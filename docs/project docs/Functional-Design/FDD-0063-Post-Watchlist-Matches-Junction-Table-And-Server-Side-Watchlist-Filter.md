# BRD-0063: Post-Watchlist Match Persistence — Junction Table and Server-Side Watchlist Filter

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0063: Post-Watchlist Match Persistence — Junction Table and Server-Side Watchlist Filter |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, ../Business-Requirements/BRD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md and the business requirements in BRD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md into functional design for **Post Watchlist Matches Junction Table And Server Side Watchlist Filter**.
Today, Social Listening evaluates every ingested post against the tenant’s active watchlists, but the resulting `post ↔ watchlist` relationships are not persisted. The match computation is performed only to populate `SocialPostIngestedEvent` messages; once those messages are published, the relationship data is discarded. This prevents `GET /v1/posts` from offering an accurate, server-side `watchlistId` filter and blocks the Watchlist Coverage widget from showing real data.

This business requirement authorizes the `post_watchlist_matches` junction table, an ingestion-time best-effort write of match records, and a new optional `watchlistId` query parameter on `GET /v1/posts`. Together these give tenants and analytics users accurate, scalable, RLS-guaranteed filtering by watchlist — including `boolean_query` watchlists that no client-side approximation can safely cover — and unlock the Watchlist Coverage breakdown on the Analytics Overview tab.

The expected business value is a trustworthy topic-filtering experience in the Analytics Dashboard, elimination of the previous client-side approximation, and a durable foundation for future watchlist-centric analytics without per-request re-evaluation of the entire post corpus.

---

### 2.2 Scope
**In scope:**
- A new `post_watchlist_matches` junction table with `tenant_id`, `post_id`, `watchlist_id`, `matched_at`, unique constraint, RLS, and query indexes.
- Writing matched `(post, watchlist)` pairs at ingestion time via a new store function, batched and idempotent on retry.
- Adding an optional `watchlistId` query parameter to `GET /v1/posts` with UUID validation, RLS-gated watchlist existence check, and cursor-pagination preservation.
- Enabling Story 8.9 to build the `selectedTopic` filter and Watchlist Coverage widget on the server-side result.
- Documenting accepted v1 trade-offs (historical gap, staleness on watchlist update) as named open questions.

**Out of scope:**
- Retroactive backfill of posts ingested before the table is created (deferred; Story 3.12 later provides a backfill mechanism).
- Automatic re-matching when a watchlist’s `terms[]` or `boolean_query` changes (accepted staleness at v1).
- Adding a `postCount` field to `GET /v1/watchlists` (left to Story 8.9’s implementation-time judgment).
- Client-side implementation of the `selectedTopic` filter and Watchlist Coverage widget (separate Story 8.9).
- Storage ceiling controls such as TTL, row caps, or partitioning (deferred until a real capacity signal).

## 3. Context and Background
See ADR Context.
Today, Social Listening evaluates every ingested post against the tenant’s active watchlists, but the resulting `post ↔ watchlist` relationships are not persisted. The match computation is performed only to populate `SocialPostIngestedEvent` messages; once those messages are published, the relationship data is discarded. This prevents `GET /v1/posts` from offering an accurate, server-side `watchlistId` filter and blocks the Watchlist Coverage widget from showing real data.

This business requirement authorizes the `post_watchlist_matches` junction table, an ingestion-time best-effort write of match records, and a new optional `watchlistId` query parameter on `GET /v1/posts`. Together these give tenants and analytics users accurate, scalable, RLS-guaranteed filtering by watchlist — including `boolean_query` watchlists that no client-side approximation can safely cover — and unlock the Watchlist Coverage breakdown on the Analytics Overview tab.

The expected business value is a trustworthy topic-filtering experience in the Analytics Dashboard, elimination of the previous client-side approximation, and a durable foundation for future watchlist-centric analytics without per-request re-evaluation of the entire post corpus.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable accurate, server-side watchlist filtering for all watchlist types | `GET /v1/posts?watchlistId=<id>` returns only posts that genuinely matched the selected watchlist at ingestion time, including `boolean_query` watchlists |
| 2 | Provide real watchlist coverage metrics for the Analytics Dashboard | Watchlist Coverage widget shows actual post counts per active watchlist backed by persisted match records |
| 3 | Eliminate client-side topic-filter approximations | The `selectedTopic` filter uses `?watchlistId` directly; no `terms[]` client-side matching is introduced |
| 4 | Preserve ingestion reliability and tenant isolation | Match-record writes are best-effort and do not block ingestion; all queries respect RLS |
| 5 | Keep the solution scalable without speculative over-engineering | Storage and query cost are known and documented; future capacity measures are named but not built before a real signal |

