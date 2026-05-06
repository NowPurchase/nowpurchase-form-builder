import { apiGet, apiPost, apiPut, apiGetOldText } from './api';

const BASE_ENDPOINT = '/api/v2/admin/templates';

// Ensure customer_id is extracted correctly and appended to the URL
const buildQueryUrl = (base, customerId) => {
  return customerId ? `${base}?customer_id=${customerId}` : base;
};

/**
 * Fetch a single template by ID for configuration
 */
export const getDynamicLog = async (template_id, customerId, options = {}) => {
  const url = buildQueryUrl(`${BASE_ENDPOINT}/${template_id}`, customerId);
  return await apiGet(url, options);
};

/**
 * Update template configuration (config and/or route)
 */
export const patchTemplateConfig = async (templateId, updates, options = {}) => {
  // Use buildQueryUrl to ensure customer_id is passed if provided in updates
  const url = buildQueryUrl(`${BASE_ENDPOINT}/${templateId}`, updates.customer_id);
  return await apiPut(url, updates, options);
};

/**
 * Create a new template/form
 */
export const createDynamicLog = async (data, options = {}) => {
  const payload = {
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    template_name: data.template_name,
    sheet_url: data.sheet_url,
    status: data.status,
    config: data.config,
    form_json: data.form_json,
    description: data.description,
    platforms: data.platforms,
  };

  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  const url = buildQueryUrl(BASE_ENDPOINT, data.customer_id);
  return await apiPost(url, payload, options);
};

/**
 * Update an existing template/form
 */
export const updateDynamicLog = async (template_id, data, options = {}) => {
  const payload = {
    form_json: data.form_json,
    template_name: data.template_name,
    customer_name: data.customer_name,
    sheet_url: data.sheet_url,
    status: data.status,
    description: data.description,
    config: data.config,
    platforms: data.platforms,
    fetch_html: false,
  };

  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  const url = buildQueryUrl(`${BASE_ENDPOINT}/${template_id}`, data.customer_id);
  return await apiPut(url, payload, options);
};

/**
 * List templates (used by Home.jsx listing and Deploy.jsx)
 */
export const listDynamicLogs = async (params = {}, options = {}) => {
  const queryParams = [];

  if (params.page !== undefined && params.page !== null) {
    queryParams.push(`page=${params.page}`);
  }
  if (params.page_no !== undefined && params.page_no !== null) {
    queryParams.push(`page=${params.page_no}`);
  }
  if (params.page_size !== undefined && params.page_size !== null) {
    queryParams.push(`page_size=${params.page_size}`);
  }
  if (params.status) {
    queryParams.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params.is_active !== undefined && params.is_active !== null) {
    queryParams.push(`is_active=${params.is_active}`);
  }
  if (params.platform) {
    queryParams.push(`platform=${encodeURIComponent(params.platform)}`);
  }
  if (params.customer) {
    queryParams.push(`customer_id=${params.customer}`);
  }
  if (params.search) {
    queryParams.push(`search=${encodeURIComponent(params.search)}`);
  }

  const queryString = queryParams.length > 0 ? queryParams.join('&') : '';
  const endpoint = queryString ? `${BASE_ENDPOINT}?${queryString}` : BASE_ENDPOINT;

  return await apiGet(endpoint, options);
};

/**
 * Fetch all templates for workflow dropdown
 */
export const getTemplatesForWorkflow = async (excludeId = null) => {
  const response = await apiGet(`${BASE_ENDPOINT}?page_size=1000`);
  let templates = Array.isArray(response) ? response : (response.results || response.templates || []);

  if (excludeId) {
    templates = templates.filter(t => t.template_id !== excludeId);
  }

  return templates.map(template => ({
    value: template.template_id,
    label: template.template_name,
    template_id: template.template_id,
    template_name: template.template_name,
    version: template.version,
    collection_name_slug: template.collection_name_slug
  }));
};

/**
 * Get sheet HTML preview via old API
 */
export const getSheetPreview = async (templateId) => {
  return await apiGetOldText(`/api/admin/dynamic_logsheet/preview/?template_id=${templateId}`);
};
export const getTemplateForConfig = getDynamicLog;
