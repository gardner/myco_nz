// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationExperience } from "@/components/location-experience";
import { STORAGE_KEY } from "@/lib/client-location";
import { fungiResponse } from "@/tests/fixtures";

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

function fungiResponseForRequest(input: RequestInfo | URL) {
  const path = String(input).split("/");
  const requestedMonth = Number(path.at(-1));
  return {
    ...fungiResponse,
    query: {
      ...fungiResponse.query,
      cell: path.at(-2),
      requestedMonth,
      includedMonths: [
        requestedMonth === 1 ? 12 : requestedMonth - 1,
        requestedMonth,
        requestedMonth === 12 ? 1 : requestedMonth + 1,
      ],
    },
  };
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
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      fetchResponse(fungiResponseForRequest(input)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationExperience />);

    const [firstResult] = await screen.findAllByRole("article");
    const selector = screen.getByRole("radiogroup", { name: "Month of year" });
    expect(geolocation).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/fungi/v1/en-NZ/r6/86bb2955fffffff/3",
    );
    expect(screen.getByRole("radio", { name: "March" })).toBeChecked();
    expect(
      selector.compareDocumentPosition(firstResult) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("refetches and replaces the share URL when the month changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      fetchResponse(fungiResponseForRequest(input)),
    );
    vi.stubGlobal("fetch", fetchMock);
    setGeolocation(() => undefined);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    fireEvent.click(screen.getByRole("radio", { name: "January" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "/api/fungi/v1/en-NZ/r6/86bb2955fffffff/1",
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
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      fetchResponse(fungiResponseForRequest(input)),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    fireEvent.click(screen.getByRole("radio", { name: "January" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Refresh location" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/api/fungi/v1/en-NZ/r6/86bb2955fffffff/1",
    );
    expect(window.location.search).toBe("?cell=86bb2955fffffff&month=1");
  });

  it("keeps month selection interactive while a previous month is loading", async () => {
    const pending = new Map<number, (response: Response) => void>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const month = Number(String(input).split("/").at(-1));
      if (month === 7) return fetchResponse(fungiResponseForRequest(input));
      return new Promise<Response>((resolve) => pending.set(month, resolve));
    });
    vi.stubGlobal("fetch", fetchMock);
    setGeolocation(() => undefined);
    render(<LocationExperience />);
    await screen.findByText("White Basket Fungus");

    const january = screen.getByRole("radio", { name: "January" });
    january.focus();
    fireEvent.click(january);
    await waitFor(() => expect(pending.has(1)).toBe(true));

    expect(screen.getByRole("radio", { name: "January" })).toHaveFocus();
    const february = screen.getByRole("radio", { name: "February" });
    expect(february).toBeEnabled();
    fireEvent.click(february);
    await waitFor(() => expect(pending.has(2)).toBe(true));
    pending.get(2)?.(await fetchResponse(fungiResponseForRequest(fetchMock.mock.calls[2][0])));

    expect(await screen.findByText("White Basket Fungus")).toBeVisible();
    expect(screen.getByRole("radio", { name: "February" })).toBeChecked();
    expect(window.location.search).toBe("?cell=86bb2955fffffff&month=2");
  });

  it.each([
    ["invalid", "86fffffffffffff", 400, "This shared area isn't valid"],
    [
      "outside New Zealand",
      "86be0e35fffffff",
      422,
      "Nearby Fungi currently covers Aotearoa New Zealand",
    ],
  ])(
    "does not persist a shared %s cell and offers map recovery",
    async (_, cell, status, heading) => {
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
      vi.stubGlobal("fetch", vi.fn(() => fetchResponse({ error: "Unsupported area" }, status)));

      render(<LocationExperience />);

      await screen.findByRole("heading", { name: heading });
      expect(screen.getByRole("link", { name: "Choose on map" })).toHaveAttribute(
        "href",
        "/map?month=7",
      );
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    },
  );
});
