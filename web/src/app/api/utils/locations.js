const LOCAL_PLACES = [
  {
    placeId: "local-current-location",
    label: "Current Location",
    address: "Use my current location",
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    placeId: "local-majestic",
    label: "Majestic",
    address: "Kempegowda Bus Station, Bengaluru",
    lat: 12.9767,
    lng: 77.5713,
  },
  {
    placeId: "local-mg-road",
    label: "MG Road",
    address: "MG Road, Bengaluru",
    lat: 12.9756,
    lng: 77.6068,
  },
  {
    placeId: "local-indiranagar",
    label: "Indiranagar",
    address: "Indiranagar, Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    placeId: "local-koramangala",
    label: "Koramangala",
    address: "Koramangala, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    placeId: "local-whitefield",
    label: "Whitefield",
    address: "Whitefield, Bengaluru",
    lat: 12.9698,
    lng: 77.75,
  },
  {
    placeId: "local-electronic-city",
    label: "Electronic City",
    address: "Electronic City, Bengaluru",
    lat: 12.8452,
    lng: 77.6602,
  },
  {
    placeId: "local-jayanagar",
    label: "Jayanagar",
    address: "Jayanagar, Bengaluru",
    lat: 12.925,
    lng: 77.5938,
  },
];

const GOOGLE_BASE_URL = "https://maps.googleapis.com/maps/api";

function getProvider() {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return "google";
  }
  return "local";
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(a, b) {
  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeLocalPlace(place) {
  return {
    provider: "local",
    placeId: place.placeId,
    label: place.label,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  };
}

function findLocalPlaces(query) {
  const value = query.trim().toLowerCase();
  const places = value
    ? LOCAL_PLACES.filter((place) => {
        return (
          place.label.toLowerCase().includes(value) ||
          place.address.toLowerCase().includes(value)
        );
      })
    : LOCAL_PLACES;

  return places.slice(0, 6).map(normalizeLocalPlace);
}

function findLocalPlace(placeId) {
  const place = LOCAL_PLACES.find((item) => item.placeId === placeId);
  return place ? normalizeLocalPlace(place) : null;
}

function formatGooglePrediction(prediction) {
  const mainText =
    prediction.structured_formatting?.main_text ||
    prediction.terms?.[0]?.value ||
    prediction.description;
  return {
    provider: "google",
    placeId: prediction.place_id,
    label: mainText,
    address: prediction.description,
  };
}

function formatGooglePlace(result) {
  const location = result.geometry?.location || {};
  return {
    provider: "google",
    placeId: result.place_id,
    label: result.name || result.formatted_address,
    address: result.formatted_address || result.name,
    lat: location.lat,
    lng: location.lng,
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || (json.status && !["OK", "ZERO_RESULTS"].includes(json.status))) {
    throw new Error(json.error_message || `Maps provider failed with status ${response.status}`);
  }
  return json;
}

export async function autocompleteLocations({ query, lat, lng }) {
  if (getProvider() !== "google") {
    return { provider: "local", suggestions: findLocalPlaces(query) };
  }

  if (!query.trim()) {
    return { provider: "google", suggestions: [] };
  }

  const params = new URLSearchParams({
    input: query,
    key: process.env.GOOGLE_MAPS_API_KEY,
    components: "country:in",
  });
  if (lat !== null && lng !== null) {
    params.set("location", `${lat},${lng}`);
    params.set("radius", "50000");
  }

  const json = await fetchJson(`${GOOGLE_BASE_URL}/place/autocomplete/json?${params}`);
  return {
    provider: "google",
    suggestions: (json.predictions || []).map(formatGooglePrediction),
  };
}

export async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  if (placeId.startsWith("local-") || getProvider() !== "google") {
    return findLocalPlace(placeId);
  }

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "place_id,name,formatted_address,geometry",
    key: process.env.GOOGLE_MAPS_API_KEY,
  });
  const json = await fetchJson(`${GOOGLE_BASE_URL}/place/details/json?${params}`);
  return json.result ? formatGooglePlace(json.result) : null;
}

export async function reverseGeocodeLocation({ lat, lng }) {
  if (getProvider() !== "google") {
    return {
      provider: "local",
      place: {
        provider: "local",
        placeId: "local-reverse-current",
        label: "Current Location",
        address: `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        lat,
        lng,
      },
    };
  }

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: process.env.GOOGLE_MAPS_API_KEY,
  });
  const json = await fetchJson(`${GOOGLE_BASE_URL}/geocode/json?${params}`);
  const result = json.results?.[0];
  return {
    provider: "google",
    place: result
      ? {
          provider: "google",
          placeId: result.place_id,
          label: result.formatted_address,
          address: result.formatted_address,
          lat,
          lng,
        }
      : null,
  };
}

export async function estimateRoute({ pickupLat, pickupLng, destLat, destLng }) {
  const pickup = { lat: pickupLat, lng: pickupLng };
  const destination = { lat: destLat, lng: destLng };

  if (getProvider() !== "google") {
    const distanceKm = haversineKm(pickup, destination);
    const durationMinutes = Math.max(3, Math.round((distanceKm / 20) * 60));
    const fare = Math.round(35 + distanceKm * 18);
    return {
      provider: "local",
      distanceMeters: Math.round(distanceKm * 1000),
      durationSeconds: durationMinutes * 60,
      fareEstimate: fare,
      currency: "INR",
    };
  }

  const params = new URLSearchParams({
    origin: `${pickupLat},${pickupLng}`,
    destination: `${destLat},${destLng}`,
    mode: "driving",
    key: process.env.GOOGLE_MAPS_API_KEY,
  });
  const json = await fetchJson(`${GOOGLE_BASE_URL}/directions/json?${params}`);
  const leg = json.routes?.[0]?.legs?.[0];
  if (!leg) {
    return null;
  }
  const distanceKm = leg.distance.value / 1000;
  return {
    provider: "google",
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    fareEstimate: Math.round(35 + distanceKm * 18),
    currency: "INR",
  };
}

export function getRequiredNumber(searchParams, key) {
  const value = parseNumber(searchParams.get(key));
  if (value === null) {
    throw new Error(`Missing or invalid ${key}`);
  }
  return value;
}

export function getOptionalNumber(searchParams, key) {
  return parseNumber(searchParams.get(key));
}
