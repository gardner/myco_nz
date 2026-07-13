import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type WranglerConfig = {
  cache?: {
    enabled?: boolean;
    cross_version_cache?: boolean;
  };
  ratelimits?: unknown[];
  vars?: Record<string, unknown>;
};

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
) as WranglerConfig;

describe("Cloudflare production configuration", () => {
  it("isolates cached pages between Worker versions", () => {
    expect(config.cache).toEqual({
      enabled: true,
      cross_version_cache: false,
    });
  });

  it("does not expose obsolete upstream proxy bindings", () => {
    expect(config.ratelimits ?? []).toEqual([]);
    expect(config.vars ?? {}).toEqual({});
  });
});
