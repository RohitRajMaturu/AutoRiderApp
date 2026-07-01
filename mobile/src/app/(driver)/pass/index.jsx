import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bus, Settings, Ticket } from "lucide-react-native";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { theme as THEME } from "@/theme/tokens";
const G = THEME.accent,
  B = THEME.bg,
  C = THEME.surface1,
  T = THEME.text1,
  M = THEME.text2;
export default function DriverPass() {
  const i = useSafeAreaInsets(),
    r = useRouter(),
    queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["driverPasses"],
    queryFn: async () => {
      const x = await fetch("/api/driver/passes");
      if (!x.ok) throw new Error("Could not load subscriptions");
      return x.json();
    },
  });
  const passes = data?.passes || [];
  const offers = data?.offers || [];
  const institutionTrips = data?.institutionTrips || [];
  const acceptOffer = useMutation({
    mutationFn: async (passId) => {
      const response = await fetch(`/api/passes/${passId}/driver-accept`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "Could not accept this pass");
      return body;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["driverPasses"] }),
    onError: (error) => toast.error("Pass unavailable", { description: error.message }),
  });
  const tripAction = useMutation({
    mutationFn: async ({ tripId, action, memberId, reason }) => {
      const suffix = action === "pickup" ? `/confirm-pickup/${memberId}` : `/${action}`;
      const response = await fetch(`/api/institution-trips/${tripId}${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Trip update failed");
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driverPasses"] }),
    onError: (error) => toast.error("Trip update failed", { description: error.message }),
  });
  const guaranteed = passes.reduce(
    (s, p) => s + Number(p.driver_payout || 0),
    0,
  );
  const completed = passes.reduce(
      (s, p) => s + Number(p.completed_rides || 0),
      0,
    ),
    total = passes.reduce((s, p) => s + Number(p.total_rides || 0), 0);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: B }}
      contentContainerStyle={{
        paddingTop: i.top + 18,
        padding: 18,
        paddingBottom: 100,
      }}
    >
      <Text style={{ color: T, fontSize: 26, fontWeight: "900" }}>
        TukTukPass
      </Text>
      <View
        style={{
          marginTop: 18,
          backgroundColor: C,
          borderRadius: 20,
          padding: 18,
        }}
      >
        <Text style={{ color: M, fontSize: 11 }}>GUARANTEED THIS PERIOD</Text>
        <Text
          style={{ color: THEME.accentText, fontSize: 28, fontWeight: "900", marginTop: 7 }}
        >
          {"\u20B9"}
          {Math.round(guaranteed).toLocaleString("en-IN")}
        </Text>
        <Text style={{ color: M, marginTop: 9 }}>
          {completed}/{total} scheduled rides completed
        </Text>
        <View
          style={{
            height: 7,
            backgroundColor: THEME.border,
            borderRadius: 9,
            marginTop: 10,
          }}
        >
          <View
            style={{
              height: 7,
              width: `${total ? Math.min(100, (completed / total) * 100) : 0}%`,
              backgroundColor: G,
              borderRadius: 9,
            }}
          />
        </View>
      </View>
      {institutionTrips.length ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: T, fontSize: 17, fontWeight: "900" }}>Today&apos;s institution routes</Text>
          {institutionTrips.map((trip) => (
            <View key={trip.id} style={{ backgroundColor: C, borderRadius: 17, padding: 16, marginTop: 10, borderWidth: 1, borderColor: THEME.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Bus color={THEME.accentText} /><Text style={{ color: T, fontWeight: "900", flex: 1 }}>{trip.institution_name} · {trip.route_name}</Text><Text style={{ color: THEME.accentText, fontSize: 11, fontWeight: "900" }}>{trip.status}</Text></View>
              <Text style={{ color: M, marginTop: 8 }}>{trip.direction} · {String(trip.scheduled_time).slice(0, 5)}</Text>
              {trip.status === "IN_PROGRESS" ? trip.members?.map((member) => {
                const picked = trip.members_picked_up?.includes(member.id);
                return <TouchableOpacity key={member.id} disabled={picked || tripAction.isPending} onPress={() => tripAction.mutate({ tripId: trip.id, action: "pickup", memberId: member.id })} style={{ marginTop: 9, padding: 11, borderRadius: 10, backgroundColor: picked ? THEME.okDim : THEME.surface2, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: T }}>{member.name}</Text><Text style={{ color: picked ? THEME.ok : THEME.accentText, fontWeight: "900" }}>{picked ? "Picked up" : "Confirm pickup"}</Text></TouchableOpacity>;
              }) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {trip.status === "SCHEDULED" ? <TouchableOpacity disabled={tripAction.isPending} onPress={() => tripAction.mutate({ tripId: trip.id, action: "start" })} style={{ flex: 1, backgroundColor: G, borderRadius: 11, padding: 12, alignItems: "center" }}><Text style={{ color: THEME.surface1, fontWeight: "900" }}>Start route</Text></TouchableOpacity> : null}
                {trip.status === "IN_PROGRESS" ? <TouchableOpacity disabled={tripAction.isPending} onPress={() => tripAction.mutate({ tripId: trip.id, action: "complete" })} style={{ flex: 1, backgroundColor: G, borderRadius: 11, padding: 12, alignItems: "center" }}><Text style={{ color: THEME.surface1, fontWeight: "900" }}>Complete</Text></TouchableOpacity> : null}
                <TouchableOpacity onPress={() => toast.warning("Cancel institution route?", { description: "Guardians will be notified immediately.", duration: 7000, action: { label: "Cancel route", onClick: () => tripAction.mutate({ tripId: trip.id, action: "cancel", reason: "Driver cancelled" }) } })} style={{ borderWidth: 1, borderColor: THEME.err, borderRadius: 11, padding: 12, alignItems: "center" }}><Text style={{ color: THEME.err, fontWeight: "900" }}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {offers.length ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: T, fontSize: 17, fontWeight: "900" }}>
            Available pass offers
          </Text>
          {offers.map((offer) => (
            <View
              key={offer.id}
              style={{
                backgroundColor: C,
                borderRadius: 17,
                padding: 16,
                marginTop: 10,
                borderWidth: 1,
                borderColor: THEME.border,
              }}
            >
              <Text style={{ color: T, fontWeight: "900" }}>
                {offer.pickup_label}
                {" \u2192 "}
                {offer.dropoff_label}
              </Text>
              <Text style={{ color: M, marginTop: 8 }}>
                {offer.scheduled_days?.join(" \u00b7 ")}
                {" \u00b7 "}
                {String(offer.scheduled_time).slice(0, 5)}
              </Text>
              <Text style={{ color: THEME.accentText, fontWeight: "900", marginTop: 8 }}>
                {"\u20B9"}
                {Number(offer.driver_payout || 0).toLocaleString("en-IN")}{" "}
                guaranteed payout
              </Text>
              <TouchableOpacity
                disabled={acceptOffer.isPending}
                onPress={() => acceptOffer.mutate(offer.id)}
                style={{
                  backgroundColor: G,
                  borderRadius: 12,
                  padding: 13,
                  alignItems: "center",
                  marginTop: 12,
                  opacity: acceptOffer.isPending ? 0.6 : 1,
                }}
              >
                <Text style={{ color: THEME.surface1, fontWeight: "900" }}>
                  Accept pass
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      {isLoading ? (
        <ActivityIndicator color={G} style={{ marginTop: 30 }} />
      ) : (
        passes.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => r.push(`/(driver)/pass/${p.id}`)}
            style={{
              backgroundColor: C,
              borderRadius: 17,
              padding: 16,
              marginTop: 12,
            }}
          >
            <View style={{ flexDirection: "row" }}>
              <Ticket color={G} />
              <Text
                style={{
                  color: T,
                  fontWeight: "900",
                  fontSize: 15,
                  marginLeft: 10,
                  flex: 1,
                }}
              >
                {p.pickup_label}
                {" \u2192 "}
                {p.dropoff_label}
              </Text>
              <Text
                style={{ color: THEME.ok, fontSize: 10, fontWeight: "900" }}
              >
                {p.status}
              </Text>
            </View>
            <Text style={{ color: M, marginTop: 10 }}>
              {p.scheduled_days?.join(" \u00b7 ")}
              {" \u00b7 "}
              {String(p.scheduled_time).slice(0, 5)}
            </Text>
            <Text style={{ color: T, marginTop: 7 }}>
              {String(p.passenger_name || "Passenger").split(" ")[0]}
              {" \u00b7 \u20B9"}
              {Math.round(Number(p.driver_payout || 0)).toLocaleString(
                "en-IN",
              )}{" "}
              total payout
            </Text>
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity
        onPress={() => r.push("/(driver)/pass/preferences")}
        style={{
          marginTop: 20,
          borderWidth: 1,
          borderColor: G,
          borderRadius: 14,
          padding: 15,
          flexDirection: "row",
          justifyContent: "center",
          gap: 9,
        }}
      >
        <Settings color={THEME.accentText} />
        <Text style={{ color: THEME.accentText, fontWeight: "900" }}>
          Subscription Preferences
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
