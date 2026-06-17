import { NavLink } from "react-router-dom";
import { createElement, useMemo } from "react";
import { LayoutGrid, GitCompareArrows, History, LogOut, Shield } from "lucide-react";
import { getUserFromToken, removeToken } from "../../services/api";
import { IS_PROD } from "../../config/env";

/**
 * AppShell — left "Liquid Glass" sidebar + main content area.
 * Pure presentation/navigation wrapper. No business logic lives here.
 *
 * Props:
 *   active     — "templates" | "deployments" | "history"  (kept for clarity; NavLink
 *                also derives the active state from the current route)
 *   onLogout   — optional. When provided (e.g. from Home), it is called so the parent
 *                can flip auth state without a reload. When absent (e.g. Deploy), the
 *                shell performs a hard logout (clear token + redirect to "/").
 *   title      — page title shown in the mobile-only top bar (desktop uses the
 *                sidebar + the page's own header instead). The mobile top bar is
 *                intentionally title-only — no actions/logout (logout lives in the
 *                desktop sidebar footer).
 *   children   — page content, rendered inside <main className="app-main">
 */
const NAV = [
  { to: "/home", label: "Templates", icon: LayoutGrid },
  { to: "/permissions", label: "Permissions", icon: Shield },
  { to: "/deploy", label: "Deployments", icon: GitCompareArrows, prodOnly: true, disabledForNonAdmin: true },
  { to: "/history", label: "History", icon: History },
];

export default function AppShell({ onLogout, title, children }) {
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
    } catch {
      /* no-op */
    }
    localStorage.clear();
    window.location.href = "/";
  };

  // Nav items visible to this user in the desktop sidebar — each tagged with
  // its disabled state.
  const visibleNav = NAV.filter(({ prodOnly }) => !(prodOnly && !IS_PROD)).map((item) => ({
    ...item,
    disabled: item.disabledForNonAdmin && !user?.is_dlms_admin,
  }));

  // Mobile bottom tab bar exposes only Templates (read-only) + Permissions —
  // the two things an admin needs from a phone.
  const mobileNav = visibleNav.filter(({ to }) => to === "/home" || to === "/permissions");

  return (
    <div className="app-shell app-shell-bg">
      {/* Mobile-only top bar — title only (no actions / no logout) */}
      <header className="app-topbar">
        <span className="app-topbar-title">{title}</span>
      </header>

      <aside className="app-sidebar">
        <div className="app-brand">
          <img src="/np-mark.svg" alt="NowPurchase" />
          <div className="wm">
            MetalCloud
            <small>Admin Panel</small>
          </div>
        </div>

        <div className="app-nav-title">Workspace</div>
        {visibleNav.map(({ to, label, icon, disabled }) =>
          disabled ? (
            <div
              key={to}
              className="app-nav-item disabled"
              title="Admin access required"
            >
              {createElement(icon)}
              <span>{label}</span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `app-nav-item ${isActive ? "active" : ""}`}
            >
              {createElement(icon)}
              <span>{label}</span>
            </NavLink>
          )
        )}

        <div className="app-sidebar-foot">
          <div className="app-avatar">{initials}</div>
          <div className="min-w-0">
            <div className="nm">{name}</div>
            <div className="org">{user?.customer_name || "NowPurchase"}</div>
          </div>
          <button className="lo" title="Log out" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="app-main">{children}</main>

      {/* Mobile-only bottom tab bar (Permissions only) */}
      <nav className="app-bottomnav">
        {mobileNav.map(({ to, label, icon, disabled }) =>
          disabled ? (
            <div key={to} className="app-tab disabled" title="Admin access required">
              {createElement(icon)}
              <span>{label}</span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `app-tab ${isActive ? "active" : ""}`}
            >
              {createElement(icon)}
              <span>{label}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}
