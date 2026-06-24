'use strict';

// ---------------------------------------------------------------------------
// preview-url.js — shared encoder for the stateless live-preview page.
//
// The whole form (FormEngine JSON) is compressed into the URL **fragment**
// (`/preview#f=<payload>`). The fragment never reaches a server, so the link
// is self-contained, auth-free, and works forever on any machine — no backend.
//
// Isomorphic: the in-app Preview button (browser) and the MCP `preview_url`
// tool (Node) both import this, so they produce identical URLs.
// ---------------------------------------------------------------------------

import LZString from 'lz-string';

// form (object or JSON string) → URL-safe compressed payload
export function encodeForm(form) {
  const json = typeof form === 'string' ? form : JSON.stringify(form);
  return LZString.compressToEncodedURIComponent(json);
}

// payload → the FormEngine JSON string (throws if the payload is corrupt)
export function decodeForm(payload) {
  const json = LZString.decompressFromEncodedURIComponent(payload || '');
  if (!json) throw new Error('Could not decode the preview link — it may be truncated or invalid.');
  return json; // a JSON string, ready for FormViewer's getForm()
}

// pull the `f=` payload out of a location hash like "#f=XXXX" without
// touching `+` (URLSearchParams would turn it into a space and corrupt it).
export function payloadFromHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const i = h.indexOf('f=');
  return i >= 0 ? h.slice(i + 2) : '';
}

// base origin + form → full shareable preview URL
export function buildPreviewUrl(baseUrl, form) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return `${base}/preview#f=${encodeForm(form)}`;
}
