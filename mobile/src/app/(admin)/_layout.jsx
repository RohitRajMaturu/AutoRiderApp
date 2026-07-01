import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, FileText, Map, Route, Users } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { adminTheme } from "@/theme/tokens";

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: adminTheme.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: adminTheme.accent,
          tabBarInactiveTintColor: adminTheme.text3,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
          tabBarStyle: {
            backgroundColor: adminTheme.surface1,
            borderTopColor: adminTheme.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            paddingHorizontal: 4,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, focused }) => <BarChart3 color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} /> }} />
        <Tabs.Screen name="drivers" options={{ title: "Drivers", tabBarIcon: ({ color, focused }) => <Users color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} /> }} />
        <Tabs.Screen name="rides" options={{ title: "Rides", tabBarIcon: ({ color, focused }) => <Route color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} /> }} />
        <Tabs.Screen name="zones" options={{ title: "Zones", tabBarIcon: ({ color, focused }) => <Map color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} /> }} />
        <Tabs.Screen name="audit" options={{ title: "Audit", tabBarIcon: ({ color, focused }) => <FileText color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} /> }} />
      </Tabs>
    </View>
  );
}
