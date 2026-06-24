'use strict';

// ---------------------------------------------------------------------------
// themes.js — single theme: MetalCloud. Standard sections render flat (no card
// box); the bordered/boxed design is reserved for tables. Control styling
// (inputs, pickers, buttons) is shared and applies to every field.
// ---------------------------------------------------------------------------

// ---- Ported design: "MetalCloud" (from the Form Component Gallery HTML) -----
// A full COMPONENT theme. The design's CSS custom properties are declared once
// on the Screen node (`cssVars`); every descendant inherits them. `componentCss`
// maps each FormEngine type → a raw-CSS string that targets the underlying
// rsuite classes (.rs-input, .rs-picker-toggle, .rs-checkbox-inner, .rs-btn …)
// using those vars. All values are lifted verbatim from the gallery.
const MC = {
  surface: '#FFFFFF',
  pageBg: '#F2F2F2',
  border: '#E6E6E6',
  radiusCard: '20px',
  shadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
  pad: '24px',
  gap: '16px',
  fontBody: '"Oxanium", "Urbanist", ui-sans-serif, system-ui, sans-serif',
};

// Design tokens as CSSProperties custom-prop keys, injected on the Screen node
// for EVERY theme so every descendant inherits them and the shared component
// CSS resolves. Fonts default to the system stack; the MetalCloud theme
// overrides --font-heading/--font-body (and sets fontFamily) via its screen.
// This is why inputs render as one clean box on clean/elevated too — not just
// MetalCloud. (Vars in `object`, selector rules in the `string` — never mix.)
// Verbatim port of the MetalCloud gallery's :root token block (Form Component
// Gallery → §1 Design Tokens). Injected once on the Screen node so every
// descendant inherits them; the component CSS below resolves entirely through
// these vars. Fonts fall back to a system stack (Urbanist/Oxanium overridden in
// the theme's screen()).
const BASE_VARS = {
  // greyscale
  '--grey-100': '#f2f2f2', '--grey-200': '#e6e6e6', '--grey-300': '#cccccc', '--grey-400': '#b3b3b3',
  '--grey-500': '#999999', '--grey-600': '#808080', '--grey-700': '#666666', '--grey-800': '#4d4d4d',
  '--grey-900': '#333333', '--grey-1000': '#1a1a1a', '--grey-1100': '#0d0d0d',
  // blue — primary brand
  '--blue-100': '#e8f2f8', '--blue-200': '#d0e4f2', '--blue-300': '#a1c9e5', '--blue-400': '#73afd8',
  '--blue-500': '#4494cb', '--blue-600': '#1579be', '--blue-700': '#116198', '--blue-800': '#0d4972', '--blue-900': '#08304c',
  // red — error / mandatory
  '--red-100': '#fcecea', '--red-200': '#fad8d5', '--red-300': '#f4b2aa', '--red-400': '#ef8b80',
  '--red-500': '#e96555', '--red-600': '#e43e2b', '--red-700': '#b63222', '--red-800': '#89251a',
  // green — success
  '--green-100': '#eaf6ed', '--green-200': '#d5ecdb', '--green-300': '#aadab7', '--green-500': '#55b570',
  '--green-600': '#2ba24c', '--green-700': '#22823d', '--green-800': '#1a612e',
  // yellow — warning
  '--yellow-100': '#fbf3e5', '--yellow-200': '#f7e8cc', '--yellow-500': '#dda333', '--yellow-600': '#d58c00', '--yellow-800': '#805400',
  // semantic — surface / text / icon / stroke
  '--surface-page': '#ffffff', '--surface-card': '#ffffff', '--surface-hover': 'var(--blue-100)', '--surface-active': 'var(--blue-200)',
  '--surface-disabled': 'var(--grey-100)', '--surface-action': 'var(--blue-600)', '--surface-action-hover': 'var(--blue-800)',
  '--text-heading': 'var(--grey-1100)', '--text-body': 'var(--grey-1000)', '--text-secondary': 'var(--grey-600)',
  '--text-placeholder': 'var(--grey-500)', '--text-disabled': 'var(--grey-400)', '--text-action': 'var(--blue-600)',
  '--text-on-action': '#ffffff', '--text-mandatory': 'var(--red-600)', '--text-error': 'var(--red-600)', '--text-success': 'var(--green-700)',
  '--icon-primary': 'var(--grey-600)', '--icon-active': 'var(--grey-1100)', '--icon-action': 'var(--blue-600)',
  '--stroke-primary': 'var(--grey-300)', '--stroke-hover': 'var(--grey-600)', '--stroke-active': 'var(--blue-600)', '--stroke-error': 'var(--red-600)',
  // spacing
  '--space-1': '4px', '--space-2': '8px', '--space-3': '12px', '--space-4': '16px', '--space-5': '20px',
  '--space-6': '24px', '--space-8': '32px', '--space-10': '40px', '--space-12': '48px', '--space-16': '64px',
  // radii
  '--radius-xs': '4px', '--radius-sm': '8px', '--radius-md': '12px', '--radius-lg': '16px',
  '--radius-xl': '20px', '--radius-pill': '9999px', '--radius-card': '20px',
  // elevation
  '--shadow-drop': '0 8px 24px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.06)',
  '--shadow-drop-lg': '0 20px 60px rgba(2,30,79,.18), 0 4px 12px rgba(0,0,0,.08)',
  '--shadow-inner': 'inset 0 1px 2px rgba(0,0,0,.12)',
  '--shadow-focus': '0 0 0 3px rgba(21,121,190,.28)', '--shadow-focus-error': '0 0 0 3px rgba(228,62,43,.24)',
  // type
  '--font-heading': '"Urbanist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '--font-body': '"Oxanium", ui-sans-serif, system-ui, -apple-system, sans-serif',
  '--font-display': '800 34px/40px var(--font-heading)', '--font-h2': '700 24px/32px var(--font-heading)',
  '--font-h3': '700 19px/26px var(--font-heading)', '--font-h4': '600 15px/22px var(--font-heading)',
  '--font-body-md': '400 15px/22px var(--font-body)', '--font-body-sm': '400 13px/18px var(--font-body)',
  '--font-label': '600 12px/16px var(--font-body)', '--font-overline': '700 10px/12px var(--font-body)',
  '--font-numeric': '600 15px/20px var(--font-body)',
};

