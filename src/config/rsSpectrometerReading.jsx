/* @refresh reset */
/**
 * Custom RsSpectrometerReading Component
 * A real-time spectrometer reading display component that connects to WebSocket
 * Shows chemical element readings with color-coded status indicators
 */

import {
  define,
  string,
  boolean,
  number,
  object,
  event,
} from "@react-form-builder/core";
import { useState, useEffect, useCallback, useMemo } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "./rsSpectrometerReading.css";

/**
 * Connection Status Chip Component
 */
const ConnectionStatusChip = ({ readyState }) => {
  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Connected",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const statusColors = {
    [ReadyState.CONNECTING]: "#3498db",
    [ReadyState.OPEN]: "#27ae60",
    [ReadyState.CLOSING]: "#e74c3c",
    [ReadyState.CLOSED]: "#95a5a6",
    [ReadyState.UNINSTANTIATED]: "#777",
  }[readyState];

  return (
    <div
      className="spectro-connection-chip"
      style={{ backgroundColor: `${statusColors}20` }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
      >
        <path
          d="M4.16667 9.16667H15.8333V4.16667H4.16667V9.16667ZM17.5 3.33333V16.6667C17.5 17.1269 17.1269 17.5 16.6667 17.5H3.33333C2.8731 17.5 2.5 17.1269 2.5 16.6667V3.33333C2.5 2.8731 2.8731 2.5 3.33333 2.5H16.6667C17.1269 2.5 17.5 2.8731 17.5 3.33333ZM15.8333 10.8333H4.16667V15.8333H15.8333V10.8333ZM5.83333 12.5H8.33333V14.1667H5.83333V12.5ZM5.83333 5.83333H8.33333V7.5H5.83333V5.83333Z"
          fill={statusColors}
        />
      </svg>
      <span style={{ color: statusColors, fontSize: "12px", fontWeight: 500 }}>
        {connectionStatus}
      </span>
    </div>
  );
};

/**
 * Red Arrow indicator for out-of-range values
 */
const RedArrow = ({ up, down }) => {
  if (up) {
    return (
      <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_up)">
          <path d="M8.9914 5.219L8.9914 13.3337H7.60812L7.60812 5.219L3.89815 8.79499L2.92017 7.85232L8.29976 2.667L13.6794 7.85232L12.7014 8.79499L8.9914 5.219Z" fill="#E43E2B"/>
        </g>
        <defs>
          <clipPath id="clip0_up">
            <rect width="16.5994" height="16" fill="white"/>
          </clipPath>
        </defs>
      </svg>
    );
  }
  if (down) {
    return (
      <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_down)">
          <path d="M8.9914 10.781L8.9914 2.66634H7.60812L7.60812 10.781L3.89815 7.20501L2.92017 8.14768L8.29976 13.333L13.6794 8.14768L12.7014 7.20501L8.9914 10.781Z" fill="#E43E2B"/>
        </g>
        <defs>
          <clipPath id="clip0_down">
            <rect width="16.5994" height="16" fill="white" transform="matrix(1 0 0 -1 0 16)"/>
          </clipPath>
        </defs>
      </svg>
    );
  }
  return null;
};

/**
 * Element Box Component - displays a single element reading
 */
const ElementBox = ({
  element,
  value,
  range,
  inRange,
  inTolerance,
  deviation,
}) => {
  // Determine CSS class based on range status
  const getRangeClass = () => {
    if (inRange === true) return "in-range";
    if (inTolerance === true) return "in-tolerance";
    if (inRange === false) return "out-of-range";
    return "no-range";
  };

  return (
    <div className={`spectro-element-box ${getRangeClass()}`}>
      <div className="spectro-element-content">
        <div className="spectro-element-header">
          <span className="spectro-element-symbol">{element}</span>
          {inRange === false && (
            <RedArrow up={parseFloat(deviation) > 0} down={parseFloat(deviation) < 0} />
          )}
        </div>
        <span className="spectro-element-value">{value}</span>
      </div>
      <div className="spectro-element-footer">
        <span className="spectro-element-range">{range}</span>
      </div>
    </div>
  );
};

/**
 * Chunk array into rows
 */
const chunk = (arr, size) => {
  const numSize = parseInt(size, 10) || 4;
  if (numSize <= 0 || !arr || arr.length === 0) return [];
  return Array.from({ length: Math.ceil(arr.length / numSize) }, (_, i) =>
    arr.slice(i * numSize, i * numSize + numSize)
  );
};

