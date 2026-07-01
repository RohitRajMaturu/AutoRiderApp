import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, MapPin, Minus, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { theme as THEME } from "@/theme/tokens";
import { hasValidPassLocation, resolvePassLocation } from "@/utils/passLocation";

const G = THEME.accent;
const B = THEME.bg;
const C = THEME.surface1;
const T = THEME.text1;
const M = THEME.text2;

function PickupZoneField({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = String(value.label || "").trim();
    if (hasValidPassLocation(value) || query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((body) => setSuggestions(body.suggestions || []))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  const selectSuggestion = async (suggestion) => {
    try {
      const zone = await resolvePassLocation(
        { ...suggestion, label: suggestion.address || suggestion.label },
        { fieldName: "pickup zone" },
      );
      onChange(zone);
      setSuggestions([]);
    } catch (error) {
      toast.error("Pickup zone not selected", { description: error.message });
    }
  };

  return (
    <View style={{ marginTop: 9, backgroundColor: C, borderWidth: 1, borderColor: hasValidPassLocation(value) ? THEME.ok : THEME.border, borderRadius: 12, paddingHorizontal: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MapPin size={18} color={THEME.accentText} />
        <TextInput
          value={value.label}
          onChangeText={(label) => onChange({ label, lat: "", lng: "" })}
          placeholder="Search area, landmark, or address"
          placeholderTextColor={THEME.text3}
          style={{ flex: 1, color: T, paddingVertical: 13 }}
          accessibilityLabel="Preferred pickup zone"
        />
        {searching ? <ActivityIndicator size="small" color={THEME.accentText} /> : null}
      </View>
      {hasValidPassLocation(value) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 11 }}>
          <CheckCircle2 size={14} color={THEME.ok} />
          <Text style={{ color: THEME.ok, fontSize: 11, fontWeight: "700" }}>Pickup zone selected</Text>
        </View>
      ) : null}
      {suggestions.map((item, index) => (
        <TouchableOpacity
          key={item.placeId || `${item.label}-${index}`}
          onPress={() => selectSuggestion(item)}
          style={{ borderTopWidth: 1, borderTopColor: THEME.border, paddingVertical: 11 }}
        >
          <Text style={{ color: T, fontWeight: "700" }}>{item.label}</Text>
          {item.address && item.address !== item.label ? (
            <Text style={{ color: M, fontSize: 11, marginTop: 2 }}>{item.address}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function Preferences() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [shift, setShift] = useState("ANY");
  const [max, setMax] = useState(3);
  const [zone, setZone] = useState({ label: "", lat: "", lng: "" });
  const [radius, setRadius] = useState("5");

  const { data } = useQuery({
    queryKey: ["passPreferences"],
    queryFn: async () => {
      const response = await fetch("/api/driver/pass-preferences");
      if (!response.ok) throw new Error("Could not load pass preferences");
      return response.json();
    },
  });

  useEffect(() => {
    const preference = data?.preferences;
    if (!preference) return;
    setEnabled(preference.accepts_pass_subscriptions);
    setShift(preference.preferred_shift);
    setMax(preference.max_active_passes);
    setRadius(String(preference.preferred_zone_radius_km || 5));

    const lat = preference.preferred_lat;
    const lng = preference.preferred_lng;
    if (lat === null || lat === undefined || lng === null || lng === undefined) return;
    const savedZone = { label: "Saved pickup zone", lat: Number(lat), lng: Number(lng) };
    setZone(savedZone);
    fetch(`/api/locations/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((body) => {
        const place = body.place;
        if (body.provider !== "local" && (place?.address || place?.label)) {
          setZone({ label: place.address || place.label, lat: Number(lat), lng: Number(lng), ...(place.placeId ? { placeId: place.placeId } : {}) });
        }
      })
      .catch(() => {});
  }, [data]);

  const savePreferences = useMutation({
    mutationFn: async () => {
      if (enabled && !hasValidPassLocation(zone)) {
        throw new Error("Search for and select a preferred pickup zone.");
      }
      const radiusKm = Number(radius);
      if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 30) {
        throw new Error("Pickup radius must be between 1 and 30 km.");
      }
      const response = await fetch("/api/driver/pass-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptsPassSubscriptions: enabled,
          preferredShift: shift,
          maxActivePasses: max,
          preferredLat: enabled ? zone.lat : null,
          preferredLng: enabled ? zone.lng : null,
          preferredZoneRadiusKm: radiusKm,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["passPreferences"] }),
        queryClient.invalidateQueries({ queryKey: ["driverPasses"] }),
      ]);
      toast.success("Preferences saved", { description: "Your pass preferences are updated." });
      router.replace("/(driver)/pass");
    },
    onError: (error) => toast.error("Could not save preferences", { description: error.message }),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: B }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: 18, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()}><ArrowLeft color={T} /></TouchableOpacity>
      <Text style={{ color: T, fontSize: 24, fontWeight: "900", marginTop: 20 }}>Pass preferences</Text>
      <View style={{ backgroundColor: C, borderRadius: 17, borderWidth: 1, borderColor: THEME.border, padding: 16, marginTop: 18, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T, fontWeight: "900" }}>Accept Pass Subscriptions</Text>
          <Text style={{ color: M, fontSize: 12, marginTop: 4 }}>Receive guaranteed commute offers</Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: THEME.border, true: G }} />
      </View>
      {enabled ? (
        <>
          <Text style={{ color: M, fontSize: 11, fontWeight: "900", marginTop: 20 }}>PREFERRED SHIFT</Text>
          <View style={{ flexDirection: "row", gap: 7, marginTop: 9 }}>
            {["MORNING", "EVENING", "BOTH", "ANY"].map((value) => (
              <TouchableOpacity key={value} onPress={() => setShift(value)} style={{ flex: 1, backgroundColor: shift === value ? G : C, borderWidth: 1, borderColor: shift === value ? G : THEME.border, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: shift === value ? THEME.surface1 : T, fontSize: 10, fontWeight: "900" }}>{value}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: M, fontSize: 11, fontWeight: "900", marginTop: 20 }}>MAX ACTIVE PASSES</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setMax(Math.max(1, max - 1))}><Minus color={THEME.accentText} /></TouchableOpacity>
            <Text style={{ color: T, fontSize: 24, fontWeight: "900" }}>{max}</Text>
            <TouchableOpacity onPress={() => setMax(Math.min(3, max + 1))}><Plus color={THEME.accentText} /></TouchableOpacity>
          </View>
          <Text style={{ color: M, fontSize: 11, fontWeight: "900", marginTop: 20 }}>PREFERRED PICKUP ZONE</Text>
          <PickupZoneField value={zone} onChange={setZone} />
          <Text style={{ color: M, fontSize: 11, fontWeight: "900", marginTop: 16 }}>PICKUP RADIUS (KM)</Text>
          <TextInput
            value={radius}
            onChangeText={(value) => setRadius(value.replace(/[^\d]/g, "").slice(0, 2))}
            placeholder="5"
            placeholderTextColor={THEME.text3}
            keyboardType="number-pad"
            accessibilityLabel="Pickup radius in kilometres"
            style={{ backgroundColor: C, borderWidth: 1, borderColor: THEME.border, color: T, padding: 13, borderRadius: 12, marginTop: 9 }}
          />
          <Text style={{ color: THEME.text3, fontSize: 11, marginTop: 6 }}>You will receive pass requests with pickups within this distance of your selected zone. Default: 5 km.</Text>
        </>
      ) : null}
      <TouchableOpacity disabled={savePreferences.isPending} onPress={() => savePreferences.mutate()} style={{ backgroundColor: G, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 26, opacity: savePreferences.isPending ? 0.6 : 1 }}>
        <Text style={{ color: THEME.surface1, fontWeight: "900" }}>{savePreferences.isPending ? "Saving..." : "Save preferences"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
