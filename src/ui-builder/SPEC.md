# FormEngine `Rs*` Components — Complete Specification

> **Single source of truth** for building a form builder on top of FormEngine (Optimajet `@react-form-builder`).
>
> - **Source:** frozen repository, commit `7c93dee44a956b5368225c2e1fa4c3fd1d8b2fe2` — **Version 7.9.0**.
> - **Scope:** the `rsuite` view package — `community/src/packages/views/rsuite/src/components/` — plus the core engine that defines the persisted JSON contract — `community/src/packages/core/`.
> - **`premium/` contains only example apps** — no `Rs*` component source exists there.
> - Every fact below is derived directly from source at that commit. No behavior will ever change (repo is frozen).

## How a component is defined

Each `Rs*` component is a React component registered through a fluent **`define(...)`** builder:

```ts
export const rsInput = define(RsInput, 'RsInput')   // (Component, type-id)
  .name('Input')                                    // palette display name
  .category(fieldsCategory)                         // palette grouping
  .props({                                          // declared properties (the prop schema)
    label: string.default('Input'),
    ...inputProps,                                  // shared property groups (see commonProperties)
    type: oneOf('text','password',…).default('text'),
    value: string.valued.uncontrolledValue(''),     // `.valued` = the data-bound value prop
    passwordMask: boolean.default(false),
  })
```

Properties are declared with a small DSL (`string`, `boolean`, `number`, `oneOf`, `array`, `event`, `node`, …) and chained modifiers (`.default(v)`, `.valued`, `.uncontrolledValue(v)`, `.labeled(...)`, `.withEditorProps({...})`, …). The full DSL is documented in **Appendix A**. The serialized output of a built form is documented in **§3 JSON Schema**.

### Reading the prop tables

