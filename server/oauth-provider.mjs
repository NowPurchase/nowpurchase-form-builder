'use strict';

// ---------------------------------------------------------------------------
// oauth-provider.mjs — a small, self-contained OAuth 2.1 authorization-server
// provider for the remote (HTTP) MCP server.
//
// claude.ai (and other remote MCP hosts) authenticate connectors with OAuth,
// not a static bearer. This implements the OAuthServerProvider contract the
// MCP SDK's `mcpAuthRouter` expects, so the SDK gives us — for free —
// discovery metadata, Dynamic Client Registration (/register), the authorize
// and token endpoints, and PKCE validation. We supply the storage + the human
// login gate + token minting.
//
// Design (pilot-grade, single instance):
//   • All state is IN-MEMORY (clients, auth codes, access/refresh tokens). A
//     restart drops sessions — clients simply re-authorize. Fine for one
//     always-on instance; swap the Maps for a shared store to scale out.
//   • The login gate is a password (MCP_AUTH_PASSWORD, falling back to
//     MCP_SHARED_SECRET). The user enters it once in the browser during the
//     OAuth redirect; we never hand that password to the client — the client
//     only ever sees short-lived tokens.
//   • The static MCP_SHARED_SECRET still works as a bearer token (for tests /
//     curl / programmatic use), so nothing that worked before breaks.
// ---------------------------------------------------------------------------

