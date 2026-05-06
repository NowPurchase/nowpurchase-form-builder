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
  AlertCircle,
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
      htmlString !== initialSettingsRef.current.html_string ||
      batchMode !== initialSettingsRef.current.batch_mode ||
      batchInputField !== initialSettingsRef.current.batch_input_field ||
      fanOutOnComplete !== initialSettingsRef.current.fan_out_on_complete ||
      splitOnComplete !== initialSettingsRef.current.split_on_complete ||
      splitField !== initialSettingsRef.current.split_field ||
      groupingMode !== initialSettingsRef.current.grouping_mode ||
      groupingField !== initialSettingsRef.current.grouping_field;

    setHasUnsavedChanges(configChanged || routeChanged || settingsChanged);
  }, [webListingFields, kioskListingFields, mobileListingFields, exportFields, searchFields, listingFilters, approvers, nextTemplate, previousTemplate, pushFields, platforms, showCompleted, allowNewSubmissions, allowReject, category, isJinjaTemplate, htmlString, batchMode, batchInputField, fanOutOnComplete, splitOnComplete, splitField, groupingMode, groupingField]);

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

    // Validate listing fields (web/kiosk/mobile/export)
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

    // Validate search fields - must be valid field paths
    searchFields.forEach((field, index) => {
      if (!field || !field.trim()) {
        if (!newErrors.search_fields) newErrors.search_fields = {};
        newErrors.search_fields[index] = 'Field path is required';
      }
    });

    // Validate listing filters
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
      // Validate options if present
      if (filter.options && Array.isArray(filter.options)) {
        filter.options.forEach((opt, optIndex) => {
          if (!opt.label || !opt.value === undefined) {
            if (!newErrors.listing_filters[index].options) newErrors.listing_filters[index].options = {};
            newErrors.listing_filters[index].options[optIndex] = 'Option needs label and value';
          }
        });
      }
      // Clean up empty error objects
      if (Object.keys(newErrors.listing_filters[index]).length === 0) {
        delete newErrors.listing_filters[index];
      }
    });
    if (newErrors.listing_filters && Object.keys(newErrors.listing_filters).length === 0) {
      delete newErrors.listing_filters;
    }

    // Validate approvers
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

    // Validate workflow routing
    if (nextTemplate === templateId) newErrors.next_template = 'Cannot select the same template';
    if (previousTemplate === templateId) newErrors.previous_template = 'Cannot select the same template';
    if (nextTemplate && previousTemplate && nextTemplate === previousTemplate) {
      newErrors.next_template = 'Next and previous cannot be the same';
      newErrors.previous_template = 'Next and previous cannot be the same';
    }

    // Validate flow settings - required fields when enabled
    if (batchMode && (!batchInputField || !batchInputField.trim())) {
      newErrors.batch_input_field = 'Batch input field is required when batch mode is enabled';
    }
    if (splitOnComplete && (!splitField || !splitField.trim())) {
      newErrors.split_field = 'Split field is required when split on complete is enabled';
    }
    if (groupingMode && (!groupingField || !groupingField.trim())) {
      newErrors.grouping_field = 'Grouping field is required when grouping mode is enabled';
    }

    // Validate platforms - at least one required
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
      const updatedTemplate = await patchTemplateConfig(templateId, prepareRequestBody());
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'var(--gradient-glow), hsl(var(--background))' }}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-[12px] text-muted-foreground">Loading configuration...</span>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-glow), hsl(var(--background))' }}>
      {/* Sub-header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button onClick={handleCancel} className="btn-ghost gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Back to templates
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold tracking-tight">{template.template_name}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">v{template.version}</span>
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 text-[10px] font-medium text-warning">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                      Unsaved
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className="btn-primary gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-6 px-6 py-8">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3">
          <nav className="sticky top-24 space-y-1">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Configuration
            </p>
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              // Check if section has errors
              const sectionHasError = (() => {
                switch (item.id) {
                  case 'general':
                    return !!errors.platforms;
                  case 'flow':
                    return !!(errors.batch_input_field || errors.split_field || errors.grouping_field);
                  case 'display':
                    return !!(errors.web || errors.kiosk || errors.mobile || errors.export);
                  case 'search':
                    return !!errors.search_fields;
                  case 'filters':
                    return !!errors.listing_filters;
                  case 'routing':
                    return !!(errors.next_template || errors.previous_template);
                  case 'approvers':
                    return !!errors.approvers;
                  default:
                    return false;
                }
              })();

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer border-0 ${
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                  } ${sectionHasError && !isActive ? 'bg-destructive/5' : ''}`}
                >
                  <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    sectionHasError
                      ? 'bg-destructive/10 text-destructive'
                      : isActive
                        ? 'bg-gradient-primary text-primary-foreground shadow-glow'
                        : 'bg-secondary text-muted-foreground group-hover:bg-background'
                  }`}>
                    <Icon className="h-4 w-4" />
                    {sectionHasError && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">!</span>
                    )}
                  </span>
                  <span className="flex-1 leading-tight">
                    <span className={`block text-sm font-medium ${sectionHasError ? 'text-destructive' : ''}`}>{item.label}</span>
                    <span className={`block text-[11px] ${sectionHasError ? 'text-destructive/70' : 'text-muted-foreground/80'}`}>{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="col-span-12 space-y-6 lg:col-span-9">
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
            <SearchSection searchFields={searchFields} setSearchFields={setSearchFields} />
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
          <p className="text-[13px] text-muted-foreground">You have unsaved changes. Discard them?</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowUnsavedModal(false)} className="btn-secondary text-[12px] mr-2">
            Cancel
          </button>
          <button
            onClick={handleDiscardChanges}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium transition-all cursor-pointer border-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/* ---------- Reusable Components ---------- */

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`section-card p-6 ${className}`}>{children}</div>;
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 transition-colors hover:bg-secondary">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <label className="relative inline-flex cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
      </label>
    </div>
  );
}

