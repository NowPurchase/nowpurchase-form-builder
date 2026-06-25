'use strict';

// ---------------------------------------------------------------------------
// dropdownMap.test.mjs — strict tests for the master-dropdown option mapping.
// Locks the "save the id; fall back to the displayed value" rule.
// Run: npm run test:dropdownmap
// ---------------------------------------------------------------------------

import { mapDropdownItem } from './dropdownMap.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

const RESP = { valueKey: 'id', labelKey: 'name' };

// ============ happy path — id saved as value, name as label ============
{
  const o = mapDropdownItem({ id: 7, name: 'Steel A' }, RESP);
  eq('value is the id, string-coerced', o.value, '7');
  eq('label is the name', o.label, 'Steel A');
  ok('full record kept under data', o.data && o.data.id === 7);
}

// ============ numeric / string id coercion ============
{
  eq('numeric id → string', mapDropdownItem({ id: 42, name: 'X' }, RESP).value, '42');
  eq('string id kept', mapDropdownItem({ id: 'abc', name: 'X' }, RESP).value, 'abc');
  eq('zero id is preserved (not treated as empty)', mapDropdownItem({ id: 0, name: 'X' }, RESP).value, '0');
}

// ============ no id → fall back to the displayed value ============
{
  const missing = mapDropdownItem({ name: 'Only Name' }, RESP);
  eq('missing id → value falls back to label', missing.value, 'Only Name');
  eq('label still shown', missing.label, 'Only Name');

  const empty = mapDropdownItem({ id: '', name: 'Empty Id' }, RESP);
  eq('empty-string id → value falls back to label', empty.value, 'Empty Id');

  const nullId = mapDropdownItem({ id: null, name: 'Null Id' }, RESP);
  eq('null id → value falls back to label', nullId.value, 'Null Id');
}

// ============ no id AND no label → empty value, never crashes ============
{
  const blank = mapDropdownItem({}, RESP);
  eq('no id, no label → empty value', blank.value, '');
  eq('no id, no label → empty label', blank.label, '');
}

// ============ custom valueKey / labelKey (per contract) ============
{
  const grade = mapDropdownItem({ grade_id: 12, name: 'EN8' }, { valueKey: 'grade_id', labelKey: 'name' });
  eq('custom valueKey (grade_id) used as value', grade.value, '12');
  eq('custom labelKey used as label', grade.label, 'EN8');

  const heat = mapDropdownItem({ id: 5, heat_code: 'H-9' }, { valueKey: 'id', labelKey: 'heat_code' });
  eq('label from heat_code', heat.label, 'H-9');
}

// ============ label present but value missing → label is value AND label ============
{
  const o = mapDropdownItem({ name: 'Same' }, RESP);
  eq('value == label when only label present', o.value, o.label);
}

// ============ defensive — null/garbage inputs don't throw ============
{
  const o = mapDropdownItem(null, RESP);
  eq('null item → empty value', o.value, '');
  const o2 = mapDropdownItem({ id: 1, name: 'A' }, null);
  eq('null resp → empty value (no keys to read)', o2.value, '');
}

// ---------------------------------------------------------------------------
console.log(`\ndropdownMap.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
