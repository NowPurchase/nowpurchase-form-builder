'use strict';

// ---------------------------------------------------------------------------
// mcp-formengine.mjs — a Model Context Protocol server that lets MCP hosts
// (Claude Desktop / Claude Code / Cursor) build & edit DLMS forms and export
// valid FormEngine JSON.
//
// It REUSES the builder's pure engine — the same code path the in-app
// assistant and the UI buttons use — so output is always on-convention.
//
// It holds a DOCUMENT of one or more STEPS. One step → a plain single
// FormEngine form. Multiple steps → a multi-step form ({ sections: [...] }),
// matching how the host renders multi-step. Edit tools apply to the ACTIVE
// step; step tools (add_step/switch_step/…) manage the list.
//
// Run:   node server/mcp-formengine.mjs
// ---------------------------------------------------------------------------

import fs from 'fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema, CallToolRequestSchema,
  ListResourcesRequestSchema, ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { initialState } from '../src/ui-builder/state/formState.js';
import { TOOLS, applyTool } from '../src/ui-builder/assistant/tools.js';
import { summarizeState } from '../src/ui-builder/assistant/runtime.js';
import { exportJSON } from '../src/ui-builder/engine/exportJSON.js';
import { importJSON } from '../src/ui-builder/engine/importJSON.js';
import { exportMultiStep, importMultiStep } from '../src/ui-builder/engine/multiStep.js';
import { buildPreviewUrl } from '../src/ui-builder/preview-url.js';

const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL || 'http://localhost:5173';

// ---- document: one or more STEPS (a multi-step form = N single forms) ------
const FORM_FILE = process.env.FORM_FILE || null;
const emptyStep = (name) => ({ name: name || 'Step 1', state: { ...initialState } });

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
let doc = loadDoc();

const cur = () => doc.steps[doc.active].state;
const setCur = (s) => { doc.steps[doc.active].state = s; };
// single step → plain FormEngine form; multiple steps → multi-step wrapper
const currentExport = () => (doc.steps.length > 1 ? exportMultiStep(doc.steps) : exportJSON(cur()));

function persist() {
  if (FORM_FILE) {
    try { fs.writeFileSync(FORM_FILE, JSON.stringify(currentExport(), null, 2)); } catch { /* ignore */ }
  }
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

function resolveStepIndex(args) {
  if (typeof args.index === 'number') return args.index;
  if (args.name) return doc.steps.findIndex((s) => s.name === args.name);
  return doc.active;
}

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

await server.connect(new StdioServerTransport());
// stderr is safe (stdout is the MCP channel)
console.error('formengine MCP server ready (stdio)');
