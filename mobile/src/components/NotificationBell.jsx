import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useAuth } from "@/utils/auth/useAuth";
import useNotificationStore, { notificationOwnerKey } from "@/store/useNotificationStore";
import { ICON } from "@/theme/iconScale";

export default function NotificationBell() {
  const router = useRouter();
  const { auth } = useAuth();
  const ownerKey = notificationOwnerKey(auth);
  const unreadCount = useNotificationStore((state) =>
    state.notifications.filter((item) => item.ownerKey === ownerKey && !item.read).length,
  );
  const notificationsRoute =
    auth?.user?.role === "driver" ? "/(driver)/notifications" : "/(passenger)/notifications";

  return (
    <TouchableOpacity
      onPress={() => router.push(notificationsRoute)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
      style={{
        alignItems: "center",
        backgroundColor: "#E7F6F4",
        borderColor: "#BFE5E0",
        borderRadius: 13,
        borderWidth: 1,
        height: 42,
        justifyContent: "center",
        width: 42,
      }}
    >
      <Bell color="#2E9C97" size={ICON.md} strokeWidth={2.2} />
      {unreadCount ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#DC2626",
            borderColor: "#FFFFFF",
            borderRadius: 9,
            borderWidth: 2,
            height: 18,
            justifyContent: "center",
            minWidth: 18,
            paddingHorizontal: 3,
            position: "absolute",
            right: -4,
            top: -5,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
