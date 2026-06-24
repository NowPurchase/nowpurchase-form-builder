'use strict';

// ---------------------------------------------------------------------------
// exportJSON.js — builds valid FormEngine (@react-form-builder v7.9.0) JSON
// from builder state. See PLAN.md "Export Logic".
//
// IMPORTANT contract details (derived from real DLMS forms, not the PLAN
// pseudocode):
//   - Every prop value is wrapped: props.label = { value: "..." } (or a
//     { computeType:"function", fnSource } object for computed props).
//   - Validations live under schema.validations = [{ key, validateWhen, args }].
//   - Events are { onChange: [{ name, type:"code", args }], ... }.
//   - dataKey is a node-level field; CSS lives in css / wrapperCss.
// ---------------------------------------------------------------------------

import { collectUsedActions } from '../state/actions.js';
import { THEMES } from '../state/themes.js';
import { TOKENS, hairline } from '../state/tokens.js';

// Maps builder field types → FormEngine component type-ids.
const FIELD_TYPE_MAP = {
  text: 'RsInput',
  number: 'RsNumberFormat',
  date: 'RsDatePicker',
  time: 'RsTimePicker',
  shift: 'RsDropdown',
  dropdown_fixed: 'RsDropdown',
  dropdown_async: 'RsDropdown',
  tags_fixed: 'RsTagPicker',
  tags_async: 'RsTagPicker',
  checkbox: 'RsCheckbox',
  toggle: 'RsToggle',
  textarea: 'RsTextArea',
  header: 'RsHeader',
  divider: 'RsDivider',
  supervisor: 'RsInput',
  upload: 'RsCameraCapture',
  spectrometer: 'RsSpectrometerReading', // np-dlms custom device-reading field
  chips: 'RsChipInput',    // np-dlms free-entry chip/tag input
  computed: 'RsInput', // read-only display of a computed value
};

// Build the fnSource for a computed field (a derived/total display).
function computedFnSource(cfg) {
  const ex = cfg && cfg.expression ? String(cfg.expression).trim() : '';
  if (ex) return /\breturn\b/.test(ex) ? ex : `return (${ex});`;
  // Aggregate a list of FORM fields (by dataKey) — the "calculated field"
  // across the form (sum/avg/min/max/count of picked fields).
  if (Array.isArray(cfg && cfg.source_fields) && cfg.source_fields.length) {
    const arr = `[${cfg.source_fields.map((k) => JSON.stringify(k)).join(',')}]`;
    const nums = `${arr}.map(function(k){return Number(form.data[k])||0;})`;
    switch (cfg.op || 'sum') {
      case 'count': return `return ${arr}.length;`;
      case 'avg': return `var a=${nums};return a.length?(a.reduce(function(x,y){return x+y;},0)/a.length):0;`;
      case 'min': return `var a=${nums};return a.length?Math.min.apply(null,a):0;`;
      case 'max': return `var a=${nums};return a.length?Math.max.apply(null,a):0;`;
      default: return `return ${nums}.reduce(function(x,y){return x+y;},0);`;
    }
  }
  const t = cfg && cfg.source_table;
  if (!t) return 'return "";';
  const c = cfg.source_column;
  const arr = `(form.data[${JSON.stringify(t)}] || [])`;
  const nums = `${arr}.map(function(r){return Number(r[${JSON.stringify(c)}])||0;})`;
  switch (cfg.op || 'sum') {
    case 'count': return `return ${arr}.length;`;
    case 'avg': return `var a=${nums};return a.length?(a.reduce(function(x,y){return x+y;},0)/a.length):0;`;
    case 'min': return `var a=${nums};return a.length?Math.min.apply(null,a):0;`;
    case 'max': return `var a=${nums};return a.length?Math.max.apply(null,a):0;`;
    default: return `return ${nums}.reduce(function(x,y){return x+y;},0);`;
  }
}

// Upload endpoint resolver (computed prop). Placeholder URL per PLAN.
const UPLOAD_URL_FN = "\nlet savedToken = localStorage.getItem('dlms_auth_token');\nreturn \"https://dlms-api.iotnp.com/api/v1/upload/image?token=\" + savedToken;\n";
// makes the uploader trigger button full-width (descendant rule, all themes)
const UPLOAD_TRIGGER_CSS = '.rs-uploader-trigger-btn{width:100% !important;height:auto;display:flex !important;align-items:center !important;justify-content:center !important;}';

