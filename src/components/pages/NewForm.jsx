import { useNavigate, useSearchParams } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import {
  formEngineRsuiteCssLoader,
  ltrCssLoader,
  RsLocalizationWrapper,
  rSuiteComponents,
} from "@react-form-builder/components-rsuite";
import { BiDi } from "@react-form-builder/core";
import { BuilderView, FormBuilder } from "@react-form-builder/designer";
import { createDynamicLog, updateDynamicLog, getDynamicLog } from "../../services/dynamicLogApi";
import { formatErrorMessage, getFieldErrors } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import CustomerDropdown from "../shared/CustomerDropdown";
import { Modal, Button } from "rsuite";
import { Menu, X, Loader2, Save, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import "rsuite/dist/rsuite.min.css";
import "./NewForm.css";

// Default empty form structure
const defaultForm = {
  version: "1",
  errorType: "RsErrorMessage",
  form: {
    key: "Screen",
    type: "Screen",
    props: {},
    children: [],
  },
  localization: {},
  languages: [
    {
      code: "en",
      dialect: "US",
      name: "English",
      description: "American English",
      bidi: "ltr",
    },
  ],
  defaultLanguage: "en-US",
};

// Setup builder view with RSuite components
const builderComponents = rSuiteComponents.map((c) => c.build());
const builderView = new BuilderView(builderComponents)
  .withViewerWrapper(RsLocalizationWrapper)
  .withCssLoader(BiDi.LTR, ltrCssLoader)
  .withCssLoader("common", formEngineRsuiteCssLoader);

function NewForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formBuilderRef = useRef(null);
  
  // Get edit/duplicate mode from URL params
  const editId = searchParams.get('edit');
  const duplicateId = searchParams.get('duplicate');
  const isEditMode = !!editId;
  const isDuplicateMode = !!duplicateId;
  const formId = editId || duplicateId;
  
  // State management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [formType, setFormType] = useState("single");
  const [sections, setSections] = useState([
    {
      section_id: "section_1",
      section_name: "Section 1",
      order: 1,
      form_json: JSON.stringify(defaultForm),
    },
  ]);
  const [selectedSectionId, setSelectedSectionId] = useState("section_1");
  const [editingSectionName, setEditingSectionName] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingForm, setLoadingForm] = useState(false);
  const hasFetchedFormRef = useRef(false);
  const autoSaveTimeoutRef = useRef(null);
  const isRestoringRef = useRef(false);
  const STORAGE_KEY = 'form_builder_draft';

  // Get current form based on selected section
  const getForm = () => {
    if (formType === "single") {
      return sections[0]?.form_json || JSON.stringify(defaultForm);
    }
    const selectedSection = sections.find((s) => s.section_id === selectedSectionId);
    return selectedSection?.form_json || JSON.stringify(defaultForm);
  };

  // Save current form to selected section
  const saveCurrentFormToSection = () => {
    if (formBuilderRef.current) {
      const formData = formBuilderRef.current.formAsString;
      
      setSections((prev) => {
        return prev.map((section) => {
          if (section.section_id === selectedSectionId) {
            return { ...section, form_json: formData };
          }
          return section;
        });
      });
    }
  };

  // Save form state to localStorage
  const saveToLocalStorage = () => {
    // Don't save if in edit/duplicate mode or if currently restoring
    if (isEditMode || isDuplicateMode || isRestoringRef.current) return;
    
    // Save current form to section first
    saveCurrentFormToSection();
    
    // Use setTimeout to ensure state is updated
    setTimeout(() => {
      try {
        const draftData = {
          templateName,
          customerId,
          status,
          formType,
          sections,
          selectedSectionId,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
      } catch (error) {
        console.error('Failed to save draft to localStorage:', error);
      }
    }, 100);
  };

  // Restore form state from localStorage
  const restoreFromLocalStorage = () => {
    // Don't restore if in edit/duplicate mode (we fetch from API)
    if (isEditMode || isDuplicateMode) return;
    
    isRestoringRef.current = true;
    
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const draftData = JSON.parse(savedData);
        
        // Restore basic fields
        if (draftData.templateName) setTemplateName(draftData.templateName);
        if (draftData.customerId !== null && draftData.customerId !== undefined) {
          setCustomerId(draftData.customerId);
        }
        if (draftData.status) setStatus(draftData.status);
        if (draftData.formType) setFormType(draftData.formType);
        if (draftData.sections && draftData.sections.length > 0) {
          setSections(draftData.sections);
        }
        if (draftData.selectedSectionId) {
          setSelectedSectionId(draftData.selectedSectionId);
        }
        
        // Restore form builder after a delay
        setTimeout(() => {
          if (formBuilderRef.current) {
            const formToLoad = draftData.formType === 'single' 
              ? draftData.sections[0]?.form_json 
              : draftData.sections.find(s => s.section_id === draftData.selectedSectionId)?.form_json;
            
            if (formToLoad) {
              try {
                formBuilderRef.current.parseForm(formToLoad);
                toast.info('Draft restored from previous session');
              } catch (e) {
                console.error('Error restoring form:', e);
              }
            }
          }
          // Allow auto-save after restoration completes
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 500);
        }, 300);
      } else {
        isRestoringRef.current = false;
      }
    } catch (error) {
      console.error('Failed to restore draft from localStorage:', error);
      isRestoringRef.current = false;
    }
  };

  // Clear localStorage draft
  const clearDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  // Debounced auto-save function
  const autoSave = () => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save (2 seconds debounce)
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveToLocalStorage();
    }, 2000);
  };

  // Handle section selection
  const handleSectionSelect = (sectionId) => {
    // Save current form before switching
    saveCurrentFormToSection();
    
    // Small delay to ensure save completes
    setTimeout(() => {
      setSelectedSectionId(sectionId);
      // Reload form in builder
      if (formBuilderRef.current) {
        const selectedSection = sections.find((s) => s.section_id === sectionId);
        if (selectedSection) {
          formBuilderRef.current.parseForm(selectedSection.form_json);
        }
      }
      // Trigger auto-save after section switch
      autoSave();
    }, 100);
  };

  // Add new section
  const handleAddSection = () => {
    if (newSectionName.trim()) {
      const newSection = {
        section_id: `section_${Date.now()}`,
        section_name: newSectionName.trim(),
        order: sections.length + 1,
        form_json: JSON.stringify(defaultForm),
      };
      
      setSections((prev) => [...prev, newSection]);
      setNewSectionName("");
      setFormType("multi-step");
      
      // Select the new section
      setTimeout(() => {
        handleSectionSelect(newSection.section_id);
      }, 100);
    }
  };

  // Delete section
  const handleDeleteSection = (sectionId) => {
    if (sections.length === 1) {
      alert("Cannot delete the last section!");
      return;
    }
    
    const filtered = sections.filter((s) => s.section_id !== sectionId);
    // Recalculate order numbers to be sequential (1, 2, 3, ...)
    const reordered = filtered.map((section, index) => ({
      ...section,
      order: index + 1,
    }));
    setSections(reordered);
    
    // If deleted section was selected, select first one
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(reordered[0].section_id);
      if (formBuilderRef.current && reordered[0]) {
        formBuilderRef.current.parseForm(reordered[0].form_json);
      }
    }
    
    // If only one section left, switch to single form
    if (reordered.length === 1) {
      setFormType("single");
    }
  };

  // Update section name
  const handleUpdateSectionName = (sectionId, newName) => {
    if (newName.trim()) {
      setSections((prev) =>
        prev.map((s) =>
          s.section_id === sectionId
            ? { ...s, section_name: newName.trim() }
            : s
        )
      );
      setEditingSectionName(null);
    }
  };

  // Toggle form type
  const handleToggleFormType = (type) => {
    // If clicking the already active type, do nothing
    if (formType === type) {
      return;
    }

    if (type === "single" && sections.length > 1) {
      if (
        !window.confirm(
          "Switching to single form will keep only the first section. Continue?"
        )
      ) {
        return;
      }
      // Reset order to 1 when switching to single form
      setSections([{ ...sections[0], order: 1 }]);
      setSelectedSectionId(sections[0].section_id);
    }
    setFormType(type);
  };

  const handleSaveFormClick = () => {
    setFieldErrors({});
    setShowSaveModal(true);
  };

  const handleSaveForm = async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    saveCurrentFormToSection();
    setSaving(true);
    setFieldErrors({}); // Clear previous errors

    try {
      if (!formBuilderRef.current) {
        throw new Error("Form builder is not initialized");
      }

      let formJson;
      
      if (formType === "single") {
        formJson = sections[0]?.form_json 
          ? (typeof sections[0].form_json === 'string' 
              ? JSON.parse(sections[0].form_json) 
              : sections[0].form_json)
          : defaultForm;
      } else {
        formJson = {
          sections: sections.map((s) => ({
            section_id: s.section_id,
            section_name: s.section_name,
            order: s.order,
            form_json: typeof s.form_json === 'string' 
              ? JSON.parse(s.form_json) 
              : s.form_json,
          })),
        };
      }

      const apiData = {
        template_name: templateName.trim(),
        form_json: formJson,
        customer: customerId,
        status: status,
      };

      // Use PUT for edit mode, POST for duplicate/new mode
      if (isEditMode && editId) {
        await updateDynamicLog(editId, apiData);
        toast.success("Form updated successfully!");
      } else {
        await createDynamicLog(apiData);
        toast.success("Form saved successfully!");
        // Clear draft after successful save
        clearDraft();
      }
      
      setShowSaveModal(false);
      setFieldErrors({});
      navigate("/home");
    } catch (err) {
      console.error("Save form error:", err);
      
      const errors = getFieldErrors(err);
      setFieldErrors(errors);
      
      // Format and show error message
      const errorMsg = formatErrorMessage(err);
      
      // Show toast with error message (longer duration for errors)
      toast.error(errorMsg || "Failed to save form. Please check the errors below.", 5000);
      
      // Keep modal open so user can see the errors
    } finally {
      setSaving(false);
    }
  };

  // Restore draft from localStorage on mount (only for new forms)
  useEffect(() => {
    if (!isEditMode && !isDuplicateMode) {
      restoreFromLocalStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch form data when in edit or duplicate mode
  useEffect(() => {
    // Prevent duplicate calls
    if (!formId) return;
    
    // Check if we've already fetched this formId
    if (hasFetchedFormRef.current === formId) return;
    
    // Clear any draft when entering edit/duplicate mode
    clearDraft();
    
    const fetchFormData = async () => {
      hasFetchedFormRef.current = formId;
      setLoadingForm(true);
      try {
        const response = await getDynamicLog(formId);
        
        if (response) {
          // Set template name (for duplicate, user will change it)
          setTemplateName(response.template_name || "");
          
          // Set customer ID
          if (response.customer) {
            const customerIdValue = typeof response.customer === 'object' 
              ? response.customer.id 
              : response.customer;
            setCustomerId(customerIdValue);
          }
          
          // Set status
          if (response.status) {
            setStatus(response.status);
          }
          
          // Prefill form JSON
          if (response.form_json) {
            const formJsonString = typeof response.form_json === 'string' 
              ? response.form_json 
              : JSON.stringify(response.form_json);
            
            // Check if it's a multi-step form (has sections)
            const hasSections = response.form_json.sections && Array.isArray(response.form_json.sections);
            
            if (hasSections) {
              // Multi-step form
              setFormType("multi-step");
              const formattedSections = response.form_json.sections.map((section, index) => ({
                section_id: section.section_id || `section_${index + 1}`,
                section_name: section.section_name || `Section ${index + 1}`,
                order: section.order || index + 1,
                form_json: JSON.stringify(section.form_json || defaultForm),
              }));
              setSections(formattedSections);
              if (formattedSections.length > 0) {
                const firstSectionId = formattedSections[0].section_id;
                setSelectedSectionId(firstSectionId);
                
                // Load first section in builder after state updates
                setTimeout(() => {
                  if (formBuilderRef.current && formattedSections[0]) {
                    try {
                      formBuilderRef.current.parseForm(formattedSections[0].form_json);
                    } catch (e) {
                      console.error("Error parsing form JSON:", e);
                    }
                  }
                }, 600);
              }
            } else {
              // Single form
              setFormType("single");
              setSections([
                {
                  section_id: "section_1",
                  section_name: "Section 1",
                  order: 1,
                  form_json: formJsonString,
                },
              ]);
              
              // Update builder after state updates
              setTimeout(() => {
                if (formBuilderRef.current) {
                  try {
                    formBuilderRef.current.parseForm(formJsonString);
                  } catch (e) {
                    console.error("Error parsing form JSON:", e);
                  }
                }
              }, 500);
            }
          }
          
          // For duplicate mode, auto-open save modal
          if (isDuplicateMode) {
            // Clear template name so user must enter a new one
            setTemplateName("");
            setTimeout(() => {
              setShowSaveModal(true);
            }, 500);
          }
        }
      } catch (err) {
        console.error("Error fetching form data:", err);
        toast.error("Failed to load form data. Please try again.");
        navigate("/home");
      } finally {
        setLoadingForm(false);
      }
    };

    fetchFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  // Auto-save form builder changes to section (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (formBuilderRef.current) {
        saveCurrentFormToSection();
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId]);

  // Auto-save to localStorage when form data changes
  useEffect(() => {
    // Don't auto-save if in edit/duplicate mode or if form is being loaded
    if (isEditMode || isDuplicateMode || loadingForm) return;
    
    autoSave();
    
    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName, customerId, status, formType, sections, selectedSectionId, isEditMode, isDuplicateMode, loadingForm]);

  // Save to localStorage before page unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Don't save if in edit/duplicate mode
      if (!isEditMode && !isDuplicateMode) {
        saveToLocalStorage();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName, customerId, status, formType, sections, selectedSectionId, isEditMode, isDuplicateMode]);

  const handleBack = () => {
    navigate("/home");
  };

  // Clear/reset form to default state
  const handleClearForm = () => {
    // Don't allow clearing in edit mode (user should use back button)
    if (isEditMode) {
      toast.warning("Cannot clear form in edit mode. Use back button to cancel.");
      return;
    }

    // Show confirmation dialog
    if (!window.confirm("Are you sure you want to clear the form? All unsaved changes will be lost.")) {
      return;
    }

    // Reset all form state to default
    setTemplateName("");
    setCustomerId(null);
    setStatus("draft");
    setFormType("single");
    setSections([
      {
        section_id: "section_1",
        section_name: "Section 1",
        order: 1,
        form_json: JSON.stringify(defaultForm),
      },
    ]);
    setSelectedSectionId("section_1");
    setFieldErrors({});
    setShowSaveModal(false);
    
    // Clear localStorage draft
    clearDraft();
    
    // Reset form builder
    setTimeout(() => {
      if (formBuilderRef.current) {
        try {
          formBuilderRef.current.parseForm(JSON.stringify(defaultForm));
        } catch (e) {
          console.error("Error resetting form builder:", e);
        }
      }
    }, 100);

    toast.success("Form cleared successfully");
  };

  const selectedSection = sections.find((s) => s.section_id === selectedSectionId);

  // Show loading state while fetching form data
  if (loadingForm) {
    return (
      <div className="new-form-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Loader2 className="animate-spin" size={32} />
          <p>Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-form-container">
      <div className="new-form-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
          <h1>{isEditMode ? "Edit Form" : isDuplicateMode ? "Duplicate Form" : "Form Builder"}</h1>
        </div>
        <div className="header-actions">
          {!isEditMode && (
            <button 
              onClick={handleClearForm} 
              className="clear-button icon-only"
              title="Clear form"
            >
              <span className="button-icon"><Trash2 size={16} /></span>
            </button>
          )}
          <button 
            onClick={handleSaveFormClick} 
            className="save-button icon-only"
            disabled={saving}
            title={saving ? "Saving..." : "Save form"}
          >
            <span className="button-icon">
              {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
            </span>
          </button>
          <button 
            onClick={handleBack} 
            className="back-button icon-only"
            title="Back to home"
          >
            <span className="button-icon"><ArrowLeft size={18} /></span>
          </button>
        </div>
      </div>
      <div className="new-form-body">
        <div className={`sidebar-panel ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className={`sidebar-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
            <div className="form-type-toggle">
              <button
                className={`type-btn ${formType === "single" ? "active" : ""}`}
                onClick={() => handleToggleFormType("single")}
              >
                Single Form
              </button>
              <button
                className={`type-btn ${formType === "multi-step" ? "active" : ""}`}
                onClick={() => handleToggleFormType("multi-step")}
              >
                Multi-Step
              </button>
            </div>

            <div className="sections-header">
              <h3>Sections ({sections.length})</h3>
            </div>

            <div className="sections-list">
              {sections.map((section) => (
                <div
                  key={section.section_id}
                  className={`section-item ${
                    selectedSectionId === section.section_id ? "active" : ""
                  }`}
                >
                  {editingSectionName === section.section_id ? (
                    <div className="section-edit">
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        onBlur={() => {
                          handleUpdateSectionName(section.section_id, newSectionName);
                          setNewSectionName("");
                        }}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateSectionName(section.section_id, newSectionName);
                            setNewSectionName("");
                          }
                        }}
                        autoFocus
                        className="section-name-input"
                      />
                    </div>
                  ) : (
                    <div
                      className="section-content"
                      onClick={() => handleSectionSelect(section.section_id)}
                    >
                      <span className="section-number">{section.order}</span>
                      <span className="section-name">{section.section_name}</span>
                      <div className="section-actions">
                        <button
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSectionName(section.section_id);
                            setNewSectionName(section.section_name);
                          }}
                          title="Edit name"
                        >
                          <Pencil size={12} />
                        </button>
                        {sections.length > 1 && (
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSection(section.section_id);
                            }}
                            title="Delete section"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {formType === "multi-step" && (
              <div className="add-section">
                <input
                  type="text"
                  placeholder="New section name..."
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddSection();
                    }
                  }}
                  className="add-section-input"
                />
                <button onClick={handleAddSection} className="add-section-btn">
                  + Add Section
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="form-builder-wrapper">
          <FormBuilder
            builderRef={formBuilderRef}
            view={builderView}
            formName={selectedSection?.section_name || "NewForm"}
            getForm={getForm}
          />
        </div>
      </div>

      <Modal
        open={showSaveModal}
        onClose={() => !saving && setShowSaveModal(false)}
        size="md"
        backdrop="static"
        className="save-form-modal"
      >
        <Modal.Header className="modal-header-custom">
          <Modal.Title className="modal-title-custom">Save Form</Modal.Title>
          <p className="modal-subtitle">Fill in the details below to save your form</p>
        </Modal.Header>
        <Modal.Body className="modal-body-custom">
          {Object.keys(fieldErrors).length > 0 && (
            <div className="modal-general-error">
              <strong>Please fix the following errors:</strong>
              <ul>
                {Object.keys(fieldErrors).map(field => (
                  <li key={field}>
                    {Array.isArray(fieldErrors[field]) 
                      ? fieldErrors[field].join(', ')
                      : fieldErrors[field]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="save-modal-content">
            <div className="modal-field-group">
              <label htmlFor="modal-template-name" className="modal-label">
                Template Name <span className="required-asterisk">*</span>
              </label>
              <input
                id="modal-template-name"
                type="text"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  // Clear error when user starts typing
                  if (fieldErrors.template_name) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.template_name;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter template name..."
                className={`modal-input ${fieldErrors.template_name ? 'modal-input-error' : ''}`}
                required
                autoFocus
              />
              {fieldErrors.template_name && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.template_name) 
                    ? fieldErrors.template_name.join(', ')
                    : fieldErrors.template_name}
                </div>
              )}
            </div>
            <div className="modal-field-group">
              <label htmlFor="modal-status" className="modal-label">
                Status
              </label>
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="modal-select"
              >
                <option value="draft">Draft</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="modal-field-group">
              <label className="modal-label">
                Customer <span className="optional-text">(optional)</span>
              </label>
              <CustomerDropdown
                value={customerId}
                onChange={setCustomerId}
                placeholder="Select customer..."
              />
              {fieldErrors.form_json && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.form_json) 
                    ? fieldErrors.form_json.join(', ')
                    : fieldErrors.form_json}
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="modal-footer-custom">
          <Button
            onClick={() => setShowSaveModal(false)}
            disabled={saving}
            className="modal-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveForm}
            className="modal-submit-btn"
            disabled={saving || !templateName.trim()}
            loading={saving}
          >
            {saving ? "Saving..." : "Save & Submit"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default NewForm;
