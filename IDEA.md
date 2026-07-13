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

> **Product decision:** Build a deliberately small, mobile-first view into iNaturalist data. The browser converts either device location or a point chosen on a static New Zealand map into an approximate H3 cell, discards the original point, and queries iNaturalist directly with the cell centre and seasonal filters. The MVP uses no application data API, database, KV namespace, R2 bucket, map SDK, user account, or iNaturalist authentication.

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
| Map | Route-isolated static SVG fallback at `/map`; no tiles or map SDK |
| Location | Browser geolocation or a manual map point converted locally to H3 resolution 6 |
| Exact coordinates | Used only in the browser, then discarded |
| Seasonal query | Previous, current, and next calendar month across all years |
| Geographic query | 30 km radius from the H3 cell centre |
| Ranking | iNaturalist research-grade observation count, descending |
| Results | Top 20 species |
| Card content | One image, common name, scientific name, observation count, iNaturalist NZ link |
| Data source | iNaturalist `observations/species_counts` |
| API authentication | None required for this public read endpoint |
| Persistence | Browser local storage for the approximate H3 cell only |
| Request control | A 10-second deadline, browser-side one-request-per-second pacing, request coalescing, and a 10-second cooldown after `429` |
| Images | Use iNaturalist taxon default image URLs directly; no image resizing or R2 in MVP |
| Future sparse-area handling | Normalized client model supports expansion metadata without requiring a frontend rewrite |

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
2. Make the initial result list fast and responsive on repeat and shared-location requests.
3. Avoid sending exact user coordinates to any network service.
4. Minimise upstream load through one-request-per-second pacing, cancellation of obsolete requests, and a cooldown after throttling.
5. Clearly represent the list as historical observation frequency, not a guaranteed encounter probability.
6. Keep the implementation small enough to maintain while leaving a clean path to wider-area results and precomputed data later.

## 1.5 Non-goals for the MVP

- Mushroom identification from a photograph.
- Edibility, toxicity, harvesting, or medical advice.
- General-purpose map browsing, pan/zoom tiles, or geographic search.
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
5. The client validates the H3 cell and month, converts the cell to its centre, and requests the fixed iNaturalist species-count query directly.
6. Loading skeletons appear while data is fetched.
7. The ranked result list appears.
8. The browser URL is replaced with the approximate H3 cell and selected month for sharing.
9. The H3 cell and timestamp are saved locally for future visits.

### Returning visit

1. If a recent saved cell exists, load its current-month result automatically.
2. Show a small **Refresh location** control for users who have moved.
3. Re-request browser location only when needed or explicitly requested.

### Result exploration

1. The user can choose any month from a 12-box selector above the ranked list.
2. The URL and result list update to the same approximate cell and selected month.
3. The user scans common names, scientific names, images, and counts.
4. The user taps **View nearby observations**.
5. A new tab opens on `inaturalist.nz/observations` filtered to the taxon, seasonal months, approximate cell centre, and search radius.

## 1.8 Information architecture and screens

### A. Location request state

Content:

- Product name.
- Heading: **Fungi likely near you**.
- Supporting text: **See the fungi most often recorded around your approximate area at this time of year.**
- Primary button: **Show fungi near me**.
- Privacy note: **Your exact location stays on this device. We send only an approximate area directly to iNaturalist.**
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

- Explain that automatic location is unavailable.
- Repeat that exact coordinates are converted to an approximate cell locally.
- Provide **Try again** and a link to the static `/map` fallback.
- Allow the user to choose an approximate area on the New Zealand outline without a geocoder or tile service.

### E. No-result state

- Heading: **Not enough local records yet**.
- Explain that iNaturalist may have sparse records for this area and season.
- Link to a broader fungi observation search on iNaturalist NZ.
- Keep the API response model ready for a later automatic wider-area fallback.

### F. Upstream failure state

- Show a short failure message and **Try again**.
- Keep the selected cell and month ready for retry.
- After an iNaturalist `429`, wait at least 10 seconds before starting another request.

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

Request and return the top 20 results. Do not reorder or silently omit species solely because a photo or common name is absent.

## 1.11 Functional requirements

