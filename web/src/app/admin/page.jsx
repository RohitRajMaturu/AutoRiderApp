import { useEffect, useMemo, useState } from "react";
import { redirect } from "react-router";
import {
  Activity,
  ArrowRight,
  Car,
  Clock,
  IndianRupee,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";

const PRIMARY = "#43B8B3";
const BG = "#EAF0F1";
const TEXT = "#17272B";
const TEXT_SEC = "#647678";
const BORDER = "#D8E4E5";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const GOLD = "#F3B51B";

export async function loader({ request }) {
  const [{ auth }, { default: sql }] = await Promise.all([
    import("@/auth"),
    import("@/app/api/utils/sql"),
  ]);
  const session = await auth(request);
  const signinUrl = `/account/signin?role=admin&callbackUrl=${encodeURIComponent(
    "/admin",
  )}`;

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

function Metric({ label, value, tone, Icon }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: TEXT_SEC }}>
            {label}
          </p>
          <p className="mt-3 text-3xl font-black" style={{ color: TEXT }}>
            {value}
          </p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${tone}18`, color: tone }}
        >
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, color }) {
  return (
    <span
      className="inline-flex rounded-lg px-2 py-1 text-xs font-black"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {children}
    </span>
  );
}

function AdminLoadingState() {
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#43B8B3]/15">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#BFE5E0] border-t-[#43B8B3]" />
          </div>
          <div>
            <p className="text-sm font-black text-[#17272B]">
              Loading command center
            </p>
            <p className="mt-1 text-xs font-bold text-[#647678]">
              Syncing rides, driver fleet, revenue, and admin controls.
            </p>
          </div>
        </div>
        <span className="rounded-lg bg-[#F3B51B]/15 px-3 py-2 text-xs font-black text-[#B88700]">
          Live data initializing
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {["Authentication", "Operations API", "Fleet telemetry"].map((item) => (
          <div key={item} className="rounded-lg border border-[#D8E4E5] bg-[#F7FBFA] p-3">
            <div className="h-2 w-20 animate-pulse rounded-full bg-[#43B8B3]/30" />
            <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#647678]">
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
    <main className="min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      <header className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black" style={{ color: PRIMARY }}>
              <ShieldCheck size={18} />
              Admin access
            </div>
            <h1 className="mt-1 text-2xl font-black">Auto Ride Command Center</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin-ops"
              className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-black text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Open Ops Dashboard
              <ArrowRight size={17} />
            </a>
            <a
              href="/account/logout"
              className="inline-flex h-11 items-center rounded-lg border bg-white px-4 text-sm font-black"
              style={{ borderColor: BORDER, color: TEXT_SEC }}
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
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
            tone="#7C3AED"
            Icon={IndianRupee}
          />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Live Ride Queue</h2>
              <StatusPill color={PRIMARY}>{liveRides.length} live</StatusPill>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wide" style={{ color: TEXT_SEC }}>
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
                      <td className="border-b px-3 py-3 font-black" style={{ borderColor: BORDER }}>
                        {String(ride.id).slice(0, 8)}
                      </td>
                      <td className="border-b px-3 py-3" style={{ borderColor: BORDER }}>
                        <StatusPill color={ride.status === "cancelled" ? ERROR : PRIMARY}>
                          {ride.status}
                        </StatusPill>
                      </td>
                      <td className="border-b px-3 py-3 font-bold" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                        {ride.passenger_phone || ride.passenger_email || "-"}
                      </td>
                      <td className="border-b px-3 py-3 font-bold" style={{ borderColor: BORDER, color: TEXT_SEC }}>
                        {ride.vehicle_number || "-"}
                      </td>
                      <td className="border-b px-3 py-3 font-black" style={{ borderColor: BORDER }}>
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
            <div className="rounded-lg border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
              <div className="mb-4 flex items-center gap-2">
                <Users size={18} color={PRIMARY} />
                <h2 className="text-lg font-black">Top Drivers</h2>
              </div>
              <div className="space-y-3">
                {topDrivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: BORDER }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{driver.vehicle_number || "Unassigned"}</p>
                      <p className="truncate text-xs font-bold" style={{ color: TEXT_SEC }}>
                        {driver.phone || driver.email || "-"}
                      </p>
                    </div>
                    <StatusPill color={driver.is_online ? SUCCESS : TEXT_SEC}>
                      {numberValue(driver.completed_rides_30d)} rides
                    </StatusPill>
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
              className="flex items-center justify-between gap-4 rounded-lg border bg-white p-5 shadow-sm transition hover:border-[#43B8B3]"
              style={{ borderColor: BORDER }}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-black" style={{ color: PRIMARY }}>
                  <Activity size={18} />
                  More data
                </div>
                <p className="mt-2 text-xl font-black">Ops Dashboard</p>
                <p className="mt-1 text-sm font-bold" style={{ color: TEXT_SEC }}>
                  Fleet heartbeat, zones, audit log, cancellation analytics, and live operations.
                </p>
              </div>
              <ArrowRight size={24} color={PRIMARY} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
