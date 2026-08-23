# BRD-0063: Post-Watchlist Match Persistence — Junction Table and Server-Side Watchlist Filter

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Post-Watchlist Match Persistence — Junction Table and Server-Side Watchlist Filter |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Architecture Documentation, on acceptance of ADR-0063 |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Architecture Documentation | Initial draft from ADR-0063 |
| 1.0 | 2026-08-19 | Menno | Approved for implementation (Story 3.11 / Story 8.9) |

---

## 2. Executive Summary

Today, Social Listening evaluates every ingested post against the tenant’s active watchlists, but the resulting `post ↔ watchlist` relationships are not persisted. The match computation is performed only to populate `SocialPostIngestedEvent` messages; once those messages are published, the relationship data is discarded. This prevents `GET /v1/posts` from offering an accurate, server-side `watchlistId` filter and blocks the Watchlist Coverage widget from showing real data.

This business requirement authorizes the `post_watchlist_matches` junction table, an ingestion-time best-effort write of match records, and a new optional `watchlistId` query parameter on `GET /v1/posts`. Together these give tenants and analytics users accurate, scalable, RLS-guaranteed filtering by watchlist — including `boolean_query` watchlists that no client-side approximation can safely cover — and unlock the Watchlist Coverage breakdown on the Analytics Overview tab.

The expected business value is a trustworthy topic-filtering experience in the Analytics Dashboard, elimination of the previous client-side approximation, and a durable foundation for future watchlist-centric analytics without per-request re-evaluation of the entire post corpus.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable accurate, server-side watchlist filtering for all watchlist types | `GET /v1/posts?watchlistId=<id>` returns only posts that genuinely matched the selected watchlist at ingestion time, including `boolean_query` watchlists |
| 2 | Provide real watchlist coverage metrics for the Analytics Dashboard | Watchlist Coverage widget shows actual post counts per active watchlist backed by persisted match records |
| 3 | Eliminate client-side topic-filter approximations | The `selectedTopic` filter uses `?watchlistId` directly; no `terms[]` client-side matching is introduced |
| 4 | Preserve ingestion reliability and tenant isolation | Match-record writes are best-effort and do not block ingestion; all queries respect RLS |
| 5 | Keep the solution scalable without speculative over-engineering | Storage and query cost are known and documented; future capacity measures are named but not built before a real signal |

---

## 4. Scope

### 4.1 In Scope

- A new `post_watchlist_matches` junction table with `tenant_id`, `post_id`, `watchlist_id`, `matched_at`, unique constraint, RLS, and query indexes.
- Writing matched `(post, watchlist)` pairs at ingestion time via a new store function, batched and idempotent on retry.
- Adding an optional `watchlistId` query parameter to `GET /v1/posts` with UUID validation, RLS-gated watchlist existence check, and cursor-pagination preservation.
- Enabling Story 8.9 to build the `selectedTopic` filter and Watchlist Coverage widget on the server-side result.
- Documenting accepted v1 trade-offs (historical gap, staleness on watchlist update) as named open questions.

### 4.2 Out of Scope

- Retroactive backfill of posts ingested before the table is created (deferred; Story 3.12 later provides a backfill mechanism).
- Automatic re-matching when a watchlist’s `terms[]` or `boolean_query` changes (accepted staleness at v1).
- Adding a `postCount` field to `GET /v1/watchlists` (left to Story 8.9’s implementation-time judgment).
- Client-side implementation of the `selectedTopic` filter and Watchlist Coverage widget (separate Story 8.9).
- Storage ceiling controls such as TTL, row caps, or partitioning (deferred until a real capacity signal).

### 4.3 Assumptions

- The existing watchlist matching logic (`matchesWatchlist()` and `matchesAst()`) is correct and does not need to change.
- Tenants expect an honest empty result for historical posts ingested before this feature is deployed.
- The volume of active watchlists and posts at v1 does not require explicit capacity controls.
- RLS via `app.tenant_id` is sufficient for multi-tenant isolation of junction records.

### 4.4 Constraints

- `social_posts` is partitioned by `created_at`, so a true `REFERENCES social_posts(id)` foreign key cannot be enforced at the database level for `post_id`.
- Match-record persistence must never cause an ingestion attempt to fail.
- The `GET /v1/posts` response shape (`SocialPostSummary[]`) must remain unchanged.
- The `GET /v1/posts` contract already supports cursor pagination and must continue to do so.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User | Uses the Analytics Dashboard to filter posts by topic | High | Accurate watchlist filter that covers all watchlist types, including boolean queries |
| Tenant-Admin | Configures watchlists and monitors content | High | Reliable per-watchlist post counts and no fabricated analytics |
| Data Model Engineer | Owns schema and persistence layer | High | Clear table contract, RLS, idempotency, and safe ingestion-side writes |
| Frontend Engineer (Analytics Dashboard) | Builds `selectedTopic` and Watchlist Coverage widget | High | A single, accurate server-side filter parameter and real counts |
| Platform Administrator | Operates multi-tenant service | Medium | Tenant isolation, predictable storage growth, and non-blocking ingestion writes |

