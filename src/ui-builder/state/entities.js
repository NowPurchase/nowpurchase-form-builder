'use strict';

// ---------------------------------------------------------------------------
// entities.js — the Master-Data Entity Registry.
//
// Each entry encodes a known master-data API contract so the builder can offer
// point-and-click config for `dropdown_async` / `tags_async` fields instead of
// hand-typed strings. The runtime call is generic:
//   POST https://dlms-api.iotnp.com/api/v1/templates/{id}/dropdown
// (see state/actions.js `fetch_dropdown`). A registry entry describes:
//   • fields  — record fields available to SEARCH / DISPLAY / auto-fill from
//   • filters — request params the API accepts (status, etc.), with defaults
//
// Seeded from the entity ids actually used across the live forms in exports/
// (grep `templates/<id>/dropdown`). The shape is intentionally plain data so it
// can later be loaded from an API instead of hardcoded. Fields lists are a
// curated starting point — the config UI also allows a custom field, so an
// unlisted field never blocks the user.
// ---------------------------------------------------------------------------

// Filters every master entity supports (the generic dropdown contract).
const COMMON_FILTERS = [
  { key: 'status', label: 'Status', type: 'enum', options: ['completed', 'pending'], default: 'completed' },
];

const f = (key, label) => ({ key, label: label || key });

export const ENTITIES = [
  {
    id: 'casting_master',
    label: 'Casting Master',
    fields: [f('name', 'Name'), f('casting_name', 'Casting Name'), f('serial_no', 'Serial No'), f('grade', 'Grade'), f('part_no', 'Part No')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'raw_material_master',
    label: 'Raw Material Master',
    fields: [f('name', 'Name'), f('grade', 'Grade'), f('material', 'Material')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'assembly_master',
    label: 'Assembly Master',
    fields: [f('name', 'Name'), f('assembly', 'Assembly'), f('part_no', 'Part No')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'assembly_operational',
    label: 'Assembly (Operational)',
    fields: [f('assembly', 'Assembly'), f('bogie_no', 'Bogie No'), f('bogie_id', 'Bogie ID')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'dispatch_operational',
    label: 'Dispatch (Operational)',
    fields: [f('assembly', 'Assembly'), f('bogie_no', 'Bogie No'), f('bogie_id', 'Bogie ID'), f('dm_no', 'DM No')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'dispatch_memo_operational',
    label: 'Dispatch Memo (Operational)',
    fields: [f('dm_no', 'DM No'), f('assembly', 'Assembly')],
    filters: COMMON_FILTERS,
  },
  {
    id: 'heat_treatment_operational',
    label: 'Heat Treatment (Operational)',
    fields: [f('heat_no', 'Heat No'), f('batch', 'Batch'), f('grade', 'Grade')],
    filters: COMMON_FILTERS,
  },
];

export function getEntity(id) {
  return ENTITIES.find((e) => e.id === id) || null;
}
