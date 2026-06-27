import React, { useState } from 'react';
import { validateContainerName } from '../../engine/dataKey.js';
import { createTableConfig, createColumn, siblingNames, FIELD_PALETTE } from '../../state/formState.js';
import { ENTITIES, getEntity } from '../../state/entities.js';
import { dropdownBaseKey } from '../../engine/autofill.js';
import { referencesTo, subtreeKeys, referenceableKeys } from '../../engine/keyGraph.js';
import { dropdownType, dropdownVariant, booleanType, booleanDisplay, dateTypeFor, dateMode } from '../../engine/fieldKind.js';
import EntityConfigModal from './EntityConfigModal.jsx';
import KeyPicker from './KeyPicker.jsx';
import Icon from '../Icon.jsx';

// Friendly name per field type (panel header), from the palette.
const TYPE_META = FIELD_PALETTE.reduce((m, p) => { m[p.type] = p; return m; }, {});
const typeLabel = (t) => (TYPE_META[t]?.label || t);
const ICON_NAME = {
  text: 'text', number: 'number', date: 'date', time: 'time', shift: 'shift',
  dropdown_fixed: 'dropdown', dropdown_async: 'link', tags_fixed: 'tag', tags_async: 'tag',
  checkbox: 'checkbox', toggle: 'toggle', textarea: 'textarea', upload: 'file', header: 'heading',
  divider: 'divider', supervisor: 'supervisor', spectrometer: 'spectrometer', chips: 'tag',
};
const iconName = (t) => ICON_NAME[t] || 'text';

