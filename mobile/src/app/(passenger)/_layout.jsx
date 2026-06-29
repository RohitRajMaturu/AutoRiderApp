import { Tabs } from "expo-router";
import { View } from "react-native";
import { Bell, Home, Clock, User } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/utils/auth/useAuth";
import useNotificationStore, { notificationOwnerKey } from "@/store/useNotificationStore";

export default function PassengerLayout() {
  const { t } = useLanguage();
  const { auth } = useAuth();
  const ownerKey = notificationOwnerKey(auth);
  const unreadCount = useNotificationStore((state) =>
    state.notifications.filter((item) => item.ownerKey === ownerKey && !item.read).length,
  );
  return (
    <View style={{ flex: 1 }}>
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
          title: t("nav.home"),
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
          title: t("nav.rides"),
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
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unreadCount ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#DC2626", color: "#FFFFFF", fontSize: 10 },
          tabBarIcon: ({ color }) => (
            <Bell
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
          title: t("nav.profile"),
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
    </View>
  );
}

