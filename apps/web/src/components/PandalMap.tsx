
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Search,
  TrainFront,
  Footprints,
  Navigation,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";

type Region = "North" | "Central" | "South";

type Pandal = {
  _id?: string;
  name: string;
  address: string;
  landmark: string;
  nearestMetro: string;
  latitude: number;
  longitude: number;
  region: Region;
  slug: string;
};

type ApiResponse = {
  count: number;
  pandals: Pandal[];
};

type StartPoint = {
  name: string;
  latitude: number;
  longitude: number;
};

type MapStop = Pandal | StartPoint;

type Props = {
  initialRegion?: Region | "All";
};

const START: StartPoint = {
  name: "Shyambazar Metro Station",
  latitude: 22.5995,
  longitude: 88.3737,
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REGION_OPTIONS: Array<Region | "All"> = [
  "All",
  "North",
  "Central",
  "South",
];

function isStartPoint(stop: MapStop): stop is StartPoint {
  return !("slug" in stop);
}

function makePinIcon(label: string, isStart = false) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:34px;
        height:34px;
        border-radius:50%;
        background:${isStart ? "#15803d" : "#9f1239"};
        color:#fff;
        font-size:12px;
        font-weight:800;
        border:3px solid #fff;
        box-shadow:0 3px 12px rgba(0,0,0,.3);
      ">${label}</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function haversineKm(a: MapStop, b: MapStop): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;

  const latitudeDifference = radians(b.latitude - a.latitude);
  const longitudeDifference = radians(b.longitude - a.longitude);

  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(value));
}

function getTravelAdvice(distanceKm: number) {
  if (distanceKm < 2) {
    return {
      title: "Chup chap haat bara",
      description: "Close enough for a walk.",
      kind: "walk" as const,
    };
  }

  if (distanceKm >= 3 && distanceKm <= 4) {
    return {
      title: "Bhai metro kore jabo",
      description:
        "Check the nearest useful metro station and actual transit route.",
      kind: "metro" as const,
    };
  }

  if (distanceKm > 2) {
    return {
      title: "Bhai gaar fete jabe, toto dar kora!",
      description:
        "Compare road travel and metro options before you leave.",
      kind: "road" as const,
    };
  }

  return {
    title: "Let's go!",
    description: "Check the route before starting.",
    kind: "walk" as const,
  };
}

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function FitRoute({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, {
        padding: [35, 35],
        maxZoom: 15,
      });
    }
  }, [map, points]);

  return null;
}

