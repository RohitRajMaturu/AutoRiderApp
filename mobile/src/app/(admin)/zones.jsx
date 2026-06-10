import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map, Plus, ToggleLeft, ToggleRight } from "lucide-react-native";

const PRIMARY = "#F97316";
const BG = "#1C1917";
const SURFACE = "#292524";
const BORDER = "#44403C";
const TEXT = "#FAFAF9";
const TEXT_SECONDARY = "#A8A29E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";

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

export default function AdminZones() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [maxDrivers, setMaxDrivers] = useState("25");
  const [swLat, setSwLat] = useState("");
  const [swLng, setSwLng] = useState("");
  const [neLat, setNeLat] = useState("");
  const [neLng, setNeLng] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminZones"],
    queryFn: async () => {
      const res = await fetch("/api/admin/zones");
      if (!res.ok) throw new Error("Failed to fetch zones");
      return res.json();
    },
  });

  const createZone = useMutation({
    mutationFn: async () => {
      const south = toNumber(swLat);
      const west = toNumber(swLng);
      const north = toNumber(neLat);
      const east = toNumber(neLng);
      const cap = Number(maxDrivers);
      if (
        !name.trim() ||
        south === null ||
        west === null ||
        north === null ||
        east === null ||
        !Number.isInteger(cap)
      ) {
        throw new Error("Enter a name, cap, and all four coordinates.");
      }
      if (south >= north || west >= east) {
        throw new Error("SW coordinates must be lower than NE coordinates.");
      }

      const res = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          max_online_drivers: cap,
          boundary: buildRectangleBoundary(south, west, north, east),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create zone");
      }
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setSwLat("");
      setSwLng("");
      setNeLat("");
      setNeLng("");
      queryClient.invalidateQueries({ queryKey: ["adminZones"] });
      Alert.alert("Zone Created", "Drivers can now be matched inside this boundary.");
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

  const zones = data?.zones || [];

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
          {zones.length} configured boundaries
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
            <Plus size={18} color={PRIMARY} />
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>
              Create Rectangle Zone
            </Text>
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
          <TouchableOpacity
            onPress={() => createZone.mutate()}
            disabled={createZone.isPending}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {createZone.isPending ? "Creating..." : "Create Zone"}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={PRIMARY} />
        ) : zones.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Map size={36} color={TEXT_SECONDARY} />
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
                onPress={() => toggleZone.mutate(zone)}
                disabled={toggleZone.isPending}
                style={{ padding: 8 }}
              >
                {zone.is_active ? (
                  <ToggleRight size={30} color={SUCCESS} />
                ) : (
                  <ToggleLeft size={30} color={TEXT_SECONDARY} />
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
