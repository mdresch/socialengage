---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Watchlist volume preview

### What it is

A watchlist builder feature that estimates, for each selected connector, how many posts a watchlist query would match before the user activates the watchlist and the system starts full ingestion. The preview polls each connector's count-capable endpoint (or a small sample) and returns a clear, per-connector breakdown of expected volume, cost, and system load.

### End-user benefits

- **Informed activation:** a Tenant-Admin or Tenant-User can see the expected data load before committing to a watchlist.
- **Rate-limit and cost protection:** users avoid accidentally creating a query that drains an API quota or generates massive storage/AI-enrichment costs.
- **Connector-specific tuning:** users can see which connectors are the biggest contributors and decide to narrow the query or disable a connector.
- **Faster iteration:** the query can be adjusted in the builder and re-previewed until the volume is acceptable.

### Core details

- A new `POST /v1/watchlists/preview-volume` endpoint accepts a watchlist AST, connector list, and optional time window.
- For each selected connector, the backend calls `SocialConnector.count?()` if the connector supports it; otherwise, it fetches a small, limited sample and extrapolates, or returns `count: null` with a clear `confidence: low` indicator.
- The response is a `WatchlistVolumePreview` object:
  - `totalEstimatedPosts`
  - `breakdown[]` with `connectorId`, `platformId`, `estimatedPosts`, `confidence` (`exact`, `extrapolated`, `unavailable`), `sampleSize` (if extrapolated), `rateLimitCost` (number of calls), and `warning` (`none`, `high_volume`, `quota_risk`, `unsupported_query`).
- The preview is **read-only** and does **not** persist posts, author records, or watchlist matches.
- Warnings are triggered by thresholds such as:
  - `> 100,000` estimated posts per connector → `high_volume`
  - `> 80%` of connector's rate-limit budget → `quota_risk`
  - query contains operators the connector cannot evaluate → `unsupported_query`
- The UI shows a per-connector table, a stacked bar or donut summary, and a final "Activate" or "Refine query" call to action.

### Implementation complexity

**Medium.** Requires a new optional `SocialConnector.count?()` method, a cross-connector aggregation service, and UI in the watchlist builder. The heavy part is dealing with connectors that do not support native counts and normalizing their different quota/cost models.

### Growth and reach

This feature prevents operational surprises and supports self-service onboarding. It becomes more valuable as more connectors with different rate-limit and search-behavior models are added.

---

## Technical design

- **Data flow:** user finishes building a watchlist in the UI → clicks **Preview volume** → `POST /v1/watchlists/preview-volume` sends `{ ast, connectorIds, timeWindow }` → `WatchlistVolumePreviewService` calls `connector.count?({ ast, timeWindow })` for each connector in parallel → if `count?` is missing or fails, the service falls back to a limited `connector.poll({ limit: previewSampleSize, ast })` and extrapolates, or marks the connector as `unavailable` → the service aggregates the counts and applies warning thresholds → returns `WatchlistVolumePreview` → UI renders the breakdown and warnings.
- **Component interactions:** `WatchlistBuilder` → `WatchlistVolumePreviewService` → `SocialConnector.count?()` / `SocialConnector.poll()` (limited) → `connectorHealthStore` for rate-limit budget → `watchlistStore` (on activate only).
- **REST/Service Bus contracts:** `POST /v1/watchlists/preview-volume` returns a `WatchlistVolumePreview` JSON. No Service Bus events. Activation is still done via the existing `POST /v1/watchlists` or `PATCH /v1/watchlists/:id` endpoint.
- **Storage:** No posts are stored. The preview is a transient, in-memory/on-the-fly result. Only the chosen watchlist AST is stored when the user activates.
- **Security considerations:** The request is tenant-scoped and uses the caller's connector credentials. Previews respect the same connector ownership tiers and RLS as real ingestion. PII from preview samples is not retained.

## Backend principles

- **Optional connector count method.** `SocialConnector.count?()` is added to the `SocialConnector` interface but is optional. A connector that cannot count must still support a limited preview sample.
- **Never store preview data.** Previewed posts are not written to `social_posts` or `post_watchlist_matches`; they are discarded after counting.
- **Rate-limit aware.** The preview call should not consume more than a small, fixed percentage of the connector's available quota.
- **Graceful degradation.** If a connector does not support counting, the system extrapolates from a sample or marks the connector as `unavailable` and still returns a result for the others.
- **Same RLS and ownership.** The preview uses the same tenant-scoped connector credentials and activation rules as live ingestion.

## Frontend / UI principles

- **User flow:** user is in the watchlist builder → enters a query → selects connectors → clicks **Preview volume** → a side panel or modal shows per-connector estimates, warnings, and a total → user refines the query or clicks **Activate**.
- **Component hierarchy:** `WatchlistBuilder` → `VolumePreviewButton` → `VolumePreviewPanel` → `ConnectorVolumeRow` → `VolumeWarning`.
- **State management:** Server state for the preview; local state for the query and selected connectors.
- **Accessibility and responsive design:** The preview table has clear headers and screen-reader announcements for warnings; mobile view stacks connector rows vertically.

## Open questions

- Should the preview use the same `timeWindow` as the watchlist, or a fixed short window (e.g., last 24 hours) to keep costs low?
- What is the maximum sample size for connectors that do not support count, and how do we extrapolate from it?
- How should the preview handle connectors that support counting but only for some query operators?
- Should the preview also estimate AI-enrichment cost (sentiment, topic) based on the projected post count?
- Should a high-volume warning block activation, or just require confirmation?
- Should the preview be accessible from the API and integrations feature, or only the UI?

## AI enhancements

- **Query-rewrite suggestion:** if a connector is too expensive, the AI suggests a narrower query that still captures the intent.
- **Smart threshold learning:** the AI learns normal watchlist volumes per tenant and warns more aggressively on outliers.
- **Cost projection:** the AI estimates storage, compute, and AI-enrichment cost from the preview counts.

## Persona acceptance

- **Tenant-Admin (primary):** can preview the volume for a new watchlist before activation and see which connectors are the most expensive.
- **Tenant-User (primary):** can understand whether a personal watchlist query is too broad before it starts ingesting data.
- **Sole-Operator (primary):** can avoid runaway ingestion and rate-limit costs from broad tenant queries.
- **Tenant-Business-Analyst (secondary):** can use the preview to scope exploratory watchlists without committing to large data volumes.

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Connector count support?** | Add `SocialConnector.count?()` as optional. Connectors with native search-count APIs (GNews, Newswire, Wikipedia, Brave/Bing) should implement it; OAuth social platforms that only support fetch should use a capped sample and extrapolate. | Twitter/X and Meta APIs expose search/tweet count endpoints in some tiers; many RSS/REST APIs return a `totalResults` or similar field. |
| **Preventing runaway costs?** | Hard-cap preview calls to 5% of the connector's remaining rate-limit budget and use a short time window (last 24h) to keep the preview cheap. | Rate-limit best practices (Meta, X, LinkedIn docs) encourage batching and preview counts before full fetches. |
| **High-volume warning policy?** | Show a warning and require an extra confirmation for `> 100,000` posts per connector, but do not block; the Tenant-Admin owns the decision. | SaaS social tools surface cost/risk warnings but let the customer confirm. |
| **Extrapolation fallback?** | For non-count connectors, fetch `previewSampleSize` (e.g., 50 or 100) posts and extrapolate using the time window and known publishing cadence. | Sampling is a common pattern in social analytics for volume estimation. |
