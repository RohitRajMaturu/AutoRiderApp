import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  CreditCard,
  IndianRupee,
  MapPin,
  Radio,
  Route,
  Search,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminShell from "@/components/AdminShell";
import AutoRideIcon from "@/components/AutoRideIcon";
import StatusBadge, { statusForDriver as driverStatusKey } from "@/components/ui/StatusBadge";
import { ICON } from "@/lib/iconScale";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return `Rs. ${Math.round(numberValue(value)).toLocaleString("en-IN")}`;
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return "Masked";
  return `•••• ${digits.slice(-4)}`;
}

function relativeTime(value) {
  if (!value) return "Never";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Never";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatShortDate(value, options = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    ...options,
  }).format(date);
}

function formatHour(value) {
  const numericHour = Number(value);
  if (Number.isInteger(numericHour) && numericHour >= 0 && numericHour <= 23) {
    const suffix = numericHour >= 12 ? "PM" : "AM";
    const hour = numericHour % 12 || 12;
    return `${hour}${suffix}`;
  }
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: true,
  })
    .format(date)
    .replace(" ", "");
}

function formatReason(value) {
  return String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isGhostDriver(driver) {
  if (!driver?.is_online) return false;
  if (!driver.last_heartbeat_at) return true;
  return Date.now() - new Date(driver.last_heartbeat_at).getTime() > 90_000;
}

function driverStatus(driver) {
  if (isGhostDriver(driver)) return "ghost";
  if (driver.is_online) return "online";
  if (!driver.is_approved) return "pending";
  return "offline";
}

function subscriptionState(driver) {
  if (!driver?.is_approved) return "pending";
  const status = String(driver.subscription_status || "").toLowerCase();
  if (["halted", "cancelled", "expired"].includes(status)) return status;
  const expiry = driver.subscription_expiry ? new Date(driver.subscription_expiry) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return "missing";
  if (expiry <= new Date()) return "expired";
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
  return daysLeft <= 7 ? "expiring" : "active";
}

function subscriptionDaysLeft(driver) {
  const expiry = driver?.subscription_expiry ? new Date(driver.subscription_expiry) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
}

function metricTone(tone) {
  return {
    amber: "var(--ar-accent)",
    green: "var(--ar-ok)",
    cyan: "var(--ar-info)",
    red: "var(--ar-err)",
  }[tone] || "var(--ar-accent)";
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const labels = { rides: "Rides", fare: "Revenue" };
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{
        background: "rgba(13,15,18,0.94)",
        borderColor: "var(--ar-border)",
        color: "var(--ar-t1)",
      }}
    >
      <p className="mb-1 font-semibold" style={{ color: "var(--ar-t3)" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: entry.color }}>
            {labels[entry.dataKey] || entry.name}:{" "}
            <strong>{entry.dataKey === "fare" ? formatCurrency(entry.value) : entry.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, tone, Icon, helper, progress }) {
  const color = metricTone(tone);

  return (
    <div className="ar-metric-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ar-t3)" }}>
            {label}
          </p>
          <p className="mt-3 truncate text-3xl font-extrabold tracking-[-0.02em]" style={{ color: "var(--ar-t1)" }}>
            {value}
          </p>
          {helper ? (
            <p className="mt-2 text-xs font-medium" style={{ color: "var(--ar-t2)" }}>
              {helper}
            </p>
          ) : null}
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
            color,
          }}
        >
          <Icon size={ICON.xl} />
        </div>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-4">
          <div className="ar-progress-track">
            <div
              className="ar-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(progress, 100))}%`,
                background: color,
                boxShadow: `0 0 10px ${color}`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminLoadingState() {
  return (
    <section className="ar-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--ar-accent-dim)" }}>
            <AutoRideIcon size={ICON.xl} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ar-t1)" }}>
              Loading command center
            </p>
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--ar-t2)" }}>
              Syncing rides, driver fleet, revenue, and admin controls.
            </p>
          </div>
        </div>
        <span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--ar-warn-dim)", color: "var(--ar-warn)" }}>
          Live data initializing
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {["Authentication", "Operations API", "Fleet telemetry"].map((item) => (
          <div key={item} className="rounded-lg border p-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s3)" }}>
            <div className="ar-skeleton h-2 w-20" />
            <p className="mt-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyRow({ colSpan, icon: Icon, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="ar-td py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <Icon size={24} style={{ color: "var(--ar-t3)" }} />
          <span style={{ color: "var(--ar-t3)", fontSize: 13 }}>{label}</span>
        </div>
      </td>
    </tr>
  );
}

