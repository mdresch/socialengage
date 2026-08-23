# Business Requirements Document (BRD)

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0004-author-normalized-separately-from-post.md, ../Business-Requirements/BRD-0004-Author-Normalized-Separately-From-Post.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0004-author-normalized-separately-from-post.md and the business requirements in BRD-0004-Author-Normalized-Separately-From-Post.md into functional design for **Author Normalized Separately From Post**.
Every ingested social post belongs to an author, and the same author can publish many posts inside a watchlist's matching window. Without a normalized author model, the platform would duplicate handle, display name, follower count, and profile location across every post from the same account, making the data hard to keep fresh and expensive to query at scale.

This BRD defines the business need to model `Author` as a first-class entity, distinct from `SocialPost`, keyed by tenant, platform, and the platform's own external author identifier. `SocialPost` will reference `Author` via a foreign key (`authorId`) rather than embedding author fields. This enables author-level analytics such as the "expert finder" query (`GET /topics/:topic/authors`) and the `AuthorTopicSignal` capability, while keeping per-post data focused on per-event facts like engagement and geo-location.

The expected business value is a smaller, cleaner storage model, more accurate author-level reporting, and a stable anchor for influencer discovery and trend analysis.

---

### 2.2 Scope
**In scope:**
- Create and maintain a normalized `Author` entity keyed by `(tenantId, platformId, externalAuthorId)`.
- Upsert `Author` rows as new posts are ingested and track `firstSeenAt` and `lastSeenAt`.
- Store `SocialPost.authorId` as a foreign key to `Author`; do not embed author fields on `SocialPost`.
- Store per-account `profileLocation` on `Author` and per-event `postGeoLocation` on `SocialPost`.
- Store a raw profile payload on `Author` for traceability and future enrichment.
- Apply the organization-as-Author pattern for connectors whose content producer is an organization, publication, or verified domain rather than an individual (Newswire, GNews, tenant-owned-domain feeds).
- Preserve a point-in-time `authorFollowerCountAtPublish` on `SocialPost` for connectors that can provide it at ingest, as a scoped exception to the normalized model.

**Out of scope:**
- Real-time author profile synchronization outside the normal ingestion flow.
- Embedding full author profile fields on each `SocialPost`.
- Building a full social graph or relationship map between authors.
- Historical backfill of author rows for posts ingested before this capability ships.
- Author identity verification beyond the platform's own `externalAuthorId`.

## 3. Context and Background
Every ingested `SocialPost` has an author, and the same author will post repeatedly within a watchlist's matching window. The system also needs to support an "expert finder" query (`GET /topics/:topic/authors`, §6) that reasons about an author's behavior over time (activity months, follower count, mention history) rather than about any single post.
Every ingested social post belongs to an author, and the same author can publish many posts inside a watchlist's matching window. Without a normalized author model, the platform would duplicate handle, display name, follower count, and profile location across every post from the same account, making the data hard to keep fresh and expensive to query at scale.

This BRD defines the business need to model `Author` as a first-class entity, distinct from `SocialPost`, keyed by tenant, platform, and the platform's own external author identifier. `SocialPost` will reference `Author` via a foreign key (`authorId`) rather than embedding author fields. This enables author-level analytics such as the "expert finder" query (`GET /topics/:topic/authors`) and the `AuthorTopicSignal` capability, while keeping per-post data focused on per-event facts like engagement and geo-location.

The expected business value is a smaller, cleaner storage model, more accurate author-level reporting, and a stable anchor for influencer discovery and trend analysis.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate author-field duplication across posts | One `Author` row per `(tenantId, platformId, externalAuthorId)` regardless of post volume |
| 2 | Enable accurate author-level analytics and expert discovery | `GET /topics/:topic/authors` and `AuthorTopicSignal` can query current and historical author facts without scanning every post |
| 3 | Keep per-post and per-author location data correctly separated | `postGeoLocation` is stored on `SocialPost`; `profileLocation` is stored on `Author` |
| 4 | Support future point-in-time reach analysis | `SocialPost` can optionally capture `authorFollowerCountAtPublish` without breaking the normalized `Author` model |
| 5 | Reduce the cost and risk of profile updates | Updating an author's display name or follower count updates one row, not historical posts |

---

**Positive consequences (from ADR):**
**Positive**
- Author-level facts (follower count, display name, profile location) are stored once and updated in place, instead of being duplicated and potentially going stale across thousands of posts from the same account.
- `firstSeenAt`/`lastSeenAt` and the upsert-on-arrival pattern give a natural way to track account activity over time, which the expert-finder query and `AuthorTopicSignal` (ADR-0007) build on directly.
- Keeps `SocialPost` focused on per-event data (engagement metrics, per-post geo, enrichment), matching the spec's explicit note that `postGeoLocation` is "per-event, not per-author" while `profileLocation` lives on `Author`.

