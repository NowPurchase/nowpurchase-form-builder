import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../shared/AppShell";
import PreviewModal from "../shared/PreviewModal";
import { toast } from "../shared/Toast";
import { getUserFromToken } from "../../services/api";
import { createDynamicLog, getDynamicLog } from "../../services/adminTemplateApi";
import Builder from "../../ui-builder/components/Builder.jsx";
import { importJSON } from "../../ui-builder/engine/importJSON.js";
import "../../ui-builder/styles.css";

/**
 * UI-Builder Simplified — the curated, convention-enforcing form builder for
 * non-technical users. Additive page: reuses AppShell (left nav) and the
 * existing adminTemplateApi; it does not touch any core files.
 *
 * Builds a form with auto-derived dataKeys + curated CSS, then saves the
 * FormEngine JSON straight into `form_json` via createDynamicLog.
 */
export default function UiBuilderSimplified() {
  const [params] = useSearchParams();
  const user = getUserFromToken();
  const customerId = params.get("customer_id") || user?.customer_id || null;
  const customerName = user?.customer_name || "";
  const editId = params.get("edit");

  const [initialForm, setInitialForm] = useState(null);
  const [ready, setReady] = useState(!editId); // no edit → ready immediately
  const [previewForm, setPreviewForm] = useState(null); // in-app preview modal

  // Best-effort load of an existing template into the builder when ?edit=<id>.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    (async () => {
      try {
        const tpl = await getDynamicLog(editId, customerId);
        const raw = tpl?.form_json;
        const json = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (alive && json) setInitialForm(importJSON(json));
      } catch (e) {
        toast.error("Could not load this template into the simplified builder.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [editId, customerId]);

  async function handleSave(exported, meta) {
    if (!customerId) {
      toast.error("No customer in context — open this from a customer or pass ?customer_id=.");
      return;
    }
    const template_name = (meta.name || "").trim();
    if (!template_name) {
      toast.error("Give the form a name (top bar) before saving.");
      return;
    }
    try {
      const res = await createDynamicLog({
        customer_id: customerId,
        customer_name: customerName,
        template_name,
        status: "completed",
        config: {},
        form_json: JSON.stringify(exported),
        description: "",
      });
      toast.success(`Saved "${template_name}" as a template.`);
      return res;
    } catch (e) {
      toast.error("Save failed. Check the console for details.");
      console.error("UiBuilderSimplified save error:", e);
    }
  }

  return (
    <AppShell title="UI-Builder Simplified">
      <div className="npui-builder" style={{ height: "100%" }}>
        {/* Save-to-template intentionally disabled for now (no onSaveTemplate). */}
        {ready && <Builder initialForm={initialForm} onPreview={setPreviewForm} />}
      </div>
      <PreviewModal form={previewForm} onClose={() => setPreviewForm(null)} />
    </AppShell>
  );
}
