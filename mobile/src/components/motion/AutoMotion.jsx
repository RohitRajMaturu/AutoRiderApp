import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

const DEFAULT_PALETTE = {
  autoYellow: "#F3B51B",
  autoGreen: "#1F8A4C",
  autoBlack: "#17272B",
  primary: "#43B8B3",
  primaryDark: "#339E9A",
  success: "#22C55E",
  error: "#EF4444",
  gold: "#F3B51B",
  purple: "#7C3AED",
  bg: "#EAF0F1",
  surface: "#FFFFFF",
  darkSurface: "#17272B",
  text: "#17272B",
  textSecondary: "#647678",
  border: "#D8E4E5",
};

const COPY = {
  searching: "Finding nearby autos...",
  matched: "Driver found!",
  arriving: "Driver is on the way",
  progress: "Ride in progress",
  completed: "Ride completed successfully",
  button: "Finding Auto...",
  empty: "No autos nearby right now",
  payment: "Payment successful",
  location: "Detecting your location...",
  splash: "TukTukGo",
};

function useLoop(duration = 1600, enabled = true) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      progress.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    progress.setValue(0);
    animation.start();
    return () => animation.stop();
  }, [duration, enabled, progress]);

  return progress;
}

function useOnce(duration = 1400) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [duration, progress]);

  return progress;
}

function mergePalette(palette, theme) {
  const merged = { ...DEFAULT_PALETTE, ...palette };
  if (theme === "dark") {
    return {
      ...merged,
      surface: merged.darkSurface,
      text: "#F8FAFC",
      textSecondary: "#B8C5C7",
      border: "#304246",
    };
  }
  return merged;
}

function AutoRickshaw({ palette, scale = 1 }) {
  return (
    <G transform={`scale(${scale}) translate(-80 -78)`}>
      <Rect x="37" y="54" width="86" height="34" rx="9" fill={palette.autoYellow} />
      <Rect x="46" y="31" width="64" height="35" rx="17" fill={palette.autoGreen} />
      <Rect x="52" y="38" width="40" height="18" rx="5" fill={palette.surface} opacity="0.88" />
      <Path d="M111 39 L122 58 L118 88 L105 87 L108 58 Z" fill={palette.autoBlack} opacity="0.78" />
      <Rect x="31" y="72" width="100" height="14" rx="6" fill={palette.autoYellow} />
      <Circle cx="50" cy="94" r="11" fill={palette.autoBlack} />
      <Circle cx="112" cy="94" r="11" fill={palette.autoBlack} />
      <Circle cx="50" cy="94" r="4" fill={palette.surface} opacity="0.82" />
      <Circle cx="112" cy="94" r="4" fill={palette.surface} opacity="0.82" />
      <Rect x="29" y="68" width="12" height="8" rx="3" fill={palette.success} opacity="0.85" />
    </G>
  );
}

function Pin({ x, y, color, scale = 1, opacity = 1 }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <Circle cx="0" cy="-7" r="13" fill={color} />
      <Circle cx="0" cy="-7" r="4" fill="#FFFFFF" opacity="0.95" />
      <Path d="M-7 4 L0 18 L7 4" fill={color} />
    </G>
  );
}

function Check({ x, y, color, scale = 1, opacity = 1 }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <Circle cx="0" cy="0" r="30" fill={color} opacity="0.12" />
      <Circle cx="0" cy="0" r="22" fill="none" stroke={color} strokeWidth="5" />
      <Path
        d="M-12 0 L-3 10 L15 -12"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

function RouteLine({ palette, variant }) {
  const path =
    variant === "progress"
      ? "M42 128 C86 68 139 68 198 124"
      : "M42 130 C88 92 134 92 198 126";
  return (
    <>
      <Path
        d={path}
        fill="none"
        stroke={palette.border}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="4 9"
      />
      <Path
        d={path}
        fill="none"
        stroke={palette.primary}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 9"
        opacity="0.75"
      />
    </>
  );
}

function BaseScene({ children, size, transparent, palette }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      {!transparent && <Rect x="0" y="0" width="240" height="240" rx="28" fill={palette.surface} />}
      <Line x1="44" y1="166" x2="196" y2="166" stroke={palette.border} strokeWidth="5" strokeLinecap="round" opacity="0.82" />
      {children}
    </Svg>
  );
}

