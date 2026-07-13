import {
  cellToBoundary,
  cellToLatLng,
  getResolution,
  isValidCell,
  latLngToCell,
} from "h3-js";

import placeData from "@/data/nz-place-names.json";

const EARTH_RADIUS_KM = 6_371;
const NEARBY_DISTANCE_KM = 30;
const PROMINENT_PLACE_TOLERANCE_KM = 5;
const places = placeData.places as [string, number, number, boolean][];
const placeCache = new Map<string, ApproximatePlace>();

export type ApproximatePlace = Readonly<{
  name: string;
  distanceKm: number;
}>;

export type CellGeometry = Readonly<{
  centre: readonly [number, number];
  boundary: ReadonlyArray<readonly [number, number]>;
}>;

export function locationToApproximateCell(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, 6);
}

export function getApproximatePlaceForCell(cell: string): ApproximatePlace {
  assertResolutionSixCell(cell);
  const cached = placeCache.get(cell);
  if (cached) return cached;

  const [latitude, longitude] = cellToLatLng(cell);
  const place = findNearestPlace(latitude, longitude);
  placeCache.set(cell, place);
  return place;
}

export function getCellGeometry(cell: string): CellGeometry {
  assertResolutionSixCell(cell);
  return {
    centre: cellToLatLng(cell),
    boundary: cellToBoundary(cell),
  };
}

export function formatApproximatePlace(place: ApproximatePlace): string {
  if (place.distanceKm <= NEARBY_DISTANCE_KM) return `Near ${place.name}`;
  return `About ${Math.round(place.distanceKm)} km from ${place.name}`;
}

function findNearestPlace(latitude: number, longitude: number): ApproximatePlace {
  let nearest = createFallbackPlace();
  let nearestProminent = createFallbackPlace();

  for (const [name, placeLatitude, placeLongitude, isProminent] of places) {
    const distanceKm = greatCircleDistanceKm(
      latitude,
      longitude,
      placeLatitude,
      placeLongitude,
    );
    const candidate = { name, distanceKm };
    if (distanceKm < nearest.distanceKm) nearest = candidate;
    if (isProminent && distanceKm < nearestProminent.distanceKm) {
      nearestProminent = candidate;
    }
  }

  const selected = nearestProminent.distanceKm <=
      nearest.distanceKm + PROMINENT_PLACE_TOLERANCE_KM
    ? nearestProminent
    : nearest;
  return { ...selected, distanceKm: Number(selected.distanceKm.toFixed(1)) };
}

export function greatCircleDistanceKm(
  latitude: number,
  longitude: number,
  otherLatitude: number,
  otherLongitude: number,
): number {
  const latitudeDelta = toRadians(otherLatitude - latitude);
  const longitudeDelta = toRadians(wrappedLongitudeDelta(otherLongitude - longitude));
  const startLatitude = toRadians(latitude);
  const endLatitude = toRadians(otherLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function createFallbackPlace(): ApproximatePlace {
  return {
    name: "Aotearoa New Zealand",
    distanceKm: Number.POSITIVE_INFINITY,
  };
}

function wrappedLongitudeDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function assertResolutionSixCell(cell: string): void {
  if (!isValidCell(cell) || getResolution(cell) !== 6) {
    throw new RangeError("A valid resolution 6 H3 cell is required");
  }
}
