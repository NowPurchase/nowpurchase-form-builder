'use strict';

// ---------------------------------------------------------------------------
// formState.test.mjs — tests the builder reducer's STABLE numbered defaults
// (easier for the product team; nothing hidden; all editable). Run: npm run test:state
//
// Principle: a label is display, a key is identity. New sections/fields get a
// stable numbered key + matching label ("Section 1"/section_1, "Input 1"/input_1)
// so a user can start immediately — but editing a LABEL must NEVER change the
// KEY (that would break data binding on a saved form). Keys move only on an
// explicit key edit.
// ---------------------------------------------------------------------------

import { reducer, initialState, findNode } from './formState.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

const reduce = (state, ...actions) => actions.reduce((s, a) => reducer(s, a), state);
const firstSec = (s) => s.sections[0];

// ============ new sections get a stable numbered key + label =================
{
  let s = reduce(initialState, { type: 'ADD_SECTION' });
  eq('section default key', firstSec(s).container_name, 'section_1');
  eq('section default label', firstSec(s).label, 'Section 1');
  s = reducer(s, { type: 'ADD_SECTION' });
  eq('second section key', s.sections[1].container_name, 'section_2');
  eq('second section label', s.sections[1].label, 'Section 2');
}

// ============ new fields get a stable numbered key + label ====================
{
  let s = reduce(initialState, { type: 'ADD_SECTION' });
  const id = firstSec(s).id;
  s = reducer(s, { type: 'ADD_FIELD', sectionId: id, fieldType: 'text' });
  s = reducer(s, { type: 'ADD_FIELD', sectionId: id, fieldType: 'number' });
  const [f1, f2] = firstSec(s).fields;
  eq('field 1 label', f1.label, 'Input 1');
  eq('field 1 key', f1.field_name, 'input_1');
  eq('field 1 dataKey', f1.dataKey, 'section_1__input_1');
  eq('field 2 key', f2.field_name, 'input_2');
  eq('field 2 dataKey', f2.dataKey, 'section_1__input_2');
}

// ============ THE GUARANTEE: editing a label never moves the key ==============
{
  let s = reduce(initialState, { type: 'ADD_SECTION' });
  const id = firstSec(s).id;
  s = reducer(s, { type: 'ADD_FIELD', sectionId: id, fieldType: 'text' });
  const fid = firstSec(s).fields[0].id;

  // rename the section LABEL → key must NOT change
  s = reducer(s, { type: 'UPDATE_SECTION', sectionId: id, patch: { label: 'Moulding Details' } });
  eq('section label changed', firstSec(s).label, 'Moulding Details');
  eq('section KEY unchanged by label edit', firstSec(s).container_name, 'section_1');

  // rename the field LABEL → key + dataKey must NOT change
  s = reducer(s, { type: 'UPDATE_FIELD', sectionId: id, fieldId: fid, patch: { label: 'Heat Number' } });
  const f = firstSec(s).fields[0];
  eq('field label changed', f.label, 'Heat Number');
  eq('field KEY unchanged by label edit', f.field_name, 'input_1');
  eq('field dataKey unchanged by label edit', f.dataKey, 'section_1__input_1');
}

// ============ keys still editable on purpose =================================
{
  let s = reduce(initialState, { type: 'ADD_SECTION' });
  const id = firstSec(s).id;
  s = reducer(s, { type: 'ADD_FIELD', sectionId: id, fieldType: 'text' });
  const fid = firstSec(s).fields[0].id;

  // explicit section key edit applies AND re-prefixes child field dataKeys
  s = reducer(s, { type: 'UPDATE_SECTION', sectionId: id, patch: { container_name: 'melting' } });
  eq('section key edited', firstSec(s).container_name, 'melting');
  eq('child dataKey re-prefixed', firstSec(s).fields[0].dataKey, 'melting__input_1');

  // explicit field key edit applies
  s = reducer(s, { type: 'UPDATE_FIELD', sectionId: id, fieldId: fid, patch: { field_name: 'heat_no' } });
  eq('field key edited', firstSec(s).fields[0].field_name, 'heat_no');
  eq('field dataKey follows the edited key', firstSec(s).fields[0].dataKey, 'melting__heat_no');
}

// ============ nested groups get a stable default; display fields don't get keys
{
  let s = reduce(initialState, { type: 'ADD_SECTION' });
  const id = firstSec(s).id;
  s = reducer(s, { type: 'ADD_SUBCONTAINER', parentId: id });
  const grp = findNode(s.sections, id).children[0];
  eq('nested group key', grp.container_name, 'group_1');
  eq('nested group label', grp.label, 'Group 1');

  s = reducer(s, { type: 'ADD_FIELD', sectionId: id, fieldType: 'header' });
  const hdr = firstSec(s).fields.find((f) => f.field_type === 'header');
  ok('display field has no input_ key', !/^input_/.test(hdr.field_name || ''));
  eq('display field has no dataKey', hdr.dataKey, '');
}

// ============ loading a form leaves its identifiers exactly as-is =============
{
  const loaded = {
    ...initialState,
    name: 'Old', template_id: 'real-uuid-123',
    sections: [{ id: 'sx', container_name: 'melting', label: 'Melting', show_header: true, fields: [], children: [], type: 'standard', table_config: null }],
  };
  let s = reducer(initialState, { type: 'LOAD_STATE', state: loaded });
  eq('loaded template_id preserved', s.template_id, 'real-uuid-123');
  s = reducer(s, { type: 'UPDATE_SECTION', sectionId: 'sx', patch: { label: 'Melting Zone' } });
  eq('loaded section key untouched by label edit', findNode(s.sections, 'sx').container_name, 'melting');
}

// ---------------------------------------------------------------------------
console.log(`\nformState.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
