# ADR-0088: Ad-hoc query allowlist

**Status:** Accepted (2026-08-28)

**Acceptance note (2026-08-28):** Accepted by Menno. Authorizes the parameterized, allowlist-governed ad-hoc query engine for analytics. Story 10.4 and Story 10.5 are fully implemented and verified.

**Authorizes:** a structured, allowlist-based `POST /v1/analytics/query` endpoint that lets tenant users run server-side aggregations without exposing raw SQL or the full `social_posts` table.

**Source:** `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Business analysts need flexible aggregation
`docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` describes a tenant-scoped endpoint for `Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` to run server-side aggregations: `GROUP BY` date, platform, author, topic, sentiment, and watchlist, with metrics like `count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, and `unique_authors`.

### 2. Raw SQL is not acceptable
The endpoint must never accept arbitrary SQL. It must translate a structured query into a safe, parameterized, RLS-governed query. This prevents SQL injection and cross-tenant data exfiltration.

### 3. Precomputed views can power common queries
`ADR-0087` (Preconfigured analytics views) provides `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`. The ad-hoc endpoint can prefer these views for daily aggregates and fall back to `social_posts` only for drill-downs. `topic_id` values in `TopicDailyCount` come from `ADR-0104`'s `topics` catalog (`TopicClusteringService`), and topic merges are not backfilled into historical rows (`ADR-0104` §6) — a `GROUP BY topic` query spanning a merge date will not reconcile pre- and post-merge volume under one identity.

### 4. `sum(reach)`, `sum(engagement)`, and `avg(sentiment_score)` are partially-covered metrics, not universally populated ones
Per `ADR-0087` (as revised): `sum_reach` is `NULL` for organization-as-Author connectors with no follower-count concept (Newswire, GNews, Wikipedia); `sum_engagement` is Facebook-only for v1, `NULL` for every other connector; `avg_sentiment_score`'s exact derivation is not yet defined. An ad-hoc query tool is a riskier place for this to surface silently than a fixed dashboard widget — "ad-hoc" implies the caller trusts a number they built themselves.

### 5. Watchlist filtering/grouping is scoped to the caller's own watchlists, per `ADR-0044`
`ADR-0044` §5c makes `watchlists` strictly private to their creator, with **no** `tenant_admin` oversight override, RLS-enforced via an `app.user_id` session predicate — the same rule `ADR-0086` §2 later matched for prospecting-list sharing. `post_watchlist_matches`, however, is RLS-scoped only by `tenant_id` (confirmed directly: its sole policy, `tenant_isolation`, carries no `user_id` predicate — `social-listening-core/migrations/0036_create_post_watchlist_matches.sql`), and `ADR-0063` §3 confirms `GET /v1/posts?watchlistId=X` validates only tenant membership, not ownership. **Decided (2026-08-27), confirmed by Menno:** this ADR does not inherit that gap — `dimensions: ['watchlist']` and `filters.watchlist` are scoped to the caller's own watchlists only (Decision §3). Whether to also close the pre-existing `GET /v1/posts?watchlistId=X` gap this exposed is `ADR-0063`'s concern, named here for visibility, not decided or fixed by this ADR.

---

## Decision

### 1. Request body is a structured query, not SQL
```ts
{
  dimensions: ('date' | 'platform' | 'author' | 'topic' | 'sentiment' | 'watchlist')[],
  metrics: (
    | { type: 'count' }
    | { type: 'sum', field: 'reach' | 'engagement' }
    | { type: 'avg', field: 'sentiment_score' }
    | { type: 'unique', field: 'author' }
  )[],
  filters?: {
    dateRange?: { start: ISOString; end: ISOString };
    platform?: string;
    author?: string;
    topic?: string;
    sentiment?: string;
    watchlist?: string;
  },
  timeGrain?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;       // default 100, hard cap 1000
  format?: 'json' | 'csv';
}
```

