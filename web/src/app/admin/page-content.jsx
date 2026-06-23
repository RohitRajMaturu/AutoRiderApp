import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Car,
  Clock,
  IndianRupee,
  Route,
  Users,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import StatusBadge from "@/components/ui/StatusBadge";
import { ICON } from "@/lib/iconScale";

const PRIMARY = "#F5A623";
const BG = "#0D0F12";
const TEXT = "#F0F2F5";
const TEXT_SEC = "#8A8F9E";
const BORDER = "rgba(255,255,255,0.08)";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const GOLD = "#F59E0B";
const SURFACE = "#1C2028";
const SURFACE_2 = "#242830";

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
    <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: TEXT }}>
            {value}
          </p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${tone}18`, color: tone }}
        >
          <Icon size={ICON.xxl} />
        </div>
      </div>
    </div>
  );
}

function AdminLoadingState() {
  return (
    <section className="rounded-lg border p-5 shadow-sm" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "var(--ar-accent-dim)" }}>
            <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: PRIMARY }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>
              Loading command center
            </p>
            <p className="mt-1 text-xs font-medium" style={{ color: TEXT_SEC }}>
              Syncing rides, driver fleet, revenue, and admin controls.
            </p>
          </div>
        </div>
        <span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--ar-warn-dim)", color: GOLD }}>
          Live data initializing
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {["Authentication", "Operations API", "Fleet telemetry"].map((item) => (
          <div key={item} className="rounded-lg border p-3" style={{ borderColor: BORDER, background: SURFACE_2 }}>
            <div className="h-2 w-20 animate-pulse rounded-full" style={{ background: "var(--ar-accent-dim)" }} />
            <p className="mt-3 text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
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
        if (!statsRes.ok || !driversRes.ok || !ridesRes.ok) {
          throw new Error("Could not load admin data");
        }
        const [statsBody, driversBody, ridesBody] = await Promise.all([
          statsRes.json(),
          driversRes.json(),
          ridesRes.json(),
        ]);
        if (!active) return;
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
          <div className="rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--ar-err)", background: "var(--ar-err-dim)", color: ERROR }}>
            {error}
          </div>
        ) : null}
        {isInitialLoading ? <AdminLoadingState /> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Active Rides"
            value={stats ? numberValue(stats.activeRides) : "..."}
            tone={PRIMARY}
            Icon={Route}
          />
          <Metric
            label="Online Drivers"
            value={stats ? numberValue(stats.activeDrivers) : "..."}
            tone={SUCCESS}
            Icon={Car}
          />
          <Metric
            label="Today Rides"
            value={stats ? numberValue(stats.todayRides) : "..."}
            tone={GOLD}
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
          <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: BORDER, background: SURFACE }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Live Ride Queue</h2>
              <StatusBadge status={liveRides.length ? "accepted" : "offline"} label={`${liveRides.length} live`} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SEC }}>
                    <th className="border-b px-3 py-3" style={{ borderColor: BORDER }}>Ride</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: BORDER }}>Status</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: BORDER }}>Passenger</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: BORDER }}>Driver</th>
                    <th className="border-b px-3 py-3" style={{ borderColor: BORDER }}>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveRides.length ? liveRides : rides.slice(0, 8)).map((ride) => (
                    <tr key={ride.id}>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: BORDER }}>
                        {String(ride.id).slice(0, 8)}
                      </td>
                      <td className="border-b px-3 py-3" style={{ borderColor: BORDER }}>
                        <StatusBadge status={ride.status} />
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                        {ride.passenger_phone ? maskPhone(ride.passenger_phone) : ride.passenger_email || "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-normal" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                        {ride.vehicle_number || "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-sm font-semibold" style={{ borderColor: BORDER }}>
                        {ride.estimated_fare ? formatCurrency(ride.estimated_fare) : "-"}
                      </td>
                    </tr>
                  ))}
                  {!rides.length ? (
                    <tr>
                      <td colSpan="5" className="px-3 py-8 text-center text-sm font-bold" style={{ color: TEXT_SEC }}>
                        No ride data yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="mb-4 flex items-center gap-2">
                <Users size={ICON.lg} color={PRIMARY} />
                <h2 className="text-base font-semibold">Top Drivers</h2>
              </div>
              <div className="space-y-3">
                {topDrivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: BORDER }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{driver.vehicle_number || "Unassigned"}</p>
                      <p className="truncate text-xs font-normal" style={{ color: TEXT_SEC }}>
                        {driver.phone || driver.email || "-"}
                      </p>
                    </div>
                    <StatusBadge status={driver.is_online ? "online" : "offline"} label={`${numberValue(driver.completed_rides_30d)} rides`} />
                  </div>
                ))}
                {!topDrivers.length ? (
                  <p className="py-8 text-center text-sm font-bold" style={{ color: TEXT_SEC }}>
                    No drivers yet
                  </p>
                ) : null}
              </div>
            </div>

            <a
              href="/admin-ops"
              className="flex items-center justify-between gap-4 rounded-lg border p-5 shadow-sm transition"
              style={{ borderColor: BORDER }}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: PRIMARY }}>
                  <Activity size={ICON.md} />
                  More data
                </div>
                <p className="mt-2 text-xl font-semibold">Ops Dashboard</p>
                <p className="mt-1 text-sm font-normal" style={{ color: TEXT_SEC }}>
                  Fleet heartbeat, zones, audit log, cancellation analytics, and live operations.
                </p>
              </div>
              <ArrowRight size={ICON.xl} color={PRIMARY} />
            </a>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