- **Type** — the logical editor/JSON type. `enum a/b/c` = `oneOf(...)` with those literal values; `color(string)` = a color-editor string; `ReactNode slot` = a child container slot (`node`/`nodeArray`); `array` = list editor.
- **Default** — value from `.default(v)`. `(uncontrolled)` marks `.uncontrolledValue(v)` (the initial value React uses before the field is controlled).
- **Value prop** — the property marked `.valued` (two-way bound to form data under the node's `dataKey`). At most one per component.
- **Events** — properties declared with the `event` builder; bindable to **Actions** (see §4).
- Auto-injected onto **every** component (not repeated per table): `key`, `className`, `tooltipProps`, `renderWhen`, `htmlAttributes`, `validation`, and the `onDidMount` / `onWillUnmount` lifecycle events. CSS is carried in `css` / `wrapperCss` (see §6), not in `props`.

## Component catalog

`Rs*` components register **38 type-ids** across 4 categories (some files register more than one type — e.g. `RsPlaceholder` → Graph/Grid/Paragraph; `RsProgress` → Circle/Line; `RsWizard` also registers the child `RsWizardStep`).

| Category | Type-ids |
|----------|----------|
| **fields** | RsInput, RsTextArea, RsAutoComplete, RsCalendar, RsCheckbox, RsDatePicker, RsDropdown, RsNumberFormat, RsPatternFormat, RsRadioGroup, RsSearch, RsTagPicker, RsTimePicker, RsToggle, RsUploader |
| **static** | RsButton, RsDivider, RsErrorMessage, RsHeader, RsImage, RsLabel, RsLink, RsMenu, RsMessage, RsPlaceholderGraph, RsPlaceholderGrid, RsPlaceholderParagraph, RsProgressCircle, RsProgressLine, RsStaticContent, RsTooltip |
| **structure** | RsBreadcrumb, RsCard, RsContainer, RsTab, RsWizard (+ RsWizardStep), **`Repeater`** (core, non-`Rs*`) |
| **modal** | RsModal, RsModalLayout |

> `RsErrorMessage`, `RsModal` are `hideFromComponentPalette()` (role-managed, not user-draggable). `RsLocalizationWrapper` is the viewer wrapper, not a form component.
> **`Repeater`** is a **core** structure component (type id `Repeater`, kind `repeater`), not part of the `Rs*` rsuite set. It binds an **array** and renders its `children` as a per-row template; see its detailed entry under **Structure & Modal**. Pairs with the built-in `addRow`/`removeRow` common actions (§Events).

### Custom NowPurchase components (`np-dlms-components`)

Beyond the upstream `Rs*` set, the host registers a few **custom** components (`NewForm.jsx` → `builderComponents`). These are NOT in the upstream rsuite package above:

| Type id | Category | What it is | Builder support |
|---------|----------|-----------|-----------------|
| `RsCameraCapture` | fields | Camera/gallery capture + upload (overrides `RsUploader`) | ✅ our `upload` field_type |
| `RsDropdown` (override) | fields | InputPicker dropdown (overrides the upstream `RsDropdown`) | ✅ our `dropdown_fixed`/`dropdown_async`/`shift` |
| **`RsSpectrometerReading`** | fields | Reads elemental composition from a spectrometer device; binds an object value keyed by element | ✅ our `spectrometer` field_type |
| **`RsChipInput`** | fields | Free-entry chip/tag input (`maxChips`, `allowDuplicates`) — value is a string the component splits into chips; distinct from `RsTagPicker` (no option list) | ✅ our `chips` field_type |
| `NpInput` | fields (`category: "input"`) | Custom-styled single-line text input | ❌ not exposed — duplicates `text`/`RsInput`; use `text` instead |

**`RsSpectrometerReading`**
- **Type id:** `RsSpectrometerReading` · **Category:** fields · **Underlying:** `np-dlms-components` · **Kind:** component · **Value prop:** `value` (an object keyed by element symbol)
- **Props:** `label` (string), `url` (string — device/reading endpoint), `elements` (string — comma-separated element symbols, e.g. `"C,Si,Mn,P,S"`), `columnsPerRow` (number, default 4), `showConnectionStatus` (boolean, default true)
- **Builder mapping:** our `spectrometer` field_type → this type id (`exportJSON.js` `FIELD_TYPE_MAP`); config keys `url` / `elements` / `columns_per_row` / `show_connection_status` are emitted as the props above. Round-trips via `_raw` like any imported node.

**`RsChipInput`** (display name "ChipInput")
- **Type id:** `RsChipInput` · **Category:** fields · **Underlying:** `np-dlms-components` · **Kind:** component · **Value prop:** `value` (string — the component `parseChips`-splits it into chips; user types + Enter/comma to add, chips are removable)
- **Props:** `label` (string), `placeholder` (string, default `"Type and press Enter or comma..."`), `size`, `allowDuplicates` (boolean, default false), `maxChips` (number, default 0 = unlimited)
- **Builder mapping:** our `chips` field_type → this type id; config keys `allow_duplicates` / `max_chips` → `allowDuplicates` / `maxChips`. Free-entry — unlike `tags_fixed`/`tags_async` (`RsTagPicker`), there is no option list.

> **`NpInput`** is registered by the host but **not exposed** as a builder field type — it duplicates `text`/`RsInput`. Use `text`. (Imported forms that happen to use `NpInput` still round-trip via `_raw`.)

## Table of contents

1. **§1–2 Components & Props** — every component, every prop, type + default (below)
2. **§3 [JSON Schema](#json-schema--persisted-form-structure)** — persisted form structure (`props`, `css`, `wrapperCss`, `events`, `schema`, `dataKey`)
3. **§4 [Events](#events)** — event props, lifecycle events, Actions
4. **§5 [Validation](#validation)** — `required`, `code`, `validateWhen`, validator resolution
5. **§6 [CSS System](#css-system--string-vs-object-duality)** — `css.any.string` vs `css.any.object` duality, `wrapperCss`, BiDi
6. **[Appendix A](#appendix-a--component-definition-dsl)** — the component-definition DSL reference

---

# §1–2 Components & Props

Grouped by category. Every declared prop, with type and default value.

## Fields
### Input — `RsInput`
- **Type id:** `RsInput` · **Category:** fields · **Underlying:** rsuite `Input` (wrapped in `InputGroup` when `passwordMask`) · **Kind:** component · **Value prop:** `value`
- **Description:** Single-line text input with label, type selection, and optional password mask toggle.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Input` | |
| placeholder | string | — | (from inputProps) |
| size | enum xs/sm/md/lg | md | (from inputProps) |
| disabled | boolean | false | (from inputProps) |
| readOnly | boolean | false | (from inputProps) |
| type | enum text/password/email/number/search/tel/url/time | text | |
| value | string | `''` (uncontrolled) | **valued**, uncontrolledValue `''` |
| passwordMask | boolean | false | renders eye toggle button |
| showPasswordAriaLabel | string | `Show password` | |

**Events:** `onChange`

### Text area — `RsTextArea`
- **Type id:** `RsTextArea` · **Category:** fields · **Underlying:** rsuite `Input` (`as="textarea"`) · **Kind:** component · **Value prop:** `value`
- **Description:** Multi-line text input with label.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Text area` | |
| value | string | `''` | **valued** |
| placeholder | string | — | |
| rows | number | 5 | positiveNumber (min 1) |
| size | enum xs/sm/md/lg | md | |
| disabled | boolean | false | |
| readOnly | boolean | false | |

**Events:** `onChange`, `onPressEnter`

### AutoComplete — `RsAutocomplete`
- **Type id:** `RsAutoComplete` · **Category:** fields · **Underlying:** rsuite `AutoComplete` · **Kind:** component · **Value prop:** `value`
- **Description:** Text input with auto-completion suggestions; has a custom icon.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| placeholder | string | — | (from inputProps) |
| size | enum xs/sm/md/lg | md | (from inputProps) |
| disabled | boolean | false | (from inputProps) |
| readOnly | boolean | false | (from inputProps) |
| label | string | `Input` | |
| data | array | `['Item1','Item2','Item3']` (labeled) | |
| defaultValue | string | — | |
| filterBy | fn | — | JS function editor `function filterBy(value, item)` returning boolean |
| menuClassName | string | — | |
| selectOnEnter | boolean | true | |
| value | string | `''` (uncontrolled) | **valued**, uncontrolledValue `''` |

**Events:** `onChange`, `onClose`, `onEnter`, `onEntering`, `onExit`, `onExited`, `onExiting`, `onSelect`

### Calendar — `RsCalendar`
- **Type id:** `RsCalendar` · **Category:** fields · **Underlying:** rsuite `Calendar` · **Kind:** component · **Value prop:** `value`
- **Description:** Inline calendar for date selection with label; suppresses `onChange` when read-only.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | — | |
| bordered | boolean | false | |
| compact | boolean | false | |
| defaultValue | date | — | |
| readOnly | boolean | false | |
| isoWeek | boolean | false | |
| value | date | — | **valued** |

**Events:** `onChange`, `onSelect`

### Checkbox — `RsCheckbox`
- **Type id:** `RsCheckbox` · **Category:** fields · **Underlying:** rsuite `Checkbox` (styled `SCheckbox` when it has label text) · **Kind:** component · **Value prop:** `checked`
- **Description:** Single checkbox; uses a styled variant showing required marker when `children` text is present.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| children | string | `Checkbox` | checkbox label text |
| checked | boolean | true (uncontrolled false) | **valued**, default true, uncontrolledValue false |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| indeterminate | boolean | — | |
| inline | boolean | false | |
| title | string | — | |

**Events:** `onChange`

### DatePicker — `RsDatePicker`
- **Type id:** `RsDatePicker` · **Category:** fields · **Underlying:** rsuite `DatePicker` · **Kind:** component · **Value prop:** `value`
- **Description:** Date/time picker with label; parses string values to Date and validates the format string.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Date` | |
| appearance | enum default/subtle | — | creatable:false |
| calendarDefaultDate | date | — | |
| cleanable | boolean | false | |
| defaultOpen | boolean | false | |
| defaultValue | date | — | |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| editable | boolean | true | |
| format | string | — | validated (INVALID_DATE_FORMAT); editor placeholder `yyyy-MM-dd` |
| isoWeek | boolean | false | |
| limitEndYear | number | — | |
| limitStartYear | number | — | |
| oneTap | boolean | — | |
| open | boolean | undefined | |
| placeholder | string | — | |
| placement | enum bottomStart/bottomEnd/topStart/topEnd/leftStart/rightStart/leftEnd/rightEnd | — | |
| preventOverflow | boolean | false | |
| showMeridiem | boolean | false | |
| showWeekNumbers | boolean | false | |
| size | enum xs/sm/md/lg | md | |
| value | date | — | **valued** |
| inline | (interface only, deprecated) | — | not in props DSL |

**Events:** `onChange`, `onChangeCalendarDate`, `onClean`, `onClose`, `onEnter`, `onEntered`, `onEntering`, `onExit`, `onExited`, `onExiting`, `onNextMonth`, `onOk`, `onOpen`, `onPrevMonth`, `onSelect`, `onToggleMonthDropdown`, `onToggleTimeDropdown`

### Dropdown — `RsDropdown`
- **Type id:** `RsDropdown` · **Category:** fields · **Underlying:** rsuite `InputPicker` · **Kind:** component · **Value prop:** `value`
- **Description:** Single-select dropdown with label, async data loading, search, and a loading spinner in the menu.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Select` | |
| value | string | — | **valued** (from pickerProps) |
| placeholder | string | — | (from pickerProps) |
| placement | enum bottomStart/bottomEnd/topStart/topEnd/leftStart/rightStart/leftEnd/rightEnd | — | (from pickerProps) |
| size | enum xs/sm/md/lg | md | (from pickerProps) |
| data | array | `['a','b','c']` (labeled) | overrides pickerProps default |
| cleanable | boolean | true | (from pickerProps) |
| creatable | boolean | false | (from pickerProps) |
| disabled | boolean | false | (from pickerProps) |
| readOnly | boolean | false | (from pickerProps) |
| groupBy | string | `''` | (from pickerProps) |
| disableVirtualized | boolean | — | (from pickerProps) |
| preload | boolean | false | |

**Events:** `onLoadData`, `onSelect`, `onClean`, `onClose`, `onCreate`, `onChange`, `onSearch` (all from pickerProps)
### Number format — `RsNumberFormat`
- **Type id:** `RsNumberFormat` · **Category:** Fields · **Underlying:** rsuite `Input` (via react-number-format `NumericFormat` + `WrappedInput`) · **Kind:** component · **Value prop:** `value`
- **Description:** Numeric input with thousands/decimal separators, prefix/suffix and formatting validation.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Number input` | Field label |
| value | number | — | **valued** (data-bound numeric value) |
| placeholder | string | — | from `...inputProps` |
| size | enum xs/sm/md/lg | md | from `...inputProps` |
| disabled | boolean | false | from `...inputProps` |
| readOnly | boolean | false | from `...inputProps` |
| allowedDecimalSeparators | array of string | — | accepted separators on input |
| allowLeadingZeros | boolean | false | |
| allowNegative | boolean | true | |
| decimalScale | number | — | editor hint `min: 0` (nonNegNumber) |
| decimalSeparator | string | — | validated; can't equal thousandSeparator |
| fixedDecimalScale | boolean | false | |
| prefix | string | — | |
| suffix | string | — | |
| thousandsGroupStyle | enum thousand/lakh/wan/none | none | |
| thousandSeparator | string | — | |

**Events:** `onChange` (emits `values.value`)

### Pattern format — `RsPatternFormat`
- **Type id:** `RsPatternFormat` · **Category:** Fields · **Underlying:** rsuite `Input` (via react-number-format `PatternFormat` + `WrappedInput`) · **Kind:** component · **Value prop:** `value`
- **Description:** Masked/pattern text input (e.g. phone, card) emitting the formatted value.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Formatted input` | Field label |
| value | string | — | **valued** (emits `values.formattedValue`) |
| placeholder | string | — | from `...inputProps` |
| size | enum xs/sm/md/lg | md | from `...inputProps` |
| disabled | boolean | false | from `...inputProps` |
| readOnly | boolean | false | from `...inputProps` |
| format | string | — | pattern (e.g. `#### #### ####`) |
| mask | string | — | numeric masks ignored with warning |
| patternChar | string | — | character used as the pattern placeholder |
| allowEmptyFormatting | boolean | false | |

**Events:** `onChange` (from `...inputProps`; component emits formatted value)

### Radio group — `RsRadioGroup`
- **Type id:** `RsRadioGroup` · **Category:** Fields · **Underlying:** rsuite `RadioGroup` (+ `Radio`) · **Kind:** component · **Value prop:** `value`
- **Description:** Group of mutually exclusive radio options.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| name | string | `RadioGroup` | HTML group name |
| appearance | enum default/picker | default | labeled Default/Picker; creatable:false |
| label | string | `Radio` | Field label |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| inline | boolean | false | lay out options horizontally |
| items | array | `[a, b, c]` (toLabeledValues) | option list; label falls back to value |
| value | string | — | **valued** |

**Events:** `onChange`

### Search — `RsSearch`
- **Type id:** `RsSearch` · **Category:** Fields · **Underlying:** rsuite `InputPicker` (custom caret hidden, search icon/loader) · **Kind:** component · **Value prop:** `value`
- **Description:** Searchable single-select input with async data loading; menu hidden when no data.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Search` | from `...pickerProps`, overridden default |
| value | string | — | **valued** (from pickerProps) |
| placeholder | string | `Search` | overridden default |
| placement | enum bottomStart/bottomEnd/topStart/topEnd/leftStart/rightStart/leftEnd/rightEnd | — | |
| size | enum xs/sm/md/lg | md | |
| data | array | — | option list |
| cleanable | boolean | true | |
| creatable | boolean | false | |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| groupBy | string | `` (empty) | group options by field |
| disableVirtualized | boolean | — | |
| preload | boolean | false | preload data on mount |

**Events:** `onLoadData`, `onSelect`, `onClean`, `onClose`, `onCreate`, `onChange`, `onSearch` (all from `...pickerProps`)

### TagPicker — `RsTagPicker`
- **Type id:** `RsTagPicker` · **Category:** Fields · **Underlying:** rsuite `TagPicker` · **Kind:** component · **Value prop:** `value`
- **Description:** Multi-select tag input bound to a string array.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Select` | from pickerProps, overridden default |
| value | array of string | — | **valued** (`array.valued.ofString`) |
| placeholder | string | — | from pickerProps |
| placement | enum bottomStart/bottomEnd/topStart/topEnd/leftStart/rightStart/leftEnd/rightEnd | — | from pickerProps |
| size | enum xs/sm/md/lg | md | from pickerProps |
| data | array | `[a, b, c]` (toLabeledValues) | options; empty values coerced to `''` |
| cleanable | boolean | true | from pickerProps |
| creatable | boolean | false | from pickerProps |
| disabled | boolean | false | from pickerProps |
| readOnly | boolean | false | from pickerProps |
| groupBy | string | `` (empty) | from pickerProps |

**Events:** `onSelect`, `onClean`, `onClose`, `onCreate`, `onChange`, `onSearch` (from pickerProps; `disableVirtualized` and `onLoadData` are removed from the spread)

### TimePicker — `RsTimePicker`
- **Type id:** `RsTimePicker` · **Category:** Fields · **Underlying:** rsuite `DatePicker` (time-only, `preventOverflow`) · **Kind:** component · **Value prop:** `value`
- **Description:** Time selection field bound to a formatted time string (parsed/formatted via date-fns).

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | `Time` | Field label |
| placeholder | string | — | |
| value | time | — | **valued** (string time) |
| defaultValue | time | — | uncontrolled fallback |
| format | string | `HH:mm` | validated (`INVALID_TIME_FORMAT`); editor placeholder `HH:mm` |
| editable | boolean | true | |
| cleanable | boolean | false | |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| open | boolean | — | forces panel open when true |
| placement | enum bottomStart/bottomEnd/topStart/topEnd/leftStart/rightStart/leftEnd/rightEnd | — | |
| size | enum xs/sm/md/lg | md | |

**Events:** `onChange`, `onClean`, `onClose`, `onEnter`, `onEntered`, `onEntering`, `onExit`, `onExited`, `onExiting`, `onOk`, `onOpen`, `onSelect`

### Toggle — `RsToggle`
- **Type id:** `RsToggle` · **Category:** Fields · **Underlying:** rsuite `Toggle` (styled, supports required marker) · **Kind:** component · **Value prop:** `checked`
- **Description:** On/off switch bound to a boolean.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| children | string | — | label text next to toggle |
| checked | boolean | true | **valued**; uncontrolled initial value `false` (`.uncontrolledValue(false)`) |
| checkedChildren | string | — | content shown in "on" state |
| unCheckedChildren | string | — | content shown in "off" state |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| size | enum sm/md/lg | md | labeled Small/Medium/Large; creatable:false (no xs) |
| color | enum red/orange/yellow/green/cyan/blue/violet | — | controlColor; creatable:false |
| loading | boolean | false | |

**Events:** `onChange`

### Uploader — `RsUploader`
- **Type id:** `RsUploader` · **Category:** Fields · **Underlying:** rsuite `Uploader` · **Kind:** component · **Value prop:** `fileList`
- **Description:** File upload field; single-file mode auto-disables the button once a file is present.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | — | Field label |
| action | string | `/` | upload endpoint |
| accept | string | — | accepted file types |
| autoUpload | boolean | true | |
| customElement | boolean | false | render `children` as trigger when true |
| children | ReactNode | — | node slot (custom trigger) |
| disableMultipart | boolean | false | |
| disabled | boolean | false | |
| readOnly | boolean | false | |
| disabledFileItem | boolean | false | |
| draggable | boolean | false | |
| fileListVisible | boolean | true | |
| listType | enum text/picture-text/picture | — | creatable:false |
| method | string | — | HTTP method |
| multiple | boolean | false | |
| name | string | — | form field name |
| removable | boolean | false | |
| timeout | number | — | editor hint `min: 0` (nonNegNumber) |
| withCredentials | boolean | false | |
| fileList | array | — | **valued**; editor hint `columns` = name/fileKey/url (InputCell) |

**Events:** `onChange`, `onError`, `onPreview`, `onProgress`, `onRemove`, `onReupload`, `onSuccess`, `onUpload`

## Static

### Button — `RsButton`
- **Type id:** `RsButton` · **Category:** static · **Underlying:** rsuite `Button` · **Kind:** component · **Value prop:** —
- **Description:** A clickable button rendering custom text content.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| active | boolean | false | |
| appearance | enum (default, primary, link, subtle, ghost) | default | editor: creatable false |
| children | string | "Button" | required, data-bound; rendered as button content via `useBuilderValue` |
| color | enum (red, orange, yellow, green, cyan, blue, violet) | — | from `controlColor`; editor: creatable false |
| disabled | boolean | false | |
| href | string | — | |
| loading | boolean | false | |
| size | enum xs/sm/md/lg | md | labeled Extra small/Small/Medium/Large; editor: creatable false |

**Events:** onClick

### Divider — `RsDivider`
- **Type id:** `RsDivider` · **Category:** static · **Underlying:** rsuite `Divider` · **Kind:** component · **Value prop:** —
- **Description:** A horizontal or vertical divider line, optionally with text.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| children | string | — | optional divider text |
| vertical | boolean | — | |

**Events:** —

### Error message — `RsErrorMessage`
- **Type id:** `RsErrorMessage` · **Category:** static · **Underlying:** rsuite `Form.ErrorMessage` · **Kind:** component · **Value prop:** —
- **Description:** Displays a form validation error message around its child content.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| placement | enum (bottomStart, bottomEnd, topStart, topEnd, leftStart, rightStart, leftEnd, rightEnd) | bottomStart | from `placement` |
| className | string | — | |

**Events:** —

### Header — `RsHeader`
- **Type id:** `RsHeader` · **Category:** static · **Underlying:** native heading element (`h1`–`h6` via `createElement`) · **Kind:** component · **Value prop:** —
- **Description:** A heading element with configurable text, level, and text styling.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| content | string | "Header" | required, data-bound; rendered via `useBuilderValue` |
| headerSize | enum h1/h2/h3/h4/h5/h6 | h4 | editor: creatable false; selects the heading tag |

**CSS props:** backgroundColor → color; textAlign → enum (start, center, end) default start (radio); color → color

**Events:** —

### Image — `RsImage`
- **Type id:** `RsImage` · **Category:** static · **Underlying:** native `img` (styled, 100% w/h) · **Kind:** component · **Value prop:** —
- **Description:** Displays an image with configurable source, alt text, and fit/position styling.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| src | string | inline logo SVG (data URI) | required, data-bound; rendered via `useBuilderValue` |
| alt | string | "Image" | |

**CSS props:** objectPosition → enum (top, bottom, left, right, center) default left; objectFit → enum (contain, cover, fill, none, scale-down) default scale-down (editor: creatable false)

**Events:** —

### Label — `RsLabel`
- **Type id:** `RsLabel` · **Category:** static · **Underlying:** native `label` · **Kind:** component · **Value prop:** —
- **Description:** A text label element.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| text | string | "Label" | data-bound; rendered via `useBuilderValue` |

**CSS props (textStyles):** textAlign → enum (start, center, end) default start (radio); fontSize → number (min 0) default 14; fontWeight → enum (lighter, normal, bold) default normal; color → color

**Events:** — (componentRole: 'label')

### Link — `RsLink`
- **Type id:** `RsLink` · **Category:** static · **Underlying:** native `a` (anchor) · **Kind:** component · **Value prop:** —
- **Description:** An anchor link rendering either text or custom child content, with optional download.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| content | enum (text, custom) | text | radio; chooses text vs children rendering |
| text | string | "Link" | shown when content = text |
| href | string | — | |
| children | node | — | ReactNode slot, shown when content = custom |
| target | enum (_self, _blank, _parent, _top, _unfencedTop) | _blank | editor: creatable false |
| download | boolean | false | |
| downloadFilename | string | — | overrides download attribute when set |

**CSS props (textStyles):** textAlign → enum (start, center, end) default start (radio); fontSize → number (min 0) default 14; fontWeight → enum (lighter, normal, bold) default normal; color → color

**Events:** onClick
### Menu — `RsMenu`
- **Type id:** `RsMenu` · **Category:** static · **Underlying:** rsuite `Nav` · **Kind:** component · **Value prop:** —
- **Description:** Navigation menu rendering a list of items (title + href) as `Nav.Item`, with selection tracking the active key.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| activeKey | string | `Home` | From `navProps`, default overridden. Active item determined by matching `title === activeKey`; updated internally on select. |
| appearance | enum: default, tabs, subtle, pills | `default` | From `navProps`. Editor: creatable=false. |
| items | array | `[{title:'Home',href:'#Home'},{title:'News',href:'#News'},{title:'Products',href:'#Products'}]` | Each item `{title, href}`. Editor columns: title (Input), href titled "Url" (Input). Renders null if empty. |
| justified | boolean | `false` | From `navProps`. |
| reversed | boolean | `false` | From `navProps`. |
| vertical | boolean | `false` | From `navProps`. |
| itemsAs | enum (HTML element tags) | `a` | Element type for each item: a, button, div, span, h1–h6, p, b, em, i, q, s, u, input, label, section, article, nav, pre. Labeled same as values. Editor: creatable=false. |

**Events:** onSelect (from `navProps`; fires with eventKey/event, also stores activeKey internally).

### Message — `RsMessage`
- **Type id:** `RsMessage` · **Category:** static · **Underlying:** rsuite `Message` (styled `SMessage`) · **Kind:** component · **Value prop:** —
- **Description:** Contextual feedback message banner with optional header, closable control, and severity type.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| children | node | — | ReactNode slot for message body. |
| closable | boolean | `false` | Shows close button. |
| header | node | — | ReactNode slot for header (styled with `overflow: initial`). |
| type | enum: info, success, warning, error | `info` | Editor: creatable=false. |

**Events:** —

### Placeholder — `RsPlaceholderGraph` / `RsPlaceholderGrid` / `RsPlaceholderParagraph`
- **Type id:** `RsPlaceholderGraph`, `RsPlaceholderGrid`, `RsPlaceholderParagraph` · **Category:** static · **Underlying:** rsuite `Placeholder.Graph` / `Placeholder.Grid` / `Placeholder.Paragraph` · **Kind:** component · **Value prop:** —
- **Description:** Loading skeleton placeholders (graph block, grid lines, or paragraph) — three separate registered components, each with a custom SVG icon.

**`RsPlaceholderGraph`** (name "Placeholder graph"):

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| width | enum size (xs/sm/md/lg) | `100%` | Default is string `'100%'` (not a size enum value). |
| height | number | `200` | |
| active | boolean | — | Animated shimmer when true. |

**`RsPlaceholderGrid`** (name "Placeholder grid"):

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| rows | number | `5` | |
| columns | number | `5` | |
| rowHeight | number | `10` | |
| rowSpacing | number | `20` | |
| active | boolean | — | |

**`RsPlaceholderParagraph`** (name "Placeholder paragraph"):

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| rows | number | `2` | |
| rowHeight | number | `10` | |
| rowSpacing | number | `20` | |
| graph | enum: circle, square, image | — | Optional leading graph shape. Editor: creatable=false. |
| active | boolean | — | |

**Events:** —

### Progress — `RsProgressCircle` / `RsProgressLine`
- **Type id:** `RsProgressCircle`, `RsProgressLine` · **Category:** static · **Underlying:** rsuite `Progress.Circle` / `Progress.Line` · **Kind:** component · **Value prop:** `percent` (dataBound)
- **Description:** Progress indicators (circular or linear), sharing common percent/status props — two separate registered components.

**Common props (both):**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| classPrefix | string | `progress` | |
| percent | number | `50` | Data-bound. Editor: min 0, max 100. |
| showInfo | boolean | `true` | |
| status | enum: success, fail, active | `active` | Editor: creatable=false. |
| strokeColor | color(string) | — | |
| strokeWidth | number | — | Overridden to default `6` for Circle. |

**`RsProgressCircle`** (name "Progress circle") adds:

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| gapDegree | number | — | Editor: min 0, max 360. |
| gapPosition | enum: right, top, bottom, left | `top` | Editor: creatable=false. |
| strokeLinecap | enum: round, square, butt | `round` | Editor: creatable=false. |
| strokeWidth | number | `6` | |
| trailColor | color(string) | — | |
| trailWidth | number | `6` | |

**`RsProgressLine`** (name "Progress line") adds:

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| vertical | boolean | `false` | |

**Events:** —

### Static content — `RsStaticContent`
- **Type id:** `RsStaticContent` · **Category:** static · **Underlying:** custom (`<span>`) · **Kind:** component · **Value prop:** —
- **Description:** Renders text or raw HTML inside a span; content is resolved via builder value and can optionally be injected as HTML.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| content | string | `Text...` | Required, data-bound. Resolved through `useBuilderValue`; default fallback `'Text...'`. |
| allowHtml | boolean | `false` | When true, content is rendered via `dangerouslySetInnerHTML`; otherwise as plain text. |

**Events:** —

### Tooltip — `RsTooltip`
- **Type id:** `RsTooltip` · **Category:** static · **Underlying:** rsuite `Whisper` + `Tooltip` · **Kind:** component (wrapper) · **Value prop:** —
- **Description:** Wraps child content in a `Whisper`/`Tooltip` overlay showing tooltip text on the configured trigger; `componentRole('tooltip')`.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| text | string | `Tooltip message...` | Required, data-bound. Shown as tooltip body. |
| children | node | — | ReactNode slot wrapped (full width/height div); renders null if absent. |
| placement | enum: top, bottom, right, left, bottomStart, bottomEnd, topStart, topEnd, leftStart, rightStart, leftEnd, rightEnd, auto, autoVertical, autoVerticalStart, autoVerticalEnd, autoHorizontal, autoHorizontalStart | `bottom` | Required. Editor: creatable=false. |
| trigger | multi-enum: click, hover, focus, active, contextMenu | `['hover']` | Required (`someOf`). |

**Events:** —

## Structure & Modal

### Breadcrumb — `RsBreadcrumb`
- **Type id:** `RsBreadcrumb` · **Category:** structure · **Underlying:** rsuite `Breadcrumb` · **Kind:** component · **Value prop:** —
- **Description:** Navigation breadcrumb rendered from an array of item objects, each mapped to a `Breadcrumb.Item`.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| separator | string | "/" | Separator between items. |
| maxItems | number | — | `nonNegNumber` (min 0). Max items shown before collapse. |
| items | array | `[{title:'one',href:'one'},{...'two'},{...'three'}]` | Item objects; editor columns: `title` (InputCell), `href`/"Url" (InputCell), `active` (CheckCell). Each item: `{active?, href?, title?}`. |
| onItemClick | event | — | Fires with clicked item. |
| onExpand | event | — | Fires on expand. |
| justifyContent (css) | enum left/center/right | "left" | `.radio()`, named "Alignment". CSS group. |

**Events:** onItemClick, onExpand

---

### Card — `RsCard`
- **Type id:** `RsCard` · **Category:** structure · **Underlying:** rsuite `Panel` · **Kind:** component (NOT `.kind('container')`, but exposes `children`/`header` node slots) · **Value prop:** —
- **Description:** Collapsible panel card; renders a header built from `title` (via RsHeader) plus a `header` node slot, and a `children` body slot.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| header | node | — | CHILD SLOT — extra header content (rendered after title). |
| children | node | — | CHILD SLOT — card body. |
| title | string | "Title" | Rendered as RsHeader at `headerSize`. |
| headerSize | enum h1..h6 | "h4" | `creatable:false`. |
| bodyFill | boolean | false | Panel body fills container. |
| bordered | boolean | true | |
| shaded | boolean | true | |
| defaultExpanded | boolean | false | |
| collapsible | boolean | false | |
| eventKey | string | — | |
| onSelect | event | — | |

**Events:** onSelect

---

### Container — `RsContainer`
- **Type id:** `RsContainer` · **Category:** structure · **Underlying:** styled `div` (flex column) · **Kind:** container (`.kind('container')`) · **Value prop:** —
- **Description:** Generic flex container holding arbitrary child components.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| children | node | — | CHILD SLOT — container contents. |
| disabled | boolean | — | `disabled` prop (stripped before render). |
| readOnly | boolean | — | `readOnly` prop (stripped before render). |
| flexDirection (css) | (containerStyles) | "column" | CSS group via `...containerStyles`. |
| gap (css) | (containerStyles) | "10px" | CSS group. |
| ...containerStyles (css) | — | — | Spread layout CSS props. |

**Events:** —

---

### Repeater — `Repeater`
- **Type id:** `Repeater` (NOT `RsRepeater` — it is a core/structure component, not an rsuite wrapper) · **Category:** structure · **Underlying:** core `Repeater` (`features/repeater/repeaterModel.tsx`) · **Kind:** `repeater` · **Value prop:** `value` · **Value type:** `array`
- **Description:** Renders an **array of repeating rows**. Its `children` are a **row template** (a `RepeaterItem`), instantiated once per element of the bound array. Each instance runs in its own **data context** scoped to that array element, so child components bind with **relative** dataKeys. The canonical way to model dynamic/editable tables.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| value | array | — | The bound array. As a node it is set via the node-level **`dataKey`** (the array lives at `form.data.<dataKey>`); `props.value` supplies the **initial** array when data is empty (e.g. `{ "value": [{}] }`). Valued annotation editor: `arrayOfObject`. |
| children | node | — | CHILD SLOT — the **row template**, rendered per element. |
| itemRenderWhen | string | — | Optional per-row conditional-render expression (`string.notLocalize`), evaluated in each row's data context. |
| flexDirection (item css) | (containerStyles) | "column" | **Item** layout = the node's **`css`** (decorates each row). Default item direction column, gap 20px. |
| flexDirection (wrapper css) | (containerStyles) | "column" | **Wrapper** layout = the node's **`wrapperCss`** (decorates the container that stacks the rows). Default column, gap 20px. |

- **Style mapping (important):** `repeaterModel` registers `repeaterItemCss` as the default **`css`** and `repeaterWrapperCss` as the default **`wrapperCss`**. So the node's `css` styles **each row**; its `wrapperCss` styles the **gap/direction between rows**. (For a table-like row, either set `css` → `flexDirection:row`, or — more robustly — make the template a single inner `RsContainer` with `flexDirection:row` and put the columns in it.)
- **Feature:** `cfSkipChildrenDuringFieldCollection = true` — template children are NOT collected as top-level form fields; they exist only per row.

**Data shape.** A repeater with `dataKey: "charge_mix"` and template children `material`, `qty` produces:
```json
{ "charge_mix": [ { "material": "pig_iron", "qty": 120 }, { "material": "scrap", "qty": 80 } ] }
```
Children use **relative** dataKeys (`material`, `qty`) — never `charge_mix__0__material`. Repeaters **nest**: a template child can itself be a `Repeater` (e.g. `samples[].readings[]`), giving arrays of objects containing arrays.

**Add / remove rows — built-in `common` actions** (`features/event/consts/repeaterActions.ts`, registered in `commonActions` as `addRow`/`removeRow`). Wire them as events with `type: "common"` — **no custom code action required**:

| Action | Args | Behaviour |
|--------|------|-----------|
| `addRow` | `dataKey: string`, `max?: number`, `rowData?: string` (JSON), `index?: number` | If `dataKey` given, pushes onto `e.data[dataKey]`; else resolves the **parent repeater key** and pushes onto `e.parentData`. New row = `JSON.parse(rowData) ?? {}`. No-op once length ≥ `max`. `index` inserts at position (else append). |
| `removeRow` | `index?: number`, `min?: number`, `dataKey?: string` | `index` defaults to `e.index` (the firing row), else `-1` (last). If `dataKey` given, removes from `e.data[dataKey]`; else resolves parent repeater key and removes from `e.parentData`. No-op once length ≤ `min`. |

- **Placement convention:** the **Add** button is a **sibling after** the repeater (its `e.data` is the repeater's parent scope) → pass `args.dataKey` = the array key. A per-row **Remove** button lives **inside** the template → needs **no args** (`removeRow` auto-resolves the row's repeater + `e.index`). For a **nested** add button placed inside an outer row, `e.data` is that row object, so `args.dataKey` = the inner (relative) array key writes into `row[dataKey]`.
- **`ActionEventArgs` members for rows:** `e.index` (nearest array index), `e.parentData` (the array's owning object), `e.data` (this context's data), `e.rootData` (whole form). See §Events / "Context an action receives".

**Computed props inside a repeater.** Computed props (`{ computeType:"function", fnSource }`) are compiled `new Function('form', fnSource)` (`features/calculation/propertyCalculator.ts`) where `form` is an `IFormData`. Crucially, `form.data` is **scoped to the component's data context**:
- A computed prop on a **row child** sees the **row**: `return (Number(form.data.qty)||0) * (Number(form.data.rate)||0);`
- A computed prop **outside** the repeater sees root data → aggregate the whole array: `return (form.data.charge_mix||[]).reduce((s,r)=>s+(Number(r.qty)||0)*(Number(r.rate)||0),0);`
- Also available: `form.parentData` (array-element parent) and `form.rootData` (always the form root).

**Minimal serialized example** (one column + add/remove):
```jsonc
{ "key": "charge_mix", "type": "Repeater", "dataKey": "charge_mix",
  "props": { "value": { "value": [ { "material": "" } ] } },
  "wrapperCss": { "any": { "object": { "flexDirection": "column", "gap": "8px" } } },
  "children": [
    { "key": "row", "type": "RsContainer",
      "css": { "any": { "object": { "flexDirection": "row", "gap": "10px", "alignItems": "center" } } },
      "children": [
        { "key": "material", "type": "RsInput", "dataKey": "material", "props": { "label": { "value": "" } } },
        { "key": "del", "type": "RsButton", "props": { "children": { "value": "×" } },
          "events": { "onClick": [ { "name": "removeRow", "type": "common", "args": { "min": 1 } } ] } }
      ] }
  ] }
// sibling Add button:
{ "key": "charge_mix_add", "type": "RsButton", "props": { "children": { "value": "+ Add Row" } },
  "events": { "onClick": [ { "name": "addRow", "type": "common", "args": { "dataKey": "charge_mix", "max": 15 } } ] } }
```

> **Version note:** the contract above was read from optimajet `formengine` community `core` **9.0.0** (local checkout) and **confirmed rendering on the target `@react-form-builder` 7.9.0 runtime** — the `Repeater` type-id, relative child binding, computed props, and the `addRow`/`removeRow` `common` actions all work there. This is what the builder's table export now emits.

---

### Tab — `RsTab`
- **Type id:** `RsTab` · **Category:** structure · **Underlying:** rsuite `Nav` (styled) · **Kind:** component (NOT container; exposes a single `pane` node slot, not nodeArray) · **Value prop:** — (writes `activeKey` to `userDefinedProps`, not data-bound)
- **Description:** Tab navigation bar; `items` render `Nav.Item` buttons and a single `pane` slot shows content conditional on `activeKey`.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| activeKey (navProps) | string | "Item1" | Active tab key. |
| appearance (navProps) | enum default/tabs/subtle/pills | "default" | `creatable:false`. |
| items | array | `toLabeledValues(['Item1','Item2','Item3'])` | Overrides navProps.items default; each item `{label,value}`. |
| justified (navProps) | boolean | false | |
| reversed (navProps) | boolean | false | |
| vertical (navProps) | boolean | false | |
| onSelect (navProps) | event | — | |
| showNavigation | boolean | true | When true renders the nav bar. |
| pane | node | — | CHILD SLOT — `.calculable(false)`; `withSlotConditionBuilder` shows pane only when `parentProps.activeKey === item value`. |

**Events:** onSelect

---

### Wizard — `RsWizard`
- **Type id:** `RsWizard` · **Category:** structure · **Underlying:** styled `div` (Rows) + rsuite `Steps`/`Button`/`ButtonToolbar` · **Kind:** component (NOT `.kind('container')`; holds `children` as `nodeArray` of RsWizardStep) · **Value prop:** `activeIndex` (`.valued`)
- **Description:** Multi-step wizard; children are RsWizardStep containers, one shown per `activeIndex`, with Prev/Next/Finish buttons and optional Steps header. Custom icon, `initialJson` seeds 3 steps, has `eventListeners`.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| activeIndex | number | 0 | `.valued` (data-bound value prop). Editor min 0 / max children−1 via `calculateEditorProps`. |
| stepsNavigation | enum disable/onlyVisited/any | "onlyVisited" | Labeled Disable/Only visited/Any; `creatable:false`. Gates clickable steps. |
| steps | array | `[]` | Editor-only step labels; `editorProps` provide onAdd/onRemove/columns(`label`→InputCell)/calculateEditorProps syncing child step labels. |
| children | nodeArray | — | CHILD SLOT (array) — `withInsertRestriction`: only `RsWizardStep` children allowed. |
| prevButtonLabel | string | "Previous" | |
| nextButtonLabel | string | "Next" | |
| finishButtonLabel | string | "Finish" | Next button disabled if on last step and finish label == next label. |
| showSteps | boolean | true | Show Steps header. |
| showStepsLabels | boolean | true | Show labels on steps. |
| verticalSteps | boolean | false | Vertical Steps layout. |
| validateOnNext | boolean | true | Validates current child before advancing. |
| validateOnFinish | boolean | true | Validates whole component before finish. |
| onNext | event | — | |
| onPrev | event | — | |
| onFinish | event | — | |

**Events:** onNext, onPrev, onFinish (also internal onChange). **eventListeners.onSelectNode**: selecting a descendant node sets wizard value to that step's index (auto-navigates to the step containing the selected node in the builder).

#### Wizard step — `RsWizardStep` (child of RsWizard)
- **Type id:** `RsWizardStep` · **Category:** structure · **Underlying:** styled `div` (flex) · **Kind:** container (`.kind('container')`) · **Value prop:** —
- **Description:** Single wizard step container; insert-restricted to a `RsWizard` parent.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| label | string | "Step" | Step title (synced with wizard `steps` editor). |
| children | node | — | CHILD SLOT — step contents. |
| flexDirection (css) | (containerStyles) | "column" | CSS group. |
| gap (css) | (containerStyles) | "10px" | CSS group. |

**Events:** — · `insertRestriction`: parent type must be `RsWizard`.

---

### Modal — `RsModal`
- **Type id:** `RsModal` · **Category:** modal · **Underlying:** rsuite `Modal` · **Kind:** component (renders `children`; `componentRole('modal')`, `hideFromComponentPalette()`) · **Value prop:** —
- **Description:** Overlay dialog wrapper; merges custom `handleClose` with `onClose`. Not shown in palette (role-managed modal).

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| autoFocus | boolean | true | |
| backdrop | boolean | true | |
| backdropClassName | string | — | |
| classPrefix | string | — | |
| dialogClassName | string | — | |
| enforceFocus | boolean | true | |
| keyboard | boolean | true | Close on Esc. |
| overflow | boolean | true | |
| size | enum xs/sm/md/lg/full | "md" | Local `modalSize` (adds "full"); labeled Extra small/Small/Medium/Large/Full. |
| onOpen | event | — | |
| onClose | event | — | |

**Events:** onOpen, onClose

---

### Modal layout — `RsModalLayout`
- **Type id:** `RsModalLayout` · **Category:** modal · **Underlying:** rsuite `Modal.Header`/`Title`/`Body`/`Footer` inside a `div` · **Kind:** component (three node slots: headerTitle, body, footer) · **Value prop:** —
- **Description:** Layout scaffold for modal contents with header-title, body, and footer slots.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| closeButton | boolean | true | Passed to `Modal.Header`. |
| headerTitle | node | — | CHILD SLOT — header title content. |
| body | node | — | CHILD SLOT — modal body. |
| footer | node | — | CHILD SLOT — modal footer. |

**Events:** —


---

## JSON Schema — Persisted Form Structure

The persisted form is the serialized form definition produced/consumed by FormEngine's Form Builder. It is described authoritatively by the generated JSON Schema at `public/schemas/persisted-form.schema.json` (Draft-07, title `FormEngine's Form Schema`), which is generated by `scripts/json-schema/generator.ts` from the TypeScript type `PersistedForm` (entry `src/index.ts`) using `ts-json-schema-generator`, then patched by `scripts/json-schema/post-processor.ts`.

The TypeScript source of truth:
- Top-level: `src/stores/PersistedForm.ts` (interface `PersistedForm`)
- Per-node: `src/stores/ComponentStore.ts` (class `ComponentStore`)
- CSS: `src/features/style/types.ts` (`Css`, `DeviceStyle`)
- Events/actions: `src/features/event/types.ts`
- Validation: `src/features/validation/types/BoundValueSchema.ts`, `ValidationRuleSettings.ts`, `ValidatorType.ts`
- Localization: `src/features/localization/types.ts`, `language.ts`

### How the schema is generated

`generator.ts` invokes `ts-json-schema-generator` on type `PersistedForm` with `jsDoc: 'extended'` (JSDoc comments become `description` fields). `post-processor.ts` then:
- Sets `title` to `FormEngine's Form Schema`.
- Replaces `ActionDefinition` references with a hand-written `PersistedActionDefinition` definition (`{body?: string, params: ActionParameters}`) and deletes the original `ActionDefinition` and `Func` definitions — i.e. the persisted action stores only source `body` + `params`, not the runtime function.
- Strips internal `__@KeySymbol…` properties from `ActionData` (the `KeySymbol` action key is runtime-only, never persisted).
- Coerces `ComponentStore.disableDataBinding` to a `ComponentProperty` ref.
- Adds missing descriptions and removes `LocalizationValue.examples`.
`verifySchema` only logs missing descriptions; it does not alter shape.

---

## 1. Top-level persisted form object (`PersistedForm`)

Required fields: `form`, `localization`, `languages`, `defaultLanguage`. All others optional.

| Field | Type | Req | Meaning |
|---|---|---|---|
| `version` | `"1"` (string const; `PersistedFormVersion.version1`) | no | Schema version of the saved form. Currently always `"1"`. |
| `actions` | `ActionValues` = `Record<string, PersistedActionDefinition>` | no | Named action definitions referenced by component events. Key = action name. |
| `formValidator` | `string` | no | The form validator (name/source of a form-level validator). |
| `errorProps` | `any` | no | Properties of the component that displays validation errors. |
| `modalType` | `string` | no | Name of the component type used to render modals. |
| `tooltipType` | `string` | no | Name of the component type used to render tooltips. |
| `errorType` | `string` | no | Name of the component type used to render the error display. |
| `form` | `ComponentStore` | **yes** | The root component node of the form's component tree (see §2). The entire form is a single `ComponentStore` whose `children` form the tree. |
| `localization` | `LocalizationValue` | **yes** | All localized strings, keyed by language → component key → type → property (see §4). |
| `languages` | `Language[]` | **yes** | The list of languages configured for the form (see below). |
| `defaultLanguage` | `string` | **yes** | The default language (full code, e.g. `en-US`). |

Note: there is no separate `tree` field — the tree IS `form` plus nested `children`. There is no top-level `defaultLocalization` field; default-language strings live inside `localization` under the default language's full code.

### `PersistedActionDefinition` (entries of `actions`)
| Field | Type | Req | Meaning |
|---|---|---|---|
| `body` | `string` | no | Source code of the action function. |
| `params` | `ActionParameters` = `Record<string, "string"\|"number"\|"boolean"\|"function">` | **yes** | Declared parameter names → parameter type. |

### `Language` (entries of `languages`)
| Field | Type | Req | Meaning |
|---|---|---|---|
| `code` | `string` | yes | Language code, e.g. `en`. |
| `dialect` | `string` | yes | Dialect code, e.g. `US`. |
| `name` | `string` | yes | Language name, e.g. `English`. |
| `description` | `string` | yes | Description, e.g. `American English`. |
| `bidi` | `BiDi` = `"ltr" \| "rtl"` | yes | Text layout direction. |

Full language code (used as localization key) = `` `${code}-${dialect}` `` (e.g. `en-US`).

---

## 2. Per-node component object (`ComponentStore`)

Each node of the form tree is a `ComponentStore`. Required: `key`, `type`, `props`. The class defaults `key=''`, `type=''`, `props={}`. Deserialization uses `ComponentStore.createFromObject` (`Object.assign(new ComponentStore(key,type), value)`), then re-initializes runtime action keys.

| Field | Type | Req | Meaning |
|---|---|---|---|
| `key` | `string` | **yes** | Unique React component key — node identity within the form. Also used as a localization key and as the default `dataKey`. |
| `type` | `string` | **yes** | The component type name (which registered component renders this node). |
| `props` | `Record<string, ComponentProperty>` | **yes** | Component property values, keyed by property name (see §3 / `ComponentProperty`). |
| `dataKey` | `string` | no | Data-binding key (value path). Controls where the node's value is read/written in form data. If omitted, the binding key defaults to `key` (helper `dataKey(store)` returns `store.dataKey ?? store.key`). |
| `css` | `Css` | no | Component CSS styles, per device (see §5). |
| `wrapperCss` | `Css` | no | CSS styles for the component's wrapper element (same shape as `css`). |
| `style` | `ComponentStyle` | no | Inline `style` attribute values, per device (`{any?,mobile?,tablet?,desktop?}` of `{string?: string}`). |
| `wrapperStyle` | `ComponentStyle` | no | Inline `style` attribute values for the wrapper element. |
| `events` | `Record<EventName, ActionData[]>` | no | Event handlers: map of event name → ordered list of actions to run (see §6). |
| `children` | `ComponentStore[]` | no | Child component nodes (recursive). Forms the tree. |
| `schema` | `BoundValueSchema` | no | Validation settings for this node's bound value (see §6). |
| `htmlAttributes` | `HtmlAttribute[]` = `Array<Record<string,string>>` | no | Arbitrary extra HTML attributes added to the rendered element. |
| `tooltipProps` | `Record<string, ComponentProperty>` | no | Property values for the node's tooltip component. |
| `modal` | `ModalComponentStore` = `{props: Record<string,ComponentProperty>, events?: Record<EventName, ActionData[]>}` | no | Settings for the node's modal. |
| `slot` | `string` | no | Name of the parent property/slot this child occupies (how a child is placed into a named slot rather than the default children area). |
| `slotCondition` | `string` | no | Condition expression for binding this child to a particular parent slot. |
| `renderWhen` | `ComponentProperty` | no | Expression/function controlling conditional rendering of the node. |
| `disableDataBinding` | `ComponentProperty<boolean>` | no | When true, disables data binding for this node. |

### How `props` maps to property values
`props` is keyed by the component's property name. Each value is a `ComponentProperty` (§3). The runtime resolves each entry to a concrete prop:
- A static value comes from `value`.
- A computed value comes from `fnSource` when `computeType === "function"`.
- A localized value is resolved from the localization tables when `computeType === "localization"` (the stored `value` is then a localization lookup; the actual string lives in `PersistedForm.localization[lang][key].component[propName]`).

### How `children` / slots are represented
The tree is nested purely via the `children: ComponentStore[]` array on each node. Slot placement is expressed on the child via `slot` (the name of the parent property the child fills) and optionally `slotCondition`. So a parent does not embed children inside its `props`; children are always in `children`, and `slot`/`slotCondition` describe which parent region each child belongs to.

### How `dataKey` controls binding / value path
`dataKey` is the key under which this node's value is stored in the form's data object (the value path). When absent, the system falls back to `key` (`dataKey()` helper). `disableDataBinding=true` turns off binding entirely for the node.

---

## 3. Component property value (`ComponentProperty<T>`)

Used by `props`, `tooltipProps`, `modal.props`, `renderWhen`, `disableDataBinding`, and `validateWhen`.

| Field | Type | Meaning |
|---|---|---|
| `value` | `T` (any; `boolean` for `disableDataBinding`) | The simple/static value. |
| `fnSource` | `string` | Source code of a function that computes the value. |
| `computeType` | `"function" \| "localization"` | How the value is computed. If absent, `value` is used as-is. `function` → use `fnSource`; `localization` → resolve from localization tables. |
| `editorType` | `string` | Property editor type — **Designer-mode only** metadata. |

---

## 4. Localization (`localization`)

Nested record, all string-keyed:

`LocalizationValue` = `Record<LanguageFullCode, ComponentsLocalization>`
→ `ComponentsLocalization` = `Record<ComponentKey, TypedLocalization>`
→ `TypedLocalization` = `Partial<Record<LocalizationType, ComponentPropsLocalization>>`
→ `ComponentPropsLocalization` = `Record<ComponentPropertyName, string>`

- `LanguageFullCode`: full code like `"en-US"`.
- `ComponentKey`: the component node's `key`.
- `LocalizationType`: `"component" | "tooltip" | "modal"` (or any string).
- Leaf: property name → localized string (e.g. `"This {$value} is localized!"`).

A node's property is localized when its `ComponentProperty.computeType === "localization"`; the resolved string is found at `localization[lang][nodeKey][type][propName]`. (There is no `localizationKeys` field on the node itself — the linkage is by the node's `key`.)

---

## 5. `css` and `wrapperCss` shapes — string vs object duality

Both `css` and `wrapperCss` use the same `Css` type. `Css` is **device-segmented**, and within each device the styles can be stored two ways:

`Css` = `{ any?: DeviceStyle; mobile?: DeviceStyle; tablet?: DeviceStyle; desktop?: DeviceStyle }`

`DeviceStyle` = `{ object?: any; string?: string }`

| Sub-field | Type | Meaning |
|---|---|---|
| `any` | `DeviceStyle` | Styles for any/all devices (base). |
| `mobile` / `tablet` / `desktop` | `DeviceStyle` | Device-specific overrides. |
| `DeviceStyle.object` | `any` | CSS defined via the **general style settings** UI (a structured style object). |
| `DeviceStyle.string` | `string` | CSS defined via the **style code editor** (a raw CSS string). |

So the string-vs-object duality is *within each device entry*: `object` holds the GUI-built style object and `string` holds hand-written CSS text. Both may be present; both are optional. `wrapperCss` applies the same structure to the wrapper element. (Contrast with `style`/`wrapperStyle`, whose `ComponentDeviceStyle` only has `string`.) The part name enum is `CssPart = 'css' | 'wrapperCss'`.

---

## 6. `events` and `schema` (validation) shapes

### `events`
`events` = `Record<EventName, ActionData[]>` — a map (object) keyed by event name; each value is an **ordered array** of actions, NOT an array of `{name, actions}` objects.

`ActionData`:
| Field | Type | Req | Meaning |
|---|---|---|---|
| `name` | `string` | yes | The action name (references an entry in top-level `actions`). |
| `type` | `"common" \| "code" \| "custom"` (`ActionType`) | yes | Action kind. |
| `args` | `Arguments` = `Record<ParameterName, ArgumentValue>` | no | Argument values passed to the action. |

`ArgumentValue` = `PrimitiveArgumentValue (string\|number\|boolean)` **or** `FunctionArgumentValue` = `{ type: "fn"; body?: string }`.

(`ActionData` also carries a runtime-only `[KeySymbol]` key that is stripped from the persisted schema by the post-processor and re-generated on load.)

### `schema` (validation — `BoundValueSchema`)
| Field | Type | Meaning |
|---|---|---|
| `autoValidate` | `boolean` | If true, the bound value is validated automatically. |
| `validations` | `ValidationRuleSettings[]` | Ordered list of validation rules. |

`ValidationRuleSettings`:
| Field | Type | Req | Meaning |
|---|---|---|---|
| `key` | `string` | yes | Unique rule key (unique within the value type). |
| `type` | `"internal" \| "custom"` (`ValidatorType`) | no | Validator kind. |
| `args` | `Record<string, any>` | no | Rule arguments (e.g. min/max/pattern). |
| `validateWhen` | `ComponentProperty` | no | Condition controlling when this rule runs. |

---

## 7. Representative annotated persisted component node

```jsonc
{
  "key": "textBox_1",            // unique node identity; also localization key & default dataKey
  "type": "RsInput",             // registered component type that renders this node
  "dataKey": "email",            // value path in form data (falls back to key if omitted)

  "props": {                     // property name -> ComponentProperty
    "label": {
      "value": "Email",          // static value
      "computeType": "localization"  // => resolved from localization[lang][key].component.label
    },
    "disabled": {
      "fnSource": "return form.data.country !== 'US'",
      "computeType": "function"  // computed at runtime from fnSource
    },
    "placeholder": { "value": "you@example.com" } // plain static value
  },

  "css": {                       // device-segmented; string vs object duality per device
    "any":    { "object": { "color": "#333" } },  // built via GUI style settings
    "mobile": { "string": "font-size: 14px;" }    // raw CSS from code editor
  },
  "wrapperCss": {
    "any": { "string": ".wrapper { margin: 8px; }" }
  },

  "style":        { "any": { "string": "padding:4px;" } }, // inline style attr (string only)

  "events": {                    // event name -> ordered ActionData[]
    "onChange": [
      {
        "name": "validateEmail", // references actions["validateEmail"]
        "type": "code",
        "args": {
          "strict": true,                              // primitive arg
          "transform": { "type": "fn", "body": "return v.trim()" } // function arg
        }
      }
    ]
  },

  "schema": {                    // BoundValueSchema — validation for the bound value
    "autoValidate": true,
    "validations": [
      {
        "key": "required",
        "type": "internal",
        "args": { "message": "Email is required" }
      },
      {
        "key": "pattern",
        "type": "internal",
        "args": { "pattern": "^[^@]+@[^@]+$" },
        "validateWhen": { "fnSource": "return form.data.subscribe === true", "computeType": "function" }
      }
    ]
  },

  "htmlAttributes": [ { "data-testid": "email-field" } ],

  "renderWhen": { "fnSource": "return form.data.showEmail", "computeType": "function" },
  "disableDataBinding": { "value": false },

  "slot": "content",             // which parent slot this child occupies (if applicable)
  "children": []                 // nested ComponentStore nodes (the tree)
}
```

The corresponding localized string for `label` would live at:

```jsonc
// PersistedForm.localization
{
  "en-US": {
    "textBox_1": {                 // == node.key
      "component": { "label": "Email" },
      "tooltip":   { "title": "Your work email" }
    }
  }
}
```


---

## Events

FormEngine's event system lets a component's interaction/DOM callbacks (e.g. `onChange`) and engine-fired lifecycle hooks (`onDidMount`, `onWillUnmount`) be bound, at form-design time, to one or more **Actions**. Each bound action runs an `ActionDefinition.func(e, args)` where `e` is an `ActionEventArgs`.

Source root: `/tmp/fe790/community/src/packages/core/src`.

---

### 1. "event" property (the `event` builder) vs "lifecycle event"

| Concept | What it is | Defined in |
|---|---|---|
| **`event` property** | An *annotation builder* that declares a component prop whose type is an event handler / function. A component author calls it in its metadata to expose a callback (e.g. an `onChange` prop). It produces an `EventAnnotation` (`annotationType: 'Event'`). | `features/annotation/index.tsx:112` → `export const event = createAnnotation<EventHandler>('event').setup({annotationType: 'Event'})`; type `EventHandler = (...args: unknown[]) => unknown` (`features/annotation/index.tsx:9`); class `EventAnnotation extends Annotation` (`features/annotation/types/annotations/EventAnnotation.tsx`); registered as `Event: EventAnnotation` in `AnnotationMap` (`features/annotation/consts.ts:17`). |
| **Lifecycle event** | An event *fired by the engine itself* on the component's React mount/unmount, not driven by a DOM interaction. The only two are constants `onDidMount` / `onWillUnmount`. | `features/event/consts/index.ts`: `DidMountEvent = 'onDidMount'`, `WillUnmountEvent = 'onWillUnmount'`. |

An `EventName` is just a `string` (`features/event/types.ts:7`). The set of *interaction* event names is **not hard-coded in core** — each component declares its own via `event` props (e.g. a select declares `onChange`, `onSelect`). Core only hard-codes the two lifecycle names.

---

### 2. Event hook names found

**Lifecycle events (fired by the engine):**

| Name | Constant | When it fires | Args passed |
|---|---|---|---|
| `onDidMount` | `DidMountEvent` | React `componentDidMount` of the component viewer → `componentState.onDidMount()` (`features/ui/ComponentViewer.tsx:28`) → `ComponentState.onDidMount()` (`stores/ComponentState.tsx:319`) | `[]` (empty args array) |
| `onWillUnmount` | `WillUnmountEvent` | React unmount cleanup → `componentState.onWillUnmount()` (`features/ui/ComponentViewer.tsx:30`) → `ComponentState.onWillUnmount()` (`stores/ComponentState.tsx:326`) | `[]` |

Both are routed through `private executeLifecycleEvent(eventName)` (`stores/ComponentState.tsx:330`), which builds the handler with `createDefaultActionHandler` and fires `new ActionEventArgs(eventName, data, store, [], ...)`. They are explicitly **excluded** from the interaction-event map (`computeEvents` does `set.delete(DidMountEvent)` / `set.delete(WillUnmountEvent)`, `ComponentState.tsx:109-110`) so they fire only via the lifecycle path, never as props.

**Component DOM / interaction events (component-declared, not core constants):**

These names are whatever a component exposes through `event` props or persists in `store.events`. Names seen referenced in core (illustrative, not an enum):

| Name | Where referenced / typical meaning | Typical args (`e.args`) |
|---|---|---|
| `onChange` | Example name in `overrideEventHandlers` doc (`Definer.ts:333`), `integratedComponentFeatures.ts:85`, field properties context (`getFieldPropertiesContext.ts:15`). Fires on value change. | `[event]` or `[value]` (DOM SyntheticEvent and/or new value) |
| `onBlur` | Same doc references (`Definer.ts:333`, `getFieldPropertiesContext.ts:18`). Fires on focus loss. | `[event]` |
| `onClick`, `onFocus`, `onSelect`, `onClean`, `onClose`, `onCreate`, `onLoadData`, `onSearch`, `onSubmit`, `onValidate`, etc. | **Not** defined in core. They are declared per-component via `event` props in component packages (material/antd/etc.) and persisted into `store.events`. Core treats them generically. | Whatever the component invokes the prop with; collected into `e.args` |

> Note: the grep for `onClick/onSelect/onSubmit/...` returns no core definitions — confirming core has no fixed catalog of interaction events. `onSelectNode` / `onCreateNode` (`features/define/utils/ComponentMetadataEventListeners.ts`) are **builder-side metadata listeners**, unrelated to runtime form events.

---

### 3. How events bind to Actions

**Persisted shape** — on the `ComponentStore` (`stores/ComponentStore.ts:139,191`):

```ts
events?: Record<EventName, ActionData[]>
```

Each `ActionData` (`features/event/types.ts:62`):

| Field | Type | Meaning |
|---|---|---|
| `[KeySymbol]?` | `string` | Unique action-instance key (set by `initActionDataKey`) |
| `name` | `string` | Action name to resolve |
| `type` | `ActionType` = `'common' \| 'code' \| 'custom'` | Which registry to resolve from |
| `args?` | `Arguments` = `Record<ParameterName, ArgumentValue>` | Per-invocation argument values |

An `ArgumentValue` is either a primitive (`string`/`number`/`boolean`) or a **function argument** `{ type: 'fn', body?: string }` (`features/event/types.ts:32-46`). Function args are compiled (cached) by `getArgumentFunction(source)` → `new Function('e','args','...userArgs', 'return (async function(){...})()')` (`features/event/consts/functionArgument.ts:13`), and detected via `isFunctionArgumentValue`.

Events are appended via `ComponentStore.addEventHandler(store, eventName, data)` (`ComponentStore.ts:266`), which does `store.events[eventName] ??= []; .push(data)`.

**Resolution & execution** (`stores/ComponentState.tsx`):

1. `computeEvents(componentState)` (line 97) builds a `Record<EventName, (...args) => Promise<void>>`. The key set = union of `Object.keys(store.events)` and override handlers, minus the two lifecycle names. This record is merged into the component's rendered props (`get` → `...this.events`, `ComponentState.tsx:188`), so the component receives real callbacks.
2. When the component invokes a callback, the wrapper (a) runs any custom/override `ActionEventHandler` (from `overrideEventHandlers` feature `cfEventHandlers`, or `context.eventHandlers`), then (b) runs `createDefaultActionHandler` (line 86).
3. `createDefaultActionHandler` reads `data.store.events?.[eventName] ?? []` and builds an action chain via `createActionHandlersChain(store, actionDataList)` (line 65). For each `ActionData` it resolves `store.findAction(data).func` and clones `data.args`.
4. The chain runs actions **sequentially**, awaiting promises. Before each call, `bindFunctionsInArgs(e, args)` (line 41) replaces any `{type:'fn'}` args with bound executable functions. Errors are caught and `console.info`-logged (line 79–82), so one failing action does not crash the form.

`store.findAction(actionData)` → `getAction(name, type)` (`stores/Store.ts:161,234`) resolves by type:

| `type` | Resolves from |
|---|---|
| `common` | `store.commonActions` (the built-ins, `Store.ts:151`) |
| `code` | `form.actions` (form-level code actions, deserialized via `createActionValuesFromObject`) |
| `custom` | `formViewerPropsStore.actions` (host-app `CustomActions`) |

Throws `Action '<name>' with type '<type>' not found!` if missing.

**Context/args an action receives** — `func(e, args)` where `e` is `ActionEventArgs` (`features/event/utils/ActionEventArgs.ts:11`):

| Member | Meaning |
|---|---|
| `type: string` | The event name that fired |
| `sender: ComponentData` | Component that triggered the event |
| `store: Store` | Form viewer store |
| `args: any[]` | Raw arguments the component passed to the callback |
| `renderedProps: Record<string,any>` | Props used to render the sender |
| `index?: number` | Sender's nearest array index (for repeater rows) |
| `cellInfo?: CellInfo` | Current table cell info |
| `get event(): SyntheticEvent \| null` | First arg that looks like a DOM event (`target && type && preventDefault`) |
| `get value()` | First non-event, defined arg (treated as the value) |
| `get data()` | Proxy to read/write this component's form data |
| `get parentData()` | Proxy to parent data (array elements) |
| `get rootData()` | Proxy to root form data |
| `userDefinedProps` / `setUserDefinedProps(props)` | Read / override the React component's user-defined props |

The `data`/`parentData`/`rootData` proxies (`features/event/utils/createComponentDataProxy.ts`) write through `field.setValue(value)` for matching fields, else `updateInitialData`. The second action param `args` is the resolved/bound `ActionData.args`. `ActionEventHandler` type = `(e: ActionEventArgs) => void | Promise<void>` (`features/event/ActionEventHandler.ts`).

---

### 4. Built-in (common) actions

Registry `commonActions: ActionValues` (`features/event/consts/actions.ts:6`), resolved for `type: 'common'`:

| Action name | Effect | Params (`ActionParameters`) |
|---|---|---|
| `log` | `console.log` | — |
| `validate` | `await componentTree.validate()`; if `failOnError`, throws `componentTree.errors` when `hasErrors` | `failOnError: boolean` |
| `clear` | `componentTree.clear(clearInitialData)` | `clearInitialData: boolean` |
| `reset` | `componentTree.reset(clearInitialData)` | `clearInitialData: boolean` |
| `addRow` | Inserts a row into a repeater array (`addRowAction`, `repeaterActions.ts`); uses `args.dataKey` or parent repeater key | `dataKey: string`, `rowData: string` (JSON), `index: number`, `max: number` |
| `removeRow` | Removes a repeater row (defaults to last / `e.index`) (`removeRowAction`) | `dataKey: string`, `index: number`, `min: number` |
| `openModal` | Finds component by `modalKey`, runs optional `beforeShow` fn (abort if it returns `false`), seeds modal `initialData` (from `useFormData` or `beforeShow` result), sets `userDefinedProps[modalState] = {open:true, initialData, beforeHide}` (`modalActions.ts`) | `modalKey: string`, `useFormData: boolean`, `beforeShow: function`, `beforeHide: function` |
| `closeModal` | Runs `beforeHide` from modal context, then `closeCurrentModal(modalResult)` | `result: string` |

**Action factories:** `ActionDefinition.functionalAction(func, params)` (JS function) and `ActionDefinition.sourceAction(body, params)` (compiles `AsyncFunction('e, args', body)`) — `features/event/types.ts:124,134`. `defineAction` helper type signature: `(name, func, params?, description?) => ActionDefinition` (`features/event/utils/defineAction.ts`). Host apps register extra actions as `CustomActions = Record<string, ActionDefinition | ActionEventHandler>`, converted by `customActionsToActionsValues` (`features/form-viewer/CustomActions.ts`) into the `type:'custom'` registry.


---

## Validation

Documents how FormEngine (Optimajet) resolves and executes value validation. All identifiers below are taken verbatim from `src/packages/core/src` of the frozen codebase.

### 1. The persisted validation `schema` on a component node

The persisted object lives on `ComponentStore.schema` (`stores/ComponentStore.ts:201`) and is typed `BoundValueSchema` (`features/validation/types/BoundValueSchema.ts`). It is consumed in `Store.createDataValidator` (`stores/Store.ts:478-479`), which passes `componentData.store.schema` into `typedValidatorsResolver(...)`.

`BoundValueSchema`:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `autoValidate` | `boolean` | optional | If true, automatic validation of the value runs; false otherwise. |
| `validations` | `ValidationRuleSettings[]` | optional | The ordered array of rule settings applied to the bound value. |

Each entry of `validations` is a `ValidationRuleSettings` (`features/validation/types/ValidationRuleSettings.ts`):

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `key` | `string` | yes | Unique rule key within the value type (e.g. `required`, `min`, `email`, `code`). |
| `type` | `ValidatorType` = `'internal' \| 'custom'` | optional | Resolution source. Absent/`'internal'` => built-in/Zod rule; `'custom'` => app-supplied validator. (`features/validation/types/ValidatorType.ts`) |
| `args` | `Record<string, any>` | optional | Arguments passed to the rule (e.g. `{limit, message}`, `{code, message}`). |
| `validateWhen` | `ComponentProperty` | optional | Conditional trigger gating whether this rule runs (see §4). |

Note: there is no literal `required`/`code` field on the schema object. `required` and `code` are simply `key` values inside the `validations` array. `isRequired` is detected by scanning for a rule whose key is `'required'` (`stores/ComponentState.tsx:37-39`).

### 2. `required`

Declared as a `validations` entry with `key: 'required'` (no args needed). It is implemented per value type as a built-in rule in the `ZodValidationRules` map (`features/validation/utils/consts.tsx:15-24`). Examples:

| Value type | `required` implementation (`rules/*.ts`) |
|------------|------------------------------------------|
| `string` | `z.string(...).nonempty('Required')` (`ZodStringRules.ts:12-13`) |
| `number` | `z.number(errorMapForUndefined)` — undefined/null => `'Required'` (`ZodNumberRules.ts:17-18`, `rules/consts.ts`) |
| `object` | `z.unknown().refine(val => isObject(val) && !isEmpty(val), 'Required')` (`ZodObjectRules.ts:11-12`) |
| `boolean` | `scheme.refine(val => val, 'Required')` (`ZodBooleanRules.ts:11`) |

Default failure message is `'Required'` (`requiredMessage`, `rules/consts.ts:4`). The presence of a `required` rule is also what `ComponentState`/`isRequired` reports to the UI. In the resolver ordering, `required` is forced to run first (see §5).

### 3. `code` (custom-code validation)

Defined by `codeValidationRule` (`features/validation/utils/consts.tsx:37-51`). It is registered as an `internal` rule under the key `code` for every value type by `Store.getValidationRules` (`stores/Store.ts:282-287`):

```ts
internal: { ...ZodValidationRules[type], code: codeValidationRule }
```

It is a JS function body string compiled at runtime via the async-function constructor (`AsyncFunction('value, form', code)`, `consts.tsx:30`; `utils/AsyncFunction.ts`).

| Aspect | Value |
|--------|-------|
| Rule key | `code` |
| Args (params) | `code` (the JS source, `required: true`, editorType `'code'`) and the inherited `message` param (`ruleBuilder` adds `message`). |
| Compiled signature | `(value, form) => Promise<boolean>` — `value` is the field value, `form` is the `IFormData`. |
| Must return | Truthy => valid (validator returns `true`). Falsy => invalid; the rule returns `message` if provided, else `false` (`consts.tsx:43-45`). |
| On compile error | Logs and falls back to `emptyCodeValidator` (always resolves `true`) (`consts.tsx:28-35`). |
| On runtime throw | Error is logged and re-thrown (`consts.tsx:46-48`). |

(The outer `RuleValidator` signature is `(value, store, args, formData)`, but the user `code` body only receives `value` and `form`.)

### 4. `validateWhen` — the trigger model

`validateWhen` is **not** a `change/blur/submit` enum. It is a `ComponentProperty` (`stores/ComponentStore.ts:34-52`) — a boolean expression / function evaluated against form data to decide whether the rule should run at all. It is evaluated by `needValidate` (`utils/needValidate.ts`) which the resolver calls per rule (`validatorsResolver.tsx:68`): rules whose `needValidate` returns false are skipped (`continue`).

`needValidate(property, formData)` logic:

| Condition | Result |
|-----------|--------|
| No `property` or no `formData` | `true` (always validate) |
| Non-functional property whose `.value` is an empty/whitespace string | `true` |
| Otherwise | `calculateExpressionProperty(property, formData) === true` |

`ComponentProperty` evaluation (`features/calculation/propertyCalculator.ts:54-58`): if `computeType === 'function'` the `fnSource` is run as `(form) => ...`; otherwise `value` is evaluated as `return <value>` with `form` in scope. So `validateWhen` runs the rule only when the expression evaluates strictly to `true`. The *when* (change/blur/submit) is governed elsewhere by `autoValidate` / `DataValidator.sendValidationEvent` (debounced 200ms) and form submit — `validateWhen` only gates the conditional predicate.

### 5. Resolution, ordering, and error/message production

`validatorsResolver` (`features/validation/utils/validatorsResolver.tsx`), exposed as `typedValidatorsResolver(validationRules)(schema)`, returns a `ResolvedValidator` of shape `(value, store, getFormData) => Promise<ValidationResult[] | undefined>` (`utils/DataValidator.ts:21`).

Resolution steps:

1. `parse()` returns early (undefined) if `schema.validations` is empty.
2. `validations` is copied and sorted by `byPriority` (`validatorsResolver.tsx:18-24`):
   - `required` is forced **first** (it is the root for subsequent rules).
   - `code` is forced **last** (uses Zod `refine` semantics under the hood).
   - all others keep relative order (comparator returns `0`).
3. Each `ValidationRuleSettings` is mapped to a validator via `toValidator`:

| `type` | Lookup | Notes |
|--------|--------|-------|
| absent or `'internal'` | `validationRules.internal[rule.key]` => `definition.validatorFactory(rule.args ?? {})` | Missing key => warn + `noOpValidator` (returns `true`). |
| `'custom'` | `validationRules.custom?.[rule.key]` => `definition.validate` | Uses `definition.params`. |
| unmatched | — | warn + `noOpValidator`. |

`internal` rules come from `ZodValidationRules[type]` plus the injected `code` rule; `custom` rules come from `formViewerPropsStore.validators?.[type]` (`Store.getValidationRules`, `stores/Store.ts:278-288`). Validator set shape is `FormViewerValidationRules` = `{ custom?: CustomValidationRules; internal: ValidationRuleSet }`.

Execution (per rule, sequential `for` loop, `validatorsResolver.tsx:62-83`):

1. Skip if `!needValidate(settings.validateWhen, getFormData?.())`.
2. Build `args`: start from each declared param's `default` (when defined), then `Object.assign(args, settings.args)`.
3. Call `validator(value, store, args, getFormData?.())`; await if it returns a Promise.
4. If the result `!== true`, push a `ValidationResult` = `{ settings, message: (args.message ?? ruleResult) }`. So the message precedence is: explicit `args.message` > the string returned by the validator > (for Zod) the first issue message > `false`.

`ValidationResult` (`features/validation/types/ValidationResult.ts`): `{ settings: ValidationRuleSettings; message?: string }`. A single rule's raw result (`RuleValidator`) is `RuleValidatorResult = string | boolean` (`types/RuleValidator.ts`) — `true` = pass, `false`/string = fail (string is the message).

`DataValidator` (`utils/DataValidator.ts`) wraps the resolved validator: it localizes results (`ErrorMessageLocalizer`, falling back to `getDefaultErrorMessage` => `result.message ?? \`Validation failed: ${result.settings.key}\``), and if `store.showAllValidationErrors` is false only the **first** error is shown. `validate()` joins messages with a space and calls the error `setter`. `sendValidationEvent` debounces validation by 200ms.

**Zod-to-validator bridge:** built-in rules build a `ZodType` and convert via `zodTypeToValidator` (`rules/zodTypeToValidator.ts`) => `async value => safeParseAsync(value)`; on success returns `true`, else returns `result.error.issues[0].message ?? false`.

**Built-in (internal) validators** by value type (`features/validation/rules/`):

| Value type | Rule keys |
|------------|-----------|
| `string` (`ZodStringRules.ts`) | `required`, `nonEmpty`, `length`, `min`, `max`, `regex`, `email`, `url`, `uuid`, `ip`, `datetime`, `includes`, `startsWith`, `endsWith` |
| `number` (`ZodNumberRules.ts`) | `required`, `min`, `max`, `lessThan`, `moreThan`, `integer`, `multipleOf`, `finite` (deprecated) |
| `boolean` (`ZodBooleanRules.ts`) | `required` (+ `isTrue`/`isFalse`-style refine rules) |
| `object` (`ZodObjectRules.ts`) | `required`, `nonEmpty` |
| `array` (`ZodArrayRules.ts`), `date` (`ZodDateRules.ts`), `time` (`ZodTimeRules.ts`) | type-specific rules |
| `enum` | `{}` (none) |
| all types | `code` (injected by `getValidationRules`) |

**`unique_key`:** a special built-in used for the component `key` property (not bound-value validation). Declared via the `validation` annotation pipeline in `features/annotation/index.tsx:14-20` (`createAnnotation('validation')` and the `key` annotation's `.validated(isUniqueKey, {code: 'unique_key', message: 'The key must be unique!'})`). `isUniqueKey` (`features/annotation/utils/isUniqueKey.tsx`) is a `RuleValidator<string>` that returns true only if exactly one component in the tree has that key (`store.reduceScreen(...) === 1`). Here `code` denotes the rule identifier, not JS source.

### 6. Annotated example of a node `schema` validation block

```jsonc
{
  // ComponentStore.schema (BoundValueSchema)
  "schema": {
    "autoValidate": true,                 // run validation automatically on value change
    "validations": [
      {
        "key": "required",                // built-in internal rule; forced to run FIRST
        "type": "internal",               // optional; absent also means internal
        "args": { "message": "This field is mandatory" } // overrides default 'Required'
      },
      {
        "key": "min",                     // built-in string/number rule
        "args": { "limit": 5, "message": "At least 5 characters" }
      },
      {
        "key": "email",                   // built-in string rule (no required args)
        "args": {}
      },
      {
        "key": "phoneFormat",             // app-supplied custom rule
        "type": "custom",                 // resolved from validationRules.custom[type]['phoneFormat']
        "args": { "message": "Invalid phone" },
        "validateWhen": {                 // ComponentProperty: only run when expression === true
          "value": "form.data.country === 'US'"   // evaluated as `return <value>` with `form` in scope
        }
      },
      {
        "key": "code",                    // custom-code rule; forced to run LAST
        "args": {
          // compiled as AsyncFunction('value, form', code); must return truthy to pass
          "code": "return value !== form.data.username;",
          "message": "Value must differ from username"  // shown on falsy return
        }
      }
    ]
  }
}
```


---

## CSS System — string vs object duality

FormEngine (Optimajet) stores per-node styling in a `Css` object that is keyed first by **responsive breakpoint** (`any` / `mobile` / `tablet` / `desktop`) and within each breakpoint splits into two parallel representations: a free-form CSS **`string`** (from the code editor) and a structured **`object`** (from the styling UI). Both are merged at render time. A node carries two such blocks: `css` (targets the component) and `wrapperCss` (targets its wrapper / Labeled container).

All facts below are derived from the frozen source under `/tmp/fe790/community`.

### 1. Persisted `css` object structure

Defined in `src/packages/core/src/features/style/types.ts` and (identically) in `src/packages/core/src/stores/ComponentStore.ts`.

```
Css
└─ <breakpoint>: DeviceStyle        // keys: any | mobile | tablet | desktop  (all optional)
   ├─ string?: string              // raw CSS text typed in the code editor
   └─ object?: any                 // structured style props from the styling UI (CSSProperties-like)
```

`ComponentStore` (`ComponentStore.ts`) holds two style blocks of this exact shape:

| Field          | Type  | Targets                                           |
|----------------|-------|---------------------------------------------------|
| `css`          | `Css` | the component element itself                       |
| `wrapperCss`   | `Css` | the component's wrapper / Labeled container        |
| `style`        | `ComponentStyle` | inline `style` attr of component (separate path) |
| `wrapperStyle` | `ComponentStyle` | inline `style` attr of wrapper (separate path)  |

Breakpoint keys (`src/packages/core/src/types.ts`): `ViewMode = 'desktop' | 'mobile' | 'tablet'`. The extra key `any` means "all devices / arbitrary device". There is **no** state-level keying (no hover/focus sub-keys) in the persisted shape — pseudo-states are expressed inside the `string` CSS text itself.

`DeviceStyle` / `ComponentDeviceStyle` types (`types.ts` lines 4-15; `ComponentStore.ts` ~108-125):

| Field    | Source UI               | Holds                                              |
|----------|-------------------------|----------------------------------------------------|
| `string` | "style code editor"     | raw CSS text the user typed                         |
| `object` | "general style settings"| structured/parsed style properties (object form)    |

### 2. `css.any.string`

- Holds the **raw CSS text** the user typed in the style code editor for the "all devices" (`any`) breakpoint.
- It is fed through `silentTransformCssString()` (for the inline `style` path) or injected verbatim into an emotion `css`\`\` template (for the `className` path) at render time. See section 4.

### 3. `css.any.object`

- Holds **structured style properties** (a CSSProperties-like object) produced by the styling UI ("general style settings") for the `any` breakpoint.
- It is spread/merged into the emotion `css`\`\` template (the `className` path) at render time. See section 4.

### 4. How the two relate — parsing, precedence, merge

There is **no parse from `object` ↔ `string`** in either direction at persistence time; they are stored independently. Conversion only happens at render, and only `string → CSSProperties` (never the reverse).

**Parsing (`string` only):**
- `src/packages/core/src/features/css-style/parse.ts` — a CSS-grammar parser (fork of reworkcss) turning a CSS string into a stylesheet AST.
- `src/packages/core/src/features/css-style/cssTransform.ts` — `silentTransformCssString(css)` wraps `transformCssString()`:
  - If the text has no `{`, it is treated as a raw declaration block and bootstrapped as `.bootstrapWithCssClass { … }` so the parser does not choke; the wrapper class is then stripped from the result.
  - `transformRules` walks the AST: `@media` rules become nested keyed objects (`@media <expr>` with `__expression__`), normal rules' declarations are camelCased (`align-items` → `alignItems`) into a CSSProperties object.
  - Errors are swallowed (`silent`) → returns `undefined`.

**Two render consumers, in `src/packages/core/src/stores/ComponentState.tsx`:**

(a) Inline `style` attribute — `getStyleFromStylePart()` (lines 336-343) consumes **only `string`**:
```
anyCss      = silentTransformCssString(stylePart?.any?.string)
viewModeCss = silentTransformCssString(stylePart?.[viewMode]?.string)
return { style: { ...anyCss, ...viewModeCss } }   // current breakpoint wins over `any`
```
(This path reads `store.style` / `store.wrapperStyle`, the `ComponentStyle` blocks — not `css`/`wrapperCss`.)

(b) `className` (emotion) — `getClassNameFromCssPart(cssPart)` (lines 345-366) consumes **both `object` and `string`**, for both `css` and `wrapperCss`, merging **model defaults then store overrides**, and **`any` then current breakpoint**:
```
cssObjectAny     = Object.assign({}, model[cssPart]?.any?.object,        store[cssPart]?.any?.object)
cssObjectCurrent = Object.assign({}, model[cssPart]?.[viewMode]?.object, store[cssPart]?.[viewMode]?.object)
return css`
  && {
    ${cssObjectAny}                       // 1. object, any
    ${cssObjectCurrent}                   // 2. object, current breakpoint
    ${store[cssPart]?.any?.string}        // 3. string, any
    ${store[cssPart]?.[viewMode]?.string} // 4. string, current breakpoint
  }
`
```

**Precedence (last wins, later overrides earlier):**

| Order | Source                              | Note                                  |
|-------|-------------------------------------|---------------------------------------|
| 1     | `object` (any)                      | model defaults overridden by store    |
| 2     | `object` (current breakpoint)       | overrides `any` object                |
| 3     | `string` (any)                      | raw text, overrides objects above     |
| 4     | `string` (current breakpoint)       | highest precedence                    |

So within `className`: **`string` beats `object`, and current breakpoint beats `any`.** The `&&` selector raises specificity so these styles win over library defaults. Note: for the `object` path both `model` and `store` are read; for the `string` path only `store` is read.

`className` getter (lines 270-277) combines `getClassNameFromCssPart('css')` with `props.className` and a `required` class via `cx`. `wrapperClassName` getter (282-284) returns `getClassNameFromCssPart('wrapperCss')`.

### 5. `wrapperCss` vs `css` — DOM targeting

Applied in `src/packages/core/src/features/ui/ComponentViewer.tsx`:

| Concept              | Getter / source                       | DOM target                                              |
|----------------------|---------------------------------------|---------------------------------------------------------|
| `css`                | `componentState.className` (`'css'`)  | the component element `<Component className=…>`         |
| `wrapperCss`         | `componentState.wrapperClassName` (`'wrapperCss'`) | the wrapper / Labeled container element     |

Logic (lines 36-64):
- `useWrapperStyles = !isFeatureEnabled(cfDisableWrapperStyles)`; `useStyles = !isFeatureEnabled(cfDisableStyles)`.
- `containerClassName = cx(otherProps.className /* incl. css */, useWrapperStyles && wrapperClassName)`.
- `kind === 'container'`: container gets `className` (css + wrapper merged) directly.
- `kind === 'repeater'`: passed as `wrapperClassName` prop to the component.
- `kind === 'template'`: wrapper gets the full `className`.
- default: wrapper element gets `wrapperClassName`; the component itself carries its own `css` className via `otherProps`.

So `css` decorates the inner component; `wrapperCss` decorates the surrounding `DefaultWrapper` / Labeled container. Both use the same `Css` shape and the same merge rules.

### 6. BiDi / RTL / LTR CSS loaders

- `BiDi` enum (`src/packages/core/src/features/localization/bidi.ts`): `LTR = 'ltr'`, `RTL = 'rtl'`.
- `View` (`features/define/utils/View.ts`) registers loaders by `CssLoaderType = BiDi | 'common'`. `withCssLoader('common', …)` registers the loader for **both** LTR and RTL; `getCssLoaders(biDi)` returns them.
- rsuite registration (`src/packages/views/rsuite/src/builderViewWithCss.ts`):
  ```
  new BuilderView(components)
    .withCssLoader(BiDi.LTR, ltrCssLoader)     // rsuite-no-reset.min.css
    .withCssLoader(BiDi.RTL, rtlCssLoader)     // rsuite-no-reset-rtl.min.css
    .withCssLoader('common', formEngineRsuiteCssLoader)  // formengine-rsuite.css
  ```
- Loaders (`src/packages/views/rsuite/src/cssLoader.ts`) dynamically import the stylesheet URL and call `loadResource(id, href, 'stylesheet')`; the LTR loader `unloadResource`s the RTL sheet and vice-versa — only one direction's sheet is mounted at a time.
- Invocation (`features/localization/ViewerLocalizationProvider.tsx` lines 36-43): on language change it picks `emotionCache.RTL` when `language.bidi == RTL` else `emotionCache.LTR`, runs `view.getCssLoaders(language.bidi)`, wraps children in `<div dir={bidi} lang=…>` + emotion `CacheProvider`.
- The RTL emotion cache (`features/localization/emotionCache.ts`) is created with `prepend: true` (key `'rtl'`); LTR cache uses key `'ltr'`. This namespaces and orders the per-node emotion classes emitted by `getClassNameFromCssPart`.

### 7. Representative annotated node `css` block (both `string` and `object`)

```jsonc
{
  "key": "RsInput0",
  "type": "RsInput",
  "props": { /* … */ },

  // Decorates the component element itself (className path):
  "css": {
    "any": {
      // structured props from the styling UI -> merged first (lowest precedence)
      "object": {
        "borderRadius": "8px",
        "backgroundColor": "#f5f5f5"
      },
      // raw CSS text from the code editor -> merged after object (overrides it)
      "string": "border: 1px solid #999;\n&:hover { border-color: #333; }"
    },
    "mobile": {
      // overrides the `any` block when viewMode === 'mobile'
      "object": { "backgroundColor": "#fff" },
      "string": "padding: 4px;"
    }
  },

  // Decorates the wrapper / Labeled container (same Css shape, same merge rules):
  "wrapperCss": {
    "any": {
      "object": { "marginBottom": "12px" },
      "string": "display: flex; gap: 8px;"
    }
  }
}
```

Resolved emotion rule for `css` at `viewMode = 'mobile'` (precedence low → high):
```css
&& {
  border-radius: 8px; background-color: #f5f5f5;   /* css.any.object        */
  background-color: #fff;                           /* css.mobile.object     */
  border: 1px solid #999; &:hover { … }             /* css.any.string        */
  padding: 4px;                                     /* css.mobile.string     */
}
```
(Net: `background-color` resolves to `#fff`; `string` rules sit last so they win over any `object` collision.)

### Key file index

| File | Role |
|------|------|
| `src/packages/core/src/features/style/types.ts` | `Css`, `DeviceStyle`, `CssPart` types |
| `src/packages/core/src/stores/ComponentStore.ts` | `css`/`wrapperCss`/`style`/`wrapperStyle` fields; `ComponentStyle`/`ComponentDeviceStyle` |
| `src/packages/core/src/stores/ComponentState.tsx` | merge/precedence logic (`getStyleFromStylePart`, `getClassNameFromCssPart`) |
| `src/packages/core/src/features/css-style/parse.ts` | CSS-string → AST parser |
| `src/packages/core/src/features/css-style/cssTransform.ts` | `silentTransformCssString` (string → CSSProperties) |
| `src/packages/core/src/features/ui/ComponentViewer.tsx` | applies css vs wrapperCss to DOM by `kind` |
| `src/packages/core/src/features/annotation/types/annotations/StyleAnnotation.tsx` | marker annotation for style metadata |
| `src/packages/core/src/features/localization/bidi.ts` / `emotionCache.ts` / `ViewerLocalizationProvider.tsx` | BiDi enum, emotion caches, loader invocation |
| `src/packages/views/rsuite/src/builderViewWithCss.ts` / `cssLoader.ts` | LTR/RTL/common CSS loader registration & loading |


---

## Appendix A — Component Definition DSL

This appendix is a code-derived reference of the FormEngine component-definition DSL, taken verbatim from
`packages/core/src/features/annotation` and `packages/core/src/features/define`. It covers the property-builder
factories, the chainable builder methods, the `define()` Definer API, and the auto-injected/role concepts.
All identifiers below appear exactly as written in the source.

---

### 1. Property-builder factories

These are exported from `features/annotation/index.tsx`. Each is a pre-configured builder instance (not a
function, except `oneOf`, `someOf`, and `fn`). The JSON `type` is the value written into the annotation's
`type` field (a `SchemaType`); the `editor` field (an `EditorType`, i.e. a `string` naming the property editor)
is separate and is the argument passed to `createAnnotation`/`createProperty`.

Two helpers underpin them (`features/annotation/utils/index.ts`):
- `createAnnotation = AnnotationBuilder.create` — `createAnnotation(editor)` builds an `AnnotationBuilder`
  whose `annotationType` defaults to `'Module'` (from `BuilderOptions`).
- `createProperty(editor)` = `createAnnotation(editor).setup({annotationType: 'Property'})`.

`SchemaTypeMap` (`features/validation/types/SchemaTypeMap.ts`) maps the `type` string to a TS type:
`string→string`, `number→number`, `boolean→boolean`, `object→object`, `array→any[]`, `enum→any`,
`date→Date`, `time→string`.

| Factory | Definition (source) | JSON `type` | editor | Notes |
|---|---|---|---|---|
| `string` | `createProperty('string').typed('string').localize` | `string` | `string` | Localizable by default. |
| `object` | `createProperty('object').typed('object')` | `object` | `object` | Any nested POJO of primitives. |
| `boolean` | `createProperty('boolean').typed('boolean')` | `boolean` | `boolean` | |
| `readOnly` | `boolean.setup({readOnly: true})` | `boolean` | `boolean` | Marks the read-only flag property. |
| `disabled` | `boolean.setup({disabled: true})` | `boolean` | `boolean` | Marks the disabled flag property. |
| `number` | `createProperty('number').typed('number')` | `number` | `number` | |
| `size` | `createProperty('size').typed('string')` | `string` | `size` | CSS unit (width/height/etc.). |
| `date` | `createProperty('date').typed('date')` | `date` | `date` | |
| `time` | `createProperty('time').typed('time')` | `time` | `time` | String format `HH:mm:ss` (`timeFormat`). |
| `array` | `createProperty('array').array` | `array` | `array` | Returns an `ArrayBuilder`; `.ofString`/`.ofObject` refine it. |
| `color` | `createProperty('color').typed('string')` | `string` | `color` | e.g. `rgba(...)`. |
| `oneOf` | `createProperty('oneOf').oneOf.bind(createProperty('oneOf'))` | `enum` | `oneOf` | Call as `oneOf(...values)` → `OneOfBuilder`. |
| `someOf` | `createProperty('someOf').someOf.bind(createProperty('someOf'))` | `enum` | `someOf` | Call as `someOf(...values)` → `SomeOfBuilder`. |
| `node` | `createNodeAnnotation<ReactNode>('node').setup({annotationType: 'Container'})` | — | `node` | Container slot; builds a `ContainerAnnotation`. |
| `stringNode` | `node` form `.withDefaultEditor('string')` | — | `node` | Container whose default node editor is `'string'`. |
| `nodeArray` | `createNodeAnnotation<ReactNode[]>('nodeArray').setup({annotationType: 'Container', bindingType: 'array'})` | — | `nodeArray` | Container holding `ReactNode[]`; `bindingType: 'array'`. |
| `event` | `createAnnotation<EventHandler>('event').setup({annotationType: 'Event'})` | — | `event` | Builds an `EventAnnotation`. `EventHandler = (...args) => unknown`. |
| `fn(begin, end='}')` | `createProperty('function').typed('string').calculable(false).withEditorProps({beginContextLine: begin, endContextLine: end})` | `string` | `function` | Function-source editor; `begin`/`end` frame the body. |
| `className` | `createProperty('string').calculable(true).build('className')` | `string` | `string` | Already a built `Annotation` (not a builder). |

Other annotation factories in the same file (used internally / for synthetic props):
`htmlAttributes`, `validation`, `tooltipType` (`typed('string')`), `cssSize`
(`createAnnotation('size').setup({calculable: false})`), `cssColor` (private),
`tooltipProps`, `renderWhen` (`typed('boolean')`), plus the `key` annotation (built; see §4).

`commonStyles` (object of `cssSize`/`cssColor` builders): `width` (default `'100%'`), `height`, `marginTop`,
`marginInlineEnd`, `marginBottom`, `marginInlineStart`, `color`, `backgroundColor`.
`containerStyles`: `flexDirection`/`alignItems`/`justifyContent`/`flexWrap` (each `oneOf(...)`), `gap` (`size`).

---

### 2. Chainable builder methods

There is a builder class hierarchy. Methods are inherited downward:

```
BaseBuilder<T>
 └─ AnnotationBuilder<T>           (adds .array, .typed, .oneOf, .someOf)
     ├─ TypedBuilder<T>            (adds .required, .default, .validated)
     │   ├─ ArrayBuilder<T>        (adds .ofString, .ofObject; field subType)
     │   └─ QuantifierBuilder<T>   (adds .labeled, overrides .required/.default/.build)
     │       ├─ OneOfBuilder<T>    (adds .radio)
     │       └─ SomeOfBuilder<T>   (default takes T[])
     └─ NodeAnnotationBuilder<T>   (adds .withSlotConditionBuilder, .withInsertRestriction, .withDefaultEditor)
```

Each method returns a clone (`clone()` deep-copies via `cloneDeep`), so builders are immutable/reusable.
`setup(options)` is the underlying mutator: it splits out `annotationType`/`autoName` into `options` and
`Object.assign`s the rest onto `annotation`.

#### BaseBuilder<T>

| Member | Kind | Signature | Effect (annotation/options field set) |
|---|---|---|---|
| `valued` | getter | `get valued` | `setup({valued: true, dataBindingType: 'twoWay'})` — marks the **single data-bound value property** (two-way). |
| `dataBound` | getter | `get dataBound` | `setup({valued: true, dataBindingType: 'oneWay'})` — value property, one-way binding. |
| `uncontrolledValue(v)` | method | `uncontrolledValue(uncontrolledValue: unknown)` | `setup({uncontrolledValue})` — value used to escape the React *uncontrolled* state (see note). |
| `localize` | getter | `get localize` | `setup({localizable: true})`. |
| `notLocalize` | getter | `get notLocalize` | `setup({localizable: false})`. |
| `named(name)` | method | `named(name: string)` | `setup({name})` — overrides display name. |
| `hinted(hint)` | method | `hinted(hint: ReactNode)` | `setup({hint})`. |
| `calculable(b)` | method | `calculable(calculable: boolean)` | `setup({calculable})` — whether the value may be a calculated expression. |
| `setup(opts)` | method | `setup(options: BuilderSetup): this` | Generic clone+merge of any annotation/option fields. |
| `clone()` | method | `clone(): this` | Deep clone. |
| `build(key)` | method | `build(key: string): Annotation` | Instantiates `new AnnotationMap[annotationType](key, name)` and assigns the accumulated annotation. `name = annotation.name ?? (autoName ? startCase(key) : key)`. |
| `withEditorProps(props)` | method | `withEditorProps(props: any): this` | Sets `editorProps = props`. |
| `hideEditor()` | method | `hideEditor(): this` | Sets `editor = undefined`. |

There is **no** `.labeled`, `.radio`, `.required`, `.default`, `.validated`, `.array`, `.typed`, `.oneOf`,
`.someOf`, `.withDefaultEditor`, `.localized`, or `.calculated` on `BaseBuilder` itself — see the subclasses.
(`.localized` and `.calculated` do not exist; the real names are `localize`/`notLocalize` and `calculable`.)

#### AnnotationBuilder<T> (created by `createAnnotation`/`createProperty`)

| Member | Kind | Signature | Effect |
|---|---|---|---|
| `array` | getter | `get array` | New `ArrayBuilder<T[]\|undefined>` with `type: 'array'`. |
| `typed(type)` | method | `typed<T extends SchemaType>(type: T)` | New `TypedBuilder<SchemaTypeMap[T]\|undefined>` with that `type`. |
| `oneOf(...values)` | method | `oneOf<U extends string\|number>(...values: U[])` | New `OneOfBuilder<U>`, `type: 'enum'`, stores `values`. |
| `someOf(...values)` | method | `someOf<U extends string\|number>(...values: U[])` | New `SomeOfBuilder<U>`, `type: 'enum'`, stores `values`. |
| `create(editor)` | static | `AnnotationBuilder.create<T>(editor)` | Factory; constructor sets `annotation = {editor}`. |

#### TypedBuilder<T>

| Member | Kind | Signature | Effect |
|---|---|---|---|
| `required` | getter | `get required: TypedBuilder<NonNullable<T>>` | `setup({required: true})`. |
| `default(v)` | method | `default(value: T): this` | `setup({default: value})`. |
| `validated(fn, errorMap)` | method | `validated(validator: RuleValidator<T>, errorMap: ErrorMap): this` | `setup({validator, errorMap})`. |

#### ArrayBuilder<T> (extends TypedBuilder)

| Member | Kind | Effect |
|---|---|---|
| `ofString` | getter | `ArrayBuilder<string[]\|undefined>`, `type: 'array'`, `editor: 'arrayOfString'`, `subType = 'string'`. |
| `ofObject` | getter | `ArrayBuilder<object[]\|undefined>`, `type: 'array'`, `subType = 'object'`. |
| `subType?` | field | `SchemaType` element type. |

#### QuantifierBuilder<T> (abstract, extends TypedBuilder; base of OneOf/SomeOf)

| Member | Kind | Signature | Effect |
|---|---|---|---|
| `values` | field | `(string\|number)[]` | The allowed values. |
| `labels?` | field | `string[]` | Display labels for values. |
| `required` | getter | `get required` | Narrows to `QuantifierBuilder<NonNullable<T>>`. |
| `labeled(...labels)` | method | `labeled(...labels: string[])` | Sets `labels` (clone). |
| `default(v)` | method | `default(value: T \| T[]): this` | `setup({default})`. |
| `build(key)` | method | override | Builds a `PropertyAnnotation` and fills `data: LabeledValue[]` by zipping `values` with `labels` (falling back to `startCase(value)`). |

#### OneOfBuilder<T>

| Member | Kind | Effect |
|---|---|---|
| `radio()` | method | `setup({editor: 'radio'})` — renders as radio buttons. |
| `default(v)` | method | `default(value: T)` — single value. |

#### SomeOfBuilder<T>

| Member | Kind | Effect |
|---|---|---|
| `default(v)` | method | `default(value: T[])` — array of values (multi-select). |

#### NodeAnnotationBuilder<T> (created by `createNodeAnnotation`; base of `node`/`stringNode`/`nodeArray`)

| Member | Kind | Signature | Effect |
|---|---|---|---|
| `withSlotConditionBuilder(fn)` | method | `(slotConditionBuilder: (props: any) => string)` | `setup({slotConditionBuilder})` — emits source that gates child binding. |
| `withInsertRestriction(pred)` | method | `(predicate?: (self: ComponentData, child: ComponentData) => boolean)` | Sets `insertPredicate` (clone). |
| `withDefaultEditor(editor)` | method | `(defaultEditor: NodeEditorType)` | Sets `defaultEditor`; `NodeEditorType = 'node' \| 'string'`. |
| `build(key)` | method | override | Builds a `ContainerAnnotation`, copying `insertPredicate` and `defaultEditor`. |

#### `.valued` vs `.uncontrolledValue` vs `.default`

- `.valued` marks the **one** property of a component whose value is the form data value and against which
  validation runs. It sets `valued: true` and `dataBindingType: 'twoWay'`. At `build()` time the Definer
  filters `propAns.filter(an => an.valued === true)`; if more than one is found it warns and uses the first;
  if none, it falls back to the property whose `name === 'value'`. The chosen annotation supplies the
  `Model.valued` key, `valueType`, `dataBindingType`, and `uncontrolledValue`.
- `.uncontrolledValue(v)` sets the value substituted when the bound value would otherwise be `undefined`,
  preventing React's controlled→uncontrolled warning. It is read from the valued annotation only.
- `.default(v)` sets the property's initial value (collected by `getDefault` into `Model.defaultProps`).
  It applies to any property; `uncontrolledValue` is specifically about the runtime undefined/uncontrolled state.

---

### 3. The `define(Component, type)` Definer API

`define = Definer.define`; `definePreset = Definer.definePreset`
(`features/define/utils/Definer.ts`). `define(component, displayName?)` resolves the name from
`displayName ?? component.displayName ?? component.name` (throws `'Anonymous components are not allowed!'`
if none), creates a `Definer<T>`, and calls `.type(displayName)` when a display name was given. All instance
methods return the (mutated) `Definer` for chaining; most delegate to private `#updateWith(opts)`.

| Method | Signature | Description |
|---|---|---|
| `name` | `name(name: string)` | Sets the component name. |
| `kind` | `kind(kind: ComponentKind)` | Sets kind: `'container' \| 'component' \| 'template' \| 'repeater'`. |
| `type` | `type(type: string)` | Sets `component.displayName = type` (the component type id). |
| `category` | `category(category: string)` | Sets the palette category. |
| `icon` | `icon(icon: ComponentType)` | Sets the palette icon component. |
| `props` | `props(properties: Annotations<T>)` | Sets the property metadata (object of builders keyed by prop name). |
| `css` | `css(css: Annotations<CSSObject>)` | Sets the component CSS metadata (style annotations). |
| `actions` | `actions(fn: ActionsInitializer)` | Internal: registers action event handlers. |
| `addFeature` | `addFeature(name: string, value: unknown)` | Internal: adds/updates a registered `ComponentFeature`. |
| `componentRole` | `componentRole(value: ComponentRole)` | Adds a role (`cfComponentRole`, multi-valued). |
| `hideFromComponentPalette` | `hideFromComponentPalette(value = true)` | `cfHideFromComponentPalette`. |
| `disableRemove` | `disableRemove(value = true)` | `cfDisableComponentRemove`. |
| `withoutStyles` | `withoutStyles(value = true)` | `cfDisableStyles`. |
| `withoutWrapperStyles` | `withoutWrapperStyles(value = true)` | `cfDisableWrapperStyles`. |
| `showClassNameStylesEditor` | `showClassNameStylesEditor(value: boolean)` | `cfDisableStylesForClassNameEditor = !value`. |
| `showInlineStylesEditor` | `showInlineStylesEditor(value: boolean)` | `cfEnableInlineStylesEditor`. |
| `skipChildrenDuringFieldCollection` | `skipChildrenDuringFieldCollection(value = true)` | `cfSkipChildrenDuringFieldCollection`. |
| `hideTooltipEditor` | `hideTooltipEditor(value = true)` | `cfDisableTooltipProperties`. |
| `overrideEventHandlers` | `overrideEventHandlers(eventHandlers: Record<EventName, ActionEventHandler>)` | `cfEventHandlers`. |
| `hideActionEditors` | `hideActionEditors(value = true)` | `cfDisableActionEditors`. |
| `insertRestriction` | `insertRestriction(fn?: InsertRestrictionFn)` | Restricts where the component can be inserted. |
| `initialJson` | `initialJson(initialJson?: string)` | Serialized `ComponentStore` JSON as the initial subtree. |
| `eventListeners` | `eventListeners(listeners?: ComponentMetadataEventListeners)` | Designer-side metadata event listeners. |
| `preview` | `preview(customPreview: ReactNode)` | **@deprecated**, unused. |
| `getType` | `getType(): string` | Returns `component.displayName \|\| component.name`. |
| `build` | `build(): BuilderComponent` | Produces `{model, meta, category}` (see below). |
| `define` | static `define<T>(component, displayName?)` | Factory. |
| `definePreset` | static `definePreset(name, components: ComponentStore[])` | Builds a preset (`cfComponentIsPreset`, `() => null` component, `initialJson` from a `ComponentStore` whose `children` are `components`). |

There is **no** `.valued`, `.model`, `.demonstrates`, or `.insertRestriction`-as-`valued` method on the
Definer. Value-binding is declared on the property builder (`.valued`/`.dataBound`), not on the Definer.

`build()` derivation (key facts): it converts `properties` via `toArray` and `cssObject`/`commonStyles` via
`toStyleProperties` (which forces `annotationType: 'Style'`, `calculable: false`). It selects the valued
annotation (filter → first, warn if >1, else `name === 'value'`), the read-only annotation (`an.readOnly`),
the disabled annotation (`an.disabled`), and collects per-prop `bindingType` into `propsBindingTypes`. It then
constructs a `Model` (form-viewer metadata: component, name, actions, `valued` key, `valueType`,
`defaultProps`, `css`, `wrapperCss`, type, kind, `readOnly` key, `propsBindingTypes`, `uncontrolledValue`,
`disabled` key, `dataBindingType`, `features`) and a `Meta` (designer metadata: type, properties, css,
wrapperCss, `modules`, customPreview, valuedAn, initialJson, eventListeners, icon, insertRestriction).

`Model` notes: it wraps the component in mobx `observer`; if `valued` is set and `dataBindingType === 'none'`
it upgrades to `'twoWay'`; `kind` defaults to `'component'`. Feature queries: `hasFeatureValue`,
`isFeatureEnabled`, `hasComponentRole`.

---

### 4. Auto-injected properties, roles, kinds, and binding types

**Auto-injected `modules`** (`features/define/constants.ts`) — common annotations added to every component's
`Meta.modules`, independent of `props`:
`tooltipProps`, `renderWhen`, `htmlAttributes`, `validation`, and the lifecycle events
`event.build(DidMountEvent)` and `event.build(WillUnmountEvent)`.

**`key`** (`features/annotation/index.tsx`) — the always-present component key:
`createAnnotation('key').typed('string').required.hinted('Unique component key').calculable(false)
.validated(isUniqueKey, {code: 'unique_key', message: 'The key must be unique!'}).build('key')`.

**`className`** — injected string property (`calculable(true)`, built directly).

**Annotation classes / `AnnotationType`** (`features/annotation/types/index.ts`, `consts.ts`): the
`annotationType` option selects the concrete class via `AnnotationMap`:
`Property→PropertyAnnotation`, `Container→ContainerAnnotation`, `Event→EventAnnotation`,
`Module→ModuleAnnotation`, `Style→StyleAnnotation`. The base `Annotation` carries: `key`, `name`, `editor`,
`hint`, `localizable` (def `false`), `valued` (def `false`), `dataBindingType` (def `'none'`), `readOnly`,
`disabled`, `editorProps`, `default`, `uncontrolledValue`, `type`, `required`, `validator`, `errorMap`,
`calculable` (def `true`), `slotConditionBuilder`, `bindingType`.

**`ComponentRole`** (`ComponentRole.ts`): `'label' | 'tooltip' | 'error-message' | 'modal' | string`.
Set via `.componentRole(value)` (stored under feature `cfComponentRole`, `allowMultiple: true`); queried via
`Model.hasComponentRole`.

**`ComponentKind`** (`types.ts`): `'container' | 'component' | 'template' | 'repeater'`. Default `'component'`.

**`DataBindingType`** (`DataBindingType.ts`): `'oneWay' | 'twoWay' | 'none'`. Set by `.valued` (twoWay) /
`.dataBound` (oneWay); default `'none'`.

**`ComponentPropertyBindType`** (`ComponentPropertyBindType.ts`): `'single' | 'array'`. Stored per-property
in `Model.propsBindingTypes`; `nodeArray` sets `bindingType: 'array'`.

**`ComponentFeature` registry** (`ComponentFeature.ts`, `integratedComponentFeatures.ts`): features must be
registered (`registerComponentFeature`/`registerBooleanComponentFeature`) before use; `allowMultiple` controls
single-value vs array storage. Built-in feature ids: `component-is-preset`, `component-role` (multi),
`disable-main-component-properties`, `disable-tooltip-properties`, `disable-style-properties`,
`disable-additional-properties`, `disable-styles-for-classname-editor`, `enable-inline-styles-editor`,
`hide-from-component-palette`, `disable-component-remove`, `disable-component-styling`,
`disable-component-wrapper-styling`, `skip-children-during-field-collection`, `event-handlers`,
`disable-action-editors`.
