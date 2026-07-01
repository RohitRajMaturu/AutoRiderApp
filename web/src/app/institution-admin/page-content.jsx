"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bus,
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

    const fetchJson = async (url, label) => {
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
    };

    Promise.all([
      fetchJson("/api/institution/overview", "Institution overview"),
      fetchJson("/api/institution/routes", "Institution routes"),
      fetchJson("/api/institution/members", "Institution members"),
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
      {overview && !["overview", "routes", "members"].includes(section) ? (
        <PendingSection section={section} />
      ) : null}
    </InstitutionShell>
  );
}
