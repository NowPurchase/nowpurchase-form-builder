import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { listDynamicLogs } from "../../services/adminTemplateApi";
import { apiToLocal } from "../../utils/dataTransform";
import { getUserFromToken } from "../../services/api";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import CustomerDropdown from "../shared/CustomerDropdown";
import AppShell from "../shared/AppShell";
import {
  FileSpreadsheet,
  Search,
  Plus,
  Settings,
  CheckCircle2,
  Pencil,
  Copy,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Inbox,
} from "lucide-react";

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

export default function Home({ onLogout }) {
  const navigate = useNavigate();
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = useMemo(() => getUserFromToken(), []);
  const isDlmsAdmin = user?.is_dlms_admin === true;

  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 40,
    count: 0,
    next: null,
    previous: null,
  });

  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem("home_searchQuery") || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => sessionStorage.getItem("home_searchQuery") || "");
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem("home_statusFilter") || "all");
  const [customerFilter, setCustomerFilter] = useState(() => {
    const saved = sessionStorage.getItem("home_customerFilter");
    return saved ? JSON.parse(saved) : (user?.customer_id || null);
  });
  const [customerFilterName, setCustomerFilterName] = useState(() => sessionStorage.getItem("home_customerFilterName") || user?.customer_name || "");

  const fetchForms = useCallback(
    async (page = 1, pageSize = pagination.page_size) => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          page_no: page,
          page_size: pageSize,
          ...(statusFilter && statusFilter !== "all" && { status: statusFilter }),
          ...(customerFilter && { customer: customerFilter }),
          ...(debouncedSearchQuery && debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
        };

        const response = await listDynamicLogs(params);

        let formsList = [];
        let paginationData = { count: 0, next: null, previous: null, page_size: pageSize };

        if (Array.isArray(response)) {
          const totalCount = response.length;
          if (totalCount > pageSize) {
            const startIndex = (page - 1) * pageSize;
            formsList = response.slice(startIndex, startIndex + pageSize);
            const totalPages = Math.ceil(totalCount / pageSize);
            paginationData = { count: totalCount, next: page < totalPages ? page + 1 : null, previous: page > 1 ? page - 1 : null, page_size: pageSize };
          } else {
            formsList = response;
            paginationData = { count: totalCount, next: totalCount === pageSize ? page + 1 : null, previous: page > 1 ? page - 1 : null, page_size: pageSize };
          }
        } else if (response.results || response.templates) {
          formsList = response.results || response.templates;
          const totalCount = response.count ?? response.total ?? response.total_count ?? 0;
          const resolvedPageSize = response.page_size || pageSize;
          const currentPage = response.page_no || response.page || page;
          const totalPages = totalCount > 0 ? Math.ceil(totalCount / resolvedPageSize) : 0;
          let nextPage = response.next ? parsePageFromUrl(response.next) : (totalPages > 0 && currentPage < totalPages ? currentPage + 1 : (formsList.length === resolvedPageSize ? currentPage + 1 : null));
          let previousPage = response.previous ? parsePageFromUrl(response.previous) : (currentPage > 1 ? currentPage - 1 : null);
          paginationData = { count: totalCount, next: nextPage, previous: previousPage, page_size: resolvedPageSize };
        }

        setAllForms(formsList.map(apiToLocal));
        setPagination({ page, page_size: pageSize, ...paginationData });
      } catch (err) {
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
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("home_searchQuery", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem("home_statusFilter", statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    sessionStorage.setItem("home_customerFilter", JSON.stringify(customerFilter));
  }, [customerFilter]);

  useEffect(() => {
    sessionStorage.setItem("home_customerFilterName", customerFilterName);
  }, [customerFilterName]);

  useEffect(() => {
    fetchForms(1);
  }, [fetchForms]);

  const filteredForms = useMemo(() => [...allForms], [allForms]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata"
    });
  };

  const totalPages = pagination.count > 0 && pagination.page_size > 0 ? Math.ceil(pagination.count / pagination.page_size) : 0;

  return (
    <AppShell active="templates" onLogout={onLogout} title="Templates">
      {/* Page Header (desktop only — mobile uses the AppShell top bar) */}
      <div className="page-head mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-10 tracking-tight">Templates</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Browse and manage every form template across your customers.</p>
        </div>
        <button onClick={() => navigate("/new-form")} className="btn-primary">
          <Plus className="h-[18px] w-[18px]" /> New form
        </button>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div>
            <div className="lbl">Total templates</div>
            <div className="val">{pagination.count || filteredForms.length}</div>
          </div>
          <div className="ic ic-blue">
            <FileSpreadsheet className="h-[22px] w-[22px]" />
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="lbl">Draft</div>
            <div className="val">{filteredForms.filter(f => (f.status || "draft").toLowerCase() === "draft").length}</div>
          </div>
          <div className="ic ic-amber">
            <FileSpreadsheet className="h-[22px] w-[22px]" />
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="lbl">Completed</div>
            <div className="val">{filteredForms.filter(f => (f.status || "").toLowerCase() === "completed").length}</div>
          </div>
          <div className="ic ic-green">
            <CheckCircle2 className="h-[22px] w-[22px]" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card">
        {/* Filters */}
        <div className="filter-bar">
          <div className="segmented">
            {["all", "draft", "completed"].map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={statusFilter === k ? 'on' : ''}
              >
                {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <div className="filter-search">
            <Search />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates…"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Customer:</span>
            </div>
            <div className="min-w-[240px]">
              <CustomerDropdown
                value={customerFilter}
                onChange={(id) => { if (id) setCustomerFilter(id); }}
                onSelect={(c) => { setCustomerFilter(c.customer_id); setCustomerFilterName(c.customer_name); }}
                placeholder="Select customer"
                initialCustomerName={customerFilterName}
                disabled={!isDlmsAdmin}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="dlms-table">
          <thead>
            <tr>
              <th>Template</th>
              <th className="c">Version</th>
              <th>Created</th>
              <th>Updated</th>
              <th className="c">Status</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && allForms.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <p className="text-sm text-destructive mb-4">{error}</p>
                  <button onClick={() => fetchForms(pagination.page)} className="btn-secondary">Retry</button>
                </td>
              </tr>
            ) : filteredForms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  No templates found.
                </td>
              </tr>
            ) : (
              filteredForms.map((f, i) => (
                <tr
                  key={f.template_id || i}
                  onClick={() => navigate(`/form/${f.template_id}`)}
                >
                  <td>
                    <div className="tmpl">
                      <div className="tic">
                        <FileSpreadsheet />
                      </div>
                      <div>
                        <div className="nm">{f.template_name || f['from-name'] || 'N/A'}</div>
                        <div className="sub">{f.customer_name || 'System'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="c">
                    <span className="ver">v{f.version || '—'}</span>
                  </td>
                  <td className="date">{formatDate(f.created_at)}</td>
                  <td className="date">{formatDate(f.updated_at)}</td>
                  <td className="c">
                    <StatusBadge status={f.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="actions">
                      <button title="Edit" onClick={() => navigate(`/new-form?edit=${f.template_id}&customer_id=${f.customer_id}`)}>
                        <Pencil />
                      </button>
                      <button title="Duplicate" onClick={() => navigate(`/new-form?duplicate=${f.template_id}&customer_id=${f.customer_id}`)}>
                        <Copy />
                      </button>
                      <button title="Configure" onClick={() => navigate(`/config/${f.template_id}?customer_id=${f.customer_id}`)}>
                        <Settings />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Mobile card list (shown ≤ 768px in place of the table) */}
        <div className="tm-list">
          {loading && allForms.length === 0 ? (
            <div className="tm-state">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="tm-state">
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={() => fetchForms(pagination.page)} className="btn-secondary">Retry</button>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="tm-state">
              <Inbox className="h-9 w-9 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">No templates found</span>
            </div>
          ) : (
            filteredForms.map((f, i) => (
              <MobileTemplateCard key={f.template_id || i} f={f} />
            ))
          )}
        </div>

        {/* Pagination */}
        {(pagination.count > 0 || pagination.next || pagination.page > 1) && (
          <div className="pager">
            <span>Showing {filteredForms.length} of {pagination.count} templates</span>
            <div className="nav">
              <button
                className="pbtn"
                onClick={() => pagination.previous && fetchForms(pagination.previous)}
                disabled={!pagination.previous || loading}
              >
                <ChevronLeft className="h-[15px] w-[15px]" />
              </button>
              <span className="pnum">Page {pagination.page} of {totalPages || 1}</span>
              <button
                className="pbtn"
                onClick={() => pagination.next && fetchForms(pagination.next)}
                disabled={!pagination.next || loading}
              >
                <ChevronRight className="h-[15px] w-[15px]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Mobile is read-only: the phone view exists so an admin can manage permissions
// and glance at what templates exist. The listing is non-interactive — names +
// basic info only, no create / edit / open actions (those live on desktop).
function MobileTemplateCard({ f }) {
  return (
    <article className="tm-card" aria-disabled="true">
      <div className="tm-icon">
        <FileSpreadsheet />
      </div>
      <div className="tm-info">
        <div className="tm-name">{f.template_name || f["from-name"] || "N/A"}</div>
        <div className="tm-sub">{(f.customer_name || "System")} · v{f.version || "—"}</div>
        <div className="tm-badge">
          <StatusBadge status={f.status} />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const s = (status || "draft").toLowerCase();
  if (s === "completed") {
    return (
      <span className="badge done">
        <span className="dot" />
        Completed
      </span>
    );
  }
  return (
    <span className="badge draft">
      <span className="dot" />
      Draft
    </span>
  );
}
