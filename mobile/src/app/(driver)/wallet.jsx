import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Info,
  Shield,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/utils/auth/useAuth";

const PRIMARY = "#43B8B3";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";
const DARK = "#17272B";

const BENEFITS = [
  {
    icon: Zap,
    title: "Accept Unlimited Rides",
    desc: "No cap on daily ride acceptances",
    color: "#EAB308",
  },
  {
    icon: Shield,
    title: "Zero Platform Commission",
    desc: "Keep 100% of your earnings",
    color: SUCCESS,
  },
  {
    icon: Star,
    title: "Priority Listing",
    desc: "Get seen first by nearby passengers",
    color: PRIMARY,
  },
  {
    icon: TrendingUp,
    title: "Earnings Analytics",
    desc: "Track your daily performance",
    color: "#3B82F6",
  },
];

function formatExpiry(expiry) {
  if (!expiry) return "Not active";
  return expiry.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DriverWallet() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["driverMe", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load driver profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: BG,
        }}
      >
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  const driver = driverData?.driver;
  const expiry = driver?.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isActive = expiry && expiry > new Date();
  const daysLeft = isActive
    ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: TEXT,
            letterSpacing: -0.5,
          }}
        >
          Subscription
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          View your driver access
        </Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>
          సభ్యత్వ స్థితి / सदस्यता स्थिति
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ margin: 16 }}>
          <View
            style={{
              backgroundColor: isActive ? DARK : "#FEF2F2",
              borderRadius: 20,
              padding: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -30,
                top: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "#FFFFFF0A",
              }}
            />
            <View
              style={{
                position: "absolute",
                right: 20,
                bottom: -40,
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: "#FFFFFF06",
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isActive ? "#647678" : "#EF4444",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {isActive ? "Active Access" : "No Active Access"}
                </Text>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "800",
                    color: isActive ? "#fff" : "#DC2626",
                    marginTop: 6,
                    letterSpacing: -0.5,
                  }}
                >
                  {isActive ? `${daysLeft} Days Left` : "Inactive"}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: isActive ? SUCCESS : "#FEE2E2",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isActive ? "#fff" : "#DC2626",
                    textTransform: "uppercase",
                  }}
                >
                  {isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color={isActive ? "#586C70" : "#991B1B"} />
              <Text
                style={{
                  fontSize: 13,
                  color: isActive ? "#586C70" : "#991B1B",
                }}
              >
                Expires {formatExpiry(expiry)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
              padding: 16,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: PRIMARY_LIGHT,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Info size={20} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>
                Admin-managed pilot access
              </Text>
              <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 3 }}>
                అడ్మిన్ ద్వారా పొడిగింపు / एडमिन से बढ़ेगा
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: TEXT_SECONDARY,
                  lineHeight: 20,
                  marginTop: 6,
                }}
              >
                Subscription expiry is extended manually by the AutoRide admin
                team during the Secunderabad pilot. Payment integration is not
                enabled in this build.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 14,
            }}
          >
            Included During Pilot
          </Text>
          <View style={{ gap: 10 }}>
            {BENEFITS.map((benefit, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: `${benefit.color}15`,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <benefit.icon
                    size={22}
                    color={benefit.color}
                    strokeWidth={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: TEXT }}
                  >
                    {benefit.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {benefit.desc}
                  </Text>
                </View>
                <CheckCircle2 size={18} color={SUCCESS} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

