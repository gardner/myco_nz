import { formatSeasonalRange, getSeasonalMonths } from "@/lib/months";
import type { FungiImage, FungiResponse, FungiResult } from "@/lib/types";

const SPECIES_COUNTS_URL = "https://api.inaturalist.org/v1/observations/species_counts";
const OBSERVATIONS_URL = "https://inaturalist.nz/observations";
const TAXA_URL = "https://www.inaturalist.nz/taxa";

type QueryLocation = {
  centreLat: number;
  centreLng: number;
};

type NormalisationInput = QueryLocation & {
  payload: unknown;
  cell: string;
  requestedMonth: number;
  generatedAt: Date;
};

export class InvalidUpstreamResponseError extends Error {
  constructor() {
    super("iNaturalist returned an invalid response");
    this.name = "InvalidUpstreamResponseError";
  }
}

export function buildSpeciesCountsUrl(
  input: QueryLocation & { requestedMonth: number },
): string {
  const months = getSeasonalMonths(input.requestedMonth);
  return withSearchParams(SPECIES_COUNTS_URL, {
    lat: input.centreLat.toFixed(5),
    lng: input.centreLng.toFixed(5),
    radius: "30",
    month: months.join(","),
    iconic_taxa: "Fungi",
    rank: "species",
    quality_grade: "research",
    locale: "en",
    per_page: "20",
  });
}

export function buildObservationsUrl(
  input: QueryLocation & { taxonId: number; months: number[] },
): string {
  return withSearchParams(OBSERVATIONS_URL, {
    taxon_id: String(input.taxonId),
    lat: input.centreLat.toFixed(5),
    lng: input.centreLng.toFixed(5),
    radius: "30",
    month: input.months.join(","),
    quality_grade: "research",
  });
}

export function buildTaxonPhotosUrl(
  taxonId: number,
  scientificName: string,
): string {
  const slug = encodeURIComponent(scientificName.trim().replace(/\s+/g, "-"));
  return `${TAXA_URL}/${taxonId}-${slug}/browse_photos`;
}

export function normaliseSpeciesCounts(input: NormalisationInput): FungiResponse {
  const results = readResults(input.payload);
  const months = getSeasonalMonths(input.requestedMonth);

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    query: {
      cell: input.cell,
      resolution: 6,
      requestedMonth: input.requestedMonth,
      includedMonths: months,
      radiusKm: 30,
      locale: "en-NZ",
    },
    coverage: {
      mode: "cell-centre-radius",
      sourceCells: [input.cell],
      expansionLevel: 0,
      label: "Within about 30 km of your approximate area",
    },
    source: { name: "iNaturalist", siteUrl: "https://inaturalist.nz" },
    results: results.slice(0, 20).map((result, index) =>
      normaliseResult(result, index, {
        centreLat: input.centreLat,
        centreLng: input.centreLng,
        requestedMonth: input.requestedMonth,
        months,
      }),
    ),
  };
}

function normaliseResult(
  value: unknown,
  index: number,
  query: QueryLocation & { requestedMonth: number; months: number[] },
): FungiResult {
  const result = readRecord(value);
  const taxon = readRecord(result.count !== undefined ? result.taxon : undefined);
  const count = result.count;
  const id = taxon.id;
  const name = taxon.name;

  if (!isNonNegativeInteger(count) || !isPositiveInteger(id) || !isNonEmptyString(name)) {
    throw new InvalidUpstreamResponseError();
  }

  const commonName = isNonEmptyString(taxon.preferred_common_name)
    ? taxon.preferred_common_name.trim()
    : null;
  const noun = count === 1 ? "observation" : "observations";

  return {
    rank: index + 1,
    taxonId: id,
    commonName,
    scientificName: name,
    observationCount: count,
    observationCountLabel: `${count} research-grade ${noun} nearby in ${formatSeasonalRange(query.requestedMonth)}`,
    image: normalisePhoto(taxon.default_photo),
    observationsUrl: buildObservationsUrl({
      taxonId: id,
      centreLat: query.centreLat,
      centreLng: query.centreLng,
      months: query.months,
    }),
  };
}

function normalisePhoto(value: unknown): FungiImage | null {
  if (!isRecord(value)) return null;
  const url = [value.square_url, value.medium_url, value.url].find(isNonEmptyString);
  if (!url) return null;

  return {
    url,
    attribution: nullableString(value.attribution),
    licenseCode: nullableString(value.license_code),
  };
}

function readResults(payload: unknown): unknown[] {
  const record = readRecord(payload);
  if (!Array.isArray(record.results)) throw new InvalidUpstreamResponseError();
  return record.results;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidUpstreamResponseError();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function withSearchParams(base: string, values: Record<string, string>): string {
  const url = new URL(base);
  url.search = new URLSearchParams(values).toString();
  return url.toString();
}
