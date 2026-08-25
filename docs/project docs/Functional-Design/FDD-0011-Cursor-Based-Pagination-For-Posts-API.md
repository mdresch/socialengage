# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0011 Cursor-Based Pagination for the Posts API — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0011-cursor-based-pagination-for-posts-api.md, ../Business-Requirements/BRD-0011-Cursor-Based-Pagination-For-Posts-API.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0011-cursor-based-pagination-for-posts-api.md and the business requirements in BRD-0011-Cursor-Based-Pagination-For-Posts-API.md into functional design for **Cursor Based Pagination For Posts API**.
SocialEngage accumulates `SocialPost` rows continuously as tenant watchlists match new content across platforms. The `GET /posts` endpoint is the primary way tenants, the admin UI, and future event-driven subsystems read this high-volume, unbounded stream. Offset-based pagination becomes both slower and less correct as the table grows: later offsets require the database to scan and discard all prior rows, and concurrent inserts can shift rows underneath a client, causing skipped or duplicated results.

This BRD establishes a **cursor-based pagination** contract for `GET /posts`. Clients receive an opaque `nextCursor` token and request the next page by passing it as a `cursor` query parameter. This preserves stable, predictable query performance at any depth and prevents the classic correctness problems of offset paging on a table that is being written concurrently. Consumers that need "page N of M" navigation will use date-range filters and "load more" affordances instead.

The expected outcomes are: (1) reliable, repeatable paging through a multi-million-row post stream; (2) no skipped or duplicated rows during concurrent ingestion; and (3) a clean, future-proof API contract for the analytics dashboard, post feed, and downstream event consumers.

---

### 2.2 Scope
**In scope:**
- Cursor-based pagination on `GET /v1/posts` using a `cursor` query parameter.
- Opaque `nextCursor` token returned in the `GET /v1/posts` response.
- Stable ordering of paged results suitable for a continuously growing `social_posts` table.
- Preservation of existing query filters (`watchlistId`, `platformId`, `from`, `to`, `sentiment`) when a cursor is used.
- Rejection of `page`, `offset`, `skip`, and other offset-style query parameters.
- Page-size default and upper bound for `GET /v1/posts` requests.
- Admin-UI "load more" / next-page consumption of the cursor, with no client-side cursor construction.
- Any new or existing endpoints whose design depends on `GET /v1/posts` pagination semantics (e.g., filtered watchlist post lists, future reply/activity lists).

**Out of scope:**
- Offset or page-number pagination for `GET /v1/posts`.
- Jump-to-arbitrary-page or "page 5 of 40" navigation in the admin UI.
- Cheap total-result-count for `GET /v1/posts` (counting the full filtered set is not part of this contract).
- Client-side decoding, inspection, or construction of cursor values.
- Changing the pagination mechanism of other endpoints unless those endpoints are explicitly scoped by a later decision.
- Sorting by `publishedAt` instead of `seq`-based ingestion order (admin UI may reverse the in-memory result set, but the backend `ORDER BY seq ASC` contract stays unchanged).

## 3. Context and Background
`SocialPost` is described as "high-volume and unbounded" — it accumulates continuously as tenants' watchlists match new content across platforms, with no natural upper bound. `GET /posts` supports filtering by `watchlistId`, `platformId`, `from`/`to`, and `sentiment`.
SocialEngage accumulates `SocialPost` rows continuously as tenant watchlists match new content across platforms. The `GET /posts` endpoint is the primary way tenants, the admin UI, and future event-driven subsystems read this high-volume, unbounded stream. Offset-based pagination becomes both slower and less correct as the table grows: later offsets require the database to scan and discard all prior rows, and concurrent inserts can shift rows underneath a client, causing skipped or duplicated results.

This BRD establishes a **cursor-based pagination** contract for `GET /posts`. Clients receive an opaque `nextCursor` token and request the next page by passing it as a `cursor` query parameter. This preserves stable, predictable query performance at any depth and prevents the classic correctness problems of offset paging on a table that is being written concurrently. Consumers that need "page N of M" navigation will use date-range filters and "load more" affordances instead.

