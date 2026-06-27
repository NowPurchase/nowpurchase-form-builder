'use strict';

// ---------------------------------------------------------------------------
// tools.test.mjs — strict tests for the form-editing tool layer (applyTool).
// Every tool: happy path + failure modes + export invariants. Run: npm test
// ---------------------------------------------------------------------------

import { applyTool, applyToolCalls } from './assistant/tools.js';
import { initialState, findNode } from './state/formState.js';
import { exportJSON } from './engine/exportJSON.js';
import { importJSON } from './engine/importJSON.js';
import { exportMultiStep, importMultiStep, isMultiStep } from './engine/multiStep.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

const base = () => ({ ...initialState, sections: [] });
// apply a chain of [name, args] and return final state
function build(steps, start) {
  let s = start || base();
  for (const [name, args] of steps) s = applyTool(s, name, args).state;
  return s;
}
const sec = (s, name) => s.sections.find((x) => x.container_name === name)
  || s.sections.flatMap((x) => x.children || []).find((x) => x.container_name === name);
const fieldBy = (section, ref) => (section.fields || []).find((f) => f.label === ref || f.field_name === ref);
function keysOf(form) { const set = []; (function w(n) { if (!n) return; if (n.key) set.push(n.key); (n.children || []).forEach(w); })(form); return set; }
function dataKeysOf(form) { const out = []; (function w(n) { if (!n) return; if (n.dataKey) out.push(n.dataKey); (n.children || []).forEach(w); })(form); return out; }
function findType(form, type) { let hit = null; (function w(n) { if (!n) return; if (n.type === type && !hit) hit = n; (n.children || []).forEach(w); })(form); return hit; }

// ============ structure ============
{
  let s = build([['add_section', { container_name: 'moulding', label: 'Moulding', fields_per_row: 2 }]]);
  ok('add_section creates section', !!sec(s, 'moulding'));
  eq('add_section fields_per_row', sec(s, 'moulding').fields_per_row, 2);

  s = applyTool(s, 'update_section', { section: 'moulding', label: 'Moulding Details', show_header: false }).state;
  eq('update_section label', sec(s, 'moulding').label, 'Moulding Details');
  eq('update_section show_header', sec(s, 'moulding').show_header, false);

  // rename re-prefixes child field keys
  s = build([['add_field', { section: 'moulding', field_type: 'text', label: 'Heat No' }]], s);
  s = applyTool(s, 'update_section', { section: 'moulding', container_name: 'melting' }).state;
  eq('rename re-derives dataKey', fieldBy(sec(s, 'melting'), 'Heat No').dataKey, 'melting__heat_no');

  // move_section
  s = build([['add_section', { container_name: 'qa' }]], s);
  const before = s.sections.map((x) => x.container_name);
  s = applyTool(s, 'move_section', { section: 'qa', direction: 'up' }).state;
  ok('move_section reorders', s.sections.map((x) => x.container_name).join() !== before.join());

  // nested group + chained key
  s = applyTool(s, 'add_nested_group', { parent_section: 'melting', container_name: 'engine' }).state;
  s = build([['add_field', { section: 'engine', field_type: 'number', label: 'RPM' }]], s);
  eq('nested chained dataKey', fieldBy(sec(s, 'engine'), 'RPM').dataKey, 'melting__engine__rpm');

  // section visibility + clear
  s = applyTool(s, 'set_section_visibility', { section: 'qa', when_field: 'Heat No', operator: 'is_not_empty' }).state;
  eq('section render_when set', sec(s, 'qa').render_when.field, 'melting__heat_no');
  s = applyTool(s, 'set_section_visibility', { section: 'qa', operator: 'always' }).state;
  eq('section render_when cleared', sec(s, 'qa').render_when, null);
}

