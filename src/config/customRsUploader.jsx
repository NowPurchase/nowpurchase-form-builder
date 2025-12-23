/* @refresh reset */
/**
 * Custom RsCameraCapture Component
 * A mobile-optimized camera capture component
 * Forces camera-only capture (no file selection from gallery)
 * Uses capture="environment" to open the rear-facing camera on mobile devices
 */

import {
  define,
  array,
  boolean,
  event,
  string,
  oneOf,
  disabled,
  node,
} from "@react-form-builder/core";
import { useRef, useEffect, useMemo } from "react";
import { Uploader } from "rsuite";

/**
 * Camera Capture Component - Mobile optimized, camera-only (no file selection)
 */
const CameraCaptureComponent = ({
  customElement,
  children,
  disabled: isDisabled,
  multiple,
  fileList,
  className,
  label,
  accept = "image/*",
  ...rest
}) => {
  const uploaderRef = useRef(null);

  useEffect(() => {
    const inputElement = uploaderRef.current?.root?.querySelector(
      'input[type="file"]'
    );

    if (inputElement) {
      // Force camera capture only (no file selection)
      inputElement.setAttribute("capture", "environment");
      inputElement.setAttribute("accept", accept);

      // Set tabIndex if not already set
      if (!inputElement.hasAttribute("tabIndex")) {
        inputElement.setAttribute("tabIndex", "-1");
      }
    }
  }, [accept]);

  const shouldAllowUpload = useMemo(
    () => (multiple ? true : !(fileList && fileList.length > 0)),
    [fileList, multiple]
  );

  const effectiveDisabled = useMemo(
    () => isDisabled || !shouldAllowUpload,
    [isDisabled, shouldAllowUpload]
  );

  return (
    <div className={className} style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 500,
            fontSize: '14px',
            color: '#575757',
          }}
        >
          {label}
        </label>
      )}
      <Uploader
        {...rest}
        accept={accept}
        disabled={effectiveDisabled}
        multiple={multiple}
        fileList={fileList}
        ref={uploaderRef}
        draggable={false}
        style={{
          width: '100%',
        }}
      >
        {customElement ? (
          <div>{children}</div>
        ) : (
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              background: effectiveDisabled ? '#f5f5f5' : '#ffffff',
              color: effectiveDisabled ? '#bfbfbf' : '#262626',
              fontSize: '14px',
              fontWeight: 500,
              cursor: effectiveDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              minHeight: '44px',
            }}
            disabled={effectiveDisabled}
            onMouseEnter={(e) => {
              if (!effectiveDisabled) {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.color = '#1890ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!effectiveDisabled) {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.color = '#262626';
              }
            }}
            onTouchStart={(e) => {
              if (!effectiveDisabled) {
                e.currentTarget.style.transform = 'scale(0.98)';
                e.currentTarget.style.borderColor = '#1890ff';
              }
            }}
            onTouchEnd={(e) => {
              if (!effectiveDisabled) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#d9d9d9';
              }
            }}
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

/**
 * RsCameraCapture component definition - Mobile optimized camera-only capture
 * Forces camera capture, no file selection from gallery
 */
export const rsCameraCapture = define(
  CameraCaptureComponent,
  "RsCameraCapture"
)
  .name("CameraCapture")
  .category("form")
  .props({
    label: string,
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
