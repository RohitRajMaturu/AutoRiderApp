import { useEffect } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

const signinHref = `/account/signin?role=admin&callbackUrl=${encodeURIComponent(
  "/admin",
)}`;

export default function AdminLoginPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace(signinHref);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EAF0F1] px-5 text-[#17272B]">
      <a
        href="/"
        aria-label="Back to TukTukGo home"
        className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#D8E4E5] bg-white text-[#17272B] shadow-sm transition hover:border-[#43B8B3]/45"
      >
        <ArrowLeft size={19} />
      </a>
      <section className="w-full max-w-md rounded-lg border border-[#D8E4E5] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#43B8B3]/15 text-[#43B8B3]">
          <ShieldCheck size={30} />
        </div>
        <h1 className="mt-5 text-2xl font-black">Admin Login</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-[#647678]">
          Continue with your admin credentials to open the web command center.
        </p>
        <a
          href={signinHref}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#43B8B3] text-sm font-black text-white"
        >
          Continue to Sign In
          <ArrowRight size={17} />
        </a>
      </section>
    </main>
  );
}
