import type { Locator } from "@playwright/test";

export const MAINLAND_MAP_SELECTOR = 'svg[viewBox="165.8 34 13.2 13.5"]';

export async function mapLocationToScreenPoint(
  map: Locator,
  location: { latitude: number; longitude: number },
) {
  return map.evaluate((element, target) => {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = target.longitude;
    point.y = -target.latitude;
    const screenPoint = point.matrixTransform(svg.getScreenCTM()!);
    const x = Math.floor(screenPoint.x);
    const y = Math.floor(screenPoint.y);
    const mappedPoint = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x, y, latitude: -mappedPoint.y, longitude: mappedPoint.x };
  }, location);
}
