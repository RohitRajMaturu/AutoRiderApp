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
  Pressable,
  Modal,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  MapPin,
  MapPinOff,
  Navigation,
  Navigation2,
  X,
  Phone,
  CheckCircle2,
  Clock3,
  Star,
  IndianRupee,
  ShieldAlert,
  ExternalLink,
  Clock,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { toast } from "sonner-native";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import AutoRideIcon from "@/components/AutoRideIcon";
import ChatDrawer from "@/components/ChatDrawer";
import NotificationBell from "@/components/NotificationBell";
import { Button, RIDE_STATUS_CONFIG, StatusBadge } from "@/components/ui";
import { ICON } from "@/theme/iconScale";
import { useAuth } from "@/utils/auth/useAuth";
import { createRidePusher } from "@/utils/pusher";
import { getVehicleLabel } from "@/utils/vehicles";
import { useLanguage } from "@/i18n/LanguageContext";
import { addInAppNotification, notificationOwnerKey } from "@/store/useNotificationStore";
import { theme } from "@/theme/tokens";

const TUKTUKGO_ICON = require("../../../assets/images/icon.png");
const PRIMARY = theme.accent;
const PRIMARY_LIGHT = theme.accentDim;
const PRIMARY_BORDER = theme.borderH;
const BG = theme.bg;
const SURFACE = theme.surface1;
const BORDER = theme.border;
const TEXT = theme.text1;
const TEXT_SECONDARY = theme.text2;
const TEXT_MUTED = theme.text3;
const SUCCESS = theme.ok;
const SUCCESS_LIGHT = theme.okDim;
const configuredMaxTripKm = Number(process.env.EXPO_PUBLIC_MAX_TRIP_DISTANCE_KM);
const MAX_TRIP_KM = Number.isFinite(configuredMaxTripKm) && configuredMaxTripKm >= 5
  ? configuredMaxTripKm
  : 25;

function scheduleWindowError(value, now = Date.now()) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "Choose a valid pickup date and time.";
  }
  if (value.getTime() < now + 15 * 60 * 1000) {
    return "Please choose a pickup at least 15 minutes from now so a driver has time to prepare.";
  }
  if (value.getTime() > now + 24 * 60 * 60 * 1000) {
    return "Rides can be scheduled up to 24 hours ahead. Please choose an earlier pickup time.";
  }
  return null;
}

function buildScheduleSlots(now = Date.now()) {
  const interval = 30 * 60 * 1000;
  const earliest = now + 20 * 60 * 1000;
  const latest = now + 24 * 60 * 60 * 1000;
  const firstSlot = Math.ceil(earliest / interval) * interval;
  const slots = [];
  for (let value = firstSlot; value <= latest; value += interval) {
    slots.push(new Date(value));
  }
  return slots;
}

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

