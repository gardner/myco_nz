// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapExperience } from "@/components/map-experience";
import { consumeLocationHandoff, STORAGE_KEY } from "@/lib/client-location";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

describe("MapExperience", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/map");
    localStorage.clear();
    sessionStorage.clear();
    navigation.push.mockReset();
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => ({
        inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      }),
    });
  });

  afterEach(() => {
    consumeLocationHandoff();
    Reflect.deleteProperty(SVGSVGElement.prototype, "getScreenCTM");
  });

  it("converts a mainland map click to an H3 cell and stores no coordinates", async () => {
    render(<MapExperience />);

    expect(screen.getByRole("heading", { name: "Choose an area" })).toBeVisible();
    expect(screen.getByRole("img", { name: /map of aotearoa new zealand/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /an approximate area/i })).toHaveAttribute(
      "href",
      "https://h3geo.org/docs",
    );
    expect(screen.getByText(/directly to iNaturalist/i)).toBeVisible();

    fireEvent.click(screen.getByTestId("mainland-land"), {
      clientX: 173.284,
      clientY: 41.2706,
    });

    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        `/?cell=86da96487ffffff&month=${new Date().getMonth() + 1}`,
      ),
    );
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(JSON.parse(stored)).toMatchObject({
      version: 1,
      cell: "86da96487ffffff",
      resolution: 6,
    });
    expect(stored).not.toContain("173.284");
    expect(stored).not.toContain("-41.2706");
  });

  it("offers a keyboard-accessible named-area alternative", async () => {
    render(<MapExperience />);

    fireEvent.change(screen.getByRole("combobox", { name: "Choose a named area" }), {
      target: { value: "nelson" },
    });

    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near this area" }));

    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        `/?cell=86da96487ffffff&month=${new Date().getMonth() + 1}`,
      ),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({
      cell: "86da96487ffffff",
      resolution: 6,
    });
  });

  it("preserves a shared month when choosing a new area", async () => {
    window.history.replaceState(null, "", "/map?month=3");
    render(<MapExperience />);

    fireEvent.change(screen.getByRole("combobox", { name: "Choose a named area" }), {
      target: { value: "nelson" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show fungi near this area" }));

    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/?cell=86da96487ffffff&month=3"),
    );
  });

  it("shows a visible error when a map point cannot be converted", () => {
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => null,
    });
    render(<MapExperience />);

    fireEvent.click(screen.getByTestId("mainland-land"));

    const feedback = screen.getByRole("status");
    const map = screen.getByRole("img", { name: /map of aotearoa new zealand/i });
    expect(feedback).toBeVisible();
    expect(feedback).toHaveTextContent("couldn't use that area");
    expect(feedback.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("does not navigate after selection work is abandoned", async () => {
    const { unmount } = render(<MapExperience />);

    fireEvent.click(screen.getByTestId("mainland-land"), {
      clientX: 173.284,
      clientY: 41.2706,
    });
    unmount();

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(navigation.push).not.toHaveBeenCalled();
    expect(consumeLocationHandoff()).toBeNull();
  });
});
