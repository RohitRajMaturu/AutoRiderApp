import { useState } from "react";
import useAuth from "@/utils/useAuth";

function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("passenger");
  const [phone, setPhone] = useState("");

  const { signUpWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    localStorage.setItem("pending_role", role);
    localStorage.setItem("pending_phone", phone);

    try {
      await signUpWithCredentials({
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: "/onboarding",
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
        <section className="mb-8">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#F97316] p-4 shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
            <span className="text-4xl">🛺</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal">
            Join
            <br />
            <span className="text-[#F97316]">Auto Ride</span>
          </h1>
          <p className="mt-4 text-base leading-6 text-stone-300">
            Create your account to start riding or earning with local auto
            requests.
          </p>
        </section>

        <section className="rounded-t-[32px] bg-white px-6 pb-7 pt-8 text-[#1C1917] shadow-2xl">
          <div className="mb-5 flex gap-2 rounded-2xl border border-stone-200 bg-[#FFFBF5] p-1.5">
            {["passenger", "driver"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold capitalize transition ${
                  role === value
                    ? "bg-[#F97316] text-white shadow"
                    : "text-stone-500"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400">
                Mobile Number
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-[#FFFBF5] px-4 py-3.5 text-base font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                placeholder="+91 99999 99999"
                autoComplete="tel"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-[#FFFBF5] px-4 py-3.5 text-base font-semibold text-stone-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                placeholder="name@example.com"
                autoComplete="email"
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
                placeholder="Create a password"
                autoComplete="new-password"
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
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <a href="/account/signin" className="font-extrabold text-[#F97316]">
              Sign in
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

export default SignUpPage;
