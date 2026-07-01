import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";
import { StatusBar } from "expo-status-bar";
import AutoRideIcon from "@/components/AutoRideIcon";
import { getVehicleLabel } from "@/utils/vehicles";
import { ICON } from "@/theme/iconScale";
import { adminTheme as T } from "@/theme/tokens";

const PRIMARY = T.accent;
const BG = T.bg;
const SURFACE = T.surface2;
const BORDER = T.border;
const TEXT = T.text1;
const TEXT_SECONDARY = T.text2;
const SUCCESS = T.ok;
const ERROR = T.err;
const GOLD = T.warn;
const WARNING = T.warn;

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return "Masked";
  return `\u2022\u2022\u2022\u2022 ${digits.slice(-4)}`;
}

const STATUS_CONFIG = {
  requested: {
    bg: `${WARNING}20`,
    text: WARNING,
    Icon: Clock,
    label: "Searching",
  },
  negotiating: {
    bg: `${GOLD}20`,
    text: GOLD,
    Icon: Clock,
    label: "Negotiating",
  },
  accepted: { bg: `${PRIMARY}20`, text: PRIMARY, Icon: AutoRideIcon, label: "Accepted" },
  completed: {
    bg: `${SUCCESS}20`,
    text: SUCCESS,
    Icon: CheckCircle2,
    label: "Completed",
  },
  cancelled: {
    bg: `${ERROR}20`,
    text: ERROR,
    Icon: XCircle,
    label: "Cancelled",
  },
};

