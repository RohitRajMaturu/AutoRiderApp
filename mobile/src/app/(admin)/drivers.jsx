import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  X,
  Search,
  ChevronDown,
  Calendar,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import AutoRideIcon from "@/components/AutoRideIcon";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#F5A623";
const PRIMARY_LIGHT = "rgba(245,166,35,0.12)";
const PRIMARY_BORDER = "rgba(255,255,255,0.14)";
const BG = "#0D0F12";
const SURFACE = "#1C2028";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#F0F2F5";
const TEXT_SECONDARY = "#8A8F9E";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";

function DriverCard({ driver, onApprove, onReject, isUpdating }) {
  const [expanded, setExpanded] = useState(false);
  const expiry = driver.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isSubscribed = expiry && expiry > new Date();

  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: driver.is_approved ? `${SUCCESS}40` : BORDER,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ padding: 16 }}
        activeOpacity={0.8}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: driver.is_approved
                  ? `${SUCCESS}20`
                  : "#F5F5F415",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <AutoRideIcon size={ICON.lg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>
                {driver.vehicle_number}
              </Text>
              <Text
                style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}
                numberOfLines={1}
              >
                {driver.phone || driver.email}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 99,
                backgroundColor: driver.is_approved
                  ? `${SUCCESS}20`
                  : "#B8870020",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: driver.is_approved ? SUCCESS : "#B88700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {driver.is_approved ? "Approved" : "Pending"}
              </Text>
            </View>
            <ChevronDown
              size={ICON.sm}
              color={TEXT_SECONDARY}
              style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: BORDER }}>
          {/* Details */}
          <View style={{ padding: 16, gap: 12 }}>
            {driver.email && (
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    width: 70,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Email
                </Text>
                <Text style={{ fontSize: 13, color: TEXT, flex: 1 }}>
                  {driver.email}
                </Text>
              </View>
            )}
            {driver.phone && (
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    width: 70,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Phone
                </Text>
                <Text style={{ fontSize: 13, color: TEXT, flex: 1 }}>
                  {driver.phone}
                </Text>
              </View>
            )}
            {driver.license_url && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    width: 70,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    paddingTop: 2,
                  }}
                >
                  License
                </Text>
                <Text
                  style={{ fontSize: 12, color: PRIMARY, flex: 1 }}
                  numberOfLines={2}
                >
                  {driver.license_url}
                </Text>
              </View>
            )}
            {expiry && (
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: TEXT_SECONDARY,
                    width: 70,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Sub. Exp
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: isSubscribed ? SUCCESS : ERROR,
                  }}
                >
                  {expiry.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            )}
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: TEXT_SECONDARY,
                  width: 70,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Rating
              </Text>
              <Text style={{ fontSize: 13, color: TEXT }}>
                {driver.avg_driver_rating_30d
                  ? `${Number(driver.avg_driver_rating_30d).toFixed(1)} / 5 (30d)`
                  : "No ratings in 30d"}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: TEXT_SECONDARY,
                  width: 70,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Status
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: driver.is_online ? SUCCESS : TEXT_SECONDARY,
                    fontWeight: "600",
                  }}
                >
                  {driver.is_online ? "● Online" : "○ Offline"}
                </Text>
                {isSubscribed && (
                  <Text
                    style={{ fontSize: 12, color: SUCCESS, fontWeight: "600" }}
                  >
                    · Subscribed
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Actions */}
          {!driver.is_approved ? (
            <View
              style={{
                flexDirection: "row",
                padding: 16,
                gap: 10,
                borderTopWidth: 1,
                borderTopColor: BORDER,
              }}
            >
              <TouchableOpacity
                onPress={() => onReject(driver.id)}
                disabled={isUpdating}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: `${ERROR}20`,
                  borderWidth: 1,
                  borderColor: `${ERROR}40`,
                }}
                activeOpacity={0.8}
              >
                <X size={ICON.sm} color={ERROR} />
                <Text style={{ color: ERROR, fontSize: 13, fontWeight: "700" }}>
                  Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onApprove(driver.id)}
                disabled={isUpdating}
                style={{
                  flex: 2,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: SUCCESS,
                  shadowColor: SUCCESS,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                activeOpacity={0.85}
              >
                <Check size={ICON.sm} color="#fff" />
                <Text
                  style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}
                >
                  {isUpdating ? "Approving..." : "Approve + 30 Days"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={{ padding: 16, borderTopWidth: 1, borderTopColor: BORDER }}
            >
              <TouchableOpacity
                onPress={() => onApprove(driver.id, true)}
                disabled={isUpdating}
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: PRIMARY_LIGHT,
                  borderWidth: 1,
                  borderColor: PRIMARY_BORDER,
                }}
                activeOpacity={0.8}
              >
                <Calendar size={ICON.sm} color={PRIMARY} />
                <Text
                  style={{ color: PRIMARY, fontSize: 13, fontWeight: "700" }}
                >
                  Extend Subscription +30 Days
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminDrivers() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | approved

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminDrivers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/drivers");
      return res.json();
    },
  });

  const updateDriver = useMutation({
    mutationFn: async ({ driverId, isApproved, subscriptionDays }) => {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          is_approved: isApproved,
          subscription_days: subscriptionDays,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      Alert.alert("✅ Updated", "Driver status has been updated.");
    },
    onError: () => Alert.alert("Error", "Failed to update driver."),
  });

  const allDrivers = data?.drivers || [];

  const filtered = allDrivers.filter((d) => {
    const matchesSearch =
      !search ||
      d.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && !d.is_approved) ||
      (filter === "approved" && d.is_approved);
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: BG,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: TEXT,
            letterSpacing: -0.5,
          }}
        >
          Driver Management
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          {allDrivers.length} total ·{" "}
          {allDrivers.filter((d) => !d.is_approved).length} pending
        </Text>

        {/* Search */}
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: SURFACE,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: BORDER,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Search size={ICON.sm} color={TEXT_SECONDARY} />
          <TextInput
            placeholder="Search vehicle, phone, email..."
            placeholderTextColor={TEXT_SECONDARY}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, fontSize: 14, color: TEXT }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={ICON.xs} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {["all", "pending", "approved"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 99,
                backgroundColor: filter === f ? PRIMARY : SURFACE,
                borderWidth: 1,
                borderColor: filter === f ? PRIMARY : BORDER,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: filter === f ? "#fff" : TEXT_SECONDARY,
                  textTransform: "capitalize",
                }}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PRIMARY}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 40 }}>👥</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: TEXT,
                  marginTop: 12,
                }}
              >
                {search ? "No results found" : "No drivers"}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: TEXT_SECONDARY,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {search
                  ? `No drivers match "${search}"`
                  : "Driver applications will appear here"}
              </Text>
            </View>
          ) : (
            filtered.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onApprove={(id, extend) =>
                  updateDriver.mutate({
                    driverId: id,
                    isApproved: true,
                    subscriptionDays: 30,
                  })
                }
                onReject={(id) =>
                  Alert.alert(
                    "Reject Driver?",
                    "This will reject the driver's application.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Reject",
                        style: "destructive",
                        onPress: () =>
                          updateDriver.mutate({
                            driverId: id,
                            isApproved: false,
                            subscriptionDays: null,
                          }),
                      },
                    ],
                  )
                }
                isUpdating={updateDriver.isPending}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

