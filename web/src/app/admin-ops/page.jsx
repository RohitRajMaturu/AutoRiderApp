import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { redirect } from "react-router";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import { ChevronDown, ChevronUp, Search, Users } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/AdminShell";
import StatusBadge, { statusForDriver as driverStatusKey } from "@/components/ui/StatusBadge";

const PRIMARY = "#F5A623";
const BG = "#0D0F12";
const TEXT = "#F0F2F5";
const TEXT_SEC = "#8A8F9E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const GOLD = "#F59E0B";
const PURPLE = "#38BDF8";
const BORDER = "rgba(255,255,255,0.08)";
const SURFACE = "#1C2028";
const SURFACE_2 = "#242830";

const queryClient = new QueryClient();

export async function loader({ request }) {
  const [{ auth }, { default: sql }] = await Promise.all([
    import("@/auth"),
    import("@/app/api/utils/sql"),
  ]);
  const session = await auth(request);
  const url = new URL(request.url);
  const signinUrl = `/account/signin?callbackUrl=${encodeURIComponent(
    url.pathname,
  )}&role=admin`;

  if (!session?.user?.id) {
    return redirect(signinUrl);
  }

  const rows = await sql`
    SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") {
    return redirect(signinUrl);
  }

  return null;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return `Rs. ${Math.round(numberValue(value)).toLocaleString("en-IN")}`;
}

function relativeTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return "Yesterday";
  return `${Math.floor(diffHours / 24)}d ago`;
}

function isGhostDriver(driver) {
  if (!driver?.is_online) return false;
  if (!driver.last_heartbeat_at) return true;
  return Date.now() - new Date(driver.last_heartbeat_at).getTime() > 90_000;
}

function truncate(value, max = 15) {
  const text = String(value || "-");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatAction(action) {
  return String(action || "").replace(/\./g, " / ");
}

function formatReason(reason) {
  const known = {
    accepted_timeout: "Ride Timed Out (Auto)",
    admin_cancelled: "Admin Override",
    admin_stuck_ride_cancelled: "Stuck Ride (Admin)",
    driver_cancelled: "Driver Cancelled",
    passenger_cancelled: "Passenger Cancelled",
    unknown: "Unknown",
  };
  if (known[reason]) return known[reason];
  return String(reason || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadata(metadata) {
  if (!metadata) return "-";
  let object = metadata;
  if (typeof metadata === "string") {
    try {
      object = JSON.parse(metadata);
    } catch {
      return truncate(metadata, 60);
    }
  }
  const text = Object.entries(object)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(" ");
  return text.length > 60 ? `${text.slice(0, 60)}...` : text || "-";
}

function formatHour(hour) {
  const normalized = Number(hour);
  if (normalized === 0) return "12AM";
  if (normalized === 12) return "12PM";
  return normalized > 12 ? `${normalized - 12}PM` : `${normalized}AM`;
}

function formatDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { weekday: "short" });
}

function useAnimatedCount(target, duration = 800) {
  const [value, setValue] = useState(numberValue(target));

  useEffect(() => {
    const start = performance.now();
    const from = value;
    const to = numberValue(target);
    let frame = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

const Card = forwardRef(function Card({ children, className = "" }, ref) {
  return (
    <section
      ref={ref}
      className={`rounded-lg border p-5 shadow-sm ${className}`}
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {children}
    </section>
  );
});

function Skeleton() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border p-5 shadow-sm" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "var(--ar-accent-dim)" }}>
              <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: PRIMARY }} />
            </div>
            <div>
              <p className="text-sm font-black" style={{ color: TEXT }}>
                Building live operations view
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: TEXT_SEC }}>
                Loading fleet telemetry, ride queue, zones, audit logs, and revenue signals.
              </p>
            </div>
          </div>
          <span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--ar-warn-dim)", color: GOLD }}>
            Enterprise data sync
          </span>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border p-5"
            style={{ borderColor: BORDER, background: SURFACE }}
          >
            <div className="h-3 w-24 animate-pulse rounded-full" style={{ background: SURFACE_2 }} />
            <div className="mt-5 h-9 w-20 animate-pulse rounded-lg" style={{ background: SURFACE_2 }} />
            <div className="mt-5 h-2 w-full animate-pulse rounded-full" style={{ background: SURFACE_2 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="rounded-lg border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="mb-5 h-4 w-44 animate-pulse rounded-full" style={{ background: SURFACE_2 }} />
          <div className="h-56 animate-pulse rounded-lg" style={{ background: SURFACE_2 }} />
        </div>
        <div className="rounded-lg border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="mb-3 h-10 animate-pulse rounded-lg last:mb-0"
              style={{ background: SURFACE_2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ show, onRetry }) {
  if (!show) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: ERROR, background: "var(--ar-err-dim)", color: ERROR }}>
      <span>Failed to load ops data. Retrying.</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg px-3 py-1 text-xs font-semibold shadow-sm"
        style={{ background: SURFACE_2, color: ERROR }}
      >
        Retry
      </button>
    </div>
  );
}

function FleetDonut({ idle, online }) {
  const size = 54;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const idlePct = online > 0 ? idle / online : 0;
  const busyPct = 1 - idlePct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={SURFACE_2}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={SUCCESS}
        strokeWidth={stroke}
        strokeDasharray={`${circumference * idlePct} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={PRIMARY}
        strokeWidth={stroke}
        strokeDasharray={`${circumference * busyPct} ${circumference}`}
        strokeDashoffset={-(circumference * idlePct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function MetricCards({ snapshot }) {
  const liveRides = useAnimatedCount(snapshot.liveRides);
  const onlineDrivers = useAnimatedCount(snapshot.onlineDrivers);
  const todayFare = useAnimatedCount(snapshot.todayFare);
  const avgRating = snapshot.conversionFunnel?.avg_rating;
  const animatedRating = useAnimatedCount(avgRating ? avgRating * 10 : 0);
  const idle = numberValue(snapshot.idleDrivers);
  const online = numberValue(snapshot.onlineDrivers);
  const completedToday = numberValue(snapshot.todayCompletedRides);
  const cancelledToday = numberValue(snapshot.todayCancelledRides);
  const todayTotal = completedToday + cancelledToday;
  const completionPct = todayTotal ? Math.round((completedToday / todayTotal) * 100) : 0;
  const funnel = snapshot.conversionFunnel || {};
  const leftRequested = numberValue(funnel.left_requested);
  const completionRate = leftRequested
    ? Math.round((numberValue(funnel.completed) / leftRequested) * 100)
    : 0;
  const completionColor =
    completionRate > 70 ? SUCCESS : completionRate < 50 ? ERROR : GOLD;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
          Active Rides
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: TEXT }}>
          {liveRides}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status="requested" label={`${snapshot.requestedRides} waiting`} />
          <StatusBadge status="accepted" label={`${snapshot.acceptedRides} in-trip`} />
        </div>
        <p
          className="mt-4 text-sm font-medium"
          style={{ color: snapshot.demandSupplyGap > 0 ? ERROR : SUCCESS }}
        >
          {snapshot.demandSupplyGap > 0
            ? `Attention: ${snapshot.demandSupplyGap} unmet requests`
            : "Supply adequate"}
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
              Drivers Online
            </p>
            <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: TEXT }}>
              {onlineDrivers}
            </div>
            <p className="mt-3 text-sm font-normal" style={{ color: TEXT_SEC }}>
              {idle} idle / {Math.max(online - idle, 0)} on trip
            </p>
          </div>
          <FleetDonut idle={idle} online={online} />
        </div>
        {snapshot.staleDriverCount > 0 ? (
          <p className="mt-4 text-xs font-medium" style={{ color: GOLD }}>
            {snapshot.staleDriverCount} may be ghost online
          </p>
        ) : null}
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
          Today's Fare Value
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: TEXT }}>
          {formatCurrency(todayFare)}
        </div>
        <p className="mt-3 text-sm font-normal" style={{ color: TEXT_SEC }}>
          {completedToday} completed / {cancelledToday} cancelled today
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: SURFACE_2 }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${completionPct}%`, backgroundColor: PRIMARY }}
          />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
          Avg Driver Rating (24h)
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: TEXT }}>
          {avgRating === null || avgRating === undefined
            ? "-"
            : `${(animatedRating / 10).toFixed(1)} rating`}
        </div>
        <p className="mt-3 text-sm font-normal" style={{ color: TEXT_SEC }}>
          Avg accept time: {funnel.avg_accept_minutes ?? "-"} min /{" "}
          {funnel.total_created ?? 0} rides created
        </p>
        <span
          className="mt-4 inline-flex rounded-md px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: completionColor }}
        >
          {completionRate}% completed
        </span>
      </Card>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload || {};
  return (
    <div className="rounded-lg border p-3 text-xs shadow-lg" style={{ borderColor: BORDER, background: SURFACE_2 }}>
      <p className="mb-2 font-semibold" style={{ color: TEXT }}>
        {label}
      </p>
      <p style={{ color: TEXT_SEC }}>Total: {point.total}</p>
      <p style={{ color: TEXT_SEC }}>Completed: {point.completed}</p>
      <p style={{ color: TEXT_SEC }}>Fare: {formatCurrency(point.fare)}</p>
    </div>
  );
}

function Timeline({ snapshot, sectionRef }) {
  const [range, setRange] = useState("today");
  const [metric, setMetric] = useState("rides");
  const data = useMemo(() => {
    if (range === "today") {
      const byHour = new Map(
        (snapshot.hourlyToday || []).map((item) => [numberValue(item.hour), item]),
      );
      return Array.from({ length: 17 }, (_, index) => {
        const hour = index + 6;
        const item = byHour.get(hour) || {};
        return {
          label: formatHour(hour),
          total: numberValue(item.total),
          completed: numberValue(item.completed),
          fare: numberValue(item.fare),
        };
      });
    }
    return (snapshot.weeklyTimeline || []).map((item) => ({
      label: formatDay(item.day),
      total: numberValue(item.total),
      completed: numberValue(item.completed),
      fare: numberValue(item.fare),
    }));
  }, [range, snapshot.hourlyToday, snapshot.weeklyTimeline]);

  return (
    <Card className="min-h-[312px]" ref={sectionRef}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold" style={{ color: TEXT }}>
          Ride Volume & Revenue
        </h2>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {[
            ["today", "Today (hourly)"],
            ["week", "This Week (daily)"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor: range === id ? PRIMARY : BORDER,
                backgroundColor: range === id ? PRIMARY : "transparent",
                color: range === id ? BG : TEXT_SEC,
              }}
            >
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-current" />
              {label}
            </button>
          ))}
          {[
            ["rides", "Rides"],
            ["fare", "Fare"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMetric(id)}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor: metric === id ? PURPLE : BORDER,
                backgroundColor: metric === id ? PURPLE : "transparent",
                color: metric === id ? BG : TEXT_SEC,
              }}
            >
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-current" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data}>
          <CartesianGrid stroke={BORDER} vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={{ fill: TEXT_SEC, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="rides" tick={{ fill: TEXT_SEC, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="fare" orientation="right" hide />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="rides" dataKey="total" fill={SURFACE_2} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="rides" dataKey="completed" fill={PRIMARY} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="fare"
            type="monotone"
            dataKey="fare"
            stroke={PURPLE}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ZoneActivity({ snapshot, sectionRef }) {
  return (
    <Card ref={sectionRef}>
      <h2 className="mb-4 text-lg font-black" style={{ color: TEXT }}>
        Zone Activity
      </h2>
      {(snapshot.zoneActivity || []).length === 0 ? (
        <p className="text-sm font-bold" style={{ color: TEXT_SEC }}>
          No active zones configured.{" "}
          <a className="font-black underline" style={{ color: PRIMARY }} href="/admin-ops">
            Open zones in mobile admin
          </a>
        </p>
      ) : (
        <div className="space-y-4">
          {snapshot.zoneActivity.map((zone) => {
            const capacity = Math.max(numberValue(zone.max_online_drivers), 1);
            const utilization = Math.min(
              Math.round((numberValue(zone.active_rides) / capacity) * 100),
              100,
            );
            const color =
              utilization > 90 ? ERROR : utilization >= 70 ? GOLD : SUCCESS;
            return (
              <div key={zone.zone_name}>
                <div className="mb-2 flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-black" style={{ color: TEXT }}>
                    {zone.zone_name}
                  </span>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-black"
                    style={{
                      backgroundColor: zone.active_rides > 0 ? `${PRIMARY}20` : "#F1F5F9",
                      color: zone.active_rides > 0 ? PRIMARY : TEXT_SEC,
                    }}
                  >
                    {zone.active_rides} active
                  </span>
                  <span className="text-xs font-black" style={{ color: TEXT_SEC }}>
                    {zone.online_drivers}/{zone.max_online_drivers}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${utilization}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Funnel({ snapshot }) {
  const funnel = snapshot.conversionFunnel || {};
  const total = numberValue(funnel.total_created);
  const left = numberValue(funnel.left_requested);
  const completed = numberValue(funnel.completed);
  const cancelled = numberValue(funnel.cancelled);
  const rows = [
    {
      label: "Acceptance Rate",
      pct: total ? Math.round((left / total) * 100) : 0,
      color: SUCCESS,
    },
    {
      label: "Completion Rate",
      pct: left ? Math.round((completed / left) * 100) : 0,
      color: PRIMARY,
    },
    {
      label: "Cancellation Rate",
      pct: left ? Math.round((cancelled / left) * 100) : 0,
      color: ERROR,
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black" style={{ color: TEXT }}>
          24h Funnel
        </h2>
        <span className="text-xs font-bold" style={{ color: TEXT_SEC }}>
          rolling sample
        </span>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex justify-between text-xs font-black">
              <span style={{ color: TEXT_SEC }}>{row.label}</span>
              <span style={{ color: TEXT }}>{row.pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs font-bold" style={{ color: TEXT_SEC }}>
        Based on {total} rides in last 24h
      </p>
    </Card>
  );
}

function DriverTable({ drivers, sectionRef }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "is_online", dir: "desc" });
  const [page, setPage] = useState(0);

  const actionMutation = useMutation({
    mutationFn: async ({ driverId, payload }) => {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Driver action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opsDrivers"] });
      queryClient.invalidateQueries({ queryKey: ["opsSnapshot"] });
    },
    onError: (err) => toast.error(err.message || "Driver action failed"),
  });

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return [...drivers]
      .filter((driver) => {
        const matchesText =
          !text ||
          String(driver.vehicle_number || "").toLowerCase().includes(text) ||
          String(driver.phone || "").toLowerCase().includes(text);
        if (!matchesText) return false;
        if (filter === "online") return driver.is_online;
        if (filter === "on_trip") return driver.is_online && driver.on_trip;
        if (filter === "idle") return driver.is_online && !driver.on_trip;
        if (filter === "offline") return !driver.is_online && driver.is_approved;
        if (filter === "pending") return !driver.is_approved;
        return true;
      })
      .sort((a, b) => {
        const aValue = a[sort.key];
        const bValue = b[sort.key];
        const aComparable =
          typeof aValue === "boolean" ? Number(aValue) : numberValue(aValue) || String(aValue || "");
        const bComparable =
          typeof bValue === "boolean" ? Number(bValue) : numberValue(bValue) || String(bValue || "");
        if (aComparable < bComparable) return sort.dir === "asc" ? -1 : 1;
        if (aComparable > bComparable) return sort.dir === "asc" ? 1 : -1;
        return 0;
      });
  }, [drivers, filter, search, sort]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const start = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min((safePage + 1) * pageSize, filtered.length);

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  const sortBy = (key) => {
    setSort((current) => ({
      key,
      dir: current.key === key && current.dir === "desc" ? "asc" : "desc",
    }));
  };

  const header = (key, label) => {
    const active = sort.key === key;
    return (
    <button
      type="button"
      onClick={() => sortBy(key)}
      aria-label={`Sort drivers by ${label}${active ? `, ${sort.dir}` : ""}`}
      className="inline-flex items-center gap-1 text-left text-xs font-black uppercase tracking-wide"
      style={{ color: TEXT_SEC }}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      ) : null}
    </button>
    );
  };

  return (
    <Card ref={sectionRef}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" style={{ color: TEXT }}>
            Driver Fleet
          </h2>
          <p className="mt-1 text-xs font-bold" style={{ color: TEXT_SEC }}>
            Showing {start}–{end} of {filtered.length} drivers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER, background: SURFACE_2 }}>
            <Search size={15} color={TEXT_SEC} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vehicle or phone"
              aria-label="Search drivers by vehicle or phone"
              className="h-full bg-transparent text-sm font-medium"
              style={{ color: TEXT }}
            />
          </label>
          {[
            ["all", "All"],
            ["online", "Online"],
            ["on_trip", "On Trip"],
            ["idle", "Idle"],
            ["offline", "Offline"],
            ["pending", "Pending"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: filter === id ? PRIMARY : BORDER,
                backgroundColor: filter === id ? PRIMARY : SURFACE,
                color: filter === id ? BG : TEXT_SEC,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("vehicle_number", "Vehicle #")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("zone_name", "Zone")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("is_online", "Status")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("today_trips", "Today Trips")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("completed_30d", "30d Trips")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("avg_rating_30d", "Rating")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: SURFACE }}>{header("last_ride_at", "Last Active")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC, background: SURFACE }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((driver) => {
              const status = driverStatusKey(driver);
              const ghost = isGhostDriver(driver);
              return (
                <tr key={driver.id} className="group align-middle transition hover:bg-[var(--ar-s3)]">
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: TEXT }}>
                    {driver.vehicle_number || "-"}
                    <div className="text-xs font-normal" style={{ color: TEXT_SEC }}>
                      {driver.phone || driver.email || "-"}
                    </div>
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-normal" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                    {driver.zone_name || "Unzoned"}
                  </td>
                  <td className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
                    <StatusBadge status={status} label={ghost ? `${status.replace("_", " ")} / stale` : undefined} />
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: TEXT }}>
                    {driver.today_trips}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: TEXT }}>
                    {driver.completed_30d}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: GOLD }}>
                    {driver.avg_rating_30d ? `${driver.avg_rating_30d} rating` : "-"}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-normal" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                    {driver.on_trip ? "On trip now" : relativeTime(driver.last_ride_at)}
                  </td>
                  <td className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
                    <div className="flex flex-wrap gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                      {!driver.is_approved ? (
                        <button
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              driverId: driver.id,
                              payload: { is_approved: true, subscription_days: 30 },
                            })
                          }
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ backgroundColor: PRIMARY, color: BG }}
                        >
                          Approve
                        </button>
                      ) : null}
                      {driver.is_online ? (
                        <button
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              driverId: driver.id,
                              payload: { force_offline: true },
                            })
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: ERROR, color: ERROR }}
                        >
                          Force Offline
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toast("Open the mobile admin app to view full driver profile")}
                        className="rounded-lg border px-2 py-1.5 text-xs font-semibold"
                        style={{ borderColor: BORDER, color: TEXT_SEC }}
                        aria-label={`View ${driver.vehicle_number || "driver"} profile`}
                        title="View"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {visible.map((driver) => {
          const status = driverStatusKey(driver);
          const ghost = isGhostDriver(driver);
          return (
            <article
              key={driver.id}
              className="rounded-lg border p-4"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black" style={{ color: TEXT }}>
                    {driver.vehicle_number || "Unassigned vehicle"}
                  </h3>
                  <p className="mt-1 truncate text-xs font-bold" style={{ color: TEXT_SEC }}>
                    {driver.phone || driver.email || "-"}
                  </p>
                </div>
                <StatusBadge status={status} label={ghost ? `${status.replace("_", " ")} / stale` : undefined} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-bold" style={{ color: TEXT_SEC }}>Zone</dt>
                  <dd className="mt-1 font-black" style={{ color: TEXT }}>{driver.zone_name || "Unzoned"}</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: TEXT_SEC }}>Today</dt>
                  <dd className="mt-1 font-black" style={{ color: TEXT }}>{driver.today_trips} trips</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: TEXT_SEC }}>30 days</dt>
                  <dd className="mt-1 font-black" style={{ color: TEXT }}>{driver.completed_30d} trips</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: TEXT_SEC }}>Last active</dt>
                  <dd className="mt-1 font-black" style={{ color: TEXT }}>
                    {driver.on_trip ? "On trip now" : relativeTime(driver.last_ride_at)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {!driver.is_approved ? (
                  <button
                    type="button"
                    onClick={() =>
                      actionMutation.mutate({
                        driverId: driver.id,
                        payload: { is_approved: true, subscription_days: 30 },
                      })
                    }
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ backgroundColor: PRIMARY, color: BG }}
                  >
                    Approve
                  </button>
                ) : null}
                {driver.is_online ? (
                  <button
                    type="button"
                    onClick={() =>
                      actionMutation.mutate({
                        driverId: driver.id,
                        payload: { force_offline: true },
                      })
                    }
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: ERROR, color: ERROR }}
                  >
                    Force Offline
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toast("Open the mobile admin app to view full driver profile")}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: BORDER, color: TEXT_SEC }}
                >
                  View
                </button>
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? (
          <div className="rounded-lg border px-3 py-8 text-center" style={{ borderColor: BORDER, color: TEXT_SEC }}>
            <Users className="mx-auto mb-2" size={32} color="var(--ar-t3)" />
            <p className="text-sm font-medium">No drivers match this filter</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ar-t3)" }}>
              Try clearing search or changing status filter
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: TEXT_SEC }}>
          Page {safePage + 1} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(current - 1, 0))}
          disabled={safePage === 0}
          className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-40"
          style={{ borderColor: BORDER, color: TEXT }}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
          disabled={safePage >= totalPages - 1}
          className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-40"
          style={{ borderColor: BORDER, color: TEXT }}
        >
          Next
        </button>
        </div>
      </div>
    </Card>
  );
}

function AuditLog({ snapshot, sectionRef }) {
  return (
    <Card ref={sectionRef}>
      <h2 className="mb-4 text-lg font-black" style={{ color: TEXT }}>
        Recent Admin Actions
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-black uppercase tracking-wide" style={{ color: TEXT_SEC }}>
              <th className="border-b px-3 py-2" style={{ borderColor: BORDER }}>Time</th>
              <th className="border-b px-3 py-2" style={{ borderColor: BORDER }}>Admin</th>
              <th className="border-b px-3 py-2" style={{ borderColor: BORDER }}>Action</th>
              <th className="border-b px-3 py-2" style={{ borderColor: BORDER }}>Target</th>
              <th className="border-b px-3 py-2" style={{ borderColor: BORDER }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot.recentAuditLog || []).map((item) => (
              <tr key={item.id}>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                  {relativeTime(item.created_at)}
                </td>
                <td className="border-b px-3 py-3 font-black" style={{ borderColor: BORDER, color: TEXT }}>
                  {truncate(item.phone || item.email)}
                </td>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: BORDER, color: PRIMARY }}>
                  {formatAction(item.action)}
                </td>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                  {item.target_type} {String(item.target_id || "").slice(0, 8)}
                </td>
                <td className="border-b px-3 py-3" style={{ borderColor: BORDER }}>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs" style={{ color: TEXT_SEC }}>
                    {formatMetadata(item.metadata)}
                  </code>
                </td>
              </tr>
            ))}
            {(snapshot.recentAuditLog || []).length === 0 ? (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-center text-sm font-bold" style={{ color: TEXT_SEC }}>
                  No recent admin actions
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CancellationBreakdown({ snapshot }) {
  const data = snapshot.cancellationBreakdown || [];
  const max = Math.max(...data.map((item) => numberValue(item.count)), 1);

  return (
    <Card>
      <h2 className="mb-4 text-lg font-black" style={{ color: TEXT }}>
        Why Rides Cancel (Last 7 Days)
      </h2>
      {data.length === 0 ? (
        <p className="text-sm font-bold" style={{ color: SUCCESS }}>
          No cancellations in this window
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={item.reason}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-bold" style={{ color: TEXT }}>
                  {formatReason(item.reason)}
                </span>
                <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-black" style={{ color: ERROR }}>
                  {item.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(numberValue(item.count) / max) * 100}%`,
                    backgroundColor: ERROR,
                    opacity: Math.max(0.35, 1 - index * 0.12),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AdminOpsPageContent() {
  const overviewRef = useRef(null);
  const driversRef = useRef(null);
  const zonesRef = useRef(null);
  const auditRef = useRef(null);
  const [activeNav, setActiveNav] = useState("overview");
  const [countdown, setCountdown] = useState(15);
  const [now, setNow] = useState(Date.now());

  const snapshotQuery = useQuery({
    queryKey: ["opsSnapshot"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ops-snapshot");
      if (!res.ok) throw new Error("Failed to load ops snapshot");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const driversQuery = useQuery({
    queryKey: ["opsDrivers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ops-drivers");
      if (!res.ok) throw new Error("Failed to load ops drivers");
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    setCountdown(15);
  }, [snapshotQuery.dataUpdatedAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((value) => (value <= 0 ? 15 : value - 1));
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = snapshotQuery.data || {};
  const drivers = driversQuery.data?.drivers || [];
  const lastUpdatedSeconds = snapshotQuery.dataUpdatedAt
    ? Math.floor((now - snapshotQuery.dataUpdatedAt) / 1000)
    : 0;
  const progressPct = ((15 - countdown) / 15) * 100;
  const isInitialLoading = snapshotQuery.isLoading || driversQuery.isLoading;

  const navItems = [
    ["overview", "Overview", overviewRef],
    ["drivers", "Drivers", driversRef],
    ["zones", "Zones", zonesRef],
    ["audit", "Audit Log", auditRef],
  ];

  const scrollTo = (id, ref) => {
    setActiveNav(id);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AdminShell
      title="TukTukGo Operations Console"
      eyebrow="Admin"
      refreshText={`Refreshing in ${countdown}s`}
    >
      <div className="fixed left-0 top-0 z-[60] h-1 transition-all duration-1000" style={{ width: `${progressPct}%`, backgroundColor: PRIMARY }} />
      <div className="space-y-5" style={{ color: TEXT }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: "var(--ar-ok-dim)", color: SUCCESS }}>
                  LIVE
                </span>
                <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: SURFACE_2, color: TEXT_SEC }}>
                  Dispatch Control
                </span>
              </div>
              <p className="mt-2 text-xs font-normal" style={{ color: TEXT_SEC }}>
                Fleet telemetry, zone utilization, stuck-ride controls, audit history, and revenue flow.
              </p>
            </div>
            <div className="text-right text-xs font-medium" style={{ color: TEXT_SEC }}>
              Last updated: {lastUpdatedSeconds}s ago
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map(([id, label, ref]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id, ref)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{
                  borderColor: activeNav === id ? PRIMARY : BORDER,
                  backgroundColor: activeNav === id ? "var(--ar-accent-dim)" : SURFACE,
                  color: activeNav === id ? PRIMARY : TEXT_SEC,
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <ErrorBanner
            show={snapshotQuery.isError || driversQuery.isError}
            onRetry={() => {
              snapshotQuery.refetch();
              driversQuery.refetch();
            }}
          />
          {lastUpdatedSeconds > 60 ? (
            <div className="rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: GOLD, background: "var(--ar-warn-dim)", color: GOLD }}>
              Data may be stale. Last updated {lastUpdatedSeconds}s ago. Check connection.
            </div>
          ) : null}

          {isInitialLoading ? (
            <Skeleton />
          ) : (
            <>
              <div ref={overviewRef} className="scroll-mt-24">
                <MetricCards snapshot={snapshot} />
              </div>

              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
                <Timeline snapshot={snapshot} />
                <div ref={zonesRef} className="grid gap-5 scroll-mt-24">
                  <ZoneActivity snapshot={snapshot} />
                  <Funnel snapshot={snapshot} />
                </div>
              </div>

              <div ref={driversRef} className="scroll-mt-24">
                <DriverTable drivers={drivers} />
              </div>

              <div ref={auditRef} className="grid scroll-mt-24 grid-cols-1 gap-5 xl:grid-cols-2">
                <AuditLog snapshot={snapshot} />
                <CancellationBreakdown snapshot={snapshot} />
              </div>
            </>
          )}
        </div>
    </AdminShell>
  );
}

export default function AdminOpsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminOpsPageContent />
    </QueryClientProvider>
  );
}
