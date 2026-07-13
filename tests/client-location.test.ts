// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  getApproximateCell,
  LocationAccessError,
  readStoredLocation,
  STORAGE_KEY,
  storeLocationCell,
} from "@/lib/client-location";

function geolocationReturning(latitude: number, longitude: number): Geolocation {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback) =>
      success({ coords: { latitude, longitude } } as GeolocationPosition),
    ),
    clearWatch: vi.fn(),
    watchPosition: vi.fn(),
  };
}

describe("getApproximateCell", () => {
  it("returns only a resolution 6 cell and disables high accuracy", async () => {
    const geolocation = geolocationReturning(-41.28664, 174.77557);

    await expect(getApproximateCell(geolocation)).resolves.toBe("86bb2955fffffff");
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 1_800_000 },
    );
  });

  it("distinguishes unsupported, denied, and unavailable location", async () => {
    await expect(getApproximateCell(null)).rejects.toMatchObject({ code: "unsupported" });

    const denied = geolocationReturning(0, 0);
    vi.mocked(denied.getCurrentPosition).mockImplementation((_, error) => {
      if (error) error({ code: 1 } as GeolocationPositionError);
    });
    await expect(getApproximateCell(denied)).rejects.toEqual(
      new LocationAccessError("denied"),
    );

    const unavailable = geolocationReturning(0, 0);
    vi.mocked(unavailable.getCurrentPosition).mockImplementation((_, error) => {
      if (error) error({ code: 2 } as GeolocationPositionError);
    });
    await expect(getApproximateCell(unavailable)).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("stored approximate location", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");

  it("stores and restores only the versioned cell metadata", () => {
    storeLocationCell("86bb2955fffffff", localStorage, now);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      version: 1,
      cell: "86bb2955fffffff",
      resolution: 6,
      updatedAt: now.toISOString(),
    });
    expect(readStoredLocation(localStorage, now)).toEqual({
      version: 1,
      cell: "86bb2955fffffff",
      resolution: 6,
      updatedAt: now.toISOString(),
    });
  });

  it("does not block results when location persistence is unavailable", () => {
    const unavailableStorage: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(),
      key: vi.fn(),
      removeItem: vi.fn(),
      setItem: () => {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    };

    expect(() => storeLocationCell("86bb2955fffffff", unavailableStorage, now)).not.toThrow();
  });

  it.each([
    ["malformed", "{"],
    ["wrong version", JSON.stringify({ version: 2, cell: "86bb2955fffffff" })],
    [
      "expired",
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: "2026-06-12T23:59:59.000Z",
      }),
    ],
    [
      "future dated",
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: "2026-07-13T00:00:01.000Z",
      }),
    ],
  ])("ignores %s storage", (_, value) => {
    localStorage.setItem(STORAGE_KEY, value);
    expect(readStoredLocation(localStorage, now)).toBeNull();
  });
});
