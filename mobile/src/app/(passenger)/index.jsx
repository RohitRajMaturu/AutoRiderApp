import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Navigation2,
  ArrowRight,
  X,
  Phone,
  CheckCircle2,
  Clock3,
  Car,
  Star,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import AutoRiderLoader from "@/components/AutoRiderLoader";

const PRIMARY = "#F97316";
const PRIMARY_LIGHT = "#FFF7ED";
const PRIMARY_BORDER = "#FED7AA";
const BG = "#FFFBF5";
const SURFACE = "#FFFFFF";
const BORDER = "#E7E5E4";
const TEXT = "#1C1917";
const TEXT_SECONDARY = "#78716C";
const TEXT_MUTED = "#A8A29E";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";

const CANCEL_REASONS = [
  { label: "Driver taking too long", value: "driver_taking_too_long" },
  { label: "Booked by mistake", value: "booked_by_mistake" },
  { label: "Plans changed", value: "plans_changed" },
];

function formatLocationAddress(location) {
  const parts = [
    location.name,
    location.street,
    location.district,
    location.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Current Location";
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms),
    ),
  ]);
}

function buildMapRegion(points) {
  const validPoints = points.filter(
    (point) =>
      point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng),
  );
  if (validPoints.length === 0) return null;

  const minLat = Math.min(...validPoints.map((point) => point.lat));
  const maxLat = Math.max(...validPoints.map((point) => point.lat));
  const minLng = Math.min(...validPoints.map((point) => point.lng));
  const maxLng = Math.max(...validPoints.map((point) => point.lng));

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.5, 0.025),
    longitudeDelta: Math.max((maxLng - minLng) * 2.5, 0.025),
  };
}

function StatusBadge({ status }) {
  const configs = {
    requested: { bg: "#FEF3C7", text: "#D97706", label: "Finding Driver" },
    accepted: { bg: SUCCESS_LIGHT, text: SUCCESS, label: "Accepted" },
    completed: { bg: "#DBEAFE", text: "#2563EB", label: "Completed" },
    cancelled: { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" },
  };
  const c = configs[status] || configs.requested;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 99,
        backgroundColor: c.bg,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: c.text,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {c.label}
      </Text>
    </View>
  );
}

