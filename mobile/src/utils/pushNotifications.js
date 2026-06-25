import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function platformName() {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

function projectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.expoConfig?.extra?.projectId ||
    undefined
  );
}

export async function configureRideNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("ride-requests", {
    name: "Ride requests",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 350, 180, 350],
    lightColor: "#43B8B3",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
}

export async function registerPushToken() {
  if (Platform.OS === "web" || !Device.isDevice) {
    return null;
  }

  await configureRideNotificationChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync(
    projectId() ? { projectId: projectId() } : undefined,
  ).then(
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
