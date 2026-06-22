import { useRef, useMemo, useEffect } from "react";
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
 * Renders a distinct camera-icon "Capture" button as rsuite's Uploader trigger
 * (so the native click -> hidden <input type="file"> wiring is handled by
 * rsuite; reliable on Android). A useEffect configures that input the same way
 * the stock RsUploader does (aria-hidden + tabIndex), and the `allowGallery`
 * prop decides the source:
 *   - allowGallery = false (default): sets `capture="environment"`, so the
 *     device camera opens directly (Capture behaviour, no gallery).
 *   - allowGallery = true: no `capture`, mimicking the stock Upload button, so
 *     on a phone the OS picker offers BOTH the camera and the gallery (Photo
 *     Library / Files) from one tap.
 *
 * `capture` is a mobile-only hint; desktop browsers ignore it and show a
 * normal file dialog regardless.
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
  allowGallery = false,
  ...rest
}) => {
  const uploaderRef = useRef(null);

  // Same input setup as the stock RsUploader (aria-hidden + tabIndex on the
  // hidden file input), then gate the source with `allowGallery`:
  //   - true:  no `capture` — identical to stock, so the OS chooser opens
  //            BOTH the camera and the gallery.
  //   - false: `capture="environment"` — opens the device camera directly.
  useEffect(() => {
    const input = uploaderRef.current?.root?.querySelector(
      'input[type="file"]'
    );
    if (!input) return;
    if (!input.hasAttribute("aria-hidden")) {
      input.setAttribute("aria-hidden", "true");
    }
    if (!input.hasAttribute("tabIndex")) {
      input.setAttribute("tabIndex", "-1");
    }
    if (allowGallery) {
      // Exact stock Upload-button config: no capture AND no accept filter. On
      // Android 13+ `accept="image/*"` forces the gallery-only Photo Picker;
      // clearing it lets the OS show the full chooser (Camera + gallery),
      // exactly like the Upload button.
      input.removeAttribute("capture");
      input.removeAttribute("accept");
    } else {
      // Camera: `capture` is ignored when `multiple` is also present (it falls
      // back to the gallery), so strip `multiple` to guarantee it opens.
      input.setAttribute("capture", "environment");
      input.setAttribute("accept", accept);
      input.removeAttribute("multiple");
    }
  }, [allowGallery, multiple, accept]);

  const shouldAllowUpload = useMemo(
    () => (multiple ? true : !(fileList && fileList.length > 0)),
    [fileList, multiple]
  );
  const effectiveDisabled = useMemo(
    () => isDisabled || !shouldAllowUpload,
    [isDisabled, shouldAllowUpload]
  );

  // Always the distinct "Capture" button (look never changes). The behaviour
  // is driven by the `capture` attribute in the effect above: allowGallery
  // false -> camera; true -> no capture, mimicking the Upload button.
  const trigger = customElement ? (
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
  );

  return (
    <div className={`rs-camera-capture ${className || ""}`.trim()}>
      {label && <label className="rs-camera-capture__label">{label}</label>}
      <Uploader
        {...rest}
        accept={allowGallery ? undefined : accept}
        disabled={effectiveDisabled}
        multiple={multiple}
        fileList={fileList}
        ref={uploaderRef}
        draggable={false}
        className="rs-camera-capture__uploader"
      >
        {trigger}
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
    allowGallery: boolean.default(false),
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
