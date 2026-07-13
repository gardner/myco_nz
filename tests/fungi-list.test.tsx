// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FungiList } from "@/components/fungi-list";
import { fungiResponse } from "@/tests/fixtures";

describe("FungiList", () => {
  it("renders ranked, attributed results with a clear external action", () => {
    render(<FungiList results={fungiResponse.results.slice(0, 1)} />);

    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(screen.getByRole("article")).toHaveTextContent("White Basket Fungus");
    expect(screen.getByText("Ileodictyon cibarium").tagName).toBe("I");
    expect(screen.getByText("(c) k_fordyce, some rights reserved (CC BY-NC)")).toBeVisible();
    expect(screen.getByText("CC BY-NC")).toBeVisible();
    expect(screen.getByRole("img")).toHaveAttribute(
      "alt",
      "Photo of White Basket Fungus (Ileodictyon cibarium)",
    );
    expect(screen.getByRole("link", { name: /view nearby observations/i })).toMatchObject({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("links the photo to the taxon's iNaturalist photo browser", () => {
    const result = {
      ...fungiResponse.results[0],
      taxonId: 500194,
      commonName: null,
      scientificName: "Rossbeevera pachydermis",
    };
    render(<FungiList results={[result]} />);

    const photoLink = screen.getByRole("link", {
      name: /browse photos of rossbeevera pachydermis/i,
    });

    expect(photoLink).toHaveAttribute(
      "href",
      "https://www.inaturalist.nz/taxa/500194-Rossbeevera-pachydermis/browse_photos",
    );
    expect(photoLink).toMatchObject({
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(photoLink).toContainElement(screen.getByRole("img"));
    expect(
      screen.getByRole("link", { name: /view nearby observations/i }),
    ).toBeVisible();
  });

  it("uses defined name and image fallbacks", () => {
    const result = {
      ...fungiResponse.results[0],
      commonName: null,
      image: null,
    };
    const { container } = render(<FungiList results={[result]} />);

    expect(screen.getByText("No common name listed")).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", "/fungi-placeholder.svg");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("removes obsolete attribution when a remote photo fails", () => {
    render(<FungiList results={fungiResponse.results.slice(0, 1)} />);

    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByText(/k_fordyce/)).not.toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "/fungi-placeholder.svg");
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });
});
