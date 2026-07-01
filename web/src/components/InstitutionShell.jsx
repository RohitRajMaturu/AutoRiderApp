import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { ICON } from "@/lib/iconScale";
import { useLogoutBackGuard } from "@/utils/useLogoutBackGuard";

function formatIstTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export default function InstitutionShell({
  activeSection,
  children,
  institutionName = "Institution",
  navItems,
  onSectionChange,
  subtitle,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { signingOut, beginLogout } = useLogoutBackGuard("/institution-login");

  useEffect(() => {
    setCollapsed(localStorage.getItem("ar_institution_sb") === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("ar_institution_sb", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (signingOut) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--ar-bg)] text-[var(--ar-t2)]"
        role="status"
        aria-live="polite"
      >
        Signing out securely…
      </div>
    );
  }

  const sidebarWidth = collapsed ? 68 : 232;
  const activeLabel =
    navItems.find((item) => item.key === activeSection)?.label || "Overview";

  return (
    <div className="min-h-screen bg-[var(--ar-bg)] text-[var(--ar-t1)]">
      <aside
        className="fixed left-0 top-0 z-50 hidden h-screen flex-col overflow-hidden border-r border-[var(--ar-border)] bg-[var(--ar-s1)] md:flex"
        style={{ width: sidebarWidth, transition: "width var(--ar-slow)" }}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ar-accent)] shadow-[var(--ar-shadow-glow)]">
            <img src="/tuktukGo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">TukTukSafe</p>
              <p className="truncate text-xs font-medium text-[var(--ar-t3)]">Institution Console</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3" aria-label="Institution navigation">
          {navItems.map(({ key, label, Icon }) => {
            const active = key === activeSection;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSectionChange(key)}
                className="group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition"
                style={{
                  background: active ? "var(--ar-accent-dim)" : "transparent",
                  color: active ? "var(--ar-accent)" : "var(--ar-t2)",
                }}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  <Icon size={ICON.md} />
                </span>
                {!collapsed ? <span className="truncate group-hover:translate-x-0.5">{label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-[var(--ar-border)] p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-9 w-full items-center justify-center rounded-lg border border-[var(--ar-border)] text-xs font-semibold text-[var(--ar-t2)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={ICON.md} /> : <ChevronLeft size={ICON.md} />}
          </button>
          <a
            href="/account/logout?next=%2Finstitution-login"
            onClick={beginLogout}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--ar-err-dim)] text-xs font-semibold text-[var(--ar-err)]"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={ICON.md} />
            {!collapsed ? <span>Sign out</span> : null}
          </a>
        </div>
      </aside>

      <div className="md:ml-[var(--institution-sidebar-width)]" style={{ "--institution-sidebar-width": `${sidebarWidth}px`, transition: "margin-left var(--ar-slow)" }}>
        <header className="sticky top-0 z-40 border-b border-[var(--ar-border)] bg-[var(--ar-s1)] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--ar-t3)]">
                Institution / {activeLabel}
              </p>
              <h1 className="text-xl font-semibold tracking-tight">{institutionName}</h1>
              {subtitle ? <p className="mt-0.5 text-xs text-[var(--ar-t2)]">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-[var(--ar-t2)]">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ar-border)]"
                aria-label="Refresh page"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
              <span>{formatIstTime(new Date(now))} IST</span>
              <a
                href="/account/logout?next=%2Finstitution-login"
                onClick={beginLogout}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ar-err-dim)] text-[var(--ar-err)] md:hidden"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={14} />
              </a>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Institution navigation">
            {navItems.map(({ key, label, Icon }) => {
              const active = key === activeSection;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSectionChange(key)}
                  className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{
                    background: active ? "var(--ar-accent-dim)" : "var(--ar-s2)",
                    borderColor: active ? "var(--ar-accent)" : "var(--ar-border)",
                    color: active ? "var(--ar-accent)" : "var(--ar-t2)",
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
