import { apiGet, apiPut } from './api';

// ---------------------------------------------------------------------------
// staticListApi — curated "static list" dropdown values (ENG-898 backend).
//
// One document per (template_id, customer_id) holding ALL of that template's
// fixed lists: { lists: { <entity_id>: [{ value, label }], ... } }.
// Referenced fixed dropdowns (options_source: 'list') load from here at render;
// the template JSON carries only the entity_id, never the values.
//
// NOTE: confirm BASE_ENDPOINT matches the route registered in the backend's
// app/api/v1/router.py — adjust the prefix here if it differs.
// ---------------------------------------------------------------------------

const BASE_ENDPOINT = '/api/v1/static-lists';

// Runtime read (form fill / config preview): customer_id is derived from the
// JWT server-side. Returns the `lists` map, or {} when no doc exists yet.
export const getStaticLists = async (templateId, options = {}) => {
  return await apiGet(`${BASE_ENDPOINT}/${templateId}`, options);
};

// Admin write (config page): full replace of this (template, customer) doc's
// `lists`. customer_id is explicit because an admin manages many customers.
export const putStaticLists = async (templateId, customerId, lists, options = {}) => {
  const url = customerId
    ? `${BASE_ENDPOINT}/${templateId}?customer_id=${customerId}`
    : `${BASE_ENDPOINT}/${templateId}`;
  return await apiPut(url, { lists }, options);
};
