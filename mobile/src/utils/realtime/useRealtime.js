import { useEffect, useRef } from "react";
import { AppState } from "react-native";

function toWsUrl(baseUrl) {
  if (!baseUrl) return null;
  if (baseUrl.startsWith("ws://") || baseUrl.startsWith("wss://")) return baseUrl;
  if (baseUrl.startsWith("https://")) return baseUrl.replace(/^https:\/\//, "wss://");
  if (baseUrl.startsWith("http://")) return baseUrl.replace(/^http:\/\//, "ws://");
  return null;
}

export function useRealtime({ enabled, onRideRequest, heartbeatPayload }) {
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let reconnectTimer = null;

    async function connect() {
      try {
        const res = await fetch("/api/auth/realtime-token", { method: "POST" });
        if (!res.ok) return;
        const data = await res.json();
        const wsBase =
          data.websocket_url ||
          process.env.EXPO_PUBLIC_REALTIME_WS_URL ||
          toWsUrl(process.env.EXPO_PUBLIC_BASE_URL);
        const wsUrl = toWsUrl(wsBase);
        if (!wsUrl || cancelled) return;

        const socket = new WebSocket(`${wsUrl.replace(/\/$/, "")}/ws?token=${encodeURIComponent(data.token)}`);
        socketRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "ride_request") {
              onRideRequest?.(message);
              socket.send(JSON.stringify({ type: "ack", ride_id: message.ride_id }));
            }
          } catch {
            // Ignore malformed realtime messages; polling remains as fallback.
          }
        };

        socket.onclose = () => {
          if (!cancelled) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    }

    connect();
    heartbeatRef.current = setInterval(() => {
      fetch("/api/drivers/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(heartbeatPayload?.() || {}),
      }).catch(() => {});
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && socketRef.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    });

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sub.remove();
      socketRef.current?.close();
    };
  }, [enabled, heartbeatPayload, onRideRequest]);
}
