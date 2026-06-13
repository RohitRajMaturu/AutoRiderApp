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
              d="M25 30c1.6-11.2 9.5-18.5 21-18.5h15c10.5 0 18.6 7.2 20.8 18.5"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M35 29c2.3-7 7.6-11.2 15.3-11.2h10.2c7.1 0 12.3 4.1 15.2 11.2H35Z"
              fill="#FFFFFF"
              opacity={0.58}
            />
            <Path
              d="M16 31h65c4.6 0 8 3.7 8 8.2V42H11v-5c0-3.3 2.7-6 6-6Z"
              fill={color}
            />
            <Path
              d="M21 34h57"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.35}
            />
            <Path
              d="M62 18l5 23"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.8}
            />
            <Circle cx={28} cy={43} r={6} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={28} cy={43} r={2.5} fill={color} />
            <Circle cx={68} cy={43} r={6} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={68} cy={43} r={2.5} fill={color} />
            <Path
              d="M13 38h11M77 38h10"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.72}
            />
            <Path
              d="M9 30h10"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.45}
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
