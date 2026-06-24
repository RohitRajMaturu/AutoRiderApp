import {
  ArrowRight,
  BadgeCheck,
  Gauge,
  MapPinned,
  ShieldCheck,
  Smartphone,
  UserRound,
  WalletCards,
} from "lucide-react";
import AutoRideIcon from "@/components/AutoRideIcon";

const IOS_APP_URL = import.meta.env.VITE_IOS_APP_URL || "";
const ANDROID_APP_URL = import.meta.env.VITE_ANDROID_APP_URL || "";

const actions = [
  {
    title: "Passengers",
    copy: "Book an auto, track arrival, and keep every trip in one place.",
    href: ANDROID_APP_URL || null,
    cta: ANDROID_APP_URL ? "Download mobile app" : "Mobile app coming soon",
    Icon: UserRound,
  },
  {
    title: "Drivers",
    copy: "Register, finish KYC, and start accepting rides after approval.",
    href: ANDROID_APP_URL || null,
    cta: ANDROID_APP_URL ? "Get driver app" : "Driver app coming soon",
    Icon: Gauge,
  },
  {
    title: "Admins",
    copy: "Approve drivers, monitor rides, manage zones, and review KYC.",
    href: "/admin-login",
    cta: "Open admin console",
    Icon: ShieldCheck,
  },
];

const metrics = [
  ["Live", "ride matching"],
  ["KYC", "driver checks"],
  ["Fair", "fare visibility"],
  ["Zone", "aware dispatch"],
];

const flow = [
  ["Set pickup", "Use map-based pickup and destination search for faster bookings."],
  ["Match nearby auto", "Drivers see clean ride requests with distance and fare context."],
  ["Track and complete", "Passengers and admins can follow the trip lifecycle clearly."],
];

function StoreCta({ href, children, variant = "primary" }) {
  const baseClass =
    "inline-flex items-center gap-2 rounded-lg px-5 py-4 text-sm font-black transition";
  const primaryClass =
    "bg-[#F3B51B] text-[#17272B] shadow-xl shadow-black/20 hover:bg-[#FFD15C]";
  const secondaryClass =
    "border border-white/24 bg-white/12 text-white backdrop-blur hover:bg-white/18";
  const disabledClass =
    variant === "primary"
      ? "bg-[#F3B51B]/62 text-[#17272B]/72"
      : "border border-white/18 bg-white/8 text-white/68";
  const className = `${baseClass} ${
    href ? (variant === "primary" ? primaryClass : secondaryClass) : disabledClass
  }`;

  if (!href) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F6FAFA] text-[#17272B]">
      <section className="relative isolate min-h-[92vh] overflow-hidden bg-[#123034]">
        <AutoRideIcon
          className="pointer-events-none absolute bottom-[-18px] right-[-50px] z-0 text-[260px] opacity-95 sm:right-[-10px] sm:text-[340px] lg:right-[7vw] lg:text-[430px]"
        />
        <div className="absolute inset-0 z-0 bg-[#123034]/72" />
        <div className="absolute inset-x-0 bottom-0 z-0 h-24 bg-[#F6FAFA]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3 font-black text-white">
            <img src="/tuktukGo.png" alt="" className="h-11 w-11 rounded-xl object-cover" />
            <span className="text-lg">TukTukGo</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href={ANDROID_APP_URL || undefined}
              aria-disabled={!ANDROID_APP_URL}
              className="hidden h-10 items-center rounded-lg px-4 text-sm font-black text-white/88 transition hover:bg-white/10 sm:inline-flex"
            >
              {ANDROID_APP_URL ? "Download App" : "App Coming Soon"}
            </a>
            <a
              href="/admin-login"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-[#17272B] shadow-sm transition hover:bg-[#F7FBFA]"
            >
              <ShieldCheck size={17} />
              Admin
            </a>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(92vh-84px)] max-w-7xl flex-col justify-center px-5 pb-28 pt-8 sm:px-8 lg:pb-32">
          <div className="max-w-3xl text-white">
            <p className="mb-5 inline-flex items-center gap-2 rounded-lg bg-white/14 px-3 py-2 text-sm font-black">
              <Smartphone size={16} />
              Auto rides built for Indian city movement
            </p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-normal sm:text-7xl lg:text-8xl">
              TukTukGo
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/88 sm:text-xl">
              Book autos quickly, keep drivers verified, and give admins one clean console for dispatch, KYC, zones, and ride operations.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <StoreCta href={ANDROID_APP_URL}>
                {ANDROID_APP_URL ? "Download Android App" : "Android App Coming Soon"}
                <ArrowRight size={18} />
              </StoreCta>
              <StoreCta href={IOS_APP_URL} variant="secondary">
                {IOS_APP_URL ? "Download iOS App" : "iOS App Coming Soon"}
              </StoreCta>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-20 max-w-7xl px-5 pb-16 sm:px-8">
        <div className="grid gap-3 rounded-2xl border border-[#D8E4E5] bg-white p-3 shadow-2xl shadow-[#17272B]/10 md:grid-cols-4">
          {metrics.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-[#F7FBFA] px-4 py-5">
              <div className="text-2xl font-black text-[#17272B]">{value}</div>
              <div className="mt-1 text-sm font-bold text-[#586C70]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {actions.map(({ title, copy, href, cta, Icon }) => {
            const ActionWrapper = href ? "a" : "div";
            return (
            <ActionWrapper
              key={title}
              href={href || undefined}
              aria-disabled={!href}
              className={`group rounded-xl border border-[#D8E4E5] bg-white p-5 shadow-sm transition ${
                href
                  ? "hover:-translate-y-0.5 hover:border-[#43B8B3] hover:shadow-xl hover:shadow-[#43B8B3]/10"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E7F6F4] text-[#238B86]">
                  <Icon size={24} />
                </div>
                <ArrowRight
                  className={`mt-2 text-[#BFD1D3] transition ${
                    href ? "group-hover:translate-x-1 group-hover:text-[#43B8B3]" : ""
                  }`}
                  size={20}
                />
              </div>
              <h2 className="mt-5 text-xl font-black">{title}</h2>
              <p className="mt-2 min-h-[52px] text-sm font-semibold leading-6 text-[#586C70]">{copy}</p>
              <div className="mt-5 text-sm font-black text-[#238B86]">{cta}</div>
            </ActionWrapper>
          )})}
        </div>
      </section>

      <section className="border-y border-[#D8E4E5] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-lg bg-[#E7F6F4] px-3 py-2 text-sm font-black text-[#238B86]">
              <MapPinned size={16} />
              How it works
            </p>
            <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
              Simple enough for daily rides. Structured enough for operations.
            </h2>
          </div>
          <div className="grid gap-3">
            {flow.map(([title, copy], index) => (
              <div key={title} className="flex gap-4 rounded-xl border border-[#D8E4E5] bg-[#F7FBFA] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#17272B] text-sm font-black text-white">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#586C70]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-16 sm:px-8 md:grid-cols-3">
        {[
          [BadgeCheck, "Verified driver onboarding", "KYC, document uploads, face match, and admin review stay connected."],
          [WalletCards, "Subscription aware dispatch", "Drivers only receive rides when approval and subscription status allow it."],
          [ShieldCheck, "Admin control center", "Operations teams can watch rides, drivers, audits, and zones from one console."],
        ].map(([Icon, title, copy]) => (
          <div key={title} className="rounded-xl bg-[#17272B] p-5 text-white">
            <Icon size={25} className="text-[#F3B51B]" />
            <h3 className="mt-4 font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/72">{copy}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
