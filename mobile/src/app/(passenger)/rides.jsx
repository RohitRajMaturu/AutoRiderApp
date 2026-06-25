import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, MapPin, IndianRupee } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { SkeletonLoader, StatusBadge } from "@/components/ui";
import AutoRideIcon from "@/components/AutoRideIcon";
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
    },
    accepted: {
      bg: theme.primaryLight,
      text: theme.primaryDark,
      Icon: AutoRideIcon,
      label: "Accepted",
    },
    negotiating: {
      bg: "#E0F2FE",
      text: "#0369A1",
      Icon: Clock,
      label: "Negotiating",
    },
    completed: {
      bg: theme.successLight,
      text: theme.success,
      Icon: CheckCircle2,
      label: "Completed",
    },
    cancelled: {
      bg: theme.errorLight,
      text: theme.error,
      Icon: XCircle,
      label: "Cancelled",
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
  const rating = Number(ride.driver_rating);
  const safeRating = Number.isInteger(rating) ? Math.min(Math.max(rating, 0), 5) : 0;
  const titleText =
    ride.status === "completed"
      ? "Trip completed"
      : ride.status === "cancelled"
        ? "Trip cancelled"
        : "Trip in progress";

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
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
              {titleText}
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
          <MapPin size={ICON.sm} color={theme.textMuted} />
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
              backgroundColor: theme.mutedSurface,
              borderRadius: theme.radii.pill,
              flexDirection: "row",
              gap: theme.spacing[2],
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <AutoRideIcon size={ICON.sm} />
            <Text style={[theme.typography.micro, { color: theme.textSecondary, fontWeight: "800" }]}>
              {ride.vehicle_number}
            </Text>
          </View>
        ) : null}

        {fare ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.mutedSurface,
              borderRadius: theme.radii.pill,
              flexDirection: "row",
              gap: theme.spacing[1],
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <IndianRupee size={ICON.xs} color={theme.textSecondary} />
            <Text style={[theme.typography.micro, { color: theme.textSecondary, fontWeight: "800" }]}>
              {fare}
            </Text>
          </View>
        ) : null}

        {Number.isFinite(distance) && distance > 0 ? (
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

        {safeRating > 0 ? (
          <View
            style={{
              backgroundColor: theme.mutedSurface,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
            }}
          >
            <Text style={[theme.typography.micro, { color: theme.textSecondary, fontWeight: "800" }]}>
              {"★".repeat(safeRating)}
              {"☆".repeat(5 - safeRating)}
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

function RidesEmptyState({ title, description }) {
  const theme = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: theme.spacing[6],
        paddingVertical: theme.spacing[10],
      }}
    >
      <Animated.View style={{ transform: [{ translateY }], marginBottom: theme.spacing[5] }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.primaryLight,
            borderRadius: theme.radii.xl,
            height: 96,
            justifyContent: "center",
            width: 96,
          }}
        >
          <AutoRideIcon size={44} />
        </View>
      </Animated.View>
      <Text style={[theme.typography.heading, { color: theme.text, textAlign: "center" }]}>
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
    queryKey: ["passengerRides", activeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        filter: activeFilter,
        offset: String((page - 1) * PAGE_SIZE),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/rides?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  const rides = useMemo(() => data?.rides || [], [data?.rides]);
  const filterCounts = data?.counts || {};
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleStart = totalCount ? pageStart + 1 : 0;
  const visibleEnd = pageStart + rides.length;

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

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
          {filterCounts.all ?? totalCount} total trips - newest first
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
          data={rides}
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
              totalCount={totalCount}
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
