import React from "react";
import { Text, View } from "react-native";
import LottieView from "lottie-react-native";

export default function AutoRiderLoader({
  size = 72,
  color = "#F97316",
  label = "Loading",
  textColor = "#78716C",
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
      <LottieView
        source={require("../../assets/animations/auto-rickshaw-loader.json")}
        autoPlay
        loop
        style={{ width: size, height: size }}
        colorFilters={[{ keypath: "*", color }]}
      />
      {!!label && (
        <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }}>
          {label}
        </Text>
      )}
    </View>
  );
}
