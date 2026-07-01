import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Image as ImageIcon,
} from "lucide-react-native";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { ICON } from "@/theme/iconScale";
import { useAuth } from "@/utils/auth/useAuth";
import { theme } from "@/theme/tokens";

const PRIMARY = theme.accent;
const PRIMARY_LIGHT = theme.accentDim;
const PRIMARY_BORDER = theme.borderH;
const BG = theme.bg;
const SURFACE = theme.surface1;
const BORDER = theme.border;
const TEXT = theme.text1;
const TEXT_SECONDARY = theme.text2;
const TEXT_MUTED = theme.text3;
const SUCCESS = theme.ok;

const STEPS = ["Details", "Docs", "Aadhaar", "Selfie", "Review"];
const KYC_DRAFT_VERSION = 1;
const KYC_DRAFT_PREFIX = "driver-kyc-draft";
const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function parseDisplayDate(value, fallbackYear = CURRENT_YEAR) {
  const raw = String(value || "").trim();
  const displayMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return {
      day: Number(displayMatch[1]),
      month: Number(displayMatch[2]),
      year: Number(displayMatch[3]),
    };
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return {
      day: Number(isoMatch[3]),
      month: Number(isoMatch[2]),
      year: Number(isoMatch[1]),
    };
  }

  const hyphenMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (hyphenMatch) {
    return {
      day: Number(hyphenMatch[1]),
      month: Number(hyphenMatch[2]),
      year: Number(hyphenMatch[3]),
    };
  }

  return { day: 1, month: 1, year: fallbackYear };
}

function clampDateParts(parts, minYear, maxYear) {
  const year = Math.min(maxYear, Math.max(minYear, parts.year));
  const month = Math.min(12, Math.max(1, parts.month));
  const day = Math.min(daysInMonth(month, year), Math.max(1, parts.day));
  return { day, month, year };
}

function formatDisplayDate(parts) {
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

function formatManualDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function createMonthCells({ month, year }) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(month, year);
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
}

function readDriverName(driver, auth) {
  return driver?.full_name || auth?.user?.name || auth?.user?.email || "";
}

function readAssetMimeType(asset) {
  if (asset?.mimeType) return asset.mimeType;
  const extension = String(asset?.uri || "").split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

async function uploadImageAsset({ asset, field, scope }) {
  if (!asset?.base64) {
    throw new Error("Could not read the selected image");
  }

  const mimeType = readAssetMimeType(asset);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      filename: asset.fileName || `${field}-${Date.now()}.jpg`,
      base64: `data:${mimeType};base64,${asset.base64}`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.url) {
    throw new Error(body.error || "Upload failed");
  }
  return body;
}

