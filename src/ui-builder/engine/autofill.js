'use strict';

// ---------------------------------------------------------------------------
// autofill.js — pure helpers for a master dropdown's "auto-fill on select".
//
// On select, extra fields from the chosen record can be kept two ways:
//   • "save with this field" — stored under the dropdown field's OWN prefix
//     (e.g. casting__part__name), in the same form JSON, no extra field.
//   • "copy into" — written to another existing field's dataKey (unchanged).
//
// These functions are pure so the behaviour is unit-tested (autofill.test.mjs)
// independently of the React config UI that calls them.
// ---------------------------------------------------------------------------

// Path to a record field inside the selected item. Contract entities
// (Django/MTC) are flat ({id,name,…}); DLMS records nest under main.data.
export function recordSourcePath(entity, key) {
  return entity && entity.request ? key : `main.data.${key}`;
}

// The dropdown field's base key for auto-save: its own dataKey without the
// async `__label` suffix (falls back to field_name, then 'field').
export function dropdownBaseKey(field) {
  const fromDataKey = field && field.dataKey ? String(field.dataKey).replace(/__label$/, '') : '';
  return fromDataKey || (field && field.field_name) || 'field';
}

// Where a single async dropdown saves the chosen option's display text on
// select: the field's own key + `__label` (the id itself lives at the field's
// key). e.g. dataKey 'casting__part' → label key 'casting__part__label'.
export function dropdownLabelKey(field) {
  const dk = field && field.dataKey ? String(field.dataKey) : '';
  return dk ? `${dk}__label` : '';
}

// Where a multi-select dropdown saves its array of selected { id, label, … }
// objects: the field's own key + `__items` (the scalar id array stays at the
// field's key). e.g. dataKey 'assembly__components' → 'assembly__components__items'.
export function dropdownItemsKey(field) {
  const dk = field && field.dataKey ? String(field.dataKey) : '';
  return dk ? `${dk}__items` : '';
}

// "Save with this field" target key: <baseKey>__<leaf of source path>.
// e.g. ('casting__part', 'name') → 'casting__part__name'
//      ('casting__part', 'main.data.grade') → 'casting__part__grade'
export function autoSaveKey(baseKey, sourcePath) {
  const leaf = String(sourcePath || '').split('.').pop();
  if (!leaf) return '';
  return `${baseKey || 'field'}__${leaf}`;
}
