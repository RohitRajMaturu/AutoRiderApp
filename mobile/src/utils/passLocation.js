export function hasValidPassLocation(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return (
    String(value?.label || "").trim().length >= 3 &&
    value?.lat !== null &&
    value?.lng !== null &&
    value?.lat !== undefined &&
    value?.lng !== undefined &&
    value?.lat !== "" &&
    value?.lng !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function normalizeLocation(place) {
  const rawLat = place?.lat ?? place?.latitude;
  const rawLng = place?.lng ?? place?.longitude;
  return {
    // Pass labels are stored in varchar(200). Keep the verified coordinates
    // even when a map provider returns an unusually verbose postal address.
    label: String(place?.address || place?.label || "").trim().slice(0, 200),
    lat: rawLat === null || rawLat === undefined || rawLat === "" ? NaN : Number(rawLat),
    lng: rawLng === null || rawLng === undefined || rawLng === "" ? NaN : Number(rawLng),
    ...(place?.placeId ? { placeId: place.placeId } : {}),
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function resolvePassLocation(value, options = {}) {
  const fetchFn = options.fetchFn || fetch;
  const fieldName = options.fieldName || "location";

  if (hasValidPassLocation(value)) return normalizeLocation(value);

  const query = String(value?.label || "").trim();
  if (query.length < 3) {
    throw new Error(`Enter a ${fieldName} with at least 3 characters.`);
  }

  // A typed label is not a verified place. Silently using the first search
  // result can save a different destination than the passenger intended.
  if (!value?.placeId) {
    throw new Error(`Choose the ${fieldName} from the search results.`);
  }

  let place = null;
  const detailResponse = await fetchFn(`/api/locations/place/${encodeURIComponent(value.placeId)}`);
  const detailBody = await readJson(detailResponse);
  if (detailResponse.ok) place = detailBody.place || null;
  if (!place) throw new Error(`We couldn't verify that ${fieldName}. Choose another search result.`);

  const suggestion = place;
  if (!hasValidPassLocation(normalizeLocation(place)) && suggestion.placeId) {
    const detailResponse = await fetchFn(`/api/locations/place/${encodeURIComponent(suggestion.placeId)}`);
    const detailBody = await readJson(detailResponse);
    if (!detailResponse.ok || !detailBody.place) {
      throw new Error(`We couldn't verify that ${fieldName}. Choose another search result.`);
    }
    place = detailBody.place;
  }

  const resolved = normalizeLocation(place);
  if (!hasValidPassLocation(resolved)) {
    throw new Error(`We couldn't verify that ${fieldName}. Choose another search result.`);
  }
  return resolved;
}
