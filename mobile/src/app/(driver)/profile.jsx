import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  LogOut,
  Phone,
  Car,
  Shield,
  ChevronRight,
  HelpCircle,
  Calendar,
  FlaskConical,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import useAppStore from "@/store/useAppStore";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#43B8B3";
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
const SUPPORT_WHATSAPP_URL = `https://wa.me/${process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "919999999999"}`;
const DRIVER_GUIDELINES_URL = process.env.EXPO_PUBLIC_GUIDELINES_URL ?? "#";

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
        borderBottomColor: "#F5F5F4",
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: "#F5F5F4",
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

function SignOutSheet({ visible, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "#00000066",
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
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <LogOut size={ICON.lg} color="#DC2626" />
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
                backgroundColor: "#DC2626",
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const { signOut, auth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { testMode, disableTestMode } = useAppStore();
  const [phone, setPhone] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(true);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: profile } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  const { data: driverData } = useQuery({
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
    }
  }, [testMode, user?.phone]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save profile");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", authUserKey] });
      setIsProfileOpen(false);
    },
    onError: (err) => Alert.alert("Save Failed", err.message),
  });

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
              backgroundColor: "#FFFBEB",
              paddingTop: insets.top + 8,
              paddingBottom: 10,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <FlaskConical size={ICON.sm} color="#B88700" />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: "#286B68",
                fontWeight: "600",
              }}
            >
              🧪 Test Mode Active — Tap to Sign In with real account
            </Text>
            <Text style={{ fontSize: 12, color: "#B88700", fontWeight: "700" }}>
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
              backgroundColor: "#FFFFFF08",
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
              backgroundColor: "#FFFFFF05",
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
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#fff" }}>
              {testMode
                ? "🛺"
                : auth?.user?.email
                  ? auth.user.email.charAt(0).toUpperCase()
                  : "D"}
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff" }}>
            {testMode ? "Guest Driver" : auth?.user?.email || "Driver"}
          </Text>
          <View
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 99,
              backgroundColor: "#FFFFFF15",
            }}
          >
            <Car size={ICON.xs} color={PRIMARY} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
              {testMode ? "Test Vehicle" : driver?.vehicle_number || "Driver"}
            </Text>
          </View>

          <View
            style={{
              marginTop: 14,
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 99,
              backgroundColor: testMode
                ? "#FFFFFF20"
                : isSubscribed
                  ? SUCCESS_LIGHT
                  : "#FEE2E2",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: testMode ? "#fff" : isSubscribed ? SUCCESS : "#DC2626",
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
                    backgroundColor: "#F5F5F4",
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
                  backgroundColor: testMode ? "#BFD1D3" : PRIMARY,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: updateProfile.isPending ? 0.7 : 1,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
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
                  backgroundColor: "#F8FAFA",
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
                <Text style={{ fontSize: 12, color: "#286B68", marginTop: 4 }}>
                  వాహన వివరాలు / वाहन विवरण
                </Text>
              </View>
              {[
                {
                  label: "Vehicle Number / వాహనం / वाहन",
                  value: driver.vehicle_number,
                  icon: Car,
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
                    borderBottomColor: "#F5F5F4",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "#F5F5F4",
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
                backgroundColor: "#FFFBEB",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: "#FDE68A",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={ICON.sm} color="#B88700" />
              <Text
                style={{ color: "#B88700", fontSize: 15, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowSignOutSheet(true)}
              style={{
                backgroundColor: "#FEF2F2",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FECACA",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <LogOut size={ICON.sm} color="#DC2626" />
              <Text
                style={{ color: "#DC2626", fontSize: 15, fontWeight: "700" }}
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
            await signOut();
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

