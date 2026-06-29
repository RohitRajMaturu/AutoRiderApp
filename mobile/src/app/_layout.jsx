import * as Sentry from "@sentry/react-native";
import { useAuth } from "@/utils/auth/useAuth";
import { AuthModal } from "@/utils/auth/useAuthModal";
import { ThemeProvider } from "@/theme/ThemeContext";
import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Linking, Modal, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import queryClient from "@/utils/queryClient";
import { Toaster } from "sonner-native";
import { configureRideNotificationChannel, registerPushToken } from "@/utils/pushNotifications";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import { addInAppNotification, notificationOwnerKey } from "@/store/useNotificationStore";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.2,
    integrations: [Sentry.mobileReplayIntegration({ maskAllText: false })],
  });
}

SplashScreen.preventAutoHideAsync();

const PRIMARY = "#43B8B3";
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "#";

function notificationTarget(data, auth) {
  const type = String(data?.type || "");
  const role = auth?.user?.role;
  if (type.includes("ride") || type.includes("negotiation") || data?.rideId) {
    return role === "passenger" ? "/(passenger)" : "/(driver)";
  }
  return null;
}

function savePushNotification(notification, auth) {
  const ownerKey = notificationOwnerKey(auth);
  if (!ownerKey) return;
  const content = notification?.request?.content || {};
  const data = content.data || {};
  const requestId = notification?.request?.identifier;
  addInAppNotification({
    ownerKey,
    title: content.title || "TukTukGo update",
    body: content.body || "Open TukTukGo for the latest ride update.",
    type: data.type || "push",
    rideId: data.rideId || null,
    dedupeKey: data.type && data.rideId
      ? `${data.type}:${data.rideId}`
      : requestId
        ? `push:${requestId}`
        : null,
  });
}

function AuthBootOverlay() {
  const { t } = useLanguage();
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: "center",
        backgroundColor: "#EAF0F1",
        bottom: 0,
        justifyContent: "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      <ActivityIndicator color={PRIMARY} size="large" />
      <Text style={{ color: "#586C70", fontSize: 13, fontWeight: "800", marginTop: 12 }}>
        {t("common.loading")}
      </Text>
    </View>
  );
}

function ConsentGate() {
  const { t } = useLanguage();
  const { auth } = useAuth();
  const consentQueryKey = [
    "userProfile",
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous",
  ];
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: consentQueryKey,
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const acceptConsent = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataConsentGiven: true,
          dataConsentAt: new Date().toISOString(),
          dataConsentVersion: "v1",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Consent update failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consentQueryKey });
    },
  });

  if (!auth) return null;

  const user = data?.user;
  const needsConsent =
    (user?.role === "passenger" || user?.role === "driver") &&
    user?.data_consent_given === false;

  return (
    <Modal visible={needsConsent} transparent animationType="fade">
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#00000066",
          flex: 1,
          justifyContent: "center",
          padding: 22,
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 22,
            padding: 22,
            width: "100%",
          }}
        >
          <Text style={{ color: "#17272B", fontSize: 20, fontWeight: "900" }}>
            {t("consent.title")}
          </Text>
          <Text style={{ color: "#586C70", fontSize: 13, lineHeight: 20, marginTop: 10 }}>
            {t(user?.role === "driver" ? "consent.driver" : "consent.passenger")}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: "#238B86", fontSize: 13, fontWeight: "900" }}>
              {t("common.privacy")}
            </Text>
          </TouchableOpacity>
          {acceptConsent.isError ? (
            <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "700", marginTop: 12 }}>
              {acceptConsent.error?.message || "Could not save consent. Please try again."}
            </Text>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={acceptConsent.isPending}
            onPress={() => acceptConsent.mutate()}
            style={{
              alignItems: "center",
              backgroundColor: PRIMARY,
              borderRadius: 14,
              marginTop: 18,
              opacity: acceptConsent.isPending ? 0.7 : 1,
              paddingVertical: 15,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
              {acceptConsent.isPending ? t("common.saving") : t("common.agree")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const { initiate, isReady, auth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const firstSegment = segments[0];
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const inProtectedGroup =
      firstSegment === "(passenger)" ||
      firstSegment === "(driver)" ||
      firstSegment === "(admin)" ||
      pathname.startsWith("/(passenger)") ||
      pathname.startsWith("/(driver)") ||
      pathname.startsWith("/(admin)") ||
      pathname.startsWith("/passenger") ||
      pathname.startsWith("/driver") ||
      pathname.startsWith("/admin");

    if (!auth && inProtectedGroup) {
      router.replace("/");
    }
  }, [auth, firstSegment, isReady, pathname, router]);

  useEffect(() => {
    if (!auth) return;
    registerPushToken().catch(() => {});
  }, [auth]);

  useEffect(() => {
    configureRideNotificationChannel().catch(() => {});
  }, []);

  useEffect(() => {
    if (!notificationOwnerKey(auth)) return undefined;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      savePushNotification(notification, auth);
    });
    return () => subscription.remove();
  }, [auth]);

  useEffect(() => {
    if (!rootNavigationState?.key || !isReady || !auth) return;

    const openFromResponse = (response) => {
      savePushNotification(response?.notification, auth);
      const data = response?.notification?.request?.content?.data || {};
      const target = notificationTarget(data, auth);
      if (target) router.push(target);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openFromResponse(response);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, [auth, isReady, rootNavigationState?.key, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="(passenger)" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="(driver)" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false, animation: "none" }} />
          </Stack>
          <AuthModal />
          <ConsentGate />
          <Toaster />
          <OfflineBanner />
          {!isReady ? <AuthBootOverlay /> : null}
          </GestureHandlerRootView>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

