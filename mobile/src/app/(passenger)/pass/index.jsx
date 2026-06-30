import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CalendarDays, Plus, Search, Ticket } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GOLD = "#F5A623";
const BG = "#0A0A0A";
const CARD = "#171717";
const TEXT = "#FFFFFF";
const MUTED = "#9CA3AF";

export default function PassengerPassHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["passengerPasses"],
    queryFn: async () => {
      const response = await fetch("/api/passes");
      if (!response.ok) throw new Error("Could not load passes");
      return response.json();
    },
  });
  const passes = data?.passes || [];
  const active = passes.find((pass) => ["ACTIVE", "PAUSED"].includes(pass.status));
  const pending = passes.filter((pass) => pass.status === "PENDING_MATCH");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 18, paddingBottom: 100 }}>
      <Text style={{ color: TEXT, fontSize: 27, fontWeight: "900" }}>TukTukPass</Text>
      <Text style={{ color: MUTED, fontSize: 13, marginTop: 5 }}>Guaranteed commute. Fixed fare. Zero daily negotiation.</Text>
      {isLoading ? <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} /> : active ? (
        <TouchableOpacity onPress={() => router.push(`/(passenger)/pass/${active.id}`)} style={{ marginTop: 22, borderRadius: 22, backgroundColor: CARD, borderWidth: 1, borderColor: "#3A2A0D", padding: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#33230A", alignItems: "center", justifyContent: "center" }}><Ticket color={GOLD} /></View>
            <Text style={{ color: active.status === "ACTIVE" ? "#22C55E" : GOLD, fontWeight: "900", fontSize: 11 }}>{active.status}</Text>
          </View>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900", marginTop: 16 }}>{active.pickup_label}</Text>
          <Text style={{ color: GOLD, fontSize: 13, marginVertical: 5 }}>↓</Text>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{active.dropoff_label}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}><CalendarDays color={MUTED} size={17} /><Text style={{ color: MUTED }}>{active.scheduled_days?.join(" · ")} · {String(active.scheduled_time).slice(0, 5)}</Text></View>
          {active.driver_name ? <Text style={{ color: TEXT, marginTop: 14, fontWeight: "700" }}>{active.driver_name} · {active.vehicle_number}</Text> : null}
          {active.upcoming_rides?.[0]?.otp ? <View style={{ marginTop: 18, backgroundColor: "#211708", borderRadius: 16, padding: 15, alignItems: "center" }}><Text style={{ color: MUTED, fontSize: 11 }}>TODAY&apos;S OTP</Text><Text style={{ color: GOLD, fontSize: 31, fontWeight: "900", letterSpacing: 8, marginTop: 5 }}>{active.upcoming_rides[0].otp}</Text></View> : null}
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: 22, borderRadius: 22, backgroundColor: CARD, padding: 20, borderWidth: 1, borderColor: "#292929" }}>
          <Ticket color={GOLD} size={32} />
          <Text style={{ color: TEXT, fontSize: 20, fontWeight: "900", marginTop: 16 }}>Commute smarter</Text>
          <Text style={{ color: MUTED, lineHeight: 20, marginTop: 7 }}>Zero negotiation and guaranteed pickup on your regular route.</Text>
          <TouchableOpacity onPress={() => router.push("/(passenger)/pass/create")} style={{ marginTop: 18, backgroundColor: GOLD, borderRadius: 14, padding: 15, alignItems: "center" }}><Text style={{ color: "#111", fontWeight: "900" }}>Set up your TukTukPass →</Text></TouchableOpacity>
        </View>
      )}
      {pending.map((pass) => <View key={pass.id} style={{ marginTop: 12, borderRadius: 16, backgroundColor: CARD, padding: 15 }}><Text style={{ color: GOLD, fontSize: 11, fontWeight: "900" }}>MATCHING A DRIVER</Text><Text style={{ color: TEXT, fontWeight: "800", marginTop: 6 }}>{pass.pickup_label} → {pass.dropoff_label}</Text></View>)}
      <TouchableOpacity onPress={() => router.push("/(passenger)/pass/interest")} style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}><Search color={GOLD} /><Text style={{ color: TEXT, fontWeight: "800" }}>Explore routes near you</Text></TouchableOpacity>
      {active ? <TouchableOpacity onPress={() => router.push("/(passenger)/pass/create")} style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", gap: 8 }}><Plus color={GOLD} /><Text style={{ color: GOLD, fontWeight: "900" }}>Create another pass</Text></TouchableOpacity> : null}
    </ScrollView>
  );
}