const WIDTH_MAP = { 1: '100%', 2: '50%', 3: '33%' };

const v = (value) => ({ value }); // prop value wrapper

// The theme being exported. Set at the start of exportJSON so deep builders
// (buildField, buttons) can pull per-component CSS without threading it.
let ACTIVE_THEME = null;
function compCss(type) {
  const map = ACTIVE_THEME && ACTIVE_THEME.componentCss;
  return map && map[type] ? map[type] : null;
}
function removeBtnCss() {
  return (ACTIVE_THEME && ACTIVE_THEME.removeBtnCss) || compCss('RsButton');
}

function getFieldWidth(fieldsPerRow) {
  return WIDTH_MAP[fieldsPerRow] || '100%';
}

// --- props ----------------------------------------------------------------

function buildFieldProps(field) {
  const cfg = field.type_config || {};
  const props = {};

  // Label (most components). Header/divider/checkbox handled specially below.
  // ALWAYS emit an explicit label — omitting it lets rsuite fall back to its
  // component default ("Input"), which then shows up in table cells. Use an
  // empty string to render no label (table cells); empty labels are collapsed
  // by a global :empty rule so they add no gap.
  const hasLabelText = field.label != null && String(field.label).trim() !== '';
  if (field.field_type !== 'header' && field.field_type !== 'divider' && field.field_type !== 'checkbox') {
    props.label = v((field.show_label === false && !hasLabelText) ? '' : (field.label || ''));
  }
  if (field.placeholder) props.placeholder = v(field.placeholder);
  if (field.disabled || field.special_prefix === 'disabled__' || field.field_type === 'supervisor' || field.field_type === 'shift') {
    props.disabled = v(true);
  }
  if (field.read_only || field.field_type === 'supervisor') props.readOnly = v(true);

  switch (field.field_type) {
    case 'text':
      props.type = v('text');
      break;

    case 'number':
      if (cfg.allow_negative != null) props.allowNegative = v(!!cfg.allow_negative);
      else props.allowNegative = v(false);
      if (cfg.decimal_scale != null) props.decimalScale = v(cfg.decimal_scale);
      if (cfg.prefix) props.prefix = v(cfg.prefix);
      if (cfg.suffix) props.suffix = v(cfg.suffix);
      break;

    case 'date':
      if (cfg.format) props.format = v(cfg.format);
      break;

    case 'shift':
      props.data = v([
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
      ]);
      break;

    case 'dropdown_fixed':
      props.data = v(cfg.options || []);
      if (cfg.clearable != null) props.cleanable = v(!!cfg.clearable);
      if (cfg.placement) props.placement = v(cfg.placement);
      break;

    case 'dropdown_async':
      props.data = v([]);
      props.disableVirtualized = v(true);
      break;

    case 'tags_fixed':
      props.data = v(cfg.options || []);
      props.creatable = v(false);
      break;

    case 'tags_async':
      props.data = v([]);
      props.creatable = v(false);
      break;

    case 'checkbox':
      props.checked = v(false);
      props.children = v(field.label || '');
      break;

    case 'toggle':
      props.checked = v(false);
      break;

    case 'textarea':
      props.rows = v(cfg.rows || 2);
      break;

    case 'header':
      props.content = v(field.label || '');
      props.headerSize = v(cfg.header_size || 'h6');
      break;

    case 'computed':
      props.value = { computeType: 'function', fnSource: computedFnSource(cfg) };
      props.readOnly = v(true);
      break;

    case 'upload':
      props.label = v(field.label || 'Attachment:');
      props.accept = { computeType: 'function', fnSource: UPLOAD_URL_FN };
      props.action = { computeType: 'function', fnSource: UPLOAD_URL_FN };
      props.removable = v(true);
      props.name = v('file');
      props.method = v('POST');
      props.multiple = v(cfg.multiple !== false);
      break;

    case 'spectrometer':
      if (cfg.url) props.url = v(cfg.url);
      if (cfg.elements) props.elements = v(cfg.elements);
      props.columnsPerRow = v(cfg.columns_per_row || 4);
      props.showConnectionStatus = v(cfg.show_connection_status !== false);
      break;

    case 'chips':
      props.allowDuplicates = v(!!cfg.allow_duplicates);
      props.maxChips = v(cfg.max_chips || 0); // 0 = unlimited
      if (cfg.size) props.size = v(cfg.size);
      break;

    default:
      break;
  }

  return props;
}

