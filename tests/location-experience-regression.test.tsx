// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationExperience } from "@/components/location-experience";
import { STORAGE_KEY } from "@/lib/client-location";
import realSpeciesCounts from "@/tests/fixtures/inaturalist-species-counts.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

function requestedMonth(input: RequestInfo | URL): number {
  return Number(new URL(String(input)).searchParams.get("month")?.split(",")[1]);
}

function createSpeciesCountsFetch() {
  return vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(() => fetchResponse(realSpeciesCounts));
}

describe("LocationExperience request regressions", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?cell=86bb2955fffffff&month=7");
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a shared cell and month without requesting location", async () => {
    window.history.replaceState(null, "", "/?cell=86bb2955fffffff&month=3");
    const geolocation = setGeolocation(() => undefined);
    const fetchMock = createSpeciesCountsFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationExperience />);

    const [firstResult] = await screen.findAllByRole("article");
    const selector = screen.getByRole("radiogroup", { name: "Month of year" });
    expect(geolocation).not.toHaveBeenCalled();
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
      "https://api.inaturalist.org/v1/observations/species_counts",
    );
    expect(Object.fromEntries(requestUrl.searchParams)).toMatchObject({
      lat: "-41.30340",
      lng: "174.75272",
      month: "2,3,4",
      iconic_taxa: "Fungi",
      quality_grade: "research",
    });
    expect(screen.getByRole("radio", { name: "March" })).toBeChecked();
    expect(
      selector.compareDocumentPosition(firstResult) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("refetches and replaces the share URL when the month changes", async () => {
    const fetchMock = createSpeciesCountsFetch();
    vi.stubGlobal("fetch", fetchMock);
    setGeolocation(() => undefined);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    fireEvent.click(screen.getByRole("radio", { name: "January" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("month")).toBe(
      "12,1,2",
    );
    expect(window.location.pathname + window.location.search).toBe(
      "/?cell=86bb2955fffffff&month=1",
    );
    expect(await screen.findByRole("radio", { name: "January" })).toBeChecked();
  });

  it("keeps the selected month when refreshing the approximate location", async () => {
    setGeolocation((success) =>
      success({ coords: { latitude: -41.28664, longitude: 174.77557 } } as GeolocationPosition),
    );
    const fetchMock = createSpeciesCountsFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    fireEvent.click(screen.getByRole("radio", { name: "January" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Refresh location" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(new URL(String(fetchMock.mock.calls[2][0])).searchParams.get("month")).toBe(
      "12,1,2",
    );
    expect(window.location.search).toBe("?cell=86bb2955fffffff&month=1");
  });

  it("coalesces rapid month choices while keeping the selector interactive", async () => {
    const fetchMock = createSpeciesCountsFetch();
    vi.stubGlobal("fetch", fetchMock);
    setGeolocation(() => undefined);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    const january = screen.getByRole("radio", { name: "January" });
    january.focus();
    fireEvent.click(january);
    expect(screen.getByRole("radio", { name: "January" })).toHaveFocus();
    const february = screen.getByRole("radio", { name: "February" });
    expect(february).toBeEnabled();
    fireEvent.click(february);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    expect(requestedMonth(fetchMock.mock.calls[1][0])).toBe(2);
    expect(screen.getByRole("radio", { name: "February" })).toBeChecked();
    expect(window.location.search).toBe("?cell=86bb2955fffffff&month=2");
  });

  it.each([
    ["invalid", "86fffffffffffff", "This shared area isn't valid"],
    [
      "outside New Zealand",
      "86be0e35fffffff",
      "Nearby Fungi currently covers Aotearoa New Zealand",
    ],
  ])(
    "does not persist a shared %s cell and offers map recovery",
    async (_, cell, heading) => {
      window.history.replaceState(null, "", `/?cell=${cell}&month=7`);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          cell,
          resolution: 6,
          updatedAt: new Date().toISOString(),
        }),
      );
      setGeolocation(() => undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      render(<LocationExperience />);

      await screen.findByRole("heading", { name: heading });
      expect(screen.getByRole("link", { name: "Choose on map" })).toHaveAttribute(
        "href",
        "/map?month=7",
      );
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