export default function DriverKycSubmit() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const [step, setStep] = useState(0);
  const [driverName, setDriverName] = useState("");
  const [dob, setDob] = useState("");
  const [dlNumber, setDlNumber] = useState("");
  const [dlExpiry, setDlExpiry] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [dlPhotoUrl, setDlPhotoUrl] = useState("");
  const [dlPreview, setDlPreview] = useState("");
  const [rcPhotoUrl, setRcPhotoUrl] = useState("");
  const [rcPreview, setRcPreview] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [selfiePreview, setSelfiePreview] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [uploadingField, setUploadingField] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";
  const draftKey = `${KYC_DRAFT_PREFIX}:${authUserKey}`;

  const { data, isLoading } = useQuery({
    queryKey: ["driverMe", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load driver profile");
      return res.json();
    },
    enabled: !!auth,
    onSuccess: (body) => {
      const driver = body?.driver;
      setDriverName((value) => value || readDriverName(driver, auth));
      setDlNumber((value) => value || driver?.dl_number || "");
      setRcNumber((value) => value || driver?.rc_number || "");
      setDob((value) =>
        value || (driver?.dob ? formatDisplayDate(parseDisplayDate(driver.dob, 1995)) : ""),
      );
      setDlExpiry((value) =>
        value || (driver?.dl_expiry ? formatDisplayDate(parseDisplayDate(driver.dl_expiry, CURRENT_YEAR + 5)) : ""),
      );
      setDlPhotoUrl((value) => value || driver?.license_storage_path || driver?.license_url || "");
      setDlPreview((value) => value || driver?.license_url || "");
      setRcPhotoUrl((value) => value || driver?.rc_photo_storage_path || driver?.rc_photo_url || "");
      setRcPreview((value) => value || driver?.rc_photo_url || "");
      setSelfieUrl((value) => value || driver?.selfie_storage_path || driver?.selfie_url || "");
      setSelfiePreview((value) => value || driver?.selfie_url || "");
    },
  });

  const driver = data?.driver;
  const aadhaarMasked = useMemo(() => {
    const digits = aadhaarNumber.replace(/\D/g, "");
    return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "";
  }, [aadhaarNumber]);

  const draft = useMemo(
    () => ({
      version: KYC_DRAFT_VERSION,
      step,
      driverName,
      dob,
      dlNumber,
      dlExpiry,
      rcNumber,
      dlPhotoUrl,
      dlPreview,
      rcPhotoUrl,
      rcPreview,
      selfieUrl,
      selfiePreview,
      aadhaarNumber,
    }),
    [
      aadhaarNumber,
      dlExpiry,
      dlNumber,
      dlPhotoUrl,
      dlPreview,
      dob,
      driverName,
      rcNumber,
      rcPhotoUrl,
      rcPreview,
      selfiePreview,
      selfieUrl,
      step,
    ],
  );

  useEffect(() => {
    let active = true;
    if (!auth || authUserKey === "anonymous") return () => {};

    AsyncStorage.getItem(draftKey)
      .then((value) => {
        if (!active || !value) return;
        const saved = JSON.parse(value);
        if (saved?.version !== KYC_DRAFT_VERSION) return;
        setStep((current) => Math.max(current, Number(saved.step) || 0));
        setDriverName((current) => current || saved.driverName || "");
        setDob((current) => current || saved.dob || "");
        setDlNumber((current) => current || saved.dlNumber || "");
        setDlExpiry((current) => current || saved.dlExpiry || "");
        setRcNumber((current) => current || saved.rcNumber || "");
        setDlPhotoUrl((current) => current || saved.dlPhotoUrl || "");
        setDlPreview((current) => current || saved.dlPreview || "");
        setRcPhotoUrl((current) => current || saved.rcPhotoUrl || "");
        setRcPreview((current) => current || saved.rcPreview || "");
        setSelfieUrl((current) => current || saved.selfieUrl || "");
        setSelfiePreview((current) => current || saved.selfiePreview || "");
        setAadhaarNumber((current) => current || saved.aadhaarNumber || "");
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [auth, authUserKey, draftKey]);

  useEffect(() => {
    if (!auth || authUserKey === "anonymous") return () => {};
    const hasDraft =
      driverName ||
      dob ||
      dlNumber ||
      dlExpiry ||
      rcNumber ||
      dlPhotoUrl ||
      rcPhotoUrl ||
      selfieUrl ||
      aadhaarNumber ||
      step > 0;
    if (!hasDraft) return () => {};

    const timeout = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    aadhaarNumber,
    auth,
    authUserKey,
    dlExpiry,
    dlNumber,
    dlPhotoUrl,
    dob,
    draft,
    draftKey,
    driverName,
    rcNumber,
    rcPhotoUrl,
    selfieUrl,
    step,
  ]);

  const uploadSelectedImage = async (field, source) => {
    setUploadingField(field);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow access to continue.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: Platform.OS === "android",
              quality: 0.8,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: Platform.OS === "android",
              quality: 0.8,
              base64: true,
            });

      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;

      const body = await uploadImageAsset({ asset, field, scope: "kyc" });

      if (field === "dl") {
        setDlPhotoUrl(body.path || body.url);
        setDlPreview(asset.uri || body.url);
      } else if (field === "rc") {
        setRcPhotoUrl(body.path || body.url);
        setRcPreview(asset.uri || body.url);
      } else {
        setSelfieUrl(body.path || body.url);
        setSelfiePreview(asset.uri || body.url);
      }
    } catch (err) {
      Alert.alert("Upload Failed", err.message || "Could not upload image");
    } finally {
      setUploadingField(null);
    }
  };

  const submitKyc = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/drivers/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverName,
          dob,
          dlNumber,
          dlExpiry,
          rcNumber,
          dlPhotoUrl,
          rcPhotoUrl,
          selfieUrl,
          aadhaarNumberFull: aadhaarNumber.replace(/\D/g, ""),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "KYC submission failed");
      return body;
    },
    onSuccess: (body) => {
      AsyncStorage.removeItem(draftKey).catch(() => {});
      setSubmitResult(body);
      queryClient.invalidateQueries({ queryKey: ["driverMe", authUserKey] });
      if (body.verification_status === "APPROVED") {
        setTimeout(() => router.replace("/(driver)"), 2000);
      }
    },
    onError: (err) => Alert.alert("KYC Failed", err.message),
  });

  const canContinue = [
    driverName && dob && dlNumber && rcNumber,
    dlPhotoUrl && rcPhotoUrl,
    aadhaarNumber.replace(/\D/g, "").length >= 4,
    selfieUrl,
    true,
  ][step];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <TukTukGoLoader label="Loading KYC..." />
      </View>
    );
  }

  if (driver?.kyc_status === "approved" && !submitResult) {
    router.replace("/(driver)");
    return null;
  }

  if (submitResult) {
    const approved = submitResult.verification_status === "APPROVED";
    const rejected = submitResult.verification_status === "REJECTED";
    return (
      <View style={{ flex: 1, backgroundColor: BG, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: approved ? theme.okDim : rejected ? theme.errDim : PRIMARY_LIGHT,
              borderColor: approved ? theme.okDim : rejected ? theme.errDim : PRIMARY_BORDER,
              borderRadius: 32,
              borderWidth: 1,
              height: 168,
              justifyContent: "center",
              width: 168,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: SURFACE,
                borderRadius: 28,
                elevation: 5,
                height: 96,
                justifyContent: "center",
                shadowColor: theme.text1,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                width: 96,
              }}
            >
              {approved ? (
                <CheckCircle2 size={52} color={SUCCESS} />
              ) : rejected ? (
                <FileText size={52} color={theme.err} />
              ) : (
                <Clock3 size={52} color={PRIMARY} />
              )}
            </View>
          </View>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: "900", marginTop: 22, textAlign: "center" }}>
            {approved ? "You're verified" : rejected ? "KYC needs another look" : "Documents under review"}
          </Text>
        </View>
        <Text style={{ marginTop: 12, textAlign: "center", color: TEXT_SECONDARY, lineHeight: 20 }}>
          {approved
            ? "You can go online once your dashboard opens."
            : rejected
              ? "Please resubmit documents with clear, matching details."
              : "This usually takes 24-48 hours."}
        </Text>
        {rejected ? (
          <TouchableOpacity
            onPress={() => {
              setSubmitResult(null);
              setStep(0);
            }}
            style={{ marginTop: 24, borderRadius: 14, backgroundColor: PRIMARY, paddingVertical: 15, alignItems: "center" }}
          >
            <Text style={{ color: theme.surface1, fontWeight: "800" }}>Resubmit Documents</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 14 }}>
          <ArrowLeft size={ICON.lg} color={TEXT} />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT }}>Driver KYC</Text>
        <Text style={{ marginTop: 4, color: TEXT_SECONDARY, fontSize: 13 }}>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <StepIndicator step={step} />
        {step === 0 ? (
          <Card title="Personal details">
            <Field label="Full name" value={driverName} onChangeText={setDriverName} />
            <DatePickerField
              label="Date of birth"
              value={dob}
              onChange={setDob}
              minYear={1940}
              maxYear={CURRENT_YEAR - 18}
              fallbackYear={1995}
            />
            <Field label="DL number" value={dlNumber} onChangeText={setDlNumber} autoCapitalize="characters" />
            <DatePickerField
              label="DL expiry"
              value={dlExpiry}
              onChange={setDlExpiry}
              minYear={CURRENT_YEAR}
              maxYear={CURRENT_YEAR + 30}
              fallbackYear={CURRENT_YEAR + 5}
            />
            <Field label="RC number" value={rcNumber} onChangeText={setRcNumber} autoCapitalize="characters" />
          </Card>
        ) : null}
        {step === 1 ? (
          <Card title="Document upload">
            <UploadField label="Driving license photo" value={dlPhotoUrl} preview={dlPreview} uploading={uploadingField === "dl"} onPick={(source) => uploadSelectedImage("dl", source)} />
            <UploadField label="RC photo" value={rcPhotoUrl} preview={rcPreview} uploading={uploadingField === "rc"} onPick={(source) => uploadSelectedImage("rc", source)} />
          </Card>
        ) : null}
        {step === 2 ? (
          <Card title="Aadhaar">
            <Field label="Aadhaar number" value={aadhaarNumber} onChangeText={setAadhaarNumber} keyboardType="number-pad" />
            <Text style={{ color: TEXT_MUTED, marginTop: 8, fontSize: 12 }}>
              Stored as: {aadhaarMasked || "Enter number to mask"}. Full Aadhaar is sent only for this HTTPS verification request.
            </Text>
          </Card>
        ) : null}
        {step === 3 ? (
          <Card title="Liveness selfie">
            <UploadField label="Selfie" value={selfieUrl} preview={selfiePreview} uploading={uploadingField === "selfie"} onPick={(source) => uploadSelectedImage("selfie", source)} cameraOnly />
          </Card>
        ) : null}
        {step === 4 ? (
          <Card title="Review & submit">
            {[
              ["Name", driverName],
              ["DOB", dob],
              ["DL", dlNumber],
              ["RC", rcNumber],
              ["Aadhaar", aadhaarMasked],
              ["DL photo", dlPhotoUrl ? "Uploaded" : "Missing"],
              ["RC photo", rcPhotoUrl ? "Uploaded" : "Missing"],
              ["Selfie", selfieUrl ? "Uploaded" : "Missing"],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.surface2 }}>
                <Text style={{ color: TEXT_MUTED, fontWeight: "700" }}>{label}</Text>
                <Text style={{ color: TEXT, fontWeight: "800", maxWidth: "58%", textAlign: "right" }}>{value}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: "row", gap: 12 }}>
        <TouchableOpacity disabled={step === 0} onPress={() => setStep((value) => Math.max(0, value - 1))} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 15, alignItems: "center", opacity: step === 0 ? 0.45 : 1 }}>
          <Text style={{ color: TEXT, fontWeight: "800" }}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!canContinue || submitKyc.isPending}
          onPress={() => (step === 4 ? submitKyc.mutate() : setStep((value) => Math.min(4, value + 1)))}
          style={{ flex: 1.4, borderRadius: 14, backgroundColor: canContinue ? PRIMARY : theme.border, paddingVertical: 15, alignItems: "center" }}
        >
          <Text style={{ color: theme.surface1, fontWeight: "900" }}>
            {submitKyc.isPending ? "Submitting..." : step === 4 ? "Submit KYC" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StepIndicator({ step }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
      {STEPS.map((label, index) => (
        <View key={label} style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: index <= step ? PRIMARY : BORDER }} />
      ))}
    </View>
  );
}

