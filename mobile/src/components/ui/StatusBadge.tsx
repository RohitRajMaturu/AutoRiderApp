import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme as defaultTheme, useTheme } from "@/theme/ThemeContext";

type StatusConfig = Record<
  string,
  {
    bg: string;
    text: string;
    label: string;
    icon?: React.ReactNode;
  }
>;

type StatusBadgeProps = {
  status: string;
  config: StatusConfig;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export const RIDE_STATUS_CONFIG = {
  requested: { bg: defaultTheme.warnDim, text: defaultTheme.warn, label: "Finding Driver" },
  negotiating: { bg: "#E0F2FE", text: "#0369A1", label: "Negotiating" },
  accepted: { bg: defaultTheme.accentDim, text: defaultTheme.accent, label: "Accepted" },
  in_progress: { bg: defaultTheme.okDim, text: defaultTheme.ok, label: "On Trip" },
  completed: { bg: defaultTheme.okDim, text: defaultTheme.ok, label: "Completed" },
  cancelled: { bg: defaultTheme.errDim, text: defaultTheme.err, label: "Cancelled" },
} satisfies StatusConfig;

export const DRIVER_STATUS_CONFIG = {
  online: { bg: defaultTheme.okDim, text: defaultTheme.ok, label: "Online" },
  idle: { bg: defaultTheme.okDim, text: defaultTheme.ok, label: "Idle" },
  on_trip: { bg: defaultTheme.accentDim, text: defaultTheme.accent, label: "On Trip" },
  offline: { bg: defaultTheme.surface3, text: defaultTheme.text3, label: "Offline" },
  pending: { bg: defaultTheme.warnDim, text: defaultTheme.warn, label: "Pending" },
} satisfies StatusConfig;

export function StatusBadge({ status, config, label, style }: StatusBadgeProps) {
  const theme = useTheme();
  const badge = config[status] ?? {
    bg: theme.mutedSurface,
    text: theme.textSecondary,
    label: status,
  };

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={[
        {
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: badge.bg,
          borderRadius: theme.radii.pill,
          flexDirection: "row",
          gap: theme.spacing[1],
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[1],
        },
        style,
      ]}
    >
      {badge.icon}
      <Text style={[theme.typography.micro, { color: badge.text }]}>
        {label || badge.label}
      </Text>
    </View>
  );
}

export function getRideStatusConfig(theme: ReturnType<typeof useTheme>): StatusConfig {
  return {
    requested: { bg: theme.warnDim, text: theme.warn, label: "Finding Driver" },
    negotiating: { bg: "#E0F2FE", text: "#0369A1", label: "Negotiating" },
    accepted: { bg: theme.accentDim, text: theme.accent, label: "Accepted" },
    in_progress: { bg: theme.okDim, text: theme.ok, label: "On Trip" },
    completed: { bg: theme.okDim, text: theme.ok, label: "Completed" },
    cancelled: { bg: theme.errDim, text: theme.err, label: "Cancelled" },
  };
}

export function getDriverStatusConfig(theme: ReturnType<typeof useTheme>): StatusConfig {
  return {
    online: { bg: theme.okDim, text: theme.ok, label: "Online" },
    idle: { bg: theme.okDim, text: theme.ok, label: "Idle" },
    on_trip: { bg: theme.accentDim, text: theme.accent, label: "On Trip" },
    offline: { bg: theme.surface3, text: theme.text3, label: "Offline" },
    pending: { bg: theme.warnDim, text: theme.warn, label: "Pending" },
  };
}