// --- schema (validations) --------------------------------------------------

function buildSchema(field) {
  const validations = [];

  if (field.required) {
    validations.push({ key: 'required' });
  }

  (field.validations || []).forEach((val) => {
    if (val.type === 'required') {
      validations.push({ key: 'required', validateWhen: val.validate_when ? { value: val.validate_when } : undefined });
    } else if (val.type === 'min_value' || val.type === 'max_value') {
      const op = val.type === 'min_value' ? '<' : '>';
      validations.push({
        key: 'code',
        args: {
          code: `if (value != null && Number(value) ${op} ${val.value}) { return false; } return true;`,
          message: val.message || '',
        },
      });
    } else if (val.type === 'between') {
      const lo = Number(val.min);
      const hi = Number(val.max);
      validations.push({
        key: 'code',
        args: {
          code: `if (value != null && value !== '' && (Number(value) < ${lo} || Number(value) > ${hi})) { return false; } return true;`,
          message: val.message || `Must be between ${lo} and ${hi}.`,
        },
      });
    } else if (val.type === 'compare_field') {
      // Compare to another field's value. Validation code context varies, so
      // read the other value defensively (form.data or data); if neither is
      // available the rule is non-blocking.
      const other = JSON.stringify(val.other_field || '');
      const op = val.op || '>';
      const otherExpr = `((typeof form!=='undefined'&&form.data)?form.data[${other}]:(typeof data!=='undefined'?data[${other}]:undefined))`;
      let cmp;
      if (op === '==') cmp = 'String(value) === String(o)';
      else if (op === '!=') cmp = 'String(value) !== String(o)';
      else cmp = `Number(value) ${op} Number(o)`;
      validations.push({
        key: 'code',
        args: {
          code: `var o = ${otherExpr}; if (o == null || o === '') return true; if (value != null && value !== '' && !(${cmp})) { return false; } return true;`,
          message: val.message || '',
        },
      });
    } else if (val.type === 'required_when') {
      validations.push({ key: 'required', validateWhen: val.validate_when ? { value: val.validate_when } : undefined });
    } else if (val.type === 'code') {
      validations.push({
        key: 'code',
        validateWhen: val.validate_when ? { value: val.validate_when } : undefined,
        args: { code: val.code || 'return true;', message: val.message || '' },
      });
    }
  });

  if (validations.length === 0) return undefined;
  // strip undefined validateWhen
  validations.forEach((x) => { if (x.validateWhen === undefined) delete x.validateWhen; });
  return { validations };
}

// --- events ----------------------------------------------------------------

function buildEvents(field) {
  const cfg = field.type_config || {};
  const events = {};

  switch (field.field_type) {
    case 'date':
      if (cfg.auto_fill_today) events.onDidMount = [{ name: 'set_date_on_mount', type: 'code' }];
      break;

    case 'time':
      if (cfg.auto_derive_shift) {
        events.onChange = [{ name: 'set_shift', type: 'code', args: { field_data_key: cfg.shift_target_key || 'shift' } }];
        events.onDidMount = [{ name: 'set_shift_on_time', type: 'code' }];
      }
      break;

    case 'dropdown_async':
    case 'tags_async':
      events.onLoadData = [{
        name: 'fetch_dropdown',
        type: 'code',
        args: { entity_id: cfg.entity_id || '', search_fields: cfg.search_fields || '' },
      }];
      if (Array.isArray(cfg.on_select_populate) && cfg.on_select_populate.length) {
        events.onSelect = [{
          name: 'populate_on_select',
          type: 'code',
          args: { mappings: cfg.on_select_populate.filter((m) => m && m.target_key) },
        }];
      }
      break;

    case 'supervisor':
      events.onDidMount = [{ name: 'set_operator_name', type: 'code' }];
      break;

    case 'upload':
      events.onSuccess = [{ name: 'set_upload_url', type: 'code' }];
      break;

    default:
      break;
  }

  // Default value on load (any field) — overrides type-based onDidMount above.
  if (field.default_value && field.default_value.mode) {
    const dv = field.default_value;
    events.onDidMount = [{
      name: 'set_default_value',
      type: 'code',
      args: { target_key: field.dataKey, mode: dv.mode, value: dv.value || '', source_key: dv.source_field || '' },
    }];
  }

  return Object.keys(events).length ? events : undefined;
}

