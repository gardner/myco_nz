import { describe, expect, it } from "vitest";

import {
  GET,
  HEAD,
} from "@/app/api/fungi/v1/en-NZ/r6/[cell]/[month]/route";

const cell = "86da82797ffffff";
const legacyUrl = `https://myco.nz/api/fungi/v1/en-NZ/r6/${cell}/7`;
const context = {
  params: Promise.resolve({ cell, month: "7" }),
};

describe("legacy fungi route", () => {
  it("redirects old data URLs to the shareable result page", async () => {
    const response = await GET(new Request(legacyUrl), context);

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(
      `https://myco.nz/?cell=${cell}&month=7`,
    );
  });

  it("provides the same redirect for HEAD without a body", async () => {
    const response = await HEAD(new Request(legacyUrl, { method: "HEAD" }), context);

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(
      `https://myco.nz/?cell=${cell}&month=7`,
    );
    await expect(response.text()).resolves.toBe("");
  });

  it.each(["0", "07", "13", "January"])(
    "rejects noncanonical month %s",
    async (month) => {
      const response = await GET(new Request(legacyUrl), {
        params: Promise.resolve({ cell, month }),
      });

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.has("Location")).toBe(false);
    },
  );
});
