'use strict';

// ---------------------------------------------------------------------------
// runtime.js — provider-neutral assistant runtime.
//
// runTurn() either calls a configured backend endpoint (which runs the real
// LLM + tool-use loop and returns tool calls) or, when no endpoint is set,
// falls back to a lightweight built-in MOCK parser so the chat is usable for
// demos with no API key. The backend contract is documented in server/.
// ---------------------------------------------------------------------------

import { TOOLS, findSection } from './tools.js';

// Where the real LLM lives. Set window.__ASSISTANT_ENDPOINT (or the
// VITE_ASSISTANT_ENDPOINT env var) to a backend that speaks the contract in
// server/README.md. Unset → mock mode.
export function getEndpoint() {
  if (typeof window !== 'undefined' && window.__ASSISTANT_ENDPOINT) return window.__ASSISTANT_ENDPOINT;
  try { return import.meta.env?.VITE_ASSISTANT_ENDPOINT || null; } catch { return null; }
}

// Compact, model-friendly view of the form (keeps context small/cheap).
export function summarizeState(state) {
  const sec = (n) => ({
    container_name: n.container_name,
    label: n.label || undefined,
    type: n.type,
    fields: (n.fields || []).map((f) => ({ field: f.field_name || f.label, type: f.field_type, dataKey: f.dataKey })),
    columns: n.type === 'table' && n.table_config
      ? n.table_config.columns.map((c) => ({ header: c.header, suffix: c.dataKey_suffix, type: c.field_type })) : undefined,
    children: (n.children || []).map(sec),
  });
  return { theme: state.theme, sections: (state.sections || []).map(sec) };
}

export const SYSTEM_PROMPT = `You are the assistant inside the DLMS visual form builder. You build and edit forms by calling the provided tools — never by writing JSON or code directly.

Naming conventions (enforced by the tools, but follow them):
- Every section has a lowercase container_name; it becomes the prefix for each field's dataKey as container_name__field.
- Nested containers chain: parent__child__field.
- The user never types a dataKey — it is derived from the section prefix + label.
- Tables are repeating rows (an array). Use add_table; you do NOT set row keys. A "repeater", "repeating table", or "table where users add rows" all mean add_table — give it a plain container_name (e.g. charge_mix, NOT charge_mix_repeater).

Field types — pick the closest:
- text, number, date, time — basic inputs.
- shift — A/B/C shift dropdown.
- dropdown_fixed / tags_fixed — choices YOU provide (pass options: [{label,value}, ...]).
- dropdown_async / tags_async — choices loaded from master data (pass entity_id and search_fields).
- checkbox / toggle — yes/no.
- textarea — multi-line text. upload — a file or image attachment.
- supervisor — the current operator's name, auto-filled and read-only.
- header / divider — display only (no data).

Guidance:
- Complete the user's entire request — keep calling tools until everything they asked for is done, then give a one-line confirmation.
- Prefer the fewest tool calls that accomplish the request.
- For "show X when Y…", use set_render_when with the dataKey of Y.
- The user may have a section (and field) selected in the builder — given below as "Focused". When they say "here", "this", "it", or don't name a target, default to the focused section/field.
- Confirm what you did in one short sentence.`;

// --- backend call -----------------------------------------------------------
async function callEndpoint(endpoint, { messages, state, focus }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, messages, tools: TOOLS, formState: summarizeState(state), focus: focus || null }),
  });
  if (!res.ok) throw new Error(`assistant endpoint ${res.status}`);
  const data = await res.json();
  return { text: data.text || '', toolCalls: data.toolCalls || data.tool_calls || [] };
}

// --- mock parser (no API key) ----------------------------------------------
const TYPE_WORDS = [
  ['supervisor', 'supervisor'], ['textarea', 'textarea'], ['text area', 'textarea'],
  ['number', 'number'], ['date', 'date'], ['time', 'time'], ['shift', 'shift'],
  ['toggle', 'toggle'], ['checkbox', 'checkbox'], ['dropdown', 'dropdown_fixed'],
  ['tags', 'tags_fixed'], ['upload', 'upload'], ['file', 'upload'], ['image', 'upload'],
  ['text', 'text'],
];

function lastSectionName(state) {
  const s = state.sections[state.sections.length - 1];
  return s ? s.container_name : null;
}

