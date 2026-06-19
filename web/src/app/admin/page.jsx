import { lazy, Suspense } from "react";
import { redirect } from "react-router";

const AdminPageContent = lazy(() => import("./page-content.jsx"));

export async function loader({ request }) {
  const [{ auth }, { default: sql }] = await Promise.all([
    import("@/auth"),
    import("@/app/api/utils/sql"),
  ]);
  const session = await auth(request);
  const signinUrl = `/admin-login?callbackUrl=${encodeURIComponent(
    "/admin",
  )}`;

  if (!session?.user?.id) {
    return redirect(signinUrl);
  }

  const rows = await sql`
    SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") {
    return redirect(signinUrl);
  }

  return null;
}

function AdminRouteFallback() {
  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "var(--ar-bg)", color: "var(--ar-t1)" }}
    >
      <div
        className="rounded-lg border p-5"
        style={{ background: "var(--ar-s2)", borderColor: "var(--ar-border)" }}
      >
        <div className="h-4 w-48 animate-pulse rounded-full bg-[var(--ar-s3)]" />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-[var(--ar-s3)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPageRoute() {
  return (
    <Suspense fallback={<AdminRouteFallback />}>
      <AdminPageContent />
    </Suspense>
  );
}
