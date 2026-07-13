import { latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";

import {
  CHATHAM_PATHS,
  CHATHAM_VIEW_BOX,
  MAINLAND_PATHS,
  MAINLAND_VIEW_BOX,
  NZ_MAP_PROVENANCE,
  clientPointToLocation,
} from "@/lib/nz-map-geometry";

describe("New Zealand map geometry", () => {
  it("records the source and exposes deterministic SVG paths", () => {
    expect(NZ_MAP_PROVENANCE).toMatchObject({
      dataset: "Natural Earth 1:10m Admin 0 - Countries",
      version: "5.1.1",
      license: "Public domain",
    });
    expect(MAINLAND_PATHS).toHaveLength(5);
    expect(CHATHAM_PATHS).toHaveLength(1);
    for (const path of [...MAINLAND_PATHS, ...CHATHAM_PATHS]) {
      expect(path).toMatch(/^M-?[\d.]+ [\d.]+L/);
      expect(path.endsWith("Z")).toBe(true);
    }
  });

  it("uses geographic longitude and negative latitude as SVG coordinates", () => {
    expect(MAINLAND_VIEW_BOX).toBe("165.8 34 13.2 13.5");
    expect(CHATHAM_VIEW_BOX).toBe("-176.75 43.65 0.55 0.55");
    expect(MAINLAND_PATHS.join("")).toContain("L174.7406 41.3466");
    expect(CHATHAM_PATHS[0]).toContain("M-176.3820 43.8986");
  });

  it("maps a client point through the SVG transform into an H3-ready location", () => {
    const svg = svgWithInverse({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    const result = clientPointToLocation(svg, 173.284, 41.2706);

    expect(result).not.toBeNull();
    expect(latLngToCell(result!.latitude, result!.longitude, 6)).toBe(
      "86da96487ffffff",
    );
    expect(result).toEqual({ latitude: -41.2706, longitude: 173.284 });
  });

  it("handles scaled and translated SVGs", () => {
    const svg = svgWithInverse({
      a: 0.5,
      b: 0,
      c: 0,
      d: 1 / 3,
      e: -5,
      f: -20 / 3,
    });
    const result = clientPointToLocation(
      svg,
      173.284 * 2 + 10,
      41.2706 * 3 + 20,
    );

    expect(result?.latitude).toBeCloseTo(-41.2706, 8);
    expect(result?.longitude).toBeCloseTo(173.284, 8);
  });

  it("preserves Chatham's canonical longitude for H3 indexing", () => {
    const svg = svgWithInverse({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    const result = clientPointToLocation(svg, -176.5597, 43.9535);

    expect(result).toEqual({ latitude: -43.9535, longitude: -176.5597 });
    expect(latLngToCell(result!.latitude, result!.longitude, 6)).toBe(
      "86bb364d7ffffff",
    );
  });

  it("returns null when the SVG has no screen transform", () => {
    const svg = { getScreenCTM: () => null } as unknown as SVGSVGElement;

    expect(clientPointToLocation(svg, 173.284, 41.2706)).toBeNull();
  });
});

function svgWithInverse(matrix: Partial<DOMMatrix>): SVGSVGElement {
  return {
    getScreenCTM: () => ({ inverse: () => matrix }) as DOMMatrix,
  } as unknown as SVGSVGElement;
}