function buildTripStatusMessage(ride) {
  return [
    "AutoRide trip status",
    `Pickup: ${ride.pickup_address}`,
    `Destination: ${ride.dest_address}`,
    ride.vehicle_number ? `Vehicle: ${ride.vehicle_number}` : null,
    ride.driver_phone ? `Driver phone: ${ride.driver_phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [pickupPlaceId, setPickupPlaceId] = useState(null);
  const [destinationPlaceId, setDestinationPlaceId] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [currentLocationSuggestion, setCurrentLocationSuggestion] =
    useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [dismissedRatingRideIds, setDismissedRatingRideIds] = useState(
    () => new Set(),
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef(null);

  // ── Fetch active ride (only poll, never block UI on refetch) ──
  const { data: activeRide } = useQuery({
    queryKey: ["activeRide"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      const data = await res.json();
      const ride =
        data.rides?.find(
          (r) =>
            r.status === "requested" ||
            r.status === "accepted" ||
            (r.status === "completed" && !r.driver_rating),
        ) || null;
      return ride;
    },
    refetchInterval: 6000,
    // Don't re-show loading state on background refetches
    staleTime: 4000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let mounted = true;

    async function loadCurrentLocation() {
      setIsLocating(true);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;

        const position = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          8000,
        );
        const { latitude, longitude } = position.coords;
        let reversePlace = null;
        try {
          const res = await withTimeout(
            fetch(`/api/locations/reverse?lat=${latitude}&lng=${longitude}`),
            5000,
          );
          const data = await res.json();
          reversePlace = data.place || null;
        } catch {
          reversePlace = null;
        }

        const [address] = reversePlace
          ? []
          : await withTimeout(
              Location.reverseGeocodeAsync({
                latitude,
                longitude,
              }),
              5000,
            ).catch(() => []);

        if (!mounted) return;

        const suggestion = {
          label: "Current Location",
          address:
            reversePlace?.address ||
            (address ? formatLocationAddress(address) : "Current Location"),
          placeId: reversePlace?.placeId || "current-location",
          lat: latitude,
          lng: longitude,
          isCurrentLocation: true,
        };
        setCurrentLocationSuggestion(suggestion);
        setUserCoords({ lat: latitude, lng: longitude });
        setPickup(suggestion.address);
        setPickupCoords({ lat: latitude, lng: longitude });
        setPickupPlaceId(suggestion.placeId);
      } catch {
        // Keep the manual pickup field usable if location permission or lookup fails.
      } finally {
        if (mounted) setIsLocating(false);
      }
    }

    loadCurrentLocation();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (focusedField !== "pickup") return;

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: pickup });
        if (userCoords) {
          params.set("lat", String(userCoords.lat));
          params.set("lng", String(userCoords.lng));
        }
        const res = await fetch(`/api/locations/autocomplete?${params}`);
        const data = await res.json();
        const remoteSuggestions = data.suggestions || [];
        const withCurrent = currentLocationSuggestion
          ? [
              currentLocationSuggestion,
              ...remoteSuggestions.filter(
                (item) => item.placeId !== currentLocationSuggestion.placeId,
              ),
            ]
          : remoteSuggestions;
        setPickupSuggestions(
          withCurrent.length > 0
            ? withCurrent.slice(0, 6)
            : currentLocationSuggestion
              ? [currentLocationSuggestion]
              : [],
        );
      } catch {
        setPickupSuggestions(
          currentLocationSuggestion ? [currentLocationSuggestion] : [],
        );
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [pickup, focusedField, userCoords, currentLocationSuggestion]);

  useEffect(() => {
    if (focusedField !== "destination") return;

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: destination });
        if (userCoords) {
          params.set("lat", String(userCoords.lat));
          params.set("lng", String(userCoords.lng));
        }
        const res = await fetch(`/api/locations/autocomplete?${params}`);
        const data = await res.json();
        const remoteSuggestions = (data.suggestions || []).filter(
          (item) => !item.isCurrentLocation,
        );
        setDestinationSuggestions(
          remoteSuggestions.length > 0
            ? remoteSuggestions.slice(0, 6)
            : [],
        );
      } catch {
        setDestinationSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [destination, focusedField, userCoords]);

  // ── Pulse animation — driven by ride status, NOT queryFn ──
  useEffect(() => {
    if (activeRide?.status === "requested") {
      if (pulseRef.current) return; // already running
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    } else {
      if (pulseRef.current) {
        pulseRef.current.stop();
        pulseRef.current = null;
      }
      pulseAnim.setValue(1);
    }
  }, [activeRide?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pulseRef.current) {
        pulseRef.current.stop();
        pulseRef.current = null;
      }
    };
  }, []);

  // ── Request ride ──
  const requestRide = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: pickup.trim(),
          dest_address: destination.trim(),
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          dest_lat: destinationCoords.lat,
          dest_lng: destinationCoords.lng,
          pickup_place_id: pickupPlaceId,
          dest_place_id: destinationPlaceId,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to request ride");
      }
      return res.json();
    },
    onSuccess: () => {
      // TanStack Query v5 format
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
      if (currentLocationSuggestion) {
        setPickup(currentLocationSuggestion.address);
        setPickupCoords({
          lat: currentLocationSuggestion.lat,
          lng: currentLocationSuggestion.lng,
        });
        setPickupPlaceId(currentLocationSuggestion.placeId);
      } else {
        setPickup("");
        setPickupCoords(null);
        setPickupPlaceId(null);
      }
      setDestination("");
      setDestinationCoords(null);
      setDestinationPlaceId(null);
      setFocusedField(null);
    },
    onError: (err) => Alert.alert("Request Failed", err.message),
  });

  // ── Cancel ride ──
  const cancelRide = useMutation({
    mutationFn: async ({ rideId, reason }) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
    onError: () => Alert.alert("Error", "Could not cancel the ride"),
  });

  const rateRide = useMutation({
    mutationFn: async ({ rideId, rating, feedback }) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rate",
          driver_rating: rating,
          rating_feedback: feedback,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to submit rating");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      setRatingValue(0);
      setRatingFeedback("");
      setDismissedRatingRideIds((current) => {
        const next = new Set(current);
        next.add(variables.rideId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
    onError: (err) => Alert.alert("Rating Failed", err.message),
  });

  const canRequest =
    pickup.trim().length > 0 &&
    destination.trim().length > 0 &&
    !!pickupCoords &&
    !!destinationCoords &&
    !requestRide.isPending;

  const promptCancelRide = (rideId) => {
    Alert.alert("Cancel Ride?", "Do you want to cancel this ride request?", [
      { text: "No", style: "cancel" },
      {
        text: "Choose Reason",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Cancellation Reason",
            "This reason will be visible to the other side.",
            CANCEL_REASONS.map((item) => ({
              text: item.label,
              style: "destructive",
              onPress: () => cancelRide.mutate({ rideId, reason: item.value }),
            })),
          ),
      },
    ]);
  };

  const shareTripStatus = async (ride) => {
    const message = buildTripStatusMessage(ride);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    const smsUrl =
      Platform.OS === "ios"
        ? `sms:&body=${encodedMessage}`
        : `sms:?body=${encodedMessage}`;

    try {
      if (await Linking.canOpenURL(whatsappUrl)) {
        await Linking.openURL(whatsappUrl);
        return;
      }
      await Linking.openURL(smsUrl);
    } catch {
      Alert.alert("Share Failed", "Could not open WhatsApp or SMS.");
    }
  };

  const dismissRatingPrompt = (rideId) => {
    setDismissedRatingRideIds((current) => {
      const next = new Set(current);
      next.add(rideId);
      return next;
    });
  };

  const mapRegion = buildMapRegion([pickupCoords, destinationCoords]);
  const displayRide =
    activeRide?.status === "completed" &&
    dismissedRatingRideIds.has(activeRide.id)
      ? null
      : activeRide;
  const activePickupCoords = activeRide
    ? { lat: Number(activeRide.pickup_lat), lng: Number(activeRide.pickup_lng) }
    : null;
  const activeDestinationCoords = activeRide
    ? { lat: Number(activeRide.dest_lat), lng: Number(activeRide.dest_lng) }
    : null;
  const activeDriverLat = Number(activeRide?.driver_last_lat);
  const activeDriverLng = Number(activeRide?.driver_last_lng);
  const activeDriverCoords =
    activeRide?.status === "accepted" &&
    Number.isFinite(activeDriverLat) &&
    Number.isFinite(activeDriverLng)
      ? { lat: activeDriverLat, lng: activeDriverLng }
      : null;
  const activeRideMapRegion = buildMapRegion([
    activePickupCoords,
    activeDestinationCoords,
    activeDriverCoords,
  ]);

  const updatePickupFromMap = async ({ latitude, longitude }) => {
    setPickupCoords({ lat: latitude, lng: longitude });
    setPickupPlaceId(null);
    try {
      const res = await fetch(`/api/locations/reverse?lat=${latitude}&lng=${longitude}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.place?.address) {
        setPickup(data.place.address);
        setPickupPlaceId(data.place.placeId || null);
      }
    } catch {
      // Keep the dragged coordinates even if reverse geocoding is unavailable.
    }
  };

  const resolvePlace = async (place) => {
    if (place.lat && place.lng) {
      return place;
    }
    if (!place.placeId) {
      return place;
    }
    const res = await fetch(`/api/locations/place/${encodeURIComponent(place.placeId)}`);
    if (!res.ok) {
      return place;
    }
    const data = await res.json();
    return data.place || place;
  };

  const selectPickup = async (place) => {
    const resolved = await resolvePlace(place);
    setPickup(resolved.address);
    setPickupCoords(
      resolved.lat && resolved.lng ? { lat: resolved.lat, lng: resolved.lng } : null,
    );
    setPickupPlaceId(resolved.placeId || null);
    setFocusedField(null);
    setPickupSuggestions([]);
  };

  const selectDestination = async (place) => {
    const resolved = await resolvePlace(place);
    setDestination(resolved.address);
    setDestinationCoords(
      resolved.lat && resolved.lng ? { lat: resolved.lat, lng: resolved.lng } : null,
    );
    setDestinationPlaceId(resolved.placeId || null);
    setFocusedField(null);
    setDestinationSuggestions([]);
  };

  const renderSuggestions = (suggestions, onSelect) => {
    if (suggestions.length === 0) return null;

    return (
      <View
        style={{
          marginTop: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: BORDER,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        {suggestions.map((place, index) => (
          <TouchableOpacity
            key={`${place.label}-${place.address}-${index}`}
            onPress={() => onSelect(place)}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: index === suggestions.length - 1 ? 0 : 1,
              borderBottomColor: "#F5F5F4",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <MapPin
              size={16}
              color={place.isCurrentLocation ? PRIMARY : TEXT_SECONDARY}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>
                {place.label}
              </Text>
              <Text
                style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}
                numberOfLines={1}
              >
                {place.address}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

      {/* Header — static, never re-mounts */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: TEXT,
                letterSpacing: -0.5,
              }}
            >
              🛺 Where to?
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
              Book your auto in seconds
            </Text>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: PRIMARY_LIGHT,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>🛺</Text>
          </View>
        </View>
      </View>

      {/* keyboardShouldPersistTaps so button taps work while keyboard is open */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {displayRide ? (
          /* ── Active Ride Card ── */
          <View style={{ margin: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 18,
                borderWidth: 1,
                borderColor:
                  activeRide.status === "accepted" ? PRIMARY_BORDER : BORDER,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              {/* Status header */}
              <View
                style={{
                  backgroundColor:
                    activeRide.status === "accepted"
                      ? PRIMARY_LIGHT
                      : "#FFFBEB",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor:
                    activeRide.status === "accepted"
                      ? PRIMARY_BORDER
                      : "#FDE68A",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {activeRide.status === "requested" ? (
                    <Animated.View
                      style={{ transform: [{ scale: pulseAnim }] }}
                    >
                      <Clock3 size={20} color="#D97706" />
                    </Animated.View>
                  ) : (
                    <CheckCircle2 size={20} color={PRIMARY} />
                  )}
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: TEXT }}
                  >
                    {activeRide.status === "requested"
                      ? "Searching for drivers..."
                      : activeRide.status === "completed"
                        ? "Ride completed"
                        : "Driver is on the way!"}
                  </Text>
                </View>
                <StatusBadge status={activeRide.status} />
              </View>

              {Platform.OS !== "web" && activeRideMapRegion && (
                <View
                  style={{
                    height: 220,
                    borderBottomWidth: 1,
                    borderBottomColor: BORDER,
                    backgroundColor: SURFACE,
                  }}
                >
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={activeRideMapRegion}
                    region={activeRideMapRegion}
                    showsUserLocation
                    showsMyLocationButton
                  >
                    {activePickupCoords && (
                      <Marker
                        coordinate={{
                          latitude: activePickupCoords.lat,
                          longitude: activePickupCoords.lng,
                        }}
                        title="Pickup"
                        pinColor={PRIMARY}
                      />
                    )}
                    {activeDestinationCoords && (
                      <Marker
                        coordinate={{
                          latitude: activeDestinationCoords.lat,
                          longitude: activeDestinationCoords.lng,
                        }}
                        title="Destination"
                        pinColor={SUCCESS}
                      />
                    )}
                    {activeDriverCoords && (
                      <Marker
                        coordinate={{
                          latitude: activeDriverCoords.lat,
                          longitude: activeDriverCoords.lng,
                        }}
                        title="Driver"
                        description={activeRide.vehicle_number || "Your driver"}
                        pinColor="#2563EB"
                      />
                    )}
                  </MapView>
                </View>
              )}

              {/* Route info */}
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View style={{ alignItems: "center", paddingTop: 4 }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: PRIMARY,
                      }}
                    />
                    <View
                      style={{
                        width: 2,
                        height: 30,
                        backgroundColor: BORDER,
                        marginVertical: 4,
                      }}
                    />
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: TEXT,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 12 }}>
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: TEXT_MUTED,
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        From
                      </Text>
                      <Text
                        style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                        numberOfLines={1}
                      >
                        {activeRide.pickup_address}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: TEXT_MUTED,
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        To
                      </Text>
                      <Text
                        style={{ fontSize: 14, fontWeight: "600", color: TEXT }}
                        numberOfLines={1}
                      >
                        {activeRide.dest_address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Driver info when accepted */}
                {activeRide.status === "accepted" &&
                  activeRide.vehicle_number && (
                    <View
                      style={{
                        marginTop: 16,
                        backgroundColor: PRIMARY_LIGHT,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: PRIMARY_BORDER,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: PRIMARY,
                            justifyContent: "center",
                            alignItems: "center",
                            overflow: "hidden",
                          }}
                        >
                          {activeRide.auto_photo_url ? (
                            <Image
                              source={{ uri: activeRide.auto_photo_url }}
                              style={{ width: 44, height: 44 }}
                            />
                          ) : (
                            <Car size={22} color="#fff" />
                          )}
                        </View>
                        <View>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: TEXT,
                            }}
                          >
                            {activeRide.vehicle_number}
                          </Text>
                          <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                            {activeRide.driver_phone || "Your driver"}
                          </Text>
                        </View>
                      </View>
                      {activeRide.driver_phone && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${activeRide.driver_phone}`)
                          }
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: SUCCESS,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Phone size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                {activeRide.status === "accepted" && (
                  <TouchableOpacity
                    onPress={() => shareTripStatus(activeRide)}
                    style={{
                      marginTop: 16,
                      backgroundColor: SUCCESS_LIGHT,
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#BBF7D0",
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={{
                        color: SUCCESS,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Share Trip Status
                    </Text>
                  </TouchableOpacity>
                )}

                {activeRide.status === "completed" && !activeRide.driver_rating && (
                  <View
                    style={{
                      marginTop: 16,
                      backgroundColor: "#FFFBEB",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#FDE68A",
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: TEXT,
                      }}
                    >
                      Rate your driver
                    </Text>
                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 12 }}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setRatingValue(value)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Star
                            size={28}
                            color={value <= ratingValue ? "#F59E0B" : TEXT_MUTED}
                            fill={value <= ratingValue ? "#F59E0B" : "none"}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      value={ratingFeedback}
                      onChangeText={(value) =>
                        setRatingFeedback(value.slice(0, 280))
                      }
                      placeholder="Optional feedback"
                      placeholderTextColor={TEXT_MUTED}
                      multiline
                      maxLength={280}
                      style={{
                        marginTop: 12,
                        minHeight: 72,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#FDE68A",
                        backgroundColor: "#fff",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 13,
                        color: TEXT,
                        textAlignVertical: "top",
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => dismissRatingPrompt(activeRide.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: TEXT_SECONDARY,
                          }}
                        >
                          Dismiss
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          rateRide.mutate({
                            rideId: activeRide.id,
                            rating: ratingValue,
                            feedback: ratingFeedback,
                          })
                        }
                        disabled={ratingValue === 0 || rateRide.isPending}
                        style={{
                          flex: 2,
                          paddingVertical: 12,
                          borderRadius: 10,
                          alignItems: "center",
                          backgroundColor:
                            ratingValue === 0 || rateRide.isPending
                              ? "#D4C4BB"
                              : PRIMARY,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#fff",
                          }}
                        >
                          {rateRide.isPending ? "Submitting..." : "Submit Rating"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Cancel */}
                {activeRide.status !== "completed" && (
                <TouchableOpacity
                  onPress={() => promptCancelRide(activeRide.id)}
                  disabled={cancelRide.isPending}
                  style={{
                    marginTop: 16,
                    alignItems: "center",
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {cancelRide.isPending
                      ? "Cancelling..."
                      : "✕  Cancel Request"}
                  </Text>
                </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* ── Ride Request Form ── */
          <View style={{ margin: 16 }}>
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: BORDER,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 3,
                overflow: "hidden",
              }}
            >
              {/* Pickup input */}
              <View
                style={{
                  padding: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F5F5F4",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: PRIMARY_LIGHT,
                      borderWidth: 1.5,
                      borderColor: PRIMARY_BORDER,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <MapPin size={18} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 4,
                      }}
                    >
                      Pickup Location
                    </Text>
                    <TextInput
                      placeholder="Enter your pickup address"
                      placeholderTextColor={TEXT_MUTED}
                      value={pickup}
                      onFocus={() => setFocusedField("pickup")}
                      onChangeText={(value) => {
                        setPickup(value);
                        setPickupCoords(null);
                        setPickupPlaceId(null);
                        setFocusedField("pickup");
                      }}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      style={{
                        fontSize: 15,
                        color: TEXT,
                        fontWeight: "500",
                        paddingVertical: 0,
                      }}
                    />
                  </View>
                  {pickup.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setPickup("");
                        setPickupCoords(null);
                        setPickupPlaceId(null);
                        setFocusedField("pickup");
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
                {isLocating && pickup.length === 0 ? (
                  <View style={{ marginTop: 12, alignItems: "flex-start" }}>
                    <AutoRiderLoader
                      label="Detecting your location..."
                      textColor={TEXT_SECONDARY}
                    />
                  </View>
                ) : (
                  renderSuggestions(
                    focusedField === "pickup" ? pickupSuggestions : [],
                    selectPickup,
                  )
                )}
              </View>

              {/* Destination input */}
              <View style={{ padding: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: "#F5F5F4",
                      borderWidth: 1.5,
                      borderColor: BORDER,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Navigation2 size={18} color={TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 4,
                      }}
                    >
                      Destination
                    </Text>
                    <TextInput
                      placeholder="Where are you going?"
                      placeholderTextColor={TEXT_MUTED}
                      value={destination}
                      onFocus={() => setFocusedField("destination")}
                      onChangeText={(value) => {
                        setDestination(value);
                        setDestinationCoords(null);
                        setDestinationPlaceId(null);
                        setFocusedField("destination");
                      }}
                      returnKeyType="done"
                      style={{
                        fontSize: 15,
                        color: TEXT,
                        fontWeight: "500",
                        paddingVertical: 0,
                      }}
                    />
                  </View>
                  {destination.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setDestination("");
                        setDestinationCoords(null);
                        setDestinationPlaceId(null);
                        setFocusedField("destination");
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
                {renderSuggestions(
                  focusedField === "destination" ? destinationSuggestions : [],
                  selectDestination,
                )}
              </View>
            </View>

            {Platform.OS !== "web" && mapRegion && (
              <View
                style={{
                  marginTop: 14,
                  height: 210,
                  borderRadius: 18,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: BORDER,
                  backgroundColor: SURFACE,
                }}
              >
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={mapRegion}
                  region={mapRegion}
                  showsUserLocation
                  showsMyLocationButton
                >
                  {pickupCoords && (
                    <Marker
                      coordinate={{
                        latitude: pickupCoords.lat,
                        longitude: pickupCoords.lng,
                      }}
                      draggable
                      title="Pickup"
                      description="Drag to adjust pickup"
                      pinColor={PRIMARY}
                      onDragEnd={(event) =>
                        updatePickupFromMap(event.nativeEvent.coordinate)
                      }
                    />
                  )}
                  {destinationCoords && (
                    <Marker
                      coordinate={{
                        latitude: destinationCoords.lat,
                        longitude: destinationCoords.lng,
                      }}
                      title="Destination"
                      pinColor={SUCCESS}
                    />
                  )}
                </MapView>
              </View>
            )}

            {/* Request button */}
            <TouchableOpacity
              onPress={() => requestRide.mutate()}
              disabled={!canRequest}
              activeOpacity={0.85}
              style={{
                marginTop: 16,
                backgroundColor: canRequest ? PRIMARY : "#D4C4BB",
                borderRadius: 14,
                paddingVertical: 17,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                shadowColor: PRIMARY,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: canRequest ? 0.3 : 0,
                shadowRadius: 12,
                elevation: canRequest ? 6 : 0,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                }}
              >
                {requestRide.isPending ? "Requesting..." : "🛺  Request Auto"}
              </Text>
              {!requestRide.isPending && <ArrowRight size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}

        {/* Safety tip */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#BBF7D0",
              padding: 14,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 18 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: SUCCESS,
                  marginBottom: 3,
                }}
              >
                Safety First
              </Text>
              <Text style={{ fontSize: 12, color: "#166534", lineHeight: 18 }}>
                Always verify the vehicle number and driver details before
                boarding.
              </Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 10,
            }}
          >
            💡 Tips
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              {
                icon: "📍",
                title: "Be Specific",
                desc: "Add a landmark to help the driver find you",
              },
              {
                icon: "⏱️",
                title: "Be Ready",
                desc: "Wait at your pickup point after confirming",
              },
            ].map((tip, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 6 }}>
                  {tip.icon}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: TEXT,
                    marginBottom: 4,
                  }}
                >
                  {tip.title}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: TEXT_SECONDARY,
                    lineHeight: 16,
                  }}
                >
                  {tip.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
