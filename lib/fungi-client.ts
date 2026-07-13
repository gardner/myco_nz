import type { FungiResponse } from "@/lib/types";

export type ClientErrorCode =
  | "invalid-location"
  | "outside-new-zealand"
  | "unavailable"
  | "invalid-response";

export class FungiClientError extends Error {
  constructor(public readonly code: ClientErrorCode) {
    super(code);
    this.name = "FungiClientError";
  }
}

export async function fetchFungi(
  cell: string,
  month: number,
  signal: AbortSignal,
): Promise<FungiResponse> {
  const response = await fetch(`/api/fungi/v1/en-NZ/r6/${cell}/${month}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 400) throw new FungiClientError("invalid-location");
  if (response.status === 422) throw new FungiClientError("outside-new-zealand");
  if (!response.ok) throw new FungiClientError("unavailable");

  const payload: unknown = await response.json();
  if (!isFungiResponse(payload) || !matchesRequest(payload, cell, month)) {
    throw new FungiClientError("invalid-response");
  }
  return payload;
}

function matchesRequest(payload: FungiResponse, cell: string, month: number): boolean {
  return payload.query.cell === cell && payload.query.requestedMonth === month;
}

function isFungiResponse(value: unknown): value is FungiResponse {
  if (!isRecord(value) || !isRecord(value.query) || !isRecord(value.coverage)) return false;
  if (!isRecord(value.source) || !Array.isArray(value.results)) return false;

  return (
    value.schemaVersion === 1 &&
    typeof value.generatedAt === "string" &&
    isFungiQuery(value.query) &&
    isCoverage(value.coverage) &&
    isSource(value.source) &&
    value.results.length <= 20 &&
    value.results.every(isFungiResult)
  );
}

function isFungiQuery(value: Record<string, unknown>): boolean {
  return (
    value.resolution === 6 &&
    isPositiveInteger(value.requestedMonth) &&
    Array.isArray(value.includedMonths) &&
    value.includedMonths.length === 3 &&
    value.includedMonths.every(isPositiveInteger) &&
    value.radiusKm === 30 &&
    value.locale === "en-NZ" &&
    typeof value.cell === "string"
  );
}

function isCoverage(value: Record<string, unknown>): boolean {
  return (
    ["cell-centre-radius", "expanded-radius", "cell-ring"].includes(String(value.mode)) &&
    Array.isArray(value.sourceCells) &&
    value.sourceCells.every((cell) => typeof cell === "string") &&
    isNonNegativeInteger(value.expansionLevel) &&
    isNonEmptyString(value.label)
  );
}

function isSource(value: Record<string, unknown>): boolean {
  return value.name === "iNaturalist" && value.siteUrl === "https://inaturalist.nz";
}

function isFungiResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isPositiveInteger(value.rank) &&
    isPositiveInteger(value.taxonId) &&
    (value.commonName === null || typeof value.commonName === "string") &&
    isNonEmptyString(value.scientificName) &&
    isNonNegativeInteger(value.observationCount) &&
    isNonEmptyString(value.observationCountLabel) &&
    isAllowedUrl(value.observationsUrl, ["https://inaturalist.nz"]) &&
    (value.image === null || isFungiImage(value.image))
  );
}

function isFungiImage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isAllowedUrl(value.url, [
      "https://inaturalist-open-data.s3.amazonaws.com",
      "https://static.inaturalist.org",
    ]) &&
    isNullableString(value.attribution) &&
    isNullableString(value.licenseCode)
  );
}

function isAllowedUrl(value: unknown, allowedOrigins: string[]): boolean {
  if (typeof value !== "string") return false;
  try {
    return allowedOrigins.includes(new URL(value).origin);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}
