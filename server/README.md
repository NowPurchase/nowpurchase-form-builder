# FormEngine MCP server

`mcp-formengine.mjs` is a [Model Context Protocol](https://modelcontextprotocol.io)
server (stdio) that lets MCP hosts — Claude Code, Claude Desktop, Cursor — **build
and edit DLMS forms and export valid FormEngine JSON**.

It reuses the UI-Builder's pure engine — the exact same code path the in-app
assistant and the UI buttons use:

- `applyTool(state, name, args)` — pure fold over the reducer (`src/ui-builder/assistant/tools.js`)
- `exportJSON` / `importJSON` — engine I/O (`src/ui-builder/engine/`)

So the JSON it emits is always on-convention (Repeater tables, relative cell
dataKeys, auto-derived `container__field` keys, no duplicate node keys).

## Run

```bash
npm run mcp          # node server/mcp-formengine.mjs  → "formengine MCP server ready (stdio)"
npm run test:mcp     # spawns the server + a real MCP client and runs 12 checks
```

Optional file persistence: set `FORM_FILE=/path/to/form.json` — the current form
is written there (as FormEngine JSON) after every mutating call, and loaded on start.

## Tools

- **Edit tools** (1:1 from `TOOLS`, so they never drift from the UI): `add_section`,
  `add_field`, `update_field`, `remove_field`, `set_render_when`, `add_table`,
  `set_theme`, `remove_section`, … (27 total).
- **Lifecycle tools:** `new_form`, `import_form` (paste FormEngine JSON), `export_form`
  (→ valid FormEngine JSON), `get_form` (compact summary).

Bad calls (unknown section/type/etc.) return a `⚠` message and **never corrupt state**.

## Resource

- `form://current` — the current form as FormEngine JSON.

## Register in an MCP host

Claude Desktop (`claude_desktop_config.json`) / Claude Code (`.mcp.json`):

```json
{
  "mcpServers": {
    "formengine": {
      "command": "node",
      "args": ["/Users/manhar/FrontEnd/nowpurchase-form-builder/server/mcp-formengine.mjs"]
    }
  }
}
```

Or, from this repo with Claude Code:

```bash
claude mcp add formengine -- node /Users/manhar/FrontEnd/nowpurchase-form-builder/server/mcp-formengine.mjs
```

## Typical flow

`new_form` → a few `add_section`/`add_field`/`add_table` calls → `export_form` →
paste the JSON into the UI-Builder (Import) or save it as a template.
