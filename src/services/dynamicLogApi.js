import { apiGet, apiPost, apiPut } from './api';

const BASE_ENDPOINT = '/admin/dynamic_form';

export const createDynamicLog = async (data) => {
  const payload = {
    template_name: data.template_name,
    sheet_id: data.sheet_id || '',
    form_json: data.form_json || {},
    customer: data.customer || null,
    status: data.status || 'draft',
    description: data.description || '',
  };

  return await apiPost(BASE_ENDPOINT + '/', payload);
};

export const updateDynamicLog = async (id, data) => {
  const payload = {
    id: id,
    template_name: data.template_name,
    sheet_id: data.sheet_id || '',
    form_json: data.form_json || {},
    customer: data.customer || null,
    status: data.status || 'draft',
    description: data.description || '',
  };

  return await apiPut(`${BASE_ENDPOINT}/${id}/`, payload);
};

export const getDynamicLog = async (id) => {
  return await apiGet(`${BASE_ENDPOINT}/${id}/`);
};

export const listDynamicLogs = async (params = {}) => {
  const queryParams = [];
  
  if (params.page !== undefined && params.page !== null) {
    queryParams.push(`page=${params.page}`);
  }
  if (params.page_size !== undefined && params.page_size !== null) {
    queryParams.push(`page_size=${params.page_size}`);
  }
  if (params.status) {
    queryParams.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params.customer !== undefined && params.customer !== null) {
    queryParams.push(`customer=${params.customer}`);
  }
  if (params.search) {
    queryParams.push(`search=${encodeURIComponent(params.search)}`);
  }

  const queryString = queryParams.length > 0 ? queryParams.join('&') : '';
  const endpoint = queryString 
    ? `${BASE_ENDPOINT}/?${queryString}`
    : `${BASE_ENDPOINT}/`;

  return await apiGet(endpoint);
};

export const getCustomerDropdown = async (search = '') => {
  const queryParams = new URLSearchParams();
  if (search) {
    queryParams.append('search', search);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `${BASE_ENDPOINT}/customers/dropdown/?${queryString}`
    : `${BASE_ENDPOINT}/customers/dropdown/`;

  return await apiGet(endpoint);
};