The expected outcomes are: (1) reliable, repeatable paging through a multi-million-row post stream; (2) no skipped or duplicated rows during concurrent ingestion; and (3) a clean, future-proof API contract for the analytics dashboard, post feed, and downstream event consumers.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Maintain stable `GET /posts` query performance as the post table grows | Page-latency p95 stays within ~200 ms regardless of cursor depth (measured against a multi-million-row table) |
| 2 | Eliminate skipped or duplicated results during concurrent ingestion | Contract test pages through `GET /posts` while rows are inserted and proves no duplicates or skips |
| 3 | Provide a safe, reusable pagination contract for the admin post feed and analytics widgets | Admin UI and dashboard components consume the same `nextCursor` token without constructing or parsing cursor values |
| 4 | Keep the API surface simple and future-proof | `GET /posts` accepts only `cursor` for pagination and explicitly rejects `page`/`offset` parameters |
| 5 | Preserve all existing filter behavior | `watchlistId`, `platformId`, `from`/`to`, and `sentiment` filters continue to work with cursor pagination |

---

**Positive consequences (from ADR):**
**Positive**
- Cursor pagination has stable, predictable performance regardless of how deep into the result set a client pages — offset pagination on a large, growing table gets progressively slower as the offset grows (the database must scan and discard all preceding rows).
- Avoids the classic offset-pagination correctness bug where new rows inserted ahead of a client's current page shift subsequent pages, causing skipped or duplicated results — a real concern here since posts are ingested continuously into the same table a client may be paging through.
- Fits naturally with `publishedAt`/`ingestedAt`-ordered access patterns, which is how most consumers (including future event-driven subsystems doing catch-up reads) will want to page through results.

**Negative**
- Cursor pagination doesn't support jumping to an arbitrary page number or showing a total result count cheaply — both of which offset pagination gives for free. Any admin UI needing "page 5 of 40" style navigation will need a different affordance (e.g., date-range filters instead of page numbers).
- Requires the API and any client SDKs to treat the cursor as an opaque token rather than something to construct or reason about directly, which is a slightly less familiar pattern for API consumers than `?page=2`.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
Paginate `GET /posts` using a cursor (`cursor=` query parameter), not offset/limit.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Admin (UI user) | Browses the post feed, filters by provider/sentiment/watchlist | High | Smooth, reliable feed that never skips or duplicates posts; "Show more" works naturally |
| API consumer / integrator | Builds against `GET /v1/posts` | High | Predictable performance and a simple, stable paging contract |
| Data engineer / downstream subsystem | Consumes posts via REST catch-up or Service Bus events | Medium | Consistent ordering and no missed rows when paging through large historical sets |
| Platform Admin | Monitors tenant health and data growth | Medium | Confidence that pagination does not degrade with table size or concurrent writes |
| Product Owner | Defines admin UI and analytics behavior | Medium | A single, reusable contract that serves both feed and dashboard use cases |
| Backend engineer | Implements and maintains `GET /v1/posts` | High | Clear rules on allowed parameters, cursor semantics, and contract tests to verify |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.4 | epic-3-data-model-storage-and-archival.md | As API consumer paging through a tenant's posts, I want `GET /posts` paginated by opaque cursor rather than offset, so that performance stays stable on a hig... | `GET /posts` accepts a `cursor` query parameter and returns a cursor for the next page; it does not accept `page`/`offset` parameters.; Paging through result... |
| Story 6.11 | epic-6-tenant-admin-ui.md | As tenant user or Tenant-Admin, I want to see the posts my tenant's connected platforms have actually collected, so that I can confirm ingestion is working a... | A `/tenant/posts` screen calls the real `GET /v1/posts` and renders each post: whatever title/text is derivable from `rawPayload` (heterogeneous per connecto... |
| Story 6.18 | epic-6-tenant-admin-ui.md | As Tenant User or Tenant-Admin, I want the search box and Provider/Sentiment/Watchlist filters on `/tenant/posts` to search and filter across everything my t... | `page.tsx` fetches the tenant's full post set via a real, paginated loop (reusing `listPosts(cursor, limit)`'s already-extended `limit` param, the identical ... |
| Story 6.25 | epic-6-tenant-admin-ui.md | As Tenant-Admin scanning the post feed for recent activity, I want the most recently ingested posts shown first, with the oldest posts only reached once I've... | `fetchAllPosts()` (`tenant/posts/page.tsx`) returns posts in most-recently-ingested-first order — the fully-fetched array is reversed once, after paging comp... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- `social_posts` has a monotonic, insertion-ordered key (`seq`) that can anchor a keyset cursor.
- Posts are ingested continuously while clients page, so correctness under concurrent inserts is a core requirement.
- Consumers of `GET /v1/posts` can adapt to a "load more" / next-page model rather than page numbers.
- The admin UI and future dashboard widgets read from the same `GET /v1/posts` endpoint.