// ============ fields ============
{
  let s = build([
    ['add_section', { container_name: 'g' }],
    ['add_field', { section: 'g', field_type: 'number', label: 'Total Qty', required: true }],
    ['add_field', { section: 'g', field_type: 'text', label: 'Note' }],
  ]);
  eq('add_field dataKey', fieldBy(sec(s, 'g'), 'Total Qty').dataKey, 'g__total_qty');
  eq('add_field required', fieldBy(sec(s, 'g'), 'Total Qty').required, true);

  s = applyTool(s, 'update_field', { section: 'g', field: 'Note', placeholder: 'hi', required: true }).state;
  eq('update_field placeholder', fieldBy(sec(s, 'g'), 'Note').placeholder, 'hi');
  eq('update_field required', fieldBy(sec(s, 'g'), 'Note').required, true);

  // configure number
  s = applyTool(s, 'configure_field', { section: 'g', field: 'Total Qty', decimal_scale: 2, suffix: 'kg', allow_negative: false }).state;
  eq('configure_field decimal', fieldBy(sec(s, 'g'), 'Total Qty').type_config.decimal_scale, 2);
  eq('configure_field suffix', fieldBy(sec(s, 'g'), 'Total Qty').type_config.suffix, 'kg');

  // configure dropdown options
  s = build([['add_field', { section: 'g', field_type: 'dropdown_fixed', label: 'Grade' }]], s);
  s = applyTool(s, 'configure_field', { section: 'g', field: 'Grade', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }).state;
  eq('configure_field options', fieldBy(sec(s, 'g'), 'Grade').type_config.options.length, 2);
  eq('export dropdown data', findType(exportJSON(s).form, 'RsDropdown').props.data.value.length, 2);

  // referenced static list (per-customer curated values) — only the key travels
  s = build([['add_field', { section: 'g', field_type: 'dropdown_fixed', label: 'Defect', required: true }]], s);
  s = applyTool(s, 'configure_field', { section: 'g', field: 'Defect', options_source: 'list', entity_id: 'defect_type' }).state;
  eq('static list options_source', fieldBy(sec(s, 'g'), 'Defect').type_config.options_source, 'list');
  {
    const exp = exportJSON(s);
    const findKey = (n, dk) => { let h = null; (function w(x) { if (!x) return; if (x.dataKey === dk) h = x; (x.children || []).forEach(w); })(n); return h; };
    const node = findKey(exp.form, 'g__defect');
    eq('static list export data empty', node.props.data.value.length, 0);
    eq('static list disabledItemValues sentinel', node.props.disabledItemValues.value[0], '__none__');
    eq('static list onLoadData action', node.events.onLoadData[0].name, 'load_static_list');
    eq('static list onLoadData entity_id', node.events.onLoadData[0].args.entity_id, 'defect_type');
    eq('static list onLoadData required', node.events.onLoadData[0].args.required, true);
    ok('static list action emitted', !!exp.actions.load_static_list);
  }

  // async dropdown: cascade filter (cross-field) + auto-fill — MCP-authorable
  s = build([['add_field', { section: 'g', field_type: 'dropdown_async', label: 'Part' }]], s);
  s = applyTool(s, 'configure_field', { section: 'g', field: 'Part', entity_id: 'mtc_part_no',
    filters: [{ key: 'client', source: 'field', field: 'g__grade' }],
    on_select_populate: [{ source_path: 'data.name', target_key: 'g__part_name', target_mode: 'field' }] }).state;
  {
    const partCfg = fieldBy(sec(s, 'g'), 'Part').type_config;
    eq('configure_field cascade filter stored', partCfg.filters[0].field, 'g__grade');
    eq('configure_field cascade source', partCfg.filters[0].source, 'field');
    eq('configure_field autofill mapping stored', partCfg.on_select_populate[0].target_key, 'g__part_name');
    // export carries the cascade into the dropdown's onLoadData args
    const exp2 = exportJSON(s);
    const partNode = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.dataKey === 'g__part') h = x; (x.children || []).forEach(w); })(n); return h; })(exp2.form);
    eq('export cascade filter in onLoadData', partNode.events.onLoadData[0].args.filters[0].field, 'g__grade');
  }

  // validations
  s = applyTool(s, 'add_validation', { section: 'g', field: 'Total Qty', type: 'max_value', value: '100', message: 'too big' }).state;
  eq('add_validation stored', fieldBy(sec(s, 'g'), 'Total Qty').validations.length, 1);
  const sch = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.dataKey === 'g__total_qty') h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s).form);
  ok('export validation → schema.code', !!sch.schema && sch.schema.validations.some((v) => v.key === 'code'));
  s = applyTool(s, 'add_validation', { section: 'g', field: 'Note', type: 'required' }).state;
  eq('add_validation required flips flag', fieldBy(sec(s, 'g'), 'Note').required, true);

  // render_when
  s = applyTool(s, 'set_render_when', { section: 'g', field: 'Note', when_field: 'Total Qty', operator: 'greater_than', value: '5' }).state;
  eq('set_render_when field resolved', fieldBy(sec(s, 'g'), 'Note').render_when.field, 'g__total_qty');

  // move_field within
  const order0 = sec(s, 'g').fields.map((f) => f.field_name).join();
  s = applyTool(s, 'move_field', { section: 'g', field: 'Note', direction: 'up' }).state;
  ok('move_field reorders', sec(s, 'g').fields.map((f) => f.field_name).join() !== order0);

  // move_field across sections (dataKey re-derives)
  s = build([['add_section', { container_name: 'other' }]], s);
  s = applyTool(s, 'move_field', { section: 'g', field: 'Note', to_section: 'other' }).state;
  ok('move_field relocates', !fieldBy(sec(s, 'g'), 'Note') && !!fieldBy(sec(s, 'other'), 'Note'));
  eq('relocated dataKey re-prefixed', fieldBy(sec(s, 'other'), 'Note').dataKey, 'other__note');
}

