import crypto from "node:crypto";

export function rideChannel(rideId) {
  return `private-ride-${rideId}`;
}

function getConfig() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null;
  }
  return {
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
  };
}

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function toQuery(params) {
  return new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
}

export function authorizeRideChannel(socketId, channelName) {
  const config = getConfig();
  if (!config) return null;

  return {
    auth: `${config.key}:${hmac(config.secret, `${socketId}:${channelName}`)}`,
  };
}

export async function triggerRideEvent(rideId, eventName, payload = {}) {
  const config = getConfig();
  if (!config) return false;

  try {
    const body = JSON.stringify({
      name: eventName,
      channel: rideChannel(rideId),
      data: JSON.stringify(payload),
    });
    const path = `/apps/${config.appId}/events`;
    const queryParams = {
      auth_key: config.key,
      auth_timestamp: String(Math.floor(Date.now() / 1000)),
      auth_version: "1.0",
      body_md5: md5(body),
    };
    const query = toQuery(queryParams);
    const signature = hmac(config.secret, ["POST", path, query].join("\n"));
    const url = `https://api-${config.cluster}.pusher.com${path}?${query}&auth_signature=${signature}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      throw new Error(`Pusher returned ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error(`Pusher trigger failed for ${eventName}:`, error);
    return false;
  }
}
