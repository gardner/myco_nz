---
title: "Nearby Fungi"
subtitle: "Product Requirements and Implementation Specification"
author: "Draft for Product and Engineering"
date: "13 July 2026"
---

**Document status:** Draft v0.1  
**Working title:** Nearby Fungi  
**Primary platform:** Mobile web  
**Implementation:** vinext on Cloudflare Workers  

> **Product decision:** Build a deliberately small, mobile-first view into iNaturalist data. The client converts the user's exact location into an approximate H3 cell before sending anything to the server. A single cacheable API route requests the most frequently observed fungi near the cell centre and around the current time of year. The MVP uses no database, KV namespace, R2 bucket, map, user account, or iNaturalist authentication.

## Contents

1. Product Requirements
2. Implementation Specification
3. Future Expansion
4. Delivery Plan
5. Open Decisions
6. Appendices and References

## Decision Snapshot

| Area | MVP decision |
|---|---|
| Product | A quick, helpful view of fungi that may be around the user now |
| Primary experience | Mobile-first ranked list; acceptable centred desktop layout |
| Map | None |
| Location | Browser geolocation converted locally to H3 resolution 6 |
| Exact coordinates | Used only in the browser, then discarded |
| Seasonal query | Previous, current, and next calendar month across all years |
| Geographic query | 30 km radius from the H3 cell centre |
| Ranking | iNaturalist research-grade observation count, descending |
| Results | Top 20 species |
| Card content | One image, common name, scientific name, observation count, iNaturalist NZ link |
| Data source | iNaturalist `observations/species_counts` |
| API authentication | None required for this public read endpoint |
| Persistence | Cloudflare Workers Cache only |
| Rate limiting | Cloudflare Rate Limiting binding on upstream cache misses |
| Images | Use iNaturalist taxon default image URLs directly; no image resizing or R2 in MVP |
| Future sparse-area handling | API response supports expansion metadata without requiring a frontend rewrite |

# 1. Product Requirements

## 1.1 Product statement

Nearby Fungi helps a person answer one simple question:

> **What fungi am I most likely to encounter around here at this time of year?**

The product does not attempt to replace iNaturalist. It is a focused, fast view over iNaturalist observation data, designed for people who want a useful local shortlist without navigating filters, maps, taxonomic search, or account features.

## 1.2 Problem

The iNaturalist observation database contains the information needed to discover locally recorded fungi, but the general-purpose interface requires the user to understand search filters and explore a map or species view. A casual user usually wants a compact answer ordered by local relevance.

The product should reduce that task to:

1. Open the page.
2. Share approximate location.
3. Scan a ranked list.
4. Open the relevant filtered observation page on iNaturalist NZ when they want more detail.

## 1.3 Target users and jobs

### Primary user

A person in New Zealand who is outdoors, planning a walk, curious about the current fungi season, or trying to learn what species are commonly recorded nearby.

### Jobs to be done

- Quickly see fungi commonly observed nearby during the current part of the year.
- Recognise candidates from a small image and names.
- Understand how much observation evidence supports each result.
- Continue into iNaturalist NZ to inspect real observations, locations, dates, identifiers, and additional photographs.

## 1.4 Goals

1. Produce useful local results with minimal interaction.
2. Make the initial result list fast on repeat and shared-location requests.
3. Avoid sending exact user coordinates to the application server or iNaturalist.
4. Minimise upstream load through coarse location keys and long-lived edge caching.
5. Clearly represent the list as historical observation frequency, not a guaranteed encounter probability.
6. Keep the implementation small enough to maintain while leaving a clean path to wider-area results and precomputed data later.

## 1.5 Non-goals for the MVP

- Mushroom identification from a photograph.
- Edibility, toxicity, harvesting, or medical advice.
- A map or map-based browsing.
- User accounts, saved lists, comments, voting, or submissions.
- Uploading observations to iNaturalist.
- Real-time sightings or alerts.
- A complete field guide or taxonomic encyclopedia.
- Arbitrary filters for radius, date, grade, taxon, or location.
- Mirroring all New Zealand observations.
- Copying iNaturalist images into R2.

## 1.6 Product principles

### Fast before feature-rich

The application should load a small shell and show a scannable list. Avoid a map SDK, large UI library, image transformation pipeline, or database until measurements justify them.

### Approximate location is sufficient

The product recommends species for an area, not a precise point. H3 resolution 6 cells average about 36.1 km² with an average edge length of about 3.72 km.[^h3]

### Explain the evidence plainly

Use wording such as **"Most often observed nearby around this time of year"**. Do not display a percentage likelihood unless a later model is calibrated to support it.

### iNaturalist remains the source of truth

Every result should provide a direct path to the matching observations on iNaturalist NZ. The application should not attempt to reproduce observation detail pages.

### Build for graceful expansion

The frontend must not assume that every result came only from one local cell. Coverage metadata should support future merging or widening without changing the card model.

## 1.7 MVP user journey

### First visit

1. The page renders immediately with the product title, one-sentence explanation, privacy note, and a prominent **Show fungi near me** button.
2. Tapping the button requests browser geolocation with high accuracy disabled.
3. The browser converts latitude and longitude into an H3 resolution 6 cell.
4. Exact coordinates are discarded.
5. The client requests the canonical cell-and-month API URL.
6. Loading skeletons appear while data is fetched.
7. The ranked result list appears.
8. The H3 cell and timestamp are saved locally for future visits.

