# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0049 Point-in-Time Author Follower Count on `SocialPost` — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved (ADR-0049 Accepted 2026-08-11; built via Story 3.9, 2026-08-12) |
| Related Documents | ADR-0049, BRD-0049, ADR-0004, ADR-0021, ADR-0007, ADR-0018, Story 3.9, Feature Design 05 (Influencer Discovery) |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0049's architecture decision and BRD-0049's business requirements into the functional design of a single, scoped exception to ADR-0004's normalized `Author` model: a point-in-time, immutable `author_follower_count_at_publish` field on `SocialPost`, capturing the author's follower count as reported by the connector at the moment that specific post was ingested. Story 3.9 (built 2026-08-12) implements this; this FDD documents the shipped functional behavior for traceability and future maintenance.

### 2.2 Scope

- **In scope:** the new nullable `author_follower_count_at_publish` column on `SocialPost`; its one-time-write, never-updated-after-ingest behavior; its independence from `Author.followerCount`'s ongoing upsert; the connector-level `canProvideFollowerCountAtPublish` capability declaration; the three-way `NULL` semantics; explicit non-backfill of pre-existing rows.
- **Out of scope:** any other per-post author profile field (`handle`, `displayName`, `profileLocation`, `verifiedStatus` remain fully normalized on `Author`, never embedded per post); retroactive backfill of historical rows; any mandated `GET /posts` or `GET /topics/:topic/authors` API response-shape change; adding `sortBy=followerCountAtPublish` to the expert-finder endpoint; a separate `AuthorSnapshot` entity; storing the value only in `rawPayload`.

### 2.3 Target Audience

Backend engineers building individual-account social connectors (Reddit, X, LinkedIn, and similar future connectors) that will populate this field; data engineers maintaining the `SocialPost`/`Author` schema; analysts (tenant business analysts, topic-center analysts, social-selling strategists) consuming reach/influencer analytics; QA maintaining contract tests for immutability and `NULL` semantics.

---

## 3. Context and Background

ADR-0004 normalizes `Author` as its own entity, upserted so `Author.followerCount` is always the most-recently-seen value — a deliberate trade-off ADR-0004 itself named: "historical accuracy of 'follower count at time of post' is not preserved." This was accepted at ADR-0004's acceptance because no individual-account connector existed yet to make the gap concrete. Reddit (the first planned individual-account connector) makes it concrete: platforms like Reddit, X, and LinkedIn return a follower count with or alongside each post at fetch time, and this value can differ meaningfully from the author's current count for fast-growing or shrinking accounts. Without a point-in-time field, a six-month-old post from an account that grew from 10,000 to 100,000 followers would incorrectly appear as a 100,000-follower post in any reach-analysis query.

Because this changes the data-model decision itself (adding per-post author data, which ADR-0004 argued against), it required a new ADR under this project's governance table, not an Amendment Log entry on ADR-0004. ADR-0049 deliberately scopes the exception to exactly one field — follower count — not a reopening of the "embed author fields per post" alternative ADR-0004 rejected. The connector-capability declaration mechanism (Open Question 5) was resolved during Story 3.9's own build: `SocialConnector.canProvideFollowerCountAtPublish`, a boolean modeled directly on ADR-0021's `supportedQueryFeatures` pattern, proven via an inline local test connector, with Newswire and GNews left completely unmodified — proving a connector that doesn't declare the capability incurs zero code change.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable accurate historical reach analysis | Reach/influencer queries can distinguish follower count at publish time from the current count |
| G2 | Preserve the normalized author model everywhere else | Only one field is added to `SocialPost`; no other author attribute is embedded per post |
| G3 | Guarantee point-in-time integrity | The stored value on any given post never changes after initial ingest |
| G4 | Keep the exception additive and low-risk for connectors that don't need it | Connectors leave the field `NULL` with zero code change required |
| G5 | Make the connector-capability signal explicit and precedented | `canProvideFollowerCountAtPublish` modeled directly on ADR-0021's existing capability-matrix pattern |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Point-in-Time Follower Count Capture at Ingest

