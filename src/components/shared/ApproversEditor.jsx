import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, GripVertical, Trash2, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import UserDropdown from './UserDropdown';

const ACTION_OPTIONS = [
  { value: 'end', label: 'End (Finalize)' },
  { value: 'next_approver', label: 'Next Approver' }
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

    const newApprovers = [...approvers];
    const draggedApprover = newApprovers[draggedIndex];
    newApprovers.splice(draggedIndex, 1);
    const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newApprovers.splice(actualDropIndex, 0, draggedApprover);

    const recalculatedApprovers = newApprovers.map((approver, i) => ({
      ...approver,
      level: i
    }));

    onChange(recalculatedApprovers);
    setDraggedIndex(null);
  };

  const selectedUserIds = approvers.map(a => a.id).filter(Boolean);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (approvers.length === 0) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Plus className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No approvers configured</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Add approvers to enable the approval workflow for this template.</p>
          <button
            onClick={handleAddApprover}
            className="btn-primary mt-5"
          >
            <Plus className="h-4 w-4" /> Add Approver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Table Header */}
      <div className="grid grid-cols-[40px_60px_1.5fr_1fr_1fr_40px] items-center gap-3 border-b border-border bg-secondary/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div></div>
        <div>Level</div>
        <div>Approver</div>
        <div>On Approve</div>
        <div>On Reject</div>
        <div></div>
      </div>

      {/* Table Body */}
      {approvers.map((approver, index) => (
        <div
          key={index}
          className={`grid grid-cols-[40px_60px_1.5fr_1fr_1fr_40px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-secondary/40 transition-colors ${
            draggedIndex === index ? 'opacity-50 bg-accent' : ''
          }`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          {/* Drag Handle */}
          <div className="flex justify-center">
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/60 hover:text-muted-foreground" />
          </div>

          {/* Level Badge */}
          <div>
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
              L{index}
            </span>
          </div>

          {/* Approver Info */}
          <div className="flex items-center gap-3 min-w-0">
            {approver.id ? (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-glow">
                  {getInitials(approver.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{approver.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground truncate">Approver Level {index}</p>
                </div>
              </>
            ) : (
              <div className="flex-1">
                <UserDropdown
                  value={approver.id}
                  onChange={() => {}}
                  onSelect={(user) => handleUserSelect(index, user)}
                  placeholder="Select approver..."
                  excludeIds={selectedUserIds.filter(id => id !== approver.id)}
                  selectedUserData={null}
                  className="w-full"
                />
                {errors[index]?.id && (
                  <span className="text-xs text-destructive mt-1">{errors[index].id}</span>
                )}
              </div>
            )}
          </div>

          {/* On Approve Action */}
          <div>
            <ActionPill
              icon={CheckCircle2}
              tone="success"
              value={approver.on_approve}
              onChange={(value) => handleApproverChange(index, 'on_approve', value)}
            />
          </div>

          {/* On Reject Action */}
          <div>
            <ActionPill
              icon={XCircle}
              tone="destructive"
              value={approver.on_reject}
              onChange={(value) => handleApproverChange(index, 'on_reject', value)}
            />
          </div>

          {/* Delete Button */}
          <div className="flex justify-center">
            <button
              onClick={() => handleDeleteApprover(index)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer bg-transparent border-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Add Button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleAddApprover}
          className="btn-primary w-full"
        >
          <Plus className="h-4 w-4" /> Add Approver
        </button>
      </div>
    </div>
  );
};

// Action Pill Select Component
const ActionPill = ({ icon: Icon, tone, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = React.useRef(null);

  const selectedOption = ACTION_OPTIONS.find(opt => opt.value === value) || ACTION_OPTIONS[0];

  const handleTriggerClick = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 90;

      if (spaceBelow < dropdownHeight) {
        setMenuPosition({
          top: rect.top - dropdownHeight - 4,
          left: rect.left,
          width: Math.max(rect.width, 180)
        });
      } else {
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 180)
        });
      }
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const toneClasses = tone === 'success'
    ? 'border-success/30 bg-success/10 text-success hover:bg-success/15'
    : 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        className={`inline-flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${toneClasses}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selectedOption.label}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </button>

      {isOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-[99998]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-[99999] rounded-lg border border-border bg-card shadow-lg overflow-hidden"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width
            }}
          >
            {ACTION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleSelect(option)}
                className={`w-full px-3 py-2.5 text-left text-sm transition-colors cursor-pointer border-0 ${
                  option.value === value
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'bg-card text-foreground hover:bg-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ApproversEditor;