// Global form-chrome rules — selectors only (no bare declarations), like the
// real forms' .section_card / .rs-uploader-trigger-btn css strings.
const GLOBAL_CSS = '.rs-form-control-label,.rs-control-label,label{font:var(--font-label) !important;color:var(--text-secondary) !important;margin-bottom:6px !important;}.rs-form-control-label:empty,.rs-control-label:empty,label:empty{display:none !important;margin:0 !important;}.rs-form-control-message,.rs-error-message{font:var(--font-body-sm) !important;color:var(--text-error) !important;}h1,h2,h3,h4{font-family:var(--font-heading) !important;color:var(--text-heading) !important;}';

// Screen css for a theme: shared vars + global rules, plus per-theme overrides.
function screen(extra = {}) {
  return { any: { object: { ...BASE_VARS, backgroundColor: 'transparent', gap: '16px', ...extra }, string: GLOBAL_CSS } };
}

// CSS targeting model (SPEC §5/§7): a node's css string is injected into emotion
// `&& { … }` on the component's ROOT element, and pseudo/`&`/nested selectors are
// supported. Two cases:
//   • Leaf components (RsButton, RsHeader) — the root IS the element, so BARE
//     declarations style it directly.
//   • Labeled components (RsInput/RsNumberFormat/RsTextArea/pickers) — the root
//     is the WRAPPER (label + control), so we target the inner control as a
//     descendant (`input{…}`, `.rs-picker-toggle{…}`). Emotion's `&&` gives the
//     descendant enough specificity to beat rsuite defaults without `!important`.
// FormEngine puts a node's css className on the component's ROOT element, which
// for a labeled input (RsInput is `.labeled(...)`) is the WRAPPER holding the
// label + input — NOT the <input>. A bare `border:…` would therefore box the
// whole label+input AND leave the input's own border → a double border (one
// inside, one above the label). So we target the inner <input> as a descendant:
// emotion nests the string under `&& { … }`, giving `&& input` enough
// specificity to win over rsuite's defaults without `!important`. This is the
// gallery's `.input` rule, ported verbatim (incl. hover/focus/disabled states).
const MC_INPUT = 'input{height:44px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:0 var(--space-4);font:var(--font-body-md);color:var(--text-body);outline:none;transition:border-color 160ms ease-out,box-shadow 160ms ease-out,background 160ms ease-out;}input::placeholder{color:var(--text-placeholder);}input:hover{border-color:var(--stroke-hover);}input:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}input:disabled{background:var(--surface-disabled);color:var(--text-disabled);border-color:var(--grey-200);cursor:not-allowed;}';
const MC_PICKER = '.rs-picker-toggle,.rs-picker-input{border-radius:var(--radius-sm) !important;border:1px solid var(--stroke-primary) !important;min-height:44px !important;display:flex !important;align-items:center !important;background:var(--surface-card) !important;font:var(--font-body-md) !important;color:var(--text-body) !important;}.rs-picker-disabled .rs-picker-toggle,.rs-picker-disabled .rs-picker-input{background:var(--surface-disabled) !important;color:var(--text-disabled) !important;}';

