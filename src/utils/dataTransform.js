export const apiToLocal = (apiData) => {
  if (!apiData) return null;

  return {
    form_id: apiData.id,
    "from-name": apiData.template_name || "",
    template_name: apiData.template_name,
    form_json: apiData.form_json || {},
    // API returns customer as number (id) and customer_name as direct field
    customer_id: apiData.customer || (typeof apiData.customer === 'object' ? apiData.customer?.id : null),
    customer_name: apiData.customer_name || (typeof apiData.customer === 'object' ? apiData.customer?.customer_name : null),
    status: apiData.status || "draft",
    version: apiData.version || null,
    created_at: apiData.created_at,
    updated_at: apiData.modified_at || apiData.updated_at,
    form_type: apiData.form_json?.sections ? "multi-step" : "single",
    sections: apiData.form_json?.sections || null,
  };
};