// ============ tables ============
{
  let s = build([['add_table', { container_name: 'charge_mix', label: 'Charge Mix', columns: [
    { header: 'Material', suffix: 'material', field_type: 'dropdown_fixed' },
    { header: 'Qty', suffix: 'qty', field_type: 'number' },
  ] }]]);
  eq('add_table is table', sec(s, 'charge_mix').type, 'table');
  eq('add_table cols', sec(s, 'charge_mix').table_config.columns.length, 2);

  s = applyTool(s, 'update_table', { section: 'charge_mix', row_mode: 'fixed', fixed_rows: 5, min_rows: 2 }).state;
  eq('update_table row_mode', sec(s, 'charge_mix').table_config.row_mode, 'fixed');
  eq('update_table min_rows', sec(s, 'charge_mix').table_config.min_rows, 2);

  s = applyTool(s, 'add_column', { section: 'charge_mix', header: 'Rate', suffix: 'rate', field_type: 'number' }).state;
  eq('add_column', sec(s, 'charge_mix').table_config.columns.length, 3);

  s = applyTool(s, 'update_column', { section: 'charge_mix', column: 'rate', header: 'Rate ₹', required: true }).state;
  const rate = sec(s, 'charge_mix').table_config.columns.find((c) => c.dataKey_suffix === 'rate');
  eq('update_column header', rate.header, 'Rate ₹');
  eq('update_column required', rate.required, true);

  const colOrder = sec(s, 'charge_mix').table_config.columns.map((c) => c.dataKey_suffix).join();
  s = applyTool(s, 'move_column', { section: 'charge_mix', column: 'rate', direction: 'left' }).state;
  ok('move_column reorders', sec(s, 'charge_mix').table_config.columns.map((c) => c.dataKey_suffix).join() !== colOrder);

  s = applyTool(s, 'remove_column', { section: 'charge_mix', column: 'rate' }).state;
  eq('remove_column', sec(s, 'charge_mix').table_config.columns.length, 2);

  // export → Repeater with relative cell keys
  const rep = findType(exportJSON(s).form, 'Repeater');
  ok('table exports Repeater', !!rep && rep.dataKey === 'charge_mix');
  ok('cell keys relative', rep.children[0].children.some((c) => c.dataKey === 'material'));
}

// ============ computed (add_total) ============
{
  let s = build([
    ['add_table', { container_name: 'cm', label: 'CM', columns: [{ header: 'Qty', suffix: 'qty', field_type: 'number' }, { header: 'Rate', suffix: 'rate', field_type: 'number' }] }],
    ['add_section', { container_name: 'totals' }],
    ['add_total', { section: 'totals', label: 'Total Qty', table: 'cm', column: 'qty', op: 'sum' }],
  ]);
  const tot = fieldBy(sec(s, 'totals'), 'Total Qty');
  eq('add_total is computed', tot.field_type, 'computed');
  ok('computed has no dataKey', !tot.dataKey);
  // export: RsInput readOnly with computed value over form.data['cm']
  const node = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.props && x.props.value && x.props.value.computeType === 'function') h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s).form);
  ok('computed exports fnSource', !!node && /form\.data\["cm"\]/.test(node.props.value.fnSource));
  ok('computed is readOnly', node.props.readOnly && node.props.readOnly.value === true);
  ok('computed node has NO dataKey', !node.dataKey);

  // expression form
  s = applyTool(s, 'add_total', { section: 'totals', label: 'Custom', expression: 'form.data.x * 2' }).state;
  const custom = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.props && x.props.value && x.props.value.computeType === 'function' && /x \* 2/.test(x.props.value.fnSource)) h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s).form);
  ok('computed expression wrapped', !!custom && /return \(form\.data\.x \* 2\)/.test(custom.props.value.fnSource));
}

// ============ custom CSS (advanced) ============
{
  let s = build([['add_section', { container_name: 'c1' }]]);
  s = applyTool(s, 'update_section', { section: 'c1', custom_css: 'background:#fff7e6;border:1px solid #e43e2b;' }).state;
  eq('custom_css stored', sec(s, 'c1').custom_css, 'background:#fff7e6;border:1px solid #e43e2b;');
  // export: container css carries both theme object AND the custom string
  const node = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.key === 'c1') h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s).form);
  ok('custom_css → css.string', node.css.any.string === 'background:#fff7e6;border:1px solid #e43e2b;');
  ok('theme object preserved alongside custom', !!node.css.any.object && typeof node.css.any.object === 'object');
  // empty custom_css must NOT add a string block
  const s2 = build([['add_section', { container_name: 'c2' }]]);
  const node2 = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.key === 'c2') h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s2).form);
  ok('no custom → no css.string', !node2.css.any.string);
}

