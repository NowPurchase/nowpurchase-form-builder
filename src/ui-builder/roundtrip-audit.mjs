'use strict';

// ---------------------------------------------------------------------------
// roundtrip-audit.mjs — measures whether the builder can EDITABLY rebuild the
// real production forms in `exports/`. Run: npm run test:roundtrip
//
// Why: the current import (importJSON.js) is a PRESERVATION import — every
// imported field keeps `_raw: node`, and export returns that verbatim
// (exportJSON.js: `if (field._raw) return field._raw`). So production forms load
// faithfully but READ-ONLY. The bar we care about is EDITABLE round-trip: could
// the builder regenerate the form from its own model if `_raw` were dropped?
//
// For each production form we produce two exports and diff them against the
// original:
//   • faithful  — current export (keeps _raw)            → sanity: ≈ original
//   • editable  — export after stripping all _raw markers → "model-only" rebuild
// The faithful-minus-editable delta is exactly what reconstruction loses.
// Output: per-form classification + an aggregate ranked gap list.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importJSON } from './engine/importJSON.js';
import { exportJSON } from './engine/exportJSON.js';
import { isMultiStep } from './engine/multiStep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = path.resolve(__dirname, '../../exports');

// ---- load every production form (flattening files, multi-doc, multi-step) ----
function loadForms() {
  const out = []; // { file, doc, step, name, customer, form }  (form = FormEngine descriptor)
  const files = fs.readdirSync(EXPORTS_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let json;
    try { json = JSON.parse(fs.readFileSync(path.join(EXPORTS_DIR, file), 'utf8')); }
    catch { continue; }
    const docs = Array.isArray(json) ? json : (json['0'] ? Object.values(json) : [json]);
    docs.forEach((doc, di) => {
      let fj = doc.form_json;
      if (typeof fj === 'string') { try { fj = JSON.parse(fj); } catch { fj = null; } }
      if (!fj) return;
      const base = { file, doc: di, name: doc.template_name || '?', customer: doc.customer_name || '?' };
      if (isMultiStep(fj)) {
        fj.sections.forEach((sec, si) => {
          let sfj = sec.form_json;
          if (typeof sfj === 'string') { try { sfj = JSON.parse(sfj); } catch { sfj = null; } }
          if (sfj) out.push({ ...base, step: sec.section_name || `step ${si + 1}`, form: sfj });
        });
      } else {
        out.push({ ...base, step: null, form: fj });
      }
    });
  }
  return out;
}

// ---- recursively strip _raw markers so export must regenerate from the model --
function stripRaw(state) {
  const s = JSON.parse(JSON.stringify(state));
  if (s._imported) delete s._imported.formValidator; // carried verbatim otherwise
  const walkSection = (sec) => {
    delete sec._rawNode;
    delete sec._rawRenderWhen;
    (sec.fields || []).forEach((f) => { delete f._raw; });
    (sec.children || []).forEach(walkSection);
  };
  (s.sections || []).forEach(walkSection);
  return s;
}

// ---- walk a FormEngine descriptor and extract semantic metrics ----------------
const DISPLAY = new Set(['Screen', 'RsContainer', 'Fragment', 'RsHeader', 'RsDivider', 'RsLabel', 'RsButton']);
const SPECIAL = new Set(['RsSpectrometerReading', 'RsChipInput', 'RsCameraCapture']);

function metrics(form) {
  const m = {
    types: {}, dataKeys: new Set(), nFields: 0,
    nValidations: 0, nComputed: 0, nRenderWhen: 0, nEvents: 0, nAsync: 0,
    nIndexedTable: 0, nSpecial: 0, hasFormValidator: !!form.formValidator,
  };
  const root = form.form || form;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type) {
      m.types[node.type] = (m.types[node.type] || 0) + 1;
      if (!DISPLAY.has(node.type)) m.nFields += 1;
      if (SPECIAL.has(node.type)) m.nSpecial += 1;
    }
    if (typeof node.dataKey === 'string' && node.dataKey) {
      m.dataKeys.add(node.dataKey);
      if (/__\d+__/.test(node.dataKey)) m.nIndexedTable += 1;
    }
    if (node.schema && Array.isArray(node.schema.validations) && node.schema.validations.length) m.nValidations += 1;
    if (node.props && /"computeType"/.test(JSON.stringify(node.props))) m.nComputed += 1;
    if (node.renderWhen) m.nRenderWhen += 1;
    if (node.events && Object.keys(node.events).length) {
      m.nEvents += 1;
      if (node.events.onLoadData) m.nAsync += 1;
    }
    if (node.children) walk(node.children);
  };
  walk(root);
  return m;
}

