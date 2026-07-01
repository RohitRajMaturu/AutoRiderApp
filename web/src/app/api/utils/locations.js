const OLA_BASE_URL = "https://api.olamaps.io";
const AUTO_BASE_FARE_INR = 35;
const AUTO_PER_KM_FARE_INR = 18;
const NEGOTIATION_MIN_PERCENT = 0.9;
const NEGOTIATION_MAX_PERCENT = 1.1;

function getApiKey() {
  return process.env.OLAMAPS_API_KEY;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEnvNumber(key, fallback) {
  const value = parseNumber(process.env[key]);
  return value === null ? fallback : value;
}

function getConfiguredFallbackPlaces() {
  const pickup = {
    provider: "local",
    placeId: "local-pickup",
    label: process.env.LOCATION_FALLBACK_PICKUP_LABEL || "Local Pickup",
    address:
      process.env.LOCATION_FALLBACK_PICKUP_ADDRESS ||
      "Configured local pickup",
    lat: getEnvNumber("LOCATION_FALLBACK_PICKUP_LAT", 12.9716),
    lng: getEnvNumber("LOCATION_FALLBACK_PICKUP_LNG", 77.5946),
  };
  const destination = {
    provider: "local",
    placeId: "local-destination",
    label:
      process.env.LOCATION_FALLBACK_DESTINATION_LABEL ||
      "Local Destination",
    address:
      process.env.LOCATION_FALLBACK_DESTINATION_ADDRESS ||
      "Configured local destination",
    lat: getEnvNumber("LOCATION_FALLBACK_DESTINATION_LAT", 12.9352),
    lng: getEnvNumber("LOCATION_FALLBACK_DESTINATION_LNG", 77.6245),
  };

  return [pickup, destination];
}

function makeSearchFallbackPlace(text, locationBias = {}) {
  const query = text.trim();
  if (!query) return null;

  const destination = getConfiguredFallbackPlaces()[1];
  // Stable, nearby demo coordinates keep location search usable when the maps
  // provider is unavailable. Different labels resolve to different points.
  const hash = [...query.toLowerCase()].reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    7,
  );
  const baseLat = parseNumber(locationBias.lat) ?? destination.lat;
  const baseLng = parseNumber(locationBias.lng) ?? destination.lng;
  const lat = baseLat + (((hash % 1201) - 600) / 100000);
  const lng = baseLng + ((((Math.floor(hash / 1201)) % 1201) - 600) / 100000);
  return {
    ...destination,
    placeId: `local-search-${encodeURIComponent(query)}`,
    label: query,
    address: query,
    lat,
    lng,
  };
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(origin, destination) {
  const earthRadiusKm = 6371;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function calculateAutoFare(distanceKm) {
  return Math.round(AUTO_BASE_FARE_INR + distanceKm * AUTO_PER_KM_FARE_INR);
}

function roundFareToNearestFive(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function calculateNegotiationFareRange(estimatedFare) {
  const fare = parseNumber(estimatedFare);
  if (fare === null || fare <= 0) {
    return { minFare: null, maxFare: null };
  }

  const minFare = roundFareToNearestFive(fare * NEGOTIATION_MIN_PERCENT);
  const maxFare = Math.max(
    minFare,
    roundFareToNearestFive(fare * NEGOTIATION_MAX_PERCENT),
  );

  return { minFare, maxFare };
}

function normalizePlace(place, provider = "local") {
  if (!place) return null;

  const geometry = place.geometry || {};
  const location = geometry.location || place.location || place.position || {};
  const lat = parseNumber(
    place.lat ?? place.latitude ?? location.lat ?? location.latitude,
  );
  const lng = parseNumber(
    place.lng ??
      place.lon ??
      place.longitude ??
      location.lng ??
      location.lon ??
      location.longitude,
  );
  const structured = place.structured_formatting || {};
  const label =
    place.label ||
    place.name ||
    place.title ||
    structured.main_text ||
    place.description ||
    place.formatted_address ||
    place.address;
  const address =
    place.address ||
    place.formatted_address ||
    place.description ||
    structured.secondary_text ||
    label;
  const placeId =
    place.placeId ||
    place.place_id ||
    place.id ||
    place.reference ||
    `${provider}-${String(label || "place").toLowerCase().replace(/\s+/g, "-")}`;

  return {
    provider,
    placeId,
    label: label || address || "Unknown place",
    address: address || label || "Unknown address",
    ...(lat !== null && lng !== null ? { lat, lng } : {}),
  };
}

function localPlacesForQuery(text = "", locationBias = {}) {
  const query = text.trim().toLowerCase();
  const matches = getConfiguredFallbackPlaces()
    .filter((place) => {
      if (!query) return true;
      return (
        place.label.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query)
      );
    })
    .slice(0, 6);

  return matches;
}

function localPlaceById(placeId) {
  const configured = getConfiguredFallbackPlaces().find((place) => place.placeId === placeId);
  if (configured) return configured;
  if (placeId.startsWith("local-search-")) {
    const encodedQuery = placeId.slice("local-search-".length);
    try {
      return makeSearchFallbackPlace(decodeURIComponent(encodedQuery));
    } catch {
      return null;
    }
  }
  return null;
}

function fallbackReverseGeocode(lat, lng) {
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

function fallbackRouteEstimate(originLat, originLng, destLat, destLng) {
  const distanceKm = haversineKm(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng },
  );
  const durationMins = Math.max(3, Math.round((distanceKm / 20) * 60));

  return {
    provider: "local",
    distanceKm: round(distanceKm),
    durationMins,
    estimatedFare: calculateAutoFare(distanceKm),
    polyline: null,
  };
}

function collectCandidates(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.predictions)) return value.predictions;
  if (Array.isArray(value.suggestions)) return value.suggestions;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.places)) return value.places;
  if (Array.isArray(value.data)) return value.data;
  if (value.data) return collectCandidates(value.data);
  return [];
}

