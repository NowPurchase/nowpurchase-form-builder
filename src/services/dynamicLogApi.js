import { apiGet, apiPost, apiPut, apiGetOldText } from './api';

const BASE_ENDPOINT = '/api/v1/templates';

export const createDynamicLog = async (data) => {
  const payload = {
    customer_id: data.customer_id, // Required
    customer_name: data.customer_name, // Save customer name
    template_name: data.template_name, // Required
    sheet_url: data.sheet_url, // Save sheet URL
    status: data.status, // Direct field (not in config)
    config: data.config, // Required
    form_json: data.form_json, // Optional
    description: data.description, // Optional
    platforms: data.platforms, // Optional
  };

  // Remove undefined fields
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return await apiPost(BASE_ENDPOINT, payload);
};

export const updateDynamicLog = async (template_id, data) => {
  const payload = {
    form_json: data.form_json, // Required for update
    template_name: data.template_name, // Optional
    customer_name: data.customer_name, // Save customer name
    sheet_url: data.sheet_url, // Save sheet URL
    status: data.status, // Direct field (not in config)
    description: data.description, // Optional
    config: data.config, // Optional
    platforms: data.platforms, // Optional
  };

  // Remove undefined fields
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return await apiPut(`${BASE_ENDPOINT}/${template_id}`, payload);
};

export const getDynamicLog = async (template_id) => {
  return await apiGet(`${BASE_ENDPOINT}/${template_id}`);
};

export const listDynamicLogs = async (params = {}) => {
  const queryParams = [];

  if (params.page_no !== undefined && params.page_no !== null) {
    queryParams.push(`page_no=${params.page_no}`);
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
    queryParams.push(`customer=${params.customer}`);
  }
  if (params.search) {
    queryParams.push(`search=${encodeURIComponent(params.search)}`);
  }

  const queryString = queryParams.length > 0 ? queryParams.join('&') : '';
  const endpoint = queryString
    ? `${BASE_ENDPOINT}?${queryString}`
    : BASE_ENDPOINT;

  return await apiGet(endpoint);
};

export const getSheetPreview = async (templateId) => {
  // Sheet preview uses old NowPurchase API, returns HTML as text
  return await apiGetOldText(`/api/admin/dynamic_logsheet/preview/?template_id=${templateId}`);
};

