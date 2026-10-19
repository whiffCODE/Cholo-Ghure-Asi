"use client";

import { useMemo, useState } from "react";
import {
  buildGoogleMapsDirectionsUrl,
  estimateItineraryDistanceKm,
  estimateWalkingMinutes,
  getMetroRecommendations,
  optimizeStopOrder,
  type TravelMode,
  type TravelStop,
} from "@/lib/travel-intelligence";

type Props = {
  stops: TravelStop[];
  onApplyOrder: (orderedIds: string[]) => void;
  travelMode?: TravelMode;
};

export function TravelIntelligencePanel({ stops, onApplyOrder, travelMode = "walking" }: Props) {
  const [message, setMessage] = useState("");
  const distanceKm = useMemo(() => estimateItineraryDistanceKm(stops), [stops]);
  const walkingMinutes = useMemo(() => estimateWalkingMinutes(distanceKm), [distanceKm]);
  const metroStations = useMemo(() => getMetroRecommendations(stops), [stops]);
  const directionsUrl = useMemo(() => buildGoogleMapsDirectionsUrl(stops, travelMode), [stops, travelMode]);

  function handleOptimize() {
    try {
      if (stops.length < 2) {
        setMessage("Select at least two pandals to optimise your visit order.");
        return;
      }
      const optimized = optimizeStopOrder(stops, stops[0]?.id);
      onApplyOrder(optimized.map((stop) => stop.id));
      setMessage("Suggested order applied. Road conditions and crowds may change the best route.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not optimise this itinerary.");
    }
  }

  return (
    <section aria-labelledby="travel-intelligence-title" className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900 dark:bg-orange-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800 dark:text-orange-200">Phase 5 · Travel Intelligence</p>
          <h3 id="travel-intelligence-title" className="mt-1 text-lg font-bold">Make your pandal route smarter</h3>
          <p className="mt-1 text-sm text-muted-foreground">Keep your first stop, then suggest a nearby-first order for the remaining pandals.</p>
        </div>
        <button type="button" onClick={handleOptimize} disabled={stops.length < 2} className="rounded-xl bg-[#65152b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7c1d37] disabled:cursor-not-allowed disabled:opacity-50">
          Optimise visit order
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-background p-3">
          <p className="text-xs text-muted-foreground">Straight-line distance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{distanceKm.toFixed(1)} km</p>
          <p className="mt-1 text-xs text-muted-foreground">Geographic estimate, not road distance.</p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <p className="text-xs text-muted-foreground">Approximate walking time</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{walkingMinutes} min</p>
          <p className="mt-1 text-xs text-muted-foreground">Assumes 4.5 km/h; excludes queues, breaks and crowd delays.</p>
        </div>
      </div>

      {metroStations.length > 0 && (
        <div>
          <h4 className="text-sm font-bold">Metro hints from your pandal data</h4>
          <ul className="mt-2 space-y-2">
            {metroStations.map((metro) => (
              <li key={metro.station} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border bg-background p-3 text-sm">
                <div>
                  <p className="font-semibold">{metro.station}{metro.line ? ` · ${metro.line}` : ""}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Listed for: {metro.serves.join(", ")}</p>
                </div>
                {metro.distanceKm != null && <span className="shrink-0 text-xs text-muted-foreground">{metro.distanceKm.toFixed(1)} km listed</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Metro suggestions use the nearestMetro fields saved with each pandal. Verify station access and service updates before travelling.</p>
        </div>
      )}

      {directionsUrl && (
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-orange-300 bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-orange-100 dark:border-orange-800 dark:hover:bg-orange-950/50">
          Open directions in Google Maps
        </a>
      )}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}
