import { useMemo, useState } from "react";
import PreviewForm from "../shared/PreviewForm";
import { decodeForm, payloadFromHash } from "../../ui-builder/preview-url";
import "rsuite/dist/rsuite.min.css";

/**
 * FormPreview — a clean, lightweight, context-free live preview.
 *
 * Ungated public route (`/preview`): no auth, no app shell, no backend. The
 * entire form travels compressed in the URL fragment (`/preview#f=...`), so the
 * same link works from the in-app Preview button and from a URL an AI hands the
 * user — on any machine, forever.
 *
 * Handles both shapes: a single FormEngine form, and a multi-step form
 * (`{ sections: [{ section_name, form_json }] }`) — rendered with a step
 * switcher, exactly like the production ViewForm.
 */
export default function FormPreview() {
  const { parsed, error } = useMemo(() => {
    try {
      const payload = payloadFromHash(window.location.hash);
      if (!payload) return { parsed: null, error: "No form data in this link." };
      return { parsed: JSON.parse(decodeForm(payload)), error: null };
    } catch (e) {
      return { parsed: null, error: e.message || "Could not read the preview link." };
    }
  }, []);

  const steps = Array.isArray(parsed?.sections) ? parsed.sections : null;
  const [active, setActive] = useState(0);

  if (error) {
    return (
      <div style={WRAP}>
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Preview unavailable</div>
          <div style={{ color: "#5b6470", fontSize: 14 }}>{error}</div>
          <div style={{ color: "#9aa3ad", fontSize: 12, marginTop: 10 }}>
            Open this page from the builder’s <b>Preview</b> button, or use a fresh preview link.
          </div>
        </div>
      </div>
    );
  }

  // multi-step: step sidebar + the selected step's form
  if (steps) {
    const sec = steps[active] || steps[0];
    const stepJson = typeof sec?.form_json === "string" ? sec.form_json : JSON.stringify(sec?.form_json ?? {});
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, maxWidth: 1100, padding: 0, display: "flex", overflow: "hidden" }}>
          <div style={SIDEBAR}>
            <div style={{ fontFamily: "'Urbanist',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: ".08em", color: "#8b95a0", padding: "4px 10px 10px" }}>STEPS</div>
            {steps.map((s, i) => (
              <button key={s.section_id || i} style={STEP(i === active)} onClick={() => setActive(i)}>
                <span style={STEPNUM(i === active)}>{i + 1}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.section_name || `Step ${i + 1}`}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: "20px 22px", overflow: "auto", background: "#f7fafd" }}>
            <PreviewForm viewerKey={active} formName={sec?.section_name} getForm={() => stepJson} />
          </div>
        </div>
      </div>
    );
  }

  // single form
  return (
    <div style={WRAP}>
      <div style={{ ...CARD, padding: "20px 22px" }}>
        <PreviewForm getForm={() => JSON.stringify(parsed)} />
      </div>
    </div>
  );
}

const WRAP = {
  minHeight: "100vh",
  background: "radial-gradient(circle at 85% 8%, rgba(21,121,190,.08), transparent 46%), #eef2f6",
  padding: "28px 16px",
  fontFamily: "'Oxanium', system-ui, sans-serif",
};
const CARD = {
  maxWidth: 920, margin: "0 auto", background: "#fff",
  border: "1px solid #dfe3e7", borderRadius: 16,
  boxShadow: "0 6px 28px rgba(2,30,79,.10)", padding: 24,
};
const SIDEBAR = { width: 220, flex: "none", borderRight: "1px solid #e3e7ea", padding: "16px 8px", overflow: "auto" };
const STEP = (on) => ({
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
  padding: "9px 10px", marginBottom: 4, borderRadius: 9, cursor: "pointer",
  border: "1px solid " + (on ? "#1579be" : "transparent"),
  background: on ? "#f0f6fb" : "transparent",
  font: "600 13px 'Urbanist',sans-serif", color: on ? "#0d4972" : "#2b333c",
});
const STEPNUM = (on) => ({
  width: 20, height: 20, flex: "none", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 700, background: on ? "#1579be" : "#e3e7ea", color: on ? "#fff" : "#5b6470",
});
