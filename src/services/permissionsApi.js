import { apiGetOld, apiGet, apiPostOld } from './api';

const BASE_ENDPOINT = '/api/dlms';

/**
 * List DLMS permissions
 * @param {object} params - Query parameters
 * @param {string} params.search - Search by user name, mobile, or company name
 * @param {string} params.template_id - Filter users with permission for this template (or DLMS admins)
 * @param {number} params.customer - Filter by customer/company ID
 */
export const listPermissions = async (params = {}) => {
  const queryParams = [];
  if (params.search) {
    queryParams.push(`search=${encodeURIComponent(params.search)}`);
  }
  if (params.template_id) {
    queryParams.push(`template_id=${encodeURIComponent(params.template_id)}`);
  }
  if (params.customer) {
    queryParams.push(`customer_id=${encodeURIComponent(params.customer)}`);
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return apiGetOld(`${BASE_ENDPOINT}/permissions/${queryString}`, { env: 'prod' });
};

/**
 * Update or create user permissions
 * Returns 201 if created, 200 if updated
 */
export const updateUserPermissions = async (userId, data) => {
  return apiPostOld(`${BASE_ENDPOINT}/permissions/${userId}/`, data, { env: 'prod' });
};

/**
 * List templates for permissions page
 * Uses DLMS API with JWT token (handles refresh)
 * @param {object} params - Query parameters (page_size, customer)
 */
export const listTemplatesForPermissions = async (params = {}) => {
  const queryParams = [];
  if (params.page_size) {
    queryParams.push(`page_size=${params.page_size}`);
  }
  if (params.customer) {
    queryParams.push(`customer_id=${params.customer}`);
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return apiGet(`/api/v2/admin/templates${queryString}`);
};
