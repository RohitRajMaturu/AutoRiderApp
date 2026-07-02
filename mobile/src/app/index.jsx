import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../utils/auth/useAuth";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import {
  ArrowRight,
  Gauge,
  IndianRupee,
  ShieldCheck,
  UserRound,
  UserPlus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import TukTukGoLoader from "../components/TukTukGoLoader";
import { theme } from "@/theme/tokens";

const SAFFRON = theme.accent;
const INDIA_GREEN = theme.ok;
const DARK = theme.text1;
const TUKTUKGO_ICON = require("../../assets/images/icon.png");

export default function Index() {
  const { auth, signIn, signUp, isReady, isSigningOut } = useAuth();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoShineAnim = useRef(new Animated.Value(0)).current;
  const [selectedRole, setSelectedRole] = useState("passenger");
  const [transitioning, setTransitioning] = useState(false);
  const wasSigningOut = useRef(false);

  useEffect(() => {
    if (isSigningOut) {
      wasSigningOut.current = true;
      setTransitioning(true);
      return undefined;
    }
    if (wasSigningOut.current) {
      const timer = setTimeout(() => {
        wasSigningOut.current = false;
        setTransitioning(false);
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSigningOut]);

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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(logoShineAnim, {
        toValue: 1,
        duration: 3200,
        useNativeDriver: true,
      }),
    );

    logoShineAnim.setValue(0);
    animation.start();
    return () => animation.stop();
  }, [logoShineAnim]);

  if (!isReady || isSigningOut || transitioning) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
        }}
      >
        <TukTukGoLoader
          fullScreen
          label="Loading TukTukGo..."
          color={SAFFRON}
        />
      </View>
    );
  }

  if (auth) {
    const role = auth.user?.role || "passenger";
    if (role === "admin") return <Redirect href="/(admin)" />;
    if (role === "driver") return <Redirect href="/(driver)" />;
    return <Redirect href="/(passenger)" />;
  }

  const selectedRoleMeta =
    selectedRole === "driver"
      ? {
          id: "driver",
          label: "Driver",
          title: "Driver account",
          subtitle: "Register, verify KYC, then go online after approval.",
          Icon: Gauge,
          color: theme.ok,
          bg: theme.okDim,
          border: theme.okDim,
        }
      : {
          id: "passenger",
          label: "Passenger",
          title: "Passenger account",
          subtitle: "Book autos, track rides, and view trip history.",
          Icon: UserRound,
          color: SAFFRON,
          bg: theme.accentDim,
          border: theme.borderH,
        };
  const SelectedRoleIcon = selectedRoleMeta.Icon;

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <StatusBar style="light" />
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
          <View style={{ flex: 1, backgroundColor: theme.accentDim }} />
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
          <Animated.View
            style={{
              width: 104,
              height: 104,
              borderRadius: 30,
              backgroundColor: theme.text1,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 26,
              borderWidth: 1,
              borderColor: theme.accentDim,
              shadowColor: theme.text1,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.34,
              shadowRadius: 22,
              elevation: 12,
              overflow: "hidden",
            }}
          >
            <Image
              source={TUKTUKGO_ICON}
              style={{
                width: 96,
                height: 96,
                borderRadius: 27,
              }}
              resizeMode="cover"
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 4,
                borderRadius: 27,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  top: -44,
                  left: -54,
                  width: 34,
                  height: 190,
                  backgroundColor: theme.surface1,
                  opacity: logoShineAnim.interpolate({
                    inputRange: [0, 0.18, 0.34, 1],
                    outputRange: [0, 0.32, 0, 0],
                  }),
                  transform: [
                    { rotate: "24deg" },
                    {
                      translateX: logoShineAnim.interpolate({
                        inputRange: [0, 0.34, 1],
                        outputRange: [-12, 168, 168],
                      }),
                    },
                  ],
                }}
              />
              <Animated.View
                style={{
                  position: "absolute",
                  left: 14,
                  right: 14,
                  bottom: 14,
                  height: 20,
                  borderRadius: 999,
                  backgroundColor: theme.accent,
                  opacity: logoShineAnim.interpolate({
                    inputRange: [0, 0.45, 0.6, 0.8, 1],
                    outputRange: [0.04, 0.04, 0.18, 0.04, 0.04],
                  }),
                  transform: [
                    {
                      scaleX: logoShineAnim.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [0.72, 1, 0.72],
                      }),
                    },
                  ],
                }}
              />
            </View>
          </Animated.View>

          <Text
            style={{
              fontSize: 42,
              fontWeight: "800",
              color: theme.surface1,
              letterSpacing: 0,
            }}
          >
            <Text style={{ color: theme.accent }}>Tuk</Text>TukGo
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: theme.text3,
              marginTop: 12,
              lineHeight: 24,
            }}
          >
            India&apos;s simplest auto-rickshaw{"\n"}ride connection platform
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 32 }}>
            {[
              { label: "Instant", Icon: Gauge },
              { label: "Safe", Icon: ShieldCheck },
              { label: "Fair", Icon: IndianRupee },
            ].map(({ label, Icon }) => (
              <View
                key={label}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: theme.accentDim,
                  borderWidth: 1,
                  borderColor: theme.accentDim,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon size={13} color={theme.text2} />
                <Text style={{ fontSize: 12, color: theme.text2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: theme.surface1,
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
              fontWeight: "800",
              color: theme.text1,
              marginBottom: 6,
            }}
          >
            Get started
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.text2,
              marginBottom: 18,
              lineHeight: 20,
            }}
          >
            Choose your role once, then continue with the right account flow.
          </Text>

          <View
            style={{
              backgroundColor: theme.surface2,
              borderColor: theme.border,
              borderRadius: 18,
              borderWidth: 1,
              flexDirection: "row",
              gap: 6,
              marginBottom: 14,
              padding: 5,
            }}
          >
            {[
              { id: "passenger", label: "Passenger", Icon: UserRound },
              { id: "driver", label: "Driver", Icon: Gauge },
            ].map((item) => {
              const selected = selectedRole === item.id;
              const RoleIcon = item.Icon;
              const color = item.id === "driver" ? theme.ok : SAFFRON;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setSelectedRole(item.id)}
                  style={{
                    alignItems: "center",
                    backgroundColor: selected ? color : "transparent",
                    borderRadius: 13,
                    flex: 1,
                    flexDirection: "row",
                    gap: 5,
                    justifyContent: "center",
                    minHeight: 42,
                  }}
                  activeOpacity={0.86}
                >
                  <RoleIcon size={16} color={selected ? theme.surface1 : color} />
                  <Text
                    style={{
                      color: selected ? theme.surface1 : theme.text2,
                      fontSize: 12,
                      fontWeight: "900",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={{
              backgroundColor: selectedRoleMeta.bg,
              borderColor: selectedRoleMeta.border,
              borderRadius: 18,
              borderWidth: 1,
              flexDirection: "row",
              gap: 12,
              marginBottom: 14,
              padding: 14,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.surface1,
                borderRadius: 14,
                height: 44,
                justifyContent: "center",
                width: 44,
              }}
            >
              <SelectedRoleIcon size={22} color={selectedRoleMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text1, fontSize: 15, fontWeight: "900" }}>
                {selectedRoleMeta.title}
              </Text>
              <Text style={{ color: theme.text2, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                {selectedRoleMeta.subtitle}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => signIn({ params: { role: selectedRole } })}
            style={{
              backgroundColor: selectedRoleMeta.color,
              borderRadius: 14,
              alignItems: "center",
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              paddingVertical: 16,
              shadowColor: selectedRoleMeta.color,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
              elevation: 7,
            }}
            activeOpacity={0.85}
          >
            <ArrowRight size={18} color={theme.surface1} />
            <Text style={{ color: theme.surface1, fontSize: 16, fontWeight: "900" }}>
              Sign in as {selectedRoleMeta.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => signUp({ params: { role: selectedRole } })}
            style={{
              borderColor: selectedRoleMeta.border,
              borderRadius: 14,
              borderWidth: 1,
              alignItems: "center",
              backgroundColor: theme.surface1,
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              marginTop: 10,
              paddingVertical: 14,
            }}
            activeOpacity={0.85}
          >
            <UserPlus size={18} color={selectedRoleMeta.color} />
            <Text style={{ color: selectedRoleMeta.color, fontSize: 14, fontWeight: "900" }}>
              Create {selectedRoleMeta.label} Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => signIn({ params: { role: "admin" } })}
            activeOpacity={0.72}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 6,
              justifyContent: "center",
              marginTop: 14,
              paddingVertical: 4,
            }}
          >
            <ShieldCheck size={14} color={theme.text3} />
            <Text style={{ color: theme.text3, fontSize: 12, fontWeight: "700" }}>
              Platform admin sign in
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              color: theme.text3,
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

