/**
 * Custom NpInput Component
 * Styled input component for NowPurchase forms
 */

import { define, string, boolean, event } from "@react-form-builder/core";
import { useState } from "react";
import "./npInput.css";

const NpInputComponent = ({
  label = "",
  placeholder = "",
  value = "",
  onChange,
  disabled = false,
  readOnly = false,
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div
      className={`np-input-container ${isFocused ? "focused" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}
    >
      <input
        type="text"
        className="np-input"
        placeholder={placeholder || label}
        value={value || ""}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        readOnly={readOnly}
      />
    </div>
  );
};

/**
 * NpInput component definition for FormEngine
 */
export const npInput = define(NpInputComponent, "NpInput")
  .name("NpInput")
  .category("input")
  .props({
    label: string.default(""),
    placeholder: string.default("Enter value..."),
    value: string.default(""),
    onChange: event,
    disabled: boolean.default(false),
    readOnly: boolean.default(false),
  });
