import { Text } from "react-native";

export default function AutoRideIcon({ size = 24, style }) {
  return (
    <Text
      accessibilityElementsHidden
      allowFontScaling={false}
      importantForAccessibility="no"
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          textAlign: "center",
        },
        style,
      ]}
    >
      🛺
    </Text>
  );
}