// --- renderWhen (Level 1) --------------------------------------------------

// Values may be stored as number (RsNumberFormat), boolean (RsCheckbox) or
// string (RsInput/dropdown). Coerce both sides to string for equality so a
// numeric 20 still matches the entered '20' (20 === '20' would be false).
const RENDER_OPS = {
  equals: (f, val) => `String(form.data.${f} ?? '') === '${val}'`,
  not_equals: (f, val) => `String(form.data.${f} ?? '') !== '${val}'`,
  is_empty: (f) => `!form.data.${f}`,
  is_not_empty: (f) => `!!form.data.${f}`,
  greater_than: (f, val) => `Number(form.data.${f} || 0) > ${val}`,
  less_than: (f, val) => `Number(form.data.${f} || 0) < ${val}`,
};

function buildRenderWhen(rw) {
  if (!rw || rw.mode !== 'condition') return undefined;
  const fn = RENDER_OPS[rw.operator];
  if (!fn) return undefined;
  return { value: fn(rw.field, rw.value) };
}

// --- field node ------------------------------------------------------------

function buildField(field, defaultWidth) {
  // Imported nodes carry their original verbatim node — emit it as-is to
  // preserve exact dataKeys/props (best-effort round-trip fidelity).
  if (field._raw) return field._raw;

  const width = field.width_override || defaultWidth;
  const node = {
    key: field.id || field.field_name || field.dataKey,
    type: FIELD_TYPE_MAP[field.field_type] || 'RsInput',
    props: buildFieldProps(field),
  };

  // header / divider / computed are display-only: no dataKey.
  if (field.field_type !== 'header' && field.field_type !== 'divider' && field.field_type !== 'computed') {
    node.dataKey = field.dataKey;
  }

  const schema = buildSchema(field);
  if (schema) node.schema = schema;

  const events = buildEvents(field);
  if (events) node.events = events;

  // In a multi-column row (defaultWidth === 'flex') columns share the row via
  // flex:1 so the row gap never pushes total width past 100% (fixes overflow).
  // An explicit width_override opts a field out of flex into a fixed width.
  const useFlex = defaultWidth === 'flex';
  const explicitWidth = field.width_override || (useFlex ? null : defaultWidth);

  const wrap = {};
  if (explicitWidth && explicitWidth !== '100%') wrap.width = explicitWidth;
  else if (useFlex && !field.width_override) wrap.flex = '1';

  // Horizontal placement of a field that doesn't fill the row.
  // alignSelf covers flex containers; margin-auto covers block flow.
  if (field.align === 'center') { wrap.alignSelf = 'center'; wrap.marginLeft = 'auto'; wrap.marginRight = 'auto'; }
  else if (field.align === 'right') { wrap.alignSelf = 'flex-end'; wrap.marginLeft = 'auto'; }
  else if (field.align === 'left') { wrap.alignSelf = 'flex-start'; }
  if (Object.keys(wrap).length) node.wrapperCss = { any: { object: wrap } };

  // Per-component design CSS from the active theme (targets rsuite classes).
  const cc = compCss(node.type);
  if (cc) node.css = { any: { string: cc } };
  // Upload field always needs its trigger button made full-width.
  if (field.field_type === 'upload') {
    const existing = node.css && node.css.any && node.css.any.string ? node.css.any.string : '';
    node.css = { any: { string: existing + UPLOAD_TRIGGER_CSS } };
  }
  // Advanced: append the user's raw custom CSS after the theme CSS so it wins.
  if (field.custom_css && String(field.custom_css).trim()) {
    const existing = node.css && node.css.any && node.css.any.string ? node.css.any.string : '';
    node.css = { any: { string: existing + String(field.custom_css).trim() } };
  }

  const rw = buildRenderWhen(field.render_when);
  if (rw) node.renderWhen = rw;

  return node;
}

// --- section ---------------------------------------------------------------

function buildSectionHeader(section, depth = 0) {
  return {
    key: `${section.container_name}_header`,
    type: 'RsHeader',
    props: { content: v(section.label || ''), headerSize: v(depth === 0 ? 'h4' : 'h5') },
  };
}

