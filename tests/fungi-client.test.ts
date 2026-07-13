import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFungi, FungiClientError } from "@/lib/fungi-client";
import realSpeciesCounts from "@/tests/fixtures/inaturalist-species-counts.json";

const cell = "86bb2955fffffff";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchFungi", () => {
  it("fetches and normalises species counts directly from iNaturalist", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json(realSpeciesCounts));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchFungi(cell, 7, new AbortController().signal);

    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.inaturalist.org/v1/observations/species_counts",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      lat: "-41.30340",
      lng: "174.75272",
      month: "6,7,8",
      iconic_taxa: "Fungi",
      quality_grade: "research",
    });
    expect(init).toMatchObject({
      credentials: "omit",
      headers: { Accept: "application/json" },
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    const headers = new Headers(init?.headers);
    expect(headers.has("User-Agent")).toBe(false);
    expect(headers.has("X-Via")).toBe(false);
    expect(result.query).toMatchObject({ cell, requestedMonth: 7, includedMonths: [6, 7, 8] });
    expect(result.results[0]).toMatchObject({
      taxonId: 382779,
      commonName: "White Basket Fungus",
    });
  });

  it.each([
    ["invalid", "86fffffffffffff", "invalid-location"],
    ["outside New Zealand", "86be0e35fffffff", "outside-new-zealand"],
  ] as const)("rejects an %s cell before fetching", async (_, inputCell, code) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchFungi(inputCell, 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError(code));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, 13, 1.5])("rejects invalid month %s before fetching", async (month) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchFungi(cell, month, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("invalid-location"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("identifies an iNaturalist throttle for local cooldown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));

    await expect(
      fetchFungi(cell, 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("rate-limited"));
  });

  it("stops waiting when iNaturalist does not respond", async () => {
    vi.useFakeTimers();
    let markFetchStarted: (() => void) | undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        markFetchStarted?.();
        return new Promise<Response>(() => undefined);
      }),
    );

    const request = fetchFungi(cell, 7, new AbortController().signal);
    const rejection = expect(request).rejects.toEqual(
      new FungiClientError("unavailable"),
    );
    await fetchStarted;
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
  });

  it("maps malformed JSON to an invalid upstream response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("not json", {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      fetchFungi(cell, 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("invalid-response"));
  });

  it("rejects malformed or unsafe upstream media", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              count: 1,
              taxon: {
                id: 123,
                name: "Example fungus",
                default_photo: { square_url: "javascript:alert(1)" },
              },
            },
          ],
        }),
      ),
    );

    await expect(
      fetchFungi(cell, 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("invalid-response"));
  });
});
