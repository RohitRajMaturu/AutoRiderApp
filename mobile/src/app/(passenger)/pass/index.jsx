import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight, Plus, Search, Ticket } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme as T } from "@/theme/tokens";
import { ICON } from "@/theme/iconScale";

function statusStyle(status, paymentStatus) {
  if (status === "ACTIVE") return { background: T.okDim, color: T.ok, label: "ACTIVE" };
  if (status === "PAUSED") return { background: T.warnDim, color: T.warn, label: "PAUSED" };
  if (status === "PENDING_MATCH" && paymentStatus !== "PAID") return { background: T.warnDim, color: T.warn, label: "PAYMENT PENDING" };
  if (status === "PENDING_MATCH") return { background: T.accentDim, color: T.accentText, label: "MATCHING DRIVER" };
  return { background: T.surface2, color: T.text2, label: String(status || "CREATED").replaceAll("_", " ") };
}

export default function PassengerPassHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState("ACTIVE");
  const { data, isLoading } = useQuery({
    queryKey: ["passengerPasses"],
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch("/api/passes");
      if (!response.ok) throw new Error("Could not load passes");
      return response.json();
    },
  });
  const passes = data?.passes || [];
  const groupedPasses = {
    ACTIVE: passes.filter((pass) => !pass.is_stale && ["PENDING_MATCH", "ACTIVE", "PAUSED"].includes(pass.status)),
    CANCELLED: passes.filter((pass) => pass.status === "CANCELLED"),
    PAST: passes.filter((pass) => pass.status !== "CANCELLED" && (pass.is_stale || !["PENDING_MATCH", "ACTIVE", "PAUSED"].includes(pass.status))),
  };
  const visiblePasses = groupedPasses[selectedTab] || [];
  const tabs = [
    { key: "ACTIVE", label: "Active" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "PAST", label: "Past" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 18, paddingBottom: 100 }}
    >
      <Text style={{ ...T.typography.title, color: T.text1 }}>TukTukPass</Text>
      <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>Your recurring routes, schedules, and driver status.</Text>

      <TouchableOpacity
        onPress={() => router.push("/(passenger)/pass/create")}
        activeOpacity={0.85}
        style={{ marginTop: 18, backgroundColor: T.accent, borderRadius: T.radii.lg, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, ...T.shadow.accent }}
      >
        <Plus color={T.surface1} size={ICON.sm} />
        <Text style={{ color: T.surface1, fontWeight: "900", fontSize: 14 }}>Create another pass</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 18, flexDirection: "row", gap: 7, backgroundColor: T.surface2, borderRadius: T.radii.lg, padding: 5 }}>
        {tabs.map((tab) => {
          const selected = selectedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setSelectedTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{ flex: 1, borderRadius: T.radii.md, paddingVertical: 10, alignItems: "center", backgroundColor: selected ? T.surface1 : "transparent", borderWidth: selected ? 1 : 0, borderColor: T.border }}
            >
              <Text style={{ color: selected ? T.accentText : T.text2, fontWeight: "900", fontSize: 12 }}>
                {tab.label} ({groupedPasses[tab.key].length})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} /> : null}

      {!isLoading && !passes.length ? (
        <View style={{ marginTop: 24, backgroundColor: T.surface1, borderRadius: T.radii.xl, padding: 22, borderWidth: 1, borderColor: T.border, ...T.shadow.card }}>
          <View style={{ width: 52, height: 52, borderRadius: T.radii.xl, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
            <Ticket color={T.accentText} size={ICON.xl} />
          </View>
          <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 16 }}>No passes yet</Text>
          <Text style={{ ...T.typography.body, color: T.text2, marginTop: 6, lineHeight: 22 }}>Create a recurring route and it will appear here immediately.</Text>
        </View>
      ) : null}

      {passes.length ? <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 24, marginBottom: 2 }}>{tabs.find((tab) => tab.key === selectedTab)?.label} passes</Text> : null}
      {!isLoading && passes.length > 0 && visiblePasses.length === 0 ? (
        <View style={{ marginTop: 10, backgroundColor: T.surface1, borderRadius: T.radii.lg, padding: 18, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ ...T.typography.body, color: T.text2, textAlign: "center" }}>No {String(tabs.find((tab) => tab.key === selectedTab)?.label || "").toLowerCase()} passes.</Text>
        </View>
      ) : null}
      {visiblePasses.map((pass) => {
        const displayStatus = pass.is_stale ? "EXPIRED" : pass.status;
        const tone = statusStyle(displayStatus, pass.payment_status);
        return (
          <TouchableOpacity
            key={pass.id}
            onPress={() => router.push(`/(passenger)/pass/${pass.id}`)}
            activeOpacity={0.84}
            style={{ marginTop: 10, backgroundColor: T.surface1, borderRadius: T.radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, ...T.shadow.card }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: T.radii.md, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
                <Ticket color={T.accentText} size={ICON.md} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ alignSelf: "flex-start", backgroundColor: tone.background, borderRadius: T.radii.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: tone.color, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }}>{tone.label}</Text>
                </View>
              </View>
              <ChevronRight size={ICON.sm} color={T.text3} />
            </View>
            <Text numberOfLines={2} style={{ ...T.typography.body, color: T.text1, fontWeight: "900", marginTop: 12 }}>{pass.pickup_label}</Text>
            <Text style={{ color: T.accentText, fontWeight: "900", marginVertical: 3 }}>↓</Text>
            <Text numberOfLines={2} style={{ ...T.typography.body, color: T.text1, fontWeight: "900" }}>{pass.dropoff_label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
              <CalendarDays color={T.text3} size={ICON.sm} />
              <Text style={{ ...T.typography.caption, color: T.text2, flex: 1 }}>
                {pass.scheduled_days?.join(" · ")} · {String(pass.scheduled_time).slice(0, 5)}
              </Text>
            </View>
            {pass.status === "PENDING_MATCH" ? (
              <Text style={{ ...T.typography.caption, color: pass.payment_status === "PAID" ? T.accentText : T.warn, marginTop: 9, fontWeight: "700" }}>
                {pass.payment_status === "PAID" ? "Created successfully. We are matching an eligible driver." : "Pass created. Complete payment before driver matching begins."}
              </Text>
            ) : pass.driver_name ? (
              <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 9 }}>{pass.driver_name} · {pass.vehicle_number}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={() => router.push("/(passenger)/pass/interest")}
        activeOpacity={0.8}
        style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: T.surface2, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.border }}
      >
        <Search color={T.accentText} size={ICON.md} />
        <Text style={{ ...T.typography.body, color: T.text1, fontWeight: "700", flex: 1 }}>Explore routes near you</Text>
        <ChevronRight size={ICON.sm} color={T.text3} />
      </TouchableOpacity>
    </ScrollView>
  );
}
