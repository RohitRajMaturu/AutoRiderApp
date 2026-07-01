import { useEffect, useMemo, useState } from "react";
import { redirect } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import useAuth from "@/utils/useAuth";
import TukTukGoLoader from "@/components/TukTukGoLoader";

export function loader({ request }) {
  const url = new URL(request.url);
  const params = url.searchParams;
  if (params.get("client") === "mobile") {
    return null;
  }

  let changed = false;
  if (params.get("mode")) {
    params.delete("mode");
    changed = true;
  }
  if (params.get("role") !== "admin") {
    params.set("role", "admin");
    changed = true;
  }
  if (params.get("callbackUrl") !== "/admin") {
    params.set("callbackUrl", "/admin");
    changed = true;
  }
  if (params.get("finalCallbackUrl")) {
    params.delete("finalCallbackUrl");
    changed = true;
  }

  return changed ? redirect(`/account/signin?${params.toString()}`) : null;
}

function readParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function getCallbackUrl() {
  const params = readParams();
  // Mobile signup completes onboarding before returning to the token endpoint.
  return params.get("finalCallbackUrl") || params.get("callbackUrl") || "/";
}

function getInitialScreen() {
  const params = readParams();
  return params.get("mode") === "signup" && params.get("client") === "mobile"
    ? "signup"
    : "signin";
}

function getInitialRole() {
  const params = readParams();
  if (params.get("role") === "driver") return "driver";
  return params.get("role") === "admin" ? "admin" : "passenger";
}

function getPrivacyPolicyUrl() {
  return import.meta.env.VITE_PRIVACY_URL || "/privacy";
}

function updateAuthUrl(screen, role) {
  if (typeof window === "undefined") return;
  const params = readParams();
  if (screen === "signup" && params.get("client") === "mobile") {
    params.set("mode", "signup");
  } else {
    params.delete("mode");
  }
  if (role === "admin" || role === "driver") {
    params.set("role", role);
  } else {
    params.delete("role");
  }
  const query = params.toString();
  window.history.replaceState(null, "", `/account/signin${query ? `?${query}` : ""}`);
}