---

**Positive consequences (from ADR):**
**Positive**

- `GET /v1/posts?watchlistId=<id>` enables proper server-side watchlist filtering — accurate for all `matchType` values (keyword, hashtag, account, boolean AST), RLS-enforced, covering the `boolean_query` watchlists the client-side approximation excluded.
- The Watchlist Coverage widget becomes buildable with real data.
- `activeWatchlistFilter`'s client-side approximation (ADR-0062 Decision §3) can be retired in Story 8.9 — better accuracy, less client-side work, tooltip disclosure no longer needed.
- Match records are written once at ingestion — no per-request re-evaluation of watchlist terms against the full post set.
- Idempotent writes (`ON CONFLICT DO NOTHING`) make the ingestion retry path safe without additional handling.

**Negative**

- New migration and new table to maintain. `post_watchlist_matches` grows proportionally to `posts × active_watchlists_per_tenant` — a real storage cost for tenants with many active watchlists and high post volumes (Open Question 3).
- **Staleness on watchlist update:** when a watchlist's `terms[]` or `boolean_query` changes, existing match records reflect the old definition. Historical posts are not re-matched (Open Question 2).
- **Historical gap:** posts ingested before this table exists have no match records. `GET /v1/posts?watchlistId=<id>` returns an honest result — only posts ingested after Story 3.11 is deployed — but that gap may surprise a tenant expecting a full historical view (Open Question 1).
- `runIngestionAttempt()` gains one additional best-effort write per ingestion call. The write is batched and non-blocking; the performance impact is expected to be negligible at this project's current scale, but is named rather than assumed.
- Story 8.7's `activeWatchlistFilter` approximation (client-side, keyword/hashtag only) and Story 8.9's server-side upgrade are two separate shipped states. During the gap between Stories 8.7 and 8.9, the UI uses the approximation; after Story 8.9, it uses the server-side parameter. This is a named, temporary inconsistency, not a permanent design flaw.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall persist every `(post, watchlist)` match produced during ingestion in a `post_watchlist_matches` junction table. | Must | A row exists for each matched pair after ingestion; the table has the required columns, unique constraint, indexes, and RLS policy. | Data Model Engineer |
| BR-002 | The system shall write match records as a best-effort, batched, idempotent operation. | Must | Batch insert uses `ON CONFLICT (post_id, watchlist_id) DO NOTHING`; duplicate calls produce no extra rows; insert failure is logged but does not fail the ingestion attempt. | Data Model Engineer |
| BR-003 | `GET /v1/posts` shall accept an optional `watchlistId` query parameter and return only posts that matched that watchlist. | Must | Valid UUID returns filtered `SocialPostSummary[]`; invalid UUID returns `400 INVALID_WATCHLIST_ID`; cross-tenant or missing watchlist returns `404 WATCHLIST_NOT_FOUND`. | API Engineer |
| BR-004 | The `watchlistId` filter shall be accurate for all watchlist `matchType` values. | Must | Contract tests cover `keyword`, `hashtag`, `account`, and `boolean_query` watchlists. | Data Model Engineer |
| BR-005 | The `watchlistId` filter shall preserve cursor-based pagination. | Must | `matched_at DESC` / `publishedAt DESC` ordering and cursor semantics remain consistent with `GET /v1/posts` without the filter. | API Engineer |
| BR-006 | The `GET /v1/posts` response shape shall not change. | Must | `SocialPostSummary[]` remains unchanged; no `matchedWatchlistIds` field is added. | API Engineer |
| BR-007 | The Analytics Dashboard shall be able to build a real Watchlist Coverage widget on the persisted data. | Should | The widget can obtain per-watchlist post counts from `GET /v1/posts?watchlistId=<id>` or from an optional `postCount` field on `GET /v1/watchlists`. | Frontend Engineer |

### 5.1 Architecture Decision
ADR-0062 Decision §3 introduced `activeWatchlistFilter` — a client-side approximation:

- Fetches the user's active watchlists from `GET /v1/watchlists` (already exists).
- For `keyword`/`hashtag` `matchType` watchlists only: matches each `terms[]` entry case-insensitively against the post's `bodyMarkdown` field (ADR-0053/Story 3.10).
- Excludes `boolean_query` watchlists — re-implementing the full boolean AST client-side carries a fidelity risk against the server's own `matchesAst()` path (ADR-0021 consistency mandate).
- The mismatch vs. server-side ingestion semantics is disclosed in a tooltip.

This was a deliberate stepping stone: it delivers a functional Watchlist-based filter to the UI with zero new backend surface. ADR-0062 Open Question 1 explicitly named the junction table as the next step.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User | Uses the Analytics Dashboard to filter posts by topic | High | Accurate watchlist filter that covers all watchlist types, including boolean queries |
| Tenant-Admin | Configures watchlists and monitors content | High | Reliable per-watchlist post counts and no fabricated analytics |
| Data Model Engineer | Owns schema and persistence layer | High | Clear table contract, RLS, idempotency, and safe ingestion-side writes |
| Frontend Engineer (Analytics Dashboard) | Builds `selectedTopic` and Watchlist Coverage widget | High | A single, accurate server-side filter parameter and real counts |
| Platform Administrator | Operates multi-tenant service | Medium | Tenant isolation, predictable storage growth, and non-blocking ingestion writes |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.11 | epic-3-data-model-storage-and-archival.md | As Tenant User or Tenant-Admin, I want `GET /v1/posts` to accept a `watchlistId` filter parameter so that I can retrieve only the posts that matched a specif... | See epic file. |
| Story 3.12 | epic-3-data-model-storage-and-archival.md | As Tenant User or Tenant-Admin, I want historical posts ingested before Story 3.11 to be matched against active watchlists in `post_watchlist_matches`, and W... | See epic file. |
| Story 8.9 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want a Watchlist/Topic filter on the analytics Overview tab backed by real server-side match records, and a real Watchlist ... | **`selectedTopic` watchlist selector — implement (not upgrade):** Story 8.7 reserved this slot as blocked; this story is the first time it is built. Fetches ... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0062 (Overview Tab Enhancement) reserved the `selectedTopic` filter and Watchlist Coverage widget slot | Internal | Product Owner | Accepted; implementation in Story 8.7/8.9 |
| D-002 | ADR-0058 already computes and publishes the `(post, watchlist)` match set at ingestion | Internal | Data Model Engineer | Built; reused by Story 3.11 |
| D-003 | Story 3.11 — `post_watchlist_matches` junction table, ingestion write, and `GET /v1/posts?watchlistId` filter | Internal | Data Model Engineer | Built 2026-08-19 |
| D-004 | Story 8.7 — Overview tab grid and reserved `selectedTopic` filter slot | Internal | Frontend Engineer | Built 2026-08-19 |
| D-005 | Story 8.9 — `selectedTopic` watchlist filter and Watchlist Coverage widget | Internal | Frontend Engineer | Built 2026-08-20 |
| D-006 | Story 3.12 — historical backfill and discovery-driven watchlist attribution (ADR-0063 Amendment Log) | Internal | Data Model Engineer | Built 2026-08-20 |

---

- The existing watchlist matching logic (`matchesWatchlist()` and `matchesAst()`) is correct and does not need to change.
- Tenants expect an honest empty result for historical posts ingested before this feature is deployed.
- The volume of active watchlists and posts at v1 does not require explicit capacity controls.
- RLS via `app.tenant_id` is sufficient for multi-tenant isolation of junction records.

ADR-0062 Decision §3 introduced `activeWatchlistFilter` — a client-side approximation:

- Fetches the user's active watchlists from `GET /v1/watchlists` (already exists).
- For `keyword`/`hashtag` `matchType` watchlists only: matches each `terms[]` entry case-insensitively against the post's `bodyMarkdown` field (ADR-0053/Story 3.10).
- Excludes `boolean_query` watchlists — re-implementing the full boolean AST client-side carries a fidelity risk against the server's own `matchesAst()` path (ADR-0021 consistency mandate).
- The mismatch vs. server-side ingestion semantics is disclosed in a tooltip.