Paginate `GET /posts` using a cursor (`cursor=` query parameter), not offset/limit.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `GET /v1/posts` page latency at any cursor depth stays within ~200 ms p95 on a multi-million-row table | Performance | Must | Measured by contract or load test against a representative dataset |
| NFR-002 | Concurrent ingestion must not cause skipped or duplicated paged results | Reliability | Must | Verified by the concurrency contract test in BR-003 |
| NFR-003 | Cursor tokens must remain opaque and implementation-detail independent | Maintainability | Should | No client or contract asserts structure on the token value |
| NFR-004 | Pagination must respect Postgres Row-Level Security and tenant isolation | Security | Must | Contract test confirms a tenant cannot page another tenant's posts via cursor manipulation |
| NFR-005 | The pagination contract must support a continuously growing table without schema or API changes | Scalability | Should | Design reviewed for keyset pagination on `seq` or equivalent monotonic key |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Cursor pagination has stable, predictable performance regardless of how deep into the result set a client pages — offset pagination on a large, growing table gets progressively slower as the offset grows (the database must scan and discard all preceding rows).
- Avoids the classic offset-pagination correctness bug where new rows inserted ahead of a client's current page shift subsequent pages, causing skipped or duplicated results — a real concern here since posts are ingested continuously into the same table a client may be paging through.
- Fits naturally with `publishedAt`/`ingestedAt`-ordered access patterns, which is how most consumers (including future event-driven subsystems doing catch-up reads) will want to page through results.

**Negative**
- Cursor pagination doesn't support jumping to an arbitrary page number or showing a total result count cheaply — both of which offset pagination gives for free. Any admin UI needing "page 5 of 40" style navigation will need a different affordance (e.g., date-range filters instead of page numbers).
- Requires the API and any client SDKs to treat the cursor as an opaque token rather than something to construct or reason about directly, which is a slightly less familiar pattern for API consumers than `?page=2`.

## 12. Assumptions and Dependencies
- `social_posts` has a monotonic, insertion-ordered key (`seq`) that can anchor a keyset cursor.
- Posts are ingested continuously while clients page, so correctness under concurrent inserts is a core requirement.
- Consumers of `GET /v1/posts` can adapt to a "load more" / next-page model rather than page numbers.
- The admin UI and future dashboard widgets read from the same `GET /v1/posts` endpoint.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | API consumers or client developers find the opaque-cursor pattern unfamiliar compared to `?page=2` | Medium | Low | Document the pattern in the API guide and provide admin-UI examples that use "load more" only | Product Owner / Technical Lead |
| R-002 | A client decodes or constructs cursor values, coupling itself to internal encoding | Medium | Medium | Add explicit contract tests and client SDK guidance that treat the token as opaque; reject obviously client-constructed values | Backend Lead |
| R-003 | Data retention / archival (ADR-0018) changes the availability of rows a cursor may refer to | Low | Medium | Cursor logic is scoped to live `social_posts`; archived rows remain addressable by their primary key via `GET /posts/:id` if referenced elsewhere | Backend Lead |
| R-004 | The admin UI initially needs total-result counts or page numbers for UX patterns | Medium | Low | Use date-range filters and "load more" affordances instead; document that total counts are out of scope per ADR-0011 | Product Owner |
| R-005 | Cursor pagination is applied to a query that also sorts or filters in a way that breaks keyset stability | Low | High | Ensure the keyset order includes the same columns used in `WHERE` filters and is verified by contract tests | Backend Lead |

---

## 14. Appendix
- ADR: `../../adr/0011-cursor-based-pagination-for-posts-api.md`
- BRD: `../Business-Requirements/BRD-0011-Cursor-Based-Pagination-For-Posts-API.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md``
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above