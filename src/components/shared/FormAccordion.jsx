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

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <g clipPath="url(#clip0_136_12399)">
        <path d="M13.1067 8.07174L11.9283 6.8934L4.16667 14.6551V15.8334H5.345L13.1067 8.07174ZM14.285 6.8934L15.4633 5.71507L14.285 4.53674L13.1067 5.71507L14.285 6.8934ZM6.035 17.5001H2.5V13.9642L13.6958 2.7684C13.8521 2.61218 14.064 2.52441 14.285 2.52441C14.506 2.52441 14.7179 2.61218 14.8742 2.7684L17.2317 5.1259C17.3879 5.28218 17.4757 5.4941 17.4757 5.71507C17.4757 5.93604 17.3879 6.14796 17.2317 6.30424L6.03583 17.5001H6.035Z" fill="#1579BE"/>
      </g>
      <defs>
        <clipPath id="clip0_136_12399">
          <rect width="20" height="20" fill="white"/>
        </clipPath>
      </defs>
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
  // Chem grid mode: when spectroData is provided, renders editable element cards instead of children
  spectroData,
  formRef,
  actualChemistry = {},
}) {
  const readings = spectroData?.spectro_reading_avg ?? [];
  const isChemMode = spectroData != null && readings.length > 0;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [committed, setCommitted] = useState({});
  const [prevSpectro, setPrevSpectro] = useState(spectroData);

  if (isChemMode && prevSpectro !== spectroData) {
    setPrevSpectro(spectroData);
    setCommitted({});
  }

  // spectroData was explicitly provided but has no readings — suppress render
  if (spectroData !== undefined && spectroData !== null && readings.length === 0) return null;

  const getValue = (symbol, recoveryRate) => {
    if (Object.prototype.hasOwnProperty.call(committed, symbol)) return committed[symbol];
    const propVal = actualChemistry[symbol];
    return propVal !== undefined && propVal !== null ? propVal : recoveryRate;
  };

  const startEditing = () => {
    const init = {};
    readings.forEach((r, i) => {
      const v = getValue(r.element_symbol, r.recovery_rate);
      init[i] = v !== undefined && v !== null ? String(v) : "";
    });
    setEditValues(init);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValues({});
  };

  const handleSave = () => {
    const newCommitted = {};
    readings.forEach((r, i) => {
      const v = editValues[i] !== undefined
        ? editValues[i]
        : String(getValue(r.element_symbol, r.recovery_rate) ?? "");
      newCommitted[r.element_symbol] = v;
    });

    if (formRef?.setInitialData) {
      const updated = Object.assign({}, actualChemistry, newCommitted);
      formRef.setInitialData("actual_chemistry", updated);
      Object.keys(newCommitted).forEach((sym) => {
        formRef.setInitialData("actual_chem_" + sym, newCommitted[sym]);
      });
    }

    setCommitted(newCommitted);
    setIsEditing(false);
    setEditValues({});
  };

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

  const chemRight = isChemMode
    ? isEditing
      ? (
        <div className="form-accordion__actions">
          <button className="form-accordion__cancel-btn" onClick={cancelEditing}>Cancel</button>
          <button className="form-accordion__save-btn" onClick={handleSave}>Save</button>
        </div>
      )
      : (
        <div
          className="form-accordion__edit-btn"
          role="button"
          tabIndex={0}
          aria-label="Edit actual chemistry"
          onClick={startEditing}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startEditing(); }}
        >
          <PencilIcon />
        </div>
      )
    : null;

  const activeRightSection = chemRight ?? rightSection;

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
        {activeRightSection && (
          <div className="form-accordion__right" onClick={(e) => e.stopPropagation()}>
            {activeRightSection}
          </div>
        )}
      </button>
      <div className={`form-accordion__body${isOpen ? "" : " form-accordion__body--collapsed"}`}>
        <div className="form-accordion__inner">
          <div className="form-accordion__content" style={panelStyle}>
            {isChemMode ? (
              <div className="form-accordion__grid-wrapper">
                <div className="form-accordion__grid">
                  {readings.map((r, i) => (
                    <div key={i} className="form-accordion__grid-card">
                      <span className="form-accordion__card-symbol">{r.element_symbol}</span>
                      {isEditing ? (
                        <input
                          className="form-accordion__card-input"
                          value={editValues[i] !== undefined ? editValues[i] : String(getValue(r.element_symbol, r.recovery_rate) ?? "")}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [i]: e.target.value }))}
                          aria-label={r.element_symbol}
                        />
                      ) : (
                        <span className="form-accordion__card-value">{getValue(r.element_symbol, r.recovery_rate)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
