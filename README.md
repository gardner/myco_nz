# Nearby Fungi

Nearby Fungi is a mobile-first view of the fungi most often recorded near an approximate area at the current time of year. It uses public iNaturalist research-grade observation counts and links every result back to the matching observations on iNaturalist NZ.

## Privacy Model

The browser requests location with high accuracy disabled, converts the coordinates to an H3 resolution 6 cell, and discards the original coordinates. Only the cell, resolution, and update time are stored locally. Network requests contain the approximate cell, never the browser coordinates.

The server converts the shared cell to its centre, applies fixed 30 km and seasonal filters, and returns a normalized response. There are no accounts, analytics, database, KV namespace, R2 bucket, map, or iNaturalist credentials.

## Development

Requires Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

## Quality Checks

```bash
pnpm quality       # TypeScript and ESLint
pnpm test          # Vitest unit, integration, and component tests
pnpm test:e2e      # Chromium, mobile layout, privacy, and axe checks
pnpm check:vinext  # vinext compatibility scan
pnpm build         # Cloudflare Worker production build
pnpm verify        # All non-browser checks above
```

ESLint enforces a maximum cyclomatic complexity of 12 per function and 300 nonblank, noncomment lines per file.

Tests use a trimmed iNaturalist response captured from the real Wellington-area species-count endpoint. The configured upstream User-Agent is `myco.nz/1.0 <gardner@bickford.nz>`.

## Worker Preview

```bash
pnpm build
pnpm start
```

The built Worker runs locally at [http://localhost:8787](http://localhost:8787).

## Deployment Checks

Deploy with the vinext Cloudflare adapter:

```bash
pnpm run deploy:vinext
```

After deployment, request the same canonical API URL twice and inspect `Cf-Cache-Status`:

```bash
curl -sS -D - -o /dev/null "https://myco.nz/api/fungi/v1/en-NZ/r6/86bb2955fffffff/7"
curl -sS -D - -o /dev/null "https://myco.nz/api/fungi/v1/en-NZ/r6/86bb2955fffffff/7"
```

The warmed response should be a cache hit, and Worker logs should show no second iNaturalist request. Production smoke testing is also required for stale-if-error behavior because local tests cannot prove edge-cache semantics.
