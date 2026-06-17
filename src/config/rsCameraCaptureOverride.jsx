import { useRef, useEffect, useMemo } from "react";
import { Uploader } from "rsuite";
import {
  define,
  string,
  boolean,
  array,
  oneOf,
  event,
  node,
  disabled,
} from "@react-form-builder/core";

/**
 * Drop-in replacement for np-dlms-components' rsCameraCapture.
 *
 * The stock component hardcodes `capture="environment"` on its file input
 * (via a useEffect), which forces mobile browsers to open the rear camera
 * directly and gives the user no way to pick from the gallery or files.
 * There is no prop to control this.
 *
 * This version adds a `source` prop:
 *   - "camera" (default): keeps the original behavior — sets
 *     capture="environment", so the device opens the camera directly.
 *   - "any": omits the `capture` attribute, so the OS shows its native
 *     chooser (Camera / Photo Library / Files) and the user can take a
 *     photo OR pick an existing image.
 *
 * Note: `capture` is a mobile-only hint; desktop browsers always show a
 * file dialog. There is no standard way to force a "gallery only" source,
 * so gallery is offered (alongside camera/files) by the OS when source="any".
 *
 * Registered under the same type name "RsCameraCapture" so existing form
 * templates pick it up automatically.
 */
const RsCameraCaptureOverrideView = ({
  customElement,
  children,
  disabled: isDisabled,
  multiple,
  fileList,
  className,
  label,
  accept = "image/*",
  source = "camera",
  ...rest
}) => {
  const uploaderRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const inputElement = uploaderRef.current?.root?.querySelector(
      'input[type="file"]'
    );
    // --- TEMP DIAGNOSTIC ---
    if (containerRef.current) {
      containerRef.current.setAttribute(
        "data-input-found",
        String(!!inputElement)
      );
    }
    if (!inputElement) return;

    if (source === "any") {
      inputElement.removeAttribute("capture");
    } else {
      inputElement.setAttribute("capture", "environment");
    }
    inputElement.setAttribute("accept", accept);
    if (!inputElement.hasAttribute("tabIndex")) {
      inputElement.setAttribute("tabIndex", "-1");
    }
    // --- TEMP DIAGNOSTIC ---
    if (containerRef.current) {
      containerRef.current.setAttribute(
        "data-capture-attr",
        inputElement.getAttribute("capture") ?? "none"
      );
    }
  }, [accept, source]);

  const shouldAllowUpload = useMemo(
    () => (multiple ? true : !(fileList && fileList.length > 0)),
    [fileList, multiple]
  );
  const effectiveDisabled = useMemo(
    () => isDisabled || !shouldAllowUpload,
    [isDisabled, shouldAllowUpload]
  );

  return (
    <div
      ref={containerRef}
      className={`rs-camera-capture ${className || ""}`.trim()}
      data-source={source}
    >
      {label && <label className="rs-camera-capture__label">{label}</label>}
      <Uploader
        {...rest}
        accept={accept}
        disabled={effectiveDisabled}
        multiple={multiple}
        fileList={fileList}
        ref={uploaderRef}
        draggable={false}
        className="rs-camera-capture__uploader"
      >
        {customElement ? (
          <div>{children}</div>
        ) : (
          <button
            type="button"
            className="rs-camera-capture__capture-btn"
            disabled={effectiveDisabled}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Capture</span>
          </button>
        )}
      </Uploader>
    </div>
  );
};

export const rsCameraCaptureOverride = define(
  RsCameraCaptureOverrideView,
  "RsCameraCapture"
)
  .name("CameraCapture")
  .category("form")
  .props({
    label: string,
    source: oneOf("camera", "any").default("camera"),
    action: string.default("/"),
    accept: string.default("image/*"),
    autoUpload: boolean.default(true),
    customElement: boolean.default(false),
    children: node,
    disableMultipart: boolean.default(false),
    disabled: disabled.default(false),
    disabledFileItem: boolean.default(false),
    draggable: boolean.default(false),
    fileListVisible: boolean.default(true),
    listType: oneOf("text", "picture-text", "picture"),
    method: string,
    multiple: boolean.default(false),
    name: string,
    onChange: event,
    onError: event,
    onPreview: event,
    onProgress: event,
    onRemove: event,
    onReupload: event,
    onSuccess: event,
    onUpload: event,
    removable: boolean.default(false),
    timeout: string,
    withCredentials: boolean.default(false),
    fileList: array.valued,
  });
