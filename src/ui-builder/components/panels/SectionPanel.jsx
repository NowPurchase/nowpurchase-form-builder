import React from 'react';
import { validateContainerName } from '../../engine/dataKey.js';
import Icon from '../Icon.jsx';

function Node({ node, siblings, depth, state, dispatch, selSection, setSelSection, setSelField }) {
  const err = validateContainerName(node.container_name, siblings.filter((n) => n !== node.container_name));
  const active = node.id === selSection;
  const kids = node.children || [];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <>
      <div
        className={`sec-item ${active ? 'active' : ''}`}
        style={depth ? { marginLeft: depth * 12 } : undefined}
        onClick={() => { setSelSection(node.id); setSelField(null); }}
      >
        <div className="row">
          <span className="name">{depth > 0 ? '↳ ' : ''}{node.container_name || <em style={{ color: 'var(--faint)' }}>unnamed</em>}</span>
          <div className="spacer" />
          <div className="controls">
            <button className="iconbtn" title="Add nested group" onClick={stop(() => dispatch({ type: 'ADD_SUBCONTAINER', parentId: node.id }))}><Icon name="nested" size={13} stroke={1.7} /></button>
            <button className="iconbtn del" title="Remove" onClick={stop(() => { dispatch({ type: 'REMOVE_SECTION', sectionId: node.id }); if (active) setSelSection(null); })}><Icon name="x" size={13} stroke={1.8} /></button>
          </div>
        </div>
        <div className="meta">
          {node.type === 'table' ? 'table' : 'standard'} · {node.fields.length} field{node.fields.length === 1 ? '' : 's'}
          {kids.length ? ` · ${kids.length} sub` : ''}
        </div>
        {err && <div className="err">{err}</div>}
      </div>
      {kids.map((c) => (
        <Node
          key={c.id} node={c} siblings={kids.map((k) => k.container_name).filter(Boolean)} depth={depth + 1}
          state={state} dispatch={dispatch} selSection={selSection} setSelSection={setSelSection} setSelField={setSelField}
        />
      ))}
    </>
  );
}

export default function SectionPanel({ state, dispatch, selSection, setSelSection, setSelField }) {
  const topNames = state.sections.map((s) => s.container_name).filter(Boolean);
  const fieldCount = state.sections.reduce((n, s) => n + s.fields.length, 0);
  return (
    <div className="panel panel-left">
      <div className="list-head">
        <span className="t">SECTIONS</span>
        <span className="c">{state.sections.length} · {fieldCount} field{fieldCount === 1 ? '' : 's'}</span>
      </div>
      <div className="section-list">
        {state.sections.length === 0 && <div className="hint" style={{ padding: '0 4px 4px' }}>No sections yet. Add one below.</div>}
        {state.sections.map((s) => (
          <Node
            key={s.id} node={s} siblings={topNames} depth={0}
            state={state} dispatch={dispatch} selSection={selSection} setSelSection={setSelSection} setSelField={setSelField}
          />
        ))}
        <button className="add-section" onClick={() => dispatch({ type: 'ADD_SECTION' })}>
          <Icon name="plus" size={14} stroke={1.8} /> Add Section
        </button>
      </div>
    </div>
  );
}
