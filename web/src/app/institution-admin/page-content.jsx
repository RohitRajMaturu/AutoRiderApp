"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  Download,
  FileText,
  LayoutDashboard,
  ReceiptIndianRupee,
  Settings,
  Users,
} from "lucide-react";
import InstitutionShell from "@/components/InstitutionShell";
import StatusBadge from "@/components/ui/StatusBadge";
import { readJsonResponse } from "@/app/api/utils/client-response";

const navItems = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "routes", label: "Routes", Icon: Bus },
  { key: "members", label: "Members", Icon: Users },
  { key: "attendance", label: "Attendance Log", Icon: FileText },
  { key: "invoices", label: "Invoices", Icon: ReceiptIndianRupee },
  { key: "settings", label: "Settings", Icon: Settings },
];

async function fetchInstitutionJson(url, label) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) {
    window.location.replace(
      `/institution-login?callbackUrl=${encodeURIComponent("/institution-admin")}`,
    );
    return new Promise(() => {});
  }
  const body = await readJsonResponse(response, label);
  if (!response.ok) {
    throw new Error(body.error || `${label} failed (${response.status})`);
  }
  return body;
}

function statusKey(value) {
  return String(value || "").trim().toLowerCase();
}

function progressForTrip(trip) {
  const expected = Number(trip.expected_count) || 0;
  if (!expected) return 0;
  return Math.min(100, ((Number(trip.picked_up_count) || 0) / expected) * 100);
}

function EmptyState({ children }) {
  return (
    <div className="ar-card flex min-h-36 items-center justify-center text-center text-sm text-[var(--ar-t2)]">
      {children}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="ar-metric-card">
      <p className="text-xs font-medium text-[var(--ar-t2)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--ar-t1)]">
        {Number(value) || 0}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading institution dashboard">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="ar-skeleton h-28" />
      ))}
    </div>
  );
}

