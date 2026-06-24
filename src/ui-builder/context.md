# ui-builder — context for Claude

**What this is:** a self-contained, convention-enforcing DLMS form builder for
**non-technical users**. It produces valid **FormEngine (@react-form-builder) 7.9.0 JSON**
with dataKeys auto-derived and CSS curated — the opposite of the raw `@react-form-builder/designer`
(`NewForm.jsx`), which lets anyone make arbitrary keys/CSS. It is **additive**: a new
left-nav page **"UI-Builder Simplified"** at route **`/ui-builder`**.

## Where things live
- `src/ui-builder/engine/` — `exportJSON.js` (builder state → FormEngine JSON), `importJSON.js`, `dataKey.js` (naming rules).
- `src/ui-builder/state/` — `formState.js` (reducer + factories), `actions.js` (auto-managed form actions), `themes.js`, `tokens.js`.
- `src/ui-builder/assistant/` — `tools.js` (the **tool layer**: `applyTool` + `TOOLS`), `runtime.js` (assistant turn runner).
- `src/ui-builder/components/` — `Builder.jsx` (root) + `panels/` (Section/Canvas/Property/Chat) + `Icon.jsx`.
- `src/ui-builder/styles.css` — **scoped under `.npui-builder`** (do NOT unscope; it must not touch host Tailwind/rsuite).
- `src/components/pages/UiBuilderSimplified.jsx` — the page (host `AppShell` + `<Builder>`).
- `src/ui-builder/tools.test.mjs` — strict tests (`npm run test:ui-builder`).

## It does NOT import @react-form-builder
This builder only *generates* FormEngine JSON; it never renders forms. So there's no
version/federation coupling. The host's `ViewForm.jsx` renders the output.

## How it wires into the app (only 2 host edits — leave the rest alone)
- `src/App.jsx` — one `<Route path="/ui-builder">`.
- `src/components/shared/AppShell.jsx` — one `NAV` entry.
- **Save:** `Builder` `onSaveTemplate(exported)` → `adminTemplateApi.createDynamicLog({ form_json: JSON.stringify(exported), ... })`. Templates already store FormEngine JSON in `form_json`, so it drops straight in.
- **Load:** `?edit=<id>` → `getDynamicLog` → `importJSON` → builder state.
- **Do not modify** host services, `NewForm`, `ViewForm`, etc.

## The conventions the engine enforces (the whole point — keep them)
- **dataKey** = `container_name__field` (lowercase); nested containers chain: `parent__child__field`. Users never type a dataKey — it's derived from section prefix + label.
- **Tables = FormEngine `Repeater`** (kind `repeater`): array key = the container name; **cell dataKeys are RELATIVE** (`material`, `qty`), not `table__0__material`; add/remove rows use the **built-in `common` actions** `addRow`/`removeRow` (no custom code); initial rows seeded via `props.value`; `min_rows` (default 1) stops deleting the last row.
- **Computed fields** (`add_total`) → read-only `RsInput` with a `{computeType:"function", fnSource}` value (sum/count/avg/min/max over a table column, or a raw expression).
- **Display-only types** (`header`, `divider`, `computed`) carry no dataKey.
- **Custom CSS** (advanced): `section.custom_css` and `field.custom_css` layer raw CSS on top of the theme (object = theme defaults, string = user overrides).
- **Specials:** `supervisor` (auto-filled, read-only), `upload`→`RsCameraCapture`, async dropdowns store `__label` + wire `fetch_dropdown`.

## Tool layer (drives both the in-app assistant and the MCP server)
`applyTool(state, name, args) → { state, message }` is a **pure fold over the reducer** — the
same code path the UI buttons use, so tools can't emit malformed JSON. ~23 form-editing tools
(add/update/move/remove sections, fields, columns; render-when; validations; computed totals;
custom CSS; meta). Bad calls return a `⚠` message and **don't mutate** state.

## Rules when changing the engine
1. Keep `tools.js` the single source of truth for tools (the in-app assistant and any MCP server both read `TOOLS`).
2. After any engine/state/tools change, run **`npm run test:ui-builder`** (60 strict cases: happy paths, failure-must-not-mutate, export invariants — no duplicate node keys, no legacy `__N__` keys, Repeater round-trip).
3. Keep `styles.css` scoped under `.npui-builder`.
4. The assistant runs in **mock mode** unless `VITE_ASSISTANT_ENDPOINT` is set (point it at the proxy for a local/cloud model). The proxy + MCP server are backend pieces, deployed separately.

See `SPEC.md` (if present here) for the full FormEngine 7.9.0 JSON contract + Repeater details.
