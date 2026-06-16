import { createElement, useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  GitCompareArrows,
  Rocket,
  Loader2,
  Users,
  Clock,
  Filter,
  Plus,
  Minus,
  Check,
  Lock,
} from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { getUserFromToken } from '../../services/api';
import {
  listDynamicLogs,
  getDynamicLog,
  createDynamicLog,
  updateDynamicLog
} from '../../services/adminTemplateApi';
import { toast } from '../shared/Toast';
import CustomerDropdown from '../shared/CustomerDropdown';
import AppShell from '../shared/AppShell';
import { IS_PROD } from '../../config/env';

export default function Deploy() {
  const [isSwapped, setIsSwapped] = useState(true);

  const user = useMemo(() => getUserFromToken(), []);
  const isDlmsAdmin = user?.is_dlms_admin === true;
  const canAccessDeployments = IS_PROD && isDlmsAdmin;

  const [customerFilter, setCustomerFilter] = useState(() => {
    const saved = sessionStorage.getItem("deploy_customerFilter");
    return saved ? JSON.parse(saved) : (user?.customer_id || null);
  });
  const [customerFilterName, setCustomerFilterName] = useState(() => sessionStorage.getItem("deploy_customerFilterName") || user?.customer_name || "");

  const baseEnv = isSwapped ? 'production' : 'staging';
  const compareEnv = isSwapped ? 'staging' : 'production';

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [baseJson, setBaseJson] = useState('');
  const [compareJson, setCompareJson] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Persist customer filter to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("deploy_customerFilter", JSON.stringify(customerFilter));
  }, [customerFilter]);

  useEffect(() => {
    sessionStorage.setItem("deploy_customerFilterName", customerFilterName);
  }, [customerFilterName]);

  useEffect(() => {
    if (!canAccessDeployments) return;

    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const fetchParams = { page_size: 1000, ...(customerFilter && { customer: customerFilter }) };
        const [stagingRes, prodRes] = await Promise.all([
          listDynamicLogs(fetchParams, { env: 'staging' }).catch(() => ({ templates: [] })),
          listDynamicLogs(fetchParams, { env: 'prod' }).catch(() => ({ templates: [] }))
        ]);

        const stagingTemplates = stagingRes?.templates || [];
        const prodTemplates = prodRes?.templates || [];
        const templateMap = new Map();

        stagingTemplates.forEach(t => {
          templateMap.set(t.template_id, {
            template_id: t.template_id,
            template_name: t.template_name,
            customer_id: t.customer || t.customer_id,
            customer_name: t.customer_name,
            staging_version: t.version,
            staging_config_hash: t.config_hash || null,
            prod_version: null,
            prod_config_hash: null
          });
        });

        prodTemplates.forEach(t => {
          if (templateMap.has(t.template_id)) {
            const existing = templateMap.get(t.template_id);
            existing.prod_version = t.version;
            existing.prod_config_hash = t.config_hash || null;
          } else {
            templateMap.set(t.template_id, {
              template_id: t.template_id,
              template_name: t.template_name,
              customer_id: t.customer || t.customer_id,
              customer_name: t.customer_name,
              staging_version: null,
              staging_config_hash: null,
              prod_version: t.version,
              prod_config_hash: t.config_hash || null
            });
          }
        });

        const merged = Array.from(templateMap.values());
        setTemplates(merged);
        if (merged.length > 0) setSelectedTemplateId(merged[0].template_id);
      } catch {
        toast.error("Failed to load templates");
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [customerFilter, canAccessDeployments]);

  useEffect(() => {
    if (!canAccessDeployments) return;

    const fetchDiffs = async () => {
      if (!selectedTemplateId) return;
      setLoadingDiff(true);
      setBaseJson('');
      setCompareJson('');
      try {
        const [baseRes, compareRes] = await Promise.all([
          getDynamicLog(selectedTemplateId, customerFilter, { env: baseEnv === 'production' ? 'prod' : 'staging' }).catch(() => null),
          getDynamicLog(selectedTemplateId, customerFilter, { env: compareEnv === 'production' ? 'prod' : 'staging' }).catch(() => null)
        ]);
        setBaseJson(baseRes ? JSON.stringify(baseRes, null, 2) : '');
        setCompareJson(compareRes ? JSON.stringify(compareRes, null, 2) : '');
      } catch (error) {
        console.error("Failed to fetch template JSON", error);
      } finally {
        setLoadingDiff(false);
      }
    };
    fetchDiffs();
  }, [selectedTemplateId, baseEnv, compareEnv, customerFilter, canAccessDeployments]);

  const handleDeploy = async () => {
    if (!selectedTemplateId || !compareJson) return;
    setDeploying(true);
    try {
      const payload = JSON.parse(compareJson);
      if (payload.customer && !payload.customer_id) payload.customer_id = payload.customer;
      const targetEnvOption = { env: baseEnv === 'production' ? 'prod' : 'staging' };
      const isNewDeployment = !baseJson || baseJson === '' || baseJson === '{}';

      if (isNewDeployment) {
        await createDynamicLog(payload, targetEnvOption);
      } else {
        await updateDynamicLog(selectedTemplateId, payload, targetEnvOption);
      }

      toast.success(`Successfully deployed to ${baseEnv}!`);
      setBaseJson(compareJson);
      setTemplates(prev => prev.map(t => {
        if (t.template_id === selectedTemplateId) {
          const updates = baseEnv === 'staging'
            ? { staging_version: payload.version, staging_config_hash: payload.config_hash || t.prod_config_hash }
            : { prod_version: payload.version, prod_config_hash: payload.config_hash || t.staging_config_hash };
          return { ...t, ...updates };
        }
        return t;
      }));
    } catch (error) {
      toast.error(`Failed to deploy: ${error.message || "Unknown error"}`);
    } finally {
      setDeploying(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = (t.template_name || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          (t.customer_name || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    const matchesCustomer = customerFilter ? String(t.customer_id) === String(customerFilter) || t.customer_name === customerFilterName : true;
    return matchesSearch && matchesCustomer;
  });

  const pendingTemplates = filteredTemplates.filter(t => t.staging_config_hash !== t.prod_config_hash);
  const selectedTemplate = templates.find(t => t.template_id === selectedTemplateId) || pendingTemplates[0] || templates[0];
  const baseVersion = selectedTemplate ? (baseEnv === 'production' ? selectedTemplate.prod_version : selectedTemplate.staging_version) : null;
  const compareVersion = selectedTemplate ? (compareEnv === 'production' ? selectedTemplate.prod_version : selectedTemplate.staging_version) : null;
  // Check if there are differences to show (for viewing)
  const hasDiff = selectedTemplate && compareJson && (baseJson !== compareJson);
  const canDeploy = canAccessDeployments && hasDiff;

  if (!canAccessDeployments) {
    return (
      <AppShell active="deployments">
        <div className="section-card flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
          <div className="icon-box mb-5 h-14 w-14">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Deployments require DLMS admin access</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Production deployments are available only to DLMS admins. Please contact an admin if you need access.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <div>
      <AppShell active="deployments">
        {/* Page header */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Deployments</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Review version differences between staging and production, then ship changes with confidence.</p>
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

        {/* Stats */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Pending" value={pendingTemplates.length} icon={GitCompareArrows} tone="warning" />
          <Stat label="Customers" value={new Set(templates.map(t => t.customer_id)).size} icon={Users} />
          <Stat label="Deployed today" value="—" icon={Rocket} tone="success" />
          <Stat label="Avg. lead time" value="—" icon={Clock} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          {/* Pending list */}
          <aside className="section-card flex max-h-[78vh] flex-col p-0">
            <div className="border-b border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-bold">Pending Deployments</p>
                <span className="badge badge-warning">{pendingTemplates.length} updates</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates…" className="input-field h-9 rounded-full pl-9" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : pendingTemplates.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No pending deployments.</div>
              ) : (
                pendingTemplates.map((p) => {
                  const active = p.template_id === selectedTemplateId;
                  const upgrade = (p.staging_version || 0) > (p.prod_version || 0);
                  return (
                    <button
                      key={p.template_id}
                      onClick={() => setSelectedTemplateId(p.template_id)}
                      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 cursor-pointer bg-transparent ${active ? 'bg-accent' : 'hover:bg-muted/50'}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold">{p.template_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{p.customer_name}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <span className="badge badge-success">v{p.staging_version || 0}</span>
                        <ArrowRight className={`h-3 w-3 ${upgrade ? 'text-success' : 'text-warning'}`} />
                        <span className="badge badge-outline">v{p.prod_version || 0}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Diff panel */}
          <section className="section-card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="icon-box h-11 w-11">
                  <GitCompareArrows className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected template</p>
                  <p className="font-display text-sm font-bold">{selectedTemplate?.template_name || '—'} <span className="font-normal text-muted-foreground">· {selectedTemplate?.customer_name}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsSwapped(v => !v)} className="btn-secondary h-11 w-11 p-0" title="Swap environments">
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                {canDeploy && (
                  <button onClick={handleDeploy} disabled={deploying} className="btn-primary">
                    {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {deploying ? 'Deploying...' : 'Create Deployment'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-b border-border bg-muted/50 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">source</p>
                <p className="text-sm font-medium">{compareEnv} · <span className={`font-mono ${compareEnv === 'staging' ? 'text-warning' : 'text-primary'}`}>v{compareVersion || '—'}</span></p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">target</p>
                <p className="text-sm font-medium">{baseEnv} · <span className={`font-mono ${baseEnv === 'production' ? 'text-primary' : 'text-warning'}`}>v{baseVersion || '—'}</span></p>
              </div>
              <div className="ml-auto">
                {canDeploy ? (
                  <span className="badge badge-success"><Check className="h-3 w-3" /> Ready to deploy</span>
                ) : hasDiff && !isDlmsAdmin ? (
                  <span className="badge badge-warning">View only</span>
                ) : (
                  <span className="badge badge-outline"><CheckCircle2 className="h-3 w-3" /> Up to date</span>
                )}
              </div>
            </div>

            {hasDiff && (
              <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Plus className="h-3 w-3 text-success" /> added</span>
                <span className="flex items-center gap-1.5"><Minus className="h-3 w-3 text-destructive" /> removed</span>
                <span className="ml-auto font-mono">JSON diff</span>
              </div>
            )}

            {loadingDiff ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : hasDiff ? (
              <div className="max-h-[60vh] overflow-y-auto">
                <ReactDiffViewer
                  oldValue={baseJson || '{}'}
                  newValue={compareJson || '{}'}
                  splitView={false}
                  useDarkTheme={false}
                  leftTitle={`${baseEnv} (v${baseVersion || '—'})`}
                  rightTitle={`${compareEnv} (v${compareVersion || '—'})`}
                  styles={{
                    variables: {
                      light: {
                        diffViewerBackground: 'hsl(var(--card))',
                        diffViewerColor: 'hsl(var(--foreground))',
                        addedBackground: 'hsl(137 58% 40% / 0.1)',
                        addedColor: 'hsl(137 58% 26%)',
                        removedBackground: 'hsl(6 77% 53% / 0.1)',
                        removedColor: 'hsl(6 77% 38%)',
                        wordAddedBackground: 'hsl(137 58% 40% / 0.25)',
                        wordRemovedBackground: 'hsl(6 77% 53% / 0.25)',
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-success/50" />
                <p className="text-sm font-medium">Environments are in sync</p>
                <p className="text-xs">No changes to deploy for this template.</p>
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </div>
  );
}

function Stat({ label, value, icon, tone }) {
  return (
    <div className="section-card flex items-center justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
        tone === "warning" ? "bg-warning/15 text-warning" :
        tone === "success" ? "bg-success/15 text-success" :
        "bg-accent text-accent-foreground"
      }`}>
        {createElement(icon, { className: "h-5 w-5" })}
      </div>
    </div>
  );
}
