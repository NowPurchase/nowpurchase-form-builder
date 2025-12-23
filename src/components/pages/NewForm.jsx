import { useNavigate, useSearchParams } from "react-router-dom";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  formEngineRsuiteCssLoader,
  ltrCssLoader,
  RsLocalizationWrapper,
  rSuiteComponents,
} from "@react-form-builder/components-rsuite";
import { rSuiteTableComponents } from "@react-form-builder/components-rsuite-table";
import { BiDi, ActionDefinition } from "@react-form-builder/core";
import { BuilderView, FormBuilder } from "@react-form-builder/designer";
import { createDynamicLog, updateDynamicLog, getDynamicLog } from "../../services/dynamicLogApi";
import { getCustomerDropdown } from "../../services/customerApi";
import { formatErrorMessage, getFieldErrors } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import CustomerDropdown from "../shared/CustomerDropdown";
import { Modal, Button } from "rsuite";
import { Menu, X, Loader2, Save, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { rsCameraCapture } from "../../config/customRsUploader";
import "rsuite/dist/rsuite.min.css";
import "./NewForm.css";

const defaultForm = {
  version: "1",
  errorType: "RsErrorMessage",
  actions: {
    onSubmit: {
      body: `    console.log("Form Submitted")`,
      params: {}
    }
  },
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

const builderComponents = [...rSuiteComponents, ...rSuiteTableComponents, rsCameraCapture].map((c) => c.build());
const builderView = new BuilderView(builderComponents)
  .withViewerWrapper(RsLocalizationWrapper)
  .withCssLoader(BiDi.LTR, ltrCssLoader)
  .withCssLoader("common", formEngineRsuiteCssLoader);

function NewForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formBuilderRef = useRef(null);
  
  const editId = searchParams.get('edit');
  const duplicateId = searchParams.get('duplicate');
  const isEditMode = !!editId;
  const isDuplicateMode = !!duplicateId;
  const formId = editId || duplicateId;
  
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
  const [sheetId, setSheetId] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState("completed");
  const [version, setVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingForm, setLoadingForm] = useState(false);
  const hasFetchedFormRef = useRef(false);
  const pendingModalOpenRef = useRef(false);
  const isProcessingFormRef = useRef(false);
  const lastFormDataRef = useRef(null);

  // Helper to safely clone and clean form JSON, preventing circular references
  // MUST be defined before getFormDataAsString to avoid initialization errors
  const cleanFormJson = useCallback((formJson) => {
    if (!formJson) return JSON.stringify(defaultForm);
    
    try {
      let parsed;
      
      // If it's already a string, parse it first
      if (typeof formJson === 'string') {
        parsed = JSON.parse(formJson);
      } else {
        parsed = formJson;
      }
      
      // Use structuredClone if available (handles circular refs better)
      // Otherwise use JSON parse/stringify with circular reference detection
      let cleaned;
      if (typeof structuredClone !== 'undefined') {
        try {
          cleaned = structuredClone(parsed);
        } catch {
          // Fallback to JSON method if structuredClone fails
          cleaned = JSON.parse(JSON.stringify(parsed));
        }
      } else {
        // Fallback: use JSON with circular reference handler
        const seen = new WeakSet();
        const jsonString = JSON.stringify(parsed, (key, value) => {
          if (typeof value === 'function' || typeof value === 'symbol') {
            return undefined;
          }
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return undefined; // Remove circular references
            }
            seen.add(value);
          }
          return value;
        });
        cleaned = JSON.parse(jsonString);
      }
      
      // Final validation and stringification
      const result = JSON.stringify(cleaned);
      JSON.parse(result); // Validate it's valid JSON
      return result;
    } catch (error) {
      console.error("Error cleaning form JSON:", error);
      return JSON.stringify(defaultForm);
    }
  }, []);

  // Helper function to safely get form data as string, handling circular references
  // Defined after cleanFormJson to avoid initialization errors
  const getFormDataAsString = useCallback((formBuilder) => {
    if (!formBuilder) return null;
    
    // Prevent recursive calls
    if (isProcessingFormRef.current) {
      return lastFormDataRef.current || JSON.stringify(defaultForm);
    }
    
    isProcessingFormRef.current = true;
    try {
      let formData = formBuilder.formAsString;
      
      // If formAsString returns an object instead of string, stringify it
      if (typeof formData !== 'string') {
        // Use structuredClone if available, otherwise use JSON with circular ref handler
        if (typeof structuredClone !== 'undefined') {
          try {
            formData = JSON.stringify(structuredClone(formData));
          } catch {
            // Fallback to JSON method
            const seen = new WeakSet();
            formData = JSON.stringify(formData, (key, value) => {
              if (typeof value === 'function' || typeof value === 'symbol') {
                return undefined;
              }
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return undefined;
                }
                seen.add(value);
              }
              return value;
            });
          }
        } else {
          const seen = new WeakSet();
          formData = JSON.stringify(formData, (key, value) => {
            if (typeof value === 'function' || typeof value === 'symbol') {
              return undefined;
            }
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return undefined;
              }
              seen.add(value);
            }
            return value;
          });
        }
      }
      
      // Validate and clean the JSON
      const parsed = JSON.parse(formData);
      const cleaned = cleanFormJson(JSON.stringify(parsed));
      lastFormDataRef.current = cleaned;
      return cleaned;
    } catch (error) {
      console.error("Error getting form data as string:", error);
      // Try to get a fresh copy from the builder if available
      try {
        if (formBuilder.formAsString && typeof formBuilder.formAsString === 'string') {
          const cleaned = cleanFormJson(formBuilder.formAsString);
          lastFormDataRef.current = cleaned;
          return cleaned;
        }
      } catch {
        // If that fails, return default form
      }
      const defaultFormJson = JSON.stringify(defaultForm);
      lastFormDataRef.current = defaultFormJson;
      return defaultFormJson;
    } finally {
      setTimeout(() => {
        isProcessingFormRef.current = false;
      }, 0);
    }
  }, [cleanFormJson]);

  // Memoize getForm to prevent unnecessary re-renders and infinite loops
  // Use useMemo to cache the form JSON string to prevent recreation on every render
  const formJsonString = useMemo(() => {
    let formJson;
    if (formType === "single") {
      formJson = sections[0]?.form_json || JSON.stringify(defaultForm);
    } else {
      const selectedSection = sections.find((s) => s.section_id === selectedSectionId);
      formJson = selectedSection?.form_json || JSON.stringify(defaultForm);
    }
    
    // Always return clean, serializable JSON
    return cleanFormJson(formJson);
  }, [formType, sections, selectedSectionId, cleanFormJson]);

  // Stable getForm callback that returns memoized form JSON
  const getForm = useCallback(() => {
    // Prevent recursive calls
    if (isProcessingFormRef.current) {
      return lastFormDataRef.current || JSON.stringify(defaultForm);
    }
    
    isProcessingFormRef.current = true;
    try {
      const result = formJsonString;
      lastFormDataRef.current = result;
      return result;
    } finally {
      // Use setTimeout to reset flag after current execution completes
      setTimeout(() => {
        isProcessingFormRef.current = false;
      }, 0);
    }
  }, [formJsonString]);

  const saveCurrentFormToSection = () => {
    if (formBuilderRef.current) {
      const formData = getFormDataAsString(formBuilderRef.current);
      
      if (formData) {
        setSections((prev) => {
          return prev.map((section) => {
            if (section.section_id === selectedSectionId) {
              return { ...section, form_json: formData };
            }
            return section;
          });
        });
      }
    }
  };

  // Handle section selection
  const handleSectionSelect = (sectionId) => {
    // Save current form before switching
    saveCurrentFormToSection();
    
    // Small delay to ensure save completes
    setTimeout(() => {
      setSelectedSectionId(sectionId);
      // Reload form in builder with clean data
      if (formBuilderRef.current) {
        const selectedSection = sections.find((s) => s.section_id === sectionId);
        if (selectedSection) {
          const cleanForm = cleanFormJson(selectedSection.form_json);
          try {
            formBuilderRef.current.parseForm(cleanForm);
          } catch (e) {
            console.error("Error parsing form when switching sections:", e);
          }
        }
      }
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
        const cleanForm = cleanFormJson(reordered[0].form_json);
        try {
          formBuilderRef.current.parseForm(cleanForm);
        } catch (e) {
          console.error("Error parsing form after section delete:", e);
        }
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
      // CRITICAL: Save current form data to section BEFORE updating the name
      // This ensures form fields are preserved when FormBuilder re-renders with new formName
      let savedFormData = null;
      if (formBuilderRef.current && sectionId === selectedSectionId) {
        savedFormData = getFormDataAsString(formBuilderRef.current);
      }
      
      // Update section name AND preserve form_json in a single state update
      setSections((prev) => {
        return prev.map((s) => {
          if (s.section_id === sectionId) {
            // If this is the selected section, preserve the current form data
            if (savedFormData && sectionId === selectedSectionId) {
              return { ...s, section_name: newName.trim(), form_json: savedFormData };
            }
            // Otherwise, just update the name and keep existing form_json
            return { ...s, section_name: newName.trim() };
          }
          return s;
        });
      });
      
      setEditingSectionName(null);
      
      // Restore form after name update to ensure it persists
      // This is needed because FormBuilder might re-render when formName prop changes
      if (sectionId === selectedSectionId && formBuilderRef.current && savedFormData) {
        setTimeout(() => {
          if (formBuilderRef.current) {
            try {
              const cleanForm = cleanFormJson(savedFormData);
              formBuilderRef.current.parseForm(cleanForm);
            } catch (e) {
              console.error("Error restoring form after section name update:", e);
            }
          }
        }, 100);
      }
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
    // CRITICAL: Save current form to sections BEFORE opening modal
    // This ensures the form data is preserved when FormBuilder re-renders
    saveCurrentFormToSection();
    
    // Mark that we want to open modal after sections state updates
    pendingModalOpenRef.current = true;
  };

  const handleSaveForm = async () => {
    if (!customerId) {
      toast.error("Customer is required");
      return;
    }
    
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    
    if (!sheetId.trim()) {
      toast.error("Sheet URL is required");
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

      // Use PUT for edit mode, POST for duplicate/new mode
      if (isEditMode && editId) {
        // Update payload - only send what's needed
        const updateData = {
          form_json: formJson, // Required
          template_name: templateName.trim(), // Optional
          customer_name: customerName, // Save customer name
          sheet_url: sheetId.trim(), // Save sheet URL
          description: description?.trim() || '', // Optional
          status: status, // Status is now a direct field
        };
        await updateDynamicLog(editId, updateData);
        toast.success("Form updated successfully!");
      } else {
        // Create payload - needs customer_id and config
        const createData = {
          customer_id: customerId, // Required (FK to old API)
          customer_name: customerName, // Save customer name
          template_name: templateName.trim(), // Required
          sheet_url: sheetId.trim(), // Save sheet URL
          status: status, // Status is now a direct field
          config: {}, // Required by API (empty object)
          form_json: formJson, // Optional
          description: description?.trim() || '', // Optional
          platforms: [], // Optional but must be array if present
        };
        await createDynamicLog(createData);
        toast.success("Form saved successfully!");
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

  // Fetch form data when in edit or duplicate mode
  useEffect(() => {
    // Prevent duplicate calls
    if (!formId) return;
    
    // Check if we've already fetched this formId
    if (hasFetchedFormRef.current === formId) return;
    
    const fetchFormData = async () => {
      hasFetchedFormRef.current = formId;
      setLoadingForm(true);
      try {
        const response = await getDynamicLog(formId);
        
        console.log('[NewForm] API Response:', response);
        console.log('[NewForm] Customer data:', {
          customer: response?.customer,
          customer_name: response?.customer_name,
          company_name: response?.customer?.company_name,
          customer_customer_name: response?.customer?.customer_name,
          customerType: typeof response?.customer,
          isObject: typeof response?.customer === 'object' && response?.customer !== null
        });
        
        if (response) {
          // Set template name (for duplicate, user will change it)
          setTemplateName(response.template_name || "");

          // Set version (always, for both edit and duplicate)
          if (response.version) {
            setVersion(response.version);
          }

          // Only prefill modal fields (customer, description, sheet_url) when in EDIT mode
          // In DUPLICATE mode, these fields should remain empty
          if (isEditMode) {
            // Set sheet URL from config
            setSheetId(response.config?.sheet_url || response.sheet_url || "");
            // Set description
            setDescription(response.description ?? "");
            // Set status from direct field
            if (response.status) {
              setStatus(response.status);
            }
            
            // Set customer ID and name
            // New API returns customer_id (integer FK to old API)
            if (response.customer_id) {
              console.log('[NewForm] Setting customer ID:', response.customer_id);
              setCustomerId(response.customer_id);

              // Check if customer_name is in the response, otherwise fetch from dropdown API
              if (response.customer_name) {
                console.log('[NewForm] Found customer_name in response:', response.customer_name);
                setCustomerName(response.customer_name);
              } else {
                console.log('[NewForm] customer_name not in response, fetching from dropdown API');
                // Fetch customer name from dropdown API
                try {
                  const customersResponse = await getCustomerDropdown("");
                  const customersList = Array.isArray(customersResponse) ? customersResponse : (customersResponse.customers || []);
                  const foundCustomer = customersList.find(c => c.id === response.customer_id);
                  if (foundCustomer && foundCustomer.customer_name) {
                    console.log('[NewForm] Found customer name from dropdown API:', foundCustomer.customer_name);
                    setCustomerName(foundCustomer.customer_name);
                  } else {
                    console.log('[NewForm] Customer not found in dropdown list');
                  }
                } catch (err) {
                  console.error('[NewForm] Failed to fetch customer name:', err);
                }
              }
            } else {
              console.log('[NewForm] No customer in response');
            }
            
            // Set status (normalize to lowercase for dropdown)
            if (response.status) {
              const normalizedStatus = response.status.toLowerCase();
              console.log('[NewForm] Setting status from API:', response.status, '->', normalizedStatus);
              setStatus(normalizedStatus);
            } else {
              console.log('[NewForm] No status in API response, keeping default');
            }
          } else {
            // Duplicate mode - clear modal fields
            console.log('[NewForm] Duplicate mode - clearing modal fields (customer, status, description, sheet_id)');
            setSheetId("");
            setDescription("");
            setCustomerId(null);
            setCustomerName("");
            setStatus("completed"); // Reset to default
          }
          
          console.log('[NewForm] Form data set:', {
            templateName: response.template_name || "",
            customerId: response.customer ? (typeof response.customer === 'object' ? response.customer.id : response.customer) : null,
            customerName: response.customer_name || (typeof response.customer === 'object' && response.customer?.customer_name) || "",
            status: response.status ? response.status.toLowerCase() : "completed",
            description: response.description ?? ""
          });
          
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
                      const cleanForm = cleanFormJson(formattedSections[0].form_json);
                      formBuilderRef.current.parseForm(cleanForm);
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
                    const cleanForm = cleanFormJson(formJsonString);
                    formBuilderRef.current.parseForm(cleanForm);
                  } catch (e) {
                    console.error("Error parsing form JSON:", e);
                  }
                }
              }, 500);
            }
          }
          
          // For duplicate mode, clear template name so user must enter a new one
          if (isDuplicateMode) {
            console.log('[NewForm] Duplicate mode - clearing template name');
            setTemplateName("");
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

  // Handle opening modal after form is saved to sections
  // This ensures the form data is in sections state before FormBuilder re-renders
  useEffect(() => {
    // If we're processing form data, wait for it to complete before checking
    // The getFormDataAsString function resets isProcessingFormRef in a setTimeout(0),
    // so we need to wait a bit for that to complete
    if (isProcessingFormRef.current) {
      // Wait for the setTimeout in getFormDataAsString to reset the flag
      // Use a small delay to let the async reset happen
      setTimeout(() => {
        // Check again if we should open the modal
        if (pendingModalOpenRef.current && !showSaveModal) {
          pendingModalOpenRef.current = false;
          setFieldErrors({});
          setShowSaveModal(true);
        }
      }, 100); // Wait 100ms for the flag to reset
      
      return;
    }
    
    if (pendingModalOpenRef.current && !showSaveModal) {
      // Reset the flag first to prevent re-triggering
      pendingModalOpenRef.current = false;
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        setFieldErrors({});
        setShowSaveModal(true);
      }, 50);
    }
  }, [sections, showSaveModal]);

  // Restore form when modal closes to ensure form persists
  useEffect(() => {
    if (!showSaveModal && formBuilderRef.current && !isProcessingFormRef.current) {
      // Modal just closed - restore form from sections to ensure it's displayed
      isProcessingFormRef.current = true;
      try {
        const currentForm = formJsonString;
        if (currentForm) {
          // Small delay to ensure modal close animation completes
          setTimeout(() => {
            if (formBuilderRef.current && !isProcessingFormRef.current) {
              isProcessingFormRef.current = true;
              try {
                const cleanForm = cleanFormJson(currentForm);
                formBuilderRef.current.parseForm(cleanForm);
              } catch (e) {
                console.error("Error restoring form after modal close:", e);
              } finally {
                setTimeout(() => {
                  isProcessingFormRef.current = false;
                }, 0);
              }
            }
          }, 100);
        }
      } catch (e) {
        console.error("Error restoring form after modal close:", e);
      } finally {
        setTimeout(() => {
          isProcessingFormRef.current = false;
        }, 0);
      }
    }
  }, [showSaveModal, formJsonString, cleanFormJson]);

  const handleBack = () => {
    navigate("/home");
  };

  // Memoized callbacks for CustomerDropdown to prevent re-renders
  const handleCustomerChange = useCallback((id) => {
    setCustomerId(id);
    // Clear error when user selects a customer
    setFieldErrors(prev => {
      if (prev.customer) {
        const newErrors = { ...prev };
        delete newErrors.customer;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleCustomerSelect = useCallback((customer) => {
    // Update both customer ID and name when selected to ensure they're in sync
    if (customer) {
      if (customer.customer_id) {
        setCustomerId(customer.customer_id);
      }
      if (customer.customer_name) {
        setCustomerName(customer.customer_name);
      }
      // Clear error when user selects a customer
      setFieldErrors(prev => {
        if (prev.customer) {
          const newErrors = { ...prev };
          delete newErrors.customer;
          return newErrors;
        }
        return prev;
      });
    }
  }, []);

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
    setSheetId("");
    setDescription("");
    setCustomerId(null);
    setCustomerName("");
    setStatus("completed");
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

  // Define actions for the form builder
  const actions = useMemo(() => ({
    onSubmit: ActionDefinition.functionalAction(async (e) => {
      try {
        await e.store.formData.validate();
      } catch (error) {
        console.warn("Validation error:", error);
      }

      if (Object.keys(e.store.formData.errors).length < 1) {
        // No errors - form is valid
        console.log("Form submitted successfully!");
        console.log("Form data:", e.store.formData.data);
        toast.success("Form submitted successfully!");
        // You can add your custom submit logic here
      } else {
        // Has errors
        console.error("Form has errors:", e.store.formData.errors);
        toast.error("Please fix the errors in the form");
      }
    }),
  }), []);

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
            onClick={handleBack} 
            className="back-button icon-only"
            title="Back to home"
          >
            <span className="button-icon"><ArrowLeft size={18} /></span>
          </button>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
          <h1>{isEditMode ? "Edit Form" : isDuplicateMode ? "Duplicate Form" : "Form Builder"}</h1>
          {version && (
            <span className="version-badge" title="Template Version">
              v{version}
            </span>
          )}
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
            actions={actions}
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
              <label className="modal-label">
                Customer <span className="required-asterisk">*</span>
              </label>
              <CustomerDropdown
                value={customerId}
                onChange={handleCustomerChange}
                onSelect={handleCustomerSelect}
                initialCustomerName={customerName}
                placeholder="Select customer..."
              />
              {fieldErrors.customer && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.customer) 
                    ? fieldErrors.customer.join(', ')
                    : fieldErrors.customer}
                </div>
              )}
              {fieldErrors.form_json && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.form_json) 
                    ? fieldErrors.form_json.join(', ')
                    : fieldErrors.form_json}
                </div>
              )}
            </div>
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
              <label htmlFor="modal-sheet-url" className="modal-label">
                Sheet URL <span className="required-asterisk">*</span>
              </label>
              <input
                id="modal-sheet-url"
                type="text"
                value={sheetId}
                onChange={(e) => {
                  setSheetId(e.target.value);
                  // Clear error when user starts typing
                  if (fieldErrors.sheet_id) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.sheet_id;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter sheet URL..."
                className={`modal-input ${fieldErrors.sheet_id ? 'modal-input-error' : ''}`}
                required
              />
              {fieldErrors.sheet_id && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.sheet_id) 
                    ? fieldErrors.sheet_id.join(', ')
                    : fieldErrors.sheet_id}
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
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="modal-field-group">
              <label htmlFor="modal-description" className="modal-label">
                Description <span className="optional-text">(optional)</span>
              </label>
              <textarea
                id="modal-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.description;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Add a short description for this form..."
                className={`modal-textarea ${fieldErrors.description ? 'modal-input-error' : ''}`}
                rows={4}
              />
              {fieldErrors.description && (
                <div className="modal-field-error">
                  {Array.isArray(fieldErrors.description)
                    ? fieldErrors.description.join(', ')
                    : fieldErrors.description}
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
            disabled={saving || !templateName.trim() || !customerId}
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

