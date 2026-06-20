import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Map,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react-native";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#F5A623";
const BG = "#0D0F12";
const SURFACE = "#1C2028";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#F0F2F5";
const TEXT_SECONDARY = "#8A8F9E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";
const PAGE_SIZE = 10;
const DEFAULT_REGION = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function toNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function buildRectangleBoundary(swLat, swLng, neLat, neLng) {
  return {
    type: "Polygon",
    coordinates: [[
      [swLng, swLat],
      [neLng, swLat],
      [neLng, neLat],
      [swLng, neLat],
      [swLng, swLat],
    ]],
  };
}

function buildPolygonBoundary(points) {
  const coordinates = points.map((point) => [point.longitude, point.latitude]);
  coordinates.push([points[0].longitude, points[0].latitude]);
  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

function normalizeRectangleFromPoints(points) {
  if (points.length < 2) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

function polygonPointsFromBoundary(boundary) {
  const geometry = boundary?.type === "Feature" ? boundary.geometry : boundary;
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates?.[0]?.[0]
        : null;
  if (!Array.isArray(ring)) return [];
  const points = ring
    .slice(0, -1)
    .map(([longitude, latitude]) => ({ latitude: Number(latitude), longitude: Number(longitude) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  return points;
}

function rectanglePolygon(rectangle) {
  if (!rectangle) return [];
  return [
    { latitude: rectangle.south, longitude: rectangle.west },
    { latitude: rectangle.south, longitude: rectangle.east },
    { latitude: rectangle.north, longitude: rectangle.east },
    { latitude: rectangle.north, longitude: rectangle.west },
  ];
}

function formatCoord(value) {
  return String(Number(value).toFixed(6));
}

function parseGeoJsonBoundary(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("GeoJSON is not valid JSON.");
  }

  const geometry = parsed?.type === "Feature" ? parsed.geometry : parsed;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
    throw new Error("Paste a GeoJSON Polygon, MultiPolygon, or Feature with polygon geometry.");
  }
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw new Error("GeoJSON polygon coordinates are required.");
  }
  return geometry;
}

export default function AdminZones() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef(null);
  const [mode, setMode] = useState("rectangle");
  const [name, setName] = useState("");
  const [maxDrivers, setMaxDrivers] = useState("25");
  const [swLat, setSwLat] = useState("");
  const [swLng, setSwLng] = useState("");
  const [neLat, setNeLat] = useState("");
  const [neLng, setNeLng] = useState("");
  const [geoJson, setGeoJson] = useState("");
  const [mapPoints, setMapPoints] = useState([]);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [editingZone, setEditingZone] = useState(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState([]);
  const [searchPin, setSearchPin] = useState(null);
  const [isSearchingArea, setIsSearchingArea] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [zonePage, setZonePage] = useState(1);
  const [zoneSort, setZoneSort] = useState("name");
  const [zoneDirection, setZoneDirection] = useState("asc");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminZones", zoneSearch, zoneSort, zoneDirection, zonePage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(zonePage),
        pageSize: String(PAGE_SIZE),
        search: zoneSearch.trim(),
        sort: zoneSort,
        direction: zoneDirection,
      });
      const res = await fetch(`/api/admin/zones?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch zones");
      return res.json();
    },
  });

  const resetZoneForm = () => {
    setName("");
    setSwLat("");
    setSwLng("");
    setNeLat("");
    setNeLng("");
    setGeoJson("");
    setMapPoints([]);
    setPolygonPoints([]);
    setEditingZone(null);
  };

  const saveZone = useMutation({
    mutationFn: async () => {
      const cap = Number(maxDrivers);
      if (!name.trim() || !Number.isInteger(cap) || cap < 1 || cap > 500) {
        throw new Error("Enter a zone name and a cap between 1 and 500.");
      }

      let boundary;
      if (mode === "geojson") {
        boundary = parseGeoJsonBoundary(geoJson);
      } else if (mode === "polygon") {
        if (polygonPoints.length < 3) {
          throw new Error("Tap at least three map points to draw a polygon.");
        }
        boundary = buildPolygonBoundary(polygonPoints);
      } else {
        const south = toNumber(swLat);
        const west = toNumber(swLng);
        const north = toNumber(neLat);
        const east = toNumber(neLng);
        if (south === null || west === null || north === null || east === null) {
          throw new Error("Enter all four rectangle coordinates.");
        }
        if (south >= north || west >= east) {
          throw new Error("SW coordinates must be lower than NE coordinates.");
        }
        boundary = buildRectangleBoundary(south, west, north, east);
      }

      const isEditing = Boolean(editingZone?.id);
      const res = await fetch("/api/admin/zones", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { zone_id: editingZone.id } : {}),
          name: name.trim(),
          max_online_drivers: cap,
          boundary,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create zone");
      }
      return res.json();
    },
    onSuccess: () => {
      resetZoneForm();
      setZonePage(1);
      queryClient.invalidateQueries({ queryKey: ["adminZones"] });
      Alert.alert("Zone Saved", "Drivers can now be matched inside this boundary.");
    },
    onError: (err) => Alert.alert("Zone Error", err.message),
  });

  const toggleZone = useMutation({
    mutationFn: async (zone) => {
      const res = await fetch("/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zone.id, is_active: !zone.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update zone");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminZones"] }),
    onError: (err) => Alert.alert("Zone Error", err.message),
  });

  const deleteZone = useMutation({
    mutationFn: async (zone) => {
      const res = await fetch("/api/admin/zones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zone.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete zone");
      }
      return res.json();
    },
    onSuccess: () => {
      if (zones.length === 1 && zonePage > 1) {
        setZonePage((page) => Math.max(page - 1, 1));
      }
      queryClient.invalidateQueries({ queryKey: ["adminZones"] });
      Alert.alert("Zone Deleted", "The service zone was removed.");
    },
    onError: (err) => Alert.alert("Zone Error", err.message),
  });

  const zones = data?.zones || [];
  const pagination = data?.pagination || {
    page: zonePage,
    pageSize: PAGE_SIZE,
    total: zones.length,
    totalPages: 1,
  };
  const selectedRectangle = normalizeRectangleFromPoints(mapPoints);
  const selectedPolygon = rectanglePolygon(selectedRectangle);
  const activeMapPolygon = mode === "polygon" ? polygonPoints : selectedPolygon;

  const setRectangleFromMap = (points) => {
    setMapPoints(points);
    const rectangle = normalizeRectangleFromPoints(points);
    if (!rectangle) return;
    setSwLat(formatCoord(rectangle.south));
    setSwLng(formatCoord(rectangle.west));
    setNeLat(formatCoord(rectangle.north));
    setNeLng(formatCoord(rectangle.east));
  };

  const handleMapPress = (event) => {
    const point = event.nativeEvent.coordinate;
    if (mode === "polygon") {
      setPolygonPoints((points) => [...points, point]);
      return;
    }
    setRectangleFromMap(mapPoints.length >= 2 ? [point] : [...mapPoints, point]);
  };

  const undoPolygonPoint = () => {
    setPolygonPoints((points) => points.slice(0, -1));
  };

  const searchArea = async () => {
    const query = areaSearch.trim();
    if (query.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    setIsSearchingArea(true);
    try {
      const res = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setAreaSuggestions((data.suggestions || []).slice(0, 5));
    } catch {
      Alert.alert("Search Failed", "Could not fetch area suggestions.");
    } finally {
      setIsSearchingArea(false);
    }
  };

  const resolvePlace = async (place) => {
    if (place.lat && place.lng) return place;
    if (!place.placeId) return place;
    const res = await fetch(`/api/locations/place/${encodeURIComponent(place.placeId)}`);
    if (!res.ok) return place;
    const data = await res.json();
    return data.place || place;
  };

  const jumpToPlace = async (place) => {
    try {
      const resolved = await resolvePlace(place);
      if (!resolved.lat || !resolved.lng) {
        Alert.alert("Location Missing", "This suggestion does not include map coordinates.");
        return;
      }
      const pin = {
        latitude: Number(resolved.lat),
        longitude: Number(resolved.lng),
        title: resolved.label || resolved.name || areaSearch,
      };
      setSearchPin(pin);
      setAreaSearch(resolved.address || resolved.label || areaSearch);
      setAreaSuggestions([]);
      mapRef.current?.animateToRegion(
        {
          latitude: pin.latitude,
          longitude: pin.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        450,
      );
    } catch {
      Alert.alert("Search Failed", "Could not move the map to that area.");
    }
  };

  const updateSort = (field) => {
    setZonePage(1);
    if (zoneSort === field) {
      setZoneDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setZoneSort(field);
    setZoneDirection(field === "created_at" ? "desc" : "asc");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode !== "rectangle") {
      setMapPoints([]);
      setSwLat("");
      setSwLng("");
      setNeLat("");
      setNeLng("");
    }
    if (nextMode !== "polygon") {
      setPolygonPoints([]);
    }
  };

  const confirmDeleteZone = (zone) => {
    Alert.alert(
      "Delete Zone?",
      `Delete "${zone.name}" permanently? Drivers and rides linked to it will become unzoned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteZone.mutate(zone),
        },
      ],
    );
  };

  const editZone = (zone) => {
    const points = polygonPointsFromBoundary(zone.boundary);
    setEditingZone(zone);
    setName(zone.name || "");
    setMaxDrivers(String(zone.max_online_drivers || 25));
    setGeoJson(JSON.stringify(zone.boundary || {}, null, 2));
    setPolygonPoints(points);
    setMode(points.length >= 3 ? "polygon" : "geojson");
    setMapPoints([]);
    const rectangle = normalizeRectangleFromPoints(points);
    if (rectangle) {
      setSwLat(formatCoord(rectangle.south));
      setSwLng(formatCoord(rectangle.west));
      setNeLat(formatCoord(rectangle.north));
      setNeLng(formatCoord(rectangle.east));
      mapRef.current?.animateToRegion(
        {
          latitude: (rectangle.south + rectangle.north) / 2,
          longitude: (rectangle.west + rectangle.east) / 2,
          latitudeDelta: Math.max(rectangle.north - rectangle.south, 0.01) * 1.8,
          longitudeDelta: Math.max(rectangle.east - rectangle.west, 0.01) * 1.8,
        },
        450,
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT }}>
          Service Zones
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          {pagination.total} configured boundaries
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={PRIMARY}
          />
        }
      >
        <View
          style={{
            backgroundColor: SURFACE,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 16,
            marginBottom: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Plus size={ICON.md} color={PRIMARY} />
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>
              {editingZone ? "Edit Service Zone" : "Create Service Zone"}
            </Text>
          </View>
          {editingZone ? (
            <TouchableOpacity
              onPress={resetZoneForm}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: BORDER,
                backgroundColor: BG,
              }}
            >
              <Text style={{ color: TEXT_SECONDARY, fontWeight: "800", fontSize: 12 }}>
                Cancel Editing
              </Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { key: "rectangle", label: "Rectangle" },
              { key: "polygon", label: "Polygon" },
              { key: "geojson", label: "GeoJSON" },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => switchMode(item.key)}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: mode === item.key ? PRIMARY : BG,
                  borderWidth: 1,
                  borderColor: mode === item.key ? PRIMARY : BORDER,
                }}
              >
                <Text
                  style={{
                    color: mode === item.key ? "#fff" : TEXT_SECONDARY,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            placeholder="Zone name"
            placeholderTextColor={TEXT_SECONDARY}
            value={name}
            onChangeText={setName}
            style={{ backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
          />
          <TextInput
            placeholder="Max online drivers"
            placeholderTextColor={TEXT_SECONDARY}
            value={maxDrivers}
            onChangeText={setMaxDrivers}
            keyboardType="number-pad"
            style={{ backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
          />
          {mode === "rectangle" || mode === "polygon" ? (
            <>
              {Platform.OS !== "web" && (
                <>
                  <View
                    style={{
                      backgroundColor: BG,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: BORDER,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Search size={ICON.sm} color={TEXT_SECONDARY} />
                      <TextInput
                        placeholder="Search area, locality, landmark..."
                        placeholderTextColor={TEXT_SECONDARY}
                        value={areaSearch}
                        onChangeText={setAreaSearch}
                        onSubmitEditing={searchArea}
                        returnKeyType="search"
                        style={{ flex: 1, color: TEXT, fontSize: 13, paddingVertical: 0 }}
                      />
                      {areaSearch.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setAreaSearch("");
                            setAreaSuggestions([]);
                            setSearchPin(null);
                          }}
                        >
                          <X size={ICON.sm} color={TEXT_SECONDARY} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={searchArea}
                        disabled={isSearchingArea}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: PRIMARY,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSearchingArea ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <LocateFixed size={ICON.sm} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                    {areaSuggestions.map((place, index) => (
                      <TouchableOpacity
                        key={`${place.placeId || place.address || place.label}-${index}`}
                        onPress={() => jumpToPlace(place)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: BORDER,
                        }}
                      >
                        <Text style={{ color: TEXT, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                          {place.label || place.name || "Suggested area"}
                        </Text>
                        <Text style={{ color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                          {place.address || place.description || ""}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View
                    style={{
                      height: 260,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: BORDER,
                      backgroundColor: BG,
                    }}
                  >
                    <MapView
                      ref={mapRef}
                      style={{ flex: 1 }}
                      initialRegion={DEFAULT_REGION}
                      onPress={handleMapPress}
                    >
                      {searchPin && (
                        <Marker
                          coordinate={searchPin}
                          title={searchPin.title || "Selected area"}
                          pinColor="#3B82F6"
                        />
                      )}
                      {mapPoints.map((point, index) => (
                        <Marker
                          key={`${point.latitude}-${point.longitude}-${index}`}
                          coordinate={point}
                          title={index === 0 ? "Corner 1" : "Corner 2"}
                          pinColor={index === 0 ? PRIMARY : SUCCESS}
                        />
                      ))}
                      {polygonPoints.map((point, index) => (
                        <Marker
                          key={`polygon-${point.latitude}-${point.longitude}-${index}`}
                          coordinate={point}
                          title={`Point ${index + 1}`}
                          pinColor={PRIMARY}
                        />
                      ))}
                      {activeMapPolygon.length >= 3 && (
                        <Polygon
                          coordinates={activeMapPolygon}
                          strokeColor={PRIMARY}
                          fillColor="rgba(67,184,179,0.22)"
                          strokeWidth={2}
                        />
                      )}
                    </MapView>
                    <View
                      style={{
                        position: "absolute",
                        left: 10,
                        right: 10,
                        bottom: 10,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: "rgba(13,15,18,0.92)",
                        borderWidth: 1,
                        borderColor: `${PRIMARY}66`,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.14,
                        shadowRadius: 12,
                        elevation: 4,
                      }}
                    >
                      <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                        {mode === "polygon"
                          ? polygonPoints.length < 3
                            ? `Tap ${3 - polygonPoints.length} more point${polygonPoints.length === 2 ? "" : "s"}`
                            : `${polygonPoints.length} point polygon selected`
                          : mapPoints.length < 2
                            ? `Tap ${2 - mapPoints.length} more corner${mapPoints.length === 1 ? "" : "s"}`
                            : "Rectangle selected"}
                      </Text>
                      <Text style={{ color: TEXT_SECONDARY, fontSize: 11, marginTop: 3 }}>
                        {mode === "polygon"
                          ? "Search to jump, then tap each boundary vertex in order."
                          : "Search to jump, pan manually, then tap two opposite corners."}
                      </Text>
                    </View>
                  </View>
                </>
              )}
              {Platform.OS !== "web" && (mapPoints.length > 0 || polygonPoints.length > 0) && (
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {mode === "polygon" && polygonPoints.length > 0 ? (
                    <TouchableOpacity
                      onPress={undoPolygonPoint}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: BORDER,
                        backgroundColor: BG,
                      }}
                    >
                      <Text style={{ color: TEXT_SECONDARY, fontWeight: "800", fontSize: 12 }}>
                        Undo Point
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => {
                      setMapPoints([]);
                      setPolygonPoints([]);
                      setSwLat("");
                      setSwLng("");
                      setNeLat("");
                      setNeLng("");
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: BORDER,
                      backgroundColor: BG,
                    }}
                  >
                    <Text style={{ color: TEXT_SECONDARY, fontWeight: "800", fontSize: 12 }}>
                      Clear Map Selection
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {mode === "rectangle" ? (
                <>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      placeholder="SW lat"
                      placeholderTextColor={TEXT_SECONDARY}
                      value={swLat}
                      onChangeText={setSwLat}
                      keyboardType="decimal-pad"
                      style={{ flex: 1, backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
                    />
                    <TextInput
                      placeholder="SW lng"
                      placeholderTextColor={TEXT_SECONDARY}
                      value={swLng}
                      onChangeText={setSwLng}
                      keyboardType="decimal-pad"
                      style={{ flex: 1, backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      placeholder="NE lat"
                      placeholderTextColor={TEXT_SECONDARY}
                      value={neLat}
                      onChangeText={setNeLat}
                      keyboardType="decimal-pad"
                      style={{ flex: 1, backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
                    />
                    <TextInput
                      placeholder="NE lng"
                      placeholderTextColor={TEXT_SECONDARY}
                      value={neLng}
                      onChangeText={setNeLng}
                      keyboardType="decimal-pad"
                      style={{ flex: 1, backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 12 }}
                    />
                  </View>
                </>
              ) : (
                <Text style={{ color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18 }}>
                  {polygonPoints.length
                    ? `${polygonPoints.length} polygon point${polygonPoints.length === 1 ? "" : "s"} selected.`
                    : "Tap the map to add polygon boundary points."}
                </Text>
              )}
            </>
          ) : (
            <TextInput
              placeholder='Paste GeoJSON Polygon, MultiPolygon, or Feature'
              placeholderTextColor={TEXT_SECONDARY}
              value={geoJson}
              onChangeText={setGeoJson}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              style={{
                minHeight: 150,
                backgroundColor: BG,
                color: TEXT,
                borderRadius: 10,
                padding: 12,
                fontFamily: "monospace",
              }}
            />
          )}
          <TouchableOpacity
            onPress={() => saveZone.mutate()}
            disabled={saveZone.isPending}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {saveZone.isPending ? "Saving..." : editingZone ? "Save Zone" : "Create Zone"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: SURFACE,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 14,
            marginBottom: 12,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: BG,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Search size={ICON.sm} color={TEXT_SECONDARY} />
            <TextInput
              placeholder="Search zones"
              placeholderTextColor={TEXT_SECONDARY}
              value={zoneSearch}
              onChangeText={(value) => {
                setZoneSearch(value);
                setZonePage(1);
              }}
              style={{ flex: 1, color: TEXT, fontSize: 13, paddingVertical: 0 }}
            />
            {zoneSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setZoneSearch("");
                  setZonePage(1);
                }}
              >
                <X size={ICON.sm} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { key: "name", label: "Name" },
              { key: "status", label: "Status" },
              { key: "created_at", label: "Newest" },
              { key: "drivers", label: "Cap" },
            ].map((item) => {
              const active = zoneSort === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => updateSort(item.key)}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? PRIMARY : BG,
                    borderWidth: 1,
                    borderColor: active ? PRIMARY : BORDER,
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : TEXT_SECONDARY,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {item.label}
                    {active ? (zoneDirection === "asc" ? " ↑" : " ↓") : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={PRIMARY} />
        ) : zones.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Map size={ICON.xl} color={TEXT_SECONDARY} />
            <Text style={{ color: TEXT_SECONDARY, marginTop: 10 }}>
              No zones yet
            </Text>
          </View>
        ) : (
          zones.map((zone) => (
            <View
              key={zone.id}
              style={{
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: zone.is_active ? `${SUCCESS}50` : BORDER,
                padding: 14,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>
                  {zone.name}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 3 }}>
                  Cap {zone.max_online_drivers} online drivers
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => editZone(zone)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: BG,
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              >
                <Pencil size={ICON.md} color={PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleZone.mutate(zone)}
                disabled={toggleZone.isPending}
                style={{ padding: 8 }}
              >
                {zone.is_active ? (
                  <ToggleRight size={ICON.xl} color={SUCCESS} />
                ) : (
                  <ToggleLeft size={ICON.xl} color={TEXT_SECONDARY} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDeleteZone(zone)}
                disabled={deleteZone.isPending}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FEF2F2",
                  borderWidth: 1,
                  borderColor: "#FECACA",
                }}
              >
                <Trash2 size={ICON.md} color={ERROR} />
              </TouchableOpacity>
            </View>
          ))
        )}
        {!isLoading && pagination.totalPages > 1 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 4,
              backgroundColor: SURFACE,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => setZonePage((page) => Math.max(page - 1, 1))}
              disabled={zonePage <= 1}
              style={{
                width: 42,
                height: 38,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: zonePage <= 1 ? BG : PRIMARY,
                opacity: zonePage <= 1 ? 0.6 : 1,
              }}
            >
              <ChevronLeft size={ICON.md} color={zonePage <= 1 ? TEXT_SECONDARY : "#fff"} />
            </TouchableOpacity>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: "800" }}>
              Page {pagination.page} of {pagination.totalPages}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setZonePage((page) => Math.min(page + 1, pagination.totalPages))
              }
              disabled={zonePage >= pagination.totalPages}
              style={{
                width: 42,
                height: 38,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: zonePage >= pagination.totalPages ? BG : PRIMARY,
                opacity: zonePage >= pagination.totalPages ? 0.6 : 1,
              }}
            >
              <ChevronRight
                size={ICON.md}
                color={zonePage >= pagination.totalPages ? TEXT_SECONDARY : "#fff"}
              />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