---

## 6. Current State (As-Is)

When a post is ingested, the connector pipeline already evaluates the post against every active watchlist:

- Keyword/hashtag/account watchlists use `matchesWatchlist()`.
- Boolean AST watchlists use `matchesAst()`.

The resulting match set is used to publish `SocialPostIngestedEvent` messages for downstream subscribers. After that, the `(post, watchlist)` pairs are discarded.

**Pain points:**

- `GET /v1/posts` cannot filter by `watchlistId`; users cannot retrieve only the posts that matched a specific watchlist.
- The Analytics Dashboard’s `selectedTopic` filter could only be implemented client-side, and only for `keyword`/`hashtag` watchlists.
- `boolean_query` watchlists cannot be filtered client-side without re-implementing the AST evaluator in the browser and risking semantic drift.
- The Watchlist Coverage widget cannot be built honestly because no real per-watchlist post count exists.
- Any per-request re-evaluation of watchlist terms against the full post set would be too expensive and was already rejected as a data-source strategy.

---

## 7. Future State (To-Be)

After this initiative is implemented:

- Every ingested post that matches one or more active watchlists results in a row in `post_watchlist_matches` for each matched `(post, watchlist)` pair.
- `GET /v1/posts` accepts an optional `?watchlistId=<uuid>` query parameter and returns only posts that the tenant’s persisted match records associate with that watchlist.
- The filter is accurate for all watchlist `matchType` values: `keyword`, `hashtag`, `account`, and `boolean_query`.
- RLS on both `social_posts` and `post_watchlist_matches` enforces tenant isolation without application-layer predicates.
- The Analytics Dashboard’s `selectedTopic` filter fetches `GET /v1/watchlists` to populate the selector, then calls `GET /v1/posts?watchlistId=<id>` when a watchlist is selected.
- The Watchlist Coverage widget displays real post counts per active watchlist derived from `post_watchlist_matches`.
- Ingestion remains robust: a failure to write match records is logged as connector-health telemetry but does not fail the post ingestion itself.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall persist every `(post, watchlist)` match produced during ingestion in a `post_watchlist_matches` junction table. | Must | A row exists for each matched pair after ingestion; the table has the required columns, unique constraint, indexes, and RLS policy. | Data Model Engineer |
| BR-002 | The system shall write match records as a best-effort, batched, idempotent operation. | Must | Batch insert uses `ON CONFLICT (post_id, watchlist_id) DO NOTHING`; duplicate calls produce no extra rows; insert failure is logged but does not fail the ingestion attempt. | Data Model Engineer |
| BR-003 | `GET /v1/posts` shall accept an optional `watchlistId` query parameter and return only posts that matched that watchlist. | Must | Valid UUID returns filtered `SocialPostSummary[]`; invalid UUID returns `400 INVALID_WATCHLIST_ID`; cross-tenant or missing watchlist returns `404 WATCHLIST_NOT_FOUND`. | API Engineer |
| BR-004 | The `watchlistId` filter shall be accurate for all watchlist `matchType` values. | Must | Contract tests cover `keyword`, `hashtag`, `account`, and `boolean_query` watchlists. | Data Model Engineer |
| BR-005 | The `watchlistId` filter shall preserve cursor-based pagination. | Must | `matched_at DESC` / `publishedAt DESC` ordering and cursor semantics remain consistent with `GET /v1/posts` without the filter. | API Engineer |
| BR-006 | The `GET /v1/posts` response shape shall not change. | Must | `SocialPostSummary[]` remains unchanged; no `matchedWatchlistIds` field is added. | API Engineer |
| BR-007 | The Analytics Dashboard shall be able to build a real Watchlist Coverage widget on the persisted data. | Should | The widget can obtain per-watchlist post counts from `GET /v1/posts?watchlistId=<id>` or from an optional `postCount` field on `GET /v1/watchlists`. | Frontend Engineer |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Junction writes must not measurably slow ingestion at current tenant scale. | Performance | Should | Ingestion throughput remains within observed baseline after the change is deployed. |
| NFR-002 | All match data must be tenant-isolated through Row-Level Security. | Security | Must | Cross-tenant `watchlistId` values are treated as not found (`404`) and never leak data. |
| NFR-003 | The schema must be safe for retry and recovery. | Reliability | Must | Idempotent insert and logged best-effort semantics prevent duplicate or lost match records from corrupting ingestion. |
| NFR-004 | The design must accommodate future backfill and re-matching without structural rework. | Maintainability | Should | Existing matchers and the junction table can be reused by a future backfill or reindex endpoint. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `post_watchlist_matches` row is identified by the unique combination of `post_id` and `watchlist_id`; re-insertion of the same pair is ignored. |
| BRU-002 | `tenant_id` is denormalized on `post_watchlist_matches` and used by the RLS policy to enforce the same isolation pattern as `social_posts` and `watchlists`. |
| BRU-003 | Deleting a `watchlists` row cascades and removes related `post_watchlist_matches` rows; deleting an individual `social_posts` row is not currently supported, so the `post_id` side is application-enforced only. |
| BRU-004 | A malformed `watchlistId` query parameter returns `400` with code `INVALID_WATCHLIST_ID`. |
| BRU-005 | A `watchlistId` that does not exist or does not belong to the caller’s tenant returns `404` with code `WATCHLIST_NOT_FOUND`; `403` is never returned for cross-tenant probe attempts. |
| BRU-006 | Failure to persist match records must not abort or fail the ingestion attempt; it is logged as connector-health telemetry. |
| BRU-007 | Historical posts ingested before the table exists have no match records; `GET /v1/posts?watchlistId=<id>` returns an honest empty result for those posts. |
| BRU-008 | Updating a watchlist’s `terms[]` or `boolean_query` does not retroactively re-match historical posts at v1. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `post_watchlist_matches.id` | Surrogate UUID primary key | Generated on insert | Data Model | Internal |
| `post_watchlist_matches.post_id` | Reference to the matched `social_posts.id` row | Ingestion match output | Data Model | Internal |
| `post_watchlist_matches.watchlist_id` | Reference to the matched `watchlists.id` row | Ingestion match output | Data Model | Internal |
| `post_watchlist_matches.tenant_id` | Denormalized tenant for RLS enforcement | Caller RLS context | Data Model | Internal (tenant-scoped) |
| `post_watchlist_matches.matched_at` | Timestamp when the match was persisted | `DEFAULT now()` | Data Model | Internal |
| `idx_pwm_watchlist_id` | Index supporting `watchlistId` filter and coverage counts | Migration | Data Model | Internal |
| `idx_pwm_post_id` | Index supporting post-scoped match lookups | Migration | Data Model | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Watchlist Coverage post count per watchlist | Power the Analytics Overview PieChart donut showing relative volume per active watchlist | Tenant User / Tenant-Admin | On demand, when the Overview tab is rendered |
| Filtered post list by selected watchlist | Support the `selectedTopic` filter on the Analytics Overview tab | Tenant User / Tenant-Admin | On demand, when a watchlist is selected |
| Connector health telemetry for match-record write failures | Alert operations if match persistence begins failing at scale | Platform Administrator / Data Model Engineer | Real time (logged per failure) |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `post_watchlist_matches` storage grows with `posts × active_watchlists` and could become costly. | Medium | Medium | Defer ceiling controls until a real capacity signal; document the risk as Open Question 3 and size the table before acting. | Data Model Engineer |
| R-002 | Existing watchlist records become stale when a watchlist definition changes. | High | Medium | Accept v1 staleness explicitly; a future re-match trigger or on-demand `POST /v1/watchlists/:id/reindex` can be added if needed. | Product Owner |
| R-003 | Historical posts lack match records, surprising users expecting a full historical view. | Medium | Medium | Communicate the honest-empty-result behavior; provide a backfill mechanism in Story 3.12 if required. | Product Owner |
| R-004 | Ingestion write of match records adds a new failure mode. | Low | High | Best-effort semantics and idempotent insert ensure a match-persistence failure does not lose the post. | Data Model Engineer |
| R-005 | `post_id` cannot carry a DB-enforced foreign key because `social_posts` is partitioned. | High | Low | Application-level enforcement plus the fact that no code path hard-deletes `social_posts` rows today; document the trade-off. | Data Model Engineer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0062 (Overview Tab Enhancement) reserved the `selectedTopic` filter and Watchlist Coverage widget slot | Internal | Product Owner | Accepted; implementation in Story 8.7/8.9 |
| D-002 | ADR-0058 already computes and publishes the `(post, watchlist)` match set at ingestion | Internal | Data Model Engineer | Built; reused by Story 3.11 |
| D-003 | Story 3.11 — `post_watchlist_matches` junction table, ingestion write, and `GET /v1/posts?watchlistId` filter | Internal | Data Model Engineer | Built 2026-08-19 |
| D-004 | Story 8.7 — Overview tab grid and reserved `selectedTopic` filter slot | Internal | Frontend Engineer | Built 2026-08-19 |
| D-005 | Story 8.9 — `selectedTopic` watchlist filter and Watchlist Coverage widget | Internal | Frontend Engineer | Built 2026-08-20 |
| D-006 | Story 3.12 — historical backfill and discovery-driven watchlist attribution (ADR-0063 Amendment Log) | Internal | Data Model Engineer | Built 2026-08-20 |