// ============ custom CSS on a field (advanced) ============
{
  let s = build([['add_section', { container_name: 'f' }], ['add_field', { section: 'f', field_type: 'text', label: 'X' }]]);
  s = applyTool(s, 'update_field', { section: 'f', field: 'X', custom_css: '.rs-input{border-color:#e43e2b;}' }).state;
  eq('field custom_css stored', fieldBy(sec(s, 'f'), 'X').custom_css, '.rs-input{border-color:#e43e2b;}');
  const node = (function find(n) { let h = null; (function w(x) { if (!x) return; if (x.dataKey === 'f__x') h = x; (x.children || []).forEach(w); })(n); return h; })(exportJSON(s).form);
  ok('field custom_css in css.string', node.css.any.string.includes('.rs-input{border-color:#e43e2b;}'));
  // appended AFTER theme CSS (theme input rule comes first → user rule wins)
  ok('custom_css appended after theme css', node.css.any.string.indexOf('height:44px') < node.css.any.string.indexOf('#e43e2b'));
}

// ============ meta + theme ============
{
  let s = build([['set_form_meta', { name: 'Heat Log', template_id: 'heat_log' }], ['set_theme', { theme: 'metalcloud' }]]);
  eq('set_form_meta name', s.name, 'Heat Log');
  eq('set_form_meta template_id', s.template_id, 'heat_log');
  eq('set_theme', s.theme, 'metalcloud');
}

// ============ validate_form ============
{
  const clean = build([['add_section', { container_name: 'a' }], ['add_field', { section: 'a', field_type: 'text', label: 'X' }]]);
  ok('validate clean → ok', applyTool(clean, 'validate_form', {}).message.startsWith('✓'));

  // duplicate section names are auto-prevented at creation (second → dup_2)
  const dedup = build([['add_section', { container_name: 'dup' }], ['add_section', { container_name: 'dup' }]]);
  eq('add_section auto-dedupes container names', dedup.sections.map((s) => s.container_name).join(','), 'dup,dup_2');

  // …but validate_form still flags a collision created by a manual rename
  const dup = build([['add_section', { container_name: 'a' }], ['add_section', { container_name: 'b' }], ['update_section', { section: 'b', container_name: 'a' }]]);
  ok('validate flags duplicate names (manual rename collision)', /Duplicate section name/.test(applyTool(dup, 'validate_form', {}).message));
}

// ============ container-name sanitize + dedupe (MCP robustness) ============
{
  // add_table dedupes against existing sections too
  const t = build([['add_section', { container_name: 'samples' }], ['add_table', { container_name: 'samples', columns: [{ header: 'A', suffix: 'a', field_type: 'input' }] }]]);
  eq('add_table dedupes vs existing section', t.sections.map((s) => s.container_name).join(','), 'samples,samples_2');

  // add_nested_group dedupes among its siblings (not against unrelated sections)
  const n = build([
    ['add_section', { container_name: 'parent' }],
    ['add_nested_group', { parent_section: 'parent', container_name: 'grp' }],
    ['add_nested_group', { parent_section: 'parent', container_name: 'grp' }],
  ]);
  const kids = n.sections.find((s) => s.container_name === 'parent').children.map((c) => c.container_name);
  eq('add_nested_group dedupes siblings', kids.join(','), 'grp,grp_2');

  // messy + reserved names are sanitized to valid, unique container keys
  const m = build([['add_section', { container_name: 'My Section! #1' }], ['add_section', { container_name: 'data' }]]);
  eq('add_section snake-cases a messy name', m.sections[0].container_name, 'my_section_1');
  ok('add_section avoids reserved names', m.sections[1].container_name !== 'data' && /^data_\d+$/.test(m.sections[1].container_name));
}

// ============ failure modes (must NOT mutate, must warn) ============
{
  const s = build([['add_section', { container_name: 'm' }], ['add_field', { section: 'm', field_type: 'text', label: 'A' }]]);
  const snap = JSON.stringify(s);
  const cases = [
    ['add_field', { section: 'nope', field_type: 'text', label: 'x' }],
    ['add_field', { section: 'm', field_type: 'banana', label: 'x' }],
    ['update_field', { section: 'm', field: 'ghost', label: 'y' }],
    ['remove_field', { section: 'm', field: 'ghost' }],
    ['move_field', { section: 'm', field: 'A', to_section: 'nope' }],
    ['configure_field', { section: 'm', field: 'A' }],
    ['update_table', { section: 'm' }],
    ['add_column', { section: 'm', header: 'h', suffix: 's' }],
    ['set_render_when', { section: 'm', field: 'ghost', when_field: 'A', operator: 'equals', value: '1' }],
  ];
  let warned = 0; let mutated = 0;
  for (const [n, a] of cases) {
    const r = applyTool(s, n, a);
    if (String(r.message).startsWith('⚠')) warned += 1;
    if (JSON.stringify(r.state) !== snap) mutated += 1;
  }
  eq('all bad calls warn', warned, cases.length);
  eq('no bad call mutates state', mutated, 0);
}

