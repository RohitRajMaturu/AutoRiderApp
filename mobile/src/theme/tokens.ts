export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "900" },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800" },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
} as const;

export const theme = {
  primary: "#43B8B3",
  primaryDark: "#339E9A",
  primaryText: "#2E9C97",
  primaryLight: "#E7F6F4",
  primaryBorder: "#BFE5E0",
  background: "#EAF0F1",
  surface: "#FFFFFF",
  dark: "#17272B",
  text: "#17272B",
  textSecondary: "#586C70",
  textMuted: "#647678",
  success: "#16A34A",
  successLight: "#DCFCE7",
  warning: "#B88700",
  warningLight: "#FEF3C7",
  error: "#DC2626",
  errorLight: "#FEE2E2",
  gold: "#F3B51B",
  border: "#D8E4E5",
  mutedSurface: "#F5F5F4",
  spacing,
  typography,
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: "#17272B",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    glow: {
      shadowColor: "#43B8B3",
      shadowOpacity: 0.32,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
  },
} as const;

export type AppTheme = typeof theme;
export type ThemeSpacing = keyof typeof spacing;
export type TypographyToken = keyof typeof typography;
