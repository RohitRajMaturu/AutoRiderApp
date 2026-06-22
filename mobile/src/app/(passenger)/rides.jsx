import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Clock, CheckCircle2, XCircle, Car, MapPin, Sparkles, IndianRupee } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { SkeletonLoader, StatusBadge } from "@/components/ui";
import { useTheme } from "@/theme/ThemeContext";
import { ICON } from "@/theme/iconScale";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
const PAGE_SIZE = 8;

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}

function rideFare(ride) {
  return ride?.final_fare ?? ride?.estimated_fare ?? null;
}

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
  const fare = formatCurrency(rideFare(ride));
  const distance = Number(ride.distance_km);
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
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
        }}
      >
        <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: theme.spacing[3], paddingRight: theme.spacing[2] }}>
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
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.text }]} numberOfLines={1}>
              {ride.status === "completed" ? "Trip completed" : ride.status === "cancelled" ? "Trip cancelled" : "Trip in progress"}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {formattedDate} - {formattedTime}
            </Text>
          </View>
        </View>
        <StatusBadge status={ride.status} config={badgeConfig} />
      </View>

      <View style={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <View style={{ gap: theme.spacing[2] }}>
          <View style={{ flexDirection: "row", gap: theme.spacing[2] }}>
            <MapPin size={ICON.sm} color={theme.success} />
            <Text style={[theme.typography.caption, { color: theme.text, flex: 1 }]} numberOfLines={2}>
              {ride.dest_address}
            </Text>
          </View>
          <Text style={[theme.typography.micro, { color: theme.textMuted, marginLeft: 24 }]} numberOfLines={1}>
            From {ride.pickup_address}
          </Text>
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

        {(fare || Number.isFinite(distance)) && (
          <View
            style={{
              alignItems: "center",
              borderTopColor: theme.mutedSurface,
              borderTopWidth: 1,
              flexDirection: "row",
              gap: theme.spacing[4],
              paddingTop: theme.spacing[3],
            }}
          >
            {fare ? (
              <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing[1] }}>
                <IndianRupee size={ICON.xs} color={theme.primary} />
                <Text style={[theme.typography.caption, { color: theme.primaryDark }]}>
                  {fare}
                </Text>
              </View>
            ) : null}
            {Number.isFinite(distance) ? (
              <Text style={[theme.typography.caption, { color: theme.textSecondary }]}>
                {distance.toFixed(1)} km
              </Text>
            ) : null}
          </View>
        )}

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

function PassengerRideBadge() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderColor: "#FFFFFF",
        borderRadius: 999,
        borderWidth: 3,
        elevation: 4,
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      }}
    >
      <Text style={{ color: "#238B86", fontSize: 24, fontWeight: "900" }}>
        🛺
      </Text>
    </View>
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
            height: 56,
            justifyContent: "center",
            position: "absolute",
            right: 18,
            top: 64,
            transform: [{ translateY: autoTranslateY }, { rotate: autoRotate }],
            width: 136,
          }}
        >
          <PassengerRideBadge />
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
      return rides.filter(
        (ride) =>
          ride.status === "requested" ||
          ride.status === "negotiating" ||
          ride.status === "accepted",
      );
    }
    return rides.filter((ride) => ride.status === activeFilter);
  }, [activeFilter, rides]);
  const visibleRides = filteredRides.slice(0, visibleCount);
  const hiddenRideCount = Math.max(filteredRides.length - visibleRides.length, 0);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeFilter]);

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
          data={visibleRides}
          estimatedItemSize={142}
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
          ListFooterComponent={
            hiddenRideCount > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderRadius: theme.radii.lg,
                  borderWidth: 1,
                  marginTop: theme.spacing[1],
                  paddingVertical: theme.spacing[4],
                }}
              >
                <Text style={[theme.typography.caption, { color: theme.primaryDark }]}>
                  Show {Math.min(hiddenRideCount, PAGE_SIZE)} More Trips
                </Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => <RideCard ride={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
