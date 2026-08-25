# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0004 Author Normalized Separately from Post — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0004 is Accepted; carries several accepted supersession/generalization notes — ADR-0024, ADR-0026, ADR-0042, ADR-0049, ADR-0050 — all folded in below) |
| Related Documents | ADR-0004, ADR-0007, ADR-0024, ADR-0026, ADR-0042, ADR-0049, ADR-0050, BRD-0004, Story 3.1, Story 3.9 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0004 (normalize `Author` once per platform account, not embedded per post) — together with its accepted amendments — into a functional design for how SocialEngage models the entity that produced a post, distinct from the post itself.

### 2.2 Scope

- **In scope:** the `Author` entity and its upsert-on-ingest lifecycle; `SocialPost.authorId` as the sole link between a post and its author; the individual-account default model; the organization-as-Author generalized pattern (Newswire, GNews, tenant-owned-domain feeds); the article-as-Author pattern (Wikipedia, structurally distinct, documented as its own case); the point-in-time `authorFollowerCountAtPublish` field on `SocialPost`.
- **Out of scope:** real-time author profile synchronization outside normal ingestion; embedding full author fields on `SocialPost`; a full social graph/relationship map between authors; historical backfill of author rows for pre-existing posts; author identity verification beyond the platform's own `externalAuthorId`; `AuthorTopicSignal` itself (ADR-0007/FDD-0007, which builds on this model but is designed separately).

### 2.3 Target Audience

Data/backend engineers implementing connectors and the ingestion pipeline; engineers building author-level analytics (expert finder, influencer discovery); the technical lead reviewing new connectors for which author pattern applies.

---

## 3. Context and Background

- **Problem/opportunity:** every ingested `SocialPost` has an author, and the same author posts repeatedly within a watchlist's matching window. The system also needs an "expert finder" query (`GET /topics/:topic/authors`) that reasons about an author's behavior over time (activity, follower count, mention history), not about any single post. Embedding author fields on every post would duplicate data, go stale, and give no clean anchor for author-level aggregates.
- **Business/user value:** author-level facts stored once and updated in place; a stable anchor for expert-finder queries and `AuthorTopicSignal`; `SocialPost` stays focused on per-event data (engagement, per-post geo, enrichment).
- **Source requirements:** ADR-0004 (and its accepted amendments ADR-0024, ADR-0026, ADR-0042, ADR-0049, ADR-0050); BRD-0004 (BR-001–BR-007, BRU-001–BRU-007); Story 3.1 (built `social-listening-core@34264e6`), Story 3.9 (built `social-listening-core@34e9dfb`).
- **Constraints/dependencies:** every post write now involves an author upsert or lookup, adding a write path a fully denormalized table wouldn't need; `Author.followerCount` reflects last-seen time, not each post's `publishedAt` — this specific gap is narrowly closed (not eliminated) by ADR-0049's `authorFollowerCountAtPublish`; connectors must supply a stable platform-native identifier for the content-producing entity.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Eliminate author-field duplication across posts | Exactly one `Author` row per `(tenantId, platformId, externalAuthorId)` regardless of post volume |
| G2 | Enable accurate author-level analytics and expert discovery | `GET /topics/:topic/authors` and `AuthorTopicSignal` query current/historical author facts without scanning every post |
| G3 | Keep per-post and per-author location data correctly separated | `postGeoLocation` on `SocialPost`; `profileLocation` on `Author` |
| G4 | Support point-in-time reach analysis without breaking the normalized model | `SocialPost.authorFollowerCountAtPublish` captured once at ingest, never reconciled with `Author.followerCount` |
| G5 | Generalize cleanly to non-individual content producers | Organization-as-Author (Newswire, GNews, tenant-owned-domain) and article-as-Author (Wikipedia) both reuse the same `Author` entity shape without a schema fork |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `Author` upsert on ingest

- **Description:** as each post is ingested, the system resolves (or creates) exactly one `Author` row for the content-producing entity, keyed by `(tenantId, platformId, externalAuthorId)`.
- **Triggers:** every post normalized by a connector during ingestion.
- **Inputs:** the connector's normalized author fields — `externalAuthorId`, handle, display name, follower count (individual-account connectors), profile location, verified status, raw profile payload.
- **Processing:** look up `Author` by `(tenantId, platformId, externalAuthorId)`; if absent, insert a new row with `firstSeenAt` set to now; if present, update in place — `lastSeenAt` refreshed to now, mutable profile fields (display name, follower count, profile location, verified status, raw profile) overwritten with the latest values; `firstSeenAt` is never updated after creation.
- **Outputs:** a resolved `authorId` used to link the new `SocialPost`.
- **Error handling:** a connector that fails to supply a stable `externalAuthorId` cannot upsert correctly — this is a connector-boundary defect, not a runtime condition the upsert logic works around.
- **Edge cases:** two posts from the same author arriving within the same ingestion run — both resolve to the same `Author` row, with `lastSeenAt` reflecting the later of the two; concurrent ingestion runs touching the same author must still converge on one row (NFR-003).

