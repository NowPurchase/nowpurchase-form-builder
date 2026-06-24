'use strict';

// ---------------------------------------------------------------------------
// corpus-test.mjs — measure REAL import→export fidelity against production
// templates. Answers: do dataKeys survive? do form-level actions survive?
// what components / structures appear that we don't model?
//
// Usage: node src/ui-builder/corpus-test.mjs [path-to-export.json]
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { importJSON } from './engine/importJSON.js';
import { exportJSON } from './engine/exportJSON.js';

const FILE = process.argv[2] || 'exports/dlms_customer_679.templates-is_active.json';
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const records = Array.isArray(raw) ? raw : (raw.data || raw.templates || raw.rows || []);

// recursive collectors over a FormEngine form tree (form.children)
function walk(node, fn) {
  if (!node) return;
  fn(node);
  (node.children || []).forEach((c) => walk(c, fn));
}
function dataKeys(form) { const s = []; walk(form, (n) => { if (n.dataKey) s.push(n.dataKey); }); return s; }
function nodeKeys(form) { const s = []; walk(form, (n) => { if (n.key) s.push(n.key); }); return s; }
function typeCounts(form) { const m = {}; walk(form, (n) => { if (n.type) m[n.type] = (m[n.type] || 0) + 1; }); return m; }

// component types our engine models (everything else imports via _raw as a
// generic field — preserved on export, but not natively editable)
const MODELLED = new Set([
  'Screen', 'RsContainer', 'RsButton', 'Repeater',
  'RsInput', 'RsNumberFormat', 'RsDatePicker', 'RsTimePicker', 'RsDropdown',
  'RsTagPicker', 'RsCheckbox', 'RsToggle', 'RsTextArea', 'RsHeader', 'RsDivider',
  'RsCameraCapture', 'RsSpectrometerReading', 'RsChipInput',
]);

const set = (a) => new Set(a);
const diff = (a, b) => [...a].filter((x) => !b.has(x));

let okKeys = 0, keyLoss = 0, actionLoss = 0, importErr = 0;
const unknownTypes = {};
const rows = [];

for (const r of records) {
  const name = (r.template_name || r.name || r.template_id || '?').slice(0, 34);
  let fj = r.form_json;
  if (typeof fj === 'string') { try { fj = JSON.parse(fj); } catch { /* */ } }
  if (!fj || !fj.form) { rows.push([name, 'NO form_json', '', '', '']); continue; }

  let out;
  try { out = exportJSON(importJSON(fj)); } catch (e) { importErr++; rows.push([name, 'IMPORT/EXPORT THREW', e.message.slice(0, 30), '', '']); continue; }

  const origKeys = set(dataKeys(fj.form));
  const newKeys = set(dataKeys(out.form));
  const lostKeys = diff(origKeys, newKeys);          // keys present originally, gone after round-trip
  const keysOk = lostKeys.length === 0;
  if (keysOk) okKeys++; else keyLoss++;

  // node-key dup check on the re-export (our invariant)
  const nk = nodeKeys(out.form);
  const dupKeys = nk.length !== new Set(nk).size;

  // form-level actions preserved?
  const origActions = set(Object.keys(fj.actions || {}));
  const newActions = set(Object.keys(out.actions || {}));
  const lostActions = diff(origActions, newActions);
  if (lostActions.length) actionLoss++;

  // components we don't model (preserved via _raw, but not editable)
  const tc = typeCounts(fj.form);
  const unknown = Object.keys(tc).filter((t) => !MODELLED.has(t));
  unknown.forEach((t) => { unknownTypes[t] = (unknownTypes[t] || 0) + tc[t]; });

  rows.push([
    name,
    `${origKeys.size} keys`,
    keysOk ? 'keys ✓' : `LOST ${lostKeys.length}`,
    lostActions.length ? `actions -${lostActions.length}` : 'actions ✓',
    (dupKeys ? 'DUPKEYS ' : '') + (unknown.length ? `unmodelled: ${unknown.join(',')}` : ''),
  ]);
}

// ---- report ----
const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('TEMPLATE', 36) + pad('SIZE', 11) + pad('DATAKEYS', 12) + pad('ACTIONS', 13) + 'NOTES');
console.log('-'.repeat(110));
for (const [a, b, c, d, e] of rows) console.log(pad(a, 36) + pad(b, 11) + pad(c, 12) + pad(d, 13) + e);

console.log('\n=== SUMMARY ===');
console.log(`templates:              ${records.length}`);
console.log(`dataKeys fully preserved: ${okKeys}/${records.length}`);
console.log(`dataKey loss:           ${keyLoss}`);
console.log(`import/export threw:    ${importErr}`);
console.log(`form-level action loss: ${actionLoss}/${records.length}`);
console.log(`unmodelled component types (preserved via _raw, not natively editable):`);
const ut = Object.entries(unknownTypes).sort((a, b) => b[1] - a[1]);
console.log(ut.length ? ut.map(([t, n]) => `   ${t}: ${n}`).join('\n') : '   (none — all components modelled)');
