import { useMemo, useState } from "react";
import useAuth from "@/utils/useAuth";

function getIdentifierKind(value) {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  if (trimmed.includes("@")) return "email";
  if (trimmed.replace(/\D/g, "").length >= 3) return "phone";
  return "text";
}

function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();
  const identifierKind = useMemo(
    () => getIdentifierKind(identifier),
    [identifier],
  );
  const label = identifierKind === "phone" ? "Mobile Number" : "Email";
  const inputMode = identifierKind === "phone" ? "tel" : "email";

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithCredentials({
        email: identifier.trim(),
        password,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] font-inter text-white">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <main className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-md flex-col justify-end px-5 pb-6 pt-12">
        <section className="mb-10">
          <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
            <span className="text-4xl">🛺</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal">
            Auto
            <br />
            <span className="text-[#F97316]">Connect</span>
          </h1>
          <p className="mt-4 text-base leading-6 text-stone-300">
            Welcome back. Sign in to book rides, accept requests, or manage your
            fleet.
          </p>
        </section>

        <section className="rounded-t-[32px] bg-white px-6 pb-7 pt-8 text-[#1C1917] shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-normal">
              Welcome Back
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Continue with your email or mobile number.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400">
                  {label}
                </label>
                {identifierKind !== "empty" && (
                  <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-bold text-[#EA580C]">
                    {identifierKind === "phone" ? "Number detected" : "Email detected"}
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode={inputMode}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-[#FFFBF5] px-4 py-3.5 text-base font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                placeholder="name@example.com or +91 99999 99999"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-[#FFFBF5] px-4 py-3.5 text-base font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#F97316] py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            New to Auto Ride?{" "}
            <a href="/account/signup" className="font-extrabold text-[#F97316]">
              Create account
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

export default SignInPage;
