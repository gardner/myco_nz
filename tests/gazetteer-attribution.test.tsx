// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GazetteerAttribution } from "@/components/gazetteer-attribution";

describe("GazetteerAttribution", () => {
  it("links the source and licence and identifies our modifications", () => {
    render(<GazetteerAttribution />);

    expect(screen.getByRole("link", { name: /NZ Gazetteer, Toitū Te Whenua LINZ/i })).toMatchObject({
      href: "https://data.linz.govt.nz/layer/51681-nz-place-names-nzgb/",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(screen.getByRole("link", { name: /CC BY 4\.0/i })).toMatchObject({
      href: "https://creativecommons.org/licenses/by/4.0/",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(screen.getByText(/filtered and coordinate-rounded for myco\.nz/i)).toBeVisible();
  });
});