- `platform` is the only source/platform dimension — the earlier draft also listed a separate `'source'` value, but nothing in the real schema distinguishes a "source" from `platform_id`/`providerId` (`SourceDailyCount` is keyed by `platform_id`; `ADR-0054`'s "Sources tab" is the same platform breakdown). Removed as a duplicate.
- `topic` resolves against `ADR-0104`'s `topics` catalog (Context §3), not `AIProviderConnector` output or a `watchlists` row.

### 2. Allowlist validation
- `dimensions` and `metrics` are validated against a hard-coded allowlist. Unknown values return `400 UNKNOWN_DIMENSION` or `400 UNKNOWN_METRIC`.
- Only combinations that are supported by a precomputed view or by `social_posts` are accepted.
- `timeGrain` must be compatible with the chosen dimensions.
- **`{ type: 'unique', field: 'author' }` combined with the `platform` or `sentiment` dimension can never be served from a precomputed view** — `SourceDailyCount` and `SentimentDailyCount` carry no `unique_authors` column (only `TopicDailyCount`/`WatchlistDailyCount` do). This combination always falls back to a live `social_posts` scan, bounded by the same resource guards as any other fallback (§5) — named explicitly here because it's a real, likely-common query shape that quietly bypasses this endpoint's own core "prefer precomputed views" performance premise, not an edge case.

### 3. Query builder generates safe SQL
- A `QueryBuilder` class translates the structured request into a parameterized `SELECT`.
- It uses `withTenant()` (ADR-0015) so the query is RLS-scoped.
- **Whenever the request uses `dimensions: ['watchlist']` or `filters.watchlist`, the builder additionally scopes to `watchlists.owner_id = app.user_id`** — the same session predicate `ADR-0044` §5c established — rather than relying on `post_watchlist_matches`' tenant-only RLS alone. A `filters.watchlist` value naming a watchlist the caller does not own resolves as if it doesn't exist (empty result, not an error), matching `ADR-0044`'s existing 404-not-403 convention. `dimensions: ['watchlist']` groups only over the caller's own watchlists — it never enumerates or reveals the existence of another user's private watchlist.
- It never concatenates user input into SQL strings.
- It prefers `*DailyCount` tables when the query matches their grain and filters; otherwise it falls back to `social_posts` with a size cap. Note that `WatchlistDailyCount` itself is not owner-scoped at the table level (ADR-0087), so a watchlist-dimensioned query against it still requires the `owner_id` predicate above at query-build time, not just at the `post_watchlist_matches` layer.

### 4. Response shape
```ts
{
  columns: string[];
  rows: Array<Record<string, string | number>>;
  rowCount: number;
  truncated: boolean;
  queryTimeMs: number;
  source: 'precomputed' | 'raw';
  warnings: string[];   // populated per §5 below; empty array when no caveat applies
}
```

### 5. Partial-coverage warnings are surfaced in the response, not left implicit
- If the request's `metrics` include `sum(reach)`, the response's `warnings` array includes a fixed string noting `sum_reach` is `NULL` for organization-as-Author connectors (no follower-count concept) and is not comparable across all platforms.
- If `metrics` include `sum(engagement)`, `warnings` notes `sum_engagement` is Facebook-only in v1 and `NULL`/absent for every other connector — a `sum(engagement)` grouped by `platform` should not be read as a cross-platform comparison.
- If `metrics` include `avg(sentiment_score)`, `warnings` notes this value's derivation and precision are still being finalized (tracked in `ADR-0087`).
- This is a response-shape addition, not a UI decision — client surfaces (ad-hoc query UI, Story 10.5) are responsible for rendering `warnings` visibly, not silently discarding them.

### 6. Resource guards
- Maximum query runtime: 30 seconds.
- Maximum returned rows: 1000.
- Per-tenant rate limit: 60 requests per minute (configurable).
- `format: 'csv'` writes to a streaming response.

### 7. Read-only
The endpoint is `POST` by convention (because it accepts a body) but is strictly read-only. It does not modify any table.

---

## Consequences

1. **Analyst power without SQL risk:** users can answer custom questions without direct database access.
2. **Performance guardrails:** the allowlist, time caps, and row limits prevent runaway queries — except `unique(author)` × `platform`/`sentiment`, which always falls back to a raw scan (§2); still bounded by the same caps, but never precomputed.
3. **Foundation for dashboards:** future dashboard widgets can be built on this endpoint.
4. **Maintenance cost:** every new dimension or metric must be added to the allowlist and query builder.
5. **Not a general query language:** users cannot express arbitrary analytics. The allowlist is intentionally narrow.
6. **Partial-coverage metrics are surfaced, not silent:** `sum(reach)`/`sum(engagement)`/`avg(sentiment_score)` carry response-level `warnings` (§5) rather than presenting as uniformly-populated numbers.
7. **Watchlist grouping/filtering is owner-scoped, per `ADR-0044`** — a caller can never see or enumerate another user's private watchlists through this endpoint, at the cost of the `QueryBuilder` needing an explicit `owner_id` join rather than relying on `post_watchlist_matches`'/`WatchlistDailyCount`'s tenant-only scoping alone (Decision §3).

---

## Alternatives considered

1. **Accept a subset of SQL with a parser.**
   - *Rejected:* even a subset parser is complex and risky. A structured JSON DSL is easier to validate and translate safely.

2. **Expose a saved-query feature with pre-approved queries.**
   - *Rejected:* it does not satisfy ad-hoc exploration. The allowlist approach gives flexibility while keeping control.

3. **Use an existing BI tool or SQL engine for analytics.**
   - *Rejected:* the project is self-hosted and self-funded. An embedded, allowlist endpoint is simpler and keeps data inside the tenant boundary.

---

## Open questions

- Should `date` dimension support `hour` grain in v1, or only `day/week/month`?
- How should the endpoint handle a query that mixes dimensions that do not share a precomputed view?
- Should users be able to save and share ad-hoc queries as named views?
- What is the right rate-limit and row-cap for free vs. paid tiers?
- ~~Does `dimensions: ['watchlist']` (or `filters.watchlist`) inherit `post_watchlist_matches`' tenant-only RLS, letting any tenant member enumerate every watchlist_id in the tenant and its match volume — including watchlists privately owned by other users?~~ **Resolved (2026-08-27), confirmed by Menno verbatim: *"no other users private watchlist widening."*** Owner-scoped only — see Decision §3 and Context §5. No caller can see or enumerate another user's private watchlist through this endpoint.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs:
  - `ADR-0087` — preconfigured analytics views; source of the precomputed tables and the `sum_reach`/`sum_engagement`/`avg_sentiment_score` partial-coverage facts
  - `ADR-0015` — tenant RLS
  - `ADR-0044` — watchlist ownership/privacy; directly relevant to the open watchlist-enumeration question above
  - `ADR-0063` — `post_watchlist_matches` junction table; source of the tenant-only RLS policy this ADR's Open Question concerns
  - `ADR-0086` — prospecting list sharing; precedent for the owner-scoped default recommended above
  - `ADR-0104` — AI topic clustering; source of `topic_id` and its merge semantics

---

*Revised 2026-08-27 (pre-acceptance), first pass: removed the duplicate `platform`/`source` dimension; documented `topic_id`'s real source (ADR-0104) and merge semantics; added response-level `warnings` for the three partial-coverage metrics inherited from ADR-0087; named the `unique(author)` × `platform`/`sentiment` always-raw-fallback case explicitly; surfaced (left open) whether `watchlist` grouping/filtering should be scoped to the caller's own watchlists.*

*Revised 2026-08-27 (pre-acceptance), second pass: resolved the watchlist-privacy question — `dimensions: ['watchlist']`/`filters.watchlist` are owner-scoped via `watchlists.owner_id = app.user_id` (ADR-0044's predicate), never enumerating or exposing another user's private watchlist. Every open question raised in review is now resolved; this ADR is awaiting formal acceptance.*
