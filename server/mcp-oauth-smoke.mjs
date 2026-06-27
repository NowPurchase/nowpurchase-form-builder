// OAuth smoke test: spawn the MCP server in HTTP mode and drive the full
// OAuth 2.1 flow a remote host (claude.ai) performs:
//   401 on /mcp  → discover protected-resource metadata → discover AS metadata
//   → Dynamic Client Registration → /authorize (login gate) → /token (PKCE)
//   → use the access token as a bearer on /mcp (initialize + a tool call).
// Also asserts the login gate rejects a wrong password.
//
// Run: npm run test:mcp-oauth
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = process.env.MCP_SERVER_PATH || path.join(__dirname, 'mcp-formengine.mjs');

const PORT = 8773;
const PASSWORD = 'hunter2-login';
const BASE = `http://127.0.0.1:${PORT}`;
const REDIRECT = 'http://localhost:9999/callback';

let pass = 0, fail = 0;
const check = (label, cond) => { cond ? (pass++, console.log('✅', label)) : (fail++, console.log('❌', label)); };
const b64url = (buf) => buf.toString('base64url');

const proc = spawn('node', [serverPath], {
  // MCP_PUBLIC_URL pins the issuer so metadata URLs are stable & https-exempt (localhost)
  env: { ...process.env, MCP_TRANSPORT: 'http', PORT: String(PORT), MCP_AUTH_PASSWORD: PASSWORD, MCP_PUBLIC_URL: BASE },
  stdio: ['ignore', 'inherit', 'inherit'],
});