function buildFieldRows(section) {
  const rows = [];
  const perRow = section.fields_per_row || 1;
  let buffer = [];
  let rowIdx = 0;

  const flush = () => {
    if (!buffer.length) return;
    if (perRow === 1 || buffer.length === 1) {
      rows.push(...buffer.map((f) => buildField(f, perRow === 1 ? '100%' : 'flex')));
    } else {
      rows.push({
        key: `${section.container_name}_row_${rowIdx}`,
        type: 'RsContainer',
        props: {},
        css: { any: { object: { flexDirection: 'row', gap: TOKENS.space.md, alignItems: 'flex-start' } } },
        children: buffer.map((f) => buildField(f, 'flex')),
      });
    }
    rowIdx += 1;
    buffer = [];
  };

  // header/divider fields force a row break and render full-width — so one
  // section can hold several labelled groups (like the melting form).
  section.fields.forEach((f) => {
    if (f.field_type === 'header' || f.field_type === 'divider') {
      flush();
      rows.push(buildField(f, '100%'));
      return;
    }
    buffer.push(f);
    if (buffer.length === perRow) flush();
  });
  flush();
  return rows;
}

// depth 0 = top-level section (full theme card); depth > 0 = nested
// sub-container (lighter bordered panel). parentPrefix chains the container
// names so the node key stays unique (e.g. moulding__engine).
function buildSection(section, theme, parentPrefix = '', depth = 0) {
  // Imported section we couldn't model → emit verbatim.
  if (section._rawNode) return section._rawNode;

  const eff = parentPrefix ? `${parentPrefix}__${section.container_name}` : section.container_name;
  let css = depth === 0
    ? (THEMES[theme] || THEMES.metalcloud).card
    : { any: { object: { border: hairline, borderRadius: TOKENS.radius.control, padding: TOKENS.space.lg, gap: TOKENS.space.md } } };
  // Advanced: raw custom CSS the user typed for this container is layered on
  // top of the theme card (object = theme defaults, string = user overrides).
  if (section.custom_css && String(section.custom_css).trim()) {
    css = { any: { object: (css.any && css.any.object) || {}, string: String(section.custom_css).trim() } };
  }
  const children = [];

  if (section.show_header && section.label) children.push(buildSectionHeader(section, depth));

  if (section.type === 'table') {
    children.push(...buildRepeaterTable(section, eff));
  } else {
    children.push(...buildFieldRows(section));
  }

  // nested sub-containers
  (section.children || []).forEach((child) => children.push(buildSection(child, theme, eff, depth + 1)));

  const node = {
    key: eff || section.container_name,
    type: 'RsContainer',
    props: {},
    css,
    children: children.filter(Boolean),
  };

  // Whole-section conditional visibility.
  const rw = buildRenderWhen(section.render_when);
  if (rw) node.renderWhen = rw;
  else if (section._rawRenderWhen) node.renderWhen = { value: section._rawRenderWhen };

  return node;
}

// --- table (FormEngine Repeater) -------------------------------------------
//
// Tables are emitted as a native `Repeater` (kind:'repeater') — an array of
// row objects — rather than pre-rendered indexed rows. THE KEY/DATAKEY STANDARD:
//
//   • Array key      → the table's (chained) container name `eff`. The array
//                      lives at form.data.<eff>; the Repeater node's `dataKey`
//                      is `eff` and its node `key` is `${eff}_repeater`.
//   • Cell node key  → `${eff}__${suffix}` (globally unique in the form).
//   • Cell dataKey   → RELATIVE column suffix only (`material`, `qty`) — bound
//                      inside each row object, NOT `table__0__material`.
//                      async cell → `${suffix}__label`; special prefix kept.
//   • Add / Remove   → built-in `common` actions addRow/removeRow (no custom
//                      code). Add is a sibling (args.dataKey = eff); a row's
//                      Remove lives in the template and needs no dataKey
//                      (auto-resolves the parent repeater + e.index).
//   • Initial rows   → seeded via props.value (an array of empty row objects);
//                      no onMount action needed.
//
// Result data shape: { "<eff>": [ { material, qty, … }, … ] }

// Column sizing uses proportional flex (`<n> 1 0`) rather than width:% so the
// row gap + the fixed action column never push the row past 100%.
function colFlex(cfg, col) {
  return `${col.width_percent || Math.floor(100 / cfg.columns.length)} 1 0`;
}

