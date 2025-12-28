import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input } from 'rsuite';
import './WorkflowRoutingEditor.css';

// Common push field suggestions
const COMMON_PUSH_FIELDS = [
  { value: 'parent_data.datetime', label: 'Date & Time', category: 'Parent Data' },
  { value: 'parent_data.snos[0]', label: 'Serial Number (first)', category: 'Parent Data' },
  { value: 'parent_data.snos', label: 'Serial Numbers (all)', category: 'Parent Data' },
  { value: 'parent_data.casting_name', label: 'Casting Name', category: 'Parent Data' },
  { value: 'parent_data.assembly', label: 'Assembly', category: 'Parent Data' },
  { value: 'status', label: 'Status', category: 'System' },
  { value: 'meta.created_at', label: 'Created Date', category: 'Metadata' },
  { value: 'meta.updated_at', label: 'Updated Date', category: 'Metadata' },
  { value: 'meta.created_by', label: 'Created By', category: 'Metadata' },
  { value: 'data.', label: 'Form Data (custom)...', category: 'Form Data' },
];

const WorkflowRoutingEditor = ({
  nextTemplate,
  previousTemplate,
  pushFields,
  availableTemplates,
  availablePushFields = [],
  onNextTemplateChange,
  onPreviousTemplateChange,
  onPushFieldsChange,
  currentTemplateId,
  errors = {}
}) => {
  const [showNextTemplateDropdown, setShowNextTemplateDropdown] = useState(false);
  const [showPreviousTemplateDropdown, setShowPreviousTemplateDropdown] = useState(false);
  const [nextTemplateSearch, setNextTemplateSearch] = useState('');
  const [previousTemplateSearch, setPreviousTemplateSearch] = useState('');
  const [showAddFieldInput, setShowAddFieldInput] = useState(false);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);

  const nextTemplateDropdownRef = useRef(null);
  const previousTemplateDropdownRef = useRef(null);
  const fieldInputRef = useRef(null);

  // Get selected template details (nextTemplate is now template_id)
  const selectedNextTemplate = availableTemplates.find(t => t.template_id === nextTemplate);
  const selectedPreviousTemplate = availableTemplates.find(t => t.template_id === previousTemplate);

  // Filter templates based on search (search by template_id)
  const filteredNextTemplates = availableTemplates.filter(t =>
    t.template_id.toLowerCase().includes(nextTemplateSearch.toLowerCase()) &&
    t.template_id !== currentTemplateId
  );

  const filteredPreviousTemplates = availableTemplates.filter(t =>
    t.template_id.toLowerCase().includes(previousTemplateSearch.toLowerCase()) &&
    t.template_id !== currentTemplateId
  );

  // Combine available fields from previous template with common suggestions
  const availableFieldsFromPrevious = availablePushFields.map(field => ({
    value: field,
    label: field,
    category: 'From Previous Template'
  }));

  const allFieldSuggestions = [...availableFieldsFromPrevious, ...COMMON_PUSH_FIELDS];

  // Filter field suggestions
  const filteredFieldSuggestions = allFieldSuggestions.filter(f =>
    newFieldValue === '' ||
    f.value.toLowerCase().includes(newFieldValue.toLowerCase()) ||
    f.label.toLowerCase().includes(newFieldValue.toLowerCase())
  );

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (nextTemplateDropdownRef.current && !nextTemplateDropdownRef.current.contains(event.target)) {
        setShowNextTemplateDropdown(false);
      }
      if (previousTemplateDropdownRef.current && !previousTemplateDropdownRef.current.contains(event.target)) {
        setShowPreviousTemplateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTemplateSelect = (template) => {
    onNextTemplateChange(template.template_id); // Store template_id
    setShowNextTemplateDropdown(false);
    setNextTemplateSearch('');
  };

  const handleClearNextTemplate = () => {
    onNextTemplateChange(null);
  };

  const handlePreviousTemplateSelect = (template) => {
    onPreviousTemplateChange(template.template_id);
    setShowPreviousTemplateDropdown(false);
    setPreviousTemplateSearch('');
  };

  const handleClearPreviousTemplate = () => {
    onPreviousTemplateChange(null);
  };

  const handleAddField = () => {
    if (newFieldValue.trim() && !pushFields.includes(newFieldValue.trim())) {
      onPushFieldsChange([...pushFields, newFieldValue.trim()]);
      setNewFieldValue('');
      setShowAddFieldInput(false);
      setShowFieldSuggestions(false);
    }
  };

  const handleRemoveField = (fieldToRemove) => {
    onPushFieldsChange(pushFields.filter(f => f !== fieldToRemove));
  };

  const handleFieldSuggestionClick = (suggestion) => {
    setNewFieldValue(suggestion.value);
    setShowFieldSuggestions(false);
    // Auto-add if it's not a partial field
    if (!suggestion.value.endsWith('.')) {
      setTimeout(() => {
        if (newFieldValue === suggestion.value) {
          handleAddField();
        }
      }, 100);
    }
  };

  const handleFieldKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddField();
    } else if (e.key === 'Escape') {
      setShowAddFieldInput(false);
      setNewFieldValue('');
      setShowFieldSuggestions(false);
    }
  };

  return (
    <div className="workflow-routing-editor">
      <div className="routing-section">
        <label className="routing-label">Next Template in Workflow</label>
        <p className="routing-hint">Select the template that comes next in the workflow</p>

        <div className="template-selector" ref={nextTemplateDropdownRef}>
          <div
            className={`template-selector-display ${errors.next_template ? 'error' : ''}`}
            onClick={() => setShowNextTemplateDropdown(!showNextTemplateDropdown)}
          >
            {selectedNextTemplate ? (
              <span className="selected-template" title={`${selectedNextTemplate.template_name} (${selectedNextTemplate.template_id})`}>
                {selectedNextTemplate.template_name}
              </span>
            ) : (
              <span className="template-placeholder">Select next template...</span>
            )}
            <div className="template-selector-icons">
              {selectedNextTemplate && (
                <button
                  type="button"
                  className="clear-template-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearNextTemplate();
                  }}
                  title="Clear selection"
                >
                  <X size={14} />
                </button>
              )}
              {showNextTemplateDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {showNextTemplateDropdown && (
            <div className="template-dropdown">
              <div className="template-dropdown-search">
                <Input
                  placeholder="Search templates..."
                  value={nextTemplateSearch}
                  onChange={setNextTemplateSearch}
                  size="sm"
                />
              </div>

              <div className="template-dropdown-list">
                {filteredNextTemplates.length === 0 ? (
                  <div className="template-dropdown-empty">No templates found</div>
                ) : (
                  filteredNextTemplates.map(template => (
                    <div
                      key={template.template_id}
                      className={`template-dropdown-item ${
                        template.template_id === nextTemplate ? 'selected' : ''
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                      title={`ID: ${template.template_id}`}
                    >
                      <div className="template-dropdown-item-content">
                        <div className="template-dropdown-item-name">{template.template_name}</div>
                        <div className="template-dropdown-item-id">{template.template_id}</div>
                      </div>
                      <div className="template-dropdown-item-version">v{template.version}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {errors.next_template && <span className="error-text">{errors.next_template}</span>}
      </div>

      <div className="routing-section">
        <label className="routing-label">Previous Template in Workflow</label>
        <p className="routing-hint">Select the template that comes before this one in the workflow</p>

        <div className="template-selector" ref={previousTemplateDropdownRef}>
          <div
            className={`template-selector-display ${errors.previous_template ? 'error' : ''}`}
            onClick={() => setShowPreviousTemplateDropdown(!showPreviousTemplateDropdown)}
          >
            {selectedPreviousTemplate ? (
              <span className="selected-template" title={`${selectedPreviousTemplate.template_name} (${selectedPreviousTemplate.template_id})`}>
                {selectedPreviousTemplate.template_name}
              </span>
            ) : (
              <span className="template-placeholder">Select previous template...</span>
            )}
            <div className="template-selector-icons">
              {selectedPreviousTemplate && (
                <button
                  type="button"
                  className="clear-template-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearPreviousTemplate();
                  }}
                  title="Clear selection"
                >
                  <X size={14} />
                </button>
              )}
              {showPreviousTemplateDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {showPreviousTemplateDropdown && (
            <div className="template-dropdown">
              <div className="template-dropdown-search">
                <Input
                  placeholder="Search templates..."
                  value={previousTemplateSearch}
                  onChange={setPreviousTemplateSearch}
                  size="sm"
                />
              </div>

              <div className="template-dropdown-list">
                {filteredPreviousTemplates.length === 0 ? (
                  <div className="template-dropdown-empty">No templates found</div>
                ) : (
                  filteredPreviousTemplates.map(template => (
                    <div
                      key={template.template_id}
                      className={`template-dropdown-item ${
                        template.template_id === previousTemplate ? 'selected' : ''
                      }`}
                      onClick={() => handlePreviousTemplateSelect(template)}
                      title={`ID: ${template.template_id}`}
                    >
                      <div className="template-dropdown-item-content">
                        <div className="template-dropdown-item-name">{template.template_name}</div>
                        <div className="template-dropdown-item-id">{template.template_id}</div>
                      </div>
                      <div className="template-dropdown-item-version">v{template.version}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {errors.previous_template && <span className="error-text">{errors.previous_template}</span>}
      </div>

      <div className="routing-section">
        <label className="routing-label">Fields to Push to Next Step</label>
        <p className="routing-hint">
          {availablePushFields.length > 0
            ? `Select fields configured in the previous template to receive from the previous workflow step`
            : 'These fields will be copied to parent_data in the next template'}
        </p>

        {availablePushFields.length > 0 && (
          <div className="available-fields-section">
            <label className="available-fields-label">Available from Previous Template:</label>
            <div className="available-fields-chips">
              {availablePushFields.map((field, index) => {
                const isAlreadyAdded = pushFields.includes(field);
                return (
                  <button
                    key={index}
                    type="button"
                    className={`available-field-chip ${isAlreadyAdded ? 'added' : ''}`}
                    onClick={() => {
                      if (!isAlreadyAdded) {
                        onPushFieldsChange([...pushFields, field]);
                      }
                    }}
                    disabled={isAlreadyAdded}
                    title={isAlreadyAdded ? 'Already added' : 'Click to add'}
                  >
                    {field}
                    {isAlreadyAdded && <span className="check-icon">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="push-fields-list">
          {pushFields.length === 0 ? (
            <div className="push-fields-empty">No fields configured</div>
          ) : (
            pushFields.map((field, index) => (
              <div key={index} className="push-field-item">
                <span className="push-field-value">{field}</span>
                <button
                  type="button"
                  className="push-field-remove-btn"
                  onClick={() => handleRemoveField(field)}
                  title="Remove field"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {showAddFieldInput ? (
          <div className="add-field-input-wrapper">
            <Input
              ref={fieldInputRef}
              placeholder="Enter field path (e.g., parent_data.snos[0])"
              value={newFieldValue}
              onChange={(value) => {
                setNewFieldValue(value);
                setShowFieldSuggestions(true);
              }}
              onKeyDown={handleFieldKeyDown}
              onFocus={() => setShowFieldSuggestions(true)}
              size="sm"
            />
            <div className="add-field-actions">
              <Button size="xs" appearance="primary" onClick={handleAddField}>
                Add
              </Button>
              <Button
                size="xs"
                appearance="subtle"
                onClick={() => {
                  setShowAddFieldInput(false);
                  setNewFieldValue('');
                  setShowFieldSuggestions(false);
                }}
              >
                Cancel
              </Button>
            </div>

            {showFieldSuggestions && filteredFieldSuggestions.length > 0 && (
              <div className="field-suggestions-dropdown">
                {Object.entries(
                  filteredFieldSuggestions.reduce((acc, s) => {
                    const cat = s.category || 'Other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(s);
                    return acc;
                  }, {})
                ).map(([category, suggestions]) => (
                  <div key={category} className="field-suggestions-category">
                    <div className="field-suggestions-category-header">{category}</div>
                    {suggestions.map(suggestion => (
                      <div
                        key={suggestion.value}
                        className="field-suggestion-item"
                        onClick={() => handleFieldSuggestionClick(suggestion)}
                      >
                        <div className="field-suggestion-value">{suggestion.value}</div>
                        <div className="field-suggestion-label">{suggestion.label}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            appearance="ghost"
            onClick={() => setShowAddFieldInput(true)}
            className="add-field-btn"
            startIcon={<Plus size={16} />}
            size="sm"
          >
            Add Custom Field
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowRoutingEditor;
