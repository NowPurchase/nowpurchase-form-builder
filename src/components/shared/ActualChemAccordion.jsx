import { useState } from "react";
import "./ActualChemAccordion.css";

function ChevronIcon({ isOpen }) {
  return (
    <svg
      className={`aca__chevron${isOpen ? "" : " aca__chevron--collapsed"}`}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1579BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function ActualChemAccordion({ spectroData, formRef, actualChemistry = {} }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  // Locally committed edits — source of truth for display after save
  const [committed, setCommitted] = useState({});
  // Detect heat change to reset committed values
  const [prevSpectro, setPrevSpectro] = useState(spectroData);
  if (prevSpectro !== spectroData) {
    setPrevSpectro(spectroData);
    setCommitted({});
  }

  const readings = spectroData?.spectro_reading_avg ?? [];
  const heatCode = spectroData?.name ?? "Actual Chemistry";

  if (!spectroData || readings.length === 0) return null;

  // Priority: locally committed > prop from form > spectro reading
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

    // formRef.data is a computed read-only snapshot; setInitialData is the correct
    // write path — it updates formViewerPropsStore.initialData (MobX observable) which
    // triggers onFormDataChange and re-renders the template preview.
    if (formRef?.setInitialData) {
      const updated = Object.assign({}, actualChemistry, newCommitted);
      formRef.setInitialData('actual_chemistry', updated);
      Object.keys(newCommitted).forEach(function(sym) {
        formRef.setInitialData('actual_chem_' + sym, newCommitted[sym]);
      });
    }

    setCommitted(newCommitted);
    setIsEditing(false);
    setEditValues({});
  };

  return (
    <div className="aca">
      <div className="aca__header-row">
        <button
          className="aca__toggle"
          onClick={() => setIsOpen((p) => !p)}
          aria-expanded={isOpen}
        >
          <ChevronIcon isOpen={isOpen} />
          <span className="aca__label">{heatCode}</span>
        </button>
        {isEditing ? (
          <div className="aca__actions">
            <button className="aca__cancel-btn" onClick={cancelEditing}>Cancel</button>
            <button className="aca__save-btn" onClick={handleSave}>Save</button>
          </div>
        ) : (
          <div
            className="aca__edit-btn"
            role="button"
            tabIndex={0}
            aria-label="Edit actual chemistry"
            onClick={startEditing}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startEditing(); }}
          >
            <PencilIcon />
          </div>
        )}
      </div>
      <div className={`aca__body${isOpen ? "" : " aca__body--collapsed"}`}>
        <div className="aca__inner">
          <div className="aca__content">
            <div className="aca__grid">
              {readings.map((r, i) => (
                <div key={i} className="aca__card">
                  <span className="aca__card-symbol">{r.element_symbol}</span>
                  {isEditing ? (
                    <input
                      className="aca__card-input"
                      value={editValues[i] !== undefined ? editValues[i] : String(getValue(r.element_symbol, r.recovery_rate) ?? "")}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [i]: e.target.value }))}
                      aria-label={r.element_symbol}
                    />
                  ) : (
                    <span className="aca__card-value">{getValue(r.element_symbol, r.recovery_rate)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
