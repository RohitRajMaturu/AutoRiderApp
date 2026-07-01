import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight, Plus, Search, Ticket } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme as T } from "@/theme/tokens";
import { ICON } from "@/theme/iconScale";

export default function PassengerPassHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["passengerPasses"],
    queryFn: async () => {
      const res = await fetch("/api/passes");
      if (!res.ok) throw new Error("Could not load passes");
      return res.json();
    },
  });

  const passes = data?.passes || [];
  const active = passes.find((pass) => ["ACTIVE", "PAUSED"].includes(pass.status));
  const pending = passes.filter((pass) => pass.status === "PENDING_MATCH");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingHorizontal: 18,
        paddingBottom: 100,
      }}
    >
      <Text style={{ ...T.typography.title, color: T.text1 }}>TukTukPass</Text>
      <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>
        Fixed fare. Guaranteed pickup. Zero negotiation.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : active ? (
        <TouchableOpacity
          onPress={() => router.push(`/(passenger)/pass/${active.id}`)}
          activeOpacity={0.85}
          style={{
            marginTop: 24,
            backgroundColor: T.surface1,
            borderRadius: T.radii.xl,
            padding: 20,
            borderWidth: 1,
            borderColor: T.border,
            ...T.shadow.card,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ width: 42, height: 42, borderRadius: T.radii.lg, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
              <Ticket color={T.accentText} size={ICON.lg} />
            </View>
            <View style={{ backgroundColor: active.status === "ACTIVE" ? T.okDim : T.warnDim, borderRadius: T.radii.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: active.status === "ACTIVE" ? T.ok : T.warn }}>
                {active.status}
              </Text>
            </View>
          </View>

          <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 16 }}>{active.pickup_label}</Text>
          <Text style={{ color: T.accentText, marginVertical: 4, fontWeight: "700" }}>↓</Text>
          <Text style={{ ...T.typography.heading, color: T.text1 }}>{active.dropoff_label}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
            <CalendarDays color={T.text3} size={ICON.sm} />
            <Text style={{ ...T.typography.caption, color: T.text2 }}>
              {active.scheduled_days?.join(" · ")} · {String(active.scheduled_time).slice(0, 5)}
            </Text>
          </View>

          {active.driver_name ? (
            <Text style={{ ...T.typography.caption, color: T.text1, marginTop: 10, fontWeight: "700" }}>
              {active.driver_name} · {active.vehicle_number}
            </Text>
          ) : null}

          {active.upcoming_rides?.[0]?.otp ? (
            <View style={{ marginTop: 18, backgroundColor: T.accentDim, borderRadius: T.radii.lg, padding: 16, alignItems: "center" }}>
              <Text style={{ ...T.typography.micro, color: T.text2, letterSpacing: 1.5 }}>TODAY&apos;S OTP</Text>
              <Text style={{ fontSize: 30, fontWeight: "900", letterSpacing: 10, color: T.accentText, marginTop: 6 }}>
                {active.upcoming_rides[0].otp}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 14, gap: 4 }}>
            <Text style={{ ...T.typography.caption, color: T.accentText, fontWeight: "800" }}>View details</Text>
            <ChevronRight size={ICON.sm} color={T.accentText} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: 24, backgroundColor: T.surface1, borderRadius: T.radii.xl, padding: 24, borderWidth: 1, borderColor: T.border, ...T.shadow.card }}>
          <View style={{ width: 52, height: 52, borderRadius: T.radii.xl, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
            <Ticket color={T.accentText} size={ICON.xl} />
          </View>
          <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 16 }}>Commute smarter</Text>
          <Text style={{ ...T.typography.body, color: T.text2, marginTop: 6, lineHeight: 22 }}>
            Zero negotiation, guaranteed pickup on your regular route.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(passenger)/pass/create")}
            activeOpacity={0.85}
            style={{ marginTop: 20, backgroundColor: T.accent, borderRadius: T.radii.lg, paddingVertical: 14, alignItems: "center", ...T.shadow.accent }}
          >
            <Text style={{ color: T.surface1, fontWeight: "900", fontSize: 14 }}>Set up TukTukPass</Text>
          </TouchableOpacity>
        </View>
      )}

      {pending.map((pass) => (
        <View key={pass.id} style={{ marginTop: 12, backgroundColor: T.surface1, borderRadius: T.radii.lg, padding: 16, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ ...T.typography.micro, color: T.warn, letterSpacing: 1.2 }}>MATCHING A DRIVER</Text>
          <Text style={{ ...T.typography.caption, color: T.text1, marginTop: 6, fontWeight: "700" }}>
            {pass.pickup_label} → {pass.dropoff_label}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        onPress={() => router.push("/(passenger)/pass/interest")}
        activeOpacity={0.8}
        style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: T.surface2, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.border }}
      >
        <Search color={T.accentText} size={ICON.md} />
        <Text style={{ ...T.typography.body, color: T.text1, fontWeight: "700", flex: 1 }}>Explore routes near you</Text>
        <ChevronRight size={ICON.sm} color={T.text3} />
      </TouchableOpacity>

      {active ? (
        <TouchableOpacity
          onPress={() => router.push("/(passenger)/pass/create")}
          activeOpacity={0.8}
          style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 14 }}
        >
          <Plus color={T.accentText} size={ICON.sm} />
          <Text style={{ color: T.accentText, fontWeight: "800", fontSize: 14 }}>Create another pass</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
