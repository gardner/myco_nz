import AxeBuilder from "@axe-core/playwright";
import { latLngToCell } from "h3-js";
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

test("routes denied location access to the map", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
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

  await expect(page).toHaveURL(/\/map$/);
  const heading = page.getByRole("heading", { name: "Choose an area" });
  await expect(heading).toBeFocused();
  await expect(page.getByRole("img", { name: /map of aotearoa new zealand/i })).toBeVisible();
  const namedArea = page.getByRole("combobox", { name: "Choose a named area" });
  await expect(namedArea).toBeEnabled();
  await namedArea.selectOption("nelson");
  const namedAreaButton = page.getByRole("button", { name: "Show fungi near this area" });
  await expect(namedAreaButton).toBeEnabled();
  expect((await namedArea.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  expect((await namedAreaButton.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await expect(page).toHaveURL(/\/map$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("mobile-map.png"), fullPage: true });
  await context.close();
});

test("converts a map click locally and loads results by H3 cell", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const apiRequests: string[] = [];
  await page.route("**/api/fungi/**", async (route) => {
    apiRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fungiResponse),
    });
  });
  await page.goto("/map");
  await expect(page.getByRole("combobox", { name: "Choose a named area" })).toBeEnabled();

  const mainland = page.locator('svg[viewBox="165.8 34 13.2 13.5"]');
  const selection = await mainland.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = 173.297512;
    point.y = 41.29682;
    const screenPoint = point.matrixTransform(svg.getScreenCTM()!);
    const x = Math.floor(screenPoint.x);
    const y = Math.floor(screenPoint.y);
    const mapPoint = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x, y, latitude: -mapPoint.y, longitude: mapPoint.x };
  });
  const expectedCell = latLngToCell(selection.latitude, selection.longitude, 6);
  await page.mouse.click(selection.x, selection.y);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Most often observed near you" })).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(3);
  expect(apiRequests).toHaveLength(1);
  expect(apiRequests[0]).toContain(`/api/fungi/v1/en-NZ/r6/${expectedCell}/`);
  expect(apiRequests[0]).not.toContain(String(selection.longitude));
  expect(apiRequests[0]).not.toContain(String(selection.latitude));

  await page.goBack();
  await expect(page).toHaveURL(/\/map$/);
});

test("keeps map conversion errors in the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("**/*h3-js*", (route) => route.abort());
  await page.goto("/map");
  await expect(page.getByRole("combobox", { name: "Choose a named area" })).toBeEnabled();

  const mainland = page.locator('svg[viewBox="165.8 34 13.2 13.5"]');
  const point = await mainland.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const mapPoint = svg.createSVGPoint();
    mapPoint.x = 173.284;
    mapPoint.y = 41.2706;
    const screenPoint = mapPoint.matrixTransform(svg.getScreenCTM()!);
    return { x: Math.floor(screenPoint.x), y: Math.floor(screenPoint.y) };
  });
  await page.mouse.click(point.x, point.y);

  const feedback = page.getByRole("status");
  await expect(feedback).toContainText("couldn't use that area");
  const feedbackBox = await feedback.boundingBox();
  expect(feedbackBox?.y).toBeGreaterThanOrEqual(0);
  expect((feedbackBox?.y ?? 800) + (feedbackBox?.height ?? 0)).toBeLessThanOrEqual(800);
});

test("uses the named Chatham selection when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  const apiRequests: string[] = [];
  await page.route("**/api/fungi/**", async (route) => {
    apiRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fungiResponse),
    });
  });
  await page.goto("/map");

  const namedArea = page.getByRole("combobox", { name: "Choose a named area" });
  await expect(namedArea).toBeEnabled();
  await namedArea.selectOption("waitangi");
  await page.getByRole("button", { name: "Show fungi near this area" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Most often observed near you" })).toBeFocused();
  expect(apiRequests).toHaveLength(1);
  expect(apiRequests[0]).toContain("/api/fungi/v1/en-NZ/r6/86bb364d7ffffff/");
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
