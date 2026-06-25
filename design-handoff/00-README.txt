================================================================================
DLMS FORM BUILDER — DESIGN HANDOFF
================================================================================

PURPOSE OF THIS FOLDER
----------------------
This folder describes every part (screen / panel / control) of the DLMS Form
Builder so a design AI can redesign each one. Each file covers ONE part and
states: what it is, where it sits, what the user does there, every control and
state, the data it reads/writes, and the design goals/constraints. No code is
required to use these — they are written for a visual designer.

Read 00 (this file) and 13 (UX principles) first for the whole-product framing,
then design part-by-part from files 01–12.

WHAT THE TOOL IS (one paragraph)
--------------------------------
A no-code builder where a non-technical operations user assembles a data-entry
FORM (for a metals/casting quality-management system, "DLMS"). The user creates
SECTIONS, adds FIELDS (text, number, date, dropdown, etc.), arranges them, sets
rules (show-when, validation, defaults), and exports a JSON the runtime renders
as a real, fillable form. There is also an AI assistant (chat) that can build
the form from plain English, and a live theme switcher.

THE SCREEN AT A GLANCE (three-pane workbench)
---------------------------------------------
  ┌───────────────────────── TOP BAR ─────────────────────────┐
  │ logo · form name · template_id · theme ▾   ⚙ Assistant Import Preview Export │
  ├───────────┬───────────────────────────────┬───────────────┤
  │ LEFT      │ CENTER (CANVAS)               │ RIGHT          │
  │ Sections  │ the form being built          │ Properties of  │
  │ list +    │ (section cards, field chips,  │ the selected   │
  │ add       │ add-field palette)            │ section/field  │
  ├───────────┴───────────────────────────────┴───────────────┤
  │ FOOTER: active section summary · N sections · N fields     │
  └────────────────────────────────────────────────────────────┘
  (A chat Assistant dock and modal dialogs overlay this.)

PARTS (one design file each)
----------------------------
  01-app-shell.txt .............. top bar, 3-pane layout, footer, modals
  02-section-panel.txt .......... LEFT: list of sections / nested groups
  03-canvas-panel.txt ........... CENTER: form canvas, field chips, palette
  04-property-panel.txt ......... RIGHT: properties for a section or field
  05-field-types.txt ............ the field palette + what each type is
  06-dropdown-and-master-data.txt the Dropdown field + master-data config modal
  07-table-editor.txt ........... table sections (repeating rows) + summaries
  08-keys-and-references.txt .... the key system, key picker, rename warnings
  09-assistant-chat.txt ......... the AI chat dock
  10-themes.txt ................. theme switcher + what a theme controls
  11-export-import-preview.txt .. the JSON in/out + preview
  12-conditional-rules.txt ...... show-when, default value, validations
  13-ux-principles.txt .......... product philosophy + visual tone to honor

CURRENT VISUAL TONE (to evolve, not necessarily keep)
-----------------------------------------------------
Light, clean, dense "tool" aesthetic. Accent blue (~#1579be / #2563eb). Cards on
a near-white canvas, hairline borders, small uppercase section labels, monospace
for keys/dataKeys. Fonts in use: a heading font (var --h), body (var --b), mono.
Rounded corners, subtle shadows. It should feel fast, trustworthy, and not toy-
like — operators rely on it for production quality records.

ACCESS / RUNNING THE LIVE TOOL (for screenshots)
------------------------------------------------
Run locally: `npm install` then `npm run dev` (Vite) → opens the builder.
The builder UI itself has NO login. If the design AI needs the live nowpurchase
platform (where this is embedded), that login is phone-number + OTP. Provide the
phone/OTP at sign-in time — do NOT store them in this folder (kept out for
privacy). These text specs are self-sufficient without the live app.
