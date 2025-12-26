import { apiGet, apiPost } from './api';

// Fetch templates from API
export const getTemplatesDropdown = async () => {
  try {
    const response = await apiGet('/api/v1/templates?page_no=1&page_size=100');

    // Response is an array of template objects
    // Extract id, template_name, and version from each
    if (Array.isArray(response)) {
      return response.map(template => ({
        id: template.id,
        template_name: template.template_name,
        version: template.version
      }));
    }

    // If response has a results array (paginated response)
    if (response?.results && Array.isArray(response.results)) {
      return response.results.map(template => ({
        id: template.id,
        template_name: template.template_name,
        version: template.version
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

// Fetch user permissions from API
export const getUserPermissions = async () => {
  try {
    const response = await apiGet('/api/v1/user-permissions');

    // Extract permissions from response
    return response?.permissions || {};
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    // Return empty object if no permissions exist yet (404 or other errors)
    return {};
  }
};

// Save user permissions to API
export const saveUserPermissions = async (permissions) => {
  try {
    const response = await apiPost('/api/v1/user-permissions', permissions);
    return response;
  } catch (error) {
    console.error('Error saving user permissions:', error);
    throw error;
  }
};
