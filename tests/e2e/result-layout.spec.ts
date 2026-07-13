import { expect, test } from "@playwright/test";

import realSpeciesCounts from "../fixtures/inaturalist-species-counts.json" with {
  type: "json",
};

test("wraps a real long Gazetteer label in the mobile results header", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route(
    "https://api.inaturalist.org/v1/observations/species_counts**",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(realSpeciesCounts),
      }),
  );

  await page.goto("/?cell=86da82237ffffff&month=7");

  const area = page.getByTestId("approximate-area-label");
  await expect(page.getByRole("link", {
    name: "View Lake Ohau Alpine Village on map",
  })).toBeVisible();
  await expect(area).toContainText(
    "About 36 km from Lake Ohau Alpine Village",
  );
  await expect(area).toBeVisible();
  expect(
    await area.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("long-area-label.png"), fullPage: true });
});
