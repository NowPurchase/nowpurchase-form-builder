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
import styled from "@emotion/styled";
import { useState, useRef, useCallback } from "react";

const sizeMap = {
  xs: { minHeight: "24px", fontSize: "12px", lineHeight: "1.66666667", chipPadding: "0px 6px", chipFont: "11px", gap: "4px", containerPadding: "1px 11px" },
  sm: { minHeight: "30px", fontSize: "14px", lineHeight: "1.42857143", chipPadding: "1px 7px", chipFont: "12px", gap: "4px", containerPadding: "4px 11px" },
  md: { minHeight: "36px", fontSize: "14px", lineHeight: "1.42857143", chipPadding: "2px 8px", chipFont: "13px", gap: "4px", containerPadding: "7px 11px" },
  lg: { minHeight: "42px", fontSize: "16px", lineHeight: "1.375",      chipPadding: "3px 10px", chipFont: "14px", gap: "5px", containerPadding: "9px 11px" },
};

const LabeledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;

  label {
    margin-inline-start: 5px;
    margin-bottom: 2px;
    text-align: left;
  }

  &.required > label::after {
    margin-inline-start: 3px;
    content: "*";
    color: #f44336;
  }
`;

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
  const sizeTokens = sizeMap[size] || sizeMap.md;
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

  return (
    <LabeledContainer
      className={`${className || ""} ${isRequired ? "required" : ""}`.trim()}
      style={style}
      role="group"
    >
      {label && <label>{label}</label>}
      <div
        style={{
          ...containerStyle,
          padding: sizeTokens.containerPadding,
          minHeight: sizeTokens.minHeight,
          gap: sizeTokens.gap,
          ...(!isInteractive ? disabledContainerStyle : {}),
        }}
        onClick={() => isInteractive && inputRef.current?.focus()}
      >
        {chips.map((chip, index) => (
          <span
            key={`${chip}-${index}`}
            style={{ ...chipStyle, padding: sizeTokens.chipPadding, fontSize: sizeTokens.chipFont }}
          >
            <span style={chipTextStyle}>{chip}</span>
            {isInteractive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(index);
                }}
                style={chipRemoveStyle}
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
            style={{ ...inputStyle, fontSize: sizeTokens.fontSize, lineHeight: sizeTokens.lineHeight }}
          />
        )}
      </div>
    </LabeledContainer>
  );
};

function parseChips(value) {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

const containerStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "4px",
  padding: "7px 11px",
  border: "1px solid #e5e5ea",
  borderRadius: "6px",
  backgroundColor: "#fff",
  minHeight: "36px",
  cursor: "text",
  transition: "border-color ease-in-out 0.15s",
  width: "100%",
  boxSizing: "border-box",
};

const disabledContainerStyle = {
  backgroundColor: "#f7f7fa",
  cursor: "not-allowed",
  opacity: 0.7,
};

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "2px 8px",
  backgroundColor: "#e8f4fd",
  border: "1px solid #b3d9f2",
  borderRadius: "4px",
  fontSize: "13px",
  lineHeight: "22px",
  color: "#1a3c5e",
  maxWidth: "200px",
  whiteSpace: "nowrap",
};

const chipTextStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipRemoveStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0",
  marginLeft: "2px",
  color: "#6b7c8d",
  borderRadius: "2px",
  lineHeight: 1,
  flexShrink: 0,
};

const inputStyle = {
  flex: 1,
  minWidth: "80px",
  border: "none",
  outline: "none",
  fontSize: "14px",
  padding: "0",
  backgroundColor: "transparent",
  color: "#343434",
  lineHeight: "1.42857143",
};

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
