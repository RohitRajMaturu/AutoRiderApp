import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/utils/auth/useAuth";

export default function TestModeBackButton({ variant = "light" }) {
  const router = useRouter();
  const { auth, signOut, isSigningOut } = useAuth();

  if (!auth) return null;

  const dark = variant === "dark";

  return (
    <View
      style={{
        backgroundColor: dark ? "#17272B" : "#F7FBFA",
        borderBottomWidth: 1,
        borderBottomColor: dark ? "#26363A" : "#D8E4E5",
      }}
    >
      <TouchableOpacity
        onPress={async () => {
          await signOut();
          router.replace("/");
        }}
        disabled={isSigningOut}
        style={{
          minHeight: 42,
          paddingHorizontal: 16,
          paddingVertical: 9,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: isSigningOut ? 0.65 : 1,
        }}
        activeOpacity={0.8}
      >
        <ArrowLeft size={17} color={dark ? "#43B8B3" : "#286B68"} />
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            color: dark ? "#BFE5E0" : "#286B68",
            fontWeight: "800",
          }}
          numberOfLines={1}
        >
          {isSigningOut ? "Returning..." : "Back to role selection"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
