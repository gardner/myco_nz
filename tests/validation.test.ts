import { describe, expect, it } from "vitest";

import {
  isSupportedNzLocation,
  validateLocationCell,
} from "@/lib/validation";

describe("isSupportedNzLocation", () => {
  it.each([
    [-41.2865, 174.7762],
    [-36.8509, 174.7645],
    [-43.95, -176.55],
  ])("accepts a supported New Zealand location", (latitude, longitude) => {
    expect(isSupportedNzLocation(latitude, longitude)).toBe(true);
  });

  it("rejects a location outside New Zealand", () => {
    expect(isSupportedNzLocation(-33.8688, 151.2093)).toBe(false);
  });
});

describe("validateLocationCell", () => {
  it("accepts a canonical resolution 6 New Zealand cell", () => {
    expect(validateLocationCell("86bb2955fffffff")).toEqual({
      ok: true,
      centre: [-41.303399067821154, 174.7527153314464],
    });
  });

  it("rejects invalid, noncanonical, wrong-resolution, and overseas cells", () => {
    expect(validateLocationCell("not-an-h3-cell")).toEqual({
      ok: false,
      reason: "invalid-cell",
    });
    expect(validateLocationCell("86BB2955FFFFFFF")).toEqual({
      ok: false,
      reason: "invalid-cell",
    });
    expect(validateLocationCell("87bb29558ffffff")).toEqual({
      ok: false,
      reason: "wrong-resolution",
    });
    expect(validateLocationCell("86be0e35fffffff")).toEqual({
      ok: false,
      reason: "outside-new-zealand",
    });
  });
});
