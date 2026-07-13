// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationExperience } from "@/components/location-experience";
import { markResultsForFocus, STORAGE_KEY } from "@/lib/client-location";
import { getSeasonalMonths } from "@/lib/months";
import realSpeciesCounts from "@/tests/fixtures/inaturalist-species-counts.json";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function setGeolocation(
  implementation: (success: PositionCallback, error: PositionErrorCallback) => void,
) {
  const getCurrentPosition = vi.fn(implementation);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}

function fetchResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("LocationExperience", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    sessionStorage.clear();
    replaceMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an explicit, private location action", () => {
    render(<LocationExperience />);

    expect(screen.getByRole("heading", { name: "Fungi likely near you" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show fungi near me" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose on map" })).toHaveAttribute("href", "/map");
    expect(screen.getByText(/exact location stays on this device/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /an approximate area/i })).toMatchObject({
      href: "https://h3geo.org/docs",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(screen.getByText(/directly to iNaturalist/i)).toBeVisible();
  });

  it("converts location locally and fetches using only the approximate cell centre", async () => {
    const exactLatitude = -41.28664;
    const exactLongitude = 174.77557;
    setGeolocation((success) =>
      success({ coords: { latitude: exactLatitude, longitude: exactLongitude } } as GeolocationPosition),
    );
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(() => fetchResponse(realSpeciesCounts));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));

    expect(await screen.findByRole("heading", { name: "Most often observed near you" })).toBeVisible();
    expect(await screen.findByText("Near Wellington")).toBeVisible();
    expect(screen.getByText("White Basket Fungus")).toBeVisible();
    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${requestedUrl.origin}${requestedUrl.pathname}`).toBe(
      "https://api.inaturalist.org/v1/observations/species_counts",
    );
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      lat: "-41.30340",
      lng: "174.75272",
      radius: "30",
      month: getSeasonalMonths(new Date().getMonth() + 1).join(","),
      iconic_taxa: "Fungi",
      rank: "species",
      quality_grade: "research",
    });
    expect(requestedUrl.toString()).not.toContain(String(exactLatitude));
    expect(requestedUrl.toString()).not.toContain(String(exactLongitude));
    expect(window.location.search).toBe(
      `?cell=86bb2955fffffff&month=${new Date().getMonth() + 1}`,
    );
  });

  it("automatically loads a fresh stored cell without requesting location", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: new Date().toISOString(),
      }),
    );
    const geolocation = setGeolocation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => fetchResponse(realSpeciesCounts)));

    render(<LocationExperience />);

    expect(await screen.findByText("White Basket Fungus")).toBeVisible();
    expect(geolocation).not.toHaveBeenCalled();
    const brand = screen.getByText("Nearby Fungi");
    const heading = screen.getByRole("heading", {
      name: "Most often observed near you",
    });
    const refreshButton = screen.getByRole("button", { name: "Refresh location" });
    expect(brand).toBeVisible();
    expect(refreshButton).toBeVisible();
    expect(refreshButton).toHaveAttribute("title", "Refresh location");
    expect(refreshButton).toHaveTextContent("");
    expect(
      refreshButton.querySelector('[data-icon="new-zealand"]'),
    ).toBeInTheDocument();
    expect(brand.closest("header")).toBe(heading.closest("header"));
    expect(refreshButton.closest("header")).toBe(heading.closest("header"));
  });

  it("focuses map-selected results after restoring their cell", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: new Date().toISOString(),
      }),
    );
    markResultsForFocus(sessionStorage);
    setGeolocation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => fetchResponse(realSpeciesCounts)));

    render(<LocationExperience />);

    expect(
      await screen.findByRole("heading", { name: "Most often observed near you" }),
    ).toHaveFocus();
  });

  it("moves denied location access to the map route", async () => {
    setGeolocation((_, error) => error({ code: 1 } as GeolocationPositionError));
    render(<LocationExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(`/map?month=${new Date().getMonth() + 1}`),
    );
  });

  it("discards a pending location result after leaving the experience", async () => {
    let resolveLocation: PositionCallback | undefined;
    setGeolocation((success) => {
      resolveLocation = success;
    });
    const fetchMock = vi.fn(() => fetchResponse(realSpeciesCounts));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<LocationExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));
    unmount();
    resolveLocation?.({
      coords: { latitude: -41.28664, longitude: 174.77557 },
    } as GeolocationPosition);

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    {
      name: "unsupported",
      configure: () => {
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: undefined,
        });
      },
      heading: "Location isn't available",
    },
    {
      name: "unavailable",
      configure: () => setGeolocation((_, error) => error({ code: 2 } as GeolocationPositionError)),
      heading: "We couldn't find your area",
    },
  ])("offers map recovery when location is $name", async ({ configure, heading }) => {
    configure();
    render(<LocationExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));

    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose on map" })).toHaveAttribute("href", "/map");
  });

  it("does not let an obsolete load overwrite a refresh failure", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: new Date().toISOString(),
      }),
    );
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);
    setGeolocation((_, error) => error({ code: 1 } as GeolocationPositionError));

    render(<LocationExperience />);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh location" }));
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(`/map?month=${new Date().getMonth() + 1}`),
    );

    resolveFetch?.(
      new Response(JSON.stringify(realSpeciesCounts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() => expect(screen.queryByText("White Basket Fungus")).not.toBeInTheDocument());
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("renders empty and upstream error states", async () => {
    const geolocation = setGeolocation((success) =>
      success({ coords: { latitude: -41.28664, longitude: 174.77557 } } as GeolocationPosition),
    );
    const fetchMock = vi.fn(() =>
      fetchResponse({ ...realSpeciesCounts, results: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));
    expect(await screen.findByRole("heading", { name: "Not enough local records yet" })).toBeVisible();

    unmount();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    fetchMock.mockImplementation(() => fetchResponse({ error: "Unavailable" }, 503));
    render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));
    expect(await screen.findByRole("heading", { name: "We couldn't load fungi right now" })).toBeVisible();
    await waitFor(() => expect(geolocation).toHaveBeenCalledTimes(2));
  });
});
