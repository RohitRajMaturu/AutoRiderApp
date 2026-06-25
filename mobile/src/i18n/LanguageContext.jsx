import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/utils/auth/useAuth";

const LANGUAGE_STORAGE_KEY = "tuktukgo-language";

export const LANGUAGE_OPTIONS = [
  { code: "en", value: "English", label: "English" },
  { code: "hi", value: "Hindi", label: "हिन्दी" },
  { code: "te", value: "Telugu", label: "తెలుగు" },
];

const translations = {
  en: {
    "common.loading": "Loading TukTukGo...",
    "common.saving": "Saving...",
    "common.agree": "I Agree",
    "common.privacy": "Open Privacy Policy",
    "nav.home": "Home",
    "nav.rides": "My Rides",
    "nav.profile": "Profile",
    "nav.dashboard": "Dashboard",
    "nav.subscription": "Subscription",
    "consent.title": "Data consent required",
    "consent.passenger":
      "To continue, please agree to TukTukGo collecting and storing your name and phone number to provide ride services, in line with the Privacy Policy.",
    "consent.driver":
      "To continue, please agree to TukTukGo collecting and storing your name, phone number, vehicle, and licence details to provide ride services, in line with the Privacy Policy.",
    "ride.finding": "Searching for drivers...",
    "ride.negotiating": "Negotiating fare - {{seconds}}s",
    "ride.driverComing": "Driver is on the way!",
    "ride.inProgress": "Trip in progress",
    "ride.completed": "Ride completed",
    "ride.badge.finding": "Finding Driver",
    "ride.badge.negotiating": "Negotiating",
    "ride.badge.accepted": "Accepted",
    "ride.badge.inProgress": "On Trip",
    "ride.badge.completed": "Completed",
    "ride.badge.cancelled": "Cancelled",
    "driver.online": "You're Online",
    "driver.offline": "You're Offline",
    "driver.nearbyRequests": "Nearby Requests",
    "driver.noRequests": "No requests yet",
    "profile.preferredLanguage": "Preferred Language",
  },
  hi: {
    "common.loading": "TukTukGo लोड हो रहा है...",
    "common.saving": "सेव हो रहा है...",
    "common.agree": "मैं सहमत हूँ",
    "common.privacy": "गोपनीयता नीति खोलें",
    "nav.home": "होम",
    "nav.rides": "मेरी राइड",
    "nav.profile": "प्रोफ़ाइल",
    "nav.dashboard": "डैशबोर्ड",
    "nav.subscription": "सब्सक्रिप्शन",
    "consent.title": "डेटा सहमति आवश्यक",
    "consent.passenger":
      "आगे बढ़ने के लिए, राइड सेवा देने हेतु TukTukGo को आपका नाम और फ़ोन नंबर सुरक्षित रखने की अनुमति दें।",
    "consent.driver":
      "आगे बढ़ने के लिए, राइड सेवा देने हेतु TukTukGo को आपका नाम, फ़ोन नंबर, वाहन और लाइसेंस विवरण सुरक्षित रखने की अनुमति दें।",
    "ride.finding": "ड्राइवर खोज रहे हैं...",
    "ride.negotiating": "किराया बातचीत - {{seconds}} सेकंड",
    "ride.driverComing": "ड्राइवर रास्ते में है!",
    "ride.inProgress": "यात्रा जारी है",
    "ride.completed": "राइड पूरी हुई",
    "ride.badge.finding": "ड्राइवर खोज",
    "ride.badge.negotiating": "बातचीत",
    "ride.badge.accepted": "स्वीकृत",
    "ride.badge.inProgress": "यात्रा में",
    "ride.badge.completed": "पूर्ण",
    "ride.badge.cancelled": "रद्द",
    "driver.online": "आप ऑनलाइन हैं",
    "driver.offline": "आप ऑफ़लाइन हैं",
    "driver.nearbyRequests": "पास की राइड",
    "driver.noRequests": "अभी कोई अनुरोध नहीं",
    "profile.preferredLanguage": "पसंदीदा भाषा",
  },
  te: {
    "common.loading": "TukTukGo లోడ్ అవుతోంది...",
    "common.saving": "సేవ్ అవుతోంది...",
    "common.agree": "నేను అంగీకరిస్తున్నాను",
    "common.privacy": "గోప్యతా విధానం తెరవండి",
    "nav.home": "హోమ్",
    "nav.rides": "నా రైడ్లు",
    "nav.profile": "ప్రొఫైల్",
    "nav.dashboard": "డ్యాష్‌బోర్డ్",
    "nav.subscription": "సబ్‌స్క్రిప్షన్",
    "consent.title": "డేటా సమ్మతి అవసరం",
    "consent.passenger":
      "కొనసాగడానికి, రైడ్ సేవల కోసం TukTukGo మీ పేరు మరియు ఫోన్ నంబర్‌ను భద్రపరచడానికి అనుమతించండి.",
    "consent.driver":
      "కొనసాగడానికి, రైడ్ సేవల కోసం TukTukGo మీ పేరు, ఫోన్ నంబర్, వాహనం మరియు లైసెన్స్ వివరాలను భద్రపరచడానికి అనుమతించండి.",
    "ride.finding": "డ్రైవర్లను వెతుకుతున్నాం...",
    "ride.negotiating": "చార్జీ చర్చ - {{seconds}} సెకన్లు",
    "ride.driverComing": "డ్రైవర్ వస్తున్నారు!",
    "ride.inProgress": "ప్రయాణం కొనసాగుతోంది",
    "ride.completed": "రైడ్ పూర్తైంది",
    "ride.badge.finding": "డ్రైవర్ కోసం",
    "ride.badge.negotiating": "చర్చ",
    "ride.badge.accepted": "అంగీకరించారు",
    "ride.badge.inProgress": "ప్రయాణంలో",
    "ride.badge.completed": "పూర్తైంది",
    "ride.badge.cancelled": "రద్దైంది",
    "driver.online": "మీరు ఆన్‌లైన్‌లో ఉన్నారు",
    "driver.offline": "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు",
    "driver.nearbyRequests": "సమీప రైడ్లు",
    "driver.noRequests": "ఇంకా అభ్యర్థనలు లేవు",
    "profile.preferredLanguage": "ఇష్టమైన భాష",
  },
};

