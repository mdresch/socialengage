---
name: ad-hoc-query-engine
description: Parameterized ad-hoc multi-dimensional analytics query builder and endpoint POST /v1/analytics/query (ADR-0088, Story 10.4).
---

# Ad-Hoc Analytics Query Engine (ADR-0088)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.4.ad-hoc-query-endpoint.contract.test.ts` — Story 10.4 contract test.

## Purpose
Enables analysts to run ad-hoc multi-dimensional aggregations over social posts across dimensions (platform, sentiment, watchlist, author, date, hour) and metrics (post_count, positive_count, neutral_count, negative_count, engagement_total) with strict SQL injection prevention and timeout protection.

## Invariants
1. **Allowlist Validation:** Only explicitly allowlisted dimensions, metrics, and time grains (`day`, `hour`, `week`, `month`) can be queried. Invalid names return `400 Bad Request`.
2. **Tenant Isolation:** Enforces `sp.tenant_id = $1` parameterized predicate in all generated queries via `withTenant()`.
3. **Execution Limits:** 30-second `statement_timeout` on query execution, maximum 1,000 returned rows (default 500).
4. **Serialization Formats:** Supports standard `json` and direct streaming `csv` responses with proper escaping.

## Endpoints
- `POST /v1/analytics/query`: Execute parameterized aggregation query.

## Relations to other components

- **`social_posts` table** — all generated queries execute against `social_posts` with mandatory `sp.tenant_id = $1` predicate via `withTenant()`; no cross-tenant data is ever accessible.
- **`withTenant()` (RLS middleware)** — gates the router handler; provides the `tenant_id` binding used in parameterized queries.
- **`precomputed-analytics-views` skill** — the companion component serving fast precomputed rollups; ad-hoc queries are the flexible complement when precomputed views don't cover a requested dimension combination.
- **`analytics-dashboard` admin SKILL.md** — the frontend `AdHocQueryBuilder` component (Story 10.5) calling `POST /v1/analytics/query` via the BFF proxy route `/api/analytics/query`.
- **`watchlist` dimension** — when `dimensions` includes `watchlist`, the engine joins `social_posts` to `watchlist_posts` (many-to-many) to group results by watchlist assignment.