// ============ export invariants on a big assembled form ============
{
  const s = build([
    ['add_section', { container_name: 'head', label: 'Header' }],
    ['add_field', { section: 'head', field_type: 'date', label: 'Date' }],
    ['add_field', { section: 'head', field_type: 'supervisor', label: 'Supervisor' }],
    ['add_table', { container_name: 'mix', label: 'Mix', columns: [{ header: 'Mat', suffix: 'mat', field_type: 'dropdown_fixed' }, { header: 'Qty', suffix: 'qty', field_type: 'number' }] }],
    ['add_section', { container_name: 'sum' }],
    ['add_total', { section: 'sum', label: 'Total', table: 'mix', column: 'qty', op: 'sum' }],
  ]);
  const out = exportJSON(s);
  const keys = keysOf(out.form);
  const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
  eq('export: no duplicate node keys', dups.length, 0);
  ok('export: version', out.version === '1');
  ok('export: has Repeater', !!findType(out.form, 'Repeater'));
  const dks = dataKeysOf(out.form);
  ok('export: no __N__ legacy keys', !dks.some((k) => /__\d+__/.test(k)));

  // round-trip through importJSON does not throw and preserves the Repeater
  let reimported = false;
  try { const st = importJSON(out); reimported = !!findType(exportJSON(st).form, 'Repeater'); } catch { reimported = false; }
  ok('round-trip import→export keeps Repeater', reimported);
}

// ============ spectrometer (np-dlms custom field) ============
{
  let s = build([
    ['add_section', { container_name: 'chemistry', label: 'Chemistry' }],
    ['add_field', { section: 'chemistry', field_type: 'spectrometer', label: 'Composition', url: 'https://dev/read', elements: 'C,Si,Mn', columns_per_row: 3, show_connection_status: false }],
  ]);
  const f = fieldBy(sec(s, 'chemistry'), 'Composition');
  ok('spectrometer field added', !!f && f.field_type === 'spectrometer');
  eq('spectrometer cfg url', f.type_config.url, 'https://dev/read');
  eq('spectrometer cfg elements', f.type_config.elements, 'C,Si,Mn');
  eq('spectrometer cfg columns_per_row', f.type_config.columns_per_row, 3);
  eq('spectrometer cfg show_connection_status', f.type_config.show_connection_status, false);

  const node = findType(exportJSON(s).form, 'RsSpectrometerReading');
  ok('export emits RsSpectrometerReading', !!node);
  ok('spectrometer has a dataKey', !!node.dataKey);
  eq('export url prop', node.props.url.value, 'https://dev/read');
  eq('export elements prop', node.props.elements.value, 'C,Si,Mn');
  eq('export columnsPerRow prop', node.props.columnsPerRow.value, 3);
  eq('export showConnectionStatus prop', node.props.showConnectionStatus.value, false);

  // configure_field edits the spectrometer config
  s = applyTool(s, 'configure_field', { section: 'chemistry', field: 'Composition', elements: 'C,Si,Mn,P,S', columns_per_row: 5 }).state;
  eq('configure_field updates elements', fieldBy(sec(s, 'chemistry'), 'Composition').type_config.elements, 'C,Si,Mn,P,S');

  // round-trip: import the exported form, spectrometer survives
  const out = exportJSON(s);
  let survives = false;
  try { survives = !!findType(exportJSON(importJSON(out)).form, 'RsSpectrometerReading'); } catch { survives = false; }
  ok('spectrometer round-trips through import/export', survives);
}

// ============ chips (np-dlms free-entry tag field) ============
{
  let s = build([
    ['add_section', { container_name: 'lab', label: 'Lab' }],
    ['add_field', { section: 'lab', field_type: 'chips', label: 'Heat Numbers', allow_duplicates: true, max_chips: 5 }],
  ]);
  const ch = fieldBy(sec(s, 'lab'), 'Heat Numbers');
  ok('chips field added', !!ch && ch.field_type === 'chips');
  eq('chips cfg allow_duplicates', ch.type_config.allow_duplicates, true);
  eq('chips cfg max_chips', ch.type_config.max_chips, 5);

  const chNode = findType(exportJSON(s).form, 'RsChipInput');
  ok('export emits RsChipInput', !!chNode && !!chNode.dataKey);
  eq('chips export allowDuplicates', chNode.props.allowDuplicates.value, true);
  eq('chips export maxChips', chNode.props.maxChips.value, 5);

  // configure_field edits chips
  s = applyTool(s, 'configure_field', { section: 'lab', field: 'Heat Numbers', max_chips: 10 }).state;
  eq('configure_field updates max_chips', fieldBy(sec(s, 'lab'), 'Heat Numbers').type_config.max_chips, 10);

  // round-trip
  const out = exportJSON(s);
  let ok2 = false;
  try { ok2 = !!findType(exportJSON(importJSON(out)).form, 'RsChipInput'); } catch { ok2 = false; }
  ok('chips round-trips through import/export', ok2);
}

