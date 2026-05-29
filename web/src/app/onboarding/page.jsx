import { useEffect, useState } from "react";
import useUser from "@/utils/useUser";

function OnboardingPage() {
  const { data: user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLoading) return;

    const finalizeOnboarding = async () => {
      const pendingRole = localStorage.getItem("pending_role") || "passenger";
      const pendingPhone = localStorage.getItem("pending_phone") || "";

      try {
        const response = await fetch("/api/user-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: pendingRole, phone: pendingPhone }),
        });

        if (!response.ok) throw new Error("Failed to update profile");

        // Cleanup
        localStorage.removeItem("pending_role");
        localStorage.removeItem("pending_phone");

        // Redirect based on role
        window.location.href = "/"; // Mobile auth flow will handle closing modal
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
        <div className="text-sm text-gray-500">Completing account setup...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-inter">
        <div className="text-sm text-red-500">Error: {error}</div>
      </div>
    );
  }

  return null;
}

export default OnboardingPage;
