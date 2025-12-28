import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, X } from 'lucide-react';
import { Input } from 'rsuite';
import './DraggableFieldRow.css';

const DraggableFieldRow = ({
  index,
  field,
  onLabelChange,
  onKeyChange,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  errors = {},
  suggestions = []
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Filter suggestions based on key input
  useEffect(() => {
    if (field.key && suggestions.length > 0) {
      const filtered = suggestions.filter(s =>
        s.value.toLowerCase().includes(field.key.toLowerCase()) ||
        s.label.toLowerCase().includes(field.key.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(suggestions);
    }
  }, [field.key, suggestions]);

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

  const handleKeyInputChange = (value) => {
    onKeyChange(value);
    if (value && suggestions.length > 0) {
      setShowSuggestions(true);
      setActiveSuggestionIndex(0);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onKeyChange(suggestion.value);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions[activeSuggestionIndex]) {
        handleSuggestionClick(filteredSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Group suggestions by category
  const groupedSuggestions = filteredSuggestions.reduce((acc, suggestion) => {
    const category = suggestion.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(suggestion);
    return acc;
  }, {});

  return (
    <div
      className="draggable-field-row"
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
    >
      <div className="field-row-number">{index + 1}.</div>

      <div className="field-row-drag-handle">
        <GripVertical size={16} />
      </div>

      <div className="field-row-input-group">
        <Input
          placeholder="Label (e.g., Date)"
          value={field.label}
          onChange={onLabelChange}
          className={errors.label ? 'input-error' : ''}
        />
        {errors.label && <span className="error-text">{errors.label}</span>}
      </div>

      <div className="field-row-input-group field-key-input-wrapper">
        <Input
          ref={inputRef}
          placeholder="Key (e.g., parent_data.datetime)"
          value={field.key}
          onChange={handleKeyInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          className={errors.key ? 'input-error' : ''}
        />
        {errors.key && <span className="error-text">{errors.key}</span>}

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="suggestions-dropdown" ref={suggestionsRef}>
            {Object.keys(groupedSuggestions).map(category => (
              <div key={category} className="suggestions-category">
                <div className="suggestions-category-header">{category}</div>
                {groupedSuggestions[category].map((suggestion, idx) => (
                  <div
                    key={suggestion.value}
                    className={`suggestion-item ${
                      filteredSuggestions.indexOf(suggestion) === activeSuggestionIndex
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setActiveSuggestionIndex(filteredSuggestions.indexOf(suggestion))}
                  >
                    <div className="suggestion-value">{suggestion.value}</div>
                    <div className="suggestion-label">{suggestion.label}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="field-row-delete-btn"
        onClick={onDelete}
        title="Delete field"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default DraggableFieldRow;