// Per-row remove — the editable-table design's ".row-x": 32x32 rounded square,
// light-red fill. Bare declarations (exactly like the real DLMS delete buttons).
const MC_REMOVE_BTN = 'width:32px;min-width:32px;height:32px;padding:0;border-radius:var(--radius-sm);background-color:var(--red-100);color:var(--red-600);border:1px solid var(--red-200);font-size:18px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;';

// Table-specific styling from the Editable Table design.
const MC_TABLE = {
  headCss: 'font:var(--font-overline);letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);',
  cellCss: 'input{height:38px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:0 12px;font:var(--font-body-sm);color:var(--text-body);outline:none;}input::placeholder{color:var(--text-placeholder);}input:hover{border-color:var(--stroke-hover);}input:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}',
  addBtnCss: 'width:100%;height:40px;border-radius:var(--radius-md);border:1px solid var(--stroke-action);background:transparent;color:var(--text-action);font:600 13px var(--font-heading);cursor:pointer;',
};

const MC_COMPONENT_CSS = {
  RsInput: MC_INPUT,
  RsNumberFormat: MC_INPUT,
  RsTextArea: 'textarea{min-height:96px;width:100%;border-radius:var(--radius-sm);border:1px solid var(--stroke-primary);background:var(--surface-card);padding:var(--space-3) var(--space-4);font:var(--font-body-md);color:var(--text-body);outline:none;transition:border-color 160ms ease-out,box-shadow 160ms ease-out;}textarea::placeholder{color:var(--text-placeholder);}textarea:hover{border-color:var(--stroke-hover);}textarea:focus{border-color:var(--stroke-active);box-shadow:var(--shadow-focus);}',
  RsDropdown: `${MC_PICKER}.rs-picker-popup{border-radius:var(--radius-md) !important;box-shadow:var(--shadow-drop-lg) !important;}`,
  RsDatePicker: MC_PICKER,
  RsTimePicker: MC_PICKER,
  RsTagPicker: `${MC_PICKER}.rs-tag{background:var(--surface-active) !important;color:var(--blue-800) !important;border-radius:var(--radius-pill) !important;}`,
  RsToggle: '.rs-toggle-checked .rs-toggle-presentation{background-color:var(--surface-action) !important;}',
  RsHeader: 'font-family:var(--font-heading);color:var(--text-heading);',
  RsButton: 'height:44px;border-radius:var(--radius-pill);font:600 14px var(--font-heading);padding:0 var(--space-6);border:1px solid var(--stroke-primary);background:transparent;color:var(--text-body);cursor:pointer;',
};

