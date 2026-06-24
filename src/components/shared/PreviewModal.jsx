import { X, ExternalLink } from "lucide-react";
import PreviewForm from "./PreviewForm";
import { buildPreviewUrl } from "../../ui-builder/preview-url";
import "rsuite/dist/rsuite.min.css";

/**
 * PreviewModal — in-app live preview of a built form, rendered with the exact
 * same FormEngine registration as production (`formView.js`).
 *
 * Kept in host space (not in the ui-builder core) so the builder stays free of
 * any `@react-form-builder` dependency — it only hands up the exported form.
 *
 * Props: form (FormEngine JSON object|string) | null, onClose().
 */
export default function PreviewModal({ form, onClose }) {
  if (!form) return null;
  const json = typeof form === "string" ? form : JSON.stringify(form);

  return (
    <div style={OVERLAY} onClick={onClose}>
      {/* rsuite picker menus (dropdown/date/time/tag) portal to <body> with a low
          z-index (7) — without rsuite's own .rs-modal-open they'd open BEHIND this
          overlay (z-index 1000), so options look missing. Lift them above it while
          the preview popup is open. (The standalone /preview tab has no overlay,
          so it already works there.) */}
      <style>{`.rs-picker-popup{z-index:${PICKER_Z} !important;}`}</style>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <div style={HEAD}>
          <b style={{ fontFamily: "'Urbanist', sans-serif", fontSize: 15 }}>Live Preview</b>
          <div style={{ flex: 1 }} />
          <a
            style={LINK}
            href={buildPreviewUrl(window.location.origin, json)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in a new tab"
          >
            <ExternalLink size={14} /> Open in tab
          </a>
          <button style={CLOSE} onClick={onClose} aria-label="Close preview"><X size={18} /></button>
        </div>
        <div style={BODY}>
          <PreviewForm getForm={() => json} />
        </div>
      </div>
    </div>
  );
}

const OVERLAY_Z = 1000;
const PICKER_Z = OVERLAY_Z + 100; // rsuite picker menus must sit above the overlay
const OVERLAY = {
  position: "fixed", inset: 0, zIndex: OVERLAY_Z,
  background: "rgba(2,30,79,.35)", backdropFilter: "blur(2px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const MODAL = {
  width: "min(960px, 96vw)", height: "min(88vh, 900px)",
  background: "#fff", borderRadius: 16, overflow: "hidden",
  display: "flex", flexDirection: "column",
  boxShadow: "0 24px 70px rgba(2,30,79,.30)",
};
const HEAD = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "12px 16px", borderBottom: "1px solid #e3e7ea", flex: "none",
};
const BODY = { flex: 1, overflow: "auto", padding: "20px 22px", background: "#f7fafd" };
const LINK = {
  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
  fontFamily: "'Urbanist', sans-serif", fontWeight: 600, fontSize: 13,
  color: "#1579be", padding: "6px 10px", borderRadius: 7, border: "1px solid #dfe3e7",
};
const CLOSE = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid #dfe3e7",
  background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5b6470",
};