export default function PandalMap({
  initialRegion = "All",
}: Props) {
  const [pandals, setPandals] = useState<Pandal[]>([]);
  const [region, setRegion] = useState<Region | "All">(
    initialRegion
  );
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setRegion(initialRegion);
  }, [initialRegion]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPandals() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/pandals`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        const data: ApiResponse = await response.json();

        setPandals(
          Array.isArray(data.pandals) ? data.pandals : []
        );
      } catch (cause) {
        if (
          cause instanceof Error &&
          cause.name !== "AbortError"
        ) {
          setError(cause.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPandals();

    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return pandals.filter((pandal) => {
      const matchesRegion =
        region === "All" || pandal.region === region;

      const searchableText = [
        pandal.name,
        pandal.address,
        pandal.landmark,
        pandal.nearestMetro,
        pandal.region,
      ]
        .join(" ")
        .toLowerCase();

      return matchesRegion && searchableText.includes(query);
    });
  }, [pandals, region, search]);

  const selected = filtered.find(
    (pandal) => pandal.slug === selectedSlug
  ) ?? null;

  const selectedIndex = selected
    ? filtered.findIndex((pandal) => pandal.slug === selected.slug)
    : -1;

  const previousStop: MapStop =
    selectedIndex > 0
      ? filtered[selectedIndex - 1]
      : START;

  const selectedDistance = selected
    ? haversineKm(previousStop, selected)
    : null;

  const routePoints = useMemo<Array<[number, number]>>(
    () => [
      [START.latitude, START.longitude],
      ...filtered.map(
        (pandal) =>
          [pandal.latitude, pandal.longitude] as [number, number]
      ),
    ],
    [filtered]
  );

  const validPandals = filtered.filter(
    (pandal) =>
      Number.isFinite(pandal.latitude) &&
      Number.isFinite(pandal.longitude) &&
      Math.abs(pandal.latitude) <= 90 &&
      Math.abs(pandal.longitude) <= 180
  );

  const visibleRoute: Array<[number, number]> = [
    [START.latitude, START.longitude],
    ...validPandals.map(
      (pandal) =>
        [pandal.latitude, pandal.longitude] as [number, number]
    ),
  ];

  return (
    <section className="space-y-5">
      {/* Search and region filter */}
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-rose-600">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pandals, landmarks or metro..."
            aria-label="Search pandals"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <select
          value={region}
          onChange={(event) =>
            setRegion(event.target.value as Region | "All")
          }
          aria-label="Filter by region"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-600"
        >
          {REGION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "All Kolkata" : `${option} Kolkata`}
            </option>
          ))}
        </select>
      </div>

      {/* Region shortcut buttons */}
      <div className="flex flex-wrap gap-2">
        {REGION_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRegion(option)}
            aria-pressed={region === option}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              region === option
                ? "border-rose-800 bg-rose-800 text-white"
                : "border-border bg-background hover:border-rose-500"
            }`}
          >
            {option === "All" ? "All areas" : `${option} Kolkata`}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {filtered.length} pandals
        </span>

        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Start: Shyambazar Metro
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading pandals...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <strong>Could not load pandals.</strong>
          <p className="mt-1">{error}</p>
          <p className="mt-1">
            Check that the backend is running and
            NEXT_PUBLIC_API_URL points to it.
          </p>
        </div>
      )}

      {/* Interactive map */}
      <div className="h-[60vh] min-h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
        <MapContainer
          center={[START.latitude, START.longitude]}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <MapResizeHandler />
          <FitRoute points={routePoints} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker
            position={[START.latitude, START.longitude]}
            icon={makePinIcon("S", true)}
          >
            <Popup>
              <strong>{START.name}</strong>
              <p>Your starting point.</p>
            </Popup>
          </Marker>

          {validPandals.map((pandal, index) => (
            <Marker
              key={pandal.slug}
              position={[pandal.latitude, pandal.longitude]}
              icon={makePinIcon(String(index + 1))}
              eventHandlers={{
                click: () => setSelectedSlug(pandal.slug),
              }}
            >
              <Popup>
                <strong>
                  {index + 1}. {pandal.name}
                </strong>

                <p>{pandal.address}</p>
                <p>Region: {pandal.region} Kolkata</p>

                <p>
                  Metro: {pandal.nearestMetro || "Not listed"}
                </p>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${pandal.latitude},${pandal.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open directions in Google Maps
                </a>
              </Popup>
            </Marker>
          ))}

          {/* Visual connection only, not a navigable road route */}
          <Polyline
            positions={visibleRoute}
            pathOptions={{
              color: "#e11d48",
              weight: 3,
              opacity: 0.7,
              dashArray: "7 7",
            }}
          />
        </MapContainer>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        The dashed line connects locations in the displayed order.
        Distances are straight-line estimates, not verified walking
        or driving distances. Actual road routing will be integrated
        separately.
      </p>

      {/* Selected stop details */}
      {selected && selectedDistance !== null && (
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-rose-200 p-2 text-rose-900 dark:bg-rose-900 dark:text-rose-100">
              <MapPin className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Selected pandal
              </p>

              <h3 className="mt-1 text-xl font-black">
                {selected.name}
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                {selected.address}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-200/70 bg-background/70 p-3 dark:border-rose-900">
              <p className="text-xs text-muted-foreground">
                Previous displayed stop
              </p>
              <p className="mt-1 font-semibold">
                {previousStop.name}
              </p>
            </div>

            <div className="rounded-xl border border-rose-200/70 bg-background/70 p-3 dark:border-rose-900">
              <p className="text-xs text-muted-foreground">
                Straight-line distance
              </p>
              <p className="mt-1 text-xl font-black">
                {selectedDistance.toFixed(2)} km
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-background/70 p-4">
            {(() => {
              const advice = getTravelAdvice(selectedDistance);
              const Icon =
                advice.kind === "walk"
                  ? Footprints
                  : advice.kind === "metro"
                    ? TrainFront
                    : Navigation;

              return (
                <>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-rose-700 dark:text-rose-300" />
                    <p className="font-bold">{advice.title}</p>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {advice.description}
                  </p>
                </>
              );
            })()}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${previousStop.latitude},${previousStop.longitude}&destination=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-800 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-900"
            >
              <Navigation className="h-4 w-4" />
              Get directions
              <ExternalLink className="h-4 w-4" />
            </a>

            {selected.nearestMetro && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.nearestMetro + ", Kolkata Metro Station")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
              >
                <TrainFront className="h-4 w-4" />
                Find metro
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </article>
      )}

      {/* Searchable stop list */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xl font-black">Your pandal stops</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a stop to inspect its location and travel advice.
          </p>
        </div>

        {filtered.length === 0 && !loading ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No pandals found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another search or region.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((pandal, index) => (
              <button
                type="button"
                key={pandal.slug}
                onClick={() => setSelectedSlug(pandal.slug)}
                aria-pressed={selectedSlug === pandal.slug}
                className={`rounded-xl border p-4 text-left transition hover:border-rose-500 hover:shadow-md ${
                  selectedSlug === pandal.slug
                    ? "border-rose-600 bg-rose-50 dark:bg-rose-950/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-sm font-black text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {pandal.region} Kolkata
                    </span>

                    <h4 className="mt-1 font-bold">{pandal.name}</h4>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {pandal.address}
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-sm">
                      <TrainFront className="h-4 w-4 shrink-0" />
                      {pandal.nearestMetro || "Metro not listed"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
