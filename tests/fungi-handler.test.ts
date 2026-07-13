import { describe, expect, it, vi } from "vitest";

import { handleFungiRequest, type FungiHandlerDependencies } from "@/lib/fungi-handler";

const cell = "86bb2955fffffff";
const requestUrl = `https://example.nz/api/fungi/v1/en-NZ/r6/${cell}/7`;

function upstreamResponse(status = 200, body: unknown = { results: [] }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createDependencies(
  fetchResponse: Response = upstreamResponse(),
  limiterSuccess = true,
): FungiHandlerDependencies & {
  fetch: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn(async () => fetchResponse);
  const limit = vi.fn(async () => ({ success: limiterSuccess }));

  return {
    fetch,
    limit,
    now: () => new Date("2026-07-13T00:00:00.000Z"),
    userAgent: "myco.nz/1.0 <gardner@bickford.nz>",
    log: vi.fn(),
  };
}

describe("handleFungiRequest", () => {
  it("rate limits the cache miss and returns a cacheable normalised response", async () => {
    const dependencies = createDependencies(
      upstreamResponse(200, {
        results: [{ count: 2, taxon: { id: 123, name: "Amanita muscaria" } }],
      }),
    );

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(dependencies.limit).toHaveBeenCalledWith({ key: "species-counts-v1" });
    expect(dependencies.fetch).toHaveBeenCalledOnce();
    const [upstreamUrl, init] = dependencies.fetch.mock.calls[0];
    expect(String(upstreamUrl)).toContain("/observations/species_counts?");
    expect(init).toMatchObject({
      headers: {
        Accept: "application/json",
        "User-Agent": dependencies.userAgent,
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=1209600, stale-while-revalidate=5184000, stale-if-error=7776000",
    );
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      results: [{ rank: 1, taxonId: 123 }],
    });
  });

  it.each([
    ["invalid cell", "not-a-cell", "7", requestUrl, 400],
    ["wrong resolution", "87bb29558ffffff", "7", requestUrl, 400],
    ["outside New Zealand", "86be0e35fffffff", "7", requestUrl, 422],
    ["invalid month", cell, "07", requestUrl, 400],
    ["query parameters", cell, "7", `${requestUrl}?radius=100`, 400],
  ])("rejects %s before rate limiting or fetching", async (_, inputCell, rawMonth, url, status) => {
    const dependencies = createDependencies();

    const response = await handleFungiRequest(
      { request: new Request(url), cell: inputCell, rawMonth },
      dependencies,
    );

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.limit).not.toHaveBeenCalled();
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when the rate limiter rejects the request", async () => {
    const dependencies = createDependencies(upstreamResponse(), false);

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])("maps upstream %s to an uncached 503", async (status) => {
    const dependencies = createDependencies(upstreamResponse(status));

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("maps malformed upstream data to an uncached 502", async () => {
    const dependencies = createDependencies(
      upstreamResponse(200, { results: [{ count: 2, taxon: {} }] }),
    );

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("maps malformed upstream JSON to an uncached 502", async () => {
    const dependencies = createDependencies(
      new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fails closed when the rate limit binding throws", async () => {
    const dependencies = createDependencies();
    dependencies.limit.mockRejectedValue(new Error("binding unavailable"));

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it("maps a network failure to an uncached 503", async () => {
    const dependencies = createDependencies();
    dependencies.fetch.mockRejectedValue(new TypeError("network failure"));

    const response = await handleFungiRequest(
      { request: new Request(requestUrl), cell, rawMonth: "7" },
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
