'use strict';

// ---------------------------------------------------------------------------
// actions.js — ACTION_REGISTRY + collectUsedActions. See PLAN.md.
// Phase 1: actions are auto-managed. The user never writes action code.
// Only the actions actually needed by the form's fields are emitted.
//
// URL Note: all URLs are placeholder. Replace with window.__DLMS_CONFIG
// references once the prototype is confirmed.
// ---------------------------------------------------------------------------

const ACTION_REGISTRY = {
  set_default_value: {
    // Included when any field has a default_value. Sets the field on mount,
    // without overwriting a value the user already entered.
    params: { target_key: 'string', mode: 'string', value: 'string', source_key: 'string' },
    body: `
      const k = args.target_key;
      if (!k || !e || !e.data) return;
      if (e.data[k] != null && e.data[k] !== '') return;
      switch (args.mode) {
        case 'today': case 'datetime': e.data[k] = new Date(); break;
        case 'now': { const d = new Date(); e.data[k] = ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); break; }
        case 'fixed': e.data[k] = args.value; break;
        case 'from_field': if (args.source_key && e.data[args.source_key] != null) e.data[k] = e.data[args.source_key]; break;
        case 'user': {
          const token = localStorage.getItem('tokenv2') || localStorage.getItem('nowpurchase_token');
          fetch('https://api.nowpurchase.com/api/user-detail/', { method: 'GET', headers: { 'accept': 'application/json', 'authorization': 'Token ' + token } })
            .then(function (r) { return r.json(); })
            .then(function (u) { if (u && u.name) e.data[k] = u.name; })
            .catch(function () {});
          break;
        }
        default: break;
      }
    `,
  },

  initFormData: {
    // ALWAYS included — fires on Screen onLoadData
    params: {},
    body: `
      if (e) {
        e.data = e.data || {};
        if (!e.data.date) e.data.date = new Date().toISOString();
        const hour = new Date().getHours();
        let shift = 'A';
        if (hour >= 14 && hour < 22) shift = 'B';
        else if (hour >= 22 || hour < 6) shift = 'C';
        if (!e.data.shift) e.data.shift = shift;
      }
    `,
  },

  fetch_dropdown: {
    // Included when any field is dropdown_async or tags_async
    params: { entity_id: 'string', search_fields: 'string', filters: 'array' },
    body: `
      const [searchValue, loadCallback, currentDataLength] = e.args;
      const { entity_id, search_fields, filters } = args;

      if (window._dropdownDebounceTimer)
        clearTimeout(window._dropdownDebounceTimer);
      if (window._dropdownAbortController)
        window._dropdownAbortController.abort();

      window._dropdownAbortController = new AbortController();
      const signal = window._dropdownAbortController.signal;

      window._dropdownDebounceTimer = setTimeout(async () => {
        const token = localStorage.getItem('dlms_auth_token');
        const url = \`https://dlms-api.iotnp.com/api/v1/templates/\${entity_id}/dropdown\`;

        const body = {
          fields: search_fields ? [search_fields] : [],
          search: searchValue ? [searchValue] : [],
          search_fields: search_fields ? [search_fields] : [],
          flat: false,
          limit: searchValue ? 20 : 100
        };

        // Apply configured filters. 'static' uses the fixed value; 'field' pulls
        // the value from another form field at fetch time (cascade).
        (filters || []).forEach(function (flt) {
          if (!flt || !flt.key) return;
          var val = flt.source === 'field' ? (e.data ? e.data[flt.field] : undefined) : flt.value;
          if (val !== undefined && val !== null && val !== '') body[flt.key] = val;
        });
        // Preserve the historical default unless a filter set it explicitly.
        if (body.status === undefined) body.status = 'completed';

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${token}\`
            },
            body: JSON.stringify(body),
            signal
          });
          const response = await res.json();
          const items = Array.isArray(response.data) ? response.data : [];
          const preparedData = items
            .slice(currentDataLength || 0, (currentDataLength || 0) + 20)
            .map(item => ({
              value: item._id,
              label: item.main?.data?.[search_fields] || item._id,
              data: item
            }));
          if (typeof loadCallback === 'function')
            loadCallback(preparedData);
        } catch (err) {
          if (err.name !== 'AbortError') console.error(err);
          if (typeof loadCallback === 'function') loadCallback([]);
        }
      }, 300);
    `,
  },

  populate_on_select: {
    // Included when an async dropdown/tags field defines on_select_populate.
    // Fills target dataKeys from the selected record (PLAN Rule 7 — nested
    // object population). The selected option carries the full record under
    // `.data` (set by fetch_dropdown).
    params: { mappings: 'array' },
    body: `
      const args0 = Array.isArray(e.args) ? e.args : [];
      const selected = args0[1] != null ? args0[1] : args0[0];
      const record = selected && selected.data ? selected.data : (selected || {});
      const mappings = args.mappings || [];
      mappings.forEach(function (m) {
        const val = String(m.source_path || '')
          .split('.')
          .reduce(function (o, k) { return (o == null ? undefined : o[k]); }, record);
        e.data[m.target_key] = (val == null ? '' : val);
      });
    `,
  },

  set_shift: {
    // Included when any Time field has auto_derive_shift: true
    params: { field_data_key: 'string' },
    body: `
      function getShift(timeString) {
        const hours = parseInt(timeString.split(':')[0], 10);
        if (hours >= 6 && hours < 14) return 'A';
        if (hours >= 14 && hours < 22) return 'B';
        return 'C';
      }
      const targetKey = args.field_data_key;
      const time = e.args[0];
      e.data[targetKey] = getShift(time);
    `,
  },

  set_date_on_mount: {
    // Included when any Date field has auto_fill_today: true
    params: {},
    body: `
      if (!e.data?.date) e.data.date = new Date();
    `,
  },

  set_shift_on_time: {
    // Included alongside set_shift for time fields
    params: {},
    body: `
      if (!e.data?.time) e.data.time = new Date();
      function getShift(timeString) {
        const hours = parseInt(timeString.split(':')[0], 10);
        if (hours >= 6 && hours < 14) return 'A';
        if (hours >= 14 && hours < 22) return 'B';
        return 'C';
      }
      if (!e.data?.shift) {
        e.data.shift = getShift(e.data.time);
      }
    `,
  },

  set_upload_url: {
    // Included when a File/Image upload field exists. On a successful upload,
    // stores the returned file_url back into the attachment array item.
    params: {},
    body: `
      if (e.args[1]?.fileKey && e.args[0]?.file_url) {
        if (!window.__fileUrlMap) window.__fileUrlMap = {};
        window.__fileUrlMap[e.args[1].fileKey] = e.args[0].file_url;
        if (e.data.attachment) {
          e.data.attachment.forEach(item => {
            if (window.__fileUrlMap[item.fileKey]) {
              item.file_url = window.__fileUrlMap[item.fileKey];
              item.status = 'finished';
            }
          });
        }
      }
    `,
  },

  set_operator_name: {
    // Included when any field is type 'supervisor'
    params: {},
    body: `
      if (e?.data?.disabled__supervisor) return;
      const token = localStorage.getItem('tokenv2')
                 || localStorage.getItem('nowpurchase_token');
      fetch('https://api.nowpurchase.com/api/user-detail/', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authorization': \`Token \${token}\`
        }
      })
      .then(res => res.json())
      .then(userData => {
        if (userData?.name)
          e.data.disabled__supervisor = userData.name;
      })
      .catch(err => console.error('Fetch error:', err));
    `,
  },

  set_unicode: {
    // Included when any checkbox exists in a table
    params: { field_name: 'string' },
    body: `
      const fieldName = args.field_name;
      const checkKey = \`derived__\${fieldName}_check\`;
      e.data[checkKey] = e.data[fieldName] ? '✓' : 'x';
    `,
  },

  merge_unit: {
    // Included when a number field has a unit pair
    params: {},
    body: `
      if (e.data.total_qty != null && e.data.unit != null) {
        e.data.total_qty_formatted = e.data.total_qty + ' ' + e.data.unit;
      }
    `,
  },

  init_table: {
    // Included when form has a table section — seeds initial visible rows.
    params: { row_count_key: 'string', initial_rows: 'number' },
    body: `
      if (e) {
        e.data = e.data || {};
        const key = args.row_count_key;
        const init = args.initial_rows || 1;
        if (e.data[key] == null) e.data[key] = init;
      }
    `,
  },

  addRow: {
    // Included when form has a table section
    params: { row_count_key: 'string', deleted_prefix: 'string', max_rows: 'number' },
    body: `
      if (e) {
        e.data = e.data || {};
        const max = args.max_rows || 20;
        const countKey = args.row_count_key;
        const deletedPrefix = args.deleted_prefix;
        const currentCount = Number(e.data[countKey] || 0);
        for (let i = 0; i < currentCount; i++) {
          if (e.data[\`\${deletedPrefix}\${i}\`] === true) {
            e.data[\`\${deletedPrefix}\${i}\`] = false;
            return;
          }
        }
        if (currentCount < max) e.data[countKey] = currentCount + 1;
      }
    `,
  },

  removeRow: {
    // Included when form has a table section
    params: { index: 'number', deleted_prefix: 'string' },
    body: `
      if (e) {
        const idx = Number(args.index);
        const deletedPrefix = args.deleted_prefix;
        if (!isNaN(idx) && idx >= 0) {
          e.data[\`\${deletedPrefix}\${idx}\`] = true;
        }
      }
    `,
  },
};

