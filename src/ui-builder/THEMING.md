# Theme Generation Spec — build a theme from this file alone

This document is **self-contained**: an AI or a human with no access to the
codebase can read it and produce a valid theme for the NowPurchase form builder.
A theme is a **complete design system** — it can change colour, fonts, **layout,
spacing, density, shape, and shadows**, not just colours.

> **How to use this spec:** read §1–§6, then emit a theme exactly in the shape of
> §1 (use the worked example in §9 as a template). Validate against §8.
> Reference CSS (to reuse or override) is in the Appendix (§10).

---

## 1. Output contract — what to produce

Produce **one `defineTheme({…})` block** to be registered under a new key in the
`THEMES` map (file `src/ui-builder/state/themes.js`). Shape:

```js
myThemeKey: defineTheme({
  name: 'My Theme',                 // REQUIRED — shown in the builder dropdown
  tokens: { /* §3 */ },             // optional — layout geometry (deep-merged)
  card:   { any: { object: { /* §7 */ } } },  // optional — the section card box
  screen: screen({ /* §4 var overrides + page bg */ }),  // optional but usual
  componentCss: { /* §5 */ },       // optional — omit to inherit base controls
  table:  { headCss: '…', cellCss: '…', addBtnCss: '…' }, // optional (§7)
  removeBtnCss: '…',                // optional (§7)
}),
```

Rules:
- Only `name` is strictly required; every other field falls back to a sensible
  base. Specify only what differs from the base.
- `screen()` and `defineTheme()` are **provided helpers** (defined in §4/§2) — use
  them as written; you do not need to reimplement them.
- The block must be **self-contained**: do not reference other themes' internal
  variables. If you want the base control look, **omit `componentCss`** (it
  inherits); to restyle controls, either override CSS variables in `screen()`
  (preferred) or provide full CSS strings (copy from the Appendix and edit).

The future MCP will import this same object; keep it a plain literal.

---

## 2. The theme model & `defineTheme` merge rules

`defineTheme(overrides)` merges your delta onto a base theme:

| Field | Merge behaviour |
|---|---|
| `tokens` | **deep-merged per group** (`color`, `radius`, `space`, `shadow`, `size`) — override just a few keys |
| `componentCss` | **shallow-merged per component type** |
| `name`, `card`, `screen`, `table`, `removeBtnCss` | **replaced** if you provide them |

The export engine then reads, for the active theme:
`tokens` (geometry) · `componentCss` (control look) · `card` (section box) ·
`screen` (CSS variables + global rules) · `table` + `removeBtnCss` (table chrome).

Adding a key to `THEMES` makes the theme appear in the builder's theme dropdown
automatically.

---

## 3. Layout tokens (geometry) — `tokens`

These drive **shape and density**; the engine bakes them into the emitted
`css`/`wrapperCss`. Groups, keys, and base defaults:

```js
tokens: {
  color:  { surface: '#FFFFFF', pageBg: 'transparent', border: '#E2E8F0', headerBg: '#F8FAFC' },
  radius: { card: '8px', control: '6px' },
  space:  { xs: '6px', sm: '8px', md: '10px', lg: '14px', xl: '16px', xxl: '20px' },
  shadow: { soft: '0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06)',
            elevated: '0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06)' },
  size:   { actionCol: '48px' },
}
```

| Token | Controls |
|---|---|
| `color.surface` | card / table-row background |
| `color.pageBg` | Screen (page) background |
| `color.border` | every hairline border (sections, table rows) |
| `color.headerBg` | table header strip background |
| `radius.card` / `radius.control` | corner rounding of cards / controls |
| `space.xs…xxl` | gaps, padding, row spacing → **density** |
| `shadow.soft` / `shadow.elevated` | elevation presets |
| `size.actionCol` | width of the table per-row delete column |

> **px only**, uppercase hex. Set `shadow.*` to `none` for a flat theme; set
> `radius.*` to `0px` for square.

---

## 4. Design tokens (CSS variables) + the `screen()` helper

~80 CSS custom properties are injected on the Screen node, so **every field
inherits them** and the component CSS resolves through them. Override them with
the `screen()` helper, which also sets the page background.

`screen(extra)` produces exactly:

```js
function screen(extra = {}) {
  return { any: { object: { ...BASE_VARS, backgroundColor: 'transparent', gap: '16px', ...extra },
                  string: GLOBAL_CSS } };
}
```

So `screen({ '--radius-sm': '0px', backgroundColor: '#eee' })` injects all base
vars, then your overrides. (`GLOBAL_CSS` and `BASE_VARS` are in §10.)

### The full variable set (override any of these)

