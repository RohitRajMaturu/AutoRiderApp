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
