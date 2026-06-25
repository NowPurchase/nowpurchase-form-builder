'use strict';

// ---------------------------------------------------------------------------
// keyGraph.js — the form's key registry + reference index (pure, testable).
//
// One source of truth for "what keys does this form produce" and "what
// references each key". Powers three features:
//   • rename warnings  — referencesTo(index, [key]) lists what breaks
//   • virtual keys     — referenceableKeys() exposes async value/label and
//                        auto-fill keys in the pickers, not just real fields
//   • value/label pair — async dropdowns get explicit value + label keys
//
// SCALE NOTE: the largest real forms have ~350 keys; building the index is a
// single O(N) walk. Callers should memoise buildReferenceIndex(state) once per
// state change (see Builder.jsx) and use O(1) Map lookups — never re-scan per
// key (that would be O(N²) on a section-cascade rename).
//
// COVERAGE NOTE: structured references (chosen via a dropdown in the UI) are
// tracked exactly. Free-text references (computed formulas, validate_when,
// on_submit code) are best-effort regex (consumer.bestEffort === true). Keys
// inside tables (row-scoped) and raw imported blocks are NOT modelled here, so
// the warning is honest about being limited to builder-managed fields.
// ---------------------------------------------------------------------------

const ASYNC_TYPES = new Set(['dropdown_async', 'tags_async']);
const DISPLAY_TYPES = new Set(['header', 'divider', 'computed']);
const FREE_REF_RE = /form\.data\.([a-zA-Z0-9_]+)/g;

// Strip a leading `form.data.` so a structured ref and a free-text ref to the
// same key normalise to the same bare key.
function normRef(ref) {
  if (ref == null) return '';
  return String(ref).replace(/^form\.data\./, '').trim();
}

function walkFields(state, fn) {
  const walk = (nodes) => (nodes || []).forEach((s) => {
    (s.fields || []).forEach((f) => fn(f, s));
    walk(s.children);
  });
  walk(state && state.sections);
}

function walkSections(state, fn) {
  const walk = (nodes) => (nodes || []).forEach((s) => { fn(s); walk(s.children); });
  walk(state && state.sections);
}

// Every key the form produces: real field keys (incl. an async dropdown's own
// value key = its dataKey) + the dropdown's auto-fill "save with this field"
// keys. NOT deduped (callers dedupe as needed).
export function collectKeys(state) {
  const out = [];
  walkFields(state, (f, s) => {
    if (DISPLAY_TYPES.has(f.field_type)) return;
    const group = s.container_name || s._effPrefix || '';
    const flabel = f.label || f.field_name || f.dataKey || 'field';
    if (ASYNC_TYPES.has(f.field_type)) {
      // The selected id(s) are stored at the field's own dataKey.
      if (f.dataKey) out.push({ key: f.dataKey, kind: 'dropdown', label: flabel, group, ownerFieldId: f.id });
      if (f.field_type === 'dropdown_async') {
        // Single dropdown also saves the chosen option's display text, plus any
        // "save with this field" auto-fill rows as their own derived keys.
        if (f.dataKey) out.push({ key: `${f.dataKey}__label`, kind: 'dropdown_label', label: `${flabel} (label)`, group, ownerFieldId: f.id });
        ((f.type_config || {}).on_select_populate || []).forEach((m) => {
          if (m && m.target_mode === 'auto' && m.target_key) {
            out.push({ key: m.target_key, kind: 'autofill', label: m.target_key, group: `from ${flabel}`, ownerFieldId: f.id });
          }
        });
      } else if (f.field_type === 'tags_async' && f.dataKey) {
        // Multi-select saves an array of { id, label, …recordFields } objects.
        out.push({ key: `${f.dataKey}__items`, kind: 'dropdown_items', label: `${flabel} (items)`, group, ownerFieldId: f.id });
      }
    } else if (f.dataKey) {
      out.push({ key: f.dataKey, kind: 'field', label: flabel, group, ownerFieldId: f.id });
    }
  });
  return out;
}

