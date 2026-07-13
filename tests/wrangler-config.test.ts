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
  it("does not expose obsolete upstream proxy bindings", () => {
    expect(config.ratelimits ?? []).toEqual([]);
    expect(config.vars ?? {}).toEqual({});
  });
});
