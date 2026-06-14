import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Mail, ShieldCheck, Smartphone } from "lucide-react";
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
  const [configLoaded, setConfigLoaded] = useState(false);
  const adminIntent = getAdminIntent();

  const { signInWithCredentials, signInWithPhoneOtp } = useAuth();

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json())
      .then((config) => {
        const enabled = config.enableOtpVerification === true;
        setEnableOtpVerification(enabled);
        if (!enabled) setMode("email");
        setConfigLoaded(true);
      })
      .catch(() => {
        setEnableOtpVerification(false);
        setMode("email");
        setConfigLoaded(true);
      });
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
      window.location.href = result.url;
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputCls =
    "h-11 w-full border-b border-[#E7EFEF] bg-transparent text-sm font-semibold text-[#17272B] outline-none transition placeholder:text-[#CCD7D8] focus:border-[#43B8B3]";
  const labelCls = "sr-only";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#43B8B3] font-sans text-[#17272B]">
      <div className="pointer-events-none absolute left-8 top-24 h-5 w-20 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute left-0 top-[145px] h-4 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-10 top-28 h-5 w-20 rounded-full bg-white/10" />

      <main className="relative z-10 min-h-screen w-full">
        <motion.section
          className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#4BBEB8] via-[#43B8B3] to-[#339E9A]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
            <div className="absolute left-8 top-14 z-10 sm:left-[10%] sm:top-20">
              <h1 className="max-w-[180px] text-[36px] font-black leading-[1.08] tracking-normal text-white sm:text-[46px]">
                Welcome
                <span className="block">Back!</span>
              </h1>
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

            <div className="absolute bottom-[342px] left-1/2 z-20 h-[300px] w-[430px] -translate-x-[46%] overflow-visible sm:bottom-[382px] sm:h-[390px] sm:w-[560px]">
              <img
                src="/images/welcome-auto-rickshaw-transparent.png"
                alt="Auto rickshaw"
                className="h-full w-full object-contain drop-shadow-[0_24px_30px_rgba(23,39,43,0.18)]"
                draggable="false"
              />
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-30 min-h-[360px] rounded-t-[38px] bg-white px-7 pb-7 pt-8 text-[#17272B] shadow-[0_-24px_42px_rgba(23,39,43,0.10)] sm:left-1/2 sm:min-h-[380px] sm:max-w-[560px] sm:-translate-x-1/2 sm:rounded-t-[44px] sm:px-10">
              <h2 className="text-[30px] font-black leading-none tracking-normal">Sign In</h2>
              {adminIntent ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#43B8B3]/20 bg-[#43B8B3]/5 p-3 text-xs font-semibold text-slate-600">
                  <ShieldCheck size={14} className="text-[#43B8B3]" />
                  First-admin access will be enabled after login.
                </div>
              ) : null}

              <div className="mt-6">
          {!configLoaded ? (
            <div className="flex justify-center py-8">
              <AutoRiderLoader label="Loading..." />
            </div>
          ) : (
            <>
              {enableOtpVerification && (
                <div className="relative mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-[#D8E4E5] bg-[#F7FBFA] p-1">
                  <motion.div
                    className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-[#43B8B3] shadow-[0_8px_18px_rgba(67,184,179,0.22)]"
                    initial={false}
                    animate={{ left: mode === "email" ? 4 : "50%" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
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
                      className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-extrabold transition ${
                        mode === id ? "text-white" : "text-slate-500"
                      }`}
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3.5">
                <AnimatePresence mode="wait">
                  {mode === "email" || !enableOtpVerification ? (
                    <motion.div
                      key="email-mode"
                      className="space-y-3.5"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div>
                        <label className={labelCls}>Email or Mobile Number</label>
                        <input
                          type="text"
                          inputMode="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={inputCls}
                          placeholder="User Name"
                          autoComplete="username"
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
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
                          <input
                            type="tel"
                            inputMode="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              setOtpSent(false);
                            }}
                            className={`${inputCls} min-w-0 flex-1`}
                            placeholder="Mobile Number"
                            autoComplete="tel"
                            required
                          />
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
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                          placeholder="000000"
                          autoComplete="one-time-code"
                          required
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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

                <motion.button
                  type="submit"
                  disabled={loading || (mode === "phone" && enableOtpVerification && !otpSent)}
                  className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#43B8B3] text-base font-extrabold text-white shadow-[0_14px_26px_rgba(67,184,179,0.24)] transition hover:bg-[#339E9A] disabled:opacity-60"
                  whileTap={{ scale: 0.985 }}
                >
                  {loading ? (
                    <AutoRiderLoader size={32} label="Please wait" />
                  ) : (
                    <>
                      {mode === "phone" && enableOtpVerification ? "Verify OTP" : "Continue"}
                      <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </motion.button>

              </form>
            </>
          )}

          <p className="mt-5 text-center text-sm text-slate-500">
            New to Auto Ride?{" "}
            <a
              href={buildAuthLink("/account/signup", adminIntent ? "admin" : null)}
              className="font-extrabold text-[#43B8B3] hover:underline"
            >
              Create account
            </a>
          </p>
              </div>
            </div>
        </motion.section>
      </main>
    </div>
  );
}

export default SignInPage;