### Returning visit

1. If a recent saved cell exists, load its current-month result automatically.
2. Show a small **Refresh location** control for users who have moved.
3. Re-request browser location only when needed or explicitly requested.

### Result exploration

1. The user scans common names, scientific names, images, and counts.
2. The user taps **View nearby observations**.
3. A new tab opens on `inaturalist.nz/observations` filtered to the taxon, seasonal months, approximate cell centre, and search radius.

## 1.8 Information architecture and screens

### A. Location request state

Content:

- Product name.
- Heading: **Fungi likely near you**.
- Supporting text: **See the fungi most often recorded around your approximate area at this time of year.**
- Primary button: **Show fungi near me**.
- Privacy note: **Your exact location stays on this device. We send only an approximate area.**
- Small attribution: **Powered by iNaturalist observations.**

### B. Loading state

- Keep the title and coverage explanation visible.
- Show 6 lightweight card skeletons.
- Do not use an indefinite full-screen spinner.
- Use an `aria-live` status message.

### C. Results state

Header area:

- Heading: **Most often observed near you**.
- Seasonal line, for example: **Based on research-grade observations from June-August across previous years.**
- Coverage line: **Within about 30 km of your approximate area.**
- **Refresh location** button.

List:

- 20 ranked species at most.
- Single-column stacked cards on mobile.
- Single-column centred list on desktop, with a maximum content width of approximately 760 px.

Footer:

- iNaturalist attribution and source link.
- Brief wording: **Observation frequency does not guarantee that a species is present today. This is not an identification or edibility guide.**

### D. Location denied or unavailable

- Explain that location is required for the MVP.
- Repeat that exact coordinates are converted to an approximate cell locally.
- Provide **Try again**.
- Do not add manual geocoding in the first release.

### E. No-result state

- Heading: **Not enough local records yet**.
- Explain that iNaturalist may have sparse records for this area and season.
- Link to a broader fungi observation search on iNaturalist NZ.
- Keep the API response model ready for a later automatic wider-area fallback.

### F. Upstream failure state

- Serve stale cached data where available.
- If no cached data exists, show a short failure message and **Try again**.
- Never cache error responses.

## 1.9 Result card specification

Each card is an `<article>` inside an ordered list item.

| Element | Requirement |
|---|---|
| Rank | Optional small ordinal, such as `1`, to reinforce ordering |
| Image | One square image, 88-104 px on mobile; 112-128 px on larger screens |
| Common name | Primary heading; fall back to **No common name listed** |
| Scientific name | Italicised and always shown |
| Evidence line | Example: **84 research-grade observations nearby in Jun-Aug** |
| Link | **View nearby observations**; opens iNaturalist NZ in a new tab |
| Photo attribution | Compact, visible or available immediately below the image |
| Missing image | Neutral fungi placeholder; do not remove the taxon from ranking |

The full card may be clickable, but the link must remain a clear semantic anchor. Avoid hiding the external action behind only an image.

## 1.10 Ranking and data semantics

### MVP ranking

Use the order returned by iNaturalist species counts, which is observation count descending.[^inat-api]

The upstream search includes:

- The previous, current, and next calendar month.
- All observation years.
- A 30 km radius around the H3 cell centre.
- `iconic_taxa=Fungi`.
- `rank=species`.
- `quality_grade=research`.

### Interpretation

The count means:

> The number of research-grade iNaturalist observations matching this approximate area and seasonal window.

It does **not** mean:

- Current abundance.
- Probability of finding the species on a particular walk.
- Ecological prevalence independent of observer behaviour.
- Identification confidence for a specimen the user is holding.

### Result count

Return the top 20 results. Request up to 30 upstream if useful for resilience, but do not reorder or silently omit species solely because a photo or common name is absent.

## 1.11 Functional requirements

| ID | Requirement |
|---|---|
| FR-001 | The first screen must explain the product and request location with one primary action. |
| FR-002 | Exact latitude and longitude must be converted to H3 resolution 6 in the browser and not sent to the application server. |
| FR-003 | The client must request data using a canonical path containing API version, locale, H3 resolution, cell, and month. |
| FR-004 | The server must validate the H3 cell, resolution, month, and supported New Zealand coverage before contacting iNaturalist. |
| FR-005 | The server must call the iNaturalist species-count endpoint only after cache and rate-limit controls permit it. |
| FR-006 | The server must return a normalised response rather than proxying the complete upstream payload. |
| FR-007 | The result list must show one image, common name, scientific name, matching observation count, and external observation link. |
| FR-008 | The observation link must use the approximate cell centre and never the user's original coordinates. |
| FR-009 | The application must preserve image attribution and licence metadata returned by iNaturalist. |
| FR-010 | Successful API responses must be publicly cacheable; errors must use `Cache-Control: no-store`. |
| FR-011 | The application must work without an iNaturalist API key, user login, application login, or OAuth flow. |
| FR-012 | The response must include coverage metadata that can represent later nearby-cell or wider-radius expansion. |
| FR-013 | The application must provide a useful denied-location, no-result, and upstream-error state. |
| FR-014 | No map code or map dependency may be included in the MVP bundle. |