// Every place a key is referenced. consumer.bestEffort distinguishes exact
// structured refs (false) from regex-scanned free text (true).
export function collectReferences(state) {
  const refs = [];
  const add = (key, consumer) => { const k = normRef(key); if (k) refs.push({ key: k, consumer }); };
  const addFree = (text, consumer) => {
    if (!text) return;
    let m; FREE_REF_RE.lastIndex = 0;
    while ((m = FREE_REF_RE.exec(String(text)))) add(m[1], consumer);
  };

  walkSections(state, (s) => {
    if (s.render_when && s.render_when.field) {
      add(s.render_when.field, { id: s.id, where: 'render_when', label: `Section "${s.label || s.container_name}" show-when`, bestEffort: false });
    }
  });

  walkFields(state, (f) => {
    const flabel = f.label || f.field_name || f.dataKey || 'field';
    if (f.render_when && f.render_when.field) {
      add(f.render_when.field, { id: f.id, where: 'render_when', label: `"${flabel}" show-when`, bestEffort: false });
    }
    if (f.default_value && f.default_value.mode === 'from_field' && f.default_value.source_field) {
      add(f.default_value.source_field, { id: f.id, where: 'default_value', label: `"${flabel}" default value`, bestEffort: false });
    }
    (f.validations || []).forEach((v) => {
      if (v.other_field) add(v.other_field, { id: f.id, where: 'validation', label: `"${flabel}" compare validation`, bestEffort: false });
      if (v.validate_when) addFree(v.validate_when, { id: f.id, where: 'validation', label: `"${flabel}" required-when`, bestEffort: true });
      if (v.code) addFree(v.code, { id: f.id, where: 'validation', label: `"${flabel}" custom validation`, bestEffort: true });
    });
    const cfg = f.type_config || {};
    (cfg.source_fields || []).forEach((sf) => add(sf, { id: f.id, where: 'computed', label: `"${flabel}" computed source`, bestEffort: false }));
    if (cfg.expression) addFree(cfg.expression, { id: f.id, where: 'computed', label: `"${flabel}" formula`, bestEffort: true });
    if (cfg.auto_derive_shift && cfg.shift_target_key) add(cfg.shift_target_key, { id: f.id, where: 'shift_target', label: `"${flabel}" shift target`, bestEffort: false });
    (cfg.filters || []).forEach((flt) => {
      if (flt && flt.source === 'field' && flt.field) add(flt.field, { id: f.id, where: 'cascade', label: `"${flabel}" cascade filter`, bestEffort: false });
    });
    (cfg.on_select_populate || []).forEach((m) => {
      if (m && m.target_mode === 'field' && m.target_key) add(m.target_key, { id: f.id, where: 'autofill_target', label: `"${flabel}" auto-fill target`, bestEffort: false });
    });
  });

  if (state && state.on_submit && state.on_submit.code) {
    addFree(state.on_submit.code, { id: '__form__', where: 'on_submit', label: 'Form submit code', bestEffort: true });
  }

  return refs;
}

// Map<key, consumer[]> — build ONCE per state change, then O(1) lookups.
export function buildReferenceIndex(state) {
  const idx = new Map();
  collectReferences(state).forEach(({ key, consumer }) => {
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(consumer);
  });
  return idx;
}

// Consumers referencing any key in `keys` (deduped). Takes the prebuilt index
// so a whole-subtree query stays O(keys), never O(keys × refs).
export function referencesTo(index, keys) {
  if (!index) return [];
  const out = [];
  const seen = new Set();
  (keys || []).forEach((k) => {
    (index.get(normRef(k)) || []).forEach((c) => {
      const id = `${c.id}|${c.where}|${c.label}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(c);
    });
  });
  return out;
}

// Every dataKey under a section (so a container_name edit can warn about all
// the child keys it cascades to). Includes async value/label + auto-fill keys.
export function subtreeKeys(state, sectionId) {
  const find = (nodes) => {
    for (const n of (nodes || [])) {
      if (n.id === sectionId) return n;
      const f = find(n.children || []);
      if (f) return f;
    }
    return null;
  };
  const node = find(state && state.sections);
  if (!node) return [];
  const keys = [];
  const fromField = (f) => {
    if (DISPLAY_TYPES.has(f.field_type)) return;
    if (f.dataKey) keys.push(f.dataKey);
    if (f.field_type === 'dropdown_async') {
      if (f.dataKey) keys.push(`${f.dataKey}__label`);
      ((f.type_config || {}).on_select_populate || []).forEach((m) => {
        if (m && m.target_mode === 'auto' && m.target_key) keys.push(m.target_key);
      });
    } else if (f.field_type === 'tags_async' && f.dataKey) {
      keys.push(`${f.dataKey}__items`);
    }
  };
  const walk = (n) => { (n.fields || []).forEach(fromField); (n.children || []).forEach(walk); };
  walk(node);
  return Array.from(new Set(keys));
}

// Grouped, deduped options for the field/key pickers: real field keys PLUS
// virtual async value/label and auto-fill keys. Excludes the current field's
// own keys so a rule can't reference itself.
export function referenceableKeys(state, currentFieldId) {
  const seen = new Set();
  return collectKeys(state)
    .filter((k) => k.ownerFieldId !== currentFieldId)
    .filter((k) => { if (seen.has(k.key)) return false; seen.add(k.key); return true; })
    .map((k) => ({ key: k.key, label: k.label, group: k.group, kind: k.kind }));
}
