import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * KeyPicker — a searchable, grouped combobox for choosing a form key.
 *
 * Replaces the raw <select> field-pickers. As forms grow the flat list of keys
 * becomes unwieldy, so this filters as you type and groups options (by section,
 * or "from <dropdown>" for virtual auto-fill keys). A free-typed value that
 * matches nothing is offered as a custom key, preserving the escape hatch.
 *
 * Props:
 *   value      — current key (string)
 *   onChange   — (key) => void
 *   options    — [{ key, label, group }]  (see keyGraph.referenceableKeys)
 *   placeholder, allowCustom (default true)
 */
export default function KeyPicker({ value, onChange, options = [], placeholder = 'pick a field…', allowCustom = true }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.find((o) => o.key === value);
  const display = selected ? selected.label : value;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.key.toLowerCase().includes(needle) || String(o.label || '').toLowerCase().includes(needle));
  }, [q, options]);

  const groups = useMemo(() => {
    const m = new Map();
    filtered.forEach((o) => { const g = o.group || ''; if (!m.has(g)) m.set(g, []); m.get(g).push(o); });
    return Array.from(m.entries());
  }, [filtered]);

  const pick = (k) => { onChange(k); setOpen(false); setQ(''); };
  const exact = options.some((o) => o.key === q.trim());

  const itemStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 8px', cursor: 'pointer', fontSize: 12 };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}
      >
        {display
          ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}{selected ? <span className="key"> · {selected.key}</span> : null}</span>
          : <span style={{ color: 'var(--faint)' }}>{placeholder}</span>}
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, marginTop: 2, background: 'var(--panel, #fff)', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
          <div style={{ padding: 6, borderBottom: '1px solid #eee' }}>
            <input autoFocus type="text" placeholder="type to filter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {groups.length === 0 && !((allowCustom && q.trim() && !exact)) && <div className="hint" style={{ padding: 8 }}>No matches</div>}
            {groups.map(([g, items]) => (
              <div key={g || '_'}>
                {g && <div style={{ padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--faint)', background: '#fafafa', position: 'sticky', top: 0 }}>{g}</div>}
                {items.map((o) => (
                  <div
                    key={o.key} onClick={() => pick(o.key)}
                    style={{ ...itemStyle, background: o.key === value ? '#eff6ff' : 'transparent' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                    <span className="key" style={{ flexShrink: 0 }}>{o.key}</span>
                  </div>
                ))}
              </div>
            ))}
            {allowCustom && q.trim() && !exact && (
              <div onClick={() => pick(q.trim())} style={{ ...itemStyle, borderTop: '1px solid #eee', color: 'var(--accent, #2563eb)' }}>
                Use custom key: <code>{q.trim()}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
