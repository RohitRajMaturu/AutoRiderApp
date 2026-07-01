import { Stack } from "expo-router";

export default function PassengerPassLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="interest" />
      <Stack.Screen name="[passId]" />
    </Stack>
  );
}
