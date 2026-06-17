import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

type CardVariant = "surface" | "tinted" | "dark";

type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  radius?: number;
  padding?: number;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  variant = "surface",
  radius,
  padding,
  shadow = true,
  style,
}: CardProps) {
  const theme = useTheme();
  const backgroundColor =
    variant === "dark"
      ? theme.dark
      : variant === "tinted"
        ? theme.primaryLight
        : theme.surface;
  const borderColor = variant === "dark" ? "rgba(255,255,255,0.12)" : theme.border;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderColor,
          borderWidth: 1,
          borderRadius: radius ?? theme.radii.lg,
          padding: padding ?? theme.spacing[4],
        },
        shadow ? theme.shadow.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
