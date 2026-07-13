import { latLngToCell } from "h3-js";
import { expect, test, type Route } from "@playwright/test";

import realSpeciesCounts from "../fixtures/inaturalist-species-counts.json" with {
  type: "json",
};
import { MAINLAND_MAP_SELECTOR, mapLocationToScreenPoint } from "./map-helpers";

const currentMonth = new Date().getMonth() + 1;
const speciesCountsRoute =
  "https://api.inaturalist.org/v1/observations/species_counts**";

function fulfillSpeciesCounts(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(realSpeciesCounts),
  });
}

test("previews a touched map cell before explicit confirmation", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 800 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const apiRequests: string[] = [];
  await page.route(speciesCountsRoute, async (route) => {
    apiRequests.push(route.request().url());
    await fulfillSpeciesCounts(route);
  });
  await page.goto("/map");
  await expect(page.getByRole("combobox", { name: "Choose a named area" })).toBeEnabled();

  const selection = await mapLocationToScreenPoint(page.locator(MAINLAND_MAP_SELECTOR), {
    latitude: -41.29682,
    longitude: 173.297512,
  });
  const expectedCell = latLngToCell(selection.latitude, selection.longitude, 6);
  await page.touchscreen.tap(selection.x, selection.y);

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByTestId("map-cell-preview")).toBeVisible();
  await expect(page.getByTestId("map-place-label")).toBeVisible();
  expect(apiRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("touch-map-preview.png"), fullPage: true });

  await page.getByRole("button", { name: "Use selected map area" }).tap();
  await expect(page).toHaveURL(`/?cell=${expectedCell}&month=${currentMonth}`);
  await expect(page.getByRole("article")).toHaveCount(3);
  expect(apiRequests).toHaveLength(1);
  await context.close();
});
