import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  Alert,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  Trophy,
  FlaskConical,
  LogOut,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Polyline,
  Stop,
} from "react-native-svg";
import { useAuth } from "@/utils/auth/useAuth";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ICON } from "@/theme/iconScale";
import AutoRideIcon from "@/components/AutoRideIcon";
import useAppStore from "@/store/useAppStore";

const PRIMARY = "#F5A623";
const PRIMARY_DARK = "#D97706";
const PRIMARY_LIGHT = "rgba(245,166,35,0.12)";
const BG = "#0D0F12";
const SURFACE = "#1C2028";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#F0F2F5";
const TEXT_SECONDARY = "#8A8F9E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const GOLD = "#F59E0B";
const PURPLE = "#38BDF8";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function SignOutSheet({ visible, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          backgroundColor: "rgba(0,0,0,0.62)",
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 22,
            paddingBottom: 30,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              backgroundColor: BORDER,
              borderRadius: 2,
              height: 4,
              marginBottom: 18,
              width: 42,
            }}
          />
          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(239,68,68,0.12)",
              borderColor: "rgba(239,68,68,0.26)",
              borderRadius: 16,
              borderWidth: 1,
              height: 50,
              justifyContent: "center",
              marginBottom: 14,
              width: 50,
            }}
          >
            <LogOut size={ICON.lg} color={ERROR} />
          </View>
          <Text style={{ color: TEXT, fontSize: 20, fontWeight: "900" }}>Sign out?</Text>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
            You will leave the admin console and return to the public start screen.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={onCancel}
              style={{
                alignItems: "center",
                borderColor: BORDER,
                borderRadius: 14,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "900" }}>Stay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={onConfirm}
              style={{
                alignItems: "center",
                backgroundColor: ERROR,
                borderRadius: 14,
                flex: 1,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return `₹${Math.round(numberValue(value)).toLocaleString("en-IN")}`;
}

function formatReason(reason) {
  return String(reason || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHourLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleTimeString("en-IN", { hour: "numeric", hour12: true })
    .replace(" ", "");
}

function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { weekday: "short" });
}

function SectionLabel({ children }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "800",
        color: TEXT_SECONDARY,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {children}
    </Text>
  );
}

function Card({ children, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: SURFACE,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function AnimatedCounter({ to, prefix = "", suffix = "", style }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    progress.setValue(0);
    const listener = progress.addListener(({ value }) => {
      setDisplayValue(Math.round(numberValue(to) * value));
    });
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [progress, to]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue.toLocaleString("en-IN")}
      {suffix}
    </Text>
  );
}

function SparklineChart({ data, color, width, height }) {
  const gradientId = useRef(`sparkFill${Math.random().toString(36).slice(2)}`).current;
  const values = data.map(numberValue);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return { x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `M0,${height} L${points.map((point) => `${point.x},${point.y}`).join(" L")} L${width},${height} Z`
      : "";

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePoints ? (
        <Polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

function TimelineBarChart({ data, xKey, metric, color }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const tooltipScale = useRef(new Animated.Value(0)).current;
  const values = data.map((item) => numberValue(item[metric]));
  const max = Math.max(...values, 1);

  useEffect(() => {
    Animated.spring(tooltipScale, {
      toValue: activeIndex === null ? 0 : 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, tooltipScale]);

  if (data.length === 0) {
    return (
      <View
        style={{
          height: 90,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PRIMARY_LIGHT,
          borderRadius: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY_DARK }}>
          No rides yet today - check back later
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: 112, paddingTop: 18 }}>
      <View style={{ height: 90, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        {data.map((item, index) => {
          const value = numberValue(item[metric]);
          const heightPct = Math.max((value / max) * 100, value > 0 ? 8 : 3);
          const isActive = activeIndex === index;
          return (
            <TouchableOpacity
              key={`${item[xKey]}-${index}`}
              onPress={() => setActiveIndex(isActive ? null : index)}
              activeOpacity={0.8}
              style={{ flex: 1, height: 90, justifyContent: "flex-end" }}
            >
              {isActive ? (
                <Animated.View
                  style={{
                    position: "absolute",
                    top: -16,
                    alignSelf: "center",
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: TEXT,
                    transform: [{ scale: tooltipScale }],
                    zIndex: 2,
                  }}
                >
                  <Text style={{ fontSize: 9, color: SURFACE, fontWeight: "800" }}>
                    {metric === "fare" ? formatCurrency(value) : value}
                  </Text>
                </Animated.View>
              ) : null}
              <View
                style={{
                  height: `${heightPct}%`,
                  borderRadius: 5,
                  backgroundColor: isActive ? color : `${color}60`,
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  position: "absolute",
                  bottom: -18,
                  alignSelf: "center",
                  fontSize: 9,
                  color: TEXT_SECONDARY,
                  fontWeight: "700",
                }}
              >
                {item[xKey]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DonutChart({ segments, size }) {
  const progress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const largest = segments.reduce(
    (best, segment) => (segment.pct > best.pct ? segment : best),
    segments[0] || { pct: 0 },
  );
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, segments]);

  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BORDER}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((segment) => {
          const dash = (circumference * segment.pct) / 100;
          const circle = (
            <AnimatedCircle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={progress.interpolate({
                inputRange: [0, 1],
                outputRange: [`0 ${circumference}`, `${dash} ${circumference}`],
              })}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              originX={size / 2}
              originY={size / 2}
              rotation="-90"
            />
          );
          offset += dash;
          return circle;
        })}
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT }}>
          {Math.round(largest.pct)}%
        </Text>
      </View>
    </View>
  );
}

function RankBadge({ rank }) {
  const color =
    rank === 1
      ? GOLD
      : rank === 2
        ? "#9CA3AF"
        : rank === 3
          ? "#B45309"
          : PRIMARY;

  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: SURFACE }}>
        {rank}
      </Text>
    </View>
  );
}

function PulseCard({ label, value, color, icon }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 17, marginBottom: 8 }}>{icon}</Text>
      <AnimatedCounter
        to={numberValue(value)}
        style={{ fontSize: 23, fontWeight: "900", color }}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: TEXT_SECONDARY,
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </Card>
  );
}

