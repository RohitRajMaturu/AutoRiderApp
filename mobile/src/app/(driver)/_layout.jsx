import { Tabs } from "expo-router";
import { View } from "react-native";
import { Home, Ticket, User, Wallet } from "lucide-react-native";
import { ICON } from "@/theme/iconScale";

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveBackgroundColor: "#E7F6F4",
  tabBarActiveTintColor: "#2E9C97",
  tabBarHideOnKeyboard: true,
  tabBarInactiveTintColor: "#647678",
  tabBarItemStyle: {
    borderRadius: 14,
    marginHorizontal: 2,
    marginVertical: 5,
  },
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 0,
  },
  tabBarStyle: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#D8E4E5",
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 6,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
};

function tabIcon(Icon) {
  return function TabIcon({ color, focused }) {
    return <Icon color={color} size={ICON.lg} strokeWidth={focused ? 2.5 : 1.7} />;
  };
}

export default function DriverLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={tabScreenOptions}>
        <Tabs.Screen
          name="index"
          options={{ title: "Drive", tabBarIcon: tabIcon(Home) }}
        />
        <Tabs.Screen
          name="wallet"
          options={{ title: "Earnings", tabBarIcon: tabIcon(Wallet) }}
        />
        <Tabs.Screen
          name="pass"
          options={{ title: "Pass", tabBarIcon: tabIcon(Ticket) }}
        />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen
          name="profile"
          options={{ title: "Account", tabBarIcon: tabIcon(User) }}
        />
        <Tabs.Screen name="kyc-submit" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
