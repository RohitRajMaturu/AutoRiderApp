import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TEST_MODE_KEY = "@autoconnect_test_mode";
const TEST_ROLE_KEY = "@autoconnect_test_role";

function isTestModeAllowed() {
  const envEnabled =
    typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_ENABLE_TEST_MODE === "true";
  return (
    typeof __DEV__ !== "undefined" && __DEV__
  ) || envEnabled;
}

const useAppStore = create((set, get) => ({
  // Theme
  theme: {
    primary: "#43B8B3",
    primaryDark: "#339E9A",
    primaryLight: "#E7F6F4",
    primaryBorder: "#BFE5E0",
    bg: "#EAF0F1",
    surface: "#FFFFFF",
    border: "#D8E4E5",
    borderLight: "#F7FBFA",
    text: "#17272B",
    textSecondary: "#586C70",
    textMuted: "#647678",
    success: "#16A34A",
    successLight: "#DCFCE7",
    warning: "#B88700",
    warningLight: "#FEF3C7",
    error: "#DC2626",
    errorLight: "#FEE2E2",
    info: "#2563EB",
    infoLight: "#EFF6FF",
  },

  // Driver location
  location: null,
  setLocation: (loc) => set({ location: loc }),

  // Active ride for passenger
  activeRide: null,
  setActiveRide: (ride) => set({ activeRide: ride }),

  // Driver online status (local cache)
  isDriverOnline: false,
  setDriverOnline: (val) => set({ isDriverOnline: val }),

  resetSessionState: () =>
    set({
      location: null,
      activeRide: null,
      isDriverOnline: false,
    }),

  // ── Test / Guest Mode ──────────────────────────────────────────
  testMode: false,
  testRole: null, // "passenger" | "driver" | "admin"
  testModeLoaded: false,
  isTestModeAllowed: isTestModeAllowed(),

  loadTestMode: async () => {
    try {
      if (!isTestModeAllowed()) {
        await Promise.all([
          AsyncStorage.removeItem(TEST_MODE_KEY),
          AsyncStorage.removeItem(TEST_ROLE_KEY),
        ]);
        set({ testMode: false, testRole: null, testModeLoaded: true });
        return;
      }
      const [mode, role] = await Promise.all([
        AsyncStorage.getItem(TEST_MODE_KEY),
        AsyncStorage.getItem(TEST_ROLE_KEY),
      ]);
      set({
        testMode: mode === "true",
        testRole: role || "passenger",
        testModeLoaded: true,
      });
    } catch {
      set({ testModeLoaded: true });
    }
  },

  enableTestMode: async (role) => {
    if (!isTestModeAllowed()) {
      set({ testMode: false, testRole: null, testModeLoaded: true });
      return;
    }
    try {
      await Promise.all([
        AsyncStorage.setItem(TEST_MODE_KEY, "true"),
        AsyncStorage.setItem(TEST_ROLE_KEY, role),
      ]);
    } catch {}
    set({ testMode: true, testRole: role });
  },

  disableTestMode: async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TEST_MODE_KEY),
        AsyncStorage.removeItem(TEST_ROLE_KEY),
      ]);
    } catch {}
    set({ testMode: false, testRole: null });
  },
}));

export default useAppStore;
