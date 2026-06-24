'use strict';

// ---------------------------------------------------------------------------
// theme-snapshot.test.mjs — GOLDEN safety net for the theme engine.
// Run: npm run test:theme
//
// Freezes metalcloud's emitted STYLING so the upcoming theme-engine refactor
// can prove it changes nothing. We snapshot a deterministic "style fingerprint"
// (the Screen css + every node's css/wrapperCss in DFS order) rather than the
// whole export, because node `key`s are uid-based (volatile) while all
// style/layout output is id-independent.
//
// First run with no golden file → writes it (and says so). Commit that file.
// Subsequent runs compare; any drift in metalcloud styling fails loudly.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTool } from './assistant/tools.js';
import { initialState } from './state/formState.js';
import { exportJSON } from './engine/exportJSON.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(__dirname, 'theme-snapshot.golden.json');

let pass = 0; let fail = 0; const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }

// A representative form exercising card, every common control, layout, and a table.
function buildSampleForm() {
  const steps = [
    ['add_section', { container_name: 'details', label: 'Details' }],
    ['add_field', { section: 'details', field_type: 'text', label: 'Heat No', required: true }],
    ['add_field', { section: 'details', field_type: 'number', label: 'Qty' }],
    ['add_field', { section: 'details', field_type: 'date', label: 'Pour Date' }],
    ['add_field', { section: 'details', field_type: 'dropdown_fixed', label: 'Grade' }],
    ['add_field', { section: 'details', field_type: 'textarea', label: 'Notes' }],
    ['add_field', { section: 'details', field_type: 'toggle', label: 'Approved' }],
    ['add_table', { container_name: 'items', label: 'Items', columns: [
      { header: 'Material', suffix: 'material', field_type: 'text' },
      { header: 'Weight', suffix: 'wt', field_type: 'number' },
    ] }],
  ];
  let s = { ...initialState, sections: [] };
  for (const [name, args] of steps) s = applyTool(s, name, args).state;
  return s;
}

// Deterministic style fingerprint: Screen css + DFS list of {type, css, wrapperCss}.
function fingerprint(form) {
  const root = form.form || form;
  const nodes = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type) nodes.push({ type: n.type, css: n.css ?? null, wrapperCss: n.wrapperCss ?? null });
    if (n.children) walk(n.children);
  };
  walk(root);
  return { screen: root.css ?? null, nodes };
}

const state = buildSampleForm();
const current = fingerprint(exportJSON(state)); // default theme = metalcloud

if (!fs.existsSync(GOLDEN)) {
  fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 2) + '\n');
  console.log(`\ntheme-snapshot: golden created (${current.nodes.length} nodes) → ${path.basename(GOLDEN)}`);
  console.log('Commit this file. Re-run after the refactor to prove metalcloud is unchanged.');
  process.exit(0);
}

const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
const a = JSON.stringify(current);
const b = JSON.stringify(golden);
ok('metalcloud node count unchanged', current.nodes.length === golden.nodes.length);
ok('metalcloud screen css unchanged', JSON.stringify(current.screen) === JSON.stringify(golden.screen));
ok('metalcloud full style fingerprint unchanged', a === b);

if (a !== b) {
  // point at the first differing node to make drift easy to locate
  const n = Math.max(current.nodes.length, golden.nodes.length);
  for (let i = 0; i < n; i += 1) {
    const ci = JSON.stringify(current.nodes[i]); const gi = JSON.stringify(golden.nodes[i]);
    if (ci !== gi) {
      console.log(`\nFirst drift at node #${i}:`);
      console.log('  golden :', gi);
      console.log('  current:', ci);
      break;
    }
  }
}

console.log(`\ntheme-snapshot.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