```text
GREYSCALE   --grey-100 #f2f2f2  --grey-200 #e6e6e6  --grey-300 #cccccc  --grey-400 #b3b3b3
            --grey-500 #999999  --grey-600 #808080  --grey-700 #666666  --grey-800 #4d4d4d
            --grey-900 #333333  --grey-1000 #1a1a1a --grey-1100 #0d0d0d
BLUE(brand) --blue-100 #e8f2f8  --blue-200 #d0e4f2  --blue-300 #a1c9e5  --blue-400 #73afd8
            --blue-500 #4494cb  --blue-600 #1579be  --blue-700 #116198  --blue-800 #0d4972  --blue-900 #08304c
RED(error)  --red-100 #fcecea  --red-200 #fad8d5  --red-300 #f4b2aa  --red-400 #ef8b80
            --red-500 #e96555  --red-600 #e43e2b  --red-700 #b63222  --red-800 #89251a
GREEN       --green-100 #eaf6ed --green-200 #d5ecdb --green-300 #aadab7 --green-500 #55b570
            --green-600 #2ba24c --green-700 #22823d --green-800 #1a612e
YELLOW      --yellow-100 #fbf3e5 --yellow-200 #f7e8cc --yellow-500 #dda333 --yellow-600 #d58c00 --yellow-800 #805400

SEMANTIC (use these in component CSS, not raw hex):
  surfaces  --surface-page  --surface-card  --surface-hover  --surface-active
            --surface-disabled  --surface-action  --surface-action-hover
  text      --text-heading  --text-body  --text-secondary  --text-placeholder
            --text-disabled  --text-action  --text-on-action  --text-mandatory
            --text-error  --text-success
  icon      --icon-primary  --icon-active  --icon-action
  stroke    --stroke-primary  --stroke-hover  --stroke-active  --stroke-error

SPACING     --space-1 4px  --space-2 8px  --space-3 12px  --space-4 16px  --space-5 20px
            --space-6 24px  --space-8 32px  --space-10 40px  --space-12 48px  --space-16 64px
RADII       --radius-xs 4px  --radius-sm 8px  --radius-md 12px  --radius-lg 16px
            --radius-xl 20px  --radius-pill 9999px  --radius-card 20px
ELEVATION   --shadow-drop  --shadow-drop-lg  --shadow-inner  --shadow-focus  --shadow-focus-error
TYPE        --font-heading  --font-body  --font-display  --font-h2  --font-h3  --font-h4
            --font-body-md  --font-body-sm  --font-label  --font-overline  --font-numeric
```

> **Rule of thumb:** colour / font / rounding → override a **variable**;
> structural geometry (spacing, table flex) → override a **`tokens`** value (§3).
> Re-skinning via variables is the cleanest path and lets later overrides win.

---

## 5. Component CSS & the targeting model — `componentCss`

A map of FormEngine component type → raw CSS string. Keys:
`RsInput`, `RsNumberFormat`, `RsTextArea`, `RsDropdown`, `RsDatePicker`,
`RsTimePicker`, `RsTagPicker`, `RsToggle`, `RsHeader`, `RsButton`.

**Targeting (critical):**
- **Leaf components** (`RsButton`, `RsHeader`): the node root *is* the element →
  use **bare declarations**.
  `RsButton: 'height:40px;border-radius:0;background:var(--surface-action);color:#fff;'`
- **Labeled components** (`RsInput`, pickers, textarea): the node root is the
  *wrapper* (label + control) → target the **inner element as a descendant**.
  The class is injected under emotion `&&`, giving descendants enough specificity
  to win **without `!important`**.
  `RsInput: 'input{height:44px;border:1px solid var(--stroke-primary);…}'`
  `RsDropdown: '.rs-picker-toggle{…}'`

**Inherit vs override:** omit `componentCss` to inherit the base control look; if
you only want a recolour/reshape, prefer overriding variables in `screen()` and
keep `componentCss` omitted. Write component CSS only for structural changes
(e.g., a different input height) — copy a base string from §10 and edit it.

**Do not use `!important`** in a new theme — it makes per-section/field overrides
hard. (The base picker/global rules use it for legacy reasons; that's exactly why
the variable route is the reliable override path.)

---

## 6. Conventions

- A node's style has two channels: **`object`** = CSS-property map (use for design
  tokens / variables); **`string`** = raw selector CSS. **Never mix** them in the
  same place; `screen()`/`card` follow this.
- Units: **px only**. Colours: uppercase hex. Reference semantic variables, not
  raw palette hex, inside component CSS so themes stay overridable.
- `metalcloud` is **frozen** (backward-compat). Never edit it — clone via
  `defineTheme`.

---

## 7. Card & tables

