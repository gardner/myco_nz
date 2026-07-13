import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFungi, FungiClientError } from "@/lib/fungi-client";
import { fungiResponse } from "@/tests/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFungi", () => {
  it("accepts the complete normalized response contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(fungiResponse)),
    );

    await expect(
      fetchFungi("86bb2955fffffff", 7, new AbortController().signal),
    ).resolves.toEqual(fungiResponse);
  });

  it.each([
    { ...fungiResponse, results: [{ ...fungiResponse.results[0], taxonId: "382779" }] },
    {
      ...fungiResponse,
      results: [
        {
          ...fungiResponse.results[0],
          observationsUrl: "https://malicious.example/observations",
        },
      ],
    },
    {
      ...fungiResponse,
      results: [
        {
          ...fungiResponse.results[0],
          image: { ...fungiResponse.results[0].image, url: "javascript:alert(1)" },
        },
      ],
    },
  ])("rejects a malformed or unsafe cached response", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );

    await expect(
      fetchFungi("86bb2955fffffff", 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("invalid-response"));
  });

  it.each([
    ["cell", { cell: "86da69a4fffffff" }],
    ["month", { requestedMonth: 8 }],
  ])("rejects a response for a different requested %s", async (_, query) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...fungiResponse,
          query: { ...fungiResponse.query, ...query },
        }),
      ),
    );

    await expect(
      fetchFungi("86bb2955fffffff", 7, new AbortController().signal),
    ).rejects.toEqual(new FungiClientError("invalid-response"));
  });
});
