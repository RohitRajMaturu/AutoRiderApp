import { useCallback, useEffect, useState } from "react";

const LOGOUT_GUARD_KEY = "tuktukgo:admin-logout-pending";

export function clearLogoutBackGuard() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(LOGOUT_GUARD_KEY);
  }
}

export function useLogoutBackGuard(loginUrl) {
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const redirectCachedPage = () => {
      if (window.sessionStorage.getItem(LOGOUT_GUARD_KEY) === "1") {
        setSigningOut(true);
        window.location.replace(loginUrl);
      }
    };

    redirectCachedPage();
    window.addEventListener("pageshow", redirectCachedPage);
    return () => window.removeEventListener("pageshow", redirectCachedPage);
  }, [loginUrl]);

  const beginLogout = useCallback((event) => {
    event.preventDefault();
    const logoutUrl = event.currentTarget.href;
    window.sessionStorage.setItem(LOGOUT_GUARD_KEY, "1");
    setSigningOut(true);
    window.requestAnimationFrame(() => window.location.assign(logoutUrl));
  }, []);

  return { signingOut, beginLogout };
}