```js
// section card box
card: { any: { object: {
  backgroundColor: 'var(--surface-card)',
  borderRadius: 'var(--radius-card)',   // or '0px' for square
  boxShadow: 'var(--shadow-drop)',      // or 'none' for flat
  border: '1px solid var(--stroke-primary)', // optional hard border
  padding: 'var(--space-6)',
  gap: 'var(--space-4)',
} } },

// table chrome
table: {
  headCss:   'font:var(--font-overline);text-transform:uppercase;color:var(--text-secondary);',
  cellCss:   'input{height:38px;border:1px solid var(--stroke-primary);border-radius:var(--radius-sm);…}',
  addBtnCss: 'width:100%;height:40px;border:1px solid var(--stroke-action);color:var(--text-action);…',
},
removeBtnCss: 'width:32px;height:32px;background:var(--red-100);color:var(--red-600);border:1px solid var(--red-200);…',
```

Table column flex and the action-column width come from `tokens.size.actionCol`
and `tokens.space.*`, so table density follows the theme.

---

## 8. Acceptance checklist

A generated theme is valid when:

- [ ] It is a single `defineTheme({…})` literal with a `name`.
- [ ] Any `tokens` keys use the exact group/key names in §3; values are px /
      uppercase hex / `none`.
- [ ] Any CSS variables referenced exist in §4.
- [ ] `componentCss` keys are from the list in §5; labeled components target the
      inner element (`input{…}` / `.rs-picker-toggle{…}`), leaf components use
      bare declarations.
- [ ] No `!important` (outside reused base strings).
- [ ] `object` vs `string` channels are not mixed.
- [ ] It does not edit or depend on `metalcloud`.

**Test it:** register the theme, then
`npm run test:theme` (the golden snapshot must still pass → `metalcloud`
unchanged), and pick the theme in the builder topbar and hit **Preview**
(`/preview`) to view it live.

---

## 9. Worked example — a complete theme from this spec

“Graphite” — dark, rounded-large, soft-elevated. Built using only this spec:
overrides a few vars + tokens + the card; inherits base controls; tweaks the
button.

```js
graphite: defineTheme({
  name: 'Graphite',
  tokens: {
    radius: { card: '18px', control: '12px' },
    space:  { xxl: '26px' },                 // roomy card padding
    color:  { border: '#2A2F3A' },
  },
  card: { any: { object: {
    backgroundColor: '#1F2430',
    borderRadius: '18px',
    boxShadow: '0 12px 32px rgba(0,0,0,.35)',
    padding: '26px',
    gap: 'var(--space-4)',
  } } },
  screen: screen({
    backgroundColor: '#11141B',
    fontFamily: 'var(--font-body)',
    '--surface-card': '#1F2430',
    '--text-heading': '#F5F7FA',
    '--text-body': '#E2E6EC',
    '--text-secondary': '#9AA3B2',
    '--stroke-primary': '#2A2F3A',
    '--stroke-active': '#4494cb',
    '--radius-sm': '12px',
    '--shadow-drop': '0 12px 32px rgba(0,0,0,.35)',
  }),
  componentCss: {
    RsButton: 'height:44px;border-radius:var(--radius-pill);font:600 14px var(--font-heading);padding:0 var(--space-6);border:none;background:var(--surface-action);color:#fff;cursor:pointer;',
  },
}),
```

That's a full, valid theme: dark surfaces (vars), larger radii (tokens + vars),
a custom card, base inputs/pickers inherited, a solid button.

---

## 10. Appendix — reference base CSS (verbatim)

Copy these to reuse or override. They are the base/`metalcloud` strings; all
reference the variables in §4.

### `GLOBAL_CSS` (injected by `screen()` as the Screen `string`)
```css
.rs-form-control-label,.rs-control-label,label{font:var(--font-label) !important;color:var(--text-secondary) !important;margin-bottom:6px !important;}.rs-form-control-label:empty,.rs-control-label:empty,label:empty{display:none !important;margin:0 !important;}.rs-form-control-message,.rs-error-message{font:var(--font-body-sm) !important;color:var(--text-error) !important;}h1,h2,h3,h4{font-family:var(--font-heading) !important;color:var(--text-heading) !important;}
```

### Base input (`RsInput`, `RsNumberFormat`)
```css
input{height:44px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:0 var(--space-4);font:var(--font-body-md);color:var(--text-body);outline:none;transition:border-color 160ms ease-out,box-shadow 160ms ease-out,background 160ms ease-out;}input::placeholder{color:var(--text-placeholder);}input:hover{border-color:var(--stroke-hover);}input:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}input:disabled{background:var(--surface-disabled);color:var(--text-disabled);border-color:var(--grey-200);cursor:not-allowed;}
```