- **Description:** Captures the author's follower count as reported by the connector at the exact moment a specific post is fetched and normalized, storing it once on that post's own row.
- **Triggers:** Creation of a new `SocialPost` row during ingestion, for a connector that declares `canProvideFollowerCountAtPublish`.
- **Inputs:** The connector's `normalize()` output for that specific post's author, including whatever follower-count value the platform's API returned alongside the post.
- **Processing:** The reported value is written into `author_follower_count_at_publish` at the same time the `SocialPost` row is created — never as a separate, later write. The value is taken exactly as reported, not derived from or reconciled against `Author.followerCount`.
- **Outputs:** A `SocialPost` row with a populated `author_follower_count_at_publish`, standing as a stable, append-only fact from that point forward.
- **Error handling:** If the connector does not return a follower count for that specific post (even though it generally declares the capability), the field is left `NULL` for that row — not defaulted to zero or any other placeholder.
- **Edge cases:** A connector that does not declare `canProvideFollowerCountAtPublish` at all never attempts to populate this field — it is simply always `NULL` for that connector's posts, with no per-post decision logic needed.

### 5.2 Feature / Capability: Immutability After Initial Write

- **Description:** Guarantees that once set, `author_follower_count_at_publish` on a given `SocialPost` row is never modified again, regardless of what happens to the same author's `Author.followerCount` afterward.
- **Triggers:** Any subsequent ingestion event involving the same author (a new post, an `Author` upsert).
- **Inputs:** N/A — this is an absence-of-write guarantee, not a processing step.
- **Processing:** No code path updates, backfills, or reconciles `author_follower_count_at_publish` on an existing row. `Author.followerCount` upserts proceed exactly as ADR-0004 already designed, entirely independently.
- **Outputs:** A stable, immutable per-post fact that can be relied on in historical queries without concern for it changing under read.
- **Error handling:** N/A — enforced by simply never writing to this column outside the initial insert.
- **Edge cases:** A later post from the same author, with a very different reported follower count, does not alter any earlier post's already-stored value — each post's value is independent and frozen at its own ingest time.

### 5.3 Feature / Capability: Connector Capability Declaration (`canProvideFollowerCountAtPublish`)

- **Description:** Lets a connector explicitly declare whether it can supply a point-in-time follower count at ingest, modeled directly on ADR-0021's `supportedQueryFeatures` capability-matrix pattern.
- **Triggers:** Connector registration/type definition.
- **Inputs:** A boolean flag on the connector's type (`SocialConnector.canProvideFollowerCountAtPublish`).
- **Processing:** A connector that sets this flag `true` is expected to populate the field on posts where the platform provides the value; a connector that does not set it (the default for existing connectors) is never expected to populate it, and unmodified connectors require zero code change.
- **Outputs:** A discoverable, typed signal of which connectors can meaningfully populate this field.
- **Error handling:** N/A — a static capability declaration, not a runtime validation.
- **Edge cases:** Proven end-to-end via an inline local test connector during Story 3.9's build (no real individual-account connector existed yet); Newswire and GNews were left completely unmodified, confirming the additive, zero-burden nature of the capability for connectors that don't need it.

### 5.4 Feature / Capability: `NULL` for Organizational/Publication Author Connectors

- **Description:** Ensures the field remains `NULL` for connectors whose `Author` represents an organization, publication, or article rather than an individual account with a meaningful follower count.
- **Triggers:** Ingestion by Newswire, GNews, Wikipedia, or any similarly organization/publication-as-Author connector.
- **Inputs:** The connector's own `canProvideFollowerCountAtPublish` declaration (unset/false for these connectors).
- **Processing:** These connectors never attempt to populate the field, following the same discipline ADR-0024/ADR-0026 already establish for leaving `Author.followerCount` itself unpopulated for organizational Author entities.
- **Outputs:** `NULL` values for every post from these connectors, with no schema-change burden beyond the nullable column existing.
- **Error handling:** N/A.
- **Edge cases:** None — this is the expected, correct behavior for these connector types, not a gap to be closed.

