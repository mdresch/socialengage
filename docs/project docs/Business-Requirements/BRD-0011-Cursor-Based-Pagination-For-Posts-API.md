# Business Requirements Document — BRD-0011: Cursor-Based Pagination for the Posts API

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Cursor-Based Pagination for the Posts API (ADR-0011) – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Project Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0011, Design Spec §6, and related user stories |
| 1.0 | 2026-08-23 | BRD Writer Agent | Filled BRD template with accepted decisions, scope, and acceptance criteria |

---

## 2. Executive Summary

SocialEngage accumulates `SocialPost` rows continuously as tenant watchlists match new content across platforms. The `GET /posts` endpoint is the primary way tenants, the admin UI, and future event-driven subsystems read this high-volume, unbounded stream. Offset-based pagination becomes both slower and less correct as the table grows: later offsets require the database to scan and discard all prior rows, and concurrent inserts can shift rows underneath a client, causing skipped or duplicated results.

This BRD establishes a **cursor-based pagination** contract for `GET /posts`. Clients receive an opaque `nextCursor` token and request the next page by passing it as a `cursor` query parameter. This preserves stable, predictable query performance at any depth and prevents the classic correctness problems of offset paging on a table that is being written concurrently. Consumers that need "page N of M" navigation will use date-range filters and "load more" affordances instead.

The expected outcomes are: (1) reliable, repeatable paging through a multi-million-row post stream; (2) no skipped or duplicated rows during concurrent ingestion; and (3) a clean, future-proof API contract for the analytics dashboard, post feed, and downstream event consumers.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Maintain stable `GET /posts` query performance as the post table grows | Page-latency p95 stays within ~200 ms regardless of cursor depth (measured against a multi-million-row table) |
| 2 | Eliminate skipped or duplicated results during concurrent ingestion | Contract test pages through `GET /posts` while rows are inserted and proves no duplicates or skips |
| 3 | Provide a safe, reusable pagination contract for the admin post feed and analytics widgets | Admin UI and dashboard components consume the same `nextCursor` token without constructing or parsing cursor values |
| 4 | Keep the API surface simple and future-proof | `GET /posts` accepts only `cursor` for pagination and explicitly rejects `page`/`offset` parameters |
| 5 | Preserve all existing filter behavior | `watchlistId`, `platformId`, `from`/`to`, and `sentiment` filters continue to work with cursor pagination |

---

## 4. Scope

### 4.1 In Scope

- Cursor-based pagination on `GET /v1/posts` using a `cursor` query parameter.
- Opaque `nextCursor` token returned in the `GET /v1/posts` response.
- Stable ordering of paged results suitable for a continuously growing `social_posts` table.
- Preservation of existing query filters (`watchlistId`, `platformId`, `from`, `to`, `sentiment`) when a cursor is used.
- Rejection of `page`, `offset`, `skip`, and other offset-style query parameters.
- Page-size default and upper bound for `GET /v1/posts` requests.
- Admin-UI "load more" / next-page consumption of the cursor, with no client-side cursor construction.
- Any new or existing endpoints whose design depends on `GET /v1/posts` pagination semantics (e.g., filtered watchlist post lists, future reply/activity lists).

### 4.2 Out of Scope

- Offset or page-number pagination for `GET /v1/posts`.
- Jump-to-arbitrary-page or "page 5 of 40" navigation in the admin UI.
- Cheap total-result-count for `GET /v1/posts` (counting the full filtered set is not part of this contract).
- Client-side decoding, inspection, or construction of cursor values.
- Changing the pagination mechanism of other endpoints unless those endpoints are explicitly scoped by a later decision.
- Sorting by `publishedAt` instead of `seq`-based ingestion order (admin UI may reverse the in-memory result set, but the backend `ORDER BY seq ASC` contract stays unchanged).

### 4.3 Assumptions

