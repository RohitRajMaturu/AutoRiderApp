import React from "react";
import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeContext";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isInactive = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizes = {
    sm: { height: 36, paddingHorizontal: theme.spacing[3], text: theme.typography.caption },
    md: { height: 46, paddingHorizontal: theme.spacing[4], text: theme.typography.body },
    lg: { height: 54, paddingHorizontal: theme.spacing[5], text: theme.typography.heading },
  };

  const variants = {
    primary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      color: theme.surface,
    },
    secondary: {
      backgroundColor: theme.primaryLight,
      borderColor: theme.primaryBorder,
      color: theme.primaryDark,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      color: theme.textSecondary,
    },
    danger: {
      backgroundColor: theme.error,
      borderColor: theme.error,
      color: theme.surface,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: theme.border,
      color: theme.text,
    },
  };

  const selectedSize = sizes[size];
  const selectedVariant = variants[variant];

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      onPress={() => {
        if (!isInactive) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }
      }}
      style={[
        animatedStyle,
        {
          alignItems: "center",
          backgroundColor: selectedVariant.backgroundColor,
          borderColor: selectedVariant.borderColor,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          flexDirection: "row",
          gap: theme.spacing[2],
          height: selectedSize.height,
          justifyContent: "center",
          opacity: isInactive ? 0.58 : 1,
          paddingHorizontal: selectedSize.paddingHorizontal,
        },
        variant === "primary" ? theme.shadow.glow : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={selectedVariant.color} />
      ) : (
        <Text style={[selectedSize.text, { color: selectedVariant.color, textAlign: "center" }]}>
          {children}
        </Text>
      )}
    </AnimatedPressable>
  );
}
