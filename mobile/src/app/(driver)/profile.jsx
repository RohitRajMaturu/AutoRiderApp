import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Modal, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  LogOut,
  Phone,
  Shield,
  ChevronRight,
  HelpCircle,
  Calendar,
  FlaskConical,
  Camera,
  UserRound,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import useAppStore from "@/store/useAppStore";
import { ICON } from "@/theme/iconScale";
import AutoRideIcon from "@/components/AutoRideIcon";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { getVehicleLabel } from "@/utils/vehicles";
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  useLanguage,
} from "@/i18n/LanguageContext";
import { theme } from "@/theme/tokens";

const PRIMARY = theme.accent;
const PRIMARY_LIGHT = theme.accentDim;
const PRIMARY_BORDER = theme.borderH;
const BG = theme.bg;
const SURFACE = theme.surface1;
const BORDER = theme.border;
const TEXT = theme.text1;
const TEXT_SECONDARY = theme.text2;
const TEXT_MUTED = theme.text3;
const SUCCESS = theme.ok;
const SUCCESS_LIGHT = theme.okDim;
const DARK = theme.text1;
const SUPPORT_WHATSAPP_URL = `https://wa.me/${process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "919999999999"}`;
const DRIVER_GUIDELINES_URL = process.env.EXPO_PUBLIC_GUIDELINES_URL ?? "#";

function readAssetMimeType(asset) {
  if (asset?.mimeType) return asset.mimeType;
  const extension = String(asset?.uri || "").split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

async function uploadImageAsset({ asset, field, scope }) {
  if (!asset?.base64) {
    throw new Error("Could not read the selected image");
  }

  const mimeType = readAssetMimeType(asset);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      filename: asset.fileName || `${field}-${Date.now()}.jpg`,
      base64: `data:${mimeType};base64,${asset.base64}`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.url) {
    throw new Error(body.error || "Upload failed");
  }
  return body;
}

function MenuItem({
  icon: Icon,
  label,
  sublabel,
  onPress,
  color = TEXT_SECONDARY,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.surface2,
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.surface2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Icon size={ICON.sm} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      <ChevronRight size={ICON.sm} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

function ProfileFetchNotice({ visible }) {
  if (!visible) return null;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.accentDim,
        borderColor: theme.border,
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 16,
        paddingVertical: 10,
        width: "100%",
      }}
    >
      <TukTukGoLoader label="Loading profile..." size={32} textColor={theme.text2} />
    </View>
  );
}

