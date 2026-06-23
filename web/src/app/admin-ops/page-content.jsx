import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { ICON } from "@/lib/iconScale";

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

function GhostDriverBadge() {
  return (
    <span
      className="ml-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: "var(--ar-warn-dim)", color: "var(--ar-warn)" }}
    >
      GHOST
    </span>
  );
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
      style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}
    >
      {children}
    </section>
  );
});

function Skeleton() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "var(--ar-accent-dim)" }}>
              <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: "var(--ar-accent)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ar-t1)" }}>
                Building live operations view
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
                Loading fleet telemetry, ride queue, zones, audit logs, and revenue signals.
              </p>
            </div>
          </div>
          <span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--ar-warn-dim)", color: "var(--ar-warn)" }}>
            Enterprise data sync
          </span>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border p-5"
            style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}
          >
            <div className="h-3 w-24 animate-pulse rounded-full" style={{ background: "var(--ar-s3)" }} />
            <div className="mt-5 h-9 w-20 animate-pulse rounded-lg" style={{ background: "var(--ar-s3)" }} />
            <div className="mt-5 h-2 w-full animate-pulse rounded-full" style={{ background: "var(--ar-s3)" }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
          <div className="mb-5 h-4 w-44 animate-pulse rounded-full" style={{ background: "var(--ar-s3)" }} />
          <div className="h-56 animate-pulse rounded-lg" style={{ background: "var(--ar-s3)" }} />
        </div>
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="mb-3 h-10 animate-pulse rounded-lg last:mb-0"
              style={{ background: "var(--ar-s3)" }}
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
    <div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--ar-err)", background: "var(--ar-err-dim)", color: "var(--ar-err)" }}>
      <span>Failed to load ops data. Retrying.</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg px-3 py-1 text-xs font-semibold shadow-sm"
        style={{ background: "var(--ar-s3)", color: "var(--ar-err)" }}
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
        stroke={"var(--ar-s3)"}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={"var(--ar-ok)"}
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
        stroke={"var(--ar-accent)"}
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
    completionRate > 70 ? "var(--ar-ok)" : completionRate < 50 ? "var(--ar-err)" : "var(--ar-warn)";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
          Active Rides
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: "var(--ar-t1)" }}>
          {liveRides}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status="requested" label={`${snapshot.requestedRides} waiting`} />
          <StatusBadge status="accepted" label={`${snapshot.acceptedRides} in-trip`} />
        </div>
        <p
          className="mt-4 text-sm font-medium"
          style={{ color: snapshot.demandSupplyGap > 0 ? "var(--ar-err)" : "var(--ar-ok)" }}
        >
          {snapshot.demandSupplyGap > 0
            ? `Attention: ${snapshot.demandSupplyGap} unmet requests`
            : "Supply adequate"}
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
              Drivers Online
            </p>
            <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: "var(--ar-t1)" }}>
              {onlineDrivers}
            </div>
            <p className="mt-3 text-sm font-normal" style={{ color: "var(--ar-t2)" }}>
              {idle} idle / {Math.max(online - idle, 0)} on trip
            </p>
          </div>
          <FleetDonut idle={idle} online={online} />
        </div>
        {snapshot.staleDriverCount > 0 ? (
          <p className="mt-4 text-xs font-medium" style={{ color: "var(--ar-warn)" }}>
            {snapshot.staleDriverCount} may be ghost online
          </p>
        ) : null}
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
          Today's Fare Value
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: "var(--ar-t1)" }}>
          {formatCurrency(todayFare)}
        </div>
        <p className="mt-3 text-sm font-normal" style={{ color: "var(--ar-t2)" }}>
          {completedToday} completed / {cancelledToday} cancelled today
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: "var(--ar-s3)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${completionPct}%`, backgroundColor: "var(--ar-accent)" }}
          />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
          Avg Driver Rating (24h)
        </p>
        <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: "var(--ar-t1)" }}>
          {avgRating === null || avgRating === undefined
            ? "-"
            : `${(animatedRating / 10).toFixed(1)} rating`}
        </div>
        <p className="mt-3 text-sm font-normal" style={{ color: "var(--ar-t2)" }}>
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
    <div className="rounded-lg border p-3 text-xs shadow-lg" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s3)" }}>
      <p className="mb-2 font-semibold" style={{ color: "var(--ar-t1)" }}>
        {label}
      </p>
      <p style={{ color: "var(--ar-t2)" }}>Total: {point.total}</p>
      <p style={{ color: "var(--ar-t2)" }}>Completed: {point.completed}</p>
      <p style={{ color: "var(--ar-t2)" }}>Fare: {formatCurrency(point.fare)}</p>
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
        <h2 className="text-base font-semibold" style={{ color: "var(--ar-t1)" }}>
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
                borderColor: range === id ? "var(--ar-accent)" : "var(--ar-border)",
                backgroundColor: range === id ? "var(--ar-accent)" : "transparent",
                color: range === id ? "var(--ar-bg)" : "var(--ar-t2)",
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
                borderColor: metric === id ? "var(--ar-info)" : "var(--ar-border)",
                backgroundColor: metric === id ? "var(--ar-info)" : "transparent",
                color: metric === id ? "var(--ar-bg)" : "var(--ar-t2)",
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
          <CartesianGrid stroke={"var(--ar-border)"} vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={{ fill: "var(--ar-t2)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="rides" tick={{ fill: "var(--ar-t2)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="fare" orientation="right" hide />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="rides" dataKey="total" fill={"var(--ar-s3)"} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="rides" dataKey="completed" fill={"var(--ar-accent)"} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="fare"
            type="monotone"
            dataKey="fare"
            stroke={"var(--ar-info)"}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ZoneActivity({ snapshot, sectionRef }) {
  const queryClient = useQueryClient();
  const toggleDispatch = useMutation({
    mutationFn: async ({ zoneId, enabled }) => {
      const res = await fetch("/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zoneId, dispatch_enabled: enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update zone dispatch");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opsSnapshot"] });
      toast.success("Zone dispatch updated");
    },
    onError: (err) => toast.error(err.message || "Could not update zone dispatch"),
  });

  return (
    <Card ref={sectionRef}>
      <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--ar-t1)" }}>
        Zone Activity
      </h2>
      {(snapshot.zoneActivity || []).length === 0 ? (
        <p className="text-sm font-bold" style={{ color: "var(--ar-t2)" }}>
          No active zones configured.{" "}
          <a className="font-semibold underline" style={{ color: "var(--ar-accent)" }} href="/admin-ops">
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
              utilization > 90 ? "var(--ar-err)" : utilization >= 70 ? "var(--ar-warn)" : "var(--ar-ok)";
            const dispatchEnabled = zone.dispatch_enabled !== false;
            return (
              <div key={zone.zone_name}>
                <div className="mb-2 flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--ar-t1)" }}>
                    {zone.zone_name}
                  </span>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: zone.active_rides > 0 ? "var(--ar-accent-dim)" : "var(--ar-s3)",
                      color: zone.active_rides > 0 ? "var(--ar-accent)" : "var(--ar-t2)",
                    }}
                  >
                    {zone.active_rides} active
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--ar-t2)" }}>
                    {zone.online_drivers}/{zone.max_online_drivers}
                  </span>
                  {zone.zone_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        toggleDispatch.mutate({
                          zoneId: zone.zone_id,
                          enabled: !dispatchEnabled,
                        })
                      }
                      disabled={toggleDispatch.isPending}
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:opacity-50"
                      style={{
                        background: dispatchEnabled ? "var(--ar-accent-dim)" : "var(--ar-s3)",
                        borderColor: dispatchEnabled ? "var(--ar-accent)" : "var(--ar-border)",
                      }}
                      aria-label={`${dispatchEnabled ? "Disable" : "Enable"} dispatch for ${zone.zone_name}`}
                      title={`${dispatchEnabled ? "Disable" : "Enable"} dispatch`}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full transition"
                        style={{
                          background: dispatchEnabled ? "var(--ar-accent)" : "var(--ar-t2)",
                          transform: `translateX(${dispatchEnabled ? 22 : 4}px)`,
                        }}
                      />
                    </button>
                  ) : null}
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--ar-s3)" }}>
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
      color: "var(--ar-ok)",
    },
    {
      label: "Completion Rate",
      pct: left ? Math.round((completed / left) * 100) : 0,
      color: "var(--ar-accent)",
    },
    {
      label: "Cancellation Rate",
      pct: left ? Math.round((cancelled / left) * 100) : 0,
      color: "var(--ar-err)",
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--ar-t1)" }}>
          24h Funnel
        </h2>
        <span className="text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
          rolling sample
        </span>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex justify-between text-xs font-semibold">
              <span style={{ color: "var(--ar-t2)" }}>{row.label}</span>
              <span style={{ color: "var(--ar-t1)" }}>{row.pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--ar-s3)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
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
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide"
      style={{ color: "var(--ar-t2)" }}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? <ChevronUp size={ICON.xs} /> : <ChevronDown size={ICON.xs} />
      ) : null}
    </button>
    );
  };

  return (
    <Card ref={sectionRef}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ar-t1)" }}>
            Driver Fleet
          </h2>
          <p className="mt-1 text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
            Showing {start}–{end} of {filtered.length} drivers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border px-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s3)" }}>
            <Search size={ICON.sm} color={"var(--ar-t2)"} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vehicle or phone"
              aria-label="Search drivers by vehicle or phone"
              className="h-full bg-transparent text-sm font-medium"
              style={{ color: "var(--ar-t1)" }}
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
                borderColor: filter === id ? "var(--ar-accent)" : "var(--ar-border)",
                backgroundColor: filter === id ? "var(--ar-accent)" : "var(--ar-s2)",
                color: filter === id ? "var(--ar-bg)" : "var(--ar-t2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("vehicle_number", "Vehicle #")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("zone_name", "Zone")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("is_online", "Status")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("today_trips", "Today Trips")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("completed_30d", "30d Trips")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("avg_rating_30d", "Rating")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2" style={{ background: "var(--ar-s2)" }}>{header("last_ride_at", "Last Active")}</th>
              <th scope="col" className="sticky top-0 z-10 border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)", background: "var(--ar-s2)" }}>
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
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}>
                    {driver.vehicle_number || "-"}
                    <div className="text-xs font-normal" style={{ color: "var(--ar-t2)" }}>
                      {driver.phone || driver.email || "-"}
                    </div>
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                    {driver.zone_name || "Unzoned"}
                  </td>
                  <td className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>
                    <StatusBadge status={status} />
                    {ghost ? <GhostDriverBadge /> : null}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}>
                    {driver.today_trips}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}>
                    {driver.completed_30d}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-warn)" }}>
                    {driver.avg_rating_30d ? `${driver.avg_rating_30d} rating` : "-"}
                  </td>
                  <td className="border-b px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                    {driver.on_trip ? "On trip now" : relativeTime(driver.last_ride_at)}
                  </td>
                  <td className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>
                    <div className="flex flex-wrap gap-2 opacity-100 transition md:opacity-60 md:group-hover:opacity-100 md:focus-within:opacity-100">
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
                          style={{ backgroundColor: "var(--ar-accent)", color: "var(--ar-bg)" }}
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
                          style={{ borderColor: "var(--ar-err)", color: "var(--ar-err)" }}
                        >
                          Force Offline
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toast("Open the mobile admin app to view full driver profile")}
                        className="rounded-lg border px-2 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}
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
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {visible.map((driver) => {
          const status = driverStatusKey(driver);
          const ghost = isGhostDriver(driver);
          return (
            <article
              key={driver.id}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ar-t1)" }}>
                    {driver.vehicle_number || "Unassigned vehicle"}
                  </h3>
                  <p className="mt-1 truncate text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
                    {driver.phone || driver.email || "-"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end">
                  <StatusBadge status={status} />
                  {ghost ? <GhostDriverBadge /> : null}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-bold" style={{ color: "var(--ar-t2)" }}>Zone</dt>
                  <dd className="mt-1 font-semibold" style={{ color: "var(--ar-t1)" }}>{driver.zone_name || "Unzoned"}</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: "var(--ar-t2)" }}>Today</dt>
                  <dd className="mt-1 font-semibold" style={{ color: "var(--ar-t1)" }}>{driver.today_trips} trips</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: "var(--ar-t2)" }}>30 days</dt>
                  <dd className="mt-1 font-semibold" style={{ color: "var(--ar-t1)" }}>{driver.completed_30d} trips</dd>
                </div>
                <div>
                  <dt className="font-bold" style={{ color: "var(--ar-t2)" }}>Last active</dt>
                  <dd className="mt-1 font-semibold" style={{ color: "var(--ar-t1)" }}>
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
                    style={{ backgroundColor: "var(--ar-accent)", color: "var(--ar-bg)" }}
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
                    style={{ borderColor: "var(--ar-err)", color: "var(--ar-err)" }}
                  >
                    Force Offline
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toast("Open the mobile admin app to view full driver profile")}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}
                  aria-label={`View ${driver.vehicle_number || "driver"} profile`}
                >
                  View
                </button>
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? (
          <div className="rounded-lg border px-3 py-8 text-center" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
            <Users className="mx-auto mb-2" size={ICON.xxl} color="var(--ar-t3)" />
            <p className="text-sm font-medium">No drivers match this filter</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ar-t3)" }}>
              Try clearing search or changing status filter
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: "var(--ar-t2)" }}>
          Page {safePage + 1} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(current - 1, 0))}
          disabled={safePage === 0}
          className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
          disabled={safePage >= totalPages - 1}
          className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}
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
      <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--ar-t1)" }}>
        Recent Admin Actions
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ar-t2)" }}>
              <th className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>Time</th>
              <th className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>Admin</th>
              <th className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>Action</th>
              <th className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>Target</th>
              <th className="border-b px-3 py-2" style={{ borderColor: "var(--ar-border)" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot.recentAuditLog || []).map((item) => (
              <tr key={item.id}>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                  {relativeTime(item.created_at)}
                </td>
                <td className="border-b px-3 py-3 font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}>
                  {truncate(item.phone || item.email)}
                </td>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-accent)" }}>
                  {formatAction(item.action)}
                </td>
                <td className="border-b px-3 py-3 font-bold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                  {item.target_type} {String(item.target_id || "").slice(0, 8)}
                </td>
                <td className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>
                  <code className="rounded px-2 py-1 text-xs" style={{ background: "var(--ar-s3)", color: "var(--ar-t2)" }}>
                    {formatMetadata(item.metadata)}
                  </code>
                </td>
              </tr>
            ))}
            {(snapshot.recentAuditLog || []).length === 0 ? (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-center text-sm font-bold" style={{ color: "var(--ar-t2)" }}>
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
      <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--ar-t1)" }}>
        Why Rides Cancel (Last 7 Days)
      </h2>
      {data.length === 0 ? (
        <p className="text-sm font-bold" style={{ color: "var(--ar-ok)" }}>
          No cancellations in this window
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={item.reason}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-bold" style={{ color: "var(--ar-t1)" }}>
                  {formatReason(item.reason)}
                </span>
                <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: "var(--ar-err-dim)", color: "var(--ar-err)" }}>
                  {item.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--ar-s3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(numberValue(item.count) / max) * 100}%`,
                    backgroundColor: "var(--ar-err)",
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
  const previousLiveRideCount = useRef(null);
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

  useEffect(() => {
    if (!snapshotQuery.data) return;
    const current = numberValue(snapshot.liveRides);
    if (previousLiveRideCount.current !== null && current > previousLiveRideCount.current) {
      toast("New ride request", {
        description: `${current - previousLiveRideCount.current} new request${current - previousLiveRideCount.current > 1 ? "s" : ""} in the live queue`,
      });
    }
    previousLiveRideCount.current = current;
  }, [snapshot.liveRides, snapshotQuery.data]);

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
      <div
        aria-label="Refresh countdown progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPct}
        className="fixed left-0 top-0 z-[60] h-1 transition-all duration-1000"
        role="progressbar"
        style={{ width: `${progressPct}%`, backgroundColor: "var(--ar-primary)" }}
      />
      <div className="space-y-5" style={{ color: "var(--ar-t1)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: "var(--ar-ok-dim)", color: "var(--ar-ok)" }}>
                  LIVE
                </span>
                <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: "var(--ar-s3)", color: "var(--ar-t2)" }}>
                  Dispatch Control
                </span>
              </div>
              <p className="mt-2 text-xs font-normal" style={{ color: "var(--ar-t2)" }}>
                Fleet telemetry, zone utilization, stuck-ride controls, audit history, and revenue flow.
              </p>
            </div>
            <div className="text-right text-xs font-medium" style={{ color: "var(--ar-t2)" }}>
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
                  borderColor: activeNav === id ? "var(--ar-accent)" : "var(--ar-border)",
                  backgroundColor: activeNav === id ? "var(--ar-accent-dim)" : "var(--ar-s2)",
                  color: activeNav === id ? "var(--ar-accent)" : "var(--ar-t2)",
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
            <div className="rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--ar-warn)", background: "var(--ar-warn-dim)", color: "var(--ar-warn)" }}>
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
  return <AdminOpsPageContent />;
}