export function normalizeLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["hi", "hindi", "हिन्दी", "हिंदी"].includes(normalized)) return "hi";
  if (["te", "telugu", "తెలుగు"].includes(normalized)) return "te";
  return "en";
}

export function languageProfileValue(code) {
  return LANGUAGE_OPTIONS.find((option) => option.code === code)?.value || "English";
}

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

function interpolate(value, params = {}) {
  return Object.entries(params).reduce(
    (text, [key, replacement]) =>
      text.replaceAll(`{{${key}}}`, String(replacement)),
    value,
  );
}

export function LanguageProvider({ children }) {
  const { auth } = useAuth();
  const [language, setLanguageState] = useState("en");
  const authUserKey =
    auth?.user?.id || auth?.user?.email || auth?.user?.phone || "anonymous";
  const { data } = useQuery({
    queryKey: ["userProfile", authUserKey],
    queryFn: async () => {
      const response = await fetch("/api/user-profile");
      if (!response.ok) throw new Error("Failed to load profile");
      return response.json();
    },
    enabled: !!auth,
    staleTime: 30_000,
  });

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored) setLanguageState(normalizeLanguage(stored));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const profileLanguage = data?.user?.preferred_language;
    if (profileLanguage) {
      const nextLanguage = normalizeLanguage(profileLanguage);
      setLanguageState(nextLanguage);
      AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => {});
    }
  }, [data?.user?.preferred_language]);

  const setLanguage = useCallback((value) => {
    const nextLanguage = normalizeLanguage(value);
    setLanguageState(nextLanguage);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => {});
  }, []);

  const t = useCallback(
    (key, params) =>
      interpolate(
        translations[language]?.[key] ?? translations.en[key] ?? key,
        params,
      ),
    [language],
  );

  const contextValue = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