function SignOutSheet({ visible, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.40)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 22,
            paddingBottom: 30,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 42,
              height: 4,
              borderRadius: 2,
              backgroundColor: BORDER,
              marginBottom: 18,
            }}
          />
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: theme.errDim,
              borderWidth: 1,
              borderColor: theme.errDim,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <LogOut size={ICON.lg} color={theme.err} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: TEXT }}>
            Sign out?
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY }}>
            You can sign back in anytime to go online, accept rides, and view earnings.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "800" }}>Stay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1,
                borderRadius: 14,
                backgroundColor: theme.err,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.surface1, fontSize: 14, fontWeight: "800" }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function DriverProfile() {
  const { setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { signOut, auth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { testMode, disableTestMode } = useAppStore();
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(null);
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  const { data: driverData, isLoading: driverProfileLoading } = useQuery({
    queryKey: ["driverMe", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load driver profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  const user = profile?.user || auth?.user;
  const driver = driverData?.driver;
  useEffect(() => {
    if (!testMode) {
      setPhone(user?.phone || "");
      setPreferredLanguage(user?.preferred_language || "English");
    }
  }, [testMode, user?.phone, user?.preferred_language]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          preferred_language: preferredLanguage,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save profile");
      return body;
    },
    onSuccess: (body) => {
      setLanguage(normalizeLanguage(body?.user?.preferred_language || preferredLanguage));
      queryClient.invalidateQueries({ queryKey: ["userProfile", authUserKey] });
      setIsProfileOpen(false);
    },
    onError: (err) => Alert.alert("Save Failed", err.message),
  });

  const updateDriverPhoto = useMutation({
    mutationFn: async (autoPhotoUrl) => {
      const res = await fetch("/api/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_photo_url: autoPhotoUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save auto photo");
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driverMe", authUserKey] }),
    onError: (err) => Alert.alert("Upload Failed", err.message),
  });

  const uploadProfileImage = async (kind) => {
    setUploadingImage(kind);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow photo access to choose this image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;

      const body = await uploadImageAsset({
        asset,
        field: kind,
        scope: kind === "driver" ? "driver-profile" : "driver-auto",
      });
      const savedUrl = body.path || body.url;
      if (kind === "driver") {
        const res = await fetch("/api/user-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: savedUrl }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to save driver image");
        queryClient.invalidateQueries({ queryKey: ["userProfile", authUserKey] });
      } else {
        updateDriverPhoto.mutate(savedUrl);
      }
    } catch (err) {
      Alert.alert("Upload Failed", err.message || "Could not upload image");
    } finally {
      setUploadingImage(null);
    }
  };

  const expiry = driver?.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isSubscribed = expiry && expiry > new Date();

  const handleExitTestMode = async () => {
    Alert.alert("Exit Test Mode", "Go back to sign-in screen?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit & Sign In",
        onPress: async () => {
          await disableTestMode();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Test mode banner */}
        {testMode && (
          <TouchableOpacity
            onPress={handleExitTestMode}
            style={{
              backgroundColor: theme.warnDim,
              paddingTop: insets.top + 8,
              paddingBottom: 10,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <FlaskConical size={ICON.sm} color={theme.warn} />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: theme.accentText,
                fontWeight: "600",
              }}
            >
              🧪 Test Mode Active — Tap to Sign In with real account
            </Text>
            <Text style={{ fontSize: 12, color: theme.warn, fontWeight: "700" }}>
              Exit →
            </Text>
          </TouchableOpacity>
        )}

        {/* Dark hero header */}
        <View
          style={{
            backgroundColor: DARK,
            paddingTop: testMode ? 24 : insets.top + 24,
            paddingBottom: 32,
            paddingHorizontal: 20,
            alignItems: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: theme.surface2,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -20,
              bottom: -20,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: theme.surface2,
            }}
          />

          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: PRIMARY,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              shadowColor: PRIMARY,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 12,
              overflow: "hidden",
            }}
          >
            {!testMode && user?.image ? (
              <Image
                source={{ uri: user.image }}
                style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
                resizeMode="cover"
              />
            ) : null}
            <Text style={{ fontSize: 36, fontWeight: "800", color: theme.surface1, opacity: !testMode && user?.image ? 0 : 1 }}>
              {testMode
                ? "🛺"
                : auth?.user?.email
                  ? auth.user.email.charAt(0).toUpperCase()
                  : "D"}
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.surface1 }}>
            {testMode ? "Guest Driver" : auth?.user?.email || "Driver"}
          </Text>
          <ProfileFetchNotice visible={!testMode && (profileLoading || driverProfileLoading)} />
          <View
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 99,
              backgroundColor: theme.accentDim,
            }}
          >
            <AutoRideIcon size={ICON.xs} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.surface1 }}>
              {testMode ? "Test Vehicle" : driver ? `${driver.vehicle_number} - ${getVehicleLabel(driver.vehicle_type)}` : "Registration pending"}
            </Text>
          </View>

          <View
            style={{
              marginTop: 14,
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 99,
              backgroundColor: testMode
                ? theme.accentDim
                : isSubscribed
                  ? SUCCESS_LIGHT
                  : theme.errDim,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: testMode ? theme.surface1 : isSubscribed ? SUCCESS : theme.err,
              }}
            >
              {testMode
                ? "🧪 Test Mode"
                : isSubscribed
                  ? `✅ Subscribed · ${Math.ceil((expiry - new Date()) / 86400000)} days left`
                  : "⚠️ No Active Subscription"}
            </Text>
          </View>
        </View>

        {!testMode ? (
          <View style={{ margin: 16, marginBottom: 0 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderColor: BORDER,
                borderRadius: 16,
                borderWidth: 1,
                padding: 16,
                gap: 14,
              }}
            >
              <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
                Driver media
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: theme.surface2,
                      borderColor: BORDER,
                      borderRadius: 14,
                      borderWidth: 1,
                      height: 112,
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {user?.image ? (
                      <Image source={{ uri: user.image }} style={{ height: "100%", width: "100%" }} resizeMode="cover" />
                    ) : (
                      <UserRound size={ICON.xl} color={TEXT_MUTED} />
                    )}
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={uploadingImage === "driver"}
                    onPress={() => uploadProfileImage("driver")}
                    style={{ alignItems: "center", backgroundColor: PRIMARY_LIGHT, borderRadius: 12, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 8, paddingVertical: 11 }}
                  >
                    <Camera size={ICON.sm} color={PRIMARY} />
                    <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "900" }}>
                      {uploadingImage === "driver" ? "Uploading..." : "Driver photo"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: theme.surface2,
                      borderColor: BORDER,
                      borderRadius: 14,
                      borderWidth: 1,
                      height: 112,
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {driver?.auto_photo_url ? (
                      <Image source={{ uri: driver.auto_photo_url }} style={{ height: "100%", width: "100%" }} resizeMode="cover" />
                    ) : (
                      <AutoRideIcon size={ICON.xl} />
                    )}
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={uploadingImage === "auto" || updateDriverPhoto.isPending}
                    onPress={() => uploadProfileImage("auto")}
                    style={{ alignItems: "center", backgroundColor: PRIMARY_LIGHT, borderRadius: 12, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 8, paddingVertical: 11 }}
                  >
                    <Camera size={ICON.sm} color={PRIMARY} />
                    <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "900" }}>
                      {uploadingImage === "auto" || updateDriverPhoto.isPending ? "Uploading..." : "Auto photo"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ backgroundColor: theme.surface2, borderColor: BORDER, borderRadius: 12, borderWidth: 1, padding: 12 }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Registration plate</Text>
                <Text style={{ color: TEXT, fontSize: 17, fontWeight: "900", marginTop: 3 }}>
                  {driver?.vehicle_number || "Not registered"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Account settings */}
        <View style={{ margin: 16, marginBottom: 0 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Account Settings
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                  Keep your contact number current for passenger calls and alerts.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsProfileOpen((value) => !value)}
                style={{
                  borderRadius: 999,
                  backgroundColor: PRIMARY_LIGHT,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>
                  {isProfileOpen ? "Hide" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            {isProfileOpen ? (
            <View style={{ marginTop: 16, gap: 12 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
                  Email
                </Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: BORDER,
                    backgroundColor: theme.surface2,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                  }}
                >
                  <Text style={{ color: TEXT_SECONDARY, fontSize: 14, fontWeight: "600" }}>
                    {testMode ? "Guest mode" : user?.email || "Not available"}
                  </Text>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 8 }}>
                  {t("profile.preferredLanguage")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {LANGUAGE_OPTIONS.map((language) => {
                    const selected = preferredLanguage === language.value;
                    return (
                      <TouchableOpacity
                        key={language.code}
                        onPress={() => setPreferredLanguage(language.value)}
                        disabled={testMode || updateProfile.isPending}
                        style={{
                          alignItems: "center",
                          backgroundColor: selected ? PRIMARY : theme.surface2,
                          borderColor: selected ? PRIMARY : BORDER,
                          borderRadius: 12,
                          borderWidth: 1,
                          flex: 1,
                          paddingVertical: 11,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? theme.surface1 : TEXT_SECONDARY,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {language.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
                  Phone Number
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  editable={!testMode && !updateProfile.isPending}
                  keyboardType="phone-pad"
                  placeholder="Add phone number"
                  placeholderTextColor={TEXT_MUTED}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: phone ? PRIMARY_BORDER : BORDER,
                    backgroundColor: SURFACE,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: TEXT,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={() => updateProfile.mutate()}
                disabled={testMode || updateProfile.isPending}
                style={{
                  borderRadius: 12,
                  backgroundColor: testMode ? theme.border : PRIMARY,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: updateProfile.isPending ? 0.7 : 1,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: theme.surface1, fontSize: 14, fontWeight: "800" }}>
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Text>
              </TouchableOpacity>
            </View>
            ) : (
              <View
                style={{
                  marginTop: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: BORDER,
                  backgroundColor: theme.surface2,
                  padding: 14,
                }}
              >
                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
                  Saved Contact
                </Text>
                <Text style={{ marginTop: 4, color: TEXT, fontSize: 15, fontWeight: "700" }}>
                  {phone || "No phone number added"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Vehicle info card - only if not test mode or driver exists */}
        {driver && !testMode && (
          <View style={{ margin: 16 }}>
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
                  Vehicle Details
                </Text>
                <Text style={{ fontSize: 12, color: theme.accentText, marginTop: 4 }}>
                  వాహన వివరాలు / वाहन विवरण
                </Text>
              </View>
              {[
                {
                  label: "Vehicle Number / వాహనం / वाहन",
                  value: driver.vehicle_number,
                  icon: AutoRideIcon,
                },
                {
                  label: "Contact Phone / ఫోన్ / फोन",
                  value: user?.phone || "Not added",
                  icon: Phone,
                },
                {
                  label: "Approval Status / అనుమతి / मंज़ूरी",
                  value: driver.is_approved ? "✅ Approved" : "⏳ Pending",
                  icon: Shield,
                },
                ...(expiry
                  ? [
                      {
                        label: "Subscription Expiry / గడువు / समाप्ति",
                        value: expiry.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }),
                        icon: Calendar,
                      },
                    ]
                  : []),
              ].map((item, i, arr) => (
                <View
                  key={i}
                  style={{
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: theme.surface2,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: theme.surface2,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <item.icon size={ICON.sm} color={TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: TEXT,
                        marginTop: 2,
                        fontWeight: "500",
                      }}
                    >
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Menu */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              overflow: "hidden",
            }}
          >
            <MenuItem
              icon={HelpCircle}
              label="Help & Support"
              sublabel="Driver assistance center"
              onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
            />
            <MenuItem
              icon={Shield}
              label="Driver Guidelines"
              sublabel="Rules & best practices"
              onPress={() => Linking.openURL(DRIVER_GUIDELINES_URL)}
            />
          </View>
        </View>

        {/* Exit test mode or Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          {testMode ? (
            <TouchableOpacity
              onPress={handleExitTestMode}
              style={{
                backgroundColor: theme.warnDim,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: theme.warnDim,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={ICON.sm} color={theme.warn} />
              <Text
                style={{ color: theme.warn, fontSize: 15, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowSignOutSheet(true)}
              style={{
                backgroundColor: theme.errDim,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.errDim,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <LogOut size={ICON.sm} color={theme.err} />
              <Text
                style={{ color: theme.err, fontSize: 15, fontWeight: "700" }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <SignOutSheet
          visible={showSignOutSheet}
          onCancel={() => setShowSignOutSheet(false)}
          onConfirm={async () => {
            setShowSignOutSheet(false);
            try {
              await signOut();
            } catch {
              Alert.alert("Sign out failed", "Could not sign out completely. Please try again.");
            }
          }}
        />

        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 28,
          }}
        >
          TukTukGo Driver Console v1.0 - India
        </Text>
      </ScrollView>
    </View>
  );
}

