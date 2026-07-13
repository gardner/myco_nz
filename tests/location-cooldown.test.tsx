// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationExperience } from "@/components/location-experience";

const pacer = vi.hoisted(() => ({
  defer: vi.fn(),
  wait: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/request-pacer", () => ({
  createRequestPacer: () => pacer,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("LocationExperience rate-limit cooldown", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?cell=86bb2955fffffff&month=7");
    localStorage.clear();
    sessionStorage.clear();
    pacer.defer.mockClear();
    pacer.wait.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts a ten-second cooldown after iNaturalist returns 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 429 })),
    );

    render(<LocationExperience />);

    expect(
      await screen.findByRole("heading", { name: "We couldn't load fungi right now" }),
    ).toBeVisible();
    expect(pacer.defer).toHaveBeenCalledOnce();
    expect(pacer.defer).toHaveBeenCalledWith(10_000);
  });
});
