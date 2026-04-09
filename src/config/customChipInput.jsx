/* @refresh reset */
import {
  define,
  string,
  boolean,
  event,
  disabled,
  number,
  oneOf,
  readOnly as readOnlyProp,
  useComponentData,
} from "@react-form-builder/core";
import { useState, useRef, useCallback } from "react";
import "./customChipInput.css";

const ChipInputComponent = ({
  value,
  onChange,
  label,
  placeholder = "Type and press Enter or comma...",
  disabled: isDisabled,
  readOnly: isReadOnly,
  size = "md",
  allowDuplicates = false,
  maxChips = 0,
  style,
  className,
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);
  const isInteractive = !isDisabled && !isReadOnly;

  let isRequired = false;
  try {
    const componentData = useComponentData();
    isRequired = componentData?.validationRules?.required ?? false;
  } catch {
    // useComponentData may not be available outside the form builder context
  }

  const chips = parseChips(value);

  const commitChip = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!allowDuplicates && chips.includes(trimmed)) {
        setInputValue("");
        return;
      }
      if (maxChips > 0 && chips.length >= maxChips) {
        setInputValue("");
        return;
      }

      const updated = [...chips, trimmed];
      onChange?.(updated.join(","));
      setInputValue("");
    },
    [chips, onChange, allowDuplicates, maxChips]
  );

  const removeChip = useCallback(
    (index) => {
      if (!isInteractive) return;
      const updated = chips.filter((_, i) => i !== index);
      onChange?.(updated.join(","));
    },
    [chips, onChange, isInteractive]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commitChip(inputValue);
      }

      if (e.key === "Backspace" && inputValue === "" && chips.length > 0 && isInteractive) {
        removeChip(chips.length - 1);
      }
    },
    [inputValue, chips, commitChip, removeChip, isInteractive]
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      const items = pasted.split(",").map((s) => s.trim()).filter(Boolean);
      if (items.length === 0) return;

      const updated = [...chips, ...items];
      onChange?.(updated.join(","));
      setInputValue("");
    },
    [chips, onChange]
  );

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      if (val.includes(",")) {
        const parts = val.split(",");
        parts.forEach((part, i) => {
          if (i < parts.length - 1) {
            const trimmed = part.trim();
            if (trimmed) commitChip(trimmed);
          } else {
            setInputValue(part);
          }
        });
      } else {
        setInputValue(val);
      }
    },
    [commitChip]
  );

  const containerClasses = [
    "chip-input-container",
    `chip-input-${size}`,
    !isInteractive ? "chip-input-disabled" : "",
  ].filter(Boolean).join(" ");

  const labeledClasses = [
    "chip-input-labeled",
    className || "",
    isRequired ? "required" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={labeledClasses} style={style} role="group">
      {label && <label>{label}</label>}
      <div
        className={containerClasses}
        onClick={() => isInteractive && inputRef.current?.focus()}
      >
        <div className="chip-input-scroll">
          {chips.map((chip, index) => (
            <span key={`${chip}-${index}`} className="chip-input-chip">
              <span className="chip-input-chip-text">{chip}</span>
              {isInteractive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(index);
                  }}
                  className="chip-input-chip-remove"
                  aria-label={`Remove ${chip}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </span>
          ))}
          {isInteractive && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={chips.length === 0 ? placeholder : ""}
              disabled={isDisabled}
              readOnly={isReadOnly}
              className="chip-input-field"
            />
          )}
        </div>
      </div>
    </div>
  );
};

function parseChips(value) {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

const size = oneOf("xs", "sm", "md", "lg")
  .labeled("Extra small", "Small", "Medium", "Large")
  .default("md")
  .withEditorProps({ creatable: false });

const readOnly = readOnlyProp.hinted("Read only component").default(false);

const nonNegNumber = number.withEditorProps({ min: 0 });

export const rsChipInput = define(ChipInputComponent, "RsChipInput")
  .name("ChipInput")
  .category("fields")
  .props({
    label: string,
    placeholder: string.hinted("Input placeholder").default("Type and press Enter or comma..."),
    size,
    disabled: disabled.hinted("Disabled component").default(false),
    readOnly,
    allowDuplicates: boolean.hinted("Allow duplicate values").default(false),
    maxChips: nonNegNumber.hinted("Max number of chips (0 = unlimited)").default(0),
    value: string.valued.default(""),
    onChange: event,
  });
