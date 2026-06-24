'use strict';

// ---------------------------------------------------------------------------
// dataKey.js — naming convention logic (the heart of the builder)
// See PLAN.md "Key Naming Convention". All dataKeys use the `__` separator.
// ---------------------------------------------------------------------------

const CONTAINER_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

const RESERVED_NAMES = [
  'screen', 'form', 'data', 'meta',
  'disabled', 'derived', 'spec', 'specs',
];

function toSnakeCase(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// dataKey = {container_name}__{field_name}, with special-prefix and async rules.
function deriveDataKey(section, field) {
  const prefix = section.container_name;

  // Rule 5 — special prefix overrides the container prefix entirely.
  if (field.special_prefix) {
    const fieldName = field.field_name || toSnakeCase(field.label || field.id);
    return `${field.special_prefix}${fieldName}`;
  }

  // Upload/attachment fields use the reserved `attachment` key (the array of
  // uploaded files). Multiple upload fields chain: attachment__{name}.
  if (field.field_type === 'upload') {
    const fieldName = field.field_name || toSnakeCase(field.label || '');
    return fieldName && fieldName !== 'attachment' ? `attachment__${fieldName}` : 'attachment';
  }

  // Rule 6 — async dropdown/tags store the display value under a __label key.
  if (field.field_type === 'dropdown_async' || field.field_type === 'tags_async') {
    const fieldName = field.field_name || toSnakeCase(field.label);
    return `${prefix}__${fieldName}__label`;
  }

  // Rule 1 + 3 — standard: container__field
  const fieldName = field.field_name || toSnakeCase(field.label || field.id);
  return `${prefix}__${fieldName}`;
}

// Rule 4 — table row dataKeys: {prefix}__{rowIndex}__{suffix}.
// tablePrefix is normalised (trailing underscores stripped) so callers may
// pass either "spec" or "spec__".
function deriveTableDataKey(tablePrefix, rowIndex, columnSuffix) {
  const p = String(tablePrefix || '').replace(/_+$/, '');
  return `${p}__${rowIndex}__${columnSuffix}`;
}

function validateContainerName(name, existingNames = []) {
  if (!name || name.trim() === '') return 'Container name is required';
  if (!CONTAINER_NAME_REGEX.test(name)) {
    return 'Lowercase letters, numbers, underscores only. Must start with a letter.';
  }
  if (RESERVED_NAMES.includes(name)) return `"${name}" is a reserved name`;
  if (existingNames.includes(name)) return `"${name}" is already used in this form`;
  return null; // valid
}

export {
  CONTAINER_NAME_REGEX,
  RESERVED_NAMES,
  toSnakeCase,
  deriveDataKey,
  deriveTableDataKey,
  validateContainerName,
};