function Card({ title, children }) {
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 16, gap: 14 }}>
      <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View>
      <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800", marginBottom: 6, textTransform: "uppercase" }}>{label}</Text>
      <TextInput
        {...props}
        placeholder={label}
        placeholderTextColor={TEXT_MUTED}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 15, fontWeight: "700" }}
      />
    </View>
  );
}

function DatePickerField({ label, value, onChange, minYear, maxYear, fallbackYear }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("calendar");
  const [draft, setDraft] = useState(() =>
    clampDateParts(parseDisplayDate(value, fallbackYear), minYear, maxYear),
  );
  const [yearRangeStart, setYearRangeStart] = useState(() => {
    const selectedYear = clampDateParts(parseDisplayDate(value, fallbackYear), minYear, maxYear).year;
    return Math.max(minYear, selectedYear - (selectedYear % 12));
  });

  const monthCells = useMemo(() => createMonthCells(draft), [draft]);
  const yearRange = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => yearRangeStart + index).filter(
        (year) => year >= minYear && year <= maxYear,
      ),
    [maxYear, minYear, yearRangeStart],
  );

  const changeMonth = (delta) => {
    setDraft((current) => {
      const next = { ...current, month: current.month + delta };
      if (next.month > 12) {
        next.month = 1;
        next.year += 1;
      }
      if (next.month < 1) {
        next.month = 12;
        next.year -= 1;
      }
      return clampDateParts(next, minYear, maxYear);
    });
  };

  const selectYear = (year) => {
    setDraft((current) => clampDateParts({ ...current, year }, minYear, maxYear));
    setMode("calendar");
  };

  const moveYearRange = (delta) => {
    setYearRangeStart((current) => Math.min(maxYear - 11, Math.max(minYear, current + delta)));
  };

  const openPicker = () => {
    const nextDraft = clampDateParts(parseDisplayDate(value, fallbackYear), minYear, maxYear);
    setDraft(nextDraft);
    setYearRangeStart(Math.max(minYear, nextDraft.year - (nextDraft.year % 12)));
    setMode("calendar");
    setOpen(true);
  };

  return (
    <View>
      <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800", marginBottom: 6, textTransform: "uppercase" }}>{label}</Text>
      <View
        style={{
          alignItems: "center",
          borderColor: BORDER,
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <CalendarDays size={ICON.md} color={PRIMARY} />
        <TextInput
          value={value}
          onChangeText={(text) => onChange(formatManualDateInput(text))}
          keyboardType="number-pad"
          placeholder="dd/mm/yyyy"
          placeholderTextColor={TEXT_MUTED}
          maxLength={10}
          style={{
            color: value ? TEXT : TEXT_MUTED,
            flex: 1,
            fontSize: 15,
            fontWeight: "800",
            padding: 0,
          }}
        />
        <TouchableOpacity activeOpacity={0.86} onPress={openPicker}>
          <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: "800" }}>Pick</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.40)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <View style={{ backgroundColor: SURFACE, borderRadius: 22, padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{label}</Text>
                  <Text style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
                    {formatDisplayDate(draft)}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: PRIMARY_LIGHT,
                    borderColor: PRIMARY_BORDER,
                    borderRadius: 13,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: "900" }}>dd/mm/yyyy</Text>
                </View>
              </View>

              {mode === "calendar" ? (
                <View style={{ marginTop: 18 }}>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => changeMonth(-1)}
                      style={{ alignItems: "center", backgroundColor: theme.surface2, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}
                    >
                      <ChevronLeft size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => setMode("years")}
                      style={{ alignItems: "center", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>
                        {MONTHS[draft.month - 1]} {draft.year}
                      </Text>
                      <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: "900", marginTop: 2 }}>
                        Tap to change year
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => changeMonth(1)}
                      style={{ alignItems: "center", backgroundColor: theme.surface2, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}
                    >
                      <ChevronRight size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: "row", marginTop: 18 }}>
                    {WEEKDAYS.map((day, index) => (
                      <Text key={`${day}-${index}`} style={{ color: TEXT_MUTED, flex: 1, fontSize: 12, fontWeight: "900", textAlign: "center" }}>
                        {day}
                      </Text>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                    {monthCells.map((day, index) => {
                      const selected = day === draft.day;
                      return (
                        <View key={`${day || "blank"}-${index}`} style={{ alignItems: "center", height: 42, justifyContent: "center", width: `${100 / 7}%` }}>
                          {day ? (
                            <TouchableOpacity
                              activeOpacity={0.84}
                              onPress={() => setDraft((current) => ({ ...current, day }))}
                              style={{
                                alignItems: "center",
                                backgroundColor: selected ? PRIMARY : "transparent",
                                borderColor: selected ? PRIMARY : BORDER,
                                borderRadius: 999,
                                borderWidth: selected ? 0 : 1,
                                height: 34,
                                justifyContent: "center",
                                width: 34,
                              }}
                            >
                              <Text style={{ color: selected ? SURFACE : TEXT, fontSize: 14, fontWeight: "900" }}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 18 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => moveYearRange(-12)}
                      style={{ alignItems: "center", backgroundColor: theme.surface2, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}
                    >
                      <ChevronLeft size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                    <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>
                      {yearRange[0]} - {yearRange[yearRange.length - 1]}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => moveYearRange(12)}
                      style={{ alignItems: "center", backgroundColor: theme.surface2, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}
                    >
                      <ChevronRight size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {yearRange.map((year) => {
                      const selected = year === draft.year;
                      return (
                        <TouchableOpacity
                          activeOpacity={0.84}
                          key={year}
                          onPress={() => selectYear(year)}
                          style={{
                            alignItems: "center",
                            backgroundColor: selected ? PRIMARY : theme.surface2,
                            borderColor: selected ? PRIMARY : BORDER,
                            borderRadius: 14,
                            borderWidth: 1,
                            height: 48,
                            justifyContent: "center",
                            width: "31.6%",
                          }}
                        >
                          <Text style={{ color: selected ? SURFACE : TEXT, fontSize: 15, fontWeight: "900" }}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => setOpen(false)}
                  style={{
                    alignItems: "center",
                    borderColor: BORDER,
                    borderRadius: 14,
                    borderWidth: 1,
                    flex: 1,
                    paddingVertical: 14,
                  }}
                >
                  <Text style={{ color: TEXT, fontWeight: "900" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    onChange(formatDisplayDate(draft));
                    setOpen(false);
                  }}
                  style={{
                    alignItems: "center",
                    backgroundColor: PRIMARY,
                    borderRadius: 14,
                    flex: 1,
                    paddingVertical: 14,
                  }}
                >
                  <Text style={{ color: SURFACE, fontWeight: "900" }}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function UploadField({ label, value, preview, uploading, onPick, cameraOnly = false }) {
  const imageSource = preview || value;
  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: value ? PRIMARY_BORDER : BORDER, padding: 12, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: value ? PRIMARY_LIGHT : theme.surface2, alignItems: "center", justifyContent: "center" }}>
          {value ? <CheckCircle2 size={ICON.md} color={SUCCESS} /> : <FileText size={ICON.md} color={TEXT_MUTED} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: TEXT, fontWeight: "900" }}>{label}</Text>
          <Text style={{ color: value ? SUCCESS : TEXT_MUTED, fontSize: 12, marginTop: 2 }}>
            {uploading ? "Uploading..." : value ? "Uploaded" : "Required"}
          </Text>
        </View>
      </View>
      {imageSource ? <Image source={{ uri: imageSource }} style={{ height: 130, borderRadius: 12, backgroundColor: theme.surface2 }} resizeMode="cover" /> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={() => onPick("camera")} disabled={uploading} style={{ flex: 1, borderRadius: 12, backgroundColor: PRIMARY_LIGHT, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7 }}>
          <Camera size={ICON.sm} color={PRIMARY} />
          <Text style={{ color: PRIMARY, fontWeight: "800" }}>Camera</Text>
        </TouchableOpacity>
        {!cameraOnly ? (
          <TouchableOpacity onPress={() => onPick("gallery")} disabled={uploading} style={{ flex: 1, borderRadius: 12, backgroundColor: theme.surface2, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7 }}>
            <ImageIcon size={ICON.sm} color={TEXT_SECONDARY} />
            <Text style={{ color: TEXT_SECONDARY, fontWeight: "800" }}>Gallery</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
