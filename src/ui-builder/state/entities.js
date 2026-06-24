'use strict';

// ---------------------------------------------------------------------------
// entities.js — the Master-Data Entity Registry.
//
// Each entry describes a master-data source the builder can offer for
// `dropdown_async` / `tags_async` fields. Two contract families are supported:
//
//  1. DLMS (default) — entities WITHOUT a `request`. They use the generic
//     POST https://dlms-api.iotnp.com/api/v1/templates/{id}/dropdown contract
//     (see state/actions.js `fetch_dropdown`, legacy branch). Output is
//     unchanged from before — existing forms are unaffected.
//
//  2. Contract-based (Django/MTC, etc.) — entities WITH a `request` + `response`.
//     exportJSON bakes the resolved contract into the field's onLoadData args so
//     the generic `fetch_dropdown` can call any GET/POST endpoint, apply filters
//     (static or pulled from another field = cascade), and map the response.
//
// Auth by backend: dlms → `Bearer <localStorage.dlms_auth_token>`;
//                  django → `Token <localStorage.nowpurchase_token>`.
//
// HOST: hardcoded for now (see HOSTS below). TODO: move to an injected
// `window.__NP_VARS` ({ dlmsHost, djangoHost }, set at app bootstrap from
// services/api.js) so the exported form is env-portable — deferred to avoid
// breaking preview before the bootstrap exists.
// ---------------------------------------------------------------------------

// TEMP hardcoded hosts (staging). Swap to window.__NP_VARS later.
const HOSTS = {
  dlms: 'https://dlms-api-stage.iotnp.com',
  django: 'https://test-api.nowpurchase.com',
};

const f = (key, label) => ({ key, label: label || key });
const COMMON_DLMS_FILTERS = [
  { key: 'status', label: 'Status', type: 'enum', options: ['completed', 'pending'], default: 'completed' },
];

// A Django dropdown: GET, `search` query param, root-array response, capped at 10.
const django = (id, label, path, response, opts = {}) => ({
  id, label, backend: 'django',
  request: { method: 'GET', path, searchParam: 'search', limit: opts.limit ?? 10 },
  response, // { path:'' (root array), valueKey, labelKey }
  fields: opts.fields || [],
  filters: opts.filters || [], // available params; cascade:true ones bind to another field
});

