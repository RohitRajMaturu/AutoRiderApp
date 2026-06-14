import { useEffect, useState } from "react";
import useUser from "@/utils/useUser";
import AutoRiderLoader from "@/components/AutoRiderLoader";

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
      // If no user, maybe session not ready yet
      setLoading(false);
    }
  }, [user, userLoading]);

  if (loading || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-inter">
        <AutoRiderLoader label="Completing account setup..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-inter">
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
          <AutoRiderLoader label="Setup needs attention" />
          <div className="text-sm font-semibold text-red-600">Error: {error}</div>
          <a
            href="/account/signin"
            className="rounded-[10px] bg-[#F97316] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#EA580C]"
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
