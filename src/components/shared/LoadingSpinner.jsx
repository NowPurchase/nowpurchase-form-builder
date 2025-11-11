import "./LoadingSpinner.css";

export default function LoadingSpinner({ size = "medium", text = "Loading..." }) {
  return (
    <div className="loading-spinner-container">
      <div className={`spinner spinner-${size}`}></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}

