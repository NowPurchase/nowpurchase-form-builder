'use strict';

// ---------------------------------------------------------------------------
// formState.js — builder state factories + reducer. See PLAN.md "Builder
// State Model". dataKey is auto-derived (and kept in sync) here so the UI
// never makes the user type a dataKey.
// ---------------------------------------------------------------------------

import { deriveDataKey } from '../engine/dataKey.js';

let _uid = 0;
export function uid(prefix = 'id') {
  _uid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_uid}`;
}

// Plain-English palette (what non-tech users see). Order = palette order.
export const FIELD_PALETTE = [
  { type: 'text', label: 'Text', icon: '📝' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'date', label: 'Date / Time', icon: '📅' },
  { type: 'time', label: 'Date / Time', icon: '🕐' },
  { type: 'shift', label: 'Shift', icon: '🔄' },
  // The four dropdown variants share one "Dropdown" palette entry; the
  // Property panel toggles source (Fixed/External) and single/multiple.
  { type: 'dropdown_fixed', label: 'Dropdown', icon: '▼' },
  { type: 'dropdown_async', label: 'Dropdown', icon: '▼' },
  { type: 'tags_fixed', label: 'Dropdown', icon: '▼' },
  { type: 'tags_async', label: 'Dropdown', icon: '▼' },
  { type: 'checkbox', label: 'Checkbox / Toggle', icon: '☑' },
  { type: 'toggle', label: 'Checkbox / Toggle', icon: '🔘' },
  { type: 'textarea', label: 'Text Area', icon: '📄' },
  { type: 'upload', label: 'File / Image Upload', icon: '📎' },
  { type: 'header', label: 'Section Title', icon: '📋' },
  { type: 'divider', label: 'Divider', icon: '—' },
  { type: 'supervisor', label: 'Supervisor', icon: '👤' },
  { type: 'spectrometer', label: 'Spectrometer Reading', icon: '🔬' },
  { type: 'chips', label: 'Free tags', icon: '🏷' },
];

function defaultTypeConfig(fieldType) {
  switch (fieldType) {
    case 'date': return { auto_fill_today: false, format: 'dd-MM-yyyy', enable_time: false };
    case 'time': return { auto_derive_shift: false, shift_target_key: 'shift' };
    case 'dropdown_fixed':
    case 'tags_fixed': return { options: [], clearable: true };
    case 'dropdown_async':
    case 'tags_async': return { entity_id: '', search_fields: '', filters: [], on_select_populate: [] };
    case 'number': return { allow_negative: false, decimal_scale: 0, prefix: '', suffix: '' };
    case 'textarea': return { rows: 2 };
    case 'supervisor': return { api_field: 'name' };
    case 'upload': return { multiple: true };
    case 'spectrometer': return { url: '', elements: '', columns_per_row: 4, show_connection_status: true };
    case 'chips': return { allow_duplicates: false, max_chips: 0 };
    case 'computed': return { op: 'sum', source_table: '', source_column: '', source_fields: [], expression: '' };
    default: return {};
  }
}

export function createSection() {
  return {
    id: uid('sec'),
    container_name: '',
    label: null,
    show_header: true,
    fields_per_row: 1,
    fields: [],
    children: [],          // nested sub-containers (chained prefix)
    type: 'standard',
    table_config: null,
    render_when: null,
    custom_css: '',        // advanced: raw CSS layered onto this container
  };
}

// Builder only authors standard tables. Dimensional (`specs__`, is_range
// toggle, s1–s5 samples) forms are hand-authored / imported as raw blocks.
export function createColumn(n = 1) {
  return {
    key: uid('col'),
    header: `Column ${n}`,
    width_percent: 50,
    field_type: 'input', // see COLUMN_TYPES (text/number/date/dropdown/checkbox/…)
    dataKey_suffix: `col${n}`,
    required: false,
    unique: false, // value must be unique across all rows in this column
    placeholder: '',
    type_config: {},
  };
}

export function createTableConfig() {
  return {
    table_type: 'standard',
    row_mode: 'dynamic',      // 'dynamic' (add/remove rows) | 'fixed' (static N rows)
    fixed_rows: 3,            // used when row_mode === 'fixed'
    max_rows: 20,             // used when row_mode === 'dynamic'
    initial_rows: 1,
    min_rows: 1,              // can't delete below this many rows (dynamic)
    add_row_label: '+ Add Row',
    row_count_key: 'table_row_count',
    data_prefix: 'table',
    deleted_prefix: 'deleted_table_',
    columns: [createColumn(1), createColumn(2)],
  };
}

export function createField(fieldType, section) {
  const isSupervisor = fieldType === 'supervisor';
  const isComputed = fieldType === 'computed';
  const field = {
    id: uid('fld'),
    field_name: isSupervisor ? 'supervisor' : '',
    label: fieldType === 'divider' ? null : (isSupervisor ? 'Supervisor' : ''),
    show_label: fieldType !== 'divider',
    field_type: fieldType,
    dataKey: '',
    required: false,
    disabled: isSupervisor,
    read_only: isSupervisor || isComputed,
    width_override: null,
    placeholder: null,
    render_when: null,
    validations: [],
    default_value: null, // { mode, value, source_field } — auto-fill on load
    special_prefix: isSupervisor ? 'disabled__' : null,
    custom_css: '',        // advanced: raw CSS layered onto this field
    type_config: defaultTypeConfig(fieldType),
  };
  field.dataKey = section ? deriveDataKey(section, field) : '';
  return field;
}

// ---- container tree helpers ----------------------------------------------
// Containers nest. A field's prefix is the chain of its ancestor container
// names joined by `__` (e.g. moulding__engine__rpm). resyncTree recomputes
// every dataKey top-down whenever the tree changes. Imported (_raw) and
// manually-overridden fields are never touched.

// Display-only field types carry no dataKey (no data binding).
const DISPLAY_TYPES = new Set(['header', 'divider', 'computed']);

function syncFieldKeyWithPrefix(prefix, field) {
  if (field._raw || field._dataKeyOverridden) return field;
  if (DISPLAY_TYPES.has(field.field_type)) {
    return field.dataKey ? { ...field, dataKey: '' } : field;
  }
  return { ...field, dataKey: deriveDataKey({ container_name: prefix }, field) };
}

function resyncTree(nodes, parentPrefix = '') {
  return (nodes || []).map((n) => {
    const eff = parentPrefix ? `${parentPrefix}__${n.container_name}` : n.container_name;
    return {
      ...n,
      _effPrefix: eff,
      fields: (n.fields || []).map((f) => syncFieldKeyWithPrefix(eff, f)),
      children: resyncTree(n.children || [], eff),
    };
  });
}

// Pull a field (by id) out of wherever it lives in the tree; returns the new
// tree (without that field) and the extracted field object (or null).
function extractField(nodes, fieldId) {
  let found = null;
  const walk = (arr) => (arr || []).map((n) => ({
    ...n,
    fields: (n.fields || []).filter((f) => {
      if (f.id === fieldId) { found = f; return false; }
      return true;
    }),
    children: walk(n.children || []),
  }));
  const tree = walk(nodes);
  return { tree, field: found };
}

// Apply fn to the node with matching id, anywhere in the tree.
function mapNode(nodes, id, fn) {
  return (nodes || []).map((n) => (n.id === id ? fn(n) : { ...n, children: mapNode(n.children || [], id, fn) }));
}
function removeNode(nodes, id) {
  return (nodes || []).filter((n) => n.id !== id).map((n) => ({ ...n, children: removeNode(n.children || [], id) }));
}
function moveNode(nodes, id, dir) {
  const idx = (nodes || []).findIndex((n) => n.id === id);
  if (idx >= 0) {
    const to = idx + dir;
    if (to < 0 || to >= nodes.length) return nodes;
    const c = [...nodes];
    [c[idx], c[to]] = [c[to], c[idx]];
    return c;
  }
  return (nodes || []).map((n) => ({ ...n, children: moveNode(n.children || [], id, dir) }));
}
export function findNode(nodes, id) {
  for (const n of (nodes || [])) {
    if (n.id === id) return n;
    const f = findNode(n.children || [], id);
    if (f) return f;
  }
  return null;
}
// Names of a node's siblings (same parent array), excluding itself.
export function siblingNames(nodes, id) {
  if ((nodes || []).some((n) => n.id === id)) {
    return nodes.filter((n) => n.id !== id).map((n) => n.container_name).filter(Boolean);
  }
  for (const n of (nodes || [])) {
    const r = siblingNames(n.children || [], id);
    if (r) return r;
  }
  return null;
}

export const initialState = {
  name: '',
  template_id: '',
  defaultLanguage: 'en-US',
  theme: 'metalcloud',
  sections: [],
  actions: {},
  on_submit: null, // advanced: { code } — raw JS run on form submit
};

// Run a tree transform, then resync all dataKeys top-down.
function withResync(state, sections) {
  return { ...state, sections: resyncTree(sections) };
}

// ---- stable numbered defaults (a key is an identity, never derived from a
// label). New sections/fields get `${base}_N` + a matching "Base N" label so a
// user can start immediately; both stay editable. Editing a LABEL never changes
// the KEY — only an explicit key edit does — so saved forms never break.
function numberedDefault(taken, base, labelBase) {
  const set = new Set(taken);
  let i = 1;
  while (set.has(`${base}_${i}`)) i += 1;
  return { key: `${base}_${i}`, label: `${labelBase} ${i}` };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...action.state };

    case 'SET_META':
      return { ...state, ...action.patch };

    case 'ADD_SECTION': {
      const taken = state.sections.map((s) => s.container_name).filter(Boolean);
      const d = numberedDefault(taken, 'section', 'Section');
      return withResync(state, [...state.sections, { ...createSection(), container_name: d.key, label: d.label }]);
    }

    case 'ADD_SUBCONTAINER':
      return withResync(state, mapNode(state.sections, action.parentId, (s) => {
        const taken = (s.children || []).map((c) => c.container_name).filter(Boolean);
        const d = numberedDefault(taken, 'group', 'Group');
        return { ...s, children: [...(s.children || []), { ...createSection(), container_name: d.key, label: d.label }] };
      }));

    case 'REMOVE_SECTION':
      return withResync(state, removeNode(state.sections, action.sectionId));

    case 'MOVE_SECTION':
      return withResync(state, moveNode(state.sections, action.sectionId, action.dir));

    case 'UPDATE_SECTION':
      // Plain apply — a label edit never touches container_name. The key only
      // changes when the user edits container_name directly.
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({ ...s, ...action.patch })));

    case 'SET_SECTION_TYPE':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({
        ...s,
        type: action.tableType ? 'table' : 'standard',
        table_config: action.tableType ? (s.table_config || null) : null,
      })));

    case 'SET_TABLE_CONFIG':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({ ...s, type: 'table', table_config: action.config })));

    case 'ADD_FIELD':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => {
        const f = createField(action.fieldType, { container_name: s._effPrefix || s.container_name });
        // Data fields get a stable numbered key + label. Display-only types
        // (header/divider/computed) and the supervisor field keep their own
        // conventions from createField().
        if (!DISPLAY_TYPES.has(action.fieldType) && action.fieldType !== 'supervisor') {
          const taken = (s.fields || []).map((x) => x.field_name).filter(Boolean);
          const d = numberedDefault(taken, 'input', 'Input');
          f.field_name = d.key;
          f.label = d.label;
        }
        return { ...s, fields: [...s.fields, f] };
      }));

    case 'REMOVE_FIELD':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({
        ...s,
        fields: s.fields.filter((f) => f.id !== action.fieldId),
      })));

    case 'MOVE_FIELD':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => {
        const idx = s.fields.findIndex((f) => f.id === action.fieldId);
        const to = idx + action.dir;
        if (idx < 0 || to < 0 || to >= s.fields.length) return s;
        const fields = [...s.fields];
        [fields[idx], fields[to]] = [fields[to], fields[idx]];
        return { ...s, fields };
      }));

    case 'UPDATE_FIELD':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({
        ...s,
        fields: s.fields.map((f) => {
          if (f.id !== action.fieldId) return f;
          // A label edit never changes the key. The key (field_name → dataKey)
          // only moves when the user edits field_name/dataKey directly.
          const next = { ...f, ...action.patch };
          if (action.patch.dataKey !== undefined) next._dataKeyOverridden = true;
          return next;
        }),
      })));

    case 'RELOCATE_FIELD': {
      // move a field to another container (its dataKey re-derives under the
      // new prefix via resync). index null/-1 → append.
      const { tree, field } = extractField(state.sections, action.fieldId);
      if (!field) return state;
      const sections = mapNode(tree, action.toSectionId, (s) => {
        const fields = [...(s.fields || [])];
        const at = (action.index == null || action.index < 0) ? fields.length : Math.min(action.index, fields.length);
        fields.splice(at, 0, field);
        return { ...s, fields };
      });
      return withResync(state, sections);
    }

    case 'UPDATE_FIELD_CONFIG':
      return withResync(state, mapNode(state.sections, action.sectionId, (s) => ({
        ...s,
        fields: s.fields.map((f) =>
          (f.id === action.fieldId ? { ...f, type_config: { ...f.type_config, ...action.patch } } : f)),
      })));

    default:
      return state;
  }
}
