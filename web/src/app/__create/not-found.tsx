import type { Route } from './+types/not-found';
import { Link } from 'react-router';

export async function loader({ params }: Route.LoaderArgs) {
  return {
    path: `/${params['*'] || ''}`,
  };
}

export default function AutoRideNotFoundPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const missingPath = loaderData.path.replace(/^\//, '') || 'unknown';

  return (
    <main className="min-h-screen bg-[#1C1917] text-white">
      <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-white to-[#138808]" />
      <section className="mx-auto flex min-h-[calc(100vh-4px)] w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F97316] shadow-[0_12px_30px_rgba(249,115,22,0.35)]">
          <img
            src="/favicon.png"
            alt="Auto Ride"
            className="h-[72px] w-[72px] rounded-[20px] object-contain"
          />
        </div>

        <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
          Route not found
        </p>
        <h1 className="text-5xl font-extrabold leading-[0.96] tracking-normal">
          This road
          <br />
          is not open yet.
        </h1>
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-stone-300">
          We could not find <span className="font-bold text-white">/{missingPath}</span>.
          Head back to Auto Ride and continue from a known screen.
        </p>

        <Link
          to="/"
          className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#F97316] px-5 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-[#EA580C]"
        >
          Back to Auto Ride
        </Link>
      </section>
    </main>
  );
}
