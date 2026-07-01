import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Ticket, User, Wallet } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { theme } from "@/theme/tokens";

function TabIcon(Icon) {
  return function MobileTabIcon({ color, focused }) {
    return <Icon color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.8} />;
  };
}

export default function DriverLayout() {
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
        <Tabs.Screen name="index" options={{ title: "Drive", tabBarIcon: TabIcon(Home) }} />
        <Tabs.Screen name="wallet" options={{ title: "Earnings", tabBarIcon: TabIcon(Wallet) }} />
        <Tabs.Screen name="pass" options={{ title: "Pass", tabBarIcon: TabIcon(Ticket) }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ title: "Account", tabBarIcon: TabIcon(User) }} />
        <Tabs.Screen name="kyc-submit" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
