import React, { useReducer, useState, useMemo } from 'react';
import { reducer, initialState, findNode } from '../state/formState.js';
import { THEMES } from '../state/themes.js';
import { exportJSON } from '../engine/exportJSON.js';
import { importJSON } from '../engine/importJSON.js';
import { buildPreviewUrl } from '../preview-url.js';
import SectionPanel from './panels/SectionPanel.jsx';
import CanvasPanel from './panels/CanvasPanel.jsx';
import PropertyPanel from './panels/PropertyPanel.jsx';
import ChatPanel from './panels/ChatPanel.jsx';
import Icon from './Icon.jsx';

// total field count across the whole container tree (for the status bar)
function countFields(nodes) {
  return (nodes || []).reduce((n, s) => n + (s.fields?.length || 0) + countFields(s.children), 0);
}
function countSections(nodes) {
  return (nodes || []).reduce((n, s) => n + 1 + countSections(s.children), 0);
}

export default function Builder({ initialForm = null, onSaveTemplate = null, onPreview = null } = {}) {
  const [state, dispatch] = useReducer(reducer, initialForm || initialState);
  const [saving, setSaving] = useState(false);
  const [selSection, setSelSection] = useState(null);
  const [selField, setSelField] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'export' | 'import'
  const [importText, setImportText] = useState('');
  const [importErr, setImportErr] = useState('');

  const exported = useMemo(
    () => (modal === 'export' ? exportJSON(state) : null),
    [modal, state],
  );

  function doImport() {
    setImportErr('');
    try {
      const json = JSON.parse(importText);
      const next = importJSON(json);
      dispatch({ type: 'LOAD_STATE', state: next });
      setSelSection(next.sections[0]?.id || null);
      setSelField(null);
      setModal(null);
      setImportText('');
    } catch (e) {
      setImportErr(e.message);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.template_id || 'form'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const activeSection = findNode(state.sections, selSection) || null;
  const totalFields = countFields(state.sections);
  const totalSections = countSections(state.sections);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark"><Icon name="logo" size={14} /></span>
          <span className="name">DLMS Form Builder</span>
        </div>
        <div className="group">
          <input
            className="tb-input" type="text" placeholder="Form name" value={state.name}
            onChange={(e) => dispatch({ type: 'SET_META', patch: { name: e.target.value } })}
            style={{ flex: '0 1 230px', minWidth: 110 }}
          />
          <input
            className="tb-input mono" type="text" placeholder="template_id" value={state.template_id}
            onChange={(e) => dispatch({ type: 'SET_META', patch: { template_id: e.target.value } })}
            style={{ flex: '0 1 180px', minWidth: 90 }}
          />
          <div className="select-wrap" style={{ flex: '0 1 200px', minWidth: 130 }}>
            <select
              className="tb-select" style={{ width: '100%' }} value={state.theme}
              onChange={(e) => dispatch({ type: 'SET_META', patch: { theme: e.target.value } })}
              title="Theme"
            >
              {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
            </select>
            <Icon name="chevron" size={12} stroke={1.8} />
          </div>
        </div>
        <div className="tb-actions">
          <button className="iconbtn" title="Form settings" onClick={() => setModal('settings')}><Icon name="gear" size={16} stroke={1.6} /></button>
          <button className="assistant" onClick={() => setChatOpen((v) => !v)}><Icon name="spark" size={14} stroke={1.5} /> Assistant</button>
          <button onClick={() => { setModal('import'); setImportErr(''); }}>Import</button>
          <button onClick={() => (onPreview ? onPreview(exportJSON(state)) : window.open(buildPreviewUrl(window.location.origin, exportJSON(state)), '_blank', 'noopener'))}><Icon name="eye" size={14} /> Preview</button>
          <button className="primary" onClick={() => setModal('export')}><Icon name="download" size={14} /> Export JSON</button>
          {onSaveTemplate && (
            <button
              className="primary" disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onSaveTemplate(exportJSON(state), { name: state.name, template_id: state.template_id }); }
                finally { setSaving(false); }
              }}
            >
              <Icon name="download" size={14} /> {saving ? 'Saving…' : 'Save template'}
            </button>
          )}
        </div>
      </div>

      <div className="layout">
        <SectionPanel
          state={state} dispatch={dispatch}
          selSection={selSection} setSelSection={setSelSection} setSelField={setSelField}
        />
        <CanvasPanel
          state={state} dispatch={dispatch}
          selSection={selSection} setSelSection={setSelSection}
          selField={selField} setSelField={setSelField}
        />
        <PropertyPanel
          state={state} dispatch={dispatch}
          section={activeSection} fieldId={selField}
        />
      </div>

      <div className="footer">
        <span className="left">
          {activeSection
            ? `${activeSection.container_name || '—'} · ${activeSection.type} · ${activeSection.fields.length} field${activeSection.fields.length === 1 ? '' : 's'}`
            : 'No section selected'}
        </span>
        <div className="keys">
          <span>{totalSections} section{totalSections === 1 ? '' : 's'}</span>
          <span>{totalFields} field{totalFields === 1 ? '' : 's'}</span>
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          state={state} dispatch={dispatch} onClose={() => setChatOpen(false)}
          setSelSection={setSelSection} setSelField={setSelField}
          focus={{
            section: activeSection?.container_name || null,
            field: (() => { const f = activeSection?.fields?.find((x) => x.id === selField); return f ? (f.field_name || f.label || null) : null; })(),
          }}
        />
      )}

      {modal === 'export' && exported && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>Export — FormEngine JSON</b><div className="spacer" /><button onClick={() => setModal(null)}>✕</button></div>
            <pre>{JSON.stringify(exported, null, 2)}</pre>
            <div className="modal-foot">
              <button className="primary" onClick={download}>Download .json</button>
              <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(exported, null, 2))}>Copy to clipboard</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'settings' && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>Form settings · On submit</b><div className="spacer" /><button onClick={() => setModal(null)}>✕</button></div>
            <div style={{ padding: 14 }}>
              <label className="fld">On-submit code</label>
              <textarea
                rows={10}
                placeholder={'// runs when the form is submitted. `e.data` is the form data.\n// e.g. e.data.total = (Number(e.data.a)||0) + (Number(e.data.b)||0);'}
                value={state.on_submit?.code || ''}
                onChange={(e) => dispatch({ type: 'SET_META', patch: { on_submit: e.target.value.trim() ? { code: e.target.value } : null } })}
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              />
              <div className="hint">Runs when the form is submitted. Wrapped in try/catch so an error here can’t crash the form. Becomes <code>actions.onSubmit</code>.</div>
            </div>
            <div className="modal-foot">
              <button className="primary" onClick={() => setModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'import' && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>Import existing FormEngine JSON</b><div className="spacer" /><button onClick={() => setModal(null)}>✕</button></div>
            <div style={{ padding: 14 }}>
              <textarea
                rows={14} placeholder="Paste form JSON here…"
                value={importText} onChange={(e) => setImportText(e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
              />
              {importErr && <div className="err">{importErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="primary" onClick={doImport}>Load into builder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