### 5.2 Feature / Capability: `SocialPost.authorId` as the sole author link

- **Description:** `SocialPost` never embeds author display fields — it carries only a foreign key, `authorId`, into `Author`.
- **Triggers:** every post write.
- **Inputs:** the `authorId` resolved by 5.1.
- **Processing:** `SocialPost` stores `authorId` and its own per-event fields (engagement metrics, `postGeoLocation`, enrichment, and, where supplied, `authorFollowerCountAtPublish`); it stores no `handle`, `displayName`, `profileLocation`, or `verifiedStatus`.
- **Outputs:** a post record that reads author details by joining to `Author` via `authorId`.
- **Error handling:** a `SocialPost` with a `handle`/`displayName`/`profileLocation`/`verifiedStatus` column populated is a schema violation of this decision — schema inspection (per BR-003's acceptance criterion) is the enforcement mechanism.
- **Edge cases:** none beyond the standard foreign-key-integrity case (an `authorId` must reference an existing `Author` row, created in the same upsert step that produced it).

### 5.3 Feature / Capability: Per-account vs. per-event location separation

- **Description:** `profileLocation` (the author's self-declared location) lives on `Author`; `postGeoLocation` (location tied to one specific post) lives on `SocialPost`.
- **Triggers:** normalization of a post's location-bearing fields during ingestion.
- **Inputs:** connector-supplied profile location (per account) and post-level geo data (per event), where the platform provides either.
- **Processing:** profile-level location is written to `Author.profileLocation` during the upsert in 5.1; post-level geo is written to `SocialPost.postGeoLocation` during the post write in 5.2. The two are never conflated.
- **Outputs:** analytics and queries can distinguish "where this author says they're based" from "where this specific post was geo-tagged."
- **Error handling:** a platform response that only supplies one kind of location (common) simply leaves the other field unset — not an error.
- **Edge cases:** an author whose profile location changes over time — `Author.profileLocation` reflects the latest value only (same "most-recent" semantics as `followerCount`); historical profile-location-at-post-time is not preserved (no equivalent of `authorFollowerCountAtPublish` exists for location).

### 5.4 Feature / Capability: Organization-as-Author pattern (generalized clause)

- **Description:** for connectors whose real-world content producer is an organization, publication, or verified domain rather than an individual person, `Author` represents that organization/publication/domain instead of a person, using the same entity shape.
- **Triggers:** ingestion by a connector matching this pattern — currently Newswire (ADR-0024), GNews/RSS-News (ADR-0026), and the tenant-owned-domain feed connector (ADR-0050).
- **Inputs:** the connector's own stable identifier for the issuing organization/publication/domain (e.g., a wire-service issuer identifier, GNews's `source.id`/`source.name`, a DNS-verified domain), mapped into `externalAuthorId`.
- **Processing:** the same upsert logic as 5.1 applies, keyed the same way, with one deliberate difference: `followerCount` is left unpopulated, since it is not a meaningful attribute for a non-individual entity. `handle`/`displayName` represent the organization's name/identifier rather than a personal handle.
- **Outputs:** one `Author` row per organization/publication/domain, reused across every article/release/post that organization produces — established as the *expected pattern* for this shape of connector (per ADR-0004's 2026-08-11 "Organization-as-Author clause"), not a one-off exception each new connector must re-justify.
- **Error handling:** a connector of this shape that instead tries to fabricate a per-post "author" (e.g., a byline) would be departing from this pattern — not sanctioned unless a future ADR names a fourth, different case.
- **Edge cases:** a wire service or publication that changes its own issuer identifier over time — would surface as a *new* `Author` row (since `externalAuthorId` changed), a known limitation shared with the individual-account default, not unique to this pattern.

### 5.5 Feature / Capability: Article-as-Author pattern (Wikipedia, structurally distinct)

- **Description:** for the Wikipedia connector (ADR-0042), `Author` represents the specific Wikipedia article being tracked, keyed by the article's stable `pageid`, reused across every `SocialPost` produced by re-polling that article's revision history over time.
- **Triggers:** ingestion by the Wikipedia connector.
- **Inputs:** the article's `pageid` and revision metadata.
- **Processing:** same upsert mechanics as 5.1, keyed on the article's `pageid` as `externalAuthorId`; `followerCount` unpopulated (not meaningful for an article).
- **Outputs:** one `Author` row per tracked article, reused across every revision-derived `SocialPost`.
- **Error handling/rationale:** this pattern is deliberately *not* folded into the organization-as-Author generalized clause (5.4) — ADR-0004's own accepted notes are explicit that an article's persistent document-identity (many posts = many revisions of the *same* work) is structurally different from an organization's persistent real-world identity (many posts = many genuinely distinct works). Treating the two as identical would misstate what the entity actually represents.
- **Edge cases:** an article that is renamed/merged on Wikipedia (its `pageid` typically persists through renames) — as long as `pageid` is stable, the same `Author` row continues to be reused; a genuine `pageid` change would, as with 5.4, surface as a new `Author` row.

### 5.6 Feature / Capability: Point-in-time follower count on `SocialPost`

- **Description:** for connectors that supply it at ingest time, `SocialPost` carries a nullable `authorFollowerCountAtPublish` — the author's follower count exactly as reported when that specific post was fetched and normalized — kept structurally separate from `Author.followerCount`'s own always-most-recent semantics.
- **Triggers:** ingestion of a post from a connector whose platform response includes a follower count at fetch time.
- **Inputs:** the connector-reported follower count at the moment of that specific post's ingest.
- **Processing:** written once, directly to `SocialPost.authorFollowerCountAtPublish`, during the same write as 5.2; never derived from, backfilled from, or reconciled against `Author.followerCount` afterward.
- **Outputs:** a reach-analysis-capable per-post snapshot that survives even as `Author.followerCount` continues to update to the latest value.
- **Error handling:** a connector that cannot supply this value at ingest simply leaves the field `NULL` — not an error condition; this is expected for organization-as-Author and article-as-Author connectors (5.4/5.5), where follower count isn't meaningful at all.
- **Edge cases:** a connector that *can* supply follower count for individual-account authors but happens not to report it for one specific post (e.g., a rate-limited profile lookup) — the field is simply `NULL` for that post, not an ingestion failure.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Data/Backend Engineer | Implements connectors that produce normalized author data; maintains the ingestion pipeline's upsert logic |
| Connector (system actor) | Supplies `externalAuthorId` and profile fields per its own platform's shape (individual, organization, or article) |
| Tenant Business Analyst | Consumes author-level analytics (expert finder, influencer discovery, activity timelines) built on this model |
| Ingestion Pipeline (system actor) | Performs the `Author` upsert and links each `SocialPost.authorId` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 3.1) | data engineer | have authors normalized into their own `Author` entity, upserted by `(tenantId, platformId, externalAuthorId)`, with `SocialPost` referencing it via `authorId` | author-level facts (handle, display name, follower count, profile location) are stored once and updated in place instead of duplicated across every post from the same account | (1) two posts from the same external author within a tenant produce exactly one `Author` row, `lastSeenAt` updated; (2) `SocialPost` has no embedded author display fields; (3) `postGeoLocation` on `SocialPost`, `profileLocation` on `Author` |
| US2 (Story 3.9) | data engineer supporting reach/influencer analysis on historical posts | have `SocialPost` carry the author's follower count as reported at the moment that specific post was ingested, kept separate from `Author`'s own current follower count | a reach-analysis query against a months-old post reflects what the author's audience actually was at publish time, not what it is today | `SocialPost` gains one nullable `authorFollowerCountAtPublish` field only; no other author field is added to `SocialPost` |

### 6.3 Workflow Diagrams / Steps

**Workflow: Ingesting a post and resolving its author**

1. Connector fetches raw platform data and normalizes it, producing both a candidate `Author` payload (`externalAuthorId`, handle/name, follower count where applicable, profile location, verified status, raw profile) and the post's own fields.
2. Ingestion pipeline looks up `Author` by `(tenantId, platformId, externalAuthorId)`.
3. If no row exists: insert a new `Author` row, `firstSeenAt = lastSeenAt = now`.
4. If a row exists: update mutable fields (display name, follower count, profile location, verified status, raw profile) and set `lastSeenAt = now`; `firstSeenAt` is untouched.
5. Pipeline writes the `SocialPost` row with `authorId` set to the resolved `Author`, plus per-event fields (`postGeoLocation`, engagement, enrichment, and `authorFollowerCountAtPublish` if the connector supplied one at this moment).
6. Downstream capabilities (expert finder, `AuthorTopicSignal`) read `Author` and `SocialPost` via the `authorId` join, never from duplicated per-post author fields.

**Workflow: Selecting which author pattern a new connector uses**

1. Engineer determines whether the connector's content producer is (a) an individual platform account, (b) an organization/publication/verified domain, or (c) a persistent non-individual document identity structurally like Wikipedia's.
2. Case (a): use the default individual-account model (5.1–5.3) directly.
3. Case (b): cite the organization-as-Author generalized clause (5.4) directly — no new ADR required purely to justify the pattern choice itself.
4. Case (c): treat as its own, separately-justified case (5.5) — do not assume it automatically qualifies under (b) without deliberate review, per ADR-0004's own recorded reasoning.

---

## 7. Data Requirements

### 7.1 Data Inputs

Connector-normalized author fields (`externalAuthorId`, handle, display name, follower count where applicable, profile location, verified status, raw profile payload); connector-normalized post fields (engagement, `postGeoLocation`, enrichment, optional `authorFollowerCountAtPublish`).

### 7.2 Data Outputs

`Author` rows (one per `(tenantId, platformId, externalAuthorId)`); `SocialPost` rows referencing `Author` via `authorId`; author-level analytics (expert finder query results, `AuthorTopicSignal` inputs) derived by joining the two.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `Author` | `tenantId`, `platformId`, `externalAuthorId` (composite unique key); `handle`, `displayName`, `followerCount` (nullable for organization/article patterns), `profileLocation`, `verifiedStatus`, `rawProfile`; `firstSeenAt` (immutable after creation), `lastSeenAt` (updated on each new post) | One `Author` has many `SocialPost` rows via `authorId` |
| `SocialPost` | `authorId` (FK to `Author`), per-event fields: engagement metrics, `postGeoLocation`, enrichment results, `authorFollowerCountAtPublish` (nullable, write-once at ingest) | Many `SocialPost` rows reference one `Author` |
| Organization-as-Author instance | same `Author` shape, `followerCount` left `NULL`, `externalAuthorId` mapped to an issuer/source/domain identifier | Applies to Newswire (ADR-0024), GNews (ADR-0026), tenant-owned-domain (ADR-0050) connectors |
| Article-as-Author instance | same `Author` shape, `externalAuthorId` mapped to a Wikipedia `pageid`, `followerCount` left `NULL` | Applies to the Wikipedia connector (ADR-0042); structurally distinct from organization-as-Author, documented separately |

### 7.4 Validation Rules

- `Author` is uniquely identified within a tenant by `(tenantId, platformId, externalAuthorId)` — no two rows share that composite key (BRU-001/BRU-002).
- `SocialPost` stores only `authorId`; it never stores `handle`, `displayName`, `profileLocation`, or `verifiedStatus` directly (BRU-003).
- `Author.followerCount` always reflects the most recently ingested value, updated in place (BRU-004); it is left unpopulated for organization-as-Author and article-as-Author connectors (BRU-006).
- `SocialPost.authorFollowerCountAtPublish`, when populated, is written once at ingest and never updated or reconciled with `Author.followerCount` (BRU-005).
- `postGeoLocation` is per-event, stored on `SocialPost`; `profileLocation` is per-account, stored on `Author` (BRU-007).
- `Author` and `SocialPost` are both subject to tenant-scoped RLS (NFR-002).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | An `Author` is uniquely identified within a tenant by `(tenantId, platformId, externalAuthorId)`. | `Author` |
| BR2 | `SocialPost` stores only `authorId`; it does not embed `handle`, `displayName`, `profileLocation`, or `verifiedStatus`. | `SocialPost` |
| BR3 | `Author.followerCount` always reflects the most recently ingested value and is updated in place. | `Author` (individual-account connectors) |
| BR4 | `SocialPost.authorFollowerCountAtPublish`, when populated, is written once at ingest and never updated or reconciled with `Author.followerCount`. | `SocialPost` |
| BR5 | Connectors whose author is an organization, publication, or verified domain leave `Author.followerCount` unpopulated; this is the expected pattern, not a one-off exception, for that connector shape. | Organization-as-Author connectors |
| BR6 | A structurally distinct persistent-document-identity case (e.g., an article) is not assumed to fall under the organization-as-Author clause without deliberate review. | Article-as-Author connectors (Wikipedia) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `SocialConnector.normalize()` (ADR-0002) | Inbound to this model | Supplies the raw fields the `Author` upsert and `SocialPost` write consume | In-process |
| `GET /topics/:topic/authors` (expert finder) | Outbound consumer | Reads `Author` (and joined `SocialPost`) for author-level analytics | REST / JSON |
| `AuthorTopicSignal` (ADR-0007) | Outbound consumer | Builds author-level topic signal aggregates on top of this model | In-process / REST |
| Postgres (ADR-0016) with RLS (ADR-0015) | Storage | Persists `Author` and `SocialPost`, tenant-isolated | Postgres wire protocol |

---

## 10. Non-Functional Considerations

- **Performance:** author upsert must not add more than a bounded, measurable overhead to ingestion latency (NFR-001); index `(tenantId, platformId, externalAuthorId)` and `SocialPost.authorId` to keep joins/lookups cheap.
- **Security/access control:** both `Author` and `SocialPost` are tenant-isolated via RLS (NFR-002); no cross-tenant read/write path exists.
- **Scalability:** the normalized model avoids per-post duplication of author fields, keeping storage growth proportional to unique authors plus posts, not authors × posts.
- **Reliability/availability:** the model must remain consistent under concurrent ingestion runs — concurrent posts from the same author resolve to a single `Author` row (NFR-003).
- **Audit and logging:** `rawProfile` is retained on `Author` for traceability; `firstSeenAt`/`lastSeenAt` give a natural activity-history anchor.
- **Extensibility:** the model must accommodate new connector-specific author shapes (organization, article) without a schema change — proven by three organization-as-Author instances and one structurally distinct article-as-Author instance sharing the same entity shape (NFR-004).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Connector fails to supply a stable `externalAuthorId` | N/A (connector-boundary defect) | Author cannot be reliably upserted; treated as a connector defect to fix, not a runtime fallback |
| `SocialPost` written with an embedded author display field | N/A (caught by schema inspection / review) | Schema violation of BR2; not a sanctioned code path |
| Connector cannot supply `authorFollowerCountAtPublish` for a post | N/A | Field left `NULL`; not an ingestion failure |
| Organization-as-Author or article-as-Author connector attempts to populate `followerCount` | N/A | Not meaningful for that entity shape; left unpopulated per BR5 |
| A structurally ambiguous new connector shape (neither individual, organization, nor article) | N/A | Requires deliberate review/new ADR rather than defaulting to an existing pattern by assumption |

---

## 12. Assumptions and Dependencies

- Every connector supplies a stable, platform-native identifier for the content-producing entity, mapped into `externalAuthorId`.
- Author data is tenant-scoped and subject to RLS.
- `Author.followerCount` and similar "most-recent" fields are acceptable as current-value-only for most use cases; point-in-time accuracy is addressed narrowly, only where `authorFollowerCountAtPublish` is populated.
- Dependency: ADR-0002 (`SocialConnector.normalize()`) is the source of the fields this model consumes.
- Dependency: ADR-0007 (`AuthorTopicSignal`) builds directly on this normalized model.
- Dependency: ADR-0024/ADR-0026/ADR-0050 established and then generalized the organization-as-Author pattern; ADR-0042 established the structurally distinct article-as-Author pattern; ADR-0049 added the point-in-time follower-count field.
- Dependency: ADR-0015/ADR-0016 (RLS, Postgres) provide the storage/isolation foundation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a future fourth connector needing a non-individual `Author` shape default to the organization-as-Author clause, or does every new shape require its own deliberate review (as ADR-0042 required)? | Technical Lead | Decide per-connector at proposal time, consistent with ADR-0004's own established practice |
| Q2 | Is a point-in-time equivalent of `profileLocation` (i.e., `postGeoLocation`-adjacent for profile location) ever needed, mirroring `authorFollowerCountAtPublish`? | Product Owner | Not currently planned; revisit if a concrete use case emerges |

---

## 14. Appendix

- **Glossary:** see BRD-0004 §15 (`Author`, `SocialPost`, `externalAuthorId`, `profileLocation`, `postGeoLocation`, `firstSeenAt`/`lastSeenAt`, `authorFollowerCountAtPublish`, Organization-as-Author).
- **Reference links:** `docs/adr/0004-author-normalized-separately-from-post.md`; `docs/project docs/Business-Requirements/BRD-0004-Author-Normalized-Separately-From-Post.md`; `docs/user-stories/epic-3-data-model-storage-and-archival.md` (Story 3.1, Story 3.9); `docs/adr/0007-author-topic-signal-minimal-v1.md`; `docs/adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md`; `docs/adr/0026-rss-news-connector-gnews-api-publication-as-author.md`; `docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md`; `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md`; `docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md`.
- **Feature design/deep research:** none found for this data-model ADR — BRD-0004's own "Missing Source Note" confirms no separate design-spec §4.1 file exists in the repository beyond the ADR's own citation.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0004 (with its accepted amendments) and BRD-0004/Story 3.1/Story 3.9 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
