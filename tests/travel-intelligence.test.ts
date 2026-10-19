import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  estimateItineraryDistanceKm,
  estimateWalkingMinutes,
  getMetroRecommendations,
  haversineKm,
  optimizeStopOrder,
  type TravelStop,
} from "../apps/web/src/lib/travel-intelligence";

const stops: TravelStop[] = [
  { id: "a", name: "Start", longitude: 88.36, latitude: 22.58, nearestMetro: { station: "Central", line: "Blue", distanceKm: 0.7 } },
  { id: "b", name: "Farther", longitude: 88.40, latitude: 22.60, nearestMetro: { station: "Park Street", line: "Blue", distanceKm: 1.2 } },
  { id: "c", name: "Nearby", longitude: 88.361, latitude: 22.581, nearestMetro: { station: "Central", line: "Blue", distanceKm: 0.7 } },
];

describe("travel intelligence", () => {
  it("returns zero distance for the same coordinate", () => {
    expect(haversineKm(stops[0], stops[0])).toBe(0);
  });

  it("keeps the requested start and visits the nearest next stop", () => {
    expect(optimizeStopOrder(stops, "a").map((stop) => stop.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input array", () => {
    const original = [...stops];
    optimizeStopOrder(stops, "a");
    expect(stops).toEqual(original);
  });

  it("rejects invalid coordinates", () => {
    expect(() => optimizeStopOrder([{ ...stops[0], latitude: 200 }, stops[1]])).toThrow(/Invalid coordinates/);
  });

  it("rejects duplicate ids", () => {
    expect(() => optimizeStopOrder([stops[0], { ...stops[1], id: stops[0].id }])).toThrow(/Duplicate stop id/);
  });

  it("estimates itinerary distance as non-negative", () => {
    expect(estimateItineraryDistanceKm(stops)).toBeGreaterThan(0);
    expect(estimateItineraryDistanceKm([stops[0]])).toBe(0);
  });

  it("estimates walking time with a configurable speed", () => {
    expect(estimateWalkingMinutes(4.5)).toBe(60);
    expect(estimateWalkingMinutes(1, 5)).toBe(12);
    expect(() => estimateWalkingMinutes(-1)).toThrow();
  });

  it("deduplicates metro stations and keeps the pandals served", () => {
    const metros = getMetroRecommendations(stops);
    expect(metros).toHaveLength(2);
    expect(metros[0].station).toBe("Central");
    expect(metros[0].serves).toEqual(["Start", "Nearby"]);
  });

  it("builds a Google Maps directions URL with waypoints", () => {
    const url = buildGoogleMapsDirectionsUrl(stops, "walking");
    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("travelmode=walking");
    expect(url).toContain("waypoints=");
  });

  it("returns no directions URL for fewer than two stops", () => {
    expect(buildGoogleMapsDirectionsUrl([stops[0]])).toBeNull();
  });
});
