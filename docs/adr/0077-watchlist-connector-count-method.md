# ADR-0077: Watchlist connector count and preview endpoint

**Status:** Accepted 2026-08-23 (review adjustments incorporated 2026-08-23)

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
  sampleSize?: number;
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}
```

- `count?()` is **optional**. If a connector does not implement it, the backend falls back to a limited preview sample.
- The method receives the same `WatchlistAST` and `timeWindow` used for `poll()`.
- The result must be tenant-scoped and use the connector's existing credentials and `RequestGate`.
- `rateLimitCost` is the estimated number of API request units the preview check itself consumed (e.g., `1` for a count API, `1` for a sample page). If the connector also wishes to surface a future ingestion cost, it must use a separate `projectedIngestionRateLimitCost` field to avoid ambiguity.
- `unsupportedOperators` lets the connector report which AST operators it cannot evaluate, supporting the `unsupported_query` warning in the breakdown.

### 2. Avoid side-effects in preview calls
Preview calls must not mutate connector state. To guarantee this:

- If the connector implements an explicit `sample?()` method, the preview controller calls `sample?()` instead of `poll()`.
- If the preview controller falls back to `poll()`, it must pass `mode: 'preview'` (or `isDryRun: true`) in `ConnectorContext` / `pollArgs`. Connector `poll()` implementations must skip watermark, cursor, checkpoint, and high-water-mark updates when preview mode is active.
- Posts fetched for the preview sample are **not** written to `social_posts`, `post_watchlist_matches`, or `outbound_activities`. They are discarded after counting.

### 3. Fallback to a limited preview sample for non-count connectors
When `count?()` is absent or the connector cannot count the supplied AST:

- Use `sample?()` if implemented; otherwise call `poll()` in `mode: 'preview'` with a small, fixed `previewSampleSize` (default **50**).
- Extrapolate using the sample's time span and the requested time window:
  - `Cadence (r) = sampleSize / Δt_sample`, where `Δt_sample` is the time between the oldest and newest sampled post.
  - `Estimated Posts = r × Δt_requested_window`.
  - If the returned sample is smaller than `previewSampleSize`, the sample's size is the **exact** count for that window and `confidence` is `exact`.
- Return `confidence: 'estimate'` (or `exact` for the short-sample edge case), the `sampleSize`, and the `rateLimitCost` supplied by the connector.

### 4. New `POST /v1/watchlists/preview-volume` endpoint
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
    errorCode?: string;
    errorMessage?: string;
  }>;
}
```

- Connector previews are executed concurrently. The controller must not fail the whole HTTP request when a single connector fails; instead, it treats the failing connector as `confidence: 'unavailable'` with `errorCode` and `errorMessage` in the breakdown item.
- Users may preview against inactive connectors as long as they are credentialed and the caller has authority to activate them under the existing RLS/RBAC rules.

### 5. Quota and warning thresholds
- Before executing `count()` or a preview `poll()`, the preview controller calls `RequestGate.checkAvailability(connectorId, estimatedUnits)`.
- If the remaining budget is below the required units, the controller throws a `QuotaExceededPreviewError`, which maps the connector's breakdown item to `warning: 'quota_risk'` and `confidence: 'unavailable'` rather than failing the entire request.
- A preview call may not consume more than 5% of the connector's remaining rate-limit budget.
- Warnings are triggered by:
  - `> 100,000` estimated posts per connector → `high_volume`
  - The preview would consume more than 80% of the connector's remaining rate-limit budget → `quota_risk`
  - Query uses operators the connector cannot evaluate → `unsupported_query`

### 6. Unsupported-query detection
- Run a shared `astCapabilityCheck(ast, connector.supportedOperators)` first (fast, static, zero API cost).
- The connector validates platform-specific syntax constraints during `count()` or `sample()` and may return `unsupportedOperators` in `ConnectorCountResult`.

---

## Consequences

1. **Operational protection:** users can see expected data load before activation, reducing the risk of broad queries draining quota or storage.
2. **Connector heterogeneity is exposed honestly:** some connectors will show exact counts, others estimates; the UI must render the confidence for each.
3. **New endpoint surface:** `POST /v1/watchlists/preview-volume` must be added to the auth/RLS pipeline, contract-tested, and documented.
4. **Optional method keeps churn low:** connectors that cannot count simply do not implement the method.
5. **Preview calls are safe by contract:** the `mode: 'preview'` flag and `sample?()` alternative prevent cursor and checkpoint mutation, and partial failures are isolated per connector.

---

## Alternatives considered

1. **Always fetch and discard a full sample for every connector.**
   - *Rejected:* it is wasteful for connectors that already expose a count API (GNews, Newswire, Brave/Bing) and could consume quota unnecessarily.

2. **Store a running estimate from historical `IngestionRun` data.**
   - *Rejected:* it adds a new time-series table and would not reflect the current query's exact parameters. Deferrable as a future optimization.

3. **Make `count()` mandatory for all connectors.**
   - *Rejected:* it would force unsupported platforms to fake a count or fail the preview. Optional method is more honest.

---

## Open questions (answered)

| Open question | Decision |
|---|---|
| What is the right default `previewSampleSize`? | **50 posts.** Most search/social APIs return 25–100 results per page/call. A sample of 50 is usually achievable in a single HTTP request without triggering pagination loops, minimizing quota burn. |
| Should `unsupported_query` be detected by the connector or a shared `astCapabilityCheck()`? | **Two-phase approach:** 1) Run a shared `astCapabilityCheck(ast, connector.supportedOperators)` first (fast, static, zero API cost). 2) The connector validates platform-specific syntax constraints during `count()` / `sample()`. |
| Can users preview against inactive connectors? | **Yes, if configured and credentialed.** Users preview watchlists to decide whether to activate them. As long as credentials exist and RLS/RBAC allows access, previewing inactive connectors is permitted. |
| How is `rateLimitCost` computed? | `rateLimitCost` is the estimated API request units the preview check itself consumed (e.g., `1` for a count API, `1` for a sample page). If the connector also wants to display future ingestion cost, that field is named `projectedIngestionRateLimitCost` to avoid ambiguity. |

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related skills: `social-listening-core/.claude/skills/watchlist-matching/SKILL.md`, `social-listening-core/.claude/skills/provider-connector-framework/SKILL.md`

### Pending supersession note (2026-08-28)

If ADR-0134 (Proposed, 2026-08-28) is accepted, this ADR's Decision §4 would be extended by ADR-0134's own §2–§4 — specifically an explicit confidence-display contract for the UI and an additive estimatedCost projection block on WatchlistVolumePreview. **Supersession update (2026-08-28):** ADR-0134 was accepted on 2026-08-28. ADR-0077 Decision §4 is now extended with an explicit confidence-display contract for the UI and an additive estimatedCost projection block.