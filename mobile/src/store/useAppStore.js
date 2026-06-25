import { create } from "zustand";

const useAppStore = create((set) => ({
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
  location: null,
  setLocation: (location) => set({ location }),
  activeRide: null,
  setActiveRide: (activeRide) => set({ activeRide }),
  isDriverOnline: false,
  setDriverOnline: (isDriverOnline) => set({ isDriverOnline }),
  resetSessionState: () =>
    set({
      location: null,
      activeRide: null,
      isDriverOnline: false,
    }),
}));

export default useAppStore;
