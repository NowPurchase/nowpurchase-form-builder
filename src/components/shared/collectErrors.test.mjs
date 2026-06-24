'use strict';

// ---------------------------------------------------------------------------
// collectErrors.test.mjs — strict tests for flattening FormEngine's validation
// error map (MessagesMap) into a [{ field, message }] list. Run: npm run test:preview
//
// The case that motivated this: the `unique` validator reports its message as a
// string[], which the original flattener silently dropped (hasErrors === true
// but nothing shown). These tests lock that behaviour in.
// ---------------------------------------------------------------------------

import { collectErrors } from './collectErrors.js';
import { applyTool } from '../../ui-builder/assistant/tools.js';
import { initialState } from '../../ui-builder/state/formState.js';
import { exportJSON } from '../../ui-builder/engine/exportJSON.js';

let pass = 0; let fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass += 1; } else { fail += 1; fails.push(name); } }
function eq(name, a, b) { ok(`${name} (got ${JSON.stringify(a)})`, a === b); }
const find = (list, field) => list.find((e) => e.field === field);

// ============ empty / falsy inputs ============
{
  eq('null errors -> empty', collectErrors(null).length, 0);
  eq('undefined errors -> empty', collectErrors(undefined).length, 0);
  eq('empty object -> empty', collectErrors({}).length, 0);
  eq('string input (not a map) -> empty', collectErrors('nope').length, 0);
  eq('null field value skipped', collectErrors({ a: null }).length, 0);
}

// ============ the unique-validator case: string[] messages ============
{
  const r = collectErrors({ heatNo: ['Value must be unique'] });
  eq('string[] field count', r.length, 1);
  eq('string[] field name', r[0].field, 'heatNo');
  eq('string[] message extracted', r[0].message, 'Value must be unique');
}

// ============ multiple messages on one field are joined ============
{
  const r = collectErrors({ qty: ['Required', 'Must be positive'] });
  eq('multi-message count', r.length, 1);
  eq('multi-message joined', r[0].message, 'Required, Must be positive');
}

// ============ bare string fallback ============
{
  const r = collectErrors({ name: 'Required' });
  eq('bare string count', r.length, 1);
  eq('bare string message', r[0].message, 'Required');
}

// ============ multiple fields ============
{
  const r = collectErrors({ a: ['err a'], b: ['err b'], c: [] });
  eq('multi-field count (empty array contributes nothing)', r.length, 2);
  ok('field a present', !!find(r, 'a'));
  ok('field b present', !!find(r, 'b'));
  ok('field c (empty messages) absent', !find(r, 'c'));
}

// ============ nested object map -> dotted path ============
{
  const r = collectErrors({ address: { city: ['Required'] } });
  eq('nested count', r.length, 1);
  eq('nested dotted path', r[0].field, 'address.city');
  eq('nested message', r[0].message, 'Required');
}

// ============ array of nested rows (e.g. table column) -> indexed path ============
{
  const r = collectErrors({
    items: [
      { material: ['Value must be unique'] },
      null,
      { material: ['Value must be unique'] },
    ],
  });
  eq('array-of-rows count', r.length, 2);
  eq('row 0 indexed path', find(r, 'items[0].material').field, 'items[0].material');
  eq('row 2 indexed path', find(r, 'items[2].material').field, 'items[2].material');
  ok('null row skipped (no items[1])', !find(r, 'items[1].material'));
}

// ============ mixed: field messages + nested rows under same key ============
{
  // a string[] message AND object rows can co-exist on one key
  const r = collectErrors({ rows: ['At least one row required', { name: ['Required'] }] });
  ok('mixed: top-level message surfaced', !!find(r, 'rows'));
  eq('mixed: top-level message text', find(r, 'rows').message, 'At least one row required');
  ok('mixed: nested row message surfaced', !!find(r, 'rows[1].name'));
}