export const ENTITIES = [
  // ---- DLMS master data (default contract — unchanged) --------------------
  { id: 'casting_master', label: 'Casting Master', fields: [f('name', 'Name'), f('casting_name', 'Casting Name'), f('serial_no', 'Serial No'), f('grade', 'Grade'), f('part_no', 'Part No')], filters: COMMON_DLMS_FILTERS },
  { id: 'raw_material_master', label: 'Raw Material Master', fields: [f('name', 'Name'), f('grade', 'Grade'), f('material', 'Material')], filters: COMMON_DLMS_FILTERS },
  { id: 'assembly_master', label: 'Assembly Master', fields: [f('name', 'Name'), f('assembly', 'Assembly'), f('part_no', 'Part No')], filters: COMMON_DLMS_FILTERS },
  { id: 'dispatch_operational', label: 'Dispatch (Operational)', fields: [f('assembly', 'Assembly'), f('bogie_no', 'Bogie No'), f('bogie_id', 'Bogie ID'), f('dm_no', 'DM No')], filters: COMMON_DLMS_FILTERS },
  { id: 'heat_treatment_operational', label: 'Heat Treatment (Operational)', fields: [f('heat_no', 'Heat No'), f('batch', 'Batch'), f('grade', 'Grade')], filters: COMMON_DLMS_FILTERS },

  // ---- MTC (Django) master data — contract-based --------------------------
  // Plain dropdowns (search-only, 10-row cap, root array).
  django('mtc_client', 'MTC · Customer / Client', '/api/castingquality/mtc/client_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'name' },
    { fields: [f('id'), f('name', 'Name')] }),

  django('mtc_part_name', 'MTC · Part Name', '/api/castingquality/mtc/part_name_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'name' },
    { fields: [f('id'), f('name', 'Name')],
      filters: [{ key: 'client', label: 'Client', cascade: true }] }),

  // ⚠ value `id` = ClientOrder PK, NOT cast_part_no.id. Do not feed this row's id
  // into mtc_part_spec's cast_part_no cascade — use part_no_id from heat/spec.
  django('mtc_part_no', 'MTC · Part Number', '/api/castingquality/mtc/part_no_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'name' },
    { fields: [f('id', 'Id (ClientOrder PK)'), f('name', 'Part Number')],
      filters: [{ key: 'client', label: 'Client', cascade: true }, { key: 'cast_part_name', label: 'Part Name', cascade: true }] }),

  // value = grade_id (NOT row id); category_id is a handy auto-fill.
  django('mtc_grade', 'MTC · Grade', '/api/castingquality/mtc/v2/grade_dropdown/',
    { path: '', valueKey: 'grade_id', labelKey: 'name' },
    { fields: [f('grade_id', 'Grade Id'), f('name', 'Grade'), f('category_id', 'Grade Category Id')],
      filters: [{ key: 'client', label: 'Client', cascade: true }] }),

  // ⚠ last 90 days, FINAL/PIT only; search is startswith.
  django('mtc_heat', 'MTC · Heat', '/api/castingquality/mtc/heats/',
    { path: '', valueKey: 'id', labelKey: 'name' },
    { fields: [f('id', 'Heat Id'), f('name', 'Heat Name'), f('heat_date', 'Heat Date'), f('part_number', 'Part Number'), f('part_no_id', 'Part No Id')],
      filters: [{ key: 'grade_id', label: 'Grade', cascade: true }, { key: 'part_no', label: 'Part No (heat)', cascade: true }] }),

  // Test dropdowns — same endpoint serves plain (?search) and by-heat (?heat_code).
  // Rows carry full test records, so they double as auto-fill sources.
  django('mtc_tensile', 'MTC · Tensile', '/api/castingquality/mtc/tensile_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'heat_code' },
    { fields: ['id', 'heat_code', 'tensile_strength', 'yield_strength', 'elongation', 'reduction_in_area', 'grade', 'part_name', 'part_number'].map((k) => f(k)),
      filters: [{ key: 'heat_code', label: 'Heat code', cascade: true }, { key: 'heat', label: 'Heat id', cascade: true }] }),

  django('mtc_impact', 'MTC · Impact', '/api/castingquality/mtc/impact_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'heat_code' },
    { fields: ['id', 'heat_code', 'specification', 'average_toughness', 'grade', 'part_name', 'part_number'].map((k) => f(k)),
      filters: [{ key: 'heat_code', label: 'Heat code', cascade: true }, { key: 'heat', label: 'Heat id', cascade: true }] }),

  django('mtc_hardness', 'MTC · Hardness', '/api/castingquality/mtc/hardness_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'heat_code' },
    { fields: ['id', 'heat_code', 'low_limit', 'high_limit', 'avg_hardness', 'grade', 'part_name', 'part_number'].map((k) => f(k)),
      filters: [{ key: 'heat_code', label: 'Heat code', cascade: true }, { key: 'heat', label: 'Heat id', cascade: true }] }),

  django('mtc_load', 'MTC · Load', '/api/castingquality/mtc/load_test_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'heat_code' },
    { fields: ['id', 'heat_code', 'ps_specification', 'ps_actual', 'grade', 'part_name', 'part_number'].map((k) => f(k)),
      filters: [{ key: 'heat_code', label: 'Heat code', cascade: true }] }),

  django('mtc_micro', 'MTC · Micro Analysis', '/api/castingquality/mtc/micro_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'heat_code' },
    { fields: ['id', 'heat_code', 'nodule_count', 'avg_nodularity', 'pearlite', 'ferrite', 'carbide', 'grade', 'part_name', 'part_number'].map((k) => f(k)),
      filters: [{ key: 'heat_code', label: 'Heat code', cascade: true }] }),

  // Cascading: part spec by part number (uncapped — pagination_class=None).
  django('mtc_part_spec', 'MTC · Part Spec', '/api/castingquality/mtc/v2/mtc_specified_dropdown/',
    { path: '', valueKey: 'id', labelKey: 'part_no' },
    { limit: 0,
      fields: ['id', 'part_no', 'part_name', 'grade', 'grade_id', 'part_no_id', 'client', 'client_id', 'part_name_id'].map((k) => f(k)),
      filters: [
        { key: 'cast_part_no', label: 'Part Number', cascade: true },
        { key: 'grade', label: 'Grade', cascade: true },
        { key: 'client', label: 'Client (→customer)', cascade: true },
      ] }),
];

export function getEntity(id) {
  return ENTITIES.find((e) => e.id === id) || null;
}

// Resolve an entity's request contract to a concrete call (full URL + auth meta),
// or null for DLMS-default entities (which use the legacy fetch path).
export function resolveRequest(entity) {
  if (!entity || !entity.request) return null;
  const backend = entity.backend || 'django';
  return {
    backend,
    method: entity.request.method || 'GET',
    url: (HOSTS[backend] || HOSTS.django) + entity.request.path,
    searchParam: entity.request.searchParam || 'search',
    limit: entity.request.limit ?? 10,
    response: entity.response || { path: '', valueKey: 'id', labelKey: 'name' },
  };
}
