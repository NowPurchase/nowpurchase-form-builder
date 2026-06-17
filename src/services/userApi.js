import { apiGetOld } from './api';

// Fetch a single user by ID
export const getUserById = async (userId) => {
  try {
    const response = await apiGetOld(`/api/r/users/${userId}/`);
    if (response) {
      return {
        id: response.id || response.user_id,
        name: response.name || response.username || `User ${response.id}`,
        email: response.email || '',
        mobile: response.mobile || ''
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    return null;
  }
};

// Fetch users from NowPurchase API
export const getUsers = async (search = '') => {
  try {
    // Construct query params
    const params = new URLSearchParams();

    if (search) {
      params.append('search', search);
    }

    const queryString = params.toString();
    const endpoint = `/api/r/users/${queryString ? `?${queryString}` : ''}`;

    const response = await apiGetOld(endpoint);

    // Response format: { results: [...users], count: number }
    // Transform to frontend format with user_id, name, customer_id, and company_name
    if (response?.results && Array.isArray(response.results)) {
      return response.results.map(user => ({
        id: user.id || user.user_id,
        name: user.name || user.username || `User ${user.id}`,
        email: user.email || '',
        mobile: user.mobile || '',
        customer_id: user.customer?.id || user.customer_id || '',
        company_name: user.customer?.company_name || ''
      }));
    }

    // Fallback: if response is directly an array
    if (Array.isArray(response)) {
      return response.map(user => ({
        id: user.id || user.user_id,
        name: user.name || user.username || `User ${user.id}`,
        email: user.email || '',
        mobile: user.mobile || '',
        customer_id: user.customer?.id || user.customer_id || '',
        company_name: user.customer?.company_name || ''
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};
