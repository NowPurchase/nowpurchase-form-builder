# MTC → DLMS: dropdown/lookup API contracts (filled)

Onboarding MTC master-data fields into the form builder's entity registry
(`state/entities.js` + `fetch_dropdown`). Contracts below are derived from the
Django backend source, not assumed. Only dropdown/lookup + auto-fill APIs are in
scope (certificate create/approve/PDF/signature/COS are out of scope).

**Source of truth (backend):**
- URLs: `casting_quality/mtc/urls.py`, `casting_quality/mtcv2/urls.py`
- Views: `casting_quality/mtc/mtc_views.py`, `casting_quality/mtc/client_views.py`, `casting_quality/mtcv2/views.py`
- Serializers: `casting_quality/mtc/client_serializers.py`, `casting_quality/mtc/mtc_serializers.py`, `casting_quality/mtcv2/serializers.py`
- Helpers: `Agnipariksha/utils.py` (`dropdown_only_view`, `CustomFilterBackend`, `MultiSearchFilter`), `casting_quality/mtc/utils.py` (`extract_query_params`)
- Auth/pagination: `Agnipariksha/settings.py`, `Agnipariksha/jwt/authentication.py`

---

## Global answers (apply to all Django/MTC entities)

| Question | Answer |
|---|---|
| Standard DLMS contract? | **none** — these are Django/DRF shapes, not the DLMS `POST /templates/{id}/dropdown` contract. All `GET`, search via `search` query param, dropdowns return a **bare root array**. |
| Pagination convention | **none for dropdowns** (hard cap 10, root array). Un-decorated list views use DRF default `LimitOffset` (`limit`/`offset`, `PAGE_SIZE=100`, `results` envelope) — but you hit those via `retrieve` (`/{id}/`) so they return a root object. |
| Response envelope | **root array** (dropdowns) / **root object** (detail retrieves). `results` envelope only on un-decorated list views you won't use as dropdowns. |

### Pagination — two regimes
- **Dropdown endpoints** (`@dropdown_only_view(limit=10)`): no pagination — hard-capped at **10 rows**, response is a **root array**. Dropdowns are *search-driven, not scrollable*; `page`/`offset` are ignored.
- **Detail/list viewsets without the decorator**: DRF default `LimitOffsetPagination` (`limit`/`offset`, `PAGE_SIZE=100`, envelope `{count,next,previous,results}`) — except `mtc_specified` which sets `pagination_class=None` (root array). Auto-fill sources are all hit via `retrieve` (`/{id}/`) → **root single object**.

### Auth (Django/MTC)
The Django backend accepts **two** schemes, tried in order (`settings.py` → `Agnipariksha/jwt/authentication.py`):
1. `Authorization: Bearer <jwt>` (`Agnipariksha.jwt.JWTAuthentication`) — same Bearer style as DLMS
2. `Authorization: Token <token>` (`drfpasswordless`/DRF legacy) — the `Token <x>` format is **confirmed correct**

You can drive these with the DLMS Bearer JWT *or* the legacy Token. **localStorage key is a frontend concern** — not determinable from the backend.

### Common quirks
- `search` supports **comma-separated OR** on `MultiSearchFilter` endpoints (micro/tensile/hardness/impact/load) and on `heats` — e.g. `?search=H123,H456`. Default match `icontains` (`^`=startswith, `=`=exact, `@`=full-text).
- The dropdown `id` is **not always the lookup id** — see per-entity notes (part_no especially).
- `tensile`/`impact`/`hardness` appear in both §1 and §2: **same endpoint** — "plain" = `?search=<text>`, "by heat" = `?heat_code=<code>` (exact filter) or `?heat=<heat_id>`.

---

## 1. Plain dropdowns

```
id:            mtc_client
label:         Customer / client
backend:       django
method:        GET
url:           …/mtc/client_dropdown/
auth:          Bearer <jwt> OR Token <token>  (DRF, customer-scoped)
search:        param=search   matches=name (icontains)
pagination:    none — capped at 10 rows, root array
filters:       []   (auto-scoped to request.user.customer)
cascade:       []
response.path: <root array>   value=id   label=name
record fields: id, name
```

```
id:            mtc_part_name
label:         Part name
backend:       django
method:        GET
url:           …/mtc/part_name_dropdown/
auth:          Bearer/Token
search:        param=search   matches=cast_part_name__name (icontains)
pagination:    none — 10 rows, root array
filters:       [ { key:client, values:<Client id>, default:none } ]
cascade:       [ { param:client, fromField:mtc_client } ]
response.path: <root array>   value=id (=cast_part_name.id)   label=name (=cast_part_name.name)
record fields: id, name
note:          distinct on cast_part_name. `client` is optional but intended as a cascade.
```

