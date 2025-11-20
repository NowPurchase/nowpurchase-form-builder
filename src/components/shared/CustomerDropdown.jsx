import { useState, useEffect, useRef, useCallback } from "react";
import { getCustomerDropdown } from "../../services/dynamicLogApi";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "./Toast";
import "./CustomerDropdown.css";

export default function CustomerDropdown({ value, onChange, onSelect, placeholder = "Select customer...", initialCustomerName }) {
  console.log('[CustomerDropdown] Props received:', {
    value,
    initialCustomerName,
    placeholder,
    hasOnChange: !!onChange,
    hasOnSelect: !!onSelect
  });
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const hasFetchedInitialRef = useRef(false);

  const fetchCustomers = useCallback(async (query = "") => {
    try {
      setLoading(true);
      const response = await getCustomerDropdown(query);
      // API returns an array directly, not wrapped in an object
      const customersList = Array.isArray(response) ? response : (response.customers || []);
      // Map API response to component format (id -> customer_id for consistency)
      const mappedCustomers = customersList.map(customer => ({
        customer_id: customer.id,
        customer_name: customer.customer_name
      }));
      setCustomers(mappedCustomers);
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      toast.error(`Failed to load customers: ${errorMsg}`);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect - only when dropdown is open and user enters a query
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery === "") {
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      fetchCustomers(trimmedQuery);
    }, 500); // 500ms debounce delay

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, searchQuery, fetchCustomers]);

  // Fetch customers when dropdown opens (single initial fetch)
  useEffect(() => {
    if (isOpen) {
      if (!hasFetchedInitialRef.current && !loading) {
        hasFetchedInitialRef.current = true;
        fetchCustomers("");
      }
    } else {
      hasFetchedInitialRef.current = false;
      setSearchQuery("");
    }
  }, [isOpen, loading, fetchCustomers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCustomer = customers.find((c) => c.customer_id === value);
  
  // Use selected customer from list, or initialCustomerName if provided, or placeholder
  const displayName = selectedCustomer 
    ? selectedCustomer.customer_name 
    : (value && initialCustomerName ? initialCustomerName : placeholder);
  const isPlaceholder = !selectedCustomer && (!value || !initialCustomerName);
  
  console.log('[CustomerDropdown] Display logic:', {
    selectedCustomer: selectedCustomer?.customer_name || 'none',
    value,
    initialCustomerName,
    displayName,
    isPlaceholder,
    customersCount: customers.length
  });

  const handleSelect = (customer) => {
    onChange(customer.customer_id);
    if (onSelect) {
      onSelect(customer);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={`customer-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      <div
        className="customer-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={isPlaceholder ? "placeholder-text" : ""}>
          {displayName}
        </span>
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div className="customer-dropdown-menu">
          <div className="customer-search">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="customer-search-input"
            />
          </div>

          {loading ? (
            <div className="customer-dropdown-loading">Loading...</div>
          ) : customers.length > 0 ? (
            <div className="customer-dropdown-list">
              {customers.map((customer) => (
                <div
                  key={customer.customer_id}
                  className={`customer-dropdown-item ${
                    value === customer.customer_id ? "selected" : ""
                  }`}
                  onClick={() => handleSelect(customer)}
                >
                  {customer.customer_name}
                </div>
              ))}
            </div>
          ) : (
            <div className="customer-dropdown-empty">No customers found</div>
          )}
        </div>
      )}
    </div>
  );
}

