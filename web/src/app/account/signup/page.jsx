import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import useAuth from "@/utils/useAuth";
import AutoRiderLoader from "@/components/AutoRiderLoader";

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
  const [configLoaded, setConfigLoaded] = useState(false);

  const { signUpWithCredentials } = useAuth();
  const isAdminSetup = role === "admin";
  const phoneEntered = phone.trim().length > 0;

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json())
      .then((config) => {
        setEnableOtpVerification(config.enableOtpVerification === true);
        setConfigLoaded(true);
      })
      .catch(() => {
        setEnableOtpVerification(false);
        setConfigLoaded(true);
      });
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
      const result = await signUpWithCredentials({
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role,
        otp: enableOtpVerification ? otp : "",
        callbackUrl: !isAdminSetup ? "/onboarding" : getFinalCallbackUrl(),
        redirect: false,
      });

      requireAuthSuccess(
        result,
        isAdminSetup
          ? "Admin registration failed. Check ADMIN_SETUP_PHONES and try again."
          : "Registration failed. Check the phone number and OTP.",
      );

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
            <h1 className="max-w-[240px] text-[36px] font-black leading-[1.08] tracking-normal text-white sm:text-[46px]">
              {isAdminSetup ? "Create Admin" : "Create Account"}
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

          <div className="absolute bottom-[438px] left-1/2 z-20 h-[260px] w-[380px] -translate-x-[46%] overflow-visible sm:bottom-[478px] sm:h-[350px] sm:w-[510px]">
            <img
              src="/images/welcome-auto-rickshaw-transparent.png"
              alt="Auto rickshaw"
              className="h-full w-full object-contain drop-shadow-[0_24px_30px_rgba(23,39,43,0.18)]"
              draggable="false"
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[72vh] overflow-y-auto rounded-t-[38px] bg-white px-7 pb-7 pt-8 text-[#17272B] shadow-[0_-24px_42px_rgba(23,39,43,0.10)] sm:left-1/2 sm:max-w-[560px] sm:-translate-x-1/2 sm:rounded-t-[44px] sm:px-10">
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
              <AutoRiderLoader label="Loading..." />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3.5">
              <div>
                <label className={labelCls}>Mobile Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setOtpSent(false);
                  }}
                  className={inputCls}
                  placeholder="Mobile Number"
                  autoComplete="tel"
                  required
                />
              </div>

              {isAdminSetup ? (
                <div className="flex items-center gap-3 rounded-[16px] border border-[#43B8B3]/30 bg-[#43B8B3]/10 p-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#43B8B3] text-white">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-[#17272B]">Admin setup</div>
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
                      {Icon ? <Icon size={16} /> : <span className="text-base">🛺</span>}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {phoneEntered && (
                  <motion.div
                    className="space-y-3.5 overflow-hidden"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {enableOtpVerification && (
                      <div className="space-y-1.5 pt-1">
                        <label className={labelCls}>OTP Verification</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                      <p className="text-[11px] font-semibold text-slate-500">min 8 characters</p>
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
                disabled={loading || !phoneEntered}
                className="group flex h-12 w-full items-center justify-center rounded-2xl bg-[#43B8B3] text-base font-extrabold text-white shadow-[0_14px_26px_rgba(67,184,179,0.24)] transition hover:bg-[#339E9A] disabled:opacity-60"
                whileTap={{ scale: 0.985 }}
              >
                {loading ? (
                  <AutoRiderLoader size={32} label="Creating account" />
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
            <a
              href={buildAuthLink("/account/signin", isAdminSetup ? "admin" : null)}
              className="font-extrabold text-[#43B8B3] hover:underline"
            >
              Sign in
            </a>
          </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

export default SignUpPage;
