'use strict';

// ---------------------------------------------------------------------------
// multiStep.js — a thin "steps" layer ON TOP of the single-form engine.
//
// A multi-step form, in this product, is simply N independent single forms,
// each its own FormEngine JSON, wrapped as:
//   { sections: [ { section_id, section_name, order, form_json }, ... ] }
// This matches exactly how the host detects/renders multi-step
// (see utils/dataTransform.js: `form_json?.sections ? "multi-step" : "single"`),
// so our output behaves identically in production.
//
// The pure engine (exportJSON / importJSON / applyTool) is unchanged — it still
// only knows single forms. A "step" = { id, name, state } where `state` is an
// ordinary builder state.
// ---------------------------------------------------------------------------

import { exportJSON } from './exportJSON.js';
import { importJSON } from './importJSON.js';

function slug(s, i) {
  const out = String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return out || `step_${i + 1}`;
}

// Is this form JSON a multi-step form (vs. a single FormEngine form)?
export function isMultiStep(formJson) {
  return !!(formJson && Array.isArray(formJson.sections));
}

// steps [{ id?, name, state }] → the host's multi-step shape { sections: [...] }
export function exportMultiStep(steps) {
  return {
    sections: (steps || []).map((st, i) => ({
      section_id: st.id || slug(st.name, i),
      section_name: st.name || `Step ${i + 1}`,
      order: i,
      form_json: exportJSON(st.state),
    })),
  };
}

// multi-step form JSON → steps [{ id, name, state }] (null if not multi-step)
export function importMultiStep(formJson) {
  if (!isMultiStep(formJson)) return null;
  return formJson.sections
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sec, i) => {
      const fj = typeof sec.form_json === 'string' ? JSON.parse(sec.form_json) : sec.form_json;
      return {
        id: sec.section_id || slug(sec.section_name, i),
        name: sec.section_name || `Step ${i + 1}`,
        state: importJSON(fj || {}),
      };
    });
}
