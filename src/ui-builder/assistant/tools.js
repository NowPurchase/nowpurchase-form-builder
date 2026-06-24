'use strict';

// ---------------------------------------------------------------------------
// tools.js — provider-neutral tool layer for the AI assistant.
//
// Each tool maps to one or more builder reducer actions. Tools are applied as
// a PURE FOLD over builder state (using the reducer directly) so a multi-step
// plan — "add a section, then add 3 fields to it" — can chain: each tool sees
// the state produced by the previous one and can resolve the new ids. The
// chat panel applies the final state with a single LOAD_STATE dispatch.
//
// Tools are intentionally HIGH-LEVEL (slot-filling), so even a small local
// model just supplies arguments rather than writing code or dataKeys.
// ---------------------------------------------------------------------------

import { reducer, findNode, createTableConfig } from '../state/formState.js';
import { toSnakeCase } from '../engine/dataKey.js';

const FIELD_TYPES = [
  'text', 'number', 'date', 'time', 'shift', 'dropdown_fixed', 'dropdown_async',
  'tags_fixed', 'tags_async', 'checkbox', 'toggle', 'textarea', 'header',
  'divider', 'supervisor', 'upload', 'spectrometer', 'chips',
];

// JSON-schema tool definitions sent to the model (provider-neutral shape).
export const TOOLS = [
  {
    name: 'add_section',
    description: 'Add a new top-level section (a card containing fields). The container_name becomes the prefix for every field key inside it; lowercase letters/numbers/underscores only.',
    parameters: {
      type: 'object',
      properties: {
        container_name: { type: 'string', description: 'lowercase key prefix, e.g. "moulding"' },
        label: { type: 'string', description: 'optional display title' },
        fields_per_row: { type: 'integer', description: 'columns per row: 1, 2, or 3 (default 2)' },
      },
      required: ['container_name'],
    },
  },
  {
    name: 'add_field',
    description: 'Add a field to a section. The dataKey is derived automatically from the section prefix and the label.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'container_name (or label) of the target section' },
        field_type: { type: 'string', enum: FIELD_TYPES },
        label: { type: 'string' },
        required: { type: 'boolean' },
        placeholder: { type: 'string' },
        entity_id: { type: 'string', description: 'for dropdown_async/tags_async: the master-data entity id' },
        search_fields: { type: 'string', description: 'for dropdown_async/tags_async: field to search' },
        options: {
          type: 'array',
          description: 'for dropdown_fixed/tags_fixed: list of {label,value}',
          items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] },
        },
        url: { type: 'string', description: 'for spectrometer: the device/reading endpoint URL' },
        elements: { type: 'string', description: 'for spectrometer: comma-separated element symbols, e.g. "C,Si,Mn,P,S"' },
        columns_per_row: { type: 'integer', description: 'for spectrometer: element grid columns per row (default 4)' },
        show_connection_status: { type: 'boolean', description: 'for spectrometer: show the device connection indicator (default true)' },
        allow_duplicates: { type: 'boolean', description: 'for chips: allow duplicate chip values (default false)' },
        max_chips: { type: 'integer', description: 'for chips: max number of chips, 0 = unlimited (default 0)' },
      },
      required: ['section', 'field_type', 'label'],
    },
  },
  {
    name: 'update_field',
    description: 'Update an existing field (e.g. make it required, rename, change placeholder).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        field: { type: 'string', description: 'field_name, label, or dataKey of the field to change' },
        required: { type: 'boolean' },
        label: { type: 'string' },
        placeholder: { type: 'string' },
        disabled: { type: 'boolean' },
        custom_css: { type: 'string', description: 'advanced: raw CSS layered onto this field' },
      },
      required: ['section', 'field'],
    },
  },
  {
    name: 'remove_field',
    description: 'Remove a field from a section.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string' }, field: { type: 'string' } },
      required: ['section', 'field'],
    },
  },
  {
    name: 'set_render_when',
    description: 'Show a field only when a condition on another field is met (the "show this if that" feature).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        field: { type: 'string' },
        when_field: { type: 'string', description: 'the dataKey of the field the condition checks' },
        operator: { type: 'string', enum: ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'greater_than', 'less_than'] },
        value: { type: 'string' },
      },
      required: ['section', 'field', 'when_field', 'operator'],
    },
  },
  {
    name: 'add_table',
    description: 'Add a table section. Each column becomes a field type. row_mode "dynamic" lets users add/remove rows; "fixed" shows a static number of rows.',
    parameters: {
      type: 'object',
      properties: {
        container_name: { type: 'string' },
        label: { type: 'string' },
        row_mode: { type: 'string', enum: ['dynamic', 'fixed'] },
        fixed_rows: { type: 'integer' },
        max_rows: { type: 'integer' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              header: { type: 'string' },
              suffix: { type: 'string', description: 'dataKey suffix, e.g. "weight"' },
              field_type: { type: 'string', enum: ['input', 'number', 'date', 'time', 'dropdown_fixed', 'dropdown_async', 'checkbox', 'toggle', 'textarea', 'readonly'] },
              width_percent: { type: 'integer' },
            },
            required: ['header', 'suffix', 'field_type'],
          },
        },
      },
      required: ['container_name', 'columns'],
    },
  },
  {
    name: 'add_nested_group',
    description: 'Add a nested sub-container inside an existing section (its fields chain the prefix: parent__child__field).',
    parameters: {
      type: 'object',
      properties: {
        parent_section: { type: 'string', description: 'container_name (or label) of the parent section' },
        container_name: { type: 'string' },
        label: { type: 'string' },
        fields_per_row: { type: 'integer' },
      },
      required: ['parent_section', 'container_name'],
    },
  },
  {
    name: 'update_section',
    description: 'Rename or restyle a section (container_name, label, columns-per-row, header visibility).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        container_name: { type: 'string' },
        label: { type: 'string' },
        fields_per_row: { type: 'integer', description: '1, 2, or 3' },
        show_header: { type: 'boolean' },
        custom_css: { type: 'string', description: 'advanced: raw CSS layered onto this container' },
      },
      required: ['section'],
    },
  },
  {
    name: 'move_section',
    description: 'Reorder a section up or down.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string' }, direction: { type: 'string', enum: ['up', 'down'] } },
      required: ['section', 'direction'],
    },
  },
  {
    name: 'set_section_visibility',
    description: 'Show a whole section only when a condition on a field holds (or always). Pass operator "always" to clear.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        when_field: { type: 'string', description: 'dataKey (or label) of the field the condition checks' },
        operator: { type: 'string', enum: ['always', 'equals', 'not_equals', 'is_empty', 'is_not_empty', 'greater_than', 'less_than'] },
        value: { type: 'string' },
      },
      required: ['section', 'operator'],
    },
  },
  {
    name: 'configure_field',
    description: 'Set type-specific options on a field: date format/auto-today, time→shift, number format, dropdown options, async entity/search, textarea rows, upload multiple, spectrometer url/elements.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        field: { type: 'string' },
        format: { type: 'string', description: 'date format e.g. dd-MM-yyyy' },
        auto_fill_today: { type: 'boolean' },
        enable_time: { type: 'boolean' },
        auto_derive_shift: { type: 'boolean' },
        shift_target_key: { type: 'string' },
        allow_negative: { type: 'boolean' },
        decimal_scale: { type: 'integer' },
        prefix: { type: 'string' },
        suffix: { type: 'string' },
        rows: { type: 'integer' },
        multiple: { type: 'boolean' },
        entity_id: { type: 'string' },
        search_fields: { type: 'string' },
        options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] } },
        url: { type: 'string', description: 'for spectrometer: device/reading endpoint URL' },
        elements: { type: 'string', description: 'for spectrometer: comma-separated element symbols' },
        columns_per_row: { type: 'integer', description: 'for spectrometer: element grid columns per row' },
        show_connection_status: { type: 'boolean', description: 'for spectrometer: show the device connection indicator' },
        allow_duplicates: { type: 'boolean', description: 'for chips: allow duplicate chip values' },
        max_chips: { type: 'integer', description: 'for chips: max number of chips (0 = unlimited)' },
      },
      required: ['section', 'field'],
    },
  },
  {
    name: 'move_field',
    description: 'Reorder a field within its section (direction), or move it to another section (to_section).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'the field’s current section' },
        field: { type: 'string' },
        direction: { type: 'string', enum: ['up', 'down'] },
        to_section: { type: 'string', description: 'move the field into this section instead' },
      },
      required: ['section', 'field'],
    },
  },
  {
    name: 'set_on_submit',
    description: 'Set JavaScript that runs when the form is submitted. The handler receives `e` (e.data is the form data); it is wrapped in try/catch on export. Pass empty code to clear.',
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'JS body, e.g. "e.data.total = (e.data.a||0)+(e.data.b||0);"' } },
      required: [],
    },
  },
  {
    name: 'set_default',
    description: 'Give a field a default value that auto-fills when the form opens: today, now (time), datetime, the current user, a fixed value, or another field\'s value.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        field: { type: 'string' },
        mode: { type: 'string', enum: ['today', 'now', 'datetime', 'user', 'fixed', 'from_field', 'none'], description: '"none" clears the default' },
        value: { type: 'string', description: 'for mode "fixed": the value to pre-fill' },
        source_field: { type: 'string', description: 'for mode "from_field": dataKey to copy from' },
      },
      required: ['section', 'field', 'mode'],
    },
  },
  {
    name: 'add_validation',
    description: 'Add a validation rule to a field.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        field: { type: 'string' },
        type: { type: 'string', enum: ['required', 'min_value', 'max_value', 'between', 'compare_field', 'required_when', 'code'] },
        value: { type: 'string', description: 'the bound for min_value/max_value' },
        min: { type: 'number', description: 'for type "between": lower bound' },
        max: { type: 'number', description: 'for type "between": upper bound' },
        op: { type: 'string', enum: ['>', '<', '>=', '<=', '==', '!='], description: 'for type "compare_field": comparison vs another field' },
        other_field: { type: 'string', description: 'for type "compare_field": dataKey of the field to compare against' },
        message: { type: 'string', description: 'error message shown to the user' },
        code: { type: 'string', description: 'for type "code": a JS body returning true when valid' },
        validate_when: { type: 'string', description: 'condition expression; required for "required_when", optional for "code"' },
      },
      required: ['section', 'field', 'type'],
    },
  },
  {
    name: 'update_table',
    description: 'Change a table’s row behaviour (dynamic/fixed, row counts, add-row label).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        row_mode: { type: 'string', enum: ['dynamic', 'fixed'] },
        fixed_rows: { type: 'integer' },
        initial_rows: { type: 'integer' },
        min_rows: { type: 'integer' },
        max_rows: { type: 'integer' },
        add_row_label: { type: 'string' },
      },
      required: ['section'],
    },
  },
  {
    name: 'add_column',
    description: 'Add a column to an existing table.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        header: { type: 'string' },
        suffix: { type: 'string', description: 'relative dataKey, e.g. "weight"' },
        field_type: { type: 'string', enum: ['input', 'number', 'date', 'time', 'dropdown_fixed', 'dropdown_async', 'checkbox', 'toggle', 'textarea', 'readonly'] },
        width_percent: { type: 'integer' },
        required: { type: 'boolean' },
        unique: { type: 'boolean', description: 'value must be unique across all rows in this column' },
      },
      required: ['section', 'header', 'suffix'],
    },
  },
  {
    name: 'update_column',
    description: 'Edit an existing table column (identified by its current suffix or header).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        column: { type: 'string', description: 'current suffix or header of the column' },
        header: { type: 'string' },
        suffix: { type: 'string' },
        field_type: { type: 'string', enum: ['input', 'number', 'date', 'time', 'dropdown_fixed', 'dropdown_async', 'checkbox', 'toggle', 'textarea', 'readonly'] },
        width_percent: { type: 'integer' },
        required: { type: 'boolean' },
        unique: { type: 'boolean', description: 'value must be unique across all rows in this column' },
      },
      required: ['section', 'column'],
    },
  },
  {
    name: 'remove_column',
    description: 'Remove a column from a table.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string' }, column: { type: 'string', description: 'suffix or header' } },
      required: ['section', 'column'],
    },
  },
  {
    name: 'move_column',
    description: 'Reorder a table column left or right.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string' }, column: { type: 'string' }, direction: { type: 'string', enum: ['left', 'right'] } },
      required: ['section', 'column', 'direction'],
    },
  },
  {
    name: 'add_total',
    description: 'Add a read-only computed field (e.g. the sum of a table column, a count, or a custom expression).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        label: { type: 'string' },
        table: { type: 'string', description: 'container_name of the table to aggregate (its array key)' },
        column: { type: 'string', description: 'the column suffix to aggregate' },
        fields: { type: 'array', items: { type: 'string' }, description: 'dataKeys of FORM fields to aggregate (calculated field across the form, e.g. ["mould__a","mould__b"])' },
        op: { type: 'string', enum: ['sum', 'count', 'avg', 'min', 'max'] },
        expression: { type: 'string', description: 'optional expression over form.data, e.g. "form.data.qty * form.data.rate" (overrides table/fields/op)' },
      },
      required: ['section', 'label'],
    },
  },
  {
    name: 'set_form_meta',
    description: 'Set form-level metadata (display name, template_id, default language).',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' }, template_id: { type: 'string' }, defaultLanguage: { type: 'string' } },
    },
  },
  {
    name: 'validate_form',
    description: 'Check the current form for problems (duplicate/empty container names, duplicate dataKeys, empty-label fields, tables with no columns, render-when referencing unknown fields). Read-only.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'set_theme',
    description: 'Set the visual theme for the whole form.',
    parameters: {
      type: 'object',
      properties: { theme: { type: 'string', enum: ['metalcloud'] } },
      required: ['theme'],
    },
  },
  {
    name: 'remove_section',
    description: 'Remove a whole section by its container_name.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string' } },
      required: ['section'],
    },
  },
];

