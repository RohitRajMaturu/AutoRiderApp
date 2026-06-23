import React, { useEffect, useMemo, useState } from "react";
import { Linking, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  IndianRupee,
  MapPin,
  Shield,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { toast } from "sonner-native";
import AutoRickshawIcon from "@/components/AutoRickshawIcon";
import { useAuth } from "@/utils/auth/useAuth";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#43B8B3";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUCCESS = "#16A34A";
const DARK = "#17272B";
const RIDE_HISTORY_PAGE_SIZE = 5;
const RIDE_HISTORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
];
const SUBSCRIPTION_PLANS = [
  { key: "starter", label: "Starter", price: "Entry", desc: "Best for occasional ride hours" },
  { key: "active", label: "Active", price: "Popular", desc: "Balanced access for daily drivers" },
  { key: "pro", label: "Pro", price: "Priority", desc: "For high-frequency driver partners" },
];

const BENEFITS = [
  {
    icon: Zap,
    title: "Accept Unlimited Rides",
    desc: "No cap on daily ride acceptances",
    color: "#EAB308",
  },
  {
    icon: Shield,
    title: "Zero Platform Commission",
    desc: "Keep 100% of your earnings",
    color: SUCCESS,
  },
  {
    icon: Star,
    title: "Priority Listing",
    desc: "Get seen first by nearby passengers",
    color: PRIMARY,
  },
  {
    icon: TrendingUp,
    title: "Earnings Analytics",
    desc: "Track your daily performance",
    color: "#3B82F6",
  },
];

