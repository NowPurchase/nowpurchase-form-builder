import React, { useState, useRef, useEffect } from 'react';
import { runTurn, getEndpoint } from '../../assistant/runtime.js';
import { applyToolCalls } from '../../assistant/tools.js';

export default function ChatPanel({ state, dispatch, onClose, focus, setSelSection, setSelField }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Tell me what to build — e.g. "add a section called moulding", "add a number field Total Qty to moulding", "make Heat No required", "show remarks when approved is not empty", or "use metalcloud theme".' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const mock = !getEndpoint();
  const listRef = useRef(null);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const result = await runTurn({ messages: next, state, focus });
      let assistantText = result.text || '';
      if (result.toolCalls && result.toolCalls.length) {
        const { state: nextState, messages: applied } = applyToolCalls(state, result.toolCalls);
        dispatch({ type: 'LOAD_STATE', state: nextState });
        // Make the AI's change visible: if it added a section/table, select it
        // (the canvas shows the active section); else jump to the section it touched.
        if (setSelSection) {
          if (nextState.sections.length > state.sections.length) {
            setSelSection(nextState.sections[nextState.sections.length - 1].id);
            setSelField?.(null);
          } else {
            const touched = result.toolCalls.map((c) => c.args?.section || c.args?.container_name).filter(Boolean).pop();
            const hit = touched && nextState.sections.find((s) => s.container_name === touched);
            if (hit) setSelSection(hit.id);
          }
        }
        assistantText += (assistantText ? '\n' : '') + applied.map((m) => `• ${m}`).join('\n');
      }
      setMessages((cur) => [...cur, { role: 'assistant', content: assistantText || '(no change)' }]);
    } catch (e) {
      setMessages((cur) => [...cur, { role: 'assistant', content: `⚠ ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-dock">
      <div className="chat-head">
        <b>🤖 Assistant</b>
        {mock && <span className="chat-badge" title="No model endpoint configured — pattern-matching only">mock mode</span>}
        <div className="spacer" />
        <button className="mini" onClick={onClose}>✕</button>
      </div>
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">{m.content.split('\n').map((line, j) => <div key={j}>{line}</div>)}</div>
          </div>
        ))}
        {busy && <div className="chat-msg assistant"><div className="chat-bubble">…</div></div>}
      </div>
      <div className="chat-input">
        <textarea
          rows={2}
          placeholder="Describe a change…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="primary" disabled={busy} onClick={send}>Send</button>
      </div>
    </div>
  );
}
