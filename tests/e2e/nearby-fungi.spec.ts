import AxeBuilder from "@axe-core/playwright";
import { cellToLatLng, latLngToCell } from "h3-js";
import { expect, test, type Route } from "@playwright/test";

import realSpeciesCounts from "../fixtures/inaturalist-species-counts.json" with {
  type: "json",
};
import { MAINLAND_MAP_SELECTOR, mapLocationToScreenPoint } from "./map-helpers";

const exactLocation = { latitude: -41.28664, longitude: 174.77557 };
const appPath = "/?disable_location_seed=1";
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

function expectCellCentreRequest(requestUrl: string, cell: string) {
  const url = new URL(requestUrl);
  const [latitude, longitude] = cellToLatLng(cell);
  expect(`${url.origin}${url.pathname}`).toBe(
    "https://api.inaturalist.org/v1/observations/species_counts",
  );
  expect(url.searchParams.get("lat")).toBe(latitude.toFixed(5));
  expect(url.searchParams.get("lng")).toBe(longitude.toFixed(5));
}

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
    await page.route(speciesCountsRoute, async (route) => {
      apiRequests.push(route.request().url());
      await fulfillSpeciesCounts(route);
    });

    await page.goto(appPath);
    await page.getByRole("button", { name: "Show fungi near me" }).click();

    const resultsHeading = page.getByRole("heading", { name: "Most often observed near you" });
    await expect(resultsHeading).toBeVisible();
    await expect(resultsHeading).toBeFocused();
    const resultsHeader = page.locator("header").filter({ has: resultsHeading });
    await expect(resultsHeader.getByText("Nearby Fungi")).toBeVisible();
    await expect(resultsHeader.getByText("Near Wellington")).toBeVisible();
    const refreshButton = page.getByRole("button", { name: "Refresh location" });
    await expect(refreshButton).toHaveAttribute("title", "Refresh location");
    await expect(refreshButton).toHaveText("");
    const refreshBox = await refreshButton.boundingBox();
    expect(refreshBox?.width).toBeGreaterThanOrEqual(44);
    expect(refreshBox?.height).toBeGreaterThanOrEqual(44);
    expect((await resultsHeader.boundingBox())?.height).toBeLessThanOrEqual(150);
    await expect(page.getByRole("article")).toHaveCount(3);
    expect(apiRequests).toHaveLength(1);
    expectCellCentreRequest(apiRequests[0], "86bb2955fffffff");
    expect(apiRequests[0]).not.toContain(String(exactLocation.latitude));
    expect(apiRequests[0]).not.toContain(String(exactLocation.longitude));
    await expect(page).toHaveURL(
      `/?cell=86bb2955fffffff&month=${currentMonth}`,
    );

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
    await page.route(speciesCountsRoute, fulfillSpeciesCounts);

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

  await expect(page).toHaveURL(new RegExp(`/map\\?month=${currentMonth}$`));
  const heading = page.getByRole("heading", { name: "Choose an area" });
  await expect(heading).toBeFocused();
  await expect(page.getByRole("img", { name: /map of aotearoa new zealand/i })).toBeVisible();
  const namedArea = page.getByRole("combobox", { name: "Choose a named area" });
  await expect(namedArea).toBeEnabled();
  await namedArea.selectOption("nelson");
  await expect(page.getByText("Near Nelson")).toBeVisible();
  await expect(page.getByTestId("map-cell-preview")).toBeVisible();
  const namedAreaButton = page.getByRole("button", { name: "Show fungi near this area" });
  await expect(namedAreaButton).toBeEnabled();
  expect((await namedArea.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  expect((await namedAreaButton.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await expect(page).toHaveURL(new RegExp(`/map\\?month=${currentMonth}$`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("mobile-map.png"), fullPage: true });
  await context.close();
});

test("converts a map click locally and loads results by H3 cell", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const apiRequests: string[] = [];
  await page.route(speciesCountsRoute, async (route) => {
    apiRequests.push(route.request().url());
    await fulfillSpeciesCounts(route);
  });
  await page.goto("/map");
  await expect(page.getByRole("combobox", { name: "Choose a named area" })).toBeEnabled();

  const mainland = page.locator(MAINLAND_MAP_SELECTOR);
  const selection = await mapLocationToScreenPoint(mainland, {
    latitude: -41.29682,
    longitude: 173.297512,
  });
  const expectedCell = latLngToCell(selection.latitude, selection.longitude, 6);
  await page.mouse.move(selection.x, selection.y);
  await expect(page.getByTestId("map-cell-preview")).toBeVisible();
  const expectedPlace = await page.getByTestId("map-place-label").textContent();
  expect(expectedPlace).toBeTruthy();
  await page.mouse.click(selection.x, selection.y);
  await page.mouse.move(1, 1);

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByTestId("map-cell-preview")).toBeVisible();
  await expect(page.getByTestId("map-place-label")).toHaveText(expectedPlace!);
  await page.getByRole("button", { name: "Use selected map area" }).click();

  await expect(page).toHaveURL(
    `/?cell=${expectedCell}&month=${currentMonth}`,
  );
  await expect(page.getByRole("heading", { name: "Most often observed near you" })).toBeFocused();
  await expect(page.getByText(expectedPlace!, { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  expect(apiRequests).toHaveLength(1);
  expectCellCentreRequest(apiRequests[0], expectedCell);
  expect(apiRequests[0]).not.toContain(String(selection.longitude));
  expect(apiRequests[0]).not.toContain(String(selection.latitude));

  await page.goBack();
  await expect(page).toHaveURL(/\/map$/);
});

test("keeps map conversion errors in the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/map");
  await expect(page.getByRole("combobox", { name: "Choose a named area" })).toBeEnabled();

  const mainland = page.locator(MAINLAND_MAP_SELECTOR);
  const point = await mapLocationToScreenPoint(mainland, {
    latitude: -41.2706,
    longitude: 173.284,
  });
  await page.evaluate(() => {
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => null,
    });
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
  await page.route(speciesCountsRoute, async (route) => {
    apiRequests.push(route.request().url());
    await fulfillSpeciesCounts(route);
  });
  await page.goto("/map");

  const namedArea = page.getByRole("combobox", { name: "Choose a named area" });
  await expect(namedArea).toBeEnabled();
  await namedArea.selectOption("waitangi");
  await page.getByRole("button", { name: "Show fungi near this area" }).click();

  await expect(page).toHaveURL(
    `/?cell=86bb364d7ffffff&month=${currentMonth}`,
  );
  await expect(page.getByRole("heading", { name: "Most often observed near you" })).toBeFocused();
  await expect(page.getByText("Near Waitangi", { exact: true })).toBeVisible();
  expect(apiRequests).toHaveLength(1);
  expectCellCentreRequest(apiRequests[0], "86bb364d7ffffff");
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
  await page.route(speciesCountsRoute, fulfillSpeciesCounts);

  await page.goto(appPath);
  await expect(page.getByRole("article")).toHaveCount(3);
  const resultsHeading = page.getByRole("heading", { name: "Most often observed near you" });
  const resultsHeader = page.locator("header").filter({ has: resultsHeading });
  await expect(resultsHeader.getByText("Nearby Fungi")).toBeVisible();
  await expect(resultsHeader.getByText("Near Wellington")).toBeVisible();
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
