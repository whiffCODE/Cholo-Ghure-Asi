"use client";

import dynamic from "next/dynamic";

const PandalMap = dynamic(
  () => import("@/components/PandalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950">
        Preparing your Puja map...
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-950 dark:bg-gray-950 dark:text-white">
      <header className="border-b border-rose-100 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 px-5 py-10 dark:border-gray-800 dark:from-gray-950 dark:via-rose-950/30 dark:to-gray-950 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
            Kolkata · Durga Puja
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
            Cholo Ghure Asi
            <span className="ml-2 text-rose-600">🪔</span>
          </h1>

          <p className="mt-4 max-w-2xl text-base text-gray-700 dark:text-gray-300 sm:text-lg">
            Pandals, baris, metro stations and your Puja gang.
            One map. Less confusion. More bhog.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#pandal-map"
              className="rounded-xl bg-rose-700 px-5 py-3 font-semibold text-white transition hover:bg-rose-800"
            >
              Explore the map
            </a>

            <a
              href="https://www.google.com/maps/dir/?api=1&origin=Shyambazar+Metro+Station%2C+Kolkata"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-rose-300 px-5 py-3 font-semibold text-rose-900 transition hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950"
            >
              Open Google Maps
            </a>
          </div>
        </div>
      </header>

      <section
        id="pandal-map"
        className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-8 sm:py-12"
      >
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">
            Your Puja hopping map
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Start at Shyambazar Metro Station and explore the pandals
            in your dataset.
          </p>
        </div>

        <PandalMap />
      </section>

      <footer className="border-t border-gray-200 px-5 py-6 text-center text-sm text-gray-500 dark:border-gray-800">
        Made for Kolkata Puja hopping · Cholo Ghure Asi
      </footer>
    </main>
  );
}