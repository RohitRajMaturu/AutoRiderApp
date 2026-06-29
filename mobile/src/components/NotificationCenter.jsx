import { useEffect, useMemo } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { Bell, CheckCheck, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import useNotificationStore, { notificationOwnerKey } from "@/store/useNotificationStore";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#43B8B3";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function NotificationCenter() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const ownerKey = notificationOwnerKey(auth);
  const allNotifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const notifications = useMemo(
    () => allNotifications.filter((item) => item.ownerKey === ownerKey),
    [allNotifications, ownerKey],
  );

  useEffect(() => {
    if (!ownerKey || notifications.length === 0) return;
    markAllRead(ownerKey);
  }, [markAllRead, notifications.length, ownerKey]);

  const confirmClear = () => {
    Alert.alert("Clear notifications?", "This removes the notification history on this device.", [
      { text: "Keep", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearNotifications(ownerKey) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#E7F6F4", alignItems: "center", justifyContent: "center" }}>
          <Bell size={ICON.md} color={PRIMARY} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT }}>Notifications</Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>Ride updates saved on this device</Text>
        </View>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={confirmClear} accessibilityRole="button" accessibilityLabel="Clear notification history" hitSlop={8}>
            <Trash2 size={ICON.md} color={TEXT_MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 18), flexGrow: notifications.length ? 0 : 1 }}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: item.read ? BORDER : "#BFE5E0", padding: 14, marginBottom: 10, flexDirection: "row", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: item.read ? "#F1F5F5" : "#E7F6F4", alignItems: "center", justifyContent: "center" }}>
              {item.read ? <CheckCheck size={ICON.sm} color={TEXT_MUTED} /> : <Bell size={ICON.sm} color={PRIMARY} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "900", color: TEXT }}>{item.title}</Text>
                <Text style={{ fontSize: 10, color: TEXT_MUTED }}>{formatNotificationTime(item.createdAt)}</Text>
              </View>
              {item.body ? <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_SECONDARY, marginTop: 4 }}>{item.body}</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingBottom: 70 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER }}>
              <Bell size={32} color={TEXT_MUTED} />
            </View>
            <Text style={{ color: TEXT, fontSize: 17, fontWeight: "900", marginTop: 18 }}>No notifications yet</Text>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 }}>
              Booking, fare, cancellation, ride-start and completion updates will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
