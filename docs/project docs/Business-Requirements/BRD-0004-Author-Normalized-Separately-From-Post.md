# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Author Normalized Separately from Post – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Devin (AI assistant) on behalf of product research session |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Draft / Pending review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Devin | Initial draft from ADR-0004, Story 3.1, and Story 3.9 |

---

## 2. Executive Summary

Every ingested social post belongs to an author, and the same author can publish many posts inside a watchlist's matching window. Without a normalized author model, the platform would duplicate handle, display name, follower count, and profile location across every post from the same account, making the data hard to keep fresh and expensive to query at scale.

This BRD defines the business need to model `Author` as a first-class entity, distinct from `SocialPost`, keyed by tenant, platform, and the platform's own external author identifier. `SocialPost` will reference `Author` via a foreign key (`authorId`) rather than embedding author fields. This enables author-level analytics such as the "expert finder" query (`GET /topics/:topic/authors`) and the `AuthorTopicSignal` capability, while keeping per-post data focused on per-event facts like engagement and geo-location.

The expected business value is a smaller, cleaner storage model, more accurate author-level reporting, and a stable anchor for influencer discovery and trend analysis.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate author-field duplication across posts | One `Author` row per `(tenantId, platformId, externalAuthorId)` regardless of post volume |
| 2 | Enable accurate author-level analytics and expert discovery | `GET /topics/:topic/authors` and `AuthorTopicSignal` can query current and historical author facts without scanning every post |
| 3 | Keep per-post and per-author location data correctly separated | `postGeoLocation` is stored on `SocialPost`; `profileLocation` is stored on `Author` |
| 4 | Support future point-in-time reach analysis | `SocialPost` can optionally capture `authorFollowerCountAtPublish` without breaking the normalized `Author` model |
| 5 | Reduce the cost and risk of profile updates | Updating an author's display name or follower count updates one row, not historical posts |

---

## 4. Scope

### 4.1 In Scope

- Create and maintain a normalized `Author` entity keyed by `(tenantId, platformId, externalAuthorId)`.
- Upsert `Author` rows as new posts are ingested and track `firstSeenAt` and `lastSeenAt`.
- Store `SocialPost.authorId` as a foreign key to `Author`; do not embed author fields on `SocialPost`.
- Store per-account `profileLocation` on `Author` and per-event `postGeoLocation` on `SocialPost`.
- Store a raw profile payload on `Author` for traceability and future enrichment.
- Apply the organization-as-Author pattern for connectors whose content producer is an organization, publication, or verified domain rather than an individual (Newswire, GNews, tenant-owned-domain feeds).
- Preserve a point-in-time `authorFollowerCountAtPublish` on `SocialPost` for connectors that can provide it at ingest, as a scoped exception to the normalized model.

### 4.2 Out of Scope

- Real-time author profile synchronization outside the normal ingestion flow.
- Embedding full author profile fields on each `SocialPost`.
- Building a full social graph or relationship map between authors.
- Historical backfill of author rows for posts ingested before this capability ships.
- Author identity verification beyond the platform's own `externalAuthorId`.

### 4.3 Assumptions

- Every connector supplies a stable, platform-native identifier for the content-producing entity.
- Author data is tenant-scoped and subject to row-level security.
- Author facts such as `followerCount` are expected to change over time and are acceptable as most-recent values for most use cases.

### 4.4 Constraints

- Must not change the public `GET /posts` or `GET /topics/:topic/authors` response shapes beyond the scoped `authorFollowerCountAtPublish` addition.
- Must respect multi-tenant isolation for both `Author` and `SocialPost`.
- Ingestion must remain performant despite the additional author upsert on every post.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Data Engineer | Implements and operates the ingestion pipeline | High | A clear, deduplicated data model that is easy to query and maintain |
| Tenant Business Analyst | Uses author and influencer analytics | High | Accurate author-level facts and stable identity over time |
| Platform Operator | Manages storage, cost, and data quality | Medium | Reduced duplication, predictable storage growth, clean archival boundaries |
| API Consumer | Builds on the posts and topics API | Medium | Stable response shapes and reliable author identifiers |
| Author-of-a-Post (Data Subject) | Subject of stored profile data | Medium | Profile data is stored accurately and only as needed |

---

## 6. Current State (As-Is)

**Current process:** When a post is ingested, the author's handle, display name, follower count, and profile location are either embedded in the post record or derived inline at query time. Each post from the same account repeats the same author fields.

**Pain points:**
- Author fields are duplicated across every post from the same account, increasing storage and query cost.
- Profile updates require a backfill across all historical posts or are simply ignored, leading to stale data.
- There is no clean anchor for author-level aggregates such as total activity, follower history, or influence signals.
- `profileLocation` and `postGeoLocation` are not clearly separated, risking incorrect analytics.

---

## 7. Future State (To-Be)

**New or improved process:** On every ingest, the system resolves or creates an `Author` row for the content producer, updates `lastSeenAt`, and links the new `SocialPost` via `authorId`. Per-account facts live on `Author`; per-event facts live on `SocialPost`. Connectors whose author is an organization, publication, or verified domain follow the same pattern with `followerCount` unpopulated. For connectors that report it, the author's follower count at the moment of the post is captured once on `SocialPost` as `authorFollowerCountAtPublish`.