## 1.12 Responsive design requirements

### Mobile

- Design baseline: 360 px CSS viewport.
- Minimum touch target: 44 by 44 px.
- Card image and primary text must be visible without horizontal scrolling.
- Use a compact horizontal card: image on the left, text and action on the right.
- Allow long scientific names to wrap naturally.

### Desktop

- Centre the content in a single readable column.
- Do not stretch cards across the full viewport.
- Increase image size and spacing slightly.
- Keep the same information hierarchy rather than introducing a separate desktop product.

## 1.13 Accessibility requirements

- Meet WCAG 2.2 AA colour contrast for text and interactive controls.
- Use a real ordered list for ranked results.
- Use semantic headings in a logical hierarchy.
- Provide useful image alt text, such as **Photo of velvet shank (Flammulina velutipes)**.
- Announce loading, success, and failure state changes through a polite live region.
- Preserve focus after retry and refresh actions.
- Do not rely on colour alone for state or ranking.
- Respect `prefers-reduced-motion`.
- Ensure external links are keyboard accessible and have an accessible indication that they open another site.

## 1.14 Privacy requirements

- Set `enableHighAccuracy: false` when requesting location.
- Convert exact coordinates into an H3 cell before any network request.
- Discard exact coordinates immediately after conversion.
- Store only the H3 cell, resolution, and last-updated timestamp in local storage.
- Do not create user profiles or associate cells with an account.
- Treat the H3 cell as approximate location information in logs and analytics.
- Do not send the cell to third-party product analytics unless explicitly reviewed.
- Keep server logs and metrics focused on cache performance, result count, latency, errors, and coarse aggregate usage.

## 1.15 Success metrics

### Product metrics

- Percentage of users who grant location and receive results.
- Percentage of successful result sessions that open an iNaturalist observation link.
- Median and p75 number of species returned.
- Rate of no-result responses.

### Performance and infrastructure metrics

- Cloudflare cache hit ratio for the fungi API route.
- iNaturalist upstream requests per day.
- Upstream response latency and 429/5xx rate.
- Cached API TTFB at p50 and p75 from New Zealand.
- Client time from location acquisition to first rendered result.

### Initial targets

- At least 90% cache hit ratio after the cache has warmed in active areas.
- Fewer than 1,000 upstream iNaturalist requests per day during the initial launch phase.
- Cached API TTFB below 250 ms at p75 in New Zealand.
- First results rendered within 2 seconds of location acquisition on a cache hit under a typical 4G connection.

## 1.16 MVP acceptance criteria

The MVP is ready to release when:

1. A first-time user can grant location and see a ranked fungi list on a 360 px viewport.
2. Network inspection confirms that exact latitude and longitude never leave the browser.
3. The response contains no more than 20 species and each card includes all required fields or defined fallbacks.
4. Every taxon link opens a correctly filtered iNaturalist NZ observations page.
5. Two identical production requests show the expected Cloudflare cache behaviour, including a cache hit after warm-up.
6. A cache hit does not make an upstream iNaturalist request.
7. Upstream errors are not cached and stale successful data is served when available.
8. Location denial, missing photos, missing common names, no results, and upstream failure have tested interfaces.
9. Automated unit, integration, accessibility, and mobile end-to-end tests pass.
10. There is no database, KV, R2, map library, or iNaturalist authentication dependency.

# 2. Implementation Specification

## 2.1 Architecture overview

vinext reimplements substantial Next.js App Router functionality on Vite, supports route handlers, and has a first-party Cloudflare Workers deployment path. It is currently marked experimental, so the project should pin versions and include production smoke tests.[^vinext]

```text
Browser
  |-- renders static/client app shell
  |-- requests browser geolocation
  |-- lat/lng -> H3 resolution 6
  |-- discards exact coordinates
  |
  `-- GET /api/fungi/v1/en-NZ/r6/{cell}/{month}
          |
          | Cloudflare Workers Cache HIT
          |   `-- return normalised JSON; Worker code is not invoked
          |
          `-- Cache MISS / refresh
                |-- validate canonical request
                |-- Cloudflare Rate Limiting binding
                |-- call iNaturalist species_counts
                |-- normalise response and build links
                `-- return long-lived cacheable JSON
```

Cloudflare Workers Cache supports cached responses ahead of Worker execution, edge-only cache directives, stale-while-revalidate, stale-if-error, and optional cross-version cache reuse.[^cf-cache]

## 2.2 Technology choices

| Layer | Choice |
|---|---|
| Framework | vinext App Router with TypeScript |
| Deployment | Cloudflare Workers via `@vinext/cloudflare` |
| Package manager | pnpm |
| Location grid | `h3-js` |
| Client data fetching | Native `fetch`; no data library required for one endpoint |
| Styling | CSS Modules and CSS custom properties, unless the repository already standardises another lightweight approach |
| Images | Native `<img>` with fixed dimensions and lazy loading |
| API validation | Small explicit validators; a schema library is optional, not required |
| Tests | Vitest, Testing Library, Playwright, and axe integration |
| Persistence | Workers Cache only |

Avoid adding a heavyweight component library, state-management library, geocoder, map dependency, or image optimiser for the MVP.

## 2.3 Suggested project structure