| ID | Requirement |
|---|---|
| FR-001 | The first screen must explain the product and request location with one primary action. |
| FR-002 | Exact latitude and longitude must be converted to H3 resolution 6 in the browser and discarded before any data request. |
| FR-003 | The client must restore and share results using a URL containing the H3 cell and selected month. |
| FR-004 | The browser must validate the H3 cell, resolution, month, and supported New Zealand coverage before contacting iNaturalist. |
| FR-005 | The browser must call the fixed iNaturalist species-count endpoint with only the H3 cell centre and fixed query policy. |
| FR-006 | The browser must normalise and validate the upstream payload before rendering it. |
| FR-007 | The result list must show one image, common name, scientific name, matching observation count, and external observation link. |
| FR-008 | The observation link must use the approximate cell centre and never the user's original coordinates. |
| FR-009 | The application must preserve image attribution and licence metadata returned by iNaturalist. |
| FR-010 | The client must omit credentials and must not add a custom `User-Agent` or `X-Via` header to iNaturalist requests. |
| FR-011 | The application must work without an iNaturalist API key, user login, application login, or OAuth flow. |
| FR-012 | The response must include coverage metadata that can represent later nearby-cell or wider-radius expansion. |
| FR-013 | The application must provide a useful denied-location, no-result, and upstream-error state. |
| FR-014 | The `/map` fallback must use route-isolated static SVG geometry with no map SDK, tile service, or geocoder. |
| FR-015 | Results must provide a 12-box month selector immediately above the ranked list and visibly distinguish the selected month. |
| FR-016 | The browser URL must contain the canonical approximate H3 cell and selected month so the result view can be shared and restored without geolocation. |
| FR-017 | Data requests must have a 10-second deadline, be spaced at least one second apart, cancel obsolete work, and start a cooldown of at least 10 seconds after a `429`. |

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
- Send only the H3 cell centre and fixed seasonal filters to iNaturalist, never the original device or map point.
- Recognise that a direct request exposes normal web metadata to iNaturalist, including the visitor's public IP address and browser-provided origin, referrer, and user agent.
- Use `credentials: "omit"` and do not add custom identification headers.
- Do not send the cell to third-party product analytics unless explicitly reviewed.

## 1.15 Success metrics

### Product metrics

- Percentage of users who grant location and receive results.
- Percentage of successful result sessions that open an iNaturalist observation link.
- Median and p75 number of species returned.
- Rate of no-result responses.

### Performance and infrastructure metrics

- iNaturalist request latency and 429/5xx rate observed by the client.
- Requests started per result session.
- Cancelled obsolete requests during month selection.
- Client time from location acquisition to first rendered result.

### Initial targets

- No more than one iNaturalist request starts per second in one browser session.
- A `429` prevents another request from starting for at least 10 seconds.
- First results render within 2 seconds of location acquisition when iNaturalist responds promptly on a typical 4G connection.

## 1.16 MVP acceptance criteria

The MVP is ready to release when:

1. A first-time user can grant location and see a ranked fungi list on a 360 px viewport.
2. Network inspection confirms that exact latitude and longitude never leave the browser.
3. The response contains no more than 20 species and each card includes all required fields or defined fallbacks.
4. Every taxon link opens a correctly filtered iNaturalist NZ observations page.
5. Network inspection confirms that the browser requests `api.inaturalist.org` with only the H3 centre and fixed filters, omits credentials, and adds no custom identification headers.
6. Rapid month changes cancel obsolete work and do not start requests more often than once per second.
7. A stalled request or iNaturalist `429` produces a tested failure state; `429` also starts a cooldown of at least 10 seconds.
8. Location denial, missing photos, missing common names, no results, and upstream failure have tested interfaces.
9. Automated unit, integration, accessibility, and mobile end-to-end tests pass.
10. There is no application data route, database, KV, R2, map library, or iNaturalist authentication dependency.
11. A shared cell-and-month URL restores the same result query, and all 12 months remain usable at the mobile baseline.

# 2. Implementation Specification

## 2.1 Architecture overview

vinext reimplements substantial Next.js App Router functionality on Vite and has a first-party Cloudflare Workers deployment path. It is currently marked experimental, so the project should pin versions and retain compatibility coverage in CI.[^vinext]

```text
Browser
  |-- renders static/client app shell
  |-- device location or map point -> H3 resolution 6
  |-- discards the original point
  |-- validates the shared H3 cell and selected month
  |-- H3 cell -> approximate centre coordinates
  |-- paces and coalesces requests
  |
  `-- GET https://api.inaturalist.org/v1/observations/species_counts
          |-- H3 centre, 30 km radius, seasonal and taxonomic filters
          `-- raw public response
                |
                `-- browser normalises and validates fields and URL origins
