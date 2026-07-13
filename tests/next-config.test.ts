import { describe, expect, it } from "vitest";

import { getContentSecurityPolicy } from "@/next.config";

describe("getContentSecurityPolicy", () => {
  it("does not upgrade HTTP development assets to HTTPS", () => {
    expect(getContentSecurityPolicy(false)).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("upgrades insecure requests in production", () => {
    expect(getContentSecurityPolicy(true)).toContain(
      "upgrade-insecure-requests",
    );
  });

  it("allows direct requests to the public iNaturalist API", () => {
    expect(getContentSecurityPolicy(true)).toContain(
      "connect-src 'self' https://api.inaturalist.org",
    );
  });
});
