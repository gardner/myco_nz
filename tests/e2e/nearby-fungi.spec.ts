import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fungiResponse } from "../fixtures";

const exactLocation = { latitude: -41.28664, longitude: 174.77557 };
const appPath = "/?disable_location_seed=1";

test.describe("Nearby Fungi", () => {
  test.use({
    viewport: { width: 360, height: 800 },
    geolocation: exactLocation,
    permissions: ["geolocation"],
  });

  test("keeps exact coordinates local and renders an accessible mobile result list", async ({
    page,
  }, testInfo) => {
    const apiRequests: string[] = [];
    await page.route("**/api/fungi/**", async (route) => {
      apiRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fungiResponse),
      });
    });

    await page.goto(appPath);
    await page.getByRole("button", { name: "Show fungi near me" }).click();

    const resultsHeading = page.getByRole("heading", { name: "Most often observed near you" });
    await expect(resultsHeading).toBeVisible();
    await expect(resultsHeading).toBeFocused();
    const resultsHeader = page.locator("header").filter({ has: resultsHeading });
    await expect(resultsHeader.getByText("Nearby Fungi")).toBeVisible();
    const refreshButton = page.getByRole("button", { name: "Refresh location" });
    await expect(refreshButton).toHaveAttribute("title", "Refresh location");
    await expect(refreshButton).toHaveText("");
    const refreshBox = await refreshButton.boundingBox();
    expect(refreshBox?.width).toBeGreaterThanOrEqual(44);
    expect(refreshBox?.height).toBeGreaterThanOrEqual(44);
    expect((await resultsHeader.boundingBox())?.height).toBeLessThanOrEqual(150);
    await expect(page.getByRole("article")).toHaveCount(3);
    expect(apiRequests).toHaveLength(1);
    expect(apiRequests[0]).toContain("/api/fungi/v1/en-NZ/r6/86bb2955fffffff/");
    expect(apiRequests[0]).not.toContain(String(exactLocation.latitude));
    expect(apiRequests[0]).not.toContain(String(exactLocation.longitude));

    const observationsLink = page.getByRole("link", { name: /view nearby observations/i }).first();
    await expect(observationsLink).toHaveAttribute("target", "_blank");
    await expect(observationsLink).toHaveAttribute("rel", "noopener noreferrer");
    await expect
      .poll(() => page.getByRole("img", { name: /photo of white basket fungus/i }).evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("mobile-results.png"), fullPage: true });
  });

  test("restores a fresh approximate cell without another location action", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nearby-fungi:location:v1",
        JSON.stringify({
          version: 1,
          cell: "86bb2955fffffff",
          resolution: 6,
          updatedAt: new Date().toISOString(),
        }),
      );
    });
    await page.route("**/api/fungi/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fungiResponse),
      }),
    );

    await page.goto(appPath);

    await expect(page.getByText("White Basket Fungus")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh location" })).toBeVisible();
  });
});

test("shows a recovery path when location permission is denied", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
      },
    });
  });
  const page = await context.newPage();

  await page.goto(appPath);
  await page.getByRole("button", { name: "Show fungi near me" }).click();

  await expect(page.getByRole("heading", { name: "Location access is off" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Location access is off" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await context.close();
});

test("keeps the result column readable on desktop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "nearby-fungi:location:v1",
      JSON.stringify({
        version: 1,
        cell: "86bb2955fffffff",
        resolution: 6,
        updatedAt: new Date().toISOString(),
      }),
    );
  });
  await page.route("**/api/fungi/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fungiResponse),
    }),
  );

  await page.goto(appPath);
  await expect(page.getByRole("article")).toHaveCount(3);
  const resultsHeading = page.getByRole("heading", { name: "Most often observed near you" });
  const resultsHeader = page.locator("header").filter({ has: resultsHeading });
  await expect(resultsHeader.getByText("Nearby Fungi")).toBeVisible();
  await expect(resultsHeader.getByRole("button", { name: "Refresh location" })).toBeVisible();
  expect((await resultsHeader.boundingBox())?.height).toBeLessThanOrEqual(80);
  await expect
    .poll(() => page.getByRole("img", { name: /photo of white basket fungus/i }).evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const contentWidth = await page.locator(".page-content").evaluate((element) =>
    element.getBoundingClientRect().width,
  );
  expect(contentWidth).toBeLessThanOrEqual(760);
  await page.screenshot({ path: testInfo.outputPath("desktop-results.png"), fullPage: true });
});
