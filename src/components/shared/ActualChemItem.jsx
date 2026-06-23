import { useState } from "react";
import FormAccordion from "./FormAccordion";
import "./ActualChemItem.css";

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <g clipPath="url(#clip0_aci_pencil)">
        <path d="M13.1067 8.07174L11.9283 6.8934L4.16667 14.6551V15.8334H5.345L13.1067 8.07174ZM14.285 6.8934L15.4633 5.71507L14.285 4.53674L13.1067 5.71507L14.285 6.8934ZM6.035 17.5001H2.5V13.9642L13.6958 2.7684C13.8521 2.61218 14.064 2.52441 14.285 2.52441C14.506 2.52441 14.7179 2.61218 14.8742 2.7684L17.2317 5.1259C17.3879 5.28218 17.4757 5.4941 17.4757 5.71507C17.4757 5.93604 17.3879 6.14796 17.2317 6.30424L6.03583 17.5001H6.035Z" fill="#1579BE"/>
      </g>
      <defs>
        <clipPath id="clip0_aci_pencil">
          <rect width="20" height="20" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

export default function ActualChemItem({
  header,
  defaultOpen = true,
  panelColor = "transparent",
  headerPadding,
  labelColor,
  labelSize,
  labelTracking,
  spectroData,
  formRef,
  actualChemistry = {},
}) {
  const readings = spectroData?.spectro_reading_avg ?? [];

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [committed, setCommitted] = useState({});
  const [prevSpectro, setPrevSpectro] = useState(spectroData);

  if (prevSpectro !== spectroData) {
    setPrevSpectro(spectroData);
    setCommitted({});
  }

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

  const rightSection = isEditing ? (
    <div className="actual-chem__actions">
      <button className="actual-chem__cancel-btn" onClick={cancelEditing}>Cancel</button>
      <button className="actual-chem__save-btn" onClick={handleSave}>Save</button>
    </div>
  ) : (
    <div
      className="actual-chem__edit-btn"
      role="button"
      tabIndex={0}
      aria-label="Edit actual chemistry"
      onClick={startEditing}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startEditing(); }}
    >
      <PencilIcon />
    </div>
  );

  return (
    <FormAccordion
      header={header}
      defaultOpen={defaultOpen}
      panelColor={panelColor}
      headerPadding={headerPadding}
      labelColor={labelColor ?? '#606060'}
      labelSize={labelSize ?? '14px'}
      labelTracking={labelTracking ?? '0.28px'}
      headerBorderBottom="none"
      rightSection={rightSection}
    >
      <div className="actual-chem__grid-wrapper">
        <div className="actual-chem__grid">
          {readings.map((r, i) => (
            <div key={i} className="actual-chem__grid-card">
              <span className="actual-chem__card-symbol">{r.element_symbol}</span>
              {isEditing ? (
                <input
                  className="actual-chem__card-input"
                  value={editValues[i] !== undefined ? editValues[i] : String(getValue(r.element_symbol, r.recovery_rate) ?? "")}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [i]: e.target.value }))}
                  aria-label={r.element_symbol}
                />
              ) : (
                <span className="actual-chem__card-value">{getValue(r.element_symbol, r.recovery_rate)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </FormAccordion>
  );
}
