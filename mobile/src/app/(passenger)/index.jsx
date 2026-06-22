import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
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
  Share,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Navigation,
  Navigation2,
  ArrowRight,
  X,
  Phone,
  CheckCircle2,
  Clock3,
  Car,
  Star,
  IndianRupee,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { ICON } from "@/theme/iconScale";
import { useAuth } from "@/utils/auth/useAuth";
import { createRidePusher } from "@/utils/pusher";

const TUKTUKGO_ICON = require("../../../assets/images/icon.png");
const PRIMARY = "#43B8B3";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUCCESS = "#16A34A";
const SUCCESS_LIGHT = "#DCFCE7";

function openGoogleMaps(destLat, destLng, destLabel) {
  const label = encodeURIComponent(destLabel || "Destination");
  const url = Platform.select({
    ios: `maps://?daddr=${destLat},${destLng}&dirflg=d`,
    android: `google.navigation:q=${destLat},${destLng}&mode=d`,
  });
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_id=${label}&travelmode=driving`;
  Linking.canOpenURL(url).then((supported) => {
    Linking.openURL(supported ? url : fallback);
  });
}

const CANCEL_REASONS = [
  { label: "Driver taking too long", value: "driver_taking_too_long" },
  { label: "Driver asked me to cancel", value: "driver_asked_to_cancel" },
  { label: "Wrong pickup or destination", value: "wrong_pickup_or_destination" },
  { label: "Booked by mistake", value: "booked_by_mistake" },
  { label: "Plans changed", value: "plans_changed" },
  { label: "Other", value: "other" },
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
    requested: { bg: "#FEF3C7", text: "#B88700", label: "Finding Driver" },
    negotiating: { bg: "#E0F2FE", text: "#0369A1", label: "Negotiating" },
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
    "TukTukGo trip status",
    `Pickup: ${ride.pickup_address}`,
    `Destination: ${ride.dest_address}`,
    ride.vehicle_number ? `Vehicle: ${ride.vehicle_number}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCurrency(value) {
  const amount = Number(value);
  return `Rs. ${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
}

function rideFare(ride) {
  return ride?.final_fare ?? ride?.estimated_fare ?? 0;
}

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
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
  const [, setShowCancelReasons] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState(
    CANCEL_REASONS[0].value,
  );
  const [otherCancelReason, setOtherCancelReason] = useState("");
  const [negotiationMode, setNegotiationMode] = useState("fixed");
  const [fareMin, setFareMin] = useState("");
  const [fareMax, setFareMax] = useState("");
  const [fareOfferEdited, setFareOfferEdited] = useState(false);
  const [fareInputError, setFareInputError] = useState("");
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [negotiationRemaining, setNegotiationRemaining] = useState(0);
  const [dismissedRatingRideIds, setDismissedRatingRideIds] = useState(
    () => new Set(),
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef(null);
  const cancelSheetRef = useRef(null);
  const cancelSnapPoints = useMemo(() => ["62%", "86%"], []);
  const renderCancelBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
      />
    ),
    [],
  );

  const openCancelSheet = () => {
    setShowCancelReasons(true);
    requestAnimationFrame(() => cancelSheetRef.current?.snapToIndex(0));
  };

  const closeCancelSheet = () => {
    cancelSheetRef.current?.close();
    setShowCancelReasons(false);
  };

  // ── Fetch active ride (only poll, never block UI on refetch) ──
  const { data: activeRide, isLoading: activeRideLoading } = useQuery({
    queryKey: ["activeRide"],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to fetch rides");
      const data = await res.json();
      const ride =
        data.rides?.find(
          (r) =>
            r.status === "requested" ||
            r.status === "negotiating" ||
            r.status === "accepted" ||
            (r.status === "completed" && !r.driver_rating),
        ) || null;
      return ride;
    },
    refetchInterval: (query) =>
      query.state.data?.status === "negotiating" ? 10000 : 6000,
    // Don't re-show loading state on background refetches
    staleTime: 4000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: tripEstimate, isFetching: tripEstimateLoading } = useQuery({
    queryKey: [
      "tripEstimate",
      pickupCoords?.lat,
      pickupCoords?.lng,
      destinationCoords?.lat,
      destinationCoords?.lng,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        pickup_lat: String(pickupCoords.lat),
        pickup_lng: String(pickupCoords.lng),
        dest_lat: String(destinationCoords.lat),
        dest_lng: String(destinationCoords.lng),
      });
      const res = await fetch(`/api/locations/estimate?${params}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to estimate route");
      }
      return res.json();
    },
    enabled: !!pickupCoords && !!destinationCoords && !activeRide,
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setFareOfferEdited(false);
    setFareInputError("");
  }, [
    pickupCoords?.lat,
    pickupCoords?.lng,
    destinationCoords?.lat,
    destinationCoords?.lng,
  ]);

  useEffect(() => {
    if (fareOfferEdited) return;

    const minFare = tripEstimate?.fareRange?.minFare;
    const maxFare = tripEstimate?.fareRange?.maxFare;
    const estimateFare = tripEstimate?.fareEstimate;
    if (!Number.isFinite(Number(minFare)) || !Number.isFinite(Number(maxFare))) {
      return;
    }

    setFareMin(String(Math.round(Number(minFare))));
    setFareMax(
      String(
        Math.round(
          Number.isFinite(Number(estimateFare)) ? Number(estimateFare) : Number(maxFare),
        ),
      ),
    );
  }, [
    fareOfferEdited,
    tripEstimate?.fareEstimate,
    tripEstimate?.fareRange?.minFare,
    tripEstimate?.fareRange?.maxFare,
  ]);

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
    if (activeRide?.status === "requested" || activeRide?.status === "negotiating") {
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
  }, [activeRide?.status, pulseAnim]);

  useEffect(() => {
    setIncomingOffers([]);
  }, [activeRide?.id]);

  useEffect(() => {
    if (!activeRide || activeRide.status !== "negotiating") return;

    const pusher = createRidePusher(auth);
    if (!pusher) return;

    const channelName = `private-ride-${activeRide.id}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("counter-offer", (data) => {
      setIncomingOffers((prev) => {
        if (prev.some((offer) => offer.driver_id === data.driverId || offer.driverId === data.driverId)) {
          return prev;
        }
        return [
          {
            id: `${data.driverId}-${data.respondedAt || Date.now()}`,
            driver_id: data.driverId,
            offer_type: "counter",
            offered_fare: data.offeredFare,
            responded_at: data.respondedAt,
          },
          ...prev,
        ];
      });
    });

    const refreshRide = () => {
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    };

    channel.bind("ride-locked", refreshRide);
    channel.bind("negotiation-expired", refreshRide);
    channel.bind("pusher:subscription_error", refreshRide);

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [activeRide?.id, activeRide?.status, auth?.jwt, queryClient]);

  const expireNegotiation = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}/expire-negotiation`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to expire negotiation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
  });

  useEffect(() => {
    if (!activeRide || activeRide.status !== "negotiating") {
      setNegotiationRemaining(0);
      return;
    }

    const expiresAt = new Date(activeRide.negotiation_expires_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setNegotiationRemaining(remaining);
      if (remaining === 0 && !expireNegotiation.isPending) {
        expireNegotiation.mutate(activeRide.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.negotiation_expires_at, expireNegotiation.isPending]);

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
          negotiation_mode: negotiationMode,
          fare_min: negotiationMode === "negotiated" ? Number(fareMin) : undefined,
          fare_max: negotiationMode === "negotiated" ? Number(fareMax) : undefined,
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
      setNegotiationMode("fixed");
      setFareMin("");
      setFareMax("");
      setFareOfferEdited(false);
      setFareInputError("");
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
      cancelSheetRef.current?.close();
      setShowCancelReasons(false);
      setSelectedCancelReason(CANCEL_REASONS[0].value);
      setOtherCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
    onError: () => Alert.alert("Error", "Could not cancel the ride"),
  });

  const rateRide = useMutation({
    mutationFn: async ({ rideId, rating, feedback }) => {
      const res = await fetch(`/api/rides/${rideId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: feedback,
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

  const hasTripEstimate = Number.isFinite(Number(tripEstimate?.fareEstimate));
  const suggestedMinFare = tripEstimate?.fareRange?.minFare;
  const suggestedMaxFare = tripEstimate?.fareRange?.maxFare;
  const hasSuggestedFareRange =
    Number.isFinite(Number(suggestedMinFare)) &&
    Number.isFinite(Number(suggestedMaxFare));
  const fareMinNumber = Number(fareMin);
  const fareMaxNumber = Number(fareMax);
  const estimateFareNumber = Number(tripEstimate?.fareEstimate);
  const offerChoices = hasSuggestedFareRange
    ? [
        { label: "Lower", value: Number(suggestedMinFare) },
        {
          label: "Fair",
          value: Number.isFinite(estimateFareNumber)
            ? estimateFareNumber
            : Number(suggestedMaxFare),
        },
        { label: "Quick", value: Number(suggestedMaxFare) },
      ]
    : [];
  const resetFareOfferToSuggestion = () => {
    if (!hasSuggestedFareRange) return;
    setFareMin(String(Math.round(Number(suggestedMinFare))));
    setFareMax(
      String(
        Math.round(
          Number.isFinite(estimateFareNumber)
            ? estimateFareNumber
            : Number(suggestedMaxFare),
        ),
      ),
    );
    setFareOfferEdited(false);
  };

  const selectFareOffer = (value) => {
    setFareOfferEdited(true);
    setFareInputError("");
    setFareMin(String(Math.round(Number(suggestedMinFare))));
    setFareMax(String(Math.round(Number(value))));
  };

  const validateCustomFareOffer = () => {
    if (!hasSuggestedFareRange) return;

    const min = Number(suggestedMinFare);
    const max = Number(suggestedMaxFare);
    const value = Number(fareMax);
    if (!Number.isInteger(value) || value < min || value > max) {
      setFareInputError(
        `Enter an offer between ${formatCurrency(min)} and ${formatCurrency(max)}.`,
      );
      resetFareOfferToSuggestion();
      return;
    }

    setFareInputError("");
    setFareMin(String(Math.round(min)));
    setFareMax(String(Math.round(value)));
  };

  const canRequest =
    pickup.trim().length > 0 &&
    destination.trim().length > 0 &&
    !!pickupCoords &&
    !!destinationCoords &&
    (negotiationMode === "fixed" ||
      (Number.isInteger(fareMinNumber) &&
        Number.isInteger(fareMaxNumber) &&
        fareMinNumber > 0 &&
        fareMaxNumber >= fareMinNumber &&
        (!hasSuggestedFareRange ||
          (fareMinNumber >= Number(suggestedMinFare) &&
            fareMaxNumber <= Number(suggestedMaxFare))))) &&
    !requestRide.isPending;

  const approveCounter = useMutation({
    mutationFn: async ({ rideId, driverId }) => {
      const res = await fetch(`/api/rides/${rideId}/approve-counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to approve counter offer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
    onError: (err) => Alert.alert("Offer Failed", err.message),
  });

  const submitCancelRide = (rideId) => {
    const reason =
      selectedCancelReason === "other"
        ? otherCancelReason.trim()
        : selectedCancelReason;

    if (!reason) return;
    cancelRide.mutate({ rideId, reason });
  };

  const shareTripStatus = async (ride) => {
    const message = buildTripStatusMessage(ride);
    try {
      await Share.share({ message });
    } catch {
      Alert.alert("Share Failed", "Could not open sharing options.");
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
  const activeRideAgeSeconds = activeRide?.created_at
    ? Math.floor((Date.now() - new Date(activeRide.created_at).getTime()) / 1000)
    : 0;
  const isLongDriverSearch =
    activeRide?.status === "requested" && activeRideAgeSeconds >= 60;
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
  const fareOffers = Array.isArray(activeRide?.fare_offers)
    ? activeRide.fare_offers
    : [];
  const counterOffers = [...incomingOffers, ...fareOffers]
    .filter((offer) => offer.offer_type === "counter")
    .filter(
      (offer, index, offers) =>
        offers.findIndex((item) => item.driver_id === offer.driver_id) === index,
    );
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
              size={ICON.sm}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: TEXT,
                borderWidth: 1,
                borderColor: "#26363A",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <Image
                source={TUKTUKGO_ICON}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: TEXT,
                letterSpacing: -0.5,
              }}
            >
              Where to?
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
              Book your auto in seconds
            </Text>
            </View>
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
        {activeRideLoading && !displayRide ? (
          <View style={{ margin: 16 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: SURFACE,
                borderColor: BORDER,
                borderRadius: 18,
                borderWidth: 1,
                paddingVertical: 18,
              }}
            >
              <TukTukGoLoader
                label="Checking active rides..."
                size={32}
                textColor={TEXT_SECONDARY}
              />
            </View>
          </View>
        ) : displayRide ? (
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
                      <Clock3 size={ICON.md} color="#B88700" />
                    </Animated.View>
                  ) : (
                    <CheckCircle2 size={ICON.md} color={PRIMARY} />
                  )}
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: TEXT }}
                  >
                    {activeRide.status === "requested"
                      ? "Searching for drivers..."
                      : activeRide.status === "negotiating"
                        ? `Negotiating fare - ${negotiationRemaining}s`
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
                  <TouchableOpacity
                    onPress={() =>
                      openGoogleMaps(
                        activeRide.dest_lat,
                        activeRide.dest_lng,
                        activeRide.dest_address,
                      )
                    }
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      zIndex: 10,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 8,
                      padding: 7,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 4,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Navigation size={ICON.sm} color="#43B8B3" />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#17272B" }}>
                      Navigate
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Route info */}
              {isLongDriverSearch && (
                <View
                  style={{
                    margin: 16,
                    marginBottom: 0,
                    backgroundColor: "#FEF3C7",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#FDE68A",
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#92400E" }}>
                    Taking longer than usual
                  </Text>
                  <Text style={{ fontSize: 12, color: "#92400E", marginTop: 4, lineHeight: 18 }}>
                    Nearby drivers may be busy. You can keep waiting or cancel and try again.
                  </Text>
                </View>
              )}

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

                {activeRide.status === "negotiating" && (
                  <View
                    style={{
                      marginTop: 16,
                      backgroundColor: "#F0F9FF",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#BAE6FD",
                      padding: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <IndianRupee size={ICON.md} color="#0369A1" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>
                          Your offer {formatCurrency(activeRide.fare_max)}
                        </Text>
                        <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
                          Drivers can accept this fare or send one counter.
                        </Text>
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: "#0369A1" }}>
                        {negotiationRemaining}s
                      </Text>
                    </View>

                    {counterOffers.length > 0 && (
                      <View style={{ marginTop: 12, gap: 10 }}>
                        {counterOffers.map((offer) => (
                          <View
                            key={offer.id || offer.driver_id}
                            style={{
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: "#BAE6FD",
                              backgroundColor: SURFACE,
                              padding: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>
                                Driver countered {formatCurrency(offer.offered_fare)}
                              </Text>
                              <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                                Approving locks this driver for your ride.
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() =>
                                approveCounter.mutate({
                                  rideId: activeRide.id,
                                  driverId: offer.driver_id,
                                })
                              }
                              disabled={approveCounter.isPending}
                              style={{
                                borderRadius: 10,
                                backgroundColor: approveCounter.isPending ? "#BFD1D3" : PRIMARY,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                              }}
                            >
                              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                                Accept
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

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
                            <Car size={ICON.lg} color="#fff" />
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
                            {activeRide.driver_phone ? "Call driver from the app" : "Your driver"}
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
                          <Phone size={ICON.md} color="#fff" />
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

                {activeRide.status === "completed" && (
                  <View
                    style={{
                      marginTop: 16,
                      backgroundColor: "#EFF6FF",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: "#2563EB",
                        textTransform: "uppercase",
                      }}
                    >
                      Fare details
                    </Text>
                    <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "700" }}>
                          Total fare
                        </Text>
                        <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT, marginTop: 2 }}>
                          {formatCurrency(rideFare(activeRide))}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "700" }}>
                          Distance
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT, marginTop: 6 }}>
                          {Number(activeRide.distance_km || 0).toFixed(1)} km
                        </Text>
                      </View>
                    </View>
                  </View>
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
                            size={ICON.xl}
                            color={value <= ratingValue ? "#F3B51B" : TEXT_MUTED}
                            fill={value <= ratingValue ? "#F3B51B" : "none"}
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
                              ? "#BFD1D3"
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
                    onPress={openCancelSheet}
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
                      {cancelRide.isPending ? "Cancelling..." : "Cancel Request"}
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
                    <MapPin size={ICON.md} color={PRIMARY} />
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
                      <X size={ICON.sm} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                </View>
                {isLocating && pickup.length === 0 ? (
                  <View style={{ marginTop: 12, alignItems: "flex-start" }}>
                    <TukTukGoLoader
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
                    <Navigation2 size={ICON.md} color={TEXT_SECONDARY} />
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
                      <X size={ICON.sm} color={TEXT_MUTED} />
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

            <View
              style={{
                marginTop: 14,
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: TEXT_MUTED,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Fare mode
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { value: "fixed", label: "Fixed" },
                  { value: "negotiated", label: "Negotiate" },
                ].map((item) => {
                  const selected = negotiationMode === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => setNegotiationMode(item.value)}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? PRIMARY_BORDER : BORDER,
                        backgroundColor: selected ? PRIMARY_LIGHT : "#F5F5F4",
                        paddingVertical: 11,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: selected ? PRIMARY : TEXT_SECONDARY,
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {(tripEstimateLoading || hasTripEstimate) && (
                <View
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: BORDER,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <IndianRupee size={ICON.sm} color={PRIMARY} />
                    <Text style={{ fontSize: 13, fontWeight: "900", color: TEXT }}>
                      {tripEstimateLoading
                        ? "Calculating fare..."
                        : `Estimated fare ${formatCurrency(tripEstimate.fareEstimate)}`}
                    </Text>
                  </View>
                  {hasTripEstimate && (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Text style={{ flex: 1, fontSize: 12, color: TEXT_SECONDARY }}>
                        {Number(tripEstimate.distanceKm || 0).toFixed(1)} km
                      </Text>
                      {hasSuggestedFareRange && (
                        <Text
                          style={{
                            flex: 2,
                            fontSize: 12,
                            color: TEXT_SECONDARY,
                            textAlign: "right",
                            fontWeight: "700",
                          }}
                        >
                          Offer between {formatCurrency(suggestedMinFare)} - {formatCurrency(suggestedMaxFare)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {negotiationMode === "negotiated" && hasSuggestedFareRange && (
                <View style={{ marginTop: 12, gap: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase" }}>
                    Your offer
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {offerChoices.map((choice) => {
                      const selected = Math.round(fareMaxNumber) === Math.round(choice.value);
                      return (
                        <TouchableOpacity
                          key={`${choice.label}-${choice.value}`}
                          onPress={() => selectFareOffer(choice.value)}
                          style={{
                            flex: 1,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: selected ? PRIMARY_BORDER : BORDER,
                            backgroundColor: selected ? PRIMARY_LIGHT : "#F5F5F4",
                            paddingVertical: 10,
                            paddingHorizontal: 6,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "800", color: selected ? PRIMARY : TEXT_MUTED }}>
                            {choice.label}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: "900", color: TEXT, marginTop: 2 }}>
                            {formatCurrency(choice.value)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: TEXT_SECONDARY,
                        lineHeight: 18,
                      }}
                    >
                      Drivers see this as your requested fare.
                    </Text>
                    <TextInput
                      value={fareMax}
                      onChangeText={(value) => {
                        setFareOfferEdited(true);
                        setFareInputError("");
                        setFareMax(value.replace(/[^\d]/g, ""));
                      }}
                      onEndEditing={validateCustomFareOffer}
                      placeholder="Custom"
                      placeholderTextColor={TEXT_MUTED}
                      keyboardType="number-pad"
                      style={{
                        width: 98,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: BORDER,
                        backgroundColor: "#F5F5F4",
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        color: TEXT,
                        fontWeight: "900",
                        textAlign: "center",
                      }}
                    />
                  </View>
                  {!!fareInputError && (
                    <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "700" }}>
                      {fareInputError}
                    </Text>
                  )}
                </View>
              )}

              {negotiationMode === "negotiated" && !hasSuggestedFareRange && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TextInput
                    value={fareMin}
                    onChangeText={(value) => {
                      setFareOfferEdited(true);
                      setFareMin(value.replace(/[^\d]/g, ""));
                    }}
                    placeholder="Min fare"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="number-pad"
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: BORDER,
                      backgroundColor: "#F5F5F4",
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: TEXT,
                      fontWeight: "700",
                    }}
                  />
                  <TextInput
                    value={fareMax}
                    onChangeText={(value) => {
                      setFareOfferEdited(true);
                      setFareMax(value.replace(/[^\d]/g, ""));
                    }}
                    placeholder="Max fare"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="number-pad"
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: BORDER,
                      backgroundColor: "#F5F5F4",
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: TEXT,
                      fontWeight: "700",
                    }}
                  />
                </View>
              )}
            </View>

            {/* Request button */}
            <TouchableOpacity
              onPress={() => requestRide.mutate()}
              disabled={!canRequest}
              activeOpacity={0.85}
              style={{
                marginTop: 16,
                backgroundColor: canRequest ? PRIMARY : "#BFD1D3",
                borderRadius: 14,
                paddingVertical: 17,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                shadowColor: PRIMARY,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: canRequest ? 0.5 : 0,
                shadowRadius: 24,
                elevation: canRequest ? 14 : 0,
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
                {requestRide.isPending ? "Requesting..." : "Request Auto"}
              </Text>
              {!requestRide.isPending && <ArrowRight size={ICON.md} color="#fff" />}
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
      <BottomSheet
        ref={cancelSheetRef}
        index={-1}
        snapPoints={cancelSnapPoints}
        enablePanDownToClose
        backdropComponent={renderCancelBackdrop}
        onClose={() => setShowCancelReasons(false)}
        backgroundStyle={{ backgroundColor: SURFACE }}
        handleIndicatorStyle={{ backgroundColor: BORDER, width: 42 }}
      >
        <BottomSheetView style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 36 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: TEXT,
            }}
          >
            Why are you cancelling?
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
            Pick one reason so the driver gets clear context.
          </Text>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderTopColor: BORDER,
            }}
          >
            {CANCEL_REASONS.map((item) => {
              const selected = selectedCancelReason === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setSelectedCancelReason(item.value)}
                  disabled={cancelRide.isPending}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: BORDER,
                    backgroundColor: selected ? "#FEE2E2" : SURFACE,
                    paddingHorizontal: 10,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: selected ? "#DC2626" : "#D6D3D1",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                      backgroundColor: SURFACE,
                    }}
                  >
                    {selected ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#DC2626",
                        }}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: TEXT,
                      fontWeight: selected ? "800" : "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedCancelReason === "other" && (
            <TextInput
              value={otherCancelReason}
              onChangeText={setOtherCancelReason}
              placeholder="Tell us the reason"
              placeholderTextColor={TEXT_MUTED}
              multiline
              maxLength={180}
              style={{
                minHeight: 78,
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#FECACA",
                backgroundColor: "#FEF2F2",
                color: TEXT,
                fontSize: 14,
                textAlignVertical: "top",
              }}
            />
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => {
                closeCancelSheet();
                setSelectedCancelReason(CANCEL_REASONS[0].value);
                setOtherCancelReason("");
              }}
              disabled={cancelRide.isPending}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: BORDER,
                backgroundColor: SURFACE,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT_SECONDARY }}>
                Keep Ride
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => activeRide?.id && submitCancelRide(activeRide.id)}
              disabled={
                cancelRide.isPending ||
                !activeRide?.id ||
                (selectedCancelReason === "other" &&
                  otherCancelReason.trim().length === 0)
              }
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor:
                  cancelRide.isPending ||
                  !activeRide?.id ||
                  (selectedCancelReason === "other" &&
                    otherCancelReason.trim().length === 0)
                    ? "#E7A3A3"
                    : "#DC2626",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                {cancelRide.isPending ? "Cancelling..." : "Cancel Ride"}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