```text
app/
  layout.tsx
  page.tsx
  globals.css
  api/
    fungi/
      v1/
        en-NZ/
          r6/
            [cell]/
              [month]/
                route.ts
components/
  location-gate.tsx
  results-header.tsx
  fungi-list.tsx
  fungi-card.tsx
  result-skeleton.tsx
  status-panel.tsx
lib/
  client-location.ts
  h3.ts
  months.ts
  fungi-api.ts
  inaturalist.ts
  inaturalist-links.ts
  types.ts
  validation.ts
public/
  fungi-placeholder.svg
```

Keep iNaturalist query construction, response normalisation, external URL construction, and month-window logic in pure functions that can be unit tested independently.

## 2.4 Location model

### Client conversion

Install H3:

```bash
pnpm add h3-js
```

Client helper:

```ts
import { latLngToCell } from "h3-js";

const H3_RESOLUTION = 6;

export async function getApproximateCell(): Promise<string> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30 * 60 * 1000,
    });
  });

  const cell = latLngToCell(
    position.coords.latitude,
    position.coords.longitude,
    H3_RESOLUTION,
  );

  // Do not persist or return the original coordinates.
  return cell;
}
```

### Local persistence

Use one versioned entry:

```ts
type StoredLocation = {
  version: 1;
  cell: string;
  resolution: 6;
  updatedAt: string;
};
```

Suggested local storage key:

```text
nearby-fungi:location:v1
```

Treat a stored cell as fresh for 30 days, but always expose **Refresh location**.

### Server conversion

The route handler converts the H3 cell to its centre latitude and longitude. Those centre coordinates are safe to use for both the upstream query and external iNaturalist link because they represent the shared cell, not the user's point.

## 2.5 Canonical API route

```text
GET /api/fungi/v1/en-NZ/r6/{cell}/{month}
```

Example:

```text
GET /api/fungi/v1/en-NZ/r6/86bb6db57ffffff/7
```

The cache key is the canonical URL. Do not accept equivalent free-form query parameters for latitude, longitude, radius, quality grade, result count, or taxon.

### Validation

Reject with `400` and `Cache-Control: no-store` when:

- The cell is not a valid H3 cell.
- The cell is not resolution 6.
- The month is not an integer from 1 to 12.
- The cell centre is outside the supported New Zealand coverage boundary.
- The path contains an unsupported locale or version.

The supported boundary can begin as compact code-owned polygons or bounding regions. A generated allowlist of valid New Zealand resolution 6 cells is a later hardening option, not an MVP prerequisite.

## 2.6 Response contract

```ts
export type FungiResponse = {
  schemaVersion: 1;
  generatedAt: string;
  query: {
    cell: string;
    resolution: 6;
    requestedMonth: number;
    includedMonths: number[];
    radiusKm: number;
    locale: "en-NZ";
  };
  coverage: {
    mode: "cell-centre-radius" | "expanded-radius" | "cell-ring";
    sourceCells: string[];
    expansionLevel: number;
    label: string;
  };
  source: {
    name: "iNaturalist";
    siteUrl: "https://inaturalist.nz";
  };
  results: FungiResult[];
};

export type FungiResult = {
  rank: number;
  taxonId: number;
  commonName: string | null;
  scientificName: string;
  observationCount: number;
  observationCountLabel: string;
  image: null | {
    url: string;
    attribution: string | null;
    licenseCode: string | null;
  };
  observationsUrl: string;
};
```

MVP coverage values:

```json
{
  "mode": "cell-centre-radius",
  "sourceCells": ["86bb6db57ffffff"],
  "expansionLevel": 0,
  "label": "Within about 30 km of your approximate area"
}
```

The frontend should display `coverage.label` and not derive copy from assumptions about the query.

## 2.7 Upstream iNaturalist request

Endpoint:

```text
GET https://api.inaturalist.org/v1/observations/species_counts
```

The endpoint returns leaf taxa associated with matching observations and orders them by count descending. It accepts the relevant month, geographic, taxonomic, rank, quality, locale, and pagination filters.[^inat-api]

Suggested parameters:

```ts
const params = new URLSearchParams({
  lat: centreLat.toFixed(5),
  lng: centreLng.toFixed(5),
  radius: "30",
  month: includedMonths.join(","),
  iconic_taxa: "Fungi",
  rank: "species",
  quality_grade: "research",
  locale: "en",
  per_page: "20",
});
```

Do not use `photos=true` for the ranking query. That would count only matching observations containing photographs and unnecessarily change the evidence measure. The taxon object can still include its default taxon photo.

### Authentication

No API key or OAuth flow is required. The public `GET /observations/species_counts` operation has no authentication requirement in the API definition; protected endpoints explicitly declare token security.[^inat-api]

### Upstream identification

Send a custom User-Agent from the Worker:

```text
NearbyFungi/1.0 (+https://example.nz/about; contact@example.nz)
```

iNaturalist asks application developers to keep requests around one per second and roughly 10,000 per day, avoid bulk extraction through the API, handle 429 responses, and identify their application with a custom User-Agent where possible.[^inat-practices]

## 2.8 Seasonal month calculation

```ts
export function getSeasonalMonths(month: number): [number, number, number] {
  const previous = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return [previous, month, next];
}
```

Sort or preserve the semantic order consistently. For display, format the month names chronologically across the year boundary; for example, December-February.