import { randomUUID, randomBytes } from 'node:crypto';
import {
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

const token = () => randomBytes(32).toString('base64url');
const nowSec = () => Math.floor(Date.now() / 1000);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// minimal styled login page that re-POSTs every OAuth param back to /authorize
function loginPage({ authorizePath, params, client, error }) {
  const hidden = (name, value) =>
    value === undefined || value === null || value === ''
      ? ''
      : `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FormEngine Builder — Sign in</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
    font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#0f1115;color:#e7e9ee}
  .card{width:min(360px,92vw);background:#171a21;border:1px solid #262b36;
    border-radius:14px;padding:28px 26px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  h1{font-size:17px;margin:0 0 4px}
  p.sub{margin:0 0 20px;color:#9aa3b2;font-size:13px}
  label{display:block;font-size:12px;color:#9aa3b2;margin:0 0 6px}
  input[type=password],input[type=text]{width:100%;box-sizing:border-box;padding:11px 12px;
    border-radius:9px;border:1px solid #2b3240;background:#0f1115;color:#e7e9ee;
    font-size:15px;outline:none}
  input:focus{border-color:#4c7dff}
  button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:9px;
    background:#4c7dff;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#3d6cf0}
  .err{margin:14px 0 0;padding:9px 11px;border-radius:8px;background:#3a1d22;
    border:1px solid #5a2a30;color:#ffb4ba;font-size:13px}
  .who{margin-top:18px;color:#6b7383;font-size:11px;text-align:center}
</style></head>
<body><form class="card" method="POST" action="${esc(authorizePath)}">
  <h1>FormEngine Builder</h1>
  <p class="sub">Authorize <b>${esc(client.client_name || client.client_id)}</b> to build forms on your behalf.</p>
  <label for="nm">Your name</label>
  <input id="nm" name="mcp_name" type="text" autofocus autocomplete="name" required style="margin-bottom:14px">
  <label for="pw">Access password</label>
  <input id="pw" name="mcp_password" type="password" autocomplete="current-password" required>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  ${hidden('response_type', 'code')}
  ${hidden('client_id', client.client_id)}
  ${hidden('redirect_uri', params.redirectUri)}
  ${hidden('code_challenge', params.codeChallenge)}
  ${hidden('code_challenge_method', 'S256')}
  ${hidden('scope', (params.scopes || []).join(' '))}
  ${hidden('state', params.state)}
  ${hidden('resource', params.resource ? params.resource.href : '')}
  <button type="submit">Sign in</button>
  <div class="who">Secure connector access · MCP OAuth</div>
</form></body></html>`;
}

/**
 * Build an OAuthServerProvider for the MCP SDK's mcpAuthRouter / requireBearerAuth.
 *
 * @param {object} opts
 * @param {string} [opts.sharedSecret]   static bearer that also counts as a valid token
 * @param {string} [opts.loginPassword]  password the human enters during /authorize ('' ⇒ no gate)
 * @param {string} [opts.authorizePath]  path the login form posts back to (default '/authorize')
 * @param {number} [opts.tokenTtlSec]    access-token lifetime (default 3600)
 * @param {number} [opts.codeTtlSec]     authorization-code lifetime (default 600)
 */
export function createOAuthProvider({
  sharedSecret = '',
  loginPassword = '',
  authorizePath = '/authorize',
  tokenTtlSec = 3600,
  codeTtlSec = 600,
} = {}) {
  const clients = new Map();        // client_id -> OAuthClientInformationFull
  const codes = new Map();          // code -> { clientId, codeChallenge, redirectUri, scopes, resource, exp }
  const accessTokens = new Map();   // token -> { clientId, scopes, exp }
  const refreshTokens = new Map();  // token -> { clientId, scopes }

  const clientsStore = {
    getClient(clientId) {
      return clients.get(clientId);
    },
    // The SDK's register handler has already minted client_id/secret; we store & return.
    registerClient(client) {
      clients.set(client.client_id, client);
      return client;
    },
  };

  // userKey identifies one authorization (one human login), independent of the
  // OAuth client_id (which claude.ai may share across users) and stable across
  // token refresh. The HTTP layer keys form state by it → per-user isolation.
  function issueTokens(clientId, scopes, userKey, identity) {
    const access = token();
    const refresh = token();
    accessTokens.set(access, { clientId, scopes, userKey, identity, exp: nowSec() + tokenTtlSec });
    refreshTokens.set(refresh, { clientId, scopes, userKey, identity });
    return {
      access_token: access,
      token_type: 'bearer',
      expires_in: tokenTtlSec,
      refresh_token: refresh,
      scope: (scopes || []).join(' '),
    };
  }

  return {
    clientsStore,

    // Render the login gate, or — once the password checks out — mint a code
    // and redirect back to the client. `res.req` carries the submitted form.
    async authorize(client, params, res) {
      const req = res.req;
      const submitted = req?.body?.mcp_password;
      const name = (req?.body?.mcp_name || '').toString().trim();
      const gated = loginPassword !== '';

      // not yet authenticated → show the password page (or re-show with an error)
      if (gated && submitted !== loginPassword) {
        const error = submitted !== undefined ? 'Incorrect password. Try again.' : undefined;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(submitted !== undefined ? 401 : 200)
          .send(loginPage({ authorizePath, params, client, error }));
        return;
      }

      // authenticated (or no gate configured) → issue a one-time auth code.
      // Mint a fresh userKey for THIS login so each user's form state is isolated.
      const code = token();
      codes.set(code, {
        clientId: client.client_id,
        userKey: token(),
        identity: { name: name || 'Unknown' }, // self-reported; stamped on saved drafts
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        scopes: params.scopes || [],
        resource: params.resource ? params.resource.href : undefined,
        exp: nowSec() + codeTtlSec,
      });

      const redirect = new URL(params.redirectUri);
      redirect.searchParams.set('code', code);
      if (params.state !== undefined) redirect.searchParams.set('state', params.state);
      res.redirect(302, redirect.href);
    },

    // SDK calls this before exchange to run PKCE validation itself.
    async challengeForAuthorizationCode(client, authorizationCode) {
      const rec = codes.get(authorizationCode);
      if (!rec || rec.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid authorization code');
      }
      if (rec.exp < nowSec()) {
        codes.delete(authorizationCode);
        throw new InvalidGrantError('Authorization code expired');
      }
      return rec.codeChallenge;
    },

    async exchangeAuthorizationCode(client, authorizationCode, _verifier, redirectUri) {
      const rec = codes.get(authorizationCode);
      if (!rec || rec.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid authorization code');
      }
      codes.delete(authorizationCode); // one-time use
      if (rec.exp < nowSec()) throw new InvalidGrantError('Authorization code expired');
      if (redirectUri !== undefined && redirectUri !== rec.redirectUri) {
        throw new InvalidGrantError('redirect_uri mismatch');
      }
      return issueTokens(client.client_id, rec.scopes, rec.userKey, rec.identity);
    },

    async exchangeRefreshToken(client, refreshToken, scopes) {
      const rec = refreshTokens.get(refreshToken);
      if (!rec || rec.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid refresh token');
      }
      refreshTokens.delete(refreshToken); // rotate
      const nextScopes = scopes && scopes.length ? scopes : rec.scopes;
      return issueTokens(client.client_id, nextScopes, rec.userKey, rec.identity); // carry userKey + identity across refresh
    },

    // Validates the bearer on /mcp. Accepts both OAuth access tokens and the
    // static shared secret (the latter keeps tests / curl / scripts working).
    async verifyAccessToken(tok) {
      if (sharedSecret && tok === sharedSecret) {
        return { token: tok, clientId: 'shared-secret', scopes: [], expiresAt: nowSec() + 3600, extra: { userKey: 'shared-secret', name: 'Service' } };
      }
      const rec = accessTokens.get(tok);
      if (!rec) throw new InvalidTokenError('Invalid access token');
      if (rec.exp < nowSec()) {
        accessTokens.delete(tok);
        throw new InvalidTokenError('Access token expired');
      }
      return { token: tok, clientId: rec.clientId, scopes: rec.scopes, expiresAt: rec.exp, extra: { userKey: rec.userKey, name: rec.identity?.name } };
    },
  };
}
