import { useState } from "react";
import useAuth from "@/utils/useAuth";

function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithCredentials({
        email,
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
    <div className="flex min-h-screen items-center justify-center bg-white p-4 font-inter">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <a
            href="/account/signup"
            className="font-medium text-blue-600 hover:underline"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignInPage;