The cache key uses the requested month, not the explicit month list. A request for month 1 deterministically implies months 12, 1, and 2 under API version 1.

## 2.9 Response normalisation

For every upstream result:

1. Read `count` and `taxon`.
2. Preserve the upstream ordering.
3. Use `preferred_common_name` when present.
4. Always include the scientific `name`.
5. Prefer `default_photo.square_url` for the card; fall back to `medium_url`, then `url`.
6. Preserve `attribution` and `license_code`.
7. Build the filtered iNaturalist NZ observations URL.
8. Return only fields needed by the frontend.

The API definition exposes species count results containing `count` and a taxon record; taxon photos can include square and medium URLs, attribution, and licence code.[^inat-api]

## 2.10 External iNaturalist NZ links

Build links server-side from the cell centre and fixed query policy:

```ts
export function buildObservationsUrl(input: {
  taxonId: number;
  centreLat: number;
  centreLng: number;
  radiusKm: number;
  months: number[];
}): string {
  const url = new URL("https://inaturalist.nz/observations");

  url.search = new URLSearchParams({
    taxon_id: String(input.taxonId),
    lat: input.centreLat.toFixed(5),
    lng: input.centreLng.toFixed(5),
    radius: String(input.radiusKm),
    month: input.months.join(","),
    quality_grade: "research",
  }).toString();

  return url.toString();
}
```

Open with:

```html
<a target="_blank" rel="noopener noreferrer">View nearby observations</a>
```

The user should land on real matching observations rather than a generic taxon profile.

## 2.11 Cloudflare cache policy

### Cache configuration

```jsonc
{
  "cache": {
    "enabled": true,
    "cross_version_cache": true
  }
}
```

`cross_version_cache` prevents routine deployments from discarding warm entries, but it also means a deployment does not automatically invalidate cached responses. Keep the API path versioned and change `/v1/` when response semantics change. Cloudflare currently documents a Wrangler 4.107.0 minimum for this option.[^cf-cache]

### Successful response headers

```http
Cache-Control: public, max-age=3600
Cloudflare-CDN-Cache-Control: public, max-age=1209600, stale-while-revalidate=5184000, stale-if-error=7776000
Content-Type: application/json; charset=utf-8
```

Policy:

- Browser freshness: 1 hour.
- Cloudflare freshness: 14 days.
- Stale while background refreshing: 60 days.
- Stale on Worker or upstream failure: 90 days.

Cloudflare supports separate browser and edge directives through `Cloudflare-CDN-Cache-Control`; the Cloudflare-specific header has precedence and is stripped before reaching the browser.[^cf-cache]

Do not use `s-maxage`, `must-revalidate`, or `proxy-revalidate` with this policy because Cloudflare documents that they disable stale serving behaviour.[^cf-cache]

### Error response headers

```http
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
```

Convert an upstream 429 or 5xx into an application 503 so an expired successful response can be used through `stale-if-error`. A true cold miss cannot use stale data.

### Cache verification

Production smoke test:

```bash
curl -I "https://app.example.nz/api/fungi/v1/en-NZ/r6/{cell}/7"
curl -I "https://app.example.nz/api/fungi/v1/en-NZ/r6/{cell}/7"
```

Confirm the second request becomes a cache hit after warm-up and does not emit a corresponding upstream-call log.

## 2.12 Rate limiting

Use Cloudflare's Rate Limiting binding, not Workers KV. KV is optimised for read-heavy caching and is eventually consistent; writes can take 60 seconds or longer to appear in other locations, making it unsuitable for an exact counter.[^cf-kv]

Example binding:

```jsonc
{
  "ratelimits": [
    {
      "name": "INATURALIST_MISS_LIMITER",
      "namespace_id": "1001",
      "simple": {
        "limit": 30,
        "period": 60
      }
    }
  ]
}
```

Call the limiter immediately before the upstream fetch:

```ts
const { success } = await env.INATURALIST_MISS_LIMITER.limit({
  key: "species-counts-v1",
});

if (!success) {
  return Response.json(
    { error: "Data source temporarily busy" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
```

Cloudflare's binding is fast and route-specific, but its counters are local to each Cloudflare location and intentionally permissive rather than an exact global accounting mechanism.[^cf-rate]

This is adequate for the MVP because:

- Cache hits do not reach the upstream-call branch.
- The route accepts only canonical New Zealand cell/month combinations.
- The application is expected to have geographically concentrated traffic.
- Upstream 429s are monitored and can trigger stricter coordination later.

Do not describe the binding as a guaranteed global one-request-per-second limiter.

## 2.13 Images and attribution

### MVP strategy

- Use one taxon default photo URL from the species-count response.
- Use a native `<img>` rather than an optimisation pipeline.
- Set explicit `width` and `height` to prevent layout shift.
- Use `loading="lazy"` below the first visible cards and `decoding="async"`.
- Use `object-fit: cover` for square presentation.
- Show a local placeholder when no image exists or loading fails.
- Preserve the returned attribution and licence code.

Example:

```tsx
<img
  src={result.image?.url ?? "/fungi-placeholder.svg"}
  width={104}
  height={104}
  alt={`Photo of ${displayName} (${result.scientificName})`}
  loading={index < 3 ? "eager" : "lazy"}
  decoding="async"
/>
```

