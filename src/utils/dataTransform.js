export const apiToLocal = (apiData) => {
  if (!apiData) return null;

  // Status is now a direct field (not in config)
  const extractedStatus = apiData.status || "draft";

  return {
    id: apiData.id, // MongoDB ObjectId - unique per version, used for updates
    form_id: apiData.template_id, // UUID - shared across versions, used for display
    template_id: apiData.template_id, // Keep template_id for reference
    "from-name": apiData.template_name || "",
    template_name: apiData.template_name,
    form_json: apiData.form_json || {},
    // New DLMS API returns customer_id as integer (FK to old API)
    customer_id: apiData.customer_id || apiData.customer || (typeof apiData.customer === 'object' ? apiData.customer?.id : null),
    // customer_name is now saved directly in the API response
    customer_name: apiData.customer_name || (typeof apiData.customer === 'object' ? apiData.customer?.customer_name : null),
    // Status is now a direct field (API contract changed)
    status: extractedStatus,
    version: apiData.version || null,
    description: apiData.description || "",
    platforms: apiData.platforms || [],
    is_active: apiData.is_active !== undefined ? apiData.is_active : true,
    created_at: apiData.created_at,
    updated_at: apiData.modified_at || apiData.updated_at,
    form_type: apiData.form_json?.sections ? "multi-step" : "single",
    sections: apiData.form_json?.sections || null,
  };
};

