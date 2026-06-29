import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const MAX_NOTIFICATIONS = 100;

export function notificationOwnerKey(auth) {
  return auth?.user?.id || auth?.user?.email || auth?.user?.phone || null;
}

const useNotificationStore = create(
  persist(
    (set) => ({
      notifications: [],
      addNotification: (notification) =>
        set((state) => {
          const ownerKey = notification?.ownerKey;
          const title = String(notification?.title || "").trim();
          if (!ownerKey || !title) return state;

          const dedupeKey = notification.dedupeKey
            ? `${ownerKey}:${notification.dedupeKey}`
            : null;
          if (
            dedupeKey &&
            state.notifications.some((item) => item.dedupeKey === dedupeKey)
          ) {
            return state;
          }

          const createdAt = notification.createdAt || new Date().toISOString();
          const item = {
            id: notification.id || `${ownerKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ownerKey,
            dedupeKey,
            title,
            body: String(notification.body || "").trim(),
            type: notification.type || "general",
            rideId: notification.rideId || null,
            createdAt,
            read: false,
          };

          return {
            notifications: [item, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
          };
        }),
      markAllRead: (ownerKey) =>
        set((state) => ({
          notifications: state.notifications.map((item) =>
            item.ownerKey === ownerKey ? { ...item, read: true } : item,
          ),
        })),
      clearNotifications: (ownerKey) =>
        set((state) => ({
          notifications: state.notifications.filter((item) => item.ownerKey !== ownerKey),
        })),
      resetNotifications: () => set({ notifications: [] }),
    }),
    {
      name: "tuktukgo-in-app-notifications-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ notifications: state.notifications }),
    },
  ),
);

export function addInAppNotification(notification) {
  useNotificationStore.getState().addNotification(notification);
}

export default useNotificationStore;
