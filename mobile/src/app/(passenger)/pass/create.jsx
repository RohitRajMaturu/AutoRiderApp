import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme as T } from "@/theme/tokens";

const GOLD = T.accent, BG = T.bg, CARD = T.surface1, TEXT = T.text1, MUTED = T.text2;
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function PassLocationField({ label, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  useEffect(() => {
    if (value.lat || value.label.trim().length < 2) { setSuggestions([]); return undefined; }
    const timer = setTimeout(() => {
      fetch(`/api/locations/autocomplete?q=${encodeURIComponent(value.label)}`)
        .then((response) => response.ok ? response.json() : { suggestions: [] })
        .then((data) => setSuggestions(data.suggestions || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value.label, value.lat]);
  const select = async (suggestion) => {
    let place = suggestion;
    if (!Number.isFinite(Number(place.lat)) && suggestion.placeId) {
      const response = await fetch(`/api/locations/place/${encodeURIComponent(suggestion.placeId)}`);
      const data = await response.json().catch(() => ({}));
      place = data.place || suggestion;
    }
    onChange({ label: place.address || place.label, lat: Number(place.lat), lng: Number(place.lng) });
    setSuggestions([]);
  };
  return <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 14 }}>
    <Text style={{ color: MUTED, fontSize: 11 }}>{label}</Text>
    <TextInput value={value.label} onChangeText={(text) => onChange({ label: text, lat: "", lng: "" })} placeholder="Search Ola Maps" placeholderTextColor={T.text3} style={{ color: TEXT, fontWeight: "800", marginTop: 7 }} />
    {value.lat ? <Text style={{ color: T.ok, fontSize: 11, marginTop: 6 }}>Location selected</Text> : null}
    {suggestions.map((item) => <TouchableOpacity key={item.placeId} onPress={() => select(item)} style={{ borderTopWidth: 1, borderTopColor: T.border, paddingVertical: 11 }}><Text style={{ color: TEXT, fontWeight: "700" }}>{item.label}</Text><Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{item.address}</Text></TouchableOpacity>)}
  </View>;
}

export default function CreatePass() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState({ label: "", lat: "", lng: "" });
  const [dropoff, setDropoff] = useState({ label: "", lat: "", lng: "" });
  const [days, setDays] = useState(["MON", "TUE", "WED", "THU", "FRI"]);
  const [time, setTime] = useState("08:30");
  const [duration, setDuration] = useState("MONTHLY");
  const [result, setResult] = useState(null);
  const createPass = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/passes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pickup: { ...pickup, lat: Number(pickup.lat), lng: Number(pickup.lng) }, dropoff: { ...dropoff, lat: Number(dropoff.lat), lng: Number(dropoff.lng) }, scheduledDays: days, scheduledTime: time, durationType: duration }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create pass");
      const paymentResponse = await fetch(`/api/passes/${body.pass.id}/confirm-payment`, { method: "POST" });
      const payment = await paymentResponse.json().catch(() => ({}));
      if (!paymentResponse.ok && paymentResponse.status !== 503) {
        throw new Error(payment.error || "Could not create payment link");
      }
      return { ...body, paymentLink: payment.paymentLink || null };
    },
    onSuccess: (data) => { setResult(data); setStep(4); queryClient.invalidateQueries({ queryKey: ["passengerPasses"] }); },
    onError: (error) => Alert.alert("Pass setup failed", error.message),
  });
  const canContinue = step !== 1 || (pickup.label && dropoff.label && Number.isFinite(Number(pickup.lat)) && Number.isFinite(Number(dropoff.lat)));
  return <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: 18, paddingBottom: 80 }}>
    <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step - 1)}><ArrowLeft color={TEXT} /></TouchableOpacity>
    <Text style={{ color: TEXT, fontSize: 25, fontWeight: "900", marginTop: 20 }}>Create TukTukPass</Text>
    <View style={{ flexDirection: "row", gap: 7, marginTop: 16 }}>{[1,2,3,4].map((value) => <View key={value} style={{ flex: 1, height: 5, borderRadius: 9, backgroundColor: value <= step ? GOLD : T.border }} />)}</View>
    {step === 1 ? <View style={{ marginTop: 24, gap: 14 }}><Text style={{ color: TEXT, fontWeight: "900" }}>1. Your regular route</Text><PassLocationField label="Where do you start?" value={pickup} onChange={setPickup} /><PassLocationField label="Where do you go?" value={dropoff} onChange={setDropoff} /></View> : null}
    {step === 2 ? <View style={{ marginTop: 24 }}><Text style={{ color: TEXT, fontWeight: "900" }}>2. Schedule</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>{DAYS.map((day) => { const selected = days.includes(day); return <TouchableOpacity key={day} onPress={() => setDays(selected ? days.filter((item) => item !== day) : [...days, day])} style={{ padding: 11, borderRadius: 999, backgroundColor: selected ? GOLD : CARD, borderWidth: 1, borderColor: selected ? GOLD : T.border }}><Text style={{ color: selected ? T.surface1 : TEXT, fontWeight: "900" }}>{day}</Text></TouchableOpacity>; })}</View><TextInput value={time} onChangeText={setTime} placeholder="08:30" placeholderTextColor={T.text3} style={{ marginTop: 18, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: T.border, color: TEXT, padding: 15 }} /><View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>{["WEEKLY","MONTHLY"].map((item) => <TouchableOpacity key={item} onPress={() => setDuration(item)} style={{ flex: 1, padding: 15, borderRadius: 14, backgroundColor: duration === item ? GOLD : CARD, borderWidth: 1, borderColor: duration === item ? GOLD : T.border, alignItems: "center" }}><Text style={{ color: duration === item ? T.surface1 : TEXT, fontWeight: "900" }}>{item === "WEEKLY" ? "Weekly (7 days)" : "Monthly (30 days)"}</Text></TouchableOpacity>)}</View></View> : null}
    {step === 3 ? <View style={{ marginTop: 24, backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 18 }}><Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>3. Review your pass</Text><Text style={{ color: MUTED, marginTop: 12 }}>{pickup.label} → {dropoff.label}</Text><Text style={{ color: MUTED, marginTop: 8 }}>{days.join(" · ")} · {time}</Text><Text style={{ color: T.accentText, fontWeight: "900", marginTop: 16 }}>15% below daily market fare</Text><Text style={{ color: MUTED, marginTop: 7 }}>Fare is fixed for the entire pass duration. Exact total and driver payout are shown before payment.</Text></View> : null}
    {step === 4 ? <View style={{ marginTop: 28, alignItems: "center" }}><View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: T.okDim, alignItems: "center", justifyContent: "center" }}><Check color={T.ok} size={36} /></View><Text style={{ color: TEXT, fontSize: 22, fontWeight: "900", marginTop: 18 }}>{result?.paymentLink ? "Complete payment" : "Pass request created"}</Text><Text style={{ color: MUTED, textAlign: "center", marginTop: 8 }}>{result?.paymentLink ? "Use the secure Razorpay payment link to activate driver matching. We also sent it by WhatsApp or SMS." : "Payments are not configured in this environment. Your request is saved for setup testing."}</Text>{result?.paymentLink ? <TouchableOpacity onPress={() => Linking.openURL(result.paymentLink)} style={{ marginTop: 20, backgroundColor: GOLD, padding: 15, borderRadius: 14, width: "100%", alignItems: "center" }}><Text style={{ color: T.surface1, fontWeight: "900" }}>Pay Securely</Text></TouchableOpacity> : null}<TouchableOpacity onPress={() => router.replace("/(passenger)/pass")} style={{ marginTop: 12, borderWidth: 1, borderColor: GOLD, padding: 15, borderRadius: 14, width: "100%", alignItems: "center" }}><Text style={{ color: T.accentText, fontWeight: "900" }}>View My Pass</Text></TouchableOpacity></View> : null}
    {step < 4 ? <TouchableOpacity disabled={!canContinue || createPass.isPending} onPress={() => step === 3 ? createPass.mutate() : setStep(step + 1)} style={{ marginTop: 28, backgroundColor: GOLD, opacity: canContinue ? 1 : 0.45, borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "center", gap: 8 }}><Text style={{ color: T.surface1, fontWeight: "900" }}>{step === 3 ? "Proceed to Pay" : "Continue"}</Text><ArrowRight color={T.surface1} size={18} /></TouchableOpacity> : null}
  </ScrollView>;
}
