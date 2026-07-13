import { describe, expect, it } from "vitest";

import {
  formatApproximatePlace,
  getApproximatePlaceForCell,
  greatCircleDistanceKm,
  locationToApproximateCell,
} from "@/lib/approximate-place";

describe("approximate New Zealand place names", () => {
  it.each([
    ["Nelson", "86da96487ffffff", "Nelson"],
    ["Wellington", "86bb2955fffffff", "Wellington"],
    ["Chatham Islands", "86bb364d7ffffff", "Waitangi"],
  ])("maps the %s cell centre to a nearby Gazetteer name", (_, cell, name) => {
    expect(getApproximatePlaceForCell(cell).name).toBe(name);
  });

  it("uses honest wording when the nearest name is further away", () => {
    expect(formatApproximatePlace({ name: "Nelson", distanceKm: 2.9 })).toBe(
      "Near Nelson",
    );
    expect(formatApproximatePlace({ name: "Te Anau", distanceKm: 33.9 })).toBe(
      "About 34 km from Te Anau",
    );
  });

  it.each([
    ["Tauranga", -37.6878, 176.1651],
    ["Dunedin", -45.8788, 170.5028],
    ["Halfmoon Bay / Oban", -46.8997, 168.1294],
    ["Waitangi", -43.9535, -176.5597],
  ])("prefers the recognisable %s name over a nearby minor locality", (name, latitude, longitude) => {
    const cell = locationToApproximateCell(latitude, longitude);
    expect(getApproximatePlaceForCell(cell).name).toBe(name);
  });

  it("measures the short route across the international date line", () => {
    expect(greatCircleDistanceKm(0, 179.9, 0, -179.9)).toBeCloseTo(22.2, 1);
  });
});
