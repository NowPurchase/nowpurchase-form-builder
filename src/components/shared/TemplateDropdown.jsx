import { useState, useEffect, useRef, memo } from "react";
import "./TemplateDropdown.css";

function TemplateDropdown({ value, onChange, onSelect, placeholder = "Select template...", excludeIds = [], templates = [] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTemplates = templates.filter(
    (template) =>
      template.template_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !excludeIds.includes(template.id)
  );

  const selectedTemplate = templates.find((t) => t.id === value);
  const displayName = selectedTemplate ? selectedTemplate.template_name : placeholder;
  const isPlaceholder = !selectedTemplate;

  const handleSelect = (template) => {
    if (onChange) {
      onChange(template.id);
    }
    if (onSelect) {
      onSelect(template);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={`template-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      <div
        className="template-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={isPlaceholder ? "placeholder-text" : ""}>
          {displayName}
        </span>
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div className="template-dropdown-menu">
          <div className="template-search">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="template-search-input"
            />
          </div>

          {filteredTemplates.length > 0 ? (
            <div className="template-dropdown-list">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-dropdown-item ${
                    value === template.id ? "selected" : ""
                  } ${excludeIds.includes(template.id) ? "disabled" : ""}`}
                  onClick={() => handleSelect(template)}
                >
                  {template.template_name}
                  {excludeIds.includes(template.id) && (
                    <span className="already-selected-badge">Selected</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="template-dropdown-empty">No templates found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TemplateDropdown);
