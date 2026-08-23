# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0063 Post-Watchlist Match Persistence — Junction Table and Server-Side Watchlist Filter — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Architecture Documentation, translated from ADR-0063 / BRD-0063 |
| Reviewer(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0063; BRD-0063; ADR-0062 (Overview Tab Enhancement); ADR-0058 (ingestion event publishing); ADR-0021 (Boolean AST matching); ADR-0011 (cursor pagination); ADR-0018 (partitioned `social_posts`); ADR-0044 (watchlist CRUD contract); Story 3.11, Story 3.12, Story 8.9 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0063 and BRD-0063 into a functional design for persisting post-to-watchlist match results and exposing them through a server-side filter on `GET /v1/posts`. It defines the `post_watchlist_matches` junction table, the ingestion-time write behavior, the new `watchlistId` query parameter, and the downstream capabilities (Watchlist Coverage widget, `selectedTopic` filter) this persistence unblocks.

ADR-0063's Status is **Accepted** (2026-08-19), and BRD-0063 is **Approved**; this FDD reflects an already-approved design, not a draft for review.

### 2.2 Scope

- **In scope:**
  - The `post_watchlist_matches` junction table (schema, indexes, RLS policy, uniqueness constraint).
  - Best-effort, idempotent, batched writing of match records at ingestion time.
  - The `GET /v1/posts?watchlistId=<id>` query parameter, its validation, and its interaction with cursor pagination.
  - The functional basis for the Watchlist Coverage widget and the `selectedTopic` filter (Story 8.9), both of which consume this persistence layer.
  - The historical backfill and Wikipedia discovery-driven attribution added by the ADR-0063 Amendment Log (Story 3.12).
- **Out of scope:**
  - Any change to how matches are computed (`matchesWatchlist()`, `matchesAst()`, AST evaluation logic itself).
  - Automatic re-matching when a watchlist definition changes (accepted v1 staleness).
  - A `postCount` field on `GET /v1/watchlists` (left to Story 8.9's own judgment; not fixed here).
  - Storage ceiling controls (TTL, row caps, partitioning) — deferred pending a real capacity signal.
  - Any UI implementation detail of the Watchlist Coverage widget or `selectedTopic` filter beyond the server-side contract they depend on (owned by Story 8.9's own design).

### 2.3 Target Audience

Backend engineers (`social-listening-core`), frontend engineers (`social-listening-admin`), QA, and the product owner reviewing traceability from BRD-0063 through to implementation.

---

## 3. Context and Background

- **Problem:** Post-to-watchlist matching already runs in-process at ingestion (`matchesWatchlist()` for keyword/hashtag/account watchlists, `matchesAst()` for `boolean_query` watchlists) to populate `SocialPostIngestedEvent` messages (ADR-0058), but the resulting `(post, watchlist)` pairs are discarded immediately after publishing. Nothing persists which posts matched which watchlists.
- **Consequence:** `GET /v1/posts` has no `watchlistId` filter; the Analytics Dashboard's `selectedTopic` filter could only be approximated client-side (and only for `keyword`/`hashtag` watchlists, per ADR-0062 Decision §3's since-withdrawn stepping stone); the Watchlist Coverage widget (ADR-0062 Decision §8) could not be built honestly because no real per-watchlist post count existed.
- **Business/user value:** Tenant Users and Tenant-Admins get an accurate, trustworthy topic-filtering experience across all watchlist types, including `boolean_query` watchlists that a client-side approximation could never safely cover, plus a real Watchlist Coverage breakdown on the Analytics Overview tab.
- **Source requirements:** ADR-0063 (Accepted 2026-08-19); BRD-0063 (Approved 2026-08-19); ADR-0062 Open Question 1, which explicitly named this junction table as "the proper long-term path for a fully accurate server-side filter."
- **Constraints:**
  - `social_posts` is partitioned by `created_at` (ADR-0018/Story 3.5), which forced its primary key to become composite (`id`, `created_at`); `social_posts.id` alone carries no unique constraint, so `post_watchlist_matches.post_id` cannot carry a DB-enforced foreign key — enforced at the application level only (same precedent as `social_posts.acquisition_id → ingestion_runs`).
  - Match-record persistence must never cause an ingestion attempt to fail (best-effort semantics).
  - `SocialPostSummary`'s response shape must remain unchanged.
  - Existing cursor-based pagination (ADR-0011) must continue to work when `watchlistId` is present.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable accurate, server-side watchlist filtering for all watchlist types | `GET /v1/posts?watchlistId=<id>` returns only posts that genuinely matched the selected watchlist at ingestion time, including `boolean_query` watchlists |
| G2 | Provide real watchlist coverage metrics for the Analytics Dashboard | Watchlist Coverage widget shows actual post counts per active watchlist backed by persisted match records |
| G3 | Eliminate client-side topic-filter approximations | The `selectedTopic` filter uses `?watchlistId` directly; no `terms[]` client-side matching predicate is introduced |
| G4 | Preserve ingestion reliability and tenant isolation | Match-record writes are best-effort and never block ingestion; all reads/writes respect RLS |
| G5 | Keep the solution scalable without speculative over-engineering | Storage/query cost is known and documented; capacity controls are named, not built, until a real signal emerges |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `post_watchlist_matches` Junction Table (Schema)

- **Description:** A new relational table that records every `(post, watchlist)` match as a discrete row, forming the durable many-to-many relationship between `social_posts` and `watchlists`.
- **Triggers:** Created by a database migration; populated continuously thereafter by the ingestion write path (5.2) and, retroactively, by the backfill operation (5.5).
- **Inputs:** N/A (schema definition, not a runtime input).
- **Processing:**
  - Columns: `id` (UUID PK, generated), `post_id` (UUID, NOT NULL, application-enforced reference to `social_posts.id` — no DB-level FK because `social_posts` is partitioned and has no standalone unique constraint on `id`), `watchlist_id` (UUID, NOT NULL, `REFERENCES watchlists(id) ON DELETE CASCADE`), `tenant_id` (UUID, NOT NULL, denormalized for RLS), `matched_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT now()`).
  - `UNIQUE (post_id, watchlist_id)` constraint enforces idempotency at the database level.
  - `idx_pwm_watchlist_id` on `(watchlist_id, tenant_id, matched_at DESC)` supports the `watchlistId` filter and coverage counts.
  - `idx_pwm_post_id` on `(post_id, tenant_id)` supports post-scoped match lookups.
  - Row-Level Security is enabled with a policy predicate `tenant_id = current_setting('app.tenant_id')::uuid`, matching the pattern already used by `social_posts` and `watchlists`.
- **Outputs:** A queryable table supporting both "which watchlists did this post match" and "which posts matched this watchlist" access patterns without a JOIN penalty on either parent table's own RLS check.
- **Error handling:** N/A at the schema level; write-time errors are handled by 5.2.
- **Edge cases:** `watchlist_id`'s cascade delete is fully real (watchlists are deleted via existing CRUD); `post_id`'s intended cascade is currently theoretical because no code path in this repo hard-deletes an individual `social_posts` row today — if one is added later, it must explicitly clean up `post_watchlist_matches` rows itself.

### 5.2 Feature / Capability: Ingestion-Time Match Persistence

- **Description:** Writes the `(post, watchlist)` pairs already computed during ingestion into `post_watchlist_matches`, without changing how matches are computed.
- **Triggers:** Invoked from `publishSocialPostIngestedEvents()` — the real, single choke point every connector's per-post ingestion loop already calls to publish `SocialPostIngestedEvent` messages (ADR-0058) — immediately after the matched-watchlist set for a post is computed.
- **Inputs:** `tenantId` and an array of `{ postId, watchlistId }` pairs representing every watchlist a given post matched (via `matchesWatchlist()` for keyword/hashtag/account watchlists, or `matchesAst()` for `boolean_query` watchlists).
- **Processing:**
  - A new store function, `insertPostWatchlistMatches(tenantId, pairs)`, issues a single batched `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING`.
  - The insert is idempotent: calling it twice with the same pairs produces no additional rows.
  - The call is wrapped so that any failure is caught, logged to the existing connector-health telemetry path (ADR-0009/ADR-0010), and swallowed — it never propagates to fail the surrounding ingestion attempt.
- **Outputs:** New rows in `post_watchlist_matches` for each matched pair; a telemetry log entry on failure.
- **Error handling:** A failed batch insert is logged as connector-health telemetry and does not throw; the post itself is still considered successfully ingested and is still returned by `GET /v1/posts` (without a filter). A "post ingested but match record missing" state is a soft inconsistency, never a hard ingestion failure.
- **Edge cases:** A post matching zero watchlists produces zero rows and is not an error. A retried ingestion attempt for the same post/watchlist pairs is a no-op on the second call because of the unique constraint.

### 5.3 Feature / Capability: `GET /v1/posts?watchlistId=<id>` Filter

- **Description:** Extends the existing posts-listing endpoint with an optional `watchlistId` query parameter that restricts results to posts persisted as matching that watchlist.
- **Triggers:** A client (Tenant User, Tenant-Admin, or the Analytics Dashboard's `selectedTopic` filter, Story 8.9) issues `GET /v1/posts` with `watchlistId` set.
- **Inputs:** `watchlistId` (string, expected UUID format), plus the endpoint's existing `cursor`/`limit` parameters.
- **Processing:**
  1. If `watchlistId` is present but not a syntactically valid UUID, respond `400` with `{ code: 'INVALID_WATCHLIST_ID' }` — no further processing.
  2. If `watchlistId` is a valid UUID, verify (under the caller's RLS context) that a matching watchlist exists and belongs to the caller's tenant; if not, respond `404` with `{ code: 'WATCHLIST_NOT_FOUND' }` — this applies uniformly whether the ID belongs to another tenant or does not exist at all (never `403`, per the same 404-vs-403 split ADR-0044 Decision §5c establishes for watchlist CRUD).
  3. Otherwise, JOIN `post_watchlist_matches` on `post_id = social_posts.id AND watchlist_id = $watchlistId`; RLS on both `social_posts` and `post_watchlist_matches` enforces tenant isolation without any additional application-layer predicate.
  4. Apply cursor-based pagination (ADR-0011) as normal; `matched_at DESC` ordering on the junction index aligns with `publishedAt DESC` ordering on `social_posts`, keeping cursor semantics consistent with the unfiltered endpoint.
- **Outputs:** The same `SocialPostSummary[]` shape the endpoint already returns, now restricted to matched posts; cursor value for the next page.
- **Error handling:** `400 INVALID_WATCHLIST_ID` for malformed UUIDs; `404 WATCHLIST_NOT_FOUND` for cross-tenant or nonexistent watchlist IDs.
- **Edge cases:** A watchlist with zero matched posts (including one whose only matches predate this feature's deployment) returns an honest empty result, not an error. Cursor pagination continues to function correctly across pages when `watchlistId` is present.

### 5.4 Feature / Capability: Watchlist Coverage Data Enablement

- **Description:** Once match records are persisted, a genuine per-watchlist post count becomes derivable, unblocking the previously non-buildable Watchlist Coverage widget on the Analytics Overview tab (ADR-0062 Decision §8).
- **Triggers:** Consumed by Story 8.9's Watchlist Coverage widget when the Overview tab renders.
- **Inputs:** The tenant's set of active watchlists (`GET /v1/watchlists`) and, for each, its matched-post count.
- **Processing:** A per-watchlist count can be obtained either by grouping `post_watchlist_matches` rows by `watchlist_id` under the RLS-scoped tenant context, or by calling `GET /v1/posts?watchlistId=<id>` once per active watchlist and using the returned total. This ADR/FDD does not fix which mechanism is used — that choice, and whether `GET /v1/watchlists` gains an optional `postCount` field, is left to Story 8.9's implementation-time judgment.
- **Outputs:** Real, non-fabricated post counts per watchlist for the coverage visualization.
- **Error handling:** A watchlist with no matches yields an honest zero, never a hidden or omitted row.
- **Edge cases:** Watchlists created after this feature's deployment show accurate counts from their first ingested match onward; watchlists whose only qualifying posts predate deployment show a count reflecting only post-deployment matches until Story 3.12's backfill runs.

### 5.5 Feature / Capability: Historical Backfill (`backfillPostWatchlistMatches`)

- **Description:** Retroactively populates `post_watchlist_matches` for posts ingested before this table existed, closing the historical data gap named as ADR-0063 Open Question 1 and resolved by the ADR-0063 Amendment Log (Story 3.12).
- **Triggers:** Run as part of a database migration step on upgrade, and/or invokable per-tenant.
- **Inputs:** An optional `tenantId`; if omitted, the operation scopes across all tenants.
- **Processing:**
  - Iterates existing `social_posts` rows (scoped to `tenantId` if provided).
  - For each post, loads the tenant's active watchlists (`listActiveWatchlistsForTenant()`).
  - Converts each watchlist to its Boolean AST form (`watchlistToAst()`) and evaluates it via the existing fallback evaluator `matchesAst()` against the post's composed text (title/snippet and `body_markdown`) — no new matching logic is introduced.
  - Inserts resulting pairs via `insertPostWatchlistMatches()` (`ON CONFLICT DO NOTHING`), guaranteeing idempotency across repeated runs.
- **Outputs:** New `post_watchlist_matches` rows for previously unmatched historical posts.
- **Error handling:** Same best-effort insert semantics as ingestion-time writes; a failure for one post/watchlist pair does not halt the backfill for others.
- **Edge cases:** Re-running the backfill is safe and produces no duplicate rows. Posts with no watchlist matches remain unmatched (a correct, not erroneous, outcome).

### 5.6 Feature / Capability: Discovery-Driven Watchlist Attribution (Wikipedia)

- **Description:** For connectors where discovery search is explicitly parameterized by a tenant's watchlist terms — specifically the Wikipedia connector (`pollWikipedia.ts`, Story 2.14) — guarantees that content discovered via a specific watchlist's query is always attributed to that watchlist in `post_watchlist_matches`, even when the general AST evaluation might not independently re-derive the same match.
- **Triggers:** Wikipedia connector's discovery phase (Phase 1) fetching articles for a specific watchlist's discovery query.
- **Inputs:** The discovering `watchlist.id`, passed explicitly into `ingestWikipediaRevisions()`.
- **Processing:** The discovering watchlist ID is explicitly included in the match set passed to `insertPostWatchlistMatches()`, in addition to (not instead of) the general AST evaluation against all other active tenant watchlists.
- **Outputs:** A guaranteed `post_watchlist_matches` row for the discovering watchlist on 100% of discovered Wikipedia content, plus any additional rows from independent AST matches against other watchlists.
- **Error handling:** Same best-effort semantics as 5.2; a failure to persist the discovery attribution is logged, not fatal.
- **Edge cases:** Re-polling already-tracked Wikipedia articles (Phase 2) continues to evaluate all active tenant watchlists normally, without special discovery attribution (that guarantee applies only to Phase 1 discovery).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant User | Filters posts by watchlist/topic in the Analytics Dashboard; views Watchlist Coverage |
| Tenant-Admin | Configures watchlists; monitors coverage and content matched per watchlist |
| Data Model Engineer | Owns the `post_watchlist_matches` schema, ingestion write path, and backfill |
| API Engineer | Owns the `GET /v1/posts?watchlistId` contract |
| Frontend Engineer (Analytics Dashboard) | Builds the `selectedTopic` filter and Watchlist Coverage widget consuming this data (Story 8.9) |
| Platform Administrator | Monitors storage growth, tenant isolation, and ingestion write telemetry |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 3.11 | Tenant User / Tenant-Admin | Have `GET /v1/posts` accept a `watchlistId` filter | Retrieve only posts that matched a specific watchlist at ingestion time | `post_watchlist_matches` table with schema/RLS/indexes exists; `insertPostWatchlistMatches()` is idempotent; `publishSocialPostIngestedEvents()` writes matches best-effort; `watchlistId` filter validates UUID (400) and tenant ownership (404), preserves cursor pagination; `SocialPostSummary` unchanged. **Built 2026-08-19.** |
| Story 3.12 | Tenant User / Tenant-Admin | Have historical posts and Wikipedia discovery results correctly attributed in `post_watchlist_matches` | Watchlist coverage and topic filters reflect historical and discovered posts accurately | `backfillPostWatchlistMatches(tenantId?)` iterates historical posts and inserts matches idempotently; a backfill migration runs on upgrade; Wikipedia discovery explicitly attributes the discovering watchlist; re-poll continues evaluating all watchlists; no breaking change to the filter contract. **Built 2026-08-20.** |
| Story 8.9 | Tenant User / Tenant-Admin | Have a Watchlist/Topic filter on the Overview tab backed by real match records, and a real Watchlist Coverage widget | Filter and coverage cover all watchlist types accurately, including boolean queries, with genuine ingestion data | Uses `GET /v1/posts?watchlistId` and `GET /v1/watchlists`; no client-side `terms[]` matching predicate; no fabricated/placeholder coverage data; no new `social-listening-core` endpoint. **Built 2026-08-20.** |

### 6.3 Workflow Diagrams / Steps

**Ingestion-time write flow:**
1. A connector's ingestion pass produces a candidate post.
2. The post is evaluated against the tenant's active watchlists via `matchesWatchlist()` (keyword/hashtag/account) or `matchesAst()` (boolean_query), producing a set of matched watchlist IDs.
3. `publishSocialPostIngestedEvents()` publishes the `SocialPostIngestedEvent` (ADR-0058, unchanged) and, in the same step, calls `insertPostWatchlistMatches(tenantId, pairs)`.
4. The batch insert either succeeds (rows persisted, idempotent on retry) or fails (error logged to connector-health telemetry; ingestion of the post itself is unaffected).

**`GET /v1/posts?watchlistId` request flow:**
1. Client issues `GET /v1/posts?watchlistId=<id>&cursor=<c>&limit=<n>`.
2. Router validates `watchlistId` is a syntactically valid UUID — malformed input short-circuits to `400 INVALID_WATCHLIST_ID`.
3. Router verifies (under RLS) that the watchlist exists and belongs to the caller's tenant — failure short-circuits to `404 WATCHLIST_NOT_FOUND`.
4. Query JOINs `social_posts` to `post_watchlist_matches` on the validated `watchlistId`, applies cursor pagination, and returns `SocialPostSummary[]` plus the next cursor.
5. Client (e.g. the Analytics Dashboard's `selectedTopic` filter) renders the filtered post set and, separately, may aggregate per-watchlist counts for the Watchlist Coverage widget.

**Historical backfill flow (Story 3.12):**
1. A migration step (or on-demand invocation) calls `backfillPostWatchlistMatches(tenantId?)`.
2. For each historical post in scope, active watchlists are loaded and evaluated via `matchesAst()`.
3. Matched pairs are inserted idempotently into `post_watchlist_matches`.
4. Subsequent `GET /v1/posts?watchlistId` calls and coverage aggregations reflect the now-backfilled historical data.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Post identity and text content (`social_posts.id`, `title`/`snippet`, `body_markdown`) produced by each connector's ingestion pipeline.
- The tenant's active watchlist definitions (`watchlists` table: `matchType`, `terms[]`, `boolean_query` AST), read via `listActiveWatchlistsForTenant()`.
- The caller's RLS session context (`app.tenant_id`) for every read/write against `post_watchlist_matches`.
- The `watchlistId` query parameter on `GET /v1/posts`.

### 7.2 Data Outputs

- Persisted rows in `post_watchlist_matches`, one per matched `(post, watchlist)` pair.
- Filtered `SocialPostSummary[]` responses from `GET /v1/posts?watchlistId=<id>`.
- Derived per-watchlist post counts for the Watchlist Coverage widget.
- Connector-health telemetry log entries on match-write failure.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `post_watchlist_matches` | `id` (UUID PK); `post_id` (UUID, NOT NULL, app-enforced reference); `watchlist_id` (UUID, NOT NULL); `tenant_id` (UUID, NOT NULL, denormalized for RLS); `matched_at` (TIMESTAMPTZ, default `now()`) | Many-to-one to `social_posts` (via `post_id`, application-enforced, no DB FK because `social_posts` is partitioned); many-to-one to `watchlists` (via `watchlist_id`, `ON DELETE CASCADE`); `UNIQUE (post_id, watchlist_id)` |
| `idx_pwm_watchlist_id` | Index on `(watchlist_id, tenant_id, matched_at DESC)` | Supports `watchlistId` filter queries and coverage counts |
| `idx_pwm_post_id` | Index on `(post_id, tenant_id)` | Supports post-scoped match lookups |
| `social_posts` (existing) | `id`, `created_at` (composite PK due to partitioning), `body_markdown`, `publishedAt` | One-to-many to `post_watchlist_matches` (application-enforced) |
| `watchlists` (existing) | `id`, `matchType` (`keyword`/`hashtag`/`account`/`boolean_query`), `terms[]`, `boolean_query` | One-to-many to `post_watchlist_matches` (`ON DELETE CASCADE`) |

### 7.4 Validation Rules

- `watchlistId` query parameter must be a syntactically valid UUID; otherwise `400 INVALID_WATCHLIST_ID`.
- `watchlistId` must resolve to a watchlist owned by the caller's tenant (enforced via RLS); otherwise `404 WATCHLIST_NOT_FOUND` — never `403`.
- `(post_id, watchlist_id)` pairs must be unique; duplicate insert attempts are silently ignored (`ON CONFLICT DO NOTHING`), not rejected as an error.
- `tenant_id` on every `post_watchlist_matches` row must match the RLS session's `app.tenant_id`; no application-layer tenant predicate is needed in addition to RLS.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BRU-001 | A `post_watchlist_matches` row is identified by the unique combination of `post_id` and `watchlist_id`; re-insertion of the same pair is ignored. | Ingestion write, backfill |
| BRU-002 | `tenant_id` is denormalized on `post_watchlist_matches` and used by the RLS policy to enforce the same isolation pattern as `social_posts` and `watchlists`. | Schema, all reads/writes |
| BRU-003 | Deleting a `watchlists` row cascades and removes related `post_watchlist_matches` rows; deleting an individual `social_posts` row is not currently supported by any code path, so the `post_id` side is application-enforced only. | Schema |
| BRU-004 | A malformed `watchlistId` query parameter returns `400` with code `INVALID_WATCHLIST_ID`. | `GET /v1/posts` |
| BRU-005 | A `watchlistId` that does not exist or does not belong to the caller's tenant returns `404` with code `WATCHLIST_NOT_FOUND`; `403` is never returned for cross-tenant probe attempts. | `GET /v1/posts` |
| BRU-006 | Failure to persist match records must not abort or fail the ingestion attempt; it is logged as connector-health telemetry. | Ingestion write |
| BRU-007 | Historical posts ingested before the table exists have no match records until backfilled; `GET /v1/posts?watchlistId=<id>` returns an honest empty result for those posts pre-backfill. | `GET /v1/posts`, backfill |
| BRU-008 | Updating a watchlist's `terms[]` or `boolean_query` does not retroactively re-match historical posts at v1 (accepted staleness). | Watchlist update |
| BRU-009 | Wikipedia posts discovered via a specific watchlist's discovery query are always attributed to that discovering watchlist, in addition to normal AST evaluation against all other active watchlists. | Wikipedia connector (`pollWikipedia.ts`) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `runIngestionAttempt()` / `publishSocialPostIngestedEvents()` (`social-listening-core`) | Internal, outbound write | Invokes `insertPostWatchlistMatches()` with the matched pairs already computed for `SocialPostIngestedEvent` publishing | In-process function call |
| `postsRouter.ts` (`social-listening-core`) | Inbound HTTP | Exposes the `watchlistId` query parameter on `GET /v1/posts` | REST / JSON over HTTPS |
| `watchlists` module (`matchesWatchlist()`, `matchesAst()`, `watchlistToAst()`, `listActiveWatchlistsForTenant()`) | Internal, read | Supplies match-computation logic reused unchanged by ingestion write and backfill | In-process function call |
| Connector-health telemetry path (ADR-0009/ADR-0010) | Internal, outbound | Receives logged errors when a batched match-record insert fails | Existing telemetry mechanism |
| Postgres RLS (`app.tenant_id` session predicate) | Internal, enforcement | Enforces tenant isolation on all `post_watchlist_matches` reads/writes | Postgres session variable / policy |
| `social-listening-admin` Analytics Dashboard (Story 8.9) | Outbound consumer | Calls `GET /v1/watchlists` and `GET /v1/posts?watchlistId=<id>` to power `selectedTopic` filter and Watchlist Coverage widget | REST / JSON over HTTPS |
| `pollWikipedia.ts` (Story 2.14 discovery phase) | Internal, write | Passes the discovering watchlist ID explicitly into the match set for discovery-driven attribution | In-process function call |

---

## 10. Non-Functional Considerations

- **Performance:** Junction-table writes are batched and best-effort; expected to be negligible at current tenant scale but not formally load-tested (NFR-001, Should). Indexes are designed specifically to support the `watchlistId` filter and coverage-count query patterns without full-table scans.
- **Security / access control:** All reads and writes are tenant-isolated via Row-Level Security using the same `app.tenant_id` session predicate already established for `social_posts` and `watchlists`; cross-tenant `watchlistId` probes return `404`, never leaking existence information via a distinguishable `403`.
- **Scalability:** Table growth is proportional to `posts × active_watchlists_per_tenant`. No ceiling controls (TTL, row caps, partitioning) are built at v1; this is a named, accepted risk (Open Question 3 / R-001), deferred until a real capacity signal emerges.
- **Reliability / availability:** Idempotent inserts (`ON CONFLICT DO NOTHING`) make ingestion retries safe. Best-effort write semantics mean a persistence failure never causes ingestion data loss for the post itself.
- **Audit and logging:** Match-write failures are logged through the existing connector-health telemetry path, giving operators visibility if persistence begins failing at scale.
- **Accessibility / localization:** Not applicable — this is a backend persistence and filtering capability with no direct UI surface of its own (UI consumption is Story 8.9's concern).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `watchlistId` query parameter is not a valid UUID | `400` response, `{ code: 'INVALID_WATCHLIST_ID' }` | Request rejected before any query executes |
| `watchlistId` does not exist or belongs to another tenant | `404` response, `{ code: 'WATCHLIST_NOT_FOUND' }` | No data leakage; identical response for "doesn't exist" and "not yours" |
| Batched match-record insert fails during ingestion | No user-facing error; the post ingests normally | Error logged to connector-health telemetry; ingestion attempt continues and succeeds |
| `watchlistId` valid but has zero matched posts (including due to pre-backfill historical gap) | Empty `SocialPostSummary[]` array, `200` response | Honest empty result, not treated as an error |
| Duplicate `(post_id, watchlist_id)` insert attempted (retry or backfill re-run) | N/A (no client-visible response) | Silently ignored via `ON CONFLICT DO NOTHING`; no duplicate row, no error |

---

## 12. Assumptions and Dependencies

- The existing watchlist matching logic (`matchesWatchlist()` and `matchesAst()`) is correct and does not need to change as part of this design.
- Tenants understand and accept an honest empty result for historical posts until Story 3.12's backfill runs.
- The volume of active watchlists and posts at v1 does not require explicit capacity controls.
- RLS via `app.tenant_id` is sufficient for multi-tenant isolation of junction records; no additional application-layer tenant predicate is needed.
- No code path in this repository hard-deletes an individual `social_posts` row today, which is why the absent DB-level `ON DELETE CASCADE` on `post_id` is an accepted, currently-theoretical trade-off.
- Depends on ADR-0058 (already computes and publishes the match set at ingestion — reused, not rebuilt) and ADR-0044 (404-vs-403 convention for watchlist ownership checks).
- Story 8.9 (Analytics Dashboard consumption) and Story 3.12 (backfill/discovery attribution) are downstream dependents, not prerequisites, of the core schema and filter described in Sections 5.1–5.3.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a `POST /v1/watchlists/:id/reindex` on-demand endpoint be built for tenant-triggered re-matching after a watchlist edit? | Product Owner | Deferred — build only if a real tenant need is demonstrated |
| Q2 | Should a re-match trigger run automatically when a watchlist's `terms[]` or `boolean_query` changes? | Product Owner | Deferred — v1 staleness is an accepted trade-off |
| Q3 | At what tenant/post-volume scale does `post_watchlist_matches` need a storage ceiling (TTL, row cap, or partitioning)? | Data Model Engineer | Deferred until a real capacity signal is observed |
| Q4 | Should `GET /v1/watchlists` gain an optional `postCount` field, or should the Watchlist Coverage widget aggregate via per-watchlist `GET /v1/posts?watchlistId` calls? | Frontend Engineer (Story 8.9) | Resolved at Story 8.9's implementation time — not fixed as a durable response-shape commitment here |

---

## 14. Appendix

### Glossary

- **Junction table:** A table implementing a many-to-many relationship by storing pairs of foreign keys.
- **Best-effort write:** A persistence step whose failure is logged but does not fail the surrounding operation (here, ingestion).
- **Idempotent insert:** An insert that produces the same final state across repeated runs with the same input, via `ON CONFLICT DO NOTHING`.
- **`matchType`:** The kind of watchlist — `keyword`, `hashtag`, `account`, or `boolean_query`.
- **RLS:** Row-Level Security, the Postgres mechanism enforcing tenant isolation.

### Reference Links

- ADR-0063 — `docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md`
- BRD-0063 — `docs/project docs/Business-Requirements/BRD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md`
- ADR-0062 — Overview Tab Enhancement (reserved the `selectedTopic` filter and Watchlist Coverage slot)
- ADR-0058 — Wired watchlist match results into `SocialPostIngestedEvent` publishing
- ADR-0021 — Boolean AST watchlist matching
- ADR-0011 — Cursor-based pagination
- ADR-0018 — Data retention and archival (partitioned `social_posts`)
- ADR-0044 — Watchlist ownership and CRUD contract
- Story 3.11, Story 3.12 — `docs/user-stories/epic-3-data-model-storage-and-archival.md`
- Story 8.9 — `docs/user-stories/epic-8-analytics-dashboard.md`

### Related Product-Research Documents

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for ADR-0063 (confirmed by BRD-0063 §16.4). Documents that mention `post_watchlist_matches` in passing, without being the source design for this ADR, include: `docs/product-research/feature-designs/02-boolean-query-builder.md`, `04-ai-topic-clustering.md`, `10-data-export.md`, `25-topic-evolution-timeline.md`, `26-watchlist-volume-preview.md`, `27-preconfigured-analytics-views.md`.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | Architecture Documentation | Regenerated as a genuine Functional Design Document, replacing a defective prior version that duplicated the BRD's flat requirements table |
