import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import realSpeciesCounts from "../fixtures/inaturalist-species-counts.json" with {
  type: "json",
};

const cell = "86bb2955fffffff";
const speciesCountsRoute =
  "https://api.inaturalist.org/v1/observations/species_counts**";

test("loads and updates a shareable month selection at 320px", async ({ page }, testInfo) => {
  const apiRequests: string[] = [];
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route(speciesCountsRoute, async (route) => {
    const url = route.request().url();
    apiRequests.push(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(realSpeciesCounts),
    });
  });

  await page.goto(`/?cell=${cell}&month=7`);

  const selector = page.getByRole("radiogroup", { name: "Month of year" });
  const selectorViewport = selector.locator("..");
  const monthOptions = selector.getByRole("radio");
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(monthOptions).toHaveCount(12);
  await expect(page.getByRole("radio", { name: "July" })).toBeChecked();
  await expect(page.getByText("Jul", { exact: true })).toBeVisible();
  const januaryBox = await page.getByText("Jan", { exact: true }).boundingBox();
  expect(januaryBox?.width).toBeGreaterThanOrEqual(44);
  expect(januaryBox?.height).toBeGreaterThanOrEqual(44);
  expect((await selectorViewport.boundingBox())?.width).toBeLessThanOrEqual(288);
  expect((await selector.boundingBox())?.y).toBeLessThan(
    (await page.getByRole("article").first().boundingBox())?.y ?? 0,
  );

  const january = page.getByRole("radio", { name: "January" });
  await january.focus();
  await january.press("Space");

  await expect(page).toHaveURL(`/?cell=${cell}&month=1`);
  await expect(january).toBeChecked();
  await expect(january).toBeFocused();
  await expect
    .poll(() => new URL(apiRequests.at(-1)!).searchParams.get("month"))
    .toBe("12,1,2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("month-selector-320.png"), fullPage: true });
});
