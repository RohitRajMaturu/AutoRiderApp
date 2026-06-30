"use client";

import { useEffect, useState } from "react";
import { Bell, Bus, FileText, LayoutDashboard, ReceiptIndianRupee, Settings, Users } from "lucide-react";

const GOLD = "#F5A623";
const nav = [
  ["overview", "Overview", LayoutDashboard], ["routes", "Routes", Bus], ["members", "Members", Users],
  ["attendance", "Attendance Log", FileText], ["invoices", "Invoices", ReceiptIndianRupee], ["settings", "Settings", Settings],
];

function Card({ children, style }) { return <div style={{ background: "#171717", border: "1px solid #292929", borderRadius: 18, padding: 18, ...style }}>{children}</div>; }
function Pill({ children, color = GOLD }) { return <span style={{ color, border: `1px solid ${color}55`, background: `${color}15`, borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 800 }}>{children}</span>; }

export default function InstitutionAdminDashboard() {
  const [section, setSection] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      fetch("/api/institution/overview").then((r) => r.ok ? r.json() : Promise.reject(new Error("Institution access required"))),
      fetch("/api/institution/routes").then((r) => r.ok ? r.json() : { routes: [] }),
      fetch("/api/institution/members").then((r) => r.ok ? r.json() : { members: [] }),
    ]).then(([o, r, m]) => { setOverview(o); setRoutes(r.routes); setMembers(m.members); }).catch((e) => setError(e.message));
  }, []);
  const active = overview?.trips?.filter((trip) => trip.status === "IN_PROGRESS") || [];
  return <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", fontFamily: "Inter, system-ui, sans-serif" }}>
    <aside style={{ width: 245, borderRight: "1px solid #262626", padding: 22, position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ color: GOLD, fontWeight: 950, fontSize: 21 }}>TukTukSafe</div><div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 5 }}>Institution Console</div>
      <nav style={{ marginTop: 30, display: "grid", gap: 8 }}>{nav.map(([key,label,Icon]) => <button key={key} onClick={() => setSection(key)} style={{ border: 0, cursor: "pointer", display: "flex", gap: 11, alignItems: "center", borderRadius: 12, padding: 12, color: section===key?"#111":"#D1D5DB", background: section===key?GOLD:"transparent", fontWeight: 800 }}><Icon size={18}/>{label}</button>)}</nav>
    </aside>
    <main style={{ flex: 1, padding: "22px 28px 60px", maxWidth: 1400 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><h1 style={{ margin: 0, fontSize: 25 }}>{overview?.institution?.name || "Institution"}</h1><div style={{ color: "#9CA3AF", marginTop: 5 }}>{overview?.institution?.subscription_plan || "Plan"} · {overview?.institution?.status || "Loading"}</div></div><div style={{ display: "flex", gap: 12, alignItems: "center" }}>{active.length ? <Pill color="#22C55E">● LIVE · {active.length} routes</Pill> : null}<Bell color={GOLD}/></div></header>
      {error ? <Card style={{ marginTop: 24, borderColor: "#7F1D1D", color: "#FCA5A5" }}>{error}. Sign in using an institution-admin account linked to an institution.</Card> : null}
      {section === "overview" ? <><>{active.length ? <div style={{ marginTop: 24, background: "#3A2605", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16, fontWeight: 850 }}>{active.length} route{active.length>1?"s":""} currently active</div> : null}</><div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(130px,1fr))", gap: 12, marginTop: 20 }}>{[["Total routes",overview?.stats?.total],["Completed",overview?.stats?.completed],["In progress",overview?.stats?.in_progress],["Cancelled",overview?.stats?.cancelled],["Students transported",overview?.stats?.studentsTransported]].map(([l,v])=><Card key={l}><div style={{color:"#9CA3AF",fontSize:12}}>{l}</div><div style={{fontSize:28,fontWeight:950,marginTop:8,color:GOLD}}>{v||0}</div></Card>)}</div><h2 style={{marginTop:28}}>Today&apos;s routes</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:14}}>{(overview?.trips||[]).map(t=><Card key={t.id}><div style={{display:"flex",justifyContent:"space-between"}}><b>{t.route_name} · {t.direction}</b><Pill color={t.status==="COMPLETED"?"#22C55E":t.status==="CANCELLED"?"#EF4444":GOLD}>{t.status}</Pill></div><div style={{color:"#9CA3AF",marginTop:12}}>{t.driver_name||"Driver unassigned"} {t.vehicle_number?`· ${t.vehicle_number}`:""}</div><div style={{marginTop:14}}>{t.picked_up_count||0}/{t.expected_count||0} picked up</div><div style={{height:7,background:"#333",borderRadius:9,marginTop:8}}><div style={{height:7,background:GOLD,borderRadius:9,width:`${t.expected_count?Math.min(100,t.picked_up_count/t.expected_count*100):0}%`}}/></div></Card>)}</div></> : null}
      {section === "routes" ? <><h2 style={{marginTop:28}}>Routes</h2>{routes.map(r=><Card key={r.id} style={{marginBottom:10,display:"flex",alignItems:"center"}}><div style={{flex:1}}><b>{r.route_name} · {r.direction}</b><div style={{color:"#9CA3AF",marginTop:5}}>{r.scheduled_days?.join(" · ")} · {String(r.scheduled_time).slice(0,5)} · {r.member_count}/{r.max_capacity} members</div></div><Pill color={r.driver_name?"#22C55E":"#EF4444"}>{r.driver_name||"Unassigned"}</Pill></Card>)}</> : null}
      {section === "members" ? <><h2 style={{marginTop:28}}>Members</h2><Card><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Member","Type","Route","Stop","Guardian","Phone","Status"].map(h=><th key={h} style={{textAlign:"left",color:"#9CA3AF",padding:10,borderBottom:"1px solid #333"}}>{h}</th>)}</tr></thead><tbody>{members.map(m=><tr key={m.id}>{[m.member_name,m.member_type,m.route_name||"Unassigned",m.stop_order||"—",m.guardian_name||"—",m.guardian_phone,m.active?"Active":"Inactive"].map((v,i)=><td key={i} style={{padding:10,borderBottom:"1px solid #222"}}>{v}</td>)}</tr>)}</tbody></table></Card></> : null}
      {!["overview","routes","members"].includes(section) ? <Card style={{marginTop:28}}><h2 style={{marginTop:0}}>{nav.find(([key])=>key===section)?.[1]}</h2><p style={{color:"#9CA3AF"}}>The schema and API contracts for this module are ready. External billing, CSV export, and communication credentials are tracked in the Phase 2 pending-items section.</p></Card> : null}
    </main>
  </div>;
}
