import { useState, useEffect, useRef, memo } from "react";
import "./TemplateDropdown.css";

function TemplateDropdown({ value, onChange, onSelect, placeholder = "Select template...", excludeIds = [], templates = [] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Close dropdown when page scrolls (but not when scrolling inside dropdown)
    const handleScroll = (event) => {
      // Don't close if scrolling inside the dropdown menu
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      if (isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    if (isOpen) {
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const filteredTemplates = templates.filter(
    (template) =>
      template?.template_name?.toLowerCase()?.includes(searchQuery.toLowerCase()) &&
      !excludeIds.some(id => String(id) === String(template.id))
  );

  const selectedTemplate = templates.find((t) => t.id === value);
  const getDisplayName = (template) => {
    if (!template) return placeholder;
    const name = template.template_name || 'Unnamed Template';
    return template.version
      ? `${name} (v${template.version})`
      : name;
  };
  const displayName = getDisplayName(selectedTemplate);
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

  const handleTriggerClick = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`template-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      <div
        className="template-dropdown-trigger"
        ref={triggerRef}
        onClick={handleTriggerClick}
      >
        <span className={isPlaceholder ? "placeholder-text" : ""}>
          {displayName}
        </span>
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div
          className="template-dropdown-menu"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 99999
          }}
        >
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
                  }`}
                  onClick={() => handleSelect(template)}
                >
                  {getDisplayName(template)}
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