```

The Cloudflare Worker serves the application shell and static assets. It is not an iNaturalist data proxy and has no data API, cache binding, rate-limit binding, database, KV namespace, or R2 bucket. The legacy `/api/fungi/v1/en-NZ/r6/{cell}/{month}` path only redirects old links to the equivalent shareable page and never contacts iNaturalist.

Because the species-count request is made directly, iNaturalist receives the visitor's public IP address and normal browser metadata such as `Origin`, `Referer`, and the browser's own user agent. Exact device coordinates and exact map points never appear in that request.

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
| Persistence | Browser local storage for the approximate H3 cell only |

Avoid adding a heavyweight component library, state-management library, geocoder, map dependency, or image optimiser for the MVP.

## 2.3 Suggested project structure

```text
app/
  layout.tsx
  page.tsx
  globals.css
  map/
    page.tsx
    map-page.module.css
components/
  location-experience.tsx
  location-views.tsx
  map-experience.tsx
  month-selector.tsx
  fungi-list.tsx
lib/
  client-location.ts
  fungi-client.ts
  inaturalist.ts
  months.ts
  nz-map-geometry.ts
  request-pacer.ts
  shared-location.ts
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

### Cell-centre conversion

The browser converts the validated H3 cell to its centre latitude and longitude. Those centre coordinates are used for both the direct iNaturalist query and external iNaturalist link because they represent the shared cell, not the user's point.

## 2.5 Browser query and validation

The shareable application URL is the canonical input:

```text
/?cell=86bb6db57ffffff&month=7
```

Before starting a network request, the browser rejects the selection when:

- The cell is not a valid H3 cell.
- The cell is not resolution 6.
- The month is not an integer from 1 to 12.
- The cell centre is outside the supported New Zealand coverage boundary.

The supported boundary can begin as compact code-owned polygons or bounding regions. A generated allowlist of valid New Zealand resolution 6 cells is a later hardening option, not an MVP prerequisite.

## 2.6 Response contract

The browser converts the raw iNaturalist response into this internal model before it reaches the UI:

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

The browser sends the request with `credentials: "omit"`, an `Accept: application/json` header, and `referrerPolicy: "strict-origin-when-cross-origin"`. This is a simple CORS request to a fixed origin; the Content Security Policy allows `connect-src https://api.inaturalist.org`.

Do not use `photos=true` for the ranking query. That would count only matching observations containing photographs and unnecessarily change the evidence measure. The taxon object can still include its default taxon photo.

### Authentication

No API key or OAuth flow is required. The public `GET /observations/species_counts` operation has no authentication requirement in the API definition; protected endpoints explicitly declare token security.[^inat-api]

### Request identity and pacing

Do not set `User-Agent` or `X-Via`; browser JavaScript cannot reliably control the user agent, and the direct request already carries the browser's native user agent plus normal `Origin` and `Referer` metadata. Do not attach cookies or other credentials.

iNaturalist asks application developers to keep requests around one per second, avoid bulk extraction through the API, and handle `429` responses.[^inat-practices] A browser-local coordinator therefore:

- Starts requests no more often than once per second.
- Cancels an obsolete in-flight request when the selected cell or month changes.
- Coalesces rapid month changes so only the latest selection proceeds.
- Stops waiting after 10 seconds so a stalled connection reaches the retry state.
- Defers subsequent work for at least 10 seconds after a `429`.

## 2.8 Seasonal month calculation

```ts
export function getSeasonalMonths(month: number): [number, number, number] {
  const previous = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return [previous, month, next];
}
```

Sort or preserve the semantic order consistently. For display, format the month names chronologically across the year boundary; for example, December-February.

The shareable URL uses the requested month, not the explicit month list. A selection of month 1 deterministically implies months 12, 1, and 2.

## 2.9 Response normalisation

For every upstream result:

1. Read `count` and `taxon`.
2. Preserve the upstream ordering.
3. Use `preferred_common_name` when present.
4. Always include the scientific `name`.
5. Prefer `default_photo.square_url` for the card; fall back to `medium_url`, then `url`.
6. Preserve `attribution` and `license_code`.
7. Build the filtered iNaturalist NZ observations URL.
8. Retain only fields needed by the frontend.
9. Validate the normalized object and allow external and image URLs only from the expected iNaturalist origins.

