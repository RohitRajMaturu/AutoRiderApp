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
import { FileText } from "lucide-react-native";

const PRIMARY = "#F5A623";
const BG = "#0D0F12";
const SURFACE = "#1C2028";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#F0F2F5";
const TEXT_SECONDARY = "#8A8F9E";

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
          Audit Log
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          Tamper-proof admin action history
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
              <FileText size={36} color={TEXT_SECONDARY} />
              <Text style={{ color: TEXT_SECONDARY, marginTop: 10 }}>
                No audit entries yet
              </Text>
            </View>
          ) : (
            logs.map((log) => (
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
                <Text style={{ fontSize: 14, color: TEXT, fontWeight: "800" }}>
                  {log.action}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                  {log.target_type} {log.target_id ? `• ${log.target_id}` : ""}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                  {log.email || log.phone || log.actor_id}
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 8 }}>
                  {new Date(log.created_at).toLocaleString("en-IN")}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

