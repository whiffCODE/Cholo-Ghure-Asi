"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";

const PandalMap = dynamic(
  () => import("@/components/PandalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-muted">
        Loading map...
      </div>
    ),
  }
);

function MapContent() {
  const params = useSearchParams();
  const region = params.get("region");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          Your Puja itinerary
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          Explore the pandal map
        </h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Explore the locations from your dataset, beginning at
          Shyambazar Metro Station.
        </p>

        <div className="mt-8">
          <PandalMap
            initialRegion={
              region === "North" ||
              region === "Central" ||
              region === "South"
                ? region
                : "All"
            }
          />
        </div>
      </section>
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          Loading map...
        </div>
      }
    >
      <MapContent />
    </Suspense>
  );
}