import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

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
  style?: StyleProp<ViewStyle>;
};

export function StatusBadge({ status, config, style }: StatusBadgeProps) {
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
      <Text style={[theme.typography.micro, { color: badge.text }]}>{badge.label}</Text>
    </View>
  );
}

export function getRideStatusConfig(theme: ReturnType<typeof useTheme>): StatusConfig {
  return {
    requested: { bg: theme.warnDim, text: theme.warn, label: "Finding Driver" },
    accepted: { bg: theme.accentDim, text: theme.accent, label: "Accepted" },
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
