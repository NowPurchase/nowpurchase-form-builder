// save_form smoke test: stand up a STUB of the DLMS draft API in-process, run
// the MCP server (http) pointed at it, then over OAuth: log in with a name,
// build a form, call save_form, and verify —
//   • the draft is written to the (stub) DLMS API with the service-key bearer
//   • created_by.name comes from the login screen
//   • the returned URL is a short ?form= preview link (not a giant hash)
//   • the read endpoint returns the form_json
//   • re-saving overwrites the SAME draft_id (stable URL)
//   • a wrong/no service key is rejected by the stub (write stays gated)
//
// Run: npm run test:mcp-save
import http from 'node:http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = process.env.MCP_SERVER_PATH || path.join(__dirname, 'mcp-formengine.mjs');

const MCP_PORT = 8775;
const DLMS_PORT = 8776;
const KEY = 'test-service-key';
const PASSWORD = 'testpass';
const NAME = 'Asha QA';
const BASE = `http://127.0.0.1:${MCP_PORT}`;
const DLMS_BASE = `http://127.0.0.1:${DLMS_PORT}`;
const REDIRECT = 'http://localhost:9999/callback';
const b64 = (b) => b.toString('base64url');
const text = (r) => r.content?.map((c) => c.text).join('\n') ?? '';

let pass = 0, fail = 0; const fails = [];
const check = (l, c) => { c ? pass++ : (fail++, fails.push(l)); console.log(c ? '✅' : '❌', l); };

// ---- stub DLMS draft API (matches the backend contract) ----
const drafts = new Map();
let lastAuth = null;
const stub = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (req.method === 'POST' && url === '/api/v1/admin/template-draft-mcp') {
    lastAuth = req.headers.authorization || '';
    if (lastAuth !== `Bearer ${KEY}`) { res.writeHead(401).end('{"error":"bad key"}'); return; }
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      let b; try { b = JSON.parse(body); } catch { res.writeHead(422).end('{}'); return; }
      if (!b.form_json || (!b.form_json.form && !b.form_json.sections)) { res.writeHead(400).end('{"error":"no form/sections"}'); return; }
      if (!b.created_by?.name) { res.writeHead(422).end('{"error":"created_by.name required"}'); return; }
      const id = b.draft_id || b64(randomBytes(16));
      drafts.set(id, { draft_id: id, name: b.name, created_by: b.created_by, form_json: b.form_json, updated_at: '2026-06-28T00:00:00Z' });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ draft_id: id, updated_at: '2026-06-28T00:00:00Z' }));
    });
    return;
  }
  const m = url.match(/^\/api\/v1\/admin\/template-draft-mcp\/(.+)$/);
  if (req.method === 'GET' && m) {
    const d = drafts.get(decodeURIComponent(m[1]));
    if (!d) { res.writeHead(404).end('{"error":"not found"}'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(d));
    return;
  }
  res.writeHead(404).end('{}');
});

async function waitReady(ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch { /* */ } await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

async function session() {
  const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
  const client = await (await fetch(asm.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'save', redirect_uris: [REDIRECT], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none' }) })).json();
  const v = b64(randomBytes(32)); const ch = b64(createHash('sha256').update(v).digest());
  const q = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: ch, code_challenge_method: 'S256', scope: 'mcp', state: 's' });
  const good = await fetch(asm.authorization_endpoint, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(q), mcp_name: NAME, mcp_password: PASSWORD }) });
  const code = new URL(good.headers.get('location')).searchParams.get('code');
  const tok = (await (await fetch(asm.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: v, client_id: client.client_id, redirect_uri: REDIRECT }) })).json()).access_token;
  const t = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tok}` } } });
  const m = new Client({ name: 'save', version: '0' }, { capabilities: {} }); await m.connect(t); return m;
}

let code = 1;
const proc = spawn('node', [serverPath], {
  env: { ...process.env, MCP_TRANSPORT: 'http', PORT: String(MCP_PORT), MCP_AUTH_PASSWORD: PASSWORD, MCP_PUBLIC_URL: BASE, PREVIEW_BASE_URL: 'http://localhost:5173', DLMS_API_BASE: DLMS_BASE, DLMS_SERVICE_KEY: KEY },
  stdio: ['ignore', 'inherit', 'inherit'],
});
try {
  await new Promise((r) => stub.listen(DLMS_PORT, r));
  check('stub DLMS API up', true);
  if (!(await waitReady())) throw new Error('mcp server not ready');

  const mcp = await session();
  const call = (n, a = {}) => mcp.callTool({ name: n, arguments: a }).then(text);
  await call('new_form');
  await call('add_section', { container_name: 'heat_details' });
  await call('add_field', { section: 'heat_details', field_type: 'text', label: 'Heat No' });

  const saved = await call('save_form', { name: 'Casting QMS' });
  const url = (saved.match(/https?:\/\/\S+/) || [])[0] || '';
  check('save_form returns a short ?form= preview URL', /\/preview\?form=/.test(url) && url.length < 300);
  check('write used the service-key bearer', lastAuth === `Bearer ${KEY}`);
  check('exactly one draft stored', drafts.size === 1);
  const stored = [...drafts.values()][0];
  check('created_by.name came from the login screen', stored.created_by?.name === NAME);
  check('stored form_json has the built field', JSON.stringify(stored.form_json).includes('heat_details__heat_no'));

  // the preview page would fetch the inner ?form= URL — verify it returns the form
  const fetchUrl = decodeURIComponent((url.split('?form=')[1] || ''));
  const readBack = await (await fetch(fetchUrl)).json();
  check('read endpoint returns the form_json', JSON.stringify(readBack.form_json).includes('heat_details__heat_no'));

  // re-save → same draft_id (stable URL, overwrite)
  await call('add_field', { section: 'heat_details', field_type: 'number', label: 'Pouring Temp' });
  const saved2 = await call('save_form', {});
  const url2 = (saved2.match(/https?:\/\/\S+/) || [])[0] || '';
  check('re-save overwrites the same draft (stable URL)', url2 === url && drafts.size === 1);
  check('overwrite updated the stored form', JSON.stringify([...drafts.values()][0].form_json).includes('heat_details__pouring_temp'));

  // new_form resets the draft → next save creates a NEW draft
  await call('new_form');
  await call('add_section', { container_name: 'fresh' });
  await call('save_form', {});
  check('new_form starts a fresh draft', drafts.size === 2);

  // stub rejects a write without the key (write stays gated)
  const badKey = await fetch(`${DLMS_BASE}/api/v1/admin/template-draft-mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form_json: { form: {} }, created_by: { name: 'x' } }) });
  check('write without service key is rejected (401)', badKey.status === 401);

  await mcp.close();
  console.log(`\nmcp-save-smoke: ${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:', fails.join(' | '));
  code = fail === 0 ? 0 : 1;
} catch (e) {
  console.log('❌ threw:', e.message);
  code = 1;
} finally {
  proc.kill('SIGTERM');
  stub.close();
}
process.exit(code);
