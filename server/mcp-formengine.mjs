'use strict';

// ---------------------------------------------------------------------------
// mcp-formengine.mjs — a Model Context Protocol server that lets MCP hosts
// (Claude Desktop / Claude Code / Cursor / claude.ai) build & edit DLMS forms
// and export valid FormEngine JSON.
//
// It REUSES the builder's pure engine — the same code path the in-app
// assistant and the UI buttons use — so output is always on-convention.
//
// It holds a DOCUMENT of one or more STEPS. One step → a plain single
// FormEngine form. Multiple steps → a multi-step form ({ sections: [...] }).
// Edit tools apply to the ACTIVE step; step tools manage the list.
//
// TWO TRANSPORTS (same engine, no logic duplication):
//   • stdio (default)  — spawned locally by an MCP host. `node mcp-formengine.mjs`
//   • Streamable HTTP  — remote, for claude.ai. Per-session in-memory state
//     keyed by Mcp-Session-Id; OAuth 2.1 auth (the model claude.ai connectors
//     use) with a static-shared-secret bearer also accepted (tests/scripts).
//   Selected by MCP_TRANSPORT=http (or by setting PORT). Env:
//     PORT (default 8080)
//     MCP_SHARED_SECRET   bearer accepted directly + default login password
//     MCP_AUTH_PASSWORD   login password for the OAuth browser gate (falls
//                         back to MCP_SHARED_SECRET; gate off if both unset)
//     MCP_PUBLIC_URL      public origin for OAuth metadata (defaults to
//                         RENDER_EXTERNAL_URL, then http://localhost:$PORT)
//
// Run:   node server/mcp-formengine.mjs            # stdio
//        MCP_TRANSPORT=http PORT=8080 node ...      # http
// ---------------------------------------------------------------------------

import fs from 'fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  ListToolsRequestSchema, CallToolRequestSchema,
  ListResourcesRequestSchema, ReadResourceRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';

import { createOAuthProvider } from './oauth-provider.mjs';

import { initialState } from '../src/ui-builder/state/formState.js';
import { TOOLS, applyTool } from '../src/ui-builder/assistant/tools.js';
import { summarizeState } from '../src/ui-builder/assistant/runtime.js';
import { exportJSON } from '../src/ui-builder/engine/exportJSON.js';
import { importJSON } from '../src/ui-builder/engine/importJSON.js';
import { exportMultiStep, importMultiStep } from '../src/ui-builder/engine/multiStep.js';
import { buildPreviewUrl } from '../src/ui-builder/preview-url.js';

const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL || 'http://localhost:5173';

// ---- document helpers (stateless / shared) --------------------------------
const FORM_FILE = process.env.FORM_FILE || null;
const emptyStep = (name) => ({ name: name || 'Step 1', state: { ...initialState } });

// Load the seed document. Only the stdio (single-session) path persists to /
// loads from FORM_FILE; HTTP sessions always start empty.
function loadDoc() {
  if (FORM_FILE && fs.existsSync(FORM_FILE)) {
    try {
      const json = JSON.parse(fs.readFileSync(FORM_FILE, 'utf8'));
      const steps = importMultiStep(json);
      if (steps) return { steps, active: 0 };
      return { steps: [{ name: 'Step 1', state: importJSON(json) }], active: 0 };
    } catch { /* ignore */ }
  }
  return { steps: [emptyStep()], active: 0 };
}

const ok = (text) => ({ content: [{ type: 'text', text }] });

