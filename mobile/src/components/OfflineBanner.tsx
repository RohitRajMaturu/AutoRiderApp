import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = React.useState(false);
  const translateY = useSharedValue(-44);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    translateY.value = withSpring(isOffline ? 0 : -44, {
      damping: 18,
      stiffness: 200,
    });
  }, [isOffline, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.banner, animatedStyle]}>
      <Text style={styles.text}>Offline - reconnecting...</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    left: 0,
    paddingVertical: 10,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 999,
  },
  text: {
    color: "#F5A623",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
