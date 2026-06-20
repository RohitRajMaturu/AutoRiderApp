import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Clock, CheckCircle2, XCircle, Car, MapPin, Sparkles } from "lucide-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { SkeletonLoader, StatusBadge } from "@/components/ui";
import { useTheme } from "@/theme/ThemeContext";
import { ICON } from "@/theme/iconScale";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function formatCancellationReason(reason) {
  if (!reason) return null;
  return String(reason)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createStatusConfig(theme) {
  return {
    requested: {
      bg: theme.warningLight,
      text: theme.warning,
      Icon: Clock,
      label: "Searching",
      accent: theme.warning,
    },
    accepted: {
      bg: theme.primaryLight,
      text: theme.primaryDark,
      Icon: Car,
      label: "Accepted",
      accent: theme.primary,
    },
    completed: {
      bg: theme.successLight,
      text: theme.success,
      Icon: CheckCircle2,
      label: "Completed",
      accent: theme.success,
    },
    cancelled: {
      bg: theme.errorLight,
      text: theme.error,
      Icon: XCircle,
      label: "Cancelled",
      accent: theme.error,
    },
  };
}

const RideCard = memo(function RideCard({ ride }) {
  const theme = useTheme();
  const statusConfig = useMemo(() => createStatusConfig(theme), [theme]);
  const config = statusConfig[ride.status] || statusConfig.requested;
  const { Icon } = config;
  const date = new Date(ride.created_at);
  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const badgeConfig = {
    [ride.status]: {
      bg: config.bg,
      text: config.text,
      label: config.label,
    },
  };

  return (
    <View
      style={[
        theme.shadow.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderLeftColor: config.accent,
          borderLeftWidth: 4,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          marginBottom: theme.spacing[3],
          overflow: "hidden",
        },
      ]}
    >
      <View
        style={{
          alignItems: "center",
          borderBottomColor: theme.mutedSurface,
          borderBottomWidth: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          padding: theme.spacing[4],
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing[3] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: config.bg,
              borderRadius: theme.radii.pill,
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <Icon size={ICON.md} color={config.text} />
          </View>
          <View>
            <Text style={[theme.typography.caption, { color: theme.text }]}>
              Ride #{ride.id}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.textMuted }]}>
              {formattedDate} - {formattedTime}
            </Text>
          </View>
        </View>
        <StatusBadge status={ride.status} config={badgeConfig} />
      </View>

      <View style={{ padding: theme.spacing[4] }}>
        <View style={{ flexDirection: "row", gap: theme.spacing[4] }}>
          <View style={{ alignItems: "center", paddingTop: theme.spacing[1] }}>
            <View
              style={{
                backgroundColor: theme.primary,
                borderRadius: theme.radii.pill,
                height: 8,
                width: 8,
              }}
            />
            <View
              style={{
                backgroundColor: theme.border,
                height: 22,
                marginVertical: theme.spacing[1],
                width: 1.5,
              }}
            />
            <View
              style={{
                backgroundColor: theme.text,
                borderRadius: 2,
                height: 8,
                width: 8,
              }}
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing[3] }}>
            <Text style={[theme.typography.caption, { color: theme.text }]} numberOfLines={1}>
              {ride.pickup_address}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.text }]} numberOfLines={1}>
              {ride.dest_address}
            </Text>
          </View>
        </View>

        {ride.vehicle_number ? (
          <View
            style={{
              alignItems: "center",
              borderTopColor: theme.mutedSurface,
              borderTopWidth: 1,
              flexDirection: "row",
              gap: theme.spacing[2],
              marginTop: theme.spacing[3],
              paddingTop: theme.spacing[3],
            }}
          >
            <Car size={ICON.sm} color={theme.textMuted} />
            <Text style={[theme.typography.caption, { color: theme.textSecondary }]}>
              {ride.vehicle_number}
            </Text>
          </View>
        ) : null}

        {ride.status === "cancelled" && ride.cancellation_reason ? (
          <View
            style={{
              borderTopColor: theme.mutedSurface,
              borderTopWidth: 1,
              marginTop: theme.spacing[3],
              paddingTop: theme.spacing[3],
            }}
          >
            <Text style={[theme.typography.micro, { color: theme.textMuted }]}>
              Cancellation reason
            </Text>
            <Text style={[theme.typography.caption, { color: theme.error, marginTop: theme.spacing[1] }]}>
              {formatCancellationReason(ride.cancellation_reason)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

function FilterTabs({ activeFilter, onChange }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: theme.spacing[2], marginTop: theme.spacing[4] }}>
      {FILTERS.map((filter) => {
        const selected = filter.key === activeFilter;
        return (
          <TouchableOpacity
            accessibilityLabel={`Show ${filter.label.toLowerCase()} rides`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            activeOpacity={0.86}
            key={filter.key}
            onPress={() => onChange(filter.key)}
            style={{
              backgroundColor: selected ? theme.primary : theme.primaryLight,
              borderColor: selected ? theme.primary : theme.primaryBorder,
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              paddingHorizontal: theme.spacing[4],
              paddingVertical: theme.spacing[2],
            }}
          >
            <Text
              style={[
                theme.typography.caption,
                { color: selected ? theme.surface : theme.primaryDark },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AutoRickshawSvg({ size = 64 }) {
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 160 116">
      <Path d="M34 61H18c-5 0-9 4-9 9v17h134V71c0-6-5-10-11-10h-13" fill="#17272B" opacity="0.16" />
      <Rect x="35" y="43" width="84" height="43" rx="10" fill="#F3B51B" />
      <Path d="M46 44c6-17 19-27 36-27h12c13 0 23 10 25 27H46Z" fill="#1F8A4C" />
      <Path d="M58 39c5-10 14-16 25-16h7c9 0 16 6 19 16H58Z" fill="#E7F6F4" />
      <Path d="M119 43l18 27-4 17h-23l4-27-8-17h13Z" fill="#17272B" opacity="0.88" />
      <Rect x="23" y="72" width="112" height="16" rx="7" fill="#F3B51B" />
      <Path d="M37 58h42v18H37z" fill="#FFD15C" opacity="0.78" />
      <Path d="M91 58h17v18H91z" fill="#FFD15C" opacity="0.7" />
      <Circle cx="49" cy="94" r="14" fill="#17272B" />
      <Circle cx="49" cy="94" r="6" fill="#BFD1D3" />
      <Circle cx="114" cy="94" r="14" fill="#17272B" />
      <Circle cx="114" cy="94" r="6" fill="#BFD1D3" />
      <Path d="M25 68h-9c-4 0-7 3-7 7v4h16V68Z" fill="#1F8A4C" />
      <Rect x="61" y="86" width="40" height="5" rx="2.5" fill="#17272B" opacity="0.2" />
      <Path d="M54 23c8-9 17-13 28-13" stroke="#17272B" strokeWidth="4" strokeLinecap="round" opacity="0.18" />
    </Svg>
  );
}

function RidesEmptyState({ title, description }) {
  const theme = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    );

    floatLoop.start();
    pulseLoop.start();
    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  const autoTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const autoRotate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-3deg"],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.88, 1.1, 0.88],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });
  const sparkleRotate = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: theme.spacing[6],
        paddingVertical: theme.spacing[10],
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.surface,
          borderColor: theme.primaryBorder,
          borderRadius: 24,
          borderWidth: 1,
          height: 158,
          justifyContent: "center",
          marginBottom: theme.spacing[5],
          overflow: "hidden",
          width: 232,
        }}
      >
        <View
          style={{
            backgroundColor: theme.primaryLight,
            borderRadius: 999,
            height: 190,
            opacity: 0.92,
            position: "absolute",
            right: -72,
            top: -82,
            width: 190,
          }}
        />
        <View
          style={{
            backgroundColor: theme.warningLight,
            borderRadius: 999,
            bottom: -42,
            height: 112,
            left: -34,
            opacity: 0.78,
            position: "absolute",
            width: 112,
          }}
        />
        <View
          style={{
            borderColor: theme.primaryBorder,
            borderRadius: 22,
            borderStyle: "dashed",
            borderWidth: 2,
            height: 66,
            left: 54,
            position: "absolute",
            top: 45,
            transform: [{ rotate: "-10deg" }],
            width: 126,
          }}
        />
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 18,
            borderWidth: 1,
            elevation: 3,
            flexDirection: "row",
            gap: theme.spacing[2],
            left: 26,
            paddingHorizontal: 10,
            paddingVertical: 9,
            position: "absolute",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.1,
            shadowRadius: 16,
            top: 22,
          }}
        >
          <MapPin size={ICON.sm} color={theme.primary} />
          <View>
            <View style={{ backgroundColor: theme.text, borderRadius: 999, height: 5, width: 58 }} />
            <View
              style={{
                backgroundColor: theme.border,
                borderRadius: 999,
                height: 5,
                marginTop: 6,
                width: 38,
              }}
            />
          </View>
        </View>
        <Animated.View
          style={{
            alignItems: "center",
            height: 68,
            justifyContent: "center",
            position: "absolute",
            right: 24,
            top: 58,
            transform: [{ translateY: autoTranslateY }, { rotate: autoRotate }],
            width: 88,
          }}
        >
          <AutoRickshawSvg size={88} />
        </Animated.View>
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.successLight,
            borderColor: theme.surface,
            borderRadius: 999,
            borderWidth: 3,
            bottom: 24,
            height: 38,
            justifyContent: "center",
            left: 58,
            position: "absolute",
            width: 38,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: theme.successLight,
              borderRadius: 999,
              height: 50,
              opacity: pulseOpacity,
              position: "absolute",
              transform: [{ scale: pulseScale }],
              width: 50,
            }}
          />
          <MapPin size={ICON.sm} color={theme.success} />
        </View>
        <Animated.View
          style={{
            alignItems: "center",
            backgroundColor: theme.warning,
            borderRadius: 999,
            height: 30,
            justifyContent: "center",
            position: "absolute",
            right: 22,
            top: 20,
            transform: [{ rotate: sparkleRotate }],
            width: 30,
          }}
        >
          <Sparkles size={ICON.xs} color={theme.surface} />
        </Animated.View>
      </View>
      <Text
        style={[
          theme.typography.heading,
          {
            color: theme.text,
            textAlign: "center",
          },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.textSecondary,
            marginTop: theme.spacing[2],
            maxWidth: 280,
            textAlign: "center",
          },
        ]}
      >
        {description}
      </Text>
    </View>
  );
}