// ====== imported form-level actions survive round-trip + edit (regression) ======
// Guards the bug where exportJSON regenerated actions from scratch and dropped
// an imported form's existing behaviours (addRow/total/auto-fill).
{
  const imported = {
    version: '1',
    actions: {
      total_sum: { body: 'return 1;', params: {} },
      addCoreRow: { body: 'return;', params: {} },
      set_date_on_mount: { body: 'return;', params: {} },
    },
    errorType: 'RsErrorMessage',
    form: {
      key: 'Screen', type: 'Screen', props: {},
      events: { onLoadData: [{ name: 'initFormData', type: 'code' }] },
      children: [{
        key: 'mould', type: 'RsContainer',
        children: [{ key: 'qty', type: 'RsInput', dataKey: 'mould__qty', props: { label: { value: 'Qty' } } }],
      }],
    },
    localization: {}, languages: [], defaultLanguage: 'en-US',
  };
  const st = importJSON(imported);
  let out = exportJSON(st);
  ok('imported actions preserved (total_sum)', !!out.actions.total_sum);
  ok('imported actions preserved (addCoreRow)', !!out.actions.addCoreRow);
  ok('generated initFormData still added', !!out.actions.initFormData);
  ok('builder signature stamped', !!(out._builder && out._builder.name === 'np-ui-builder' && out._builder.version));
  ok('original Screen events preserved', JSON.stringify(out.form).includes('initFormData'));
  // editing the imported form must NOT drop its actions
  out = exportJSON(applyTool(st, 'add_section', { container_name: 'extra' }).state);
  ok('actions survive after editing imported form', !!out.actions.total_sum && !!out.actions.addCoreRow);
  ok('imported dataKey preserved after edit', JSON.stringify(out.form).includes('mould__qty'));
}

// ============ multi-step (steps layer on top of the single-form engine) ======
{
  const stepA = build([['add_section', { container_name: 'moulding' }], ['add_field', { section: 'moulding', field_type: 'number', label: 'Qty' }]]);
  const stepB = build([['add_section', { container_name: 'inspect' }], ['add_field', { section: 'inspect', field_type: 'text', label: 'Remarks' }]]);
  const steps = [{ name: 'Moulding', state: stepA }, { name: 'Inspection', state: stepB }];

  const ms = exportMultiStep(steps);
  ok('multi-step export has sections[]', Array.isArray(ms.sections) && ms.sections.length === 2);
  eq('step 1 section_name', ms.sections[0].section_name, 'Moulding');
  eq('step 2 section_name', ms.sections[1].section_name, 'Inspection');
  ok('each step is its own FormEngine form', !!ms.sections[0].form_json.form && !!ms.sections[1].form_json.form);
  ok('isMultiStep detects multi-step', isMultiStep(ms));
  ok('isMultiStep false for single form', !isMultiStep(exportJSON(stepA)));

  const back = importMultiStep(ms);
  eq('round-trip step count', back.length, 2);
  eq('round-trip preserves step name', back[1].name, 'Inspection');
  const reMs = exportMultiStep(back);
  ok('round-trip preserves step-1 dataKey', JSON.stringify(reMs.sections[0]).includes('moulding__qty'));
  ok('round-trip preserves step-2 dataKey', JSON.stringify(reMs.sections[1]).includes('inspect__remarks'));
}

