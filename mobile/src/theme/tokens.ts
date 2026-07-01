export const spacing = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
  6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "900" as const },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800" as const },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "800" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const },
} as const;

export const radii = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999,
} as const;

/** Passenger + Driver screens (light, teal accent) */
export const theme = {
  bg: "#EFF3F4",
  surface1: "#FFFFFF",
  surface2: "#F7F9FA",
  surface3: "#EFF3F4",
  border: "#D4E0E2",
  borderH: "#A8C2C6",
  accent: "#3BA8A3",
  accentDim: "rgba(59,168,163,0.12)",
  accentText: "#2A8A85",
  text1: "#152022",
  text2: "#4A6266",
  text3: "#7E979A",
  ok: "#2A7D52",
  okDim: "rgba(42,125,82,0.12)",
  err: "#B03030",
  errDim: "rgba(176,48,48,0.12)",
  warn: "#996A1A",
  warnDim: "rgba(153,106,26,0.12)",
  info: "#2D6A9A",
  infoDim: "rgba(45,106,154,0.12)",
  // Compatibility names for shared components; all point to this same light system.
  primary: "#3BA8A3",
  primaryDark: "#2A8A85",
  primaryText: "#2A8A85",
  primaryLight: "rgba(59,168,163,0.12)",
  primaryBorder: "#A8C2C6",
  background: "#EFF3F4",
  surface: "#FFFFFF",
  dark: "#152022",
  text: "#152022",
  textSecondary: "#4A6266",
  textMuted: "#7E979A",
  success: "#2A7D52",
  successLight: "rgba(42,125,82,0.12)",
  warning: "#996A1A",
  warningLight: "rgba(153,106,26,0.12)",
  error: "#B03030",
  errorLight: "rgba(176,48,48,0.12)",
  mutedSurface: "#F7F9FA",
  spacing,
  typography,
  radii,
  shadow: {
    card: {
      shadowColor: "#152022", shadowOpacity: 0.07,
      shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    elevated: {
      shadowColor: "#152022", shadowOpacity: 0.12,
      shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6,
    },
    accent: {
      shadowColor: "#3BA8A3", shadowOpacity: 0.28,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
    },
    glow: {
      shadowColor: "#3BA8A3", shadowOpacity: 0.28,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
    },
  },
} as const;

/** Admin screens only (dark, amber accent) */
export const adminTheme = {
  bg: "#0D0F12",
  surface1: "#151820",
  surface2: "#1C2028",
  surface3: "#242830",
  border: "rgba(255,255,255,0.10)",
  borderH: "rgba(255,255,255,0.18)",
  accent: "#F5A623",
  accentDim: "rgba(245,166,35,0.12)",
  text1: "#F0F2F5",
  text2: "#9299AA",
  text3: "#565C6E",
  ok: "#3A9E6A",
  okDim: "rgba(58,158,106,0.14)",
  err: "#D05050",
  errDim: "rgba(208,80,80,0.14)",
  warn: "#C99A3A",
  warnDim: "rgba(201,154,58,0.14)",
  info: "#4A88B8",
  infoDim: "rgba(74,136,184,0.14)",
  spacing,
  typography,
  radii,
  shadow: {
    card: {
      shadowColor: "#000", shadowOpacity: 0.30,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    elevated: {
      shadowColor: "#000", shadowOpacity: 0.45,
      shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
    },
    accent: {
      shadowColor: "#F5A623", shadowOpacity: 0.28,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
    },
  },
} as const;

export type AppTheme = typeof theme;
export type AdminTheme = typeof adminTheme;
