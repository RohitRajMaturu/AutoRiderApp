const APP_DOWNLOAD_URL = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? "#";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-[#1C1917] font-inter text-white">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-7 py-10">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
          <span className="text-[42px]" aria-hidden="true">
            🛺
          </span>
        </div>

        <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-normal">
          Auto<span className="text-[#F97316]">Ride</span>
        </h1>
        <p className="mt-4 max-w-sm text-base font-medium leading-7 text-stone-300">
          India's simplest auto-rickshaw ride connection platform.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {["Instant", "Safe", "Fair"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-stone-200"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <a
            href={APP_DOWNLOAD_URL}
            className="rounded-[14px] bg-[#F97316] px-5 py-4 text-center text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-[#EA580C]"
          >
            Download App
          </a>
          <a
            href="/account/signup?role=driver"
            className="rounded-[14px] border border-white/15 bg-white/[0.08] px-5 py-4 text-center text-sm font-extrabold text-white transition hover:bg-white/[0.12]"
          >
            Register as Driver
          </a>
        </div>
      </section>
    </main>
  );
}