function AuthBackground({ title, children }) {
  const params = readParams();
  const isMobileClient = params.get("client") === "mobile";
  const isAndroidClient = isMobileClient && params.get("nativePlatform") === "android";

  useEffect(() => {
    if (!isAndroidClient || typeof window === "undefined") return undefined;
    const viewport = window.visualViewport;
    const updateViewportHeight = () => {
      const height = Math.round(viewport?.height || window.innerHeight);
      document.documentElement.style.setProperty("--auth-viewport-height", `${height}px`);
    };
    updateViewportHeight();
    viewport?.addEventListener("resize", updateViewportHeight);
    viewport?.addEventListener("scroll", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    return () => {
      viewport?.removeEventListener("resize", updateViewportHeight);
      viewport?.removeEventListener("scroll", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      document.documentElement.style.removeProperty("--auth-viewport-height");
    };
  }, [isAndroidClient]);

  return (
    <div
      className={`relative overflow-hidden bg-[#43B8B3] font-sans text-[#17272B] ${isAndroidClient ? "h-[var(--auth-viewport-height,100dvh)] min-h-0" : "min-h-screen"}`}
    >
      <div className="pointer-events-none absolute left-8 top-24 h-5 w-20 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute left-0 top-[145px] h-4 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-10 top-28 h-5 w-20 rounded-full bg-white/10" />

      <main className={`relative z-10 w-full ${isAndroidClient ? "h-full min-h-0" : "min-h-screen"}`}>
        <section className={`relative w-full overflow-hidden bg-gradient-to-br from-[#4BBEB8] via-[#43B8B3] to-[#339E9A] ${isAndroidClient ? "h-full min-h-0" : "min-h-screen"}`}>
          {!isMobileClient ? (
            <a
              href="/"
              aria-label="Back to TukTukGo home"
              className="absolute left-5 top-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/90 text-[#17272B] shadow-[0_10px_24px_rgba(23,39,43,0.16)] transition hover:bg-white sm:left-8 sm:top-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </a>
          ) : null}
          <div className="absolute left-8 top-14 z-10 sm:left-[10%] sm:top-20">
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                className="max-w-[240px] text-[36px] font-black leading-[1.08] tracking-normal text-white sm:text-[46px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
          </div>

          <div className="absolute left-9 top-[175px] h-5 w-16 rounded-full bg-white/10" />
          <div className="absolute left-2 top-[198px] h-4 w-24 rounded-full bg-white/10" />
          <div className="absolute right-7 top-[145px] h-5 w-16 rounded-full bg-white/10" />
          {[78, 174, 260].map((left, index) => (
            <div
              key={left}
              className="absolute h-3 w-7 border-t-2 border-[#2A817E]/55"
              style={{
                left: `${12 + index * 24}%`,
                top: 148 + index * 34,
                borderRadius: "50%",
                transform: `rotate(${index % 2 ? -9 : 8}deg)`,
              }}
            />
          ))}

          <div className="absolute bottom-[378px] left-1/2 z-20 h-[286px] w-[410px] -translate-x-[46%] overflow-visible sm:bottom-[418px] sm:h-[374px] sm:w-[540px]">
            <img
              src="/images/welcome-auto-rickshaw-transparent.png"
              alt="Auto rickshaw"
              className="h-full w-full object-contain drop-shadow-[0_24px_30px_rgba(23,39,43,0.18)]"
              draggable="false"
            />
          </div>

          <motion.div
            layout={!isAndroidClient}
            className="absolute bottom-0 left-0 right-0 z-30 max-h-[74vh] overflow-y-auto rounded-t-[38px] bg-white px-7 pb-7 pt-8 text-[#17272B] shadow-[0_-24px_42px_rgba(23,39,43,0.10)] sm:left-1/2 sm:max-w-[560px] sm:-translate-x-1/2 sm:rounded-t-[44px] sm:px-10"
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
          >
            {children}
          </motion.div>
        </section>
      </main>
    </div>
  );
}

export default function SignInPage() {
  const [screen, setScreen] = useState(getInitialScreen);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState("password");
  const [identifierMode, setIdentifierMode] = useState("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState(getInitialRole);
  const [enableOtpVerification, setEnableOtpVerification] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const allowSignup = readParams().get("client") === "mobile";

  const { signInWithCredentials, signInWithPhoneOtp, signUpWithCredentials } =
    useAuth();

  const isAdminSetup = role === "admin";
  const title = useMemo(() => {
    if (screen === "signin") {
      if (!allowSignup) return "Admin Login";
      if (role === "driver") return "Driver Login";
      if (role === "admin") return "Admin Login";
      return "Passenger Login";
    }
    return isAdminSetup ? "Create Admin" : "Create Account";
  }, [allowSignup, isAdminSetup, role, screen]);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json())
      .then((config) => {
        const enabled = config.enableOtpVerification === true;
        setEnableOtpVerification(enabled);
        setLoginMode(enabled ? "password" : "password");
        setConfigLoaded(true);
      })
      .catch(() => {
        setEnableOtpVerification(false);
        setLoginMode("password");
        setConfigLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!allowSignup && screen === "signup") {
      setScreen("signin");
      return;
    }
    updateAuthUrl(screen, role);
    setError(null);
    setConsentGiven(false);
  }, [allowSignup, role, screen]);

  const requireAuthSuccess = (result, fallbackMessage) => {
    if (!result) throw new Error(fallbackMessage);
    if (result.error) {
      throw new Error(result.error === "CredentialsSignin" ? fallbackMessage : result.error);
    }
    if (!result.url) throw new Error(fallbackMessage);
    return result;
  };

  const sendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not send OTP");
      setOtpSent(true);
    } catch (err) {
      setError(err.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifySignupOtp = async () => {
    if (!enableOtpVerification) return;
    const response = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.verified) {
      throw new Error(body.error || "Verify your OTP before creating the account");
    }
  };

  const onSignIn = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result =
        loginMode === "password" || !enableOtpVerification
          ? await signInWithCredentials({
              email: identifier.trim(),
              password,
              callbackUrl: getCallbackUrl(),
              redirect: false,
            })
          : await signInWithPhoneOtp({
              phone: phone.trim(),
              otp,
              callbackUrl: getCallbackUrl(),
              redirect: false,
            });

      requireAuthSuccess(
        result,
        loginMode === "password" || !enableOtpVerification
          ? "Invalid email/phone or password"
          : "Invalid or expired OTP",
      );

      window.location.href = result.url;
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const onSignUp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await verifySignupOtp();
      const result = await signUpWithCredentials({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        phone: phone.trim(),
        role,
        otp: enableOtpVerification ? otp : "",
        dataConsentGiven: isAdminSetup ? "false" : String(consentGiven),
        dataConsentAt: consentGiven ? new Date().toISOString() : "",
        dataConsentVersion: "v1",
        callbackUrl: !isAdminSetup ? "/onboarding" : getCallbackUrl(),
        redirect: false,
      });

      requireAuthSuccess(
        result,
        isAdminSetup
          ? "Admin registration failed. Check ADMIN_SETUP_PHONES and try again."
          : "Registration failed. Check the phone number and OTP.",
      );

      if (!isAdminSetup) {
        localStorage.setItem("pending_role", role);
        localStorage.setItem("pending_phone", phone);
        localStorage.setItem("pending_final_callback", getCallbackUrl());
      }

      window.location.href = result.url;
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputCls =
    "h-12 w-full min-w-0 rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] px-4 text-sm font-semibold text-[#17272B] outline-none transition placeholder:text-[#9EADAF] focus:border-[#43B8B3] focus:bg-white focus:ring-2 focus:ring-[#43B8B3]/15";
  const phoneInputCls =
    "h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[#17272B] outline-none placeholder:text-[#9EADAF]";
  const labelCls = "sr-only";

  return (
    <AuthBackground title={title}>
      <AnimatePresence mode="wait">
        {screen === "signin" ? (
          <motion.div
            key="signin-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <h2 className="text-[30px] font-black leading-none tracking-normal">
              Sign In
            </h2>
            <div className="mt-6">
              {!configLoaded ? (
                <div className="flex justify-center py-8">
                  <TukTukGoLoader label="Loading..." />
                </div>
              ) : (
                <>
                  {enableOtpVerification && (
                    <div className="relative mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] p-1">
                      <motion.div
                        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-[#43B8B3] shadow-[0_8px_18px_rgba(67,184,179,0.22)]"
                        initial={false}
                        animate={{ left: loginMode === "phone" ? "50%" : 4 }}
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                      {[
                        { id: "password", label: "Password", Icon: Mail },
                        { id: "phone", label: "Phone OTP", Icon: Smartphone },
                      ].map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setLoginMode(id);
                            setError(null);
                          }}
                          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-extrabold transition ${
                            loginMode === id ? "text-white" : "text-slate-500"
                          }`}
                        >
                          <Icon size={15} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={onSignIn} className="space-y-3.5">
                    <AnimatePresence mode="wait">
                      {loginMode === "password" || !enableOtpVerification ? (
                        <motion.div
                          key="password-mode"
                          className="space-y-3.5"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] p-1">
                            {[
                              { id: "phone", label: "Mobile" },
                              { id: "email", label: "Email" },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setIdentifierMode(item.id);
                                  setIdentifier("");
                                  setError(null);
                                }}
                                className={`h-9 rounded-xl text-sm font-extrabold transition ${
                                  identifierMode === item.id
                                    ? "bg-[#43B8B3] text-white shadow-[0_6px_14px_rgba(67,184,179,0.2)]"
                                    : "text-slate-500"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          <div>
                            <label className={labelCls}>
                              {identifierMode === "phone" ? "Mobile Number" : "Email"}
                            </label>
                            {identifierMode === "phone" ? (
                              <div className="flex h-12 overflow-hidden rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] transition focus-within:border-[#43B8B3] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#43B8B3]/15">
                                <span className="flex shrink-0 items-center border-r border-[#D8E4E5] bg-[#EDF5F4] px-3 text-sm font-extrabold text-[#286B68]">
                                  +91
                                </span>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  value={identifier}
                                  onChange={(event) =>
                                    setIdentifier(
                                      event.target.value.replace(/\D/g, "").slice(0, 10),
                                    )
                                  }
                                  className={phoneInputCls}
                                  placeholder="10-digit mobile number"
                                  autoComplete="tel"
                                  maxLength={10}
                                  required
                                />
                              </div>
                            ) : (
                              <input
                                type="email"
                                inputMode="email"
                                value={identifier}
                                onChange={(event) => setIdentifier(event.target.value)}
                                className={inputCls}
                                placeholder="name@example.com"
                                autoComplete="username"
                                required
                              />
                            )}
                          </div>
                          <div>
                            <label className={labelCls}>Password</label>
                            <input
                              type="password"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              className={inputCls}
                              placeholder="Password"
                              autoComplete="current-password"
                              required
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="phone-mode"
                          className="space-y-3.5"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div>
                            <label className={labelCls}>Mobile Number</label>
                            <div className="flex gap-2">
                              <div className="flex h-12 min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] transition focus-within:border-[#43B8B3] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#43B8B3]/15">
                                <span className="flex shrink-0 items-center border-r border-[#D8E4E5] bg-[#EDF5F4] px-3 text-sm font-extrabold text-[#286B68]">
                                  +91
                                </span>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  value={phone}
                                  onChange={(event) => {
                                    setPhone(
                                      event.target.value.replace(/\D/g, "").slice(0, 10),
                                    );
                                    setOtpSent(false);
                                  }}
                                  className={phoneInputCls}
                                  placeholder="10-digit mobile number"
                                  autoComplete="tel"
                                  maxLength={10}
                                  required
                                />
                              </div>
                              <button
                                type="button"
                                onClick={sendOtp}
                                disabled={loading || !phone.trim()}
                                className="h-11 rounded-2xl border border-[#43B8B3]/40 bg-[#43B8B3]/10 px-4 text-sm font-extrabold text-[#278E8C] transition hover:bg-[#43B8B3]/15 disabled:opacity-50"
                              >
                                {otpSent ? "Resend" : "OTP"}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className={labelCls}>One-time Password</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={otp}
                              onChange={(event) =>
                                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                              }
                              className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                              placeholder="000000"
                              autoComplete="one-time-code"
                              required
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AuthError error={error} />

                    <motion.button
                      type="submit"
                      disabled={loading || (loginMode === "phone" && enableOtpVerification && !otpSent)}
                      className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#43B8B3] text-base font-extrabold text-white shadow-[0_14px_26px_rgba(67,184,179,0.24)] transition hover:bg-[#339E9A] disabled:opacity-60"
                      whileTap={{ scale: 0.985 }}
                    >
                      {loading ? (
                        <TukTukGoLoader size={32} label="Please wait" />
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </motion.button>
                  </form>
                </>
              )}
              {allowSignup ? (
                <p className="mt-5 text-center text-sm text-slate-500">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setScreen("signup")}
                    className="font-extrabold text-[#43B8B3] hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              ) : (
                <p className="mt-5 text-center text-sm text-slate-500">
                  Web access is restricted to admin sign in.
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="signup-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <h2 className="text-[30px] font-black leading-none tracking-normal">
              {isAdminSetup ? "Admin Setup" : "Create Account"}
            </h2>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              {isAdminSetup
                ? "Create the first admin account with your real phone number."
                : "Set up your passenger or driver account."}
            </p>

            <div className="mt-6">
              {!configLoaded ? (
                <div className="flex justify-center py-8">
                  <TukTukGoLoader label="Loading..." />
                </div>
              ) : (
                <form onSubmit={onSignUp} className="space-y-3.5">
                  <div>
                    <label className={labelCls}>Mobile Number</label>
                    <div className="flex h-12 overflow-hidden rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] transition focus-within:border-[#43B8B3] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#43B8B3]/15">
                      <span className="flex shrink-0 items-center border-r border-[#D8E4E5] bg-[#EDF5F4] px-3 text-sm font-extrabold text-[#286B68]">
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(event) => {
                          setPhone(
                            event.target.value.replace(/\D/g, "").slice(0, 10),
                          );
                          setOtpSent(false);
                        }}
                        className={phoneInputCls}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>

                  {isAdminSetup ? (
                    <div className="flex items-center gap-3 rounded-[16px] border border-[#43B8B3]/30 bg-[#43B8B3]/10 p-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#43B8B3] text-white">
                        <ShieldCheck size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-[#17272B]">
                          Admin setup
                        </div>
                        <div className="mt-0.5 text-xs font-semibold leading-4 text-slate-500">
                          Restricted first-admin creation
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative grid grid-cols-2 gap-1 rounded-[16px] border border-[#D8E4E5] bg-[#F7FBFA] p-1">
                      <motion.div
                        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-[12px] bg-[#43B8B3] shadow-[0_8px_18px_rgba(67,184,179,0.22)]"
                        initial={false}
                        animate={{ left: role === "passenger" ? 4 : "50%" }}
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                      {[
                        { id: "passenger", label: "Passenger", Icon: UserRound },
                        { id: "driver", label: "Driver", Icon: null },
                      ].map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setRole(id)}
                          className={`relative z-10 flex h-11 items-center justify-center gap-2 rounded-[10px] text-sm font-extrabold transition ${
                            role === id ? "text-white" : "text-slate-500"
                          }`}
                        >
                          {Icon ? <Icon size={16} /> : <span className="text-base">Auto</span>}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {enableOtpVerification && (
                    <div className="space-y-1.5 pt-1">
                      <label className={labelCls}>OTP Verification</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otp}
                          onChange={(event) =>
                            setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          className={`${inputCls} min-w-0 flex-1 text-center text-lg tracking-[0.5em]`}
                          placeholder="000000"
                          autoComplete="one-time-code"
                          required
                        />
                        <button
                          type="button"
                          onClick={sendOtp}
                          disabled={loading || !phone.trim()}
                          className="h-11 rounded-2xl border border-[#43B8B3]/40 bg-[#43B8B3]/10 px-4 text-sm font-extrabold text-[#278E8C] transition hover:bg-[#43B8B3]/15 disabled:opacity-50"
                        >
                          {otpSent ? "Resend" : "Send"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(event) => setSignupEmail(event.target.value)}
                      className={inputCls}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Password</label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(event) => setSignupPassword(event.target.value)}
                      className={inputCls}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <p className="text-[11px] font-semibold text-slate-500">
                      min 8 characters
                    </p>
                  </div>

                  {!isAdminSetup ? (
                    <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-[#D8E4E5] bg-[#F7FBFA] p-3.5">
                      <input
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(event) => setConsentGiven(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[#BFD1D3] accent-[#43B8B3]"
                      />
                      <span className="text-xs font-semibold leading-5 text-slate-500">
                        I agree to TukTukGo collecting and storing my{" "}
                        {role === "driver"
                          ? "name, phone number, vehicle, and licence details"
                          : "name and phone number"}{" "}
                        to provide ride services, in line with the{" "}
                        <a
                          href={getPrivacyPolicyUrl()}
                          target="_blank"
                          rel="noreferrer"
                          className="font-extrabold text-[#43B8B3] hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                  ) : null}

                  <AuthError error={error} />

                  <motion.button
                    type="submit"
                    disabled={loading || !phone.trim() || (!isAdminSetup && !consentGiven)}
                    className="group flex h-12 w-full items-center justify-center rounded-2xl bg-[#43B8B3] text-base font-extrabold text-white shadow-[0_14px_26px_rgba(67,184,179,0.24)] transition hover:bg-[#339E9A] disabled:opacity-60"
                    whileTap={{ scale: 0.985 }}
                  >
                    {loading ? (
                      <TukTukGoLoader size={32} label="Creating account" />
                    ) : (
                      <>
                        {isAdminSetup ? "Create Admin" : "Create Account"}
                        <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </motion.button>
                </form>
              )}

              <p className="mt-5 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setScreen("signin")}
                  className="font-extrabold text-[#43B8B3] hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthBackground>
  );
}

function AuthError({ error }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="rounded-[14px] border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
