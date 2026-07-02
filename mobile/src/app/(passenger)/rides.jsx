import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, MapPin, IndianRupee, Ticket, CalendarDays } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { SkeletonLoader, StatusBadge } from "@/components/ui";
import AutoRideIcon from "@/components/AutoRideIcon";
import { useTheme } from "@/theme/ThemeContext";
import { ICON } from "@/theme/iconScale";
import { getVehicleLabel } from "@/utils/vehicles";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "passes", label: "Passes" },
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
    scheduled: {
      bg: theme.infoDim,
      text: theme.info,
      Icon: Clock,
      label: "Scheduled",
    },
    accepted: {
      bg: theme.primaryLight,
      text: theme.primaryDark,
      Icon: AutoRideIcon,
      label: "Accepted",
    },
    negotiating: {
      bg: theme.infoDim,
      text: theme.info,
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
  const displayStatus = ride.status === "requested" && ride.scheduled_for ? "scheduled" : ride.status;
  const config = statusConfig[displayStatus] || statusConfig.requested;
  const { Icon } = config;
  const fare = formatCurrency(rideFare(ride));
  const distance = Number(ride.distance_km);
  const date = new Date(ride.scheduled_for || ride.created_at);
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
    [displayStatus]: {
      bg: config.bg,
      text: config.text,
      label: config.label,
    },
  };
  const rating = Number(ride.driver_rating);
  const safeRating = Number.isInteger(rating) ? Math.min(Math.max(rating, 0), 5) : 0;
  const titleText =
    displayStatus === "scheduled"
      ? "Ride scheduled"
      : ride.status === "completed"
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
            <Text style={[theme.typography.caption, { color: theme.text1, fontWeight: "800" }]} numberOfLines={1}>
              {titleText}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.text3, marginTop: 2 }]} numberOfLines={1}>
              {formattedDate} - {formattedTime}
            </Text>
          </View>
        </View>
        <StatusBadge status={displayStatus} config={badgeConfig} />
      </View>

      <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[1] }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: theme.spacing[2] }}>
          <MapPin size={ICON.sm} color={theme.text3} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[theme.typography.caption, { color: theme.text1 }]} numberOfLines={1}>
              {ride.dest_address}
            </Text>
            <Text style={[theme.typography.micro, { color: theme.text3, marginTop: 2 }]} numberOfLines={1}>
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
            <Text style={[theme.typography.micro, { color: theme.text2, fontWeight: "800" }]}>
              {ride.vehicle_number} - {getVehicleLabel(ride.vehicle_type)}
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
            <IndianRupee size={ICON.xs} color={theme.text2} />
            <Text style={[theme.typography.micro, { color: theme.text2, fontWeight: "800" }]}>
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
            <Text style={[theme.typography.micro, { color: theme.text2, fontWeight: "800" }]}>
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
            <Text style={[theme.typography.micro, { color: theme.text2, fontWeight: "800" }]}>
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

