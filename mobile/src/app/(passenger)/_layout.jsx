import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Home, Ticket, User } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { theme } from "@/theme/tokens";

function TabIcon(Icon) {
  return function MobileTabIcon({ color, focused }) {
    return <Icon color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} />;
  };
}

export default function PassengerLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.text3,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
          tabBarStyle: {
            backgroundColor: theme.surface1,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            paddingHorizontal: 4,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Book", tabBarIcon: TabIcon(Home) }} />
        <Tabs.Screen name="rides" options={{ title: "Trips", tabBarIcon: TabIcon(Clock) }} />
        <Tabs.Screen name="pass" options={{ title: "Pass", tabBarIcon: TabIcon(Ticket) }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ title: "Account", tabBarIcon: TabIcon(User) }} />
      </Tabs>
    </View>
  );
}