// ---- helpers ---------------------------------------------------------------

function norm(s) { return String(s || '').trim().toLowerCase(); }

// find a container node anywhere in the tree by container_name or label
export function findSection(state, ref) {
  const target = norm(ref);
  let hit = null;
  const walk = (nodes) => (nodes || []).forEach((n) => {
    if (norm(n.container_name) === target || norm(n.label) === target) hit = hit || n;
    walk(n.children);
  });
  walk(state.sections);
  return hit;
}

function findField(section, ref) {
  const target = norm(ref);
  return (section.fields || []).find((f) => norm(f.field_name) === target
    || norm(f.label) === target || norm(f.dataKey) === target) || null;
}

// index of a table column referenced by its suffix or header (-1 if none)
function findColIndex(cfg, ref) {
  const t = norm(ref);
  return (cfg.columns || []).findIndex((c) => norm(c.dataKey_suffix) === t || norm(c.header) === t);
}

const ASYNC = new Set(['dropdown_async', 'tags_async']);
const FIXED_OPTS = new Set(['dropdown_fixed', 'tags_fixed']);

// Resolve a reference to a real dataKey. If it already looks like a key
// (contains __ or matches a field's dataKey), keep it; otherwise search every
// field by field_name/label and return its dataKey.
function resolveDataKey(state, ref) {
  if (!ref) return ref;
  const target = norm(ref);
  let found = null;
  const walk = (nodes) => (nodes || []).forEach((n) => {
    (n.fields || []).forEach((f) => {
      if (norm(f.dataKey) === target || norm(f.field_name) === target || norm(f.label) === target) found = found || f.dataKey;
    });
    walk(n.children);
  });
  walk(state.sections);
  return found || ref;
}