---

## 14. Acceptance Criteria

- The `post_watchlist_matches` table, indexes, unique constraint, and RLS policy exist after migrations run and can be verified by schema inspection.
- `insertPostWatchlistMatches()` performs a batch insert with `ON CONFLICT DO NOTHING` and is idempotent on retry.
- `publishSocialPostIngestedEvents()` calls `insertPostWatchlistMatches()` with the matched `(post, watchlist)` pairs without throwing on persistence failure.
- `GET /v1/posts?watchlistId=<id>` returns only posts that matched the specified watchlist and belongs to the caller’s tenant.
- `GET /v1/posts?watchlistId=invalid` returns `400 INVALID_WATCHLIST_ID`.
- `GET /v1/posts?watchlistId=<cross-tenant-or-missing-id>` returns `404 WATCHLIST_NOT_FOUND`.
- Cursor pagination works correctly with `watchlistId` present.
- The `SocialPostSummary` response shape is unchanged.
- No client-side `terms[]` matching is introduced in the Analytics Dashboard; the `selectedTopic` filter uses the server-side parameter.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Junction table** | A database table that implements a many-to-many relationship by storing pairs of foreign keys. |
| **post_watchlist_matches** | The table that persists which posts matched which watchlists at ingestion time. |
| **matchType** | The kind of watchlist: `keyword`, `hashtag`, `account`, or `boolean_query`. |
| **boolean_query** | A watchlist defined by a Boolean AST expression of `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, and `ACCOUNT` nodes. |
| **RLS** | Row-Level Security, the Postgres policy mechanism used to enforce tenant isolation. |
| **Best-effort write** | A persistence step whose failure is logged but does not fail the surrounding transaction or ingestion attempt. |
| **Idempotent insert** | An insert that produces the same final state when run multiple times with the same input, typically via `ON CONFLICT DO NOTHING`. |

---

## 16. Appendices

### 16.1 Source Architecture Decision Record

- [ADR-0063: Post-watchlist match persistence — `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId` server-side filter](../../../../docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md)

### 16.2 Related User Stories

- [Story 3.11 — Post-watchlist match persistence](../../../../docs/user-stories/epic-3-data-model-storage-and-archival.md) (`epic-3-data-model-storage-and-archival.md`)
- [Story 3.12 — Historical backfill and discovery-driven watchlist attribution](../../../../docs/user-stories/epic-3-data-model-storage-and-archival.md) (`epic-3-data-model-storage-and-archival.md`)
- [Story 8.9 — `selectedTopic` watchlist filter and Watchlist Coverage widget](../../../../docs/user-stories/epic-8-analytics-dashboard.md) (`epic-8-analytics-dashboard.md`)

### 16.3 Related ADRs

- ADR-0062 — Overview Tab Enhancement (reserved the `selectedTopic` filter and Watchlist Coverage slot)
- ADR-0058 — Wired watchlist match results into `SocialPostIngestedEvent` publishing
- ADR-0053 — Canonical Markdown post-body normalization
- ADR-0021 — Boolean AST watchlist matching
- ADR-0011 — Cursor-based pagination
- ADR-0018 — Data retention and archival (partitioned `social_posts`)
- ADR-0044 — Watchlist ownership and CRUD contract

### 16.4 Missing Source Documents

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for ADR-0063. Related product-research documents that mention `post_watchlist_matches` include:

- `docs/product-research/feature-designs/02-boolean-query-builder.md`
- `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- `docs/product-research/feature-designs/10-data-export.md`
- `docs/product-research/feature-designs/25-topic-evolution-timeline.md`
- `docs/product-research/feature-designs/26-watchlist-volume-preview.md`
- `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-19 |
| Product Owner | Menno | — | 2026-08-19 |
| Technical Lead | Menno | — | 2026-08-19 |
| Other Stakeholder | — | — | — |