// theme.table.<part> with graceful fallback to null
function tableStyle(part) {
  const t = ACTIVE_THEME && ACTIVE_THEME.table;
  return t && t[part] ? t[part] : null;
}

// Column field_type (builder vocabulary) → standalone field_type used by
// buildField. Cells are real field nodes (the real-form standard), so a column
// can be any input type — fully customisable while staying on-convention.
function colFieldType(colType) {
  if (colType === 'input') return 'text';
  if (colType === 'readonly' || colType === 'header_display') return 'text';
  return colType; // number | date | time | dropdown_fixed | dropdown_async | checkbox | tags_fixed | textarea
}

// Relative dataKey for a column inside a repeater row (no table prefix).
function cellDataKey(col) {
  const suffix = col.dataKey_suffix;
  if (col.field_type === 'dropdown_async' || col.field_type === 'tags_async') return `${suffix}__label`;
  if (col.special_prefix) return `${col.special_prefix}${suffix}`;
  return suffix;
}

// Column header strip (a sibling above the repeater), aligned to the cell flex.
function buildRepeaterHeader(eff, cfg, withActions) {
  const headCss = tableStyle('headCss');
  const children = cfg.columns.map((col) => ({
    key: `${eff}_th_${col.dataKey_suffix}`,
    type: 'RsHeader',
    props: { content: v(col.header || col.dataKey_suffix), headerSize: v('h6') },
    wrapperCss: { any: { object: { flex: colFlex(cfg, col), textAlign: 'center' } } },
    ...(headCss ? { css: { any: { string: headCss } } } : {}),
  }));
  if (withActions) {
    children.push({
      key: `${eff}_th_actions`,
      type: 'RsHeader',
      props: { content: v(''), headerSize: v('h6') },
      wrapperCss: { any: { object: { flex: `0 0 ${TOKENS.size.actionCol}` } } },
    });
  }
  return {
    key: `${eff}_thead`,
    type: 'RsContainer',
    props: {},
    css: { any: { object: { gap: TOKENS.space.md, flexDirection: 'row', alignItems: 'center', borderBottom: hairline, padding: `${TOKENS.space.sm} ${TOKENS.space.sm}` } } },
    children,
  };
}

// One cell node — a real field bound to a RELATIVE dataKey (row-scoped).
function buildRepeaterCell(eff, cfg, col) {
  const readonly = col.field_type === 'readonly' || col.field_type === 'header_display';
  const synthetic = {
    id: `${eff}__${col.dataKey_suffix}`,
    field_name: col.dataKey_suffix,
    label: '',
    show_label: false,
    field_type: colFieldType(col.field_type),
    dataKey: cellDataKey(col),
    required: !!col.required,
    disabled: readonly,
    read_only: readonly,
    width_override: null,
    placeholder: col.placeholder || null,
    render_when: null,
    validations: [],
    special_prefix: null,
    type_config: col.type_config || {},
  };

  const node = buildField(synthetic, null);
  const wrap = { flex: colFlex(cfg, col) };

  // Compact table-cell input styling for text/number cells.
  const cellCss = tableStyle('cellCss');
  if (cellCss && (node.type === 'RsInput' || node.type === 'RsNumberFormat')) {
    node.css = { any: { string: cellCss } };
  }

  // Checkbox/toggle cells: store the native boolean, centered in the column.
  if (synthetic.field_type === 'checkbox' || synthetic.field_type === 'toggle') {
    wrap.display = 'flex';
    wrap.justifyContent = 'center';
    wrap.alignItems = 'center';
  }
  node.wrapperCss = { any: { object: wrap } };
  return node;
}

// The row template — a single horizontal RsContainer of cells (+ remove btn).
function buildRepeaterRow(eff, cfg, withRemove) {
  const children = cfg.columns.map((col) => buildRepeaterCell(eff, cfg, col));

  if (withRemove) {
    // Inside the repeater → removeRow auto-resolves this row via e.index.
    children.push({
      key: `${eff}_del`,
      type: 'RsButton',
      props: { children: v('×'), size: v('sm') },
      // min defaults to 1 so users can't delete the last row; set min_rows:0 to allow emptying.
      events: { onClick: [{ name: 'removeRow', type: 'common', args: { min: cfg.min_rows == null ? 1 : cfg.min_rows } }] },
      wrapperCss: { any: { object: { flex: `0 0 ${TOKENS.size.actionCol}`, display: 'flex', justifyContent: 'center' } } },
      ...(removeBtnCss() ? { css: { any: { string: removeBtnCss() } } } : {}),
    });
  }

  return {
    key: `${eff}_row`,
    type: 'RsContainer',
    props: {},
    css: { any: { object: { gap: TOKENS.space.md, alignItems: 'center', flexDirection: 'row', padding: `${TOKENS.space.sm} ${TOKENS.space.sm}` } } },
    children,
  };
}

