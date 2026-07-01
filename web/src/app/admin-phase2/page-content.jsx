"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Bus, Clock3, ShieldCheck, Ticket, Users } from "lucide-react";
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
        color: active ? "white" : "var(--ar-t1)",
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
        const body = await readJsonResponse(response, "Pass & Institution console");
        if (!response.ok) {
          throw new Error(body.error || `Pass & Institution console failed (${response.status})`);
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
    <AdminShell eyebrow="Super Admin" title="Pass & Institution Console">
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

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Pass and institution data sections">
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
        <SchoolsTab
          institutions={data?.institutions || []}
          trips={data?.trips || []}
          onCreated={(institution) =>
            setData((current) => ({
              ...current,
              institutions: [
                { ...institution, route_count: 0, paid_amount: 0 },
                ...(current?.institutions || []),
              ],
            }))
          }
        />
      ) : null}
      {!loading && tab === "sla" ? <SlaTab events={data?.slaEvents || []} /> : null}
    </AdminShell>
  );
}

function DriverSchedule({ items }) {
  if (!items?.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--ar-border-h)] bg-[var(--ar-s3)] px-3 py-2 text-xs text-[var(--ar-t3)]">
        <Clock3 size={14} />
        Open for assignments
      </div>
    );
  }

  return (
    <div className="grid min-w-[250px] gap-2">
      {items.map((item, index) => (
        <div
          key={`${item.time}-${item.type}-${item.label}-${index}`}
          className="flex items-center gap-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-s3)] px-2.5 py-2 shadow-[var(--ar-shadow-sm)]"
        >
          <span className="rounded-md bg-[var(--ar-accent-dim)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--ar-accent)]">
            {String(item.time || "—").slice(0, 5)}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ar-t3)]">
              {item.type || "Assignment"}
            </span>
            <span className="block truncate text-xs font-semibold text-[var(--ar-t1)]">
              {item.label || "Scheduled route"}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function DriverLoadTab({ drivers }) {
  if (!drivers.length) return <EmptyState>No approved drivers are available yet.</EmptyState>;

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
              <tr key={driver.id} className="ar-tr">
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
                <td className="border-b px-3 py-3" style={{ borderColor: "var(--ar-border)" }}>
                  <DriverSchedule items={driver.today_schedule} />
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
            <div className="mt-4 border-t border-[var(--ar-border)] pt-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ar-t3)]">
                <Clock3 size={13} />
                Today&apos;s schedule
              </div>
              <DriverSchedule items={driver.today_schedule} />
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

function InstitutionOnboarding({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    setMessage("");
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    payload.monthlyFee = Number(payload.monthlyFee);
    try {
      const response = await fetch("/api/institutions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readJsonResponse(response, "Institution onboarding");
      if (!response.ok) throw new Error(body.error || "Could not create institution");
      onCreated(body.institution);
      formElement.reset();
      setMessage(`Created ${body.institution.name}. The institution admin can sign in now.`);
      setOpen(false);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-10 rounded-lg border bg-transparent px-3 text-sm outline-none";
  const fieldStyle = { borderColor: "var(--ar-border)", color: "var(--ar-t1)" };

  return (
    <div className="ar-card mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Institution onboarding</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ar-t2)" }}>
            Create the institution and its restricted admin login together.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((value) => !value); setError(""); setMessage(""); }}
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: "var(--ar-accent)", color: "white" }}
        >
          {open ? "Close" : "Add institution"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm" role="status" style={{ color: "var(--ar-ok)" }}>{message}</p> : null}
      {error ? <p className="mt-3 text-sm" role="alert" style={{ color: "var(--ar-err)" }}>{error}</p> : null}

      {open ? (
        <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input className={fieldClass} style={fieldStyle} name="name" placeholder="Institution name" required minLength={2} />
          <select className={fieldClass} style={{ ...fieldStyle, background: "var(--ar-s2)" }} name="type" defaultValue="SCHOOL">
            <option value="SCHOOL">School</option><option value="COLLEGE">College</option>
            <option value="HOSPITAL">Hospital</option><option value="CORPORATE">Corporate</option>
          </select>
          <input className={fieldClass} style={fieldStyle} name="address" placeholder="Address" required />
          <input className={fieldClass} style={fieldStyle} name="contactName" placeholder="Primary contact" required />
          <input className={fieldClass} style={fieldStyle} name="contactEmail" type="email" placeholder="Contact email" required />
          <input className={fieldClass} style={fieldStyle} name="contactPhone" inputMode="tel" placeholder="Contact phone" required />
          <select className={fieldClass} style={{ ...fieldStyle, background: "var(--ar-s2)" }} name="subscriptionPlan" defaultValue="STANDARD">
            <option value="BASIC">Basic</option><option value="STANDARD">Standard</option><option value="PREMIUM">Premium</option>
          </select>
          <input className={fieldClass} style={fieldStyle} name="monthlyFee" type="number" min="0" step="1" defaultValue="15000" placeholder="Monthly fee" required />
          <input className={fieldClass} style={fieldStyle} name="trialEndsAt" type="date" aria-label="Trial end date" />
          <input className={fieldClass} style={fieldStyle} name="adminName" placeholder="Admin full name" required minLength={2} />
          <input className={fieldClass} style={fieldStyle} name="adminEmail" type="email" placeholder="Admin login email" required />
          <input className={fieldClass} style={fieldStyle} name="adminPhone" inputMode="tel" placeholder="Admin login phone" required />
          <input className={fieldClass} style={fieldStyle} name="adminPassword" type="password" minLength={8} maxLength={72} placeholder="Temporary password (8+ chars)" required />
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg text-sm font-bold disabled:opacity-60 md:col-span-2 xl:col-span-1"
            style={{ background: "var(--ar-ok)", color: "white" }}
          >
            {saving ? "Creating…" : "Create institution & admin"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SchoolsTab({ institutions, trips, onCreated }) {
  return (
    <>
      <InstitutionOnboarding onCreated={onCreated} />
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
