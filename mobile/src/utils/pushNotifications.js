import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

function platformName() {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

export async function registerPushToken() {
  if (Platform.OS === "web" || !Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync().then(
    (result) => result.data,
  );
  if (!token) return null;

  const response = await fetch("/api/notifications/push-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: platformName(),
      deviceId: Device.osBuildId || Device.modelId || null,
    }),
  });
  if (!response.ok) {
    return null;
  }
  return token;
}
