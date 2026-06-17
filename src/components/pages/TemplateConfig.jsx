import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  ChevronDown,
  Loader2,
  Settings2,
  Workflow,
  Filter,
  Search,
  Layers,
  GitBranch,
  Users,
  Sparkles,
  Code2,
  FileSpreadsheet,
  GripVertical,
  X,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { Modal } from 'rsuite';
import ListingFieldsEditor from '../shared/ListingFieldsEditor';
import WorkflowRoutingEditor from '../shared/WorkflowRoutingEditor';
import ApproversEditor from '../shared/ApproversEditor';
import SearchFieldsEditor from '../shared/SearchFieldsEditor';
import ListingFiltersEditor from '../shared/ListingFiltersEditor';
import { getTemplateForConfig, patchTemplateConfig, getTemplatesForWorkflow } from '../../services/adminTemplateApi';
import { toast } from '../shared/Toast';

const NAV = [
  { id: 'general', label: 'General', icon: Settings2, hint: 'Basics & platforms' },
  { id: 'flow', label: 'Flow', icon: Workflow, hint: 'Batch · Fan out · Split' },
  { id: 'display', label: 'Display & Export', icon: Layers, hint: 'Columns and exports' },
  { id: 'search', label: 'Search Fields', icon: Search, hint: 'Searchable paths' },
  { id: 'filters', label: 'Listing Filters', icon: Filter, hint: 'Filter the listing' },
  { id: 'routing', label: 'Workflow Routing', icon: GitBranch, hint: 'Prev / next templates' },
  { id: 'approvers', label: 'Approvers', icon: Users, hint: 'Approval chain' },
];

