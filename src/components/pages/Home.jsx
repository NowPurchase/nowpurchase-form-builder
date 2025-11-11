import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { listDynamicLogs } from "../../services/dynamicLogApi";
import { apiToLocal } from "../../utils/dataTransform";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import LoadingSpinner from "../shared/LoadingSpinner";
import { X, Search, ChevronUp, ChevronDown, Copy, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import "./Home.css";

function Home({ onLogout }) {
  const navigate = useNavigate();
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    count: 0,
    next: null,
    previous: null,
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchForms = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        page_size: pagination.page_size,
        ...(statusFilter && { status: statusFilter }),
      };

      const response = await listDynamicLogs(params);
      
      // Handle both array response and paginated response
      let formsList = [];
      let paginationData = {
        count: 0,
        next: null,
        previous: null,
      };

      if (Array.isArray(response)) {
        // API returns array directly
        const totalCount = response.length;
        const pageSize = pagination.page_size;
        
        // Case 1: API returns all items (more than page_size) - do client-side pagination
        if (totalCount > pageSize) {
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          formsList = response.slice(startIndex, endIndex);
          
          const totalPages = Math.ceil(totalCount / pageSize);
          paginationData = {
            count: totalCount,
            next: page < totalPages ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
          };
        } 
        // Case 2: API returns exactly page_size items - assume backend paginated correctly
        // Enable Next button if we got exactly page_size items (might be more pages)
        else if (totalCount === pageSize) {
          formsList = response;
          paginationData = {
            count: totalCount, // Approximate - backend should provide total count
            next: `page=${page + 1}`, // Assume there might be more
            previous: page > 1 ? `page=${page - 1}` : null,
          };
        }
        // Case 3: API returns fewer than page_size - we're on last page
        else {
          formsList = response;
          paginationData = {
            count: totalCount,
            next: null,
            previous: page > 1 ? `page=${page - 1}` : null,
          };
        }
      } else if (response.results) {
        // Paginated response
        formsList = response.results;
        const totalCount = response.count || 0;
        const pageSize = pagination.page_size;
        
        // If API doesn't provide next/previous URLs, calculate them client-side
        // This handles cases where API paginates but doesn't return pagination metadata
        if ((response.next === null || response.next === undefined) && 
            (response.previous === null || response.previous === undefined) &&
            totalCount > 0) {
          const totalPages = Math.ceil(totalCount / pageSize);
          paginationData = {
            count: totalCount,
            next: page < totalPages ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
          };
        } else {
          // Use API-provided pagination URLs
          paginationData = {
            count: totalCount,
            next: response.next,
            previous: response.previous,
          };
        }
      }
      
      const transformedForms = formsList.map(apiToLocal);
      setAllForms(transformedForms);
      setPagination((prev) => ({
        page: page,
        page_size: prev.page_size,
        ...paginationData,
      }));
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      setError(errorMsg);
      toast.error(errorMsg);
      setAllForms([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.page_size]);

  useEffect(() => {
    fetchForms(1);
  }, [fetchForms]);

  const filteredForms = useMemo(() => {
    let filtered = [...allForms];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((form) => {
        const formName = String(form["from-name"] || "").toLowerCase();
        const formId = String(form.form_id || "").toLowerCase();
        const customerName = String(form.customer_name || "").toLowerCase();
        const templateName = String(form.template_name || "").toLowerCase();
        
        return (
          formName.includes(query) ||
          formId.includes(query) ||
          customerName.includes(query) ||
          templateName.includes(query)
        );
      });
    }

    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case "name":
          aValue = String(a["from-name"] || "").toLowerCase();
          bValue = String(b["from-name"] || "").toLowerCase();
          break;
        case "customer_name":
          aValue = String(a.customer_name || "").toLowerCase();
          bValue = String(b.customer_name || "").toLowerCase();
          break;
        case "form_id":
          // form_id is a number, convert to string for comparison
          aValue = String(a.form_id || "").toLowerCase();
          bValue = String(b.form_id || "").toLowerCase();
          break;
        case "created_at":
        default:
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
      }
      return sortOrder === "asc" 
        ? (aValue > bValue ? 1 : aValue < bValue ? -1 : 0)
        : (aValue < bValue ? 1 : aValue > bValue ? -1 : 0);
    });

    return filtered;
  }, [allForms, searchQuery, sortBy, sortOrder]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleNewForm = () => {
    navigate("/new-form");
  };

  const handleRowClick = (form) => {
    navigate(`/form/${form.form_id}`);
  };

  const handleDuplicate = (e, form) => {
    e.stopPropagation(); // Prevent row click
    // Navigate to duplicate form page - will auto-open save modal
    navigate(`/new-form?duplicate=${form.form_id}`);
  };

  const handleEdit = (e, form) => {
    e.stopPropagation(); // Prevent row click
    // Navigate to edit form page
    navigate(`/new-form?edit=${form.form_id}`);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
  };

  const removeFilter = (filterKey) => {
    if (filterKey === "search") {
      setSearchQuery("");
    } else if (filterKey === "status") {
      setStatusFilter("");
    }
  };

  const getActiveFilterChips = () => {
    const chips = [];
    if (searchQuery) {
      chips.push({ key: "search", label: `Search: "${searchQuery}"`, value: searchQuery });
    }
    if (statusFilter) {
      chips.push({ key: "status", label: `Status: ${statusFilter}`, value: statusFilter });
    }
    return chips;
  };

  const handlePageChange = (newPage) => {
    fetchForms(newPage);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to descending
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) {
      return <ChevronDown size={14} className="sort-icon-inactive" />;
    }
    return sortOrder === "asc" 
      ? <ChevronUp size={14} className="sort-icon-active" />
      : <ChevronDown size={14} className="sort-icon-active" />;
  };

  const hasActiveFilters = searchQuery || statusFilter;

  if (loading && allForms.length === 0) {
    return (
      <div className="home-container">
        <div className="home-header">
          <h1>Dynamic Form Engine</h1>
        </div>
        <LoadingSpinner text="Loading forms..." />
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Dynamic Form Engine</h1>
        <div className="header-actions">
          <button onClick={handleNewForm} className="new-form-button">
            + New form
          </button>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
      <div className="home-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => fetchForms(pagination.page)}>Retry</button>
          </div>
        )}

        <div className="search-filters-container">
          <div className="filters-row">
            <div className="search-box">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="clear-search-btn"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="status-toggle-buttons">
              <button
                onClick={() => setStatusFilter("")}
                className={`status-toggle-btn ${statusFilter === "" ? "active" : ""}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`status-toggle-btn ${statusFilter === "draft" ? "active" : ""}`}
              >
                Draft
              </button>
              <button
                onClick={() => setStatusFilter("completed")}
                className={`status-toggle-btn ${statusFilter === "completed" ? "active" : ""}`}
              >
                Completed
              </button>
            </div>
          </div>
          {getActiveFilterChips().length > 0 && (
            <div className="active-filters-chips">
              {getActiveFilterChips().map((chip) => (
                <div key={chip.key} className="filter-chip">
                  <span className="chip-label">{chip.label}</span>
                  <button
                    onClick={() => removeFilter(chip.key)}
                    className="chip-remove"
                    aria-label={`Remove ${chip.key} filter`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={handleClearFilters} className="clear-all-chips-btn">
                Clear all
              </button>
            </div>
          )}
        </div>

        {pagination.count > 0 && (
          <div className="results-info">
            Showing {filteredForms.length} of {pagination.count} forms
            {pagination.count > pagination.page_size && (
              <span> (Page {pagination.page} of {Math.ceil(pagination.count / pagination.page_size)})</span>
            )}
          </div>
        )}

        <div className="table-container">
          <Table>
            {filteredForms.length === 0 && (
              <TableCaption>
                {hasActiveFilters 
                  ? "No forms match your filters" 
                  : "No forms found"}
              </TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="sortable-header"
                  onClick={() => handleSort("form_id")}
                >
                  <span className="header-content">
                    Form ID
                    {getSortIcon("form_id")}
                  </span>
                </TableHead>
                <TableHead 
                  className="sortable-header"
                  onClick={() => handleSort("name")}
                >
                  <span className="header-content">
                    Template Name
                    {getSortIcon("name")}
                  </span>
                </TableHead>
                <TableHead 
                  className="sortable-header"
                  onClick={() => handleSort("customer_name")}
                >
                  <span className="header-content">
                    Customer
                    {getSortIcon("customer_name")}
                  </span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead 
                  className="sortable-header"
                  onClick={() => handleSort("created_at")}
                >
                  <span className="header-content">
                    Created At
                    {getSortIcon("created_at")}
                  </span>
                </TableHead>
                <TableHead className="actions-header">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.length > 0 ? (
                filteredForms.map((form) => (
                  <TableRow
                    key={form.form_id}
                    onClick={() => handleRowClick(form)}
                    className="table-row-clickable"
                  >
                    <TableCell className="font-medium">{form.form_id}</TableCell>
                    <TableCell>{form.template_name || form["from-name"] || "N/A"}</TableCell>
                    <TableCell>{form.customer_name || "N/A"}</TableCell>
                    <TableCell>
                      <span className={`status-badge status-${form.status || "draft"}`}>
                        {form.status || "draft"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {form.version ? (
                        <span className="version-badge">{form.version}</span>
                      ) : (
                        <span className="version-empty">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(form.created_at)}</TableCell>
                    <TableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          className="action-btn edit-btn"
                          onClick={(e) => handleEdit(e, form)}
                          title="Edit form"
                          aria-label="Edit form"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="action-btn duplicate-btn"
                          onClick={(e) => handleDuplicate(e, form)}
                          title="Duplicate form"
                          aria-label="Duplicate form"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="7" className="no-data text-center">
                    {hasActiveFilters ? "No forms match your filters" : "No forms found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {pagination.count > pagination.page_size && (
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.previous || loading}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {Math.ceil(pagination.count / pagination.page_size)}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.next || loading}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
