import { expect, test } from "@playwright/test";

const SHARED_PATH = "/?cell=86bb2955fffffff&month=9";
const SOCIAL_IMAGE_PATH = "/social/nearby-fungi-v1.jpg";

test("serves complete social metadata for a shared location", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    userAgent: "facebookexternalhit/1.1",
  });
  const page = await context.newPage();
  const response = await page.goto(SHARED_PATH);

  expect(response?.ok()).toBe(true);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Fungi recorded near Wellington around September | Nearby Fungi",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://myco.nz/?cell=86bb2955fffffff&month=9",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://myco.nz/social/nearby-fungi-v1.jpg",
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
    "content",
    "630",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://myco.nz/?cell=86bb2955fffffff&month=9",
  );

  const image = await request.get(SOCIAL_IMAGE_PATH);
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toBe("image/jpeg");
  await context.close();
});