function SceneArtwork({ type, palette, size, transparent, reduceMotion }) {
  const loop = useLoop(type === "button" ? 1100 : 1900, !reduceMotion && ["searching", "arriving", "progress", "button", "location"].includes(type));
  const once = useOnce(type === "matched" || type === "completed" || type === "payment" || type === "empty" || type === "splash" ? 1500 : 1);

  const autoTranslateX = loop.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange:
      type === "button"
        ? [-95, 0, 95]
        : type === "arriving" || type === "progress"
          ? [-58, 18, 58]
          : [-12, 10, -12],
  });
  const autoTranslateY = loop.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: type === "arriving" || type === "progress" ? [8, -18, 8] : [0, -4, 0],
  });
  const successScale = once.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 1.08, 1] });
  const successOpacity = once.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] });
  const pinOpacity = once.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0, 0] });
  const splashOpacity = once.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.15, 1, 1] });
  const splashScale = once.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.82, 1.05, 1] });
  const radarScale = loop.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.85] });
  const radarOpacity = loop.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.35, 0.08, 0] });

  if (type === "location") {
    return (
      <View style={{ width: size, height: size }}>
        <BaseScene size={size} transparent={transparent} palette={palette}>
          <Pin x={120} y={118} color={palette.primary} scale={1.1} />
        </BaseScene>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            opacity: radarOpacity,
            transform: [{ scale: radarScale }],
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <Circle cx="120" cy="111" r="38" fill="none" stroke={palette.primary} strokeWidth="5" />
          </Svg>
        </Animated.View>
      </View>
    );
  }

  if (type === "splash") {
    return (
      <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }] }}>
        <BaseScene size={size} transparent palette={palette}>
          <Path
            d="M53 150 L70 88 L127 76 L184 130 L170 160 L55 160"
            fill="none"
            stroke={palette.autoBlack}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <G transform="translate(42 45) scale(1.05)">
            <AutoRickshaw palette={palette} scale={1} />
          </G>
        </BaseScene>
      </Animated.View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <BaseScene size={size} transparent={transparent} palette={palette}>
        {(type === "arriving" || type === "progress") && (
          <>
            <RouteLine palette={palette} variant={type} />
            <Pin x={42} y={130} color={palette.success} scale={0.82} />
            <Pin x={198} y={126} color={palette.purple} scale={0.82} />
          </>
        )}
        {type === "searching" && (
          <>
            <Pin x={55} y={94} color={palette.primary} scale={0.65} opacity={0.82} />
            <Pin x={190} y={91} color={palette.primary} scale={0.65} opacity={0.72} />
            <Pin x={178} y={152} color={palette.primary} scale={0.58} opacity={0.65} />
          </>
        )}
        {type === "empty" && (
          <>
            <AnimatedG opacity={pinOpacity}>
              <Pin x={56} y={91} color={palette.primary} scale={0.62} />
              <Pin x={190} y={98} color={palette.primary} scale={0.62} />
            </AnimatedG>
          </>
        )}
        {(type === "matched" || type === "completed" || type === "payment") && (
          <Pin x={178} y={126} color={type === "payment" ? palette.success : palette.purple} scale={0.85} />
        )}
      </BaseScene>

      {type === "searching" && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            opacity: radarOpacity,
            transform: [{ scale: radarScale }],
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <Circle cx="120" cy="130" r="36" fill="none" stroke={palette.primary} strokeWidth="4" />
          </Svg>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: size / 2 - 80,
          top: size / 2 - 82,
          transform: [
            { translateX: type === "matched" || type === "completed" || type === "payment" ? once.interpolate({ inputRange: [0, 1], outputRange: [-60, 34] }) : autoTranslateX },
            { translateY: autoTranslateY },
            { scale: type === "button" ? 0.5 : 1 },
          ],
        }}
      >
        <Svg width={160} height={130} viewBox="0 0 160 130">
          <AutoRickshaw palette={palette} />
        </Svg>
      </Animated.View>

      {(type === "matched" || type === "completed" || type === "payment") && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: size / 2 - 40,
            top: size / 2 - 58,
            opacity: successOpacity,
            transform: [{ translateX: 55 }, { scale: successScale }],
          }}
        >
          <Svg width={80} height={80} viewBox="0 0 80 80">
            <Check x={40} y={40} color={palette.success} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const AnimatedG = Animated.createAnimatedComponent(G);

export function AutoMotionScene({
  type = "searching",
  label,
  size = 220,
  theme = "light",
  palette,
  transparent = true,
  reduceMotion = false,
  showLabel = true,
  style,
}) {
  const colors = useMemo(() => mergePalette(palette, theme), [palette, theme]);
  const copy = label ?? COPY[type] ?? COPY.searching;

  return (
    <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
      <SceneArtwork
        type={type}
        palette={colors}
        size={size}
        transparent={transparent}
        reduceMotion={reduceMotion}
      />
      {showLabel && (
        <Text
          style={{
            marginTop: 8,
            color: colors.text,
            fontSize: 15,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          {copy}
        </Text>
      )}
    </View>
  );
}

export function AutoMotionLoader(props) {
  return <AutoMotionScene type="searching" {...props} />;
}

export function AutoMotionSuccess({ message = COPY.completed, ...props }) {
  return <AutoMotionScene type="completed" label={message} {...props} />;
}

export function AutoMotionEmptyState({ message = COPY.empty, ...props }) {
  return <AutoMotionScene type="empty" label={message} {...props} />;
}

export function AutoMotionButtonLoader({
  label = COPY.button,
  theme = "light",
  palette,
  style,
}) {
  const colors = useMemo(() => mergePalette(palette, theme), [palette, theme]);
  return (
    <View
      style={[
        {
          height: 42,
          minWidth: 158,
          borderRadius: 21,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.primary,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <AutoMotionScene
        type="button"
        size={76}
        theme={theme}
        palette={palette}
        showLabel={false}
        transparent
      />
      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

export function useMotionPressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 160,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 180,
    }).start();
  };
  return { scale, onPressIn, onPressOut };
}

export function MotionPressable({ children, style, ...props }) {
  const press = useMotionPressScale();
  return (
    <Animated.View style={[style, { transform: [{ scale: press.scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export const AUTO_MOTION_LOTTIE = {
  searching: require("../../../assets/animations/auto-motion/searching-nearby-auto.json"),
  matched: require("../../../assets/animations/auto-motion/driver-match-found.json"),
  arriving: require("../../../assets/animations/auto-motion/driver-arriving.json"),
  progress: require("../../../assets/animations/auto-motion/ride-in-progress.json"),
  completed: require("../../../assets/animations/auto-motion/ride-completed.json"),
  button: require("../../../assets/animations/auto-motion/booking-button-loader.json"),
  empty: require("../../../assets/animations/auto-motion/no-drivers-available.json"),
  payment: require("../../../assets/animations/auto-motion/payment-success.json"),
  location: require("../../../assets/animations/auto-motion/detecting-location.json"),
  splash: require("../../../assets/animations/auto-motion/splash-screen.json"),
};

export { DEFAULT_PALETTE as AUTO_MOTION_PALETTE };