// ---- lifecycle + step tools (beyond the builder's edit tools) -------------
const LIFECYCLE_TOOLS = [
  { name: 'new_form', description: 'Reset to a single empty form.', parameters: { type: 'object', properties: {} } },
  {
    name: 'import_form',
    description: 'Load an existing form to edit — accepts a single FormEngine form OR a multi-step form. Pass the full JSON as a string.',
    parameters: { type: 'object', properties: { json: { type: 'string', description: 'the form JSON (single or multi-step)' } }, required: ['json'] },
  },
  { name: 'export_form', description: 'Return the current form as valid JSON (single FormEngine form, or a multi-step {sections:[…]} when there are multiple steps).', parameters: { type: 'object', properties: {} } },
  { name: 'get_form', description: 'Return a compact summary of the current form (steps, sections, fields, keys).', parameters: { type: 'object', properties: {} } },
  { name: 'preview_url', description: 'Return a shareable URL that renders the current form live in the browser (no login needed). Works for single and multi-step forms.', parameters: { type: 'object', properties: {} } },
  // --- multi-step management ---
  { name: 'add_step', description: 'Add a new step (page) — makes this a multi-step form — and switch edits to it.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'step name, e.g. "Inspection"' } } } },
  { name: 'switch_step', description: 'Switch the active step that subsequent edits apply to (by name or 0-based index).', parameters: { type: 'object', properties: { name: { type: 'string' }, index: { type: 'integer' } } } },
  { name: 'rename_step', description: 'Rename the active step.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'new name' } }, required: ['name'] } },
  { name: 'remove_step', description: 'Remove a step by name or index (cannot remove the last remaining step).', parameters: { type: 'object', properties: { name: { type: 'string' }, index: { type: 'integer' } } } },
  { name: 'list_steps', description: 'List the steps (pages) with their section counts and which is active.', parameters: { type: 'object', properties: {} } },
];

// ---------------------------------------------------------------------------
// Per-session server factory. Each call owns its own `doc` (form state), so an
// HTTP deployment can run many independent sessions concurrently. The handler
// logic is identical to the single-session path — only the state is scoped.
// ---------------------------------------------------------------------------
function createServer({ enablePersist = false } = {}) {
  let doc = enablePersist ? loadDoc() : { steps: [emptyStep()], active: 0 };

  const cur = () => doc.steps[doc.active].state;
  const setCur = (s) => { doc.steps[doc.active].state = s; };
  // single step → plain FormEngine form; multiple steps → multi-step wrapper
  const currentExport = () => (doc.steps.length > 1 ? exportMultiStep(doc.steps) : exportJSON(cur()));

  const persist = () => {
    if (enablePersist && FORM_FILE) {
      try { fs.writeFileSync(FORM_FILE, JSON.stringify(currentExport(), null, 2)); } catch { /* ignore */ }
    }
  };

  const resolveStepIndex = (args) => {
    if (typeof args.index === 'number') return args.index;
    if (args.name) return doc.steps.findIndex((s) => s.name === args.name);
    return doc.active;
  };

  const server = new Server(
    { name: 'formengine-builder', version: '0.2.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  // tools = the builder's edit tools (1:1, never drift) + lifecycle/step tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS, ...LIFECYCLE_TOOLS].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters || { type: 'object', properties: {} },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;

    switch (name) {
      case 'new_form':
        doc = { steps: [emptyStep()], active: 0 };
        persist();
        return ok('Started a new empty form.');

      case 'import_form': {
        try {
          const json = typeof args.json === 'string' ? JSON.parse(args.json) : args.json;
          const steps = importMultiStep(json);
          if (steps) {
            doc = { steps, active: 0 };
            persist();
            return ok(`Imported a multi-step form with ${steps.length} step(s): ${steps.map((s) => s.name).join(', ')}.`);
          }
          doc = { steps: [{ name: 'Step 1', state: importJSON(json) }], active: 0 };
          persist();
          return ok(`Imported a single form with ${doc.steps[0].state.sections.length} section(s).`);
        } catch (e) {
          return ok(`⚠ Could not import: ${e.message}`);
        }
      }

      case 'export_form':
        return ok(JSON.stringify(currentExport(), null, 2));

      case 'get_form':
        if (doc.steps.length > 1) {
          return ok(JSON.stringify({
            form_type: 'multi-step',
            active: doc.active,
            steps: doc.steps.map((st, i) => ({ index: i, name: st.name, ...summarizeState(st.state) })),
          }, null, 2));
        }
        return ok(JSON.stringify(summarizeState(cur()), null, 2));

      case 'preview_url':
        return ok(buildPreviewUrl(PREVIEW_BASE_URL, currentExport()));

      case 'add_step': {
        doc.steps.push(emptyStep(args.name || `Step ${doc.steps.length + 1}`));
        doc.active = doc.steps.length - 1;
        persist();
        return ok(`Added step "${doc.steps[doc.active].name}" — now ${doc.steps.length} steps; it is the active step.`);
      }

      case 'switch_step': {
        const idx = resolveStepIndex(args);
        if (idx < 0 || idx >= doc.steps.length) return ok('⚠ No such step.');
        doc.active = idx;
        return ok(`Active step is now "${doc.steps[idx].name}" (${idx + 1}/${doc.steps.length}).`);
      }

      case 'rename_step':
        doc.steps[doc.active].name = args.name;
        persist();
        return ok(`Renamed the active step to "${args.name}".`);

      case 'remove_step': {
        if (doc.steps.length <= 1) return ok('⚠ Cannot remove the only step.');
        const idx = resolveStepIndex(args);
        if (idx < 0 || idx >= doc.steps.length) return ok('⚠ No such step.');
        const [rm] = doc.steps.splice(idx, 1);
        doc.active = Math.min(doc.active, doc.steps.length - 1);
        persist();
        return ok(`Removed step "${rm.name}". ${doc.steps.length} step(s) left.`);
      }

      case 'list_steps':
        return ok(JSON.stringify(
          doc.steps.map((s, i) => ({ index: i, name: s.name, active: i === doc.active, sections: (s.state.sections || []).length })),
          null, 2,
        ));

      default: {
        // a builder edit tool — applied to the ACTIVE step as a pure fold
        if (!TOOLS.some((t) => t.name === name)) return ok(`⚠ Unknown tool "${name}".`);
        const r = applyTool(cur(), name, args);
        setCur(r.state);
        persist();
        return ok(r.message);
      }
    }
  });

  // resource: the current form (single or multi-step) as JSON
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: 'form://current', name: 'Current form (FormEngine / multi-step JSON)', mimeType: 'application/json' }],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri !== 'form://current') throw new Error(`Unknown resource: ${req.params.uri}`);
    return { contents: [{ uri: 'form://current', mimeType: 'application/json', text: JSON.stringify(currentExport(), null, 2) }] };
  });

  return server;
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport (remote — for claude.ai). One transport + one
// server instance per session, tracked by Mcp-Session-Id. No FORM_FILE
// persistence (multi-session); state lives per session.
//
// Auth: OAuth 2.1 (the SDK's mcpAuthRouter supplies discovery metadata, DCR,
// /authorize, /token + PKCE; oauth-provider.mjs supplies storage + the login
// gate). The /mcp channel is guarded by requireBearerAuth, which also emits
// the WWW-Authenticate: resource_metadata header that triggers a client's
// OAuth discovery. The static MCP_SHARED_SECRET is still accepted as a bearer.
// ---------------------------------------------------------------------------
async function startHttp() {
  const PORT = Number(process.env.PORT || 8080);
  const SECRET = process.env.MCP_SHARED_SECRET || '';
  const LOGIN_PASSWORD = process.env.MCP_AUTH_PASSWORD || SECRET || '';
  const PUBLIC_URL = (process.env.MCP_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
  const issuerUrl = new URL(PUBLIC_URL);
  const resourceServerUrl = new URL('/mcp', issuerUrl);

  const transports = Object.create(null); // sessionId -> StreamableHTTPServerTransport

  const provider = createOAuthProvider({ sharedSecret: SECRET, loginPassword: LOGIN_PASSWORD });

  const app = express();
  app.disable('x-powered-by');

  // health check (Render etc.)
  app.get(['/', '/health'], (_req, res) => res.status(200).send('ok'));

  // OAuth 2.1 endpoints (mounted at root): /authorize, /token, /register,
  // /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp
  app.use(mcpAuthRouter({
    provider,
    issuerUrl,
    resourceServerUrl,
    scopesSupported: ['mcp'],
    resourceName: 'FormEngine Builder',
  }));

  // bearer guard for the MCP channel; points 401s at the resource metadata
  const bearer = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  });

  const mcpChannel = async (req, res) => {
    try {
      const body = req.body; // parsed by express.json() on POST; undefined otherwise
      const sid = req.headers['mcp-session-id'];
      let transport = sid ? transports[sid] : undefined;

      if (!transport) {
        if (req.method === 'POST' && isInitializeRequest(body)) {
          // new session: fresh transport + fresh per-session server/state
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => { transports[id] = transport; },
          });
          transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
          await createServer().connect(transport);
        } else {
          res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session — send an initialize request first.' }, id: null });
          return;
        }
      }

      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: String((e && e.message) || e) });
    }
  };

  app.post('/mcp', bearer, express.json({ limit: '8mb' }), mcpChannel);
  app.get('/mcp', bearer, mcpChannel);
  app.delete('/mcp', bearer, mcpChannel);

  app.listen(PORT, () => {
    const gate = LOGIN_PASSWORD ? 'on' : 'OFF (no MCP_AUTH_PASSWORD/MCP_SHARED_SECRET)';
    console.error(`formengine MCP server ready (http :${PORT}, OAuth issuer ${issuerUrl.href}, login gate ${gate})`);
  });
}

// ---- transport selection --------------------------------------------------
const TRANSPORT = (process.env.MCP_TRANSPORT || (process.env.PORT ? 'http' : 'stdio')).toLowerCase();

if (TRANSPORT === 'http') {
  await startHttp();
} else {
  // stdio: single session, with optional FORM_FILE persistence (unchanged)
  await createServer({ enablePersist: true }).connect(new StdioServerTransport());
  console.error('formengine MCP server ready (stdio)'); // stderr (stdout is the MCP channel)
}