```
id:            mtc_part_no
label:         Part number
backend:       django
method:        GET
url:           …/mtc/part_no_dropdown/
auth:          Bearer/Token
search:        param=search   matches=cast_part_no__number (icontains)
pagination:    none — 10 rows, root array
filters:       [ {key:client,...}, {key:cast_part_name,...} ]
cascade:       [ { param:client, fromField:mtc_client },
                 { param:cast_part_name, fromField:mtc_part_name } ]
response.path: <root array>   value=id   label=name (=cast_part_no.number)
record fields: id, name
⚠ FLAG:        value `id` is the **ClientOrder PK**, NOT cast_part_no.id (no source override
               on the serializer). The §2 part-spec cascade key `cast_part_no` expects a
               part_no id — pass the right one; don't reuse this row's `id` as cast_part_no.
```

```
id:            mtc_grade            # V2
label:         Grade
backend:       django
method:        GET
url:           …/mtc/v2/grade_dropdown/
auth:          Bearer/Token
search:        param=search   matches=grade__name (icontains)
pagination:    none — 10 rows, root array
filters:       [ { key:client, values:<Client id>, default:none } ]
cascade:       [ { param:client, fromField:mtc_client } ]
response.path: <root array>   value=grade_id   label=name (=grade.name)
record fields: id (=MtcSpecified id), grade_id, name, category_id (=grade.grade_category.id)
note:          distinct on grade. Use grade_id (not id) as the value; category_id is a
               handy auto-fill into a grade-category field.
```

```
id:            mtc_heat
label:         Heats
backend:       django
method:        GET
url:           …/mtc/heats/
auth:          Bearer/Token
search:        param=search   matches=Heat.heat_name (startswith, comma-OR)
pagination:    none — 10 rows, root array
filters:       [ {key:grade_id → cm_heat.grade_id}, {key:part_no → cm_heat.part_no_id},
                 {key:id → cm_heat.id},
                 {key:heat_date__gte}, {key:heat_date__lte} ]
cascade:       [ { param:part_no, fromField:mtc_part_no(part_no id) },
                 { param:grade_id, fromField:mtc_grade } ]
response.path: <root array>   value=id (=cm_heat.id, i.e. Heat id)   label=name (=heat_name)
record fields: id, name, heat_date, part_number, part_no_id
⚠ FLAG:        source = SpectrometerReading (FINAL/PIT), distinct per heat, **last 90 days only**.
               search is **startswith** here (not icontains) and the `part_no` filter key
               is a Heat part_no id — different from the part_no dropdown's row id.
```

```
id:            mtc_tensile / mtc_impact / mtc_hardness / mtc_load / mtc_micro
label:         Tensile / Impact / Load / Hardness / Micro analysis
backend:       django
method:        GET
url:           …/mtc/tensile_dropdown/  | impact_dropdown/ | load_test_dropdown/
               | hardness_dropdown/ | micro_dropdown/
auth:          Bearer/Token
search:        param=search   matches=heat_code (icontains, comma-OR)
pagination:    none — 10 rows, root array
filters:       [ {key:heat → heat_id}, {key:heat_code → heat_code} ]
cascade:       [ { param:heat_code, fromField:mtc_heat(name) }   # or param:heat ← heat id ]
response.path: <root array>   value=id   label=heat_code (no dedicated label field — build one)
record fields (per type):
  tensile : id,is_parsed,heat_code,tensile_strength,yield_strength,elongation,
            reduction_in_area,grade,partname,partno,raw_data,part_name,part_number
  impact  : id,is_parsed,heat_code,specification,average_toughness,grade,partname,partno,
            heat,raw_data,part_name,part_number
  hardness: id,is_parsed,heat_code,low_limit,high_limit,avg_hardness,grade,partname,partno,
            heat,raw_data,part_name,part_number
  load    : id,is_parsed,heat_code,ps_specification,ps_actual,grade,partname,partno,heat,
            raw_data,part_name,part_number
  micro   : id,is_parsed,heat_code,nodule_count,avg_nodularity,pearlite,ferrite,carbide,
            grade,partname,partno,heat,raw_data,part_name,part_number
⚠ FLAG:        only is_parsed=True rows. These return full test records — they double as
               auto-fill sources (test values already in the dropdown payload, so picking
               one can fill the test fields without a second call).
               micro_dropdown retrieve (/{id}/) returns micro_images, NOT the test row.
```

## 2. Cascading dropdowns

```
id:            mtc_part_spec        # V2
label:         Part spec
backend:       django
method:        GET
url:           …/mtc/v2/mtc_specified_dropdown/?cast_part_no={part_no_id}
auth:          Bearer/Token
search:        param=search   matches=grade__name, part_no__number, part_name__name, client__name
pagination:    none (pagination_class=None) — root array, NOT capped at 10
filters/cascade: filter_map → client→customer, cast_part_name→part_name, cast_part_no→part_no
                 filterset_fields → grade, part_no, part_name, customer, client_id
                 [ { param:cast_part_no, fromField:mtc_part_no } ]
response.path: <root array>
               value=id   label=part_no  (or compose grade + part_no)
record fields: id, part_no(=number), part_name(=part_no.part_name str), grade(=name),
               grade_id, part_no_id, client(=name), client_id, part_name_id
⚠ FLAG:        `client` filter key maps to **customer**, and there's also a `client_id`
               filterset field — pick deliberately. `part_name` field is sourced from
               part_no.part_name (the related PartName's str), which may differ from part_name_id.
```

