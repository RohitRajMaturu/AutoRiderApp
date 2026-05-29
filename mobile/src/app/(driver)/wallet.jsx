import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";

const PRIMARY = "#F97316";
const PRIMARY_LIGHT = "#FFF7ED";
const PRIMARY_BORDER = "#FED7AA";
const BG = "#FFFBF5";
const SURFACE = "#FFFFFF";
const BORDER = "#E7E5E4";
const TEXT = "#1C1917";
const TEXT_SECONDARY = "#78716C";
const TEXT_MUTED = "#A8A29E";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";
const DARK = "#1C1917";

const PLANS = [
  {
    name: "Daily",
    price: "₹30",
    period: "/day",
    duration: "1 Day",
    popular: false,
  },
  {
    name: "Weekly",
    price: "₹150",
    period: "/week",
    duration: "7 Days",
    popular: true,
  },
  {
    name: "Monthly",
    price: "₹500",
    period: "/month",
    duration: "30 Days",
    popular: false,
  },
];

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

export default function DriverWallet() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = React.useState(1); // Weekly default

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["driverMe"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      return res.json();
    },
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

      {/* Header */}
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
          Manage your driver plan
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
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
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isActive ? "#A8A29E" : "#EF4444",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {isActive ? "Active Plan" : "No Active Plan"}
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
                  {isActive ? `${daysLeft} Days Left` : "Subscribe Now"}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: isActive ? "#16A34A" : "#FEE2E2",
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

            {isActive && expiry && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Calendar size={14} color="#78716C" />
                <Text style={{ fontSize: 13, color: "#78716C" }}>
                  Expires{" "}
                  {expiry.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
            )}

            {!isActive && (
              <Text style={{ fontSize: 13, color: "#991B1B", lineHeight: 20 }}>
                You need an active subscription to go online and accept rides.
              </Text>
            )}
          </View>
        </View>

        {/* Plans */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 14,
            }}
          >
            Choose a Plan
          </Text>
          <View style={{ gap: 10 }}>
            {PLANS.map((plan, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedPlan(i)}
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: selectedPlan === i ? PRIMARY : BORDER,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor:
                        selectedPlan === i ? PRIMARY_LIGHT : "#F5F5F4",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: selectedPlan === i ? 1.5 : 0,
                      borderColor: PRIMARY_BORDER,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: selectedPlan === i ? PRIMARY : BORDER,
                        borderWidth: selectedPlan === i ? 0 : 2,
                        borderColor: TEXT_MUTED,
                      }}
                    />
                  </View>
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{ fontSize: 16, fontWeight: "700", color: TEXT }}
                      >
                        {plan.name}
                      </Text>
                      {plan.popular && (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 99,
                            backgroundColor: PRIMARY,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#fff",
                            }}
                          >
                            BEST VALUE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}
                    >
                      {plan.duration} access
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: selectedPlan === i ? PRIMARY : TEXT,
                    }}
                  >
                    {plan.price}
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT_MUTED }}>
                    {plan.period}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Payment",
                "UPI/Razorpay integration coming soon! Contact admin to activate subscription.",
              )
            }
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              shadowColor: PRIMARY,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
              {isActive
                ? "Renew Subscription"
                : `Subscribe - ${PLANS[selectedPlan].price}`}
            </Text>
            <Text style={{ color: "#FED7AA", fontSize: 12, marginTop: 4 }}>
              Tap to continue with UPI / Card
            </Text>
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 14,
            }}
          >
            What's Included
          </Text>
          <View style={{ gap: 10 }}>
            {BENEFITS.map((b, i) => (
              <View
                key={i}
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
                    backgroundColor: `${b.color}15`,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <b.icon size={22} color={b.color} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: TEXT }}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {b.desc}
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
