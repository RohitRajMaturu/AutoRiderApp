import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export default function AutoRiderLoader({
  label = "Loading",
  color = "#F97316",
  textColor = "#78716C",
  fullScreen = false,
}) {
  const pulse = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Svg width={72} height={46} viewBox="0 0 64 40" fill="none">
          <Path
            d="M12 24c1.4-8.2 7.2-14 16-14h12c5.8 0 10.8 3.8 12.4 9.4L54 24"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Path
            d="M18 24h30l-3-8H26c-4.2 0-7.2 2.2-8 8Z"
            fill={color}
            opacity={0.18}
          />
          <Circle cx={22} cy={28} r={5} fill={color} />
          <Circle cx={46} cy={28} r={5} fill={color} />
          <Path
            d="M8 24h48"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      {!!label && (
        <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }}>
          {label}
        </Text>
      )}
    </View>
  );
}
