'use strict';

// ---------------------------------------------------------------------------
// keyGraph.test.mjs — strict tests for the form key registry + reference index.
// Run: npm run test:keygraph
// ---------------------------------------------------------------------------

import {
  collectKeys, collectReferences, buildReferenceIndex,
  referencesTo, subtreeKeys, referenceableKeys,
} from './keyGraph.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

// A small form: section "casting" with a text field, an async dropdown (with
// explicit value/label + auto-fill keys), and consumers referencing them.
function sampleState() {
  return {
    on_submit: { code: 'return form.data.casting__qty > 0;' },
    sections: [
      {
        id: 'sec1', container_name: 'casting', label: 'Casting',
        render_when: null,
        fields: [
          { id: 'f_qty', field_name: 'qty', label: 'Qty', field_type: 'number', dataKey: 'casting__qty', type_config: {} },
          {
            id: 'f_part', field_name: 'part', label: 'Part', field_type: 'dropdown_async',
            dataKey: 'casting__part',
            type_config: {
              entity_id: 'casting_master', search_fields: 'name',
              filters: [{ key: 'client', source: 'field', field: 'casting__qty' }],
              on_select_populate: [
                { source_path: 'name', target_key: 'casting__part__name', target_mode: 'auto' },
                { source_path: 'grade', target_key: 'casting__grade_copy', target_mode: 'field' },
              ],
            },
          },
          {
            id: 'f_grade', field_name: 'grade', label: 'Grade', field_type: 'text', dataKey: 'casting__grade',
            render_when: { mode: 'condition', field: 'casting__part', operator: 'is_not_empty' },
            default_value: { mode: 'from_field', source_field: 'casting__part__name' },
            validations: [
              { type: 'compare_field', op: '>', other_field: 'casting__qty' },
              { type: 'required_when', validate_when: 'form.data.casting__qty > 5' },
            ],
            type_config: {},
          },
          {
            id: 'f_total', field_name: 'total', label: 'Total', field_type: 'computed', dataKey: '',
            type_config: { op: 'sum', source_fields: ['casting__qty'], expression: 'form.data.casting__qty * 2' },
          },
          {
            id: 'f_tags', field_name: 'tags', label: 'Tags', field_type: 'tags_async', dataKey: 'casting__tags',
            type_config: { entity_id: 'casting_master', search_fields: 'name', on_select_populate: [{ source_path: 'grade', target_key: 'casting__tags__grade', target_mode: 'auto' }] },
          },
        ],
        children: [],
      },
    ],
  };
}

// ============ collectKeys — real fields + async dropdown + auto-fill ============
{
  const keys = collectKeys(sampleState());
  const byKey = (k) => keys.find((x) => x.key === k);
  ok('casting__qty is a field key', byKey('casting__qty')?.kind === 'field');
  ok('async dropdown id key = its dataKey (base)', byKey('casting__part')?.kind === 'dropdown');
  ok('single dropdown label key present', byKey('casting__part__label')?.kind === 'dropdown_label');
  ok('auto-fill key present (virtual)', byKey('casting__part__name')?.kind === 'autofill');
  ok('copy-into target is NOT a produced key', !byKey('casting__grade_copy'));
  ok('computed field produces no key', !byKey('') && !keys.some((k) => k.ownerFieldId === 'f_total'));
  ok('auto-fill key grouped under the dropdown', byKey('casting__part__name')?.group === 'from Part');
  ok('dropdown id key grouped under its section', byKey('casting__part')?.group === 'casting');
  // multi-select: id array at base + objects at __items; folded fields are NOT separate keys
  ok('multi-select id key = its dataKey', byKey('casting__tags')?.kind === 'dropdown');
  ok('multi-select items key present', byKey('casting__tags__items')?.kind === 'dropdown_items');
  ok('multi-select folded field is NOT a separate key', !byKey('casting__tags__grade'));
}