// ============ Tier 1: default value, calculated field, validations ==========
{
  let s = build([
    ['add_section', { container_name: 'm' }],
    ['add_field', { section: 'm', field_type: 'date', label: 'Pour Date' }],
    ['add_field', { section: 'm', field_type: 'number', label: 'A' }],
    ['add_field', { section: 'm', field_type: 'number', label: 'B' }],
  ]);

  // --- default value ---
  s = applyTool(s, 'set_default', { section: 'm', field: 'Pour Date', mode: 'today' }).state;
  eq('set_default stores mode', fieldBy(sec(s, 'm'), 'Pour Date').default_value.mode, 'today');
  let ex = exportJSON(s);
  ok('default wires onDidMount set_default_value', JSON.stringify(ex.form).includes('set_default_value'));
  ok('set_default_value action emitted', !!ex.actions.set_default_value);
  s = applyTool(s, 'set_default', { section: 'm', field: 'Pour Date', mode: 'none' }).state;
  eq('set_default none clears it', fieldBy(sec(s, 'm'), 'Pour Date').default_value, null);

  // --- calculated field across form fields ---
  s = applyTool(s, 'add_total', { section: 'm', label: 'Total', fields: ['m__a', 'm__b'], op: 'sum' }).state;
  const calc = JSON.stringify(exportJSON(s).form);
  ok('calculated field uses computeType function', calc.includes('computeType') && calc.includes('function'));
  ok('calculated field references picked fields', calc.includes('m__a') && calc.includes('m__b'));

  // --- validations ---
  s = applyTool(s, 'add_validation', { section: 'm', field: 'A', type: 'between', min: 1, max: 10 }).state;
  s = applyTool(s, 'add_validation', { section: 'm', field: 'B', type: 'compare_field', op: '>', other_field: 'm__a' }).state;
  s = applyTool(s, 'add_validation', { section: 'm', field: 'A', type: 'required_when', validate_when: 'form.data.m__b' }).state;
  const vs = JSON.stringify(exportJSON(s).form);
  ok('between validation emits range check', vs.includes('Number(value) < 1') && vs.includes('Number(value) > 10'));
  ok('compare_field validation references other field', vs.includes('m__a') && vs.includes('Number(value) >'));
  ok('required_when emits validateWhen', vs.includes('validateWhen'));
}

