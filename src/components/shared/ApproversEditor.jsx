import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, GripVertical, X, ChevronDown } from 'lucide-react';
import { Button } from 'rsuite';
import UserDropdown from './UserDropdown';
import './ApproversEditor.css';

const ACTION_OPTIONS = [
  { value: 'end', label: 'End (Finalize)' },
  { value: 'next_approver', label: 'Next Approver (Escalate)' }
];

const ApproversEditor = ({ approvers, onChange, errors = {} }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAddApprover = () => {
    const newApprover = {
      id: '',
      name: '',
      level: approvers.length,
      on_approve: 'end',
      on_reject: 'end'
    };
    onChange([...approvers, newApprover]);
  };

  const handleDeleteApprover = (index) => {
    const newApprovers = approvers.filter((_, i) => i !== index);
    // Recalculate levels after deletion
    const recalculatedApprovers = newApprovers.map((approver, i) => ({
      ...approver,
      level: i
    }));
    onChange(recalculatedApprovers);
  };

  const handleApproverChange = (index, field, value) => {
    const newApprovers = [...approvers];
    newApprovers[index] = { ...newApprovers[index], [field]: value };
    onChange(newApprovers);
  };

  const handleUserSelect = (index, user) => {
    const newApprovers = [...approvers];
    newApprovers[index] = {
      ...newApprovers[index],
      id: String(user.id),
      name: user.name || 'Unnamed User'
    };
    onChange(newApprovers);
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

    const newApprovers = [...approvers];
    const draggedApprover = newApprovers[draggedIndex];

    // Remove from old position
    newApprovers.splice(draggedIndex, 1);

    // Insert at new position
    const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newApprovers.splice(actualDropIndex, 0, draggedApprover);

    // Recalculate levels based on new order
    const recalculatedApprovers = newApprovers.map((approver, i) => ({
      ...approver,
      level: i
    }));

    onChange(recalculatedApprovers);
    setDraggedIndex(null);
  };

  // Get selected user IDs to exclude from other dropdowns
  const selectedUserIds = approvers.map(a => a.id).filter(Boolean);

  return (
    <div className="approvers-editor">
      <div className="approvers-info-banner">
        <div className="info-icon">i</div>
        <div className="info-content">
          <strong>How approval workflow works:</strong>
          <ul>
            <li><strong>End (Finalize)</strong> — Completes approval (approve) or blocks logsheet (reject)</li>
            <li><strong>Next Approver</strong> — Escalates to the next level approver</li>
            <li>Drag to reorder approvers and change their levels</li>
          </ul>
        </div>
      </div>

      {approvers.length === 0 ? (
        <div className="approvers-empty-state">
          <p>No approvers configured</p>
          <p className="empty-state-hint">Add approvers to enable the approval workflow for this template</p>
        </div>
      ) : (
        <div className="approvers-table">
          <div className="approvers-table-header">
            <div className="header-drag"></div>
            <div className="header-level">Level</div>
            <div className="header-user">Approver</div>
            <div className="header-action">On Approve</div>
            <div className="header-action">On Reject</div>
            <div className="header-actions"></div>
          </div>

          <div className="approvers-list">
            {approvers.map((approver, index) => (
              <div
                key={index}
                className={`approver-row ${draggedIndex === index ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="approver-drag-handle">
                  <GripVertical size={16} />
                </div>

                <div className="approver-level">
                  <span className="level-badge">
                    {index}
                  </span>
                </div>

                <div className="approver-user">
                  <UserDropdown
                    value={approver.id}
                    onChange={(userId) => {}}
                    onSelect={(user) => handleUserSelect(index, user)}
                    placeholder="Select approver..."
                    excludeIds={selectedUserIds.filter(id => id !== approver.id)}
                    selectedUserData={approver.id ? { id: approver.id, name: approver.name } : null}
                  />
                  {errors[index]?.id && <span className="error-text">{errors[index].id}</span>}
                </div>

                <div className="approver-action">
                  <ActionSelect
                    value={approver.on_approve}
                    onChange={(value) => handleApproverChange(index, 'on_approve', value)}
                  />
                </div>

                <div className="approver-action">
                  <ActionSelect
                    value={approver.on_reject}
                    onChange={(value) => handleApproverChange(index, 'on_reject', value)}
                  />
                </div>
                <div className="approver-actions">
                  <button
                    type="button"
                    className="approver-delete-btn"
                    onClick={() => handleDeleteApprover(index)}
                    title="Remove approver"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        appearance="ghost"
        onClick={handleAddApprover}
        className="add-approver-btn"
        startIcon={<Plus size={16} />}
      >
        Add Approver
      </Button>
    </div>
  );
};

// Custom select component for action dropdowns
const ActionSelect = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = React.useRef(null);
  const selectedOption = ACTION_OPTIONS.find(opt => opt.value === value) || ACTION_OPTIONS[0];

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleTriggerClick = () => {
    if (disabled) return;

    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 90; // Approximate height of dropdown

      // Position above if not enough space below
      if (spaceBelow < dropdownHeight) {
        setMenuPosition({
          top: rect.top - dropdownHeight - 4,
          left: rect.left,
          width: rect.width
        });
      } else {
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`action-select ${disabled ? 'disabled' : ''}`}>
      <div
        ref={triggerRef}
        className="action-select-trigger"
        onClick={handleTriggerClick}
      >
        <span className="action-select-value">{selectedOption.label}</span>
        {!disabled && <ChevronDown size={14} />}
      </div>

      {isOpen && !disabled && createPortal(
        <>
          <div className="action-select-backdrop" onClick={() => setIsOpen(false)} />
          <div
            className="action-select-dropdown"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width
            }}
          >
            {ACTION_OPTIONS.map(option => (
              <div
                key={option.value}
                className={`action-select-option ${option.value === value ? 'selected' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ApproversEditor;
