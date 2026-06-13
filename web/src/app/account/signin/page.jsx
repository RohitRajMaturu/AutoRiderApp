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
      <main className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-md flex-col justify-end px-7 pb-5 pt-10">
        <section className="mb-8">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
            <img src="/auto-ride-icon.png" alt="Auto Ride" className="h-16 w-16 object-contain" />
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

        <section className="rounded-t-[32px] bg-white px-6 pb-7 pt-7 text-[#1C1917] shadow-2xl">
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
