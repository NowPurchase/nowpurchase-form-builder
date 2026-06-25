'use strict';

// ---------------------------------------------------------------------------
// fieldKind.test.mjs — strict tests for merged-palette ↔ field_type mapping.
// Run: npm run test:fieldkind
// ---------------------------------------------------------------------------

import {
  dropdownType, dropdownVariant, isDropdownType,
  booleanType, booleanDisplay, isBooleanType,
  dateTypeFor, dateMode, isDateTimeType,
} from './fieldKind.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

// ============ dropdown: the 4 combinations, both directions ============
{
  eq('fixed + single', dropdownType({ source: 'fixed', multiple: false }), 'dropdown_fixed');
  eq('fixed + multiple', dropdownType({ source: 'fixed', multiple: true }), 'tags_fixed');
  eq('external + single', dropdownType({ source: 'external', multiple: false }), 'dropdown_async');
  eq('external + multiple', dropdownType({ source: 'external', multiple: true }), 'tags_async');

  // round-trip every type
  ['dropdown_fixed', 'tags_fixed', 'dropdown_async', 'tags_async'].forEach((t) => {
    const v = dropdownVariant(t);
    eq(`round-trip ${t}`, dropdownType(v), t);
  });
  ok('variant of dropdown_async is external+single', dropdownVariant('dropdown_async').source === 'external' && dropdownVariant('dropdown_async').multiple === false);
  ok('variant of tags_fixed is fixed+multiple', dropdownVariant('tags_fixed').source === 'fixed' && dropdownVariant('tags_fixed').multiple === true);
  ok('isDropdownType true for all 4', ['dropdown_fixed', 'tags_fixed', 'dropdown_async', 'tags_async'].every(isDropdownType));
  ok('isDropdownType false for text', !isDropdownType('text'));
}

// ============ checkbox / toggle ============
{
  eq('display checkbox → checkbox', booleanType('checkbox'), 'checkbox');
  eq('display toggle → toggle', booleanType('toggle'), 'toggle');
  eq('checkbox → display checkbox', booleanDisplay('checkbox'), 'checkbox');
  eq('toggle → display toggle', booleanDisplay('toggle'), 'toggle');
  ok('isBooleanType', isBooleanType('checkbox') && isBooleanType('toggle') && !isBooleanType('date'));
}

// ============ date / time ============
{
  eq('mode date → date type', dateTypeFor('date').field_type, 'date');
  eq('mode date → enable_time false', dateTypeFor('date').enable_time, false);
  eq('mode datetime → date type', dateTypeFor('datetime').field_type, 'date');
  eq('mode datetime → enable_time true', dateTypeFor('datetime').enable_time, true);
  eq('mode time → time type', dateTypeFor('time').field_type, 'time');

  eq('date field → date mode', dateMode({ field_type: 'date', type_config: {} }), 'date');
  eq('date+enable_time → datetime mode', dateMode({ field_type: 'date', type_config: { enable_time: true } }), 'datetime');
  eq('time field → time mode', dateMode({ field_type: 'time', type_config: {} }), 'time');
  ok('isDateTimeType', isDateTimeType('date') && isDateTimeType('time') && !isDateTimeType('number'));
}

// ---------------------------------------------------------------------------
console.log(`\nfieldKind.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
