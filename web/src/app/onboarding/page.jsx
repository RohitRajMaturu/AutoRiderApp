import { useEffect, useMemo, useState } from "react";
import useUser from "@/utils/useUser";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { ConceptBackdrop } from "@/components/ConceptVisuals";

const LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Odia",
  "Punjabi",
  "Tamil",
  "Telugu",
  "Urdu",
];

const GENDER_OPTIONS = [
  { value: "", label: "Select (optional)" },
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "self_described", label: "Self-described" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const fieldClass =
  "w-full rounded-xl border border-[#D8E4E5] bg-white px-4 py-3 text-sm font-semibold text-[#17272B] outline-none transition focus:border-[#43B8B3] focus:ring-4 focus:ring-[#43B8B3]/10";

function parseIndianDate(dateOfBirth) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth || "");
  if (isoMatch) {
    const date = new Date(`${dateOfBirth}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : { date, isoDate: dateOfBirth };
  }
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
  return nationalNumber ? `+91${nationalNumber}` : null;
}

function dateForAge(age) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date.toISOString().slice(0, 10);
}

function OnboardingPage() {
  const { data: user, loading: userLoading } = useUser();
  const userId = user?.id;
  const userName = user?.name;
  const [pendingRole, setPendingRole] = useState(null);
  const [pendingPhone, setPendingPhone] = useState("");
  const [finalCallbackUrl, setFinalCallbackUrl] = useState("/");
  const [form, setForm] = useState({
    name: "",
    dateOfBirth: "",
    genderIdentity: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    preferredLanguage: "English",
    accessibilityNeeds: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canPickContact, setCanPickContact] = useState(false);
  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const clearPendingSignup = () => {
    localStorage.removeItem("pending_role");
    localStorage.removeItem("pending_phone");
    localStorage.removeItem("pending_final_callback");
  };

  const saveProfile = async (profile = {}, completeProfile = false) => {
    const response = await fetch("/api/user-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: pendingRole === "admin" ? undefined : pendingRole,
        phone: pendingPhone,
        ...profile,
        complete_profile: completeProfile,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Failed to update profile");
  };

  const finishSignup = async (profile = {}, completeProfile = false) => {
    setLoading(true);
    setError(null);
    try {
      await saveProfile(profile, completeProfile);

      if (pendingRole === "admin") {
        const adminResponse = await fetch("/api/admin/setup", { method: "POST" });
        if (!adminResponse.ok) {
          const body = await adminResponse.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create admin account");
        }
      }

      clearPendingSignup();
      window.location.href = finalCallbackUrl;
    } catch (err) {
      setError(err.message || "Unable to complete account setup");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      window.location.href = "/account/signin";
      return;
    }

    const role = localStorage.getItem("pending_role") || "passenger";
    const phone = localStorage.getItem("pending_phone") || "";
    const callback = localStorage.getItem("pending_final_callback") || "/";
    setPendingRole(role);
    setPendingPhone(phone);
    setFinalCallbackUrl(callback);
    setForm((current) => ({
      ...current,
      name: userName || "",
      emergencyContactPhone: "",
    }));

    if (role !== "passenger") {
      setLoading(true);
      const finalizeNonPassenger = async () => {
        try {
          const response = await fetch("/api/user-profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: role === "admin" ? undefined : role,
              phone,
            }),
          });
          if (!response.ok) throw new Error("Failed to update profile");

          if (role === "admin") {
            const adminResponse = await fetch("/api/admin/setup", { method: "POST" });
            if (!adminResponse.ok) {
              const body = await adminResponse.json().catch(() => ({}));
              throw new Error(body.error || "Failed to create admin account");
            }
          }

          clearPendingSignup();
          window.location.href = callback;
        } catch (err) {
          setError(err.message || "Unable to complete account setup");
          setLoading(false);
        }
      };
      finalizeNonPassenger();
    }
  }, [userId, userLoading, userName]);

  useEffect(() => {
    setCanPickContact(Boolean(window.ReactNativeWebView?.postMessage));
    const handleContact = (event) => {
      const detail = event.detail || {};
      setForm((current) => ({
        ...current,
        emergencyContactName: detail.name || current.emergencyContactName,
        emergencyContactPhone: indianNationalNumber(detail.phone),
      }));
    };
    window.addEventListener("TUKTUKGO_CONTACT_SELECTED", handleContact);
    return () => window.removeEventListener("TUKTUKGO_CONTACT_SELECTED", handleContact);
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!form.dateOfBirth) {
      setError("Please enter your date of birth");
      return;
    }
    if (age === null || age < 13 || age > 120) {
      setError("Please enter a valid date of birth");
      return;
    }
    if (
      (form.emergencyContactName.trim() && !form.emergencyContactPhone.trim()) ||
      (!form.emergencyContactName.trim() && form.emergencyContactPhone.trim())
    ) {
      setError("Add both an emergency contact name and phone number, or leave both blank");
      return;
    }
    if (form.emergencyContactPhone && indianNationalNumber(form.emergencyContactPhone).length !== 10) {
      setError("Please enter a valid 10-digit emergency contact number");
      return;
    }

    finishSignup(
      {
        name: form.name.trim(),
        date_of_birth: parseIndianDate(form.dateOfBirth)?.isoDate,
        gender_identity: form.genderIdentity || null,
        emergency_contact_name: form.emergencyContactName.trim() || null,
        emergency_contact_phone: indianPhonePayload(form.emergencyContactPhone),
        preferred_language: form.preferredLanguage,
        accessibility_needs: form.accessibilityNeeds.trim() || null,
      },
      true,
    );
  };

  if (userLoading || pendingRole === null || (pendingRole !== "passenger" && loading)) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
        <ConceptBackdrop />
        <div className="relative z-10 rounded-[24px] border border-white/80 bg-white/88 px-8 py-7 shadow-[0_22px_60px_rgba(23,39,43,0.12)] backdrop-blur">
          <TukTukGoLoader label="Completing account setup..." />
        </div>
      </div>
    );
  }

  if (pendingRole !== "passenger" && error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
        <ConceptBackdrop />
        <div className="relative z-10 max-w-sm rounded-[24px] bg-white p-8 text-center shadow-xl">
          <div className="text-sm font-semibold text-red-600">{error}</div>
          <a href="/account/signin" className="mt-5 inline-block rounded-xl bg-[#43B8B3] px-5 py-3 font-bold text-white">
            Go back
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#EAF0F1] px-4 py-8 font-inter text-[#17272B] sm:px-6">
      <ConceptBackdrop />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 mx-auto w-full max-w-2xl rounded-[28px] border border-white/80 bg-white/94 p-6 shadow-[0_24px_70px_rgba(23,39,43,0.14)] backdrop-blur sm:p-9"
      >
        <div className="mb-7">
          <div className="mb-3 inline-flex rounded-full bg-[#E7F6F4] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#339E9A]">
            Passenger profile
          </div>
          <h1 className="text-2xl font-black sm:text-3xl">A few details before your first ride</h1>
          <p className="mt-2 text-sm leading-6 text-[#586C70]">
            These details help personalize your experience and give you quick access to safety information. You can update them later in Account Settings.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Full name *</span>
            <input
              className={fieldClass}
              maxLength={120}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Date of birth *</span>
            <input
              className={fieldClass}
              type="date"
              lang="en-IN"
              min={dateForAge(120)}
              max={dateForAge(13)}
              value={form.dateOfBirth}
              onChange={(event) => updateField("dateOfBirth", event.target.value)}
              autoComplete="bday"
            />
            <span className="mt-1 block text-xs text-[#647678]">
              {age !== null && age >= 0 ? `Age: ${age} · DD/MM/YYYY` : "Choose your date (DD/MM/YYYY)"}
            </span>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Gender (optional)</span>
            <select
              className={`${fieldClass} h-12 appearance-auto`}
              value={form.genderIdentity}
              onChange={(event) => updateField("genderIdentity", event.target.value)}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Preferred language</span>
            <select
              className={`${fieldClass} h-12 appearance-auto`}
              value={form.preferredLanguage}
              onChange={(event) => updateField("preferredLanguage", event.target.value)}
            >
              {LANGUAGES.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>

          <div className="hidden sm:block" />

          <label>
            <span className="mb-2 block text-sm font-bold">Emergency contact name</span>
            <input
              className={fieldClass}
              maxLength={120}
              value={form.emergencyContactName}
              onChange={(event) => updateField("emergencyContactName", event.target.value)}
              placeholder="Trusted person"
              autoComplete="name"
            />
            {canPickContact ? (
              <button
                type="button"
                onClick={() =>
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: "PICK_EMERGENCY_CONTACT" }),
                  )
                }
                className="mt-2 inline-flex rounded-full border border-[#BFE5E0] bg-[#E7F6F4] px-3 py-2 text-xs font-extrabold text-[#339E9A]"
              >
                Choose from contacts
              </button>
            ) : null}
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Emergency contact phone</span>
            <div className="flex overflow-hidden rounded-xl border border-[#D8E4E5] bg-white focus-within:border-[#43B8B3] focus-within:ring-4 focus-within:ring-[#43B8B3]/10">
              <span className="flex items-center border-r border-[#D8E4E5] bg-[#F5F5F4] px-3 text-sm font-extrabold text-[#17272B]">
                +91
              </span>
              <input
                className="min-w-0 flex-1 bg-white px-4 py-3 text-sm font-semibold text-[#17272B] outline-none"
                maxLength={10}
                value={form.emergencyContactPhone}
                onChange={(event) => updateField("emergencyContactPhone", indianNationalNumber(event.target.value))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel-national"
              />
            </div>
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Accessibility or mobility needs</span>
            <textarea
              className={`${fieldClass} min-h-24 resize-y`}
              maxLength={500}
              value={form.accessibilityNeeds}
              onChange={(event) => updateField("accessibilityNeeds", event.target.value)}
              placeholder="For example: extra time to board, limited mobility, or communication preferences"
            />
            <span className="mt-1 block text-xs text-[#647678]">Optional. Do not include medical records.</span>
          </label>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-7 w-full rounded-xl bg-[#43B8B3] px-5 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(67,184,179,0.28)] transition hover:bg-[#339E9A] disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Saving your profile..." : "Save and continue"}
        </button>
      </form>
    </div>
  );
}

export default OnboardingPage;
