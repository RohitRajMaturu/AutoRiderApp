import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { theme as T } from "@/theme/tokens";
import { ICON } from "@/theme/iconScale";
import { hasValidPassLocation, resolvePassLocation } from "@/utils/passLocation";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_INDEX = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PASS_TIME_SLOTS = Array.from({ length: 38 }, (_, index) => {
  const minutes = 5 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function formatTime(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "Choose time";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || "").slice(0, 5).split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : NaN;
}

function formatLocationAddress(location) {
  return [location?.name, location?.street, location?.district, location?.city]
    .filter(Boolean)
    .join(", ") || "Current location";
}

function routeDistanceMeters(a, b) {
  if (!hasValidPassLocation(a) || !hasValidPassLocation(b)) return NaN;
  const radius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(Number(b.lng) - Number(a.lng));
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function countScheduledRides(days, duration) {
  const totalDays = duration === "WEEKLY" ? 7 : 30;
  const wanted = new Set(days);
  let count = 0;
  const date = new Date();
  for (let offset = 0; offset < totalDays; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    if (wanted.has(DAY_INDEX[candidate.getDay()])) count += 1;
  }
  return count;
}

function firstValidationError({ pickup, dropoff, days, time, duration }) {
  if (!hasValidPassLocation(pickup)) return "Enter or select a valid pickup location.";
  if (!hasValidPassLocation(dropoff)) return "Enter or select a valid destination.";
  if (routeDistanceMeters(pickup, dropoff) < 100) return "Pickup and destination must be at least 100 metres apart.";
  if (!days.length) return "Choose at least one travel day.";
  if (!PASS_TIME_SLOTS.includes(time)) return "Choose a pickup time from the available slots.";
  if (!["WEEKLY", "MONTHLY"].includes(duration)) return "Choose weekly or monthly duration.";
  return null;
}

function PassLocationField({ label, value, onChange, onUseCurrentLocation, locating }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (hasValidPassLocation(value) || value.label.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      fetch(`/api/locations/autocomplete?q=${encodeURIComponent(value.label)}`)
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((data) => setSuggestions(data.suggestions || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  const selectSuggestion = async (suggestion) => {
    try {
      const next = await resolvePassLocation(
        { ...suggestion, label: suggestion.address || suggestion.label },
        { fieldName: label.toLowerCase().includes("start") ? "pickup" : "destination" },
      );
      onChange(next);
      setSuggestions([]);
    } catch (error) {
      toast.error("Location not selected", { description: error.message });
    }
  };

  return (
    <View style={{ backgroundColor: T.surface1, borderRadius: T.radii.lg, borderWidth: 1, borderColor: hasValidPassLocation(value) ? T.ok : T.border, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: T.text2, fontSize: 11, fontWeight: "800" }}>{label.toUpperCase()}</Text>
        {onUseCurrentLocation ? (
          <TouchableOpacity
            onPress={onUseCurrentLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.accentDim, borderRadius: T.radii.pill, paddingHorizontal: 9, paddingVertical: 6 }}
          >
            {locating ? <ActivityIndicator size="small" color={T.accentText} /> : <LocateFixed size={ICON.xs} color={T.accentText} />}
            <Text style={{ color: T.accentText, fontSize: 10, fontWeight: "900" }}>{locating ? "Locating" : "Use current"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TextInput
        value={value.label}
        onChangeText={(text) => onChange({ label: text, lat: "", lng: "" })}
        placeholder="Search for a location"
        placeholderTextColor={T.text3}
        style={{ color: T.text1, fontWeight: "800", marginTop: 7, paddingVertical: 5 }}
      />
      {hasValidPassLocation(value) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
          <CheckCircle2 size={ICON.xs} color={T.ok} />
          <Text style={{ color: T.ok, fontSize: 11, fontWeight: "700" }}>Location selected</Text>
        </View>
      ) : null}
      {suggestions.map((item, index) => (
        <TouchableOpacity
          key={item.placeId || `${item.label}-${index}`}
          onPress={() => selectSuggestion(item)}
          style={{ borderTopWidth: 1, borderTopColor: T.border, paddingVertical: 11 }}
        >
          <Text style={{ color: T.text1, fontWeight: "700" }}>{item.label}</Text>
          <Text style={{ color: T.text2, fontSize: 11, marginTop: 2 }}>{item.address}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
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
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingRoute, setResolvingRoute] = useState(false);
  const [result, setResult] = useState(null);

  const { data: existingData } = useQuery({
    queryKey: ["passengerPasses"],
    queryFn: async () => {
      const response = await fetch("/api/passes");
      if (!response.ok) return { passes: [] };
      return response.json();
    },
  });

  const rideCount = useMemo(() => countScheduledRides(days, duration), [days, duration]);
  const overlappingPass = useMemo(
    () => (existingData?.passes || []).find((pass) => {
      if (!["PENDING_MATCH", "ACTIVE", "PAUSED"].includes(pass.status)) return false;
      const passTime = String(pass.scheduled_time || "").slice(0, 5);
      const sharesDay = (pass.scheduled_days || []).some((day) => days.includes(day));
      return sharesDay && Math.abs(timeToMinutes(passTime) - timeToMinutes(time)) <= 120;
    }),
    [days, existingData, time],
  );

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        toast.error("Location permission needed", { description: "Allow location access to use your current pickup point." });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      let label = "Current location";
      try {
        const response = await fetch(`/api/locations/reverse?lat=${latitude}&lng=${longitude}`);
        const body = await response.json().catch(() => ({}));
        label = body.place?.address || body.place?.label || label;
      } catch {
        const [deviceLocation] = await Location.reverseGeocodeAsync({ latitude, longitude });
        label = formatLocationAddress(deviceLocation);
      }
      setPickup({ label, lat: latitude, lng: longitude });
      toast.success("Current pickup selected", { description: label });
    } catch (error) {
      toast.error("Could not get current location", { description: error.message || "Try searching for the pickup instead." });
    } finally {
      setLocating(false);
    }
  };

  const createPass = useMutation({
    mutationFn: async () => {
      const [resolvedPickup, resolvedDropoff] = await Promise.all([
        resolvePassLocation(pickup, { fieldName: "pickup" }),
        resolvePassLocation(dropoff, { fieldName: "destination" }),
      ]);
      setPickup(resolvedPickup);
      setDropoff(resolvedDropoff);

      const validationError = firstValidationError({ pickup: resolvedPickup, dropoff: resolvedDropoff, days, time, duration });
      if (validationError) throw new Error(validationError);

      const response = await fetch("/api/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: resolvedPickup,
          dropoff: resolvedDropoff,
          scheduledDays: days,
          scheduledTime: time,
          durationType: duration,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || "Could not create pass");
        error.code = body.code;
        error.fieldErrors = body.fieldErrors;
        throw error;
      }

      const paymentResponse = await fetch(`/api/passes/${body.pass.id}/confirm-payment`, { method: "POST" });
      const payment = await paymentResponse.json().catch(() => ({}));
      return {
        ...body,
        paymentLink: paymentResponse.ok ? payment.paymentLink || null : null,
        paymentWarning: paymentResponse.ok || paymentResponse.status === 503
          ? null
          : payment.error || "The pass was created, but the payment link is temporarily unavailable.",
      };
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ["passengerPasses"] });
      const overlapWarning = data.warnings?.find((warning) => warning.code === "OVERLAPPING_PASS_SCHEDULE");
      if (overlapWarning) {
        toast.warning("Pass created with a schedule overlap", { description: overlapWarning.message });
      } else if (data.paymentWarning) {
        toast.warning("Pass saved", { description: data.paymentWarning });
      } else {
        toast.success("TukTukPass created", { description: "Review the payment step to begin driver matching." });
      }
    },
    onError: (error) => {
      const fieldErrors = error.fieldErrors || {};
      if (fieldErrors.pickup) {
        setStep(1);
        toast.error("Pickup location issue", { description: fieldErrors.pickup });
        return;
      }
      if (fieldErrors.dropoff) {
        setStep(1);
        toast.error("Destination issue", { description: fieldErrors.dropoff });
        return;
      }
      const detail = Object.values(fieldErrors)[0] || error.message;
      toast.error("Pass could not be created", { description: detail || "Review the highlighted pass details and try again." });
    },
  });

  const continueFlow = async () => {
    if (step === 1) {
      setResolvingRoute(true);
      try {
        const [resolvedPickup, resolvedDropoff] = await Promise.all([
          resolvePassLocation(pickup, { fieldName: "pickup" }),
          resolvePassLocation(dropoff, { fieldName: "destination" }),
        ]);
        const routeError = firstValidationError({ pickup: resolvedPickup, dropoff: resolvedDropoff, days: ["MON"], time: "08:30", duration: "WEEKLY" });
        if (routeError) throw new Error(routeError);
        setPickup(resolvedPickup);
        setDropoff(resolvedDropoff);
        setStep(2);
      } catch (error) {
        toast.error("Complete your route", { description: error.message || "Check both locations and try again." });
      } finally {
        setResolvingRoute(false);
      }
      return;
    }
    if (step === 2) {
      if (!days.length) {
        toast.error("Choose travel days", { description: "Select at least one day for your recurring pickup." });
        return;
      }
      if (!PASS_TIME_SLOTS.includes(time)) {
        toast.error("Choose a pickup time", { description: "Select a time from the available slots." });
        return;
      }
      if (overlappingPass) {
        toast.error("Pass schedule overlaps", {
          description: "Choose different travel days or a pickup time more than 2 hours from your existing pass.",
        });
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!hasValidPassLocation(pickup) || !hasValidPassLocation(dropoff)) {
        setStep(1);
        toast.error("Check your locations", {
          description: "Select a location from the search suggestions to confirm coordinates.",
        });
        return;
      }
      createPass.mutate();
    }
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => (step === 1 ? router.back() : setStep((value) => value - 1))} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft color={T.text1} />
        </TouchableOpacity>
        <Text style={{ ...T.typography.title, color: T.text1, marginTop: 20 }}>Create TukTukPass</Text>
        <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>Set your regular route once. We&apos;ll handle the recurring pickups.</Text>

        <View style={{ flexDirection: "row", gap: 7, marginTop: 18 }}>
          {[1, 2, 3, 4].map((value) => (
            <View key={value} style={{ flex: 1, height: 5, borderRadius: T.radii.pill, backgroundColor: value <= step ? T.accent : T.border }} />
          ))}
        </View>

        {step === 1 ? (
          <View style={{ marginTop: 24, gap: 14 }}>
            <Text style={{ ...T.typography.heading, color: T.text1 }}>Your regular route</Text>
            <PassLocationField label="Where do you start?" value={pickup} onChange={setPickup} onUseCurrentLocation={useCurrentLocation} locating={locating} />
            <PassLocationField label="Where do you go?" value={dropoff} onChange={setDropoff} />
            <Text style={{ ...T.typography.micro, color: T.text3 }}>Choose a search result so TukTukGo receives valid map coordinates.</Text>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ ...T.typography.heading, color: T.text1 }}>Schedule</Text>
            <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>Choose the days and regular pickup time.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {DAYS.map((day) => {
                const selected = days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setDays(selected ? days.filter((item) => item !== day) : [...days, day])}
                    style={{ paddingHorizontal: 13, paddingVertical: 11, borderRadius: T.radii.pill, backgroundColor: selected ? T.accent : T.surface1, borderWidth: 1, borderColor: selected ? T.accent : T.border }}
                  >
                    <Text style={{ color: selected ? T.surface1 : T.text1, fontWeight: "900" }}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ ...T.typography.micro, color: T.text2, marginTop: 20, marginBottom: 7 }}>PICKUP TIME</Text>
            <TouchableOpacity
              onPress={() => setTimePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Choose pickup time, currently ${formatTime(time)}`}
              style={{ backgroundColor: T.surface1, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.borderH, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: T.radii.md, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
                <Clock3 size={ICON.md} color={T.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text1, fontSize: 16, fontWeight: "900" }}>{formatTime(time)}</Text>
                <Text style={{ color: T.text3, fontSize: 11, marginTop: 2 }}>Tap to choose a 30-minute slot</Text>
              </View>
              <ArrowRight size={ICON.sm} color={T.accentText} />
            </TouchableOpacity>

            <Text style={{ ...T.typography.micro, color: T.text2, marginTop: 20, marginBottom: 7 }}>DURATION</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {["WEEKLY", "MONTHLY"].map((item) => {
                const selected = duration === item;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setDuration(item)}
                    style={{ flex: 1, padding: 15, borderRadius: T.radii.lg, backgroundColor: selected ? T.accent : T.surface1, borderWidth: 1, borderColor: selected ? T.accent : T.border, alignItems: "center" }}
                  >
                    <Text style={{ color: selected ? T.surface1 : T.text1, fontWeight: "900" }}>{item === "WEEKLY" ? "7 days" : "30 days"}</Text>
                    <Text style={{ color: selected ? T.surface1 : T.text3, fontSize: 10, marginTop: 3 }}>{item === "WEEKLY" ? "Weekly pass" : "Monthly pass"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ ...T.typography.heading, color: T.text1 }}>Review your pass</Text>
            <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>Everything that will repeat is summarized below.</Text>

            <View style={{ marginTop: 16, backgroundColor: T.surface1, borderRadius: T.radii.xl, borderWidth: 1, borderColor: T.border, padding: 18, ...T.shadow.card }}>
              <View style={{ flexDirection: "row", gap: 13 }}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <MapPin size={ICON.sm} color={T.accentText} />
                  </View>
                  <View style={{ width: 2, height: 34, backgroundColor: T.border }} />
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.okDim, alignItems: "center", justifyContent: "center" }}>
                    <MapPin size={ICON.sm} color={T.ok} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...T.typography.micro, color: T.text3 }}>PICKUP</Text>
                  <Text style={{ ...T.typography.body, color: T.text1, fontWeight: "800", marginTop: 2 }} numberOfLines={2}>{pickup.label}</Text>
                  <Text style={{ ...T.typography.micro, color: T.text3, marginTop: 20 }}>DESTINATION</Text>
                  <Text style={{ ...T.typography.body, color: T.text1, fontWeight: "800", marginTop: 2 }} numberOfLines={2}>{dropoff.label}</Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: T.border, marginVertical: 18 }} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  { Icon: Clock3, label: "Pickup", value: formatTime(time) },
                  { Icon: CalendarDays, label: "Travel days", value: `${days.length} days/week` },
                  { Icon: ShieldCheck, label: "Duration", value: duration === "WEEKLY" ? "7 days" : "30 days" },
                  { Icon: CheckCircle2, label: "Expected rides", value: String(rideCount) },
                ].map(({ Icon, label, value }) => (
                  <View key={label} style={{ width: "47%", flexGrow: 1, backgroundColor: T.surface2, borderRadius: T.radii.md, padding: 12 }}>
                    <Icon size={ICON.sm} color={T.accentText} />
                    <Text style={{ ...T.typography.micro, color: T.text3, marginTop: 7 }}>{label.toUpperCase()}</Text>
                    <Text style={{ ...T.typography.caption, color: T.text1, fontWeight: "900", marginTop: 2 }}>{value}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 14, backgroundColor: T.accentDim, borderRadius: T.radii.lg, padding: 14 }}>
                <Text style={{ color: T.accentText, fontWeight: "900" }}>15% below the estimated daily market fare</Text>
                <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>Your exact total, platform fee, and driver payout are calculated securely before payment.</Text>
              </View>
            </View>

            {overlappingPass ? (
              <View style={{ marginTop: 12, backgroundColor: T.warnDim, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.warn, padding: 14 }}>
                <Text style={{ color: T.warn, fontWeight: "900" }}>Schedule overlap detected</Text>
                <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 4 }}>
                  This overlaps your {overlappingPass.pickup_label} → {overlappingPass.dropoff_label} pass. Choose different days or a pickup time more than 2 hours apart.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ marginTop: 28, alignItems: "center" }}>
            <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: T.okDim, alignItems: "center", justifyContent: "center" }}>
              <Check color={T.ok} size={36} />
            </View>
            <Text style={{ ...T.typography.heading, color: T.text1, marginTop: 18 }}>{result?.paymentLink ? "Complete payment" : "Pass request created"}</Text>
            <Text style={{ ...T.typography.body, color: T.text2, textAlign: "center", marginTop: 8 }}>
              {result?.paymentLink
                ? `Your ${result.fare?.rideCount || rideCount}-ride pass is ready. Use the secure payment link to begin driver matching.`
                : result?.paymentWarning || "Your request is saved. Payment can be completed when the provider is available."}
            </Text>
            {result?.fare ? (
              <View style={{ width: "100%", marginTop: 18, backgroundColor: T.surface1, borderRadius: T.radii.lg, borderWidth: 1, borderColor: T.border, padding: 15 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: T.text2 }}>Pass total</Text>
                  <Text style={{ color: T.text1, fontWeight: "900" }}>₹{Number(result.fare.agreedFare || 0).toLocaleString("en-IN")}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ color: T.text2 }}>Per ride</Text>
                  <Text style={{ color: T.accentText, fontWeight: "900" }}>₹{Number(result.fare.perRideFare || 0).toLocaleString("en-IN")}</Text>
                </View>
              </View>
            ) : null}
            {result?.paymentLink ? (
              <TouchableOpacity onPress={() => Linking.openURL(result.paymentLink)} style={{ marginTop: 20, backgroundColor: T.accent, padding: 15, borderRadius: T.radii.lg, width: "100%", alignItems: "center", ...T.shadow.accent }}>
                <Text style={{ color: T.surface1, fontWeight: "900" }}>Pay securely</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.replace("/(passenger)/pass")} style={{ marginTop: 12, borderWidth: 1, borderColor: T.accent, padding: 15, borderRadius: T.radii.lg, width: "100%", alignItems: "center" }}>
              <Text style={{ color: T.accentText, fontWeight: "900" }}>View my passes</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step < 4 ? (
          <TouchableOpacity
            disabled={createPass.isPending || resolvingRoute}
            onPress={continueFlow}
            style={{ marginTop: 28, backgroundColor: T.accent, opacity: createPass.isPending || resolvingRoute ? 0.6 : 1, borderRadius: T.radii.lg, padding: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, ...T.shadow.accent }}
          >
            {createPass.isPending || resolvingRoute ? <ActivityIndicator size="small" color={T.surface1} /> : null}
            <Text style={{ color: T.surface1, fontWeight: "900" }}>{resolvingRoute ? "Checking route…" : step === 3 ? "Proceed to pay" : "Continue"}</Text>
            {!createPass.isPending && !resolvingRoute ? <ArrowRight color={T.surface1} size={18} /> : null}
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={timePickerOpen} transparent animationType="fade" onRequestClose={() => setTimePickerOpen(false)}>
        <Pressable onPress={() => setTimePickerOpen(false)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(21,32,34,0.45)" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: T.surface1, borderTopLeftRadius: T.radii.xxl, borderTopRightRadius: T.radii.xxl, padding: 20, paddingBottom: insets.bottom + 24, maxHeight: "82%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View>
                <Text style={{ ...T.typography.heading, color: T.text1 }}>Choose pickup time</Text>
                <Text style={{ ...T.typography.caption, color: T.text2, marginTop: 2 }}>Available recurring slots from 5 AM</Text>
              </View>
              <TouchableOpacity onPress={() => setTimePickerOpen(false)} hitSlop={10} accessibilityLabel="Close time picker">
                <X size={ICON.md} color={T.text3} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {PASS_TIME_SLOTS.map((slot) => {
                const selected = slot === time;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => {
                      setTime(slot);
                      setTimePickerOpen(false);
                    }}
                    style={{ minHeight: 52, borderRadius: T.radii.md, borderWidth: 1, borderColor: selected ? T.accent : T.border, backgroundColor: selected ? T.accentDim : T.surface1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: T.text1 }}>{formatTime(slot)}</Text>
                      <Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Recurring pickup time</Text>
                    </View>
                    {selected ? <CheckCircle2 size={ICON.md} color={T.accentText} /> : <Text style={{ color: T.accentText, fontWeight: "900" }}>Select</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
