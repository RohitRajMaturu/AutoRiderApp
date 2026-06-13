import { useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import useAuth from "@/utils/useAuth";

function getInitialRole() {
  if (typeof window === "undefined") return "passenger";
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "admin" ? "admin" : "passenger";
}

function getFinalCallbackUrl() {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  return params.get("finalCallbackUrl") || params.get("callbackUrl") || "/";
}

function buildAuthLink(path, nextRole) {
  if (typeof window === "undefined") return path;
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  const callbackUrl = current.get("callbackUrl");
  const finalCallbackUrl = current.get("finalCallbackUrl");
  if (callbackUrl) params.set("callbackUrl", callbackUrl);
  if (finalCallbackUrl) params.set("finalCallbackUrl", finalCallbackUrl);
  if (nextRole) params.set("role", nextRole);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(getInitialRole);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [enableOtpVerification, setEnableOtpVerification] = useState(false);

  const { signUpWithCredentials } = useAuth();
  const isAdminSetup = role === "admin";
  const phoneEntered = phone.trim().length > 0;

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json())
      .then((config) => setEnableOtpVerification(config.enableOtpVerification === true))
      .catch(() => setEnableOtpVerification(false));
  }, []);

  const requireAuthSuccess = (result, message) => {
    if (!result || result.error || !result.url) {
      throw new Error(message);
    }
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
      if (!response.ok) {
        throw new Error(body.error || "Could not send OTP");
      }
      setOtpSent(true);
    } catch (err) {
      setError(err.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isAdminSetup) {
      localStorage.setItem("pending_role", role);
      localStorage.setItem("pending_phone", phone);
      localStorage.setItem("pending_final_callback", getFinalCallbackUrl());
    }

    try {
      await verifyOtp();

      console.log("[signup] submitting", {
        phone,
        email: email.trim().toLowerCase(),
        role,
        enableOtpVerification,
      });
      const result = await signUpWithCredentials({
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role,
        otp: enableOtpVerification ? otp : "",
        callbackUrl: enableOtpVerification && !isAdminSetup ? "/onboarding" : getFinalCallbackUrl(),
        redirect: false,
      });

      requireAuthSuccess(
        result,
        isAdminSetup
          ? "Admin registration failed. Check ADMIN_SETUP_PHONES and try again."
          : "Registration failed. Check the phone number and OTP.",
      );

      console.log("[signup] auth result", result);
      window.location.href = result.url;
    } catch (err) {
      console.error("[signup] failed", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] font-inter text-white">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <main className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-md flex-col justify-end px-7 pb-5 pt-10">
        <section className="mb-7">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
            <img src="/auto-ride-icon.png" alt="Auto Ride" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="text-[38px] font-extrabold leading-[1.02] tracking-normal text-white">
            {isAdminSetup ? "Create admin" : "Join Auto Ride"}
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-stone-300">
            {isAdminSetup
              ? "Create the first admin account with your real phone number."
              : "Set up your rider or driver account in under a minute."}
          </p>
        </section>

        <section className="rounded-t-[32px] bg-white px-6 pb-7 pt-7 text-[#1C1917] shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                Mobile Number
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setOtpSent(false);
                }}
                className="w-full rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-[15px] font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                placeholder="+91 99999 99999"
                autoComplete="tel"
                required
              />
            </div>

            {isAdminSetup ? (
              <div className="flex items-center gap-3 rounded-[16px] border border-orange-200 bg-[#FFF7ED] p-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#F97316] text-white">
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold text-stone-900">Admin setup</div>
                  <div className="mt-0.5 text-xs font-semibold leading-4 text-stone-500">
                    Restricted first-admin creation
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "passenger", label: "Passenger", Icon: UserRound },
                  { id: "driver", label: "Driver", emoji: "🛺" },
                ].map(({ id, label, Icon, emoji }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRole(id)}
                    className={`flex items-center justify-center gap-2 rounded-[14px] border px-3 py-3 text-sm font-extrabold transition ${
                      role === id
                        ? "border-[#F97316] bg-[#FFF7ED] text-[#EA580C] shadow-[0_8px_18px_rgba(249,115,22,0.12)]"
                        : "border-stone-200 bg-[#FFFBF5] text-stone-500"
                    }`}
                  >
                    {Icon ? <Icon size={17} /> : <span className="text-[17px] leading-none">{emoji}</span>}
                    {label}
                  </button>
                ))}
              </div>
            )}

            {phoneEntered && (
              <>
                {enableOtpVerification && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                      OTP Verification
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="min-w-0 flex-1 rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-center text-[17px] font-extrabold tracking-[0.16em] text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                        placeholder="000000"
                        autoComplete="one-time-code"
                        required
                      />
                      <button
                        type="button"
                        onClick={sendOtp}
                        disabled={loading || !phone.trim()}
                        className="rounded-[14px] border border-orange-200 bg-orange-50 px-4 text-sm font-extrabold text-[#EA580C] disabled:opacity-50"
                      >
                        {otpSent ? "Resend" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-[15px] font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-[15px] font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <p className="text-xs font-semibold text-stone-400">min 8 characters</p>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-[14px] border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phoneEntered}
              className="w-full rounded-[14px] border-b-[2px] border-b-[#138808] bg-[#F97316] py-[17px] text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? "Creating account..." : isAdminSetup ? "Create Admin" : "Create Account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <a
              href={buildAuthLink("/account/signin", isAdminSetup ? "admin" : null)}
              className="font-extrabold text-[#F97316]"
            >
              Sign in
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

export default SignUpPage;
