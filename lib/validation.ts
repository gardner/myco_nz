import { cellToLatLng, getResolution, isValidCell } from "h3-js";

type Bounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

const SUPPORTED_BOUNDS: Bounds[] = [
  {
    minLatitude: -41.8,
    maxLatitude: -34,
    minLongitude: 172.4,
    maxLongitude: 178.7,
  },
  {
    minLatitude: -47.5,
    maxLatitude: -40.4,
    minLongitude: 166,
    maxLongitude: 174.6,
  },
  {
    minLatitude: -44.7,
    maxLatitude: -43.3,
    minLongitude: -177.5,
    maxLongitude: -175.5,
  },
];

export type CellValidation =
  | { ok: true; centre: [number, number] }
  | {
      ok: false;
      reason: "invalid-cell" | "wrong-resolution" | "outside-new-zealand";
    };

export function isSupportedNzLocation(latitude: number, longitude: number): boolean {
  return SUPPORTED_BOUNDS.some(
    (bounds) =>
      latitude >= bounds.minLatitude &&
      latitude <= bounds.maxLatitude &&
      longitude >= bounds.minLongitude &&
      longitude <= bounds.maxLongitude,
  );
}

export function validateLocationCell(cell: string): CellValidation {
  if (cell !== cell.toLowerCase() || !isValidCell(cell)) {
    return { ok: false, reason: "invalid-cell" };
  }
  if (getResolution(cell) !== 6) {
    return { ok: false, reason: "wrong-resolution" };
  }

  const centre = cellToLatLng(cell);
  if (!isSupportedNzLocation(...centre)) {
    return { ok: false, reason: "outside-new-zealand" };
  }

  return { ok: true, centre };
}
