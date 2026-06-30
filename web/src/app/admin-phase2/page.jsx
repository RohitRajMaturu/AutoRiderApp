import Phase2Operations from "./page-content";
import { redirect } from "react-router";

export async function loader({ request }) {
  const { auth } = await import("@/auth");
  const session = await auth(request);
  if (!session?.user?.id || session.user.role !== "admin") {
    return redirect(`/admin-login?callbackUrl=${encodeURIComponent("/admin-phase2")}`);
  }
  return null;
}

export default function Page() {
  return <Phase2Operations />;
}
