"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MapPin, TrainFront, ArrowUpRight } from "lucide-react";

export type PandalCardData = {
  name: string;
  address: string;
  landmark: string;
  nearestMetro: string;
  latitude: number;
  longitude: number;
  region: "North" | "Central" | "South";
  slug: string;
};

const regionStyle = {
  North: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  Central: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  South: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

export function PandalCard({ pandal }: { pandal: PandalCardData }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      whileHover={reducedMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.22 }}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-rose-950/5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${regionStyle[pandal.region]}`}>
          {pandal.region} Kolkata
        </span>

        <MapPin className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
      </div>

      <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight">
        {pandal.name}
      </h3>

      <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{pandal.address}</span>
      </p>

      {pandal.landmark && (
        <p className="mt-2 text-sm text-muted-foreground">
          Landmark: {pandal.landmark}
        </p>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/70 p-3 text-sm">
        <TrainFront className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
        <div>
          <p className="text-xs text-muted-foreground">Nearest listed metro</p>
          <p className="mt-0.5 font-semibold">{pandal.nearestMetro || "Not available"}</p>
        </div>
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${pandal.latitude},${pandal.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-800 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-900"
        >
          Get directions
          <ArrowUpRight className="h-4 w-4" />
        </a>

        <Link
          href={`/map?region=${pandal.region}&pandal=${encodeURIComponent(pandal.slug)}`}
          className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-accent"
          aria-label={`View ${pandal.name} on the map`}
        >
          Map
        </Link>
      </div>
    </motion.article>
  );
}