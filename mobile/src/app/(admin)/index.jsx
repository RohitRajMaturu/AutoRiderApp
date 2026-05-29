import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Users,
  Car,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  FlaskConical,
} from "lucide-react-native";
import { useAuth } from "@/utils/auth/useAuth";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import useAppStore from "@/store/useAppStore";

const PRIMARY = "#F97316";
const PRIMARY_LIGHT = "#FFF7ED";
const PRIMARY_BORDER = "#FED7AA";
const BG = "#1C1917";
const SURFACE = "#292524";
const SURFACE2 = "#FFFFFF";
const BORDER = "#44403C";
const TEXT = "#FAFAF9";
const TEXT_SECONDARY = "#A8A29E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";

function StatCard({ icon: Icon, label, value, color, change }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: `${color}20`,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: TEXT,
          letterSpacing: -1,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: TEXT_SECONDARY,
          marginTop: 4,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {change !== undefined && (
        <Text
          style={{
            fontSize: 11,
            color: change >= 0 ? SUCCESS : ERROR,
            marginTop: 4,
            fontWeight: "600",
          }}
        >
          {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
        </Text>
      )}
    </View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const router = useRouter();
  const { testMode, disableTestMode } = useAppStore();

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ["adminDrivers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/drivers");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;
  const drivers = driversData?.drivers || [];
  const pendingDrivers = drivers.filter((d) => !d.is_approved);
  const onlineDrivers = drivers.filter((d) => d.is_online && d.is_approved);
  const isLoading = statsLoading || driversLoading;

  const ridesBreakdown = stats
    ? [
        {
          label: "Completed",
          value: stats.completedRides,
          color: SUCCESS,
          pct:
            stats.totalRides > 0
              ? ((stats.completedRides / stats.totalRides) * 100).toFixed(0)
              : 0,
        },
        {
          label: "Active",
          value: stats.activeRides,
          color: PRIMARY,
          pct:
            stats.totalRides > 0
              ? ((stats.activeRides / stats.totalRides) * 100).toFixed(0)
              : 0,
        },
        {
          label: "Cancelled",
          value: stats.cancelledRides,
          color: ERROR,
          pct:
            stats.totalRides > 0
              ? ((stats.cancelledRides / stats.totalRides) * 100).toFixed(0)
              : 0,
        },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: BG,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: TEXT,
              letterSpacing: -0.5,
            }}
          >
            🛺 Admin Panel
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
            AutoConnect Command Center
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 99,
              backgroundColor: `${SUCCESS}20`,
              borderWidth: 1,
              borderColor: `${SUCCESS}40`,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: SUCCESS }}>
              ● LIVE
            </Text>
          </View>
        </View>
      </View>

      {/* Test mode banner */}
      {testMode && (
        <TouchableOpacity
          onPress={async () => {
            await disableTestMode();
            router.replace("/");
          }}
          style={{
            backgroundColor: "#FEF3C7",
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#FDE68A",
          }}
          activeOpacity={0.8}
        >
          <FlaskConical size={16} color="#D97706" />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: "#92400E",
              fontWeight: "600",
            }}
          >
            🧪 Test Mode — Tap to Exit & Sign In for real admin access
          </Text>
          <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "700" }}>
            Exit →
          </Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ color: TEXT_SECONDARY, marginTop: 12, fontSize: 14 }}>
            Loading analytics...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={statsRefetching}
              onRefresh={refetchStats}
              tintColor={PRIMARY}
            />
          }
        >
          {/* Alerts */}
          {pendingDrivers.length > 0 && (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FDE68A",
                padding: 14,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 22 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#92400E" }}
                >
                  {pendingDrivers.length} Driver
                  {pendingDrivers.length > 1 ? "s" : ""} Awaiting Approval
                </Text>
                <Text style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                  Tap Drivers tab to review
                </Text>
              </View>
            </View>
          )}

          {/* Main stats */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: TEXT_SECONDARY,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 12,
            }}
          >
            Overview
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <StatCard
              icon={BarChart3}
              label="Total Rides"
              value={stats?.totalRides ?? "—"}
              color={PRIMARY}
            />
            <StatCard
              icon={Users}
              label="Total Drivers"
              value={stats?.totalDrivers ?? "—"}
              color="#3B82F6"
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            <StatCard
              icon={Wifi}
              label="Online Now"
              value={onlineDrivers.length}
              color={SUCCESS}
            />
            <StatCard
              icon={Clock}
              label="Pending Approval"
              value={stats?.pendingDrivers ?? "—"}
              color="#D97706"
            />
          </View>

          {/* Ride breakdown */}
          {stats && stats.totalRides > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: TEXT_SECONDARY,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 12,
                }}
              >
                Ride Breakdown
              </Text>
              <View
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 16,
                }}
              >
                {ridesBreakdown.map((item, i) => (
                  <View
                    key={i}
                    style={{
                      marginBottom: i < ridesBreakdown.length - 1 ? 14 : 0,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: TEXT_SECONDARY,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: item.color,
                        }}
                      >
                        {item.value} ({item.pct}%)
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 6,
                        backgroundColor: BORDER,
                        borderRadius: 3,
                      }}
                    >
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: item.color,
                          width: `${item.pct}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Online drivers */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: TEXT_SECONDARY,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 12,
            }}
          >
            Live Drivers ({onlineDrivers.length})
          </Text>
          {onlineDrivers.length === 0 ? (
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 24,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 10 }}>🛺</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: TEXT_SECONDARY,
                }}
              >
                No drivers online
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              {onlineDrivers.slice(0, 5).map((driver, i) => (
                <View
                  key={driver.id}
                  style={{
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: i < onlineDrivers.length - 1 ? 1 : 0,
                    borderBottomColor: BORDER,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${SUCCESS}20`,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Car size={18} color={SUCCESS} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                    >
                      {driver.vehicle_number}
                    </Text>
                    <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      {driver.phone || driver.email}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 99,
                      backgroundColor: `${SUCCESS}20`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: SUCCESS,
                      }}
                    >
                      ● ONLINE
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Quick actions */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: TEXT_SECONDARY,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 12,
            }}
          >
            Quick Stats
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 14,
                alignItems: "center",
              }}
            >
              <CheckCircle2
                size={24}
                color={SUCCESS}
                style={{ marginBottom: 8 }}
              />
              <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT }}>
                {stats?.completedRides ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: TEXT_SECONDARY,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Completed
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 14,
                alignItems: "center",
              }}
            >
              <XCircle size={24} color={ERROR} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT }}>
                {stats?.cancelledRides ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: TEXT_SECONDARY,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Cancelled
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 14,
                alignItems: "center",
              }}
            >
              <Clock size={24} color={PRIMARY} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT }}>
                {stats?.activeRides ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: TEXT_SECONDARY,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Active
              </Text>
            </View>
          </View>

          {/* Exit test mode OR sign out */}
          {testMode ? (
            <TouchableOpacity
              onPress={async () => {
                await disableTestMode();
                router.replace("/");
              }}
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: "#FDE68A",
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={18} color="#D97706" />
              <Text
                style={{ color: "#D97706", fontSize: 14, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => signOut()}
              style={{
                backgroundColor: "#FFFFFF10",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: ERROR, fontSize: 14, fontWeight: "700" }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}
