import { NavLink, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { LayoutGrid, GitCompareArrows, History, LogOut } from "lucide-react";
import { getUserFromToken, removeToken } from "../../services/api";

/**
 * AppShell — left "Liquid Glass" sidebar + main content area.
 * Pure presentation/navigation wrapper. No business logic lives here.
 *
 * Props:
 *   active   — "templates" | "deployments" | "history"  (kept for clarity; NavLink
 *              also derives the active state from the current route)
 *   onLogout — optional. When provided (e.g. from Home), it is called so the parent
 *              can flip auth state without a reload. When absent (e.g. Deploy), the
 *              shell performs a hard logout (clear token + redirect to "/").
 *   children — page content, rendered inside <main className="app-main">
 */
const NAV = [
  { to: "/home", label: "Templates", icon: LayoutGrid },
  { to: "/deploy", label: "Deployments", icon: GitCompareArrows },
  { to: "/history", label: "History", icon: History },
];

export default function AppShell({ onLogout, children }) {
  const navigate = useNavigate();
  const user = useMemo(() => getUserFromToken(), []);

  const name = user?.name || user?.customer_name || "DLMS User";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      removeToken();
    } catch (e) {
      /* no-op */
    }
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="app-shell app-shell-bg">
      <aside className="app-sidebar">
        <div className="app-brand">
          <img src="/np-mark.svg" alt="NowPurchase" />
          <div className="wm">
            DLMS
            <small>Admin Panel</small>
          </div>
        </div>

        <div className="app-nav-title">Workspace</div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `app-nav-item ${isActive ? "active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="app-sidebar-foot">
          <div className="app-avatar">{initials}</div>
          <div className="min-w-0">
            <div className="nm">{name}</div>
            <div className="org">NowPurchase · DLMS</div>
          </div>
          <button className="lo" title="Log out" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
