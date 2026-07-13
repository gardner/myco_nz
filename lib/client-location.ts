export const STORAGE_KEY = "nearby-fungi:location:v1";
const H3_RESOLUTION = 6;
const MAX_STORED_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RESOLUTION_SIX_CELL = /^86[0-9a-f]{13}$/;
const RESULTS_FOCUS_KEY = "nearby-fungi:focus-results";
let locationHandoff: string | null = null;

export type StoredLocation = {
  version: 1;
  cell: string;
  resolution: 6;
  updatedAt: string;
};

export type LocationErrorCode = "unsupported" | "denied" | "unavailable";

export class LocationAccessError extends Error {
  constructor(public readonly code: LocationErrorCode) {
    super(code);
    this.name = "LocationAccessError";
  }
}

export function getLocationSeed(
  value: string | undefined = process.env.NEXT_PUBLIC_LOCATION_SEED,
): string | null {
  return value && RESOLUTION_SIX_CELL.test(value) ? value : null;
}

export async function getApproximateCell(
  geolocation: Geolocation | null = navigator.geolocation,
): Promise<string> {
  if (!geolocation) throw new LocationAccessError("unsupported");

  const [latitude, longitude] = await new Promise<[number, number]>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        const code = error.code === 1 ? "denied" : "unavailable";
        reject(new LocationAccessError(code));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 1_800_000 },
    );
  });

  return coordinatesToApproximateCell(latitude, longitude);
}

export async function coordinatesToApproximateCell(
  latitude: number,
  longitude: number,
): Promise<string> {
  const { latLngToCell } = await import("h3-js");
  return latLngToCell(latitude, longitude, H3_RESOLUTION);
}

export function storeLocationCell(
  cell: string,
  storage?: Storage,
  now: Date = new Date(),
): void {
  try {
    const value: StoredLocation = {
      version: 1,
      cell,
      resolution: 6,
      updatedAt: now.toISOString(),
    };
    (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Persistence is optional; the current request can still use the cell.
  }
}

export function clearStoredLocationCell(cell: string, storage?: Storage): void {
  try {
    const target = storage ?? localStorage;
    if (readStoredLocation(target)?.cell === cell) target.removeItem(STORAGE_KEY);
  } catch {
    // A blocked storage API should not prevent recovery from an invalid location.
  }
}

export function handoffLocationCell(cell: string, storage?: Storage): void {
  locationHandoff = cell;
  storeLocationCell(cell, storage);
}

export function consumeLocationHandoff(): string | null {
  const cell = locationHandoff;
  locationHandoff = null;
  return cell;
}

export function readStoredLocation(
  storage?: Storage,
  now: Date = new Date(),
): StoredLocation | null {
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(STORAGE_KEY) ?? "null");
    if (!isStoredLocation(value)) return null;

    const updatedAt = Date.parse(value.updatedAt);
    const age = now.getTime() - updatedAt;
    if (!Number.isFinite(updatedAt) || age < 0 || age > MAX_STORED_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function markResultsForFocus(storage?: Storage): void {
  try {
    (storage ?? sessionStorage).setItem(RESULTS_FOCUS_KEY, "1");
  } catch {
    // Focus restoration is an enhancement; navigation can continue without it.
  }
}

export function consumeResultsFocus(storage?: Storage): boolean {
  try {
    const target = storage ?? sessionStorage;
    const shouldFocus = target.getItem(RESULTS_FOCUS_KEY) === "1";
    target.removeItem(RESULTS_FOCUS_KEY);
    return shouldFocus;
  } catch {
    return false;
  }
}

function isStoredLocation(value: unknown): value is StoredLocation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredLocation>;
  return (
    candidate.version === 1 &&
    candidate.resolution === 6 &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.cell === "string" &&
    RESOLUTION_SIX_CELL.test(candidate.cell)
  );
}
