import { ArrowRight, Download, ShieldCheck, Smartphone } from "lucide-react";

const IOS_APP_URL = "#ios-app";
const ANDROID_APP_URL = "#android-app";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F6FAFA] text-[#17272B]">
      <section className="relative isolate min-h-screen overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[62vh] bg-[#43B8B3]" />
        <div className="absolute inset-x-0 top-[62vh] h-20 bg-[#F3B51B]" />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3 font-black text-white">
            <img src="/tuktukGo.png" alt="" className="tuktukgo-logo-mark h-10 w-10 rounded-xl" />
            <span className="text-lg">TukTukGo</span>
          </a>
          <a
            href="/admin-login"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-[#17272B] shadow-sm transition hover:bg-[#F7FBFA]"
          >
            <ShieldCheck size={17} />
            Admin Login
          </a>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[1fr_460px]">
          <div className="max-w-2xl pb-10 text-white">
            <p className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-black">
              <Smartphone size={16} />
              Book city auto rides in seconds
            </p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-normal sm:text-7xl">
              TukTukGo
            </h1>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-white/90">
              Fast local auto bookings, live driver tracking, simple fares, and safer trips for everyday city movement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={ANDROID_APP_URL}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#17272B] px-5 text-sm font-black text-white transition hover:bg-[#24383C]"
              >
                <Download size={18} />
                Android App
              </a>
              <a
                href={IOS_APP_URL}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-[#17272B] transition hover:bg-[#F7FBFA]"
              >
                <Download size={18} />
                iOS App
              </a>
            </div>
          </div>

          <div className="relative mx-auto aspect-[0.74] w-full max-w-[360px] rounded-[34px] border-[10px] border-[#17272B] bg-white p-4 shadow-2xl">
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-[#17272B]" />
            <div className="mt-8 overflow-hidden rounded-[24px] bg-[#EAF0F1]">
              <div className="bg-[#43B8B3] px-5 pb-16 pt-6 text-white">
                <div className="text-sm font-black text-white/80">Pickup confirmed</div>
                <div className="mt-3 text-3xl font-black">Driver arriving</div>
              </div>
              <div className="-mt-10 px-5 pb-5">
                <div className="rounded-lg bg-white p-4 shadow-lg">
                  <img
                    src="/images/welcome-auto-rickshaw-transparent.png"
                    alt="Auto rickshaw"
                    className="mx-auto h-36 w-full object-contain"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black">3 min away</div>
                      <div className="text-xs font-bold text-slate-500">KA 05 AR 2026</div>
                    </div>
                    <div className="rounded-lg bg-[#F3B51B] px-3 py-2 text-sm font-black">
                      Rs. 86
                    </div>
                  </div>
                </div>
                <a
                  href="/admin-login"
                  className="mt-4 flex h-12 items-center justify-center gap-2 rounded-lg bg-[#43B8B3] text-sm font-black text-white"
                >
                  Admin console
                  <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
