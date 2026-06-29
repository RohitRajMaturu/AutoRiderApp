import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  Image as RNImage,
  Modal,
  Pressable,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  MapPin,
  Navigation,
  Phone,
  Clock,
  FileText,
  Wifi,
  WifiOff,
  Camera,
  Image as ImageIcon,
  IndianRupee,
  Star,
} from "lucide-react-native";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { toast } from "sonner-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import ChatDrawer from "@/components/ChatDrawer";
import { Button } from "@/components/ui";
import { MotionPressable } from "@/components/motion";
import { useAuth } from "@/utils/auth/useAuth";
import { ICON } from "@/theme/iconScale";
import { createRidePusher } from "@/utils/pusher";
import { useLanguage } from "@/i18n/LanguageContext";
import { addInAppNotification, notificationOwnerKey } from "@/store/useNotificationStore";

const TUKTUKGO_ICON = require("../../../assets/images/icon.png");
const RIDE_REQUEST_CHIME = require("../../../assets/sounds/ride-request.wav");
const PRIMARY = "#43B8B3";
const PRIMARY_DARK = "#339E9A";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";
const DARK = "#17272B";
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "#";

function openGoogleMaps(destLat, destLng, destLabel) {
  const label = encodeURIComponent(destLabel || "Destination");
  const url = Platform.select({
    ios: `maps://?daddr=${destLat},${destLng}&dirflg=d`,
    android: `google.navigation:q=${destLat},${destLng}&mode=d`,
  });
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_id=${label}&travelmode=driving`;
  Linking.canOpenURL(url).then((supported) => {
    Linking.openURL(supported ? url : fallback);
  });
}

function formatCancellationReason(reason) {
  if (!reason) return "Ride was cancelled.";
  return String(reason)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value) {
  const amount = Number(value);
  return `Rs. ${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
}

function rideFare(ride) {
  return ride?.final_fare ?? ride?.estimated_fare ?? 0;
}

function pickPrimaryActiveRide(rides) {
  const accepted = (rides || []).filter((ride) => ride.status === "accepted");
  const started = accepted
    .filter((ride) => ride.started_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  if (started.length > 0) return started[0];
  return accepted.sort(
    (a, b) => new Date(a.accepted_at || a.created_at).getTime() - new Date(b.accepted_at || b.created_at).getTime(),
  )[0] || null;
}

async function readApiError(response, fallback) {
  const error = await response.json().catch(() => ({}));
  const message = error.error || fallback;
  const apiError = new Error(message);
  apiError.code = error.code || message;
  apiError.status = response.status;
  throw apiError;
}

function showDriverNotice(title, description) {
  toast(title, {
    description,
    duration: 3500,
  });
}

function isStaleRideError(err) {
  return [
    "RIDE_CANCELLED",
    "RIDE_ALREADY_ACCEPTED",
    "RIDE_UNAVAILABLE",
    "RIDE_ACCEPT_UNAVAILABLE",
    "DRIVER_ACTIVE_RIDE",
  ].includes(err?.code);
}

async function playRideRequestChime() {
  try {
    const { sound } = await Audio.Sound.createAsync(RIDE_REQUEST_CHIME, {
      shouldPlay: true,
      volume: 0.7,
    });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // Sound should never block ride polling.
  }
}

// ─── Registration Form ────────────────────────────────────────────────────────
function RegistrationScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [vehicle, setVehicle] = useState("");
  const [autoPhotoUrl, setAutoPhotoUrl] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [autoPhotoPreview, setAutoPhotoPreview] = useState("");
  const [licensePreview, setLicensePreview] = useState("");
  const [uploadingField, setUploadingField] = useState(null);
  const [step, setStep] = useState(1);
  const [consentGiven, setConsentGiven] = useState(false);

  const registerDriver = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_number: vehicle.toUpperCase().trim(),
          auto_photo_url: autoPhotoUrl,
          license_url: licenseUrl,
          dataConsentGiven: consentGiven,
          dataConsentAt: new Date().toISOString(),
          dataConsentVersion: "v1",
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

  const uploadSelectedImage = async (field, source) => {
    const isCamera = source === "camera";
    setUploadingField(field);

    try {
      const permission = isCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Needed",
          isCamera
            ? "Allow camera access to take this photo."
            : "Allow photo access to choose this image.",
        );
        return;
      }

      const result = isCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS === "android",
            quality: 0.72,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS === "android",
            quality: 0.72,
            base64: true,
          });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        throw new Error("Could not read the selected image");
      }

      const mimeType = asset.mimeType || "image/jpeg";
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "driver-registration",
          base64: `data:${mimeType};base64,${asset.base64}`,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Upload failed");
      }

      if (field === "auto") {
        setAutoPhotoUrl(body.path || body.url);
        setAutoPhotoPreview(asset.uri || body.url);
      } else {
        setLicenseUrl(body.path || body.url);
        setLicensePreview(asset.uri || body.url);
      }
    } catch (err) {
      Alert.alert("Upload Failed", err.message || "Could not upload image");
    } finally {
      setUploadingField(null);
    }
  };

  const renderUploadField = ({
    field,
    title,
    required,
    helper,
    value,
    preview,
  }) => {
    const isUploading = uploadingField === field;
    const borderColor = value ? PRIMARY_BORDER : BORDER;

    return (
      <View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: TEXT_SECONDARY,
            marginBottom: 8,
          }}
        >
          {title}
          {required ? " *" : ""}
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor,
            borderRadius: 14,
            backgroundColor: "#F5F5F4",
            padding: 12,
            gap: 12,
          }}
        >
          {preview || value ? (
            <RNImage
              source={{ uri: preview || value }}
              style={{
                width: "100%",
                height: 150,
                borderRadius: 12,
                backgroundColor: "#D8E4E5",
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                height: 130,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#D6D3D1",
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: SURFACE,
              }}
            >
              <ImageIcon size={ICON.xl} color={TEXT_MUTED} />
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: "600",
                  color: TEXT_MUTED,
                }}
              >
                No image selected
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => uploadSelectedImage(field, "camera")}
              disabled={isUploading}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 12,
                backgroundColor: SURFACE,
                borderWidth: 1,
                borderColor: PRIMARY_BORDER,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: isUploading ? 0.6 : 1,
              }}
            >
              <Camera size={ICON.sm} color={PRIMARY_DARK} />
              <Text style={{ color: PRIMARY_DARK, fontSize: 13, fontWeight: "700" }}>
                {isUploading ? "Uploading..." : "Camera"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => uploadSelectedImage(field, "gallery")}
              disabled={isUploading}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 12,
                backgroundColor: SURFACE,
                borderWidth: 1,
                borderColor: PRIMARY_BORDER,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: isUploading ? 0.6 : 1,
              }}
            >
              <ImageIcon size={ICON.sm} color={PRIMARY_DARK} />
              <Text style={{ color: PRIMARY_DARK, fontSize: 13, fontWeight: "700" }}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
          {value ? "Uploaded successfully" : helper}
        </Text>
      </View>
    );
  };

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
          Start earning by registering your vehicle
        </Text>
        <View style={{ flexDirection: "row", marginTop: 20, gap: 8 }}>
          {steps.map((s) => (
            <View key={s.num} style={{ flex: 1 }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: s.num <= step ? PRIMARY : "#D8E4E5",
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
                  color: "#286B68",
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
                backgroundColor: !vehicle.trim() ? "#BFD1D3" : PRIMARY,
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
              {renderUploadField({
                field: "auto",
                title: "Vehicle Photo",
                helper: "Take or choose a clear photo of your vehicle",
                value: autoPhotoUrl,
                preview: autoPhotoPreview,
              })}
              {renderUploadField({
                field: "license",
                title: "License / Permit",
                required: true,
                helper: "Take or choose a clear photo of your driving license or permit",
                value: licenseUrl,
                preview: licensePreview,
              })}
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
                  backgroundColor: !licenseUrl.trim() ? "#BFD1D3" : PRIMARY,
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
                { label: "Vehicle Photo", value: autoPhotoUrl || "Not provided" },
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
                Your application will be reviewed by our admin team. You&apos;ll
                start accepting rides once approved.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setConsentGiven((value) => !value)}
              style={{
                alignItems: "flex-start",
                backgroundColor: consentGiven ? PRIMARY_LIGHT : SURFACE,
                borderColor: consentGiven ? PRIMARY_BORDER : BORDER,
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: "row",
                gap: 12,
                padding: 14,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: consentGiven ? PRIMARY : SURFACE,
                  borderColor: consentGiven ? PRIMARY : BORDER,
                  borderRadius: 7,
                  borderWidth: 1.5,
                  height: 22,
                  justifyContent: "center",
                  marginTop: 1,
                  width: 22,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
                  {consentGiven ? "✓" : ""}
                </Text>
              </View>
              <Text style={{ color: TEXT_SECONDARY, flex: 1, fontSize: 12, lineHeight: 18 }}>
                I agree to TukTukGo collecting and storing my name, phone number,
                vehicle, and licence details to provide ride services, in line with the{" "}
                <Text
                  style={{ color: PRIMARY_DARK, fontWeight: "900" }}
                  onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </TouchableOpacity>
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
                disabled={registerDriver.isPending || !consentGiven}
                style={{
                  flex: 2,
                  backgroundColor: consentGiven ? PRIMARY : "#BFD1D3",
                  borderRadius: 14,
                  paddingVertical: 17,
                  alignItems: "center",
                  shadowColor: PRIMARY,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                  opacity: registerDriver.isPending ? 0.7 : 1,
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
        <Clock size={ICON.xxl} color="#B88700" />
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
        Our team is reviewing your documents.{"\n"}You&apos;ll be notified once
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
function RideRequestCard({
  ride,
  driverId,
  onAccept,
  isAccepting,
  onFareOffer,
  isOffering,
  isLocked,
}) {
  const [counterFare, setCounterFare] = useState("");
  const isNegotiating = ride.status === "negotiating";
  const driverOffer = Array.isArray(ride.fare_offers)
    ? ride.fare_offers.find((offer) => offer.driver_id === driverId)
    : null;
  const hasCountered = driverOffer?.offer_type === "counter";
  const hasDeclined = driverOffer?.offer_type === "decline";
  const isWaitingForPassenger = isNegotiating && hasCountered;
  const timeAgo = () => {
    const diff = Math.floor((Date.now() - new Date(ride.created_at)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <View style={{ backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, overflow: "hidden" }}>
      <View style={{ padding: isNegotiating ? 16 : 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F4", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: isNegotiating ? "#0369A1" : "#22C55E",
              shadowColor: isNegotiating ? "#0369A1" : "#22C55E",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
          <Text style={{ fontSize: isNegotiating ? 14 : 12, fontWeight: "900", color: isNegotiating ? "#0369A1" : SUCCESS }}>
            {isWaitingForPassenger
              ? "Waiting for Passenger"
              : isNegotiating
                ? "⚡ Fare Negotiation — Respond Now"
                : "New Ride Request"}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: TEXT_MUTED }}>{timeAgo()}</Text>
      </View>

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", paddingTop: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY }} />
            <View style={{ width: 1.5, height: 26, backgroundColor: BORDER, marginVertical: 3 }} />
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: TEXT }} />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Pickup</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT }} numberOfLines={1}>{ride.pickup_address}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Drop</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT }} numberOfLines={1}>{ride.dest_address}</Text>
            </View>
          </View>
        </View>

        {isNegotiating && (
          <View style={{ marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: "#BAE6FD", backgroundColor: "#F0F9FF", padding: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#0369A1", textTransform: "uppercase" }}>Passenger offer</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT, marginTop: 2 }}>{formatCurrency(ride.fare_max)}</Text>
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>Accept this fare or send one higher counter.</Text>

            {isWaitingForPassenger ? (
              <View style={{ marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: SURFACE, padding: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "900", color: "#0369A1" }}>Counter sent: {formatCurrency(driverOffer.offered_fare)}</Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 18 }}>Waiting for the passenger to accept. This card will update when they respond.</Text>
              </View>
            ) : (
              (() => {
                const passengerOffer = Number(ride.fare_max || 0);
                const counterNum = Number(counterFare);
                const isBelowOffer = counterFare !== "" && counterNum <= passengerOffer;
                const isDisabled = !counterFare || isBelowOffer || isOffering || isLocked || hasDeclined;

                return (
                  <View style={{ gap: 10, marginTop: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: isBelowOffer ? "#DC2626" : counterFare ? PRIMARY : BORDER,
                        backgroundColor: SURFACE,
                        overflow: "hidden",
                      }}
                    >
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1, borderRightColor: BORDER, backgroundColor: isBelowOffer ? "#FEF2F2" : PRIMARY_LIGHT }}>
                        <Text style={{ fontSize: 22, fontWeight: "900", color: isBelowOffer ? "#DC2626" : PRIMARY_DARK }}>₹</Text>
                      </View>
                      <TextInput
                        value={counterFare}
                        onChangeText={(value) => setCounterFare(value.replace(/[^\d]/g, ""))}
                        placeholder={String(passengerOffer + 10)}
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="number-pad"
                        editable={!isOffering && !isLocked && !hasDeclined}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, color: TEXT, fontWeight: "800", fontSize: 26, minHeight: 64 }}
                        accessibilityLabel="Enter your counter fare amount in rupees"
                        accessibilityHint={`Passenger offered ${formatCurrency(ride.fare_max)}. Enter a higher amount.`}
                      />
                    </View>

                    {isBelowOffer ? (
                      <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "700", paddingHorizontal: 4 }}>
                        Counter must be higher than passenger&apos;s ₹{passengerOffer} offer
                      </Text>
                    ) : counterFare ? (
                      <Text style={{ fontSize: 12, color: TEXT_MUTED, paddingHorizontal: 4 }}>
                        You&apos;ll earn ₹{counterNum} if accepted
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={() => {
                        if (isDisabled) return;
                        Keyboard.dismiss();
                        onFareOffer(ride.id, { offerType: "counter", offeredFare: counterNum });
                      }}
                      disabled={isDisabled}
                      accessibilityLabel="Send counter fare to passenger"
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        borderRadius: 14,
                        backgroundColor: isDisabled ? BORDER : pressed ? "#38A89D" : PRIMARY,
                        paddingVertical: 16,
                        alignItems: "center",
                        opacity: isOffering ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "900", color: isDisabled ? TEXT_MUTED : "#FFFFFF" }}>
                        {isOffering ? "Sending…" : "Send Counter Fare"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })()
            )}
          </View>
        )}

        {!isWaitingForPassenger && !hasDeclined && (
          <Button
            variant="primary"
            size="md"
            onPress={() => isNegotiating ? onFareOffer(ride.id, { offerType: "accept" }) : onAccept(ride.id)}
            loading={isAccepting || isOffering}
            disabled={isAccepting || isOffering || isLocked}
            style={{ marginTop: 14 }}
            accessibilityLabel="Accept ride request"
          >
            Accept Ride
          </Button>
        )}

        {isNegotiating && !isWaitingForPassenger && !hasDeclined && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFareOffer(ride.id, { offerType: "decline" });
            }}
            disabled={isOffering || isLocked}
            accessibilityLabel="Decline this ride request"
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#FECACA",
              backgroundColor: pressed ? "#FEF2F2" : SURFACE,
              paddingVertical: 14,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "#DC2626", fontSize: 15, fontWeight: "700" }}>Decline Request</Text>
          </Pressable>
        )}

        {hasDeclined && (
          <Text style={{ marginTop: 12, color: TEXT_MUTED, fontSize: 12, fontWeight: "700" }}>You declined this request.</Text>
        )}
      </View>
    </View>
  );
}
function KycGateScreen({ status, reason }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isRejected = status === "rejected" || status === "resubmission_required";
  const isPending = status === "pending_review";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 28,
          paddingHorizontal: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 26,
            backgroundColor: isRejected ? "#FEF2F2" : PRIMARY_LIGHT,
            borderWidth: 1,
            borderColor: isRejected ? "#FECACA" : PRIMARY_BORDER,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <FileText size={ICON.xxl} color={isRejected ? "#DC2626" : PRIMARY} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT, textAlign: "center" }}>
          {isPending
            ? "KYC under review"
            : isRejected
              ? "KYC needs resubmission"
              : "Complete driver KYC"}
        </Text>
        <Text style={{ marginTop: 10, fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22, textAlign: "center" }}>
          {isPending
            ? "Your documents are being reviewed. Online mode stays disabled until approval."
            : isRejected
              ? reason || "Please resubmit clear documents with matching details."
              : "Verify your license, RC, Aadhaar, and selfie before going online."}
        </Text>
        {!isPending ? (
          <TouchableOpacity
            onPress={() => router.push("/(driver)/kyc-submit")}
            style={{
              marginTop: 28,
              width: "100%",
              borderRadius: 16,
              backgroundColor: PRIMARY,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
              {isRejected ? "Resubmit KYC" : "Start KYC"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ActiveRideCard({
  ride,
  onCall,
  onStart,
  onComplete,
  onCancel,
  isCalling,
  isStarting,
  isCompleting,
  isCancelling,
  pusherChannel,
}) {
  const hasStarted = Boolean(ride.started_at);
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
                color: "#647678",
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
              {hasStarted ? "Ride In Progress" : "Passenger Waiting"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 10 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              {ride.can_call ? (
                <MotionPressable
                  onPress={() => onCall(ride.id)}
                  disabled={isCalling}
                  accessibilityLabel="Call passenger"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: SUCCESS,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: isCalling ? 0.65 : 1,
                  }}
                >
                  <Phone size={ICON.md} color="#fff" />
                </MotionPressable>
              ) : null}
              <ChatDrawer
                rideId={ride.id}
                pusherChannel={pusherChannel}
                role="driver"
              />
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
                {hasStarted ? "ON TRIP" : "PICKUP"}
              </Text>
            </View>
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
              <MapPin size={ICON.sm} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#586C70",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Pickup / పికప్ / पिकअप
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
          <MotionPressable
            onPress={() =>
              openGoogleMaps(
                hasStarted ? ride.dest_lat : ride.pickup_lat,
                hasStarted ? ride.dest_lng : ride.pickup_lng,
                hasStarted ? ride.dest_address : ride.pickup_address,
              )
            }
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 9,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
              backgroundColor: PRIMARY_LIGHT,
            }}
          >
            <Navigation size={ICON.sm} color={PRIMARY} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
              {hasStarted ? "Navigate to Drop-off" : "Navigate to Pickup"}
            </Text>
          </MotionPressable>
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
              <MapPin size={ICON.sm} color="#647678" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#586C70",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Drop-off / డ్రాప్ / ड्रॉप
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
          <Button
            variant="primary"
            size="md"
            onPress={() => {
              if (!hasStarted) {
                onStart(ride.id);
                return;
              }
              onComplete(ride.id);
            }}
            loading={isStarting || isCompleting}
            disabled={isStarting || isCompleting || isCancelling}
            style={{
              flex: 2,
            }}
            accessibilityLabel={hasStarted ? "Complete ride" : "Start ride"}
          >
            {hasStarted ? "Complete Ride" : "Start Ride"}
          </Button>
          <Button
            variant="danger"
            size="md"
            onPress={() => onCancel(ride.id)}
            loading={isCancelling}
            disabled={isStarting || isCompleting || isCancelling}
            style={{
              flex: 1,
            }}
            accessibilityLabel="Cancel active ride"
          >
            Cancel
          </Button>
        </View>
      </View>
    </View>
  );
}

// ─── Main Driver Home ─────────────────────────────────────────────────────────
function CompletedRideSummary({
  ride,
  onDismiss,
  onRate,
  ratingValue,
  setRatingValue,
  ratingFeedback,
  setRatingFeedback,
  isRating,
}) {
  if (!ride) return null;

  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#BBF7D0",
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: SUCCESS_LIGHT,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#BBF7D0",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "900", color: SUCCESS }}>
          Ride completed
        </Text>
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: SUCCESS_LIGHT,
            borderColor: "#BBF7D0",
            borderRadius: 14,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <Text
            style={{
              color: SUCCESS,
              fontSize: 12,
              fontWeight: "900",
              textTransform: "uppercase",
            }}
          >
            Collect from passenger
          </Text>
          <Text style={{ color: TEXT, fontSize: 34, fontWeight: "900", marginTop: 4 }}>
            {formatCurrency(rideFare(ride))}
          </Text>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
            Confirm payment directly with the passenger.
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase" }}>
              Ride status
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: SUCCESS, marginTop: 5 }}>
              Payment due
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase" }}>
              Distance
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT, marginTop: 5 }}>
              {Number(ride.distance_km || 0).toFixed(1)} km
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: TEXT_SECONDARY }} numberOfLines={2}>
          {ride.pickup_address} to {ride.dest_address}
        </Text>
        {!ride.passenger_rating ? (
          <View
            style={{
              backgroundColor: "#FFFBEB",
              borderColor: "#FDE68A",
              borderRadius: 14,
              borderWidth: 1,
              padding: 14,
            }}
          >
            <Text style={{ color: TEXT, fontSize: 14, fontWeight: "900" }}>
              Rate the passenger
            </Text>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 3 }}>
              Help keep the TukTukGo community reliable.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity key={value} onPress={() => setRatingValue(value)}>
                  <Star
                    size={ICON.xl}
                    color={value <= ratingValue ? "#F3B51B" : TEXT_MUTED}
                    fill={value <= ratingValue ? "#F3B51B" : "none"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={ratingFeedback}
              onChangeText={(value) => setRatingFeedback(value.slice(0, 280))}
              placeholder="Optional passenger feedback"
              placeholderTextColor={TEXT_MUTED}
              multiline
              maxLength={280}
              style={{
                backgroundColor: SURFACE,
                borderColor: "#FDE68A",
                borderRadius: 10,
                borderWidth: 1,
                color: TEXT,
                marginTop: 12,
                minHeight: 68,
                paddingHorizontal: 12,
                paddingVertical: 10,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button
                variant="secondary"
                size="md"
                onPress={onDismiss}
                style={{ flex: 1 }}
              >
                Later
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={() => onRate(ride.id)}
                loading={isRating}
                disabled={ratingValue === 0 || isRating}
                style={{ flex: 2 }}
              >
                Submit Rating
              </Button>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 10 }}>
            <Text style={{ color: SUCCESS, fontSize: 13, fontWeight: "900" }}>
              Passenger rated {ride.passenger_rating}/5
            </Text>
            <Button variant="secondary" size="md" onPress={onDismiss}>
              Done
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

function TopLineLoader({ visible }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 950,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: PRIMARY_LIGHT,
        zIndex: 10,
      }}
    >
      <Animated.View
        style={{
          width: "42%",
          height: "100%",
          backgroundColor: PRIMARY,
          borderTopRightRadius: 99,
          borderBottomRightRadius: 99,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-width * 0.42, width],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

function ConfirmActionModal({ config, onClose }) {
  if (!config) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(23, 39, 43, 0.42)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 28,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: TEXT }}>
            {config.title}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 20 }}>
            {config.message}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: BORDER,
                paddingVertical: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: TEXT_SECONDARY, fontWeight: "800" }}>
                {config.cancelLabel || "Not Now"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const action = config.onConfirm;
                onClose();
                action?.();
              }}
              style={{
                flex: 1,
                borderRadius: 12,
                backgroundColor: config.destructive ? "#DC2626" : PRIMARY,
                paddingVertical: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {config.confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function DriverHome() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const activeMutationCount = useIsMutating();
  const notifiedCancelledRideIds = useRef(new Set());
  const cancellationNoticesInitialized = useRef(false);
  const notifiedRideRequestIds = useRef(new Set());
  const acceptedNoticesInitialized = useRef(false);
  const notifiedAcceptedRideIds = useRef(new Set());
  const [lockedRideIds, setLockedRideIds] = useState(() => new Set());
  const [completedRideSummary, setCompletedRideSummary] = useState(null);
  const [passengerRatingValue, setPassengerRatingValue] = useState(0);
  const [passengerRatingFeedback, setPassengerRatingFeedback] = useState("");
  const dismissedPassengerRatingRideIds = useRef(new Set());
  const [visibleRequestCount, setVisibleRequestCount] = useState(5);
  const [confirmAction, setConfirmAction] = useState(null);
  const [activeRideChannel, setActiveRideChannel] = useState(null);
  const onlineToggleAnim = useRef(new Animated.Value(0)).current;
  const { auth } = useAuth();
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";
  const notificationUserKey = notificationOwnerKey(auth);
  const notifyDriver = useCallback(
    ({ title, body, type, rideId, dedupeKey }) => {
      addInAppNotification({
        ownerKey: notificationUserKey,
        title,
        body,
        type,
        rideId,
        dedupeKey,
      });
    },
    [notificationUserKey],
  );

  const {
    data: driverData,
    isLoading: driverLoading,
    isError: driverError,
    refetch: refetchDriver,
  } = useQuery({
    queryKey: ["driverMe", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load driver profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  const {
    data: ridesData,
    refetch: refetchRides,
    isRefetching,
  } = useQuery({
    queryKey: ["driverRides", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to load rides");
      return res.json();
    },
    enabled:
      !!driverData?.driver?.is_approved && !!driverData?.driver?.is_online,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ["driverEarnings", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers/earnings");
      if (!res.ok) throw new Error("Failed to load earnings");
      return res.json();
    },
    enabled: !!driverData?.driver,
    staleTime: 30000,
  });
  const { data: incentiveData } = useQuery({
    queryKey: ["driverIncentives", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers/incentives");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!auth,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const activeDriverRide = pickPrimaryActiveRide(ridesData?.rides || []);
  const activeRideForChatId = activeDriverRide?.id;

  useEffect(() => {
    if (completedRideSummary) return;
    const latestCompletedRide = (ridesData?.rides || []).find(
      (ride) => ride.status === "completed",
    );
    if (
      latestCompletedRide &&
      !latestCompletedRide.passenger_rating &&
      !dismissedPassengerRatingRideIds.current.has(latestCompletedRide.id)
    ) {
      setPassengerRatingValue(0);
      setPassengerRatingFeedback("");
      setCompletedRideSummary(latestCompletedRide);
    }
  }, [completedRideSummary, ridesData?.rides]);

  useEffect(() => {
    Animated.spring(onlineToggleAnim, {
      toValue: driverData?.driver?.is_online ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [driverData?.driver?.is_online, onlineToggleAnim]);

  useEffect(() => {
    notifiedCancelledRideIds.current.clear();
    cancellationNoticesInitialized.current = false;
    notifiedRideRequestIds.current.clear();
    notifiedAcceptedRideIds.current.clear();
    acceptedNoticesInitialized.current = false;
  }, [authUserKey]);

  useEffect(() => {
    if (!Array.isArray(ridesData?.rides)) return;
    const cancelledRides = ridesData.rides.filter(
      (ride) =>
        ride.status === "cancelled" &&
        ride.driver_id,
    );

    if (!cancellationNoticesInitialized.current) {
      cancelledRides.forEach((ride) => notifiedCancelledRideIds.current.add(ride.id));
      cancellationNoticesInitialized.current = true;
      return;
    }

    const cancelledRide = cancelledRides.find(
      (ride) => !notifiedCancelledRideIds.current.has(ride.id),
    );
    if (!cancelledRide) return;
    notifiedCancelledRideIds.current.add(cancelledRide.id);
    showDriverNotice(
      "Passenger cancelled the ride",
      formatCancellationReason(cancelledRide.cancellation_reason),
    );
    notifyDriver({
      title: "Passenger cancelled the ride",
      body: formatCancellationReason(cancelledRide.cancellation_reason),
      type: "ride_cancelled",
      rideId: cancelledRide.id,
      dedupeKey: `ride_cancelled:${cancelledRide.id}`,
    });
  }, [notifyDriver, ridesData?.rides]);

  useEffect(() => {
    if (!Array.isArray(ridesData?.rides)) return;
    const acceptedRides = ridesData.rides.filter((ride) => ride.status === "accepted");
    if (!acceptedNoticesInitialized.current) {
      acceptedRides.forEach((ride) => notifiedAcceptedRideIds.current.add(ride.id));
      acceptedNoticesInitialized.current = true;
      return;
    }
    const acceptedRide = acceptedRides.find(
      (ride) => !notifiedAcceptedRideIds.current.has(ride.id),
    );
    if (!acceptedRide) return;
    notifiedAcceptedRideIds.current.add(acceptedRide.id);
    notifyDriver({
      title: "Booking confirmed",
      body: "This ride is assigned to you. Head to the pickup location.",
      type: "ride_accepted",
      rideId: acceptedRide.id,
      dedupeKey: `ride_accepted:${acceptedRide.id}`,
    });
  }, [notifyDriver, ridesData?.rides]);

  useEffect(() => {
    const requestedRides = (ridesData?.rides || []).filter(
      (ride) =>
        (ride.status === "requested" || ride.status === "negotiating") &&
        !ride.driver_id,
    );
    const newRide = requestedRides.find(
      (ride) => !notifiedRideRequestIds.current.has(ride.id),
    );
    requestedRides.forEach((ride) => notifiedRideRequestIds.current.add(ride.id));
    if (activeDriverRide) return;
    if (newRide) {
      playRideRequestChime();
      notifyDriver({
        title: "New ride request",
        body: `${newRide.pickup_address || "Pickup location"} to ${newRide.dest_address || "destination"}`,
        type: "ride_request",
        rideId: newRide.id,
        dedupeKey: `ride_request:${newRide.id}`,
      });
    }
  }, [activeDriverRide, notifyDriver, ridesData?.rides]);

  useEffect(() => {
    const openRideCount = (ridesData?.rides || []).filter(
      (ride) =>
        (ride.status === "requested" || ride.status === "negotiating") &&
        !ride.driver_id,
    ).length;
    if (!driverData?.driver?.is_online || openRideCount <= 5) {
      setVisibleRequestCount(5);
    }
  }, [ridesData?.rides, driverData?.driver?.is_online]);

  useEffect(() => {
    const negotiatingRides = (ridesData?.rides || []).filter(
      (ride) => ride.status === "negotiating" && !ride.driver_id,
    );
    if (negotiatingRides.length === 0) return;

    const pusher = createRidePusher({ jwt: auth?.jwt });
    if (!pusher) return;

    const channels = negotiatingRides.map((ride) => {
      const channelName = `private-ride-${ride.id}`;
      const channel = pusher.subscribe(channelName);
      channel.bind("ride-locked", (data) => {
        if (!data?.rideId || data.driverId === driverData?.driver?.id) {
          queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
          return;
        }
        setLockedRideIds((current) => {
          const next = new Set(current);
          next.add(data.rideId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      });
      channel.bind("negotiation-expired", () => {
        queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      });
      return channelName;
    });

    return () => {
      channels.forEach((channelName) => {
        pusher.unsubscribe(channelName);
      });
      pusher.disconnect();
    };
  }, [ridesData?.rides, auth?.jwt, driverData?.driver?.id, authUserKey, queryClient]);

  useEffect(() => {
    if (!activeRideForChatId) {
      setActiveRideChannel(null);
      return undefined;
    }

    const pusher = createRidePusher({ jwt: auth?.jwt });
    if (!pusher) {
      setActiveRideChannel(null);
      return undefined;
    }

    const channelName = `private-ride-${activeRideForChatId}`;
    const channel = pusher.subscribe(channelName);
    channel.bind("ride-cancelled", (data) => {
      if (data?.actorRole === "driver") return;
      if (data?.rideId) notifiedCancelledRideIds.current.add(data.rideId);
      showDriverNotice(
        "Passenger cancelled the ride",
        formatCancellationReason(data?.reason),
      );
      notifyDriver({
        title: "Passenger cancelled the ride",
        body: formatCancellationReason(data?.reason),
        type: "ride_cancelled",
        rideId: data?.rideId || activeRideForChatId,
        dedupeKey: `ride_cancelled:${data?.rideId || activeRideForChatId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
    });
    setActiveRideChannel(channel);

    return () => {
      setActiveRideChannel(null);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [activeRideForChatId, auth?.jwt, authUserKey, notifyDriver, queryClient]);

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["driverMe", authUserKey] }),
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
          "Allow location access so TukTukGo can place you inside a service zone.",
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
        await readApiError(res, "Failed to accept ride");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      showDriverNotice("Ride accepted", "Head to the pickup location now.");
      notifyDriver({
        title: "Ride accepted",
        body: "Head to the pickup location now.",
        type: "ride_accepted",
        rideId: data?.ride?.id,
        dedupeKey: `ride_accepted:${data?.ride?.id}`,
      });
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      if (isStaleRideError(err)) {
        showDriverNotice(
          err.code === "DRIVER_ACTIVE_RIDE" ? "Current ride comes first" : "Ride no longer available",
          err.message,
        );
        return;
      }
      Alert.alert("Accept Failed", err.message);
    },
  });

  const fareOffer = useMutation({
    mutationFn: async ({ rideId, offerType, offeredFare }) => {
      const res = await fetch(`/api/rides/${rideId}/fare-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerType, offeredFare }),
      });
      if (!res.ok) {
        await readApiError(res, "Failed to submit fare offer");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      if (variables.offerType === "accept") {
        showDriverNotice("Ride accepted", "Head to the pickup location now.");
        notifyDriver({
          title: "Ride accepted",
          body: "Head to the pickup location now.",
          type: "ride_accepted",
          rideId: data?.ride?.id || variables.rideId,
          dedupeKey: `ride_accepted:${data?.ride?.id || variables.rideId}`,
        });
      } else if (variables.offerType === "counter") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showDriverNotice("Counter sent", "The passenger can now approve your fare.");
        notifyDriver({
          title: "Counter offer sent",
          body: "The passenger can now approve your fare.",
          type: "counter_offer_sent",
          rideId: variables.rideId,
          dedupeKey: `counter_offer_sent:${variables.rideId}`,
        });
      }
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      if (isStaleRideError(err) || err.status === 409) {
        showDriverNotice(
          err.code === "DRIVER_ACTIVE_RIDE" ? "Current ride comes first" : "Ride no longer available",
          err.message,
        );
        return;
      }
      Alert.alert("Offer Failed", err.message);
    },
  });

  const completeRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to complete ride");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      queryClient.invalidateQueries({ queryKey: ["driverEarnings", authUserKey] });
      queryClient.invalidateQueries({ queryKey: ["driverRideHistory", authUserKey] });
      setCompletedRideSummary(data.ride);
      setPassengerRatingValue(0);
      setPassengerRatingFeedback("");
      showDriverNotice("Ride completed", `Fare: ${formatCurrency(rideFare(data.ride))}`);
      notifyDriver({
        title: "Ride completed",
        body: `Fare: ${formatCurrency(rideFare(data.ride))}`,
        type: "ride_completed",
        rideId: data?.ride?.id,
        dedupeKey: `ride_completed:${data?.ride?.id}`,
      });
    },
  });

  const ratePassenger = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rate_passenger",
          passenger_rating: passengerRatingValue,
          passenger_rating_feedback: passengerRatingFeedback,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to rate passenger");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCompletedRideSummary(data.ride);
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      showDriverNotice("Rating submitted", "Thank you for your feedback.");
    },
    onError: (err) => showDriverNotice("Rating failed", err.message),
  });

  const startRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to start ride");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCompletedRideSummary(null);
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      Alert.alert("Ride Started", "Navigate to the drop-off location.");
      notifyDriver({
        title: "Ride started",
        body: "Navigate to the drop-off location.",
        type: "ride_started",
        rideId: data?.ride?.id,
        dedupeKey: `ride_started:${data?.ride?.id}`,
      });
    },
    onError: (err) => Alert.alert("Start Failed", err.message),
  });

  const requestMaskedCall = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        await readApiError(res, "Call failed. Try again.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      showDriverNotice("Connecting call", data.message || "Connecting you now...");
    },
    onError: (err) => {
      showDriverNotice("Call unavailable", err.message || "Call failed. Try again.");
    },
  });

  const cancelRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: "driver_cancelled" }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to cancel ride");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.ride?.id) notifiedCancelledRideIds.current.add(data.ride.id);
      queryClient.invalidateQueries({ queryKey: ["driverRides", authUserKey] });
      showDriverNotice("Ride cancelled", "The passenger has been notified.");
      notifyDriver({
        title: "Ride cancelled",
        body: "The passenger has been notified.",
        type: "ride_cancelled",
        rideId: data?.ride?.id,
        dedupeKey: `ride_cancelled:${data?.ride?.id}`,
      });
    },
    onError: (err) => showDriverNotice("Cancel failed", err.message),
  });

  const rides = useMemo(() => ridesData?.rides || [], [ridesData?.rides]);
  const activeRide = pickPrimaryActiveRide(rides);
  const additionalAcceptedRideCount = Math.max(
    rides.filter((ride) => ride.status === "accepted").length - (activeRide ? 1 : 0),
    0,
  );
  const negotiatingRidesForDriver = useMemo(
    () =>
      rides.filter((ride) => {
        const driverOffer = Array.isArray(ride.fare_offers)
          ? ride.fare_offers.find((offer) => offer.driver_id === driverData?.driver?.id)
          : null;
        return (
          ride.status === "negotiating" &&
          !ride.driver_id &&
          driverOffer?.offer_type !== "decline"
        );
      }),
    [driverData?.driver?.id, rides],
  );
  const nonNegotiatingRides = useMemo(
    () => rides.filter((ride) => ride.status === "requested" && !ride.driver_id),
    [rides],
  );
  const availableRides = [...negotiatingRidesForDriver, ...nonNegotiatingRides];
  const visibleNonNegotiatingRides = nonNegotiatingRides.slice(0, visibleRequestCount);
  const hiddenAvailableRideCount = Math.max(
    nonNegotiatingRides.length - visibleNonNegotiatingRides.length,
    0,
  );

  if (driverLoading && !driverData) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
        }}
      >
        <StatusBar style="dark" />
        <TopLineLoader visible />
      </View>
    );
  }

  if (driverError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: BG,
          padding: 24,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: TEXT,
            textAlign: "center",
          }}
        >
          Could not load driver profile
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 20,
          }}
        >
          Retry after a moment. If it continues, sign out and sign in again.
        </Text>
        <TouchableOpacity
          onPress={() => refetchDriver()}
          style={{
            marginTop: 18,
            borderRadius: 12,
            backgroundColor: PRIMARY,
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const driver = driverData?.driver;
  if (!driver) return <RegistrationScreen />;
  const kycStatus = driver.kyc_status || "not_started";
  if (kycStatus !== "approved") {
    return (
      <KycGateScreen
        status={kycStatus}
        reason={driver.kyc_rejection_reason}
      />
    );
  }
  if (!driver.is_approved) return <PendingScreen />;

  const expiryDate = driver.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isExpired = !expiryDate || expiryDate < new Date();
  const toggleThumbTranslate = onlineToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <TopLineLoader
        visible={driverLoading || isRefetching || activeMutationCount > 0}
      />

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: DARK,
                borderWidth: 1,
                borderColor: "#26363A",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <RNImage
                source={TUKTUKGO_ICON}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: TEXT,
                letterSpacing: -0.5,
              }}
            >
              Dashboard
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
              {driver.vehicle_number} ·{" "}
              {driver.is_online ? t("driver.online") : t("driver.offline")}
            </Text>
            <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>
              {driver.is_online
                ? "మీరు ఆన్‌లైన్‌లో ఉన్నారు / आप ऑनलाइन हैं"
                : "ఆఫ్‌లైన్ / ऑफलाइन"}
            </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 }}>
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
            activeOpacity={0.85}
            disabled={toggleStatus.isPending}
            accessibilityRole="switch"
            accessibilityState={{ checked: driver.is_online, disabled: toggleStatus.isPending }}
          >
            <Animated.View
              style={{
                width: 64,
                height: 34,
                borderRadius: 17,
                padding: 3,
                backgroundColor: driver.is_online ? SUCCESS : "#D8E4E5",
                borderWidth: 1,
                borderColor: driver.is_online ? "#BBF7D0" : BORDER,
                opacity: toggleStatus.isPending ? 0.7 : 1,
                justifyContent: "center",
              }}
            >
              <Animated.View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: SURFACE,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  elevation: 3,
                  transform: [{ translateX: toggleThumbTranslate }],
                }}
              >
                {driver.is_online ? (
                  <Wifi size={ICON.sm} color={SUCCESS} />
                ) : (
                  <WifiOff size={ICON.sm} color={TEXT_MUTED} />
                )}
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
          </View>
        </View>

        {!activeRide && driver.is_online && availableRides.length > 0 ? (
          <View
            style={{
              marginTop: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#FDBA74",
              backgroundColor: "#FFF7ED",
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EA580C" }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: TEXT }}>
                {availableRides.length} new ride {availableRides.length === 1 ? "request" : "requests"}
              </Text>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>
                Review the pickup and fare below before accepting.
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: PRIMARY_BORDER,
            backgroundColor: PRIMARY_LIGHT,
            padding: 14,
            display: activeRide || availableRides.length > 0 ? "none" : "flex",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 11,
                backgroundColor: SURFACE,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <IndianRupee size={ICON.sm} color={PRIMARY_DARK} />
            </View>
            <Text style={{ fontSize: 13, color: TEXT, fontWeight: "800" }}>
              Earnings summary
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            {[
              { label: "Today", value: earningsData?.today, rides: `${earningsData?.ridesToday ?? 0} rides` },
              { label: "This Week", value: earningsData?.week },
              { label: "This Month", value: earningsData?.month },
            ].map((item, index) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  paddingHorizontal: index === 0 ? 0 : 10,
                  borderLeftWidth: index === 0 ? 0 : 1,
                  borderLeftColor: PRIMARY_BORDER,
                }}
              >
                <Text style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: "700" }}>
                  {item.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 15, color: TEXT, fontWeight: "900", marginTop: 4 }}
                >
                  {earningsLoading ? "--" : formatCurrency(item.value)}
                </Text>
                {item.rides ? (
                  <Text style={{ fontSize: 10, color: PRIMARY_DARK, fontWeight: "700", marginTop: 3 }}>
                    {item.rides}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {!activeRide && availableRides.length === 0 && incentiveData?.daily ? (
          incentiveData.daily.achieved ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#BBF7D0",
                backgroundColor: SUCCESS_LIGHT,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Star size={ICON.md} color={SUCCESS} fill={SUCCESS} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: SUCCESS }}>Daily target achieved!</Text>
                <Text style={{ fontSize: 11, color: "#166534", marginTop: 3 }}>
                  {incentiveData.daily.completed}/{incentiveData.daily.target} rides — ₹{incentiveData.daily.bonus} bonus earned
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                marginTop: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                backgroundColor: SURFACE,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" }}>
                  <Star size={ICON.sm} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: TEXT }}>
                    {incentiveData.daily.remaining} more rides → ₹{incentiveData.daily.bonus} bonus
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>
                    {incentiveData.daily.completed}/{incentiveData.daily.target} completed today
                  </Text>
                </View>
              </View>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: "#E7ECEC", marginTop: 12, overflow: "hidden" }}>
                <View
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: PRIMARY,
                    width: `${Math.min((incentiveData.daily.completed / incentiveData.daily.target) * 100, 100)}%`,
                  }}
                />
              </View>
            </View>
          )
        ) : null}

        {!activeRide && isExpired && (
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
                color: "#286B68",
                flex: 1,
                fontWeight: "600",
              }}
            >
              Subscription expired — go to Subscription tab to renew
            </Text>
          </View>
        )}
      </View>

      <FlashList
        data={!activeRide && driver.is_online && nonNegotiatingRides.length > 0 ? visibleNonNegotiatingRides : []}
        keyExtractor={(ride) => String(ride.id)}
        estimatedItemSize={180}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetchRides}
            tintColor={PRIMARY}
          />
        }
        ListHeaderComponent={
          <>
            {activeRide && (
          <ActiveRideCard
            ride={activeRide}
            onCall={(id) => requestMaskedCall.mutate(id)}
            onStart={(id) =>
              setConfirmAction({
                title: "Start ride?",
                message: "Start this ride after the passenger boards.",
                confirmLabel: "Start Ride",
                onConfirm: () => startRide.mutate(id),
              })
            }
            onComplete={(id) =>
              setConfirmAction({
                title: "Complete ride?",
                message: "Mark this ride as completed after drop-off.",
                confirmLabel: "Complete",
                onConfirm: () => completeRide.mutate(id),
              })
            }
            onCancel={(id) =>
              setConfirmAction({
                title: "Cancel ride?",
                message: "Cancel this accepted ride only if you cannot continue.",
                confirmLabel: "Cancel Ride",
                cancelLabel: "Keep Ride",
                destructive: true,
                onConfirm: () => cancelRide.mutate(id),
              })
            }
            isCalling={requestMaskedCall.isPending}
            isStarting={startRide.isPending}
            isCompleting={completeRide.isPending}
            isCancelling={cancelRide.isPending}
            pusherChannel={activeRideChannel}
          />
        )}
        {activeRide ? (
          <View
            style={{
              marginBottom: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: additionalAcceptedRideCount > 0 ? "#FDBA74" : PRIMARY_BORDER,
              backgroundColor: additionalAcceptedRideCount > 0 ? "#FFF7ED" : PRIMARY_LIGHT,
              padding: 13,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "900", color: TEXT }}>
              Current trip protected
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 17, color: TEXT_SECONDARY, marginTop: 4 }}>
              New requests are paused until this ride is completed or cancelled.
              {additionalAcceptedRideCount > 0
                ? ` ${additionalAcceptedRideCount} previously accepted ride${additionalAcceptedRideCount > 1 ? "s are" : " is"} waiting and will appear after this trip.`
                : ""}
            </Text>
          </View>
        ) : null}
        {!activeRide && completedRideSummary && (
          <CompletedRideSummary
            ride={completedRideSummary}
            ratingValue={passengerRatingValue}
            setRatingValue={setPassengerRatingValue}
            ratingFeedback={passengerRatingFeedback}
            setRatingFeedback={setPassengerRatingFeedback}
            isRating={ratePassenger.isPending}
            onRate={(rideId) => ratePassenger.mutate(rideId)}
            onDismiss={() => {
              dismissedPassengerRatingRideIds.current.add(
                completedRideSummary.id,
              );
              setCompletedRideSummary(null);
            }}
          />
        )}

        {!activeRide && driver.is_online && negotiatingRidesForDriver.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingHorizontal: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0369A1" }} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#0369A1", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {negotiatingRidesForDriver.length} Fare Negotiation
                {negotiatingRidesForDriver.length > 1 ? "s" : ""} — Action needed
              </Text>
            </View>
            {negotiatingRidesForDriver.map((ride) => (
              <RideRequestCard
                key={ride.id}
                ride={ride}
                driverId={driver.id}
                onAccept={(id) => acceptRide.mutate(id)}
                isAccepting={acceptRide.isPending}
                onFareOffer={(rideId, offer) => fareOffer.mutate({ rideId, ...offer })}
                isOffering={fareOffer.isPending}
                isLocked={!!activeRide || lockedRideIds.has(ride.id)}
              />
            ))}
          </View>
        ) : null}

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
              You&apos;re currently offline
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
            <Text
              style={{
                fontSize: 13,
                color: TEXT_MUTED,
                textAlign: "center",
                marginTop: 10,
                lineHeight: 20,
              }}
            >
              ఆన్‌లైన్ చేయండి / ऑनलाइन जाएं
            </Text>
          </View>
        ) : !activeRide ? (
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
              {t("driver.nearbyRequests")} ({availableRides.length}){"\n"}
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                సమీప రైడ్లు / नज़दीकी राइड्स
              </Text>
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
                  {t("driver.noRequests")}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: TEXT_MUTED,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  ఇంకా రైడ్లు లేవు / अभी कोई राइड नहीं
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
            ) : null}
          </>
        ) : null}
          </>
        }
        ListFooterComponent={
          !activeRide && driver.is_online && hiddenAvailableRideCount > 0 ? (
            <TouchableOpacity
              onPress={() => setVisibleRequestCount((count) => count + 5)}
              style={{
                backgroundColor: SURFACE,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: BORDER,
                paddingVertical: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: "800" }}>
                Show {Math.min(hiddenAvailableRideCount, 5)} More Requests
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <RideRequestCard
            ride={item}
            driverId={driver.id}
            onAccept={(id) => acceptRide.mutate(id)}
            isAccepting={acceptRide.isPending}
            onFareOffer={(rideId, offer) =>
              fareOffer.mutate({ rideId, ...offer })
            }
            isOffering={fareOffer.isPending}
            isLocked={lockedRideIds.has(item.id)}
          />
        )}
      />
      <ConfirmActionModal
        config={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </View>
  );
}

