import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme as T } from "@/theme/tokens";
import { ICON } from "@/theme/iconScale";

function LocationCard({ label, value, onChange }) {
  return (
    <View style={{ backgroundColor: T.surface1, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.border, padding: 16, marginTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <MapPin color={T.accentText} size={ICON.sm} />
        <Text style={{ ...T.typography.micro, color: T.text2 }}>{label.toUpperCase()}</Text>
      </View>
      <TextInput
        value={value.label}
        onChangeText={(text) => onChange({ ...value, label: text })}
        placeholder="Location"
        placeholderTextColor={T.text3}
        style={{ color: T.text1, fontWeight: "700", marginTop: 10, paddingVertical: 6 }}
      />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        {[["Latitude", "lat"], ["Longitude", "lng"]].map(([placeholder, field]) => (
          <TextInput
            key={field}
            value={value[field]}
            onChangeText={(text) => onChange({ ...value, [field]: text })}
            placeholder={placeholder}
            placeholderTextColor={T.text3}
            keyboardType="decimal-pad"
            style={{ flex: 1, backgroundColor: T.surface2, borderRadius: T.radii.md, borderWidth: 1, borderColor: T.border, color: T.text1, padding: 12 }}
          />
        ))}
      </View>
    </View>
  );
}

export default function Interest() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pickup, setPickup] = useState({ label: "", lat: "", lng: "" });
  const [dropoff, setDropoff] = useState({ label: "", lat: "", lng: "" });
  const [done, setDone] = useState(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/pass-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { ...pickup, lat: Number(pickup.lat), lng: Number(pickup.lng) },
          dropoff: { ...dropoff, lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
          preferredDays: ["MON", "TUE", "WED", "THU", "FRI"],
          preferredTime: "08:30",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      return body;
    },
    onSuccess: setDone,
    onError: (error) => Alert.alert("Could not register", error.message),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 80 }}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft color={T.text1} />
      </TouchableOpacity>
      <Text style={{ ...T.typography.title, color: T.text1, marginTop: 20 }}>Route interest</Text>
      <Text style={{ ...T.typography.body, color: T.text2, marginTop: 7 }}>
        Tell us where you commute. We&apos;ll notify you when a driver covers it.
      </Text>
      {done ? (
        <View style={{ marginTop: 30, alignItems: "center", backgroundColor: T.surface1, borderRadius: T.radii.xl, borderWidth: 1, borderColor: T.border, padding: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: T.radii.xl, backgroundColor: T.okDim, alignItems: "center", justifyContent: "center" }}>
            <Check color={T.ok} size={34} />
          </View>
          <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 15 }}>Got it!</Text>
          <Text style={{ ...T.typography.body, color: T.text2, textAlign: "center", marginTop: 7 }}>
            We&apos;ll notify you when a driver covers this route. {done.similarPassengers} other passengers are waiting nearby.
          </Text>
        </View>
      ) : (
        <>
          <LocationCard label="Pickup" value={pickup} onChange={setPickup} />
          <LocationCard label="Drop-off" value={dropoff} onChange={setDropoff} />
          <TouchableOpacity
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ backgroundColor: T.accent, padding: 16, borderRadius: T.radii.lg, alignItems: "center", marginTop: 20, opacity: mutation.isPending ? 0.6 : 1, ...T.shadow.accent }}
          >
            <Text style={{ color: T.surface1, fontWeight: "900" }}>Register interest</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