function mockTurn(message, state, focus) {
  const m = message.trim();
  const low = m.toLowerCase();
  const calls = [];
  const focusSection = (focus && focus.section) || null;

  // theme
  const themeMatch = low.match(/\b(clean|elevated|metalcloud)\b/);
  if (themeMatch && /(theme|style|look)/.test(low)) {
    calls.push({ name: 'set_theme', args: { theme: themeMatch[1] } });
    return { text: `Set theme to ${themeMatch[1]}.`, toolCalls: calls };
  }

  // add section
  let mm = low.match(/add (?:a |an )?section (?:called |named )?["']?([a-z][a-z0-9_ ]*?)["']?$/);
  if (mm) {
    const name = mm[1].trim().replace(/\s+/g, '_');
    return { text: `Adding section "${name}".`, toolCalls: [{ name: 'add_section', args: { container_name: name } }] };
  }

  // make <field> required [in <section>]
  mm = low.match(/make ["']?([a-z0-9_ ]+?)["']? required(?: in ["']?([a-z0-9_ ]+?)["']?)?$/);
  if (mm) {
    const section = (mm[2] || focusSection || lastSectionName(state) || '').trim();
    return { text: `Marking "${mm[1].trim()}" required.`, toolCalls: [{ name: 'update_field', args: { section, field: mm[1].trim(), required: true } }] };
  }

  // show <field> when <whenfield> (is not empty | greater than N | equals V)
  mm = low.match(/show ["']?([a-z0-9_ ]+?)["']? (?:only )?when ["']?([a-z0-9_]+?)["']? (is not empty|is empty|>\s*(\d+)|greater than (\d+)|less than (\d+)|equals? (.+)|=\s*(.+))$/);
  if (mm) {
    const field = mm[1].trim();
    const whenField = mm[2].trim();
    let operator = 'is_not_empty'; let value = '';
    if (/is empty/.test(mm[3])) operator = 'is_empty';
    else if (/is not empty/.test(mm[3])) operator = 'is_not_empty';
    else if (mm[4] || mm[5]) { operator = 'greater_than'; value = mm[4] || mm[5]; }
    else if (mm[6]) { operator = 'less_than'; value = mm[6]; }
    else if (mm[7] || mm[8]) { operator = 'equals'; value = (mm[7] || mm[8]).trim(); }
    const sec = findSection(state, '') || state.sections.find((s) => (s.fields || []).some((f) => (f.field_name === field || f.label?.toLowerCase() === field)));
    const section = sec ? sec.container_name : (focusSection || lastSectionName(state) || '');
    return { text: `"${field}" will show when ${whenField} ${operator} ${value}.`, toolCalls: [{ name: 'set_render_when', args: { section, field, when_field: whenField, operator, value } }] };
  }

  // add <type> [field] <label> [to <section>]
  mm = low.match(/add (?:a |an )?(required )?(\w[\w ]*?) (?:field|input)?\s*(?:called |named |labell?ed )?["']?([a-z0-9_ ]+?)["']?(?: to ["']?([a-z0-9_ ]+?)["']?)?$/);
  if (mm) {
    const required = !!mm[1];
    const typeWord = mm[2].trim();
    const ft = (TYPE_WORDS.find(([w]) => typeWord.includes(w)) || [])[1];
    const label = mm[3].trim();
    const section = (mm[4] || focusSection || lastSectionName(state) || '').trim();
    if (ft && section) {
      return { text: `Adding ${ft} "${label}" to ${section}.`, toolCalls: [{ name: 'add_field', args: { section, field_type: ft, label, required } }] };
    }
  }

  return {
    text: 'I can do this in mock mode: "add section <name>", "add a number field <label> to <section>", "make <field> required", "show <field> when <key> is not empty", "use metalcloud theme". For full natural-language understanding, connect a model endpoint (see server/README.md).',
    toolCalls: [],
  };
}

// --- public ----------------------------------------------------------------
export async function runTurn({ messages, state, focus }) {
  const endpoint = getEndpoint();
  const last = [...messages].reverse().find((x) => x.role === 'user');
  if (!endpoint) return { ...mockTurn(last ? last.content : '', state, focus), mock: true };
  const r = await callEndpoint(endpoint, { messages, state, focus });
  return { ...r, mock: false };
}
