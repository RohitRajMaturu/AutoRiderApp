import { useEffect, useState } from "react";
import useUser from "@/utils/useUser";
import TukTukGoLoader from "@/components/TukTukGoLoader";
import { ConceptBackdrop } from "@/components/ConceptVisuals";

function OnboardingPage() {
  const { data: user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLoading) return;

    const finalizeOnboarding = async () => {
      const pendingRole = localStorage.getItem("pending_role") || "passenger";
      const pendingPhone = localStorage.getItem("pending_phone") || "";
      const finalCallbackUrl = localStorage.getItem("pending_final_callback") || "/";

      try {
        const response = await fetch("/api/user-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: pendingRole === "admin" ? undefined : pendingRole,
            phone: pendingPhone,
          }),
        });

        if (!response.ok) throw new Error("Failed to update profile");

        if (pendingRole === "admin") {
          const adminResponse = await fetch("/api/admin/setup", {
            method: "POST",
          });
          if (!adminResponse.ok) {
            const body = await adminResponse.json().catch(() => ({}));
            throw new Error(body.error || "Failed to create admin account");
          }
        }

        // Cleanup
        localStorage.removeItem("pending_role");
        localStorage.removeItem("pending_phone");
        localStorage.removeItem("pending_final_callback");

        // Redirect based on role
        window.location.href = finalCallbackUrl;
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    if (user) {
      finalizeOnboarding();
    } else {
      // Session didn't propagate — redirect back to sign in
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

  if (loading || userLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
        <ConceptBackdrop />
        <div className="relative z-10 rounded-[24px] border border-white/80 bg-white/88 px-8 py-7 shadow-[0_22px_60px_rgba(23,39,43,0.12)] backdrop-blur">
          <TukTukGoLoader label="Completing account setup..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
        <ConceptBackdrop />
        <div className="relative z-10 flex max-w-sm flex-col items-center gap-4 rounded-[24px] border border-white/80 bg-white/88 px-8 py-7 text-center shadow-[0_22px_60px_rgba(23,39,43,0.12)] backdrop-blur">
          <TukTukGoLoader label="Setup needs attention" />
          <div className="text-sm font-semibold text-red-600">Error: {error}</div>
          <a
            href="/account/signin"
            className="rounded-[10px] bg-[#43B8B3] px-4 py-2 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(67,184,179,0.28)] transition hover:bg-[#339E9A]"
          >
            Go back
          </a>
        </div>
      </div>
    );
  }

  return null;
}

export default OnboardingPage;
