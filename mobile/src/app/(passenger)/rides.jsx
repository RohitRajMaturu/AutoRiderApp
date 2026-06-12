import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, Car } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";

const PRIMARY = "#F97316";
const BG = "#FFFBF5";
const SURFACE = "#FFFFFF";
const BORDER = "#E7E5E4";
const TEXT = "#1C1917";
const TEXT_SECONDARY = "#78716C";
const TEXT_MUTED = "#A8A29E";
const SUCCESS = "#16A34A";

const STATUS_CONFIG = {
  requested: {
    bg: "#FEF3C7",
    text: "#D97706",
    Icon: Clock,
    label: "Searching",
  },
  accepted: { bg: "#FFF7ED", text: PRIMARY, Icon: Car, label: "Accepted" },
  completed: {
    bg: "#DCFCE7",
    text: SUCCESS,
    Icon: CheckCircle2,
    label: "Completed",
  },
  cancelled: {
    bg: "#FEE2E2",
    text: "#DC2626",
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

function RideCard({ ride }) {
  const config = STATUS_CONFIG[ride.status] || STATUS_CONFIG.requested;
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

  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#F5F5F4",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>
              Ride #{ride.id}
            </Text>
            <Text style={{ fontSize: 11, color: TEXT_MUTED }}>
              {formattedDate} · {formattedTime}
            </Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 99,
            backgroundColor: config.bg,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: config.text,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {config.label}
          </Text>
        </View>
      </View>

      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", paddingTop: 5 }}>
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
                height: 22,
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
              style={{ fontSize: 13, fontWeight: "500", color: TEXT }}
              numberOfLines={1}
            >
              {ride.pickup_address}
            </Text>
            <Text
              style={{ fontSize: 13, fontWeight: "500", color: TEXT }}
              numberOfLines={1}
            >
              {ride.dest_address}
            </Text>
          </View>
        </View>
        {ride.vehicle_number && (
          <View
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: "#F5F5F4",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Car size={13} color={TEXT_MUTED} />
            <Text
              style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: "500" }}
            >
              {ride.vehicle_number}
            </Text>
          </View>
        )}
        {ride.status === "cancelled" && ride.cancellation_reason && (
          <View
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: "#F5F5F4",
            }}
          >
            <Text style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: "700" }}>
              Cancellation reason
            </Text>
            <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600", marginTop: 3 }}>
              {formatCancellationReason(ride.cancellation_reason)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PassengerRides() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["passengerRides"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const rides = data?.rides || [];
  const activeRides = rides.filter(
    (r) => r.status === "requested" || r.status === "accepted",
  );
  const pastRides = rides.filter(
    (r) => r.status === "completed" || r.status === "cancelled",
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: SURFACE,
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
          My Rides
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          {rides.length} trip{rides.length !== 1 ? "s" : ""} total
        </Text>
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
          {rides.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>🛺</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: TEXT }}>
                No rides yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                  marginTop: 8,
                  lineHeight: 20,
                }}
              >
                Your trip history{"\n"}will appear here
              </Text>
            </View>
          ) : (
            <>
              {activeRides.length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: PRIMARY,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10,
                    }}
                  >
                    Active
                  </Text>
                  {activeRides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </>
              )}
              {pastRides.length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: TEXT_MUTED,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10,
                      marginTop: activeRides.length > 0 ? 16 : 0,
                    }}
                  >
                    History
                  </Text>
                  {pastRides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
