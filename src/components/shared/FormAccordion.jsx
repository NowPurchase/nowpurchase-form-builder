import { useState } from "react";
import "./FormAccordion.css";

function ChevronIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FormAccordion({
  header,
  defaultOpen = true,
  panelColor = "#F2F2F2",
  panelPadding,
  labelColor,
  labelSize,
  labelTracking,
  headerPadding,
  headerBackground,
  headerBorderBottom,
  rightSection,
  children,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const panelStyle = { backgroundColor: panelColor };
  if (panelPadding !== undefined) panelStyle.padding = panelPadding;

  const headerStyle = {};
  if (headerPadding !== undefined) headerStyle.padding = headerPadding;
  if (headerBackground !== undefined) headerStyle.background = headerBackground;
  if (headerBorderBottom !== undefined) headerStyle.borderBottom = headerBorderBottom;

  const labelStyle = {};
  if (labelColor !== undefined) labelStyle.color = labelColor;
  if (labelSize !== undefined) labelStyle.fontSize = labelSize;
  if (labelTracking !== undefined) labelStyle.letterSpacing = labelTracking;

  return (
    <div className="form-accordion">
      <button
        className="form-accordion__header"
        style={headerStyle}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronIcon
          className={`form-accordion__chevron${isOpen ? "" : " form-accordion__chevron--collapsed"}`}
        />
        <span className="form-accordion__label" style={labelStyle}>{header}</span>
        {rightSection && (
          <div className="form-accordion__right" onClick={(e) => e.stopPropagation()}>
            {rightSection}
          </div>
        )}
      </button>
      <div className={`form-accordion__body${isOpen ? "" : " form-accordion__body--collapsed"}`}>
        <div className="form-accordion__inner">
          <div className="form-accordion__content" style={panelStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
