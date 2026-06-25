import { Tabs } from "expo-router";
import { View } from "react-native";
import { Home, Clock, User } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PassengerLayout() {
  const { t } = useLanguage();
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

