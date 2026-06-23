import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  IndianRupee,
  Route,
  Users,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AutoRickshawIcon from "@/components/AutoRickshawIcon";
import StatusBadge from "@/components/ui/StatusBadge";
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

function Metric({ label, value, tone, Icon }) {
  return (
    <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "var(--ar-t1)" }}>
            {value}
          </p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
            color: tone,
          }}
        >
          <Icon size={ICON.xxl} />
        </div>
      </div>
    </div>
  );
}

function AdminLoadingState() {
  return (
    <section className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "var(--ar-accent-dim)" }}>
            <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: "var(--ar-accent)" }} />
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
            <div className="h-2 w-20 animate-pulse rounded-full" style={{ background: "var(--ar-accent-dim)" }} />
            <p className="mt-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState("");

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

  const topDrivers = useMemo(
    () =>
      [...drivers]
        .sort(
          (a, b) =>
            numberValue(b.completed_rides_30d) - numberValue(a.completed_rides_30d),
        )
        .slice(0, 5),
    [drivers],
  );
  const liveRides = rides.filter((ride) =>
    ["requested", "accepted"].includes(ride.status),
  );
  const isInitialLoading = !stats && !error;

  return (
    <AdminShell title="TukTukGo Command Center" eyebrow="Admin">
      <div className="mx-auto max-w-7xl space-y-5">
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
            tone={"var(--ar-accent)"}
            Icon={Route}
          />
          <Metric
            label="Online Drivers"
            value={stats ? numberValue(stats.activeDrivers) : "..."}
            tone={"var(--ar-ok)"}
            Icon={AutoRickshawIcon}
          />
          <Metric
            label="Today Rides"
            value={stats ? numberValue(stats.todayRides) : "..."}
            tone={"var(--ar-warn)"}
            Icon={Clock}
          />
          <Metric
            label="Today Fare"
            value={stats ? formatCurrency(stats.todayFareValue) : "..."}
            tone="var(--ar-info)"
            Icon={IndianRupee}
          />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Live Ride Queue</h2>
              <StatusBadge status={liveRides.length ? "accepted" : "offline"} label={`${liveRides.length} live`} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t2)" }}>
                    <th className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>Ride</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>Status</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>Passenger</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>Driver</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveRides.length ? liveRides : rides.slice(0, 8)).map((ride) => (
                    <tr key={ride.id}>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: "var(--ar-border)" }}>
                        {String(ride.id).slice(0, 8)}
                      </td>
                      <td className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>
                        <StatusBadge status={ride.status} />
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                        {ride.passenger_phone ? maskPhone(ride.passenger_phone) : ride.passenger_email || "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                        {ride.vehicle_number || "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--ar-border)" }}>
                        {ride.estimated_fare ? formatCurrency(ride.estimated_fare) : "-"}
                      </td>
                    </tr>
                  ))}
                  {!rides.length ? (
                    <tr>
                      <td colSpan="5" className="px-3 py-8 text-center text-sm font-bold" style={{ color: "var(--ar-t2)" }}>
                        No ride data yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s2)" }}>
              <div className="mb-4 flex items-center gap-2">
                <Users size={ICON.lg} color={"var(--ar-accent)"} />
                <h2 className="text-base font-semibold">Top Drivers</h2>
              </div>
              <div className="space-y-3">
                {topDrivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "var(--ar-border)" }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{driver.vehicle_number || "Unassigned"}</p>
                      <p className="truncate text-xs font-normal" style={{ color: "var(--ar-t2)" }}>
                        {driver.phone || driver.email || "-"}
                      </p>
                    </div>
                    <StatusBadge status={driver.is_online ? "online" : "offline"} label={`${numberValue(driver.completed_rides_30d)} rides`} />
                  </div>
                ))}
                {!topDrivers.length ? (
                  <p className="py-8 text-center text-sm font-bold" style={{ color: "var(--ar-t2)" }}>
                    No drivers yet
                  </p>
                ) : null}
              </div>
            </div>

            <a
              href="/admin-ops"
              className="flex items-center justify-between gap-4 rounded-lg border p-5 shadow-sm transition"
              style={{ borderColor: "var(--ar-border)" }}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ar-accent)" }}>
                  <Activity size={ICON.md} />
                  More data
                </div>
                <p className="mt-2 text-xl font-semibold">Ops Dashboard</p>
                <p className="mt-1 text-sm font-normal" style={{ color: "var(--ar-t2)" }}>
                  Fleet heartbeat, zones, audit log, cancellation analytics, and live operations.
                </p>
              </div>
              <ArrowRight size={ICON.xl} color={"var(--ar-accent)"} />
            </a>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
