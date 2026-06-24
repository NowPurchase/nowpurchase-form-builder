'use strict';

// ---------------------------------------------------------------------------
// tokens.js — the single source of truth for every style value the export
// engine emits. Change a value here and it propagates to all generated CSS
// (themes, section rows, tables, headers, controls).
//
// Conventions (enforced across the whole output):
//   • Units: px only (no rem/em mixing).
//   • Colors: uppercase hex.
//   • All emitted CSS uses the structured `object` form (CSSProperties) — never
//     raw `string` CSS — so values stay machine-editable and overridable.
// ---------------------------------------------------------------------------

const TOKENS = {
  color: {
    surface: '#FFFFFF',     // card / row background
    pageBg: 'transparent',  // Screen background (lets host page show through)
    border: '#E2E8F0',      // every hairline border
    headerBg: '#F8FAFC',    // table header strip
  },
  radius: {
    card: '8px',
    control: '6px',
  },
  // spacing scale (use these names, not raw px, everywhere)
  space: {
    xs: '6px',
    sm: '8px',
    md: '10px',  // standard gap between fields / row gap
    lg: '14px',  // gap between a card's children
    xl: '16px',  // gap between section cards
    xxl: '20px', // card padding
  },
  shadow: {
    soft: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    elevated: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  },
  size: {
    actionCol: '48px', // fixed width of the table per-row remove-button column
  },
};

// derived helpers
const hairline = `1px solid ${TOKENS.color.border}`;

export { TOKENS, hairline };
