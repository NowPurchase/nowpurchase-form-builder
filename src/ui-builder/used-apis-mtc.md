# MTC Module — API Documentation

**Module:** MTC (Material Test Certificate)
**Last updated:** 2026-06-24

This document lists every API called by the MTC module, why it is called, its purpose, and what it does. The MTC module is a **multi-tenant** system: a common core handles generic certificates, while customer-specific modules (NIF Ispat, Nipha, TRSL, Crescent, Vishwakarma, Govind, MalMetalliks, etc.) layer their own approval and template logic on top.

---

## 1. Overview

The MTC module lets quality teams **create, edit, approve, and publish Material Test Certificates** for casting products. A certificate aggregates:

- Client / order information
- Part number & material specification (target chemistry, hardness, tensile, micro requirements)
- Heat / spectro analysis readings
- Test results (tensile, impact, hardness, load, micro analysis)
- Signatures and a generated PDF

There are two API generations running side by side:

| Generation | Base path | Used by |
|-----------|-----------|---------|
| **V1** | `/api/castingquality/mtc/...` | Original/standard certificate flow |
| **V2** | `/api/castingquality/mtc/v2/...` | MalMetalliks + all newer customer modules |

**API source files**

| File | Responsibility |
|------|----------------|
| `src/api/CertificateApi.js` | Core V1 certificate CRUD, dropdowns, spectro, history, signatures |
| `src/api/MalMetalliksMTCApi.js` | V2 certificate CRUD, specs, heat-linked test data, NIF approval |
| `src/api/niphaApi.js` | Nipha customer create + grade dropdown |
| `src/modules/mtc/customers/TRSL/trsl.api.js` | TRSL approval + certificate count |
| `src/api/CosApi.js` | COS (schema-driven certificate-of-standards) table |

---

## 2. Core Certificate Lifecycle APIs

These drive the main create → edit → approve flow. Source: `src/api/CertificateApi.js` unless noted.

| Purpose | Method & Endpoint | Function | Called from | Reason / What it does |
|---------|-------------------|----------|-------------|------------------------|
| **List certificates** | `GET /api/castingquality/mtc/test_certificate/` | `getTestCertificateListingData` | `pages/MTC/MTCList.jsx`, `pages/Certificate/CertificateDetails.jsx` | Loads the paginated certificate listing table. Accepts search, page, page_size, and status filters so users can browse and find certificates. |
| **Get certificate detail** | `GET /api/castingquality/mtc/test_certificate/{id}/` | `getCertificateDetails` | `modules/mtc/MTCCreate.jsx`, `pages/MTC/MTCDetail.jsx`, `pages/MalMetalliksMTC/MalMetalliksMTCCreate.jsx` | Fetches a full certificate (part numbers, client order, heat, micro, tensile, hardness) to populate the detail/edit screen. |
| **Create certificate** | `POST /api/castingquality/mtc/test_certificate/` | `saveMtcCertificate` | `pages/Certificate/CertificateCreate.jsx` | Persists a new V1 certificate from the create form. |
| **Update certificate** | `PATCH /api/castingquality/mtc/test_certificate/{id}/` | `updateMtcCertificate` | `pages/Certificate/CertificateCreate.jsx`, `pages/MalMetalliksMTC/MalMetalliksMTCCreate.jsx` | Saves edits to an existing V1 certificate. |
| **Generate report number** | `GET /api/castingquality/mtc/gen_report_no/` | `getReportNumber` | `pages/MTC/CreateMTC.jsx` (form init) | Returns the next sequential report number so each new certificate gets a unique, ordered ID. |

### V2 / MalMetalliks lifecycle (`src/api/MalMetalliksMTCApi.js`)

| Purpose | Method & Endpoint | Function | Reason / What it does |
|---------|-------------------|----------|------------------------|
| **List (V2)** | `GET /api/castingquality/mtc/v2/test_certificate/` | `getMalMetalliksMTCListingData` | Paginated listing for V2/MalMetalliks customers. |
| **Detail (V2)** | `GET /api/castingquality/mtc/v2/test_certificate/{id}/` | `getMalMetalliksMTCDetails` | Returns the V2 certificate with `dynamic_data`, `client`, `mtc_heat`, `mtc_micro` for the view/edit screen. |
| **Create (V2)** | `POST /api/castingquality/mtc/v2/test_certificate/` | `saveMalMetalliksMTC` | Creates a V2 certificate. Shared by MalMetalliks, NIF, Nipha and other modern customer configs. |
| **Update (V2)** | `PATCH /api/castingquality/mtc/v2/test_certificate/{id}/` | `updateMalMetalliksMTC` | Saves edits to a V2 certificate. |
| **Material specification** | `GET /api/castingquality/mtc/v2/mtc_specified/{id}/` | `getMalMetalliksSpecifiedDetails` | Loads the spec for a part (target chemistry, hardness, tensile, micro requirements) so test results can be validated against requirements. |

---

## 3. Approval APIs

Approval finalizes a certificate, attaches the generated PDF, and records signatures. Each customer has its own approval endpoint variant because their PDF templates and signature requirements differ. All approval calls use `?approve=true` and send a `multipart/form-data` payload (PDF + signature metadata).

