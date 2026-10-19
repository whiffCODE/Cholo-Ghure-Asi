export type TravelMode = "driving" | "walking" | "transit";

export type TravelStop = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  nearestMetro?: {
    station: string;
    line?: string;
    distanceKm?: number;
  };
};

const EARTH_RADIUS_KM = 6371.0088;

export function isValidTravelStop(stop: TravelStop): boolean {
  return Boolean(
    stop.id.trim() &&
      stop.name.trim() &&
      Number.isFinite(stop.longitude) &&
      Number.isFinite(stop.latitude) &&
      stop.longitude >= -180 &&
      stop.longitude <= 180 &&
      stop.latitude >= -90 &&
      stop.latitude <= 90,
  );
}

function assertValidStops(stops: TravelStop[]): void {
  const ids = new Set<string>();
  for (const stop of stops) {
    if (!isValidTravelStop(stop)) {
      throw new Error(`Invalid coordinates or identity for stop: ${stop.name || stop.id || "unknown"}`);
    }
    if (ids.has(stop.id)) throw new Error(`Duplicate stop id: ${stop.id}`);
    ids.add(stop.id);
  }
}

/** Haversine distance in kilometres. This is straight-line distance, not road distance. */
export function haversineKm(a: Pick<TravelStop, "longitude" | "latitude">, b: Pick<TravelStop, "longitude" | "latitude">): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Greedy nearest-neighbour ordering. The chosen start is preserved; each next
 * stop is the geographically nearest unvisited stop. It is a heuristic, not a
 * guarantee of the globally shortest road route.
 */
export function optimizeStopOrder(stops: TravelStop[], startId?: string): TravelStop[] {
  if (stops.length < 2) return [...stops];
  assertValidStops(stops);

  const start = startId ? stops.find((stop) => stop.id === startId) : stops[0];
  if (!start) throw new Error(`Starting stop not found: ${startId}`);

  const remaining = stops.filter((stop) => stop.id !== start.id);
  const ordered = [start];
  let current = start;

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const distance = haversineKm(current, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    current = remaining.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/** Sum of straight-line distances between consecutive stops, in kilometres. */
export function estimateItineraryDistanceKm(stops: TravelStop[]): number {
  if (stops.length < 2) return 0;
  assertValidStops(stops);
  return stops.slice(1).reduce((total, stop, index) => total + haversineKm(stops[index], stop), 0);
}

/** Approximate walking time. Use only as a planning hint, not a live ETA. */
export function estimateWalkingMinutes(distanceKm: number, speedKmh = 4.5): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("Distance must be a non-negative number.");
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) throw new Error("Walking speed must be greater than zero.");
  return Math.ceil((distanceKm / speedKmh) * 60);
}

export function getMetroRecommendations(stops: TravelStop[]) {
  const stations = new Map<string, { station: string; line?: string; distanceKm?: number; serves: string[] }>();
  for (const stop of stops) {
    const metro = stop.nearestMetro;
    if (!metro?.station?.trim()) continue;
    const key = metro.station.trim().toLocaleLowerCase();
    const existing = stations.get(key);
    if (existing) {
      existing.serves.push(stop.name);
      if (existing.distanceKm == null && metro.distanceKm != null) existing.distanceKm = metro.distanceKm;
      if (!existing.line && metro.line) existing.line = metro.line;
    } else {
      stations.set(key, {
        station: metro.station.trim(),
        ...(metro.line ? { line: metro.line } : {}),
        ...(Number.isFinite(metro.distanceKm) && metro.distanceKm! >= 0 ? { distanceKm: metro.distanceKm } : {}),
        serves: [stop.name],
      });
    }
  }
  return [...stations.values()].sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return a.station.localeCompare(b.station);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildGoogleMapsDirectionsUrl(stops: TravelStop[], mode: TravelMode = "walking"): string | null {
  if (stops.length < 2) return null;
  assertValidStops(stops);
  const toLatLng = (stop: TravelStop) => `${stop.latitude},${stop.longitude}`;
  const params = new URLSearchParams({
    api: "1",
    origin: toLatLng(stops[0]),
    destination: toLatLng(stops[stops.length - 1]),
    travelmode: mode,
  });
  const waypoints = stops.slice(1, -1).map(toLatLng);
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
