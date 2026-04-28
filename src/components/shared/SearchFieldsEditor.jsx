import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input } from 'rsuite';
import './SearchFieldsEditor.css';

// Common field path suggestions
const FIELD_SUGGESTIONS = [
  { value: 'data.main.data.serial_no', label: 'Serial Number', category: 'Form Data' },
  { value: 'data.main.data.heat_no', label: 'Heat Number', category: 'Form Data' },
  { value: 'data.main.data.casting_name.name', label: 'Casting Name', category: 'Form Data' },
  { value: 'data.main.data.assembly.name', label: 'Assembly Name', category: 'Form Data' },
  { value: 'parent_data.snos[0]', label: 'Parent Serial (first)', category: 'Parent Data' },
  { value: 'parent_data.casting_name.name', label: 'Parent Casting Name', category: 'Parent Data' },
  { value: 'meta.created_by_name', label: 'Created By', category: 'Metadata' },
  { value: 'status', label: 'Status', category: 'System' },
];

const SearchFieldsEditor = ({ fields, onChange }) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Filter suggestions based on input and exclude already added fields
  const filteredSuggestions = FIELD_SUGGESTIONS.filter(s =>
    !fields.includes(s.value) &&
    (newFieldValue === '' ||
      s.value.toLowerCase().includes(newFieldValue.toLowerCase()) ||
      s.label.toLowerCase().includes(newFieldValue.toLowerCase()))
  );

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddField = () => {
    const trimmedValue = newFieldValue.trim();
    if (trimmedValue && !fields.includes(trimmedValue)) {
      onChange([...fields, trimmedValue]);
      setNewFieldValue('');
      setShowAddInput(false);
      setShowSuggestions(false);
    }
  };

  const handleRemoveField = (fieldToRemove) => {
    onChange(fields.filter(f => f !== fieldToRemove));
  };

  const handleSuggestionClick = (suggestion) => {
    if (!fields.includes(suggestion.value)) {
      onChange([...fields, suggestion.value]);
    }
    setNewFieldValue('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddField();
    } else if (e.key === 'Escape') {
      setShowAddInput(false);
      setNewFieldValue('');
      setShowSuggestions(false);
    }
  };

  // Group suggestions by category
  const groupedSuggestions = filteredSuggestions.reduce((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="search-fields-editor">
      <div className="search-fields-description">
        <p>Configure which field paths can be searched. Users can search logsheets by these fields.</p>
      </div>

      <div className="search-fields-list">
        {fields.length === 0 ? (
          <div className="search-fields-empty">
            No search fields configured
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={index} className="search-field-chip">
              <code className="search-field-value">{field}</code>
              <button
                type="button"
                className="search-field-remove"
                onClick={() => handleRemoveField(field)}
                title="Remove field"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {showAddInput ? (
        <div className="search-field-input-wrapper">
          <div className="search-field-input-row">
            <Input
              ref={inputRef}
              placeholder="Enter field path (e.g., data.main.data.serial_no)"
              value={newFieldValue}
              onChange={(value) => {
                setNewFieldValue(value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              size="sm"
            />
            <Button size="xs" appearance="primary" onClick={handleAddField}>
              Add
            </Button>
            <Button
              size="xs"
              appearance="subtle"
              onClick={() => {
                setShowAddInput(false);
                setNewFieldValue('');
                setShowSuggestions(false);
              }}
            >
              Cancel
            </Button>
          </div>

          {showSuggestions && Object.keys(groupedSuggestions).length > 0 && (
            <div className="search-field-suggestions" ref={suggestionsRef}>
              {Object.entries(groupedSuggestions).map(([category, suggestions]) => (
                <div key={category} className="suggestion-category">
                  <div className="suggestion-category-header">{category}</div>
                  {suggestions.map(suggestion => (
                    <div
                      key={suggestion.value}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <code className="suggestion-value">{suggestion.value}</code>
                      <span className="suggestion-label">{suggestion.label}</span>
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
          onClick={() => setShowAddInput(true)}
          className="add-search-field-btn"
          startIcon={<Plus size={16} />}
          size="sm"
        >
          Add Search Field
        </Button>
      )}
    </div>
  );
};

export default SearchFieldsEditor;
