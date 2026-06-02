import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from "react-native";
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
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";

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

const PLACE_SUGGESTIONS = [
  {
    label: "Current Location",
    address: "Use my current location",
    lat: 12.9716,
    lng: 77.5946,
    isCurrentLocation: true,
  },
  {
    label: "Majestic",
    address: "Kempegowda Bus Station, Bengaluru",
    lat: 12.9767,
    lng: 77.5713,
  },
  {
    label: "MG Road",
    address: "MG Road, Bengaluru",
    lat: 12.9756,
    lng: 77.6068,
  },
  {
    label: "Indiranagar",
    address: "Indiranagar, Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    label: "Koramangala",
    address: "Koramangala, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    label: "Whitefield",
    address: "Whitefield, Bengaluru",
    lat: 12.9698,
    lng: 77.75,
  },
  {
    label: "Electronic City",
    address: "Electronic City, Bengaluru",
    lat: 12.8452,
    lng: 77.6602,
  },
  {
    label: "Jayanagar",
    address: "Jayanagar, Bengaluru",
    lat: 12.925,
    lng: 77.5938,
  },
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

function getSuggestions(query, currentLocationSuggestion) {
  const value = query.trim().toLowerCase();
  const suggestions = currentLocationSuggestion
    ? [currentLocationSuggestion, ...PLACE_SUGGESTIONS.filter((p) => !p.isCurrentLocation)]
    : PLACE_SUGGESTIONS;

  if (!value) {
    return suggestions.slice(0, 4);
  }

  return suggestions
    .filter((place) => {
      return (
        place.label.toLowerCase().includes(value) ||
        place.address.toLowerCase().includes(value)
      );
    })
    .slice(0, 5);
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

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [currentLocationSuggestion, setCurrentLocationSuggestion] =
    useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
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
          (r) => r.status === "requested" || r.status === "accepted",
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

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = position.coords;
        let reversePlace = null;
        try {
          const res = await fetch(
            `/api/locations/reverse?lat=${latitude}&lng=${longitude}`,
          );
          const data = await res.json();
          reversePlace = data.place || null;
        } catch {
          reversePlace = null;
        }

        const [address] = reversePlace
          ? []
          : await Location.reverseGeocodeAsync({
              latitude,
              longitude,
            });

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
            : getSuggestions(pickup, currentLocationSuggestion),
        );
      } catch {
        setPickupSuggestions(getSuggestions(pickup, currentLocationSuggestion));
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
            : getSuggestions(destination, null),
        );
      } catch {
        setDestinationSuggestions(getSuggestions(destination, null));
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
          pickup_lat: pickupCoords?.lat ?? 12.9716,
          pickup_lng: pickupCoords?.lng ?? 77.5946,
          dest_lat: destinationCoords?.lat ?? 12.9352,
          dest_lng: destinationCoords?.lng ?? 77.6245,
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
      } else {
        setPickup("");
        setPickupCoords(null);
      }
      setDestination("");
      setDestinationCoords(null);
      setFocusedField(null);
    },
    onError: (err) => Alert.alert("Request Failed", err.message),
  });

  // ── Cancel ride ──
  const cancelRide = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
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

  const canRequest =
    pickup.trim().length > 0 &&
    destination.trim().length > 0 &&
    !requestRide.isPending;
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
    setFocusedField(null);
    setPickupSuggestions([]);
  };

  const selectDestination = async (place) => {
    const resolved = await resolvePlace(place);
    setDestination(resolved.address);
    setDestinationCoords(
      resolved.lat && resolved.lng ? { lat: resolved.lat, lng: resolved.lng } : null,
    );
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
        {activeRide ? (
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
                      : "Driver is on the way!"}
                  </Text>
                </View>
                <StatusBadge status={activeRide.status} />
              </View>

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
                          }}
                        >
                          <Car size={22} color="#fff" />
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
                            Your driver
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

                {/* Cancel */}
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      "Cancel Ride?",
                      "Are you sure you want to cancel?",
                      [
                        { text: "No", style: "cancel" },
                        {
                          text: "Yes, Cancel",
                          style: "destructive",
                          onPress: () => cancelRide.mutate(activeRide.id),
                        },
                      ],
                    );
                  }}
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
                        setFocusedField("pickup");
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
                {isLocating && pickup.length === 0 ? (
                  <Text
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                    }}
                  >
                    Detecting your current location...
                  </Text>
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
