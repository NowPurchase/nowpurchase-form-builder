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

---

## Host-side wiring still required for static lists to work live
(Not "future features" — these are the integration points the shipped frontend
depends on. Track until confirmed.)

- **`window.__NP_VARS.templateId`** must be injected by the host at render —
  `load_static_list` reads it for the GET URL. Missing → empty dropdowns (safe).
  Same `__NP_VARS` the `state/entities.js` TODO already anticipates (host base
  URLs too).
- **Confirm the route prefix** `/api/v1/static-lists` in `services/staticListApi.js`
  and in the `load_static_list` action body matches what the backend (ENG-898)
  actually registered in `app/api/v1/router.py`.
