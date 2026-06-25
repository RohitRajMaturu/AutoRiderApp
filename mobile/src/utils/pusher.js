import Pusher from "pusher-js/react-native";

function firstPartyHeaders(auth) {
  const headers = {
    "x-createxyz-project-group-id": process.env.EXPO_PUBLIC_PROJECT_GROUP_ID,
    host: process.env.EXPO_PUBLIC_HOST,
    "x-forwarded-host": process.env.EXPO_PUBLIC_HOST,
    "x-createxyz-host": process.env.EXPO_PUBLIC_HOST,
  };

  if (auth?.jwt) {
    headers.authorization = `Bearer ${auth.jwt}`;
  }

  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => Boolean(value)),
  );
}

export function createRidePusher(auth) {
  const key = process.env.EXPO_PUBLIC_PUSHER_KEY;
  const cluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || "ap2";
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;

  if (!key || !baseUrl) {
    return null;
  }

  return new Pusher(key, {
    cluster,
    authEndpoint: `${baseUrl}/api/pusher/auth`,
    auth: {
      headers: firstPartyHeaders(auth),
    },
  });
}
