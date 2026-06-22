import { useEffect } from "react";
import { Tabs, useRootNavigationState, useRouter } from "expo-router";
import { View } from "react-native";
import { Home, Clock, User } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { useAuth } from "@/utils/auth/useAuth";
import useAppStore from "@/store/useAppStore";

export default function PassengerLayout() {
  const { auth, isReady } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const testMode = useAppStore((state) => state.testMode);

  const isProtected = isReady && !auth && !testMode;

  useEffect(() => {
    if (isProtected && rootNavigationState?.key) {
      router.replace("/");
    }
  }, [isProtected, rootNavigationState?.key, router]);

  if (isProtected) {
    return <View style={{ flex: 1, backgroundColor: "#EAF0F1" }} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#D8E4E5",
          paddingTop: 8,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: "#43B8B3",
        tabBarInactiveTintColor: "#647678",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home
              color={color}
              size={ICON.lg}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "My Rides",
          tabBarIcon: ({ color }) => (
            <Clock
              color={color}
              size={ICON.lg}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User
              color={color}
              size={ICON.lg}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.5}
            />
          ),
        }}
      />
    </Tabs>
  );
}

