import useAuth from "@/utils/useAuth";
import { useEffect } from "react";

function LogoutPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({ callbackUrl: "/account/signin", redirect: true });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-inter">
      <div className="text-sm text-gray-500">Signing you out...</div>
    </div>
  );
}

export default LogoutPage;