function OverviewSection({ overview }) {
  const trips = overview?.trips || [];
  const activeTrips = trips.filter((trip) => statusKey(trip.status) === "in_progress");
  const metrics = [
    ["Total routes", overview?.stats?.total],
    ["Completed", overview?.stats?.completed],
    ["In progress", overview?.stats?.in_progress],
    ["Cancelled", overview?.stats?.cancelled],
    ["Students transported", overview?.stats?.studentsTransported],
  ];

  return (
    <div className="space-y-6">
      {activeTrips.length ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--ar-ok)] bg-[var(--ar-ok-dim)] px-4 py-3 text-sm font-semibold text-[var(--ar-ok)]">
          <span className="ar-live-dot" />
          {activeTrips.length} route{activeTrips.length === 1 ? " is" : "s are"} currently active
        </div>
      ) : null}

      <section aria-labelledby="institution-summary-heading">
        <div className="ar-section-header">
          <h2 id="institution-summary-heading" className="ar-section-title">Today at a glance</h2>
          <span className="ar-section-meta">Live operational totals</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(([label, value]) => (
            <MetricCard key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      <section aria-labelledby="today-routes-heading">
        <div className="ar-section-header">
          <h2 id="today-routes-heading" className="ar-section-title">Today&apos;s routes</h2>
          <span className="ar-section-meta">{trips.length} scheduled</span>
        </div>
        {trips.length ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {trips.map((trip) => (
              <article key={trip.id} className="ar-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{trip.route_name || "Unnamed route"}</h3>
                    <p className="mt-1 text-xs text-[var(--ar-t2)]">{trip.direction || "Route"}</p>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <p className="mt-4 text-sm text-[var(--ar-t2)]">
                  {trip.driver_name || "Driver unassigned"}
                  {trip.vehicle_number ? ` · ${trip.vehicle_number}` : ""}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--ar-t2)]">Pickup progress</span>
                  <span className="font-semibold">
                    {Number(trip.picked_up_count) || 0}/{Number(trip.expected_count) || 0}
                  </span>
                </div>
                <div className="ar-progress-track mt-2">
                  <div
                    className="ar-progress-fill bg-[var(--ar-accent)]"
                    style={{ width: `${progressForTrip(trip)}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No routes are scheduled for today.</EmptyState>
        )}
      </section>
    </div>
  );
}

function RoutesSection({ routes }) {
  return (
    <section aria-labelledby="routes-heading">
      <div className="ar-section-header">
        <div>
          <h2 id="routes-heading" className="ar-section-title">Routes</h2>
          <p className="mt-1 text-xs text-[var(--ar-t2)]">Schedules, capacity, and driver assignments</p>
        </div>
        <span className="ar-section-meta">{routes.length} total</span>
      </div>
      {routes.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.map((route) => (
            <article key={route.id} className="ar-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{route.route_name || "Unnamed route"}</h3>
                  <p className="mt-1 text-xs text-[var(--ar-t2)]">{route.direction || "Route"}</p>
                </div>
                <StatusBadge
                  status={route.driver_name ? "assigned" : "unassigned"}
                  label={route.driver_name || "Unassigned"}
                />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-[var(--ar-t3)]">Schedule</dt>
                  <dd className="mt-1 font-medium">
                    {route.scheduled_days?.join(" · ") || "Not scheduled"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ar-t3)]">Time</dt>
                  <dd className="mt-1 font-medium">{String(route.scheduled_time || "—").slice(0, 5)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ar-t3)]">Members</dt>
                  <dd className="mt-1 font-medium">{Number(route.member_count) || 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ar-t3)]">Capacity</dt>
                  <dd className="mt-1 font-medium">{Number(route.max_capacity) || 0}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState>No routes have been configured yet.</EmptyState>
      )}
    </section>
  );
}

function MembersSection({ members }) {
  const columns = ["Member", "Type", "Route", "Stop", "Guardian", "Phone", "Status"];

  return (
    <section aria-labelledby="members-heading">
      <div className="ar-section-header">
        <div>
          <h2 id="members-heading" className="ar-section-title">Members</h2>
          <p className="mt-1 text-xs text-[var(--ar-t2)]">Students, guardians, and route assignments</p>
        </div>
        <span className="ar-section-meta">{members.length} total</span>
      </div>
      {members.length ? (
        <>
          <div className="ar-card hidden overflow-x-auto p-0 md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {columns.map((column) => <th key={column} className="ar-th">{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="ar-tr">
                    <td className="ar-td font-semibold">{member.member_name}</td>
                    <td className="ar-td text-[var(--ar-t2)]">{member.member_type}</td>
                    <td className="ar-td">{member.route_name || "Unassigned"}</td>
                    <td className="ar-td">{member.stop_order ?? "—"}</td>
                    <td className="ar-td">{member.guardian_name || "—"}</td>
                    <td className="ar-td text-[var(--ar-t2)]">{member.guardian_phone || "—"}</td>
                    <td className="ar-td">
                      <StatusBadge status={member.active ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {members.map((member) => (
              <article key={member.id} className="ar-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{member.member_name}</h3>
                    <p className="mt-1 text-xs text-[var(--ar-t2)]">{member.member_type}</p>
                  </div>
                  <StatusBadge status={member.active ? "active" : "inactive"} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-[var(--ar-t3)]">Route</dt><dd className="mt-1 font-medium">{member.route_name || "Unassigned"}</dd></div>
                  <div><dt className="text-[var(--ar-t3)]">Stop</dt><dd className="mt-1 font-medium">{member.stop_order ?? "—"}</dd></div>
                  <div><dt className="text-[var(--ar-t3)]">Guardian</dt><dd className="mt-1 font-medium">{member.guardian_name || "—"}</dd></div>
                  <div><dt className="text-[var(--ar-t3)]">Phone</dt><dd className="mt-1 font-medium">{member.guardian_phone || "—"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState>No members have been added yet.</EmptyState>
      )}
    </section>
  );
}

function localIsoDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function AttendanceSection({ institutionId, routes }) {
  const [dateFrom, setDateFrom] = useState(() => localIsoDate(30));
  const [dateTo, setDateTo] = useState(() => localIsoDate());
  const [routeId, setRouteId] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!institutionId) return undefined;
    let active = true;
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: "1000" });
    if (routeId) params.set("route_id", routeId);
    if (attendanceStatus) params.set("status", attendanceStatus);
    setLoading(true);
    setError("");
    fetchInstitutionJson(
      `/api/institutions/${institutionId}/trips/log?${params}`,
      "Attendance log",
    )
      .then((body) => {
        if (active) setRows(Array.isArray(body.attendance) ? body.attendance : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load attendance");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attendanceStatus, dateFrom, dateTo, institutionId, routeId]);

  const exportCsv = () => {
    const headers = ["Date", "Route", "Member", "Status", "Driver"];
    const lines = rows.map((row) => [
      row.scheduled_date,
      row.route_name,
      row.member_name,
      row.attendance_status,
      row.driver_name || "Unassigned",
    ]);
    const csv = [headers, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="attendance-heading">
      <div className="ar-section-header">
        <div>
          <h2 id="attendance-heading" className="ar-section-title">Attendance Log</h2>
          <p className="mt-1 text-xs text-[var(--ar-t2)]">Member pickup records by route and date</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows.length}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ar-accent)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="ar-card mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium text-[var(--ar-t2)]">
          From
          <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ar-border)] bg-transparent px-3 py-2 text-sm text-[var(--ar-t1)]" />
        </label>
        <label className="text-xs font-medium text-[var(--ar-t2)]">
          To
          <input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ar-border)] bg-transparent px-3 py-2 text-sm text-[var(--ar-t1)]" />
        </label>
        <label className="text-xs font-medium text-[var(--ar-t2)]">
          Route
          <select value={routeId} onChange={(event) => setRouteId(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ar-border)] bg-[var(--ar-surface)] px-3 py-2 text-sm text-[var(--ar-t1)]">
            <option value="">All routes</option>
            {routes.map((route) => <option key={route.id} value={route.id}>{route.route_name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--ar-t2)]">
          Status
          <select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ar-border)] bg-[var(--ar-surface)] px-3 py-2 text-sm text-[var(--ar-t1)]">
            <option value="">All statuses</option>
            {["PICKED_UP", "ABSENT", "UNCONFIRMED", "PENDING", "NOT_RECORDED", "CANCELLED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-[var(--ar-err)] bg-[var(--ar-err-dim)] px-4 py-3 text-sm text-[var(--ar-err)]" role="alert">{error}</div> : null}
      {loading ? <div className="ar-skeleton h-48" /> : rows.length ? (
        <div className="ar-card overflow-x-auto p-0">
          <table className="w-full border-collapse">
            <thead><tr>{["Date", "Route", "Member", "Status", "Driver"].map((column) => <th key={column} className="ar-th">{column}</th>)}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.trip_id}-${row.member_id}`} className="ar-tr">
                <td className="ar-td">{String(row.scheduled_date).slice(0, 10)}</td>
                <td className="ar-td font-medium">{row.route_name}</td>
                <td className="ar-td">{row.member_name}</td>
                <td className="ar-td"><StatusBadge status={row.attendance_status} label={String(row.attendance_status).replaceAll("_", " ")} /></td>
                <td className="ar-td text-[var(--ar-t2)]">{row.driver_name || "Unassigned"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState>No attendance records match these filters.</EmptyState>}
    </section>
  );
}

const invoiceColors = {
  PAID: ["var(--ar-ok-dim)", "var(--ar-ok)"],
  SENT: ["var(--ar-info-dim)", "var(--ar-info)"],
  OVERDUE: ["var(--ar-err-dim)", "var(--ar-err)"],
  DRAFT: ["var(--ar-s3)", "var(--ar-t3)"],
};

function InvoicesSection({ institutionId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!institutionId) return undefined;
    let active = true;
    fetchInstitutionJson(`/api/institutions/${institutionId}/invoices`, "Institution invoices")
      .then((body) => {
        if (active) setInvoices(Array.isArray(body.invoices) ? body.invoices : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load invoices");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [institutionId]);

  const openExternal = (url) => {
    const target = new URL(url, window.location.origin);
    if (!["http:", "https:"].includes(target.protocol)) return;
    const popup = window.open(target.href, "_blank", "noopener,noreferrer");
    if (popup) popup.opener = null;
  };

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <section aria-labelledby="invoices-heading">
      <div className="ar-section-header">
        <div>
          <h2 id="invoices-heading" className="ar-section-title">Invoices</h2>
          <p className="mt-1 text-xs text-[var(--ar-t2)]">Monthly route billing and payment status</p>
        </div>
        <span className="ar-section-meta">{invoices.length} total</span>
      </div>
      {error ? <div className="mb-4 rounded-xl border border-[var(--ar-err)] bg-[var(--ar-err-dim)] px-4 py-3 text-sm text-[var(--ar-err)]" role="alert">{error}</div> : null}
      {loading ? <div className="ar-skeleton h-48" /> : invoices.length ? (
        <div className="ar-card overflow-x-auto p-0">
          <table className="w-full border-collapse">
            <thead><tr>{["Month", "Routes", "Trips done", "Amount", "Status", "Action"].map((column) => <th key={column} className="ar-th">{column}</th>)}</tr></thead>
            <tbody>{invoices.map((invoice) => {
              const status = String(invoice.status || "DRAFT").toUpperCase();
              const colors = invoiceColors[status] || invoiceColors.DRAFT;
              return (
                <tr key={invoice.id} className="ar-tr">
                  <td className="ar-td font-medium">{new Date(invoice.billing_month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</td>
                  <td className="ar-td">{Number(invoice.total_routes) || 0}</td>
                  <td className="ar-td">{Number(invoice.total_trips_completed) || 0}</td>
                  <td className="ar-td font-semibold">{money.format(Number(invoice.amount) || 0)}</td>
                  <td className="ar-td"><span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: colors[0], color: colors[1] }}>{status}</span></td>
                  <td className="ar-td"><div className="flex flex-wrap gap-2">
                    {["SENT", "OVERDUE"].includes(status) && invoice.razorpay_payment_link_url ? <button type="button" onClick={() => openExternal(invoice.razorpay_payment_link_url)} className="rounded-lg bg-[var(--ar-accent)] px-3 py-1.5 text-xs font-semibold text-white">Pay Now</button> : null}
                    {status !== "DRAFT" && invoice.pdf_url ? <button type="button" onClick={() => openExternal(invoice.pdf_url)} className="rounded-lg border border-[var(--ar-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ar-t1)]">Download PDF</button> : null}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <EmptyState>No invoices have been generated yet.</EmptyState>}
    </section>
  );
}

function PendingSection({ section }) {
  const label = navItems.find((item) => item.key === section)?.label || "Module";
  return (
    <section className="ar-card" aria-labelledby="pending-section-heading">
      <h2 id="pending-section-heading" className="ar-section-title">{label}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ar-t2)]">
        The schema and API contracts for this module are ready. External billing, CSV export,
        and communication credentials remain tracked in the Phase 2 pending items.
      </p>
    </section>
  );
}

export default function InstitutionAdminDashboard() {
  const [section, setSection] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchInstitutionJson("/api/institution/overview", "Institution overview"),
      fetchInstitutionJson("/api/institution/routes", "Institution routes"),
      fetchInstitutionJson("/api/institution/members", "Institution members"),
    ])
      .then(([overviewData, routeData, memberData]) => {
        if (!active) return;
        setOverview(overviewData);
        setRoutes(Array.isArray(routeData.routes) ? routeData.routes : []);
        setMembers(Array.isArray(memberData.members) ? memberData.members : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load institution data");
      });

    return () => {
      active = false;
    };
  }, []);

  const subtitle = useMemo(() => {
    const plan = overview?.institution?.subscription_plan;
    const status = overview?.institution?.status;
    return [plan, status].filter(Boolean).join(" · ") || "TukTukSafe Schools";
  }, [overview]);

  return (
    <InstitutionShell
      activeSection={section}
      institutionName={overview?.institution?.name || "Institution"}
      navItems={navItems}
      onSectionChange={setSection}
      subtitle={subtitle}
    >
      {error ? (
        <div className="mb-6 rounded-xl border border-[var(--ar-err)] bg-[var(--ar-err-dim)] px-4 py-3 text-sm font-semibold text-[var(--ar-err)]" role="alert">
          {error}
        </div>
      ) : null}

      {!overview && !error ? <LoadingState /> : null}
      {overview && section === "overview" ? <OverviewSection overview={overview} /> : null}
      {overview && section === "routes" ? <RoutesSection routes={routes} /> : null}
      {overview && section === "members" ? <MembersSection members={members} /> : null}
      {overview && section === "attendance" ? <AttendanceSection institutionId={overview.institution.id} routes={routes} /> : null}
      {overview && section === "invoices" ? <InvoicesSection institutionId={overview.institution.id} /> : null}
      {overview && section === "settings" ? (
        <PendingSection section={section} />
      ) : null}
    </InstitutionShell>
  );
}