/**
 * Parse element range string to min/max
 */
const parseElementRange = (chemistry) => {
  if (!chemistry) return [];

  return chemistry.map((item) => {
    const range = item.ele_range;
    let min = null;
    let max = null;

    if (range) {
      const parts = range.split("-");
      if (parts.length === 2) {
        const minVal = parseFloat(parts[0]);
        const maxVal = parseFloat(parts[1]);
        min = isNaN(minVal) ? null : minVal;
        max = isNaN(maxVal) ? null : maxVal;
      } else if (parts.length === 1) {
        const maxVal = parseFloat(parts[0]);
        max = isNaN(maxVal) ? null : maxVal;
      }
    }

    return { ...item, min, max };
  });
};

/**
 * Spectrometer Reading Component
 */
const SpectrometerReadingComponent = ({
  label = "Spectrometer Reading",
  url = "",
  columnsPerRow = 4,
  showConnectionStatus = true,
  elements = "C,Si,Mn,S,P,Cr,Cu,Ni",
  value = {},
  onChange,
  className,
}) => {

  // Parse comma-separated elements string into array
  const elementsList = useMemo(() =>
    elements
      ? elements.split(",").map((e) => e.trim()).filter(Boolean)
      : [],
    [elements]
  );
  const [readings, setReadings] = useState([]);
  const [gradeTc, setGradeTc] = useState([]);
  const [bathTc, setBathTc] = useState([]);

  // WebSocket URL from prop
  const wsUrl = url || null;

  // WebSocket connection
  const { lastJsonMessage, readyState } = useWebSocket(
    wsUrl,
    {
      shouldReconnect: () => true,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
      onError: (err) => console.warn("[Spectrometer] Connection Error:", err),
      retryOnError: true,
      onClose: () => console.warn("[Spectrometer] Connection closed"),
    },
    !!wsUrl
  );

  // Build form data from readings - calls onChange with flattened data
  const setFormData = useCallback((heatData, readingsData, gradeTargetChemistry, bathTargetChemistry) => {
    const formData = {};

    readingsData.forEach((reading, index) => {
      const prefix = `${index}`;

      // Heat info
      formData[`${prefix}__heat_id`] = heatData.id || "";
      formData[`${prefix}__heat_name`] = heatData.heat_name || "";
      formData[`${prefix}__heat_date`] = heatData.heat_date || "";

      // Reading info
      formData[`${prefix}__reading_id`] = reading.id || "";
      formData[`${prefix}__sample_type`] = reading.sample_type || "";
      formData[`${prefix}__reading_created_at`] = reading.reading_created_at || "";

      // Element values with __ notation
      if (reading.reading_avg) {
        reading.reading_avg.forEach((element) => {
          const symbol = element.element_symbol;
          formData[`${prefix}__elements__${symbol}__value`] = element.recovery_rate ?? "";
          formData[`${prefix}__elements__${symbol}__in_range`] = element.in_range ?? false;
          formData[`${prefix}__elements__${symbol}__in_tolerance`] = element.in_tolerance ?? false;
          formData[`${prefix}__elements__${symbol}__deviation`] = element.deviation ?? "";

          // Add min/max from target chemistry (only if they exist)
          const isBath = reading.sample_type === "Bath";
          const targetChem = isBath && bathTargetChemistry?.length > 0
            ? bathTargetChemistry.find((e) => e.element__symbol === symbol)
            : gradeTargetChemistry?.find((e) => e.element__symbol === symbol);

          if (targetChem?.min != null) {
            formData[`${prefix}__elements__${symbol}__min`] = targetChem.min;
          }
          if (targetChem?.max != null) {
            formData[`${prefix}__elements__${symbol}__max`] = targetChem.max;
          }
        });
      }
    });

    console.log("[Spectrometer] Form data set:", Object.keys(formData).length, "keys");

    // Call onChange to update form data
    if (onChange) {
      onChange(formData);
    }
  }, [onChange]);

  // Process incoming WebSocket data
  useEffect(() => {
    if (lastJsonMessage?.data) {
      // data is an array of heats, get the first one
      const data = Array.isArray(lastJsonMessage.data)
        ? lastJsonMessage.data[0]
        : lastJsonMessage.data;

      if (!data) return;

      // Get all readings
      const allReadings = data.readings || [];
      setReadings(allReadings);

      // Parse target chemistry
      const parsedGradeTc = data.cm_data?.cm_target_chemistry
        ? parseElementRange(data.cm_data.cm_target_chemistry)
        : [];
      const parsedBathTc = data.cm_data?.cm_bath_target_chemistry
        ? parseElementRange(data.cm_data.cm_bath_target_chemistry)
        : [];

      setGradeTc(parsedGradeTc);
      setBathTc(parsedBathTc);

      // Set form data with target chemistry for min/max
      setFormData(data, allReadings, parsedGradeTc, parsedBathTc);
    }
  }, [lastJsonMessage, setFormData]);

  // Get reading average with target chemistry filtering and element ordering
  const getReadingAvg = useCallback(
    (reading) => {
      const readingAvg = reading.reading_avg || [];

      // If elements prop is provided, filter and order by it
      if (elementsList && elementsList.length > 0) {
        return elementsList
          .map((symbol) => readingAvg.find((e) => e.element_symbol === symbol))
          .filter(Boolean);
      }

      // Fallback: filter by gradeTc
      return readingAvg.filter((element) => {
        return gradeTc.find((e) => e.element__symbol === element.element_symbol);
      });
    },
    [gradeTc, elementsList]
  );

  // Format range string
  const formatRange = (min, max) => {
    const hasMin = min != null && !isNaN(min);
    const hasMax = max != null && !isNaN(max);

    if (hasMin && hasMax) {
      return `${min}-${max}`;
    }
    if (hasMax) {
      return `${max} Max`;
    }
    if (hasMin) {
      return `${min} Min`;
    }
    return "-";
  };

  // Calculate range string for an element
  const getElementRange = useCallback(
    (reading, elementSymbol) => {
      const grade = gradeTc.find((e) => e.element__symbol === elementSymbol);
      const bath = bathTc.find((e) => e.element__symbol === elementSymbol);

      if (reading.sample_type === "Bath" && bathTc.length > 0 && bath) {
        return formatRange(bath.min, bath.max);
      }
      if (grade) {
        return formatRange(grade.min, grade.max);
      }
      return "-";
    },
    [gradeTc, bathTc]
  );

  // No URL configured
  if (!url) {
    return (
      <div className={`spectro-container ${className || ""}`}>
        <div className="spectro-header">
          <span className="spectro-label">{label}</span>
        </div>
        <div className="spectro-no-data">
          <span>No WebSocket URL configured</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`spectro-container ${className || ""}`}>
      <div className="spectro-header">
        <span className="spectro-label">{label}</span>
        {showConnectionStatus && <ConnectionStatusChip readyState={readyState} />}
      </div>

      {readings.length === 0 ? (
        <div className="spectro-no-data">
          <span>Waiting for readings...</span>
        </div>
      ) : (
        readings.map((reading, index) => {
          const readingAvg = getReadingAvg(reading);

          return (
            <div key={reading.id || index} className="spectro-reading-section">
              <div className="spectro-reading-header">
                <span className={`spectro-sample-type ${reading.sample_type?.toLowerCase() || ""}`}>
                  {reading.sample_type || "Bath"}
                </span>
                <span className="spectro-reading-number">
                  {index === 0 ? "Reading" : `Reading ${index + 1}`}
                </span>
              </div>

              <div className="spectro-elements-grid">
                {chunk(readingAvg, columnsPerRow).map((row, rowIndex) => (
                  <div key={rowIndex} className="spectro-elements-row">
                    {row.map((element, colIndex) => (
                      <div
                        key={colIndex}
                        className="spectro-element-col"
                        style={{ width: `${100 / (parseInt(columnsPerRow, 10) || 4)}%` }}
                      >
                        <ElementBox
                          element={element.element_symbol}
                          value={element.recovery_rate}
                          range={getElementRange(reading, element.element_symbol)}
                          inRange={element.in_range}
                          inTolerance={element.in_tolerance}
                          deviation={element.deviation}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

/**
 * RsSpectrometerReading component definition for FormEngine
 */
export const rsSpectrometerReading = define(
  SpectrometerReadingComponent,
  "RsSpectrometerReading"
)
  .name("SpectrometerReading")
  .category("spectrometer")
  .props({
    label: string.default("Spectrometer Reading"),
    url: string,
    columnsPerRow: number.default(4),
    showConnectionStatus: boolean.default(true),
    elements: string.default("C,Si,Mn,S,P,Cr,Cu,Ni"),
    value: object.valued.default({}),
    onChange: event,
  });