| Customer / flow | Method & Endpoint | Function | Source | Signatures captured |
|-----------------|-------------------|----------|--------|---------------------|
| **Standard** | `PATCH .../mtc/v2/test_certificate/{id}/?approve=true` | `approveCertificate` | CertificateApi.js | PDF only |
| **Crescent** | `PATCH .../mtc/v2/test_certificate/{id}/?approve=true` | `approveCrescentCertificate` | CertificateApi.js | PDF + `prepared_by_image_url` |
| **Vishwakarma** (client 429) | `PATCH .../mtc/test_certificate/{id}/?approve=true` | `approveVishwakarmaCertificate` | CertificateApi.js | PDF only (V1 template) |
| **NIF Ispat** | `PATCH .../mtc/v2/test_certificate/{id}/?approve=true` | `approveNifCertificate` | MalMetalliksMTCApi.js | PDF + incharge + manager signature URLs |
| **TRSL** | `PATCH .../mtc/v2/test_certificate/{id}/?approve=true` | `approveTrslCertificate` | TRSL/trsl.api.js | PDF + Prepared By + Checked By + Approved By |

All of the above are invoked from `src/componentsV2/MTCFooter/index.jsx`, which selects the correct approval function based on the certificate's customer.

**Why separate functions for one endpoint?** The URL is largely the same, but each customer requires a different `dynamic_data` payload (which signatures, in what roles) and a different PDF template. Keeping them as distinct functions makes the per-customer contract explicit.

---

## 4. Dropdown / Lookup APIs

These populate form fields during certificate creation. Most accept a `params` object (search term, pagination); several support an `AbortController` `signal` so stale requests are cancelled while the user types.

| Field | Method & Endpoint | Function | Source | Purpose |
|-------|-------------------|----------|--------|---------|
| Customer / client | `GET .../mtc/client_dropdown/` | `getCustomerNameList` | CertificateApi.js | Pick the client the certificate is for. |
| Part name | `GET .../mtc/part_name_dropdown/` | `getPartNameList` | CertificateApi.js | Select the part name. |
| Part number | `GET .../mtc/part_no_dropdown/` | `getPartNumberList` | CertificateApi.js | Select the part number. |
| Part number (V2) | `GET .../mtc/v2/mtc_specified_dropdown/` | `getMalPartNumberList` | CertificateApi.js | V2 part/spec selection for MalMetalliks. |
| MTC spec by part | `GET .../mtc/v2/mtc_specified_dropdown/?cast_part_no={id}` | `getMtcSpecifiedDropdown` | MalMetalliksMTCApi.js | Lists specs valid for the chosen part. |
| Grade (V2) | `GET .../mtc/v2/grade_dropdown/` | `getGradesList` | niphaApi.js | Material grade options (Nipha). |
| Tensile | `GET .../mtc/tensile_dropdown/` | `getTensileList` | CertificateApi.js | Choose tensile test records (cancellable). |
| Impact | `GET .../mtc/impact_dropdown/` | `getImpactList` | CertificateApi.js | Choose impact test records. |
| Load | `GET .../mtc/load_test_dropdown/` | `getLoadTestList` | CertificateApi.js | Choose load test records. |
| Hardness | `GET .../mtc/hardness_dropdown/` | `getHardnessList` | CertificateApi.js | Choose hardness test records (cancellable). |
| Micro analysis | `GET .../mtc/micro_dropdown/` | `getMicroAnalysisList` | CertificateApi.js | Choose microstructure analysis records (cancellable). |

### Heat-code-scoped test lookups (`MalMetalliksMTCApi.js`)

When a heat code is selected, these pull the test data tied to that specific heat so results auto-fill:

| Method & Endpoint | Function | Purpose |
|-------------------|----------|---------|
| `GET .../mtc/tensile_dropdown/?heat_code={code}` | `getTensileByHeatCode` | Tensile data for the heat. |
| `GET .../mtc/impact_dropdown/?heat_code={code}` | `getImpactByHeatCode` | Impact data for the heat. |
| `GET .../mtc/hardness_dropdown/?heat_code={code}` | `getHardnessByHeatCode` | Hardness data for the heat. |

---

## 5. Spectro / Heat Analysis APIs

Source: `src/api/CertificateApi.js`. These bring spectrometer/heat chemistry into the certificate.

| Purpose | Method & Endpoint | Function | What it does |
|---------|-------------------|----------|--------------|
| List heats | `GET .../mtc/heats/` | `getSpectroHeatList` | Searchable heat list for selection (cancellable). |
| Heat detail | `GET .../mtc/heats/{id}/` | `getSpectroHeatData` | Full chemistry/details for a chosen heat. |
| Final readings | `GET .../mtc/final_reading/{id}/` | `getSpectroFinalReadings` | Final spectro reading values for display on the certificate. |
| Govind micro | `GET .../mtc/govind_micro/{id}/` | `fetchHeatMicroDetails` | Govind-Steel-specific microstructure details. |