// ============ collectReferences — structured vs best-effort ============
{
  const refs = collectReferences(sampleState());
  const to = (k) => refs.filter((r) => r.key === k);
  ok('render_when ref to async dropdown id key', to('casting__part').some((r) => r.consumer.where === 'render_when' && r.consumer.bestEffort === false));
  ok('default_value ref to auto-fill key', to('casting__part__name').some((r) => r.consumer.where === 'default_value'));
  ok('compare validation ref (structured)', to('casting__qty').some((r) => r.consumer.where === 'validation' && r.consumer.bestEffort === false));
  ok('cascade filter ref (structured)', to('casting__qty').some((r) => r.consumer.where === 'cascade'));
  ok('copy-into target ref (structured)', to('casting__grade_copy').some((r) => r.consumer.where === 'autofill_target'));
  ok('computed source_fields ref (structured)', to('casting__qty').some((r) => r.consumer.where === 'computed' && r.consumer.bestEffort === false));
  ok('formula ref is best-effort', to('casting__qty').some((r) => r.consumer.where === 'computed' && r.consumer.bestEffort === true));
  ok('validate_when ref is best-effort', to('casting__qty').some((r) => r.consumer.where === 'validation' && r.consumer.bestEffort === true));
  ok('on_submit code ref is best-effort', to('casting__qty').some((r) => r.consumer.where === 'on_submit' && r.consumer.bestEffort === true));
}

// ============ buildReferenceIndex + referencesTo — dedup, O(1) lookup ============
{
  const idx = buildReferenceIndex(sampleState());
  ok('index is a Map', idx instanceof Map);
  const partRefs = referencesTo(idx, ['casting__part']);
  ok('casting__part has at least one consumer', partRefs.length >= 1);
  const qtyRefs = referencesTo(idx, ['casting__qty']);
  ok('casting__qty has multiple distinct consumers', qtyRefs.length >= 4);
  // dedup across overlapping key lists
  const dup = referencesTo(idx, ['casting__qty', 'casting__qty']);
  eq('duplicate keys do not double-count', dup.length, qtyRefs.length);
  eq('unknown key → no refs', referencesTo(idx, ['nope__nope']).length, 0);
  // form.data. prefix normalises to bare key
  eq('referencesTo normalises form.data. prefix', referencesTo(idx, ['form.data.casting__part']).length, partRefs.length);
}

// ============ subtreeKeys — section cascade coverage ============
{
  const st = sampleState();
  const keys = subtreeKeys(st, 'sec1');
  ok('subtree includes field key', keys.includes('casting__qty'));
  ok('subtree includes async dropdown id key', keys.includes('casting__part'));
  ok('subtree includes single dropdown label key', keys.includes('casting__part__label'));
  ok('subtree includes auto-fill key', keys.includes('casting__part__name'));
  eq('unknown section → empty', subtreeKeys(st, 'nope').length, 0);
}

// ============ referenceableKeys — excludes own field, deduped, grouped ============
{
  const st = sampleState();
  const opts = referenceableKeys(st, 'f_part');
  ok('excludes own dropdown id key', !opts.some((o) => o.key === 'casting__part'));
  ok('excludes own dropdown label key', !opts.some((o) => o.key === 'casting__part__label'));
  ok('excludes own auto-fill key', !opts.some((o) => o.key === 'casting__part__name'));
  ok('includes other field key', opts.some((o) => o.key === 'casting__qty'));
  ok('options carry a group', opts.every((o) => typeof o.group === 'string'));
  const keysOnly = opts.map((o) => o.key);
  eq('no duplicate keys', keysOnly.length, new Set(keysOnly).size);
}

// ============ scale sanity — ~350 keys build + lookup correctly ============
{
  const fields = [];
  for (let i = 0; i < 350; i += 1) {
    fields.push({ id: `f${i}`, field_name: `f${i}`, label: `F${i}`, field_type: 'text', dataKey: `big__f${i}`, type_config: {} });
  }
  // one field references the very last key
  fields[0].render_when = { mode: 'condition', field: 'big__f349', operator: 'equals', value: '1' };
  const big = { sections: [{ id: 'big', container_name: 'big', fields, children: [] }] };
  const idx = buildReferenceIndex(big);
  eq('large form: 350 keys collected', collectKeys(big).length, 350);
  eq('large form: lookup finds the one ref', referencesTo(idx, ['big__f349']).length, 1);
  eq('large form: unreferenced key → 0', referencesTo(idx, ['big__f100']).length, 0);
}

// ---------------------------------------------------------------------------
console.log(`\nkeyGraph.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
