import { lazy, Suspense } from "react";
import { redirect } from "react-router";

const AdminOpsPageContent = lazy(() => import("./page-content.jsx"));

export async function loader({ request }) {
  const [{ auth }, { default: sql }] = await Promise.all([
    import("@/auth"),
    import("@/app/api/utils/sql"),
  ]);
  const session = await auth(request);
  const url = new URL(request.url);
  const signinUrl = `/admin-login?callbackUrl=${encodeURIComponent(
    url.pathname,
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

function AdminOpsRouteFallback() {
  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "var(--ar-bg)", color: "var(--ar-t1)" }}
    >
      <div className="space-y-5">
        <section
          className="rounded-lg border p-5"
          style={{ background: "var(--ar-s2)", borderColor: "var(--ar-border)" }}
        >
          <div className="h-4 w-56 animate-pulse rounded-full bg-[var(--ar-s3)]" />
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-lg bg-[var(--ar-s3)]" />
            ))}
          </div>
        </section>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
          <div className="h-80 animate-pulse rounded-lg bg-[var(--ar-s2)]" />
          <div className="h-80 animate-pulse rounded-lg bg-[var(--ar-s2)]" />
        </div>
      </div>
    </div>
  );
}

export default function AdminOpsPageRoute() {
  return (
    <Suspense fallback={<AdminOpsRouteFallback />}>
      <AdminOpsPageContent />
    </Suspense>
  );
}
