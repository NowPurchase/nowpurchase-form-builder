import { useNavigate, NavLink } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { listDynamicLogs } from "../../services/adminTemplateApi";
import { apiToLocal } from "../../utils/dataTransform";
import { getUserFromToken } from "../../services/api";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import LoadingSpinner from "../shared/LoadingSpinner";
import CustomerDropdown from "../shared/CustomerDropdown";
import { Pagination } from "@mui/material";
import {
  FileSpreadsheet,
  Search,
  Plus,
  LogOut,
  LayoutGrid,
  GitCompareArrows,
  History,
  Settings,
  CheckCircle2,
  Pencil,
  Copy,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
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

  const TABS = [
    { to: "/home", label: "Templates", icon: LayoutGrid },
    { to: "/deploy", label: "Deployments", icon: GitCompareArrows },
    { to: "/history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-glow), hsl(var(--background))' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="icon-box h-9 w-9">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">DLMS Admin Panel</span>
          </div>

          <nav className="hidden lg:flex floating-nav">
            {TABS.map((t) => {
              const isActive = location.pathname === t.to || (t.to !== "/home" && location.pathname.startsWith(t.to));
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={`nav-tab ${isActive ? 'nav-tab-active' : 'nav-tab-inactive'}`}
                >
                  {t.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={onLogout} className="btn-ghost">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Templates</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse and manage every form template across your customers.</p>
          </div>
          <button onClick={() => navigate("/new-form")} className="btn-primary">
            <Plus className="h-4 w-4" /> New form
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total templates" value={pagination.count || filteredForms.length} icon={FileSpreadsheet} />
          <Stat label="Draft" value={filteredForms.filter(f => (f.status || "draft").toLowerCase() === "draft").length} icon={FileSpreadsheet} tone="warning" />
          <Stat label="Completed" value={filteredForms.filter(f => (f.status || "").toLowerCase() === "completed").length} icon={FileSpreadsheet} tone="success" />
        </div>

        {/* Table Card */}
        <div className="section-card overflow-hidden p-0">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1">
              {["all", "draft", "completed"].map((k) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={`nav-tab ${statusFilter === k ? 'nav-tab-active' : 'nav-tab-inactive'} capitalize`}
                >
                  {k === "all" ? "All" : k}
                </button>
              ))}
            </div>

            <div className="relative ml-auto w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates…"
                className="input-field h-10 pl-9"
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

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_150px_150px_90px_100px] items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Template</div>
            <div className="text-center">Version</div>
            <div>Created</div>
            <div>Updated</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Table Body */}
          {loading && allForms.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <button onClick={() => fetchForms(pagination.page)} className="btn-secondary">Retry</button>
            </div>
          ) : (
            <>
              {filteredForms.map((f, i) => (
                <div
                  key={f.template_id || i}
                  onClick={() => navigate(`/form/${f.template_id}`)}
                  className="grid grid-cols-[1fr_80px_150px_150px_90px_100px] items-center gap-3 border-b border-border px-5 py-3.5 text-sm transition-colors hover:bg-secondary/30 cursor-pointer last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="icon-box-muted h-9 w-9 shrink-0">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.template_name || f['from-name'] || 'N/A'}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.customer_name || 'System'}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="badge badge-outline font-mono">v{f.version || '—'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(f.created_at)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(f.updated_at)}</span>
                  <div className="flex justify-center">
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconBtn title="Edit" onClick={() => navigate(`/new-form?edit=${f.template_id}&customer_id=${f.customer_id}`)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Duplicate" onClick={() => navigate(`/new-form?duplicate=${f.template_id}&customer_id=${f.customer_id}`)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Configure" onClick={() => navigate(`/config/${f.template_id}?customer_id=${f.customer_id}`)}>
                      <Settings className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              ))}
              {filteredForms.length === 0 && (
                <div className="px-5 py-16 text-center text-sm text-muted-foreground">No templates found.</div>
              )}
            </>
          )}

          {/* Pagination */}
          {(pagination.count > 0 || pagination.next || pagination.page > 1) && (
            <div className="flex items-center justify-between p-4 text-xs text-muted-foreground border-t border-border">
              <span>Showing {filteredForms.length} of {pagination.count} forms</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.previous && fetchForms(pagination.previous)}
                  disabled={!pagination.previous || loading}
                  className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>Page {pagination.page} of {totalPages || 1}</span>
                <button
                  onClick={() => pagination.next && fetchForms(pagination.next)}
                  disabled={!pagination.next || loading}
                  className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="section-card flex items-center justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
        tone === "warning" ? "bg-warning/10 text-warning" :
        tone === "success" ? "bg-success/10 text-success" :
        "bg-gradient-primary text-primary-foreground"
      }`} style={!tone ? { boxShadow: 'var(--shadow-glow)' } : {}}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "draft").toLowerCase();
  if (s === "completed") {
    return <span className="badge badge-success"><CheckCircle2 className="h-3 w-3" /> Completed</span>;
  }
  return <span className="badge badge-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Draft</span>;
}

function IconBtn({ children, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer"
    >
      {children}
    </button>
  );
}