// ---------------------------------------------------------------------------
// Themes are first-class DESIGN SYSTEMS, not CSS-var overrides. A theme owns
// everything the export engine emits:
//   • tokens       — layout geometry (spacing, radii, borders, table flex,
//                    action-col width, shadows). The export engine reads these,
//                    so a theme can change LAYOUT/DENSITY/SHAPE, not just colour.
//   • componentCss — per-FormEngine-type raw CSS (control look)
//   • card/screen  — section card + Screen (CSS vars + global rules)
//   • table/removeBtnCss — table-specific styling
// `defineTheme(overrides)` deep-merges onto BASE so a new theme (metalv2, …) is
// a small delta that can override anything. Add a key to THEMES and it appears
// in the builder's theme dropdown automatically.
// ---------------------------------------------------------------------------

// Base layout geometry. Mirrors state/tokens.js (the export engine's historical
// constants) so metalcloud — which inherits these unchanged — emits identical
// output. A theme overrides only the token groups it wants to change.
const BASE_TOKENS = {
  color: { surface: '#FFFFFF', pageBg: 'transparent', border: '#E2E8F0', headerBg: '#F8FAFC' },
  radius: { card: '8px', control: '6px' },
  space: { xs: '6px', sm: '8px', md: '10px', lg: '14px', xl: '16px', xxl: '20px' },
  shadow: {
    soft: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    elevated: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  },
  size: { actionCol: '48px' },
};

const BASE_THEME = {
  name: 'Base',
  tokens: BASE_TOKENS,
  componentCss: {},
  card: null,
  screen: screen(),
  table: null,
  removeBtnCss: null,
};

// Deep-merge token groups (color/radius/space/shadow/size) so a theme can
// override just a few values; unspecified groups/keys fall back to BASE_TOKENS.
function mergeTokens(base, ovr) {
  if (!ovr) return base;
  const out = {};
  for (const k of Object.keys(base)) out[k] = { ...base[k], ...(ovr[k] || {}) };
  for (const k of Object.keys(ovr)) if (!out[k]) out[k] = ovr[k];
  return out;
}

// Build a theme from a delta over BASE. Top-level fields replace; tokens and
// componentCss merge (so a theme adds/overrides without re-listing everything).
function defineTheme(overrides = {}) {
  return {
    ...BASE_THEME,
    ...overrides,
    tokens: mergeTokens(BASE_THEME.tokens, overrides.tokens),
    componentCss: { ...BASE_THEME.componentCss, ...(overrides.componentCss || {}) },
  };
}