function formatCancellationReason(reason) {
  if (!reason) return null;
  return String(reason)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function RideRow({ ride, onCancel, isCancelling }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[ride.status] || STATUS_CONFIG.requested;
  const { Icon } = config;
  const date = new Date(ride.created_at);

  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor:
          ride.status === "completed"
            ? `${SUCCESS}40`
            : ride.status === "cancelled"
              ? `${ERROR}20`
              : BORDER,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ padding: 14 }}
        activeOpacity={0.8}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: config.bg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon size={ICON.sm} color={config.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>
                Ride #{ride.id}
              </Text>
              <Text
                style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}
              >
                {date.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                {"\u00B7"}{" "}
                {date.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 99,
                backgroundColor: config.bg,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: config.text,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {config.label}
              </Text>
            </View>
            <ChevronDown
              size={ICON.xs}
              color={TEXT_SECONDARY}
              style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: BORDER,
            padding: 14,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center", paddingTop: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: PRIMARY,
                }}
              />
              <View
                style={{
                  width: 1.5,
                  height: 24,
                  backgroundColor: BORDER,
                  marginVertical: 3,
                }}
              />
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: TEXT,
                }}
              />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text
                style={{ fontSize: 13, color: TEXT, fontWeight: "500" }}
                numberOfLines={1}
              >
                {ride.pickup_address}
              </Text>
              <Text
                style={{ fontSize: 13, color: TEXT, fontWeight: "500" }}
                numberOfLines={1}
              >
                {ride.dest_address}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 6 }}>
            {ride.passenger_phone && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 80,
                  }}
                >
                  Passenger
                </Text>
                <Text style={{ fontSize: 12, color: TEXT }}>
                  {maskPhone(ride.passenger_phone)}
                </Text>
              </View>
            )}
            {ride.vehicle_number && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 80,
                  }}
                >
                  Driver
                </Text>
                <Text style={{ fontSize: 12, color: TEXT }}>
                  {ride.vehicle_number} - {getVehicleLabel(ride.vehicle_type)}{" "}
                  {ride.driver_phone ? `· ${maskPhone(ride.driver_phone)}` : ""}
                </Text>
              </View>
            )}
            {(ride.estimated_fare || ride.driver_rating || ride.distance_km) && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginTop: 6,
                  alignItems: "center",
                }}
              >
                {ride.estimated_fare && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      fontWeight: "600",
                    }}
                  >
                    {"\u20B9"}{Math.round(ride.estimated_fare)}
                  </Text>
                )}
                {ride.distance_km && (
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                    {ride.distance_km} km
                  </Text>
                )}
                {ride.driver_rating && (
                  <Text
                    style={{ fontSize: 12, color: GOLD, fontWeight: "700" }}
                  >
                    {"\u2605"} {ride.driver_rating}/5
                  </Text>
                )}
              </View>
            )}
            {ride.accepted_at && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 80,
                  }}
                >
                  Accepted
                </Text>
                <Text style={{ fontSize: 12, color: TEXT }}>
                  {new Date(ride.accepted_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
            {ride.completed_at && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 80,
                  }}
                >
                  Completed
                </Text>
                <Text style={{ fontSize: 12, color: SUCCESS }}>
                  {new Date(ride.completed_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
            {ride.status === "cancelled" && ride.cancellation_reason && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 80,
                  }}
                >
                  Reason
                </Text>
                <Text style={{ fontSize: 12, color: ERROR, flex: 1 }}>
                  {formatCancellationReason(ride.cancellation_reason)}
                </Text>
              </View>
            )}
          </View>
          {(ride.status === "requested" || ride.status === "accepted") && (
            <TouchableOpacity
              onPress={() => onCancel(ride.id)}
              disabled={isCancelling}
              style={{
                marginTop: 12,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: `${ERROR}20`,
                borderWidth: 1,
                borderColor: `${ERROR}40`,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: ERROR, fontSize: 12, fontWeight: "700" }}>
                {isCancelling ? "Cancelling..." : "Cancel Stuck Ride"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminRides() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminRides", filter, sort, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: filter,
        sort,
        search,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/rides?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchText.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const cancelRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch("/api/admin/rides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_id: rideId,
          action: "cancel",
          reason: "admin_stuck_ride_cancelled",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to cancel ride");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRides"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      Alert.alert("Ride Cancelled", "The stuck ride has been cancelled.");
    },
    onError: (err) => Alert.alert("Cancel Failed", err.message),
  });

  const rides = data?.rides || [];
  const counts = data?.counts || {};
  const pagination = data?.pagination || {
    page: 1,
    total: 0,
    totalPages: 1,
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: BG,
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
          All Rides
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          {counts.all || 0} total rides · updates every 15s
        </Text>

        <View
          style={{
            alignItems: "center",
            backgroundColor: SURFACE,
            borderColor: BORDER,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: "row",
            gap: 8,
            marginTop: 14,
            paddingHorizontal: 12,
          }}
        >
          <Search size={ICON.sm} color={TEXT_SECONDARY} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search ride, route, vehicle or phone"
            placeholderTextColor={TEXT_SECONDARY}
            style={{ color: TEXT, flex: 1, fontSize: 13, paddingVertical: 11 }}
          />
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {["all", "requested", "negotiating", "accepted", "completed", "cancelled"].map(
            (f) => {
              const colors = {
                all: TEXT_SECONDARY,
                requested: WARNING,
                negotiating: GOLD,
                accepted: PRIMARY,
                completed: SUCCESS,
                cancelled: ERROR,
              };
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 99,
                    backgroundColor:
                      filter === f
                        ? f === "all"
                          ? SURFACE
                          : `${colors[f]}20`
                        : SURFACE,
                    borderWidth: 1,
                    borderColor:
                      filter === f
                        ? f === "all"
                          ? TEXT_SECONDARY
                          : colors[f]
                        : BORDER,
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color:
                        filter === f
                          ? f === "all"
                            ? TEXT
                            : colors[f]
                          : TEXT_SECONDARY,
                      textTransform: "capitalize",
                    }}
                  >
                    {f} ({counts[f]})
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["fare_high", "Fare: High"],
            ["fare_low", "Fare: Low"],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => {
                setSort(value);
                setPage(1);
              }}
              style={{
                backgroundColor: sort === value ? `${PRIMARY}20` : SURFACE,
                borderColor: sort === value ? PRIMARY : BORDER,
                borderRadius: 9,
                borderWidth: 1,
                paddingHorizontal: 11,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: sort === value ? PRIMARY : TEXT_SECONDARY,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlashList
          data={rides}
          estimatedItemSize={250}
          keyExtractor={(ride) => String(ride.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 40 }}>??</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: TEXT,
                  marginTop: 12,
                }}
              >
                No rides found
              </Text>
              <Text
                style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 6 }}
              >
                {filter === "all"
                  ? search
                    ? "Try a different search"
                    : "Ride activity will appear here"
                  : `No ${filter} rides`}
              </Text>
            </View>
          }
          ListFooterComponent={
            pagination.total > 0 ? (
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingVertical: 12,
                }}
              >
                <TouchableOpacity
                  disabled={page <= 1}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  style={{
                    alignItems: "center",
                    backgroundColor: SURFACE,
                    borderColor: BORDER,
                    borderRadius: 10,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 5,
                    opacity: page <= 1 ? 0.4 : 1,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                  }}
                >
                  <ChevronLeft size={ICON.xs} color={TEXT} />
                  <Text style={{ color: TEXT, fontSize: 12, fontWeight: "700" }}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                    Page {pagination.page} of {pagination.totalPages}
                  </Text>
                  <Text style={{ color: TEXT_SECONDARY, fontSize: 10, marginTop: 2 }}>
                    {pagination.total} matching rides
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={page >= pagination.totalPages}
                  onPress={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                  style={{
                    alignItems: "center",
                    backgroundColor: SURFACE,
                    borderColor: BORDER,
                    borderRadius: 10,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 5,
                    opacity: page >= pagination.totalPages ? 0.4 : 1,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                  }}
                >
                  <Text style={{ color: TEXT, fontSize: 12, fontWeight: "700" }}>
                    Next
                  </Text>
                  <ChevronRight size={ICON.xs} color={TEXT} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <RideRow
              ride={item}
              onCancel={(rideId) =>
                Alert.alert(
                  "Cancel stuck ride?",
                  "This will close the ride and write an admin audit log entry.",
                  [
                    { text: "Keep Ride", style: "cancel" },
                    {
                      text: "Cancel Ride",
                      style: "destructive",
                      onPress: () => cancelRide.mutate(rideId),
                    },
                  ],
                )
              }
              isCancelling={cancelRide.isPending}
            />
          )}
        />
      )}
    </View>
  );
}

