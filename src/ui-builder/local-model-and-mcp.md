# Local model assistant + FormEngine MCP server

Two ways to drive the form builder with AI, both reusing the **same pure engine**
(`src/assistant/tools.js` → `applyTool`, plus `exportJSON`/`importJSON`/the reducer):

1. **Local model tier** — the in-app Assistant runs on a local model (Qwen2.5-Coder 7B via
   Ollama). Free, private, offline; cloud (Gemini) stays a one-line fallback for big builds.
2. **FormEngine MCP server** — external agents (Claude Desktop / Claude Code / Cursor) build &
   edit DLMS forms and export valid FormEngine JSON.

---

## 1. Local model tier (Ollama)

**Verdict — is Qwen2.5-Coder 7B enough?** Yes, for everyday "small things" (add a field, make
required, set a render-when, set theme, add a small table). The assistant's tools are
high-level *slot-filling*, so the model only maps a sentence → one tool name + a few args. Route
big multi-step builds ("build the whole melting form") to cloud. `applyTool` validates every
call (unknown section/type → a `⚠` message, never corrupt state), so an occasional bad call from
a 7B degrades gracefully.

**How it's wired.** `server/assistant-proxy.mjs` gained an `ollama` provider. Ollama's running
`/api/generate` has no native function-calling, but it supports `format:"json"`, which forces
strictly-valid JSON. So the provider sends the system prompt + form summary + `focus` + a compact
tool list and asks the model to reply with exactly:

```json
{ "text": "<one short sentence>", "toolCalls": [ { "name": "<tool>", "args": { } } ] }
```

The proxy parses that into the same `{ text, toolCalls }` the browser already consumes — the
whole downstream path (`applyToolCalls` → reducer) is unchanged.

**Setup**
```bash
ollama pull qwen2.5-coder:7b      # one-time (already present here)
# server/.env:
PROVIDER=ollama
MODEL=qwen2.5-coder:7b
OLLAMA_URL=http://localhost:11434/api/generate
node server/assistant-proxy.mjs   # → assistant-proxy [ollama/qwen2.5-coder:7b]
```
Switch back to cloud anytime: set `PROVIDER=gemini` (key already in `.env`) and restart.

**Verified.** "add a number field Total Qty to moulding and make it required" → correct
`add_field` call (~5s); "show remarks when approved is not empty" → correct `set_render_when`,
with `approved` resolved to `qc__approved` when applied through the engine.

---

## 2. FormEngine MCP server

`server/mcp-formengine.mjs` (stdio, uses `@modelcontextprotocol/sdk`). It holds one in-memory
form `state` and reuses the engine, so its output is always on-convention (Repeater tables,
relative keys, etc.). Optional file persistence via `FORM_FILE=/path/to/form.json`.

**Tools** — the builder's edit tools 1:1 (generated from `TOOLS`, so they never drift):
`add_section, add_field, update_field, remove_field, set_render_when, add_table, set_theme,
remove_section` — plus lifecycle tools: `new_form`, `import_form` (paste FormEngine JSON),
`export_form` (→ valid FormEngine JSON), `get_form` (compact summary).

**Resource** — `form://current` returns the current form as FormEngine JSON.

**Flow** — in the host: `new_form` → a few `add_*` calls → `export_form` → import the JSON into
the builder UI (or save to a file). Same convention/output as the in-app assistant.

**Register (Claude Desktop / Claude Code)** — add a stdio server entry:
```json
{
  "mcpServers": {
    "formengine": {
      "command": "node",
      "args": ["/Users/manhar/form_engine_simplified/server/mcp-formengine.mjs"]
    }
  }
}
```

**Verified.** A client built `moulding` (number + supervisor) + a `charge_mix` Repeater table;
`export_form` produced `version 1`, actions `initFormData, set_operator_name`, **1 Repeater, 18
unique nodes, 0 duplicate keys**; `form://current` read back the JSON.

---

## How the two relate
- **Shared core:** `tools.js` `applyTool` + the pure engine — one source of truth.
- **In-app chat:** browser React state ← `applyToolCalls` ← proxy ← **local Qwen or cloud**.
- **MCP:** Node form-doc ← `applyTool` ← **external host**.
- Independent in v1; both emit identical, on-convention FormEngine JSON. (A live browser↔MCP
  sync is possible later but not needed now.)
