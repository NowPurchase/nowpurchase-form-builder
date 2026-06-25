'use strict';

// ---------------------------------------------------------------------------
// fieldKind.js — pure mapping between a merged palette entry's UI options and
// the underlying internal field_type. Lets the palette show ONE "Dropdown" /
// "Checkbox / Toggle" / "Date / Time" entry while the engine keeps its proven
// distinct types. Unit-tested in fieldKind.test.mjs.
//
// Every merge target derives the SAME base dataKey, so toggling a field between
// these types never changes its key (verified by dataKey.js rule 6).
// ---------------------------------------------------------------------------

// ---- Dropdown: { source: 'fixed' | 'external', multiple } <-> field_type ----
export function dropdownType({ source, multiple }) {
  const ext = source === 'external';
  if (multiple) return ext ? 'tags_async' : 'tags_fixed';
  return ext ? 'dropdown_async' : 'dropdown_fixed';
}

export function dropdownVariant(fieldType) {
  return {
    source: (fieldType === 'dropdown_async' || fieldType === 'tags_async') ? 'external' : 'fixed',
    multiple: (fieldType === 'tags_fixed' || fieldType === 'tags_async'),
  };
}

export const DROPDOWN_TYPES = ['dropdown_fixed', 'tags_fixed', 'dropdown_async', 'tags_async'];
export function isDropdownType(t) { return DROPDOWN_TYPES.indexOf(t) !== -1; }

// ---- Checkbox / Toggle: display 'checkbox' | 'toggle' <-> field_type ----
export function booleanType(display) {
  return display === 'toggle' ? 'toggle' : 'checkbox';
}
export function booleanDisplay(fieldType) {
  return fieldType === 'toggle' ? 'toggle' : 'checkbox';
}
export function isBooleanType(t) { return t === 'checkbox' || t === 'toggle'; }

// ---- Date / Time: mode 'date' | 'datetime' | 'time' <-> { field_type, enable_time } ----
// Date and Date+Time are both the `date` type (enable_time differs); Time is `time`.
export function dateTypeFor(mode) {
  if (mode === 'time') return { field_type: 'time', enable_time: false };
  if (mode === 'datetime') return { field_type: 'date', enable_time: true };
  return { field_type: 'date', enable_time: false };
}
export function dateMode(field) {
  if (!field) return 'date';
  if (field.field_type === 'time') return 'time';
  return (field.type_config && field.type_config.enable_time) ? 'datetime' : 'date';
}
export function isDateTimeType(t) { return t === 'date' || t === 'time'; }
