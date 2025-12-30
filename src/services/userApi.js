import { apiGetOld } from './api';

// Fetch users from NowPurchase API
export const getUsers = async (search = '') => {
  try {
    // Construct query params
    const params = new URLSearchParams();

    // Hardcoded customer ID filter
    const allowedCustomerIds = [243, 441];
    allowedCustomerIds.forEach(customerId => {
      params.append("customer_id", customerId);
    });

    if (search) {
      params.append('search', search);
    }

    const queryString = params.toString();
    const endpoint = `/api/r/users/${queryString ? `?${queryString}` : ''}`;

    const response = await apiGetOld(endpoint);

    // Response format: { results: [...users], count: number }
    // Transform to frontend format with user_id and name
    if (response?.results && Array.isArray(response.results)) {
      return response.results.map(user => ({
        id: user.id || user.user_id,
        name: user.name || user.username || `User ${user.id}`,
        email: user.email || '',
        mobile: user.mobile || ''
      }));
    }

    // Fallback: if response is directly an array
    if (Array.isArray(response)) {
      return response.map(user => ({
        id: user.id || user.user_id,
        name: user.name || user.username || `User ${user.id}`,
        email: user.email || '',
        mobile: user.mobile || ''
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};