const PassCard = memo(function PassCard({ pass, onPress }) {
  const theme = useTheme();
  const status = String(pass.status || "PENDING_MATCH").toUpperCase();
  const statusTone = status === "ACTIVE"
    ? { bg: theme.successLight, text: theme.success }
    : status === "CANCELLED"
      ? { bg: theme.errorLight, text: theme.error }
      : { bg: theme.warningLight, text: theme.warning };
  const created = new Date(pass.created_at);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.radii.lg, borderWidth: 1, marginBottom: theme.spacing[2], padding: theme.spacing[3] }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: theme.spacing[2] }}>
        <View style={{ alignItems: "center", flexDirection: "row", flex: 1, gap: theme.spacing[2] }}>
          <View style={{ alignItems: "center", backgroundColor: theme.primaryLight, borderRadius: 12, height: 34, justifyContent: "center", width: 34 }}>
            <Ticket size={ICON.sm} color={theme.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.text1, fontWeight: "800" }]}>TukTukPass</Text>
            <Text style={[theme.typography.micro, { color: theme.text3, marginTop: 2 }]}>
              {Number.isNaN(created.getTime()) ? "Pass history" : created.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: statusTone.bg, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={[theme.typography.micro, { color: statusTone.text, fontWeight: "900" }]}>{status.replace(/_/g, " ")}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
        <MapPin size={ICON.sm} color={theme.text3} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.caption, { color: theme.text1 }]} numberOfLines={1}>{pass.dropoff_label}</Text>
          <Text style={[theme.typography.micro, { color: theme.text3, marginTop: 2 }]} numberOfLines={1}>From {pass.pickup_label}</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
        <CalendarDays size={ICON.xs} color={theme.text3} />
        <Text style={[theme.typography.micro, { color: theme.text2, flex: 1 }]}>
          {(pass.scheduled_days || []).join(" · ")} · {String(pass.scheduled_time || "").slice(0, 5)} · {pass.duration_type === "WEEKLY" ? "7 days" : "30 days"}
        </Text>
        <ChevronRight size={ICON.sm} color={theme.primaryDark} />
      </View>
    </TouchableOpacity>
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
        <Text style={[theme.typography.micro, { color: theme.text2 }]}>
          Showing {start}-{end} of {totalCount}
        </Text>
        <Text style={[theme.typography.micro, { color: theme.text1 }]}>
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
          <ChevronLeft size={ICON.sm} color={theme.text2} />
          <Text style={[theme.typography.caption, { color: theme.text2 }]}>Previous</Text>
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
          <Text style={[theme.typography.caption, { color: disabledNext ? theme.text2 : theme.surface1 }]}>Next</Text>
          <ChevronRight size={ICON.sm} color={disabledNext ? theme.text2 : theme.surface1} />
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
      <Text style={[theme.typography.heading, { color: theme.text1, textAlign: "center" }]}>
        {title}
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.text2,
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
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["passengerRides", activeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        filter: activeFilter === "passes" ? "all" : activeFilter,
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

  const { data: passData, isLoading: passesLoading, refetch: refetchPasses, isRefetching: passesRefetching } = useQuery({
    queryKey: ["passengerPasses"],
    queryFn: async () => {
      const res = await fetch("/api/passes");
      if (!res.ok) throw new Error("Failed to fetch passes");
      return res.json();
    },
    staleTime: 60000,
  });

  const rides = useMemo(() => data?.rides || [], [data?.rides]);
  const passes = useMemo(() => passData?.passes || [], [passData?.passes]);
  const historyItems = useMemo(() => {
    const passItems = passes.map((pass) => ({ ...pass, historyType: "pass" }));
    if (activeFilter === "passes") return passItems;
    const rideItems = rides.map((ride) => ({ ...ride, historyType: "ride" }));
    if (activeFilter !== "all" || page !== 1) return rideItems;
    return [...passItems, ...rideItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [activeFilter, page, passes, rides]);
  const filterCounts = data?.counts || {};
  const displayCounts = { ...filterCounts, all: (filterCounts.all || 0) + passes.length, passes: passes.length };
  const totalCount = activeFilter === "passes" ? passes.length : activeFilter === "all" ? (data?.total || 0) + passes.length : data?.total ?? 0;
  const rideTotal = data?.total ?? 0;
  const totalPages = activeFilter === "passes" ? 1 : Math.max(Math.ceil(rideTotal / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleStart = totalCount ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + historyItems.length, totalCount);

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
    passes: {
      title: "No pass history",
      description: "Active, paused, cancelled, and previous TukTukPass records will appear here.",
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
        <Text style={[theme.typography.heading, { color: theme.text1 }]}>My Rides</Text>
        <Text style={[theme.typography.caption, { color: theme.text2, marginTop: theme.spacing[1] }]}>
          {displayCounts.all ?? totalCount} trips and passes - newest first
        </Text>
        <FilterTabs activeFilter={activeFilter} counts={displayCounts} onChange={setActiveFilter} />
      </View>

      {isLoading || passesLoading ? (
        <View style={{ gap: theme.spacing[3], padding: theme.spacing[4] }}>
          <SkeletonLoader variant="list-item" />
          <SkeletonLoader variant="list-item" />
          <SkeletonLoader variant="list-item" />
        </View>
      ) : (
        <FlashList
          data={historyItems}
          estimatedItemSize={142}
          keyExtractor={(item) => `${item.historyType}-${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || passesRefetching}
              onRefresh={() => Promise.all([refetch(), refetchPasses()])}
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
          renderItem={({ item }) => item.historyType === "pass"
            ? <PassCard pass={item} onPress={() => router.push(`/(passenger)/pass/${item.id}`)} />
            : <RideCard ride={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
