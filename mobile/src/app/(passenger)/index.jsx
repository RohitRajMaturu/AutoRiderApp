import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Navigation2,
  ArrowRight,
  X,
  Phone,
  CheckCircle2,
  Clock3,
  Car,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

const PRIMARY = "#F97316";
const PRIMARY_LIGHT = "#FFF7ED";
const PRIMARY_BORDER = "#FED7AA";
const BG = "#FFFBF5";
const SURFACE = "#FFFFFF";
const BORDER = "#E7E5E4";
const TEXT = "#1C1917";
const TEXT_SECONDARY = "#78716C";
const TEXT_MUTED = "#A8A29E";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";

function StatusBadge({ status }) {
  const configs = {
    requested: { bg: "#FEF3C7", text: "#D97706", label: "Finding Driver" },
    accepted: { bg: SUCCESS_LIGHT, text: SUCCESS, label: "Accepted" },
    completed: { bg: "#DBEAFE", text: "#2563EB", label: "Completed" },
    cancelled: { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" },
  };
  const c = configs[status] || configs.requested;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 99,
        backgroundColor: c.bg,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: c.text,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {c.label}
      </Text>
    </View>
  );
}

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const { data: activeRide, isLoading: rideLoading } = useQuery({
    queryKey: ["activeRide"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      const data = await res.json();
      const ride =
        data.rides?.find(
          (r) => r.status === "requested" || r.status === "accepted",
        ) || null;
      if (ride?.status === "requested") startPulse();
      return ride;
    },
    refetchInterval: 5000,
  });

  const requestRide = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: pickup,
          dest_address: destination,
          pickup_lat: 12.9716,
          pickup_lng: 77.5946,
          dest_lat: 12.9352,
          dest_lng: 77.6245,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to request ride");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["activeRide"]);
      setPickup("");
      setDestination("");
    },
    onError: (err) => Alert.alert("Request Failed", err.message),
  });

  const cancelRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      pulseAnim.stopAnimation();
      queryClient.invalidateQueries(["activeRide"]);
    },
    onError: () => Alert.alert("Error", "Could not cancel the ride"),
  });

  if (rideLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: BG,
        }}
      >
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

      {/* Header */}
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: TEXT,
                letterSpacing: -0.5,
              }}
            >
              🛺 Where to?
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
              Book your auto in seconds
            </Text>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: PRIMARY_LIGHT,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>🛺</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Ride Card */}
        {activeRide ? (
          <View style={{ margin: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 18,
                borderWidth: 1,
                borderColor:
                  activeRide.status === "accepted" ? PRIMARY_BORDER : BORDER,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              {/* Status header */}
              <View
                style={{
                  backgroundColor:
                    activeRide.status === "accepted"
                      ? PRIMARY_LIGHT
                      : "#FFFBEB",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor:
                    activeRide.status === "accepted"
                      ? PRIMARY_BORDER
                      : "#FDE68A",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {activeRide.status === "requested" ? (
                    <Animated.View
                      style={{ transform: [{ scale: pulseAnim }] }}
                    >
                      <Clock3 size={20} color="#D97706" />
                    </Animated.View>
                  ) : (
                    <CheckCircle2 size={20} color={PRIMARY} />
                  )}
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: TEXT }}
                  >
                    {activeRide.status === "requested"
                      ? "Searching for drivers..."
                      : "Driver is on the way!"}
                  </Text>
                </View>
                <StatusBadge status={activeRide.status} />
              </View>

              {/* Route info */}
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View style={{ alignItems: "center", paddingTop: 4 }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: PRIMARY,
                      }}
                    />
                    <View
                      style={{
                        width: 2,
                        height: 30,
                        backgroundColor: BORDER,
                        marginVertical: 4,
                      }}
                    />
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: TEXT,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 12 }}>
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: TEXT_MUTED,
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        From
                      </Text>
                      <Text
                        style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                        numberOfLines={1}
                      >
                        {activeRide.pickup_address}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: TEXT_MUTED,
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        To
                      </Text>
                      <Text
                        style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                        numberOfLines={1}
                      >
                        {activeRide.dest_address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Driver card if accepted */}
                {activeRide.status === "accepted" &&
                  activeRide.vehicle_number && (
                    <View
                      style={{
                        marginTop: 16,
                        backgroundColor: PRIMARY_LIGHT,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: PRIMARY_BORDER,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: PRIMARY,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Car size={22} color="#fff" />
                        </View>
                        <View>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: TEXT,
                            }}
                          >
                            {activeRide.vehicle_number}
                          </Text>
                          <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                            Your driver
                          </Text>
                        </View>
                      </View>
                      {activeRide.driver_phone && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${activeRide.driver_phone}`)
                          }
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: SUCCESS,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Phone size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                {/* Cancel */}
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      "Cancel Ride?",
                      "Are you sure you want to cancel?",
                      [
                        { text: "No", style: "cancel" },
                        {
                          text: "Yes, Cancel",
                          style: "destructive",
                          onPress: () => cancelRide.mutate(activeRide.id),
                        },
                      ],
                    );
                  }}
                  disabled={cancelRide.isPending}
                  style={{
                    marginTop: 16,
                    alignItems: "center",
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {cancelRide.isPending
                      ? "Cancelling..."
                      : "✕  Cancel Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* Ride Request Form */
          <View style={{ margin: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: BORDER,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 3,
                overflow: "hidden",
              }}
            >
              {/* Pickup */}
              <View
                style={{
                  padding: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F5F5F4",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: PRIMARY_LIGHT,
                      borderWidth: 1.5,
                      borderColor: PRIMARY_BORDER,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <MapPin size={18} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 4,
                      }}
                    >
                      Pickup Location
                    </Text>
                    <TextInput
                      placeholder="Enter your pickup address"
                      placeholderTextColor={TEXT_MUTED}
                      value={pickup}
                      onChangeText={setPickup}
                      style={{ fontSize: 15, color: TEXT, fontWeight: "500" }}
                    />
                  </View>
                  {pickup.length > 0 && (
                    <TouchableOpacity onPress={() => setPickup("")}>
                      <X size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Divider line */}
              <View
                style={{
                  marginLeft: 56,
                  height: 1,
                  backgroundColor: "#F5F5F4",
                }}
              />

              {/* Destination */}
              <View style={{ padding: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: "#F5F5F4",
                      borderWidth: 1.5,
                      borderColor: BORDER,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Navigation2 size={18} color={TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 4,
                      }}
                    >
                      Destination
                    </Text>
                    <TextInput
                      placeholder="Where are you going?"
                      placeholderTextColor={TEXT_MUTED}
                      value={destination}
                      onChangeText={setDestination}
                      style={{ fontSize: 15, color: TEXT, fontWeight: "500" }}
                    />
                  </View>
                  {destination.length > 0 && (
                    <TouchableOpacity onPress={() => setDestination("")}>
                      <X size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => requestRide.mutate()}
              disabled={
                !pickup.trim() || !destination.trim() || requestRide.isPending
              }
              style={{
                marginTop: 16,
                backgroundColor:
                  !pickup.trim() || !destination.trim() ? "#D4C4BB" : PRIMARY,
                borderRadius: 14,
                paddingVertical: 17,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                shadowColor: PRIMARY,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: !pickup.trim() || !destination.trim() ? 0 : 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
              activeOpacity={0.85}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                }}
              >
                {requestRide.isPending ? "Requesting..." : "🛺  Request Auto"}
              </Text>
              {!requestRide.isPending && <ArrowRight size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}

        {/* Info strip */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#BBF7D0",
              padding: 14,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 18 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: SUCCESS,
                  marginBottom: 3,
                }}
              >
                Safety First
              </Text>
              <Text style={{ fontSize: 12, color: "#166534", lineHeight: 18 }}>
                Always verify the vehicle number and driver details before
                boarding. Trust your gut.
              </Text>
            </View>
          </View>
        </View>

        {/* Quick tip */}
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 10,
            }}
          >
            💡 Tips
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              {
                icon: "📍",
                title: "Be Specific",
                desc: "Add landmark to help driver find you",
              },
              {
                icon: "⏱️",
                title: "Be Ready",
                desc: "Wait at your pickup point on confirmation",
              },
            ].map((tip, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 6 }}>
                  {tip.icon}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: TEXT,
                    marginBottom: 4,
                  }}
                >
                  {tip.title}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: TEXT_SECONDARY,
                    lineHeight: 16,
                  }}
                >
                  {tip.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}
