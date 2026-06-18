import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function TukTukGoLoader({
  size = 72,
  color = "#43B8B3",
  label = "Loading",
  textColor = "#586C70",
  fullScreen = false,
}) {
  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        justifyContent: "center",
        alignItems: "center",
        gap: fullScreen ? 12 : 8,
      }}
    >
      <ActivityIndicator size={size > 48 ? "large" : "small"} color={color} />
      {!!label && (
        <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }}>
          {label}
        </Text>
      )}
    </View>
  );
}

