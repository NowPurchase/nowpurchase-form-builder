import { apiGet, apiPost } from './api';

// Fetch templates from API
export const getTemplatesDropdown = async () => {
  try {
    const response = await apiGet('/api/v1/templates?page_no=1&page_size=100');

    // Response is an array of template objects
    // Use template_id as the stable unique identifier (persists across clones/versions)
    const mapTemplate = (template) => ({
      id: template.template_id,
      template_name: template.template_name,
      version: template.version
    });

    // Filter out invalid templates (must have template_id and template_name)
    const filterValid = (template) => template.template_id && template.template_name;

    if (Array.isArray(response)) {
      return response.filter(filterValid).map(mapTemplate);
    }

    // If response has a results array (paginated response)
    if (response?.results && Array.isArray(response.results)) {
      return response.results.filter(filterValid).map(mapTemplate);
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

    // Response format: { users: [...], total: number }
    // Transform to frontend format: {userId: {isAdmin: bool, permissions: {...}}}
    if (response?.users && Array.isArray(response.users)) {
      const transformedData = {};
      response.users.forEach(user => {
        if (user.user_id) {
          transformedData[user.user_id] = {
            isAdmin: user.is_admin || false,
            permissions: user.permissions || {}
          };
        }
      });
      return transformedData;
    }

    // Fallback: if response is directly an array (for backward compatibility)
    if (Array.isArray(response)) {
      const transformedData = {};
      response.forEach(user => {
        if (user.user_id) {
          transformedData[user.user_id] = {
            isAdmin: user.is_admin || false,
            permissions: user.permissions || {}
          };
        }
      });
      return transformedData;
    }

    // Fallback for empty response
    return {};
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    // Return empty object if no permissions exist yet (404 or other errors)
    return {};
  }
};

// Save user permissions to API
export const saveUserPermissions = async (permissionsData) => {
  try {
    // Transform from frontend format: {userId: {isAdmin: bool, permissions: {...}}}
    // To API format: {users: [{user_id: string, is_admin: bool, permissions: {...}}]}
    const users = Object.keys(permissionsData).map(userId => ({
      user_id: userId,
      is_admin: permissionsData[userId].isAdmin || false,
      permissions: permissionsData[userId].permissions || {}
    }));

    const payload = { users };
    const response = await apiPost('/api/v1/user-permissions', payload);
    return response;
  } catch (error) {
    console.error('Error saving user permissions:', error);
    throw error;
  }
};
