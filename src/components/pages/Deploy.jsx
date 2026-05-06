import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  GitCompareArrows,
  Rocket,
  LayoutGrid,
  History,
  Loader2,
  LogOut,
  Users,
  Clock,
  Filter,
  Plus,
  Minus,
  Check,
  Lock,
  Phone,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { getUserFromToken, isProdAuthenticated, sendProdOTP, verifyProdOTP, setProdSessionAuth } from '../../services/api';
import {
  listDynamicLogs,
  getDynamicLog,
  createDynamicLog,
  updateDynamicLog
} from '../../services/adminTemplateApi';
import { toast } from '../shared/Toast';
import CustomerDropdown from '../shared/CustomerDropdown';

export default function Deploy() {
  const navigate = useNavigate();
  const [isSwapped, setIsSwapped] = useState(true);

  const user = useMemo(() => getUserFromToken(), []);
  const isDlmsAdmin = user?.is_dlms_admin === true;

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

  // Production login modal state
  const [showProdLoginModal, setShowProdLoginModal] = useState(() => !isProdAuthenticated());
  const [prodMobile, setProdMobile] = useState('');
  const [prodOtp, setProdOtp] = useState('');
  const [prodOtpSent, setProdOtpSent] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState('');
  const [prodCountdown, setProdCountdown] = useState(0);
  const prodOtpInputRef = useRef(null);

  // Check prod auth and show modal if not authenticated
  useEffect(() => {
    if (!isProdAuthenticated()) {
      setShowProdLoginModal(true);
    }
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (prodCountdown > 0) {
      const timer = setTimeout(() => setProdCountdown(prodCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [prodCountdown]);

  // Focus OTP input when OTP is sent
  useEffect(() => {
    if (prodOtpSent && prodOtpInputRef.current) {
      prodOtpInputRef.current.focus();
    }
  }, [prodOtpSent]);

  const handleProdSendOTP = async (e) => {
    e.preventDefault();
    setProdError('');

    if (!prodMobile || prodMobile.length !== 10) {
      setProdError('Please enter a valid 10-digit mobile number');
      return;
    }

    setProdLoading(true);
    try {
      const mobileWithPrefix = prodMobile.startsWith('+91') ? prodMobile : `+91${prodMobile}`;
      await sendProdOTP(mobileWithPrefix);
      setProdOtpSent(true);
      setProdCountdown(60);
    } catch (err) {
      setProdError(err.message || 'Failed to send OTP');
    } finally {
      setProdLoading(false);
    }
  };

  const handleProdVerifyOTP = async (e) => {
    e.preventDefault();
    setProdError('');

    if (!prodOtp || prodOtp.length !== 4) {
      setProdError('Please enter a valid 4-digit OTP');
      return;
    }

    setProdLoading(true);
    try {
      const mobileWithPrefix = prodMobile.startsWith('+91') ? prodMobile : `+91${prodMobile}`;
      await verifyProdOTP(mobileWithPrefix, prodOtp);
      setShowProdLoginModal(false);
      toast.success('Successfully authenticated to production!');
    } catch (err) {
      setProdError(err.message || 'Invalid OTP');
    } finally {
      setProdLoading(false);
    }
  };

  const handleProdResendOTP = async () => {
    if (prodCountdown > 0) return;
    setProdError('');
    setProdOtp('');
    setProdLoading(true);
    try {
      const mobileWithPrefix = prodMobile.startsWith('+91') ? prodMobile : `+91${prodMobile}`;
      await sendProdOTP(mobileWithPrefix);
      setProdCountdown(60);
    } catch (err) {
      setProdError(err.message || 'Failed to resend OTP');
    } finally {
      setProdLoading(false);
    }
  };

  const handleCloseProdModal = () => {
    setShowProdLoginModal(false);
    navigate('/home');
  };

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
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const fetchParams = { page_size: 1000, ...(customerFilter && { customer: customerFilter }) };
        const [stagingRes, prodRes] = await Promise.all([
          listDynamicLogs(fetchParams).catch(() => ({ templates: [] })),
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
      } catch (error) {
        toast.error("Failed to load templates");
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [customerFilter]);

  useEffect(() => {
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
  }, [selectedTemplateId, baseEnv, compareEnv, customerFilter]);

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
  // Only admin users can deploy
  const canDeploy = isDlmsAdmin && hasDiff;

  const TABS = [
    { to: "/home", label: "Templates", icon: LayoutGrid },
    { to: "/deploy", label: "Deployments", icon: GitCompareArrows },
    { to: "/history", label: "History", icon: History },
  ];

  return (
    <>
    <div className={`min-h-screen ${showProdLoginModal ? 'pointer-events-none select-none' : ''}`} style={{ background: 'var(--gradient-glow), hsl(var(--background))', filter: showProdLoginModal ? 'grayscale(50%) brightness(0.7)' : 'none', transition: 'filter 0.3s ease' }}>
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
              const isActive = location.pathname === t.to;
              return (
                <NavLink key={t.to} to={t.to} className={`nav-tab ${isActive ? 'nav-tab-active' : 'nav-tab-inactive'}`}>
                  {t.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/home')} className="btn-ghost"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Deployments</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review version differences between staging and production, then ship changes with confidence.</p>
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
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Pending" value={pendingTemplates.length} icon={GitCompareArrows} tone="warning" />
          <Stat label="Customers" value={new Set(templates.map(t => t.customer_id)).size} icon={Users} />
          <Stat label="Deployed today" value="—" icon={Rocket} tone="success" />
          <Stat label="Avg. lead time" value="—" icon={Clock} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Pending list */}
          <aside className="section-card flex max-h-[78vh] flex-col p-0">
            <div className="border-b border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Pending Deployments</p>
                <span className="badge badge-warning">{pendingTemplates.length} updates</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates…" className="input-field h-9 pl-9" />
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
                      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 cursor-pointer bg-transparent ${active ? 'bg-accent' : 'hover:bg-secondary/50'}`}
                    >
                      <div className={`icon-box-muted h-9 w-9 shrink-0 ${active ? 'bg-gradient-primary text-primary-foreground' : ''}`} style={active ? { boxShadow: 'var(--shadow-glow)' } : {}}>
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.template_name}</p>
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
                <div className="icon-box h-10 w-10">
                  <GitCompareArrows className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected template</p>
                  <p className="text-sm font-semibold">{selectedTemplate?.template_name || '—'} <span className="font-normal text-muted-foreground">· {selectedTemplate?.customer_name}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsSwapped(v => !v)} className="btn-secondary h-9 w-9 p-0" title="Swap environments">
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

            <div className="flex flex-wrap items-center gap-4 border-b border-border bg-secondary/30 px-5 py-4">
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
                        addedBackground: 'hsl(152 60% 42% / 0.1)',
                        addedColor: 'hsl(152 60% 30%)',
                        removedBackground: 'hsl(0 75% 58% / 0.1)',
                        removedColor: 'hsl(0 75% 40%)',
                        wordAddedBackground: 'hsl(152 60% 42% / 0.25)',
                        wordRemovedBackground: 'hsl(0 75% 58% / 0.25)',
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
      </main>
    </div>

      {/* Production Login Modal */}
      {showProdLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseProdModal} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Production Login Required</h3>
                  <p className="text-sm text-muted-foreground">Authenticate to access deployments</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {prodError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {prodError}
                </div>
              )}

              {!prodOtpSent ? (
                <form onSubmit={handleProdSendOTP}>
                  <label className="block text-sm font-medium mb-2">Mobile Number</label>
                  <div className="relative mb-4">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+91</span>
                    <input
                      type="tel"
                      value={prodMobile}
                      onChange={(e) => setProdMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit mobile"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      maxLength={10}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={prodLoading || prodMobile.length !== 10}
                    className="w-full btn-primary py-3 disabled:opacity-50"
                  >
                    {prodLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleProdVerifyOTP}>
                  <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    OTP sent to +91{prodMobile}
                  </div>
                  <label className="block text-sm font-medium mb-2">Enter OTP</label>
                  <input
                    ref={prodOtpInputRef}
                    type="text"
                    value={prodOtp}
                    onChange={(e) => setProdOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit OTP"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
                    maxLength={4}
                  />
                  <button
                    type="submit"
                    disabled={prodLoading || prodOtp.length !== 4}
                    className="w-full btn-primary py-3 disabled:opacity-50 mb-3"
                  >
                    {prodLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Verify & Login'}
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => { setProdOtpSent(false); setProdOtp(''); setProdError(''); }}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" /> Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleProdResendOTP}
                      disabled={prodCountdown > 0 || prodLoading}
                      className="text-primary hover:text-primary/80 disabled:text-muted-foreground bg-transparent border-0 cursor-pointer"
                    >
                      {prodCountdown > 0 ? `Resend in ${prodCountdown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-4 bg-muted/30 border-t border-border">
              <button
                onClick={handleCloseProdModal}
                className="w-full btn-secondary py-2.5 text-sm"
              >
                Cancel & Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="section-card flex items-center justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
        tone === "warning" ? "bg-warning/10 text-warning" :
        tone === "success" ? "bg-success/10 text-success" :
        "bg-accent text-accent-foreground"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
