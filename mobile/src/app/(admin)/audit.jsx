import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Power,
  Route,
  ShieldCheck,
  Search,
  UserCheck,
  UserX,
} from "lucide-react-native";
import { ICON } from "@/theme/iconScale";
import { adminTheme as T } from "@/theme/tokens";

const PRIMARY = T.accent;
const BG = T.bg;
const SURFACE = T.surface2;
const BORDER = T.border;
const TEXT = T.text1;
const TEXT_SECONDARY = T.text2;
const SUCCESS = T.ok;
const ERROR = T.err;

function readMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function auditPresentation(log) {
  const metadata = readMetadata(log.metadata);
  const common = {
    actor: log.email || log.phone || "Administrator",
    metadata,
  };

  switch (log.action) {
    case "zone.create":
      return {
        ...common,
        title: "Created a service zone",
        detail: `${metadata.name || "New zone"} was added for ride dispatch.`,
        color: SUCCESS,
        Icon: MapPin,
      };
    case "zone.update":
      return {
        ...common,
        title: "Updated a service zone",
        detail: `${metadata.name || "Zone settings"} were changed.`,
        color: PRIMARY,
        Icon: MapPin,
      };
    case "zone.delete":
      return {
        ...common,
        title: "Removed a service zone",
        detail: `${metadata.name || "A service zone"} was removed from dispatch.`,
        color: ERROR,
        Icon: MapPin,
      };
    case "driver.force_offline":
      return {
        ...common,
        title: "Took a driver offline",
        detail: "The driver was manually taken offline by an administrator.",
        color: ERROR,
        Icon: Power,
      };
    case "driver_kyc.approve":
      return {
        ...common,
        title: "Approved driver verification",
        detail: "The driver's KYC documents were approved.",
        color: SUCCESS,
        Icon: UserCheck,
      };
    case "driver_kyc.reject":
      return {
        ...common,
        title: "Rejected driver verification",
        detail: metadata.reason || "The driver's KYC documents were rejected.",
        color: ERROR,
        Icon: UserX,
      };
    case "ride.cancel":
      return {
        ...common,
        title: "Cancelled a stuck ride",
        detail: metadata.reason
          ? `Reason: ${String(metadata.reason).replace(/_/g, " ")}`
          : "The ride was manually closed by an administrator.",
        color: ERROR,
        Icon: Route,
      };
    case "driver.update": {
      const approval =
        metadata.is_approved === true
          ? "Driver application approved."
          : metadata.is_approved === false
            ? "Driver application rejected."
            : null;
      const subscription = metadata.subscription_days
        ? `Subscription extended by ${metadata.subscription_days} days.`
        : null;
      return {
        ...common,
        title: approval ? "Updated driver approval" : "Updated driver account",
        detail:
          [approval, subscription].filter(Boolean).join(" ") ||
          "Driver account settings were changed.",
        color: approval ? SUCCESS : PRIMARY,
        Icon: ShieldCheck,
      };
    }
    default:
      return {
        ...common,
        title: "Performed an administrative action",
        detail: String(log.action || "Account settings changed").replace(/[._]/g, " "),
        color: PRIMARY,
        Icon: CheckCircle2,
      };
  }
}

export default function AdminAudit() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["adminAudit", category, sort, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        category,
        sort,
        search,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    refetchInterval: 30000,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchText.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const logs = data?.logs || [];
  const counts = data?.counts || {};
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };

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
          Admin Activity
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          {counts.all || 0} recorded administrator actions
        </Text>
        <View
          style={{
            alignItems: "center",
            backgroundColor: SURFACE,
            borderColor: BORDER,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: "row",
            gap: 8,
            marginTop: 14,
            paddingHorizontal: 12,
          }}
        >
          <Search size={ICON.sm} color={TEXT_SECONDARY} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search action, admin, target or details"
            placeholderTextColor={TEXT_SECONDARY}
            style={{ color: TEXT, flex: 1, fontSize: 13, paddingVertical: 11 }}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["all", "All"],
            ["zone", "Zones"],
            ["driver", "Drivers"],
            ["ride", "Rides"],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => {
                setCategory(value);
                setPage(1);
              }}
              style={{
                backgroundColor: category === value ? T.accentDim : SURFACE,
                borderColor: category === value ? PRIMARY : BORDER,
                borderRadius: 99,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{
                  color: category === value ? PRIMARY : TEXT_SECONDARY,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {label} ({counts[value] || 0})
              </Text>
            </TouchableOpacity>
          ))}
          {[
            ["newest", "Newest"],
            ["oldest", "Oldest"],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => {
                setSort(value);
                setPage(1);
              }}
              style={{
                backgroundColor: sort === value ? T.okDim : SURFACE,
                borderColor: sort === value ? SUCCESS : BORDER,
                borderRadius: 99,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{
                  color: sort === value ? SUCCESS : TEXT_SECONDARY,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {isError ? (
          <View
            style={{
              backgroundColor: T.errDim,
              borderColor: T.err,
              borderRadius: 10,
              borderWidth: 1,
              marginTop: 10,
              padding: 11,
            }}
          >
            <Text style={{ color: T.err, fontSize: 12 }}>
              Audit activity could not be loaded. Pull down to try again.
            </Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PRIMARY}
            />
          }
        >
          {logs.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 50 }}>
              <FileText size={ICON.xl} color={TEXT_SECONDARY} />
              <Text style={{ color: TEXT_SECONDARY, marginTop: 10 }}>
                No admin activity yet
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const presentation = auditPresentation(log);
              const { Icon } = presentation;
              return (
                <View
                  key={log.id}
                  style={{
                    backgroundColor: SURFACE,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: BORDER,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: `${presentation.color}20`,
                        borderRadius: 18,
                        height: 36,
                        justifyContent: "center",
                        width: 36,
                      }}
                    >
                      <Icon size={ICON.sm} color={presentation.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: TEXT, fontWeight: "800" }}>
                        {presentation.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: TEXT_SECONDARY,
                          lineHeight: 17,
                          marginTop: 3,
                        }}
                      >
                        {presentation.detail}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      borderTopColor: BORDER,
                      borderTopWidth: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 12,
                      paddingTop: 10,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: TEXT_SECONDARY, flex: 1, fontSize: 11 }}
                    >
                      By {presentation.actor}
                    </Text>
                    <Text style={{ color: TEXT_SECONDARY, fontSize: 11 }}>
                      {new Date(log.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          {pagination.total > 0 ? (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
                paddingVertical: 12,
              }}
            >
              <TouchableOpacity
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={{
                  alignItems: "center",
                  backgroundColor: SURFACE,
                  borderColor: BORDER,
                  borderRadius: 10,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 5,
                  opacity: page <= 1 ? 0.4 : 1,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <ChevronLeft size={ICON.xs} color={TEXT} />
                <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                  Previous
                </Text>
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </Text>
                <Text style={{ color: TEXT_SECONDARY, fontSize: 10, marginTop: 2 }}>
                  {pagination.total} matching actions
                </Text>
              </View>
              <TouchableOpacity
                disabled={page >= pagination.totalPages}
                onPress={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                style={{
                  alignItems: "center",
                  backgroundColor: SURFACE,
                  borderColor: BORDER,
                  borderRadius: 10,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 5,
                  opacity: page >= pagination.totalPages ? 0.4 : 1,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800" }}>
                  Next
                </Text>
                <ChevronRight size={ICON.xs} color={TEXT} />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
