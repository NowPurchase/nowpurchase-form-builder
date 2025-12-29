import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from 'rsuite';
import DraggableFieldRow from './DraggableFieldRow';
import './ListingFieldsEditor.css';

// Common key suggestions for autocomplete
const COMMON_KEYS = [
  // System
  { value: '_id', label: 'Document ID', category: 'System' },
  { value: 'status', label: 'Status', category: 'System' },
  { value: 'template_id', label: 'Template ID', category: 'System' },
  { value: 'template_version', label: 'Template Version', category: 'System' },

  // Parent Data
  { value: 'parent_data.datetime', label: 'Date & Time', category: 'Parent Data' },
  { value: 'parent_data.snos[0]', label: 'Serial Number (first)', category: 'Parent Data' },
  { value: 'parent_data.snos', label: 'Serial Numbers (all)', category: 'Parent Data' },
  { value: 'parent_data.casting_name.name', label: 'Casting Name', category: 'Parent Data' },
  { value: 'parent_data.casting_name.id', label: 'Casting ID', category: 'Parent Data' },
  { value: 'parent_data.assembly.name', label: 'Assembly Name', category: 'Parent Data' },
  { value: 'parent_data.assembly.id', label: 'Assembly ID', category: 'Parent Data' },

  // Metadata
  { value: 'meta.created_at', label: 'Created Date', category: 'Metadata' },
  { value: 'meta.updated_at', label: 'Updated Date', category: 'Metadata' },
  { value: 'meta.created_by', label: 'Created By', category: 'Metadata' },
  { value: 'meta.customer_id', label: 'Customer ID', category: 'Metadata' },

  // Form Data
  { value: 'data.', label: 'Form Data (custom)...', category: 'Form Data' },
];

const ListingFieldsEditor = ({ platform, fields, onChange, errors = {} }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAddField = () => {
    onChange([...fields, { label: '', key: '' }]);
  };

  const handleDeleteField = (index) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  const handleLabelChange = (index, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], label: value };
    onChange(newFields);
  };

  const handleKeyChange = (index, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], key: value };
    onChange(newFields);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newFields = [...fields];
    const draggedField = newFields[draggedIndex];

    // Remove from old position
    newFields.splice(draggedIndex, 1);

    // Insert at new position
    const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newFields.splice(actualDropIndex, 0, draggedField);

    onChange(newFields);
    setDraggedIndex(null);
  };

  return (
    <div className="listing-fields-editor">
      <div className="listing-fields-table">
        <div className="table-headers">
          <div className="header-drag"></div>
          <div className="header-number">#</div>
          <div className="header-label">LABEL</div>
          <div className="header-key">KEY PATH</div>
          <div className="header-actions"></div>
        </div>

        <div className="listing-fields-list">
        {fields.length === 0 ? (
          <div className="empty-state">
            <p>No fields configured for {platform} listing</p>
            <p className="empty-state-hint">Click "Add Field" to get started</p>
          </div>
        ) : (
          fields.map((field, index) => (
            <DraggableFieldRow
              key={index}
              index={index}
              field={field}
              onLabelChange={(value) => handleLabelChange(index, value)}
              onKeyChange={(value) => handleKeyChange(index, value)}
              onDelete={() => handleDeleteField(index)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              errors={errors[index] || {}}
              suggestions={COMMON_KEYS}
            />
          ))
        )}
        </div>
      </div>

      <Button
        appearance="ghost"
        onClick={handleAddField}
        className="add-field-btn"
        startIcon={<Plus size={16} />}
      >
        Add Field
      </Button>
    </div>
  );
};

export default ListingFieldsEditor;
