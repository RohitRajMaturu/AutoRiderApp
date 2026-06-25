import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Modal, Pressable } from "react-native";
import * as Contacts from "expo-contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  LogOut,
  Phone,
  Shield,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  ContactRound,
  CalendarDays,
  HelpCircle,
  FlaskConical,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import useAppStore from "@/store/useAppStore";
import { ICON } from "@/theme/iconScale";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { toast } from "sonner-native";
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  useLanguage,
} from "@/i18n/LanguageContext";

const PRIMARY = "#43B8B3";
const PRIMARY_LIGHT = "#E7F6F4";
const PRIMARY_BORDER = "#BFE5E0";
const BG = "#EAF0F1";
const SURFACE = "#FFFFFF";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const SUPPORT_WHATSAPP_URL = `https://wa.me/${process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "919999999999"}`;
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "#";
const GENDER_OPTIONS = [
  { value: "", label: "Select (optional)" },
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "self_described", label: "Self-described" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CURRENT_YEAR = new Date().getFullYear();

function pad2(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function parseDisplayDate(value, fallbackYear = CURRENT_YEAR - 25) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || "");
  return match
    ? { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) }
    : { day: 1, month: 1, year: fallbackYear };
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
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth(month, year) }, (_, index) => index + 1),
  ];
}

function isoToIndianDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "";
}

