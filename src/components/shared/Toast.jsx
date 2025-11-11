import { useState, useEffect } from "react";
import "./Toast.css";

let toastId = 0;
const toasts = [];
const listeners = [];

const notify = (message, type = "info", duration = 3000) => {
  const id = toastId++;
  const toast = { id, message, type, duration };
  toasts.push(toast);
  listeners.forEach((listener) => listener([...toasts]));
  
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
  
  return id;
};

const removeToast = (id) => {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
    listeners.forEach((listener) => listener([...toasts]));
  }
};

export const toast = {
  success: (message, duration) => notify(message, "success", duration),
  error: (message, duration) => notify(message, "error", duration),
  info: (message, duration) => notify(message, "info", duration),
  warning: (message, duration) => notify(message, "warning", duration),
};

export default function ToastContainer() {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const listener = (newToasts) => setToastList(newToasts);
    listeners.push(listener);
    setToastList([...toasts]);

    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  if (toastList.length === 0) return null;

  return (
    <div className="toast-container">
      {toastList.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

