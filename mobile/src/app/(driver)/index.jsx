import React, { useEffect, useRef, useState } from "react";
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
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Phone,
  Clock,
  Car,
  CheckCircle2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

const PRIMARY = "#F97316";
const PRIMARY_DARK = "#EA580C";
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
const DARK = "#1C1917";

function formatCancellationReason(reason) {
  if (!reason) return "Ride was cancelled.";
  return String(reason)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ─── Registration Form ────────────────────────────────────────────────────────
function RegistrationScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [vehicle, setVehicle] = useState("");
  const [autoPhotoUrl, setAutoPhotoUrl] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [step, setStep] = useState(1);

  const registerDriver = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_number: vehicle.toUpperCase().trim(),
          auto_photo_url: autoPhotoUrl,
          license_url: licenseUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driverMe"] }),
    onError: (err) => Alert.alert("Registration Failed", err.message),
  });

  const steps = [
    { num: 1, label: "Vehicle" },
    { num: 2, label: "Documents" },
    { num: 3, label: "Submit" },
  ];

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: TEXT,
            letterSpacing: -0.5,
          }}
        >
          🛺 Driver Registration
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 }}>
          Start earning by registering your auto
        </Text>
        <View style={{ flexDirection: "row", marginTop: 20, gap: 8 }}>
          {steps.map((s) => (
            <View key={s.num} style={{ flex: 1 }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: s.num <= step ? PRIMARY : "#E7E5E4",
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  fontWeight: "600",
                  color: s.num <= step ? PRIMARY : TEXT_MUTED,
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <View style={{ gap: 20 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 16,
                }}
              >
                Vehicle Information
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: TEXT_SECONDARY,
                  marginBottom: 8,
                }}
              >
                Vehicle Registration Number *
              </Text>
              <TextInput
                placeholder="e.g. KA 01 AB 1234"
                placeholderTextColor={TEXT_MUTED}
                value={vehicle}
                onChangeText={setVehicle}
                autoCapitalize="characters"
                style={{
                  backgroundColor: "#F5F5F4",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  fontWeight: "600",
                  color: TEXT,
                  borderWidth: 1,
                  borderColor: vehicle ? PRIMARY_BORDER : BORDER,
                }}
              />
            </View>
            <View
              style={{
                backgroundColor: PRIMARY_LIGHT,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: PRIMARY_BORDER,
                padding: 16,
                flexDirection: "row",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 20 }}>ℹ️</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#9A3412",
                  lineHeight: 20,
                }}
              >
                Make sure your vehicle number matches your RC book exactly.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setStep(2)}
              disabled={!vehicle.trim()}
              style={{
                backgroundColor: !vehicle.trim() ? "#D4C4BB" : PRIMARY,
                borderRadius: 14,
                paddingVertical: 17,
                alignItems: "center",
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Next →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 20,
                gap: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Upload Documents
              </Text>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    marginBottom: 8,
                  }}
                >
                  Auto Photo URL
                </Text>
                <TextInput
                  placeholder="https://link-to-auto-photo.jpg"
                  placeholderTextColor={TEXT_MUTED}
                  value={autoPhotoUrl}
                  onChangeText={setAutoPhotoUrl}
                  style={{
                    backgroundColor: "#F5F5F4",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 14,
                    color: TEXT,
                    borderWidth: 1,
                    borderColor: autoPhotoUrl ? PRIMARY_BORDER : BORDER,
                  }}
                />
                <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
                  Share a photo link of your auto-rickshaw
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    marginBottom: 8,
                  }}
                >
                  License / Permit URL *
                </Text>
                <TextInput
                  placeholder="https://link-to-license.pdf"
                  placeholderTextColor={TEXT_MUTED}
                  value={licenseUrl}
                  onChangeText={setLicenseUrl}
                  style={{
                    backgroundColor: "#F5F5F4",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 14,
                    color: TEXT,
                    borderWidth: 1,
                    borderColor: licenseUrl ? PRIMARY_BORDER : BORDER,
                  }}
                />
                <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
                  Driving license or auto permit document link
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  paddingVertical: 17,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              >
                <Text
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  ← Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                disabled={!licenseUrl.trim()}
                style={{
                  flex: 2,
                  backgroundColor: !licenseUrl.trim() ? "#D4C4BB" : PRIMARY,
                  borderRadius: 14,
                  paddingVertical: 17,
                  alignItems: "center",
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  Next →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  padding: 14,
                  backgroundColor: PRIMARY_LIGHT,
                  borderBottomWidth: 1,
                  borderBottomColor: PRIMARY_BORDER,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: PRIMARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Review Details
                </Text>
              </View>
              {[
                { label: "Vehicle Number", value: vehicle.toUpperCase() },
                { label: "Auto Photo", value: autoPhotoUrl || "Not provided" },
                { label: "License URL", value: licenseUrl },
              ].map((item, i) => (
                <View
                  key={i}
                  style={{
                    padding: 16,
                    borderBottomWidth: i < 2 ? 1 : 0,
                    borderBottomColor: "#F5F5F4",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: TEXT_MUTED,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: "500", color: TEXT }}
                    numberOfLines={1}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: SUCCESS_LIGHT,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#BBF7D0",
                padding: 16,
                flexDirection: "row",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 20 }}>✅</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#166534",
                  lineHeight: 20,
                }}
              >
                Your application will be reviewed by our admin team. You'll
                start accepting rides once approved.
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setStep(2)}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  paddingVertical: 17,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              >
                <Text
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  ← Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => registerDriver.mutate()}
                disabled={registerDriver.isPending}
                style={{
                  flex: 2,
                  backgroundColor: PRIMARY,
                  borderRadius: 14,
                  paddingVertical: 17,
                  alignItems: "center",
                  shadowColor: PRIMARY,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  {registerDriver.isPending
                    ? "Submitting..."
                    : "Submit Application 🚀"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}

// ─── Pending Screen ───────────────────────────────────────────────────────────
function PendingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BG,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        paddingTop: insets.top,
      }}
    >
      <StatusBar style="dark" />
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: "#FEF3C7",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Clock size={48} color="#D97706" strokeWidth={1.5} />
      </View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "800",
          color: TEXT,
          textAlign: "center",
          letterSpacing: -0.5,
        }}
      >
        Application Under Review
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: TEXT_SECONDARY,
          textAlign: "center",
          marginTop: 12,
          lineHeight: 24,
        }}
      >
        Our team is reviewing your documents.{"\n"}You'll be notified once
        approved.
      </Text>
      <View style={{ marginTop: 32, width: "100%", gap: 12 }}>
        {[
          { emoji: "📋", text: "Documents submitted successfully" },
          { emoji: "🔍", text: "Admin review in progress (24-48 hrs)" },
          { emoji: "✅", text: "Approval notification via app" },
        ].map((s, i) => (
          <View
            key={i}
            style={{
              backgroundColor: SURFACE,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECONDARY, flex: 1 }}>
              {s.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Ride Request Card ────────────────────────────────────────────────────────
function RideRequestCard({ ride, onAccept, isAccepting }) {
  const timeAgo = () => {
    const diff = Math.floor((Date.now() - new Date(ride.created_at)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };
  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#F5F5F4",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#22C55E",
            }}
          />
          <Text style={{ fontSize: 12, fontWeight: "600", color: SUCCESS }}>
            New Request
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: TEXT_MUTED }}>{timeAgo()}</Text>
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
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
                width: 1.5,
                height: 26,
                backgroundColor: BORDER,
                marginVertical: 3,
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
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 2,
                }}
              >
                Pickup
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                numberOfLines={1}
              >
                {ride.pickup_address}
              </Text>
            </View>
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 2,
                }}
              >
                Drop
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                numberOfLines={1}
              >
                {ride.dest_address}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onAccept(ride.id)}
          disabled={isAccepting}
          style={{
            marginTop: 14,
            backgroundColor: PRIMARY,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
          }}
          activeOpacity={0.85}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {isAccepting ? "Accepting..." : "✅ Accept Ride"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Active Ride Card ─────────────────────────────────────────────────────────
function ActiveRideCard({ ride, onComplete, isCompleting }) {
  return (
    <View
      style={{
        backgroundColor: DARK,
        borderRadius: 18,
        marginBottom: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      <View style={{ padding: 20 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: "#A8A29E",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Active Ride
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#FFFFFF",
                marginTop: 4,
                letterSpacing: -0.5,
              }}
            >
              Passenger Waiting 🛺
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 99,
              backgroundColor: "#22C55E",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
              LIVE
            </Text>
          </View>
        </View>
        <View style={{ gap: 12, marginBottom: 20 }}>
          <View
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#FFFFFF15",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <MapPin size={16} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#78716C",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Pickup
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#fff",
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {ride.pickup_address}
              </Text>
            </View>
          </View>
          <View
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: "#FFFFFF15",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <MapPin size={16} color="#A8A29E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#78716C",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Drop-off
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#fff",
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {ride.dest_address}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {ride.passenger_phone && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${ride.passenger_phone}`)}
              style={{
                flex: 1,
                backgroundColor: SUCCESS,
                borderRadius: 12,
                paddingVertical: 14,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
              activeOpacity={0.85}
            >
              <Phone size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                Call
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Complete Ride?", "Mark this ride as completed?", [
                { text: "Cancel", style: "cancel" },
                { text: "Complete", onPress: () => onComplete(ride.id) },
              ]);
            }}
            disabled={isCompleting}
            style={{
              flex: 2,
              backgroundColor: PRIMARY,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              {isCompleting ? "Completing..." : "✓ Complete Ride"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Driver Home ─────────────────────────────────────────────────────────
export default function DriverHome() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const notifiedCancelledRideIds = useRef(new Set());

  const { data: driverData, isLoading: driverLoading } = useQuery({
    queryKey: ["driverMe"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      return res.json();
    },
  });

  const {
    data: ridesData,
    refetch: refetchRides,
    isRefetching,
  } = useQuery({
    queryKey: ["driverRides"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      return res.json();
    },
    enabled:
      !!driverData?.driver?.is_approved && !!driverData?.driver?.is_online,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  useEffect(() => {
    const cancelledRide = (ridesData?.rides || []).find(
      (ride) =>
        ride.status === "cancelled" &&
        ride.driver_id &&
        !notifiedCancelledRideIds.current.has(ride.id),
    );
    if (!cancelledRide) return;
    notifiedCancelledRideIds.current.add(cancelledRide.id);
    Alert.alert(
      "Ride Cancelled",
      formatCancellationReason(cancelledRide.cancellation_reason),
    );
  }, [ridesData?.rides]);

  const toggleStatus = useMutation({
    mutationFn: async (online) => {
      let coords = null;
      if (online) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          throw new Error("LOCATION_PERMISSION_REQUIRED");
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }

      const res = await fetch("/api/drivers/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: online, ...coords }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.code || error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driverMe"] }),
    onError: (err) => {
      if (
        err.message === "SUBSCRIPTION_EXPIRED" ||
        err.message.includes("subscription")
      ) {
        Alert.alert(
          "Subscription Required",
          "Please renew your subscription to go online.",
        );
      } else if (err.message === "LOCATION_PERMISSION_REQUIRED") {
        Alert.alert(
          "Location Required",
          "Allow location access so Auto Ride can place you inside a service zone.",
        );
      } else if (err.message === "NO_SERVICE_ZONE") {
        Alert.alert(
          "Outside Service Zone",
          "Your current location is not inside any active service zone.",
        );
      } else {
        Alert.alert("Error", err.message);
      }
    },
  });

  const acceptRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to accept ride");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driverRides"] });
      Alert.alert("🎉 Ride Accepted!", "Head to the pickup location now!");
    },
    onError: (err) => Alert.alert("Accept Failed", err.message),
  });

  const completeRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driverRides"] });
      Alert.alert("✅ Ride Completed!", "Great work! Keep earning!");
    },
  });

  if (driverLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: BG,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const driver = driverData?.driver;
  if (!driver) return <RegistrationScreen />;
  if (!driver.is_approved) return <PendingScreen />;

  const rides = ridesData?.rides || [];
  const activeRide = rides.find((r) => r.status === "accepted");
  const availableRides = rides.filter(
    (r) => r.status === "requested" && !r.driver_id,
  );
  const expiryDate = driver.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isExpired = !expiryDate || expiryDate < new Date();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
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
              🛺 Dashboard
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
              {driver.vehicle_number} ·{" "}
              {driver.is_online ? "You're Online" : "You're Offline"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!driver.is_online && isExpired) {
                Alert.alert(
                  "Subscription Required",
                  "Renew your subscription in the Subscription tab to go online.",
                );
                return;
              }
              toggleStatus.mutate(!driver.is_online);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 99,
              backgroundColor: driver.is_online ? SUCCESS_LIGHT : "#F5F5F4",
              borderWidth: 1.5,
              borderColor: driver.is_online ? "#BBF7D0" : BORDER,
            }}
            activeOpacity={0.8}
          >
            {driver.is_online ? (
              <Wifi size={16} color={SUCCESS} />
            ) : (
              <WifiOff size={16} color={TEXT_MUTED} />
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: driver.is_online ? SUCCESS : TEXT_SECONDARY,
              }}
            >
              {toggleStatus.isPending
                ? "..."
                : driver.is_online
                  ? "Online"
                  : "Offline"}
            </Text>
          </TouchableOpacity>
        </View>

        {isExpired && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: "#FEF3C7",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#FDE68A",
              padding: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text
              style={{
                fontSize: 12,
                color: "#92400E",
                flex: 1,
                fontWeight: "600",
              }}
            >
              Subscription expired — go to Subscription tab to renew
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchRides}
            tintColor={PRIMARY}
          />
        }
      >
        {activeRide && (
          <ActiveRideCard
            ride={activeRide}
            onComplete={(id) => completeRide.mutate(id)}
            isCompleting={completeRide.isPending}
          />
        )}

        {!driver.is_online ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🛺</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: TEXT,
                textAlign: "center",
              }}
            >
              You're currently offline
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: TEXT_SECONDARY,
                textAlign: "center",
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Toggle online to start{"\n"}receiving ride requests
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 28, fontWeight: "800", color: PRIMARY }}
                >
                  {availableRides.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: TEXT_MUTED,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Available
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 28, fontWeight: "800", color: SUCCESS }}
                >
                  {activeRide ? 1 : 0}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: TEXT_MUTED,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Active
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: TEXT,
                marginBottom: 12,
              }}
            >
              Nearby Requests ({availableRides.length})
            </Text>

            {availableRides.length === 0 ? (
              <View
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 32,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>
                  No requests yet
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: TEXT_SECONDARY,
                    textAlign: "center",
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  Ride requests from nearby passengers{"\n"}will appear here
                  automatically
                </Text>
              </View>
            ) : (
              availableRides.map((ride) => (
                <RideRequestCard
                  key={ride.id}
                  ride={ride}
                  onAccept={(id) => acceptRide.mutate(id)}
                  isAccepting={acceptRide.isPending}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