### 5.5 Feature / Capability: No Retroactive Backfill

- **Description:** Ensures adding this column does not trigger any attempt to populate historical `SocialPost` rows.
- **Triggers:** The migration that adds `author_follower_count_at_publish` to the schema.
- **Inputs:** N/A.
- **Processing:** Existing rows simply receive `NULL` for the new column as part of the migration's default; no backfill job runs.
- **Outputs:** Pre-existing rows carry `NULL`, correctly representing "this post predates the column," distinct from the other two `NULL` cases (§5.6).
- **Error handling:** N/A.
- **Edge cases:** Any future initiative to backfill historical values from platform historical APIs is explicitly named as an open question, not decided or attempted here.

### 5.6 Feature / Capability: Three-Way `NULL` Semantics Documentation

- **Description:** Names and requires documentation of the three semantically distinct meanings `NULL` can carry on this field, so future consumers don't conflate them.
- **Triggers:** Any point where `NULL` is encountered on `author_follower_count_at_publish` by a downstream consumer or query.
- **Inputs:** The three cases: (a) the connector's `Author` type doesn't meaningfully have a follower count (organizational/publication connectors); (b) the connector supports the capability generally but the platform did not return a value for this specific post; (c) the row predates the column's existence (pre-migration row).
- **Processing:** These three cases are documented at implementation time (migration comment and/or `SocialPost` model field-level doc) so a future consumer is aware of which case applies before drawing conclusions from a `NULL`.
- **Outputs:** A documented, disambiguated understanding of `NULL` for any future query or analysis built against this field.
- **Error handling:** N/A — a documentation requirement, not a runtime distinguishing mechanism (the three cases are not distinguished by a separate flag; they are distinguished by external context: connector type, ingest date, platform response).
- **Edge cases:** A consumer that needs to programmatically distinguish these cases (rather than relying on documentation) is not supported by this design — that would require additional schema, not decided here.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Backend Engineer (connector author) | Builds individual-account connectors that declare and populate this field |
| Data Engineer | Maintains the `SocialPost`/`Author` schema and migration |
| Tenant Business Analyst / Topic-Center Analyst | Consumes the field for historical reach/influencer analysis |
| Social-Selling Strategist | Uses influencer discovery features that may draw on this signal in the future |
| Ingestion pipeline | Writes the field at post-creation time; never touches it again |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Story 3.9 | Data engineer / future individual-account connector author | ...capture and permanently preserve the author's follower count at the moment a post was published | ...historical reach analysis reflects the audience size that actually existed at publish time, not the author's current count | New nullable `INTEGER` column added to `SocialPost`; populated once at ingest from connector `normalize()` output; never updated afterward; `NULL` for connectors that don't provide it; existing rows retain `NULL` with no backfill; `canProvideFollowerCountAtPublish` capability flag added and proven via an inline test connector, with Newswire/GNews unmodified |

### 6.3 Workflow Diagrams / Steps

**Workflow: post ingestion with follower-count capture**

1. Connector fetches a post and its author's data from the platform API.
2. If the connector declares `canProvideFollowerCountAtPublish: true` and the platform response includes a follower count for that author: the connector's `normalize()` output carries that value.
3. Ingestion pipeline creates the new `SocialPost` row, writing the reported value into `author_follower_count_at_publish` in the same operation.
4. Independently, `Author` is upserted per ADR-0004's existing logic — `Author.followerCount` is set to the most-recently-seen value, unrelated to what was just written on the post row.
5. The post's `author_follower_count_at_publish` is now frozen; no future ingestion event, for this author or any other, ever modifies it.

**Workflow: connector without the capability**

1. Connector fetches a post; it does not declare `canProvideFollowerCountAtPublish` (the default).
2. Ingestion pipeline creates the `SocialPost` row with `author_follower_count_at_publish = NULL`, with no per-post decision logic invoked.
3. `Author` upsert proceeds unaffected — for organizational/publication connectors, `Author.followerCount` itself also typically stays unpopulated, per the existing ADR-0024/ADR-0026 pattern.

**Workflow: historical analysis query**

