import { useRef, useState } from "react";
import { FormViewer } from "@react-form-builder/core";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { viewWithCss } from "../../config/formView";
import { collectErrors } from "./collectErrors";

/**
 * PreviewForm — wraps a FormEngine `FormViewer` with a Submit button that runs
 * the form's real validators and shows the result inline.
 *
 * Previews are validation-silent on their own: nothing triggers the field
 * validators until something calls `formData.validate()`. We grab the viewer via
 * `viewerRef`, run `validate()` on submit, then read `hasErrors` / `errors` so
 * you can confirm exactly which rules fired (and on which fields) — the same
 * validation production would run.
 *
 * Props: getForm() => string (FormEngine JSON), formName?, viewerKey? (forces a
 * fresh viewer, e.g. when switching multi-step steps).
 */
const actions = { onSubmit: () => { /* validation is driven by the Submit button below */ } };

// Turn an error path into something a person can read:
//   "cm[0].material" -> "cm › row 1 › material"   (row index shown 1-based)
//   "address.city"   -> "address › city"
function humanizeField(field) {
  return field
    .replace(/\[(\d+)\]/g, (_, n) => ` › row ${Number(n) + 1}`)
    .replace(/\./g, " › ");
}

export default function PreviewForm({ getForm, formName, viewerKey }) {
  const viewerRef = useRef(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const formData = viewerRef.current?.formData;
    if (!formData) return;
    setSubmitting(true);
    try {
      // Order matters. getValidationResult() reports the COMPLETE merged map
      // (field + form-level validators such as table cross-row `unique`) WITHOUT
      // mutating state — read it FIRST so it's clean. validate() then mutates
      // field state to light up inline errors; running it first pollutes the
      // repeater (it stores the whole error object per row) and doubles the
      // result. validate() is best-effort — never let it abort reporting.
      const result = await formData.getValidationResult();
      const errors = collectErrors(result);
      try {
        await formData.validate();
      } catch (e) {
        console.warn("[PreviewForm] validate() threw; result already captured:", e);
      }
      setResult(
        errors.length
          ? { ok: false, errors, data: formData.data }
          : { ok: true, data: formData.data }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <FormViewer
        key={viewerKey}
        view={viewWithCss}
        viewerRef={viewerRef}
        formName={formName}
        getForm={getForm}
        actions={actions}
      />

      <div style={BAR}>
        <button style={BTN(submitting)} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Validating…" : "Submit"}
        </button>
        {result?.ok && (
          <span style={{ ...TAG, color: "#15803d", background: "#ecfdf3", borderColor: "#abefc6" }}>
            <CheckCircle2 size={15} /> All validations passed
          </span>
        )}
        {result && !result.ok && (
          <span style={{ ...TAG, color: "#b42318", background: "#fef3f2", borderColor: "#fecdca" }}>
            <AlertTriangle size={15} /> {result.errors.length} field{result.errors.length === 1 ? "" : "s"} failed validation
          </span>
        )}
      </div>

      {result && !result.ok && result.errors.length > 0 && (
        <ul style={ERRLIST}>
          {result.errors.map((e) => (
            <li key={e.field} style={ERRITEM}>
              <code style={ERRFIELD}>{humanizeField(e.field)}</code>
              <span style={{ color: "#b42318" }}>{e.message}</span>
            </li>
          ))}
        </ul>
      )}

      {result?.ok && (
        <pre style={DATA}>{JSON.stringify(result.data, null, 2)}</pre>
      )}
    </div>
  );
}

const BAR = {
  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
  marginTop: 18, paddingTop: 16, borderTop: "1px solid #e3e7ea",
};
const BTN = (busy) => ({
  font: "700 14px 'Urbanist',sans-serif", color: "#fff",
  background: busy ? "#6aa8d6" : "#1579be", border: "none",
  padding: "10px 22px", borderRadius: 9, cursor: busy ? "default" : "pointer",
});
const TAG = {
  display: "inline-flex", alignItems: "center", gap: 6,
  font: "600 13px 'Urbanist',sans-serif",
  padding: "5px 11px", borderRadius: 8, border: "1px solid",
};
const ERRLIST = { listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 6 };
const ERRITEM = {
  display: "flex", alignItems: "baseline", gap: 10,
  font: "13px 'Oxanium',system-ui,sans-serif",
  background: "#fff", border: "1px solid #fecdca", borderRadius: 8, padding: "8px 12px",
};
const ERRFIELD = {
  font: "600 12px ui-monospace,SFMono-Regular,Menlo,monospace",
  color: "#0d4972", background: "#f0f6fb", padding: "2px 6px", borderRadius: 5, flex: "none",
};
const DATA = {
  marginTop: 12, padding: "12px 14px", background: "#0d1117", color: "#c9d1d9",
  borderRadius: 9, fontSize: 12.5, lineHeight: 1.5, overflow: "auto", maxHeight: 280,
};
