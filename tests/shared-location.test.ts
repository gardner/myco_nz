import { describe, expect, it } from "vitest";

import {
  buildSharedLocationUrl,
  parseSharedLocationSearch,
} from "@/lib/shared-location";

describe("shared location URLs", () => {
  it("parses a canonical resolution 6 cell and month", () => {
    expect(
      parseSharedLocationSearch("?cell=86bb2955fffffff&month=9"),
    ).toEqual({ cell: "86bb2955fffffff", month: 9 });
  });

  it.each([
    ["missing month", "?cell=86bb2955fffffff"],
    ["invalid cell", "?cell=87bb2955fffffff&month=9"],
    ["uppercase cell", "?cell=86BB2955FFFFFFF&month=9"],
    ["zero month", "?cell=86bb2955fffffff&month=0"],
    ["month above twelve", "?cell=86bb2955fffffff&month=13"],
    ["decimal month", "?cell=86bb2955fffffff&month=1.5"],
    ["zero-padded month", "?cell=86bb2955fffffff&month=07"],
    ["duplicate month", "?cell=86bb2955fffffff&month=7&month=8"],
  ])("rejects a %s", (_, search) => {
    expect(parseSharedLocationSearch(search)).toBeNull();
  });

  it("builds a stable share URL", () => {
    expect(buildSharedLocationUrl("86da96487ffffff", 12)).toBe(
      "/?cell=86da96487ffffff&month=12",
    );
  });
});