### Explicitly deferred

- Cloudflare Image Resizing.
- An image proxy.
- R2 replication.
- Selecting two or three observation photos per species.

Add an image proxy or R2 only if measurements show origin reliability, repeated image transfer, or licensing-controlled curation warrants it.

## 2.14 Client component boundaries

`app/page.tsx` can render static product copy and a client component for location and data state.

Suggested state machine:

```text
idle
  -> locating
  -> loading-results
  -> success
  -> denied
  -> unsupported
  -> no-results
  -> error
```

Avoid storing duplicate server state. One reducer or a small discriminated union is sufficient.

```ts
type ViewState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "loading-results"; cell: string }
  | { status: "success"; data: FungiResponse }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "no-results"; data: FungiResponse }
  | { status: "error"; message: string };
```

Use `AbortController` so refresh actions cancel an obsolete fetch.

## 2.15 UI implementation notes

### Card layout

```text
+----------+------------------------------------+
|          | Common name                       |
|  image   | Scientific name                   |
|          | 84 research-grade observations    |
|          | View nearby observations ->       |
+----------+------------------------------------+
```

Mobile CSS guidance:

- Card: CSS grid with columns `96px minmax(0, 1fr)`.
- Gap: 12-16 px.
- Card padding: 12-16 px.
- Border radius: 12-16 px.
- Keep shadows subtle or use a border.
- Common name: 1.05-1.2 rem, semibold.
- Scientific name: 0.9-1 rem, italic.
- Evidence and attribution: 0.8-0.9 rem.

Desktop:

- Increase grid image column to 120 px.
- Maintain one column and approximately 760 px maximum width.
- Use generous page margins rather than a dense multi-column dashboard.

## 2.16 Error handling

| Condition | Server behaviour | Client behaviour |
|---|---|---|
| Invalid path | 400, no-store | Generic invalid request; normally unreachable through UI |
| Outside supported NZ area | 400 or 422, no-store | Explain current NZ-only coverage |
| Rate limit reached | 503, no-store | Short busy message and retry |
| iNaturalist 429 | 503, no-store | Serve stale if available; otherwise retry message |
| iNaturalist 5xx/timeout | 503, no-store | Serve stale if available; otherwise retry message |
| Malformed upstream JSON | 502, no-store | Retry message; log structured error |
| Empty result list | 200 cacheable | No-result state |
| Missing image | 200 cacheable | Placeholder |
| Missing common name | 200 cacheable | Scientific name plus fallback common-name copy |

Set an upstream timeout of roughly 8-10 seconds using `AbortSignal.timeout()` or an `AbortController`.

## 2.17 Observability

Emit structured logs only on Worker execution, especially:

```json
{
  "event": "inat_species_counts",
  "apiVersion": 1,
  "month": 7,
  "resultCount": 20,
  "upstreamStatus": 200,
  "upstreamMs": 412,
  "expansionLevel": 0
}
```

Also log:

- Validation failures by reason.
- Rate-limiter rejection.
- Upstream timeout.
- iNaturalist 429 and 5xx.
- Normalisation failures.
- Empty results.

Do not log raw browser coordinates because the Worker never receives them. Avoid attaching user-identifying values to cell-level events.

Client analytics, if added, should record only:

- Location permission result.
- Results loaded.
- No results.
- iNaturalist link clicked.
- Refresh location used.

Do not include the exact H3 cell in third-party analytics by default.

## 2.18 Security and abuse controls

- Accept only `GET` and `HEAD` for the public data route.
- Validate all path segments.
- Fix query policy server-side.
- Do not expose a generic iNaturalist proxy.
- Limit supported cells to New Zealand coverage.
- Use a fixed upstream host and path; do not accept a user-supplied URL.
- Return a strict JSON content type.
- Set a conservative Content Security Policy for the app, explicitly permitting the known iNaturalist image hosts required by returned URLs.
- Use `rel="noopener noreferrer"` for outbound links.
- Keep dependencies pinned and run vinext compatibility checks during upgrades because vinext remains experimental.[^vinext]

## 2.19 Testing strategy

### Unit tests

- Month window for January, December, and ordinary months.
- H3 cell validation and resolution check.
- Supported NZ boundary check.
- iNaturalist parameter construction.
- Response normalisation.
- Missing common name and image fallbacks.
- External observations URL construction.
- Cache headers for success and errors.
- Coverage metadata defaults.

### Route integration tests

Mock the upstream response and verify:

- Correct URL and headers.
- No authentication token is added.
- Custom User-Agent is present.
- Upstream ordering is preserved.
- 429 and 5xx become 503.
- Invalid paths never call upstream.
- Rate-limit rejection never calls upstream.

### End-to-end tests

Use mocked browser geolocation:

- First visit and permission grant.
- Returning visit using stored cell.
- Refresh location.
- Permission denied.
- Unsupported geolocation.
- Successful result list at 360 px.
- Missing image and common name.
- External link parameters.
- Keyboard navigation.
- Automated axe scan.

### Production smoke tests

- Deploy via vinext Cloudflare integration.
- Fetch the same canonical route twice and inspect `Cf-Cache-Status`.
- Confirm a cached request produces no upstream log.
- Confirm exact mocked latitude/longitude does not appear in request URLs, application logs, or analytics payloads.
- Confirm stale data is served during a controlled upstream 503 test where feasible.