### Base picker (`RsDatePicker`, `RsTimePicker`; `RsDropdown`/`RsTagPicker` extend it)
```css
.rs-picker-toggle,.rs-picker-input{border-radius:var(--radius-sm) !important;border:1px solid var(--stroke-primary) !important;min-height:44px !important;display:flex !important;align-items:center !important;background:var(--surface-card) !important;font:var(--font-body-md) !important;color:var(--text-body) !important;}.rs-picker-disabled .rs-picker-toggle,.rs-picker-disabled .rs-picker-input{background:var(--surface-disabled) !important;color:var(--text-disabled) !important;}
```
`RsDropdown` also appends: `.rs-picker-popup{border-radius:var(--radius-md) !important;box-shadow:var(--shadow-drop-lg) !important;}`
`RsTagPicker` also appends: `.rs-tag{background:var(--surface-active) !important;color:var(--blue-800) !important;border-radius:var(--radius-pill) !important;}`

### Base textarea (`RsTextArea`)
```css
textarea{min-height:96px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:var(--space-3) var(--space-4);font:var(--font-body-md);color:var(--text-body);outline:none;transition:border-color 160ms ease-out,box-shadow 160ms ease-out;}textarea::placeholder{color:var(--text-placeholder);}textarea:hover{border-color:var(--stroke-hover);}textarea:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}
```

### Other base component CSS
```css
/* RsToggle */ .rs-toggle-checked .rs-toggle-presentation{background-color:var(--surface-action) !important;}
/* RsHeader */ font-family:var(--font-heading);color:var(--text-heading);
/* RsButton */ height:44px;border-radius:var(--radius-pill);font:600 14px var(--font-heading);padding:0 var(--space-6);border:1px solid var(--stroke-primary);background:transparent;color:var(--text-body);cursor:pointer;
```

### Base table strings
```css
/* table.headCss */  font:var(--font-overline);letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);
/* table.cellCss */  input{height:38px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:0 12px;font:var(--font-body-sm);color:var(--text-body);outline:none;}input::placeholder{color:var(--text-placeholder);}input:hover{border-color:var(--stroke-hover);}input:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}
/* table.addBtnCss */width:100%;height:40px;border-radius:var(--radius-md);border:1px solid var(--stroke-action);background:transparent;color:var(--text-action);font:600 13px var(--font-heading);cursor:pointer;
/* removeBtnCss */   width:32px;min-width:32px;height:32px;padding:0;border-radius:var(--radius-sm);background-color:var(--red-100);color:var(--red-600);border:1px solid var(--red-200);font-size:18px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;
```

### `BASE_VARS` defaults for semantic/type tokens (the rest are the palette in §4)
```text
--surface-page #ffffff  --surface-card #ffffff  --surface-hover var(--blue-100)  --surface-active var(--blue-200)
--surface-disabled var(--grey-100)  --surface-action var(--blue-600)  --surface-action-hover var(--blue-800)
--text-heading var(--grey-1100)  --text-body var(--grey-1000)  --text-secondary var(--grey-600)
--text-placeholder var(--grey-500)  --text-disabled var(--grey-400)  --text-action var(--blue-600)
--text-on-action #ffffff  --text-mandatory var(--red-600)  --text-error var(--red-600)  --text-success var(--green-700)
--icon-primary var(--grey-600)  --icon-active var(--grey-1100)  --icon-action var(--blue-600)
--stroke-primary var(--grey-300)  --stroke-hover var(--grey-600)  --stroke-active var(--blue-600)  --stroke-error var(--red-600)
--shadow-drop 0 8px 24px rgba(0,0,0,.12),0 2px 4px rgba(0,0,0,.06)
--shadow-drop-lg 0 20px 60px rgba(2,30,79,.18),0 4px 12px rgba(0,0,0,.08)
--shadow-inner inset 0 1px 2px rgba(0,0,0,.12)  --shadow-focus 0 0 0 3px rgba(21,121,190,.28)  --shadow-focus-error 0 0 0 3px rgba(228,62,43,.24)
--font-heading "Urbanist", system-ui, sans-serif   --font-body "Oxanium", ui-sans-serif, system-ui, sans-serif
--font-display 800 34px/40px var(--font-heading)   --font-h2 700 24px/32px var(--font-heading)
--font-h3 700 19px/26px var(--font-heading)         --font-h4 600 15px/22px var(--font-heading)
--font-body-md 400 15px/22px var(--font-body)        --font-body-sm 400 13px/18px var(--font-body)
--font-label 600 12px/16px var(--font-body)          --font-overline 700 10px/12px var(--font-body)
--font-numeric 600 15px/20px var(--font-body)
```