- `social_posts` has a monotonic, insertion-ordered key (`seq`) that can anchor a keyset cursor.
- Posts are ingested continuously while clients page, so correctness under concurrent inserts is a core requirement.
- Consumers of `GET /v1/posts` can adapt to a "load more" / next-page model rather than page numbers.
- The admin UI and future dashboard widgets read from the same `GET /v1/posts` endpoint.

### 4.4 Constraints

- Postgres Row-Level Security enforces tenant isolation; pagination must respect the caller's `tenantId` scope.
- The table is expected to hold multi-million rows per tenant over time, so the database cannot scan and discard large offsets.
- Cursor tokens must remain opaque so the keyset comparison and encoding can evolve without breaking clients.
- The decision is binding on `GET /v1/posts`; any future endpoints with similar high-volume, append-only semantics should follow the same convention.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Admin (UI user) | Browses the post feed, filters by provider/sentiment/watchlist | High | Smooth, reliable feed that never skips or duplicates posts; "Show more" works naturally |
| API consumer / integrator | Builds against `GET /v1/posts` | High | Predictable performance and a simple, stable paging contract |
| Data engineer / downstream subsystem | Consumes posts via REST catch-up or Service Bus events | Medium | Consistent ordering and no missed rows when paging through large historical sets |
| Platform Admin | Monitors tenant health and data growth | Medium | Confidence that pagination does not degrade with table size or concurrent writes |
| Product Owner | Defines admin UI and analytics behavior | Medium | A single, reusable contract that serves both feed and dashboard use cases |
| Backend engineer | Implements and maintains `GET /v1/posts` | High | Clear rules on allowed parameters, cursor semantics, and contract tests to verify |

---

## 6. Current State (As-Is)

The `social_posts` table is high-volume and unbounded: every matched post from every active connector for every tenant is written to the same tenant-scoped table. `GET /posts` already supports filters by `watchlistId`, `platformId`, `from`/`to` date range, and `sentiment`.

**Current pain points:**
- Without an explicit pagination contract, a naive offset/limit design would degrade as the result set grows.
- Offset pagination forces the database to scan and discard rows for every deeper page, increasing latency linearly with offset size.
- Because posts are ingested concurrently with reads, an offset-based design is vulnerable to the classic "shifting window" bug: newly inserted rows that belong earlier in the order push subsequent pages, causing rows to be skipped or duplicated across requests.
- The admin post feed and analytics widgets need a single reliable read contract; an ambiguous pagination model would force each client to handle concurrency edge cases independently.

---

## 7. Future State (To-Be)

`GET /v1/posts` returns a page of `SocialPostSummary` records plus an opaque `nextCursor` token. The client requests the next page by sending the token as the `cursor` query parameter. Pagination is anchored to a keyset (monotonic `seq`) rather than a numeric offset, so the database can resolve any page with a bounded index scan and no row-by-row discard.

