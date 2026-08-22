# ADR-0088: Ad-hoc query allowlist

**Status:** Proposed (2026-08-23)

**Authorizes:** a structured, allowlist-based `POST /v1/analytics/query` endpoint that lets tenant users run server-side aggregations without exposing raw SQL or the full `social_posts` table.

**Source:** `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Business analysts need flexible aggregation
`docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` describes a tenant-scoped endpoint for `Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` to run server-side aggregations: `GROUP BY` date, platform, author, topic, sentiment, and watchlist, with metrics like `count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, and `unique_authors`.

### 2. Raw SQL is not acceptable
The endpoint must never accept arbitrary SQL. It must translate a structured query into a safe, parameterized, RLS-governed query. This prevents SQL injection and cross-tenant data exfiltration.

### 3. Precomputed views can power common queries
`ADR-0087` (Preconfigured analytics views) provides `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`. The ad-hoc endpoint can prefer these views for daily aggregates and fall back to `social_posts` only for drill-downs.

---

## Decision

### 1. Request body is a structured query, not SQL
```ts
{
  dimensions: ('date' | 'platform' | 'author' | 'topic' | 'sentiment' | 'watchlist' | 'source')[],
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

### 2. Allowlist validation
- `dimensions` and `metrics` are validated against a hard-coded allowlist. Unknown values return `400 UNKNOWN_DIMENSION` or `400 UNKNOWN_METRIC`.
- Only combinations that are supported by a precomputed view or by `social_posts` are accepted.
- `timeGrain` must be compatible with the chosen dimensions.

### 3. Query builder generates safe SQL
- A `QueryBuilder` class translates the structured request into a parameterized `SELECT`.
- It uses `withTenant()` (ADR-0015) so the query is RLS-scoped.
- It never concatenates user input into SQL strings.
- It prefers `*DailyCount` tables when the query matches their grain and filters; otherwise it falls back to `social_posts` with a size cap.

### 4. Response shape
```ts
{
  columns: string[];
  rows: Array<Record<string, string | number>>;
  rowCount: number;
  truncated: boolean;
  queryTimeMs: number;
  source: 'precomputed' | 'raw';
}
```

### 5. Resource guards
- Maximum query runtime: 30 seconds.
- Maximum returned rows: 1000.
- Per-tenant rate limit: 60 requests per minute (configurable).
- `format: 'csv'` writes to a streaming response.

### 6. Read-only
The endpoint is `POST` by convention (because it accepts a body) but is strictly read-only. It does not modify any table.

---

## Consequences

1. **Analyst power without SQL risk:** users can answer custom questions without direct database access.
2. **Performance guardrails:** the allowlist, time caps, and row limits prevent runaway queries.
3. **Foundation for dashboards:** future dashboard widgets can be built on this endpoint.
4. **Maintenance cost:** every new dimension or metric must be added to the allowlist and query builder.
5. **Not a general query language:** users cannot express arbitrary analytics. The allowlist is intentionally narrow.

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

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0087` (preconfigured analytics views), `ADR-0015` (tenant RLS), `ADR-0044` (watchlist ownership)
