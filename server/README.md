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

---

## Remote deploy (HTTP — for claude.ai)

The same server speaks **two transports** from one codebase (no logic duplicated):

| Transport | Use | How |
|---|---|---|
| **stdio** (default) | local MCP hosts (Claude Desktop/Code/Cursor) | `node server/mcp-formengine.mjs` |
| **Streamable HTTP** | remote — a claude.ai **custom connector** | `MCP_TRANSPORT=http` (or set `PORT`) |

HTTP mode keeps form state **per authenticated user** — keyed by a `userKey`
baked into each OAuth login's token (stable across token refresh), **not** by
the MCP session id. This is deliberate: claude.ai issues a fresh MCP session for
**every tool call**, so per-session state would vanish between `add_section` and
`export_form`. Keying by user means a build accumulates across those calls, while
concurrent users (separate logins) stay isolated. State is in-memory on a single
instance (no DB; horizontal scaling would need an external store) — persistence
of a finished form is the chat / preview-URL→save model.

### Auth: OAuth 2.1 (what claude.ai uses)

claude.ai authenticates connectors with **OAuth**, not a static token. The server
is a self-contained OAuth 2.1 authorization server (via the MCP SDK's
`mcpAuthRouter`): it advertises discovery metadata, supports **Dynamic Client
Registration** (so claude.ai registers itself — leave Client ID/Secret blank in
the connector panel), and runs the authorization-code + **PKCE** flow. The human
proves access once via a **login password** screen during the OAuth redirect; the
client only ever receives short-lived tokens.

The login screen also asks for the user's **name** (self-reported), which is
stamped as `created_by` on any form saved via `save_form`.

The static `MCP_SHARED_SECRET` is **also** accepted as a bearer on `/mcp` — handy
for `curl`/scripts/tests — so both paths coexist.

OAuth endpoints (served at root): `/.well-known/oauth-authorization-server`,
`/.well-known/oauth-protected-resource/mcp`, `/authorize`, `/token`, `/register`.

### Saving forms (`save_form`) → DLMS draft API

`preview_url` embeds the whole form in the URL hash — fine for small forms, but a
big form makes a multi-thousand-char link that chat UIs truncate. **`save_form`**
instead persists the form to the **DLMS draft API** and returns a short
`…/preview?form=<draft-url>` link (the preview page fetches it). Re-saving
overwrites the same draft (stable URL) until `new_form`. Needs `DLMS_API_BASE` +
`DLMS_SERVICE_KEY`; if unset, `save_form` reports that saving isn't configured
(everything else still works). Writes send `Authorization: Bearer
$DLMS_SERVICE_KEY`; the public read link carries an unguessable `draft_id`.

### Env vars (HTTP mode)

| Var | Default | Meaning |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | set `http` for remote (or just set `PORT`) |
| `PORT` | `8080` | port to listen on (Render injects this) |
| `MCP_AUTH_PASSWORD` | _(falls back to `MCP_SHARED_SECRET`)_ | password users type on the OAuth login screen. **Login gate is OFF if this and `MCP_SHARED_SECRET` are both unset.** |
| `MCP_SHARED_SECRET` | _(unset)_ | optional static bearer also accepted on `/mcp`; also the default login password |
| `MCP_PUBLIC_URL` | `RENDER_EXTERNAL_URL` → `http://localhost:$PORT` | public **https** origin used in OAuth metadata. Auto-detected on Render. |
| `PREVIEW_BASE_URL` | `http://localhost:5173` | base for `preview_url` / `save_form` links (the form-builder app origin) |
| `DLMS_API_BASE` | _(unset)_ | DLMS backend origin for the draft API; enables `save_form` |
| `DLMS_SERVICE_KEY` | _(unset)_ | bearer the server sends on draft writes (server-to-server) |

Endpoints: `POST/GET/DELETE /mcp` (the MCP channel) and `GET /health` (200 `ok`).

### Deploy as a Docker image (no repo connection)

The image ships **only** the bundled artifact — Render never sees your source.

```bash
# 1. bundle server + engine → one self-contained file (server/dist/mcp.mjs)
npm run mcp:bundle

# 2. build the image (build context = server/, so the repo isn't sent)
docker build -f server/Dockerfile -t <registry>/formengine-mcp:latest server/

# 3. push to your registry (Docker Hub, GHCR, etc.)
docker push <registry>/formengine-mcp:latest
```

On **Render**: *New → Web Service → Deploy an existing image* → paste the image
URL → set env var `MCP_AUTH_PASSWORD` (the OAuth login password) → deploy. Render
pulls the image; **no GitHub connection needed**. Health check path: `/health`.
`MCP_PUBLIC_URL` is auto-detected from `RENDER_EXTERNAL_URL`. For a private
image, add a registry credential (GHCR username + a PAT with `read:packages`).

> Use a paid always-on instance — a free tier that sleeps drops in-memory
> sessions **and OAuth tokens** on cold start (clients just re-authorize).

### Register in claude.ai

A Team admin: *Settings → Connectors → Add custom connector* → the Render URL
(`https://…/mcp`). **Leave OAuth Client ID/Secret blank** — the server supports
Dynamic Client Registration, so claude.ai registers itself. On first use each
member is sent to the login screen and enters `MCP_AUTH_PASSWORD` once. The team
toggles the connector on per chat.

### Maintenance

The bundle is a **generated artifact** (like the web app's `dist/`), never
hand-edited. Change a tool in `src/ui-builder/assistant/tools.js` → the MCP
inherits it → `npm run mcp:bundle` → rebuild/push the image. One codebase, no
fork. Guard with the test suites below before shipping.

## Tests

```bash
npm run test:mcp        # stdio: spawn server + real client, build → export (28 checks)
npm run test:mcp-http   # http: auth, build→export, cross-session persistence (same user) (11 checks)
npm run test:mcp-oauth  # http: full OAuth flow + per-user persistence across refresh + concurrent-user isolation (21 checks)
npm run test:mcp-save   # http: save_form → stub DLMS draft API (service-key write, created_by, short link, overwrite) (11 checks)

# validate the BUNDLED artifact (not just source) over HTTP:
npm run mcp:bundle && MCP_SERVER_PATH=server/dist/mcp.mjs npm run test:mcp-http
npm run mcp:bundle && MCP_SERVER_PATH=server/dist/mcp.mjs npm run test:mcp-oauth
```
