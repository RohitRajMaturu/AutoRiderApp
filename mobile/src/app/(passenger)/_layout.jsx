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
          tabBarIcon: ({ color, size }) => (
            <Home
              color={color}
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
            />
          ),
        }}
      />
    </Tabs>
  );
}

