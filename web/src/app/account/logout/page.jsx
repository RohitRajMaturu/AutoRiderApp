import useAuth from "@/utils/useAuth";
import useUser from "@/utils/useUser";
import { useEffect, useRef, useState } from "react";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { ConceptBackdrop } from "@/components/ConceptVisuals";

function getLogoutCallbackUrl(userRole) {
  if (typeof window === "undefined") return "/account/signin";
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (next && next.startsWith("/")) return next;

  const signinParams = new URLSearchParams();
  for (const key of ["callbackUrl", "finalCallbackUrl", "mode", "role"]) {
    const value = params.get(key);
    if (value) signinParams.set(key, value);
  }

  const requestedRole = signinParams.get("role");
  const base = userRole === "admin" || requestedRole === "admin"
    ? "/admin-login"
    : "/account/signin";
  const query = signinParams.toString();
  return `${base}${query ? `?${query}` : ""}`;
}

function LogoutPage() {
  const { signOut } = useAuth();
  const { user, data } = useUser();
  const hasStarted = useRef(false);
  const [failed, setFailed] = useState(false);
  const userRole = user?.role || data?.role;

  useEffect(() => {
    if (hasStarted.current) return undefined;
    hasStarted.current = true;

    let settled = false;
    const target = getLogoutCallbackUrl(userRole);

    const fallbackTimer = setTimeout(() => {
      if (!settled && typeof window !== "undefined") {
        settled = true;
        window.location.href = target;
      }
    }, 4000);

    signOut({ callbackUrl: target, redirect: true })
      .catch((err) => {
        console.error("Sign-out failed:", err);
        settled = true;
        clearTimeout(fallbackTimer);
        setFailed(true);
        if (typeof window !== "undefined") {
          window.location.href = target;
        }
      });

    return () => clearTimeout(fallbackTimer);
  }, [signOut, userRole]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
      <ConceptBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-3 rounded-[24px] border border-white/80 bg-white/88 px-8 py-7 text-center shadow-[0_22px_60px_rgba(23,39,43,0.12)] backdrop-blur">
        <TukTukGoLoader label={failed ? "Redirecting..." : "Signing you out..."} />
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#43B8B3]">
          TukTukGo
        </p>
      </div>
    </div>
  );
}

export default LogoutPage;
