import React from 'react';

// Small stroke-based icon set (matches the DLMS Form Builder design).
// Usage: <Icon name="up" size={13} />
const PATHS = {
  logo: <path d="M12.5 5.5a3 3 0 0 1-4 4L4 14l-.5 .5a1.4 1.4 0 0 1-2-2L2 12l4.5-4.5a3 3 0 0 1 4-4l-2 2 1.5 1.5 2-2" />,
  spark: <><path d="M9 2.5l1.4 3.6 3.6 1.4-3.6 1.4L9 12.5 7.6 8.9 4 7.5l3.6-1.4z" /><path d="M14 12.5l.6 1.4 1.4.6-1.4.6L14 16.5l-.6-1.4-1.4-.6 1.4-.6z" /></>,
  download: <path d="M9 2.5v8M5.5 7.5 9 11l3.5-3.5M3.5 14.5h11" />,
  chevron: <path d="M4.5 7 9 11.5 13.5 7" />,
  up: <path d="M9 13V5M5.5 8.5 9 5l3.5 3.5" />,
  down: <path d="M9 5v8M5.5 9.5 9 13l3.5-3.5" />,
  x: <path d="M5 5l8 8M13 5l-8 8" />,
  plus: <path d="M9 4v10M4 9h10" />,
  check: <path d="M4.5 9.5l3 3 6-7" />,
  caret: <path d="M6 4.5 10.5 9 6 13.5" />,
  // field-type icons
  text: <path d="M3 5h12M3 9h12M3 13h7" />,
  number: <path d="M6 3 5 15M13 3l-1 12M3 7h12M2.5 11h12" />,
  date: <><rect x="3" y="4" width="12" height="11" rx="1.6" /><path d="M3 7.5h12M6 2.5v3M12 2.5v3" /></>,
  dropdown: <><rect x="3" y="4.5" width="12" height="9" rx="1.6" /><path d="M7 8.5 9 10.5 11 8.5" /></>,
  checkbox: <><rect x="3" y="3" width="12" height="12" rx="2.4" /><path d="M5.8 9l2 2 4-4.5" /></>,
  textarea: <><rect x="3" y="3.5" width="12" height="11" rx="1.6" /><path d="M5.5 7h7M5.5 9.5h7M5.5 12h4" /></>,
  time: <><circle cx="9" cy="9" r="6" /><path d="M9 5.5V9l2.5 1.5" /></>,
  shift: <path d="M14 7a5 5 0 1 0 .5 4M14 3.5V7h-3.5" />,
  link: <path d="M7.5 10.5 10.5 7.5M6 8 4 10a2.8 2.8 0 0 0 4 4l2-2M12 10l2-2a2.8 2.8 0 0 0-4-4l-2 2" />,
  tag: <><path d="M3 3.5h5l7 7-4.5 4.5-7-7z" /><circle cx="6" cy="6.5" r="1" /></>,
  toggle: <><rect x="2" y="5.5" width="14" height="7" rx="3.5" /><circle cx="11.5" cy="9" r="2.2" fill="currentColor" stroke="none" /></>,
  file: <path d="M14 8.5 8.5 14a3 3 0 0 1-4.2-4.2l6-6a2 2 0 0 1 2.9 2.8l-6 6a1 1 0 0 1-1.4-1.4l5.3-5.3" />,
  heading: <path d="M4 4v10M12 4v10M4 9h8" />,
  divider: <path d="M3 9h12" />,
  supervisor: <><circle cx="9" cy="6" r="2.6" /><path d="M3.5 14.5a5.5 5.5 0 0 1 11 0" /></>,
  spectrometer: <><circle cx="9" cy="9" r="2" /><ellipse cx="9" cy="9" rx="7" ry="3" /><ellipse cx="9" cy="9" rx="7" ry="3" transform="rotate(60 9 9)" /><ellipse cx="9" cy="9" rx="7" ry="3" transform="rotate(120 9 9)" /></>,
  nested: <><rect x="2.5" y="2.5" width="13" height="13" rx="2" /><rect x="6" y="6" width="6" height="6" rx="1" /></>,
  empty: <><rect x="3" y="3" width="12" height="12" rx="2" /><path d="M6 7h6M6 9.5h4" /></>,
  handle: <path d="M5 6h8M5 9h8M5 12h8" />,
  eye: <><path d="M1.5 9S4 3.5 9 3.5 16.5 9 16.5 9 14 14.5 9 14.5 1.5 9 1.5 9z" /><circle cx="9" cy="9" r="2.4" /></>,
  gear: <><circle cx="9" cy="9" r="2.3" /><path d="M9 1.6v2M9 14.4v2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M1.6 9h2M14.4 9h2M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4" /></>,
};

export default function Icon({ name, size = 14, stroke = 1.6, className, style }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >{p}</svg>
  );
}
