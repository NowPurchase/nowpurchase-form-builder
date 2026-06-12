import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { listPermissions, updateUserPermissions, listTemplatesForPermissions } from "../../services/permissionsApi";
import { getUserFromToken } from "../../services/api";
import { formatErrorMessage } from "../../utils/errorHandler";
import { toast } from "../shared/Toast";
import AppShell from "../shared/AppShell";
import CustomerDropdown from "../shared/CustomerDropdown";
import {
  Shield,
  Search,
  User,
  FileSpreadsheet,
  ChevronDown,
  Check,
  Loader2,
  Inbox,
  CheckSquare,
  Square,
  Save,
} from "lucide-react";

const LEVELS = [
  { value: "all", label: "All", color: "#2ba24c", enabled: true },
  { value: "edit", label: "Edit", color: "#1579be", enabled: false, comingSoon: true },
  { value: "view", label: "View", color: "#808080", enabled: false, comingSoon: true },
];

export default function Permissions({ onLogout }) {
  const [mode, setMode] = useState("user"); // 'user' | 'template'
  const [permissions, setPermissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [leftSearch, setLeftSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [rightFilter, setRightFilter] = useState("all"); // 'all' | 'granted'
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});

  const user = useMemo(() => getUserFromToken(), []);
  const isDlmsAdmin = user?.is_dlms_admin === true;

  const [customerFilter, setCustomerFilter] = useState(() => {
    const saved = sessionStorage.getItem("perm_customerFilter");
    if (saved && saved !== "null") return JSON.parse(saved);
    const userData = getUserFromToken();
    return userData?.customer_id || null;
  });
  const [customerFilterName, setCustomerFilterName] = useState(() => {
    const saved = sessionStorage.getItem("perm_customerFilterName");
    if (saved) return saved;
    const userData = getUserFromToken();
    return userData?.customer_name || "";
  });

  // Persist customer filter to sessionStorage
  useEffect(() => {
    if (customerFilter) {
      sessionStorage.setItem("perm_customerFilter", JSON.stringify(customerFilter));
    }
  }, [customerFilter]);

  useEffect(() => {
    if (customerFilterName) {
      sessionStorage.setItem("perm_customerFilterName", customerFilterName);
    }
  }, [customerFilterName]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [permsRes, templatesRes] = await Promise.all([
        listPermissions({ customer: customerFilter }),
        listTemplatesForPermissions({ page_size: 1000, customer: customerFilter }),
      ]);

      const permsList = Array.isArray(permsRes) ? permsRes : [];
      setPermissions(permsList);

      const templatesList = Array.isArray(templatesRes)
        ? templatesRes
        : (templatesRes?.results || templatesRes?.templates || []);
      setTemplates(templatesList);

      if (permsList.length > 0) {
        setSelectedId(permsList[0].user?.id);
      }
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [customerFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(leftSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [leftSearch]);

  // Fetch permissions when search changes (user mode)
  useEffect(() => {
    if (mode !== "user") return;

    const searchPermissions = async () => {
      setSearching(true);
      try {
        const permsRes = await listPermissions({
          customer: customerFilter,
          search: debouncedSearch || undefined,
        });
        setPermissions(Array.isArray(permsRes) ? permsRes : []);
      } catch (err) {
        console.error("Failed to search permissions:", err);
      } finally {
        setSearching(false);
      }
    };

    searchPermissions();
  }, [debouncedSearch, mode, customerFilter]);


  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setSelectedId(null);
    setLeftSearch("");
    setDebouncedSearch("");
    setRightSearch("");
    setRightFilter("all");
    setPendingChanges({});
    setDirty(false);

    if (newMode === "user" && permissions.length > 0) {
      setSelectedId(permissions[0].user?.id);
    } else if (newMode === "template" && templates.length > 0) {
      setSelectedId(templates[0].template_id);
    }
  };

  const leftItems = useMemo(() => {
    if (mode === "user") {
      return permissions.map(p => ({
        id: p.user?.id,
        name: p.user?.name || "Unknown",
        company: p.user?.company_name || "—",
        mobile: p.user?.mobile || "",
        initials: (p.user?.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
        isAdmin: p.is_dlms_admin || false,
        count: Object.keys(p.template_permissions || {}).length,
      }));
    }
    return templates.map(t => ({
      id: t.template_id,
      name: t.template_name || "Untitled",
      sub: `${t.customer_name || "System"} · v${t.version || "1"}`,
      isAdmin: false,
      count: permissions.filter(p => (p.template_permissions || {})[t.template_id]).length,
    }));
  }, [mode, permissions, templates]);

  const filteredLeftItems = useMemo(() => {
    let items = leftItems;

    // For template mode, filter locally by search
    if (mode === "template" && leftSearch) {
      const q = leftSearch.toLowerCase();
      items = items.filter(it =>
        it.name.toLowerCase().includes(q) ||
        it.sub.toLowerCase().includes(q)
      );
    }

    return items;
  }, [leftItems, leftSearch, mode]);

  const selectedItem = useMemo(() => {
    return leftItems.find(it => it.id === selectedId);
  }, [leftItems, selectedId]);

  const selectedPermission = useMemo(() => {
    if (mode !== "user") return null;
    return permissions.find(p => p.user?.id === selectedId);
  }, [mode, permissions, selectedId]);

  const rightItems = useMemo(() => {
    if (mode === "user") {
      const perm = permissions.find(p => p.user?.id === selectedId);
      const templatePerms = { ...perm?.template_permissions, ...pendingChanges };

      return templates.map(t => {
        const key = t.template_id;
        const granted = !!templatePerms[key];
        const level = templatePerms[key] || null;
        return {
          id: t.template_id,
          key,
          name: t.template_name || "Untitled",
          sub: `${t.customer_name || "System"} · v${t.version || "1"}`,
          granted,
          level,
        };
      });
    }

    const selectedTemplate = templates.find(t => t.template_id === selectedId);
    const key = selectedTemplate?.template_id;

    return permissions.map(p => {
      const userId = p.user?.id;
      const pendingLevel = pendingChanges[userId];
      const originalLevel = (p.template_permissions || {})[key] || null;

      // Determine current state based on pending changes
      let granted, level;
      if (pendingLevel === undefined) {
        granted = !!originalLevel;
        level = originalLevel;
      } else if (pendingLevel === null) {
        granted = false;
        level = null;
      } else {
        granted = true;
        level = pendingLevel;
      }

      return {
        id: userId,
        key,
        name: p.user?.name || "Unknown",
        company: p.user?.company_name || "—",
        mobile: p.user?.mobile || "",
        sub: p.user?.mobile || "—",
        initials: (p.user?.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
        granted,
        level,
        isAdmin: p.is_dlms_admin,
      };
    });
  }, [mode, selectedId, templates, permissions, pendingChanges]);

  const filteredRightItems = useMemo(() => {
    let items = rightItems;
    if (rightFilter === "granted") {
      items = items.filter(it => it.granted);
    }
    const q = rightSearch.toLowerCase();
    return items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      it.sub.toLowerCase().includes(q)
    );
  }, [rightItems, rightFilter, rightSearch]);

  const handleToggle = (itemId, itemKey) => {
    if (mode === "user") {
      setPendingChanges(prev => {
        const current = prev[itemKey];
        if (current === undefined) {
          const perm = permissions.find(p => p.user?.id === selectedId);
          const existing = perm?.template_permissions?.[itemKey];
          if (existing) {
            return { ...prev, [itemKey]: null };
          } else {
            return { ...prev, [itemKey]: "all" };
          }
        } else if (current === null) {
          return { ...prev, [itemKey]: "all" };
        } else {
          return { ...prev, [itemKey]: null };
        }
      });
      setDirty(true);
    } else if (mode === "template") {
      // itemId = user ID, itemKey = template ID (selectedId)
      setPendingChanges(prev => {
        const current = prev[itemId];
        if (current === undefined) {
          const perm = permissions.find(p => p.user?.id === itemId);
          const existing = perm?.template_permissions?.[itemKey];
          if (existing) {
            return { ...prev, [itemId]: null };
          } else {
            return { ...prev, [itemId]: "all" };
          }
        } else if (current === null) {
          return { ...prev, [itemId]: "all" };
        } else {
          return { ...prev, [itemId]: null };
        }
      });
      setDirty(true);
    }
  };

  const handleLevelChange = (itemIdOrKey, level) => {
    if (mode === "user") {
      setPendingChanges(prev => ({ ...prev, [itemIdOrKey]: level }));
      setDirty(true);
    } else if (mode === "template") {
      // itemIdOrKey is user ID in template mode
      setPendingChanges(prev => ({ ...prev, [itemIdOrKey]: level }));
      setDirty(true);
    }
  };

  const handleAdminToggle = () => {
    if (!selectedPermission) return;
    handleSaveAdmin(!selectedPermission.is_dlms_admin);
  };

  const handleSaveAdmin = async (isAdmin) => {
    setSaving(true);
    try {
      const response = await updateUserPermissions(selectedId, {
        template_permissions: selectedPermission.template_permissions,
        is_dlms_admin: isAdmin,
      });
      setPermissions(prev => prev.map(p => p.user?.id === selectedId ? response : p));
      toast.success(isAdmin ? "Admin access granted" : "Admin access revoked");
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!dirty || !selectedId) return;

    setSaving(true);
    try {
      if (mode === "user") {
        const perm = permissions.find(p => p.user?.id === selectedId);
        const newPerms = { ...perm?.template_permissions };

        Object.entries(pendingChanges).forEach(([key, value]) => {
          if (value === null) {
            delete newPerms[key];
          } else {
            newPerms[key] = value;
          }
        });

        const response = await updateUserPermissions(selectedId, {
          template_permissions: newPerms,
          is_dlms_admin: perm?.is_dlms_admin || false,
        });

        setPermissions(prev => prev.map(p => p.user?.id === selectedId ? response : p));
      } else if (mode === "template") {
        // pendingChanges is { [userId]: level }
        // selectedId is the template ID
        const updates = Object.entries(pendingChanges).map(async ([userId, level]) => {
          const perm = permissions.find(p => p.user?.id === Number(userId));
          if (!perm) return null;

          const newPerms = { ...perm.template_permissions };
          if (level === null) {
            delete newPerms[selectedId];
          } else {
            newPerms[selectedId] = level;
          }

          const response = await updateUserPermissions(Number(userId), {
            template_permissions: newPerms,
            is_dlms_admin: perm.is_dlms_admin || false,
          });
          return { userId: Number(userId), response };
        });

        const results = await Promise.all(updates);
        setPermissions(prev => {
          let updated = [...prev];
          results.forEach(result => {
            if (result) {
              updated = updated.map(p => p.user?.id === result.userId ? result.response : p);
            }
          });
          return updated;
        });
      }

      setPendingChanges({});
      setDirty(false);
      toast.success("Permissions saved");
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    const newChanges = {};
    filteredRightItems.forEach(it => {
      if (it.isAdmin) return; // Skip admins
      if (!it.granted) {
        const changeKey = mode === "user" ? it.key : it.id;
        newChanges[changeKey] = "all";
      }
    });
    setPendingChanges(prev => ({ ...prev, ...newChanges }));
    setDirty(true);
  };

  const handleClearAll = () => {
    const newChanges = {};
    filteredRightItems.forEach(it => {
      if (it.isAdmin) return; // Skip admins
      if (it.granted) {
        const changeKey = mode === "user" ? it.key : it.id;
        newChanges[changeKey] = null;
      }
    });
    setPendingChanges(prev => ({ ...prev, ...newChanges }));
    setDirty(true);
  };

  if (!isDlmsAdmin) {
    return (
      <AppShell active="permissions" onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="font-display text-xl font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">
            You need admin privileges to view this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="permissions" onLogout={onLogout}>
      <div className="perm-page-head">
        <div>
          <h1>Permissions</h1>
          <p>Control which users can access which templates. Pick a side to work from — the access you grant is the same either way.</p>
        </div>
        <div className="perm-cust-filter">
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

      <div className="perm-modebar">
        <div className="perm-seg">
          <button
            className={mode === "user" ? "on" : ""}
            onClick={() => handleModeChange("user")}
          >
            <User className="h-4 w-4" />
            By User
          </button>
          <button
            className={mode === "template" ? "on" : ""}
            onClick={() => handleModeChange("template")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            By Template
          </button>
        </div>
        <div className="perm-hint">
          {mode === "user"
            ? <>Select a <b>user</b>, then grant the templates they can access.</>
            : <>Select a <b>template</b>, then choose which users can access it.</>
          }
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      ) : (
        <div className="perm-grid">
          {/* LEFT PANE */}
          <aside className="perm-pane">
            <div className="perm-pane-head">
              <div className="perm-pane-title">
                {mode === "user" ? "Users" : "Templates"}
                <span className="muted">{filteredLeftItems.length}</span>
              </div>
              <div className="perm-search">
                <Search className="h-4 w-4" />
                <input
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                  placeholder={mode === "user" ? "Search users…" : "Search templates…"}
                />
              </div>
            </div>
            <div className="perm-list">
              {searching && mode === "user" ? (
                <div className="perm-empty" style={{ padding: "40px 20px" }}>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredLeftItems.length === 0 ? (
                <div className="perm-empty">
                  <Inbox className="h-10 w-10" />
                  <div className="et">No results</div>
                </div>
              ) : (
                filteredLeftItems.map(it => (
                  <button
                    key={it.id}
                    className={`perm-litem ${it.id === selectedId ? "active" : ""}`}
                    onClick={() => { setSelectedId(it.id); setPendingChanges({}); setDirty(false); }}
                  >
                    {mode === "user" ? (
                      <span className="perm-lic usr">{it.initials}</span>
                    ) : (
                      <span className="perm-lic tpl"><FileSpreadsheet className="h-[18px] w-[18px]" /></span>
                    )}
                    <div className="perm-linfo">
                      <div className="perm-ln">{it.name}</div>
                      <div className="perm-lc">
                        {mode === "user" ? (
                          <>{it.company}{it.mobile && <> · {it.mobile}</>}</>
                        ) : it.sub}
                      </div>
                    </div>
                    {it.isAdmin ? (
                      <span className="perm-admin-badge"><Shield className="h-3 w-3" />Admin</span>
                    ) : (
                      <span className={`perm-grant-pill ${it.count > 0 ? "has" : ""}`}>
                        {it.count} {mode === "user" ? (it.count === 1 ? "template" : "templates") : (it.count === 1 ? "user" : "users")}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* RIGHT PANE */}
          <section className="perm-assign">
            {selectedItem ? (
              <>
                <div className="perm-assign-head">
                  {mode === "user" ? (
                    <div className="perm-ha usr">{selectedItem.initials}</div>
                  ) : (
                    <div className="perm-ha tpl"><FileSpreadsheet className="h-5 w-5" /></div>
                  )}
                  <div className="perm-head-info">
                    <div className="perm-head-name">{selectedItem.name}</div>
                    <div className="perm-head-sub">{selectedItem.sub}</div>
                  </div>
                  <div className="perm-head-actions">
                    {mode === "user" && (
                      <>
                        <div className="perm-admin-toggle" onClick={handleAdminToggle}>
                          <span className="at-t">Admin</span>
                          <span className={`perm-switch ${selectedItem.isAdmin ? "on" : ""}`}></span>
                        </div>
                        <span className="perm-head-divider"></span>
                      </>
                    )}
                    <button
                      className="perm-btn-save"
                      disabled={!dirty || saving}
                      onClick={handleSave}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                </div>

                {mode === "user" && selectedItem.isAdmin && (
                  <div className="perm-admin-banner">
                    <Shield className="h-5 w-5" />
                    <span><b>{selectedItem.name} is a DLMS Admin</b> — they automatically have access to every template.</span>
                  </div>
                )}

                <div className="perm-assign-tools">
                  <div className="perm-search">
                    <Search className="h-4 w-4" />
                    <input
                      value={rightSearch}
                      onChange={(e) => setRightSearch(e.target.value)}
                      placeholder={mode === "user" ? "Search templates…" : "Search users…"}
                    />
                  </div>
                  <div className="perm-filter-seg">
                    <button className={rightFilter === "all" ? "on" : ""} onClick={() => setRightFilter("all")}>All</button>
                    <button className={rightFilter === "granted" ? "on" : ""} onClick={() => setRightFilter("granted")}>Granted</button>
                  </div>
                  {((mode === "user" && !selectedItem.isAdmin) || mode === "template") && (
                    <>
                      <button className="perm-selall" onClick={handleSelectAll}>
                        <CheckSquare className="h-4 w-4" />
                        Select all
                      </button>
                      <button className="perm-clearall" onClick={handleClearAll}>
                        <Square className="h-4 w-4" />
                        Clear
                      </button>
                    </>
                  )}
                </div>

                <div className={`perm-alist ${selectedItem.isAdmin ? "is-admin" : ""}`}>
                  {filteredRightItems.length === 0 ? (
                    <div className="perm-empty">
                      <Inbox className="h-10 w-10" />
                      <div className="et">Nothing to show</div>
                      <div className="ep">No {mode === "user" ? "templates" : "users"} match this filter.</div>
                    </div>
                  ) : (
                    filteredRightItems.map(it => (
                      <div key={it.id} className={`perm-arow ${it.granted ? "granted" : ""} ${mode === "template" && it.isAdmin ? "is-admin" : ""}`}>
                        <div
                          className={`perm-chk ${it.granted ? "on" : ""}`}
                          onClick={() => {
                            if (mode === "user" && selectedItem.isAdmin) return;
                            if (mode === "template" && it.isAdmin) return;
                            handleToggle(it.id, it.key);
                          }}
                        >
                          {it.granted && <Check className="h-3.5 w-3.5" />}
                        </div>
                        {mode === "user" ? (
                          <span className="perm-aic tpl"><FileSpreadsheet className="h-[18px] w-[18px]" /></span>
                        ) : (
                          <span className="perm-aic usr">{it.initials}</span>
                        )}
                        <div className="perm-ainfo">
                          <div className="perm-an">{it.name}</div>
                          <div className="perm-as">
                            {mode === "template" ? (
                              <>{it.company}{it.mobile && <> · {it.mobile}</>}</>
                            ) : it.sub}
                          </div>
                        </div>
                        {it.granted && (
                          <LevelDropdown
                            value={it.level}
                            onChange={(lvl) => handleLevelChange(mode === "user" ? it.key : it.id, lvl)}
                            disabled={mode === "user" ? selectedItem.isAdmin : it.isAdmin}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="perm-empty" style={{ height: "100%" }}>
                <Inbox className="h-10 w-10" />
                <div className="et">Select an item</div>
                <div className="ep">Choose a {mode === "user" ? "user" : "template"} from the left to manage permissions.</div>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function LevelDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LEVELS.find(l => l.value === value) || LEVELS[0];

  return (
    <div className="perm-level" ref={ref}>
      <button
        className="perm-level-btn"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        <span className="dot" style={{ background: current.color }}></span>
        {current.label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="perm-level-menu">
          {LEVELS.map(l => (
            <div
              key={l.value}
              className={`perm-level-opt ${value === l.value ? "sel" : ""} ${!l.enabled ? "disabled" : ""}`}
              onClick={() => {
                if (!l.enabled) return;
                onChange(l.value);
                setOpen(false);
              }}
            >
              <span className="dot" style={{ background: l.color }}></span>
              <span className="perm-level-label">
                {l.label}
                {l.comingSoon && <span className="coming-soon">Coming soon</span>}
              </span>
              {value === l.value && <Check className="h-4 w-4" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
