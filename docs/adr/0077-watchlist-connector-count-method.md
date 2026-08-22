# ADR-0077: Watchlist connector count and preview endpoint

**Status:** Proposed (2026-08-23)

**Authorizes:** a `POST /v1/watchlists/preview-volume` endpoint and an optional `SocialConnector.count?()` method that estimates how many posts a watchlist query would match on each selected connector before the user activates the watchlist.

**Source:** `docs/product-research/feature-designs/26-watchlist-volume-preview.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The watchlist volume preview feature needs a per-connector estimate
`docs/product-research/feature-designs/26-watchlist-volume-preview.md` describes a preview that, for each selected connector, estimates how many posts a watchlist query would match before the watchlist is activated and full ingestion begins. The goal is to prevent runaway rate-limit, storage, and AI-enrichment costs.

### 2. Connectors have different count capabilities
- **GNews** (ADR-0064, Story 2.7), **Newswire** (ADR-0024, Story 2.6), **Wikipedia** (ADR-0042, Story 2.13), **Brave Search** (ADR-0065, Story 2.21), and **Bing Search** (ADR-0066, Story 2.22) often expose a total-results or page-count field alongside search results.
- **Facebook** (ADR-0059, Story 2.15), **Instagram** (ADR-0067), and **LinkedIn** (ADR-0070) generally do not expose a direct count endpoint for the queries this platform can run.
- A single connector may or may not support counting depending on API tier, query operators, and platform terms.

### 3. The `SocialConnector` interface is already pluggable
`ProviderConnector` / `SocialConnector` already abstracts `poll()` per platform. Adding an optional `count?()` method keeps the change additive and lets each connector declare its own capability, consistent with ADR-0026's and ADR-0064's connector design conventions.

---

## Decision

### 1. Add an optional `SocialConnector.count?()` method
```ts
interface SocialConnector {
  // ... existing methods ...
  count?(
    ctx: ConnectorContext,
    args: { ast: WatchlistAST; timeWindow: TimeWindow }
  ): Promise<ConnectorCountResult>;
}

interface ConnectorCountResult {
  count: number;
  confidence: 'exact' | 'estimate';
}
```

- `count?()` is **optional**. If a connector does not implement it, the backend falls back to a limited preview sample.
- The method receives the same `WatchlistAST` and `timeWindow` used for `poll()`.
- The result must be tenant-scoped and use the connector's existing credentials and `RequestGate`.

### 2. Fallback to a limited preview sample for non-count connectors
When `count?()` is absent or returns `null`:

- Call `connector.poll({ limit: previewSampleSize, ast, timeWindow })` with a small, fixed `previewSampleSize` (default 100).
- Extrapolate the total from the sample using the time window and the connector's known publishing cadence.
- Return `confidence: 'estimate'` and the `sampleSize`.

### 3. New `POST /v1/watchlists/preview-volume` endpoint
```ts
// Request
{
  ast: WatchlistAST;
  connectorIds: string[];
  timeWindow?: { start?: ISOString; end?: ISOString };
}

// Response
{
  totalEstimatedPosts: number;
  breakdown: Array<{
    connectorId: string;
    platformId: string;
    estimatedPosts: number;
    confidence: 'exact' | 'estimate' | 'unavailable';
    sampleSize?: number;
    rateLimitCost: number;
    warning: 'none' | 'high_volume' | 'quota_risk' | 'unsupported_query';
  }>;
}
```

### 4. Quota and warning thresholds
- A preview call may not consume more than 5% of the connector's remaining rate-limit budget.
- Warnings are triggered by:
  - `> 100,000` estimated posts per connector → `high_volume`
  - `> 80%` of the connector's rate-limit budget at risk → `quota_risk`
  - query uses operators the connector cannot evaluate → `unsupported_query`

### 5. No preview posts are persisted
Posts fetched for the preview sample are **not** written to `social_posts`, `post_watchlist_matches`, or `outbound_activities`. They are discarded after counting.

---

## Consequences

1. **Operational protection:** users can see expected data load before activation, reducing the risk of broad queries draining quota or storage.
2. **Connector heterogeneity is exposed honestly:** some connectors will show exact counts, others estimates; the UI must render the confidence for each.
3. **New endpoint surface:** `POST /v1/watchlists/preview-volume` must be added to the auth/RLS pipeline, contract-tested, and documented.
4. **Optional method keeps churn low:** connectors that cannot count simply do not implement the method.

---

## Alternatives considered

1. **Always fetch and discard a full sample for every connector.**
   - *Rejected:* it is wasteful for connectors that already expose a count API (GNews, Newswire, Brave/Bing) and could consume quota unnecessarily.

2. **Store a running estimate from historical `IngestionRun` data.**
   - *Rejected:* it adds a new time-series table and would not reflect the current query's exact parameters. Deferrable as a future optimization.

3. **Make `count()` mandatory for all connectors.**
   - *Rejected:* it would force unsupported platforms to fake a count or fail the preview. Optional method is more honest.

---

## Open questions

- What is the right default `previewSampleSize` for connectors that cannot count? 50, 100, or 250?
- Should `unsupported_query` be detected by the connector or by a shared `astCapabilityCheck()`?
- Should the preview endpoint require the connector to be already active, or can a user preview against any connector they have the authority to activate?
- How is the `rateLimitCost` computed for connector-specific cost models (per-request vs. per-result)?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related skills: `social-listening-core/.claude/skills/watchlist-matching/SKILL.md`, `social-listening-core/.claude/skills/provider-connector-framework/SKILL.md`
