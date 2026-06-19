import React, { memo, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Clock, CheckCircle2, XCircle, Car } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { EmptyState, SkeletonLoader, StatusBadge } from "@/components/ui";
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
              height: 36,
              justifyContent: "center",
              width: 36,
            }}
          >
            <Icon size={ICON.sm} color={config.text} />
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
            <Car size={ICON.xs} color={theme.textMuted} />
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
            <EmptyState
              title={emptyCopy.title}
              description={emptyCopy.description}
              animationVariant="empty"
            />
          }
          renderItem={({ item }) => <RideCard ride={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
