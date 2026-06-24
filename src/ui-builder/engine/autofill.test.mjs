'use strict';

// ---------------------------------------------------------------------------
// autofill.test.mjs — strict tests for master-dropdown auto-fill helpers.
// Run: npm run test:autofill
// ---------------------------------------------------------------------------

import { recordSourcePath, dropdownBaseKey, autoSaveKey } from './autofill.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

// ============ recordSourcePath — flat (Django) vs nested (DLMS) ============
{
  const django = { request: {} };           // contract entity → flat record
  const dlms = { id: 'casting_master' };     // no request → DLMS, nested under main.data
  eq('django: flat key', recordSourcePath(django, 'name'), 'name');
  eq('django: id key', recordSourcePath(django, 'id'), 'id');
  eq('dlms: nested under main.data', recordSourcePath(dlms, 'name'), 'main.data.name');
  eq('null entity → dlms shape', recordSourcePath(null, 'grade'), 'main.data.grade');
}

// ============ dropdownBaseKey — strips async __label, falls back ============
{
  eq('strips __label suffix', dropdownBaseKey({ dataKey: 'casting__part__label' }), 'casting__part');
  eq('plain dataKey kept', dropdownBaseKey({ dataKey: 'sec__field' }), 'sec__field');
  eq('only trailing __label stripped', dropdownBaseKey({ dataKey: 'a__label__b' }), 'a__label__b');
  eq('falls back to field_name', dropdownBaseKey({ field_name: 'part' }), 'part');
  eq('falls back to "field"', dropdownBaseKey({}), 'field');
  eq('null field → "field"', dropdownBaseKey(null), 'field');
}

// ============ autoSaveKey — prefix + leaf of the source path ============
{
  // THE prefix guarantee: <baseKey>__<recordLeaf>, following the __ convention.
  eq('django leaf', autoSaveKey('casting__part', 'name'), 'casting__part__name');
  eq('dlms path → leaf only', autoSaveKey('casting__part', 'main.data.grade'), 'casting__part__grade');
  eq('id', autoSaveKey('casting__part', 'id'), 'casting__part__id');
  eq('deeper path → last segment', autoSaveKey('x', 'a.b.c'), 'x__c');
  eq('empty source → empty key', autoSaveKey('casting__part', ''), '');
  eq('missing source → empty key', autoSaveKey('casting__part', undefined), '');
  eq('missing base → "field" prefix', autoSaveKey('', 'name'), 'field__name');
}

// ============ end-to-end: async field key → base → auto key ============
{
  // An async dropdown field stores its value under `${prefix}__${name}__label`,
  // so a saved record field must land under `${prefix}__${name}__<record>`.
  const field = { field_name: 'part', dataKey: 'casting__part__label' };
  const base = dropdownBaseKey(field);
  eq('base from async field', base, 'casting__part');
  eq('auto-save key carries full prefix', autoSaveKey(base, recordSourcePath({ request: {} }, 'name')), 'casting__part__name');
}

// ---------------------------------------------------------------------------
console.log(`\nautofill.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
