import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Settings as SettingsIcon, 
  ArrowRight,
  ArrowRightLeft,
  GitMerge,
  History,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  ArrowLeft,
  X
} from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { apiGet, apiPut, apiPost, getUserFromToken } from '../../services/api';
import { toast } from '../shared/Toast';
import CustomerDropdown from '../shared/CustomerDropdown';
import './Deploy.css';

// Mock history retained until backend API is ready

const MOCK_HISTORY = [
  {
    id: 1,
    template_name: "Moulding Inspection",
    version: "v51",
    deployed_by: "Manhar",
    date: "2026-04-15 14:30",
    status: "success",
    from: "Staging",
    to: "Production"
  },
  {
    id: 2,
    template_name: "Shot Blasting AHT (Inspection)",
    version: "v24",
    deployed_by: "System",
    date: "2026-04-12 09:15",
    status: "success",
    from: "Staging",
    to: "Production"
  },
  {
    id: 3,
    template_name: "Load Test",
    version: "v75",
    deployed_by: "Manhar",
    date: "2026-04-10 16:45",
    status: "success",
    from: "Staging",
    to: "Production"
  }
];

export default function Deploy() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const [isSwapped, setIsSwapped] = useState(false);
  
  const user = useMemo(() => getUserFromToken(), []);
  const isDlmsAdmin = user?.is_dlms_admin === true;

  const [customerFilter, setCustomerFilter] = useState(() => user?.customer_id || null);
  const [customerFilterName, setCustomerFilterName] = useState(() => user?.customer_name || "");
  
  const baseEnv = isSwapped ? 'staging' : 'production';
  const compareEnv = isSwapped ? 'production' : 'staging';
  
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  const [baseJson, setBaseJson] = useState('');
  const [compareJson, setCompareJson] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const [stagingRes, prodRes] = await Promise.all([
          apiGet('/api/v2/admin/templates?page_size=1000').catch(() => ({ templates: [] })),
          apiGet('/api/v2/admin/templates?page_size=1000', { env: 'prod' }).catch(() => ({ templates: [] }))
        ]);

        const stagingTemplates = stagingRes?.templates || [];
        const prodTemplates = prodRes?.templates || [];

        const templateMap = new Map();

        stagingTemplates.forEach(t => {
          templateMap.set(t.template_id, {
            template_id: t.template_id,
            template_name: t.template_name,
            customer_id: t.customer_id,
            customer_name: t.customer_name,
            staging_version: t.version,
            prod_version: null
          });
        });

        prodTemplates.forEach(t => {
          if (templateMap.has(t.template_id)) {
            templateMap.get(t.template_id).prod_version = t.version;
          } else {
            templateMap.set(t.template_id, {
              template_id: t.template_id,
              template_name: t.template_name,
              customer_id: t.customer_id,
              customer_name: t.customer_name,
              staging_version: null,
              prod_version: t.version
            });
          }
        });

        const merged = Array.from(templateMap.values());
        setTemplates(merged);
        if (merged.length > 0) {
          setSelectedTemplateId(merged[0].template_id);
        }
      } catch (error) {
        toast.error("Failed to load templates");
        console.error(error);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchDiffs = async () => {
      if (!selectedTemplateId) return;
      setLoadingDiff(true);
      setBaseJson('');
      setCompareJson('');
      try {
        const [baseRes, compareRes] = await Promise.all([
          apiGet(`/api/v2/admin/templates/${selectedTemplateId}`, { env: baseEnv === 'production' ? 'prod' : 'staging' }).catch(() => null),
          apiGet(`/api/v2/admin/templates/${selectedTemplateId}`, { env: compareEnv === 'production' ? 'prod' : 'staging' }).catch(() => null)
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
  }, [selectedTemplateId, baseEnv, compareEnv]);

  const handleDeploy = async () => {
    if (!selectedTemplateId || !compareJson) return;
    setDeploying(true);
    try {
      const payload = JSON.parse(compareJson);
      const targetEnvOption = { env: baseEnv === 'production' ? 'prod' : 'staging' };
      const isNewDeployment = !baseJson || baseJson === '' || baseJson === '{}';
      
      // Attempt to deploy to the base environment
      if (isNewDeployment) {
        await apiPost('/api/v2/admin/templates', payload, targetEnvOption);
      } else {
        await apiPut(`/api/v2/admin/templates/${selectedTemplateId}`, payload, targetEnvOption);
      }
      
      toast.success(`Successfully deployed ${selectedTemplateId} to ${baseEnv}!`);
      
      // Update local state to reflect deployment
      setBaseJson(compareJson); 
      
      setTemplates(prev => prev.map(t => {
        if (t.template_id === selectedTemplateId) {
          return {
            ...t,
            [baseEnv === 'staging' ? 'staging_version' : 'prod_version']: payload.version
          };
        }
        return t;
      }));

    } catch (error) {
      toast.error(`Failed to deploy: ${error.message || "Unknown error"}`);
      console.error(error);
    } finally {
      setDeploying(false);
    }
  };

  const selectedTemplate = templates.find(t => t.template_id === selectedTemplateId);

  const handleTemplateChange = (e) => {
    setSelectedTemplateId(e.target.value);
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = (t.template_name || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
                          (t.customer_name || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    // Since some old templates might lack customer_id in the API but have customer_name,
    // we filter by name if ID is missing or by ID if it's there.
    const matchesCustomer = customerFilter 
      ? (t.customer_id === customerFilter || t.customer_name === customerFilterName) 
      : true;
    
    return matchesSearch && matchesCustomer;
  });

  const baseVersion = selectedTemplate ? (baseEnv === 'production' ? selectedTemplate.prod_version : selectedTemplate.staging_version) : null;
  const compareVersion = selectedTemplate ? (compareEnv === 'production' ? selectedTemplate.prod_version : selectedTemplate.staging_version) : null;
  const canDeploy = selectedTemplate && compareJson && (baseJson !== compareJson);

  return (
    <div className="deploy-layout">
      {/* Sidebar */}
      <div className="deploy-sidebar">
        <div className="sidebar-header">
          <Package className="sidebar-logo" size={20} />
          <span>Deployments</span>
        </div>
        
        <div className="sidebar-nav">
          <button 
            className="nav-item back-home-btn"
            onClick={() => navigate('/')}
            style={{ marginBottom: '16px', color: '#64748b' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
          
          <div className="nav-section-title">NAVIGATION</div>
          <button 
            className={`nav-item ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            <GitMerge size={16} />
            <span>New Deployment</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>History</span>
          </button>
        </div>
        
        <div className="sidebar-footer">
          <button className="nav-item">
            <SettingsIcon size={16} />
            <div className="settings-text">
              <span>Settings</span>
              <span className="version">v1.0.0</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="deploy-main">
        {activeTab === 'new' && (
          <div className="deployment-view">
            <div className="deploy-header">
              <div className="header-titles">
                <h1>Compare & Deploy</h1>
                <p>Compare template versions between staging and production environments to safely deploy changes.</p>
              </div>
              <div className="deploy-filters" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="deploy-search">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by template name or customer..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="deploy-customer-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    initialCustomerName={customerFilterName}
                    disabled={!isDlmsAdmin}
                    title={!isDlmsAdmin ? "Must be admin to change customer" : undefined}
                  />
                  {customerFilter && isDlmsAdmin && (
                    <button
                      onClick={() => {
                        setCustomerFilter(null);
                        setCustomerFilterName("");
                      }}
                      className="clear-customer-filter-btn"
                      aria-label="Clear customer filter"
                      title="Clear customer filter"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredTemplates.filter(t => t.staging_version !== t.prod_version).length > 0 && (
              <div className="pending-deployments-card">
                <div className="pending-header">
                  <h3>Pending Deployments</h3>
                  <span className="pending-badge">{filteredTemplates.filter(t => t.staging_version !== t.prod_version).length} Updates Available</span>
                </div>
                <div className="pending-list">
                  {filteredTemplates.filter(t => t.staging_version !== t.prod_version).map(t => (
                    <div 
                      key={t.template_id} 
                      className={`pending-item ${selectedTemplateId === t.template_id ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplateId(t.template_id)}
                    >
                      <div className="pending-info">
                        <span className="pending-name">{t.template_name}</span>
                        <span className="pending-customer">{t.customer_name}</span>
                      </div>
                      <div className="pending-versions">
                        <span className="v-tag v-staging">{t.staging_version ? `v${t.staging_version}` : 'New'}</span>
                        <ArrowRight size={14} className="path-arrow" />
                        <span className="v-tag v-production">{t.prod_version ? `v${t.prod_version}` : 'Not Deployed'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="compare-card">
              <div className="compare-header">
                <div className="branch-selector">
                  <span className="selector-label">base:</span>
                  <div className={`env-badge ${baseEnv}-badge`}>{baseEnv}</div>
                </div>
                
                <button 
                  className="swap-btn" 
                  onClick={() => setIsSwapped(!isSwapped)}
                  title="Swap environments"
                >
                  <ArrowRightLeft size={16} />
                </button>
                
                <div className="branch-selector">
                  <span className="selector-label">compare:</span>
                  <div className={`env-badge ${compareEnv}-badge`}>{compareEnv}</div>
                </div>
              </div>

              <div className="compare-body">
                <div className="compare-controls">
                  <div className="form-group template-group">
                    <label>Select Template</label>
                    <select 
                      className="template-select"
                      value={selectedTemplateId}
                      onChange={handleTemplateChange}
                      disabled={loadingTemplates || filteredTemplates.length === 0}
                    >
                      {loadingTemplates ? (
                        <option>Loading templates...</option>
                      ) : filteredTemplates.length === 0 ? (
                        <option>No templates found</option>
                      ) : (
                        filteredTemplates.map(t => (
                          <option key={t.template_id} value={t.template_id}>
                            {t.template_name} ({t.customer_name})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {selectedTemplate && !loadingDiff && (
                  <div className="version-diff-container">
                    <div className="diff-status">
                      {canDeploy ? (
                        <div className="status-message can-deploy">
                          <CheckCircle2 size={18} />
                          <span>Able to deploy. The {compareEnv} template configuration differs from the base environment.</span>
                        </div>
                      ) : (
                        <div className="status-message up-to-date">
                          <CheckCircle2 size={18} />
                          <span>Environments are identical. No new changes to deploy.</span>
                        </div>
                      )}
                    </div>

                    <div className="diff-details">
                      <div className="diff-item">
                        <span className="diff-label">{baseEnv} Version</span>
                        <span className="diff-value">{baseVersion ? `v${baseVersion}` : 'Not Deployed'}</span>
                      </div>
                      <ArrowRight size={16} className="diff-arrow" />
                      <div className="diff-item">
                        <span className="diff-label">Deploying Version</span>
                        <span className="diff-value highlighted">{compareVersion ? `v${compareVersion}` : 'Not Available'}</span>
                      </div>
                    </div>

                    {canDeploy && (
                      <div className="deploy-action-row">
                        <button 
                          className="btn-primary deploy-btn-large" 
                          onClick={handleDeploy}
                          disabled={deploying}
                        >
                          {deploying ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              <span>Deploying...</span>
                            </>
                          ) : (
                            'Create Deployment'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {loadingDiff ? (
                  <div className="diff-viewer-loading">
                    <Loader2 size={32} className="animate-spin loading-icon" />
                    <p>Loading configuration data...</p>
                  </div>
                ) : (
                  selectedTemplate && canDeploy && (
                    <div className="diff-viewer-container">
                      <div className="diff-header">
                        <h3>Changes in Configuration JSON</h3>
                      </div>
                      <div className="diff-wrapper">
                        <ReactDiffViewer 
                          oldValue={baseJson || '{}'} 
                          newValue={compareJson || '{}'} 
                          splitView={true} 
                          useDarkTheme={false}
                          leftTitle={`${baseEnv} (${baseVersion ? `v${baseVersion}` : 'Empty'})`}
                          rightTitle={`${compareEnv} (${compareVersion ? `v${compareVersion}` : 'Empty'})`}
                          styles={{
                            variables: {
                              light: {
                                diffViewerBackground: '#fff',
                                diffViewerColor: '#111827',
                                addedBackground: '#e6ffec',
                                addedColor: '#166534',
                                removedBackground: '#ffeef0',
                                removedColor: '#991b1b',
                                wordAddedBackground: '#acf2bd',
                                wordRemovedBackground: '#fdb8c0',
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
                

              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-view">
            <div className="deploy-header">
              <div className="header-titles">
                <h1>Deployment History</h1>
                <p>View past deployments across your organization.</p>
              </div>
            </div>

            <div className="table-container">
              <table className="templates-table history-table">
                <thead>
                  <tr>
                    <th>TEMPLATE</th>
                    <th>VERSION</th>
                    <th>PATH</th>
                    <th>STATUS</th>
                    <th>DEPLOYED BY</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_HISTORY.map((hist) => (
                    <tr key={hist.id}>
                      <td className="font-medium">{hist.template_name}</td>
                      <td>
                        <span className="v-tag v-production">{hist.version}</span>
                      </td>
                      <td>
                        <div className="path-cell">
                          <span className="env-tag staging">{hist.from}</span>
                          <ArrowRight size={12} className="path-arrow" />
                          <span className="env-tag production">{hist.to}</span>
                        </div>
                      </td>
                      <td>
                        <div className="status-cell success">
                          <CheckCircle2 size={14} />
                          <span>Success</span>
                        </div>
                      </td>
                      <td>{hist.deployed_by}</td>
                      <td>
                        <div className="date-cell">
                          <Clock size={14} />
                          <span>{hist.date}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
