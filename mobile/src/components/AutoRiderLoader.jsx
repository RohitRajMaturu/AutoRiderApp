import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

export default function AutoRiderLoader({
  label = "Loading",
  color = "#F97316",
  textColor = "#78716C",
  fullScreen = false,
}) {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.04,
            duration: 560,
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: -3,
            duration: 560,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 0.96,
            duration: 560,
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: 0,
            duration: 560,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [lift, pulse]);

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Animated.View style={{ transform: [{ translateY: lift }, { scale: pulse }] }}>
        <Svg width={86} height={54} viewBox="0 0 96 56" fill="none">
          <Path
            d="M10 40c10-15 22-22 36-22 13 0 24 5 40 18"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="5 7"
            opacity={0.28}
          />
          <G>
            <Path
              d="M23 31c1.4-10.4 8.6-17 19.5-17h14c8.2 0 15.2 5 17.6 12.8L76 31"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M30 30h38l-3.8-10.5H43c-6.8 0-11.4 3.6-13 10.5Z"
              fill={color}
              opacity={0.18}
            />
            <Path
              d="M18 32h60c3.4 0 6 2.7 6 6v3H12v-3c0-3.3 2.7-6 6-6Z"
              fill={color}
            />
            <Path
              d="M23 32h50"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.35}
            />
            <Circle cx={29} cy={42} r={6} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={29} cy={42} r={2.5} fill={color} />
            <Circle cx={67} cy={42} r={6} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={67} cy={42} r={2.5} fill={color} />
            <Path
              d="M46 20h12l3.2 10H42l4-10Z"
              fill="#FFFFFF"
              opacity={0.55}
            />
            <Path
              d="M15 37h7M74 37h8"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
            />
          </G>
          <Path
            d="M7 47h82"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.2}
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