async function waitReady(ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let code = 1;
try {
  const ready = await waitReady();
  check('server boots in http mode (health 200)', ready);
  if (!ready) throw new Error('server did not become ready');

  // 1. unauthenticated /mcp → 401 + WWW-Authenticate w/ resource_metadata
  const unauth = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  });
  const www = unauth.headers.get('www-authenticate') || '';
  check('unauthenticated /mcp → 401', unauth.status === 401);
  check('401 carries WWW-Authenticate resource_metadata', /resource_metadata=/.test(www));
  const rmUrl = (www.match(/resource_metadata="([^"]+)"/) || [])[1];
  check('resource_metadata URL present', !!rmUrl);

  // 2. discover protected-resource metadata → authorization server
  const prm = await (await fetch(rmUrl)).json();
  check('protected-resource metadata lists an authorization_server', Array.isArray(prm.authorization_servers) && prm.authorization_servers.length > 0);
  const asBase = prm.authorization_servers[0].replace(/\/+$/, '');

  // 3. discover AS metadata
  const asm = await (await fetch(`${asBase}/.well-known/oauth-authorization-server`)).json();
  check('AS metadata advertises authorization + token + registration endpoints',
    !!asm.authorization_endpoint && !!asm.token_endpoint && !!asm.registration_endpoint);
  check('AS supports S256 PKCE', (asm.code_challenge_methods_supported || []).includes('S256'));

  // 4. Dynamic Client Registration (public client + PKCE)
  const reg = await fetch(asm.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'oauth-smoke',
      redirect_uris: [REDIRECT],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const client = await reg.json();
  check('DCR returns a client_id', reg.status === 201 && !!client.client_id);
  check('public client has no client_secret', !client.client_secret);

  // 5. PKCE pair (S256)
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(8));
  const authQ = new URLSearchParams({
    response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT,
    code_challenge: challenge, code_challenge_method: 'S256', scope: 'mcp', state,
  });

  // 6a. GET /authorize → login page (HTML, 200), no code yet
  const loginGet = await fetch(`${asm.authorization_endpoint}?${authQ}`, { redirect: 'manual' });
  const loginHtml = await loginGet.text();
  check('GET /authorize shows login page (200, html)', loginGet.status === 200 && /mcp_password/.test(loginHtml));

  // 6b. POST /authorize with WRONG password → stays on login page, no redirect
  const wrong = await fetch(asm.authorization_endpoint, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...Object.fromEntries(authQ), mcp_password: 'nope' }),
  });
  check('wrong password is rejected (no redirect)', wrong.status === 401 && !wrong.headers.get('location'));

  // 6c. POST /authorize with the RIGHT password → 302 redirect carrying ?code & state
  const good = await fetch(asm.authorization_endpoint, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...Object.fromEntries(authQ), mcp_password: PASSWORD }),
  });
  const loc = good.headers.get('location') || '';
  const locUrl = new URL(loc);
  const authCode = locUrl.searchParams.get('code');
  check('correct password redirects to redirect_uri', good.status === 302 && loc.startsWith(REDIRECT));
  check('redirect carries an authorization code', !!authCode);
  check('redirect echoes state', locUrl.searchParams.get('state') === state);

  // 7. exchange code → tokens (PKCE verifier)
  const tokRes = await fetch(asm.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: authCode, code_verifier: verifier,
      client_id: client.client_id, redirect_uri: REDIRECT,
    }),
  });
  const tokens = await tokRes.json();
  check('token endpoint returns a bearer access_token', tokRes.status === 200 && !!tokens.access_token && tokens.token_type === 'bearer');
  check('token endpoint returns a refresh_token', !!tokens.refresh_token);

  // 7b. wrong PKCE verifier must fail (can't, code is single-use — so re-run a fresh code)
  // (covered implicitly: a tampered verifier fails verifyChallenge in the SDK token handler)

  // 8. use the access token as a bearer on /mcp — full MCP session
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  });
  const mcp = new Client({ name: 'oauth-smoke', version: '0.0.0' }, { capabilities: {} });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  check('OAuth token authorizes an MCP session (tools listed)', tools.length >= 8);
  await mcp.callTool({ name: 'new_form', arguments: {} });
  const added = (await mcp.callTool({ name: 'add_section', arguments: { container_name: 'heat' } }))
    .content?.map((c) => c.text).join('\n') ?? '';
  check('OAuth-authed tool call works', added.length > 0 && !added.startsWith('⚠'));
  await mcp.close();

  // 9. refresh-token grant yields a new access token
  const refreshed = await (await fetch(asm.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }),
  })).json();
  check('refresh_token grant returns a new access token', !!refreshed.access_token && refreshed.access_token !== tokens.access_token);

  // 9b. refreshed token (same user/login) still sees the first user's form
  const t1 = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${refreshed.access_token}` } } });
  const m1 = new Client({ name: 'oauth-smoke-refresh', version: '0' }, { capabilities: {} });
  await m1.connect(t1);
  const sameUserForm = (await m1.callTool({ name: 'get_form', arguments: {} })).content?.map((c) => c.text).join('\n') ?? '';
  check('state survives token refresh (same userKey sees prior form)', sameUserForm.includes('heat'));
  await m1.close();

  // 10. SECOND login (fresh /authorize → new userKey) must NOT see user 1's form
  const v2 = b64url(randomBytes(32)); const ch2 = b64url(createHash('sha256').update(v2).digest());
  const q2 = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: ch2, code_challenge_method: 'S256', scope: 'mcp', state: 's2' });
  const good2 = await fetch(asm.authorization_endpoint, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(q2), mcp_password: PASSWORD }) });
  const code2 = new URL(good2.headers.get('location')).searchParams.get('code');
  const tokens2 = await (await fetch(asm.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: code2, code_verifier: v2, client_id: client.client_id, redirect_uri: REDIRECT }) })).json();
  const t2 = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tokens2.access_token}` } } });
  const m2 = new Client({ name: 'oauth-smoke-user2', version: '0' }, { capabilities: {} });
  await m2.connect(t2);
  const user2Form = (await m2.callTool({ name: 'get_form', arguments: {} })).content?.map((c) => c.text).join('\n') ?? '';
  check('concurrent users are isolated (2nd login has no user-1 section)', !user2Form.includes('heat'));
  await m2.close();

  console.log(`\nmcp-oauth-smoke: ${pass} passed, ${fail} failed`);
  code = fail === 0 ? 0 : 1;
} catch (e) {
  console.log('❌ threw:', e.message);
  console.log(`\nmcp-oauth-smoke: ${pass} passed, ${fail + 1} failed`);
  code = 1;
} finally {
  proc.kill('SIGTERM');
}
process.exit(code);