// Plain-English column types (non-tech friendly). Value = stored field_type.
const COLUMN_TYPES = [
  ['input', '📝 Text'],
  ['number', '🔢 Number'],
  ['date', '📅 Date'],
  ['time', '🕐 Time'],
  ['dropdown_fixed', '▼ Dropdown'],
  ['dropdown_async', '🔗 Dropdown (master data)'],
  ['checkbox', '☑ Checkbox'],
  ['toggle', '🔘 Toggle'],
  ['tags_fixed', '🏷 Dropdown (multi-select)'],
  ['textarea', '📄 Text Area'],
  ['readonly', '🔒 Read-only display'],
];

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="fld">{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <div className={`check ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="box">{checked && <Icon name="check" size={12} stroke={2.4} />}</span>
      <span className="lab">{label}</span>
    </div>
  );
}

const WIDTHS = ['25%', '33%', '50%', '66%', '75%', '100%'];

// Predefined date formats (rsuite-valid tokens — case matters: MM=month). Free
// text invites invalid patterns that break the picker, so offer a shortlist.
// For "Date + Time", export appends the time part automatically.
const DATE_FORMATS = ['dd-MM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd MMM yyyy'];

// Warns (non-blocking) when the given key(s) are referenced by other builder
// rules, so the user knows a rename will break them. Structured refs are exact;
// best-effort hits (formulas / validate_when / on_submit code) are flagged as
// such. Coverage is honest: table-internal and raw imported refs aren't scanned.
function KeyUsageWarning({ refIndex, keys }) {
  const consumers = referencesTo(refIndex, keys);
  if (!consumers.length) return null;
  const structured = consumers.filter((c) => !c.bestEffort);
  const fuzzy = consumers.filter((c) => c.bestEffort);
  const liStyle = { fontSize: 12, lineHeight: 1.5 };
  return (
    <div style={{ marginTop: 6, padding: '6px 8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e' }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>⚠ Used in {consumers.length} rule{consumers.length === 1 ? '' : 's'} — renaming will break {consumers.length === 1 ? 'it' : 'them'}:</div>
      {structured.length > 0 && <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>{structured.map((c, i) => <li key={i} style={liStyle}>{c.label}</li>)}</ul>}
      {fuzzy.length > 0 && (
        <>
          <div style={{ fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>Possibly (best-effort scan of formulas / code):</div>
          <ul style={{ margin: '2px 0 0', paddingInlineStart: 18 }}>{fuzzy.map((c, i) => <li key={i} style={liStyle}>{c.label}</li>)}</ul>
        </>
      )}
      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>ℹ Custom formulas/code and raw imported blocks aren't fully scanned.</div>
    </div>
  );
}

// ---- type-specific config editors ----------------------------------------
// `set` patches type_config; `setField` patches field-level props (e.g. the
// field_type that a merged-palette toggle switches between).
function TypeConfig({ field, set, setField, fieldOptions = [] }) {
  const c = field.type_config || {};
  switch (field.field_type) {
    case 'date':
    case 'time':
      return <DateTimeConfig field={field} set={set} setField={setField} />;
    case 'checkbox':
    case 'toggle':
      return <BooleanConfig field={field} setField={setField} />;
    case 'number':
      return (
        <>
          <Check label="Allow negative" checked={c.allow_negative} onChange={(v) => set({ allow_negative: v })} />
          <Field label="Decimal scale"><input type="number" value={c.decimal_scale ?? 0} onChange={(e) => set({ decimal_scale: Number(e.target.value) })} /></Field>
          <Field label="Prefix"><input type="text" value={c.prefix || ''} onChange={(e) => set({ prefix: e.target.value })} /></Field>
          <Field label="Suffix"><input type="text" value={c.suffix || ''} onChange={(e) => set({ suffix: e.target.value })} /></Field>
        </>
      );
    case 'textarea':
      return <Field label="Rows"><input type="number" value={c.rows ?? 2} onChange={(e) => set({ rows: Number(e.target.value) })} /></Field>;
    case 'upload':
      return (
        <>
          <Check label="Allow multiple files" checked={c.multiple !== false} onChange={(v) => set({ multiple: v })} />
        </>
      );
    case 'dropdown_fixed':
    case 'tags_fixed':
    case 'dropdown_async':
    case 'tags_async':
      return <DropdownConfig field={field} set={set} setField={setField} fieldOptions={fieldOptions} />;
    case 'spectrometer':
      return (
        <>
          <Field label="Reading endpoint URL" hint="spectrometer device / API endpoint"><input type="text" value={c.url || ''} onChange={(e) => set({ url: e.target.value })} /></Field>
          <Field label="Elements" hint='comma-separated symbols, e.g. "C,Si,Mn,P,S"'><input type="text" value={c.elements || ''} onChange={(e) => set({ elements: e.target.value })} /></Field>
          <Field label="Columns per row"><input type="number" value={c.columns_per_row ?? 4} onChange={(e) => set({ columns_per_row: Number(e.target.value) })} /></Field>
          <Check label="Show connection status" checked={c.show_connection_status !== false} onChange={(v) => set({ show_connection_status: v })} />
        </>
      );
    case 'chips':
      return (
        <>
          <Check label="Allow duplicate values" checked={!!c.allow_duplicates} onChange={(v) => set({ allow_duplicates: v })} />
          <Field label="Max chips" hint="0 = unlimited"><input type="number" value={c.max_chips ?? 0} onChange={(e) => set({ max_chips: Number(e.target.value) })} /></Field>
        </>
      );
    case 'computed':
      return (
        <>
          <Field label="Calculate">
            <select value={c.op || 'sum'} onChange={(e) => set({ op: e.target.value })}>
              {['sum', 'avg', 'min', 'max', 'count'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Of these fields" hint="comma-separated dataKeys, e.g. mould__a, mould__b">
            <input type="text" value={(c.source_fields || []).join(', ')} onChange={(e) => set({ source_fields: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </Field>
          <Field label="…or a formula" hint='overrides the above, e.g. form.data.qty * form.data.rate'>
            <input type="text" value={c.expression || ''} onChange={(e) => set({ expression: e.target.value })} />
          </Field>
        </>
      );
    default:
      return null;
  }
}

// Merged "Dropdown": one entry covers the 4 internal types. Source (Fixed list /
// External master data) + Allow multiple toggle the underlying field_type via
// fieldKind; the relevant editor (options vs entity config) renders below. The
// dataKey is identical across all four, so toggling never breaks references.
function DropdownConfig({ field, set, setField, fieldOptions }) {
  const c = field.type_config || {};
  const { source, multiple } = dropdownVariant(field.field_type);
  const change = (patch) => setField({ field_type: dropdownType({ source, multiple, ...patch }) });
  return (
    <>
      <Field label="Source" hint="A fixed list you define, or External master data fetched from an API.">
        <select value={source} onChange={(e) => change({ source: e.target.value })}>
          <option value="fixed">Fixed list</option>
          <option value="external">External (master data)</option>
        </select>
      </Field>
      <Check label="Allow multiple" checked={multiple} onChange={(v) => change({ multiple: v })} />
      {source === 'external'
        ? <AsyncConfig c={c} set={set} fieldOptions={fieldOptions} field={field} />
        : <FixedConfig c={c} set={set} />}
    </>
  );
}

// Fixed dropdown: typed options (travel in the template) OR a referenced
// per-customer list (only the list key travels; values are set in template
// config and loaded at render — empty until configured).
function FixedConfig({ c, set }) {
  const isList = c.options_source === 'list';
  return (
    <>
      <Field label="Options" hint="Typed: values live in this template. Referenced list: curated per-customer values set in template config — only the list key travels, so copying the template never copies values.">
        <select value={c.options_source || 'inline'} onChange={(e) => set({ options_source: e.target.value })}>
          <option value="inline">Typed options</option>
          <option value="list">Referenced list (per-customer)</option>
        </select>
      </Field>
      {isList
        ? <Field label="List key" hint="The entity_id this field reads from /static-lists. Values load at render; empty dropdown until configured for the customer.">
            <input type="text" value={c.entity_id || ''} placeholder="e.g. casting_grade" onChange={(e) => set({ entity_id: e.target.value })} />
          </Field>
        : <OptionsEditor options={c.options || []} onChange={(options) => set({ options })} />}
    </>
  );
}

// Merged "Checkbox / Toggle": same yes/no field, choose how it renders.
function BooleanConfig({ field, setField }) {
  return (
    <Field label="Display as">
      <select value={booleanDisplay(field.field_type)} onChange={(e) => setField({ field_type: booleanType(e.target.value) })}>
        <option value="checkbox">Checkbox</option>
        <option value="toggle">Toggle</option>
      </select>
    </Field>
  );
}

// Merged "Date / Time": Mode picks Date / Date+Time / Time. Date & Date+Time are
// the `date` type (enable_time differs); Time is the `time` type.
function DateTimeConfig({ field, set, setField }) {
  const c = field.type_config || {};
  const mode = dateMode(field);
  const change = (m) => {
    const next = dateTypeFor(m);
    if (next.field_type !== field.field_type) setField({ field_type: next.field_type });
    if (next.field_type === 'date') set({ enable_time: next.enable_time });
  };
  return (
    <>
      <Field label="Mode">
        <select value={mode} onChange={(e) => change(e.target.value)}>
          <option value="date">Date</option>
          <option value="datetime">Date + Time</option>
          <option value="time">Time</option>
        </select>
      </Field>
      {field.field_type === 'date' ? (
        <>
          <Check label="Auto-fill today on mount" checked={c.auto_fill_today} onChange={(v) => set({ auto_fill_today: v })} />
          <Field label="Format" hint={c.enable_time ? 'Time (HH:mm) is added automatically.' : undefined}>
            <select value={c.format || 'dd-MM-yyyy'} onChange={(e) => set({ format: e.target.value })}>
              {DATE_FORMATS.map((val) => <option key={val} value={val}>{val.toLowerCase()}</option>)}
              {c.format && !DATE_FORMATS.includes(c.format) && <option value={c.format}>{c.format.toLowerCase()} (custom)</option>}
            </select>
          </Field>
        </>
      ) : (
        <>
          <Check label="Auto-derive shift from time" checked={c.auto_derive_shift} onChange={(v) => set({ auto_derive_shift: v })} />
          {c.auto_derive_shift && <Field label="Shift target dataKey"><input type="text" value={c.shift_target_key || 'shift'} onChange={(e) => set({ shift_target_key: e.target.value })} /></Field>}
        </>
      )}
    </>
  );
}

// Master-data dropdown config: basic choices on the right panel (entity +
// search/display field), a "Configure…" button for the full popup (filters +
// auto-fill), and a raw-value Advanced disclosure so power is never hidden.
function AsyncConfig({ c, set, fieldOptions, field }) {
  // Base key for "save with this field" auto-keys (see engine/autofill.js).
  const baseKey = dropdownBaseKey(field);
  const [open, setOpen] = useState(false);
  const entity = getEntity(c.entity_id);
  const nFilters = (c.filters || []).length;
  const nFill = (c.on_select_populate || []).length;
  return (
    <>
      <Field label="Entity (master data)">
        <select value={c.entity_id || ''} onChange={(e) => set({ entity_id: e.target.value })}>
          <option value="">Select an entity…</option>
          {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
          {c.entity_id && !entity && <option value={c.entity_id}>{c.entity_id} (custom)</option>}
        </select>
      </Field>
      <Field label="Search / display field">
        {entity ? (
          <select value={c.search_fields || ''} onChange={(e) => set({ search_fields: e.target.value })}>
            <option value="">Select a field…</option>
            {entity.fields.map((fl) => <option key={fl.key} value={fl.key}>{fl.label}</option>)}
            {c.search_fields && !entity.fields.some((fl) => fl.key === c.search_fields) && <option value={c.search_fields}>{c.search_fields} (custom)</option>}
          </select>
        ) : (
          <input type="text" value={c.search_fields || ''} placeholder="field name (e.g. name)" onChange={(e) => set({ search_fields: e.target.value })} />
        )}
      </Field>
      <button className="mini block" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>⚙ Configure filters &amp; auto-fill…</button>
      {(nFilters || nFill) ? <div className="key" style={{ marginTop: 4 }}>{nFilters} filter{nFilters === 1 ? '' : 's'} · {nFill} auto-fill</div> : null}
      <details className="advanced" style={{ marginTop: 8 }}>
        <summary>Advanced (raw)</summary>
        <Field label="Entity ID"><input type="text" value={c.entity_id || ''} onChange={(e) => set({ entity_id: e.target.value })} /></Field>
        <Field label="Search field"><input type="text" value={c.search_fields || ''} onChange={(e) => set({ search_fields: e.target.value })} /></Field>
      </details>
      {open && <EntityConfigModal value={c} fieldOptions={fieldOptions} baseKey={baseKey} onChange={(patch) => set(patch)} onClose={() => setOpen(false)} />}
    </>
  );
}

function OptionsEditor({ options, onChange }) {
  return (
    <Field label="Options">
      {options.map((o, i) => (
        <div className="inline" key={i} style={{ marginBottom: 4 }}>
          <input type="text" placeholder="label" value={o.label} onChange={(e) => { const n = [...options]; n[i] = { ...o, label: e.target.value }; onChange(n); }} />
          <input type="text" placeholder="value" value={o.value} onChange={(e) => { const n = [...options]; n[i] = { ...o, value: e.target.value }; onChange(n); }} />
          <button className="mini danger" onClick={() => onChange(options.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="mini" onClick={() => onChange([...options, { label: '', value: '' }])}>+ Option</button>
    </Field>
  );
}

// ---- table config editor ---------------------------------------------------
function TableEditor({ section, dispatch }) {
  const cfg = section.table_config;
  const setCfg = (patch) => dispatch({ type: 'SET_TABLE_CONFIG', sectionId: section.id, config: { ...cfg, ...patch } });
  const setCol = (i, patch) => { const cols = cfg.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)); setCfg({ columns: cols }); };

  const fixed = cfg.row_mode === 'fixed';
  return (
    <>
      <Field label="Rows" hint={fixed ? 'A static number of rows (no add/remove).' : 'Users can add/remove rows.'}>
        <select value={cfg.row_mode || 'dynamic'} onChange={(e) => setCfg({ row_mode: e.target.value })}>
          <option value="dynamic">Dynamic (add / remove rows)</option>
          <option value="fixed">Fixed (static rows)</option>
        </select>
      </Field>

      {fixed ? (
        <Field label="Number of rows"><input type="number" value={cfg.fixed_rows ?? 3} onChange={(e) => setCfg({ fixed_rows: Number(e.target.value) })} /></Field>
      ) : (
        <>
          <div className="row3">
            <div className="row3-cell"><label className="fld">Start with</label><input type="number" value={cfg.initial_rows ?? 1} onChange={(e) => setCfg({ initial_rows: Number(e.target.value) })} /></div>
            <div className="row3-cell"><label className="fld">Min rows</label><input type="number" min={0} value={cfg.min_rows ?? 1} onChange={(e) => setCfg({ min_rows: Number(e.target.value) })} /></div>
            <div className="row3-cell"><label className="fld">Max rows</label><input type="number" value={cfg.max_rows} onChange={(e) => setCfg({ max_rows: Number(e.target.value) })} /></div>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>Rows shown initially · minimum kept · maximum allowed.</div>
          <Field label="Add-row button label"><input type="text" value={cfg.add_row_label ?? '+ Add Row'} onChange={(e) => setCfg({ add_row_label: e.target.value })} /></Field>
        </>
      )}

      <label className="fld">Columns <span className="hint">(each column is a field — pick its type)</span></label>
      {cfg.columns.map((col, i) => {
        const setColCfg = (patch) => setCol(i, { type_config: { ...(col.type_config || {}), ...patch } });
        return (
          <div className="col-editor" key={col.key}>
            <div className="inline">
              <input type="text" placeholder="Header shown to user" value={col.header} onChange={(e) => setCol(i, { header: e.target.value })} />
              <button className="mini" disabled={i === 0} onClick={() => { const c = [...cfg.columns]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; setCfg({ columns: c }); }}>↑</button>
              <button className="mini" disabled={i === cfg.columns.length - 1} onClick={() => { const c = [...cfg.columns]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; setCfg({ columns: c }); }}>↓</button>
              <button className="mini danger" onClick={() => setCfg({ columns: cfg.columns.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <select value={col.field_type} onChange={(e) => setCol(i, { field_type: e.target.value })}>
              {COLUMN_TYPES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </select>
            <div className="inline" style={{ marginTop: 6 }}>
              <input type="text" placeholder="key suffix (e.g. char)" value={col.dataKey_suffix} onChange={(e) => setCol(i, { dataKey_suffix: e.target.value })} />
              <input type="number" placeholder="width %" style={{ width: 80 }} value={col.width_percent} onChange={(e) => setCol(i, { width_percent: Number(e.target.value) })} />
            </div>
            <div className="inline" style={{ marginTop: 6, gap: 16 }}>
              <label className="inline">
                <input type="checkbox" checked={!!col.required} onChange={(e) => setCol(i, { required: e.target.checked })} />
                <span style={{ fontSize: 12 }}>Required</span>
              </label>
              {col.field_type !== 'checkbox' && col.field_type !== 'toggle' && (
                <label className="inline" title="Value must be unique across all rows in this column">
                  <input type="checkbox" checked={!!col.unique} onChange={(e) => setCol(i, { unique: e.target.checked })} />
                  <span style={{ fontSize: 12 }}>Unique</span>
                </label>
              )}
            </div>

            <Field label="Summary (under the table)" hint="Aggregate this column across all rows.">
              <select value={col.summary || ''} onChange={(e) => setCol(i, { summary: e.target.value })}>
                <option value="">— none —</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
                <option value="count">Count</option>
                <option value="product">Product (multiply)</option>
              </select>
            </Field>

            {(col.field_type === 'dropdown_fixed' || col.field_type === 'tags_fixed') && (
              <OptionsEditor options={col.type_config?.options || []} onChange={(options) => setColCfg({ options })} />
            )}
            {(col.field_type === 'dropdown_async' || col.field_type === 'tags_async') && (
              <>
                <Field label="Entity (master data) ID" hint="e.g. casting_master"><input type="text" value={col.type_config?.entity_id || ''} onChange={(e) => setColCfg({ entity_id: e.target.value })} /></Field>
                <Field label="Search field"><input type="text" value={col.type_config?.search_fields || ''} onChange={(e) => setColCfg({ search_fields: e.target.value })} /></Field>
              </>
            )}

            <div className="key">{section.container_name || 'table'}[ ].{col.dataKey_suffix || '?'}</div>
          </div>
        );
      })}
      <button className="mini" style={{ marginTop: 6 }} onClick={() => setCfg({ columns: [...cfg.columns, createColumn(cfg.columns.length + 1)] })}>+ Column</button>

      {cfg.columns.some((c) => c.summary) && (
        <div style={{ marginTop: 10 }}>
          <Check label="Show totals row under the table" checked={!!cfg.show_totals} onChange={(v) => setCfg({ show_totals: v })} />
          <div className="hint">Totals are always computed &amp; saved; this only controls whether the row is visible.</div>
        </div>
      )}
    </>
  );
}

// ---- section properties ----------------------------------------------------
function SectionProps({ section, state, dispatch, refIndex }) {
  const others = siblingNames(state.sections, section.id) || [];
  const nameErr = validateContainerName(section.container_name, others.filter((n) => n !== section.container_name));
  const upd = (patch) => dispatch({ type: 'UPDATE_SECTION', sectionId: section.id, patch });

  const isTable = section.type === 'table';
  return (
    <>
      <div className="prop-head">
        <span className="title"><span className="ico"><Icon name={isTable ? 'nested' : 'heading'} size={16} /></span>{isTable ? 'Table' : 'Section'}</span>
        {section.container_name && <span className="kind">{section.container_name}</span>}
      </div>
      <div className="prop-body">
        <Field label="Position" hint="Move this section up or down.">
          <div className="inline" style={{ gap: 6 }}>
            <button className="mini" onClick={() => dispatch({ type: 'MOVE_SECTION', sectionId: section.id, dir: -1 })}>↑ Up</button>
            <button className="mini" onClick={() => dispatch({ type: 'MOVE_SECTION', sectionId: section.id, dir: 1 })}>Down ↓</button>
          </div>
        </Field>
        <Field label="Title" hint="Heading shown above this section.">
          <input type="text" value={section.label || ''} placeholder="e.g. Moulding Details" onChange={(e) => upd({ label: e.target.value || null })} />
        </Field>
        <Field label="Name" hint="Lowercase id used in the data keys.">
          <input type="text" value={section.container_name} placeholder="e.g. moulding" onChange={(e) => upd({ container_name: e.target.value })} />
          {nameErr && <div className="err">{nameErr}</div>}
          {section._effPrefix && <div className="key" style={{ marginTop: 4 }}>{isTable ? section._effPrefix + '[ ]' : section._effPrefix + '__‹field›'}</div>}
          <KeyUsageWarning refIndex={refIndex} keys={subtreeKeys(state, section.id)} />
        </Field>
        <Check label="Show the title" checked={section.show_header} onChange={(v) => upd({ show_header: v })} />

        <Field label="Layout">
          <select value={isTable ? 'table' : 'standard'} onChange={(e) => {
            if (e.target.value === 'table') dispatch({ type: 'SET_TABLE_CONFIG', sectionId: section.id, config: section.table_config || createTableConfig('standard') });
            else dispatch({ type: 'SET_SECTION_TYPE', sectionId: section.id, tableType: null });
          }}>
            <option value="standard">Fields (a form section)</option>
            <option value="table">Table (repeating rows)</option>
          </select>
        </Field>

        {isTable && section.table_config
          ? <TableEditor section={section} dispatch={dispatch} />
          : (
            <>
              <Field label="Field layout" hint="Horizontal places fields side by side; Vertical stacks them.">
                <select value={section.layout_orientation || 'horizontal'} onChange={(e) => upd({ layout_orientation: e.target.value })}>
                  <option value="horizontal">Horizontal (side by side)</option>
                  <option value="vertical">Vertical (stacked)</option>
                </select>
              </Field>
              {(section.layout_orientation || 'horizontal') === 'horizontal' && (
                <Field label="Columns per row">
                  <select value={section.fields_per_row || 2} onChange={(e) => upd({ fields_per_row: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} per row</option>)}
                  </select>
                </Field>
              )}
            </>
          )}

        <button className="block" style={{ marginTop: 14, height: 38, borderStyle: 'dashed', gap: 7 }} onClick={() => dispatch({ type: 'ADD_SUBCONTAINER', parentId: section.id })}><Icon name="nested" size={15} /> Add nested group</button>

        <label className="fld">Show this section when…</label>
        <RenderWhenEditor
          value={section.render_when}
          onChange={(rw) => upd({ render_when: rw })}
          fieldOptions={referenceableKeys(state, null).filter((o) => o.group !== section.container_name)}
        />

        <details className="advanced">
          <summary>Advanced</summary>
          <Field label="Custom CSS" hint="Raw CSS layered onto this container, on top of the theme. e.g. background:#fff7e6; or .rs-input{border-color:#e43e2b;}">
            <textarea
              rows={4} spellCheck={false} placeholder="background:#fafafa; border:1px solid #eee;"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              value={section.custom_css || ''}
              onChange={(e) => upd({ custom_css: e.target.value })}
            />
          </Field>
        </details>
      </div>
    </>
  );
}

// ---- field properties ------------------------------------------------------
// Reorder the selected field within its section — lives in the panel (not on
// the canvas chip) so it's easy to find and the highlighted chip is easy to
// track as it moves. Left/right (±1) + up/down a row (±perRow) in a grid; just
// up/down when stacked.
function PositionControl({ section, field, dispatch }) {
  const fields = section.fields || [];
  const idx = fields.findIndex((f) => f.id === field.id);
  const total = fields.length;
  if (idx < 0 || total < 2) return null;
  const perRow = (section.layout_orientation || 'horizontal') === 'vertical' ? 1 : (section.fields_per_row || 2);
  const grid = perRow > 1;
  const move = (dir) => dispatch({ type: 'MOVE_FIELD', sectionId: section.id, fieldId: field.id, dir });
  return (
    <Field label="Position" hint="Move this field within the section.">
      <div className="inline" style={{ gap: 6, flexWrap: 'wrap' }}>
        {grid ? (
          <>
            <button className="mini" disabled={idx === 0} onClick={() => move(-1)}>← Left</button>
            <button className="mini" disabled={idx === total - 1} onClick={() => move(1)}>Right →</button>
            <button className="mini" disabled={idx < perRow} onClick={() => move(-perRow)}>↑ Up</button>
            <button className="mini" disabled={idx + perRow >= total} onClick={() => move(perRow)}>Down ↓</button>
          </>
        ) : (
          <>
            <button className="mini" disabled={idx === 0} onClick={() => move(-1)}>↑ Up</button>
            <button className="mini" disabled={idx === total - 1} onClick={() => move(1)}>Down ↓</button>
          </>
        )}
      </div>
    </Field>
  );
}

function FieldProps({ section, field, dispatch, fieldOptions, refIndex }) {
  const upd = (patch) => dispatch({ type: 'UPDATE_FIELD', sectionId: section.id, fieldId: field.id, patch });
  const setCfg = (patch) => dispatch({ type: 'UPDATE_FIELD_CONFIG', sectionId: section.id, fieldId: field.id, patch });
  const isDisplay = field.field_type === 'header' || field.field_type === 'divider';

  return (
    <>
      <div className="prop-head">
        <span className="title"><span className="ico"><Icon name={iconName(field.field_type)} size={16} /></span>{typeLabel(field.field_type)} field</span>
        <span className="kind">{typeLabel(field.field_type)}</span>
      </div>
      <div className="prop-body">
        {field._raw && <div className="tag" style={{ marginBottom: 8, color: '#92400e' }}>⚠ Imported field — exports verbatim. Editing label re-derives its key.</div>}

        <PositionControl section={section} field={field} dispatch={dispatch} />

        {field.field_type !== 'divider' && (
          <Field label="Label" hint="Shown above the field."><input type="text" value={field.label || ''} onChange={(e) => upd({ label: e.target.value })} /></Field>
        )}

        {!isDisplay && (
          <>
            {/* Key — the dataKey other rules reference. Surfaced in Basic (right
                under the label) so it's discoverable; manual override kept. */}
            <Field label="Key" hint="Auto-derived from the label. Other rules reference this.">
              <div className="datakey">{field.dataKey || '—'}</div>
              <label className="inline" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={!!field._dataKeyOverridden} onChange={(e) => { if (!e.target.checked) upd({ dataKey: '', _dataKeyOverridden: false, label: field.label }); else upd({ dataKey: field.dataKey }); }} />
                <span style={{ fontSize: 12 }}>Override manually</span>
              </label>
              {field._dataKeyOverridden && <input type="text" style={{ marginTop: 4 }} value={field.dataKey} onChange={(e) => upd({ dataKey: e.target.value })} />}
              <KeyUsageWarning refIndex={refIndex} keys={[field.dataKey]} />
            </Field>

            <Check label="Required" checked={field.required} onChange={(v) => upd({ required: v })} />
            <Field label="Placeholder"><input type="text" value={field.placeholder || ''} onChange={(e) => upd({ placeholder: e.target.value || null })} /></Field>

            <TypeConfig field={field} set={setCfg} setField={upd} fieldOptions={fieldOptions} />

            <label className="fld">Show this field when…</label>
            <RenderWhenEditor value={field.render_when} onChange={(rw) => upd({ render_when: rw })} fieldOptions={fieldOptions} />

            <label className="fld">Default value (on open)</label>
            <DefaultValueEditor value={field.default_value} onChange={(dv) => upd({ default_value: dv })} fieldOptions={fieldOptions} />

            <label className="fld">Validation rules</label>
            <ValidationsEditor value={field.validations} onChange={(vs) => upd({ validations: vs })} fieldOptions={fieldOptions} />

            <details className="advanced">
              <summary>Advanced</summary>

              <div className="inline">
                <div style={{ flex: 1 }}>
                  <Field label="Width">
                    <select value={field.width_override || ''} onChange={(e) => upd({ width_override: e.target.value || null })}>
                      <option value="">auto</option>
                      {WIDTHS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Align">
                    <select value={field.align || ''} onChange={(e) => upd({ align: e.target.value || null })}>
                      <option value="">Left</option>
                      <option value="left">⟸ Left</option>
                      <option value="center">⟺ Center</option>
                      <option value="right">⟹ Right</option>
                    </select>
                  </Field>
                </div>
              </div>

              <Check label="Disabled" checked={field.disabled} onChange={(v) => upd({ disabled: v })} />
              <Check label="Read only" checked={field.read_only} onChange={(v) => upd({ read_only: v })} />

              <Field label="Field name (override)" hint="Auto-derived from the label. Drives the key above.">
                <input type="text" value={field.field_name} onChange={(e) => upd({ field_name: e.target.value })} />
              </Field>

              <Field label="Special prefix">
                <select value={field.special_prefix || ''} onChange={(e) => upd({ special_prefix: e.target.value || null })}>
                  <option value="">none ({section.container_name}__)</option>
                  <option value="disabled__">disabled__ (read-only, auto-populated)</option>
                  <option value="meta__">meta__ (hidden metadata)</option>
                  <option value="derived__">derived__ (computed display)</option>
                </select>
              </Field>

              <Field label="Custom CSS" hint="Raw CSS layered onto this field, on top of the theme. e.g. .rs-input{border-color:#e43e2b;}">
                <textarea
                  rows={3} spellCheck={false} placeholder=".rs-input{background:#fff7e6;}"
                  style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                  value={field.custom_css || ''}
                  onChange={(e) => upd({ custom_css: e.target.value })}
                />
              </Field>
            </details>
          </>
        )}
      </div>
    </>
  );
}

// Referenceable keys (real field keys + virtual dropdown/auto-fill keys, grouped)
// now come from keyGraph.referenceableKeys — see PropertyPanel/SectionProps.

function RenderWhenEditor({ value, onChange, fieldOptions }) {
  const rw = value || { mode: 'always', field: '', operator: 'equals', value: '' };
  const set = (patch) => onChange({ ...rw, ...patch });
  const noValue = ['is_empty', 'is_not_empty'].includes(rw.operator);

  return (
    <>
      <select value={rw.mode} onChange={(e) => onChange(e.target.value === 'always' ? null : { ...rw, mode: 'condition' })}>
        <option value="always">Always show</option>
        <option value="condition">Show only when…</option>
      </select>
      {rw.mode === 'condition' && (
        <div className="col-editor">
          <label className="fld" style={{ marginTop: 0 }}>Field</label>
          <KeyPicker value={rw.field} onChange={(k) => set({ field: k })} options={fieldOptions} placeholder="— pick a field —" />

          <select style={{ marginTop: 4 }} value={rw.operator} onChange={(e) => set({ operator: e.target.value })}>
            <option value="equals">equals</option><option value="not_equals">not equals</option>
            <option value="is_empty">is empty</option><option value="is_not_empty">is not empty</option>
            <option value="greater_than">greater than</option><option value="less_than">less than</option>
          </select>
          {!noValue && <input type="text" style={{ marginTop: 4 }} placeholder="value" value={rw.value} onChange={(e) => set({ value: e.target.value })} />}
          {rw.field && <div className="key" style={{ marginTop: 4 }}>uses form.data.{rw.field}</div>}
        </div>
      )}
    </>
  );
}

// Default value on open — auto-fill today/now/user/fixed/another field.
function DefaultValueEditor({ value, onChange, fieldOptions }) {
  const dv = value || { mode: 'none', value: '', source_field: '' };
  const set = (patch) => { const next = { ...dv, ...patch }; onChange(next.mode === 'none' ? null : next); };
  return (
    <>
      <select value={dv.mode} onChange={(e) => set({ mode: e.target.value })}>
        <option value="none">No default</option>
        <option value="today">Today (date)</option>
        <option value="now">Now (time)</option>
        <option value="datetime">Now (date + time)</option>
        <option value="user">Current user</option>
        <option value="fixed">Fixed value…</option>
        <option value="from_field">Copy from another field…</option>
      </select>
      {dv.mode === 'fixed' && <input type="text" style={{ marginTop: 4 }} placeholder="value" value={dv.value} onChange={(e) => set({ value: e.target.value })} />}
      {dv.mode === 'from_field' && (
        <div style={{ marginTop: 4 }}>
          <KeyPicker value={dv.source_field} onChange={(k) => set({ source_field: k })} options={fieldOptions} placeholder="— pick a field —" />
        </div>
      )}
    </>
  );
}

const VAL_TYPES = [['min_value', 'Min value'], ['max_value', 'Max value'], ['between', 'Between'], ['compare_field', 'Compare to field'], ['required_when', 'Required when'], ['code', 'Custom code']];
// Validation rules beyond "Required" (which is the checkbox above).
function ValidationsEditor({ value, onChange, fieldOptions }) {
  const required = (value || []).filter((v) => v.type === 'required');
  const list = (value || []).filter((v) => v.type !== 'required');
  const commit = (next) => onChange([...required, ...next]);
  const add = () => commit([...list, { type: 'min_value' }]);
  const setRow = (i, patch) => commit(list.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const del = (i) => commit(list.filter((_, j) => j !== i));
  return (
    <>
      {list.map((v, i) => (
        <div className="col-editor" key={i}>
          <div className="inline">
            <select value={v.type} onChange={(e) => setRow(i, { type: e.target.value })}>
              {VAL_TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            </select>
            <button className="mini danger" onClick={() => del(i)}>✕</button>
          </div>
          {(v.type === 'min_value' || v.type === 'max_value') && <input type="number" style={{ marginTop: 4 }} placeholder="bound" value={v.value ?? ''} onChange={(e) => setRow(i, { value: e.target.value })} />}
          {v.type === 'between' && (
            <div className="inline" style={{ marginTop: 4 }}>
              <input type="number" placeholder="min" value={v.min ?? ''} onChange={(e) => setRow(i, { min: Number(e.target.value) })} />
              <input type="number" placeholder="max" value={v.max ?? ''} onChange={(e) => setRow(i, { max: Number(e.target.value) })} />
            </div>
          )}
          {v.type === 'compare_field' && (
            <div className="inline" style={{ marginTop: 4 }}>
              <select value={v.op || '>'} onChange={(e) => setRow(i, { op: e.target.value })}>{['>', '<', '>=', '<=', '==', '!='].map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <div style={{ flex: 1 }}><KeyPicker value={v.other_field || ''} onChange={(k) => setRow(i, { other_field: k })} options={fieldOptions} placeholder="— field —" /></div>
            </div>
          )}
          {v.type === 'required_when' && <input type="text" style={{ marginTop: 4 }} placeholder="form.data.<key> condition" value={v.validate_when || ''} onChange={(e) => setRow(i, { validate_when: e.target.value })} />}
          {v.type === 'code' && <input type="text" style={{ marginTop: 4 }} placeholder="return <bool>" value={v.code || ''} onChange={(e) => setRow(i, { code: e.target.value })} />}
          <input type="text" style={{ marginTop: 4 }} placeholder="error message (optional)" value={v.message || ''} onChange={(e) => setRow(i, { message: e.target.value })} />
        </div>
      ))}
      <button className="mini" style={{ marginTop: 4 }} onClick={add}>+ Validation</button>
    </>
  );
}

export default function PropertyPanel({ state, dispatch, section, fieldId, refIndex }) {
  if (!section) {
    return (
      <div className="panel panel-right">
        <div className="empty">
          <Icon name="empty" size={34} stroke={1.3} />
          <div>Select a section or field to edit its properties.</div>
        </div>
      </div>
    );
  }
  const field = fieldId ? section.fields.find((f) => f.id === fieldId) : null;
  const fieldOptions = field ? referenceableKeys(state, field.id) : [];
  return (
    <div className="panel panel-right">
      {field
        ? <FieldProps section={section} field={field} dispatch={dispatch} fieldOptions={fieldOptions} refIndex={refIndex} />
        : <SectionProps section={section} state={state} dispatch={dispatch} refIndex={refIndex} />}
    </div>
  );
}