function LiveRideQueue({ rides }) {
  return (
    <div className="ar-card overflow-hidden p-0">
      <div className="ar-section-header px-5 pt-5">
        <div>
          <h2 className="ar-section-title">Live Ride Queue</h2>
          <p className="ar-section-meta">Requested and accepted rides needing attention</p>
        </div>
        <StatusBadge status={rides.length ? "accepted" : "offline"} label={`${rides.length} live`} />
      </div>
      <div className="max-h-[410px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="ar-th">Ride</th>
              <th className="ar-th">Status</th>
              <th className="ar-th">Passenger</th>
              <th className="ar-th">Driver</th>
              <th className="ar-th">Fare</th>
              <th className="ar-th">Created</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((ride) => (
              <tr key={ride.id} className="ar-tr">
                <td className="ar-td font-mono text-xs">{String(ride.id).slice(0, 8)}</td>
                <td className="ar-td"><StatusBadge status={ride.status} /></td>
                <td className="ar-td" style={{ color: "var(--ar-t2)" }}>
                  {ride.passenger_phone ? maskPhone(ride.passenger_phone) : ride.passenger_email || "-"}
                </td>
                <td className="ar-td">
                  <div className="flex items-center gap-2">
                    <AutoRideIcon size={ICON.sm} />
                    <span style={{ color: "var(--ar-t2)" }}>{ride.vehicle_number || "Unassigned"}</span>
                  </div>
                </td>
                <td className="ar-td font-semibold">
                  {ride.estimated_fare ? formatCurrency(ride.estimated_fare) : "-"}
                </td>
                <td className="ar-td" style={{ color: "var(--ar-t3)" }}>
                  {relativeTime(ride.created_at)}
                </td>
              </tr>
            ))}
            {!rides.length ? <EmptyRow colSpan={6} icon={Route} label="No active rides right now" /> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FleetTable({ drivers }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = useMemo(
    () => ({
      all: drivers.length,
      online: drivers.filter((driver) => driverStatus(driver) === "online").length,
      idle: drivers.filter((driver) => driverStatus(driver) === "ghost").length,
      offline: drivers.filter((driver) => driverStatus(driver) === "offline").length,
      pending: drivers.filter((driver) => driverStatus(driver) === "pending").length,
    }),
    [drivers],
  );

  const filteredDrivers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return drivers
      .filter((driver) => filter === "all" || driverStatus(driver) === filter)
      .filter((driver) => {
        if (!needle) return true;
        return [driver.vehicle_number, driver.phone, driver.email, driver.id]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(needle));
      })
      .slice(0, 8);
  }, [drivers, filter, query]);

  return (
    <div className="ar-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--ar-border)" }}>
        <div>
          <h2 className="ar-section-title">Driver Fleet</h2>
          <p className="ar-section-meta">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ar-search">
            <Search size={14} color="var(--ar-t3)" />
            <input
              aria-label="Search drivers"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fleet"
              value={query}
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear driver search">
                <X size={13} color="var(--ar-t3)" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              ["all", `All ${counts.all}`],
              ["online", `Online ${counts.online}`],
              ["idle", `Ghost ${counts.idle}`],
              ["offline", `Offline ${counts.offline}`],
              ["pending", `Pending ${counts.pending}`],
            ].map(([key, label]) => (
              <button
                aria-pressed={filter === key}
                className="ar-filter-btn"
                key={key}
                onClick={() => setFilter(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="ar-th">Vehicle</th>
              <th className="ar-th">Status</th>
              <th className="ar-th">30d</th>
              <th className="ar-th">Rating</th>
              <th className="ar-th">Subscription</th>
              <th className="ar-th">Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map((driver) => {
              const ghost = isGhostDriver(driver);
              const status = driverStatus(driver);
              return (
                <tr key={driver.id} className="ar-tr">
                  <td className="ar-td">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "var(--ar-accent-dim)", color: "var(--ar-accent)" }}
                      >
                        <AutoRideIcon size={ICON.md} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold" style={{ color: "var(--ar-t1)" }}>
                          {driver.vehicle_number || "Unassigned"}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--ar-t2)" }}>
                          {driver.phone || driver.email || "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="ar-td">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={driverStatusKey(driver)} label={status} />
                      {ghost ? (
                        <span className="ar-pill" style={{ background: "var(--ar-warn-dim)", color: "var(--ar-warn)" }}>
                          GHOST
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="ar-td font-mono">{numberValue(driver.completed_rides_30d)}</td>
                  <td className="ar-td">
                    {numberValue(driver.avg_driver_rating_30d) > 0 ? (
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--ar-warn)" }}>
                        <Star size={12} fill="currentColor" />
                        {Number(driver.avg_driver_rating_30d).toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ar-t3)" }}>-</span>
                    )}
                  </td>
                  <td className="ar-td" style={{ color: "var(--ar-t2)" }}>
                    {formatShortDate(driver.subscription_expiry, { year: "numeric" })}
                  </td>
                  <td className="ar-td" style={{ color: "var(--ar-t3)" }}>
                    {relativeTime(driver.last_heartbeat_at || driver.updated_at)}
                  </td>
                </tr>
              );
            })}
            {!filteredDrivers.length ? <EmptyRow colSpan={6} icon={Users} label="No drivers match the current view" /> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CancellationPanel({ reasons }) {
  const total = reasons.reduce((sum, item) => sum + numberValue(item.count), 0);
  const colors = ["var(--ar-err)", "var(--ar-warn)", "var(--ar-info)", "var(--ar-accent)", "var(--ar-ok)"];

  return (
    <div className="ar-card">
      <div className="ar-section-header">
        <div className="flex items-center gap-2">
          <AlertTriangle size={ICON.md} color="var(--ar-warn)" />
          <h2 className="ar-section-title">Why Rides Cancel</h2>
        </div>
        <span className="ar-section-meta">Top reasons</span>
      </div>
      <div className="space-y-3">
        {reasons.map((item, index) => {
          const pct = total ? Math.round((numberValue(item.count) / total) * 100) : 0;
          const color = colors[index % colors.length];
          return (
            <div key={`${item.cancellation_reason}-${index}`}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium" style={{ color: "var(--ar-t1)" }}>
                  {formatReason(item.cancellation_reason)}
                </span>
                <span className="font-mono text-xs font-semibold" style={{ color }}>
                  {numberValue(item.count)}
                </span>
              </div>
              <div className="ar-progress-track">
                <div className="ar-progress-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
        {!reasons.length ? (
          <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t3)" }}>
            No cancellation reasons recorded yet
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FunnelPanel({ stats }) {
  const total = numberValue(stats?.totalRides);
  const completed = numberValue(stats?.completedRides);
  const cancelled = numberValue(stats?.cancelledRides);
  const active = numberValue(stats?.activeRides);
  const items = [
    { label: "Completion Rate", value: total ? Math.round((completed / total) * 100) : 0, color: "var(--ar-ok)" },
    { label: "Cancellation Rate", value: total ? Math.round((cancelled / total) * 100) : 0, color: "var(--ar-err)" },
    { label: "Active Queue Share", value: total ? Math.round((active / total) * 100) : 0, color: "var(--ar-info)" },
  ];

  return (
    <div className="ar-card">
      <div className="ar-section-header">
        <div className="flex items-center gap-2">
          <TrendingUp size={ICON.md} color="var(--ar-info)" />
          <h2 className="ar-section-title">Operating Funnel</h2>
        </div>
        <span className="ar-section-meta">{total} total rides</span>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--ar-t2)" }}>{item.label}</span>
              <span className="font-mono text-xs font-bold" style={{ color: item.color }}>{item.value}%</span>
            </div>
            <div className="ar-progress-track">
              <div className="ar-progress-fill" style={{ width: `${item.value}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsPanel({ drivers }) {
  const insights = useMemo(() => {
    const approved = drivers.filter((driver) => driver.is_approved);
    const counts = approved.reduce(
      (acc, driver) => {
        const state = subscriptionState(driver);
        acc[state] = (acc[state] || 0) + 1;
        if (driver.manual_payment_link) acc.manualLinks += 1;
        if (numberValue(driver.subscription_failure_count) > 0) acc.failures += 1;
        return acc;
      },
      {
        active: 0,
        expiring: 0,
        expired: 0,
        halted: 0,
        cancelled: 0,
        missing: 0,
        pending: 0,
        queued: 0,
        manualLinks: 0,
        failures: 0,
      },
    );
    counts.queued = approved.filter((driver) => driver.queued_subscription_plan).length;
    const attention = approved
      .map((driver) => ({
        driver,
        state: subscriptionState(driver),
        daysLeft: subscriptionDaysLeft(driver),
      }))
      .filter(({ driver, state }) =>
        ["expiring", "expired", "halted", "cancelled", "missing"].includes(state) ||
        driver.manual_payment_link ||
        numberValue(driver.subscription_failure_count) > 0,
      )
      .sort((a, b) => {
        const priority = { halted: 0, expired: 1, cancelled: 2, missing: 3, expiring: 4, active: 5 };
        return (priority[a.state] ?? 9) - (priority[b.state] ?? 9);
      })
      .slice(0, 5);

    return {
      approvedCount: approved.length,
      counts,
      attention,
    };
  }, [drivers]);

  const activeCoverage = insights.approvedCount
    ? Math.round(((insights.counts.active + insights.counts.expiring) / insights.approvedCount) * 100)
    : 0;
  const atRisk =
    insights.counts.expiring +
    insights.counts.expired +
    insights.counts.halted +
    insights.counts.cancelled +
    insights.counts.missing;

  return (
    <div className="ar-card">
      <div className="ar-section-header">
        <div className="flex items-center gap-2">
          <CreditCard size={ICON.md} color="var(--ar-info)" />
          <h2 className="ar-section-title">Payments & Subscriptions</h2>
        </div>
        <span className="ar-section-meta">Driver access health</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Coverage", `${activeCoverage}%`, "var(--ar-ok)", `${insights.counts.active + insights.counts.expiring}/${insights.approvedCount}`],
          ["At Risk", atRisk, "var(--ar-warn)", "needs review"],
          ["Queued", insights.counts.queued, "var(--ar-accent)", "next-cycle plans"],
          ["Failures", insights.counts.failures, "var(--ar-err)", "payment issues"],
        ].map(([label, value, color, helper]) => (
          <div key={label} className="rounded-lg border p-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)" }}>
            <p className="font-mono text-xl font-bold" style={{ color }}>{value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>{label}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ar-t2)" }}>{helper}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>
            Attention Queue
          </span>
          <span className="text-xs" style={{ color: "var(--ar-t2)" }}>
            Subscription expiry controls dispatch eligibility
          </span>
        </div>
        <div className="space-y-2">
          {insights.attention.map(({ driver, state, daysLeft }) => (
            <div
              key={driver.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ar-accent-dim)", color: "var(--ar-accent)" }}>
                  <AutoRideIcon size={ICON.md} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{driver.vehicle_number || "Unassigned"}</p>
                  <p className="truncate text-xs" style={{ color: "var(--ar-t2)" }}>
                    {driver.phone || driver.email || "-"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className="ar-pill"
                  style={{
                    background: state === "expiring" ? "var(--ar-warn-dim)" : "var(--ar-err-dim)",
                    color: state === "expiring" ? "var(--ar-warn)" : "var(--ar-err)",
                  }}
                >
                  {state}
                </span>
                <p className="mt-1 text-xs" style={{ color: "var(--ar-t3)" }}>
                  {daysLeft === null ? "No expiry" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                </p>
              </div>
            </div>
          ))}
          {!insights.attention.length ? (
            <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t3)" }}>
              No payment or subscription issues need attention
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      try {
        const [statsRes, driversRes, ridesRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/drivers"),
          fetch("/api/admin/rides"),
        ]);
        const failed = [
          [statsRes, "stats"],
          [driversRes, "drivers"],
          [ridesRes, "rides"],
        ].find(([response]) => !response.ok);
        if (failed) {
          const [response, label] = failed;
          throw new Error(`Could not load admin ${label} data (${response.status})`);
        }
        const [statsBody, driversBody, ridesBody] = await Promise.all([
          statsRes.json(),
          driversRes.json(),
          ridesRes.json(),
        ]);
        if (!active) return;
        setError("");
        setStats(statsBody.stats || {});
        setDrivers(driversBody.drivers || []);
        setRides(ridesBody.rides || []);
      } catch (err) {
        if (active) setError(err.message || "Could not load admin data");
      }
    }

    loadAdminData();
    const timer = setInterval(loadAdminData, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const liveRides = useMemo(
    () => rides.filter((ride) => ["requested", "accepted"].includes(ride.status)),
    [rides],
  );
  const topDrivers = useMemo(
    () =>
      [...drivers]
        .sort((a, b) => numberValue(b.completed_rides_30d) - numberValue(a.completed_rides_30d))
        .slice(0, 5),
    [drivers],
  );
  const chartData = useMemo(
    () =>
      (stats?.hourlyTimeline || []).map((item) => ({
        label: formatHour(item.hour),
        rides: numberValue(item.rides),
        fare: Math.round(numberValue(item.fare)),
      })),
    [stats?.hourlyTimeline],
  );
  const onlineDrivers = drivers.filter((driver) => driver.is_online && driver.is_approved).length;
  const completionProgress = numberValue(stats?.totalRides)
    ? Math.round((numberValue(stats?.completedRides) / numberValue(stats?.totalRides)) * 100)
    : 0;
  const isInitialLoading = !stats && !error;

  return (
    <AdminShell title="TukTukGo Command Center" eyebrow="Admin">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {error ? (
          <div className="rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--ar-err)", background: "var(--ar-err-dim)", color: "var(--ar-err)" }}>
            {error}
          </div>
        ) : null}
        {isInitialLoading ? <AdminLoadingState /> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Active Rides"
            value={stats ? numberValue(stats.activeRides) : "..."}
            helper={`${numberValue(stats?.todayRides)} rides today`}
            tone="amber"
            Icon={Route}
            progress={numberValue(stats?.todayRides) ? Math.min(numberValue(stats?.activeRides) * 20, 100) : 0}
          />
          <Metric
            label="Online Drivers"
            value={stats ? numberValue(stats.activeDrivers) : "..."}
            helper={`${onlineDrivers}/${numberValue(stats?.totalDrivers)} approved online`}
            tone="green"
            Icon={AutoRideIcon}
            progress={numberValue(stats?.totalDrivers) ? Math.round((onlineDrivers / numberValue(stats?.totalDrivers)) * 100) : 0}
          />
          <Metric
            label="Completed"
            value={stats ? numberValue(stats.completedRides) : "..."}
            helper={`${completionProgress}% completion rate`}
            tone="cyan"
            Icon={Activity}
            progress={completionProgress}
          />
          <Metric
            label="Today Fare"
            value={stats ? formatCurrency(stats.todayFareValue) : "..."}
            helper={`${formatCurrency(stats?.totalFareValue)} lifetime fare`}
            tone="amber"
            Icon={IndianRupee}
          />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <div className="ar-card min-h-[330px]">
            <div className="ar-section-header">
              <div>
                <h2 className="ar-section-title">Today Rides & Revenue</h2>
                <p className="ar-section-meta">Hourly rides as bars, revenue as the trend line</p>
              </div>
              <span className="ar-pill" style={{ background: "var(--ar-ok-dim)", color: "var(--ar-ok)" }}>
                <span className="ar-live-dot" />
                Live refresh
              </span>
            </div>
            <div className="h-[250px]">
              {!isMounted ? null : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ left: -20, right: 6, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#565C6E", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="rides"
                      tick={{ fill: "#565C6E", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="fare"
                      orientation="right"
                      tick={{ fill: "#565C6E", fontSize: 11 }}
                      axisLine={false}
                      tickFormatter={(value) => `Rs.${Math.round(numberValue(value))}`}
                      tickLine={false}
                      width={58}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      yAxisId="rides"
                      dataKey="rides"
                      name="Rides"
                      fill="#F5A623"
                      fillOpacity={0.72}
                      radius={[5, 5, 0, 0]}
                    />
                    <Line
                      yAxisId="fare"
                      type="monotone"
                      dataKey="fare"
                      name="Revenue"
                      stroke="#38BDF8"
                      strokeWidth={2.4}
                      dot={{ r: 2.5, fill: "#38BDF8", strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: "#38BDF8", stroke: "#0D0F12", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t3)" }}>
                  <Clock size={24} />
                  <p className="mt-2 text-sm">No hourly ride data for today</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-5">
            <FunnelPanel stats={stats} />
            <div className="ar-card">
              <div className="ar-section-header">
                <div className="flex items-center gap-2">
                  <Radio size={ICON.md} color="var(--ar-ok)" />
                  <h2 className="ar-section-title">Fleet Pulse</h2>
                </div>
                <span className="ar-section-meta">{relativeTime(new Date())}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Online", onlineDrivers, "var(--ar-ok)"],
                  ["Pending", numberValue(stats?.pendingDrivers), "var(--ar-warn)"],
                  ["Live", liveRides.length, "var(--ar-info)"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-lg border p-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)" }}>
                    <p className="font-mono text-xl font-bold" style={{ color }}>{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <LiveRideQueue rides={liveRides} />
          <div className="ar-card">
            <div className="ar-section-header">
              <div className="flex items-center gap-2">
                <Users size={ICON.lg} color="var(--ar-accent)" />
                <h2 className="ar-section-title">Top Drivers</h2>
              </div>
              <span className="ar-section-meta">30 days</span>
            </div>
            <div className="space-y-3">
              {topDrivers.map((driver, index) => (
                <div key={driver.id} className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)" }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ar-accent-dim)", color: "var(--ar-accent)" }}>
                      <AutoRideIcon size={ICON.md} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{driver.vehicle_number || "Unassigned"}</p>
                      <p className="truncate text-xs" style={{ color: "var(--ar-t2)" }}>
                        {driver.phone || driver.email || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold" style={{ color: index === 0 ? "var(--ar-accent)" : "var(--ar-t1)" }}>
                      {numberValue(driver.completed_rides_30d)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>rides</p>
                  </div>
                </div>
              ))}
              {!topDrivers.length ? (
                <div className="rounded-lg border p-8 text-center text-sm" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t3)" }}>
                  No drivers yet
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <FleetTable drivers={drivers} />

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PaymentsPanel drivers={drivers} />
          <CancellationPanel reasons={stats?.cancellationReasons || []} />
        </section>

        <section>
          <a
            href="/admin-ops"
            className="ar-card flex items-center justify-between gap-5 transition"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ar-accent)" }}>
                <MapPin size={ICON.md} />
                Operations depth
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.02em]">Ops Dashboard</p>
              <p className="mt-2 max-w-xl text-sm font-normal" style={{ color: "var(--ar-t2)" }}>
                Fleet heartbeat, zones, audit log, cancellation analytics, and live operational controls.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ar-accent-dim)", color: "var(--ar-accent)" }}>
              <ArrowRight size={ICON.xl} />
            </div>
          </a>
        </section>
      </div>
    </AdminShell>
  );
}