export default function PassengerRides() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [activeFilter, setActiveFilter] = useState("pending");
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["passengerRides"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const rides = useMemo(() => data?.rides || [], [data?.rides]);
  const filteredRides = useMemo(() => {
    if (activeFilter === "pending") {
      return rides.filter((ride) => ride.status === "requested" || ride.status === "accepted");
    }
    return rides.filter((ride) => ride.status === activeFilter);
  }, [activeFilter, rides]);

  const emptyCopy = {
    pending: {
      title: "No pending rides",
      description: "Active ride requests and accepted rides will appear here.",
    },
    completed: {
      title: "No completed rides",
      description: "Completed trips will appear here after your first ride.",
    },
    cancelled: {
      title: "No cancelled rides",
      description: "Cancelled trip records will appear here when available.",
    },
  }[activeFilter];

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <StatusBar style="dark" />
      <View
        style={{
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
          paddingBottom: theme.spacing[4],
          paddingHorizontal: theme.spacing[5],
          paddingTop: insets.top + theme.spacing[4],
        }}
      >
        <Text style={[theme.typography.heading, { color: theme.text }]}>My Rides</Text>
        <Text style={[theme.typography.caption, { color: theme.textSecondary, marginTop: theme.spacing[1] }]}>
          {rides.length} trip{rides.length !== 1 ? "s" : ""} total
        </Text>
        <FilterTabs activeFilter={activeFilter} onChange={setActiveFilter} />
      </View>

      {isLoading ? (
        <View style={{ gap: theme.spacing[3], padding: theme.spacing[4] }}>
          <SkeletonLoader variant="list-item" />
          <SkeletonLoader variant="list-item" />
          <SkeletonLoader variant="list-item" />
        </View>
      ) : (
        <FlashList
          data={filteredRides}
          estimatedItemSize={168}
          keyExtractor={(ride) => String(ride.id)}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={{ padding: theme.spacing[4], paddingBottom: 80 }}
          ListEmptyComponent={
            <RidesEmptyState
              title={emptyCopy.title}
              description={emptyCopy.description}
            />
          }
          renderItem={({ item }) => <RideCard ride={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