// ---- apply a single tool call as a pure state transition -------------------
// returns { state, message }
export function applyTool(state, name, args = {}) {
  switch (name) {
    case 'add_section': {
      let s = reducer(state, { type: 'ADD_SECTION' });
      const sec = s.sections[s.sections.length - 1];
      s = reducer(s, { type: 'UPDATE_SECTION', sectionId: sec.id, patch: {
        container_name: args.container_name,
        label: args.label || null,
        fields_per_row: args.fields_per_row || 2,
      } });
      return { state: s, message: `Added section "${args.container_name}".` };
    }

    case 'add_field': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      if (!FIELD_TYPES.includes(args.field_type)) return { state, message: `⚠ Unknown field type "${args.field_type}".` };
      let s = reducer(state, { type: 'ADD_FIELD', sectionId: sec.id, fieldType: args.field_type });
      const after = findNode(s.sections, sec.id);
      const fld = after.fields[after.fields.length - 1];
      // The tool derives the key from the label ONCE, here at creation (the
      // caller supplies a meaningful label and expects a meaningful key like
      // `heat_no`). The reducer never re-derives on later label edits, so saved
      // keys stay stable. An explicit field_name wins if provided.
      const fieldName = toSnakeCase(args.field_name || args.label || '');
      s = reducer(s, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: {
        label: args.label,
        ...(fieldName ? { field_name: fieldName } : {}),
        required: !!args.required,
        placeholder: args.placeholder || null,
      } });
      const cfg = {};
      if (ASYNC.has(args.field_type)) { cfg.entity_id = args.entity_id || ''; cfg.search_fields = args.search_fields || ''; }
      if (FIXED_OPTS.has(args.field_type) && Array.isArray(args.options)) cfg.options = args.options;
      if (args.field_type === 'spectrometer') {
        if (args.url !== undefined) cfg.url = args.url;
        if (args.elements !== undefined) cfg.elements = args.elements;
        if (args.columns_per_row !== undefined) cfg.columns_per_row = args.columns_per_row;
        if (args.show_connection_status !== undefined) cfg.show_connection_status = args.show_connection_status;
      }
      if (args.field_type === 'chips') {
        if (args.allow_duplicates !== undefined) cfg.allow_duplicates = args.allow_duplicates;
        if (args.max_chips !== undefined) cfg.max_chips = args.max_chips;
      }
      if (Object.keys(cfg).length) s = reducer(s, { type: 'UPDATE_FIELD_CONFIG', sectionId: sec.id, fieldId: fld.id, patch: cfg });
      const dk = findNode(s.sections, sec.id).fields.slice(-1)[0].dataKey;
      return { state: s, message: `Added ${args.field_type} "${args.label}" → ${dk}.` };
    }

    case 'update_field': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}" in "${args.section}".` };
      const patch = {};
      ['required', 'label', 'placeholder', 'disabled', 'custom_css'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      const s = reducer(state, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch });
      return { state: s, message: `Updated "${args.field}".` };
    }

    case 'remove_field': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}".` };
      const s = reducer(state, { type: 'REMOVE_FIELD', sectionId: sec.id, fieldId: fld.id });
      return { state: s, message: `Removed "${args.field}".` };
    }

    case 'set_render_when': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}".` };
      // Resolve a bare field reference (e.g. "approved") to its real dataKey.
      const whenKey = resolveDataKey(state, args.when_field);
      const s = reducer(state, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: {
        render_when: { mode: 'condition', field: whenKey, operator: args.operator, value: args.value || '' },
      } });
      return { state: s, message: `"${args.field}" now shows only when ${whenKey} ${args.operator} ${args.value || ''}.` };
    }

    case 'add_table': {
      let s = reducer(state, { type: 'ADD_SECTION' });
      const sec = s.sections[s.sections.length - 1];
      s = reducer(s, { type: 'UPDATE_SECTION', sectionId: sec.id, patch: { container_name: args.container_name, label: args.label || null } });
      const base = createTableConfig();
      const cols = (args.columns || []).map((c, i) => ({
        key: `col_${i}`, header: c.header, dataKey_suffix: c.suffix,
        field_type: c.field_type || 'input', width_percent: c.width_percent || Math.floor(100 / (args.columns.length || 1)),
        required: false, placeholder: '', type_config: {},
      }));
      const config = {
        ...base,
        row_mode: args.row_mode || 'dynamic',
        fixed_rows: args.fixed_rows || 3,
        max_rows: args.max_rows || 20,
        data_prefix: args.container_name,
        columns: cols.length ? cols : base.columns,
      };
      s = reducer(s, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config });
      return { state: s, message: `Added ${config.row_mode} table "${args.container_name}" with ${config.columns.length} columns.` };
    }

    case 'set_theme': {
      const s = reducer(state, { type: 'SET_META', patch: { theme: args.theme } });
      return { state: s, message: `Theme set to "${args.theme}".` };
    }

    case 'remove_section': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const s = reducer(state, { type: 'REMOVE_SECTION', sectionId: sec.id });
      return { state: s, message: `Removed section "${args.section}".` };
    }

    case 'add_nested_group': {
      const parent = findSection(state, args.parent_section);
      if (!parent) return { state, message: `⚠ No section "${args.parent_section}".` };
      let s = reducer(state, { type: 'ADD_SUBCONTAINER', parentId: parent.id });
      const after = findNode(s.sections, parent.id);
      const child = after.children[after.children.length - 1];
      s = reducer(s, { type: 'UPDATE_SECTION', sectionId: child.id, patch: {
        container_name: args.container_name, label: args.label || null, fields_per_row: args.fields_per_row || 1,
      } });
      return { state: s, message: `Added nested group "${args.container_name}" inside "${args.parent_section}".` };
    }

    case 'update_section': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const patch = {};
      ['container_name', 'label', 'fields_per_row', 'show_header', 'custom_css'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      const s = reducer(state, { type: 'UPDATE_SECTION', sectionId: sec.id, patch });
      return { state: s, message: `Updated section "${args.section}".` };
    }

    case 'move_section': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const s = reducer(state, { type: 'MOVE_SECTION', sectionId: sec.id, dir: args.direction === 'up' ? -1 : 1 });
      return { state: s, message: `Moved section "${args.section}" ${args.direction}.` };
    }

    case 'set_section_visibility': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      let render_when = null;
      if (args.operator && args.operator !== 'always') {
        render_when = { mode: 'condition', field: resolveDataKey(state, args.when_field), operator: args.operator, value: args.value || '' };
      }
      const s = reducer(state, { type: 'UPDATE_SECTION', sectionId: sec.id, patch: { render_when } });
      return { state: s, message: render_when
        ? `Section "${args.section}" now shows only when ${render_when.field} ${args.operator} ${args.value || ''}.`
        : `Section "${args.section}" always shows.` };
    }

    case 'configure_field': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}" in "${args.section}".` };
      const patch = {};
      ['format', 'auto_fill_today', 'enable_time', 'auto_derive_shift', 'shift_target_key', 'allow_negative',
        'decimal_scale', 'prefix', 'suffix', 'rows', 'multiple', 'entity_id', 'search_fields', 'options',
        'url', 'elements', 'columns_per_row', 'show_connection_status', 'allow_duplicates', 'max_chips']
        .forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      if (!Object.keys(patch).length) return { state, message: `⚠ Nothing to configure on "${args.field}".` };
      const s = reducer(state, { type: 'UPDATE_FIELD_CONFIG', sectionId: sec.id, fieldId: fld.id, patch });
      return { state: s, message: `Configured "${args.field}".` };
    }

    case 'move_field': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}" in "${args.section}".` };
      if (args.to_section) {
        const dest = findSection(state, args.to_section);
        if (!dest) return { state, message: `⚠ No target section "${args.to_section}".` };
        if (dest.id === sec.id) return { state, message: `"${args.field}" is already in "${args.to_section}".` };
        const s = reducer(state, { type: 'RELOCATE_FIELD', fieldId: fld.id, toSectionId: dest.id });
        return { state: s, message: `Moved "${args.field}" to "${args.to_section}".` };
      }
      const s = reducer(state, { type: 'MOVE_FIELD', sectionId: sec.id, fieldId: fld.id, dir: args.direction === 'up' ? -1 : 1 });
      return { state: s, message: `Moved "${args.field}" ${args.direction || 'down'}.` };
    }

    case 'set_on_submit': {
      const code = String(args.code || '').trim();
      const s = reducer(state, { type: 'SET_META', patch: { on_submit: code ? { code } : null } });
      return { state: s, message: code ? 'Set custom on-submit code.' : 'Cleared on-submit code.' };
    }

    case 'set_default': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}" in "${args.section}".` };
      const dv = (args.mode && args.mode !== 'none')
        ? { mode: args.mode, value: args.value || '', source_field: args.source_field || '' }
        : null;
      const s = reducer(state, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: { default_value: dv } });
      return { state: s, message: dv ? `Set "${args.field}" to default to ${args.mode}.` : `Cleared default on "${args.field}".` };
    }

    case 'add_validation': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      const fld = findField(sec, args.field);
      if (!fld) return { state, message: `⚠ No field "${args.field}" in "${args.section}".` };
      if (args.type === 'required') {
        const s = reducer(state, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: { required: true } });
        return { state: s, message: `Made "${args.field}" required.` };
      }
      const val = { type: args.type };
      if (args.value !== undefined) val.value = args.value;
      if (args.min !== undefined) val.min = args.min;
      if (args.max !== undefined) val.max = args.max;
      if (args.op !== undefined) val.op = args.op;
      if (args.other_field !== undefined) val.other_field = args.other_field;
      if (args.message) val.message = args.message;
      if (args.code) val.code = args.code;
      if (args.validate_when) val.validate_when = args.validate_when;
      const s = reducer(state, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: { validations: [...(fld.validations || []), val] } });
      return { state: s, message: `Added ${args.type} validation to "${args.field}".` };
    }

    case 'update_table': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      if (sec.type !== 'table' || !sec.table_config) return { state, message: `⚠ "${args.section}" is not a table.` };
      const cfg = { ...sec.table_config };
      ['row_mode', 'fixed_rows', 'initial_rows', 'min_rows', 'max_rows', 'add_row_label'].forEach((k) => { if (args[k] !== undefined) cfg[k] = args[k]; });
      const s = reducer(state, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config: cfg });
      return { state: s, message: `Updated table "${args.section}".` };
    }

    case 'add_column': {
      const sec = findSection(state, args.section);
      if (!sec || sec.type !== 'table' || !sec.table_config) return { state, message: `⚠ "${args.section}" is not a table.` };
      const cfg = sec.table_config;
      const cols = [...cfg.columns, {
        key: `col_${args.suffix}`, header: args.header, dataKey_suffix: args.suffix,
        field_type: args.field_type || 'input', width_percent: args.width_percent || Math.floor(100 / (cfg.columns.length + 1)),
        required: !!args.required, unique: !!args.unique, placeholder: '', type_config: {},
      }];
      const s = reducer(state, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config: { ...cfg, columns: cols } });
      return { state: s, message: `Added column "${args.header}" to "${args.section}".` };
    }

    case 'update_column': {
      const sec = findSection(state, args.section);
      if (!sec || sec.type !== 'table' || !sec.table_config) return { state, message: `⚠ "${args.section}" is not a table.` };
      const cfg = sec.table_config;
      const idx = findColIndex(cfg, args.column);
      if (idx < 0) return { state, message: `⚠ No column "${args.column}" in "${args.section}".` };
      const cols = cfg.columns.map((c, i) => (i === idx ? {
        ...c,
        ...(args.header !== undefined ? { header: args.header } : {}),
        ...(args.suffix !== undefined ? { dataKey_suffix: args.suffix } : {}),
        ...(args.field_type !== undefined ? { field_type: args.field_type } : {}),
        ...(args.width_percent !== undefined ? { width_percent: args.width_percent } : {}),
        ...(args.required !== undefined ? { required: args.required } : {}),
        ...(args.unique !== undefined ? { unique: args.unique } : {}),
      } : c));
      const s = reducer(state, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config: { ...cfg, columns: cols } });
      return { state: s, message: `Updated column "${args.column}".` };
    }

    case 'remove_column': {
      const sec = findSection(state, args.section);
      if (!sec || sec.type !== 'table' || !sec.table_config) return { state, message: `⚠ "${args.section}" is not a table.` };
      const cfg = sec.table_config;
      const idx = findColIndex(cfg, args.column);
      if (idx < 0) return { state, message: `⚠ No column "${args.column}".` };
      if (cfg.columns.length <= 1) return { state, message: `⚠ A table needs at least one column.` };
      const cols = cfg.columns.filter((_, i) => i !== idx);
      const s = reducer(state, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config: { ...cfg, columns: cols } });
      return { state: s, message: `Removed column "${args.column}".` };
    }

    case 'move_column': {
      const sec = findSection(state, args.section);
      if (!sec || sec.type !== 'table' || !sec.table_config) return { state, message: `⚠ "${args.section}" is not a table.` };
      const cfg = sec.table_config;
      const idx = findColIndex(cfg, args.column);
      const to = idx + (args.direction === 'left' ? -1 : 1);
      if (idx < 0) return { state, message: `⚠ No column "${args.column}".` };
      if (to < 0 || to >= cfg.columns.length) return { state, message: `Column "${args.column}" can't move further ${args.direction}.` };
      const cols = [...cfg.columns];
      [cols[idx], cols[to]] = [cols[to], cols[idx]];
      const s = reducer(state, { type: 'SET_TABLE_CONFIG', sectionId: sec.id, config: { ...cfg, columns: cols } });
      return { state: s, message: `Moved column "${args.column}" ${args.direction}.` };
    }

    case 'add_total': {
      const sec = findSection(state, args.section);
      if (!sec) return { state, message: `⚠ No section "${args.section}".` };
      let s = reducer(state, { type: 'ADD_FIELD', sectionId: sec.id, fieldType: 'computed' });
      const fld = findNode(s.sections, sec.id).fields.slice(-1)[0];
      s = reducer(s, { type: 'UPDATE_FIELD', sectionId: sec.id, fieldId: fld.id, patch: { label: args.label } });
      s = reducer(s, { type: 'UPDATE_FIELD_CONFIG', sectionId: sec.id, fieldId: fld.id, patch: {
        op: args.op || 'sum', source_table: args.table || '', source_column: args.column || '',
        source_fields: Array.isArray(args.fields) ? args.fields : [], expression: args.expression || '',
      } });
      const how = args.expression ? '= formula' : args.table ? `= ${args.op || 'sum'} of ${args.table}.${args.column || ''}` : (Array.isArray(args.fields) && args.fields.length ? `= ${args.op || 'sum'} of ${args.fields.length} field(s)` : '');
      return { state: s, message: `Added computed "${args.label}" ${how}.`.trim() };
    }

    case 'set_form_meta': {
      const patch = {};
      ['name', 'template_id', 'defaultLanguage'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      if (!Object.keys(patch).length) return { state, message: '⚠ Nothing to set.' };
      const s = reducer(state, { type: 'SET_META', patch });
      return { state: s, message: 'Updated form metadata.' };
    }

    case 'validate_form': {
      const issues = [];
      const names = {};
      const keys = {};
      const walk = (nodes) => (nodes || []).forEach((sec) => {
        if (!sec.container_name) issues.push(`Section without a name${sec.label ? ` (label "${sec.label}")` : ''}.`);
        else names[sec.container_name] = (names[sec.container_name] || 0) + 1;
        if (sec.type === 'table' && !((sec.table_config || {}).columns || []).length) issues.push(`Table "${sec.container_name}" has no columns.`);
        (sec.fields || []).forEach((f) => {
          if (f.field_type !== 'divider' && !(f.label || f.field_name)) issues.push(`A field in "${sec.container_name}" has no label.`);
          if (f.dataKey) keys[f.dataKey] = (keys[f.dataKey] || 0) + 1;
        });
        walk(sec.children);
      });
      walk(state.sections);
      Object.entries(names).forEach(([n, c]) => { if (c > 1) issues.push(`Duplicate section name "${n}" (${c}×).`); });
      Object.entries(keys).forEach(([k, c]) => { if (c > 1) issues.push(`Duplicate dataKey "${k}" (${c}×).`); });
      return { state, message: issues.length ? `Found ${issues.length} issue(s):\n- ${issues.join('\n- ')}` : '✓ No problems found.' };
    }

    default:
      return { state, message: `⚠ Unknown tool "${name}".` };
  }
}

// Fold a list of tool calls over state; returns { state, messages }.
export function applyToolCalls(state, calls) {
  const messages = [];
  let s = state;
  (calls || []).forEach((c) => {
    const r = applyTool(s, c.name, c.args || c.arguments || {});
    s = r.state;
    messages.push(r.message);
  });
  return { state: s, messages };
}
