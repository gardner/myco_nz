import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type WranglerConfig = {
  ratelimits?: unknown[];
  vars?: Record<string, unknown>;
};

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
) as WranglerConfig;

describe("Cloudflare production configuration", () => {
  it("allows the documented iNaturalist request pace for cold cache misses", () => {
    expect(config.ratelimits).toContainEqual({
      name: "INATURALIST_MISS_LIMITER",
      namespace_id: "26071301",
      simple: { limit: 60, period: 60 },
    });
  });

  it("identifies this application to iNaturalist", () => {
    expect(config.vars?.INATURALIST_USER_AGENT).toBe(
      "myco.nz/1.0 <gardner@bickford.nz>",
    );
  });
});
