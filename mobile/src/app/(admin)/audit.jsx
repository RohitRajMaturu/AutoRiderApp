import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  MapPin,
  Power,
  Route,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react-native";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#F5A623";
const BG = "#0D0F12";
const SURFACE = "#1C2028";
const BORDER = "rgba(255,255,255,0.16)";
const TEXT = "#F0F2F5";
const TEXT_SECONDARY = "#C3C8D4";
const SUCCESS = "#22C55E";
const ERROR = "#EF4444";

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
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["adminAudit"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit");
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const logs = data?.logs || [];

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
          Actions performed by administrators
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
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
        </ScrollView>
      )}
    </View>
  );
}