**Expected capabilities:**
- A client can walk through the entire filtered, tenant-scoped result set from oldest to newest (or, in the admin UI, newest-first after a client-side reverse) without skipped or duplicated rows.
- Query latency remains roughly constant regardless of how far into the result set the client has paged.
- Concurrent ingestion never corrupts the page boundaries for an in-flight paging session.
- The admin UI and analytics widgets share the same `GET /v1/posts` cursor contract, consuming only `nextCursor` and never constructing or interpreting cursor values.
- `GET /v1/posts` explicitly rejects `page`/`offset` parameters, keeping the API surface stable and future-proof.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | `GET /v1/posts` shall accept an optional `cursor` query parameter and return an opaque `nextCursor` when more pages remain | Must | Contract test proves a request with a valid `cursor` returns the next page and a `nextCursor` is present when not at end | Product Owner / Backend Lead |
| BR-002 | `GET /v1/posts` shall not accept `page`, `offset`, `skip`, or equivalent offset parameters | Must | Requests with offset-style parameters are rejected with a `400` error | Product Owner / Backend Lead |
| BR-003 | Paging through `GET /v1/posts` while new posts are concurrently inserted shall produce no skipped or duplicated rows | Must | Contract test inserts rows mid-pagination and asserts the union of all pages equals the expected set with no duplicates | Product Owner / Backend Lead |
| BR-004 | `GET /v1/posts` shall continue to support `watchlistId`, `platformId`, `from`, `to`, and `sentiment` filters when a `cursor` is present | Must | Each filter is tested in combination with `cursor`; pagination returns correct, filtered pages | Product Owner / Backend Lead |
| BR-005 | The `nextCursor` token shall be treated as opaque by all clients and client SDKs | Should | Admin-UI and dashboard code pass the token directly without decoding or constructing it | Frontend Lead |
| BR-006 | `GET /v1/posts` shall enforce a default page size and a maximum page size for the `limit` parameter | Should | Default and max page sizes are documented and contract-tested; requests above the max return an error | Product Owner / Backend Lead |
| BR-007 | The admin post feed shall use "load more" / next-page navigation only, never page-number controls | Should | UI tests confirm the feed renders a `nextCursor`-driven control and no `page` input | Frontend Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `GET /v1/posts` page latency at any cursor depth stays within ~200 ms p95 on a multi-million-row table | Performance | Must | Measured by contract or load test against a representative dataset |
| NFR-002 | Concurrent ingestion must not cause skipped or duplicated paged results | Reliability | Must | Verified by the concurrency contract test in BR-003 |
| NFR-003 | Cursor tokens must remain opaque and implementation-detail independent | Maintainability | Should | No client or contract asserts structure on the token value |
| NFR-004 | Pagination must respect Postgres Row-Level Security and tenant isolation | Security | Must | Contract test confirms a tenant cannot page another tenant's posts via cursor manipulation |
| NFR-005 | The pagination contract must support a continuously growing table without schema or API changes | Scalability | Should | Design reviewed for keyset pagination on `seq` or equivalent monotonic key |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `GET /v1/posts` accepts `cursor` as its only pagination mechanism and rejects `page`/`offset` parameters. |
| BRU-002 | The `nextCursor` token is opaque; clients must pass it back verbatim and must not decode, construct, or reason about its internal value. |
| BRU-003 | Pagination is ordered on a monotonic, insertion-ordered key (`seq`) so that pages are stable under concurrent inserts. |
| BRU-004 | All `GET /v1/posts` responses must remain scoped by the caller's tenant through Postgres RLS, regardless of cursor value. |
| BRU-005 | Existing filters (`watchlistId`, `platformId`, `from`/`to`, `sentiment`) must be applied before and consistently with cursor keyset comparison. |
| BRU-006 | A missing, invalid, or expired `cursor` must return a client-error response and must not expose internal database state. |
| BRU-007 | Page-size limits are enforced by the API; the admin UI may request a specific `limit` but never exceeds the documented maximum. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `social_posts.id` | Primary key / public post identifier | `social_posts` table | Backend / Data | Tenant-owned content |
| `social_posts.seq` | Monotonic, insertion-ordered identity column used as the keyset anchor for cursor pagination | `social_posts` table | Backend / Data | Internal ordering key |
| `social_posts.tenant_id` | Tenant owner for RLS scope | `social_posts` table | Backend / Data | Multi-tenant isolation key |
| `social_posts.platform_id` | Provider/platform that sourced the post | `social_posts` table | Backend / Data | Tenant-owned content |
| `social_posts.published_at` | Original publish timestamp of the post | `social_posts` table | Backend / Data | Tenant-owned content |
| `social_posts.ingested_at` | Time the post was stored in the system | `social_posts` table | Backend / Data | Operational metadata |
| `social_posts.sentiment` | Inferred sentiment label | `social_posts` table | Backend / Data | Tenant-owned content |
| `post_watchlist_matches.watchlist_id` | Link between posts and matching watchlists | `post_watchlist_matches` table | Backend / Data | Tenant-owned content |
| `nextCursor` token | Opaque, encoded keyset value returned in `GET /v1/posts` responses | API encoding of `seq` plus filter state | API / Frontend | Internal token; no PII |
| `GET /v1/posts` response | Page of `SocialPostSummary[]` plus `nextCursor` | Derived from `social_posts` and joined tables | API / Frontend | Tenant-owned content, RLS-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| `GET /v1/posts` p95 latency by cursor depth | Track that deep paging does not degrade performance | Backend / Platform Admin | Continuous (monitoring) |
| Paging-correctness pass/fail rate | Confirm no skipped or duplicated pages under concurrent ingestion | Backend / QA | Per contract run |
| Filtered page coverage | Verify cursor pagination works with each supported filter combination | Backend / QA | Per contract run |
| Admin post feed "load more" usage | Observe that the UI follows the intended next-page pattern | Product / Frontend | Per release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | API consumers or client developers find the opaque-cursor pattern unfamiliar compared to `?page=2` | Medium | Low | Document the pattern in the API guide and provide admin-UI examples that use "load more" only | Product Owner / Technical Lead |
| R-002 | A client decodes or constructs cursor values, coupling itself to internal encoding | Medium | Medium | Add explicit contract tests and client SDK guidance that treat the token as opaque; reject obviously client-constructed values | Backend Lead |
| R-003 | Data retention / archival (ADR-0018) changes the availability of rows a cursor may refer to | Low | Medium | Cursor logic is scoped to live `social_posts`; archived rows remain addressable by their primary key via `GET /posts/:id` if referenced elsewhere | Backend Lead |
| R-004 | The admin UI initially needs total-result counts or page numbers for UX patterns | Medium | Low | Use date-range filters and "load more" affordances instead; document that total counts are out of scope per ADR-0011 | Product Owner |
| R-005 | Cursor pagination is applied to a query that also sorts or filters in a way that breaks keyset stability | Low | High | Ensure the keyset order includes the same columns used in `WHERE` filters and is verified by contract tests | Backend Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Design Spec §6 "REST API Surface (v1)" (defines `GET /posts` surface and filter set) | Source / Reference | Project Owner | Accepted (2026-07-28) |
| D-002 | ADR-0011: Cursor-based pagination for `GET /posts` (governing architecture decision) | Source / Reference | Project Owner | Accepted (2026-07-28) |
| D-003 | `social_posts` data model with `seq` and tenant-scoped filtering (Story 3.1 / Epic 3) | Internal / Data | Backend Lead | Built |
| D-004 | Story 3.4 — Cursor-based pagination for the posts API (contract tests and implementation) | Internal / Implementation | Backend Lead | Ready |
| D-005 | Story 6.11 — Post feed (browse ingested posts) (first admin-UI consumer) | Internal / UI | Frontend Lead | Built |
| D-006 | ADR-0012: Thin events with REST fetch on demand (post detail via `GET /posts/:id`) | Related ADR | Project Owner | Accepted |
| D-007 | ADR-0044: Watchlist API design and database schema (filtered post list with `watchlistId`) | Related ADR | Project Owner | Accepted |
| D-008 | `docs/product-research/feature-designs/08-dashboards-and-analytics.md` (references `GET /v1/posts` cursor pagination) | Related Design | Product Owner | Accepted |
| D-009 | No dedicated product-research feature design or deep-research brief exists specifically for ADR-0011 | Missing Source | Product Owner | Noted in Appendices |

