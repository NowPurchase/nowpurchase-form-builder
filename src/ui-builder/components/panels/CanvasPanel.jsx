import React from 'react';
import Icon from '../Icon.jsx';

// add-toolbar: grouped, consolidated palette. Each entry adds ONE representative
// internal field_type; the variant (single/multi, fixed/external, checkbox/toggle,
// date/time mode) is then chosen in the Property panel. Shift & Supervisor are no
// longer offered — build them from a Fixed dropdown / a Text field with the
// "Current user" default. (Predefined templates will cover these later.)
const PALETTE_GROUPS = [
  { title: 'Inputs', items: [
    ['text', 'Text', 'text'], ['number', 'Number', 'number'], ['date', 'Date / Time', 'date'],
    ['textarea', 'Text Area', 'textarea'], ['upload', 'File / Image', 'file'], ['spectrometer', 'Spectrometer', 'spectrometer'],
  ] },
  { title: 'Choices', items: [
    ['dropdown_fixed', 'Dropdown', 'dropdown'], ['checkbox', 'Checkbox / Toggle', 'checkbox'], ['chips', 'Free tags', 'tag'],
  ] },
  { title: 'Layout', items: [
    ['header', 'Section Title', 'heading'], ['divider', 'Divider', 'divider'],
  ] },
];
// Short label for the field-row chip. Merged families collapse to one name.
const TYPE_LABEL = {
  text: 'Text', number: 'Number', date: 'Date', time: 'Time', shift: 'Shift',
  dropdown_fixed: 'Dropdown', dropdown_async: 'Dropdown', tags_fixed: 'Dropdown', tags_async: 'Dropdown',
  checkbox: 'Checkbox', toggle: 'Toggle', textarea: 'Text Area', upload: 'File', header: 'Section Title',
  divider: 'Divider', supervisor: 'Supervisor', spectrometer: 'Spectrometer', chips: 'Free tags', computed: 'Computed',
};

// field_type → Icon glyph for the chip's icon tile.
const CHIP_ICON = {
  text: 'text', number: 'number', date: 'date', time: 'time', shift: 'shift',
  dropdown_fixed: 'dropdown', dropdown_async: 'link', tags_fixed: 'tag', tags_async: 'tag',
  checkbox: 'checkbox', toggle: 'toggle', textarea: 'textarea', upload: 'file',
  header: 'heading', divider: 'divider', supervisor: 'supervisor', spectrometer: 'spectrometer',
  chips: 'tag', computed: 'number',
};

// Clean field chip: click to select (reorder lives in the right panel for the
// selected field). A subtle ✕ appears on hover/select for quick removal.
function FieldRow({ field, active, onSelect, onRemove }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const labelled = !!(field.label || field.field_name);
  return (
    <div className={`field-chip ${active ? 'active' : ''}`} onClick={onSelect}>
      <span className="handle"><Icon name="handle" size={14} stroke={1.8} /></span>
      <span className="chip-ico"><Icon name={CHIP_ICON[field.field_type] || 'text'} size={17} stroke={1.7} /></span>
      <div className="body">
        <div className="lbl-row">
          <span className={`lbl ${labelled ? '' : 'untitled'}`}>{field.label || field.field_name || 'Untitled field'}</span>
          {field.required && <span className="req" title="Required">*</span>}
        </div>
        {field.dataKey && <div className="key">{field.dataKey}</div>}
      </div>
      <span className="type">{TYPE_LABEL[field.field_type] || field.field_type}</span>
      <button className="iconbtn del chip-del" title="Remove" onClick={stop(onRemove)}><Icon name="x" size={13} stroke={1.8} /></button>
    </div>
  );
}

// Group a section's fields into visual rows that mirror the export layout, so
// the canvas shows the real arrangement (Horizontal N-per-row vs Vertical
// stacked) without opening the preview. header/divider break to a full row.
function layoutRows(node) {
  const perRow = (node.layout_orientation || 'horizontal') === 'vertical' ? 1 : (node.fields_per_row || 2);
  const groups = [];
  let buf = [];
  const flush = () => { if (buf.length) { groups.push(buf); buf = []; } };
  (node.fields || []).forEach((f) => {
    if (f.field_type === 'header' || f.field_type === 'divider') { flush(); groups.push([f]); return; }
    buf.push(f);
    if (buf.length === perRow) flush();
  });
  flush();
  return groups;
}

