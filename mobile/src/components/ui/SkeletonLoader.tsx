import React from "react";
import { View } from "react-native";
import { Skeleton } from "moti/skeleton";
import { useTheme } from "@/theme/ThemeContext";

type SkeletonVariant = "card" | "list-item" | "metric";

type SkeletonLoaderProps = {
  variant?: SkeletonVariant;
};

export function SkeletonLoader({ variant = "card" }: SkeletonLoaderProps) {
  const theme = useTheme();
  const colorMode = "light";

  if (variant === "metric") {
    return (
      <Skeleton.Group show>
        <View style={{ gap: theme.spacing[3] }}>
          <Skeleton colorMode={colorMode} height={16} width="45%" radius={8} />
          <Skeleton colorMode={colorMode} height={32} width="70%" radius={8} />
        </View>
      </Skeleton.Group>
    );
  }

  if (variant === "list-item") {
    return (
      <Skeleton.Group show>
        <View style={{ flexDirection: "row", gap: theme.spacing[3], padding: theme.spacing[4] }}>
          <Skeleton colorMode={colorMode} height={44} width={44} radius={22} />
          <View style={{ flex: 1, gap: theme.spacing[2] }}>
            <Skeleton colorMode={colorMode} height={14} width="65%" radius={8} />
            <Skeleton colorMode={colorMode} height={12} width="90%" radius={8} />
          </View>
        </View>
      </Skeleton.Group>
    );
  }

  return (
    <Skeleton.Group show>
      <View style={{ gap: theme.spacing[3], padding: theme.spacing[4] }}>
        <Skeleton colorMode={colorMode} height={18} width="55%" radius={8} />
        <Skeleton colorMode={colorMode} height={90} width="100%" radius={16} />
        <Skeleton colorMode={colorMode} height={14} width="78%" radius={8} />
      </View>
    </Skeleton.Group>
  );
}
