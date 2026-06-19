import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { ICON } from "@/lib/iconScale";

function formatIstTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const navItems = [
  { label: "Command Center", route: "/admin", Icon: LayoutDashboard },
  { label: "Operations", route: "/admin-ops", Icon: Activity },
];

export default function AdminShell({
  title,
  eyebrow = "Admin",
  refreshText,
  children,
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setCollapsed(localStorage.getItem("ar_sb") === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("ar_sb", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sidebarWidth = collapsed ? 64 : 220;
  const activeLabel = useMemo(
    () =>
      navItems.find((item) => location.pathname === item.route)?.label ||
      "Admin",
    [location.pathname],
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--ar-bg)", color: "var(--ar-t1)" }}
    >
      <aside
        className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r"
        style={{
          width: sidebarWidth,
          background: "var(--ar-s1)",
          borderColor: "var(--ar-border)",
          transition: "width var(--ar-slow)",
        }}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <img
            src="/tuktukGo.png"
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
          />
          {!collapsed ? (
            <span className="truncate text-sm font-semibold">TukTukGo</span>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map(({ label, route, Icon }) => {
            const active = location.pathname === route;
            return (
              <Link
                key={route}
                to={route}
                className="group flex h-10 items-center gap-3 rounded-lg border-l-2 px-3 text-sm font-medium transition"
                style={{
                  borderLeftColor: active ? "var(--ar-accent)" : "transparent",
                  background: active ? "var(--ar-accent-dim)" : "transparent",
                  color: active ? "var(--ar-accent)" : "var(--ar-t2)",
                }}
                title={collapsed ? label : undefined}
              >
                <Icon size={ICON.md} />
                {!collapsed ? <span className="truncate">{label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t p-3" style={{ borderColor: "var(--ar-border)" }}>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-9 w-full items-center justify-center rounded-lg border text-xs font-semibold"
            style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={ICON.md} /> : <ChevronLeft size={ICON.md} />}
          </button>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: "var(--ar-s3)", color: "var(--ar-t1)" }}
            >
              AD
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Admin</p>
                <p className="text-xs" style={{ color: "var(--ar-t2)" }}>
                  Operations
                </p>
              </div>
            ) : null}
          </div>
          <Link
            to="/account/logout"
            className="flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold"
            style={{ color: "var(--ar-t2)" }}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={ICON.md} />
            {!collapsed ? <span>Sign out</span> : null}
          </Link>
        </div>
      </aside>

      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left var(--ar-slow)",
        }}
      >
        <header
          className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-6 py-3"
          style={{
            background: "rgba(13,15,18,0.88)",
            borderColor: "var(--ar-border)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>
              {eyebrow} / {activeLabel}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium" style={{ color: "var(--ar-t2)" }}>
            {refreshText ? (
              <span
                className="rounded-lg px-3 py-2"
                style={{ background: "var(--ar-accent-dim)", color: "var(--ar-accent)" }}
              >
                {refreshText}
              </span>
            ) : null}
            <span>{formatIstTime(new Date(now))} IST</span>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
