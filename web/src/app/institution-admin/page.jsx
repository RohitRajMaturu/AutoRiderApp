import InstitutionAdminDashboard from "./page-content";
import { redirect } from "react-router";

export async function loader({ request }) {
  const { auth } = await import("@/auth");
  const session = await auth(request);
  if (!session?.user?.id || session.user.role !== "institution_admin") {
    return redirect(`/institution-login?callbackUrl=${encodeURIComponent("/institution-admin")}`);
  }
  return null;
}

export default function InstitutionAdminPage() {
  return <InstitutionAdminDashboard />;
}