// Decide which actions to emit based on the field types / toggles in use.
function collectUsedActions(state) {
  const needed = new Set(['initFormData']); // always

  (state.sections || []).forEach((section) => {
    if (section.type === 'table') {
      // Tables are native Repeaters: add/remove rows use the BUILT-IN `common`
      // actions (addRow/removeRow), not custom code — so nothing to declare
      // here. Initial rows are seeded via props.value. Only async columns still
      // need a custom action (the dropdown loader).
      const cols = (section.table_config || {}).columns || [];
      if (cols.some((c) => c.field_type === 'dropdown_async' || c.field_type === 'tags_async')) needed.add('fetch_dropdown');
    }

    (section.fields || []).forEach((field) => {
      const cfg = field.type_config || {};
      if (field.default_value && field.default_value.mode) needed.add('set_default_value');
      switch (field.field_type) {
        case 'dropdown_async':
        case 'tags_async':
          needed.add('fetch_dropdown');
          if (Array.isArray(cfg.on_select_populate) && cfg.on_select_populate.length) {
            needed.add('populate_on_select');
          }
          break;
        case 'time':
          if (cfg.auto_derive_shift) {
            needed.add('set_shift');
            needed.add('set_shift_on_time');
          }
          break;
        case 'date':
          if (cfg.auto_fill_today) needed.add('set_date_on_mount');
          break;
        case 'supervisor':
          needed.add('set_operator_name');
          break;
        case 'upload':
          needed.add('set_upload_url');
          break;
        default:
          break;
      }
    });
  });

  const result = {};
  needed.forEach((name) => {
    const def = ACTION_REGISTRY[name];
    if (!def) return;
    result[name] = { body: def.body.trim(), params: def.params };
  });
  return result;
}

export { ACTION_REGISTRY, collectUsedActions };
