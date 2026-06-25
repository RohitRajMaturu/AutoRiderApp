import { Tabs } from "expo-router";
import { View } from "react-native";
import TestModeBackButton from "@/components/TestModeBackButton";
import { Home, Wallet, User } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";

export default function DriverLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TestModeBackButton />
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
          title: "Dashboard",
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
        name="wallet"
        options={{
          title: "Subscription",
          tabBarIcon: ({ color }) => (
            <Wallet
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
      <Tabs.Screen
        name="kyc-submit"
        options={{
          href: null,
        }}
      />
      </Tabs>
    </View>
  );
}
