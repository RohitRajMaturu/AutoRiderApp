import { useEffect, useState } from "react";
import { useParams } from "react-router";
const terminal = {
  stopped: "Updates were stopped for this number.",
  expired: "This tracking link has expired.",
  ended: "This institution trip has ended.",
};
export default function MemberTrackingPage() {
  const { token } = useParams();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      timer;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/track/member/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tracking unavailable");
        if (!active) return;
        setData(body);
        setError("");
        if (body.status === "active") timer = setTimeout(poll, 10000);
      } catch (e) {
        if (active) {
          setError(e.message);
          timer = setTimeout(poll, 10000);
        }
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token]);
  const hasLocation =
    Number.isFinite(data?.driver?.lat) && Number.isFinite(data?.driver?.lng);
  const mapUrl = hasLocation
    ? `https://maps.google.com/maps?q=${data.driver.lat},${data.driver.lng}&z=16&output=embed`
    : null;
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#fff",
        fontFamily: "Inter,system-ui",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            color: "#F5A623",
            fontWeight: 900,
            fontSize: 12,
            letterSpacing: 1.2,
          }}
        >
          TUKTUKSAFE
        </div>
        <h1 style={{ marginTop: 6 }}>Institution trip tracking</h1>
        {error ? (
          <section
            style={{ background: "#331C20", padding: 18, borderRadius: 16 }}
          >
            {error}
          </section>
        ) : null}
        {data && terminal[data.status] ? (
          <section
            style={{
              background: "#171717",
              padding: 24,
              borderRadius: 18,
              textAlign: "center",
            }}
          >
            {terminal[data.status]}
          </section>
        ) : null}
        {data?.status === "active" ? (
          <>
            <section
              style={{
                background: "#302407",
                border: "1px solid #F5A623",
                padding: 16,
                borderRadius: 16,
                marginBottom: 14,
              }}
            >
              <b>{data.member.name}</b> ·{" "}
              {data.member.pickupConfirmedAt
                ? "Pickup confirmed"
                : "Trip in progress"}
            </section>
            <section
              style={{
                background: "#171717",
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              {mapUrl ? (
                <iframe
                  title="Driver live location"
                  src={mapUrl}
                  style={{ width: "100%", height: 330, border: 0 }}
                />
              ) : (
                <div
                  style={{
                    height: 220,
                    display: "grid",
                    placeItems: "center",
                    color: "#9CA3AF",
                  }}
                >
                  Waiting for the driver&apos;s location…
                </div>
              )}
              <div style={{ padding: 18, display: "grid", gap: 10 }}>
                <Info label="Route" value={data.trip.routeName} />
                <Info label="Driver" value={data.driver.name} />
                <Info label="Vehicle" value={data.driver.vehicle} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 800 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontWeight: 800, marginTop: 3 }}>
        {value || "Not available"}
      </div>
    </div>
  );
}
