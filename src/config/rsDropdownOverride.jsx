import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { InputPicker, Loader } from "rsuite";
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

/**
 * Drop-in replacement for @react-form-builder/components-rsuite's RsDropdown.
 *
 * The stock component's search hook does:
 *   useEffect(() => { if (searchKeyword) onLoadData(searchKeyword, cb, 0); }, [searchKeyword]);
 * which means backspacing to empty clears the items list and never refetches,
 * leaving the dropdown blank until the picker is closed and reopened.
 *
 * This version always invokes onLoadData when the keyword changes (including ""),
 * so the list reloads after a backspace-to-empty.
 *
 * Registered under the same type name "RsDropdown" so existing form templates
 * pick it up automatically.
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

/**
 * Mirrors the stock `Labeled` wrapper from @react-form-builder/components-rsuite,
 * which isn't exported from the package's public API. The framework adds the
 * `required` class to the component's className when a `required` validation
 * rule exists; the `&.required > label::after` rule turns that class into the
 * red asterisk, matching the behavior of other fields (e.g. RsNumberFormat).
 */
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

function useDropdownState({
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

  const isSelectedValue = useCallback((it) => it.value === value, [value]);

  const loadCallback = useCallback(
    (newItems) => {
      let existing = items;
      if (value && newItems.some(isSelectedValue)) {
        existing = items.filter((it) => !isSelectedValue(it));
      }
      setItems([...existing, ...newItems]);
      setLoading(false);
    },
    [items, isSelectedValue, value]
  );

  useEffect(() => {
    if (preload) onLoadData?.("", loadCallback, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload, onLoadData]);

  useEffect(() => {
    const extra =
      value && !data?.some(isSelectedValue) ? [{ value, label: value }] : [];
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

  const onOpen = useCallback(() => {
    onOpenProp?.();
    if (!value && !preload) onLoadData?.("", loadCallback, 0);
  }, [onOpenProp, value, preload, onLoadData, loadCallback]);

  const onCreate = useCallback(
    (_value, item) => {
      setItems([item, ...items]);
      setSearchKeyword("");
    },
    [items]
  );

  return {
    data: items,
    value,
    loading,
    listProps,
    onSearch,
    onOpen,
    onCreate,
    virtualized: !!onLoadData && disableVirtualized !== true,
  };
}

const RsDropdownOverrideView = ({
  data,
  label,
  onLoadData,
  onSearch,
  onOpen,
  onChange,
  value = "",
  className,
  preload,
  disableVirtualized,
  ...rest
}) => {
  const { loading, ...state } = useDropdownState({
    data,
    onLoadData,
    value,
    preload,
    disableVirtualized,
    onSearchProp: onSearch,
    onOpenProp: onOpen,
  });

  // The framework's injected onChange updates the stored value but does not
  // re-run validation, so a "Required" error stays visible after a value is
  // picked (or reappears correctly when cleared). Mark the field touched and
  // re-validate on every value change so the error state stays in sync.
  const componentData = useComponentData();
  const handleChange = useCallback(
    (newValue, ...args) => {
      onChange?.(newValue, ...args);
      const field = componentData?.field;
      if (field) {
        field.setTouched();
        field.validate?.();
      }
    },
    [onChange, componentData]
  );

  const pickerRef = useRef(null);
  useEffect(() => {
    const input = pickerRef.current?.root?.querySelector(
      "input.rs-picker-search-input"
    );
    if (input && !input.hasAttribute("aria-hidden")) {
      input.setAttribute("aria-hidden", "true");
    }
  }, []);

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
      <InputPicker
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

export const rsDropdownOverride = define(RsDropdownOverrideView, "RsDropdown")
  .name("Dropdown")
  .props({
    label: string.default("Select"),
    value: string.valued,
    placeholder: string,
    placement,
    size,
    data: array.default(toLabeledValues(["a", "b", "c"])),
    cleanable: boolean.default(true),
    creatable: boolean.default(false),
    disabled: boolean.default(false),
    readOnly: boolean.default(false),
    groupBy: string.default(""),
    disableVirtualized: boolean,
    preload: boolean.default(false),
    onLoadData: event,
    onSelect: event,
    onClean: event,
    onClose: event,
    onCreate: event,
    onChange: event,
    onSearch: event,
    onOpen: event,
  });
