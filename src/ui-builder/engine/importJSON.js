'use strict';

// ---------------------------------------------------------------------------
// importJSON.js — best-effort parse of existing FormEngine JSON into builder
// state. See PLAN.md "Import Logic".
//
// Strategy: every top-level RsContainer becomes a Section. Within it we
// recursively collect leaf field nodes. Each field is *modelled* (field_type,
// dataKey, label, required, width) so the builder UI can display/edit it, and
// also retains its original node under `_raw` so export reproduces the exact
// dataKeys/props/events ("complex features load as read-only raw blocks").
// Nothing here throws on unknown shapes — unknown nodes are kept verbatim.
// ---------------------------------------------------------------------------

let _idCounter = 0;
function generateId() {
  _idCounter += 1;
  return `imp_${_idCounter}`;
}

// FormEngine type-id → builder field_type (reverse of FIELD_TYPE_MAP).
const REVERSE_TYPE = {
  RsInput: 'text',
  RsNumberFormat: 'number',
  RsDatePicker: 'date',
  RsTimePicker: 'time',
  RsCheckbox: 'checkbox',
  RsTextArea: 'textarea',
  RsHeader: 'header',
  RsDivider: 'divider',
  RsDropdown: 'dropdown_fixed',
  RsTagPicker: 'tags_fixed',
  RsSpectrometerReading: 'spectrometer',
  RsChipInput: 'chips',
};

const FIELD_TYPES = new Set(Object.keys(REVERSE_TYPE));

function propValue(props, name) {
  const p = props && props[name];
  if (p == null) return undefined;
  if (typeof p === 'object' && 'value' in p) return p.value;
  return p;
}

function hasRequired(node) {
  const vals = node.schema && node.schema.validations;
  return Array.isArray(vals) && vals.some((x) => x && x.key === 'required');
}

function widthFromWrapper(node) {
  const w = node.wrapperCss && node.wrapperCss.any && node.wrapperCss.any.object && node.wrapperCss.any.object.width;
  return w || null;
}

function detectSpecialPrefix(dataKey) {
  if (!dataKey) return null;
  if (dataKey.startsWith('disabled__')) return 'disabled__';
  if (dataKey.startsWith('meta__')) return 'meta__';
  if (dataKey.startsWith('derived__')) return 'derived__';
  return null;
}

// Turn a single FormEngine leaf node into a builder Field (keeps `_raw`).
function nodeToField(node) {
  const fieldType = REVERSE_TYPE[node.type] || 'text';
  const label = propValue(node.props, 'label')
    ?? propValue(node.props, 'content')
    ?? null;

  return {
    id: node.key || generateId(),
    field_name: '',
    label: label === '' ? null : label,
    show_label: !!label,
    field_type: fieldType,
    dataKey: node.dataKey || null,
    required: hasRequired(node),
    disabled: !!propValue(node.props, 'disabled'),
    read_only: !!propValue(node.props, 'readOnly'),
    width_override: widthFromWrapper(node),
    placeholder: propValue(node.props, 'placeholder') || null,
    render_when: null,
    validations: [],
    special_prefix: detectSpecialPrefix(node.dataKey),
    type_config: {},
    _raw: node, // verbatim node — export emits this for round-trip fidelity
  };
}

// Recursively collect leaf field nodes from a container subtree.
function collectFields(node, out, skipKeys) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => collectFields(n, out, skipKeys)); return; }

  if (node.type === 'RsContainer' || node.type === 'Screen') {
    collectFields(node.children, out, skipKeys);
    return;
  }

  // Any non-container node we recognise (or that carries a dataKey) is a field.
  if (FIELD_TYPES.has(node.type) || node.dataKey) {
    if (skipKeys && skipKeys.has(node)) return;
    out.push(nodeToField(node));
  }
}

function firstHeaderLabel(container) {
  const kids = container.children || [];
  for (const k of kids) {
    if (k && k.type === 'RsHeader') {
      const c = propValue(k.props, 'content');
      if (c) return { label: c, node: k };
    }
  }
  return null;
}

function looksLikeTable(container) {
  let indexed = false;
  function scan(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(scan); return; }
    if (typeof n.dataKey === 'string' && /__\d+__/.test(n.dataKey)) indexed = true;
    if (n.children) scan(n.children);
  }
  scan(container.children);
  return indexed || /(_table|_grid)$/.test(container.key || '');
}

function containerToSection(container) {
  const header = firstHeaderLabel(container);
  const skip = new Set();
  if (header) skip.add(header.node); // don't list the section header as a field

  const fields = [];
  collectFields(container.children, fields, skip);

  return {
    id: generateId(),
    container_name: container.key || generateId(),
    label: header ? header.label : null,
    show_header: !!header,
    fields_per_row: 1, // imported fields emitted flat; their _raw carries layout
    fields,
    type: looksLikeTable(container) ? 'table_imported' : 'standard',
    table_config: null,
    render_when: null,
    // preserve an existing whole-section condition verbatim for round-trip
    _rawRenderWhen: (container.renderWhen && container.renderWhen.value) || null,
  };
}

function detectTheme(form) {
  // Elevated cards carry a box-shadow string; otherwise treat as clean.
  const kids = (form && form.children) || [];
  for (const k of kids) {
    const s = k && k.css && k.css.any && k.css.any.string;
    if (typeof s === 'string' && /box-shadow/.test(s)) return 'elevated';
  }
  return 'clean';
}

function importJSON(json) {
  const form = (json && json.form) || {};
  const sections = [];

  (form.children || []).forEach((child) => {
    if (!child || child.type !== 'RsContainer') {
      // Non-container top-level node (rare) — wrap it verbatim as its own block.
      if (child) {
        sections.push({
          id: generateId(),
          container_name: child.key || generateId(),
          label: null,
          show_header: false,
          fields_per_row: 1,
          fields: [],
          type: 'standard',
          table_config: null,
          _rawNode: child,
        });
      }
      return;
    }
    sections.push(containerToSection(child));
  });

  return {
    name: '',
    template_id: '',
    defaultLanguage: (json && json.defaultLanguage) || 'en-US',
    theme: detectTheme(form),
    sections,
    // Preserve the form's existing behaviors (addRow/total/auto-fill actions)
    // so editing an imported form and re-exporting doesn't drop them.
    actions: (json && json.actions) || {},
    // Original top-level form metadata + the Screen node's own props/css/events,
    // re-emitted verbatim on export for round-trip fidelity.
    _imported: {
      version: json && json.version,
      errorType: json && json.errorType,
      formValidator: json && json.formValidator,
      localization: json && json.localization,
      languages: json && json.languages,
      defaultLanguage: json && json.defaultLanguage,
      screen: { props: form.props, css: form.css, events: form.events },
    },
  };
}

export { importJSON, nodeToField, containerToSection };
