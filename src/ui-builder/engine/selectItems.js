'use strict';

// ---------------------------------------------------------------------------
// selectItems.js — pure logic for a MULTI-select master dropdown's saved
// "objects" array: one { id, label, ...recordFields } per selected option.
//
// The picker stores the scalar ids at its own key (the widget needs scalars to
// track selection); this builds the companion `…__items` array that the
// RsTagPicker override writes on every change (full rebuild — no accumulation).
// Imported directly by the override (a normal bundled component), so no string
// injection — and unit-tested in selectItems.test.mjs.
// ---------------------------------------------------------------------------

function navigate(record, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, record);
}

// One object for a selected option. `fields` ([{ path, key }]) folds extra
// record fields (from "Also save fields") in alongside id + label.
export function buildSelectedItem(option, fields) {
  const id = option == null ? '' : option.value;
  const sid = id == null ? '' : String(id);
  const obj = {
    id: sid,
    label: (option && option.label != null && option.label !== '') ? option.label : sid,
  };
  (fields || []).forEach(function (fl) {
    if (!fl || !fl.key) return;
    obj[fl.key] = navigate(option ? option.data : undefined, fl.path);
  });
  return obj;
}

// Full rebuild of the saved objects array from the picker's current selection.
//   ids     — array of selected ids (the picker's value)
//   options — loaded options [{ value, label, data }]
//   fields  — [{ path, key }] record fields to fold in
// Ordered to match `ids`. An id with no loaded option still yields {id,label:id}
// so a preselected value is never dropped.
export function rebuildSelectedItems(ids, options, fields) {
  const idArr = Array.isArray(ids) ? ids : (ids != null && ids !== '' ? [ids] : []);
  const byVal = {};
  (Array.isArray(options) ? options : []).forEach(function (o) { if (o && o.value != null) byVal[String(o.value)] = o; });
  return idArr.map(function (id) {
    const opt = byVal[String(id)];
    return buildSelectedItem(opt || { value: id }, fields);
  });
}
