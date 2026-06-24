import React from 'react';
import { ENTITIES, getEntity } from '../../state/entities.js';

/**
 * EntityConfigModal — full point-and-click config for a master-data dropdown
 * (`dropdown_async` / `tags_async`). Driven by the entity registry
 * (state/entities.js): pick an entity, a search/display field, request FILTERS
 * (a fixed value or pulled from another form field = cascade), and AUTO-FILL
 * mappings (copy fields from the selected record into other form fields).
 *
 * Writes back into the field's type_config via onChange(patch). Raw/custom
 * values are always allowed (an unlisted entity/field shows as "(custom)") so
 * power is never hidden — matches the builder's UX philosophy.
 *
 * Props: value (type_config), onChange(patch), onClose(), fieldOptions
 * ([{ dataKey, label }] — other form fields, for "from field" + auto-fill).
 */
export default function EntityConfigModal({ value, onChange, onClose, fieldOptions = [] }) {
  const c = value || {};
  const entity = getEntity(c.entity_id);
  const filters = c.filters || [];
  const populate = c.on_select_populate || [];

  const setFilters = (next) => onChange({ filters: next });
  const setPopulate = (next) => onChange({ on_select_populate: next });

  const addFilter = () => {
    const first = entity && entity.filters && entity.filters[0];
    setFilters([...filters, { key: (first && first.key) || '', source: 'static', value: (first && first.default) || '', field: '' }]);
  };
  const setFilter = (i, patch) => setFilters(filters.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const addPop = () => setPopulate([...populate, { target_key: '', source_path: '' }]);
  const setPop = (i, patch) => setPopulate(populate.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>Configure master dropdown</b><div className="spacer" /><button onClick={onClose}>✕</button></div>
        <div style={{ padding: 14, overflow: 'auto' }}>

          {/* Entity */}
          <label className="fld">Entity (master data)</label>
          <select value={c.entity_id || ''} onChange={(e) => onChange({ entity_id: e.target.value })}>
            <option value="">Select an entity…</option>
            {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
            {c.entity_id && !entity && <option value={c.entity_id}>{c.entity_id} (custom)</option>}
          </select>

          {/* Search / display field */}
          <label className="fld" style={{ marginTop: 10 }}>Search / display field</label>
          {entity ? (
            <select value={c.search_fields || ''} onChange={(e) => onChange({ search_fields: e.target.value })}>
              <option value="">Select a field…</option>
              {entity.fields.map((fl) => <option key={fl.key} value={fl.key}>{fl.label}</option>)}
              {c.search_fields && !entity.fields.some((fl) => fl.key === c.search_fields) && <option value={c.search_fields}>{c.search_fields} (custom)</option>}
            </select>
          ) : (
            <input type="text" value={c.search_fields || ''} placeholder="field name (e.g. name)" onChange={(e) => onChange({ search_fields: e.target.value })} />
          )}

          {/* Filters */}
          <label className="fld" style={{ marginTop: 14 }}>Filters</label>
          <div className="hint" style={{ marginTop: 0 }}>Limit options sent to the API. A value can be fixed, or taken from another field (cascade).</div>
          {filters.map((flt, i) => {
            const meta = entity && entity.filters && entity.filters.find((x) => x.key === flt.key);
            return (
              <div className="col-editor" key={i}>
                <div className="inline">
                  {entity && entity.filters && entity.filters.length ? (
                    <select value={flt.key} onChange={(e) => { const m = entity.filters.find((x) => x.key === e.target.value); setFilter(i, { key: e.target.value, value: (m && m.default) || '' }); }}>
                      {entity.filters.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      {flt.key && !entity.filters.some((x) => x.key === flt.key) && <option value={flt.key}>{flt.key}</option>}
                    </select>
                  ) : (
                    <input type="text" placeholder="filter key (e.g. status)" value={flt.key} onChange={(e) => setFilter(i, { key: e.target.value })} />
                  )}
                  <select value={flt.source} onChange={(e) => setFilter(i, { source: e.target.value })}>
                    <option value="static">Fixed value</option>
                    <option value="field">From field</option>
                  </select>
                  <button className="mini danger" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>✕</button>
                </div>
                {flt.source === 'field' ? (
                  <select style={{ marginTop: 4 }} value={flt.field || ''} onChange={(e) => setFilter(i, { field: e.target.value })}>
                    <option value="">Select a field…</option>
                    {fieldOptions.map((o) => <option key={o.dataKey} value={o.dataKey}>{o.label} ({o.dataKey})</option>)}
                  </select>
                ) : (meta && meta.type === 'enum') ? (
                  <select style={{ marginTop: 4 }} value={flt.value || ''} onChange={(e) => setFilter(i, { value: e.target.value })}>
                    {(meta.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input style={{ marginTop: 4 }} type="text" placeholder="value" value={flt.value || ''} onChange={(e) => setFilter(i, { value: e.target.value })} />
                )}
              </div>
            );
          })}
          <button className="mini" onClick={addFilter}>+ Filter</button>

          {/* Auto-fill on select */}
          <label className="fld" style={{ marginTop: 14 }}>Auto-fill on select</label>
          <div className="hint" style={{ marginTop: 0 }}>When an option is picked, copy values from the selected record into other fields.</div>
          {populate.map((m, i) => (
            <div className="col-editor" key={i}>
              <div className="inline">
                <select value={m.target_key || ''} onChange={(e) => setPop(i, { target_key: e.target.value })}>
                  <option value="">Target field…</option>
                  {fieldOptions.map((o) => <option key={o.dataKey} value={o.dataKey}>{o.label} ({o.dataKey})</option>)}
                  {m.target_key && !fieldOptions.some((o) => o.dataKey === m.target_key) && <option value={m.target_key}>{m.target_key}</option>}
                </select>
                <button className="mini danger" onClick={() => setPopulate(populate.filter((_, j) => j !== i))}>✕</button>
              </div>
              {entity ? (
                <select style={{ marginTop: 4 }} value={m.source_path || ''} onChange={(e) => setPop(i, { source_path: e.target.value })}>
                  <option value="">From record field…</option>
                  {entity.fields.map((fl) => <option key={fl.key} value={`main.data.${fl.key}`}>{fl.label}</option>)}
                  {m.source_path && !entity.fields.some((fl) => `main.data.${fl.key}` === m.source_path) && <option value={m.source_path}>{m.source_path}</option>}
                </select>
              ) : (
                <input style={{ marginTop: 4 }} type="text" placeholder="source path in record (e.g. main.data.weight)" value={m.source_path || ''} onChange={(e) => setPop(i, { source_path: e.target.value })} />
              )}
              <div className="key">{m.target_key || '?'} ← record.{m.source_path || '?'}</div>
            </div>
          ))}
          <button className="mini" onClick={addPop}>+ Auto-fill</button>

        </div>
        <div className="modal-foot"><button className="primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