function ToggleGroup({ options, value, onChange, activeColor }) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 5,
              backgroundColor: active ? activeColor : "transparent",
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: active ? SURFACE : TEXT_SECONDARY,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const router = useRouter();
  const { testMode, disableTestMode } = useAppStore();
  const [chartView, setChartView] = useState("today");
  const [chartMetric, setChartMetric] = useState("rides");
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const webUrl = (
    process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:4000"
  ).replace(/\/$/, "");

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
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const forceOffline = useMutation({
    mutationFn: async (driverId) => {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, force_offline: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to force driver offline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    },
    onError: (err) => Alert.alert("Force Offline Failed", err.message),
  });

  const stats = statsData?.stats || {};
  const drivers = driversData?.drivers || [];
  const pendingDrivers = drivers.filter((d) => !d.is_approved);
  const onlineDrivers = drivers.filter((d) => d.is_online && d.is_approved);
  const isLoading = statsLoading || driversLoading;

  const hourlyTimeline = useMemo(
    () =>
      (stats.hourlyTimeline || []).map((item) => ({
        ...item,
        hour_label: formatHourLabel(item.hour),
        rides: numberValue(item.rides),
        fare: numberValue(item.fare),
      })),
    [stats.hourlyTimeline],
  );
  const weeklyTimeline = useMemo(
    () =>
      (stats.weeklyTimeline || []).map((item) => ({
        ...item,
        day_label: formatDayLabel(item.day),
        rides: numberValue(item.rides),
        fare: numberValue(item.fare),
      })),
    [stats.weeklyTimeline],
  );
  const timelineData = chartView === "today" ? hourlyTimeline : weeklyTimeline;
  const xKey = chartView === "today" ? "hour_label" : "day_label";
  const metricColor = chartMetric === "rides" ? PRIMARY : PURPLE;
  const timelineValues = timelineData.map((item) => numberValue(item[chartMetric]));
  const peakValue = Math.max(...timelineValues, 0);
  const totalValue = timelineValues.reduce((sum, value) => sum + value, 0);

  const rideTotal = numberValue(stats.totalRides);
  const healthSegments = [
    {
      label: "Completed",
      color: SUCCESS,
      pct: rideTotal ? (numberValue(stats.completedRides) / rideTotal) * 100 : 0,
    },
    {
      label: "Cancelled",
      color: ERROR,
      pct: rideTotal ? (numberValue(stats.cancelledRides) / rideTotal) * 100 : 0,
    },
    {
      label: "Active",
      color: PRIMARY,
      pct: rideTotal ? (numberValue(stats.activeRides) / rideTotal) * 100 : 0,
    },
  ];
  const cancellationReasons = (stats.cancellationReasons || []).slice(0, 4);
  const maxCancellation = Math.max(
    ...cancellationReasons.map((item) => numberValue(item.count)),
    1,
  );
  const topDrivers = [...drivers]
    .sort(
      (a, b) =>
        numberValue(b.completed_rides_30d) - numberValue(a.completed_rides_30d),
    )
    .slice(0, 5);
  const hasRideLeaders = topDrivers.some(
    (driver) => numberValue(driver.completed_rides_30d) > 0,
  );
  const avgFare =
    numberValue(stats.completedRides) > 0
      ? numberValue(stats.totalFareValue) / numberValue(stats.completedRides)
      : 0;
  const avgFareTrend = weeklyTimeline.map((item) =>
    item.rides > 0 ? item.fare / item.rides : 0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

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
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <AutoRideIcon size={24} />
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: TEXT,
              }}
            >
              Admin Panel
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
            TukTukGo Command Center
          </Text>
        </View>
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
          <FlaskConical size={ICON.sm} color="#B88700" />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: "#286B68",
              fontWeight: "600",
            }}
          >
            🧪 Test Mode - Tap to Exit & Sign In for real admin access
          </Text>
          <Text style={{ fontSize: 12, color: "#B88700", fontWeight: "700" }}>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={statsRefetching}
              onRefresh={refetchStats}
              tintColor={PRIMARY}
            />
          }
        >
          <LinearGradient
            colors={[PRIMARY, PRIMARY_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 18,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              boxShadow: `0 8px 24px ${PRIMARY}40`,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 11, color: "#FFFFFFB3", fontWeight: "800" }}
              >
                Total Fare Value
              </Text>
              <AnimatedCounter
                to={numberValue(stats.totalFareValue)}
                prefix="₹"
                style={{ fontSize: 32, fontWeight: "900", color: SURFACE }}
              />
              <Text style={{ fontSize: 11, color: "#FFFFFFA6", marginTop: 2 }}>
                Today: {formatCurrency(stats.todayFareValue)} ·{" "}
                {numberValue(stats.todayRides)} rides
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <SparklineChart
                data={weeklyTimeline.map((item) => item.fare)}
                color={SURFACE}
                width={100}
                height={44}
              />
              <Text style={{ fontSize: 10, color: "#FFFFFFA6", marginTop: 4 }}>
                7-day trend
              </Text>
            </View>
          </LinearGradient>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <PulseCard
              label="Online Now"
              value={onlineDrivers.length}
              color={SUCCESS}
              icon="●"
            />
            <PulseCard
              label="Today Rides"
              value={stats.todayRides}
              color={PRIMARY}
              icon="🛺"
            />
            <PulseCard
              label="Pending Approval"
              value={stats.pendingDrivers}
              color={GOLD}
              icon="⏳"
            />
          </View>

          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <SectionLabel>Ride Flow</SectionLabel>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <ToggleGroup
                  value={chartView}
                  onChange={setChartView}
                  activeColor={metricColor}
                  options={[
                    { label: "Today", value: "today" },
                    { label: "Week", value: "week" },
                  ]}
                />
                <ToggleGroup
                  value={chartMetric}
                  onChange={setChartMetric}
                  activeColor={metricColor}
                  options={[
                    { label: "Rides", value: "rides" },
                    { label: "₹ Fare", value: "fare" },
                  ]}
                />
              </View>
            </View>
            <TimelineBarChart
              data={timelineData}
              xKey={xKey}
              metric={chartMetric}
              color={metricColor}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                Peak:{" "}
                <Text style={{ fontWeight: "900", color: metricColor }}>
                  {chartMetric === "fare" ? formatCurrency(peakValue) : peakValue}
                </Text>
              </Text>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                Total:{" "}
                <Text style={{ fontWeight: "900", color: metricColor }}>
                  {chartMetric === "fare" ? formatCurrency(totalValue) : totalValue}
                </Text>
              </Text>
            </View>
          </Card>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "stretch",
                  marginBottom: 8,
                }}
              >
                <TrendingUp size={ICON.xs} color={PRIMARY} />
                <SectionLabel>Ride Health</SectionLabel>
              </View>
              <DonutChart segments={healthSegments} size={112} />
              <View style={{ alignSelf: "stretch", gap: 6, marginTop: 10 }}>
                {healthSegments.map((segment) => (
                  <View
                    key={segment.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                    >
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: segment.color,
                        }}
                      />
                      <Text style={{ fontSize: 10, color: TEXT_SECONDARY }}>
                        {segment.label}
                      </Text>
                    </View>
                    <Text
                      style={{ fontSize: 10, fontWeight: "800", color: TEXT }}
                    >
                      {Math.round(segment.pct)}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                <AlertTriangle size={ICON.xs} color={ERROR} />
                <SectionLabel>Why Rides Cancel</SectionLabel>
              </View>
              {cancellationReasons.length === 0 ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: SUCCESS,
                    fontWeight: "800",
                    marginTop: 24,
                  }}
                >
                  No cancellations yet ✓
                </Text>
              ) : (
                cancellationReasons.map((item, index) => {
                  const count = numberValue(item.count);
                  return (
                    <View key={item.cancellation_reason || index} style={{ marginBottom: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: 10, color: TEXT_SECONDARY }}
                        >
                          {formatReason(item.cancellation_reason)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: ERROR,
                            textAlign: "right",
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: `${ERROR}15`,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: 5,
                            borderRadius: 3,
                            width: `${(count / maxCancellation) * 100}%`,
                            backgroundColor: `${ERROR}${["FF", "CC", "99", "77"][index] || "66"}`,
                          }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          </View>

          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Trophy size={ICON.sm} color={GOLD} />
                <SectionLabel>Top Drivers - 30 Days</SectionLabel>
              </View>
              <Text style={{ fontSize: 11, fontWeight: "800", color: PRIMARY }}>
                by rides
              </Text>
            </View>
            {!hasRideLeaders ? (
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: "700",
                  color: TEXT_SECONDARY,
                  paddingVertical: 24,
                }}
              >
                No ride data yet
              </Text>
            ) : (
              topDrivers.map((driver, index) => (
                <View
                  key={driver.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: index < topDrivers.length - 1 ? 1 : 0,
                    borderBottomColor: BORDER,
                  }}
                >
                  <RankBadge rank={index + 1} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 13, fontWeight: "700", color: TEXT }}
                    >
                      {driver.vehicle_number || "Unassigned Vehicle"}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}
                    >
                      {driver.phone || driver.email}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: "800", color: PRIMARY }}
                    >
                      {numberValue(driver.completed_rides_30d)} rides
                    </Text>
                    {driver.avg_driver_rating_30d && (
                      <Text
                        style={{ fontSize: 11, color: GOLD, fontWeight: "800" }}
                      >
                        ★ {driver.avg_driver_rating_30d}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: driver.is_online ? SUCCESS : BORDER,
                    }}
                  />
                  {driver.is_online && (
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          "Force driver offline?",
                          "This will end the driver's online session immediately.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Force Offline",
                              style: "destructive",
                              onPress: () => forceOffline.mutate(driver.id),
                            },
                          ],
                        )
                      }
                      disabled={forceOffline.isPending}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 99,
                        borderWidth: 1,
                        borderColor: ERROR,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={{ fontSize: 10, fontWeight: "800", color: ERROR }}
                      >
                        Force Offline
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </Card>

          <Card
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IndianRupee size={ICON.sm} color={PURPLE} />
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: TEXT_SECONDARY }}
                >
                  Avg Fare / Ride
                </Text>
              </View>
              <AnimatedCounter
                to={Math.round(avgFare)}
                prefix="₹"
                style={{ fontSize: 28, fontWeight: "900", color: PURPLE }}
              />
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                per completed ride
              </Text>
            </View>
            <SparklineChart
              data={avgFareTrend}
              color={PURPLE}
              width={100}
              height={48}
            />
          </Card>

          {pendingDrivers.length > 0 && (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FDE68A",
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 22 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#286B68" }}
                >
                  {pendingDrivers.length} Driver
                  {pendingDrivers.length > 1 ? "s" : ""} Awaiting Approval
                </Text>
                <Text style={{ fontSize: 12, color: "#586C70", marginTop: 2 }}>
                  Tap Drivers tab to review
                </Text>
              </View>
            </View>
          )}

          <View>
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
                }}
              >
                {onlineDrivers.slice(0, 5).map((driver, index) => (
                  <View
                    key={driver.id}
                    style={{
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderBottomWidth:
                        index < Math.min(onlineDrivers.length, 5) - 1 ? 1 : 0,
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
                      <AutoRideIcon size={ICON.md} />
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
          </View>

          <TouchableOpacity
            onPress={() => Linking.openURL(`${webUrl}/admin-ops`)}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: SURFACE, fontSize: 14, fontWeight: "800" }}>
              Open Ops Dashboard
            </Text>
          </TouchableOpacity>

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
              <FlaskConical size={ICON.sm} color="#B88700" />
              <Text
                style={{ color: "#B88700", fontSize: 14, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowSignOutSheet(true)}
              style={{
                backgroundColor: SURFACE,
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
      <SignOutSheet
        visible={showSignOutSheet}
        onCancel={() => setShowSignOutSheet(false)}
        onConfirm={async () => {
          setShowSignOutSheet(false);
          try {
            await signOut();
          } catch {
            Alert.alert("Sign out", "You have been returned to the start screen.");
          }
        }}
      />
    </View>
  );
}
