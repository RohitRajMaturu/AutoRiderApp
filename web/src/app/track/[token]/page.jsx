import { useEffect, useState } from "react";
import { useParams } from "react-router";

const terminalCopy = {
  stopped: ["Sharing stopped", "The passenger has confirmed they are safe and stopped this link."],
  expired: ["Tracking link expired", "This safety link has reached its four-hour limit."],
  ended: ["Ride ended", "This ride has completed or been cancelled, so live tracking is no longer available."],
};

export default function SafetyTrackingPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/api/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load tracking");
        if (!active) return;
        setData(body);
        setError("");
        setUpdatedAt(new Date());
        if (body.status === "active") timer = setTimeout(poll, 10000);
      } catch (err) {
        if (!active) return;
        setError(err.message);
        timer = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token]);

  const terminal = data && terminalCopy[data.status];
  const hasLocation = Number.isFinite(data?.driver?.lat) && Number.isFinite(data?.driver?.lng);
  const mapUrl = hasLocation
    ? `https://maps.google.com/maps?q=${data.driver.lat},${data.driver.lng}&z=16&output=embed`
    : null;

  return (
    <main style={{ minHeight: "100vh", background: "#0F1F23", color: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif", padding: "24px 16px 48px" }}>
      <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <div>
            <div style={{ color: "#43B8B3", fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>TukTukGo</div>
            <h1 style={{ fontSize: 24, lineHeight: 1.2, margin: "5px 0 0" }}>Safety Tracking</h1>
          </div>
          {data?.status === "active" ? <span style={{ borderRadius: 999, padding: "7px 11px", background: "#123B34", color: "#5EE0A0", fontSize: 12, fontWeight: 800 }}>● LIVE</span> : null}
        </header>

        {error ? <section style={{ padding: 20, borderRadius: 18, background: "#331C20", border: "1px solid #71333B" }}><strong>Tracking unavailable</strong><p style={{ color: "#F4B5BD", marginBottom: 0 }}>{error}</p></section> : null}
        {!data && !error ? <section style={{ padding: 24, borderRadius: 18, background: "#172B30" }}>Loading the live ride…</section> : null}
        {terminal ? <section style={{ padding: 28, borderRadius: 20, background: "#172B30", border: "1px solid #294047", textAlign: "center" }}><h2 style={{ marginTop: 0 }}>{terminal[0]}</h2><p style={{ color: "#AFC1C5", lineHeight: 1.6, marginBottom: 0 }}>{terminal[1]}</p></section> : null}

        {data?.status === "active" ? (
          <>
            <section style={{ padding: 18, borderRadius: 18, background: "#16302F", border: "1px solid #286B68", marginBottom: 16 }}>
              <strong>{data.passenger.name} shared this ride for safety.</strong>
              <p style={{ color: "#B9D8D5", margin: "7px 0 0", lineHeight: 1.5 }}>Their driver location updates here about every 10 seconds.</p>
            </section>
            <section style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #294047", background: "#172B30" }}>
              {mapUrl ? <iframe title="Driver live location" src={mapUrl} style={{ width: "100%", height: 330, border: 0, display: "block" }} loading="lazy" /> : <div style={{ height: 220, display: "grid", placeItems: "center", color: "#AFC1C5", padding: 20, textAlign: "center" }}>Waiting for the driver’s latest location…</div>}
              <div style={{ padding: 20, display: "grid", gap: 16 }}>
                <Info label="Passenger" value={data.passenger.name} />
                <Info label="Pickup" value={data.ride.pickupAddress} />
                <Info label="Destination" value={data.ride.destAddress} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Info label="Driver" value={data.driver.name} />
                  <Info label="Vehicle" value={data.driver.vehicle} />
                </div>
                <div style={{ color: "#789096", fontSize: 12 }}>Last updated {updatedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return <div><div style={{ color: "#789096", fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div><div style={{ color: "#F8FAFC", fontSize: 15, fontWeight: 700, marginTop: 4, lineHeight: 1.45 }}>{value || "Not available"}</div></div>;
}
