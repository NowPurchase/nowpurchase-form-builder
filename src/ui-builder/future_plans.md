# Future Plans — deferred ideas

Parking lot for things we designed/discussed but chose NOT to build yet. Each
entry: what it is, why it's deferred, and what it unblocks. Pull from here when
the dependency lands or the need shows up.

Related context: [`option-lists` design] lives in memory `static-lists-architecture`;
the shipped static-list feature touches `state/actions.js` (`load_static_list`),
`engine/exportJSON.js`, `components/panels/PropertyPanel.jsx` (`FixedConfig`),
`services/staticListApi.js`.

---

## 1. Static-list Admin Config page
**What:** A page where, per `(template, customer)`, you edit each referenced
list's `{value, label}` rows and `PUT` them to `/static-lists/{template_id}`.
Template picker + customer picker at top; one small editable table per list key.
**Status:** Deferred by explicit decision ("build the admin page later").
**Ready:** `services/staticListApi.js` (`getStaticLists` / `putStaticLists`)
already exists and is waiting — the page just needs the UI.
**Unblocks:** Ops actually populating values; until then referenced dropdowns
render empty (by design — empty is safe, never errors).

## 2. Promote-helper: "typed options → referenced list"
**What:** A one-click button in a fixed dropdown's properties that converts an
inline (typed-options) dropdown into a referenced list:
1. set `options_source: 'list'`
2. auto-derive `entity_id` from the field label/dataKey
3. carry the current typed options over as the list's seed values
4. clear inline `options`
**Status:** Optional / deferred.
**Why wait:** Mainly pays off when editing legacy/imported forms (which is
itself deferred). New fields just pick "referenced list" from the start.
**Unblocks:** Fast migration of the ~64 baked static dropdowns in production —
notably the 32-item product list repeated 15× and the ~8 hardcoded
operator-name lists.

## 3. Conditional table columns
**What:** Let a table column show/hide on a **form-level** condition (e.g. hide
the "Reason" column unless `status = rejected`). Wire `col.render_when` →
each cell's `renderWhen` (`buildRepeaterCell` currently hardcodes
`render_when: null`).
**Status:** Deferred — no production form uses it yet (0 of 28).
**Note:** Conditional *whole-table* render already works (table = section,
section `render_when` applies). Conditional **rows** are NOT possible (Repeater
rows are data-driven). Conditional **cell per-row by a same-row sibling** is
hard (FormEngine `renderWhen` uses absolute `form.data.X`, can't reach a row
sibling cleanly) — out of scope unless a real need appears.

## 4. Preview-aware placeholder for referenced static lists

**What:** In the stateless `/preview#f=…` page there's no template_id / customer /
backend, so referenced lists (`options_source: 'list'`) resolve to an **empty**
dropdown (or the required-sentinel). Safe, but unhelpful — the author can't tell
the field is a referenced list or which key it's bound to.
**Idea:** Detect preview (`#f=` hash / `/preview` path) in `load_static_list` →
skip the fetch → emit ONE disabled, non-selectable placeholder naming the list,
e.g. `⟨ list: casting_grade ⟩  (values load per-customer at runtime)`. Reuses the
`disabledItemValues` sentinel mechanism, so nothing fake is submittable.
**Status:** Deferred. Current behavior (empty in preview) is correct, just not
informative.
**Unblocks:** Authors verifying a form in preview can see *that* a dropdown is a
referenced list and *which* key — instead of a mystery blank.

## 5. Static-list `entity_id` reference-awareness

**What:** The key dependency graph (`engine/keyGraph.js`) + rename warnings track
form-*internal* dataKey references. A referenced-list field's **dataKey** is
already covered (rename warns like any field). But its **`entity_id` (list key)**
is an *outward* reference — to the backend `/static-lists` store — that the graph
does NOT model.
**Two gaps:**
- *Within the form:* multiple fields can share one `entity_id` (e.g. 15 product
  dropdowns → `casting_grade`). Renaming one silently diverges from the rest. A
  light "this list key is shared by N fields" hint would help.
- *Against backend config:* an `entity_id` that doesn't match a key configured
  for that (template, customer) just renders empty. The builder can't know the
  backend config at author time.
**Higher-value fix (ties to #1, the admin page):** auto-derive the set of
`entity_id`s the form references and present exactly those for configuration —
form declares "I need these lists", config page fills them. Closes the loop
without a true cross-key warning.
**Status:** Deferred.

## 6. Surface rename warnings through the MCP/tool layer

**What:** The key dependency graph (`engine/keyGraph.js`) powers a rename warning
in the **Builder UI** — before renaming a field/section, the user sees what
references break. The **MCP/assistant** path (`update_field` / `update_section`)
just *applies* the rename; it doesn't return "this breaks N references" to the
caller. So an MCP-driven rename can silently break a cascade filter / computed /
render-when reference.
**Idea:** Have the rename tools compute `referencesTo(...)` for the old key and
include any breakages in the tool's return message (advisory), or require an
`acknowledge_breakage` flag. The graph already exists — it's just not wired into
the tool responses.
**Status:** Deferred. (Authoring parity is done; this is about *warning* parity.)

---

## Host-side wiring still required for static lists to work live

(Not "future features" — these are the integration points the shipped frontend
depends on. Track until confirmed.)

- **Template id source — RESOLVED via URL.** `load_static_list` reads the
  template id from the URL at load time (query `?template_id=`, else the 24-char
  Mongo-ObjectId path segment, e.g. `/config/:templateId`). This is switch-safe:
  navigating to another template changes the URL, so every picker resolves the
  CURRENT template — no stale global. `window.__NP_VARS.templateId` is only a
  last-ditch fallback now. ⚠ Still confirm the **render repo's** fill-URL shape
  matches (path-param 24-hex or `?template_id=`); the parser assumes one of those.
- **Host base URL** still falls back to the hardcoded staging
  `https://dlms-api-stage.iotnp.com`; move to `window.__NP_VARS.dlmsHost` for
  env-portability (same TODO as `state/entities.js`).
- **Confirm the route prefix** `/api/v1/static-lists` in `services/staticListApi.js`
  and in the `load_static_list` action body matches what the backend (ENG-898)
  actually registered in `app/api/v1/router.py`.
- **Preview page caveat:** the stateless `/preview#f=…` page has no template_id
  (form travels in the hash, no backend) → referenced lists render empty there.
  Acceptable (design-time preview, no customer context).