The API definition exposes species count results containing `count` and a taxon record; taxon photos can include square and medium URLs, attribution, and licence code.[^inat-api]

## 2.10 External iNaturalist NZ links

Build links in the browser from the cell centre and fixed query policy:

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

## 2.11 Images and attribution

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

## 2.12 Client component boundaries

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

Avoid storing duplicate remote result state. One reducer or a small discriminated union is sufficient.

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

## 2.13 UI implementation notes

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

## 2.14 Error handling

| Condition | Client behaviour |
|---|---|
| Invalid shared cell or month | Reject before network access and offer location refresh or `/map` |
| Outside supported NZ area | Reject before network access and explain current NZ-only coverage |
| iNaturalist 429 | Show the retry message and defer another request for at least 10 seconds |
| iNaturalist 5xx or network failure | Show the retry message while retaining the selected cell and month |
| Malformed or unsafe upstream response | Reject the response and show the retry message |
| Empty result list | Show the no-result state |
| Missing image | Show the local placeholder |
| Missing common name | Show the scientific name plus fallback common-name copy |

Use `AbortController` to cancel an obsolete request when location or month changes. An abort is not presented as an error when a newer request owns the UI state.

## 2.15 Observability

The Cloudflare Worker serves the application and therefore cannot log direct iNaturalist response status, latency, or result count. Do not add browser telemetry merely to recreate server-side upstream logs.

Client analytics, if added, should record only:

- Location permission result.
- Results loaded.
- No results.
- iNaturalist link clicked.
- Refresh location used.

Do not include the exact H3 cell in third-party analytics by default.

## 2.16 Security and abuse controls

- Validate the H3 cell, resolution, month, and New Zealand coverage before network access.
- Keep the iNaturalist origin, path, radius, taxon, rank, quality, locale, and result limit fixed in code; do not accept a user-supplied upstream URL.
- Omit credentials and add no authentication or custom identification headers.
- Treat the upstream response as untrusted structured data and reject malformed required fields.
- Allow observation, taxon-photo, and image URLs only from expected HTTPS iNaturalist origins.
- Set a conservative Content Security Policy that permits connections to `api.inaturalist.org` and the known image hosts required by validated results.
- Use `rel="noopener noreferrer"` for outbound links.
- Keep dependencies pinned and run vinext compatibility checks during upgrades because vinext remains experimental.[^vinext]

## 2.17 Testing strategy

### Unit tests

- Month window for January, December, and ordinary months.
- H3 cell validation and resolution check.
- Supported NZ boundary check.
- iNaturalist parameter construction.
- Response normalisation.
- Missing common name and image fallbacks.
- External observations URL construction.
- Image and external URL origin allowlists.
- Coverage metadata defaults.
- One-request-per-second pacing, abortable waits, and post-`429` cooldown.

### Client integration tests

Mock the upstream response and verify:

- The browser calls the fixed iNaturalist origin with the H3 centre and seasonal filters.
- The original mocked geolocation or map point is absent from the request URL.
- `credentials: "omit"` and the expected referrer policy are used.
- No authentication token, custom `User-Agent`, or `X-Via` header is added.
- Upstream ordering is preserved.
- A `429` is distinguished so the coordinator can start its cooldown.
- A request that does not settle reaches the retry state after the deadline.
- Invalid or unsupported shared selections never call upstream.
- Unsafe image and link origins are rejected.

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
- Direct cross-origin iNaturalist request interception.
- Exact mocked latitude/longitude absent from all request URLs.
- Rapid month selection coalescing and focus retention.
- Legacy fungi URLs redirect to the equivalent cell-and-month page without an upstream request.

## 2.18 Deployment and configuration

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

## 2.19 Performance budgets

| Budget | Target |
|---|---:|
| Initial app JavaScript, gzipped | Less than 120 KB where practical |
| Above-the-fold images | No more than 3 eager thumbnails |
| Thumbnail display size | 88-128 px |
| Layout shift | CLS below 0.1 |
| iNaturalist API response time p75 in NZ | Below 2 seconds where the upstream permits |
| API JSON payload | Preferably below 40 KB compressed |
| LCP p75 on mobile | Below 2.5 seconds after location is available |

Use explicit image dimensions, a static shell, no map SDK, and no runtime UI framework beyond the existing React/vinext stack.

# 3. Future Expansion

## 3.1 Sparse-area and nearby-cell expansion

The MVP does not automatically widen the search. The response contract and UI copy must nevertheless support it from day one.

