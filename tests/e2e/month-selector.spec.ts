import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { getSeasonalMonths } from "../../lib/months";
import { fungiResponse } from "../fixtures";

const cell = "86bb2955fffffff";

test("loads and updates a shareable month selection at 320px", async ({ page }, testInfo) => {
  const apiRequests: string[] = [];
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("**/api/fungi/**", async (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname.split("/");
    const month = Number(path.at(-1));
    apiRequests.push(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...fungiResponse,
        query: {
          ...fungiResponse.query,
          cell: path.at(-2),
          requestedMonth: month,
          includedMonths: getSeasonalMonths(month),
        },
      }),
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
  expect(apiRequests.at(-1)).toContain(`/api/fungi/v1/en-NZ/r6/${cell}/1`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("month-selector-320.png"), fullPage: true });
});
