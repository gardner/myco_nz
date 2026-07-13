import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";

const SOURCE_URL = "https://gazetteer.linz.govt.nz/gaz.csv";
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/nz-place-names.json",
);
const USER_AGENT = "myco.nz <gardner@bickford.nz>";
const GENERAL_PLACE_TYPES = new Set(["City", "Town", "Village"]);
const EXCLUDED_STATUSES = /(Collected|Discontinued|Original|Replaced)/;
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
const PROMINENT_LABEL_HIERARCHY_MAX = 10;

export function parseGazetteerCsv(csv) {
  return parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  });
}

export function buildPlaceNameData(records, retrievedOn) {
  const preferredByFeature = new Map();

  for (const record of records) {
    if (!isIncludedRecord(record)) continue;
    const candidate = toCandidate(record);
    const current = preferredByFeature.get(candidate.featureId);
    if (!current || isPreferred(candidate, current)) {
      preferredByFeature.set(candidate.featureId, candidate);
    }
  }

  const places = [...preferredByFeature.values()]
    .sort(compareCandidates)
    .map(toPlaceTuple);

  return {
    source: {
      title: "New Zealand Gazetteer",
      custodian:
        "Ngā Pou Taunaha o Aotearoa New Zealand Geographic Board / Toitū Te Whenua LINZ",
      url: SOURCE_URL,
      layerUrl: "https://data.linz.govt.nz/layer/51681-nz-place-names-nzgb/",
      licence: "Creative Commons Attribution 4.0 International",
      licenceUrl: LICENCE_URL,
      retrievedOn,
    },
    selection: {
      placeTypes: ["City", "Town", "Village", "selected Locality"],
      localityRule:
        "Official Locality, or Unofficial Recorded Locality with a numeric label hierarchy",
      prominenceRule: "numeric label hierarchy of 10 or lower",
      coordinates: "NZ application bounds, rounded to 5 decimal places",
      duplicateRule: "prefer a numeric label hierarchy, then name",
      modifications:
        "Filtered by place type, status, and application bounds; duplicate alternatives resolved; coordinates rounded to 5 decimal places.",
    },
    places,
  };
}

async function updatePlaceNames() {
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: "text/csv", "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`NZ Gazetteer download failed with HTTP ${response.status}`);
  }

  const records = parseGazetteerCsv(await response.text());
  const retrievedOn = new Date().toISOString().slice(0, 10);
  const output = buildPlaceNameData(records, retrievedOn);
  assertExpectedPlaceCount(output.places.length);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
  console.log(`Wrote ${output.places.length} place names to ${OUTPUT_PATH}`);
}

function isIncludedRecord(record) {
  const status = record.status ?? "";
  const placeType = record.feat_type ?? "";
  if (EXCLUDED_STATUSES.test(status)) return false;
  if (!GENERAL_PLACE_TYPES.has(placeType) && !isIncludedLocality(record)) return false;

  const latitude = Number(record.crd_latitude);
  const longitude = Number(record.crd_longitude);
  return isSupportedLocation(latitude, longitude);
}

function isIncludedLocality(record) {
  if (record.feat_type !== "Locality") return false;
  const status = record.status ?? "";
  return status.startsWith("Official") ||
    (status === "Unofficial Recorded" && hasNumericLabelHierarchy(record));
}

function isSupportedLocation(latitude, longitude) {
  const mainland = latitude >= -47.5 && latitude <= -34 &&
    longitude >= 166 && longitude <= 178.7;
  const chatham = latitude >= -44.7 && latitude <= -43.3 &&
    longitude >= -177.5 && longitude <= -175.5;
  return Number.isFinite(latitude) && Number.isFinite(longitude) && (mainland || chatham);
}

function toCandidate(record) {
  const labelHierarchy = getLabelHierarchy(record);
  return {
    featureId: record.feat_id,
    name: record.name.trim(),
    latitude: roundCoordinate(record.crd_latitude),
    longitude: roundCoordinate(record.crd_longitude),
    hasLabelHierarchy: labelHierarchy !== undefined,
    isProminent: labelHierarchy !== undefined &&
      labelHierarchy <= PROMINENT_LABEL_HIERARCHY_MAX,
  };
}

function hasNumericLabelHierarchy(record) {
  return getLabelHierarchy(record) !== undefined;
}

function getLabelHierarchy(record) {
  const value = (record.label_hierarchy ?? "").trim();
  return /^\d+$/.test(value) ? Number(value) : undefined;
}

function toPlaceTuple({ name, latitude, longitude, isProminent }) {
  return [name, latitude, longitude, isProminent];
}

function isPreferred(candidate, current) {
  if (candidate.hasLabelHierarchy !== current.hasLabelHierarchy) {
    return candidate.hasLabelHierarchy;
  }
  return candidate.name < current.name;
}

function compareCandidates(left, right) {
  return left.name.localeCompare(right.name, "en-NZ") ||
    left.latitude - right.latitude || left.longitude - right.longitude;
}

function roundCoordinate(value) {
  return Number(Number(value).toFixed(5));
}

function assertExpectedPlaceCount(count) {
  if (count < 1_000 || count > 1_500) {
    throw new Error(`Unexpected filtered Gazetteer size: ${count}`);
  }
}

function isExecutedDirectly() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && resolve(entrypoint) === fileURLToPath(import.meta.url));
}

if (isExecutedDirectly()) await updatePlaceNames();
