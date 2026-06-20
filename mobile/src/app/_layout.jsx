import { useAuth } from "@/utils/auth/useAuth";
import { AuthModal } from "@/utils/auth/useAuthModal";
import { ThemeProvider } from "@/theme/ThemeContext";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Linking, Modal, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  QueryClientProvider,
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import queryClient from "@/utils/queryClient";
import { Toaster } from "sonner-native";
SplashScreen.preventAutoHideAsync();

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "#";
const PRIMARY = "#43B8B3";

function GlobalFetchIndicator() {
  const fetchingCount = useIsFetching();

  if (!fetchingCount) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFFF2",
        borderColor: "#D7E2E4",
        borderRadius: 999,
        borderWidth: 1,
        elevation: 8,
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        position: "absolute",
        right: 16,
        shadowColor: "#17272B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        top: 16,
        zIndex: 50,
      }}
    >
      <ActivityIndicator color={PRIMARY} size="small" />
      <Text style={{ color: "#17272B", fontSize: 12, fontWeight: "900" }}>
        Updating
      </Text>
    </View>
  );
}

function ConsentGate() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["userProfile", auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous"],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });
  const user = data?.user;
  const needsConsent =
    !!auth &&
    (user?.role === "passenger" || user?.role === "driver") &&
    user?.data_consent_given === false;

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
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

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
            Data consent required
          </Text>
          <Text style={{ color: "#586C70", fontSize: 13, lineHeight: 20, marginTop: 10 }}>
            To continue, please agree to TukTukGo collecting and storing your{" "}
            {user?.role === "driver"
              ? "name, phone number, vehicle, and licence details"
              : "name and phone number"}{" "}
            to provide ride services, in line with the Privacy Policy.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: "#238B86", fontSize: 13, fontWeight: "900" }}>
              Open Privacy Policy
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
              backgroundColor: "#43B8B3",
              borderRadius: 14,
              marginTop: 18,
              opacity: acceptConsent.isPending ? 0.7 : 1,
              paddingVertical: 15,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
              {acceptConsent.isPending ? "Saving..." : "I Agree"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const { initiate, isReady } = useAuth();

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="(passenger)" options={{ headerShown: false }} />
            <Stack.Screen name="(driver)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          </Stack>
          <AuthModal />
          <ConsentGate />
          <GlobalFetchIndicator />
          <Toaster />
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