function formatExpiry(expiry) {
  if (!expiry) return "Not active";
  return expiry.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value) {
  const amount = Number(value);
  return `Rs. ${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
}

function formatRideDate(value) {
  if (!value) return "Completed";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDistance(value) {
  const distance = Number(value);
  return Number.isFinite(distance) ? `${distance.toFixed(1)} km` : null;
}

function rideCompletedTime(ride) {
  const value = ride?.completed_at || ride?.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function matchesPeriod(ride, period) {
  if (period === "all") return true;
  const days = Number(period.replace("d", ""));
  const time = rideCompletedTime(ride);
  if (!Number.isFinite(days) || !time) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function sortRideHistory(a, b) {
  return rideCompletedTime(b) - rideCompletedTime(a);
}

function HistoryChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? DARK : SURFACE,
        borderColor: selected ? DARK : BORDER,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: selected ? SURFACE : TEXT_SECONDARY,
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryPager({
  canGoBack,
  canGoForward,
  currentPage,
  end,
  isFetchingNextPage,
  onNext,
  onPrevious,
  start,
  total,
}) {
  if (total === 0) return null;

  return (
    <View
      style={{
        borderTopColor: "#F5F5F4",
        borderTopWidth: 1,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800" }}>
          Showing {start}-{end} of {total}
        </Text>
        <Text style={{ color: TEXT, fontSize: 11, fontWeight: "900" }}>
          Page {currentPage}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          activeOpacity={0.84}
          disabled={!canGoBack}
          onPress={onPrevious}
          style={{
            alignItems: "center",
            backgroundColor: canGoBack ? SURFACE : "#F5F5F4",
            borderColor: BORDER,
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: 5,
            justifyContent: "center",
            opacity: canGoBack ? 1 : 0.55,
            paddingVertical: 11,
          }}
        >
          <ChevronLeft size={ICON.sm} color={TEXT_SECONDARY} />
          <Text style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: "900" }}>
            Previous
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.84}
          disabled={!canGoForward || isFetchingNextPage}
          onPress={onNext}
          style={{
            alignItems: "center",
            backgroundColor: canGoForward ? PRIMARY : "#F5F5F4",
            borderColor: canGoForward ? PRIMARY : BORDER,
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: 5,
            justifyContent: "center",
            opacity: canGoForward && !isFetchingNextPage ? 1 : 0.55,
            paddingVertical: 11,
          }}
        >
          <Text style={{ color: canGoForward ? SURFACE : TEXT_SECONDARY, fontSize: 12, fontWeight: "900" }}>
            {isFetchingNextPage ? "Loading" : "Next"}
          </Text>
          <ChevronRight size={ICON.sm} color={canGoForward ? SURFACE : TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DriverWallet() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [ridePeriod, setRidePeriod] = useState("all");
  const [ridePage, setRidePage] = useState(1);
  const [subscriptionDetailsOpen, setSubscriptionDetailsOpen] = useState(false);
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["driverMe", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load driver profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ["driverEarnings", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers/earnings");
      if (!res.ok) throw new Error("Failed to load earnings");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 30000,
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ["driverSubscription", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/driver/subscription/status");
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 30000,
  });

  const createSubscription = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/driver/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: subscriptionData?.subscription?.plan || "starter" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not start subscription");
      return body;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["driverSubscription", authUserKey] });
      const shortUrl = data?.subscription?.shortUrl;
      if (shortUrl) {
        await Linking.openURL(shortUrl);
      } else {
        toast("Subscription created", {
          description: "Complete payment from the Razorpay link when available.",
        });
      }
    },
    onError: (err) => {
      toast("Subscription unavailable", {
        description: err.message || "Payment setup is not ready yet.",
      });
    },
  });

  const changeSubscription = useMutation({
    mutationFn: async (planKey) => {
      const res = await fetch("/api/driver/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not change subscription plan");
      return body;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["driverSubscription", authUserKey] });
      const shortUrl = data?.subscription?.shortUrl;
      if (shortUrl) {
        await Linking.openURL(shortUrl);
      }
      toast(data?.mode === "queued" ? "Plan change scheduled" : "Plan change started", {
        description:
          data?.mode === "queued"
            ? "Your current plan remains active. The new plan starts after this cycle ends."
            : "Complete the payment/mandate flow to activate this plan.",
      });
    },
    onError: (err) => {
      toast("Plan change unavailable", {
        description: err.message || "Could not schedule the selected plan.",
      });
    },
  });

  const {
    data: rideHistoryData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: rideHistoryLoading,
  } = useInfiniteQuery({
    queryKey: ["driverRideHistory", authUserKey],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: String(pageParam),
        pageSize: "10",
      });
      const res = await fetch(`/api/drivers/rides?${params}`);
      if (!res.ok) throw new Error("Failed to load ride history");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!auth,
    staleTime: 30000,
  });

  const driver = driverData?.driver;
  const subscription = subscriptionData?.subscription;
  const providerConfigured = Boolean(subscriptionData?.providerConfigured);
  const currentPlan = subscription?.plan || "starter";
  const queuedPlan = subscription?.queuedPlan || null;
  const queuedStartsAt = subscription?.queuedStartsAt
    ? new Date(subscription.queuedStartsAt)
    : null;
  const expiry = driver?.subscription_expiry
    ? new Date(driver.subscription_expiry)
    : null;
  const isActive = expiry && expiry > new Date();
  const daysLeft = isActive
    ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
    : 0;
  const rideHistory = useMemo(
    () => rideHistoryData?.pages.flatMap((page) => page.rides || []) || [],
    [rideHistoryData?.pages],
  );
  const filteredRideHistory = useMemo(() => {
    return rideHistory
      .filter((ride) => matchesPeriod(ride, ridePeriod))
      .sort((a, b) => sortRideHistory(a, b));
  }, [rideHistory, ridePeriod]);
  const rideTotalPages = Math.max(
    Math.ceil(filteredRideHistory.length / RIDE_HISTORY_PAGE_SIZE),
    1,
  );
  const safeRidePage = Math.min(ridePage, rideTotalPages);
  const rideStartIndex = (safeRidePage - 1) * RIDE_HISTORY_PAGE_SIZE;
  const visibleRideHistory = filteredRideHistory.slice(
    rideStartIndex,
    rideStartIndex + RIDE_HISTORY_PAGE_SIZE,
  );
  const visibleRideStart = filteredRideHistory.length ? rideStartIndex + 1 : 0;
  const visibleRideEnd = rideStartIndex + visibleRideHistory.length;
  const canGoBack = safeRidePage > 1;
  const canGoForward =
    safeRidePage < rideTotalPages ||
    Boolean(hasNextPage && filteredRideHistory.length === rideHistory.length);

  useEffect(() => {
    setRidePage(1);
  }, [ridePeriod]);

  useEffect(() => {
    if (ridePage > rideTotalPages) setRidePage(rideTotalPages);
  }, [ridePage, rideTotalPages]);

  const goToNextRidePage = async () => {
    if (safeRidePage < rideTotalPages) {
      setRidePage((value) => value + 1);
      return;
    }
    if (hasNextPage) {
      await fetchNextPage();
      setRidePage((value) => value + 1);
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: BG,
        }}
      >
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

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
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: TEXT,
            letterSpacing: -0.5,
          }}
        >
          Subscription
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
          View your driver access
        </Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>
          సభ్యత్వ స్థితి / सदस्यता स्थिति
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ margin: 16 }}>
          <View
            style={{
              backgroundColor: isActive ? DARK : "#FEF2F2",
              borderRadius: 20,
              padding: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -30,
                top: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "#FFFFFF0A",
              }}
            />
            <View
              style={{
                position: "absolute",
                right: 20,
                bottom: -40,
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: "#FFFFFF06",
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isActive ? "#647678" : "#EF4444",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {isActive ? "Active Access" : "No Active Access"}
                </Text>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "800",
                    color: isActive ? "#fff" : "#DC2626",
                    marginTop: 6,
                    letterSpacing: -0.5,
                  }}
                >
                  {isActive ? `${daysLeft} Days Left` : "Inactive"}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: isActive ? SUCCESS : "#FEE2E2",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isActive ? "#fff" : "#DC2626",
                    textTransform: "uppercase",
                  }}
                >
                  {isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={ICON.xs} color={isActive ? "#586C70" : "#991B1B"} />
              <Text
                style={{
                  fontSize: 13,
                  color: isActive ? "#586C70" : "#991B1B",
                }}
              >
                Expires {formatExpiry(expiry)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
              padding: 16,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: PRIMARY_LIGHT,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Info size={ICON.md} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => setSubscriptionDetailsOpen((value) => !value)}
                style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>
                    {providerConfigured ? "Razorpay subscription" : "Admin-managed pilot access"}
                  </Text>
                  <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 3 }}>
                    Current plan: {currentPlan.toUpperCase()} · {subscription?.status || "pilot"}
                  </Text>
                  {queuedPlan ? (
                    <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "800", marginTop: 3 }}>
                      {queuedPlan.toUpperCase()} queued from {formatExpiry(queuedStartsAt)}
                    </Text>
                  ) : null}
                </View>
                {subscriptionDetailsOpen ? (
                  <ChevronUp size={ICON.sm} color={TEXT_SECONDARY} />
                ) : (
                  <ChevronDown size={ICON.sm} color={TEXT_SECONDARY} />
                )}
              </TouchableOpacity>
              {subscriptionDetailsOpen ? (
                <>
                  <Text style={{ fontSize: 12, color: PRIMARY, marginTop: 10 }}>
                    {subscription?.status
                      ? `Status: ${subscription.status}${subscription.mandateStatus ? `, mandate ${subscription.mandateStatus}` : ""}`
                      : "Pilot access is controlled by TukTukGo operations"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: TEXT_SECONDARY,
                      lineHeight: 20,
                      marginTop: 6,
                    }}
                  >
                    {providerConfigured
                      ? "Use Razorpay UPI AutoPay to activate or renew access. If a mandate fails, a manual payment link can be shown here."
                      : "Subscription expiry is extended manually by the TukTukGo admin team until Razorpay credentials are connected."}
                  </Text>
                  <View style={{ marginTop: 14 }}>
                <Text style={{ color: TEXT, fontSize: 13, fontWeight: "800" }}>
                  Change plan
                </Text>
                <Text style={{ color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                  Your current plan stays active until expiry. If you change plans midway, the selected plan is scheduled for the next cycle and the current subscription is stopped at cycle end.
                </Text>
                {queuedPlan ? (
                  <View
                    style={{
                      backgroundColor: "#FFFBEB",
                      borderColor: "#FDE68A",
                      borderRadius: 12,
                      borderWidth: 1,
                      marginTop: 10,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "900" }}>
                      {queuedPlan.toUpperCase()} starts {formatExpiry(queuedStartsAt)}
                    </Text>
                    <Text style={{ color: "#92400E", fontSize: 11, lineHeight: 16, marginTop: 3 }}>
                      This queued change applies only after the current paid period ends.
                    </Text>
                  </View>
                ) : null}
                <View style={{ gap: 8, marginTop: 10 }}>
                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const isCurrent = currentPlan === plan.key && !queuedPlan;
                    const isQueued = queuedPlan === plan.key;
                    const disabled =
                      !providerConfigured ||
                      changeSubscription.isPending ||
                      isCurrent ||
                      isQueued;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={disabled}
                        key={plan.key}
                        onPress={() => changeSubscription.mutate(plan.key)}
                        style={{
                          backgroundColor: isCurrent || isQueued ? PRIMARY_LIGHT : SURFACE,
                          borderColor: isCurrent || isQueued ? PRIMARY_BORDER : BORDER,
                          borderRadius: 12,
                          borderWidth: 1,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          opacity: disabled && !(isCurrent || isQueued) ? 0.55 : 1,
                          padding: 12,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ color: TEXT, fontSize: 13, fontWeight: "900" }}>
                            {plan.label}
                          </Text>
                          <Text style={{ color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 }}>
                            {plan.desc}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: "900" }}>
                            {isQueued ? "QUEUED" : isCurrent ? "CURRENT" : plan.price}
                          </Text>
                          {!isCurrent && !isQueued ? (
                            <Text style={{ color: TEXT_MUTED, fontSize: 10, marginTop: 3 }}>
                              {isActive ? "Next cycle" : "Activate now"}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ color: TEXT_MUTED, fontSize: 11, lineHeight: 16, marginTop: 10 }}>
                  T&C: plan changes do not refund or shorten the current billing period. The current plan remains usable until its expiry date. The new plan begins from the next cycle after successful Razorpay mandate/payment setup.
                </Text>
              </View>
              {subscription?.manualPaymentLink ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(subscription.manualPaymentLink)}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: PRIMARY,
                    borderRadius: 12,
                    marginTop: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>
                    Renew Now
                  </Text>
                </TouchableOpacity>
              ) : providerConfigured ? (
                <TouchableOpacity
                  onPress={() => createSubscription.mutate()}
                  disabled={createSubscription.isPending}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: PRIMARY,
                    borderRadius: 12,
                    marginTop: 12,
                    opacity: createSubscription.isPending ? 0.65 : 1,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>
                    {createSubscription.isPending ? "Opening..." : isActive ? "Manage Renewal" : "Activate Plan"}
                  </Text>
                </TouchableOpacity>
              ) : null}
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 12,
            }}
          >
            Earnings
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Today", value: earningsData?.today },
              { label: "7 Days", value: earningsData?.week },
              { label: "30 Days", value: earningsData?.month },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 12,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: PRIMARY_LIGHT,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <IndianRupee size={ICON.sm} color={PRIMARY} />
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: TEXT,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {earningsLoading ? "..." : formatCurrency(item.value)}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 12,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#F5F5F4",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>
                    Ride History
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                    {rideHistory.length} loaded - newest first
                  </Text>
                </View>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: PRIMARY_LIGHT,
                    borderColor: PRIMARY_BORDER,
                    borderRadius: 999,
                    borderWidth: 1,
                    justifyContent: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: PRIMARY, fontSize: 10, fontWeight: "900" }}>
                    {RIDE_HISTORY_PAGE_SIZE}/page
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 14 }}
                style={{ marginTop: 12 }}
              >
                {RIDE_HISTORY_FILTERS.map((filter) => (
                  <HistoryChip
                    key={filter.key}
                    label={filter.label}
                    onPress={() => setRidePeriod(filter.key)}
                    selected={ridePeriod === filter.key}
                  />
                ))}
              </ScrollView>
            </View>
            {rideHistoryLoading ? (
              <Text
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                }}
              >
                Loading ride history...
              </Text>
            ) : rideHistory.length === 0 ? (
              <Text
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                }}
              >
                Completed ride earnings will appear here.
              </Text>
            ) : filteredRideHistory.length === 0 ? (
              <Text
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                }}
              >
                No rides match the current filters.
              </Text>
            ) : (
              <>
                {visibleRideHistory.map((ride, index) => (
                  <View
                    key={ride.id}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: index < visibleRideHistory.length - 1 ? 1 : 0,
                      borderBottomColor: "#F5F5F4",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: PRIMARY_LIGHT,
                        borderWidth: 1,
                        borderColor: PRIMARY_BORDER,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AutoRickshawIcon size={ICON.sm} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, fontWeight: "700", color: TEXT }}
                      >
                        {ride.dest_address}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <MapPin size={ICON.xs} color={TEXT_MUTED} />
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: 11, color: TEXT_SECONDARY }}
                        >
                          From {ride.pickup_address}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: "700" }}>
                          {formatRideDate(ride.completed_at)}
                        </Text>
                        {formatDistance(ride.distance_km) ? (
                          <Text
                            style={{
                              backgroundColor: "#F1F7F7",
                              borderRadius: 999,
                              color: TEXT_SECONDARY,
                              fontSize: 10,
                              fontWeight: "800",
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}
                          >
                            {formatDistance(ride.distance_km)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontWeight: "900", color: PRIMARY }}>
                        {formatCurrency(ride.fare)}
                      </Text>
                      <Text style={{ color: SUCCESS, fontSize: 10, fontWeight: "800", marginTop: 4 }}>
                        Settled
                      </Text>
                    </View>
                  </View>
                ))}
                <HistoryPager
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  currentPage={safeRidePage}
                  end={visibleRideEnd}
                  isFetchingNextPage={isFetchingNextPage}
                  onNext={goToNextRidePage}
                  onPrevious={() => setRidePage((value) => Math.max(value - 1, 1))}
                  start={visibleRideStart}
                  total={filteredRideHistory.length}
                />
              </>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT,
              marginBottom: 14,
            }}
          >
            Included During Pilot
          </Text>
          <View style={{ gap: 10 }}>
            {BENEFITS.map((benefit, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: `${benefit.color}15`,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <benefit.icon
                    size={ICON.lg}
                    color={benefit.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: TEXT }}
                  >
                    {benefit.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {benefit.desc}
                  </Text>
                </View>
                <CheckCircle2 size={ICON.sm} color={SUCCESS} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

