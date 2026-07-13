// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MapPage from "@/app/map/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("MapPage", () => {
  it("is a directly renderable map route with a way back", async () => {
    render(<MapPage />);

    expect(await screen.findByRole("heading", { name: "Choose an area" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Back to Nearby Fungi" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
