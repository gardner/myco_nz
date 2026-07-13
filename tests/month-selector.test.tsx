// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MonthSelector } from "@/components/month-selector";

describe("MonthSelector", () => {
  it("renders twelve month boxes and exposes the selected month", () => {
    const onSelect = vi.fn();
    render(<MonthSelector selectedMonth={7} onSelect={onSelect} />);

    const group = screen.getByRole("radiogroup", { name: "Month of year" });
    const months = screen.getAllByRole("radio");
    expect(group).toContainElement(months[0]);
    expect(months).toHaveLength(12);
    expect(screen.getByRole("radio", { name: "July" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "June" })).not.toBeChecked();
    expect(screen.getByText("Jan")).toBeVisible();
    expect(screen.getByText("Jun")).toBeVisible();
    expect(screen.getByText("Jul")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "January" }));
    expect(onSelect).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("radio", { name: "July" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