function SectionCard({ node, depth, dispatch, selSection, setSelSection, selField, setSelField }) {
  const isTable = node.type === 'table';
  const imported = node.type === 'table_imported' || node.fields.some((f) => f._raw);
  const kids = node.children || [];
  const addField = (type) => (e) => { e.stopPropagation(); dispatch({ type: 'ADD_FIELD', sectionId: node.id, fieldType: type }); setSelSection(node.id); };

  return (
    <div className={`canvas-card ${depth ? 'nested' : ''}`} onClick={(e) => { e.stopPropagation(); setSelSection(node.id); }}>
      <div className="cs-head">
        <h2 className="title">{depth > 0 ? '↳ ' : ''}{node.label || node.container_name || 'Untitled section'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isTable && <span className="tb-badge">Table</span>}
          {imported && <span className="tb-badge" style={{ color: '#92400e', background: '#fef3c7' }}>Imported</span>}
          <span className="key">{node._effPrefix || node.container_name || 'name required'}</span>
        </div>
      </div>

      {isTable ? (
        <div style={{ padding: '16px 18px' }}>
          <div className="hint" style={{ marginTop: 0 }}>{node.table_config?.row_mode === 'fixed' ? 'Fixed' : 'Dynamic'} table · <code>{node.container_name}</code>[ ]{node.table_config?.row_mode === 'fixed' ? '' : ` · max ${node.table_config?.max_rows} rows`}</div>
          <table style={{ width: '100%', fontSize: 12, marginTop: 10, borderCollapse: 'collapse' }}>
            <thead><tr>{node.table_config?.columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', borderBottom: '1px solid var(--line-2)', padding: '6px 4px' }}>
                <div style={{ font: '700 12px var(--h)' }}>{c.header}</div>
                <div className="key">{c.dataKey_suffix}</div>
              </th>
            ))}</tr></thead>
          </table>
          <div className="hint">Configure columns in the right panel →</div>
        </div>
      ) : (
        <>
          <div className="field-grid">
            {node.fields.length === 0 && <div className="hint" style={{ marginTop: 0 }}>No fields yet — add one below.</div>}
            {layoutRows(node).map((group, gi) => (
              <div className="field-lyt-row" key={gi} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                {group.map((f) => (
                  <div key={f.id} style={{ flex: 1, minWidth: 0 }}>
                    <FieldRow
                      field={f} active={f.id === selField && node.id === selSection}
                      onSelect={() => { setSelSection(node.id); setSelField(f.id); }}
                      onRemove={() => { dispatch({ type: 'REMOVE_FIELD', sectionId: node.id, fieldId: f.id }); if (f.id === selField) setSelField(null); }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="palette">
            <div className="ph"><span className="t">ADD FIELD</span><span className="rule" /></div>
            {PALETTE_GROUPS.map((grp) => (
              <div className="pal-group" key={grp.title}>
                <span className="pal-group-label">{grp.title}</span>
                <div className="row">
                  {grp.items.map(([type, label, icon]) => (
                    <button key={type} title={label} onClick={addField(type)}><span className="pi"><Icon name={icon} size={15} /></span>{label}</button>
                  ))}
                  {grp.title === 'Layout' && (
                    <button title="nested group" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_SUBCONTAINER', parentId: node.id }); }}><span className="pi"><Icon name="nested" size={15} /></span>Nested Group</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {kids.map((c) => (
        <SectionCard
          key={c.id} node={c} depth={depth + 1} dispatch={dispatch}
          selSection={selSection} setSelSection={setSelSection} selField={selField} setSelField={setSelField}
        />
      ))}
    </div>
  );
}

export default function CanvasPanel({ state, dispatch, selSection, setSelSection, selField, setSelField }) {
  if (state.sections.length === 0) {
    return (
      <div className="panel-center">
        <div className="empty">
          <Icon name="empty" size={34} stroke={1.3} />
          <div>Add a section from the left to begin building.</div>
        </div>
      </div>
    );
  }
  // Show the selected top-level section (or the one containing the selection), else the first.
  const top = state.sections.find((s) => s.id === selSection)
    || state.sections.find((s) => (s.children || []).some((c) => c.id === selSection))
    || state.sections[0];
  return (
    <div className="panel-center">
      <SectionCard
        node={top} depth={0} dispatch={dispatch}
        selSection={selSection} setSelSection={setSelSection} selField={selField} setSelField={setSelField}
      />
    </div>
  );
}
