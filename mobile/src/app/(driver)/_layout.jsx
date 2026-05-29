import { Tabs } from "expo-router";
import { Home, Wallet, User } from "lucide-react-native";

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E7E5E4",
          paddingTop: 8,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: "#F97316",
        tabBarInactiveTintColor: "#A8A29E",
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
              size={22}
              strokeWidth={color === "#F97316" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#F97316" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#F97316" ? 2.5 : 1.8}
            />
          ),
        }}
      />
    </Tabs>
  );
}
