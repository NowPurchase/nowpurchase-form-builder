/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { TagPicker, Loader } from "rsuite";
import styled from "@emotion/styled";
import {
  define,
  array,
  string,
  boolean,
  event,
  oneOf,
  toLabeledValues,
  useComponentData,
} from "@react-form-builder/core";
import { rebuildSelectedItems } from "../ui-builder/engine/selectItems.js";

/**
 * Drop-in replacement for the stock RsTagPicker (multi-select dropdown).
 *
 * The stock component (`@react-form-builder/components-rsuite` tag-picker)
 * deliberately strips `onLoadData` from its props and only renders a STATIC
 * `data` list — so a master-data multi-select (`tags_async`) never fetches.
 * This override mirrors `rsDropdownOverride` but for multi-select: it drives
 * rsuite's `TagPicker` with async `onLoadData` (on open, on search incl.
 * backspace-to-empty, and on scroll-to-end for pagination), so master tags work
 * like master dropdowns. Registered under the same type name "RsTagPicker".
 */

const LoaderWrapper = styled(Loader)`
  && {
    display: flex;
    justify-content: center;
    position: absolute;
    bottom: 0;
    background: var(--rs-bg-overlay);
    width: 100%;
    padding-block: 10px;
  }
`;

const Labeled = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;

  label {
    margin-inline-start: 5px;
    margin-bottom: 2px;
    text-align: left;
  }

  &.required > label::after {
    margin-inline-start: 3px;
    content: "*";
    color: #f44336;
  }
`;

function useTagDropdownState({
  data,
  onLoadData,
  value,
  preload,
  disableVirtualized,
  onSearchProp,
  onOpenProp,
}) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [items, setItems] = useState(data ?? []);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  // Append newly loaded items, de-duped by value (multi-select keeps a growing list).
  const loadCallback = useCallback((newItems) => {
    setItems((prev) => {
      const seen = new Set(prev.map((it) => it.value));
      const merged = prev.slice();
      newItems.forEach((it) => { if (!seen.has(it.value)) merged.push(it); });
      return merged;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (preload) onLoadData?.("", loadCallback, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload, onLoadData]);

  // Keep any already-selected values visible even if not in the current page.
  useEffect(() => {
    const extra = selected
      .filter((v) => !(data ?? []).some((it) => it.value === v))
      .map((v) => ({ value: v, label: v }));
    setItems([...extra, ...(data ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!onLoadData) return;
    setLoading(true);
    onLoadData(searchKeyword, loadCallback, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  const listProps = useMemo(
    () => ({
      onItemsRendered: ({ visibleStopIndex }) => {
        if (onLoadData && visibleStopIndex >= items.length - 1) {
          setLoading(true);
          onLoadData(searchKeyword, loadCallback, items.length);
        }
      },
    }),
    [onLoadData, items.length, searchKeyword, loadCallback]
  );

  const onSearch = useCallback(
    (newKeyword) => {
      if (onLoadData) setItems([]);
      setSearchKeyword(newKeyword);
      onSearchProp?.(newKeyword);
    },
    [onLoadData, onSearchProp]
  );

  // Multi-select: always (re)load on open so the user can keep adding options.
  const onOpen = useCallback(() => {
    onOpenProp?.();
    if (!preload) onLoadData?.("", loadCallback, 0);
  }, [onOpenProp, preload, onLoadData, loadCallback]);

  return {
    data: items,
    value: selected,
    loading,
    listProps,
    onSearch,
    onOpen,
    virtualized: !!onLoadData && disableVirtualized !== true,
  };
}

const RsTagPickerOverrideView = ({
  data,
  label,
  onLoadData,
  onSearch,
  onOpen,
  onChange,
  value,
  className,
  preload,
  disableVirtualized,
  itemsKey,
  foldFields,
  ...rest
}) => {
  const { loading, ...state } = useTagDropdownState({
    data,
    onLoadData,
    value,
    preload,
    disableVirtualized,
    onSearchProp: onSearch,
    onOpenProp: onOpen,
  });

  // foldFields arrives as JSON (a string prop): [{ path, key }] record fields to
  // fold into each saved object.
  const fold = useMemo(() => {
    if (!foldFields) return [];
    try { return JSON.parse(foldFields); } catch { return []; }
  }, [foldFields]);

  // Latest loaded options, so the items array can be rebuilt on every change.
  const optionsRef = useRef([]);
  optionsRef.current = state.data;

  // Re-validate on change so a "Required" error clears once a value is picked
  // (mirrors rsDropdownOverride). Also rebuild the companion `${key}__items`
  // array of { id, label, …recordFields } objects from the current selection.
  const componentData = useComponentData();
  const handleChange = useCallback(
    (newValue, ...args) => {
      onChange?.(newValue, ...args);
      const field = componentData?.field;
      if (field) {
        field.setTouched();
        field.validate?.();
      }
      if (itemsKey && componentData) {
        try {
          const root = componentData.rootData;
          if (root) root[itemsKey] = rebuildSelectedItems(newValue, optionsRef.current, fold);
        } catch {
          /* rootData not writable in this context — ids are still saved */
        }
      }
    },
    [onChange, componentData, itemsKey, fold]
  );

  const pickerRef = useRef(null);
  const renderMenu = useCallback(
    (menu) => (
      <>
        {menu}
        {loading && <LoaderWrapper />}
      </>
    ),
    [loading]
  );

  return (
    <Labeled className={className} role="group">
      {label && <label>{label}</label>}
      <TagPicker
        ref={pickerRef}
        {...rest}
        {...state}
        onChange={handleChange}
        renderMenu={renderMenu}
        block
      />
    </Labeled>
  );
};

const placement = oneOf(
  "bottomStart",
  "bottomEnd",
  "topStart",
  "topEnd",
  "leftStart",
  "rightStart",
  "leftEnd",
  "rightEnd"
);
const size = oneOf("xs", "sm", "md", "lg").default("md");

export const rsTagPickerOverride = define(RsTagPickerOverrideView, "RsTagPicker")
  .name("TagPicker")
  .props({
    label: string.default("Select"),
    value: array.valued.ofString,
    placeholder: string,
    placement,
    size,
    data: array.default(toLabeledValues(["a", "b", "c"])),
    cleanable: boolean.default(true),
    creatable: boolean.default(false),
    disabled: boolean.default(false),
    readOnly: boolean.default(false),
    disableVirtualized: boolean,
    preload: boolean.default(false),
    // Where to write the array of selected { id, label, …recordFields } objects,
    // and (as JSON) which record fields to fold in. Set by exportJSON for
    // master-data multi-selects; absent for plain/fixed tag pickers (no-op).
    itemsKey: string,
    foldFields: string,
    onLoadData: event,
    onSelect: event,
    onClean: event,
    onClose: event,
    onCreate: event,
    onChange: event,
    onSearch: event,
    onOpen: event,
  });
