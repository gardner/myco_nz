export const STORAGE_KEY = "nearby-fungi:location:v1";
const H3_RESOLUTION = 6;
const MAX_STORED_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RESOLUTION_SIX_CELL = /^86[0-9a-f]{13}$/;

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