---

## 14. Acceptance Criteria

- `GET /v1/posts` accepts a `cursor` query parameter and returns a `nextCursor` token when more pages remain.
- `GET /v1/posts` does not accept `page`/`offset` parameters and rejects them with a `400` response.
- Paging through results while new posts are concurrently inserted produces no duplicate or skipped rows.
- Query latency for a page near the end of a multi-million-row table is comparable to a page near the start.
- `watchlistId`, `platformId`, `from`/`to`, and `sentiment` filters continue to work correctly when combined with `cursor`.
- The `nextCursor` token is opaque; the admin UI passes it verbatim and never constructs or decodes it.
- The admin post feed uses "load more" / next-page navigation and no page-number control for `GET /v1/posts`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Cursor (pagination) | An opaque token returned by the API that identifies the starting point for the next page of results. |
| Keyset pagination | A pagination strategy that filters rows using the value of the last seen ordered key (`seq`) instead of skipping a fixed number of rows with `OFFSET`. |
| Offset pagination | A pagination strategy using `LIMIT ... OFFSET ...`; prone to performance degradation and correctness issues under concurrent inserts. |
| Opaque token | A value whose internal structure clients must not rely on; the server may change the encoding without notice. |
| `seq` | A monotonic, insertion-ordered identity column on `social_posts` used as the keyset anchor for the cursor. |
| `SocialPost` | The domain entity representing an ingested social post; stored in the `social_posts` table. |
| `SocialPostSummary` | The response shape returned by `GET /v1/posts`, containing a subset of `SocialPost` fields plus pagination metadata. |

