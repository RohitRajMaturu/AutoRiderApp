"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Bus,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
const G = "#F5A623",
  B = "#0A0A0A",
  C = "#171717",
  M = "#9CA3AF";
const tabs = [
  ["load", "Driver Load", Users],
  ["passes", "TukTukPass", Ticket],
  ["schools", "TukTukSafe", Building2],
  ["sla", "SLA Events", ShieldCheck],
];
const Card = ({ children }) => (
  <div
    style={{
      background: C,
      border: "1px solid #2A2A2A",
      borderRadius: 16,
      padding: 17,
    }}
  >
    {children}
  </div>
);
export default function Phase2Operations() {
  const [tab, setTab] = useState("load"),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/phase2")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        return b;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main
      style={{
        minHeight: "100vh",
        background: B,
        color: "#fff",
        padding: 28,
        fontFamily: "Inter,system-ui",
      }}
    >
      <a
        href="/admin"
        style={{ color: M, textDecoration: "none", display: "flex", gap: 7 }}
      >
        <ArrowLeft size={18} />
        Command Center
      </a>
      <h1 style={{ fontSize: 29, marginBottom: 4 }}>Phase 2 Operations</h1>
      <p style={{ color: M, marginTop: 0 }}>
        Driver capacity, commuter passes, institutions, and reliability.
      </p>
      <div style={{ display: "flex", gap: 8, margin: "22px 0" }}>
        {tabs.map(([k, l, I]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              background: tab === k ? G : C,
              color: tab === k ? "#111" : "#fff",
              border: "1px solid #333",
              borderRadius: 12,
              padding: "11px 15px",
              fontWeight: 850,
              display: "flex",
              gap: 8,
            }}
          >
            <I size={17} />
            {l}
          </button>
        ))}
      </div>
      {error ? <Card>{error}</Card> : null}
      {tab === "load" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(data?.drivers || []).map((d) => (
            <Card key={d.id}>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <b style={{ minWidth: 180 }}>{d.name}</b>
                <span style={{ color: M }}>Rating {d.rating || "—"}</span>
                <span>
                  Passes <b style={{ color: G }}>{d.active_passes}</b>
                </span>
                <span>
                  Institution routes{" "}
                  <b style={{ color: G }}>{d.institution_routes}</b>
                </span>
                <span>
                  SLA{" "}
                  <b
                    style={{ color: d.sla_score < 50 ? "#EF4444" : "#22C55E" }}
                  >
                    {d.sla_score}
                  </b>
                </span>
              </div>
              <div style={{ color: M, marginTop: 10, fontSize: 13 }}>
                {d.today_schedule
                  ?.map(
                    (x) =>
                      `${String(x.time).slice(0, 5)} ${x.type}: ${x.label}`,
                  )
                  .join(" · ") || "No recurring assignments"}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {tab === "passes" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(data?.passes || []).map((p) => (
            <Card key={p.id}>
              <b>
                {p.pickup_label} → {p.dropoff_label}
              </b>
              <div style={{ color: M, marginTop: 8 }}>
                {p.passenger_name} · {p.driver_name || "Pending match"} ·{" "}
                {p.status} · ₹
                {Math.round(p.agreed_fare).toLocaleString("en-IN")}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {tab === "schools" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: 12,
            }}
          >
            {(data?.institutions || []).map((i) => (
              <Card key={i.id}>
                <Building2 color={G} />
                <h3>{i.name}</h3>
                <div style={{ color: M }}>
                  {i.institution_type} · {i.subscription_plan} · {i.status}
                </div>
                <div style={{ marginTop: 9 }}>
                  {i.route_count} routes · ₹
                  {Math.round(i.paid_amount).toLocaleString("en-IN")} paid
                </div>
              </Card>
            ))}
          </div>
          <h2 style={{ marginTop: 28 }}>Today&apos;s school trips</h2>
          {(data?.trips || []).map((t) => (
            <Card key={t.id}>
              <Bus color={G} size={18} />{" "}
              <b>
                {t.institution_name} · {t.route_name}
              </b>
              <span style={{ float: "right", color: G }}>{t.status}</span>
            </Card>
          ))}
        </>
      ) : null}
      {tab === "sla" ? (
        <div style={{ display: "grid", gap: 9 }}>
          {(data?.slaEvents || []).map((e) => (
            <Card key={e.id}>
              <b>{e.driver_name}</b>
              <span style={{ marginLeft: 14, color: M }}>{e.event_type}</span>
              <b
                style={{
                  float: "right",
                  color: e.points_delta < 0 ? "#EF4444" : "#22C55E",
                }}
              >
                {e.points_delta > 0 ? "+" : ""}
                {e.points_delta}
              </b>
            </Card>
          ))}
        </div>
      ) : null}
    </main>
  );
}