**Expected capabilities:**
- Query and update an author's profile in one place.
- Build author-level analytics such as unique active authors, activity windows, and influence signals.
- Keep per-post and per-author geo data cleanly separated.
- Support historical reach analysis via an optional point-in-time follower count on the post.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Author upsert on ingest must not add more than a bounded, measurable overhead to the ingestion pipeline | Performance | Should | Ingestion contract tests continue to meet their latency thresholds |
| NFR-002 | `Author` and `SocialPost` data must be isolated by tenant | Security | Must | RLS policies prevent cross-tenant reads and writes on both tables |
| NFR-003 | The normalized author model must remain consistent under concurrent ingestion runs | Reliability | Must | Concurrent posts from the same author resolve to a single `Author` row |
| NFR-004 | The model must be extensible to future connector-specific author shapes | Maintainability | Should | New connectors can adopt the organization-as-Author pattern without schema changes |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Unique active authors by platform | Measure publisher diversity and bot-like concentration | Tenant Business Analyst | Daily / On-demand |
| Author activity timeline (`firstSeenAt` / `lastSeenAt`) | Identify emerging and re-activated authors | Tenant Business Analyst | Daily / On-demand |
| Follower count distribution | Segment authors by audience size for influencer analysis | Tenant Business Analyst | Weekly / On-demand |
| New authors per watchlist | Track audience growth around monitored topics | Tenant Business Analyst | Daily |
| Ingestion author upsert volume | Operational insight into write-path overhead | Platform Operator | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Author upsert adds write overhead to every post ingest | Medium | Medium | Batch or pipeline author lookups; monitor ingestion latency | Data Engineer |
| R-002 | `Author.followerCount` becomes stale or historically misleading | Medium | High | Keep `Author.followerCount` as "most recent"; use `SocialPost.authorFollowerCountAtPublish` for point-in-time analysis where supplied | Product Owner |
| R-003 | Joins between `SocialPost` and `Author` introduce query latency | Medium | Medium | Index `(tenantId, platformId, externalAuthorId)` and `SocialPost.authorId`; measure query plans | Data Engineer |
| R-004 | Different connectors use different author identifier shapes | Medium | Medium | Document connector-specific mapping in each connector's SKILL.md and ADR; enforce `externalAuthorId` normalization at the connector boundary | Data Engineer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Story 3.1 — Normalized author entity | Internal | Menno | Shipped / Ready |
| D-002 | Story 3.9 — Point-in-time author follower count on `SocialPost` | Internal | Menno | Shipped 2026-08-12 |
| D-003 | ADR-0024, ADR-0026, ADR-0050 — organization-as-Author exceptions | Internal | Menno | Accepted |
| D-004 | ADR-0049 — point-in-time follower count field | Internal | Menno | Accepted 2026-08-11 |
| D-005 | ADR-0042 — Wikipedia article-as-Author exception | Internal | Menno | Accepted 2026-08-08 |
| D-006 | Design Spec §4.1 "Author" | Reference | Product Owner | Not present as a separate file in the repository; source cited by ADR-0004 |

---

## 14. Acceptance Criteria

- Ingesting two posts from the same external author within a tenant results in exactly one `Author` row, with `lastSeenAt` updated on the second ingest.
- `SocialPost` has no embedded author display fields — only `authorId`.
- `postGeoLocation` lives on `SocialPost` (per-event); `profileLocation` lives on `Author` (per-account) — verified by schema inspection.
- `SocialPost.authorFollowerCountAtPublish` is populated once at ingest, never derived from or reconciled with `Author.followerCount`, and remains `NULL` for connectors that do not supply it.
- Organization-as-Author connectors (Newswire, GNews, tenant-owned-domain) represent the content producer as `Author` with `followerCount` unpopulated and a stable organization/publication/domain identifier.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `Author` | The normalized entity representing a content-producing account, article, or organization within a tenant and platform. |
| `SocialPost` | A single ingested social post, event, or content item linked to one `Author`. |
| `externalAuthorId` | The platform-native stable identifier for the content producer, supplied by a connector. |
| `profileLocation` | A per-account location declared by the content producer; stored on `Author`. |
| `postGeoLocation` | A per-event geo location attached to a specific post; stored on `SocialPost`. |
| `firstSeenAt` / `lastSeenAt` | Timestamps tracking the first and most recent observed ingestion of an `Author`. |
| `authorFollowerCountAtPublish` | The author's follower count as reported at the moment a specific post was ingested; a point-in-time snapshot on `SocialPost`. |
| Organization-as-Author | The pattern where `Author` represents an organization, publication, or verified domain rather than an individual platform account. |

---

## 16. Appendices

### Reference Documents

- `docs/adr/0004-author-normalized-separately-from-post.md` — Source ADR.
- `docs/user-stories/epic-3-data-model-storage-and-archival.md` — Story 3.1 (normalized author entity) and Story 3.9 (point-in-time follower count).
- `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md` — Point-in-time follower count exception.
- `docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md` — Tenant-owned-domain connector and organization-as-Author generalization.
- `docs/adr/0024-newswire-rss-press-release-organization-as-author.md` — Newswire organization-as-Author exception.
- `docs/adr/0026-gnews-rss-source-publication-as-author.md` — GNews source-publication-as-Author exception.
- `docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md` — Wikipedia article-as-Author exception.
- `docs/adr/0007-author-topic-signals.md` — Author-level signal capability that builds on this model.

### Missing Source Note

The ADR-0004 source is cited as "Design Spec §4.1 'Author'". A separate file matching that design spec section was not found in the repository; this BRD was produced from the ADR text and related user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
