import React from "react";
import { Text, View } from "react-native";
import { AutoMotionScene } from "@/components/motion";
import { useTheme } from "@/theme/ThemeContext";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  animationVariant?: "searching" | "empty" | "completed";
};

export function EmptyState({
  title,
  description,
  action,
  animationVariant = "empty",
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: "center", padding: theme.spacing[8] }}>
      <AutoMotionScene
        type={animationVariant}
        label={undefined}
        palette={undefined}
        size={148}
        showLabel={false}
        style={undefined}
      />
      <Text style={[theme.typography.heading, { color: theme.text, marginTop: theme.spacing[4], textAlign: "center" }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.textSecondary,
              marginTop: theme.spacing[2],
              textAlign: "center",
            },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing[5] }}>{action}</View> : null}
    </View>
  );
}
