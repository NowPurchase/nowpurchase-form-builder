import { apiGet, apiPost, apiPut } from './api';

const BASE_ENDPOINT = '/admin/dynamic_form';

export const createDynamicLog = async (data) => {
  const payload = {
    template_name: data.template_name,
    form_json: data.form_json || {},
    customer: data.customer || null,
    status: data.status || 'draft',
  };

  return await apiPost(BASE_ENDPOINT + '/', payload);
};

export const updateDynamicLog = async (id, data) => {
  const payload = {
    id: id,
    template_name: data.template_name,
    form_json: data.form_json || {},
    customer: data.customer || null,
    status: data.status || 'draft',
  };

  return await apiPut(`${BASE_ENDPOINT}/${id}/`, payload);
};

export const getDynamicLog = async (id) => {
  return await apiGet(`${BASE_ENDPOINT}/${id}/`);
};

export const listDynamicLogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.page_size) queryParams.append('page_size', params.page_size);
  if (params.status) queryParams.append('status', params.status);
  if (params.customer) queryParams.append('customer', params.customer);
  if (params.template_name) queryParams.append('template_name', params.template_name);

  const queryString = queryParams.toString();
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