This was a deliberate stepping stone: it delivers a functional Watchlist-based filter to the UI with zero new backend surface. ADR-0062 Open Question 1 explicitly named the junction table as the next step.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Junction writes must not measurably slow ingestion at current tenant scale. | Performance | Should | Ingestion throughput remains within observed baseline after the change is deployed. |
| NFR-002 | All match data must be tenant-isolated through Row-Level Security. | Security | Must | Cross-tenant `watchlistId` values are treated as not found (`404`) and never leak data. |
| NFR-003 | The schema must be safe for retry and recovery. | Reliability | Must | Idempotent insert and logged best-effort semantics prevent duplicate or lost match records from corrupting ingestion. |
| NFR-004 | The design must accommodate future backfill and re-matching without structural rework. | Maintainability | Should | Existing matchers and the junction table can be reused by a future backfill or reindex endpoint. |

---

## 11. Error Handling and Exceptions
**Positive**

- `GET /v1/posts?watchlistId=<id>` enables proper server-side watchlist filtering — accurate for all `matchType` values (keyword, hashtag, account, boolean AST), RLS-enforced, covering the `boolean_query` watchlists the client-side approximation excluded.
- The Watchlist Coverage widget becomes buildable with real data.
- `activeWatchlistFilter`'s client-side approximation (ADR-0062 Decision §3) can be retired in Story 8.9 — better accuracy, less client-side work, tooltip disclosure no longer needed.
- Match records are written once at ingestion — no per-request re-evaluation of watchlist terms against the full post set.
- Idempotent writes (`ON CONFLICT DO NOTHING`) make the ingestion retry path safe without additional handling.

**Negative**

- New migration and new table to maintain. `post_watchlist_matches` grows proportionally to `posts × active_watchlists_per_tenant` — a real storage cost for tenants with many active watchlists and high post volumes (Open Question 3).
- **Staleness on watchlist update:** when a watchlist's `terms[]` or `boolean_query` changes, existing match records reflect the old definition. Historical posts are not re-matched (Open Question 2).
- **Historical gap:** posts ingested before this table exists have no match records. `GET /v1/posts?watchlistId=<id>` returns an honest result — only posts ingested after Story 3.11 is deployed — but that gap may surprise a tenant expecting a full historical view (Open Question 1).
- `runIngestionAttempt()` gains one additional best-effort write per ingestion call. The write is batched and non-blocking; the performance impact is expected to be negligible at this project's current scale, but is named rather than assumed.
- Story 8.7's `activeWatchlistFilter` approximation (client-side, keyword/hashtag only) and Story 8.9's server-side upgrade are two separate shipped states. During the gap between Stories 8.7 and 8.9, the UI uses the approximation; after Story 8.9, it uses the server-side parameter. This is a named, temporary inconsistency, not a permanent design flaw.

---

## 12. Assumptions and Dependencies
- The existing watchlist matching logic (`matchesWatchlist()` and `matchesAst()`) is correct and does not need to change.
- Tenants expect an honest empty result for historical posts ingested before this feature is deployed.
- The volume of active watchlists and posts at v1 does not require explicit capacity controls.
- RLS via `app.tenant_id` is sufficient for multi-tenant isolation of junction records.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `post_watchlist_matches` storage grows with `posts × active_watchlists` and could become costly. | Medium | Medium | Defer ceiling controls until a real capacity signal; document the risk as Open Question 3 and size the table before acting. | Data Model Engineer |
| R-002 | Existing watchlist records become stale when a watchlist definition changes. | High | Medium | Accept v1 staleness explicitly; a future re-match trigger or on-demand `POST /v1/watchlists/:id/reindex` can be added if needed. | Product Owner |
| R-003 | Historical posts lack match records, surprising users expecting a full historical view. | Medium | Medium | Communicate the honest-empty-result behavior; provide a backfill mechanism in Story 3.12 if required. | Product Owner |
| R-004 | Ingestion write of match records adds a new failure mode. | Low | High | Best-effort semantics and idempotent insert ensure a match-persistence failure does not lose the post. | Data Model Engineer |
| R-005 | `post_id` cannot carry a DB-enforced foreign key because `social_posts` is partitioned. | High | Low | Application-level enforcement plus the fact that no code path hard-deletes `social_posts` rows today; document the trade-off. | Data Model Engineer |

---

## 14. Appendix
- ADR: `../../adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md`
- BRD: `../Business-Requirements/BRD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md``
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md``
- Feature design: `docs/product-research/feature-designs/10-data-export.md``
- Feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md``
- Feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md``
- Feature design: `docs/product-research/feature-designs/27-preconfigured-analytics-views.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above