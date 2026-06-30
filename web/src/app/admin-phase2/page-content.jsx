"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Bus, ShieldCheck, Ticket, Users } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { ChartSkeleton } from "@/components/AdminECharts";
import StatusBadge from "@/components/ui/StatusBadge";
import { ICON } from "@/lib/iconScale";
import { readJsonResponse } from "@/app/api/utils/client-response";

const tabs = [
  { key: "load", label: "Driver Load", Icon: Users },
  { key: "passes", label: "TukTukPass", Icon: Ticket },
  { key: "schools", label: "TukTukSafe", Icon: Building2 },
  { key: "sla", label: "SLA Events", Icon: ShieldCheck },
];

function formatCurrency(value) {
  return `Rs. ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function statusKey(value) {
  return String(value || "").toLowerCase();
}

function EmptyState({ children }) {
  return (
    <div
      className="ar-card flex flex-col items-center justify-center gap-2 py-12 text-center"
      style={{ color: "var(--ar-t2)" }}
    >
      <p className="text-sm">{children}</p>
    </div>
  );
}

function TabButton({ active, label, Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition"
      style={{
        background: active ? "var(--ar-accent)" : "var(--ar-s2)",
        color: active ? "var(--ar-bg)" : "var(--ar-t1)",
        borderColor: active ? "var(--ar-accent)" : "var(--ar-border)",
      }}
    >
      <Icon size={ICON.md} />
      {label}
    </button>
  );
}

export default function Phase2Operations() {
  const [tab, setTab] = useState("load");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/phase2", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace(
            `/admin-login?callbackUrl=${encodeURIComponent("/admin-phase2")}`,
          );
          return new Promise(() => {});
        }
        const body = await readJsonResponse(response, "Phase 2 console");
        if (!response.ok) {
          throw new Error(body.error || `Phase 2 console failed (${response.status})`);
        }
        return body;
      })
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, []);

  const loading = !data && !error;
  const summary = useMemo(() => {
    if (!data) return null;
    return {
      drivers: data.drivers?.length || 0,
      activePasses: (data.passes || []).filter(
        (pass) => statusKey(pass.status) === "active",
      ).length,
      institutions: data.institutions?.length || 0,
      openSlaEvents: (data.slaEvents || []).filter(
        (event) => Number(event.points_delta) < 0,
      ).length,
    };
  }, [data]);

  return (
    <AdminShell eyebrow="Super Admin" title="Phase 2 Console">
      <p className="mb-6 text-sm" style={{ color: "var(--ar-t2)" }}>
        Driver capacity, commuter pass subscriptions, institutional routes, and reliability events.
      </p>

      {summary ? (
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            ["Approved drivers", summary.drivers],
            ["Active passes", summary.activePasses],
            ["Institutions", summary.institutions],
            ["Open SLA flags", summary.openSlaEvents],
          ].map(([label, value]) => (
            <div key={label} className="ar-metric-card">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--ar-t3)" }}
              >
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Phase 2 data sections">
        {tabs.map(({ key, label, Icon }) => (
          <TabButton
            key={key}
            label={label}
            Icon={Icon}
            active={tab === key}
            onClick={() => setTab(key)}
          />
        ))}
      </div>

      {error ? (
        <div
          className="ar-card"
          role="alert"
          style={{ borderColor: "var(--ar-err)", color: "var(--ar-err)" }}
        >
          {error}
        </div>
      ) : null}

      {loading ? <ChartSkeleton height={320} /> : null}
      {!loading && tab === "load" ? <DriverLoadTab drivers={data?.drivers || []} /> : null}
      {!loading && tab === "passes" ? <PassesTab passes={data?.passes || []} /> : null}
      {!loading && tab === "schools" ? (
        <SchoolsTab institutions={data?.institutions || []} trips={data?.trips || []} />
      ) : null}
      {!loading && tab === "sla" ? <SlaTab events={data?.slaEvents || []} /> : null}
    </AdminShell>
  );
}

function DriverLoadTab({ drivers }) {
  if (!drivers.length) return <EmptyState>No approved drivers are available yet.</EmptyState>;

  const scheduleText = (driver) =>
    driver.today_schedule
      ?.map((item) => `${String(item.time).slice(0, 5)} ${item.type}: ${item.label}`)
      .join(" · ") || "No recurring assignments";

  return (
    <>
      <div className="ar-card hidden overflow-x-auto md:block">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr style={{ color: "var(--ar-t3)" }}>
              {["Driver", "Rating", "Passes", "Institution routes", "SLA score", "Today's schedule"].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ borderColor: "var(--ar-border)" }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td className="border-b px-3 py-3 font-semibold" style={{ borderColor: "var(--ar-border)" }}>
                  {driver.name}
                </td>
                <td className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                  {driver.rating || "—"}
                </td>
                <td className="border-b px-3 py-3 font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-accent)" }}>
                  {driver.active_passes}
                </td>
                <td className="border-b px-3 py-3 font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-accent)" }}>
                  {driver.institution_routes}
                </td>
                <td className="border-b px-3 py-3 font-semibold" style={{ borderColor: "var(--ar-border)", color: driver.sla_score < 50 ? "var(--ar-err)" : "var(--ar-ok)" }}>
                  {driver.sla_score}
                </td>
                <td className="border-b px-3 py-3 text-xs" style={{ borderColor: "var(--ar-border)", color: "var(--ar-t2)" }}>
                  {scheduleText(driver)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {drivers.map((driver) => (
          <div key={driver.id} className="ar-card">
            <div className="flex items-center justify-between gap-3">
              <b>{driver.name}</b>
              <span style={{ color: driver.sla_score < 50 ? "var(--ar-err)" : "var(--ar-ok)", fontWeight: 600 }}>
                SLA {driver.sla_score}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: "var(--ar-t2)" }}>
              <span>Rating {driver.rating || "—"}</span>
              <span>Passes <b style={{ color: "var(--ar-accent)" }}>{driver.active_passes}</b></span>
              <span>Routes <b style={{ color: "var(--ar-accent)" }}>{driver.institution_routes}</b></span>
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--ar-t3)" }}>
              {scheduleText(driver)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PassesTab({ passes }) {
  if (!passes.length) return <EmptyState>No TukTukPass subscriptions have been created yet.</EmptyState>;
  return (
    <div className="grid gap-3">
      {passes.map((pass) => (
        <div key={pass.id} className="ar-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>{pass.pickup_label} → {pass.dropoff_label}</b>
            <div className="mt-1 text-sm" style={{ color: "var(--ar-t2)" }}>
              {pass.passenger_name} · {pass.driver_name || "Pending match"} · {formatCurrency(pass.agreed_fare)}
            </div>
          </div>
          <StatusBadge status={statusKey(pass.status)} />
        </div>
      ))}
    </div>
  );
}

function SchoolsTab({ institutions, trips }) {
  return (
    <>
      {!institutions.length ? (
        <EmptyState>No institutions have been registered yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {institutions.map((institution) => (
            <div key={institution.id} className="ar-card">
              <div className="flex items-start justify-between gap-2">
                <Building2 size={ICON.lg} color="var(--ar-accent)" />
                <StatusBadge status={statusKey(institution.status)} />
              </div>
              <h3 className="mt-3 font-semibold">{institution.name}</h3>
              <div className="mt-1 text-sm" style={{ color: "var(--ar-t2)" }}>
                {institution.institution_type} · {institution.subscription_plan}
              </div>
              <div className="mt-2 text-sm">
                {institution.route_count} routes · {formatCurrency(institution.paid_amount)} paid
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold">Today&apos;s school trips</h2>
      {!trips.length ? (
        <EmptyState>No institution trips are scheduled for today.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {trips.map((trip) => (
            <div key={trip.id} className="ar-card flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bus size={ICON.md} color="var(--ar-accent)" />
                <b>{trip.institution_name} · {trip.route_name}</b>
              </div>
              <StatusBadge status={statusKey(trip.status)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SlaTab({ events }) {
  if (!events.length) return <EmptyState>No driver SLA events have been recorded.</EmptyState>;
  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <div key={event.id} className="ar-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <b>{event.driver_name}</b>
            <span className="text-sm" style={{ color: "var(--ar-t2)" }}>{event.event_type}</span>
          </div>
          <b style={{ color: event.points_delta < 0 ? "var(--ar-err)" : "var(--ar-ok)" }}>
            {event.points_delta > 0 ? "+" : ""}{event.points_delta}
          </b>
        </div>
      ))}
    </div>
  );
}
