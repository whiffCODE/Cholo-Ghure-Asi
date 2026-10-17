"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Compass,
  MapPinned,
  Search,
  Sparkles,
  TrainFront,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { PandalCard, type PandalCardData } from "@/components/pandal-card";

const PandalMap = dynamic(
  () => import("@/components/PandalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-muted">
        Loading your Puja map...
      </div>
    ),
  }
);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const regions = [
  {
    name: "North Kolkata",
    value: "North",
    description: "Traditional baris, heritage lanes and iconic pandals.",
    symbol: "উ",
    style: "from-rose-950 to-red-800",
  },
  {
    name: "Central Kolkata",
    value: "Central",
    description: "Historic neighbourhoods and city-centre celebrations.",
    symbol: "শ",
    style: "from-amber-950 to-orange-800",
  },
  {
    name: "South Kolkata",
    value: "South",
    description: "Creative themes, big crowds and spectacular lights.",
    symbol: "দ",
    style: "from-emerald-950 to-teal-800",
  },
];

export default function HomePage() {
  const [pandals, setPandals] = useState<PandalCardData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();

    async function loadPandals() {
      try {
        const response = await fetch(`${API_URL}/api/pandals`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        setPandals(data.pandals ?? []);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadPandals();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return pandals;

    return pandals.filter((p) =>
      `${p.name} ${p.address} ${p.landmark} ${p.nearestMetro} ${p.region}`
        .toLowerCase()
        .includes(term)
    );
  }, [pandals, search]);

  const featured = filtered.slice(0, 6);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="relative isolate overflow-hidden bg-[#280911] text-[#fff8eb]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_25%,rgba(190,67,44,0.38),transparent_45%),radial-gradient(ellipse_at_10%_100%,rgba(174,121,32,0.20),transparent_45%)]" />

        <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-80 w-80 rounded-full border border-amber-200/10 sm:h-[480px] sm:w-[480px]" />
        <div className="pointer-events-none absolute -right-8 -top-16 -z-10 h-64 w-64 rounded-full border border-amber-200/10 sm:h-[400px] sm:w-[400px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-100/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Sparkles className="h-4 w-4" />
              Kolkata Puja hopping, sorted
            </div>

            <p className="mt-8 text-sm font-semibold tracking-[0.25em] text-amber-300">
              শারদীয়ার শুভেচ্ছা
            </p>

            <h1 className="mt-3 max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
              Pujo plan?
              <br />
              <span className="text-amber-300">Cholo ghure asi.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-rose-100/80 sm:text-lg">
              Find your pandals, map the route, catch the nearest metro
              and keep your Puja gang together. Less route confusion.
              More adda, aloo dum and bhog.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#pandal-map"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3.5 font-bold text-[#280911] transition hover:bg-amber-200"
              >
                Explore the map
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 font-semibold text-white transition hover:bg-white/10"
              >
                Plan your route
                <Compass className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-rose-100/70">
              <span className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-amber-300" />
                Pandal discovery
              </span>
              <span className="flex items-center gap-2">
                <TrainFront className="h-4 w-4 text-amber-300" />
                Metro planning
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-300" />
                Friends together
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.12 }}
            className="relative mx-auto w-full max-w-lg"
          >
            <div className="rounded-[2rem] border border-amber-200/20 bg-white/[0.06] p-3 shadow-2xl shadow-black/20 backdrop-blur-sm">
              <div className="overflow-hidden rounded-[1.5rem] bg-[#f5e6ca] p-6 text-[#45131c] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#8e4b37]">
                    Your Puja day
                  </span>
                  <Sparkles className="h-5 w-5 text-[#b37a24]" />
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    ["01", "Start at Shyambazar", "Meet the gang"],
                    ["02", "Explore the pandals", "Follow your route"],
                    ["03", "Find the nearest metro", "Skip the road chaos"],
                  ].map(([number, title, subtitle]) => (
                    <div key={number} className="flex items-center gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6d1728] font-black text-amber-200">
                        {number}
                      </span>
                      <div>
                        <p className="font-bold">{title}</p>
                        <p className="mt-0.5 text-sm text-[#825b4d]">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 rounded-2xl bg-[#6d1728] p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                    Travel wisdom
                  </p>
                  <p className="mt-2 text-xl font-black">
                    Distance kom? Hete jao.
                  </p>
                  <p className="mt-1 text-sm text-rose-100/80">
                    Beshi dur? Bhai, metro kore jabo!
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-amber-100/20 bg-[#3d111b] px-4 py-3 shadow-xl sm:block">
              <p className="text-xs text-amber-200">Puja mode</p>
              <p className="mt-1 font-bold">Adda. Maps. Repeat.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
              Pick your para
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Kolkata, three ways
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Start with a neighbourhood and build a route around the
              pandals you want to see.
            </p>
          </div>

          <a
            href="#pandal-map"
            className="inline-flex items-center gap-2 text-sm font-bold text-rose-800 hover:underline dark:text-rose-300"
          >
            Jump to map <ArrowDown className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {regions.map((region, index) => (
            <motion.div
              key={region.value}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.07 }}
            >
              <Link
                href={`/map?region=${region.value}`}
                className={`group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${region.style} p-6 text-white shadow-sm transition hover:shadow-xl`}
              >
                <span className="pointer-events-none absolute -right-3 -top-12 text-[170px] font-black leading-none text-white/[0.07]">
                  {region.symbol}
                </span>

                <div className="relative flex items-start justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                    Explore the region
                  </span>
                  <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-1 group-hover:translate-x-1" />
                </div>

                <div className="relative mt-8">
                  <h3 className="text-2xl font-black">{region.name}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-white/75">
                    {region.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                Find your next stop
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Search pandals
              </h2>
              <p className="mt-3 text-muted-foreground">
                Search by name, address, landmark or listed metro station.
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm focus-within:ring-2 focus-within:ring-rose-600">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Try Bagbazar, Shyambazar, metro..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search pandals"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </label>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {["North", "Central", "South"].map((region) => (
              <button
                type="button"
                key={region}
                onClick={() => setSearch(region)}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
              >
                {region} Kolkata
              </button>
            ))}
          </div>

          {loading && (
            <p className="mt-8 text-sm text-muted-foreground">
              Finding pandals from your dataset...
            </p>
          )}

          {error && (
            <p role="alert" className="mt-8 rounded-xl border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">
              We couldn't load the pandals. Check that the backend is
              running and NEXT_PUBLIC_API_URL is correct. Details: {error}
            </p>
          )}

          {!loading && !error && (
            <>
              <div className="mt-8 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-300"
                >
                  Open full map <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {featured.length ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {featured.map((pandal) => (
                    <PandalCard key={pandal.slug} pandal={pandal} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
                  <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-semibold">No pandals found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try a different name, landmark or region.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section
        id="pandal-map"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16"
      >
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
            Your journey starts here
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            The pandal map
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Explore the stops, inspect locations and prepare your
            Shyambazar-to-Kolkata hopping route.
          </p>
        </div>

        <PandalMap />
      </section>

      <footer className="border-t border-border bg-background px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">Cholo Ghure Asi 🪔</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Less confusion. More Pujo.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Made for Kolkata pandal hoppers.
          </p>
        </div>
      </footer>
    </main>
  );
}