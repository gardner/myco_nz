# Nearby Fungi

Nearby Fungi is a mobile-first view of the fungi most often recorded near an approximate area at a selected time of year. It uses public iNaturalist research-grade observation counts and links every result back to the matching observations on iNaturalist NZ.

## Privacy Model

The browser requests location with high accuracy disabled, converts the coordinates to an H3 resolution 6 cell, and discards the original coordinates. Users can instead choose a point on the static `/map` fallback; that point is converted and discarded the same way. Only the cell, resolution, and update time are stored locally. Shareable URLs contain the approximate cell and selected month, never the original coordinates.

Result pages use `/?cell=<resolution-6-H3>&month=<1-12>`. The 12-box month selector updates this URL and reloads the matching seasonal window, so the current view can be shared directly.

The browser validates the cell and month, converts the cell to its centre, and sends those approximate centre coordinates with fixed 30 km and seasonal filters directly to `api.inaturalist.org`. It then normalizes and validates the returned fields and permits images only from known iNaturalist origins. iNaturalist receives the visitor's public IP address and normal web request metadata such as the browser user agent, origin, and referrer; it never receives the original device or map coordinates.

Requests omit credentials and do not add a custom `User-Agent` or `X-Via` header. A client-side coordinator applies a 10-second request deadline, spaces requests at least one second apart, cancels obsolete month selections, and waits at least 10 seconds after an iNaturalist `429` before another request. There are no accounts, analytics, application data API, database, KV namespace, R2 bucket, map SDK, tile service, or iNaturalist credentials.

Legacy `/api/fungi/v1/en-NZ/r6/<cell>/<month>` links permanently redirect to the equivalent shareable page. The compatibility route never contacts iNaturalist.

The static New Zealand outline is derived from Natural Earth 1:10m Admin 0 - Countries v5.1.1, which is public-domain data.

## Development

Requires Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

For local development without browser geolocation, set `NEXT_PUBLIC_LOCATION_SEED` to a resolution 6 H3 cell in `.env.development.local`. This seed is not loaded by production builds.

## Quality Checks

```bash
pnpm quality       # TypeScript and ESLint
pnpm test          # Vitest unit, integration, and component tests
pnpm test:e2e      # Chromium, WebKit, mobile layout, privacy, and axe checks
pnpm check:vinext  # vinext compatibility scan
pnpm build         # Cloudflare Worker production build
pnpm verify        # All non-browser checks above
```

ESLint enforces a maximum cyclomatic complexity of 12 per function and 300 nonblank, noncomment lines per file.

Tests use a trimmed iNaturalist response captured from the real Wellington-area species-count endpoint.

## Worker Preview

```bash
pnpm build
pnpm start
```

The built Worker runs locally at [http://localhost:8787](http://localhost:8787).

## Deployment

Deploy with the vinext Cloudflare adapter:

```bash
pnpm run deploy:vinext
```
