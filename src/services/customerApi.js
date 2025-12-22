import { apiGetOld } from './api';

// Customer-related API calls use the old NowPurchase API
// since customer_id in DLMS is a FK to the old API

export const getCustomerDropdown = async (search = '') => {
  const queryParams = new URLSearchParams();
  if (search) {
    queryParams.append('search', search);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/admin/dynamic_form/customers/dropdown/?${queryString}`
    : `/api/admin/dynamic_form/customers/dropdown/`;

  return await apiGetOld(endpoint);
};

export const getCustomerById = async (customerId) => {
  return await apiGetOld(`/api/admin/customers/${customerId}/`);
};

// Fetch multiple customers by IDs
export const getCustomersByIds = async (customerIds) => {
  if (!customerIds || customerIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(customerIds)];
  const idsParam = uniqueIds.join(',');

  return await apiGetOld(`/api/admin/customers/?ids=${idsParam}`);
};