## 2.20 Deployment and configuration

Create or initialise the project with pnpm:

```bash
pnpm create vinext-app@latest nearby-fungi
cd nearby-fungi
pnpm add h3-js
```

vinext documents deployment through:

```bash
pnpm exec vinext check
pnpm exec vinext build
pnpm exec @vinext/cloudflare deploy
```

The initialisation flow creates or updates the Vite, Wrangler, and deployment configuration needed for Cloudflare Workers.[^vinext]

Suggested non-secret variables:

```text
INATURALIST_USER_AGENT
APP_BASE_URL
```

There should be no iNaturalist key or token in project configuration.

CI should run:

```bash
pnpm install --frozen-lockfile
pnpm exec vinext check
pnpm test
pnpm exec playwright test
pnpm exec vinext build
```

Pin vinext, its Cloudflare adapter, Wrangler, and H3 versions. Review upgrades intentionally.

## 2.21 Performance budgets

| Budget | Target |
|---|---:|
| Initial app JavaScript, gzipped | Less than 120 KB where practical |
| Above-the-fold images | No more than 3 eager thumbnails |
| Thumbnail display size | 88-128 px |
| Layout shift | CLS below 0.1 |
| Cached API TTFB p75 in NZ | Below 250 ms |
| API JSON payload | Preferably below 40 KB compressed |
| Upstream timeout | 8-10 seconds |
| LCP p75 on mobile | Below 2.5 seconds after location is available |

Use explicit image dimensions, a static shell, no map SDK, and no runtime UI framework beyond the existing React/vinext stack.

# 3. Future Expansion

## 3.1 Sparse-area and nearby-cell expansion

The MVP does not automatically widen the search. The response contract and UI copy must nevertheless support it from day one.

### Candidate trigger

A future backend policy can expand when either:

- Fewer than 12 species are returned; or
- The sum of displayed observation counts falls below a configurable evidence threshold.

These values should be measured before being finalised.

### Preferred first expansion: wider radius

A second request at a larger radius is the simplest upstream-efficient strategy:

```text
Expansion level 0: 30 km
Expansion level 1: 60 km
Expansion level 2: 100 km
```

Advantages:

- One species-count request per level.
- iNaturalist handles deduplication and aggregation.
- Existing ranking semantics remain clear.
- The cache key can remain the original local cell and month because expansion policy is deterministic inside the API version.

Response example:

```json
{
  "coverage": {
    "mode": "expanded-radius",
    "sourceCells": ["local-cell"],
    "expansionLevel": 1,
    "label": "Local records were sparse, so these results cover about 60 km"
  }
}
```

### Alternative expansion: neighbouring H3 cells

A later precomputed or local-data system may merge a `gridDisk` ring around the user's cell.

Requirements:

- Deduplicate by `taxonId`.
- Sum or otherwise combine counts with documented semantics.
- Preserve `sourceCells`.
- Avoid double-counting observations that appear in overlapping radius searches.
- Keep coverage copy explicit.

Because live radius queries overlap, do not merge several live radius responses by simply adding counts. Neighbour-cell aggregation is most appropriate once counts are computed from non-overlapping cell assignments in a local dataset.

## 3.2 Read-through KV cache

Add KV only if Workers Cache eviction or resilience becomes a measured issue.

Read path:

```text
Workers Cache -> KV result blob -> iNaturalist
```

KV would store the normalised answer for a cell and month, not rate-limit counters and not raw observations.

Potential benefits:

- Persistent last-known-good result.
- Easier prewarming of popular cells.
- Cached answers survive edge eviction.

Costs:

- Additional storage operations and invalidation logic.
- Eventual consistency.
- Another layer to observe and test.

## 3.3 Precomputed New Zealand aggregate

If traffic or product features justify removing live dependency, build a scheduled data pipeline rather than a request-time raw mirror:

```text
Bulk occurrence dataset
  -> filter New Zealand + Fungi
  -> assign each observation to H3 cell
  -> group by cell + calendar month + taxon
  -> generate ranked response JSON
  -> publish immutable/versioned objects to R2
```

The runtime route then reads one object per cell/month. This supports correct neighbouring-cell aggregation because each observation belongs to one base cell.

Do not build this before the launch metrics show meaningful upstream volume, cache misses, or product demand for custom spatial analysis.

## 3.4 Image caching or R2

Potential later stages:

1. Continue direct source images with browser and Cloudflare caching.
2. Add a cacheable read-through image route if source reliability becomes an issue.
3. Curate and copy licensed images to R2 only when stable ownership, prewarming, or multiple-photo detail views justify it.

Any copied image must retain licence and attribution metadata and comply with the source licence.

## 3.5 Other deferred features

- Manual town or postcode selection without a map.
- Broader taxonomic groups.
- Month selector or seasonal browsing.
- Species detail drawer.
- Two or three observation photos.
- Weather-aware ranking.
- Recent observation weighting.
- Map view.
- Saved favourites.
- Observation submission.

# 4. Delivery Plan

## Phase 0: Technical spike

Deliverables:

- Minimal vinext app deployed to Cloudflare.
- One hard-coded cacheable JSON route.
- Confirm Workers Cache behaviour and `Cf-Cache-Status`.
- Confirm route-handler access to the Rate Limiting binding.
- Confirm direct iNaturalist species-count request and custom User-Agent.
- Record any vinext compatibility gaps.