function buildTripStatusMessage(ride) {
  return [
    "TukTukGo trip status",
    ride.started_at ? "Status: Trip in progress" : "Status: Driver is on the way",
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

function driverIdentifierImage(ride) {
  return ride?.auto_photo_url || ride?.driver_image || null;
}

export default function PassengerHome() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { auth, isSigningOut } = useAuth();
  const authUserKey = auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";
  const notificationUserKey = notificationOwnerKey(auth);
  const notifyPassenger = useCallback(
    ({ title, body, type, rideId, dedupeKey }) => {
      addInAppNotification({
        ownerKey: notificationUserKey,
        title,
        body,
        type,
        rideId,
        dedupeKey,
      });
    },
    [notificationUserKey],
  );
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
  const [activeRideChannel, setActiveRideChannel] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosTrackingUrl, setSosTrackingUrl] = useState(null);
  const [sosPending, setSosPending] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(null);
  const [scheduleChooserOpen, setScheduleChooserOpen] = useState(false);
  const lastActiveRideIdRef = useRef(null);
  const selfCancelledRideIdsRef = useRef(new Set());
  const notifiedCancelledRideIdsRef = useRef(new Set());
  const [dismissedRatingRideIds, setDismissedRatingRideIds] = useState(
    () => new Set(),
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const counterPulseAnim = useRef(new Animated.Value(1)).current;
  const lastIncomingCounterCountRef = useRef(0);
  const negotiationWarningRef = useRef(null);
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
  const { data: activeRide } = useQuery({
    queryKey: ["activeRide"],
    queryFn: async () => {
      const res = await withTimeout(fetch("/api/rides"), 8000);
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
  const activeRideId = activeRide?.id;
  const activeRideStatus = activeRide?.status;
  const activeRideNegotiationExpiresAt = activeRide?.negotiation_expires_at;

  const { data: profileData } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 30000,
  });
  const savedPlaces = profileData?.savedPlaces ?? profileData?.user?.savedPlaces ?? [];

  const startSos = async () => {
    if (!activeRide?.id) return;
    if (!profileData?.user?.emergency_contact_phone) {
      Alert.alert("Emergency contact needed", "Add an emergency contact in your profile before using SOS.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Profile", onPress: () => router.push("/(passenger)/profile") },
      ]);
      return;
    }
    setSosPending(true);
    try {
      const res = await fetch(`/api/rides/${activeRide.id}/sos`, { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Could not start SOS");
      setSosActive(true);
      setSosTrackingUrl(result.trackingUrl);
      Alert.alert("SOS link sent", "One SMS with your live tracking link was sent to your emergency contact.");
    } catch (err) {
      Alert.alert("SOS Failed", err.message);
    } finally {
      setSosPending(false);
    }
  };

  const stopSos = async () => {
    if (!activeRide?.id) return;
    setSosPending(true);
    try {
      const res = await fetch(`/api/rides/${activeRide.id}/sos`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Could not stop SOS");
      setSosActive(false);
      setSosTrackingUrl(null);
    } catch (err) {
      Alert.alert("Stop SOS Failed", err.message);
    } finally {
      setSosPending(false);
    }
  };

  useEffect(() => {
    if (!activeRide || activeRide.status !== "accepted") {
      setSosActive(false);
      setSosTrackingUrl(null);
    }
  }, [activeRide, activeRide?.id, activeRide?.status]);

  useEffect(() => {
    if (activeRideId) lastActiveRideIdRef.current = activeRideId;
  }, [activeRideId]);

  const { data: latestCancelledRide } = useQuery({
    queryKey: ["latestPassengerCancelledRide"],
    queryFn: async () => {
      const res = await fetch("/api/rides?filter=cancelled&pageSize=1");
      if (!res.ok) return null;
      const data = await res.json();
      return data.rides?.[0] || null;
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });

  useEffect(() => {
    if (
      !latestCancelledRide?.id ||
      latestCancelledRide.id !== lastActiveRideIdRef.current ||
      selfCancelledRideIdsRef.current.has(latestCancelledRide.id) ||
      notifiedCancelledRideIdsRef.current.has(latestCancelledRide.id)
    ) {
      return;
    }
    notifiedCancelledRideIdsRef.current.add(latestCancelledRide.id);
    toast("Driver cancelled the ride", {
      description: "Please request another ride when you are ready.",
      duration: 4000,
    });
    notifyPassenger({
      title: "Driver cancelled the ride",
      body: "Please request another ride when you are ready.",
      type: "ride_cancelled",
      rideId: latestCancelledRide.id,
      dedupeKey: `ride_cancelled:${latestCancelledRide.id}`,
    });
  }, [latestCancelledRide, notifyPassenger]);

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
  const isDestinationTooFar =
    Number.isFinite(Number(tripEstimate?.distanceKm)) &&
    Number(tripEstimate.distanceKm) > MAX_TRIP_KM;

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
    lastIncomingCounterCountRef.current = 0;
    negotiationWarningRef.current = null;
  }, [activeRide?.id]);

  useEffect(() => {
    if (incomingOffers.length <= lastIncomingCounterCountRef.current) return;
    lastIncomingCounterCountRef.current = incomingOffers.length;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(counterPulseAnim, { toValue: 1.03, duration: 150, useNativeDriver: true }),
      Animated.timing(counterPulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(counterPulseAnim, { toValue: 1.03, duration: 150, useNativeDriver: true }),
      Animated.timing(counterPulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [counterPulseAnim, incomingOffers.length]);

  useEffect(() => {
    if (
      !activeRideId ||
      !["requested", "negotiating"].includes(activeRideStatus)
    ) {
      return;
    }

    const pusher = createRidePusher({ jwt: auth?.jwt });
    if (!pusher) return;

    const channelName = `private-ride-${activeRideId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("counter-offer", (data) => {
      notifyPassenger({
        title: "New fare offer",
        body: `A driver offered ${formatCurrency(data?.offeredFare)} for your ride.`,
        type: "counter_offer",
        rideId: activeRideId,
        dedupeKey: `counter_offer:${activeRideId}`,
      });
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
    channel.bind("ride-accepted", (data) => {
      notifyPassenger({
        title: "Driver accepted your booking",
        body: data?.queuedNext
          ? "Your driver is finishing a nearby trip and will come to you next."
          : "Your driver is heading to the pickup location.",
        type: "ride_accepted",
        rideId: data?.rideId || activeRideId,
        dedupeKey: `ride_accepted:${data?.rideId || activeRideId}`,
      });
      refreshRide();
    });
    channel.bind("negotiation-expired", refreshRide);
    channel.bind("pusher:subscription_error", refreshRide);

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [activeRideId, activeRideStatus, auth?.jwt, notifyPassenger, queryClient]);

  useEffect(() => {
    if (!activeRideId || activeRideStatus !== "accepted") {
      setActiveRideChannel(null);
      return undefined;
    }

    const pusher = createRidePusher({ jwt: auth?.jwt });
    if (!pusher) {
      setActiveRideChannel(null);
      return undefined;
    }

    const channelName = `private-ride-${activeRideId}`;
    const channel = pusher.subscribe(channelName);
    channel.bind("ride-cancelled", (data) => {
      if (data?.actorRole === "passenger") return;
      if (data?.rideId) notifiedCancelledRideIdsRef.current.add(data.rideId);
      toast("Driver cancelled the ride", {
        description: "Please request another ride when you are ready.",
        duration: 4000,
      });
      notifyPassenger({
        title: "Driver cancelled the ride",
        body: "Please request another ride when you are ready.",
        type: "ride_cancelled",
        rideId: data?.rideId || activeRideId,
        dedupeKey: `ride_cancelled:${data?.rideId || activeRideId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
      queryClient.invalidateQueries({ queryKey: ["latestPassengerCancelledRide"] });
    });
    const refreshRideLifecycle = () => {
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    };
    channel.bind("ride-started", (data) => {
      notifyPassenger({
        title: "Ride started",
        body: "Your trip is now in progress.",
        type: "ride_started",
        rideId: data?.rideId || activeRideId,
        dedupeKey: `ride_started:${data?.rideId || activeRideId}`,
      });
      refreshRideLifecycle();
    });
    channel.bind("ride-completed", (data) => {
      notifyPassenger({
        title: "Ride completed",
        body: "You have reached your destination. Thank you for riding with TukTukGo.",
        type: "ride_completed",
        rideId: data?.rideId || activeRideId,
        dedupeKey: `ride_completed:${data?.rideId || activeRideId}`,
      });
      refreshRideLifecycle();
    });
    channel.bind("driver-ready", (data) => {
      notifyPassenger({
        title: "Driver is heading to you",
        body: "The previous trip is complete. Your driver is now coming to your pickup.",
        type: "driver_ready",
        rideId: data?.rideId || activeRideId,
        dedupeKey: `driver_ready:${data?.rideId || activeRideId}`,
      });
      refreshRideLifecycle();
    });
    setActiveRideChannel(channel);

    return () => {
      setActiveRideChannel(null);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [activeRideId, activeRideStatus, auth?.jwt, notifyPassenger, queryClient]);

  const { mutate: expireNegotiation, isPending: expireNegotiationPending } = useMutation({
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
    if (!activeRideId || activeRideStatus !== "negotiating") {
      setNegotiationRemaining(0);
      return;
    }

    const expiresAt = new Date(activeRideNegotiationExpiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setNegotiationRemaining(remaining);
      if (remaining === 10 && negotiationWarningRef.current !== activeRideId) {
        negotiationWarningRef.current = activeRideId;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (remaining === 0 && !expireNegotiationPending) {
        expireNegotiation(activeRideId);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeRideId, activeRideStatus, activeRideNegotiationExpiresAt, expireNegotiation, expireNegotiationPending]);

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
          ...(isScheduling && scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const requestError = new Error(error.error || "Failed to request ride");
        requestError.code = error.code;
        throw requestError;
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
      setIsScheduling(false);
      setScheduledFor(null);
      setScheduleChooserOpen(false);
      setFocusedField(null);
    },
    onError: (err) => {
      if (err.code === "DESTINATION_TOO_FAR") {
        toast("Destination too far", {
          description: `Please choose a drop-off within the ${MAX_TRIP_KM} km local service area.`,
          duration: 4000,
        });
        return;
      }
      Alert.alert("Request Failed", err.message);
    },
  });

  // ── Cancel ride ──
  const cancelRide = useMutation({
    mutationFn: async ({ rideId, reason }) => {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to cancel");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.ride?.id) selfCancelledRideIdsRef.current.add(data.ride.id);
      cancelSheetRef.current?.close();
      setShowCancelReasons(false);
      setSelectedCancelReason(CANCEL_REASONS[0].value);
      setOtherCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["activeRide"] });
      queryClient.invalidateQueries({ queryKey: ["passengerRides"] });
    },
    onError: (err) =>
      toast("Could not cancel the ride", {
        description: err.message || "Please try again.",
        duration: 3500,
      }),
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

  const requestMaskedCall = useMutation({
    mutationFn: async (rideId) => {
      const res = await fetch(`/api/rides/${rideId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Call failed. Try again.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast("Connecting call", {
        description: data.message || "Connecting you now...",
        duration: 3500,
      });
    },
    onError: (err) => {
      toast("Call unavailable", {
        description: err.message || "Call failed. Try again.",
        duration: 3500,
      });
    },
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

  const scheduleError = isScheduling ? scheduleWindowError(scheduledFor) : null;
  const scheduleSlots = buildScheduleSlots();
  const canRequest =
    pickup.trim().length > 0 &&
    destination.trim().length > 0 &&
    !!pickupCoords &&
    !!destinationCoords &&
    !isDestinationTooFar &&
    (negotiationMode === "fixed" ||
      (Number.isInteger(fareMinNumber) &&
        Number.isInteger(fareMaxNumber) &&
        fareMinNumber > 0 &&
        fareMaxNumber >= fareMinNumber &&
        (!hasSuggestedFareRange ||
          (fareMinNumber >= Number(suggestedMinFare) &&
            fareMaxNumber <= Number(suggestedMaxFare))))) &&
    !requestRide.isPending;

  const submitRideRequest = () => {
    if (scheduleError) {
      Alert.alert("Choose a pickup time", scheduleError);
      return;
    }
    requestRide.mutate();
  };

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
  const isTripStarted =
    activeRide?.status === "accepted" && Boolean(activeRide.started_at);
  const isDriverFinishingPreviousRide =
    activeRide?.status === "accepted" && Boolean(activeRide.driver_finishing_previous_ride);
  const passengerRideStatus = isTripStarted ? "in_progress" : activeRide?.status;
  const passengerRideStatusLabel = {
    requested: t("ride.badge.finding"),
    negotiating: t("ride.badge.negotiating"),
    accepted: t("ride.badge.accepted"),
    in_progress: t("ride.badge.inProgress"),
    completed: t("ride.badge.completed"),
    cancelled: t("ride.badge.cancelled"),
  }[passengerRideStatus];
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
          backgroundColor: theme.surface1,
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
              borderBottomColor: theme.surface2,
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

  if (!auth || isSigningOut) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar style="dark" />
      </View>
    );
  }

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
                borderColor: theme.text1,
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
              Book the right ride in seconds
            </Text>
            </View>
          </View>
          <NotificationBell />
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
                shadowColor: theme.text1,
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
                    isTripStarted
                      ? SUCCESS_LIGHT
                      : activeRide.status === "accepted"
                      ? PRIMARY_LIGHT
                      : theme.warnDim,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor:
                    isTripStarted
                      ? theme.okDim
                      : activeRide.status === "accepted"
                      ? PRIMARY_BORDER
                      : theme.warnDim,
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
                      <Clock3 size={ICON.md} color={theme.warn} />
                    </Animated.View>
                  ) : (
                    <CheckCircle2 size={ICON.md} color={PRIMARY} />
                  )}
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: TEXT }}
                  >
                    {activeRide.status === "requested"
                      ? t("ride.finding")
                      : activeRide.status === "negotiating"
                        ? t("ride.negotiating", { seconds: negotiationRemaining })
                      : activeRide.status === "completed"
                        ? t("ride.completed")
                        : isTripStarted
                          ? t("ride.inProgress")
                          : t("ride.driverComing")}
                  </Text>
                </View>
                <StatusBadge
                  status={passengerRideStatus}
                  config={RIDE_STATUS_CONFIG}
                  label={passengerRideStatusLabel}
                />
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
                        pinColor={theme.info}
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
                      backgroundColor: theme.surface1,
                      borderRadius: 8,
                      padding: 7,
                      shadowColor: theme.text1,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 4,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Navigation size={ICON.sm} color={theme.accent} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: theme.text1 }}>
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
                    backgroundColor: theme.warnDim,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.warnDim,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "900", color: theme.warn }}>
                    Taking longer than usual
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.warn, marginTop: 4, lineHeight: 18 }}>
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
                      backgroundColor: theme.infoDim,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.infoDim,
                      padding: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <IndianRupee size={ICON.md} color={theme.info} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>
                          Your offer {formatCurrency(activeRide.fare_max)}
                        </Text>
                        <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
                          Drivers can accept this fare or send one counter.
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color:
                            negotiationRemaining <= 10
                              ? theme.err
                              : negotiationRemaining <= 20
                                ? theme.warn
                                : theme.info,
                        }}
                      >
                        {negotiationRemaining}s
                      </Text>
                    </View>

                    {counterOffers.length > 0 && (
                      <Animated.View style={{ marginTop: 12, gap: 10, transform: [{ scale: counterPulseAnim }] }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.info }} />
                          <Text style={{ fontSize: 11, fontWeight: "800", color: theme.info, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {counterOffers.length} driver counter{counterOffers.length > 1 ? "s" : ""} — tap to accept
                          </Text>
                        </View>
                        {counterOffers.map((offer) => (
                          <View
                            key={offer.id || offer.driver_id}
                            style={{
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: theme.infoDim,
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
                            <Pressable
                              onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                approveCounter.mutate({
                                  rideId: activeRide.id,
                                  driverId: offer.driver_id,
                                });
                              }}
                              disabled={approveCounter.isPending}
                              accessibilityLabel={`Accept driver counter offer of ${formatCurrency(offer.offered_fare)}`}
                              accessibilityRole="button"
                              style={({ pressed }) => ({
                                borderRadius: 12,
                                backgroundColor: pressed ? theme.accentText : PRIMARY,
                                paddingVertical: 14,
                                paddingHorizontal: 20,
                                alignItems: "center",
                                opacity: approveCounter.isPending ? 0.7 : 1,
                                minWidth: 100,
                              })}
                            >
                              <Text style={{ color: theme.surface1, fontSize: 15, fontWeight: "900" }}>
                                {approveCounter.isPending ? "…" : "Accept ✓"}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </Animated.View>
                    )}
                  </View>
                )}

                {/* Driver info when accepted */}
                {activeRide.status === "accepted" &&
                  (activeRide.vehicle_number || activeRide.auto_photo_url || activeRide.driver_image) && (
                    <View
                      style={{
                        marginTop: 16,
                        backgroundColor: SURFACE,
                        borderRadius: 18,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: PRIMARY_BORDER,
                        shadowColor: theme.accentText,
                        shadowOpacity: 0.08,
                        shadowRadius: 18,
                        shadowOffset: { width: 0, height: 8 },
                        elevation: 3,
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
                            width: 72,
                            height: 72,
                            borderRadius: 18,
                            backgroundColor: PRIMARY_LIGHT,
                            justifyContent: "center",
                            alignItems: "center",
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: PRIMARY_BORDER,
                          }}
                        >
                          {driverIdentifierImage(activeRide) ? (
                            <Image
                              source={{ uri: driverIdentifierImage(activeRide) }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <AutoRideIcon size={ICON.xxl} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "800",
                              color: SUCCESS,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                            }}
                          >
                            {isTripStarted
                              ? "Trip started"
                              : isDriverFinishingPreviousRide
                                ? "Next pickup confirmed"
                                : "Your vehicle is assigned"}
                          </Text>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "900",
                              color: TEXT,
                              marginTop: 4,
                            }}
                          >
                            {activeRide.vehicle_number
                              ? `${activeRide.vehicle_number} - ${getVehicleLabel(activeRide.vehicle_type)}`
                              : isTripStarted
                                ? "Trip in progress"
                                : isDriverFinishingPreviousRide
                                  ? "Driver finishing a nearby trip"
                                  : "Driver on the way"}
                          </Text>
                          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 17 }}>
                            {isTripStarted
                              ? "You are on the way to your destination."
                              : isDriverFinishingPreviousRide
                                ? "You are the driver's next pickup. We will alert you when the driver starts heading your way."
                                : "Match this photo and plate before boarding."}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: PRIMARY_LIGHT,
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <AutoRideIcon size={ICON.sm} />
                          <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                            {activeRide.vehicle_number ? `${activeRide.vehicle_number} - ${getVehicleLabel(activeRide.vehicle_type)}` : "Verify vehicle"}
                          </Text>
                        </View>
                        <Text style={{ flex: 1, color: TEXT_SECONDARY, fontSize: 12, textAlign: "right" }}>
                          {isTripStarted
                            ? "Trip is underway."
                            : activeRide.can_call
                              ? "Need help? Call securely."
                              : "Driver details confirmed."}
                        </Text>
                      </View>
                    </View>
                  )}

                {activeRide.status === "accepted" ? (
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    {activeRide.can_call ? (
                      <TouchableOpacity
                        onPress={() => requestMaskedCall.mutate(activeRide.id)}
                        disabled={requestMaskedCall.isPending}
                        style={{
                          alignItems: "center",
                          backgroundColor: SUCCESS,
                          borderRadius: 999,
                          flex: 1,
                          height: 46,
                          justifyContent: "center",
                          opacity: requestMaskedCall.isPending ? 0.65 : 1,
                        }}
                        accessibilityLabel="Call assigned driver"
                      >
                        <Phone size={ICON.md} color={theme.surface1} />
                      </TouchableOpacity>
                    ) : null}
                    <ChatDrawer
                      rideId={activeRide.id}
                      pusherChannel={activeRideChannel}
                      role="passenger"
                    />
                  </View>
                ) : null}

                {activeRide.status === "accepted" && (
                  <View style={{ marginTop: 16, gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => shareTripStatus(activeRide)}
                      style={{
                        backgroundColor: SUCCESS_LIGHT,
                        borderRadius: 12,
                        paddingVertical: 13,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: theme.okDim,
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: SUCCESS, fontSize: 14, fontWeight: "700" }}>
                        Share Trip Status
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={sosPending}
                      onPress={() => Alert.alert(
                        sosActive ? "Yes, I’m Safe" : "Send SOS Link",
                        sosActive
                          ? "Stop live safety tracking for your emergency contact?"
                          : "Send one SMS with a live tracking link to your emergency contact?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: sosActive ? "Stop SOS" : "Send Link",
                            style: sosActive ? "destructive" : "default",
                            onPress: sosActive ? stopSos : startSos,
                          },
                        ],
                      )}
                      style={{
                        backgroundColor: sosActive ? theme.errDim : theme.err,
                        borderRadius: 12,
                        paddingVertical: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                        borderWidth: 1,
                        borderColor: sosActive ? theme.errDim : theme.err,
                        opacity: sosPending ? 0.6 : 1,
                      }}
                    >
                      <ShieldAlert size={ICON.sm} color={sosActive ? theme.err : theme.surface1} />
                      <Text style={{ color: sosActive ? theme.err : theme.surface1, fontSize: 14, fontWeight: "800" }}>
                        {sosPending ? "Please wait..." : sosActive ? "Yes, I’m Safe — Stop SOS" : "SOS — Send Live Link"}
                      </Text>
                    </TouchableOpacity>
                    {sosActive && sosTrackingUrl ? (
                      <TouchableOpacity
                        onPress={() => Share.share({ message: `Track my TukTukGo ride: ${sosTrackingUrl}`, url: sosTrackingUrl })}
                        style={{ borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE }}
                      >
                        <ExternalLink size={ICON.sm} color={TEXT_SECONDARY} />
                        <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: "800" }}>Share tracking link</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {activeRide.status === "completed" && (
                  <View
                    style={{
                      marginTop: 16,
                      backgroundColor: theme.infoDim,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.infoDim,
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: theme.info,
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
                      backgroundColor: theme.warnDim,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.warnDim,
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
                            color={value <= ratingValue ? theme.accent : TEXT_MUTED}
                            fill={value <= ratingValue ? theme.accent : "none"}
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
                        borderColor: theme.warnDim,
                        backgroundColor: theme.surface1,
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
                      <Button
                        variant="primary"
                        size="md"
                        onPress={() =>
                          rateRide.mutate({
                            rideId: activeRide.id,
                            rating: ratingValue,
                            feedback: ratingFeedback,
                          })
                        }
                        loading={rateRide.isPending}
                        disabled={ratingValue === 0 || rateRide.isPending}
                        style={{
                          flex: 2,
                        }}
                        accessibilityLabel="Submit ride rating"
                      >
                        Submit Rating
                      </Button>
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
                        color: theme.err,
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
                shadowColor: theme.text1,
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
                  borderBottomColor: theme.surface2,
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
                      backgroundColor: theme.surface2,
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
                {!activeRide && savedPlaces.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {savedPlaces.map((place) => (
                      <TouchableOpacity
                        key={place.id}
                        onPress={() => {
                          setDestination(place.address);
                          setDestinationCoords({ lat: place.lat, lng: place.lng });
                          setDestinationPlaceId(place.placeId ?? null);
                          setFocusedField(null);
                          setDestinationSuggestions([]);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: PRIMARY_BORDER,
                          backgroundColor: PRIMARY_LIGHT,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <MapPin size={ICON.xs} color={PRIMARY} />
                        <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>
                          {place.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
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
                        backgroundColor: selected ? PRIMARY_LIGHT : theme.surface2,
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

              {isDestinationTooFar ? (
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.errDim,
                    backgroundColor: theme.errDim,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <MapPinOff size={ICON.md} color={theme.err} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "900", color: theme.err }}>
                      That&apos;s a bit far for an auto
                    </Text>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: theme.err, marginTop: 4 }}>
                      This destination is {Math.round(Number(tripEstimate.distanceKm))} km away. TukTukGo currently supports local trips up to {MAX_TRIP_KM} km. Please choose a closer drop-off.
                    </Text>
                  </View>
                </View>
              ) : null}

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
                            backgroundColor: selected ? PRIMARY_LIGHT : theme.surface2,
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
                        backgroundColor: theme.surface2,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        color: TEXT,
                        fontWeight: "900",
                        textAlign: "center",
                      }}
                    />
                  </View>
                  {!!fareInputError && (
                    <Text style={{ fontSize: 12, color: theme.err, fontWeight: "700" }}>
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
                      backgroundColor: theme.surface2,
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
                      backgroundColor: theme.surface2,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: TEXT,
                      fontWeight: "700",
                    }}
                  />
                </View>
              )}
            </View>

            <View
              style={{
                marginTop: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isScheduling ? PRIMARY_BORDER : BORDER,
                backgroundColor: SURFACE,
                padding: 14,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setIsScheduling((value) => {
                    const next = !value;
                    if (next) {
                      if (!scheduledFor) setScheduledFor(new Date(Date.now() + 30 * 60 * 1000));
                      setNegotiationMode("fixed");
                    } else {
                      setScheduleChooserOpen(false);
                    }
                    return next;
                  });
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: PRIMARY_LIGHT, alignItems: "center", justifyContent: "center" }}>
                  <Clock size={ICON.sm} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>Schedule for later</Text>
                  <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>15 minutes to 24 hours from now</Text>
                </View>
                <View style={{ width: 44, height: 26, borderRadius: 999, padding: 3, backgroundColor: isScheduling ? PRIMARY : BORDER, alignItems: isScheduling ? "flex-end" : "flex-start" }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.surface1 }} />
                </View>
              </TouchableOpacity>
              {isScheduling && scheduledFor ? (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER, gap: 12 }}>
                  <View style={{ borderRadius: 14, backgroundColor: PRIMARY_LIGHT, borderWidth: 1, borderColor: PRIMARY_BORDER, padding: 14 }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: PRIMARY, textTransform: "uppercase", letterSpacing: 0.7 }}>Selected pickup</Text>
                    <Text style={{ fontSize: 17, fontWeight: "900", color: TEXT, marginTop: 5 }}>
                      {scheduledFor.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>

                  <View>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT_MUTED, marginBottom: 8 }}>Quick choices</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                      {[
                        // Keep a one-minute submission buffer so the 15-minute choice
                        // still clears the server minimum after the passenger confirms.
                        { label: "15 min", minutes: 16 },
                        { label: "1 hour", minutes: 60 },
                        { label: "4 hours", minutes: 240 },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.label}
                          onPress={() => {
                            setScheduledFor(new Date(Date.now() + option.minutes * 60 * 1000));
                            Haptics.selectionAsync();
                          }}
                          style={{ borderRadius: 999, borderWidth: 1, borderColor: PRIMARY_BORDER, backgroundColor: SURFACE, paddingHorizontal: 14, paddingVertical: 10 }}
                        >
                          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <TouchableOpacity
                    onPress={() => setScheduleChooserOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Choose another pickup date and time"
                    style={{
                      borderRadius: 13,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                      backgroundColor: SURFACE,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Clock size={ICON.sm} color={PRIMARY} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "900", color: TEXT }}>Choose another pickup slot</Text>
                      <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>Select date and time together in one tap</Text>
                    </View>
                    <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: "900" }}>›</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", gap: 8, borderRadius: 12, backgroundColor: theme.warnDim, borderWidth: 1, borderColor: theme.warnDim, padding: 11 }}>
                    <Clock size={ICON.sm} color={theme.warn} />
                    <Text style={{ flex: 1, color: theme.warn, fontSize: 11, lineHeight: 17, fontWeight: "700" }}>
                      Need a later ride? TukTukGo currently accepts schedules up to 24 hours ahead for reliable driver availability.
                    </Text>
                  </View>

                  {scheduleError ? (
                    <Text style={{ color: theme.err, fontSize: 12, fontWeight: "700" }}>{scheduleError}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <Modal
              visible={scheduleChooserOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setScheduleChooserOpen(false)}
            >
              <Pressable
                onPress={() => setScheduleChooserOpen(false)}
                style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23,39,43,0.45)" }}
              >
                <Pressable onPress={() => {}} style={{ backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: "82%" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <View>
                      <Text style={{ fontSize: 19, fontWeight: "900", color: TEXT }}>Choose pickup slot</Text>
                      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 3 }}>Date and time are combined for you</Text>
                    </View>
                    <TouchableOpacity onPress={() => setScheduleChooserOpen(false)} hitSlop={10}>
                      <X size={ICON.md} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, borderRadius: 12, backgroundColor: PRIMARY_LIGHT, borderWidth: 1, borderColor: PRIMARY_BORDER, padding: 10, marginBottom: 12 }}>
                    <Clock size={ICON.sm} color={PRIMARY} />
                    <Text style={{ flex: 1, color: PRIMARY, fontSize: 11, lineHeight: 17, fontWeight: "700" }}>
                      Available pickup slots for the next 24 hours. Tap one option to select it.
                    </Text>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                    {scheduleSlots.map((slot, index) => {
                      const previous = scheduleSlots[index - 1];
                      const showDay = !previous || previous.toDateString() !== slot.toDateString();
                      const selected = scheduledFor && Math.abs(slot.getTime() - scheduledFor.getTime()) < 60 * 1000;
                      return (
                        <React.Fragment key={slot.toISOString()}>
                          {showDay ? (
                            <Text style={{ fontSize: 11, fontWeight: "900", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.7, marginTop: index ? 14 : 2, marginBottom: 7 }}>
                              {slot.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </Text>
                          ) : null}
                          <TouchableOpacity
                            onPress={() => {
                              setScheduledFor(slot);
                              setScheduleChooserOpen(false);
                              Haptics.selectionAsync();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Schedule pickup for ${slot.toLocaleString("en-IN")}`}
                            style={{
                              minHeight: 52,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: selected ? PRIMARY : BORDER,
                              backgroundColor: selected ? PRIMARY_LIGHT : SURFACE,
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              marginBottom: 8,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View>
                              <Text style={{ fontSize: 15, fontWeight: "900", color: TEXT }}>
                                {slot.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                              </Text>
                              <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                                {slot.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                              </Text>
                            </View>
                            {selected ? <CheckCircle2 size={ICON.md} color={PRIMARY} /> : <Text style={{ color: PRIMARY, fontWeight: "900" }}>Select</Text>}
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => setScheduleChooserOpen(false)}
                    style={{ marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 13, alignItems: "center" }}
                  >
                    <Text style={{ color: TEXT_SECONDARY, fontSize: 14, fontWeight: "800" }}>Keep current selection</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Request button */}
            <Button
              variant="primary"
              size="lg"
              onPress={submitRideRequest}
              loading={requestRide.isPending}
              disabled={!canRequest}
              style={{
                marginTop: 16,
              }}
              accessibilityLabel={isScheduling ? "Schedule ride" : "Request ride"}
            >
              {isScheduling ? "Schedule Ride" : "Request Ride"}
            </Button>
          </View>
        )}

        {/* Safety tip */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: theme.okDim,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.okDim,
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
              <Text style={{ fontSize: 12, color: theme.ok, lineHeight: 18 }}>
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
                    backgroundColor: selected ? theme.errDim : SURFACE,
                    paddingHorizontal: 10,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: selected ? theme.err : theme.text2,
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
                          backgroundColor: theme.err,
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
                borderColor: theme.errDim,
                backgroundColor: theme.errDim,
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
                    ? theme.errDim
                    : theme.err,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: theme.surface1 }}>
                {cancelRide.isPending ? "Cancelling..." : "Cancel Ride"}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

