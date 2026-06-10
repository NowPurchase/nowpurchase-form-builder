import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { getUserFromToken, isProdAuthenticated, sendProdOTP, verifyProdOTP } from '../../services/api';
import {
  listDynamicLogs,
  getDynamicLog,
  createDynamicLog,
  updateDynamicLog
} from '../../services/adminTemplateApi';
import { toast } from '../shared/Toast';
import CustomerDropdown from '../shared/CustomerDropdown';
import AppShell from '../shared/AppShell';

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

  return (
    <>
    <div className={showProdLoginModal ? 'pointer-events-none select-none' : ''} style={{ filter: showProdLoginModal ? 'grayscale(50%) brightness(0.7)' : 'none', transition: 'filter 0.3s ease' }}>
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

      {/* Production Login Modal */}
      {showProdLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="login-wrap">
            {/* Logo + Title */}
            <div className="login-top">
              <div className="login-mark">
                <ShieldCheck />
              </div>
              <h1>Production Login</h1>
              <div className="sub">Authenticate to access deployments</div>
            </div>

            {/* Mobile Step */}
            {!prodOtpSent ? (
              <div className="login-card">
                <div className="login-card-head">
                  <h2>Verify Identity</h2>
                  <p>Enter your mobile number to continue</p>
                </div>

                <form onSubmit={handleProdSendOTP}>
                  <label className="login-lbl">Mobile Number</label>
                  <div className="login-mobile-field">
                    <span className="cc">
                      <Users className="h-4 w-4" />
                      <span>+91</span>
                    </span>
                    <input
                      type="tel"
                      value={prodMobile}
                      onChange={(e) => setProdMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      maxLength={10}
                      autoFocus
                    />
                  </div>

                  {prodError && <div className="login-error">{prodError}</div>}

                  <button
                    type="submit"
                    disabled={prodLoading || prodMobile.length !== 10}
                    className="login-btn-primary"
                  >
                    {prodLoading ? (
                      <><Loader2 className="animate-spin" /> Sending OTP...</>
                    ) : (
                      <><span>Continue</span><ArrowRight /></>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e5e5' }}>
                  <button onClick={handleCloseProdModal} className="login-back-btn" style={{ width: '100%', justifyContent: 'center' }}>
                    <ArrowLeft /> Cancel & Go Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="login-card">
                <div className="login-card-head">
                  <h2>Verify OTP</h2>
                  <p>Enter the code sent to +91 {prodMobile}</p>
                </div>

                <form onSubmit={handleProdVerifyOTP}>
                  <button
                    type="button"
                    onClick={() => { setProdOtpSent(false); setProdOtp(''); setProdError(''); }}
                    className="login-back-btn"
                  >
                    <ArrowLeft /> Change number
                  </button>

                  <div className="login-sent-note">
                    <CheckCircle2 />
                    OTP sent to +91 {prodMobile}
                  </div>

                  <label className="login-lbl">Verification Code</label>
                  <div className="login-otp-field">
                    <span className="lead"><Clock /></span>
                    <input
                      ref={prodOtpInputRef}
                      type="text"
                      value={prodOtp}
                      onChange={(e) => setProdOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Enter 4-digit OTP"
                      maxLength={4}
                    />
                  </div>

                  {prodError && <div className="login-error">{prodError}</div>}

                  <button
                    type="submit"
                    disabled={prodLoading || prodOtp.length !== 4}
                    className="login-btn-primary"
                  >
                    {prodLoading ? (
                      <><Loader2 className="animate-spin" /> Verifying...</>
                    ) : (
                      <><span>Verify & Sign in</span><ArrowRight /></>
                    )}
                  </button>

                  <div className="login-resend">
                    {prodCountdown > 0 ? (
                      <>Resend code in <b>{prodCountdown}s</b></>
                    ) : (
                      <button type="button" onClick={handleProdResendOTP} disabled={prodLoading}>
                        Resend verification code
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
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
        <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
        tone === "warning" ? "bg-warning/15 text-warning" :
        tone === "success" ? "bg-success/15 text-success" :
        "bg-accent text-accent-foreground"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