const THEMES = {
  // MetalCloud — the gallery's `.section`: white card, drop shadow, rounded, no
  // border line (boxed look reserved for tables). Inherits BASE_TOKENS unchanged.
  metalcloud: defineTheme({
    name: 'MetalCloud',
    componentCss: MC_COMPONENT_CSS,
    removeBtnCss: MC_REMOVE_BTN,
    table: MC_TABLE,
    card: { any: { object: {
      backgroundColor: 'var(--surface-card)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-drop)',
      padding: 'var(--space-6)',
      gap: 'var(--space-4)',
    } } },
    screen: screen({
      '--font-heading': '"Urbanist", system-ui, sans-serif',
      '--font-body': '"Oxanium", ui-sans-serif, system-ui, sans-serif',
      backgroundColor: 'var(--grey-200)',
      gap: 'var(--space-6)',
      fontFamily: 'var(--font-body)',
    }),
  }),

  // MetalV2 — a deliberately DIFFERENT design system, proving a theme can change
  // layout/shape/shadow, not just colour: flat (no drop shadow), SQUARE corners,
  // DENSE spacing, hard 2px borders. Controls restyle two ways at once — token
  // overrides change geometry, var overrides re-skin the shared component CSS.
  metalv2: defineTheme({
    name: 'MetalV2 (Flat)',
    tokens: {
      color: { border: '#0F172A', headerBg: '#0F172A' },
      radius: { card: '0px', control: '0px' },
      space: { xs: '4px', sm: '6px', md: '6px', lg: '8px', xl: '10px', xxl: '12px' },
      shadow: { soft: 'none', elevated: 'none' },
    },
    // Hard-edged boxed card instead of a soft floating one.
    card: { any: { object: {
      backgroundColor: '#ffffff',
      border: '2px solid #0F172A',
      borderRadius: '0px',
      boxShadow: 'none',
      padding: '12px',
      gap: '8px',
    } } },
    // Reuse the shared component CSS but flip the vars it reads → square, flat,
    // dark-bordered controls with no extra CSS to write.
    componentCss: {
      ...MC_COMPONENT_CSS,
      RsButton: 'height:40px;border-radius:0;font:600 13px var(--font-heading);padding:0 var(--space-5);border:2px solid var(--stroke-active);background:var(--surface-action);color:#fff;cursor:pointer;',
    },
    screen: screen({
      '--font-heading': '"Urbanist", system-ui, sans-serif',
      '--font-body': '"Oxanium", ui-sans-serif, system-ui, sans-serif',
      backgroundColor: '#E2E8F0',
      gap: '12px',
      fontFamily: 'var(--font-body)',
      // flat + square: kill rounding and shadows, darken strokes
      '--radius-xs': '0px', '--radius-sm': '0px', '--radius-md': '0px', '--radius-lg': '0px', '--radius-xl': '0px', '--radius-card': '0px', '--radius-pill': '0px',
      '--stroke-primary': '#0F172A', '--stroke-hover': '#0F172A', '--stroke-active': '#1579be',
      '--shadow-drop': 'none', '--shadow-drop-lg': 'none', '--shadow-focus': '0 0 0 2px rgba(21,121,190,.35)',
    }),
  }),

  warmAmber: defineTheme({
    name: 'Warm Amber',
    tokens: {
      color: {
        surface:  '#FFFBF3',
        pageBg:   '#FBF6EE',
        border:   '#E8DCC3',
        headerBg: '#F5EBD6',
      },
      radius: { card: '10px', control: '8px' },
      space:  { xs: '6px', sm: '8px', md: '10px', lg: '14px', xl: '18px', xxl: '22px' },
      shadow: {
        soft:     '0 1px 3px rgba(122,76,12,.08), 0 1px 2px rgba(122,76,12,.05)',
        elevated: '0 8px 24px rgba(122,76,12,.10), 0 2px 6px rgba(122,76,12,.06)',
      },
    },
    card: { any: { object: {
      backgroundColor: 'var(--surface-card)',
      borderRadius: '10px',
      boxShadow: '0 1px 3px rgba(122,76,12,.08), 0 1px 2px rgba(122,76,12,.05)',
      border: '1px solid var(--stroke-primary)',
      padding: 'var(--space-6)',
      gap: 'var(--space-4)',
    } } },
    screen: screen({
      backgroundColor: '#FBF6EE',
      fontFamily: 'var(--font-body)',
      '--surface-page':         '#FBF6EE',
      '--surface-card':         '#FFFBF3',
      '--surface-hover':        '#FBF0DC',
      '--surface-active':       '#F5E2BE',
      '--surface-action':       '#C77A1A',
      '--surface-action-hover': '#A86314',
      '--text-heading':         '#3D2A0F',
      '--text-body':            '#4A3517',
      '--text-secondary':       '#8A6F47',
      '--text-placeholder':     '#B49E78',
      '--text-action':          '#A86314',
      '--text-on-action':       '#FFFBF3',
      '--icon-primary':         '#8A6F47',
      '--icon-active':          '#3D2A0F',
      '--icon-action':          '#C77A1A',
      '--stroke-primary':       '#E8DCC3',
      '--stroke-hover':         '#C9B58A',
      '--stroke-active':        '#C77A1A',
      '--shadow-drop':          '0 8px 24px rgba(122,76,12,.10), 0 2px 6px rgba(122,76,12,.06)',
      '--shadow-drop-lg':       '0 20px 60px rgba(122,76,12,.16), 0 4px 12px rgba(122,76,12,.08)',
      '--shadow-focus':         '0 0 0 3px rgba(199,122,26,.22)',
      '--radius-sm':            '8px',
      '--radius-card':          '10px',
      '--blue-800':             '#A86314',
    }),
  }),

  brutalistMono: defineTheme({
    name: 'Brutalist Mono',
    tokens: {
      color: {
        surface:  '#FFFFFF',
        pageBg:   '#FFFFFF',
        border:   '#000000',
        headerBg: '#F2F2F2',
      },
      radius: { card: '0px', control: '0px' },
      space:  { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px', xxl: '14px' },
      shadow: { soft: 'none', elevated: '6px 6px 0 #000000' },
      size:   { actionCol: '44px' },
    },
    card: { any: { object: {
      backgroundColor: '#FFFFFF',
      borderRadius: '0px',
      boxShadow: '6px 6px 0 #000000',
      border: '2px solid #000000',
      padding: 'var(--space-5)',
      gap: 'var(--space-3)',
    } } },
    screen: screen({
      backgroundColor: '#FFFFFF',
      fontFamily: 'var(--font-body)',
      '--surface-page':         '#FFFFFF',
      '--surface-card':         '#FFFFFF',
      '--surface-hover':        '#F2F2F2',
      '--surface-active':       '#E6E6E6',
      '--surface-disabled':     '#F2F2F2',
      '--surface-action':       '#000000',
      '--surface-action-hover': '#1A1A1A',
      '--text-heading':         '#000000',
      '--text-body':            '#000000',
      '--text-secondary':       '#4D4D4D',
      '--text-placeholder':     '#808080',
      '--text-disabled':        '#999999',
      '--text-action':          '#000000',
      '--text-on-action':       '#FFFFFF',
      '--icon-primary':         '#000000',
      '--icon-active':          '#000000',
      '--icon-action':          '#000000',
      '--stroke-primary':       '#000000',
      '--stroke-hover':         '#000000',
      '--stroke-active':        '#000000',
      '--shadow-drop':          '4px 4px 0 #000000',
      '--shadow-drop-lg':       '6px 6px 0 #000000',
      '--shadow-focus':         '0 0 0 3px #000000',
      '--radius-xs':            '0px',
      '--radius-sm':            '0px',
      '--radius-md':            '0px',
      '--radius-lg':            '0px',
      '--radius-pill':          '0px',
      '--radius-card':          '0px',
      '--space-1': '3px',
      '--space-2': '6px',
      '--space-3': '9px',
      '--space-4': '12px',
      '--space-5': '16px',
      '--space-6': '20px',
      '--space-8': '24px',
      '--font-heading': '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
      '--font-body':    '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
      '--blue-800': '#000000',
    }),
    componentCss: {
      RsInput:        'input{height:40px;width:100%;border-radius:0;border:2px solid #000000;background:#FFFFFF;padding:0 var(--space-3);font:var(--font-body-md);color:#000000;outline:none;}input::placeholder{color:#808080;}input:hover{border-color:#000000;}input:focus{border-color:#000000;box-shadow:4px 4px 0 #000000;}input:disabled{background:#F2F2F2;color:#999999;cursor:not-allowed;}',
      RsNumberFormat: 'input{height:40px;width:100%;border-radius:0;border:2px solid #000000;background:#FFFFFF;padding:0 var(--space-3);font:var(--font-numeric);color:#000000;outline:none;}input:focus{border-color:#000000;box-shadow:4px 4px 0 #000000;}',
      RsTextArea:     'textarea{min-height:96px;width:100%;border-radius:0;border:2px solid #000000;background:#FFFFFF;padding:var(--space-2) var(--space-3);font:var(--font-body-md);color:#000000;outline:none;}textarea::placeholder{color:#808080;}textarea:focus{border-color:#000000;box-shadow:4px 4px 0 #000000;}',
      RsButton:       'height:40px;border-radius:0;font:700 13px var(--font-heading);text-transform:uppercase;letter-spacing:.08em;padding:0 var(--space-4);border:2px solid #000000;background:#000000;color:#FFFFFF;cursor:pointer;',
      RsHeader:       'font-family:var(--font-heading);color:#000000;text-transform:uppercase;letter-spacing:.04em;',
    },
    table: {
      headCss:   'font:700 11px var(--font-heading);letter-spacing:.1em;text-transform:uppercase;color:#000000;border-bottom:2px solid #000000;padding-bottom:var(--space-2);',
      cellCss:   'input{height:36px;width:100%;border-radius:0;border:2px solid #000000;background:#FFFFFF;padding:0 var(--space-2);font:var(--font-body-sm);color:#000000;outline:none;}input::placeholder{color:#808080;}input:hover{border-color:#000000;}input:focus{border-color:#000000;box-shadow:3px 3px 0 #000000;}',
      addBtnCss: 'width:100%;height:38px;border-radius:0;border:2px solid #000000;background:#FFFFFF;color:#000000;font:700 12px var(--font-heading);text-transform:uppercase;letter-spacing:.08em;cursor:pointer;',
    },
    removeBtnCss: 'width:32px;min-width:32px;height:32px;padding:0;border-radius:0;background:#FFFFFF;color:#000000;border:2px solid #000000;font-size:18px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;',
  }),

  softMint: defineTheme({
    name: 'Soft Mint',
    tokens: {
      color: {
        surface:  '#FFFFFF',
        pageBg:   '#F2FAF6',
        border:   '#D5ECDB',
        headerBg: '#EAF6ED',
      },
      radius: { card: '20px', control: '22px' },
      space:  { xs: '8px', sm: '10px', md: '14px', lg: '18px', xl: '22px', xxl: '28px' },
      shadow: {
        soft:     '0 2px 8px rgba(43,162,76,.06), 0 1px 3px rgba(43,162,76,.04)',
        elevated: '0 16px 40px rgba(43,162,76,.10), 0 4px 10px rgba(43,162,76,.06)',
      },
    },
    card: { any: { object: {
      backgroundColor: '#FFFFFF',
      borderRadius: '20px',
      boxShadow: '0 16px 40px rgba(43,162,76,.10), 0 4px 10px rgba(43,162,76,.06)',
      border: '1px solid #E5F2EA',
      padding: 'var(--space-8)',
      gap: 'var(--space-5)',
    } } },
    screen: screen({
      backgroundColor: '#F2FAF6',
      fontFamily: 'var(--font-body)',
      '--surface-page':         '#F2FAF6',
      '--surface-card':         '#FFFFFF',
      '--surface-hover':        '#EAF6ED',
      '--surface-active':       '#D5ECDB',
      '--surface-action':       '#2BA24C',
      '--surface-action-hover': '#22823D',
      '--text-heading':         '#0F2A18',
      '--text-body':            '#1A3D26',
      '--text-secondary':       '#5A7264',
      '--text-placeholder':     '#9CB3A4',
      '--text-action':          '#22823D',
      '--text-on-action':       '#FFFFFF',
      '--icon-primary':         '#5A7264',
      '--icon-active':          '#1A3D26',
      '--icon-action':          '#2BA24C',
      '--stroke-primary':       '#D5ECDB',
      '--stroke-hover':         '#AADAB7',
      '--stroke-active':        '#2BA24C',
      '--shadow-drop':          '0 16px 40px rgba(43,162,76,.10), 0 4px 10px rgba(43,162,76,.06)',
      '--shadow-drop-lg':       '0 28px 80px rgba(43,162,76,.14), 0 8px 20px rgba(43,162,76,.08)',
      '--shadow-focus':         '0 0 0 4px rgba(43,162,76,.20)',
      '--radius-sm':            '22px',
      '--radius-md':            '20px',
      '--radius-lg':            '24px',
      '--radius-card':          '20px',
      '--space-4': '20px',
      '--space-5': '24px',
      '--space-6': '32px',
      '--space-8': '40px',
      '--blue-800': '#22823D',
    }),
  }),
};

export { THEMES, defineTheme };
