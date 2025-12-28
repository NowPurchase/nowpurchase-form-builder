import { apiGet, apiPatch } from './api';

const BASE_ENDPOINT = '/api/v1/templates';

/**
 * Fetch a single template by ID for configuration
 * @param {string} templateId - Template UUID
 * @returns {Promise<Object>} Template data
 */
export const getTemplateForConfig = async (templateId) => {
  try {
    const response = await apiGet(`${BASE_ENDPOINT}/${templateId}`);
    return response;
  } catch (error) {
    console.error('Error fetching template for config:', error);
    throw error;
  }
};

/**
 * Update template configuration (config and/or route)
 * @param {string} templateId - Template UUID
 * @param {Object} updates - { config?, route? }
 * @returns {Promise<Object>} Updated template data
 */
export const patchTemplateConfig = async (templateId, updates) => {
  try {
    const response = await apiPatch(`${BASE_ENDPOINT}/${templateId}`, updates);
    return response;
  } catch (error) {
    console.error('Error updating template config:', error);
    throw error;
  }
};

/**
 * Fetch all templates for workflow dropdown
 * @param {string} excludeId - Template ID to exclude (current template)
 * @returns {Promise<Array>} List of templates
 */
export const getTemplatesForWorkflow = async (excludeId = null) => {
  try {
    const response = await apiGet(`${BASE_ENDPOINT}?page_size=1000`);
    // Handle both array response and paginated response with results
    let templates = Array.isArray(response) ? response : (response.results || []);

    // Exclude current template
    if (excludeId) {
      templates = templates.filter(t => t.template_id !== excludeId);
    }

    // Format for dropdown
    return templates.map(template => ({
      value: template.template_id, // Store template_id as value
      label: template.template_name,
      template_id: template.template_id,
      template_name: template.template_name,
      version: template.version,
      collection_name_slug: template.collection_name_slug
    }));
  } catch (error) {
    console.error('Error fetching templates for workflow:', error);
    throw error;
  }
};