1. An analyst queries `SocialPost` for reach analysis over a time window.
2. For each post, the query reads `author_follower_count_at_publish` (the audience size at that post's own publish time) rather than joining to `Author.followerCount` (the author's current audience size).
3. A `NULL` value is interpreted per the documented three-way semantics (organizational connector / platform omitted / pre-migration row) rather than assumed to mean zero or "unknown in a single sense."

---

## 7. Data Requirements

### 7.1 Data Inputs

The connector's `normalize()` output for a specific post's author, including any platform-reported follower count at fetch time.

### 7.2 Data Outputs

A populated or `NULL` `author_follower_count_at_publish` value on each `SocialPost` row; unchanged `Author.followerCount` behavior.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialPost` | New: `author_follower_count_at_publish` (nullable `INTEGER`, immutable after initial write) | Written once at post creation; never updated by any later `Author` upsert |
| `Author` | `followerCount` (unchanged — most-recently-seen, upserted value) | Continues exactly as ADR-0004 designed; complementary to, never reconciled with, the new per-post field |
| `SocialConnector` | New: `canProvideFollowerCountAtPublish` (boolean capability flag, modeled on ADR-0021's `supportedQueryFeatures`) | Determines whether a connector's `normalize()` output is expected to populate the new field |
| `IngestionRun` | Unchanged | The run during which the point-in-time value is captured; not itself modified by this ADR |

### 7.4 Validation Rules

- `author_follower_count_at_publish` must be written only at initial `SocialPost` creation — no code path may `UPDATE` it afterward.
- `author_follower_count_at_publish` must never be derived from, defaulted from, or reconciled against `Author.followerCount`.
- A connector without a real follower-count value for a specific post must leave the field `NULL`, never a placeholder like `0`.
- Pre-existing rows (created before the column existed) retain `NULL`; no migration-triggered backfill is performed.
- Column type is `INTEGER` (nullable) for v1 — a future `BIGINT` migration is named as a real possibility if a platform's follower counts approach or exceed `INTEGER` overflow (e.g., very large Reddit subreddits, YouTube channels).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `author_follower_count_at_publish` is set exactly once, at initial `SocialPost` creation | Ingestion write path |
| BR2 | If the connector does not return a follower count for the post's author, the field is `NULL`, not a default zero | Ingestion write path |
| BR3 | The field may never be updated, backfilled, or reconciled from `Author.followerCount` after initial write | Data integrity |
| BR4 | Only follower count may be stored as a point-in-time author field on `SocialPost`; every other author attribute stays exclusively on the normalized `Author` entity | Schema scope |
| BR5 | `NULL` can represent any of three distinct cases (connector-type-inapplicable, platform-omitted, pre-migration row); these must be documented, not conflated | Consumer interpretation |
| BR6 | Existing rows are never backfilled when the column is added | Migration behavior |
| BR7 | A connector's `canProvideFollowerCountAtPublish` flag determines whether it is expected to populate the field; unset/false connectors require zero code change | Connector capability |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Connector `normalize()` function | Inbound (to ingestion pipeline) | Supplies the point-in-time follower count when available | In-process TypeScript |
| Ingestion pipeline (`SocialPost` creation) | Internal | Writes the field once, at row creation | In-process TypeScript |
| `Author` upsert logic (ADR-0004, unchanged) | Internal | Continues to maintain `Author.followerCount` independently | In-process TypeScript |
| Postgres (`SocialPost` schema) | Internal | Stores the nullable `INTEGER` column | SQL / migration |
| Reach/influencer analytics queries (downstream, future) | Outbound (to analysts) | Reads the point-in-time value for historical analysis | SQL query |
| `GET /topics/:topic/authors` (ADR-0007, unmodified by this ADR) | N/A | Not extended by this ADR; a future ADR/amendment would decide whether to add a `sortBy` option using this field | HTTP/JSON |

---

## 10. Non-Functional Considerations

- **Performance:** One nullable 32-bit integer per row — negligible storage/query overhead; no change to `rawPayload` retention or archival economics (ADR-0018 unaffected).
- **Security / access control:** Follower count is treated as public author metadata; the field remains tenant-scoped under the existing `SocialPost`/`Author` RLS, unchanged by this ADR.
- **Scalability:** `INTEGER` is sufficient for all v1-contemplated platforms; a documented `BIGINT` upgrade path exists if a future platform's follower counts approach overflow.
- **Reliability / availability:** Immutability after initial write makes the field simple to reason about in concurrent/historical read scenarios — it cannot change under read.
- **Audit and logging:** No new audit mechanism introduced; the field's own immutability is itself the integrity guarantee.
- **Accessibility:** N/A.
- **Localization / internationalization:** N/A.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Connector declares the capability but the platform doesn't return a value for a specific post | N/A (internal) | Field left `NULL` for that row, not defaulted to zero |
| Connector doesn't declare the capability at all | N/A | Field is always `NULL` for that connector's posts; zero code change required |
| Attempted write to the field on an existing row (should never happen) | N/A (implementation defect if it occurs) | Violates BR1/BR3; must be treated as a bug, not a supported code path |
| Query conflates the three `NULL` cases | N/A (analysis-quality issue, not a system error) | Consumers must consult the documented semantics (§5.6) before interpreting `NULL` |
| A future platform's follower count exceeds `INTEGER` range | N/A | Requires a schema migration to `BIGINT`; not automatically handled by this design |

---

## 12. Assumptions and Dependencies

- Individual-account social connectors (Reddit, X, LinkedIn, etc.) return the author follower count alongside or near the post payload at fetch time.
- Public author metadata such as follower count is permitted to be stored under relevant platform API terms.
- The additional nullable integer per post is acceptable at v1 data volumes.
- This field is primarily for analytical and operational use, not real-time scoring, until a future ADR or amendment explicitly decides otherwise.
- Depends on: ADR-0004 (normalized `Author` entity, the baseline this ADR scopedly excepts), ADR-0021 (capability-declaration pattern this field's connector flag is modeled on), ADR-0007 (expert-finder endpoint, unmodified, but named as a future consumer candidate), ADR-0018 (retention/archival, unaffected).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `BIGINT` replace `INTEGER` if a future connector's platform can exceed 2.1 billion followers? | Engineering | Named, not decided; a future schema migration if/when it becomes real |
| Q2 | Should `GET /topics/:topic/authors` ever accept `sortBy=followerCountAtPublish` or a derived aggregate for reach-weighted expert ranking? | Product / Architecture | The most consequential downstream open question; deferred to a future ADR or Amendment Log decision, not resolved here |
| Q3 | Should historical backfill of this field from platform historical APIs ever be attempted for pre-existing rows? | Product / Engineering | Explicitly named as open, not assumed "no" — depends on platform API terms, cost, and analytical value |

---

## 14. Appendix

### Glossary

See BRD-0049 Section 15 for the full glossary (`Author`, `SocialPost`, `author_follower_count_at_publish`, `Author.followerCount`, Point-in-time, Connector, `normalize()`, `canProvideFollowerCountAtPublish`, `AuthorTopicSignal`).

### Reference Links

- **ADR-0049:** `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md`
- **BRD-0049:** `docs/project docs/Business-Requirements/BRD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md`
- **Related ADRs:** ADR-0004 (normalized Author model, the baseline exception target), ADR-0021 (capability-declaration pattern), ADR-0007 (expert-finder endpoint, unmodified but a future consumer candidate), ADR-0018 (retention/archival, unaffected)
- **Story:** Story 3.9 (`docs/user-stories/epic-3-data-model-storage-and-archival.md`), built 2026-08-12 (`social-listening-core@34e9dfb`)
- **Related feature design:** `docs/product-research/feature-designs/05-influencer-discovery.md` — future downstream use case that may consume this field

### Missing / Not Applicable Sources

- No dedicated `docs/product-research/reports/<feature>-deep-research.md` file was located for this specific data-model exception; this FDD, like BRD-0049, was synthesized from ADR-0049, Story 3.9, and the influencer-discovery feature design.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0049 and BRD-0049, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