/* ---------- Section Components ---------- */

function GeneralSection({ template, platforms, setPlatforms, category, setCategory, showCompleted, setShowCompleted, allowNewSubmissions, setAllowNewSubmissions, allowReject, setAllowReject, isJinjaTemplate, setIsJinjaTemplate, htmlString, setHtmlString, errors = {} }) {
  const togglePlatform = (id) => {
    setPlatforms(platforms.includes(id) ? platforms.filter(p => p !== id) : [...platforms, id]);
  };

  return (
    <>
      <SectionHeader icon={Settings2} title="General Settings" description="Core information, where this template runs, and submission rules." />

      <Card>
        <div className="grid gap-6 md:grid-cols-2 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Template name</label>
            <div className="h-11 w-full rounded-xl border border-border bg-muted/40 px-4 flex items-center text-sm text-muted-foreground select-none">
              {template.template_name}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Category</label>
            <div className="flex gap-2 h-11">
              {['master', 'operational'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={category === c ? 'btn-primary h-11' : 'btn-secondary h-11'}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platforms</label>
            {errors.platforms && (
              <span className="text-xs text-destructive">{errors.platforms}</span>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { k: 'web', label: 'Web', icon: Monitor },
              { k: 'kiosk', label: 'Kiosk', icon: Tablet },
              { k: 'mobile', label: 'Mobile', icon: Smartphone },
            ].map(({ k, label, icon: Icon }) => {
              const on = platforms.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => togglePlatform(k)}
                  className={`group relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    on
                      ? 'border-primary/40 bg-accent shadow-glow'
                      : 'border-border bg-card hover:border-primary/20 hover:bg-accent/40'
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    on ? 'bg-gradient-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{on ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ToggleRow label="Show completed logsheets" hint="Visible to all viewers" checked={showCompleted} onChange={setShowCompleted} />
          <ToggleRow label="Allow new submissions" hint="Users can create new entries" checked={allowNewSubmissions} onChange={setAllowNewSubmissions} />
          <ToggleRow label="Allow reject" hint="Approvers can reject submissions" checked={allowReject} onChange={setAllowReject} />
          <ToggleRow label="Use Jinja2 template for preview" hint="Render preview with Jinja2" checked={isJinjaTemplate} onChange={setIsJinjaTemplate} />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">HTML Template</h3>
          </div>
          <span className="badge badge-outline font-mono text-[10px]">Jinja2 / Django</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{ variable_name }}"}</code> syntax for dynamic values.
        </p>
        <div className="code-editor-wrapper">
          <div className="code-editor-body">
            <div className="code-editor-lines">
              {Array.from({ length: Math.max(12, (htmlString || '').split('\n').length) }, (_, i) => (
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
      </Card>
    </>
  );
}

function FlowSection({ batchMode, setBatchMode, batchInputField, setBatchInputField, fanOutOnComplete, setFanOutOnComplete, splitOnComplete, setSplitOnComplete, splitField, setSplitField, groupingMode, setGroupingMode, groupingField, setGroupingField, errors = {} }) {
  return (
    <>
      <SectionHeader icon={Workflow} title="Advanced Flow Configuration" description="Control how submissions are batched, split and grouped." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Batch Mode</p>
              <p className="mt-1 text-xs text-muted-foreground">Group multiple entries into a single batch</p>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          <div>
            <input
              type="text"
              value={batchInputField}
              onChange={(e) => setBatchInputField(e.target.value)}
              placeholder="e.g., data.main.data.batch_items"
              disabled={!batchMode}
              className={`h-11 w-full rounded-xl border px-4 text-sm outline-none focus:border-ring disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed ${
                errors.batch_input_field ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
              }`}
            />
            {errors.batch_input_field && (
              <p className="mt-1.5 text-xs text-destructive">{errors.batch_input_field}</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Fan Out</p>
              <p className="mt-1 text-xs text-muted-foreground">Distribute records to multiple targets</p>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input type="checkbox" checked={fanOutOnComplete} onChange={(e) => setFanOutOnComplete(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          <input
            type="text"
            placeholder="No additional field required"
            disabled
            className="h-11 w-full rounded-xl border border-border bg-muted/40 px-4 text-sm text-muted-foreground cursor-not-allowed"
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Split On Complete</p>
              <p className="mt-1 text-xs text-muted-foreground">Split incoming records on a key</p>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input type="checkbox" checked={splitOnComplete} onChange={(e) => setSplitOnComplete(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          <div>
            <input
              type="text"
              value={splitField}
              onChange={(e) => setSplitField(e.target.value)}
              placeholder="e.g., data.main.data.serial_numbers"
              disabled={!splitOnComplete}
              className={`h-11 w-full rounded-xl border px-4 text-sm outline-none focus:border-ring disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed ${
                errors.split_field ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
              }`}
            />
            {errors.split_field && (
              <p className="mt-1.5 text-xs text-destructive">{errors.split_field}</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Grouping Mode</p>
              <p className="mt-1 text-xs text-muted-foreground">Select multiple docs from previous template</p>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input type="checkbox" checked={groupingMode} onChange={(e) => setGroupingMode(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          <div>
            <input
              type="text"
              value={groupingField}
              onChange={(e) => setGroupingField(e.target.value)}
              placeholder="e.g., data.main.data.selected_heats"
              disabled={!groupingMode}
              className={`h-11 w-full rounded-xl border px-4 text-sm outline-none focus:border-ring disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed ${
                errors.grouping_field ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
              }`}
            />
            {errors.grouping_field && (
              <p className="mt-1.5 text-xs text-destructive">{errors.grouping_field}</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function DisplaySection({ activeTab, setActiveTab, webListingFields, setWebListingFields, kioskListingFields, setKioskListingFields, mobileListingFields, setMobileListingFields, exportFields, setExportFields, errors }) {
  return (
    <>
      <SectionHeader icon={Layers} title="Display & Export" description="Choose which columns appear per platform and what gets exported." />
      <Card>
        <div className="inline-flex flex-wrap gap-0.5 p-1 rounded-lg border border-border bg-secondary/40 mb-5">
          {[
            { id: 'web', label: 'Web', icon: Monitor },
            { id: 'kiosk', label: 'Kiosk', icon: Tablet },
            { id: 'mobile', label: 'Mobile', icon: Smartphone },
            { id: 'export', label: 'Export', icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer border-0 ${
                activeTab === id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'web' && <ListingFieldsEditor platform="web" fields={webListingFields} onChange={setWebListingFields} errors={errors.web || {}} />}
        {activeTab === 'kiosk' && <ListingFieldsEditor platform="kiosk" fields={kioskListingFields} onChange={setKioskListingFields} errors={errors.kiosk || {}} />}
        {activeTab === 'mobile' && <ListingFieldsEditor platform="mobile" fields={mobileListingFields} onChange={setMobileListingFields} errors={errors.mobile || {}} />}
        {activeTab === 'export' && <ListingFieldsEditor platform="export" fields={exportFields} onChange={setExportFields} errors={errors.export || {}} />}
      </Card>
    </>
  );
}

function SearchSection({ searchFields, setSearchFields }) {
  return (
    <>
      <SectionHeader icon={Search} title="Search Fields" description="Configure which field paths can be searched. Users can search logsheets by these fields." />
      <Card>
        <SearchFieldsEditor fields={searchFields} onChange={setSearchFields} />
      </Card>
    </>
  );
}

function FiltersSection({ listingFilters, setListingFilters }) {
  return (
    <>
      <SectionHeader icon={Filter} title="Listing Filters" description="Configure filters for the logsheet listing. Users can filter logsheets using these options." />
      <Card>
        <ListingFiltersEditor filters={listingFilters} onChange={setListingFilters} />
      </Card>
    </>
  );
}

function RoutingSection({ nextTemplate, previousTemplate, pushFields, availableTemplates, availablePushFields, onNextTemplateChange, onPreviousTemplateChange, onPushFieldsChange, currentTemplateId, errors }) {
  return (
    <>
      <SectionHeader icon={GitBranch} title="Workflow Routing" description="Define what comes before and after this template, and which fields carry forward." />
      <Card>
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
      </Card>
    </>
  );
}

function ApproversSection({ approvers, setApprovers, errors }) {
  return (
    <>
      <SectionHeader icon={Users} title="Approvers" description="Drag to reorder approvers and change their levels." />
      <div className="rounded-2xl border border-primary/20 bg-accent/60 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">How approval works</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>• <span className="font-medium text-foreground">End (Finalize)</span> — completes (approve) or blocks (reject) the logsheet.</li>
              <li>• <span className="font-medium text-foreground">Next Approver</span> — escalates to the next level approver.</li>
            </ul>
          </div>
        </div>
      </div>
      <Card className="p-0">
        <ApproversEditor approvers={approvers} onChange={setApprovers} errors={errors.approvers || {}} />
      </Card>
    </>
  );
}

export default TemplateConfig;
