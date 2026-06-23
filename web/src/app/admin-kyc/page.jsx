import { useEffect, useState } from "react";
import { redirect } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileCheck2, XCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import StatusBadge from "@/components/ui/StatusBadge";
import { ICON } from "@/lib/iconScale";

export async function loader({ request }) {
  const [{ auth }, { default: sql }] = await Promise.all([
    import("@/auth"),
    import("@/app/api/utils/sql"),
  ]);
  const session = await auth(request);
  const url = new URL(request.url);
  const signinUrl = `/admin-login?callbackUrl=${encodeURIComponent(url.pathname)}`;

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

export default function AdminKycPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState(null);

  const selected = drivers.find((driver) => driver.id === selectedId) || drivers[0];

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kyc");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load KYC queue");
      setDrivers(body.drivers || []);
      setSelectedId((current) => current || body.drivers?.[0]?.id || null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function review(driverId, action) {
    if (action === "reject" && !reason.trim()) {
      toast.error("Add a rejection reason first");
      return;
    }
    setBusyId(driverId);
    try {
      const res = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, action, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Review failed");
      toast.success(action === "approve" ? "Driver approved" : "Driver rejected");
      setReason("");
      setSelectedId(null);
      await loadQueue();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="KYC Review"
      eyebrow="Admin"
      refreshText={`${drivers.length} pending`}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <section
          className="rounded-lg border"
          style={{ background: "var(--ar-s2)", borderColor: "var(--ar-border)" }}
        >
          <div className="border-b p-4" style={{ borderColor: "var(--ar-border)" }}>
            <div className="flex items-center gap-2">
              <FileCheck2 size={ICON.lg} color="var(--ar-accent)" />
              <h2 className="text-base font-semibold">Pending Drivers</h2>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--ar-border)" }}>
            {loading ? (
              <div className="p-4 text-sm" style={{ color: "var(--ar-t2)" }}>
                Loading queue...
              </div>
            ) : drivers.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--ar-t2)" }}>
                No KYC reviews pending
              </div>
            ) : (
              drivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => setSelectedId(driver.id)}
                  className="block w-full px-4 py-3 text-left transition"
                  style={{
                    background:
                      selected?.id === driver.id
                        ? "var(--ar-accent-dim)"
                        : "transparent",
                    borderColor: "var(--ar-border)",
                  }}
                >
                  <p className="text-sm font-semibold">{driver.vehicle_number}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ar-t2)" }}>
                    {driver.email || driver.phone}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status="pending_review" />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section
          className="rounded-lg border p-5"
          style={{ background: "var(--ar-s2)", borderColor: "var(--ar-border)" }}
        >
          {!selected ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--ar-t2)" }}>
              Select a driver to review
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selected.vehicle_number}</h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--ar-t2)" }}>
                    {selected.email || selected.phone}
                  </p>
                </div>
                <StatusBadge status={selected.kyc_status} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Info label="DOB" value={selected.dob} />
                <Info label="DL Number" value={selected.dl_number} />
                <Info label="DL Expiry" value={selected.dl_expiry} />
                <Info label="RC Number" value={selected.rc_number} />
                <Info label="Aadhaar" value={selected.aadhaar_number_masked ? `**** ${selected.aadhaar_number_masked}` : "Not provided"} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <DocumentLink label="DL Photo" href={selected.license_url} />
                <DocumentLink label="RC Photo" href={selected.rc_photo_url} />
                <DocumentLink label="Selfie" href={selected.selfie_url} />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Vendor Checks</h3>
                <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--ar-border)" }}>
                  {(selected.kyc_checks || []).map((check) => (
                    <div
                      key={check.id}
                      className="grid grid-cols-1 gap-2 border-b px-3 py-3 text-sm md:grid-cols-[1fr_1fr_0.7fr_0.7fr]"
                      style={{ borderColor: "var(--ar-border)" }}
                    >
                      <span className="font-semibold">{check.check_type}</span>
                      <span style={{ color: "var(--ar-t2)" }}>{check.vendor}</span>
                      <span>{check.status}</span>
                      <span style={{ color: "var(--ar-t2)" }}>
                        {check.confidence_score ?? "-"}
                      </span>
                    </div>
                  ))}
                  {(selected.kyc_checks || []).length === 0 ? (
                    <div className="px-3 py-4 text-sm" style={{ color: "var(--ar-t2)" }}>
                      No vendor checks recorded yet
                    </div>
                  ) : null}
                </div>
              </div>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason required when rejecting"
                className="min-h-24 w-full rounded-lg border bg-transparent p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor: "var(--ar-border)", color: "var(--ar-t1)" }}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busyId === selected.id}
                  onClick={() => review(selected.id, "approve")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
                  style={{ background: "var(--ar-ok)", color: "var(--ar-bg)" }}
                >
                  <CheckCircle2 size={ICON.md} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === selected.id}
                  onClick={() => review(selected.id, "reject")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
                  style={{ background: "var(--ar-err)", color: "white" }}
                >
                  <XCircle size={ICON.md} />
                  Reject
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)" }}>
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ar-t3)" }}>{label}</p>
      <p className="mt-2 text-sm font-semibold">{value || "-"}</p>
    </div>
  );
}

function DocumentLink({ label, href }) {
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-between rounded-lg border p-3 text-sm font-semibold"
      style={{ borderColor: "var(--ar-border)", background: "var(--ar-s1)", color: href ? "var(--ar-accent)" : "var(--ar-t3)" }}
    >
      {label}
      <ExternalLink size={ICON.sm} />
    </a>
  );
}
