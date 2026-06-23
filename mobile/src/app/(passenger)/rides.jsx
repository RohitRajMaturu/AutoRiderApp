import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, MapPin, Sparkles, IndianRupee } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { SkeletonLoader, StatusBadge } from "@/components/ui";
import AutoRickshawIcon from "@/components/AutoRickshawIcon";
import { useTheme } from "@/theme/ThemeContext";
import { ICON } from "@/theme/iconScale";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
const PAGE_SIZE = 6;

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}

function rideFare(ride) {
  return ride?.final_fare ?? ride?.estimated_fare ?? null;
}

function rideTime(ride) {
  const value = ride?.completed_at || ride?.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function matchesStatus(ride, activeFilter) {
  if (activeFilter === "all") return true;
  if (activeFilter === "pending") {
    return ["requested", "negotiating", "accepted"].includes(ride.status);
  }
  return ride.status === activeFilter;
}

function sortRides(a, b) {
  return rideTime(b) - rideTime(a);
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
      Icon: AutoRickshawIcon,
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
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderLeftColor: config.accent,
        borderLeftWidth: 3,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        marginBottom: theme.spacing[2],
        padding: theme.spacing[3],
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: theme.spacing[3],
          justifyContent: "space-between",
        }}
      >
        <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: theme.spacing[2] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: config.bg,
              borderRadius: 12,
              height: 34,
              justifyContent: "center",
              width: 34,
            }}
          >
            <Icon size={ICON.sm} color={config.text} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[theme.typography.caption, { color: theme.text, fontWeight: "800" }]} numberOfLines={1}>
              {ride.status === "completed" ? "Trip completed" : ride.status === "cancelled" ? "Trip cancelled" : "Trip in progress"}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {formattedDate} - {formattedTime}
            </Text>
          </View>
        </View>
        <StatusBadge status={ride.status} config={badgeConfig} />
      </View>

      <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[1] }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: theme.spacing[2] }}>
          <MapPin size={ICON.sm} color={theme.success} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[theme.typography.caption, { color: theme.text }]} numberOfLines={1}>
              {ride.dest_address}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.textMuted, marginTop: 2 }]} numberOfLines={1}>
              From {ride.pickup_address}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          borderTopColor: theme.mutedSurface,
          borderTopWidth: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing[2],
          marginTop: theme.spacing[3],
          paddingTop: theme.spacing[3],
        }}
      >
        {ride.vehicle_number ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.primaryLight,
              borderRadius: theme.radii.pill,
              flexDirection: "row",
              gap: theme.spacing[2],
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <AutoRickshawIcon size={ICON.sm} color={theme.primaryDark} />
            <Text style={[theme.typography.micro, { color: theme.primaryDark, fontWeight: "800" }]}>
              {ride.vehicle_number}
            </Text>
          </View>
        ) : null}

        {fare ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.successLight,
              borderRadius: theme.radii.pill,
              flexDirection: "row",
              gap: theme.spacing[1],
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <IndianRupee size={ICON.xs} color={theme.success} />
            <Text style={[theme.typography.micro, { color: theme.success, fontWeight: "800" }]}>
              {fare}
            </Text>
          </View>
        ) : null}

        {Number.isFinite(distance) ? (
          <View
            style={{
              backgroundColor: theme.mutedSurface,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <Text style={[theme.typography.micro, { color: theme.textSecondary, fontWeight: "800" }]}>
              {distance.toFixed(1)} km
            </Text>
          </View>
        ) : null}

        {ride.status === "cancelled" && ride.cancellation_reason ? (
          <Text style={[theme.typography.micro, { color: theme.error, flexBasis: "100%" }]} numberOfLines={1}>
            Reason: {formatCancellationReason(ride.cancellation_reason)}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

function FilterTabs({ activeFilter, onChange, counts }) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing[2], paddingRight: theme.spacing[5] }}
      style={{ marginTop: theme.spacing[4] }}
    >
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
              {filter.label} {counts?.[filter.key] ?? 0}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function PaginationBar({ page, totalPages, totalCount, start, end, onPrevious, onNext }) {
  const theme = useTheme();
  const disabledPrevious = page <= 1;
  const disabledNext = page >= totalPages;

  if (totalCount === 0) return null;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        marginTop: theme.spacing[2],
        padding: theme.spacing[3],
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[theme.typography.micro, { color: theme.textSecondary }]}>
          Showing {start}-{end} of {totalCount}
        </Text>
        <Text style={[theme.typography.micro, { color: theme.text }]}>
          Page {page}/{totalPages}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabledPrevious}
          onPress={onPrevious}
          style={{
            alignItems: "center",
            backgroundColor: disabledPrevious ? theme.mutedSurface : theme.surface,
            borderColor: theme.border,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: theme.spacing[1],
            justifyContent: "center",
            opacity: disabledPrevious ? 0.5 : 1,
            paddingVertical: theme.spacing[3],
          }}
        >
          <ChevronLeft size={ICON.sm} color={theme.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.textSecondary }]}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabledNext}
          onPress={onNext}
          style={{
            alignItems: "center",
            backgroundColor: disabledNext ? theme.mutedSurface : theme.primary,
            borderColor: disabledNext ? theme.border : theme.primary,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: theme.spacing[1],
            justifyContent: "center",
            opacity: disabledNext ? 0.5 : 1,
            paddingVertical: theme.spacing[3],
          }}
        >
          <Text style={[theme.typography.caption, { color: disabledNext ? theme.textSecondary : theme.surface }]}>Next</Text>
          <ChevronRight size={ICON.sm} color={disabledNext ? theme.textSecondary : theme.surface} />
        </TouchableOpacity>
      </View>
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
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
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
  const filterCounts = useMemo(
    () =>
      FILTERS.reduce((acc, filter) => {
        acc[filter.key] = rides.filter((ride) => matchesStatus(ride, filter.key)).length;
        return acc;
      }, {}),
    [rides],
  );
  const filteredRides = useMemo(() => {
    return rides
      .filter((ride) => matchesStatus(ride, activeFilter))
      .sort((a, b) => sortRides(a, b));
  }, [activeFilter, rides]);
  const totalPages = Math.max(Math.ceil(filteredRides.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleRides = filteredRides.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleStart = filteredRides.length ? pageStart + 1 : 0;
  const visibleEnd = pageStart + visibleRides.length;

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const emptyCopy = {
    all: {
      title: "No rides yet",
      description: "Booked trips, active rides, and completed rides will appear here.",
    },
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
          {rides.length} total trips - newest first
        </Text>
        <FilterTabs activeFilter={activeFilter} counts={filterCounts} onChange={setActiveFilter} />
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
            <PaginationBar
              end={visibleEnd}
              onNext={() => setPage((value) => Math.min(value + 1, totalPages))}
              onPrevious={() => setPage((value) => Math.max(value - 1, 1))}
              page={safePage}
              start={visibleStart}
              totalCount={filteredRides.length}
              totalPages={totalPages}
            />
          }
          renderItem={({ item }) => <RideCard ride={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
