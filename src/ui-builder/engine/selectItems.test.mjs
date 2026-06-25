'use strict';

// ---------------------------------------------------------------------------
// selectItems.test.mjs — strict tests for multi-select saved objects array.
// Run: npm run test:selectitems
// ---------------------------------------------------------------------------

import { buildSelectedItem, rebuildSelectedItems } from './selectItems.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }

const FOLD = [{ path: 'grade', key: 'grade' }, { path: 'serial_no', key: 'serial_no' }];
const OPTS = [
  { value: 7, label: 'Steel A', data: { id: 7, name: 'Steel A', grade: 'EN8', serial_no: 'S-100' } },
  { value: 9, label: 'Iron B', data: { id: 9, name: 'Iron B', grade: 'FG260', serial_no: 'S-205' } },
];

// ============ buildSelectedItem — id + label + folded record fields ============
{
  const o = buildSelectedItem(OPTS[0], FOLD);
  eq('id string-coerced', o.id, '7');
  eq('label from option', o.label, 'Steel A');
  eq('folded grade', o.grade, 'EN8');
  eq('folded serial_no', o.serial_no, 'S-100');
  ok('object has exactly id,label,grade,serial_no', JSON.stringify(Object.keys(o).sort()) === JSON.stringify(['grade', 'id', 'label', 'serial_no']));
}

// ============ buildSelectedItem — fallbacks ============
{
  const noLabel = buildSelectedItem({ value: 3 }, []);
  eq('label falls back to id when missing', noLabel.label, '3');
  const noData = buildSelectedItem({ value: 5, label: 'X' }, FOLD);
  eq('missing record → folded field undefined', noData.grade, undefined);
  const nested = buildSelectedItem({ value: 1, label: 'Y', data: { main: { data: { grade: 'G' } } } }, [{ path: 'main.data.grade', key: 'grade' }]);
  eq('folds via dotted path', nested.grade, 'G');
}

// ============ rebuildSelectedItems — order, fold, prune, clear ============
{
  const both = rebuildSelectedItems(['7', '9'], OPTS, FOLD);
  eq('two selected → two objects', both.length, 2);
  eq('order matches ids[0]', both[0].id, '7');
  eq('order matches ids[1]', both[1].id, '9');
  eq('object carries folded field', both[1].grade, 'FG260');

  // reselect in different order → array reorders to match
  const reordered = rebuildSelectedItems(['9', '7'], OPTS, FOLD);
  eq('reorder follows ids', reordered[0].id, '9');

  // deselect one → only the remaining object (full rebuild prunes)
  const pruned = rebuildSelectedItems(['7'], OPTS, FOLD);
  eq('deselect prunes', pruned.length, 1);
  eq('remaining is the kept one', pruned[0].id, '7');

  // clear all → empty
  eq('clear → empty array', rebuildSelectedItems([], OPTS, FOLD).length, 0);
}

// ============ rebuildSelectedItems — id types, unknown ids, scalars ============
{
  const numericIds = rebuildSelectedItems([7, 9], OPTS, FOLD);
  eq('numeric ids matched to options', numericIds[0].label, 'Steel A');

  const unknown = rebuildSelectedItems(['7', '404'], OPTS, FOLD);
  eq('unknown id still yields an object', unknown.length, 2);
  eq('unknown id → label falls back to id', unknown[1].label, '404');
  eq('unknown id → no folded field', unknown[1].grade, undefined);

  eq('non-array scalar id wrapped', rebuildSelectedItems('7', OPTS, FOLD).length, 1);
  eq('null ids → empty', rebuildSelectedItems(null, OPTS, FOLD).length, 0);
}

// ============ no fold fields → just id + label ============
{
  const o = rebuildSelectedItems(['7'], OPTS, [])[0];
  ok('only id + label when nothing folded', JSON.stringify(Object.keys(o).sort()) === JSON.stringify(['id', 'label']));
}

// ---------------------------------------------------------------------------
console.log(`\nselectItems.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
