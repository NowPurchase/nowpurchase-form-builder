import React from 'react';
import Icon from '../Icon.jsx';

// add-toolbar: a few common types inline, the rest under "More".
const COMMON = [
  ['text', 'Text', 'text'], ['number', 'Number', 'number'], ['date', 'Date', 'date'],
  ['dropdown_fixed', 'Dropdown', 'dropdown'], ['checkbox', 'Checkbox', 'checkbox'], ['textarea', 'Text Area', 'textarea'],
];
const MORE = [
  ['time', 'Time', 'time'], ['shift', 'Shift', 'shift'], ['dropdown_async', 'Dropdown · Master', 'link'],
  ['tags_fixed', 'Tags', 'tag'], ['tags_async', 'Tags · Master', 'tag'], ['toggle', 'Toggle', 'toggle'],
  ['upload', 'File / Image', 'file'], ['header', 'Section Title', 'heading'], ['divider', 'Divider', 'divider'],
  ['supervisor', 'Supervisor', 'supervisor'], ['spectrometer', 'Spectrometer', 'spectrometer'],
  ['chips', 'Chips · Free tags', 'tag'],
];
const TYPE_LABEL = {
  text: 'Text', number: 'Number', date: 'Date', time: 'Time', shift: 'Shift',
  dropdown_fixed: 'Dropdown', dropdown_async: 'Dropdown · Master', tags_fixed: 'Tags', tags_async: 'Tags · Master',
  checkbox: 'Checkbox', toggle: 'Toggle', textarea: 'Text Area', upload: 'File', header: 'Section Title',
  divider: 'Divider', supervisor: 'Supervisor', spectrometer: 'Spectrometer', chips: 'Chips',
};

function FieldRow({ field, active, onSelect, onUp, onDown, onRemove }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const labelled = !!(field.label || field.field_name);
  return (
    <div className={`field-chip ${active ? 'active' : ''}`} onClick={onSelect}>
      <span className="handle"><Icon name="handle" size={14} stroke={1.8} /></span>
      <div className="body">
        <div className="lbl-row">
          <span className={`lbl ${labelled ? '' : 'untitled'}`}>{field.label || field.field_name || 'Untitled field'}</span>
          {field.required && <span className="req">required</span>}
        </div>
        {field.dataKey && <div className="key">{field.dataKey}</div>}
      </div>
      <span className="type">{TYPE_LABEL[field.field_type] || field.field_type}</span>
      <div className="controls">
        <button className="iconbtn" title="Move up" onClick={stop(onUp)}><Icon name="up" size={13} stroke={1.8} /></button>
        <button className="iconbtn" title="Move down" onClick={stop(onDown)}><Icon name="down" size={13} stroke={1.8} /></button>
        <button className="iconbtn del" title="Remove" onClick={stop(onRemove)}><Icon name="x" size={13} stroke={1.8} /></button>
      </div>
    </div>
  );
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
            {node.fields.map((f) => (
              <FieldRow
                key={f.id} field={f} active={f.id === selField && node.id === selSection}
                onSelect={() => { setSelSection(node.id); setSelField(f.id); }}
                onUp={() => dispatch({ type: 'MOVE_FIELD', sectionId: node.id, fieldId: f.id, dir: -1 })}
                onDown={() => dispatch({ type: 'MOVE_FIELD', sectionId: node.id, fieldId: f.id, dir: 1 })}
                onRemove={() => { dispatch({ type: 'REMOVE_FIELD', sectionId: node.id, fieldId: f.id }); if (f.id === selField) setSelField(null); }}
              />
            ))}
          </div>

          <div className="palette">
            <div className="ph"><span className="t">ADD FIELD</span><span className="rule" /></div>
            <div className="row">
              {COMMON.map(([type, label, icon]) => (
                <button key={type} title={label} onClick={addField(type)}><span className="pi"><Icon name={icon} size={15} /></span>{label}</button>
              ))}
              <details className="pal-more" onClick={(e) => e.stopPropagation()}>
                <summary><span className="pi-caret" style={{ display: 'flex' }}><Icon name="chevron" size={13} stroke={1.8} /></span>More</summary>
                <div className="pal-more-grid">
                  {MORE.map(([type, label, icon]) => (
                    <button key={type} title={label} onClick={addField(type)}><span className="pi"><Icon name={icon} size={14} /></span>{label}</button>
                  ))}
                  <button title="nested group" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_SUBCONTAINER', parentId: node.id }); }}><span className="pi"><Icon name="nested" size={14} /></span>Nested Group</button>
                </div>
              </details>
            </div>
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