// A seed row object — empty string per column (false for checkbox/toggle).
function seedRow(cfg) {
  const o = {};
  cfg.columns.forEach((col) => {
    const ft = colFieldType(col.field_type);
    o[cellDataKey(col)] = (ft === 'checkbox' || ft === 'toggle') ? false : '';
  });
  return o;
}

// Build the table block (header strip + Repeater + add button) as an array of
// nodes that become direct children of the section card. `eff` is the chained
// container name and is used verbatim as the array key.
function buildRepeaterTable(section, eff) {
  const cfg = section.table_config;
  const fixed = cfg.row_mode === 'fixed';
  const seed = seedRow(cfg);
  const count = fixed ? (cfg.fixed_rows || 1) : (cfg.initial_rows || 1);
  const initial = Array.from({ length: count }, () => ({ ...seed }));

  const nodes = [];
  nodes.push(buildRepeaterHeader(eff, cfg, !fixed));
  nodes.push({
    key: `${eff}_repeater`,
    type: 'Repeater',
    dataKey: eff,
    props: { value: v(initial) },
    wrapperCss: { any: { object: { flexDirection: 'column', gap: TOKENS.space.sm } } },
    children: [buildRepeaterRow(eff, cfg, !fixed)],
  });

  if (!fixed) {
    const addCss = tableStyle('addBtnCss') || compCss('RsButton');
    nodes.push({
      key: `${eff}_add`,
      type: 'RsButton',
      props: { children: v(cfg.add_row_label || '+ Add Row'), appearance: v('ghost') },
      events: { onClick: [{ name: 'addRow', type: 'common', args: { dataKey: eff, max: cfg.max_rows || 20, rowData: JSON.stringify(seed) } }] },
      wrapperCss: { any: { object: { width: '100%', marginTop: TOKENS.space.xs } } },
      ...(addCss ? { css: { any: { string: addCss } } } : {}),
    });
  }
  return nodes;
}

// --- form validator (cross-row uniqueness on table columns) ----------------
//
// FormEngine's formValidator is `(formData) => Record<fieldKey, message>`.
// We generate one that scans each table's row array for duplicate values in
// columns flagged `unique`. To highlight the exact cell we emit the error
// under several candidate cell-key formats (FormEngine matches whichever it
// uses). We deliberately do NOT emit a bare table-level key — see the note in
// the generated body. Any imported formValidator is run first and its errors
// merged in (never clobbered).

// Boolean columns (checkbox/toggle) can't be "unique" — only two possible
// values, so uniqueness is meaningless and would block any two rows.
const NON_UNIQUE_COL_TYPES = new Set(['checkbox', 'toggle']);

function collectUniqueColumns(nodes, parentPrefix, out) {
  (nodes || []).forEach((sec) => {
    const eff = parentPrefix ? `${parentPrefix}__${sec.container_name}` : sec.container_name;
    if (sec.type === 'table' && sec.table_config) {
      (sec.table_config.columns || []).forEach((col) => {
        if (col.unique && !NON_UNIQUE_COL_TYPES.has(col.field_type)) {
          out.push({ table: eff, column: cellDataKey(col), label: col.header || col.dataKey_suffix });
        }
      });
    }
    collectUniqueColumns(sec.children, eff, out);
  });
  return out;
}