### Candidate trigger

A future query policy can expand when either:

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
- The shareable selection can remain the original local cell and month because expansion policy is deterministic.

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

## 3.2 Precomputed New Zealand aggregate

If traffic or product features justify removing live dependency, build a scheduled data pipeline rather than a request-time raw mirror:

```text
Bulk occurrence dataset
  -> filter New Zealand + Fungi
  -> assign each observation to H3 cell
  -> group by cell + calendar month + taxon
  -> generate ranked response JSON
  -> publish immutable/versioned objects to R2
```

If such a system is adopted later, the application can read one immutable object per cell and month instead of calling the live API. This supports correct neighbouring-cell aggregation because each observation belongs to one base cell.

Do not build this before measured demand or persistent upstream availability problems justify adding storage and a data pipeline.

## 3.3 Image caching or R2

Potential later stages:

1. Continue direct source images with normal browser and origin HTTP caching.
2. Add a cacheable read-through image route if source reliability becomes an issue.
3. Curate and copy licensed images to R2 only when stable ownership, prewarming, or multiple-photo detail views justify it.

Any copied image must retain licence and attribution metadata and comply with the source licence.

## 3.4 Other deferred features

- Manual town or postcode selection without a map.
- Broader taxonomic groups.
- Species detail drawer.
- Two or three observation photos.
- Weather-aware ranking.
- Recent observation weighting.
- Saved favourites.
- Observation submission.

# 4. Delivery Plan

## Phase 0: Technical spike

Deliverables:

- Minimal vinext app deployed to Cloudflare.
- Confirm browser CORS access to the public iNaturalist species-count endpoint.
- Confirm exact coordinates can be discarded before the direct request.
- Confirm the response contains sufficient taxon photo and attribution metadata.
- Record any vinext compatibility gaps.

Exit criterion: a browser request using only an H3 centre and fixed filters renders normalized real iNaturalist fixture data.

## Phase 1: Functional MVP

Deliverables:

- Location gate and local H3 conversion.
- Shareable cell-and-month URL.
- Direct iNaturalist request and client-side normalized contract.
- Mobile result cards.
- Static `/map` fallback and month selector.
- External iNaturalist NZ links.
- Loading, denied, empty, and error states.
- Local cell persistence and refresh location.
- Unit and integration tests.

## Phase 2: Hardening

Deliverables:

- One-request-per-second pacing, obsolete-request cancellation, and post-`429` cooldown.
- Accessibility review and axe tests.
- CSP, response-origin allowlists, and supported-area validation.
- Performance profiling on a mid-range mobile device.
- Chromium and WebKit privacy-focused end-to-end tests.

## Phase 3: Launch and measure

For the first 4-6 weeks, review available aggregate and privacy-safe signals:

- Application load and rendering performance.
- Empty-result areas.
- Result counts and link click-through.
- iNaturalist 429 or availability failures.
- Image failures.

Do not add a database, KV, R2, a proxy route, or a local occurrence dataset until measurements identify a real constraint and the privacy impact has been reviewed.

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
| Analytics | None by default; add only privacy-reviewed aggregate events |
| Sparse-area fallback | Defer, but design response contract now |

# Appendix A: Key engineering decisions

## Why not a database now?

The runtime question is a small public iNaturalist lookup that the browser can make directly. A database would add ingestion, retention, privacy, and operational concerns without improving the MVP answer.

## Why H3 resolution 6?

It removes point-level precision and is still local enough for a 30 km recommendation query. The shared URL can change resolution later under an explicit migration.

## Why only a static map fallback?

The ranked list remains the core job. A route-isolated SVG outline provides a private fallback when device location is unavailable without adding tiles, pan and zoom controls, a geocoder, or a map SDK to the primary experience.

## Why one image?

One image provides recognition value while keeping cards compact and network use predictable. iNaturalist remains the destination for additional observation photos.

# References

[^vinext]: vinext, official project and Cloudflare deployment overview: https://vinext.io/

[^inat-api]: iNaturalist API v1 Swagger definition, including `observations/species_counts`, parameters, response fields, public versus protected operations, and taxon photo metadata: https://api.inaturalist.org/v1/swagger.json

[^inat-practices]: iNaturalist API Recommended Practices: https://www.inaturalist.org/pages/api+recommended+practices

[^h3]: H3, tables of cell statistics across resolutions: https://h3geo.org/docs/core-library/restable/