function extractRoute(json) {
  const routes = json?.routes || json?.data?.routes || json?.result?.routes || [];
  const route = routes[0] || json?.route || json?.data?.route || json?.result;
  if (!route) return null;

  const leg = route.legs?.[0] || route.sections?.[0] || route;
  const distanceMeters = parseNumber(
    route.distance ||
      route.distance_meters ||
      route.summary?.distance ||
      leg.distance ||
      leg.distance_meters,
  );
  const durationSeconds = parseNumber(
    route.duration ||
      route.duration_seconds ||
      route.summary?.duration ||
      leg.duration ||
      leg.duration_seconds,
  );
  const polyline =
    route.overview_polyline ||
    route.polyline ||
    route.geometry ||
    route.encoded_polyline ||
    route.summary?.polyline ||
    null;

  if (distanceMeters === null || durationSeconds === null) {
    return null;
  }

  const distanceKm = distanceMeters / 1000;
  return {
    provider: "ola",
    distanceKm: round(distanceKm),
    durationMins: Math.max(1, Math.round(durationSeconds / 60)),
    estimatedFare: calculateAutoFare(distanceKm),
    polyline,
  };
}

async function requestOla(path, { method = "GET", params, body } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OLAMAPS_API_KEY is not configured");
  }

  const url = new URL(`${OLA_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Request-Id":
        globalThis.crypto?.randomUUID?.() ||
        `autoconnect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(
      json?.error_message ||
        json?.message ||
        `Ola Maps request failed with status ${response.status}`,
    );
  }

  return json;
}

export async function getAutocomplete(text = "", locationBias = {}) {
  const query = text.trim();
  if (!query) {
    return { provider: getApiKey() ? "ola" : "local", suggestions: [] };
  }

  try {
    const json = await requestOla("/places/v1/autocomplete", {
      params: {
        input: query,
        location:
          locationBias?.lat !== null &&
          locationBias?.lat !== undefined &&
          locationBias?.lng !== null &&
          locationBias?.lng !== undefined
            ? `${locationBias.lat},${locationBias.lng}`
            : undefined,
      },
    });
    const suggestions = collectCandidates(json)
      .map((place) => normalizePlace(place, "ola"))
      .filter(Boolean)
      .slice(0, 8);

    return {
      provider: "ola",
      suggestions,
    };
  } catch {
    return {
      provider: "local",
      suggestions: localPlacesForQuery(query, locationBias),
    };
  }
}

export async function getPlaceDetails(placeId) {
  if (!placeId) return null;
  if (placeId.startsWith("local-")) return localPlaceById(placeId);

  try {
    const json = await requestOla("/places/v1/details", {
      params: { place_id: placeId },
    });
    const place =
      normalizePlace(json?.result, "ola") ||
      normalizePlace(json?.data, "ola") ||
      normalizePlace(json, "ola");

    return place?.lat !== undefined && place?.lng !== undefined ? place : null;
  } catch {
    return localPlaceById(placeId) || null;
  }
}

export async function getReverseGeocode(lat, lng) {
  try {
    const json = await requestOla("/places/v1/reverse-geocode", {
      params: { latlng: `${lat},${lng}` },
    });
    const candidate =
      collectCandidates(json)[0] ||
      json?.result ||
      json?.data ||
      json?.place ||
      json;
    const place = normalizePlace({ ...candidate, lat, lng }, "ola");

    return {
      provider: "ola",
      place: place || fallbackReverseGeocode(lat, lng).place,
    };
  } catch {
    return fallbackReverseGeocode(lat, lng);
  }
}

export async function getRouteEstimate(originLat, originLng, destLat, destLng) {
  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    const json = await requestOla("/routing/v1/directions", {
      method: "POST",
      params: {
        origin,
        destination,
        mode: "auto",
      },
      body: {
        origin,
        destination,
        mode: "auto",
        alternatives: false,
        steps: false,
        overview: "full",
      },
    });
    const estimate = extractRoute(json);

    return estimate || fallbackRouteEstimate(originLat, originLng, destLat, destLng);
  } catch {
    return fallbackRouteEstimate(originLat, originLng, destLat, destLng);
  }
}

export async function autocompleteLocations({ query, lat, lng }) {
  return getAutocomplete(query || "", { lat, lng });
}

export async function reverseGeocodeLocation({ lat, lng }) {
  return getReverseGeocode(lat, lng);
}

export async function estimateRoute({ pickupLat, pickupLng, destLat, destLng }) {
  const estimate = await getRouteEstimate(pickupLat, pickupLng, destLat, destLng);
  const fareRange = calculateNegotiationFareRange(estimate.estimatedFare);

  return {
    ...estimate,
    distanceMeters: Math.round(estimate.distanceKm * 1000),
    durationSeconds: estimate.durationMins * 60,
    fareEstimate: estimate.estimatedFare,
    fareRange,
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
