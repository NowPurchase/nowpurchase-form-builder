'use strict';

// verify.js — round-trip test against all fixtures + a clean-generation
// self-test that exercises the builder's own export path (no _raw shortcuts).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importJSON } from './engine/importJSON.js';
import { exportJSON } from './engine/exportJSON.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function countDataKeys(node, set) {
  set = set || new Set();
  if (!node || typeof node !== 'object') return set;
  if (Array.isArray(node)) { node.forEach((n) => countDataKeys(n, set)); return set; }
  if (typeof node.dataKey === 'string' && node.dataKey) set.add(node.dataKey);
  if (node.children) countDataKeys(node.children, set);
  return set;
}

const fixturesDir = path.join(__dirname, 'fixtures');
const files = fs.existsSync(fixturesDir)
  ? fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'))
  : [];

let passed = 0;
let failed = 0;
let belowTarget = 0;

console.log('=== Round-trip coverage (import → export) ===\n');

files.forEach((file) => {
  let original;
  try {
    original = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
  } catch (e) {
    console.log(`❌ ${file}: unreadable (${e.message})`);
    failed++;
    return;
  }

  if (!original.form) {
    console.log(`➖ ${file}: no form node (skipped)`);
    return;
  }

  try {
    const builderState = importJSON(original);
    const exported = exportJSON(builderState);

    const originalKeys = countDataKeys(original.form);
    const exportedKeys = countDataKeys(exported.form);
    const missing = [...originalKeys].filter((k) => !exportedKeys.has(k));
    const coverage = originalKeys.size === 0
      ? 100
      : Math.round(((originalKeys.size - missing.length) / originalKeys.size) * 100);

    const mark = coverage >= 80 ? '✅' : '⚠️ ';
    if (coverage < 80) belowTarget++;
    console.log(`${mark} ${file}: ${coverage}% (${originalKeys.size - missing.length}/${originalKeys.size} dataKeys, ${builderState.sections.length} sections)`);
    if (missing.length && missing.length <= 5) {
      console.log(`     missing: ${missing.join(', ')}`);
    } else if (missing.length) {
      console.log(`     missing ${missing.length}, e.g. ${missing.slice(0, 4).join(', ')}`);
    }
    passed++;
  } catch (err) {
    console.log(`❌ ${file}: ${err.message}`);
    failed++;
  }
});

console.log(`\n${passed} imported, ${failed} failed, ${belowTarget} below 80% target (of ${files.length} fixtures)`);

// ---------------------------------------------------------------------------
// Clean-generation self-test: build a moulding-like form from scratch using
// the builder state model and assert the export shape (no _raw passthrough).
// ---------------------------------------------------------------------------

console.log('\n=== Clean generation self-test (moulding form from scratch) ===\n');

const mouldingState = {
  name: 'Moulding Log',
  template_id: 'moulding_log',
  defaultLanguage: 'en-US',
  theme: 'clean',
  sections: [
    {
      id: 's1',
      container_name: 'moulding',
      label: 'Moulding Details',
      show_header: true,
      fields_per_row: 2,
      type: 'standard',
      fields: [
        { id: 'f_date', field_name: 'date', label: 'Date', show_label: true, field_type: 'date', dataKey: 'moulding__date', required: true, type_config: { auto_fill_today: true } },
        { id: 'f_time', field_name: 'time', label: 'Time', show_label: true, field_type: 'time', dataKey: 'moulding__time', required: true, type_config: { auto_derive_shift: true, shift_target_key: 'shift' } },
        { id: 'f_sup', field_name: 'supervisor', label: 'Supervisor', show_label: true, field_type: 'supervisor', dataKey: 'disabled__supervisor', special_prefix: 'disabled__', type_config: {} },
        { id: 'f_cast', field_name: 'casting_name', label: 'Casting', show_label: true, field_type: 'dropdown_async', dataKey: 'moulding__casting_name', type_config: { entity_id: 'casting_master', search_fields: 'casting_name' } },
      ],
    },
    {
      id: 's2',
      container_name: 'spec',
      label: 'Specifications',
      show_header: true,
      fields_per_row: 1,
      fields: [],
      type: 'table',
      table_config: {
        table_type: 'standard',
        max_rows: 3,
        row_count_key: 'row_count_standard',
        data_prefix: 'spec',
        deleted_prefix: 'deleted_',
        columns: [
          { key: 'char', header: 'Characteristic', width_percent: 40, field_type: 'input', dataKey_suffix: 'char' },
          { key: 'obs', header: 'Observation', width_percent: 40, field_type: 'input', dataKey_suffix: 'observation' },
          { key: 'ok', header: 'OK', width_percent: 20, field_type: 'checkbox', dataKey_suffix: 'ok' },
        ],
      },
    },
  ],
};

const out = exportJSON(mouldingState);
const keys = [...countDataKeys(out.form)];
// Repeater-table standard: array key = container name; cell dataKeys RELATIVE.
const expect = [
  'moulding__date', 'moulding__time', 'disabled__supervisor', 'moulding__casting_name',
  'spec',                  // the Repeater node's array key
  'char', 'observation', 'ok',  // relative cell dataKeys (row-scoped)
];
const checks = [];
expect.forEach((k) => checks.push([`dataKey ${k}`, keys.includes(k)]));

// find the Repeater node + its add button to assert the table standard
let repeater = null; let addBtn = null;
(function walk(n) {
  if (!n) return;
  if (n.type === 'Repeater') repeater = n;
  if (n.type === 'RsButton' && n.events?.onClick?.[0]?.name === 'addRow') addBtn = n;
  (n.children || []).forEach(walk);
})(out.form);

checks.push(['table → Repeater node', !!repeater && repeater.type === 'Repeater']);
checks.push(['Repeater dataKey = container name (spec)', repeater?.dataKey === 'spec']);
checks.push(['Repeater seeds initial rows via props.value', Array.isArray(repeater?.props?.value?.value) && repeater.props.value.value.length === 1]);
checks.push(['cell dataKeys are relative (no spec__0__)', !keys.some((k) => /^spec__\d+__/.test(k))]);
checks.push(['addRow is built-in common action', addBtn?.events.onClick[0].type === 'common' && addBtn?.events.onClick[0].args.dataKey === 'spec']);
checks.push(['no custom row actions emitted', !out.actions.addRow && !out.actions.removeRow && !out.actions.init_table && !out.actions.set_unicode]);
checks.push(['has initFormData action', !!out.actions.initFormData]);
checks.push(['has fetch_dropdown action', !!out.actions.fetch_dropdown]);
checks.push(['has set_date_on_mount action', !!out.actions.set_date_on_mount]);
checks.push(['has set_shift + set_shift_on_time', !!out.actions.set_shift && !!out.actions.set_shift_on_time]);
checks.push(['has set_operator_name action', !!out.actions.set_operator_name]);
checks.push(['Screen onLoadData → initFormData', out.form.events.onLoadData[0].name === 'initFormData']);
checks.push(['defaultLanguage en-US', out.defaultLanguage === 'en-US']);

let selfPass = 0;
checks.forEach(([name, ok]) => {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (ok) selfPass++;
});
console.log(`\nself-test: ${selfPass}/${checks.length} checks passed`);

if (process.env.DUMP) {
  fs.writeFileSync('moulding.out.json', JSON.stringify(out, null, 2));
  console.log('wrote moulding.out.json');
}