Exit criterion: two identical production requests demonstrate a warm cache hit and the second request does not execute upstream-fetch code.

## Phase 1: Functional MVP

Deliverables:

- Location gate and local H3 conversion.
- Versioned canonical API route.
- Upstream request and normalised contract.
- Mobile result cards.
- External iNaturalist NZ links.
- Loading, denied, empty, and error states.
- Local cell persistence and refresh location.
- Unit and integration tests.

## Phase 2: Hardening

Deliverables:

- Cache and rate-limit production configuration.
- Accessibility review and axe tests.
- Structured logs and dashboards.
- Production smoke tests.
- CSP and supported-area validation.
- Performance profiling on a mid-range mobile device.
- Cross-version cache enabled after API versioning tests pass.

## Phase 3: Launch and measure

For the first 4-6 weeks, review:

- Cache hit ratio.
- Distinct active cells.
- Upstream calls per day.
- Empty-result areas.
- Result counts and link click-through.
- iNaturalist 429 or availability failures.
- Image failures.

Do not add KV, R2, or a local occurrence dataset until these measurements identify a real constraint.

# 5. Open Decisions

The following defaults are recommended but should be confirmed during implementation review:

| Decision | Recommended default |
|---|---|
| Public product name | Nearby Fungi as a working title |
| Results per page | 20 |
| H3 resolution | 6 |
| Initial radius | 30 km |
| Seasonal window | Previous/current/next month |
| Stored-cell lifetime | 30 days |
| First-visit behaviour | Explicit Show fungi near me button |
| Desktop layout | Centred single-column list |
| Analytics | Cloudflare operational metrics first; minimal product events only |
| Sparse-area fallback | Defer, but design response contract now |

# Appendix A: Route-handler outline

```ts
import { env } from "cloudflare:workers";
import { cellToLatLng, getResolution, isValidCell } from "h3-js";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cell: string; month: string }> },
): Promise<Response> {
  const { cell, month: rawMonth } = await context.params;
  const month = Number(rawMonth);

  if (!isValidCell(cell) || getResolution(cell) !== 6 || !isValidMonth(month)) {
    return noStoreJson({ error: "Invalid request" }, 400);
  }

  const [lat, lng] = cellToLatLng(cell);
  if (!isSupportedNzLocation(lat, lng)) {
    return noStoreJson({ error: "Outside supported area" }, 422);
  }

  const { success } = await env.INATURALIST_MISS_LIMITER.limit({
    key: "species-counts-v1",
  });
  if (!success) {
    return noStoreJson({ error: "Data source temporarily busy" }, 503);
  }

  const months = getSeasonalMonths(month);
  const upstream = await fetch(buildInatUrl({ lat, lng, months }), {
    headers: {
      Accept: "application/json",
      "User-Agent": env.INATURALIST_USER_AGENT,
    },
    signal: AbortSignal.timeout(9_000),
  });

  if (!upstream.ok) {
    return noStoreJson({ error: "Data source temporarily unavailable" }, 503);
  }

  const payload = await upstream.json();
  const body = normaliseSpeciesCounts({ payload, cell, month, months, lat, lng });

  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Cloudflare-CDN-Cache-Control":
        "public, max-age=1209600, " +
        "stale-while-revalidate=5184000, " +
        "stale-if-error=7776000",
    },
  });
}
```

# Appendix B: Key engineering decisions

## Why not a database now?

The only runtime question is a deterministic cell/month lookup whose answer is reproducible from iNaturalist. Long-lived HTTP caching removes most repeated upstream work without ingestion or database operations.

## Why not KV now?

Workers Cache already handles the hot path before Worker execution. KV adds value only as a persistent second-level cache. It should not be used for strict rate-limit counters because of eventual consistency.[^cf-kv]

## Why H3 resolution 6?

It removes point-level precision, yields substantial cache sharing, and is still local enough for a 30 km recommendation query. The API version can change resolution later without breaking old cached responses.

## Why no map?

A map adds JavaScript, interaction design, accessibility work, location detail, and product complexity without improving the core ranked-list job.

## Why one image?

One image provides recognition value while keeping cards compact and network use predictable. iNaturalist remains the destination for additional observation photos.

# References

[^vinext]: vinext, official project and Cloudflare deployment overview: https://vinext.io/

[^cf-cache]: Cloudflare, Workers Cache configuration, versioning, cache directives, stale serving, and header precedence: https://developers.cloudflare.com/workers/cache/configuration/

[^cf-rate]: Cloudflare, Workers Rate Limiting binding, locality, performance, and accuracy: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

[^cf-kv]: Cloudflare, Workers KV architecture and eventual consistency: https://developers.cloudflare.com/kv/concepts/how-kv-works/

[^inat-api]: iNaturalist API v1 Swagger definition, including `observations/species_counts`, parameters, response fields, public versus protected operations, and taxon photo metadata: https://api.inaturalist.org/v1/swagger.json

[^inat-practices]: iNaturalist API Recommended Practices: https://www.inaturalist.org/pages/api+recommended+practices

[^h3]: H3, tables of cell statistics across resolutions: https://h3geo.org/docs/core-library/restable/