**External integration — DLMS**

| Method & Endpoint | Function | What it does |
|-------------------|----------|--------------|
| `POST https://dlms-api-stage.iotnp.com/api/v1/templates/heat-details/dropdown/v2` | `getHeatDetailsFromDLMS` | NIF flow only. Queries the external **DLMS** system for heat details by name. Note: points at a **stage** host — verify before production use. |

---

## 6. Supporting APIs (history, images, client info)

| Purpose | Method & Endpoint | Function | Source | What it does |
|---------|-------------------|----------|--------|--------------|
| Client/order detail | `GET .../mtc/client_order/{id}/` | `getClientDetails` | CertificateApi.js | Client + order material specs for the certificate header. |
| Edit history (V1) | `GET .../mtc/history/{id}/` | `retrieveEditHistory` | CertificateApi.js | Audit trail of edits. |
| Edit history (V2) | `GET .../mtc/v2/history/{id}/` | `retrieveMalEditHistory` | CertificateApi.js | Audit trail for V2 certificates. |
| Extract micro images | `GET .../mtc/extract_images/{id}/` | `extractMicroImages` | CertificateApi.js | Pulls microstructure images attached to a certificate (used in MalMetalliks create). |
| TRSL count | `GET .../mtc/v2/test_certificate/?client_id={id}` | `getTrslTCCount` | TRSL/trsl.api.js | Total certificate count for a TRSL client (status display). |

---

## 7. Signature & Image Upload APIs

| Purpose | Method & Endpoint | Function | What it does |
|---------|-------------------|----------|--------------|
| Upload user signature | `PATCH /api/r/user_signature/{id}/` | `uploadSignature` | Stores a user's signature image for reuse in approvals. |
| Get user signature | `GET /api/r/user_signature/{id}/` | `getUserSignature` | Retrieves a stored signature to show on the certificate. |
| Upload image (generic) | `POST /upload-image/` | (inline) | Uploads a signature/image, returns a CDN URL. Called from `MTCFooter`, `NifMTCDetail.jsx`, `TRSL/TrslMTCDetail.jsx` **before** approval so the resulting URL can be passed into the approval payload. |

---

## 8. COS MTC APIs

COS (schema-driven Certificate of Standards) table. Source: `src/api/CosApi.js`, UI at `src/pages/CosMTC/`.

| Purpose | Method & Endpoint | Function | What it does |
|---------|-------------------|----------|--------------|
| Schema | `GET /api/cos/schema/` | `getCosSchema` | Returns the dynamic column/field config so the table renders without hardcoding columns. |
| List | `GET /api/cos/` | `getCosList` | Paginated COS records (infinite scroll) with search/status filters. |
| Detail | `GET /api/cos/{id}/` | `getCosDetail` | Full COS record (incl. `target_chemistry`) for the detail drawer. |
| Create rows | `POST /api/cos/` | `createCosRows` | Bulk-creates new pending COS rows. |
| Update row | `PATCH /api/cos/{id}/` | `updateCosRow` | Saves inline-edit and drawer changes to a single row. |

---

## 9. Quick Reference — endpoints by method

**GET**
- `mtc/test_certificate/`, `mtc/test_certificate/{id}/`
- `mtc/v2/test_certificate/`, `mtc/v2/test_certificate/{id}/`
- `mtc/gen_report_no/`, `mtc/client_order/{id}/`
- `mtc/v2/mtc_specified/{id}/`, `mtc/v2/mtc_specified_dropdown/`
- `mtc/{client,part_name,part_no}_dropdown/`
- `mtc/{tensile,impact,load_test,hardness,micro}_dropdown/`, `mtc/v2/grade_dropdown/`
- `mtc/heats/`, `mtc/heats/{id}/`, `mtc/final_reading/{id}/`, `mtc/govind_micro/{id}/`
- `mtc/history/{id}/`, `mtc/v2/history/{id}/`, `mtc/extract_images/{id}/`
- `/api/r/user_signature/{id}/`
- `/api/cos/`, `/api/cos/{id}/`, `/api/cos/schema/` 

**POST**
- `mtc/test_certificate/`, `mtc/v2/test_certificate/`
- `/upload-image/`, `/api/cos/`
- DLMS heat-details (external)

**PATCH**
- `mtc/test_certificate/{id}/`, `mtc/v2/test_certificate/{id}/`
- `...test_certificate/{id}/?approve=true` (standard, Crescent, Vishwakarma, NIF, TRSL)
- `/api/r/user_signature/{id}/`, `/api/cos/{id}/`

---

## 10. Notes & observations

- **V1 vs V2 coexist.** New customers should use the V2 (`/v2/`) endpoints; V1 remains for the legacy/standard flow.
- **Per-customer approval functions** share one endpoint but differ in `dynamic_data`/PDF template — `MTCFooter` is the dispatcher.
- **DLMS** call targets a `*-stage.iotnp.com` host; confirm the environment before relying on it in production.
- **Cancellable lookups** (`tensile`, `hardness`, `micro`, `heats`) accept an `AbortController` signal to drop stale type-ahead requests.