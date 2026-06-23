import { useState, useMemo } from "react";
import FormAccordion from "./FormAccordion";
import "./MechPropsAccordion.css";

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1579BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function parse(val, fallback) {
  if (!val) return fallback;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function MechPropsAccordion({
  header = "Mechanical Properties",
  columns,
  minData,
  maxData,
  actualData,
  formRef,
}) {
  const parsedColumns = useMemo(() => parse(columns, []), [columns]);
  const parsedMin     = useMemo(() => parse(minData, {}), [minData]);
  const parsedMax     = useMemo(() => parse(maxData, {}), [maxData]);
  const parsedActual  = useMemo(() => parse(actualData, {}), [actualData]);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [committed, setCommitted] = useState({});

  // Reset committed values when actualData changes (e.g. new heat selected)
  const [prevActualData, setPrevActualData] = useState(actualData);
  if (prevActualData !== actualData) {
    setPrevActualData(actualData);
    setCommitted({});
  }

  // Flatten leaf columns (expand subColumns)
  const leafColumns = useMemo(() => {
    const leaves = [];
    for (const col of parsedColumns) {
      if (col.subColumns?.length) {
        col.subColumns.forEach(sub => leaves.push(sub));
      } else {
        leaves.push(col);
      }
    }
    return leaves;
  }, [parsedColumns]);

  const hasGroups = parsedColumns.some(c => c.subColumns?.length > 0);

  const getActualValue = (key) => {
    if (Object.prototype.hasOwnProperty.call(committed, key)) return committed[key];
    const v = parsedActual[key];
    return v !== undefined && v !== null ? v : "";
  };

  const startEditing = () => {
    const init = {};
    leafColumns.forEach(col => {
      const v = getActualValue(col.key);
      init[col.key] = v !== undefined && v !== null ? String(v) : "";
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
    leafColumns.forEach(col => {
      newCommitted[col.key] = editValues[col.key] !== undefined
        ? editValues[col.key]
        : String(getActualValue(col.key) ?? "");
    });

    if (formRef?.setInitialData) {
      Object.keys(newCommitted).forEach(key => {
        formRef.setInitialData(key, newCommitted[key]);
      });
    }

    setCommitted(newCommitted);
    setIsEditing(false);
    setEditValues({});
  };

  const displayVal = (v) =>
    v !== undefined && v !== null && v !== "" ? v : "-";

  return (
    <FormAccordion header={header}>
      <div className="mpa">
        <div className="mpa__toolbar">
          {isEditing ? (
            <div className="mpa__actions">
              <button className="mpa__cancel-btn" onClick={cancelEditing}>Cancel</button>
              <button className="mpa__save-btn" onClick={handleSave}>Save</button>
            </div>
          ) : (
            <div
              className="mpa__edit-btn"
              role="button"
              tabIndex={0}
              aria-label="Edit actual values"
              onClick={startEditing}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") startEditing(); }}
            >
              <PencilIcon />
            </div>
          )}
        </div>

        <div className="mpa__scroll">
          <table className="mpa__table">
            <thead>
              <tr className="mpa__tr--head">
                <th className="mpa__th mpa__th--req" rowSpan={hasGroups ? 2 : 1}>Req</th>
                {parsedColumns.map((col, i) =>
                  col.subColumns?.length ? (
                    <th key={i} colSpan={col.subColumns.length} className="mpa__th mpa__th--group">
                      <div className="mpa__th-inner">
                        <span className="mpa__th-label">{col.label}</span>
                        {col.unit && <span className="mpa__th-unit">{col.unit}</span>}
                      </div>
                    </th>
                  ) : (
                    <th key={i} rowSpan={hasGroups ? 2 : 1} className="mpa__th">
                      <div className="mpa__th-inner">
                        <span className="mpa__th-label">{col.label}</span>
                        {col.unit && <span className="mpa__th-unit">{col.unit}</span>}
                      </div>
                    </th>
                  )
                )}
              </tr>
              {hasGroups && (
                <tr className="mpa__tr--subhead">
                  {parsedColumns.flatMap((col, i) =>
                    col.subColumns?.length
                      ? col.subColumns.map((sub, j) => (
                          <th key={`${i}-${j}`} className="mpa__th mpa__th--sub">
                            <div className="mpa__th-inner">
                              <span className="mpa__th-label">{sub.label}</span>
                              {sub.unit && <span className="mpa__th-unit">{sub.unit}</span>}
                            </div>
                          </th>
                        ))
                      : []
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {/* Min row */}
              <tr className="mpa__tr--spec">
                <td className="mpa__td mpa__td--label">Min</td>
                {leafColumns.map((col, i) => (
                  <td key={i} className="mpa__td">{displayVal(parsedMin[col.key])}</td>
                ))}
              </tr>
              {/* Max row */}
              <tr className="mpa__tr--spec">
                <td className="mpa__td mpa__td--label">Max</td>
                {leafColumns.map((col, i) => (
                  <td key={i} className="mpa__td">{displayVal(parsedMax[col.key])}</td>
                ))}
              </tr>
              {/* Actual row */}
              <tr className="mpa__tr--actual">
                <td className="mpa__td mpa__td--label">Actual</td>
                {leafColumns.map((col, i) => {
                  const val = getActualValue(col.key);
                  return (
                    <td key={i} className="mpa__td">
                      {isEditing ? (
                        <input
                          className="mpa__input"
                          value={editValues[col.key] !== undefined ? editValues[col.key] : String(val ?? "")}
                          onChange={e => setEditValues(prev => ({ ...prev, [col.key]: e.target.value }))}
                          aria-label={col.label}
                        />
                      ) : (
                        displayVal(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </FormAccordion>
  );
}
