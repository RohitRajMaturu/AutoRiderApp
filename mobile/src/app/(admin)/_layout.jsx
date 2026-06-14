import { Tabs } from "expo-router";
import { BarChart3, FileText, Map, Users, Route } from "lucide-react-native";

export default function AdminLayout() {
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
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <BarChart3
              color={color}
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
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
              size={22}
              strokeWidth={color === "#43B8B3" ? 2.5 : 1.8}
            />
          ),
        }}
      />
    </Tabs>
  );
}