**Negative**
- Every post write now involves an author upsert (or a lookup against an already-upserted author within the same ingestion run), adding a write path that a fully denormalized post table wouldn't need.
- Author facts like `followerCount` reflect whatever was true at last-seen time, not at each individual post's `publishedAt` — historical accuracy of "follower count at time of post" is not preserved.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall create or update one `Author` row for each content-producing entity encountered during ingestion | Must | Ingesting two posts from the same `externalAuthorId` within a tenant results in one `Author` row with `lastSeenAt` updated | Product Owner |
| BR-002 | The system shall uniquely identify an `Author` by the composite key `(tenantId, platformId, externalAuthorId)` | Must | No two `Author` rows share the same `(tenantId, platformId, externalAuthorId)` | Product Owner |
| BR-003 | `SocialPost` shall reference `Author` via `authorId` and not embed author display fields | Must | `SocialPost` has no `handle`, `displayName`, `profileLocation`, or `verifiedStatus` columns | Product Owner |
| BR-004 | The system shall track `firstSeenAt` and `lastSeenAt` on `Author` | Must | `firstSeenAt` is set on first encounter and never updated; `lastSeenAt` is updated on each new post | Product Owner |
| BR-005 | The system shall store `profileLocation` on `Author` and `postGeoLocation` on `SocialPost` | Must | Schema inspection confirms each field lives on the correct table | Product Owner |
| BR-006 | The system shall support the organization-as-Author pattern for connectors where the content producer is an organization, publication, or verified domain | Must | Newswire, GNews, and tenant-owned-domain connectors use the pattern and leave `followerCount` unpopulated | Product Owner |
| BR-007 | The system shall optionally store a point-in-time author follower count on `SocialPost` for connectors that provide it at ingest | Should | `SocialPost.authorFollowerCountAtPublish` is set once at ingest and never reconciled with `Author.followerCount` | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
Model `Author` as its own entity, keyed by `(tenantId, platformId, externalAuthorId)`, upserted as new posts arrive, tracking `firstSeenAt`/`lastSeenAt` and the raw profile payload. `SocialPost.authorId` is a foreign key into `Author` rather than embedding author fields on every post.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Data Engineer | Implements and operates the ingestion pipeline | High | A clear, deduplicated data model that is easy to query and maintain |
| Tenant Business Analyst | Uses author and influencer analytics | High | Accurate author-level facts and stable identity over time |
| Platform Operator | Manages storage, cost, and data quality | Medium | Reduced duplication, predictable storage growth, clean archival boundaries |
| API Consumer | Builds on the posts and topics API | Medium | Stable response shapes and reliable author identifiers |
| Author-of-a-Post (Data Subject) | Subject of stored profile data | Medium | Profile data is stored accurately and only as needed |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.1 | epic-3-data-model-storage-and-archival.md | As data engineer, I want authors normalized into their own `Author` entity, upserted by `(tenantId, platformId, externalAuthorId)`, with `SocialPost` referen... | Ingesting two posts from the same external author within a tenant results in exactly one `Author` row, with `lastSeenAt` updated on the second ingest.; `Soci... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Author.tenantId` | Tenant scope for RLS | Identity resolution / session | Platform | Internal |
| `Author.platformId` | Connector/platform identifier | Connector `providerId` | Platform | Internal |
| `Author.externalAuthorId` | Platform-native author identifier | Connector normalized output | Platform | Internal |
| `Author.handle` | Author's public handle or username | Connector normalized output | Tenant | Public / personal data |
| `Author.displayName` | Author's public display name | Connector normalized output | Tenant | Public / personal data |
| `Author.followerCount` | Most recently seen follower/audience count | Connector normalized output | Tenant | Public / aggregated |
| `Author.profileLocation` | Author's self-declared location | Connector normalized output | Tenant | Public / personal data |
| `Author.verifiedStatus` | Platform verification status | Connector normalized output | Tenant | Public |
| `Author.rawProfile` | Raw platform profile payload | Connector raw response | Tenant | Personal data |
| `Author.firstSeenAt` | Timestamp of first observed post | Ingestion pipeline | Platform | Internal |
| `Author.lastSeenAt` | Timestamp of most recent post | Ingestion pipeline | Platform | Internal |
| `SocialPost.authorId` | Foreign key to `Author` | Ingestion pipeline | Platform | Internal |
| `SocialPost.postGeoLocation` | Per-post geo data | Connector normalized output | Tenant | Public / personal data |
| `SocialPost.authorFollowerCountAtPublish` | Optional point-in-time follower count | Connector normalized output | Tenant | Public / aggregated |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | An `Author` is uniquely identified within a tenant by `(tenantId, platformId, externalAuthorId)`. |
| BRU-002 | There is exactly one `Author` row per external content-producing entity within a tenant. |
| BRU-003 | `SocialPost` stores only `authorId`; it does not embed `handle`, `displayName`, `profileLocation`, or `verifiedStatus`. |
| BRU-004 | `Author.followerCount` always reflects the most recently ingested value and is updated in place. |
| BRU-005 | `SocialPost.authorFollowerCountAtPublish`, when populated, is written once at ingest and never updated or reconciled with `Author.followerCount`. |
| BRU-006 | Connectors whose author is an organization, publication, or verified domain leave `Author.followerCount` unpopulated. |
| BRU-007 | `postGeoLocation` is a per-event attribute on `SocialPost`; `profileLocation` is a per-account attribute on `Author`. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Story 3.1 — Normalized author entity | Internal | Menno | Shipped / Ready |
| D-002 | Story 3.9 — Point-in-time author follower count on `SocialPost` | Internal | Menno | Shipped 2026-08-12 |
| D-003 | ADR-0024, ADR-0026, ADR-0050 — organization-as-Author exceptions | Internal | Menno | Accepted |
| D-004 | ADR-0049 — point-in-time follower count field | Internal | Menno | Accepted 2026-08-11 |
| D-005 | ADR-0042 — Wikipedia article-as-Author exception | Internal | Menno | Accepted 2026-08-08 |
| D-006 | Design Spec §4.1 "Author" | Reference | Product Owner | Not present as a separate file in the repository; source cited by ADR-0004 |

