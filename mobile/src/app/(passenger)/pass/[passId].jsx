import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Phone,
  ReceiptIndianRupee,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { theme as T } from "@/theme/tokens";

const GOLD = T.accent;
const BG = T.bg;
const CARD = T.surface1;
const TEXT = T.text1;
const MUTED = T.text2;
const CANCELLABLE = new Set(["PENDING_MATCH", "ACTIVE", "PAUSED"]);

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function AmountRow({ label, value, strong = false, color = TEXT }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, marginTop: 12 }}>
      <Text style={{ color: MUTED, flex: 1, fontSize: 14 }}>{label}</Text>
      <Text style={{ color, fontSize: strong ? 17 : 14, fontWeight: strong ? "900" : "800" }}>
        {value}
      </Text>
    </View>
  );
}

function RefundConfirmation({ visible, loading, quote, submitting, onClose, onConfirm }) {
  const canConfirm = quote?.canCancel && !submitting;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={submitting ? undefined : onClose}
        style={{ flex: 1, backgroundColor: "rgba(21,32,34,0.52)", justifyContent: "flex-end" }}
      >
        <Pressable
          style={{
            backgroundColor: CARD,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: "90%",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 32 }}>
            <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: "center", marginBottom: 18 }} />
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center" }}>
              <ReceiptIndianRupee size={27} color={T.accentText} />
            </View>
            <Text style={{ color: TEXT, fontSize: 22, fontWeight: "900", marginTop: 14 }}>
              Review your refund
            </Text>
            <Text style={{ color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 7 }}>
              Nothing will be cancelled until you confirm these amounts.
            </Text>

            {loading ? (
              <View style={{ minHeight: 210, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={GOLD} />
                <Text style={{ color: MUTED, marginTop: 10 }}>Calculating your refund…</Text>
              </View>
            ) : quote ? (
              <>
                <View style={{ backgroundColor: T.surface2, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, marginTop: 20 }}>
                  <AmountRow label="Pass amount" value={money(quote.totalPassAmount)} />
                  <AmountRow label="Amount paid" value={money(quote.paidAmount)} />
                  <AmountRow label={`Refund eligibility (${quote.refundPercentage}%)`} value={money(quote.refundAmount)} />
                  <AmountRow label="Cancellation deduction" value={`− ${money(quote.cancellationDeduction)}`} color={quote.cancellationDeduction ? T.warn : T.ok} />
                  <View style={{ height: 1, backgroundColor: T.border, marginTop: 15 }} />
                  <AmountRow label="Refund you will receive" value={money(quote.refundAmount)} strong color={T.ok} />
                </View>

                <View style={{ backgroundColor: T.infoDim, borderRadius: 16, padding: 14, marginTop: 14 }}>
                  <Text style={{ color: T.info, fontWeight: "900" }}>Why this amount?</Text>
                  <Text style={{ color: TEXT, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{quote.policy}</Text>
                </View>

                <View style={{ marginTop: 16 }}>
                  <AmountRow label="Completed rides" value={String(quote.completedRides)} />
                  <AmountRow label="Upcoming rides cancelled" value={String(quote.upcomingRidesToCancel)} />
                  <AmountRow label="Refund destination" value={quote.refundDestination} />
                </View>

                <View style={{ flexDirection: "row", gap: 9, backgroundColor: T.okDim, borderRadius: 16, padding: 14, marginTop: 18 }}>
                  <ShieldCheck size={20} color={T.ok} />
                  <Text style={{ color: T.ok, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>
                    We record the refund amount and status on this pass. Bank processing time may vary after the refund is initiated.
                  </Text>
                </View>

                {quote.blockedReason ? (
                  <View style={{ backgroundColor: T.errDim, borderRadius: 16, padding: 14, marginTop: 14 }}>
                    <Text style={{ color: T.err, fontSize: 13, lineHeight: 19, fontWeight: "800" }}>{quote.blockedReason}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
              <TouchableOpacity
                disabled={submitting}
                onPress={onClose}
                style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: TEXT, fontWeight: "900" }}>Keep pass</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!canConfirm}
                onPress={onConfirm}
                style={{ flex: 1.35, borderRadius: 14, backgroundColor: canConfirm ? T.err : T.surface3, paddingVertical: 14, alignItems: "center" }}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={{ color: canConfirm ? "#FFFFFF" : T.text3, fontWeight: "900", textAlign: "center" }}>
                    Cancel & refund {money(quote?.refundAmount)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function PassDetail() {
  const { passId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundQuote, setRefundQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [cancellationResult, setCancellationResult] = useState(null);

  const { data } = useQuery({
    queryKey: ["pass", passId],
    queryFn: async () => {
      const response = await fetch(`/api/passes/${passId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pass not found");
      return body;
    },
  });

  const action = useMutation({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/passes/${passId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(body.error || "Pass update failed");
        error.code = body.code;
        error.refundQuote = body.refundQuote;
        throw error;
      }
      return body;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pass", passId] });
      queryClient.invalidateQueries({ queryKey: ["passengerPasses"] });
      if (variables.action === "cancel") {
        setRefundOpen(false);
        setCancellationResult(result);
        const description = result.refundAmount > 0
          ? result.refundPending
            ? `${money(result.refundAmount)} is recorded and pending processing.`
            : `${money(result.refundAmount)} was initiated to your original payment method.`
          : "No payment refund is due for this pass.";
        toast.success("Pass cancelled", { description });
      } else {
        toast.success("Pass updated");
      }
    },
    onError: (error) => {
      if (error.code === "REFUND_QUOTE_CHANGED" && error.refundQuote) {
        setRefundQuote(error.refundQuote);
        toast.warning("Refund amount updated", { description: "Please review the new amount before confirming again." });
        return;
      }
      toast.error("Pass update failed", { description: error.message });
    },
  });

  const openRefundReview = async () => {
    setRefundOpen(true);
    setQuoteLoading(true);
    setRefundQuote(null);
    try {
      const response = await fetch(`/api/passes/${passId}/cancel`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not calculate refund");
      setRefundQuote(body.refundQuote);
    } catch (error) {
      setRefundOpen(false);
      toast.error("Refund details unavailable", { description: error.message });
    } finally {
      setQuoteLoading(false);
    }
  };

  const pass = data?.pass;
  if (!pass) return <View style={{ flex: 1, backgroundColor: BG }} />;
  const recordedRefund = cancellationResult?.refundAmount ?? pass.cancellation_refund_amount;
  const refundPending = cancellationResult?.refundPending ?? pass.cancellation_refund_pending;

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: 18, paddingBottom: 80 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft color={TEXT} />
        </TouchableOpacity>
        <Text style={{ color: TEXT, fontSize: 25, fontWeight: "900", marginTop: 18 }}>Pass details</Text>

        <View style={{ marginTop: 18, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 18 }}>
          <Text style={{ color: T.accentText, fontWeight: "900" }}>{pass.status}</Text>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900", marginTop: 14 }}>{pass.pickup_label}</Text>
          <Text style={{ color: T.accentText, marginVertical: 5 }}>↓</Text>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{pass.dropoff_label}</Text>
          <Text style={{ color: MUTED, marginTop: 14 }}>{pass.scheduled_days?.join(" · ")} · {String(pass.scheduled_time).slice(0, 5)}</Text>
          <Text style={{ color: MUTED, marginTop: 6 }}>{pass.start_date} → {pass.end_date}</Text>
        </View>

        {pass.driver_name ? (
          <View style={{ marginTop: 14, backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
            <UserRound color={T.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT, fontWeight: "900" }}>{pass.driver_name}</Text>
              <Text style={{ color: MUTED, marginTop: 3 }}>{pass.vehicle_number}</Text>
            </View>
            <Phone color={TEXT} />
          </View>
        ) : null}

        {pass.status === "CANCELLED" && recordedRefund !== null && recordedRefund !== undefined ? (
          <View style={{ marginTop: 14, backgroundColor: refundPending ? T.warnDim : T.okDim, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: refundPending ? T.warn : T.ok }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={22} color={refundPending ? T.warn : T.ok} />
              <Text style={{ color: refundPending ? T.warn : T.ok, fontWeight: "900", fontSize: 16 }}>
                Refund {refundPending ? "pending" : "initiated"}
              </Text>
            </View>
            <Text style={{ color: TEXT, fontSize: 24, fontWeight: "900", marginTop: 12 }}>{money(recordedRefund)}</Text>
            <Text style={{ color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
              {refundPending ? "Your refund is recorded for processing." : "Sent to the original payment method. Bank processing time may vary."}
            </Text>
            {pass.cancellation_refund_id || cancellationResult?.refundId ? (
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>Reference: {pass.cancellation_refund_id || cancellationResult.refundId}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={{ color: TEXT, fontWeight: "900", marginTop: 22, marginBottom: 10 }}>Ride calendar</Text>
        {(pass.rides || []).slice(0, 14).map((ride) => (
          <View key={ride.id} style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 8, flexDirection: "row" }}>
            <CalendarDays color={T.accentText} size={18} />
            <Text style={{ color: TEXT, flex: 1, marginLeft: 10 }}>{ride.scheduled_date}</Text>
            <Text style={{ color: ride.status === "COMPLETED" ? T.ok : T.accentText, fontWeight: "800" }}>{ride.status}</Text>
            {ride.otp ? <Text style={{ color: TEXT, marginLeft: 10, fontWeight: "900" }}>{ride.otp}</Text> : null}
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          {pass.status === "ACTIVE" ? (
            <TouchableOpacity
              disabled={action.isPending}
              onPress={() => action.mutate({ action: "pause", startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) })}
              style={{ flex: 1, backgroundColor: GOLD, padding: 14, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: T.surface1, fontWeight: "900" }}>Pause</Text>
            </TouchableOpacity>
          ) : null}
          {pass.status === "PAUSED" ? (
            <TouchableOpacity disabled={action.isPending} onPress={() => action.mutate({ action: "resume" })} style={{ flex: 1, backgroundColor: GOLD, padding: 14, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: T.surface1, fontWeight: "900" }}>Resume</Text>
            </TouchableOpacity>
          ) : null}
          {CANCELLABLE.has(pass.status) ? (
            <TouchableOpacity disabled={action.isPending} onPress={openRefundReview} style={{ flex: 1, borderWidth: 1, borderColor: T.err, padding: 14, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: T.err, fontWeight: "900" }}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <RefundConfirmation
        visible={refundOpen}
        loading={quoteLoading}
        quote={refundQuote}
        submitting={action.isPending}
        onClose={() => !action.isPending && setRefundOpen(false)}
        onConfirm={() => action.mutate({ action: "cancel", confirmedRefundAmount: refundQuote.refundAmount })}
      />
    </>
  );
}
