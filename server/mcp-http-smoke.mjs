// HTTP smoke test: spawn the formengine MCP server in Streamable HTTP mode,
// then exercise it the way claude.ai would — over the network, with auth and
// independent per-session state. Asserts:
//   • health check
//   • shared-secret auth (401 without the bearer)
//   • full build → export flow over HTTP
//   • per-session isolation (two sessions don't share form state)
//
// Run: npm run test:mcp-http
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Defaults to the source entry; set MCP_SERVER_PATH to test the bundled artifact.
const serverPath = process.env.MCP_SERVER_PATH || path.join(__dirname, 'mcp-formengine.mjs');

const PORT = 8771;
const SECRET = 'smoke-secret';
const URL_MCP = `http://127.0.0.1:${PORT}/mcp`;
const authHeaders = { Authorization: `Bearer ${SECRET}` };

let pass = 0, fail = 0;
const check = (label, cond) => { cond ? (pass++, console.log('✅', label)) : (fail++, console.log('❌', label)); };
const text = (r) => r.content?.map((c) => c.text).join('\n') ?? '';

// --- spawn the server in HTTP mode ---
const proc = spawn('node', [serverPath], {
  env: { ...process.env, MCP_TRANSPORT: 'http', PORT: String(PORT), MCP_SHARED_SECRET: SECRET },
  stdio: ['ignore', 'inherit', 'inherit'],
});

// wait until the health endpoint answers (or time out)
async function waitReady(ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

// open an authed MCP client over HTTP (each call = its own session)
async function connectClient() {
  const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
    requestInit: { headers: authHeaders },
  });
  const client = new Client({ name: 'http-smoke', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport };
}

let code = 1;
try {
  const ready = await waitReady();
  check('server boots in http mode (health 200)', ready);
  if (!ready) throw new Error('server did not become ready');

  // 1. auth: no bearer → 401
  const noAuth = await fetch(URL_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
  check('rejects request without bearer (401)', noAuth.status === 401);

  // 2. authed client: connect + tools advertised
  const a = await connectClient();
  const { tools } = await a.client.listTools();
  const names = tools.map((t) => t.name);
  check('authed client connects + lists tools', tools.length >= 8);
  check('exposes edit + lifecycle tools', ['add_section', 'add_field', 'export_form', 'preview_url'].every((n) => names.includes(n)));

  // 3. build → export over HTTP
  await a.client.callTool({ name: 'new_form', arguments: {} });
  const sec = text(await a.client.callTool({ name: 'add_section', arguments: { container_name: 'moulding' } }));
  check('add_section over HTTP responds', sec.length > 0 && !sec.startsWith('⚠'));
  const fld = text(await a.client.callTool({ name: 'add_field', arguments: { section: 'moulding', label: 'Total Qty', field_type: 'number', required: true } }));
  check('add_field over HTTP responds', !fld.startsWith('⚠'));
  const exported = JSON.parse(text(await a.client.callTool({ name: 'export_form', arguments: {} })));
  const nodeKeys = [];
  (function walk(nodes) { (nodes || []).forEach((n) => { if (n.key) nodeKeys.push(n.key); walk(n.children); }); })(exported.form?.children || []);
  check('export produces a form', !!(exported.version || exported.form));
  check('no duplicate node keys', new Set(nodeKeys).size === nodeKeys.length);

  // 4. per-session isolation: a second client must NOT see session A's section
  const b = await connectClient();
  await b.client.callTool({ name: 'new_form', arguments: {} });
  await b.client.callTool({ name: 'add_section', arguments: { container_name: 'inspection' } });
  const aForm = JSON.parse(text(await a.client.callTool({ name: 'get_form', arguments: {} })));
  const bForm = JSON.parse(text(await b.client.callTool({ name: 'get_form', arguments: {} })));
  const aSecs = (aForm.sections || []).map((s) => s.container_name ?? s.name ?? s.key);
  const bSecs = (bForm.sections || []).map((s) => s.container_name ?? s.name ?? s.key);
  check('session A still has its own section', JSON.stringify(aForm).includes('moulding'));
  check('session B has its own section', JSON.stringify(bForm).includes('inspection'));
  check('sessions are isolated (B has no moulding)', !JSON.stringify(bForm).includes('moulding'));

  // 5. distinct session ids
  check('each session has a distinct id', a.transport.sessionId && b.transport.sessionId && a.transport.sessionId !== b.transport.sessionId);

  await a.client.close();
  await b.client.close();

  console.log(`\nmcp-http-smoke: ${pass} passed, ${fail} failed`);
  code = fail === 0 ? 0 : 1;
} catch (e) {
  console.log('❌ threw:', e.message);
  console.log(`\nmcp-http-smoke: ${pass} passed, ${fail + 1} failed`);
  code = 1;
} finally {
  proc.kill('SIGTERM');
}
process.exit(code);
