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
import "leaflet/dist/leaflet.css";

type Region = "North" | "Central" | "South";

type Pandal = {
  _id: string;
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

const START = {
  name: "Shyambazar Metro Station",
  latitude: 22.5995,
  longitude: 88.3737,
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const pinIcon = (label: string, isStart = false) =>
  L.divIcon({
    className: "",
    html: `
      <div style="
        width:34px;height:34px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:12px;
        background:${isStart ? "#15803d" : "#9f1239"};
        border:3px solid white;
        box-shadow:0 2px 10px #0005;
      ">${label}</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function haversineKm(a: Pandal | typeof START, b: Pandal | typeof START) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function adviceFor(distanceKm: number) {
  if (distanceKm < 2) return "Chup chap haat bara";
  if (distanceKm >= 3 && distanceKm <= 4) {
    return "Bhai metro kore jabo";
  }
  if (distanceKm > 2) {
    return "Bhai gaar fete jabe, toto dar kora!";
  }
  return "Let's go!";
}

export default function PandalMap() {
  const [pandals, setPandals] = useState<Pandal[]>([]);
  const [region, setRegion] = useState<Region | "All">("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pandal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPandals() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/api/pandals`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        setPandals(data.pandals);
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

    return pandals.filter((pandal) => {
      const matchesRegion = region === "All" || pandal.region === region;
      const matchesSearch =
        !term ||
        `${pandal.name} ${pandal.address} ${pandal.landmark} ${pandal.nearestMetro}`
          .toLowerCase()
          .includes(term);

      return matchesRegion && matchesSearch;
    });
  }, [pandals, region, search]);

  // CSV order is only a preview order, not an optimised itinerary.
  const routePoints = useMemo(
    () => [
      [START.latitude, START.longitude] as [number, number],
      ...filtered.map(
        (p) => [p.latitude, p.longitude] as [number, number]
      ),
    ],
    [filtered]
  );

  const selectedIndex = selected
    ? filtered.findIndex((p) => p.slug === selected.slug)
    : -1;

  const previousStop =
    selectedIndex > 0
      ? filtered[selectedIndex - 1]
      : START;

  const selectedDistance = selected
    ? haversineKm(previousStop, selected)
    : null;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pandals, landmarks or metro stations..."
          aria-label="Search pandals"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-rose-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />

        <select
          value={region}
          onChange={(e) =>
            setRegion(e.target.value as Region | "All")
          }
          aria-label="Filter by Kolkata region"
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="All">All Kolkata</option>
          <option value="North">North Kolkata</option>
          <option value="Central">Central Kolkata</option>
          <option value="South">South Kolkata</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {filtered.length} pandals
        </span>
        <span className="rounded-full bg-green-100 px-3 py-1 text-green-900 dark:bg-green-950 dark:text-green-200">
          Start: Shyambazar Metro
        </span>
      </div>

      {loading && <p>Loading the Puja map...</p>}

      {error && (
        <p role="alert" className="text-red-600">
          Could not load the map: {error}. Check the backend server.
        </p>
      )}

      <div className="h-[65vh] min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <MapContainer
          center={[22.59, 88.36]}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <MapResizeHandler />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker
            position={[START.latitude, START.longitude]}
            icon={pinIcon("S", true)}
          >
            <Popup>
              <strong>{START.name}</strong>
              <br />
              Your route starting point
            </Popup>
          </Marker>

          {routePoints.length > 1 && (
            <Polyline
              positions={routePoints}
              pathOptions={{ color: "#e11d48", weight: 4, opacity: 0.75 }}
            />
          )}

          {filtered.map((pandal, index) => (
            <Marker
              key={pandal.slug}
              position={[pandal.latitude, pandal.longitude]}
              icon={pinIcon(String(index + 1))}
              eventHandlers={{
                click: () => setSelected(pandal),
              }}
            >
              <Popup>
                <strong>{index + 1}. {pandal.name}</strong>
                <br />
                {pandal.region} Kolkata
                <br />
                {pandal.nearestMetro}
                <br />
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
        </MapContainer>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        The red line currently connects stops in CSV order. Distances
        shown below are straight-line estimates, not navigable road
        distances. Route optimisation and road-based distances come in
        the routing milestone.
      </p>

      {selected && selectedDistance !== null && (
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <h2 className="text-lg font-bold">{selected.name}</h2>
          <p className="mt-1 text-sm">{selected.address}</p>
          <p className="mt-2 text-sm">
            Previous stop: {previousStop.name}
          </p>
          <p className="mt-1 font-semibold">
            Straight-line distance: {selectedDistance.toFixed(2)} km
          </p>
          <p className="mt-2 font-semibold">
            {adviceFor(selectedDistance)}
          </p>
          <p className="mt-2 text-sm">
            Nearest metro listed in your data: {selected.nearestMetro}
          </p>
        </article>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((pandal, index) => (
          <button
            type="button"
            key={pandal.slug}
            onClick={() => setSelected(pandal)}
            className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-rose-400 hover:shadow-md dark:border-gray-800"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Stop {index + 1} · {pandal.region} Kolkata
            </span>
            <h3 className="mt-1 font-bold">{pandal.name}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {pandal.address}
            </p>
            <p className="mt-2 text-sm">
              <strong>Metro:</strong> {pandal.nearestMetro}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}