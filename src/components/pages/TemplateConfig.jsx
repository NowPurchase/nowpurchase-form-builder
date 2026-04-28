import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Monitor, Tablet, Smartphone, Download, Search, Filter } from 'lucide-react';
import { Button, Loader, Modal } from 'rsuite';
import ListingFieldsEditor from '../shared/ListingFieldsEditor';
import WorkflowRoutingEditor from '../shared/WorkflowRoutingEditor';
import ApproversEditor from '../shared/ApproversEditor';
import SearchFieldsEditor from '../shared/SearchFieldsEditor';
import ListingFiltersEditor from '../shared/ListingFiltersEditor';
import { getTemplateForConfig, patchTemplateConfig, getTemplatesForWorkflow } from '../../services/templateConfigApi';
import { toast } from '../shared/Toast';
import './TemplateConfig.css';

const TemplateConfig = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  // Template data
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config state
  const [webListingFields, setWebListingFields] = useState([]);
  const [kioskListingFields, setKioskListingFields] = useState([]);
  const [mobileListingFields, setMobileListingFields] = useState([]);
  const [exportFields, setExportFields] = useState([]);
  const [searchFields, setSearchFields] = useState([]);
  const [listingFilters, setListingFilters] = useState([]);
  const [approvers, setApprovers] = useState([]);

  // Route state
  const [nextTemplate, setNextTemplate] = useState(null);
  const [previousTemplate, setPreviousTemplate] = useState(null);
  const [pushFields, setPushFields] = useState([]);

  // General settings state
  const [platforms, setPlatforms] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [allowNewSubmissions, setAllowNewSubmissions] = useState(true);
  const [category, setCategory] = useState('master');
  const [isJinjaTemplate, setIsJinjaTemplate] = useState(false);
  const [htmlString, setHtmlString] = useState('');

  // Available templates for workflow
  const [availableTemplates, setAvailableTemplates] = useState([]);

  // Available fields from previous template's next_template_push_fields
  const [availablePushFields, setAvailablePushFields] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('web');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState({});
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Initial data refs
  const initialConfigRef = React.useRef(null);
  const initialRouteRef = React.useRef(null);
  const initialSettingsRef = React.useRef(null);

  // Fetch template data
  const fetchTemplateData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTemplateForConfig(templateId);
      setTemplate(data);

      // Set config fields
      const config = data.config || {};
      setWebListingFields(config.web_listing || []);
      setKioskListingFields(config.kiosk_listing || []);
      setMobileListingFields(config.mobile_listing || []);
      setExportFields(config.export_fields || []);
      setSearchFields(config.search_fields || []);
      setListingFilters(config.listing_filters || []);
      setApprovers(config.approvers || []);

      // Set route fields
      const route = data.route || {};
      setNextTemplate(route.next_template || null);
      setPreviousTemplate(route.previous_template || null);
      setPushFields(route.next_template_push_fields || []);

      // Set general settings
      setPlatforms(data.platforms || []);
      setShowCompleted(data.show_completed || false);
      setAllowNewSubmissions(data.allow_new_submissions !== undefined ? data.allow_new_submissions : true);
      setCategory(data.category || 'master'); // Default to 'master' if null
      setIsJinjaTemplate(data.is_jinja_template || false);
      setHtmlString(data.html_string || '');

      // Store initial values for comparison
      initialConfigRef.current = {
        web_listing: config.web_listing || [],
        kiosk_listing: config.kiosk_listing || [],
        mobile_listing: config.mobile_listing || [],
        export_fields: config.export_fields || [],
        search_fields: config.search_fields || [],
        listing_filters: config.listing_filters || [],
        approvers: config.approvers || []
      };

      initialRouteRef.current = {
        next_template: route.next_template || null,
        previous_template: route.previous_template || null,
        next_template_push_fields: route.next_template_push_fields || []
      };

      initialSettingsRef.current = {
        platforms: data.platforms || [],
        show_completed: data.show_completed || false,
        allow_new_submissions: data.allow_new_submissions !== undefined ? data.allow_new_submissions : true,
        category: data.category || 'master',
        is_jinja_template: data.is_jinja_template || false,
        html_string: data.html_string || ''
      };

    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template configuration');
      navigate('/home');
    } finally {
      setLoading(false);
    }
  }, [templateId, navigate]);

  // Fetch available templates for workflow
  const fetchAvailableTemplates = useCallback(async () => {
    try {
      const templates = await getTemplatesForWorkflow(templateId);
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, [templateId]);

  // Fetch previous template's push fields
  const fetchPreviousTemplatePushFields = useCallback(async () => {
    if (!previousTemplate) {
      setAvailablePushFields([]);
      return;
    }

    try {
      const prevTemplateData = await getTemplateForConfig(previousTemplate);
      const prevPushFields = prevTemplateData.route?.next_template_push_fields || [];
      setAvailablePushFields(prevPushFields);
    } catch (error) {
      console.error('Error fetching previous template push fields:', error);
      setAvailablePushFields([]);
    }
  }, [previousTemplate]);

  useEffect(() => {
    fetchTemplateData();
    fetchAvailableTemplates();
  }, [fetchTemplateData, fetchAvailableTemplates]);

  // Fetch previous template's push fields when previousTemplate changes
  useEffect(() => {
    fetchPreviousTemplatePushFields();
  }, [fetchPreviousTemplatePushFields]);

  // Track unsaved changes
  useEffect(() => {
    if (!initialConfigRef.current || !initialRouteRef.current || !initialSettingsRef.current) return;

    const configChanged =
      JSON.stringify(webListingFields) !== JSON.stringify(initialConfigRef.current.web_listing) ||
      JSON.stringify(kioskListingFields) !== JSON.stringify(initialConfigRef.current.kiosk_listing) ||
      JSON.stringify(mobileListingFields) !== JSON.stringify(initialConfigRef.current.mobile_listing) ||
      JSON.stringify(exportFields) !== JSON.stringify(initialConfigRef.current.export_fields) ||
      JSON.stringify(searchFields) !== JSON.stringify(initialConfigRef.current.search_fields) ||
      JSON.stringify(listingFilters) !== JSON.stringify(initialConfigRef.current.listing_filters) ||
      JSON.stringify(approvers) !== JSON.stringify(initialConfigRef.current.approvers);

    const routeChanged =
      nextTemplate !== initialRouteRef.current.next_template ||
      previousTemplate !== initialRouteRef.current.previous_template ||
      JSON.stringify(pushFields) !== JSON.stringify(initialRouteRef.current.next_template_push_fields);

    const settingsChanged =
      JSON.stringify(platforms) !== JSON.stringify(initialSettingsRef.current.platforms) ||
      showCompleted !== initialSettingsRef.current.show_completed ||
      allowNewSubmissions !== initialSettingsRef.current.allow_new_submissions ||
      category !== initialSettingsRef.current.category ||
      isJinjaTemplate !== initialSettingsRef.current.is_jinja_template ||
      htmlString !== initialSettingsRef.current.html_string;

    setHasUnsavedChanges(configChanged || routeChanged || settingsChanged);
  }, [webListingFields, kioskListingFields, mobileListingFields, exportFields, searchFields, listingFilters, approvers, nextTemplate, previousTemplate, pushFields, platforms, showCompleted, allowNewSubmissions, category, isJinjaTemplate, htmlString]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Leave anyway?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Validate configuration
  const validateConfig = () => {
    const newErrors = {};

    // Validate each platform's fields
    const validatePlatformFields = (fields, platform) => {
      fields.forEach((field, index) => {
        if (!field.label || !field.label.trim()) {
          if (!newErrors[platform]) newErrors[platform] = {};
          if (!newErrors[platform][index]) newErrors[platform][index] = {};
          newErrors[platform][index].label = 'Label is required';
        }
        if (!field.key || !field.key.trim()) {
          if (!newErrors[platform]) newErrors[platform] = {};
          if (!newErrors[platform][index]) newErrors[platform][index] = {};
          newErrors[platform][index].key = 'Key is required';
        }
      });
    };

    validatePlatformFields(webListingFields, 'web');
    validatePlatformFields(kioskListingFields, 'kiosk');
    validatePlatformFields(mobileListingFields, 'mobile');

    // Validate approvers
    approvers.forEach((approver, index) => {
      if (!approver.id || !approver.id.trim()) {
        if (!newErrors.approvers) newErrors.approvers = {};
        if (!newErrors.approvers[index]) newErrors.approvers[index] = {};
        newErrors.approvers[index].id = 'Approver is required';
      }
    });

    // Prevent self-reference in workflow
    if (nextTemplate === templateId) {
      newErrors.next_template = 'Cannot select the same template as next step';
    }

    if (previousTemplate === templateId) {
      newErrors.previous_template = 'Cannot select the same template as previous step';
    }

    // Prevent direct circular dependency (A -> B and B -> A)
    if (nextTemplate && previousTemplate && nextTemplate === previousTemplate) {
      newErrors.next_template = 'Next and previous template cannot be the same';
      newErrors.previous_template = 'Next and previous template cannot be the same';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Prepare request body
  const prepareRequestBody = () => {
    const body = {};

    // Check if config changed
    const configChanged =
      JSON.stringify(webListingFields) !== JSON.stringify(initialConfigRef.current.web_listing) ||
      JSON.stringify(kioskListingFields) !== JSON.stringify(initialConfigRef.current.kiosk_listing) ||
      JSON.stringify(mobileListingFields) !== JSON.stringify(initialConfigRef.current.mobile_listing) ||
      JSON.stringify(exportFields) !== JSON.stringify(initialConfigRef.current.export_fields) ||
      JSON.stringify(searchFields) !== JSON.stringify(initialConfigRef.current.search_fields) ||
      JSON.stringify(listingFilters) !== JSON.stringify(initialConfigRef.current.listing_filters) ||
      JSON.stringify(approvers) !== JSON.stringify(initialConfigRef.current.approvers);

    if (configChanged) {
      body.config = {
        web_listing: webListingFields,
        kiosk_listing: kioskListingFields,
        mobile_listing: mobileListingFields,
        export_fields: exportFields,
        search_fields: searchFields,
        listing_filters: listingFilters,
        approvers: approvers
      };
    }

    // Check if route changed
    const routeChanged =
      nextTemplate !== initialRouteRef.current.next_template ||
      previousTemplate !== initialRouteRef.current.previous_template ||
      JSON.stringify(pushFields) !== JSON.stringify(initialRouteRef.current.next_template_push_fields);

    if (routeChanged) {
      body.route = {
        next_template: nextTemplate,
        previous_template: previousTemplate,
        next_template_push_fields: pushFields
      };
    }

    // Check if settings changed
    const platformsChanged = JSON.stringify(platforms) !== JSON.stringify(initialSettingsRef.current.platforms);
    const showCompletedChanged = showCompleted !== initialSettingsRef.current.show_completed;
    const allowNewSubmissionsChanged = allowNewSubmissions !== initialSettingsRef.current.allow_new_submissions;
    const categoryChanged = category !== initialSettingsRef.current.category;
    const isJinjaTemplateChanged = isJinjaTemplate !== initialSettingsRef.current.is_jinja_template;
    const htmlStringChanged = htmlString !== initialSettingsRef.current.html_string;

    // Always send boolean fields with explicit true/false values, even if unchanged
    const settingsChanged = platformsChanged || showCompletedChanged || allowNewSubmissionsChanged || categoryChanged || isJinjaTemplateChanged || htmlStringChanged;

    if (settingsChanged) {
      if (platformsChanged) {
        body.platforms = platforms;
      }
      // Always include boolean fields when any setting changes to ensure explicit true/false values
      body.show_completed = showCompleted;
      body.allow_new_submissions = allowNewSubmissions;

      if (categoryChanged) {
        body.category = category;
      }

      if (isJinjaTemplateChanged) {
        body.is_jinja_template = isJinjaTemplate;
      }

      if (htmlStringChanged) {
        body.html_string = htmlString;
        body.fetch_html = false; // Don't fetch from Google Sheets when manually setting HTML
      }
    }

    return body;
  };

  // Save configuration
  const handleSave = async () => {
    // Validate
    if (!validateConfig()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    const requestBody = prepareRequestBody();

    // Check if there are any changes
    if (Object.keys(requestBody).length === 0) {
      toast.warning('No changes to save');
      return;
    }

    try {
      setSaving(true);
      const updatedTemplate = await patchTemplateConfig(templateId, requestBody);

      // Update local state with new data
      setTemplate(updatedTemplate);

      // Update initial refs
      const config = updatedTemplate.config || {};
      initialConfigRef.current = {
        web_listing: config.web_listing || [],
        kiosk_listing: config.kiosk_listing || [],
        mobile_listing: config.mobile_listing || [],
        export_fields: config.export_fields || [],
        search_fields: config.search_fields || [],
        listing_filters: config.listing_filters || [],
        approvers: config.approvers || []
      };

      // Update config state with new values
      setExportFields(config.export_fields || []);
      setSearchFields(config.search_fields || []);
      setListingFilters(config.listing_filters || []);
      setApprovers(config.approvers || []);

      const route = updatedTemplate.route || {};
      initialRouteRef.current = {
        next_template: route.next_template || null,
        previous_template: route.previous_template || null,
        next_template_push_fields: route.next_template_push_fields || []
      };

      initialSettingsRef.current = {
        platforms: updatedTemplate.platforms || [],
        show_completed: updatedTemplate.show_completed || false,
        allow_new_submissions: updatedTemplate.allow_new_submissions !== undefined ? updatedTemplate.allow_new_submissions : true,
        category: updatedTemplate.category || 'master',
        is_jinja_template: updatedTemplate.is_jinja_template || false,
        html_string: updatedTemplate.html_string || ''
      };

      // Update local state with new values
      setIsJinjaTemplate(updatedTemplate.is_jinja_template || false);
      setHtmlString(updatedTemplate.html_string || '');

      setHasUnsavedChanges(false);
      toast.success(`Configuration updated to version ${updatedTemplate.version}`);

    } catch (error) {
      console.error('Error saving config:', error);

      // Handle validation errors
      if (error.details && typeof error.details === 'object') {
        setErrors(error.details);
      }

      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation('/home');
      setShowUnsavedModal(true);
    } else {
      navigate('/home');
    }
  };

  // Confirm discard changes
  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  };

  if (loading) {
    return (
      <div className="template-config-loading">
        <Loader size="md" content="Loading template configuration..." />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="template-config-page">
      <div className="template-config-header">
        <button className="back-button" onClick={handleCancel}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="template-config-title">
          <h1>Template Configuration</h1>
          <div className="template-info">
            <span className="template-name">{template.template_name}</span>
            <span className="template-version">v{template.version}</span>
            {template.updated_at && (
              <span className="template-updated">
                Last updated: {new Date(template.updated_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="template-config-content">
        {/* General Settings Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">⚙️</div>
            <div>
              <h2>General Settings</h2>
              <p>Configure template platforms, visibility, and category</p>
            </div>
          </div>

          <div className="settings-container">
            <div className="settings-row">
              {/* Platforms */}
              <div className="settings-field">
                <label className="field-label">Platforms</label>
                <div className="platform-checkboxes">
                  <label className="platform-checkbox">
                    <input
                      type="checkbox"
                      checked={platforms.includes('web')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPlatforms([...platforms, 'web']);
                        } else {
                          setPlatforms(platforms.filter(p => p !== 'web'));
                        }
                      }}
                    />
                    <span className="checkbox-label">Web</span>
                  </label>
                  <label className="platform-checkbox">
                    <input
                      type="checkbox"
                      checked={platforms.includes('kiosk')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPlatforms([...platforms, 'kiosk']);
                        } else {
                          setPlatforms(platforms.filter(p => p !== 'kiosk'));
                        }
                      }}
                    />
                    <span className="checkbox-label">Kiosk</span>
                  </label>
                  <label className="platform-checkbox">
                    <input
                      type="checkbox"
                      checked={platforms.includes('mobile')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPlatforms([...platforms, 'mobile']);
                        } else {
                          setPlatforms(platforms.filter(p => p !== 'mobile'));
                        }
                      }}
                    />
                    <span className="checkbox-label">Mobile</span>
                  </label>
                </div>
              </div>

              {/* Category */}
              <div className="settings-field">
                <label className="field-label">Category</label>
                <div className="category-buttons">
                  <button
                    type="button"
                    className={`category-btn ${category === 'master' ? 'active' : ''}`}
                    onClick={() => setCategory('master')}
                  >
                    Master
                  </button>
                  <button
                    type="button"
                    className={`category-btn ${category === 'operational' ? 'active' : ''}`}
                    onClick={() => setCategory('operational')}
                  >
                    Operational
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-row">
              {/* Show Completed */}
              <div className="settings-field">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="settings-checkbox"
                  />
                  <span>Show completed logsheets</span>
                </label>
                <p className="field-hint">Display completed entries in the listing</p>
              </div>

              {/* Allow New Submissions */}
              <div className="settings-field">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={allowNewSubmissions}
                    onChange={(e) => setAllowNewSubmissions(e.target.checked)}
                    className="settings-checkbox"
                  />
                  <span>Allow new submission from kiosk</span>
                </label>
                <p className="field-hint">Enable users to create new entries from kiosk platform</p>
              </div>
            </div>

            <div className="settings-row">
              {/* Is Jinja Template */}
              <div className="settings-field">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={isJinjaTemplate}
                    onChange={(e) => setIsJinjaTemplate(e.target.checked)}
                    className="settings-checkbox"
                  />
                  <span>Use Jinja2 Template for Preview</span>
                </label>
                <p className="field-hint">Enable Jinja2/Django-style variable replacement in HTML preview</p>
              </div>
            </div>

            {/* HTML Template */}
            <div className="settings-row" style={{ flexDirection: 'column' }}>
              <div className="settings-field" style={{ width: '100%' }}>
                <label className="field-label">HTML Template</label>
                <p className="field-hint" style={{ marginBottom: '8px' }}>
                  Paste your HTML template here. Use {'{{ variable_name }}'} syntax for dynamic values.
                </p>
                <textarea
                  value={htmlString}
                  onChange={(e) => setHtmlString(e.target.value)}
                  placeholder="Paste your HTML template here..."
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Listing & Export Configuration Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">📊</div>
            <div>
              <h2>Display & Export Configuration</h2>
              <p>Configure columns for platform listings and CSV/Excel export</p>
            </div>
          </div>

          <div className="platform-tabs">
            <button
              className={`platform-tab ${activeTab === 'web' ? 'active' : ''}`}
              onClick={() => setActiveTab('web')}
            >
              <Monitor size={18} />
              Web Listing
            </button>
            <button
              className={`platform-tab ${activeTab === 'kiosk' ? 'active' : ''}`}
              onClick={() => setActiveTab('kiosk')}
            >
              <Tablet size={18} />
              Kiosk Listing
            </button>
            <button
              className={`platform-tab ${activeTab === 'mobile' ? 'active' : ''}`}
              onClick={() => setActiveTab('mobile')}
            >
              <Smartphone size={18} />
              Mobile Listing
            </button>
            <button
              className={`platform-tab ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <Download size={18} />
              Export Fields
            </button>
          </div>

          <div className="platform-content">
            {activeTab === 'web' && (
              <ListingFieldsEditor
                platform="web"
                fields={webListingFields}
                onChange={setWebListingFields}
                errors={errors.web || {}}
              />
            )}
            {activeTab === 'kiosk' && (
              <ListingFieldsEditor
                platform="kiosk"
                fields={kioskListingFields}
                onChange={setKioskListingFields}
                errors={errors.kiosk || {}}
              />
            )}
            {activeTab === 'mobile' && (
              <ListingFieldsEditor
                platform="mobile"
                fields={mobileListingFields}
                onChange={setMobileListingFields}
                errors={errors.mobile || {}}
              />
            )}
            {activeTab === 'export' && (
              <div className="export-fields-wrapper">
                <p className="export-fields-hint">
                  Configure fields to include when exporting logsheets to CSV or Excel format.
                </p>
                <ListingFieldsEditor
                  platform="export"
                  fields={exportFields}
                  onChange={setExportFields}
                  errors={errors.export || {}}
                />
              </div>
            )}
          </div>
        </section>

        {/* Search Configuration Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">
              <Search size={20} />
            </div>
            <div>
              <h2>Search Configuration</h2>
              <p>Configure which fields can be searched in logsheet listings</p>
            </div>
          </div>

          <SearchFieldsEditor
            fields={searchFields}
            onChange={setSearchFields}
          />
        </section>

        {/* Listing Filters Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">
              <Filter size={20} />
            </div>
            <div>
              <h2>Listing Filters</h2>
              <p>Configure filter options for logsheet listings</p>
            </div>
          </div>

          <ListingFiltersEditor
            filters={listingFilters}
            onChange={setListingFilters}
          />
        </section>

        {/* Workflow Routing Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">🔗</div>
            <div>
              <h2>Workflow Routing</h2>
              <p>Configure workflow chaining and data propagation between templates</p>
            </div>
          </div>

          <WorkflowRoutingEditor
            nextTemplate={nextTemplate}
            previousTemplate={previousTemplate}
            pushFields={pushFields}
            availableTemplates={availableTemplates}
            availablePushFields={availablePushFields}
            onNextTemplateChange={setNextTemplate}
            onPreviousTemplateChange={setPreviousTemplate}
            onPushFieldsChange={setPushFields}
            currentTemplateId={templateId}
            errors={errors}
          />
        </section>

        {/* Approval Workflow Section */}
        <section className="config-section">
          <div className="section-header">
            <div className="section-icon">✅</div>
            <div>
              <h2>Approval Workflow</h2>
              <p>Configure multi-level approval process for logsheets before completion</p>
            </div>
          </div>

          <ApproversEditor
            approvers={approvers}
            onChange={setApprovers}
            errors={errors.approvers || {}}
          />
        </section>
      </div>

      {/* Footer Actions */}
      <div className="template-config-footer">
        <div className="footer-info">
          {hasUnsavedChanges && <span className="unsaved-indicator">● Unsaved changes</span>}
        </div>
        <div className="footer-actions">
          <Button appearance="subtle" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!hasUnsavedChanges}
            startIcon={<Save size={16} />}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      <Modal open={showUnsavedModal} onClose={() => setShowUnsavedModal(false)} size="xs">
        <Modal.Header>
          <Modal.Title>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes. Are you sure you want to leave without saving?
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowUnsavedModal(false)} appearance="subtle">
            Cancel
          </Button>
          <Button onClick={handleDiscardChanges} appearance="primary" color="red">
            Discard Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TemplateConfig;