function buildFormValidator(state) {
  const uniques = collectUniqueColumns(state.sections, '', []);
  const imported = state._imported && state._imported.formValidator;
  if (!uniques.length) return imported || undefined; // nothing to add — keep imported as-is

  const parts = ['var errors = {};'];
  if (imported) {
    parts.push(`try { var _imp = (function (formData) {\n${imported}\n})(formData); if (_imp) Object.assign(errors, _imp); } catch (e) {}`);
  }
  parts.push(`var _uniqueGroups = ${JSON.stringify(uniques)};
_uniqueGroups.forEach(function (g) {
  var rows = Array.isArray(formData[g.table]) ? formData[g.table] : [];
  var seen = {};
  rows.forEach(function (row, i) {
    if (!row) return;
    var val = row[g.column];
    if (val == null || val === '') return;
    var key = String(val);
    if (seen[key] != null) {
      // Flag ONLY the later (offending) row — the first occurrence is the valid
      // one — and point the message back at it so the user knows what it clashes
      // with. seen[key] holds the 0-based index of that first occurrence.
      var msg = (g.label || g.column) + ' must be unique — already used in row ' + (seen[key] + 1) + '.';
      // FormEngine binds a table to a Repeater (array) field, so its errors must
      // be a NESTED array shape — errors[table][rowIndex][column] = msg — exactly
      // mirroring the data. A flat key like errors[table+'.'+i+'.'+col] does NOT
      // attach (it isn't a real field dataKey); a bare errors[table]=string makes
      // the repeater throw "Expected 'object' type, got 'string'".
      errors[g.table] = errors[g.table] || [];
      errors[g.table][i] = errors[g.table][i] || {};
      errors[g.table][i][g.column] = msg;
    } else { seen[key] = i; }
  });
});`);
  parts.push('return errors;');
  return parts.join('\n');
}

// --- top level -------------------------------------------------------------

function buildFormTree(state) {
  const theme = THEMES[state.theme] || THEMES.metalcloud;
  // A theme may restyle the whole page via `screen`; else use default tokens.
  const screenCss = theme.screen || { any: { object: { backgroundColor: TOKENS.color.pageBg, gap: TOKENS.space.xl } } };
  // For imported forms, re-emit the original Screen's props/css/events so
  // screen-level behaviour (e.g. onLoadData wiring) survives a round-trip.
  const scr = (state._imported && state._imported.screen) || {};
  return {
    key: 'Screen',
    type: 'Screen',
    props: scr.props || {},
    css: scr.css || screenCss,
    events: scr.events || { onLoadData: [{ name: 'initFormData', type: 'code' }] },
    children: (state.sections || []).map((s) => buildSection(s, state.theme)),
  };
}

// Stamp marking forms produced by this builder (provenance + version).
const BUILDER_SIGNATURE = { name: 'np-ui-builder', version: '1.0.0' };

const DEFAULT_LANGUAGES = [{
  code: 'en',
  dialect: 'US',
  name: 'English',
  description: 'American English',
  bidi: 'ltr',
}];

function exportJSON(state) {
  ACTIVE_THEME = THEMES[state.theme] || THEMES.metalcloud;
  const imp = state._imported || {};
  const out = {
    version: imp.version || '1',
    // Merge: actions our modelled fields need, with the form's ORIGINAL
    // actions taking precedence — so an imported form's existing behaviours
    // (addRow/removeRow/totals/auto-fill) survive editing and re-export.
    actions: { ...collectUsedActions(state), ...(state.actions || {}) },
    errorType: imp.errorType || 'RsErrorMessage',
    form: buildFormTree(state),
    localization: imp.localization || {},
    languages: imp.languages || DEFAULT_LANGUAGES,
    defaultLanguage: imp.defaultLanguage || state.defaultLanguage || 'en-US',
    _builder: { ...BUILDER_SIGNATURE },
  };
  // Form validator: cross-row uniqueness on table columns, merged with any
  // imported validator (returns the imported one unchanged if no unique cols).
  const fv = buildFormValidator(state);
  if (fv !== undefined) out.formValidator = fv;

  // Advanced (developer) escape hatch: raw code to run on submit. Wrapped in
  // try/catch so a faulty handler can't hard-crash the form. `e.data` is the
  // form data. Overrides any imported onSubmit.
  if (state.on_submit && String(state.on_submit.code || '').trim()) {
    out.actions = {
      ...out.actions,
      onSubmit: { params: {}, body: `try {\n${state.on_submit.code}\n} catch (err) { console.error('onSubmit error:', err); }` },
    };
  }
  return out;
}

export {
  exportJSON,
  buildFormTree,
  buildSection,
  buildField,
  buildRepeaterTable,
  buildRenderWhen,
  buildFieldProps,
  buildSchema,
  buildEvents,
  FIELD_TYPE_MAP,
  WIDTH_MAP,
};
