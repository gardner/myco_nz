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

type PackageJson = {
  scripts: Record<string, string>;
};

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
) as WranglerConfig;
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageJson;

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

  it("starts the built Worker beside its generated asset directory", () => {
    const command = "cd dist/server && wrangler dev --config wrangler.json";

    expect(packageJson.scripts.start).toBe(command);
    expect(packageJson.scripts["start:vinext"]).toBe(command);
  });
});