---

## 16. Appendices

### Supporting and reference documents

- [ADR-0011: Cursor-based pagination for `GET /posts`](../../adr/0011-cursor-based-pagination-for-posts-api.md)
- [Design Spec §6 "REST API Surface (v1)"](../../project%20docs/2026-07-28-social-listening-ingestion-design.md#6-rest-api-surface-v1)
- [Feature design: 08-dashboards-and-analytics.md](../../product-research/feature-designs/08-dashboards-and-analytics.md) (references `GET /v1/posts` cursor pagination)
- [Data export feature design: 10-data-export.md](../../product-research/feature-designs/10-data-export.md) (recommends keyset/cursor pagination for large exports)

### Related user stories

- **Story 3.4 — Cursor-based pagination for the posts API** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`)
  - As an API consumer paging through a tenant's posts, I want `GET /posts` paginated by opaque cursor rather than offset, so that performance stays stable on a high-volume, continuously-growing table, and concurrent inserts don't cause skipped or duplicated results across pages.
  - Acceptance criteria: `GET /posts` accepts a `cursor` query parameter and returns a cursor for the next page; it does not accept `page`/`offset` parameters; concurrent-insert pagination test shows no duplicates or skips; query latency at end of large table is comparable to start.
- **Story 6.11 — Post feed (browse ingested posts)** (`docs/user-stories/epic-6-tenant-admin-ui.md`)
  - Built 2026-08-12. Exposes `GET /v1/posts` and `GET /v1/posts/:id` in the admin UI using the real opaque `nextCursor` "load more" pattern, never page-number controls or client-constructed cursors.
- **Story 6.18 — Post feed search/filter operates over all matched posts, not just the current page** (`docs/user-stories/epic-6-tenant-admin-ui.md`)
  - Built 2026-08-17. Client-side full-set fetch over `GET /v1/posts` cursor pages before rendering search/filters; uses the existing cursor mechanism and no new backend endpoint.
- **Story 6.25 — Post feed shows most-recently-ingested posts first** (`docs/user-stories/epic-6-tenant-admin-ui.md`)
  - Built 2026-08-18. Reverses the fully-fetched, in-memory array client-side after paging through `GET /v1/posts`; backend `ORDER BY seq ASC` and cursor keyset direction remain unchanged.
- **Story 6.26 — Post feed's Provider filter derives its options from real data, not a hardcoded list** (`docs/user-stories/epic-6-tenant-admin-ui.md`)
  - Built 2026-08-18. Reuses the full post set already fetched through ADR-0011 cursor pagination; no change to the pagination mechanism itself.

### Missing sources

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for ADR-0011. The ADR is sourced directly from the Design Spec §6 and the related user stories above.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
