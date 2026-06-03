import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../utils/auth/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
} from "react-native";
import {
  ArrowRight,
  CircleDollarSign,
  FlaskConical,
  Gauge,
  ShieldCheck,
  UserRound,
  CarFront,
  Settings,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import useAppStore from "../store/useAppStore";

const SAFFRON = "#F97316";
const INDIA_GREEN = "#138808";
const DARK = "#1C1917";

function RolePickerModal({ visible, onClose, onSelect }) {
  const roles = [
    {
      id: "passenger",
      Icon: UserRound,
      title: "Passenger",
      desc: "Book autos, track rides, call drivers",
      color: SAFFRON,
      bg: "#FFF7ED",
      border: "#FED7AA",
    },
    {
      id: "driver",
      Icon: CarFront,
      title: "Driver",
      desc: "Go online, accept rides, manage subscription",
      color: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
    },
    {
      id: "admin",
      Icon: Settings,
      title: "Admin",
      desc: "Dashboard, driver approvals, analytics",
      color: "#2563EB",
      bg: "#EFF6FF",
      border: "#BFDBFE",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "#00000060",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 28,
              paddingBottom: 40,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E7E5E4",
                alignSelf: "center",
                marginBottom: 24,
              }}
            />

            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: DARK,
                marginBottom: 6,
                letterSpacing: 0,
              }}
            >
              Choose Role to Test
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#78716C",
                marginBottom: 24,
                lineHeight: 20,
              }}
            >
              Explore each section of the app without signing in. API calls may show empty data.
            </Text>

            <View
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#FDE68A",
                padding: 12,
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FlaskConical size={18} color="#92400E" />
              <Text
                style={{
                  fontSize: 12,
                  color: "#92400E",
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                Test mode - UI is fully functional. Sign in with a real account to use live data.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  onPress={() => onSelect(role.id)}
                  style={{
                    backgroundColor: role.bg,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: role.border,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: "#fff",
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 6,
                      elevation: 2,
                    }}
                  >
                    <role.Icon size={26} color={role.color} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: role.color,
                      }}
                    >
                      {role.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#78716C",
                        marginTop: 3,
                        lineHeight: 18,
                      }}
                    >
                      {role.desc}
                    </Text>
                  </View>
                  <ArrowRight size={20} color={role.color} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Index() {
  const { auth, signIn, isReady } = useAuth();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [showRolePicker, setShowRolePicker] = useState(false);

  const { testMode, testRole, testModeLoaded, loadTestMode, enableTestMode } = useAppStore();

  useEffect(() => {
    loadTestMode();
  }, [loadTestMode]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const { data, isLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const response = await fetch("/api/user-profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    enabled: !!auth,
  });

  if (!testModeLoaded || !isReady || (auth && isLoading)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFBF5",
        }}
      >
        <ActivityIndicator size="large" color={SAFFRON} />
        <Text style={{ marginTop: 12, fontSize: 14, color: "#78716C" }}>
          Loading Auto Ride...
        </Text>
      </View>
    );
  }

  if (testMode && testRole) {
    if (testRole === "admin") return <Redirect href="/(admin)" />;
    if (testRole === "driver") return <Redirect href="/(driver)" />;
    return <Redirect href="/(passenger)" />;
  }

  if (auth) {
    const role = data?.user?.role || "passenger";
    if (role === "admin") return <Redirect href="/(admin)" />;
    if (role === "driver") return <Redirect href="/(driver)" />;
    return <Redirect href="/(passenger)" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <StatusBar style="light" />
      <RolePickerModal
        visible={showRolePicker}
        onClose={() => setShowRolePicker(false)}
        onSelect={async (role) => {
          setShowRolePicker(false);
          await enableTestMode(role);
        }}
      />

      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <View
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: SAFFRON,
            opacity: 0.08,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 100,
            left: -80,
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: SAFFRON,
            opacity: 0.05,
          }}
        />

        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            flexDirection: "row",
          }}
        >
          <View style={{ flex: 1, backgroundColor: SAFFRON }} />
          <View style={{ flex: 1, backgroundColor: "#FFFFFF22" }} />
          <View style={{ flex: 1, backgroundColor: INDIA_GREEN }} />
        </View>

        <Animated.View
          style={{
            paddingHorizontal: 32,
            paddingTop: insets.top + 60,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: SAFFRON,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 28,
              shadowColor: SAFFRON,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 40 }}>🛺</Text>
          </View>

          <Text
            style={{
              fontSize: 42,
              fontWeight: "800",
              color: "#FFFFFF",
              letterSpacing: 0,
            }}
          >
            Auto{"\n"}
            <Text style={{ color: SAFFRON }}>Ride</Text>
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#A8A29E",
              marginTop: 12,
              lineHeight: 24,
            }}
          >
            India's simplest auto-rickshaw{"\n"}ride connection platform
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 32 }}>
            {[
              { label: "Instant", Icon: Gauge },
              { label: "Safe", Icon: ShieldCheck },
              { label: "Fair", Icon: CircleDollarSign },
            ].map(({ label, Icon }) => (
              <View
                key={label}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: "#FFFFFF12",
                  borderWidth: 1,
                  borderColor: "#FFFFFF18",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon size={13} color="#D6D3D1" />
                <Text style={{ fontSize: 12, color: "#D6D3D1" }}>{label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: 28,
            paddingTop: 36,
            paddingBottom: insets.bottom + 28,
            marginTop: 60,
            opacity: fadeAnim,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "#1C1917",
              marginBottom: 6,
            }}
          >
            Get Started
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#78716C",
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            Sign in to book an auto or start earning as a driver today.
          </Text>

          <TouchableOpacity
            onPress={() => signIn()}
            style={{
              backgroundColor: SAFFRON,
              borderRadius: 14,
              paddingVertical: 17,
              alignItems: "center",
              shadowColor: SAFFRON,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 8,
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: "700",
                letterSpacing: 0,
              }}
            >
              Continue with Email / Number
            </Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginVertical: 18,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
            <Text style={{ fontSize: 12, color: "#A8A29E", fontWeight: "600" }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
          </View>

          <TouchableOpacity
            onPress={() => setShowRolePicker(true)}
            style={{
              backgroundColor: "#F5F5F4",
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "#E7E5E4",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            <FlaskConical size={18} color="#44403C" />
            <Text style={{ color: "#44403C", fontSize: 15, fontWeight: "700" }}>
              Skip Sign In - Test App
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#A8A29E",
              marginTop: 16,
              lineHeight: 16,
            }}
          >
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