const TemplateConfig = () => {
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customer_id');
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  const [webListingFields, setWebListingFields] = useState([]);
  const [kioskListingFields, setKioskListingFields] = useState([]);
  const [mobileListingFields, setMobileListingFields] = useState([]);
  const [exportFields, setExportFields] = useState([]);
  const [searchFields, setSearchFields] = useState([]);
  const [listingFilters, setListingFilters] = useState([]);
  const [approvers, setApprovers] = useState([]);

  const [nextTemplate, setNextTemplate] = useState(null);
  const [previousTemplate, setPreviousTemplate] = useState(null);
  const [pushFields, setPushFields] = useState([]);

  const [platforms, setPlatforms] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [allowNewSubmissions, setAllowNewSubmissions] = useState(true);
  const [allowReject, setAllowReject] = useState(false);
  const [category, setCategory] = useState('master');
  const [isJinjaTemplate, setIsJinjaTemplate] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [htmlString, setHtmlString] = useState('');

  const [batchMode, setBatchMode] = useState(false);
  const [batchInputField, setBatchInputField] = useState('');
  const [fanOutOnComplete, setFanOutOnComplete] = useState(false);
  const [splitOnComplete, setSplitOnComplete] = useState(false);
  const [splitField, setSplitField] = useState('');
  const [groupingMode, setGroupingMode] = useState(false);
  const [groupingField, setGroupingField] = useState('');

  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [availablePushFields, setAvailablePushFields] = useState([]);

  const [activeTab, setActiveTab] = useState('web');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState({});
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const initialConfigRef = React.useRef(null);
  const initialRouteRef = React.useRef(null);
  const initialSettingsRef = React.useRef(null);

  const fetchTemplateData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTemplateForConfig(templateId, customerId);
      setTemplate(data);

      const config = data.config || {};
      setWebListingFields(config.web_listing || []);
      setKioskListingFields(config.kiosk_listing || []);
      setMobileListingFields(config.mobile_listing || []);
      setExportFields(config.export_fields || []);
      setSearchFields(config.search_fields || []);
      setListingFilters(config.listing_filters || []);
      setApprovers(config.approvers || []);

      const route = data.route || {};
      setNextTemplate(route.next_template || null);
      setPreviousTemplate(route.previous_template || null);
      setPushFields(route.next_template_push_fields || []);

      setPlatforms(data.platforms || []);
      setShowCompleted(data.show_completed || false);
      setAllowNewSubmissions(data.allow_new_submissions !== undefined ? data.allow_new_submissions : true);
      setAllowReject(data.allow_reject || false);
      setCategory(data.category || 'master');
      setIsJinjaTemplate(data.is_jinja_template || false);
      setIsPreview(data.has_preview || false);
      setHtmlString(data.html_string || '');

      setBatchMode(data.batch_mode || false);
      setBatchInputField(data.batch_input_field || '');
      setFanOutOnComplete(data.fan_out_on_complete || false);
      setSplitOnComplete(data.split_on_complete || false);
      setSplitField(data.split_field || '');
      setGroupingMode(data.grouping_mode || false);
      setGroupingField(data.grouping_field || '');

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
        allow_reject: data.allow_reject || false,
        category: data.category || 'master',
        is_jinja_template: data.is_jinja_template || false,
        has_preview: data.has_preview || false,
        html_string: data.html_string || '',
        batch_mode: data.batch_mode || false,
        batch_input_field: data.batch_input_field || '',
        fan_out_on_complete: data.fan_out_on_complete || false,
        split_on_complete: data.split_on_complete || false,
        split_field: data.split_field || '',
        grouping_mode: data.grouping_mode || false,
        grouping_field: data.grouping_field || ''
      };

    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template configuration');
      navigate('/home');
    } finally {
      setLoading(false);
    }
  }, [templateId, navigate]);

  const fetchAvailableTemplates = useCallback(async () => {
    try {
      const templates = await getTemplatesForWorkflow(templateId);
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, [templateId]);

  const fetchPreviousTemplatePushFields = useCallback(async () => {
    if (!previousTemplate) {
      setAvailablePushFields([]);
      return;
    }
    try {
      const prevTemplateData = await getTemplateForConfig(previousTemplate, customerId);
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

  useEffect(() => {
    fetchPreviousTemplatePushFields();
  }, [fetchPreviousTemplatePushFields]);

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
      allowReject !== initialSettingsRef.current.allow_reject ||
      category !== initialSettingsRef.current.category ||
      isJinjaTemplate !== initialSettingsRef.current.is_jinja_template ||
      isPreview !== initialSettingsRef.current.has_preview ||
      htmlString !== initialSettingsRef.current.html_string ||
      batchMode !== initialSettingsRef.current.batch_mode ||
      batchInputField !== initialSettingsRef.current.batch_input_field ||
      fanOutOnComplete !== initialSettingsRef.current.fan_out_on_complete ||
      splitOnComplete !== initialSettingsRef.current.split_on_complete ||
      splitField !== initialSettingsRef.current.split_field ||
      groupingMode !== initialSettingsRef.current.grouping_mode ||
      groupingField !== initialSettingsRef.current.grouping_field;

    setHasUnsavedChanges(configChanged || routeChanged || settingsChanged);
  }, [webListingFields, kioskListingFields, mobileListingFields, exportFields, searchFields, listingFilters, approvers, nextTemplate, previousTemplate, pushFields, platforms, showCompleted, allowNewSubmissions, allowReject, category, isJinjaTemplate, isPreview, htmlString, batchMode, batchInputField, fanOutOnComplete, splitOnComplete, splitField, groupingMode, groupingField]);

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

  const validateConfig = () => {
    const newErrors = {};

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
    validatePlatformFields(exportFields, 'export');

    searchFields.forEach((field, index) => {
      if (!field || !field.trim()) {
        if (!newErrors.search_fields) newErrors.search_fields = {};
        newErrors.search_fields[index] = 'Field path is required';
      }
    });

    listingFilters.forEach((filter, index) => {
      if (!newErrors.listing_filters) newErrors.listing_filters = {};
      if (!newErrors.listing_filters[index]) newErrors.listing_filters[index] = {};

      if (!filter.id || !filter.id.trim()) {
        newErrors.listing_filters[index].id = 'Filter ID is required';
      }
      if (!filter.label || !filter.label.trim()) {
        newErrors.listing_filters[index].label = 'Label is required';
      }
      if (!filter.field || !filter.field.trim()) {
        newErrors.listing_filters[index].field = 'Field path is required';
      }
      if (filter.options && Array.isArray(filter.options)) {
        filter.options.forEach((opt, optIndex) => {
          if (!opt.label || !opt.value === undefined) {
            if (!newErrors.listing_filters[index].options) newErrors.listing_filters[index].options = {};
            newErrors.listing_filters[index].options[optIndex] = 'Option needs label and value';
          }
        });
      }
      if (Object.keys(newErrors.listing_filters[index]).length === 0) {
        delete newErrors.listing_filters[index];
      }
    });
    if (newErrors.listing_filters && Object.keys(newErrors.listing_filters).length === 0) {
      delete newErrors.listing_filters;
    }

    approvers.forEach((approver, index) => {
      if (!approver.id || !approver.id.trim()) {
        if (!newErrors.approvers) newErrors.approvers = {};
        if (!newErrors.approvers[index]) newErrors.approvers[index] = {};
        newErrors.approvers[index].id = 'Approver is required';
      }
      if (!['end', 'next_approver'].includes(approver.on_approve)) {
        if (!newErrors.approvers) newErrors.approvers = {};
        if (!newErrors.approvers[index]) newErrors.approvers[index] = {};
        newErrors.approvers[index].on_approve = 'Must be "end" or "next_approver"';
      }
      if (!['end', 'next_approver'].includes(approver.on_reject)) {
        if (!newErrors.approvers) newErrors.approvers = {};
        if (!newErrors.approvers[index]) newErrors.approvers[index] = {};
        newErrors.approvers[index].on_reject = 'Must be "end" or "next_approver"';
      }
    });

    if (nextTemplate === templateId) newErrors.next_template = 'Cannot select the same template';
    if (previousTemplate === templateId) newErrors.previous_template = 'Cannot select the same template';
    if (nextTemplate && previousTemplate && nextTemplate === previousTemplate) {
      newErrors.next_template = 'Next and previous cannot be the same';
      newErrors.previous_template = 'Next and previous cannot be the same';
    }

    if (batchMode && (!batchInputField || !batchInputField.trim())) {
      newErrors.batch_input_field = 'Batch input field is required when batch mode is enabled';
    }
    if (splitOnComplete && (!splitField || !splitField.trim())) {
      newErrors.split_field = 'Split field is required when split on complete is enabled';
    }
    if (groupingMode && (!groupingField || !groupingField.trim())) {
      newErrors.grouping_field = 'Grouping field is required when grouping mode is enabled';
    }

    if (!platforms || platforms.length === 0) {
      newErrors.platforms = 'At least one platform must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const prepareRequestBody = () => {
    const body = {
      config: {
        web_listing: webListingFields,
        kiosk_listing: kioskListingFields,
        mobile_listing: mobileListingFields,
        export_fields: exportFields,
        search_fields: searchFields,
        listing_filters: listingFilters,
        approvers: approvers
      },
      route: {
        next_template: nextTemplate,
        previous_template: previousTemplate,
        next_template_push_fields: pushFields
      },
      platforms,
      show_completed: showCompleted,
      allow_new_submissions: allowNewSubmissions,
      allow_reject: allowReject,
      batch_mode: batchMode,
      fan_out_on_complete: fanOutOnComplete,
      split_on_complete: splitOnComplete,
      grouping_mode: groupingMode,
      batch_input_field: batchInputField,
      split_field: splitField,
      grouping_field: groupingField,
      category,
      is_jinja_template: isJinjaTemplate,
      has_preview: isPreview,
      html_string: htmlString
    };

    if (initialSettingsRef.current && htmlString !== initialSettingsRef.current.html_string) {
      body.fetch_html = false;
    }
    return body;
  };

  const handleSave = async () => {
    if (!validateConfig()) {
      toast.error('Please fix validation errors');
      return;
    }
    if (!hasUnsavedChanges) {
      toast.warning('No changes to save');
      return;
    }

    try {
      setSaving(true);
      const updatedTemplate = await patchTemplateConfig(templateId, customerId, prepareRequestBody());
      setTemplate(updatedTemplate);

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
        allow_reject: updatedTemplate.allow_reject || false,
        category: updatedTemplate.category || 'master',
        is_jinja_template: updatedTemplate.is_jinja_template || false,
        has_preview: updatedTemplate.has_preview || false,
        html_string: updatedTemplate.html_string || '',
        batch_mode: updatedTemplate.batch_mode || false,
        batch_input_field: updatedTemplate.batch_input_field || '',
        fan_out_on_complete: updatedTemplate.fan_out_on_complete || false,
        split_on_complete: updatedTemplate.split_on_complete || false,
        split_field: updatedTemplate.split_field || '',
        grouping_mode: updatedTemplate.grouping_mode || false,
        grouping_field: updatedTemplate.grouping_field || ''
      };

      setIsJinjaTemplate(updatedTemplate.is_jinja_template || false);
      setIsPreview(updatedTemplate.has_preview || false);
      setHtmlString(updatedTemplate.html_string || '');
      setHasUnsavedChanges(false);
      toast.success(`Saved! Version ${updatedTemplate.version}`);

    } catch (error) {
      if (error.details && typeof error.details === 'object') setErrors(error.details);
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation('/home');
      setShowUnsavedModal(true);
    } else {
      navigate('/home');
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    if (pendingNavigation) navigate(pendingNavigation);
  };

  const getSectionHasError = (sectionId) => {
    switch (sectionId) {
      case 'general': return !!errors.platforms;
      case 'flow': return !!(errors.batch_input_field || errors.split_field || errors.grouping_field);
      case 'display': return !!(errors.web || errors.kiosk || errors.mobile || errors.export);
      case 'search': return !!errors.search_fields;
      case 'filters': return !!errors.listing_filters;
      case 'routing': return !!(errors.next_template || errors.previous_template);
      case 'approvers': return !!errors.approvers;
      default: return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 app-shell-bg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading configuration...</span>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen app-shell-bg">
      {/* Sub-header */}
      <header className="cfg-subhead">
        <button onClick={handleCancel} className="cfg-btn-back">
          <ArrowLeft /> Back to templates
        </button>
        <span className="vr" />
        <div className="cfg-doc">
          <div className="cfg-doc-ic">
            <FileSpreadsheet />
          </div>
          <div>
            <div className="cfg-doc-name">{template.template_name}</div>
            <div className="cfg-doc-meta">
              <span className="cfg-doc-ver">v{template.version}</span>
              {hasUnsavedChanges && (
                <span className="cfg-unsaved">
                  <span className="pulse" />
                  Unsaved
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="spacer" />
        <button onClick={handleSave} disabled={!hasUnsavedChanges || saving} className="cfg-btn-save">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </header>

      {/* Page grid */}
      <div className="cfg-wrap">
        {/* Config nav */}
        <nav className="cfg-nav">
          <div className="cfg-nav-title">Configuration</div>
          <div className="cfg-nav-card">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const hasError = getSectionHasError(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`cfg-nav-item ${isActive ? 'active' : ''} ${hasError ? 'has-error' : ''}`}
                >
                  <span className="ci"><Icon /></span>
                  <span className="ct">
                    <span className="cl">{item.label}</span>
                    <span className="ch">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="cfg-content">
          {activeSection === 'general' && (
            <GeneralSection
              template={template}
              platforms={platforms}
              setPlatforms={setPlatforms}
              category={category}
              setCategory={setCategory}
              showCompleted={showCompleted}
              setShowCompleted={setShowCompleted}
              allowNewSubmissions={allowNewSubmissions}
              setAllowNewSubmissions={setAllowNewSubmissions}
              allowReject={allowReject}
              setAllowReject={setAllowReject}
              isJinjaTemplate={isJinjaTemplate}
              setIsJinjaTemplate={setIsJinjaTemplate}
              isPreview={isPreview}
              setIsPreview={setIsPreview}
              htmlString={htmlString}
              setHtmlString={setHtmlString}
              errors={errors}
            />
          )}
          {activeSection === 'flow' && (
            <FlowSection
              batchMode={batchMode}
              setBatchMode={setBatchMode}
              batchInputField={batchInputField}
              setBatchInputField={setBatchInputField}
              fanOutOnComplete={fanOutOnComplete}
              setFanOutOnComplete={setFanOutOnComplete}
              splitOnComplete={splitOnComplete}
              setSplitOnComplete={setSplitOnComplete}
              splitField={splitField}
              setSplitField={setSplitField}
              groupingMode={groupingMode}
              setGroupingMode={setGroupingMode}
              groupingField={groupingField}
              setGroupingField={setGroupingField}
              errors={errors}
            />
          )}
          {activeSection === 'display' && (
            <DisplaySection
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              webListingFields={webListingFields}
              setWebListingFields={setWebListingFields}
              kioskListingFields={kioskListingFields}
              setKioskListingFields={setKioskListingFields}
              mobileListingFields={mobileListingFields}
              setMobileListingFields={setMobileListingFields}
              exportFields={exportFields}
              setExportFields={setExportFields}
              errors={errors}
            />
          )}
          {activeSection === 'search' && (
            <SearchSection
              searchFields={searchFields}
              setSearchFields={setSearchFields}
              webListingFields={webListingFields}
              kioskListingFields={kioskListingFields}
            />
          )}
          {activeSection === 'filters' && (
            <FiltersSection listingFilters={listingFilters} setListingFilters={setListingFilters} />
          )}
          {activeSection === 'routing' && (
            <RoutingSection
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
          )}
          {activeSection === 'approvers' && (
            <ApproversSection approvers={approvers} setApprovers={setApprovers} errors={errors} />
          )}
        </main>
      </div>

      {/* Unsaved Modal */}
      <Modal open={showUnsavedModal} onClose={() => setShowUnsavedModal(false)} size="xs">
        <Modal.Header>
          <Modal.Title>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-muted-foreground">You have unsaved changes. Discard them?</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowUnsavedModal(false)} className="btn-secondary text-sm mr-2">
            Cancel
          </button>
          <button
            onClick={handleDiscardChanges}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer border-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/* ---------- Section Header ---------- */
function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="cfg-sec-head">
      <div className="si"><Icon /></div>
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

/* ---------- Toggle Switch ---------- */
function Switch({ checked, onChange, disabled = false }) {
  return (
    <span
      onClick={() => !disabled && onChange(!checked)}
      className={`cfg-switch ${checked ? 'on' : ''}`}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    />
  );
}

/* ---------- Toggle Row ---------- */
function ToggleRow({ label, hint, checked, onChange, disabled = false }) {
  return (
    <div className={`cfg-toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div>
        <div className="tr-l">{label}</div>
        {hint && <div className="tr-h">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/* ---------- General Section ---------- */
function GeneralSection({ template, platforms, setPlatforms, category, setCategory, showCompleted, setShowCompleted, allowNewSubmissions, setAllowNewSubmissions, allowReject, setAllowReject, isJinjaTemplate, setIsJinjaTemplate, isPreview, setIsPreview, htmlString, setHtmlString, errors = {} }) {
  const togglePlatform = (id) => {
    setPlatforms(platforms.includes(id) ? platforms.filter(p => p !== id) : [...platforms, id]);
  };

  return (
    <>
      <SectionHeader icon={Settings2} title="General Settings" description="Core information, where this template runs, and submission rules." />

      <div className="cfg-card">
        <div className="cfg-grid-2">
          <div>
            <label className="cfg-field-label">Template name</label>
            <div className="cfg-readonly-field">{template.template_name}</div>
          </div>
          <div>
            <label className="cfg-field-label">Category</label>
            <div className="cfg-seg">
              <button className={category === 'master' ? 'on' : ''} onClick={() => setCategory('master')}>Master</button>
              <button className={category === 'operational' ? 'on' : ''} onClick={() => setCategory('operational')}>Operational</button>
            </div>
          </div>
        </div>

        <div className="cfg-block-gap">
          <div className="flex items-center justify-between">
            <label className="cfg-field-label" style={{ marginBottom: 0 }}>Platforms</label>
            {errors.platforms && <span className="cfg-err">{errors.platforms}</span>}
          </div>
          <div className="cfg-platforms">
            {[
              { k: 'web', label: 'Web', icon: Monitor },
              { k: 'kiosk', label: 'Kiosk', icon: Tablet },
              { k: 'mobile', label: 'Mobile', icon: Smartphone },
            ].map(({ k, label, icon: Icon }) => {
              const on = platforms.includes(k);
              return (
                <button key={k} onClick={() => togglePlatform(k)} className={`cfg-plat ${on ? 'on' : ''}`}>
                  <div className="pi"><Icon /></div>
                  <div>
                    <div className="pl">{label}</div>
                    <div className="ps">{on ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cfg-block-gap">
          <div className="cfg-toggles">
            <ToggleRow label="Show completed logsheets" hint="Visible to all viewers" checked={showCompleted} onChange={setShowCompleted} />
            <ToggleRow label="Allow new submissions" hint="Users can create new entries" checked={allowNewSubmissions} onChange={setAllowNewSubmissions} />
            <ToggleRow label="Allow reject" hint="Approvers can reject submissions" checked={allowReject} onChange={setAllowReject} />
            <ToggleRow label="Has preview" hint="Template has a preview" checked={isPreview} onChange={setIsPreview} />
            <ToggleRow label="Use Jinja2 template for preview" hint="Render preview with Jinja2" checked={isJinjaTemplate} onChange={setIsJinjaTemplate} disabled={!isPreview} />
          </div>
        </div>
      </div>

      <div className="cfg-card">
        <div className="cfg-ed-head">
          <div className="cfg-ed-title"><Code2 /> HTML Template</div>
          <span className="cfg-chip-mono">Jinja2 / Django</span>
        </div>
        <p className="cfg-ed-hint">Use <code>{"{{ variable_name }}"}</code> syntax for dynamic values.</p>
        <div className="code-editor-wrapper">
          <div className="code-editor-body">
            <div className="code-editor-lines">
              {Array.from({ length: Math.max(9, (htmlString || '').split('\n').length) }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <textarea
              value={htmlString}
              onChange={(e) => setHtmlString(e.target.value)}
              placeholder="<!-- Paste your HTML/Django template here... -->"
              className="code-editor-textarea"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Flow Section ---------- */
function FlowSection({ batchMode, setBatchMode, batchInputField, setBatchInputField, fanOutOnComplete, setFanOutOnComplete, splitOnComplete, setSplitOnComplete, splitField, setSplitField, groupingMode, setGroupingMode, groupingField, setGroupingField, errors = {} }) {
  return (
    <>
      <SectionHeader icon={Workflow} title="Advanced Flow Configuration" description="Control how submissions are batched, split and grouped." />
      <div className="cfg-flow-grid">
        <div className="cfg-flow-card">
          <div className="cfg-flow-top">
            <div>
              <div className="ft-l">Batch Mode</div>
              <div className="ft-h">Group multiple entries into a single batch</div>
            </div>
            <Switch checked={batchMode} onChange={setBatchMode} />
          </div>
          <input
            type="text"
            value={batchInputField}
            onChange={(e) => setBatchInputField(e.target.value)}
            placeholder="e.g., data.main.data.batch_items"
            disabled={!batchMode}
            className={`cfg-tin mono ${!batchMode ? 'is-disabled' : ''} ${errors.batch_input_field ? 'has-error' : ''}`}
          />
          {errors.batch_input_field && <p className="cfg-err">{errors.batch_input_field}</p>}
        </div>

        <div className="cfg-flow-card">
          <div className="cfg-flow-top">
            <div>
              <div className="ft-l">Fan Out</div>
              <div className="ft-h">Distribute records to multiple targets</div>
            </div>
            <Switch checked={fanOutOnComplete} onChange={setFanOutOnComplete} />
          </div>
          <input type="text" value="No additional field required" disabled className="cfg-tin is-disabled" />
        </div>

        <div className="cfg-flow-card">
          <div className="cfg-flow-top">
            <div>
              <div className="ft-l">Split On Complete</div>
              <div className="ft-h">Split incoming records on a key</div>
            </div>
            <Switch checked={splitOnComplete} onChange={setSplitOnComplete} />
          </div>
          <input
            type="text"
            value={splitField}
            onChange={(e) => setSplitField(e.target.value)}
            placeholder="e.g., data.main.data.serial_numbers"
            disabled={!splitOnComplete}
            className={`cfg-tin mono ${!splitOnComplete ? 'is-disabled' : ''} ${errors.split_field ? 'has-error' : ''}`}
          />
          {errors.split_field && <p className="cfg-err">{errors.split_field}</p>}
        </div>

        <div className="cfg-flow-card">
          <div className="cfg-flow-top">
            <div>
              <div className="ft-l">Grouping Mode</div>
              <div className="ft-h">Select multiple docs from previous template</div>
            </div>
            <Switch checked={groupingMode} onChange={setGroupingMode} />
          </div>
          <input
            type="text"
            value={groupingField}
            onChange={(e) => setGroupingField(e.target.value)}
            placeholder="e.g., data.main.data.selected_heats"
            disabled={!groupingMode}
            className={`cfg-tin mono ${!groupingMode ? 'is-disabled' : ''} ${errors.grouping_field ? 'has-error' : ''}`}
          />
          {errors.grouping_field && <p className="cfg-err">{errors.grouping_field}</p>}
        </div>
      </div>
    </>
  );
}

/* ---------- Display Section ---------- */
function DisplaySection({ activeTab, setActiveTab, webListingFields, setWebListingFields, kioskListingFields, setKioskListingFields, mobileListingFields, setMobileListingFields, exportFields, setExportFields, errors }) {
  return (
    <>
      <SectionHeader icon={Layers} title="Display & Export" description="Choose which columns appear per platform and what gets exported." />
      <div className="cfg-card">
        <div className="cfg-dtabs">
          {[
            { id: 'web', label: 'Web', icon: Monitor },
            { id: 'kiosk', label: 'Kiosk', icon: Tablet },
            { id: 'mobile', label: 'Mobile', icon: Smartphone },
            { id: 'export', label: 'Export', icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={activeTab === id ? 'on' : ''}>
              <Icon /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'web' && <ListingFieldsEditor platform="web" fields={webListingFields} onChange={setWebListingFields} errors={errors.web || {}} />}
        {activeTab === 'kiosk' && <ListingFieldsEditor platform="kiosk" fields={kioskListingFields} onChange={setKioskListingFields} errors={errors.kiosk || {}} />}
        {activeTab === 'mobile' && <ListingFieldsEditor platform="mobile" fields={mobileListingFields} onChange={setMobileListingFields} errors={errors.mobile || {}} />}
        {activeTab === 'export' && <ListingFieldsEditor platform="export" fields={exportFields} onChange={setExportFields} errors={errors.export || {}} />}
      </div>
    </>
  );
}

/* ---------- Search Section ---------- */
function SearchSection({ searchFields, setSearchFields, webListingFields, kioskListingFields }) {
  return (
    <>
      <SectionHeader icon={Search} title="Search Fields" description="Configure which field paths can be searched. Users can search logsheets by these fields." />
      <div className="cfg-card">
        <SearchFieldsEditor
          fields={searchFields}
          onChange={setSearchFields}
          webListingFields={webListingFields}
          kioskListingFields={kioskListingFields}
        />
      </div>
    </>
  );
}

/* ---------- Filters Section ---------- */
function FiltersSection({ listingFilters, setListingFilters }) {
  return (
    <>
      <SectionHeader icon={Filter} title="Listing Filters" description="Configure filters for the logsheet listing. Users can filter logsheets using these options." />
      <div className="cfg-card">
        <ListingFiltersEditor filters={listingFilters} onChange={setListingFilters} />
      </div>
    </>
  );
}

/* ---------- Routing Section ---------- */
function RoutingSection({ nextTemplate, previousTemplate, pushFields, availableTemplates, availablePushFields, onNextTemplateChange, onPreviousTemplateChange, onPushFieldsChange, currentTemplateId, errors }) {
  return (
    <>
      <SectionHeader icon={GitBranch} title="Workflow Routing" description="Define what comes before and after this template, and which fields carry forward." />
      <div className="cfg-card">
        <WorkflowRoutingEditor
          nextTemplate={nextTemplate}
          previousTemplate={previousTemplate}
          pushFields={pushFields}
          availableTemplates={availableTemplates}
          availablePushFields={availablePushFields}
          onNextTemplateChange={onNextTemplateChange}
          onPreviousTemplateChange={onPreviousTemplateChange}
          onPushFieldsChange={onPushFieldsChange}
          currentTemplateId={currentTemplateId}
          errors={errors}
        />
      </div>
    </>
  );
}

/* ---------- Approvers Section ---------- */
function ApproversSection({ approvers, setApprovers, errors }) {
  return (
    <>
      <SectionHeader icon={Users} title="Approvers" description="Drag to reorder approvers and change their levels." />
      <div className="cfg-info-callout">
        <Sparkles />
        <div>
          <div className="ic-title">How approval works</div>
          <ul>
            <li><b>End (Finalize)</b> — completes (approve) or blocks (reject) the logsheet.</li>
            <li><b>Next Approver</b> — escalates to the next level approver.</li>
          </ul>
        </div>
      </div>
      <div className="cfg-card flush">
        <ApproversEditor approvers={approvers} onChange={setApprovers} errors={errors.approvers || {}} />
      </div>
    </>
  );
}

export default TemplateConfig;
