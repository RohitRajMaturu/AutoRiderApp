import { useEffect, useState } from "react";
import { Mail, Smartphone } from "lucide-react";
import useAuth from "@/utils/useAuth";
import AutoRiderLoader from "@/components/AutoRiderLoader";

function getAdminIntent() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("role") === "admin";
}

function getCallbackUrl() {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  return params.get("callbackUrl") || params.get("finalCallbackUrl") || "/";
}

function buildAuthLink(path, role) {
  if (typeof window === "undefined") return path;
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  const callbackUrl = current.get("callbackUrl");
  const finalCallbackUrl = current.get("finalCallbackUrl");
  if (callbackUrl) params.set("callbackUrl", callbackUrl);
  if (finalCallbackUrl) params.set("finalCallbackUrl", finalCallbackUrl);
  if (role) params.set("role", role);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [enableOtpVerification, setEnableOtpVerification] = useState(false);
  const adminIntent = getAdminIntent();

  const { signInWithCredentials, signInWithPhoneOtp } = useAuth();

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json())
      .then((config) => {
        const enabled = config.enableOtpVerification === true;
        setEnableOtpVerification(enabled);
        if (!enabled) setMode("email");
      })
      .catch(() => setEnableOtpVerification(false));
  }, []);

  const requireAuthSuccess = (result, message) => {
    if (!result || result.error || !result.url) {
      throw new Error(message);
    }
    return result;
  };

  const maybeEnableAdmin = async () => {
    if (!adminIntent) return;
    const adminResponse = await fetch("/api/admin/setup", { method: "POST" });
    if (!adminResponse.ok) {
      const body = await adminResponse.json().catch(() => ({}));
      throw new Error(body.error || "Failed to enable admin access");
    }
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log("[signin] submitting", {
        mode,
        email,
        phone,
        adminIntent,
        enableOtpVerification,
      });
      const result =
        mode === "email" || !enableOtpVerification
          ? await signInWithCredentials({
              email: email.trim(),
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
        mode === "email" || !enableOtpVerification
          ? "Invalid email/phone or password"
          : "Invalid or expired OTP",
      );

      await maybeEnableAdmin();
      console.log("[signin] auth result", result);
      window.location.href = result.url;
    } catch (err) {
      console.error("[signin] failed", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] font-inter text-white">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <main className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-md flex-col justify-between px-6 pb-5 pt-8">
        <section className="flex flex-1 flex-col justify-center py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
                <img src="/auto-ride-icon.png" alt="Auto Ride" className="h-11 w-11 object-contain" />
              </div>
              <div>
                <div className="text-sm font-extrabold tracking-normal text-white">Auto Ride</div>
                <div className="text-xs font-semibold text-stone-400">Secunderabad pilot</div>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-stone-200">
              Single-zone
            </div>
          </div>

          <div className="relative mb-7 overflow-hidden rounded-[28px] border border-white/10 bg-[#292524] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
            <svg
              aria-hidden="true"
              className="h-40 w-full"
              viewBox="0 0 360 180"
              fill="none"
            >
              <path
                d="M16 126C74 78 132 72 190 108C239 138 285 127 342 84"
                stroke="#FED7AA"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="8 10"
                opacity="0.55"
              />
              <path
                d="M0 158H360"
                stroke="#57534E"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M42 158C78 134 112 122 151 122H238C276 122 306 134 337 158H42Z"
                fill="#1C1917"
              />
              <path
                d="M90 150h178"
                stroke="#F97316"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M101 103c5-26 25-43 56-43h54c28 0 50 18 56 45l7 33H94l7-35Z"
                fill="#F97316"
              />
              <path
                d="M128 102c5-16 18-26 36-26h38c18 0 31 10 37 26H128Z"
                fill="#FFF7ED"
                opacity="0.92"
              />
              <path
                d="M111 117h151c12 0 22 10 22 22v12H89v-12c0-12 10-22 22-22Z"
                fill="#EA580C"
              />
              <path
                d="M122 118h128"
                stroke="#FFF7ED"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.48"
              />
              <circle cx="128" cy="151" r="16" fill="#FAFAF9" />
              <circle cx="128" cy="151" r="7" fill="#292524" />
              <circle cx="245" cy="151" r="16" fill="#FAFAF9" />
              <circle cx="245" cy="151" r="7" fill="#292524" />
              <path
                d="M86 138h25M263 138h28"
                stroke="#FAFAF9"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.78"
              />
              <path
                d="M44 43h58M44 57h36M270 45h48M292 59h26"
                stroke="#A8A29E"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.34"
              />
              <circle cx="302" cy="92" r="10" fill="#138808" opacity="0.88" />
              <circle cx="69" cy="91" r="8" fill="#F97316" opacity="0.8" />
            </svg>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Fast login", "Live rides", "Fair fares"].map((item) => (
                <div
                  key={item}
                  className="rounded-[12px] border border-white/10 bg-white/[0.06] px-2 py-2 text-center text-[11px] font-extrabold text-stone-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <h1 className="text-[38px] font-extrabold leading-[1.02] tracking-normal text-white">
            Welcome back
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-stone-300">
            {adminIntent
              ? "Sign in with your existing account to enable first-admin access."
              : enableOtpVerification
                ? "Choose email password or phone OTP to continue."
                : "Sign in with your email or phone and password."}
          </p>
        </section>

        <section className="rounded-[28px] bg-white px-6 pb-7 pt-7 text-[#1C1917] shadow-2xl">
          {enableOtpVerification && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-[14px] border border-stone-200 bg-[#FFFBF5] p-1">
              {[
                { id: "email", label: "Email", Icon: Mail },
                { id: "phone", label: "Phone", Icon: Smartphone },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id);
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-[11px] py-2.5 text-sm font-extrabold transition ${
                    mode === id ? "bg-[#F97316] text-white shadow" : "text-stone-500"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "email" || !enableOtpVerification ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                    Email or Mobile Number
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-[15px] font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                    placeholder="name@example.com or +91 99999 99999"
                    autoComplete="username"
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
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                    Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setOtpSent(false);
                      }}
                      className="min-w-0 flex-1 rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-[15px] font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      placeholder="+91 99999 99999"
                      autoComplete="tel"
                      required
                    />
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={loading || !phone.trim()}
                      className="rounded-[14px] border border-orange-200 bg-orange-50 px-4 text-sm font-extrabold text-[#EA580C] disabled:opacity-50"
                    >
                      {otpSent ? "Resend" : "OTP"}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-normal text-stone-400">
                    OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-[14px] border border-stone-200 bg-[#FFFBF5] px-4 py-4 text-center text-[18px] font-extrabold tracking-[0.18em] text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                    placeholder="000000"
                    autoComplete="one-time-code"
                    required
                  />
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
              disabled={loading || (mode === "phone" && !otpSent)}
              className="w-full rounded-[14px] bg-[#F97316] py-[17px] text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? (
                <AutoRiderLoader label="Please wait" />
              ) : mode === "phone" ? (
                "Verify OTP"
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-stone-500">
            New to Auto Ride?{" "}
            <a
              href={buildAuthLink("/account/signup", adminIntent ? "admin" : null)}
              className="font-extrabold text-[#F97316]"
            >
              Create account
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

export default SignInPage;
