'use strict';

// ---------------------------------------------------------------------------
// dropdownMap.js — the canonical rule for turning a raw master-data API record
// into a picker option { value, label, data }.
//
// The runtime copy lives inside the `fetch_dropdown` action body in
// state/actions.js (it's injected as a code string into the exported form, so
// it can't import this module). This pure mirror is the SOURCE OF TRUTH and is
// unit-tested in dropdownMap.test.mjs — keep the two in sync.
//
// Rule (kept deliberately simple):
//   • value (what we save on select) = the contract's id, item[valueKey].
//   • Safety net: if a row omits the id, fall back to the displayed value
//     (item[labelKey]) so a selection never saves an empty value.
//   • value is string-coerced — the picker stores string values, so a numeric
//     id (7) must match its option ("7"), else the selected label won't show.
//   • label = item[labelKey] when present, else the (stringified) value.
// ---------------------------------------------------------------------------

export function mapDropdownItem(item, resp) {
  const r = resp || {};
  let val = item == null ? undefined : item[r.valueKey];
  if (val == null || val === '') val = item == null ? undefined : item[r.labelKey];
  const labelRaw = item == null ? undefined : item[r.labelKey];
  const label = (labelRaw != null && labelRaw !== '') ? labelRaw : String(val == null ? '' : val);
  return { value: val == null ? '' : String(val), label, data: item };
}