// ============ table cross-row `unique`: flat multi-notation map ============
{
  // Exactly what the generated form-level validator emits for ONE duplicate:
  // the same message under four key notations (dotted row, bracket row, the
  // other duplicate row, and the bare table key). The preview must show this as
  // one clean line per offending cell — not four near-identical lines.
  const msg = 'Material must be unique (duplicate at row 2).';
  const r = collectErrors({
    'cm.1.material': msg,
    'cm[1].material': msg,
    'cm.0.material': msg,
    'cm': msg,
  });
  eq('table-unique collapses to one line per cell', r.length, 2);
  ok('dotted/bracket unified to bracket form', !!find(r, 'cm[1].material'));
  ok('other duplicate row present', !!find(r, 'cm[0].material'));
  ok('bare table rollup dropped', !find(r, 'cm'));
  ok('no dotted-index notation leaks through', !r.some((e) => /\.\d+\./.test(e.field)));
  eq('message preserved', find(r, 'cm[1].material').message, msg);
}

// ============ FormEngine replication: table key copied into every row ========
{
  // The EXACT shape getValidationResult() returns at runtime for a unique table:
  // FormEngine binds the table to a Repeater whose key equals the form-validator
  // key, so it copies the whole table-keyed object into each row. The real
  // per-row error is the leaf ("material"); the nested "cm" copies are noise.
  const msg = 'Material must be unique (duplicate at row 2).';
  const raw = {
    cm: [
      { cm: [{ material: msg }, { material: msg }], material: msg },
      { cm: [{ material: msg }, { material: msg }], material: msg },
    ],
  };
  const r = collectErrors(raw);
  eq('replication collapses to one line per row', r.length, 2);
  ok('row 0 leaf kept', !!find(r, 'cm[0].material'));
  ok('row 1 leaf kept', !!find(r, 'cm[1].material'));
  ok('no replicated nested table key leaks', !r.some((e) => /cm\[\d\]\.cm/.test(e.field)));
}

// ============ integration: real generated validator -> collectErrors ============
{
  // Build a table with a unique text column, run the REAL form-level validator
  // exportJSON emits, and confirm its output renders as visible preview errors.
  // This is the end-to-end path that was silently failing.
  let s = { ...initialState, sections: [] };
  s = applyTool(s, 'add_table', {
    container_name: 'cm', label: 'Castings',
    columns: [{ header: 'Material', suffix: 'material', field_type: 'text' }],
  }).state;
  s = applyTool(s, 'update_column', { section: 'cm', column: 'material', unique: true }).state;

  const fv = exportJSON(s).formValidator;
  ok('export produced a form validator', typeof fv === 'string' && fv.length > 0);

  // duplicate values across rows -> validator returns an error map; FormEngine's
  // getValidationResult() merges that map verbatim, which is what we flatten.
  // Only the LATER row is flagged, pointing back at the first occurrence.
  const rawErrors = new Function('formData', fv)({ cm: [{ material: 'X' }, { material: 'X' }] });
  const r = collectErrors(rawErrors);
  eq('exactly one error (the later row)', r.length, 1);
  eq('flagged cell is the later row', r[0].field, 'cm[1].material');
  ok('message points back at row 1', /already used in row 1/.test(r[0].message));

  // triple duplicate -> rows 2 and 3 flagged, first row clean
  const triErrors = new Function('formData', fv)({ cm: [{ material: 'X' }, { material: 'X' }, { material: 'X' }] });
  const tri = collectErrors(triErrors);
  eq('triple -> two errors', tri.length, 2);
  ok('triple -> row 1 not flagged', !find(tri, 'cm[0].material'));
  ok('triple -> rows 2 and 3 both point at row 1', tri.every((e) => /already used in row 1/.test(e.message)));

  // no duplicates -> validator returns {} -> nothing to show (form passes)
  const clean = new Function('formData', fv)({ cm: [{ material: 'X' }, { material: 'Y' }] });
  eq('distinct values -> no preview errors', collectErrors(clean).length, 0);
}

// ---------------------------------------------------------------------------
console.log(`\ncollectErrors.test: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
