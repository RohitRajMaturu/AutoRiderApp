import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import useAuth from "@/utils/useAuth";
import TukTukGoLoader from "@/components/TukTukGoLoader";

const callouts = [
  {
    Icon: Activity,
    title: "Fleet telemetry",
    desc: "Live driver status, ride queues, and zone utilization.",
  },
  {
    Icon: BarChart2,
    title: "Revenue analytics",
    desc: "Fare trends, completion rates, and operating signals.",
  },
  {
    Icon: ShieldCheck,
    title: "Access controls",
    desc: "Driver approvals, force-offline controls, and audit history.",
  },
];

function getPortalFromUrl() {
  if (typeof window === "undefined") return "super";
  const params = new URLSearchParams(window.location.search);
  return params.get("portal") === "institution" || params.get("callbackUrl") === "/institution-admin"
    ? "institution"
    : "super";
}

function getAdminCallbackUrl(portal) {
  if (typeof window === "undefined") return portal === "institution" ? "/institution-admin" : "/admin";
  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
  const expectedPrefix = portal === "institution" ? "/institution-admin" : "/admin";
  return callbackUrl?.startsWith(expectedPrefix) ? callbackUrl : expectedPrefix;
}

export default function AdminLoginPage() {
  const { signInWithCredentials } = useAuth();
  const [portal, setPortal] = useState(getPortalFromUrl);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const callbackUrl = getAdminCallbackUrl(portal);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signInWithCredentials({
        email: identifier.trim(),
        password,
        callbackUrl,
        redirect: false,
      });
      if (!result || result.error || !result.url) {
        throw new Error(`Invalid ${portal === "institution" ? "institution admin" : "super admin"} credentials`);
      }
      window.location.href = result.url;
    } catch (err) {
      setError(err.message || "Could not sign in");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--ar-bg)] text-[var(--ar-t1)] lg:grid lg:grid-cols-2">
      <a
        href="/"
        aria-label="Back to TukTukGo home"
        className="absolute left-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ar-border)] bg-[var(--ar-s2)] text-[var(--ar-t1)] shadow-sm transition hover:border-[var(--ar-accent)]"
      >
        <ArrowLeft size={19} />
      </a>

      <section className="hidden min-h-screen flex-col justify-between bg-[var(--ar-s1)] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="/tuktukGo.png"
            alt="TukTukGo"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-xl font-semibold">TukTukGo</span>
        </div>

        <div className="max-w-md space-y-7">
          {callouts.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ar-accent-dim)] text-[var(--ar-accent)]">
                <Icon size={18} />
              </div>
              <div>
                <h2 className="text-sm font-medium text-[var(--ar-t1)]">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--ar-t2)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[var(--ar-t3)]">
          Operations Console · v2.0
        </p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-6 py-16 sm:px-10 lg:p-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/tuktukGo.png"
                alt="TukTukGo"
                className="h-9 w-9 rounded-lg object-cover"
              />
              <span className="text-lg font-semibold">TukTukGo</span>
            </div>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-[var(--ar-border)] bg-[var(--ar-s1)] p-1">
            {[
              ["super", "Super Admin"],
              ["institution", "Institution Admin"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setPortal(key); setError(""); }}
                className="rounded-lg px-3 py-2.5 text-xs font-bold transition"
                style={{
                  background: portal === key ? "var(--ar-accent)" : "transparent",
                  color: portal === key ? "var(--ar-bg)" : "var(--ar-t2)",
                }}
                aria-pressed={portal === key}
              >
                {label}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {portal === "institution" ? "Institution Admin sign in" : "Super Admin sign in"}
          </h1>
          <p className="mt-2 text-sm text-[var(--ar-t2)]">
            {portal === "institution"
              ? "Manage your institution's routes, members, trips, and invoices"
              : "TukTukGo Platform Operations Console"}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="sr-only">Email or mobile number</span>
              <div className="flex h-12 items-center gap-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-s2)] px-4">
                <Mail size={17} className="text-[var(--ar-t2)]" />
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Email or mobile number"
                  autoComplete="username"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--ar-t1)] placeholder:text-[var(--ar-t3)]"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="sr-only">Password</span>
              <div className="flex h-12 items-center gap-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-s2)] px-4">
                <Lock size={17} className="text-[var(--ar-t2)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--ar-t1)] placeholder:text-[var(--ar-t3)]"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-lg border border-[var(--ar-err)] bg-[var(--ar-err-dim)] px-4 py-3 text-sm font-semibold text-[var(--ar-err)]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--ar-accent)] text-sm font-black text-[var(--ar-bg)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? (
                <TukTukGoLoader size={32} label="Signing in" />
              ) : (
                <>
                  Continue to {portal === "institution" ? "Institution" : "Console"}
                  <ChevronRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