> Tensile/Impact/Hardness "by heat" are the §1 endpoints with `?heat_code={code}` or
> `?heat={heat_id}` — already covered above; no separate registration needed.

## 3. Auto-fill / detail sources (root single object via `/{id}/` retrieve)

```
id:            mtc_part_spec_detail     # V2
url:           …/mtc/v2/mtc_specified/{id}/      (id = MtcSpecified id, e.g. from mtc_part_spec)
auth:          Bearer/Token   pagination: n/a (retrieve)
response.path: <root object>
auto-fill fields:
  id, customer,
  client {id, name, …},
  grade {id, name, grade_code, grade_category},
  part_name {id, name}, part_no {id, number},
  data { … customer-specific requirements as a JSON/HStore dict …,
         target_chemistry: [ {element, min, max, relaxed_min, relaxed_max} ] }
⚠ FLAG:        target_chemistry is INJECTED live from PartTargetChemistry (FINAL for IF /
               LADLE for EAF furnace_type) in "live" mode; in "saved" mode it's read from
               stored data. Hardness/tensile/micro requirements live as keys inside `data`
               and vary per customer — treat `data` as dynamic, not a fixed schema.
```

```
id:            mtc_client_order_detail
url:           …/mtc/client_order/{id}/         (id = ClientOrder id)
auth:          Bearer/Token   pagination: n/a (retrieve)
response.path: <root object>
auto-fill fields:
  id, part_no, part_name, material_specs,
  type_distribution_std_name, phase_distribution_std_name,
  client {id, name, …}, cast_part_name {id, name}, cast_part_no {id, number},
  client_order_hardness {id, low_limit, high_limit},
  client_order_tensile {id, tensile_strength, yield_strength, elongation},
  client_order_tc [ {element, element__symbol, min_value, max_value} ]
note:          LIST on this viewset IS paginated (LimitOffset, results-envelope) — but you
               only need the detail retrieve for auto-fill.
```

```
id:            mtc_heat_detail
url:           …/mtc/heats/{id}/                (id = cm_heat / Heat id)
auth:          Bearer/Token   pagination: n/a (retrieve)
response.path: <root ARRAY>  (retrieve returns many=True!)
fields:        [ {id, name, heat_date, part_number, part_no_id} ]
⚠ FLAG:        despite the "full chemistry" expectation, this returns the SAME dropdown
               shape (heat meta only), as an ARRAY, NOT chemistry. For chemistry use
               mtc_final_reading below.
```

```
id:            mtc_final_reading
url:           …/mtc/final_reading/{id}/        (id = Heat id)
auth:          Bearer/Token   pagination: n/a (retrieve)
response.path: <root object>   (latest FINAL/PIT SpectrometerReading for the heat)
auto-fill fields:
  id, in_range, in_tolerance, reading_created_at,
  spectro_reading_avg [ {element, element_symbol, recovery_rate, in_range,
                         deviation, in_tolerance} ]
⚠ FLAG:        THIS is the per-element chemistry source (spectro_reading_avg). Cascade it
               from mtc_heat (whose value is the Heat id). recovery_rate rounded to 3 dp.
```

---

## Flags — decide before registering

1. **Heat "full chemistry" comes from `final_reading/{id}/`, not `heats/{id}/`.** The latter
   just re-emits heat metadata as an array. Point the auto-fill picker at `final_reading`.
2. **`part_no_dropdown` value is the ClientOrder PK**, not a part_no id — so feeding it into
   `mtc_specified_dropdown?cast_part_no=` (which wants a part_no id) is a bug waiting to happen.
   Use `mtc_heat.part_no_id` or `mtc_part_spec.part_no_id` as the real part_no id source.
3. **Dropdowns are search-only (10-row cap, no paging).** If any list needs to be browsable
   rather than typed-into, the backend needs a paginated variant — flag it now.
4. **localStorage key + JWT acceptance** are the only genuinely open items, both frontend/
   cross-host: confirm the DLMS Bearer JWT validates against `*.api.nowpurchase.com`; else use
   the legacy `Token` + its own storage key.
5. **`mtc_heat` is windowed to the last 90 days** and to FINAL/PIT readings — older heats won't
   appear. If certificates can reference older heats, this window is a constraint to revisit.
6. **`mtc_specified_dropdown` (part_spec) is uncapped** (`pagination_class=None`) unlike the
   other dropdowns — a tenant with many specs returns the whole set in one array.
7. **`*_dropdown` rows lack a clean display label** for tensile/impact/hardness/load/micro
   (only `heat_code` + raw values) — compose a label client-side.
8. **`client`/`customer` filter-key collision** on `mtc_specified_dropdown`: `client` maps to
   `customer`, and there's a separate `client_id` field. Choose the intended one explicitly.
