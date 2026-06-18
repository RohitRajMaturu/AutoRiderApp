import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  LogOut,
  Phone,
  Shield,
  ChevronRight,
  HelpCircle,
  FlaskConical,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import useAppStore from "@/store/useAppStore";

const PRIMARY = "#43B8B3";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUPPORT_WHATSAPP_URL = `https://wa.me/${process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "919999999999"}`;
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "#";

function MenuItem({
  icon: Icon,
  label,
  sublabel,
  onPress,
  color = TEXT_SECONDARY,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: "#F5F5F4",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Icon size={18} color={color} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      <ChevronRight size={16} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

export default function PassengerProfile() {
  const insets = useSafeAreaInsets();
  const { signOut, auth } = useAuth();
  const router = useRouter();
  const { testMode, disableTestMode } = useAppStore();
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: profile } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });
  const { data: ridesData } = useQuery({
    queryKey: ["passengerRides", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to load rides");
      return res.json();
    },
    enabled: !!auth,
  });

  const handleExitTestMode = async () => {
    Alert.alert(
      "Exit Test Mode",
      "This will take you back to the sign-in screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit & Sign In",
          onPress: async () => {
            await disableTestMode();
            router.replace("/");
          },
        },
      ],
    );
  };

  const user = profile?.user || auth?.user;
  const rides = ridesData?.rides || [];
  const completedRides = rides.filter((r) => r.status === "completed").length;
  const initials = user?.email ? user.email.charAt(0).toUpperCase() : "?";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Test mode banner */}
        {testMode && (
          <TouchableOpacity
            onPress={handleExitTestMode}
            style={{
              backgroundColor: "#FFFBEB",
              borderBottomWidth: 1,
              borderBottomColor: "#FDE68A",
              paddingTop: insets.top + 8,
              paddingBottom: 10,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <FlaskConical size={16} color="#B88700" />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: "#286B68",
                fontWeight: "600",
              }}
            >
              🧪 Test Mode Active — Tap to Sign In with real account
            </Text>
            <Text style={{ fontSize: 12, color: "#B88700", fontWeight: "700" }}>
              Exit →
            </Text>
          </TouchableOpacity>
        )}

        {/* Hero header */}
        <View
          style={{
            backgroundColor: SURFACE,
            paddingTop: testMode ? 24 : insets.top + 24,
            paddingBottom: 28,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: PRIMARY,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              shadowColor: PRIMARY,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#fff" }}>
              {testMode
                ? "?"
                : auth?.user?.email
                  ? auth.user.email.charAt(0).toUpperCase()
                  : "?"}
            </Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT }}>
            {testMode ? "Guest Passenger" : auth?.user?.email || "—"}
          </Text>
          <View
            style={{
              marginTop: 8,
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: 99,
              backgroundColor: PRIMARY_LIGHT,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY }}>
              🛺 Passenger
            </Text>
          </View>

          {/* Stats */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 24,
              gap: 1,
              backgroundColor: BORDER,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Total Rides", value: rides.length },
              { label: "Completed", value: completedRides },
              {
                label: "Cancelled",
                value: rides.filter((r) => r.status === "cancelled").length,
              },
            ].map((stat, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: i === 1 ? PRIMARY : TEXT,
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: TEXT_MUTED,
                    marginTop: 2,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Details */}
        <View style={{ margin: 16 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#F5F5F4",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#F5F5F4",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Phone size={18} color={TEXT_SECONDARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Phone Number
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: TEXT,
                    marginTop: 2,
                    fontWeight: "500",
                  }}
                >
                  {testMode ? "—" : "Not added yet"}
                </Text>
              </View>
            </View>
            <MenuItem
              icon={Shield}
              label="Privacy & Safety"
              sublabel="Manage your safety settings"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            />
            <MenuItem
              icon={HelpCircle}
              label="Help & Support"
              sublabel="Get help with your rides"
              onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
            />
          </View>
        </View>

        {/* Exit test mode or Sign out */}
        <View style={{ marginHorizontal: 16, gap: 10 }}>
          {testMode ? (
            <TouchableOpacity
              onPress={handleExitTestMode}
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: "#FDE68A",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={18} color="#B88700" />
              <Text
                style={{ color: "#B88700", fontSize: 15, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: () => signOut(),
                  },
                ]);
              }}
              style={{
                backgroundColor: "#FEF2F2",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FECACA",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <LogOut size={18} color="#DC2626" />
              <Text
                style={{ color: "#DC2626", fontSize: 15, fontWeight: "700" }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 28,
          }}
        >
          TukTukGo v1.0 - Made in India
        </Text>
      </ScrollView>
    </View>
  );
}

