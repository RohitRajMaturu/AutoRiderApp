import { Stack } from "expo-router";

export default function DriverPassLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[passId]" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
