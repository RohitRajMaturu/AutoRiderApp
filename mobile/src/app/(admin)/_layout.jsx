import { Tabs, useRootNavigationState, useRouter } from "expo-router";
import { BarChart3, FileText, Map, Users, Route } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { ICON } from "@/theme/iconScale";
import { useAuth } from "@/utils/auth/useAuth";
import useAppStore from "@/store/useAppStore";
import { useEffect } from "react";

export default function AdminLayout() {
  const theme = useTheme();
  const active = theme.accent;
  const { auth, isReady } = useAuth();
  const testMode = useAppStore((state) => state.testMode);
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const shouldLeaveProtectedArea = isReady && !auth && !testMode;
  const canNavigate = !!rootNavigationState?.key;

  useEffect(() => {
    if (shouldLeaveProtectedArea && canNavigate) {
      router.replace("/");
    }
  }, [canNavigate, router, shouldLeaveProtectedArea]);

  if (shouldLeaveProtectedArea) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface1,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingTop: 8,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: theme.text3,
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
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <BarChart3
              color={color}
              size={ICON.lg}
              strokeWidth={color === active ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: "Drivers",
          tabBarIcon: ({ color }) => (
            <Users
              color={color}
              size={ICON.lg}
              strokeWidth={color === active ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "Rides",
          tabBarIcon: ({ color }) => (
            <Route
              color={color}
              size={ICON.lg}
              strokeWidth={color === active ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="zones"
        options={{
          title: "Zones",
          tabBarIcon: ({ color }) => (
            <Map
              color={color}
              size={ICON.lg}
              strokeWidth={color === active ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: "Audit",
          tabBarIcon: ({ color }) => (
            <FileText
              color={color}
              size={ICON.lg}
              strokeWidth={color === active ? 2.5 : 1.5}
            />
          ),
        }}
      />
    </Tabs>
  );
}