// ---- per-form audit -----------------------------------------------------------
const FEATURES = [
  ['dataKeys',     (o, e) => countLost(o.dataKeys, e.dataKeys),        'dataKeys changed/lost'],
  ['validations',  (o, e) => o.nValidations - e.nValidations,          'field validations not reconstructed'],
  ['computed',     (o, e) => o.nComputed - e.nComputed,               'computed/total fields not reconstructed'],
  ['renderWhen',   (o, e) => o.nRenderWhen - e.nRenderWhen,           'conditional visibility not reconstructed'],
  ['events',       (o, e) => o.nEvents - e.nEvents,                   'field events (auto-fill/derive) not reconstructed'],
  ['async',        (o, e) => o.nAsync - e.nAsync,                     'async-dropdown loaders not reconstructed'],
  ['indexedTable', (o, e) => o.nIndexedTable - e.nIndexedTable,       'indexed-table cells not reconstructed'],
  ['special',      (o, e) => o.nSpecial - e.nSpecial,                 'special components (spectrometer/chip/upload) not reconstructed'],
  ['formValidator',(o, e) => (o.hasFormValidator ? 1 : 0) - (e.hasFormValidator ? 1 : 0), 'form-level validator dropped'],
];

function countLost(origSet, newSet) {
  let lost = 0;
  for (const k of origSet) if (!newSet.has(k)) lost += 1;
  return lost;
}

function auditForm(entry) {
  const state = importJSON(entry.form);
  const faithful = exportJSON(state);
  const editable = exportJSON(stripRaw(state));

  const orig = metrics(entry.form);
  const mFaithful = metrics(faithful);
  const mEditable = metrics(editable);

  // how many imported fields relied on _raw (preservation) in the first place
  const rawFields = (function count(secs) {
    let n = 0;
    (secs || []).forEach((s) => {
      n += (s.fields || []).filter((f) => f._raw).length;
      n += count(s.children);
    });
    return n;
  })(state.sections);

  const lost = {};
  for (const [key, fn, label] of FEATURES) {
    const delta = fn(orig, mEditable);
    if (delta > 0) lost[key] = { delta, label };
  }

  // editability: share of fields whose data survives a model-only rebuild
  const keysSurvived = orig.dataKeys.size - countLost(orig.dataKeys, mEditable.dataKeys);
  const editablePct = orig.dataKeys.size ? Math.round((keysSurvived / orig.dataKeys.size) * 100) : 100;

  let verdict;
  if (orig.nFields === 0) verdict = 'empty';
  else if (Object.keys(lost).length === 0) verdict = 'editable';
  else if (editablePct === 0 || rawFields === orig.nFields) verdict = 'passthrough-only';
  else verdict = 'partial';

  // sanity: faithful export should preserve the original field count
  const faithfulOk = mFaithful.nFields >= orig.nFields - 1; // allow header-as-label drift

  return { entry, orig, verdict, editablePct, rawFields, lost, faithfulOk };
}

// ---- run ----------------------------------------------------------------------
function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

function main() {
  const forms = loadForms();
  const results = forms.map(auditForm);

  console.log(`\nROUND-TRIP FIDELITY AUDIT — ${results.length} production forms (bar: editable round-trip, no _raw)\n`);
  console.log(pad('FORM (file · step)', 42), pad('fields', 7), pad('editable%', 10), pad('verdict', 17), 'lost features');
  console.log('-'.repeat(120));

  const tally = { editable: 0, partial: 0, 'passthrough-only': 0, empty: 0 };
  const gapCounts = {}; const gapLabels = {};
  let faithfulFails = 0;

  for (const r of results) {
    tally[r.verdict] += 1;
    if (!r.faithfulOk) faithfulFails += 1;
    const name = `${r.entry.name}${r.entry.step ? ' · ' + r.entry.step : ''}`;
    const where = `${path.basename(r.entry.file).replace('.templates', '').replace('.json', '')}`;
    const lostTags = Object.keys(r.lost);
    for (const k of lostTags) { gapCounts[k] = (gapCounts[k] || 0) + 1; gapLabels[k] = r.lost[k].label; }
    console.log(
      pad(`${name} · ${where}`.slice(0, 40), 42),
      pad(r.orig.nFields, 7),
      pad(r.verdict === 'empty' ? '-' : r.editablePct + '%', 10),
      pad(r.verdict, 17),
      lostTags.join(', ') || '—',
    );
  }

  console.log('\n=== VERDICT TALLY ===');
  console.log(`  editable (no loss):     ${tally.editable}`);
  console.log(`  partial:                ${tally.partial}`);
  console.log(`  passthrough-only:       ${tally['passthrough-only']}`);
  console.log(`  empty:                  ${tally.empty}`);
  console.log(`  faithful-export sanity: ${results.length - faithfulFails}/${results.length} preserved field count`);

  console.log('\n=== AGGREGATE RANKED GAP LIST (reconstruction work to reach editable round-trip) ===');
  Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`  ${pad(n + '/' + results.length, 8)} ${gapLabels[k]}`);
  });
  console.log('');
}

main();
