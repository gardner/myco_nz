import { describe, expect, it } from "vitest";

import { formatSeasonalRange, getSeasonalMonths } from "@/lib/months";

describe("getSeasonalMonths", () => {
  it.each([
    [1, [12, 1, 2]],
    [7, [6, 7, 8]],
    [12, [11, 12, 1]],
  ] as const)("wraps the seasonal window for month %s", (month, expected) => {
    expect(getSeasonalMonths(month)).toEqual(expected);
  });
});

describe("formatSeasonalRange", () => {
  it.each([
    [1, "Dec-Feb"],
    [7, "Jun-Aug"],
    [12, "Nov-Jan"],
  ])("formats the range for month %s", (month, expected) => {
    expect(formatSeasonalRange(month)).toBe(expected);
  });
});
