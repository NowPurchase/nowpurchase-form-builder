import { useCallback, useEffect, useState } from "react";
import FormAccordion from "./FormAccordion";
import "./ActualChemItem.css";

const sanitizeNumeric = (raw) => {
  const stripped = raw.replace(/[^0-9.]/g, "");
  const firstDot = stripped.indexOf(".");
  if (firstDot === -1) return stripped;
  return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, "");
};

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
}) {
  const readings = spectroData?.spectro_reading_avg ?? [];

  const buildValues = useCallback(
    (rdgs) =>
      Object.fromEntries(
        rdgs.map((r) => {
          const stored = formRef?.data?.["actual_chem__" + r.element_symbol];
          const val = stored !== undefined && stored !== null ? stored : r.recovery_rate;
          return [r.element_symbol, val !== undefined && val !== null ? String(val) : ""];
        })
      ),
    [formRef]
  );

  const spectroId = spectroData?.["id"];
  const [values, setValues] = useState(() => buildValues(readings));

  useEffect(() => {
    setValues(buildValues(readings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectroId, readings.length]);

  if (spectroData !== undefined && spectroData !== null && readings.length === 0) return null;

  const handleChange = (symbol, raw) => {
    const value = sanitizeNumeric(raw);
    const updated = { ...values, [symbol]: value };
    setValues(updated);

    if (formRef?.setInitialData) {
      const numericValue = value === "" ? "" : Number(value);
      formRef.setInitialData("actual_chem__" + symbol, numericValue);
    }
  };

  return (
    <FormAccordion
      header={header}
      defaultOpen={defaultOpen}
      panelColor={panelColor}
      headerPadding={headerPadding}
      labelColor={labelColor ?? "#606060"}
      labelSize={labelSize ?? "14px"}
      labelTracking={labelTracking ?? "0.28px"}
      headerBorderBottom="none"
    >
      <div className="actual-chem__grid">
        {readings.map((r) => (
          <div key={r.element_symbol} className="actual-chem__card">
            <div className="actual-chem__card-label">{r.element_symbol}</div>
            <input
              className="actual-chem__card-input"
              value={values[r.element_symbol] ?? ""}
              onChange={(e) => handleChange(r.element_symbol, e.target.value)}
              aria-label={r.element_symbol}
              type="text"
              inputMode="decimal"
            />
          </div>
        ))}
      </div>
    </FormAccordion>
  );
}
