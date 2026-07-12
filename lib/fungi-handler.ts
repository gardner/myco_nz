import {
  buildSpeciesCountsUrl,
  InvalidUpstreamResponseError,
  normaliseSpeciesCounts,
} from "@/lib/inaturalist";
import { parseCanonicalMonth, validateLocationCell } from "@/lib/validation";

const SUCCESS_CACHE_CONTROL = "public, max-age=3600";
const EDGE_CACHE_CONTROL =
  "public, max-age=1209600, stale-while-revalidate=5184000, stale-if-error=7776000";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FungiHandlerDependencies = {
  fetch: Fetcher;
  limit: (input: { key: string }) => Promise<{ success: boolean }>;
  now: () => Date;
  userAgent: string;
  log: (event: Record<string, unknown>) => void;
};

export type FungiHandlerInput = {
  request: Request;
  cell: string;
  rawMonth: string;
};

export async function handleFungiRequest(
  input: FungiHandlerInput,
  dependencies: FungiHandlerDependencies,
): Promise<Response> {
  if (new URL(input.request.url).searchParams.size > 0) {
    return validationError(dependencies, "unexpected-query", 400);
  }

  const month = parseCanonicalMonth(input.rawMonth);
  if (month === null) return validationError(dependencies, "invalid-month", 400);

  const location = validateLocationCell(input.cell);
  if (!location.ok) {
    const status = location.reason === "outside-new-zealand" ? 422 : 400;
    return validationError(dependencies, location.reason, status);
  }

  const limited = await applyRateLimit(dependencies);
  if (limited) return limited;

  const [centreLat, centreLng] = location.centre;
  const startedAt = Date.now();
  let upstream: Response;
  try {
    upstream = await dependencies.fetch(
      buildSpeciesCountsUrl({ centreLat, centreLng, requestedMonth: month }),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": dependencies.userAgent,
        },
        signal: AbortSignal.timeout(9_000),
      },
    );
  } catch (error) {
    dependencies.log({ event: "inat_species_counts_error", kind: errorKind(error), month });
    return noStoreJson({ error: "Data source temporarily unavailable" }, 503);
  }

  if (!upstream.ok) {
    dependencies.log({
      event: "inat_species_counts_error",
      kind: "upstream-status",
      month,
      upstreamStatus: upstream.status,
    });
    return noStoreJson({ error: "Data source temporarily unavailable" }, 503);
  }

  try {
    const body = normaliseSpeciesCounts({
      payload: await upstream.json(),
      cell: input.cell,
      requestedMonth: month,
      centreLat,
      centreLng,
      generatedAt: dependencies.now(),
    });
    dependencies.log({
      event: "inat_species_counts",
      apiVersion: 1,
      month,
      resultCount: body.results.length,
      upstreamStatus: upstream.status,
      upstreamMs: Date.now() - startedAt,
      expansionLevel: 0,
    });
    return Response.json(body, {
      headers: {
        "Cache-Control": SUCCESS_CACHE_CONTROL,
        "Cloudflare-CDN-Cache-Control": EDGE_CACHE_CONTROL,
      },
    });
  } catch (error) {
    const kind = error instanceof InvalidUpstreamResponseError ? "invalid-schema" : "invalid-json";
    dependencies.log({ event: "inat_species_counts_error", kind, month });
    return noStoreJson({ error: "Data source returned an invalid response" }, 502);
  }
}

async function applyRateLimit(
  dependencies: FungiHandlerDependencies,
): Promise<Response | null> {
  try {
    const result = await dependencies.limit({ key: "species-counts-v1" });
    if (result.success) return null;
  } catch {
    dependencies.log({ event: "inat_species_counts_error", kind: "rate-limit-failure" });
    return noStoreJson({ error: "Data source temporarily busy" }, 503);
  }

  dependencies.log({ event: "inat_species_counts_error", kind: "rate-limited" });
  return noStoreJson({ error: "Data source temporarily busy" }, 503);
}

function validationError(
  dependencies: FungiHandlerDependencies,
  reason: string,
  status: number,
): Response {
  dependencies.log({ event: "fungi_validation_error", reason });
  return noStoreJson({ error: "Invalid request" }, status);
}

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorKind(error: unknown): string {
  return error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "fetch";
}
