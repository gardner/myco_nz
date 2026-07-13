// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationExperience } from "@/components/location-experience";
import { STORAGE_KEY } from "@/lib/client-location";
import { fungiResponse } from "@/tests/fixtures";

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
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an explicit, private location action", () => {
    render(<LocationExperience />);

    expect(screen.getByRole("heading", { name: "Fungi likely near you" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show fungi near me" })).toBeVisible();
    expect(screen.getByText(/exact location stays on this device/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /an approximate area/i })).toMatchObject({
      href: "https://h3geo.org/docs",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("converts location locally, fetches only by cell, and renders results", async () => {
    const exactLatitude = -41.28664;
    const exactLongitude = 174.77557;
    setGeolocation((success) =>
      success({ coords: { latitude: exactLatitude, longitude: exactLongitude } } as GeolocationPosition),
    );
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return fetchResponse(fungiResponse);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));

    expect(await screen.findByRole("heading", { name: "Most often observed near you" })).toBeVisible();
    expect(screen.getByText("White Basket Fungus")).toBeVisible();
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain("/api/fungi/v1/en-NZ/r6/86bb2955fffffff/");
    expect(requestedUrl).not.toContain(String(exactLatitude));
    expect(requestedUrl).not.toContain(String(exactLongitude));
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
    vi.stubGlobal("fetch", vi.fn(() => fetchResponse(fungiResponse)));

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
    expect(brand.closest("header")).toBe(heading.closest("header"));
    expect(refreshButton.closest("header")).toBe(heading.closest("header"));
  });

  it("shows the denied-location recovery state", async () => {
    setGeolocation((_, error) => error({ code: 1 } as GeolocationPositionError));
    render(<LocationExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));

    expect(await screen.findByRole("heading", { name: "Location access is off" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Location access is off");
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
    expect(await screen.findByRole("heading", { name: "Location access is off" })).toBeVisible();

    resolveFetch?.(
      new Response(JSON.stringify(fungiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() => expect(screen.queryByText("White Basket Fungus")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Location access is off" })).toBeVisible();
  });

  it("renders empty and upstream error states", async () => {
    const geolocation = setGeolocation((success) =>
      success({ coords: { latitude: -41.28664, longitude: 174.77557 } } as GeolocationPosition),
    );
    const fetchMock = vi.fn(() => fetchResponse({ ...fungiResponse, results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));
    expect(await screen.findByRole("heading", { name: "Not enough local records yet" })).toBeVisible();

    unmount();
    localStorage.clear();
    fetchMock.mockImplementation(() => fetchResponse({ error: "Unavailable" }, 503));
    render(<LocationExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near me" }));
    expect(await screen.findByRole("heading", { name: "We couldn't load fungi right now" })).toBeVisible();
    await waitFor(() => expect(geolocation).toHaveBeenCalledTimes(2));
  });
});
