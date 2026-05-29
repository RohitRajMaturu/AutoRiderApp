import { Tabs } from "expo-router";
import { Home, Clock, User } from "lucide-react-native";

export default function PassengerLayout() {
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
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home
              color={color}
              size={22}
              strokeWidth={color === "#F97316" ? 2.5 : 1.8}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "My Rides",
          tabBarIcon: ({ color, size }) => (
            <Clock
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
          tabBarIcon: ({ color, size }) => (
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
