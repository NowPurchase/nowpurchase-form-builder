import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  formEngineRsuiteCssLoader,
  ltrCssLoader,
  RsLocalizationWrapper,
  rSuiteComponents,
} from '@react-form-builder/components-rsuite';
import { BiDi, createView, FormViewer } from '@react-form-builder/core';
import { getDynamicLog, getSheetPreview } from "../../services/dynamicLogApi";
import { apiToLocal } from "../../utils/dataTransform";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import LoadingSpinner from "../shared/LoadingSpinner";
import "rsuite/dist/rsuite.min.css";
import "./ViewForm.css";

const components = rSuiteComponents.map((c) => c.build().model);

const viewWithCss = createView(components)
  .withViewerWrapper(RsLocalizationWrapper)
  .withCssLoader(BiDi.LTR, ltrCssLoader)
  .withCssLoader('common', formEngineRsuiteCssLoader);

function ViewForm() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("preview");
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [sheetPreviewHtml, setSheetPreviewHtml] = useState("");
  const [loadingSheetPreview, setLoadingSheetPreview] = useState(false);
  const hasFetchedFormRef = useRef(false);

  useEffect(() => {
    if (!formId) return;
    
    if (hasFetchedFormRef.current === formId) return;
    
    const fetchForm = async () => {
      hasFetchedFormRef.current = formId;
      try {
        setLoading(true);
        const apiData = await getDynamicLog(formId);
        const transformedData = apiToLocal(apiData);
        setFormData(transformedData);
        setSelectedSectionIndex(0);
      } catch (err) {
        const errorMsg = formatErrorMessage(err);
        toast.error(`Failed to load form: ${errorMsg}`);
        setFormData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const handleBack = () => {
    navigate("/home");
  };

  // Fetch sheet preview when Sheet Preview tab is clicked
  useEffect(() => {
    if (activeTab === "sheet-preview" && formId && !sheetPreviewHtml && !loadingSheetPreview) {
      const fetchSheetPreview = async () => {
        try {
          setLoadingSheetPreview(true);
          const html = await getSheetPreview(formId);
          // Use HTML as-is from API response without any modifications
          setSheetPreviewHtml(html);
        } catch (err) {
          const errorMsg = formatErrorMessage(err);
          toast.error(`Failed to load sheet preview: ${errorMsg}`);
          setSheetPreviewHtml("");
        } finally {
          setLoadingSheetPreview(false);
        }
      };
      fetchSheetPreview();
    }
  }, [activeTab, formId, sheetPreviewHtml, loadingSheetPreview]);

  const getFormJson = () => {
    if (!formData) return JSON.stringify({});
    
    if (formData.form_type === "single") {
      return typeof formData.form_json === "string"
        ? formData.form_json
        : JSON.stringify(formData.form_json);
    } else {
      const firstSection = formData.sections?.[0];
      if (firstSection) {
        return typeof firstSection.form_json === "string"
          ? firstSection.form_json
          : JSON.stringify(firstSection.form_json);
      }
    }
    return JSON.stringify({});
  };

  const getSectionFormJson = (section) => {
    if (!section) return JSON.stringify({});
    return typeof section.form_json === "string"
      ? section.form_json
      : JSON.stringify(section.form_json);
  };

  const getAllSectionsJson = () => {
    if (!formData || formData.form_type !== "multi-step") return null;
    return formData.sections || [];
  };

  const actions = useMemo(() => ({
    onSubmit: (e) => {
      toast.success("Form submitted successfully!");
    },
  }), []);

  const getFormattedJson = () => {
    if (!formData) return "{}";
    
    const formattedData = JSON.parse(JSON.stringify(formData));
    
    if (formattedData.form_type === "single" && typeof formattedData.form_json === "string") {
      try {
        formattedData.form_json = JSON.parse(formattedData.form_json);
      } catch (e) {
        // Ignore parse errors
      }
    } else if (formattedData.form_type === "multi-step" && formattedData.sections) {
      formattedData.sections = formattedData.sections.map((section) => {
        if (typeof section.form_json === "string") {
          try {
            section.form_json = JSON.parse(section.form_json);
          } catch (e) {
            // Ignore parse errors
          }
        }
        return section;
      });
    }
    
    return JSON.stringify(formattedData, null, 2);
  };

  const handleCopyJson = async () => {
    try {
      const jsonString = getFormattedJson();
      await navigator.clipboard.writeText(jsonString);
      toast.success("JSON copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy JSON to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="view-form-container">
        <div className="view-form-header">
          <h1>Form Viewer</h1>
        </div>
        <LoadingSpinner text="Loading form..." />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="view-form-container">
        <div className="view-form-header">
          <h1>Form Not Found</h1>
          <button onClick={handleBack} className="back-button">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-form-container">
      <div className="view-form-header">
        <div className="header-left">
          <h1>{formData["from-name"] || "Form View"}</h1>
          <span className="form-id-badge">ID: {formData.form_id}</span>
          {formData.version && (
            <span className="form-version-badge">Version: {formData.version}</span>
          )}
        </div>
        <div className="header-actions">
          <button onClick={handleBack} className="back-button">
            Back to Home
          </button>
        </div>
      </div>

      <div className="view-form-tabs">
        <button
          className={`tab-button ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
        <button
          className={`tab-button ${activeTab === "sheet-preview" ? "active" : ""}`}
          onClick={() => setActiveTab("sheet-preview")}
        >
          Sheet Preview
        </button>
        <button
          className={`tab-button ${activeTab === "json" ? "active" : ""}`}
          onClick={() => setActiveTab("json")}
        >
          JSON View
        </button>
      </div>

      <div className="view-form-content">
        {activeTab === "sheet-preview" ? (
          <div className="sheet-preview-wrapper">
            {loadingSheetPreview ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '400px',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <LoadingSpinner text="Loading sheet preview..." />
              </div>
            ) : sheetPreviewHtml ? (
              <div 
                style={{ width: 'fit-content', margin: '0 auto' }}
                dangerouslySetInnerHTML={{ __html: sheetPreviewHtml }}
              />
            ) : (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '400px',
                color: '#64748b'
              }}>
                <p>No sheet preview available</p>
              </div>
            )}
          </div>
        ) : activeTab === "preview" ? (
          <div className="form-preview-wrapper">
            {formData.form_type === "multi-step" && getAllSectionsJson() ? (
              <div className="multi-step-preview">
                <div className="sections-sidebar">
                  <div className="sections-sidebar-header">
                    <h3>Steps</h3>
                  </div>
                  <div className="sections-list">
                    {getAllSectionsJson().map((section, index) => (
                      <div
                        key={section.section_id}
                        className={`section-nav-item ${
                          selectedSectionIndex === index ? "active" : ""
                        }`}
                        onClick={() => setSelectedSectionIndex(index)}
                      >
                        <div className="section-nav-number">{index + 1}</div>
                        <div className="section-nav-name">{section.section_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="section-content-area">
                  {getAllSectionsJson()[selectedSectionIndex] && (
                    <div className="section-preview">
                      <div className="section-preview-header">
                        <h3>
                          Step {selectedSectionIndex + 1}: {getAllSectionsJson()[selectedSectionIndex].section_name}
                        </h3>
                      </div>
                      <div className="section-preview-content">
                        <FormViewer
                          view={viewWithCss}
                          formName={getAllSectionsJson()[selectedSectionIndex].section_name}
                          getForm={() => getSectionFormJson(getAllSectionsJson()[selectedSectionIndex])}
                          actions={actions}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <FormViewer
                view={viewWithCss}
                formName={formData["from-name"]}
                getForm={getFormJson}
                actions={actions}
              />
            )}
          </div>
        ) : (
          <div className="json-view-wrapper">
            <div className="json-view-header">
              <h3>Form JSON</h3>
              <button onClick={handleCopyJson} className="copy-json-button">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy to Clipboard
              </button>
            </div>
            <div className="json-viewer">
              <pre>{getFormattedJson()}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewForm;

