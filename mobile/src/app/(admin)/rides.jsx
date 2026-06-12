import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Car,
  ChevronDown,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";

const PRIMARY = "#F97316";
const BG = "#1C1917";
const SURFACE = "#292524";
const BORDER = "#44403C";
const TEXT = "#FAFAF9";
const TEXT_SECONDARY = "#A8A29E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const WARNING = "#D97706";

const STATUS_CONFIG = {
  requested: {
    bg: `${WARNING}20`,
    text: WARNING,
    Icon: Clock,
    label: "Searching",
  },
  accepted: { bg: `${PRIMARY}20`, text: PRIMARY, Icon: Car, label: "Accepted" },
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
              <Icon size={18} color={config.text} strokeWidth={2} />
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
                ·{" "}
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
              size={14}
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
                  {ride.passenger_phone}
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
                  {ride.vehicle_number}{" "}
                  {ride.driver_phone ? `· ${ride.driver_phone}` : ""}
                </Text>
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

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminRides"],
    queryFn: async () => {
      const res = await fetch("/api/admin/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    refetchInterval: 15000,
  });

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

  const allRides = data?.rides || [];
  const filtered =
    filter === "all" ? allRides : allRides.filter((r) => r.status === filter);

  const counts = {
    all: allRides.length,
    requested: allRides.filter((r) => r.status === "requested").length,
    accepted: allRides.filter((r) => r.status === "accepted").length,
    completed: allRides.filter((r) => r.status === "completed").length,
    cancelled: allRides.filter((r) => r.status === "cancelled").length,
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
          {allRides.length} total rides · updates every 15s
        </Text>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {["all", "requested", "accepted", "completed", "cancelled"].map(
            (f) => {
              const colors = {
                all: TEXT_SECONDARY,
                requested: WARNING,
                accepted: PRIMARY,
                completed: SUCCESS,
                cancelled: ERROR,
              };
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
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
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PRIMARY}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 40 }}>🛺</Text>
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
                  ? "Ride activity will appear here"
                  : `No ${filter} rides`}
              </Text>
            </View>
          ) : (
            filtered.map((ride) => (
              <RideRow
                key={ride.id}
                ride={ride}
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
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
