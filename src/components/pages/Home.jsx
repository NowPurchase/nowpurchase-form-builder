import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { listDynamicLogs } from "../../services/dynamicLogApi";
import { apiToLocal } from "../../utils/dataTransform";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import LoadingSpinner from "../shared/LoadingSpinner";
import CustomerDropdown from "../shared/CustomerDropdown";
import { X, Search, ChevronUp, ChevronDown, Copy, Pencil } from "lucide-react";
import { Pagination } from "@mui/material";
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

function parsePageFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pageParam = parsed.searchParams.get("page");
    return pageParam ? Number(pageParam) : 1;
  } catch {
    return null;
  }
}

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState(null);
  const [customerFilterName, setCustomerFilterName] = useState("");

  const fetchForms = useCallback(
    async (page = 1, pageSize = pagination.page_size) => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          page_no: page,
          page_size: pageSize,
          ...(statusFilter && { status: statusFilter }),
          ...(customerFilter && { customer: customerFilter }),
          ...(debouncedSearchQuery &&
            debouncedSearchQuery.trim() && {
              search: debouncedSearchQuery.trim(),
            }),
        };

        console.log('[Home] Fetching templates with params:', params);

        const response = await listDynamicLogs(params);

        console.log('[Home] API Response:', response);

        let formsList = [];
        let paginationData = {
          count: 0,
          next: null,
          previous: null,
          page_size: pageSize,
        };

        if (Array.isArray(response)) {
          const totalCount = response.length;

          if (totalCount > pageSize) {
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            formsList = response.slice(startIndex, endIndex);

            const totalPages = Math.ceil(totalCount / pageSize);
            paginationData = {
              count: totalCount,
              next: page < totalPages ? page + 1 : null,
              previous: page > 1 ? page - 1 : null,
              page_size: pageSize,
            };
          } else if (totalCount === pageSize) {
            formsList = response;
            paginationData = {
              count: totalCount,
              next: page + 1,
              previous: page > 1 ? page - 1 : null,
              page_size: pageSize,
            };
          } else {
            formsList = response;
            paginationData = {
              count: totalCount,
              next: null,
              previous: page > 1 ? page - 1 : null,
              page_size: pageSize,
            };
          }
        } else if (response.results) {
          formsList = response.results;
          const totalCount =
            typeof response.count === "number" ? response.count : 0;
          const resolvedPageSize = params.page_size || pageSize;
          const nextPage = parsePageFromUrl(response.next);
          const previousPage = parsePageFromUrl(response.previous);

          paginationData = {
            count: totalCount,
            next: nextPage,
            previous: previousPage,
            page_size: resolvedPageSize,
          };
        }

        const transformedForms = formsList.map(apiToLocal);
        setAllForms(transformedForms);
        setPagination({
          page: page,
          page_size: pageSize,
          ...paginationData,
        });
      } catch (err) {
        console.error('[Home] Error fetching forms:', err);
        const errorMsg = formatErrorMessage(err);
        setError(errorMsg);
        toast.error(errorMsg);
        setAllForms([]);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, customerFilter, debouncedSearchQuery, pagination.page_size]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchForms(1);
  }, [fetchForms]);

  const filteredForms = useMemo(() => {
    let filtered = [...allForms];

    filtered.sort((a, b) => {
      const aValue = new Date(a.created_at || 0).getTime();
      const bValue = new Date(b.created_at || 0).getTime();
      return sortOrder === "asc"
        ? aValue > bValue
          ? 1
          : aValue < bValue
          ? -1
          : 0
        : aValue < bValue
        ? 1
        : aValue > bValue
        ? -1
        : 0;
    });

    return filtered;
  }, [allForms, sortOrder]);

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
    navigate(`/form/${form.template_id}`);
  };

  const handleDuplicate = (e, form) => {
    e.stopPropagation();
    navigate(`/new-form?duplicate=${form.template_id}`);
  };

  const handleEdit = (e, form) => {
    e.stopPropagation();
    navigate(`/new-form?edit=${form.template_id}`);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setStatusFilter("");
    setCustomerFilter(null);
    setCustomerFilterName("");
  };

  const removeFilter = (filterKey) => {
    if (filterKey === "search") {
      setSearchQuery("");
      setDebouncedSearchQuery("");
    } else if (filterKey === "status") {
      setStatusFilter("");
    } else if (filterKey === "customer") {
      setCustomerFilter(null);
      setCustomerFilterName("");
    }
  };

  const getActiveFilterChips = () => {
    const chips = [];
    if (searchQuery) {
      chips.push({
        key: "search",
        label: `Search: "${searchQuery}"`,
        value: searchQuery,
      });
    }
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter}`,
        value: statusFilter,
      });
    }
    if (customerFilter && customerFilterName) {
      chips.push({
        key: "customer",
        label: `Customer: ${customerFilterName}`,
        value: customerFilter,
      });
    }
    return chips;
  };

  const handlePageChange = (newPage) => {
    if (!newPage || newPage < 1 || newPage === pagination.page || loading) {
      return;
    }
    fetchForms(newPage);
  };

  const handleSort = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const getSortIcon = () => {
    return sortOrder === "asc" ? (
      <ChevronUp size={14} className="sort-icon-active" />
    ) : (
      <ChevronDown size={14} className="sort-icon-active" />
    );
  };

  const hasActiveFilters = searchQuery || statusFilter || customerFilter;
  const totalPages =
    pagination.count > 0 && pagination.page_size > 0
      ? Math.ceil(pagination.count / pagination.page_size)
      : 0;

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
                placeholder="Search template name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearchQuery("");
                  }}
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
                className={`status-toggle-btn ${
                  statusFilter === "" ? "active" : ""
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`status-toggle-btn ${
                  statusFilter === "draft" ? "active" : ""
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => setStatusFilter("completed")}
                className={`status-toggle-btn ${
                  statusFilter === "completed" ? "active" : ""
                }`}
              >
                Completed
              </button>
            </div>
            <div className="customer-filter-wrapper">
              <div className="customer-filter-container">
                <CustomerDropdown
                  value={customerFilter}
                  onChange={(id) => {
                    if (!id) {
                      setCustomerFilter(null);
                      setCustomerFilterName("");
                    } else {
                      setCustomerFilter(id);
                    }
                  }}
                  onSelect={(customer) => {
                    setCustomerFilter(customer.customer_id);
                    setCustomerFilterName(customer.customer_name);
                  }}
                  placeholder="Filter by customer..."
                />
                {customerFilter && (
                  <button
                    onClick={() => {
                      setCustomerFilter(null);
                      setCustomerFilterName("");
                    }}
                    className="clear-customer-filter-btn"
                    aria-label="Clear customer filter"
                    title="Clear customer filter"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
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
              <button
                onClick={handleClearFilters}
                className="clear-all-chips-btn"
              >
                Clear all
              </button>
            </div>
          )}
          {pagination.count > 0 && (
            <div className="results-info">
              Showing {filteredForms.length} of {pagination.count} forms
              {(totalPages > 1 || pagination.next || pagination.previous) && (
                <span>
                  {" "}
                  (
                  {totalPages > 0
                    ? `Page ${pagination.page} of ${totalPages}`
                    : `Page ${pagination.page}`}
                  )
                </span>
              )}
            </div>
          )}
        </div>

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
                <TableHead className="col-template-name">Template Name</TableHead>
                <TableHead className="col-customer">Customer</TableHead>
                <TableHead className="col-status">Status</TableHead>
                <TableHead className="col-version">Version</TableHead>
                <TableHead className="col-created-at sortable-header" onClick={handleSort}>
                  <span className="header-content">
                    Created At
                    {getSortIcon()}
                  </span>
                </TableHead>
                <TableHead className="col-actions actions-header">Actions</TableHead>
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
                    <TableCell>
                      {form.template_name || form["from-name"] || "N/A"}
                    </TableCell>
                    <TableCell>{form.customer_name || "N/A"}</TableCell>
                    <TableCell>
                      <span
                        className={`status-badge status-${(
                          form.status || "draft"
                        ).toLowerCase()}`}
                      >
                        {form.status || "draft"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="version-cell">
                        {form.version ? `v${form.version}` : "—"}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(form.created_at)}</TableCell>
                    <TableCell
                      className="actions-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                  <TableCell colSpan="6" className="no-data text-center">
                    {hasActiveFilters
                      ? "No forms match your filters"
                      : "No forms found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {(totalPages > 1 || pagination.next || pagination.previous) && (
          <div className="pagination-controls">
            <Pagination
              count={
                totalPages > 0
                  ? totalPages
                  : pagination.page + (pagination.next ? 1 : 0)
              }
              page={pagination.page}
              onChange={(event, value) => handlePageChange(value)}
              disabled={loading}
              color="standard"
              showFirstButton
              showLastButton
              sx={{
                "& .MuiPaginationItem-root": {
                  color: "#1f2937",
                  "&.Mui-selected": {
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                    "&:hover": {
                      backgroundColor: "#1e293b",
                    },
                  },
                  "&:hover": {
                    backgroundColor: "#f3f4f6",
                  },
                },
                "& .MuiPaginationItem-icon": {
                  color: "#64748b",
                },
                "& .Mui-disabled": {
                  color: "#d1d5db",
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