function contactDisplayName(contact) {
  return (
    contact?.name?.trim() ||
    [contact?.firstName, contact?.middleName, contact?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    contact?.nickname?.trim() ||
    ""
  );
}

function parseIndianDate(dateOfBirth) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateOfBirth || "");
  if (!match) return null;
  const [, day, month, year] = match;
  const isoDate = `${year}-${month}-${day}`;
  const date = new Date(`${isoDate}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return { date, isoDate };
}

function calculateAge(dateOfBirth) {
  const parsed = parseIndianDate(dateOfBirth);
  if (!parsed) return null;
  const birth = parsed.date;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function indianNationalNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(-10);
}

function indianPhonePayload(value) {
  const nationalNumber = indianNationalNumber(value);
  return nationalNumber ? `+91${nationalNumber}` : "";
}

function PassengerBadge() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: PRIMARY_LIGHT,
        borderColor: PRIMARY_BORDER,
        borderRadius: 99,
        borderWidth: 1,
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: "700" }}>
        🛺
      </Text>
    </View>
  );
}

function ProfileFetchNotice({ visible }) {
  if (!visible) return null;

  return (
    <View
      style={{
        alignItems: "center",
        borderColor: PRIMARY_BORDER,
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 16,
        paddingVertical: 10,
        width: "100%",
      }}
    >
      <TukTukGoLoader label="Loading profile..." size={32} textColor={TEXT_SECONDARY} />
    </View>
  );
}

function MenuItem({
  icon: Icon,
  label,
  sublabel,
  onPress,
  color = TEXT_SECONDARY,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: "#F5F5F4",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Icon size={ICON.sm} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      <ChevronRight size={ICON.sm} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

function ProfileTextField({
  label,
  value,
  onChangeText,
  editable,
  placeholder,
  keyboardType,
  maxLength,
  multiline = false,
  helper,
}) {
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={TEXT_MUTED}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 92 : undefined,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: value ? PRIMARY_BORDER : BORDER,
          backgroundColor: SURFACE,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: TEXT,
          fontSize: multiline ? 14 : 15,
          fontWeight: multiline ? "500" : "600",
        }}
      />
      {helper ? (
        <Text style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 5 }}>{helper}</Text>
      ) : null}
    </View>
  );
}

function IndianPhoneField({
  label,
  value,
  onChangeText,
  editable,
  placeholder = "10-digit mobile number",
}) {
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          alignItems: "center",
          borderColor: value ? PRIMARY_BORDER : BORDER,
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            alignItems: "center",
            alignSelf: "stretch",
            backgroundColor: "#F5F5F4",
            borderRightColor: BORDER,
            borderRightWidth: 1,
            justifyContent: "center",
            paddingHorizontal: 13,
          }}
        >
          <Text style={{ color: TEXT, fontSize: 15, fontWeight: "800" }}>+91</Text>
        </View>
        <TextInput
          value={value}
          onChangeText={(next) => onChangeText(indianNationalNumber(next))}
          editable={editable}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={TEXT_MUTED}
          maxLength={10}
          style={{
            backgroundColor: SURFACE,
            color: TEXT,
            flex: 1,
            fontSize: 15,
            fontWeight: "600",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        />
      </View>
    </View>
  );
}

function CompactSelect({ label, value, options, onChange, disabled }) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
        {label}
      </Text>
      <TouchableOpacity
        disabled={disabled}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
        style={{
          alignItems: "center",
          backgroundColor: SURFACE,
          borderColor: BORDER,
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: 48,
          paddingHorizontal: 14,
        }}
      >
        <Text style={{ color: value ? TEXT : TEXT_MUTED, fontSize: 14, fontWeight: "600" }}>
          {selected?.label}
        </Text>
        <ChevronDown size={ICON.sm} color={TEXT_MUTED} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable
          onPress={() => setVisible(false)}
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            style={{
              backgroundColor: SURFACE,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "70%",
              paddingBottom: 24,
              paddingTop: 12,
            }}
          >
            <View style={{ alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: BORDER, marginBottom: 8 }} />
            <Text style={{ color: TEXT, fontSize: 17, fontWeight: "800", padding: 16 }}>{label}</Text>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setVisible(false);
                    }}
                    style={{
                      alignItems: "center",
                      borderTopColor: "#F5F5F4",
                      borderTopWidth: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      minHeight: 50,
                      paddingHorizontal: 18,
                    }}
                  >
                    <Text style={{ color: TEXT, fontSize: 14, fontWeight: isSelected ? "800" : "500" }}>
                      {option.label}
                    </Text>
                    {isSelected ? <Check size={ICON.sm} color={PRIMARY} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DatePickerField({ label, value, onChange, disabled }) {
  const minYear = CURRENT_YEAR - 120;
  const maxYear = CURRENT_YEAR - 13;
  const fallbackYear = CURRENT_YEAR - 25;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("calendar");
  const [draft, setDraft] = useState(() =>
    clampDateParts(parseDisplayDate(value, fallbackYear), minYear, maxYear),
  );
  const [yearRangeStart, setYearRangeStart] = useState(() =>
    Math.max(minYear, draft.year - (draft.year % 12)),
  );
  const monthCells = useMemo(() => createMonthCells(draft), [draft]);
  const yearRange = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => yearRangeStart + index).filter(
        (year) => year >= minYear && year <= maxYear,
      ),
    [maxYear, minYear, yearRangeStart],
  );

  const openPicker = () => {
    const nextDraft = clampDateParts(parseDisplayDate(value, fallbackYear), minYear, maxYear);
    setDraft(nextDraft);
    setYearRangeStart(Math.max(minYear, nextDraft.year - (nextDraft.year % 12)));
    setMode("calendar");
    setOpen(true);
  };

  const changeMonth = (delta) => {
    setDraft((current) => {
      const next = { ...current, month: current.month + delta };
      if (next.month > 12) {
        next.month = 1;
        next.year += 1;
      } else if (next.month < 1) {
        next.month = 12;
        next.year -= 1;
      }
      return clampDateParts(next, minYear, maxYear);
    });
  };

  const moveYearRange = (delta) => {
    setYearRangeStart((current) =>
      Math.min(Math.max(minYear, maxYear - 11), Math.max(minYear, current + delta)),
    );
  };

  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          alignItems: "center",
          borderColor: value ? PRIMARY_BORDER : BORDER,
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
          editable={!disabled}
          keyboardType="number-pad"
          placeholder="DD/MM/YYYY"
          placeholderTextColor={TEXT_MUTED}
          maxLength={10}
          style={{ color: TEXT, flex: 1, fontSize: 15, fontWeight: "700", padding: 0 }}
        />
        <TouchableOpacity disabled={disabled} activeOpacity={0.86} onPress={openPicker}>
          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>Pick</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 5 }}>
        {calculateAge(value) !== null ? `Age: ${calculateAge(value)}` : "Select your date of birth"}
      </Text>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ alignItems: "center", backgroundColor: "#00000066", flex: 1, justifyContent: "center", padding: 20 }}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <View style={{ backgroundColor: SURFACE, borderRadius: 22, padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{label}</Text>
                  <Text style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
                    {formatDisplayDate(draft)}
                  </Text>
                </View>
                <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "900" }}>DD/MM/YYYY</Text>
              </View>

              {mode === "calendar" ? (
                <View style={{ marginTop: 18 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={{ alignItems: "center", backgroundColor: "#F5F5F4", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                      <ChevronLeft size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setMode("years")} style={{ alignItems: "center", padding: 10 }}>
                      <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>
                        {MONTHS[draft.month - 1]} {draft.year}
                      </Text>
                      <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: "800" }}>Tap to change year</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={{ alignItems: "center", backgroundColor: "#F5F5F4", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                      <ChevronRight size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: "row", marginTop: 18 }}>
                    {WEEKDAYS.map((day, index) => (
                      <Text key={`${day}-${index}`} style={{ color: TEXT_MUTED, flex: 1, fontSize: 12, fontWeight: "900", textAlign: "center" }}>{day}</Text>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                    {monthCells.map((day, index) => {
                      const selected = day === draft.day;
                      return (
                        <View key={`${day || "blank"}-${index}`} style={{ alignItems: "center", height: 42, justifyContent: "center", width: `${100 / 7}%` }}>
                          {day ? (
                            <TouchableOpacity
                              onPress={() => setDraft((current) => ({ ...current, day }))}
                              style={{ alignItems: "center", backgroundColor: selected ? PRIMARY : "transparent", borderColor: selected ? PRIMARY : BORDER, borderRadius: 999, borderWidth: selected ? 0 : 1, height: 34, justifyContent: "center", width: 34 }}
                            >
                              <Text style={{ color: selected ? SURFACE : TEXT, fontSize: 14, fontWeight: "900" }}>{day}</Text>
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
                    <TouchableOpacity onPress={() => moveYearRange(-12)} style={{ alignItems: "center", backgroundColor: "#F5F5F4", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                      <ChevronLeft size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                    <Text style={{ color: TEXT, fontSize: 17, fontWeight: "900" }}>
                      {yearRange[0]} - {yearRange[yearRange.length - 1]}
                    </Text>
                    <TouchableOpacity onPress={() => moveYearRange(12)} style={{ alignItems: "center", backgroundColor: "#F5F5F4", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                      <ChevronRight size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {yearRange.map((year) => (
                      <TouchableOpacity
                        key={year}
                        onPress={() => {
                          setDraft((current) => clampDateParts({ ...current, year }, minYear, maxYear));
                          setMode("calendar");
                        }}
                        style={{ alignItems: "center", backgroundColor: year === draft.year ? PRIMARY : "#F7FBFA", borderColor: year === draft.year ? PRIMARY : BORDER, borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", width: "31.6%" }}
                      >
                        <Text style={{ color: year === draft.year ? SURFACE : TEXT, fontSize: 15, fontWeight: "900" }}>{year}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity onPress={() => setOpen(false)} style={{ alignItems: "center", borderColor: BORDER, borderRadius: 14, borderWidth: 1, flex: 1, paddingVertical: 14 }}>
                  <Text style={{ color: TEXT, fontWeight: "900" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onChange(formatDisplayDate(draft));
                    setOpen(false);
                  }}
                  style={{ alignItems: "center", backgroundColor: PRIMARY, borderRadius: 14, flex: 1, paddingVertical: 14 }}
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

function SignOutSheet({ visible, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "#00000066",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 22,
            paddingBottom: 30,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 42,
              height: 4,
              borderRadius: 2,
              backgroundColor: BORDER,
              marginBottom: 18,
            }}
          />
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <LogOut size={ICON.lg} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: TEXT }}>
            Sign out?
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY }}>
            You can sign back in anytime to book rides and view your trip history.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: BORDER,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "800" }}>Stay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1,
                borderRadius: 14,
                backgroundColor: "#DC2626",
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function PassengerProfile() {
  const { setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { signOut, auth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { testMode, disableTestMode } = useAppStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!auth,
    staleTime: 0,
  });
  const { data: ridesData, isLoading: ridesLoading } = useQuery({
    queryKey: ["passengerRides", authUserKey],
    queryFn: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to load rides");
      return res.json();
    },
    enabled: !!auth,
  });

  const handleExitTestMode = async () => {
    Alert.alert(
      "Exit Test Mode",
      "This will take you back to the sign-in screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit & Sign In",
          onPress: async () => {
            await disableTestMode();
            router.replace("/");
          },
        },
      ],
    );
  };

  const user = profile?.user || auth?.user;
  useEffect(() => {
    if (!testMode) {
      setName(user?.name || "");
      setPhone(indianNationalNumber(user?.phone));
      setDateOfBirth(isoToIndianDate(user?.date_of_birth));
      setGenderIdentity(user?.gender_identity || "");
      setPreferredLanguage(user?.preferred_language || "English");
      setEmergencyContactName(user?.emergency_contact_name || "");
      setEmergencyContactPhone(indianNationalNumber(user?.emergency_contact_phone));
      setAccessibilityNeeds(user?.accessibility_needs || "");
    }
  }, [
    testMode,
    user?.accessibility_needs,
    user?.date_of_birth,
    user?.emergency_contact_name,
    user?.emergency_contact_phone,
    user?.gender_identity,
    user?.name,
    user?.phone,
    user?.preferred_language,
  ]);

  const chooseEmergencyContact = async () => {
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Contacts Permission",
          "Allow contacts access to choose an emergency contact. You can still enter it manually.",
        );
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const selectedPhone = contact.phoneNumbers?.find((item) => item.number)?.number || "";
      const selectedName = contactDisplayName(contact);
      setEmergencyContactName(selectedName);
      setEmergencyContactPhone(indianNationalNumber(selectedPhone));
      if (!selectedName) {
        Alert.alert("Name Not Available", "Please enter a name for the selected contact.");
      }
      if (!selectedPhone) {
        Alert.alert("No Phone Number", "That contact has no phone number. Please enter one manually.");
      }
    } catch {
      Alert.alert(
        "Contact Picker Unavailable",
        "We could not open contacts on this device. Please enter the contact manually.",
      );
    }
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const age = calculateAge(dateOfBirth);
      if (!name.trim()) throw new Error("Full name is required");
      if (phone && phone.length !== 10) throw new Error("Enter a valid 10-digit phone number");
      if (age === null || age < 13 || age > 120) {
        throw new Error("Enter a valid date of birth as DD/MM/YYYY");
      }
      if (
        (emergencyContactName.trim() && !emergencyContactPhone.trim()) ||
        (!emergencyContactName.trim() && emergencyContactPhone.trim())
      ) {
        throw new Error("Add both emergency contact name and phone, or leave both blank");
      }
      if (emergencyContactPhone && emergencyContactPhone.length !== 10) {
        throw new Error("Enter a valid 10-digit emergency contact number");
      }
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: indianPhonePayload(phone),
          date_of_birth: parseIndianDate(dateOfBirth)?.isoDate,
          gender_identity: genderIdentity || null,
          preferred_language: preferredLanguage,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_phone: indianPhonePayload(emergencyContactPhone) || null,
          accessibility_needs: accessibilityNeeds.trim() || null,
          complete_profile: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save profile");
      return body;
    },
    onSuccess: async (body) => {
      setLanguage(normalizeLanguage(body?.user?.preferred_language || preferredLanguage));
      queryClient.setQueryData(["userProfile", authUserKey], body);
      await queryClient.invalidateQueries({ queryKey: ["userProfile", authUserKey] });
      toast.success("Profile saved", {
        description: "Your passenger details have been updated.",
      });
      setTimeout(() => setIsProfileOpen(false), 500);
    },
    onError: (err) => Alert.alert("Save Failed", err.message),
  });

  const rides = ridesData?.rides || [];
  const completedRides = rides.filter((r) => r.status === "completed").length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Test mode banner */}
        {testMode && (
          <TouchableOpacity
            onPress={handleExitTestMode}
            style={{
              backgroundColor: "#FFFBEB",
              borderBottomWidth: 1,
              borderBottomColor: "#FDE68A",
              paddingTop: insets.top + 8,
              paddingBottom: 10,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <FlaskConical size={ICON.sm} color="#B88700" />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: "#286B68",
                fontWeight: "600",
              }}
            >
              🧪 Test Mode Active — Tap to Sign In with real account
            </Text>
            <Text style={{ fontSize: 12, color: "#B88700", fontWeight: "700" }}>
              Exit →
            </Text>
          </TouchableOpacity>
        )}

        {/* Hero header */}
        <View
          style={{
            backgroundColor: SURFACE,
            paddingTop: testMode ? 24 : insets.top + 24,
            paddingBottom: 28,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: PRIMARY,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              shadowColor: PRIMARY,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#fff" }}>
              {testMode
                ? "?"
                : user?.name || auth?.user?.email
                  ? (user?.name || auth.user.email).charAt(0).toUpperCase()
                  : "?"}
            </Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT }}>
            {testMode ? "Guest Passenger" : user?.name || auth?.user?.email || "—"}
          </Text>
          <PassengerBadge />
          <ProfileFetchNotice visible={!testMode && (profileLoading || ridesLoading)} />
          <View
            style={{
              display: "none",
              marginTop: 8,
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: 99,
              backgroundColor: PRIMARY_LIGHT,
              borderWidth: 1,
              borderColor: PRIMARY_BORDER,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY }}>
              🛺 Passenger
            </Text>
          </View>

          {/* Stats */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 24,
              gap: 1,
              backgroundColor: BORDER,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Total Rides", value: rides.length },
              { label: "Completed", value: completedRides },
              {
                label: "Cancelled",
                value: rides.filter((r) => r.status === "cancelled").length,
              },
            ].map((stat, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: SURFACE,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: i === 1 ? PRIMARY : TEXT,
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: TEXT_MUTED,
                    marginTop: 2,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account settings */}
        <View style={{ margin: 16, marginBottom: 0 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Account Settings
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                  Manage your personal, safety, and accessibility details.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsProfileOpen((value) => !value)}
                style={{
                  borderRadius: 999,
                  backgroundColor: PRIMARY_LIGHT,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>
                  {isProfileOpen ? "Hide" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            {isProfileOpen ? (
            <View style={{ marginTop: 16, gap: 12 }}>
              <ProfileTextField
                label="Full Name"
                value={name}
                onChangeText={setName}
                editable={!testMode && !updateProfile.isPending}
                placeholder="Your full name"
                maxLength={120}
              />

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6 }}>
                  Email
                </Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: BORDER,
                    backgroundColor: "#F5F5F4",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                  }}
                >
                  <Text style={{ color: TEXT_SECONDARY, fontSize: 14, fontWeight: "600" }}>
                    {testMode ? "Guest mode" : user?.email || "Not available"}
                  </Text>
                </View>
              </View>

              <IndianPhoneField
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                editable={!testMode && !updateProfile.isPending}
              />

              <DatePickerField
                label="Date of Birth"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                disabled={testMode || updateProfile.isPending}
              />

              <CompactSelect
                label="Gender (Optional)"
                value={genderIdentity}
                options={GENDER_OPTIONS}
                onChange={setGenderIdentity}
                disabled={testMode || updateProfile.isPending}
              />

              <CompactSelect
                label={t("profile.preferredLanguage")}
                value={preferredLanguage}
                options={LANGUAGE_OPTIONS.map((language) => ({
                  label: language.label,
                  value: language.value,
                }))}
                onChange={setPreferredLanguage}
                disabled={testMode || updateProfile.isPending}
              />

              <ProfileTextField
                label="Emergency Contact Name"
                value={emergencyContactName}
                onChangeText={setEmergencyContactName}
                editable={!testMode && !updateProfile.isPending}
                placeholder="Trusted person"
                maxLength={120}
              />

              <TouchableOpacity
                onPress={chooseEmergencyContact}
                disabled={testMode || updateProfile.isPending}
                activeOpacity={0.82}
                style={{
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: PRIMARY_LIGHT,
                  borderColor: PRIMARY_BORDER,
                  borderRadius: 999,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 7,
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                }}
              >
                <ContactRound size={ICON.sm} color={PRIMARY} />
                <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "800" }}>
                  Choose from contacts
                </Text>
              </TouchableOpacity>

              <IndianPhoneField
                label="Emergency Contact Phone"
                value={emergencyContactPhone}
                onChangeText={setEmergencyContactPhone}
                editable={!testMode && !updateProfile.isPending}
              />

              <ProfileTextField
                label="Accessibility or Mobility Needs"
                value={accessibilityNeeds}
                onChangeText={setAccessibilityNeeds}
                editable={!testMode && !updateProfile.isPending}
                placeholder="Extra boarding time, limited mobility, or communication preferences"
                maxLength={500}
                multiline
                helper="Optional. Do not include medical records."
              />

              <TouchableOpacity
                onPress={() => updateProfile.mutate()}
                disabled={testMode || updateProfile.isPending}
                style={{
                  borderRadius: 12,
                  backgroundColor: testMode ? "#BFD1D3" : PRIMARY,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: updateProfile.isPending ? 0.7 : 1,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Text>
              </TouchableOpacity>
            </View>
            ) : null}
          </View>
        </View>

        {/* Details */}
        <View style={{ margin: 16 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#F5F5F4",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#F5F5F4",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Phone size={ICON.sm} color={TEXT_SECONDARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Phone Number
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: TEXT,
                    marginTop: 2,
                    fontWeight: "500",
                  }}
                >
                  {testMode
                    ? "—"
                    : user?.phone
                      ? `+91 ${indianNationalNumber(user.phone)}`
                      : "Not added yet"}
                </Text>
              </View>
            </View>
            <MenuItem
              icon={Shield}
              label="Privacy & Safety"
              sublabel="Manage your safety settings"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            />
            <MenuItem
              icon={HelpCircle}
              label="Help & Support"
              sublabel="Get help with your rides"
              onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
            />
          </View>
        </View>

        {/* Exit test mode or Sign out */}
        <View style={{ marginHorizontal: 16, gap: 10 }}>
          {testMode ? (
            <TouchableOpacity
              onPress={handleExitTestMode}
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: "#FDE68A",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={ICON.sm} color="#B88700" />
              <Text
                style={{ color: "#B88700", fontSize: 15, fontWeight: "700" }}
              >
                Exit Test Mode → Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowSignOutSheet(true)}
              style={{
                backgroundColor: "#FEF2F2",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FECACA",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              activeOpacity={0.8}
            >
              <LogOut size={ICON.sm} color="#DC2626" />
              <Text
                style={{ color: "#DC2626", fontSize: 15, fontWeight: "700" }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <SignOutSheet
          visible={showSignOutSheet}
          onCancel={() => setShowSignOutSheet(false)}
          onConfirm={async () => {
            setShowSignOutSheet(false);
            try {
              await signOut();
            } catch {
              Alert.alert("Sign out", "You have been returned to the start screen.");
            }
          }}
        />

        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 28,
          }}
        >
          TukTukGo v1.0 - Made in India
        </Text>
      </ScrollView>
    </View>
  );
}

