import useAuth from "@/utils/useAuth";
import { useEffect } from "react";
import AutoRiderLoader from "@/components/AutoRiderLoader";
import { ConceptBackdrop } from "@/components/ConceptVisuals";

function LogoutPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({ callbackUrl: "/account/signin", redirect: true });
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EAF0F1] px-6 font-inter text-[#17272B]">
      <ConceptBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-3 rounded-[24px] border border-white/80 bg-white/88 px-8 py-7 text-center shadow-[0_22px_60px_rgba(23,39,43,0.12)] backdrop-blur">
        <AutoRiderLoader label="Signing you out..." />
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#43B8B3]">
          Auto Ride
        </p>
      </div>
    </div>
  );
}

export default LogoutPage;