---

- Every connector supplies a stable, platform-native identifier for the content-producing entity.
- Author data is tenant-scoped and subject to row-level security.
- Author facts such as `followerCount` are expected to change over time and are acceptable as most-recent values for most use cases.

Model `Author` as its own entity, keyed by `(tenantId, platformId, externalAuthorId)`, upserted as new posts arrive, tracking `firstSeenAt`/`lastSeenAt` and the raw profile payload. `SocialPost.authorId` is a foreign key into `Author` rather than embedding author fields on every post.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Author upsert on ingest must not add more than a bounded, measurable overhead to the ingestion pipeline | Performance | Should | Ingestion contract tests continue to meet their latency thresholds |
| NFR-002 | `Author` and `SocialPost` data must be isolated by tenant | Security | Must | RLS policies prevent cross-tenant reads and writes on both tables |
| NFR-003 | The normalized author model must remain consistent under concurrent ingestion runs | Reliability | Must | Concurrent posts from the same author resolve to a single `Author` row |
| NFR-004 | The model must be extensible to future connector-specific author shapes | Maintainability | Should | New connectors can adopt the organization-as-Author pattern without schema changes |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Author-level facts (follower count, display name, profile location) are stored once and updated in place, instead of being duplicated and potentially going stale across thousands of posts from the same account.
- `firstSeenAt`/`lastSeenAt` and the upsert-on-arrival pattern give a natural way to track account activity over time, which the expert-finder query and `AuthorTopicSignal` (ADR-0007) build on directly.
- Keeps `SocialPost` focused on per-event data (engagement metrics, per-post geo, enrichment), matching the spec's explicit note that `postGeoLocation` is "per-event, not per-author" while `profileLocation` lives on `Author`.

**Negative**
- Every post write now involves an author upsert (or a lookup against an already-upserted author within the same ingestion run), adding a write path that a fully denormalized post table wouldn't need.
- Author facts like `followerCount` reflect whatever was true at last-seen time, not at each individual post's `publishedAt` — historical accuracy of "follower count at time of post" is not preserved.

## 12. Assumptions and Dependencies
- Every connector supplies a stable, platform-native identifier for the content-producing entity.
- Author data is tenant-scoped and subject to row-level security.
- Author facts such as `followerCount` are expected to change over time and are acceptable as most-recent values for most use cases.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Author upsert adds write overhead to every post ingest | Medium | Medium | Batch or pipeline author lookups; monitor ingestion latency | Data Engineer |
| R-002 | `Author.followerCount` becomes stale or historically misleading | Medium | High | Keep `Author.followerCount` as "most recent"; use `SocialPost.authorFollowerCountAtPublish` for point-in-time analysis where supplied | Product Owner |
| R-003 | Joins between `SocialPost` and `Author` introduce query latency | Medium | Medium | Index `(tenantId, platformId, externalAuthorId)` and `SocialPost.authorId`; measure query plans | Data Engineer |
| R-004 | Different connectors use different author identifier shapes | Medium | Medium | Document connector-specific mapping in each connector's SKILL.md and ADR; enforce `externalAuthorId` normalization at the connector boundary | Data Engineer |

---

## 14. Appendix
- ADR: `../../adr/0004-author-normalized-separately-from-post.md`
- BRD: `../Business-Requirements/BRD-0004-Author-Normalized-Separately-From-Post.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: _No deep-research report found._
- User stories: see extracted stories above