import { useEffect, useState } from "react";
import { ChevronRight, Mail, Smartphone } from "lucide-react";
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
    <div className="min-h-screen bg-[#FFFBF5] font-inter text-[#1C1917]">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <main className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-[430px] flex-col justify-center px-5 py-8">
        <section className="mb-5 overflow-hidden rounded-[24px] border border-stone-800 bg-[#1C1917] text-white shadow-[0_20px_60px_rgba(28,25,23,0.22)]">
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F97316] shadow-[0_10px_24px_rgba(249,115,22,0.28)]">
                <img src="/auto-ride-icon.png" alt="Auto Ride" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-base font-extrabold tracking-normal">Auto Ride</div>
                <div className="text-xs font-semibold text-stone-400">Secunderabad pilot</div>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-normal text-stone-200">
              Single-zone
            </div>
          </div>

          <div className="px-5 pb-6 pt-7">
            <div className="relative h-24 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.06]">
              <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 390 110" fill="none">
                <path d="M-18 86C44 44 91 39 138 70C187 101 224 99 271 62C313 29 353 27 412 53" stroke="#FED7AA" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
                <path d="M-20 88C43 46 91 41 138 72C187 103 225 101 273 64C313 33 353 29 412 55" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 10" />
                <circle cx="74" cy="50" r="9" fill="#F97316" />
                <circle cx="74" cy="50" r="16" stroke="#F97316" strokeOpacity="0.22" strokeWidth="7" />
                <circle cx="299" cy="47" r="9" fill="#138808" />
                <circle cx="299" cy="47" r="16" stroke="#138808" strokeOpacity="0.22" strokeWidth="7" />
                <path d="M30 23h58M49 36h26M285 76h54M304 88h24" stroke="#FAFAF9" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
              </svg>
            </div>
            <h1 className="mt-5 text-[34px] font-extrabold leading-tight tracking-normal">
              Welcome back
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-stone-300">
              {adminIntent
                ? "Sign in with your existing account to enable first-admin access."
                : enableOtpVerification
                  ? "Use email password or phone OTP to continue."
                  : "Sign in with your email or phone and password."}
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white px-6 pb-6 pt-6 shadow-[0_18px_55px_rgba(28,25,23,0.10)]">
          {enableOtpVerification && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-[14px] border border-stone-200 bg-[#FFFBF5] p-1">
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
                  className={`flex items-center justify-center gap-2 rounded-[10px] py-2 text-sm font-extrabold transition ${
                    mode === id ? "bg-[#F97316] text-white shadow" : "text-stone-500"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3.5">
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
                    className="h-12 w-full rounded-[10px] border border-stone-200 bg-[#FFFBF5] px-3.5 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
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
                    className="h-12 w-full rounded-[10px] border border-stone-200 bg-[#FFFBF5] px-3.5 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
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
                      className="h-12 min-w-0 flex-1 rounded-[10px] border border-stone-200 bg-[#FFFBF5] px-3.5 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      placeholder="+91 99999 99999"
                      autoComplete="tel"
                      required
                    />
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={loading || !phone.trim()}
                      className="h-12 rounded-[10px] border border-orange-200 bg-orange-50 px-4 text-sm font-extrabold text-[#EA580C] disabled:opacity-50"
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
                    className="h-12 w-full rounded-[10px] border border-stone-200 bg-[#FFFBF5] px-3.5 text-center text-base font-extrabold tracking-normal text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
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
              className="group flex h-12 w-full items-center justify-center rounded-[10px] border-b-2 border-b-[#138808] bg-[#F97316] text-base font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)] transition hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? (
                <AutoRiderLoader label="Please wait" />
              ) : mode === "phone" ? (
                <>
                  Verify OTP
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
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
