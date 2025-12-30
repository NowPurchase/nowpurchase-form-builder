import { useState, useEffect, useRef, memo, useCallback } from "react";
import { getUsers } from "../../services/userApi";
import "./UserDropdown.css";

function UserDropdown({ value, onChange, onSelect, placeholder = "Search and select user...", excludeIds = [], selectedUserData = null }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const requestCounterRef = useRef(0);

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

  // Fetch users when dropdown opens or search query changes
  const fetchUsers = useCallback(async (search = '') => {
    // Increment request counter and store current request ID
    requestCounterRef.current += 1;
    const currentRequestId = requestCounterRef.current;

    try {
      setLoading(true);
      const fetchedUsers = await getUsers(search);

      // Only update state if this is still the latest request
      if (currentRequestId === requestCounterRef.current) {
        setUsers(fetchedUsers);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Only update state if this is still the latest request
      if (currentRequestId === requestCounterRef.current) {
        setUsers([]);
        setLoading(false);
      }
    }
  }, []);

  // Fetch users when dropdown opens or search query changes
  useEffect(() => {
    if (!isOpen) return;

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search (500ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, isOpen, fetchUsers]);

  const filteredUsers = users.filter(
    (user) => !excludeIds.some(id => String(id) === String(user.id))
  );

  const getDisplayName = (user) => {
    if (!user) return placeholder;
    const name = user.name || 'Unnamed User';
    return user.email ? `${name} (${user.email})` : name;
  };
  const displayName = getDisplayName(selectedUserData);
  const isPlaceholder = !selectedUserData;

  const handleSelect = (user) => {
    if (onChange) {
      onChange(user.id);
    }
    if (onSelect) {
      onSelect(user);
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
    <div className={`user-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      <div
        className="user-dropdown-trigger"
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
          className="user-dropdown-menu"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 99999
          }}
        >
          <div className="user-search">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="user-search-input"
              autoFocus
            />
          </div>

          {loading ? (
            <div className="user-dropdown-loading">Loading users...</div>
          ) : filteredUsers.length > 0 ? (
            <div className="user-dropdown-list">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`user-dropdown-item ${
                    String(value) === String(user.id) ? "selected" : ""
                  }`}
                  onClick={() => handleSelect(user)}
                >
                  <div className="user-info">
                    <div className="user-name">{user.name || 'Unnamed User'}</div>
                    {user.email && <div className="user-email">{user.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="user-dropdown-empty">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(UserDropdown);