// ============ on-submit (advanced raw code) ============
{
  let s = build([['add_section', { container_name: 'm' }], ['add_field', { section: 'm', field_type: 'number', label: 'A' }]]);
  s = applyTool(s, 'set_on_submit', { code: 'e.data.total = Number(e.data.m__a)||0;' }).state;
  ok('set_on_submit stores code', !!s.on_submit && /e\.data\.total/.test(s.on_submit.code));
  const ex = exportJSON(s);
  ok('export emits actions.onSubmit', !!ex.actions.onSubmit && /e\.data\.total/.test(ex.actions.onSubmit.body));
  ok('onSubmit wrapped in try/catch', /try \{/.test(ex.actions.onSubmit.body) && /catch/.test(ex.actions.onSubmit.body));
  s = applyTool(s, 'set_on_submit', { code: '' }).state;
  eq('set_on_submit empty clears it', s.on_submit, null);
  ok('cleared → no onSubmit in export', !exportJSON(s).actions.onSubmit);
}

// ============ unique column (cross-row uniqueness via formValidator) ========
{
  let s = build([
    ['add_table', { container_name: 'cm', label: 'Charge Mix', columns: [
      { header: 'Material', suffix: 'material', field_type: 'input' },
      { header: 'Qty', suffix: 'qty', field_type: 'number' },
    ] }],
  ]);
  s = applyTool(s, 'update_column', { section: 'cm', column: 'material', unique: true }).state;
  eq('unique flag stored on column', sec(s, 'cm').table_config.columns[0].unique, true);

  const ex = exportJSON(s);
  ok('unique column generates a formValidator', typeof ex.formValidator === 'string' && ex.formValidator.includes('_uniqueGroups'));

  // run the generated validator like FormEngine would: (formData) => errors
  const validate = new Function('formData', ex.formValidator);
  const dup = validate({ cm: [{ material: 'x' }, { material: 'x' }] }) || {};
  ok('duplicate detected', Object.keys(dup).length > 0 && JSON.stringify(dup).toLowerCase().includes('unique'));
  // errors must mirror the data: a NESTED array (errors[table][rowIndex][column]),
  // which is the only shape FormEngine's Repeater field accepts. A flat key or a
  // bare table-level string makes the repeater throw and aborts validate().
  ok('errors use the nested array shape', Array.isArray(dup.cm));
  // only the LATER row is flagged; the first occurrence stays valid
  ok('offending (later) row flagged', !!(dup.cm[1] && dup.cm[1].material));
  ok('first occurrence NOT flagged', !(dup.cm[0] && dup.cm[0].material));
  ok('message points back at the original row', /already used in row 1/.test(dup.cm[1].material));
  ok('no bare table-level string (would crash the repeater)', typeof dup.cm !== 'string');
  // three identical values: rows 2 and 3 both flagged, both pointing at row 1
  const tri = validate({ cm: [{ material: 'x' }, { material: 'x' }, { material: 'x' }] }) || {};
  ok('triple: row 1 stays clean', !(tri.cm[0] && tri.cm[0].material));
  ok('triple: row 2 flagged -> row 1', !!tri.cm[1] && /already used in row 1/.test(tri.cm[1].material));
  ok('triple: row 3 flagged -> row 1', !!tri.cm[2] && /already used in row 1/.test(tri.cm[2].material));
  const clean = validate({ cm: [{ material: 'x' }, { material: 'y' }] }) || {};
  ok('no error when all values unique', Object.keys(clean).length === 0);
  const noFlag = exportJSON(applyTool(s, 'update_column', { section: 'cm', column: 'material', unique: false }).state);
  ok('clearing unique removes the validator', noFlag.formValidator === undefined);

  // unique on a boolean column is ignored (meaningless on true/false)
  let b = build([['add_table', { container_name: 'tb', label: 'T', columns: [{ header: 'Done', suffix: 'done', field_type: 'checkbox' }] }]]);
  b = applyTool(b, 'update_column', { section: 'tb', column: 'done', unique: true }).state;
  ok('unique on boolean column produces no validator', exportJSON(b).formValidator === undefined);

  // unique on an async/API dropdown compares the stored selection (__label key)
  let a = build([['add_table', { container_name: 'am', label: 'AM', columns: [{ header: 'Material', suffix: 'material', field_type: 'dropdown_async' }] }]]);
  a = applyTool(a, 'update_column', { section: 'am', column: 'material', unique: true }).state;
  const av = exportJSON(a).formValidator;
  ok('async-unique validator targets the __label key', typeof av === 'string' && av.includes('material__label'));
  const dupSel = new Function('formData', av)({ am: [{ material__label: 'Steel-A' }, { material__label: 'Steel-A' }] }) || {};
  ok('duplicate async selection detected', Object.keys(dupSel).length > 0);
}

// ============ master-dropdown: entity registry + filters wiring ============
{
  const findType = (form, type) => { let h = null; (function w(n) { if (!n) return; if (n.type === type && !h) h = n; (n.children || []).forEach(w); })(form); return h; };

  // entity registry sanity
  const reg = await import('./state/entities.js');
  ok('entity registry non-empty', Array.isArray(reg.ENTITIES) && reg.ENTITIES.length > 0);
  ok('entities have id/label/fields', reg.ENTITIES.every((e) => e.id && e.label && Array.isArray(e.fields)));
  ok('getEntity resolves a known id', !!reg.getEntity('casting_master') && reg.getEntity('nope') === null);

  // build a master dropdown, set entity/search + filters, and export
  let s = build([['add_section', { container_name: 'm' }], ['add_field', { section: 'm', field_type: 'dropdown_async', label: 'Material' }]]);
  s = applyTool(s, 'configure_field', { section: 'm', field: 'Material', entity_id: 'casting_master', search_fields: 'name' }).state;
  // filters aren't a tool arg (set via the config popup UI) — set on type_config directly
  const fld = sec(s, 'm').fields.find((f) => f.label === 'Material');
  fld.type_config.filters = [
    { key: 'status', source: 'static', value: 'pending' },
    { key: 'grade', source: 'field', field: 'm__grade' },
  ];

  const node = findType(exportJSON(s).form, 'RsDropdown');
  const args = node.events.onLoadData[0].args;
  eq('export carries entity_id', args.entity_id, 'casting_master');
  eq('export carries search field', args.search_fields, 'name');
  ok('export carries filters array', Array.isArray(args.filters) && args.filters.length === 2);
  ok('static filter preserved', args.filters.some((x) => x.key === 'status' && x.source === 'static' && x.value === 'pending'));
  ok('field-sourced filter preserved', args.filters.some((x) => x.key === 'grade' && x.source === 'field' && x.field === 'm__grade'));

  // DLMS-default entity: NO baked request contract (legacy fetch path)
  ok('DLMS entity omits request contract', args.request === undefined);

  // the generated fetch_dropdown runtime action must apply filters (static + from field)
  const fd = (exportJSON(s).actions || {}).fetch_dropdown;
  ok('fetch_dropdown action emitted', !!fd && typeof fd.body === 'string');
  ok('fetch_dropdown applies filters', /filters/.test(fd.body) && /e\.data\[flt\.field\]/.test(fd.body));
  ok('fetch_dropdown handles generic contract + auth by backend', /request\.url/.test(fd.body) && /Token /.test(fd.body) && /Bearer /.test(fd.body));

  // Django/MTC entity: bakes a generic GET contract (method/url/searchParam/response)
  let d = build([['add_section', { container_name: 'q' }], ['add_field', { section: 'q', field_type: 'dropdown_async', label: 'Part' }]]);
  d = applyTool(d, 'configure_field', { section: 'q', field: 'Part', entity_id: 'mtc_part_no' }).state;
  const dArgs = findType(exportJSON(d).form, 'RsDropdown').events.onLoadData[0].args;
  ok('django entity bakes a request contract', !!dArgs.request);
  eq('django request method', dArgs.request.method, 'GET');
  ok('django request url is full + staging host', /^https:\/\/test-api\.nowpurchase\.com\/.*part_no_dropdown\/$/.test(dArgs.request.url));
  eq('django request backend', dArgs.request.backend, 'django');
  ok('django response mapping present', dArgs.request.response && dArgs.request.response.valueKey === 'id' && dArgs.request.response.labelKey === 'name');
}

// ---------------------------------------------------------------------------
console.log(`\ntools.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
