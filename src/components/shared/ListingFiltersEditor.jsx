import React, { useState } from 'react';
import { Plus, GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, Toggle, SelectPicker } from 'rsuite';
import './ListingFiltersEditor.css';

const PLACEMENT_OPTIONS = [
  { label: 'Main', value: 'main' },
  { label: 'More', value: 'more' }
];

const ListingFiltersEditor = ({ filters, onChange }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAddFilter = () => {
    const newFilter = {
      id: `filter_${Date.now()}`,
      label: '',
      type: 'dropdown',
      placement: 'main',
      field: '',
      multiSelect: false,
      defaultValue: null,
      options: [],
      show_count: false,
      allow_clear: true
    };
    onChange([...filters, newFilter]);
    setExpandedIndex(filters.length);
  };

  const handleDeleteFilter = (index) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onChange(newFilters);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleFilterChange = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    onChange(newFilters);
  };

  const handleAddOption = (filterIndex) => {
    const newFilters = [...filters];
    const options = newFilters[filterIndex].options || [];
    newFilters[filterIndex].options = [...options, { label: '', value: '', color: '#3498ff' }];
    onChange(newFilters);
  };

  const handleOptionChange = (filterIndex, optionIndex, field, value) => {
    const newFilters = [...filters];
    const options = [...newFilters[filterIndex].options];
    options[optionIndex] = { ...options[optionIndex], [field]: value };
    newFilters[filterIndex].options = options;
    onChange(newFilters);
  };

  const handleDeleteOption = (filterIndex, optionIndex) => {
    const newFilters = [...filters];
    newFilters[filterIndex].options = newFilters[filterIndex].options.filter((_, i) => i !== optionIndex);
    onChange(newFilters);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newFilters = [...filters];
    const draggedFilter = newFilters[draggedIndex];
    newFilters.splice(draggedIndex, 1);
    const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newFilters.splice(actualDropIndex, 0, draggedFilter);
    onChange(newFilters);
    setDraggedIndex(null);

    // Update expanded index if needed
    if (expandedIndex === draggedIndex) {
      setExpandedIndex(actualDropIndex);
    } else if (expandedIndex !== null) {
      if (draggedIndex < expandedIndex && actualDropIndex >= expandedIndex) {
        setExpandedIndex(expandedIndex - 1);
      } else if (draggedIndex > expandedIndex && actualDropIndex <= expandedIndex) {
        setExpandedIndex(expandedIndex + 1);
      }
    }
  };

  return (
    <div className="listing-filters-editor">
      <div className="filters-description">
        <p>Configure filters for the logsheet listing. Users can filter logsheets using these options.</p>
      </div>

      {filters.length === 0 ? (
        <div className="filters-empty-state">
          <p>No filters configured</p>
          <p className="empty-state-hint">Add filters to enable filtering in logsheet listings</p>
        </div>
      ) : (
        <div className="filters-list">
          {filters.map((filter, index) => (
            <div
              key={index}
              className={`filter-card ${expandedIndex === index ? 'expanded' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="filter-card-header" onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}>
                <div className="filter-drag-handle" onClick={(e) => e.stopPropagation()}>
                  <GripVertical size={16} />
                </div>
                <div className="filter-summary">
                  <span className="filter-label">{filter.label || 'Untitled Filter'}</span>
                  <span className="filter-meta">
                    <span className={`filter-placement-badge ${filter.placement || 'main'}`}>
                      {filter.placement === 'more' ? 'More' : 'Main'}
                    </span>
                    {filter.show_count && <span className="filter-count-badge">Count</span>}
                    {filter.multiSelect && <span className="filter-multi-badge">Multi</span>}
                  </span>
                </div>
                <div className="filter-card-actions">
                  <button
                    type="button"
                    className="filter-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFilter(index);
                    }}
                    title="Delete filter"
                  >
                    <X size={16} />
                  </button>
                  {expandedIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {expandedIndex === index && (
                <div className="filter-card-body">
                  <div className="filter-form-grid">
                    <div className="filter-form-field">
                      <label>Filter ID</label>
                      <Input
                        value={filter.id}
                        onChange={(value) => handleFilterChange(index, 'id', value)}
                        placeholder="e.g., status"
                        size="sm"
                      />
                    </div>

                    <div className="filter-form-field">
                      <label>Label</label>
                      <Input
                        value={filter.label}
                        onChange={(value) => handleFilterChange(index, 'label', value)}
                        placeholder="e.g., Status"
                        size="sm"
                      />
                    </div>

                    <div className="filter-form-field">
                      <label>Field Path</label>
                      <Input
                        value={filter.field}
                        onChange={(value) => handleFilterChange(index, 'field', value)}
                        placeholder="e.g., status or meta.created_at"
                        size="sm"
                      />
                    </div>

                    <div className="filter-form-field">
                      <label>Placement</label>
                      <SelectPicker
                        data={PLACEMENT_OPTIONS}
                        value={filter.placement || 'main'}
                        onChange={(value) => handleFilterChange(index, 'placement', value)}
                        searchable={false}
                        cleanable={false}
                        size="sm"
                        block
                      />
                    </div>

                    <div className="filter-form-field">
                      <label>Default Value</label>
                      <Input
                        value={filter.defaultValue || ''}
                        onChange={(value) => handleFilterChange(index, 'defaultValue', value || null)}
                        placeholder="e.g., approval"
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="filter-toggles">
                    <label className="filter-toggle-item">
                      <Toggle
                        checked={filter.show_count}
                        onChange={(checked) => handleFilterChange(index, 'show_count', checked)}
                        size="sm"
                      />
                      <span>Show Count</span>
                    </label>

                    <label className="filter-toggle-item">
                      <Toggle
                        checked={filter.multiSelect}
                        onChange={(checked) => handleFilterChange(index, 'multiSelect', checked)}
                        size="sm"
                      />
                      <span>Multi-Select</span>
                    </label>

                    <label className="filter-toggle-item">
                      <Toggle
                        checked={filter.allow_clear}
                        onChange={(checked) => handleFilterChange(index, 'allow_clear', checked)}
                        size="sm"
                      />
                      <span>Allow Clear</span>
                    </label>
                  </div>

                  <div className="filter-options-section">
                      <div className="filter-options-header">
                        <label>Options</label>
                        <Button
                          size="xs"
                          appearance="ghost"
                          onClick={() => handleAddOption(index)}
                          startIcon={<Plus size={14} />}
                        >
                          Add Option
                        </Button>
                      </div>

                      {(filter.options || []).length === 0 ? (
                        <div className="filter-options-empty">No options configured</div>
                      ) : (
                        <div className="filter-options-list">
                          {filter.options.map((option, optIndex) => (
                            <div key={optIndex} className="filter-option-row">
                              <Input
                                value={option.label}
                                onChange={(value) => handleOptionChange(index, optIndex, 'label', value)}
                                placeholder="Label"
                                size="sm"
                              />
                              <Input
                                value={option.value}
                                onChange={(value) => handleOptionChange(index, optIndex, 'value', value)}
                                placeholder="Value"
                                size="sm"
                              />
                              <div className="option-color-picker">
                                <input
                                  type="color"
                                  value={option.color || '#3498ff'}
                                  onChange={(e) => handleOptionChange(index, optIndex, 'color', e.target.value)}
                                  title="Option color"
                                />
                              </div>
                              <button
                                type="button"
                                className="option-delete-btn"
                                onClick={() => handleDeleteOption(index, optIndex)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        appearance="ghost"
        onClick={handleAddFilter}
        className="add-filter-btn"
        startIcon={<Plus size={16} />}
      >
        Add Filter
      </Button>
    </div>
  );
};

export default ListingFiltersEditor;
