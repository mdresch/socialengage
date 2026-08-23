# BRD-0049: Point-in-Time Author Follower Count on `SocialPost`

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0049: Point-in-Time Author Follower Count on `SocialPost` |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0049-point-in-time-author-follower-count-on-social-post.md, ../Business-Requirements/BRD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0049-point-in-time-author-follower-count-on-social-post.md and the business requirements in BRD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md into functional design for **Point In Time Author Follower Count On Social Post**.
**What problem are we solving?**  
`Author` is normalized and keyed by `(tenantId, platformId, externalAuthorId)`, and `Author.followerCount` is upserted to the most recently seen value on every new ingestion. Because `SocialPost` only stored `authorId`, any historical reach or influencer analysis against a post from months ago was forced to use the author's *current* follower count. A post published when an account had 10,000 followers but now has 100,000 would incorrectly appear as a 100,000-follower post in time-series analysis.

**Who is affected?**  
Data engineers, tenant business analysts, topic-center analysts, and social-selling strategists who perform reach, influencer, or historical time-series analysis on `SocialPost` data.

**What is the proposed solution at a glance?**  
Add a single, optional, point-in-time field — `author_follower_count_at_publish` — to `SocialPost`. It is populated once at ingest from the connector's reported author follower count for that specific post and is never updated after write. `Author.followerCount` continues to represent the current, most-recently-seen value. The two values are complementary.

**What business value do we expect?**  
Reach and influencer classification queries can now use the audience size that existed at the moment a post was published, making historical comparisons materially more accurate and enabling more credible influencer and crisis-impact analysis.

---

### 2.2 Scope
**In scope:**
- Add one nullable `INTEGER` column, `author_follower_count_at_publish`, to the `SocialPost` storage schema.
- Populate that column once at post-ingest time from the connector's `normalize()` output for that specific post's author.
- Keep the value immutable: no later `Author.followerCount` upsert, reconciliation, or backfill may modify it.
- Leave `Author.followerCount` unchanged as the most-recently-seen current value.
- Add connector-level signaling of the capability to provide a follower count at publish time (e.g., `SocialConnector.canProvideFollowerCountAtPublish`), modeled on the existing `supportedQueryFeatures` pattern.
- Ensure the field remains `NULL` for connectors where the value is not meaningful (e.g., Newswire, GNews, Wikipedia/organization-as-Author connectors).
- Document the `NULL` semantics for the field in the migration and/or model code when implemented.

**Out of scope:**
- Retroactive backfill of `author_follower_count_at_publish` for existing `SocialPost` rows.
- Any mandated change to the `GET /posts` or `GET /topics/:topic/authors` API response shapes.
- Adding `sortBy=followerCountAtPublish` or similar to the expert-finder endpoint.
- Embedding any other author profile field (`handle`, `displayName`, `profileLocation`, `verifiedStatus`) on `SocialPost`.
- Reopening the full "embed author per post" design that ADR-0004 rejected.
- Use of the `IngestionRun.rawPayload` archival store as a substitute for a queryable column.

## 3. Context and Background
ADR-0004 models `Author` as its own entity keyed by `(tenantId, platformId, externalAuthorId)`, upserted as new posts arrive. `SocialPost.authorId` is a foreign key into `Author`. This means `Author.followerCount` is always the *most-recently-seen* value, upserted in place whenever the author is encountered in a new ingestion run. ADR-0004 names this trade-off explicitly in its own Negative consequences:

> "Author facts like `followerCount` reflect whatever was true at last-seen time, not at each individual post's `publishedAt` — historical accuracy of 'follower count at time of post' is not preserved."

That consequence was accepted at the time as a deliberate trade-off: keeping `SocialPost` focused on per-event data and avoiding per-post duplication of author profile fields, which was ADR-0004's core motivation.

**Why this is not just an Amendment Log entry on ADR-0004:** this ADR changes the data-model decision itself — adding a field to `SocialPost` that partially reintroduces per-post author data, which is precisely what ADR-0004 argued against. Under this ADR series' own governance table (see `docs/adr/README.md`'s "Conventions for changing an existing ADR"), *"the underlying decision itself changes → new ADR"*. An Amendment Log entry is appropriate when an adjustable parameter changes (a threshold, a window length); it is not appropriate when the schema structure changes in a way that touches the durable decision text of an Accepted ADR.

**The specific use case that forces this decision:** individual-account social platforms — Reddit initially; X, LinkedIn, and similar future connectors — return a follower count with or alongside each post in their own API response at fetch time. This value can differ meaningfully from the author's current `followerCount` stored on `Author`, especially for accounts with rapid audience growth or loss between posts. Analysts performing reach or influencer analysis on historical posts need the value that was true *at the time the post was published*, not the author's current subscriber count at query time. Without this field, a post from six months ago from an account that grew from 10,000 to 100,000 followers will look, in any reach analysis query, as though it was a 100,000-follower post at the time — materially wrong for any time-series reach analysis.

**Why this was deferred rather than decided at ADR-0004's acceptance:** ADR-0004 was accepted before any individual-account social connector was built or storied. The follower-count-at-publish concern was accurate but speculative in the absence of a real connector that would supply that value. Reddit (Phase 1's second platform) is the first connector where this question becomes concrete and implementation-time decisions will need an answer — making now the right time to decide, rather than allowing it to be resolved ad hoc during Story implementation.

**Relationship to `AuthorTopicSignal` and the expert finder (ADR-0007):** the expert-finder query (`GET /topics/:topic/authors?sortBy=activeMonths|mentionCount`) does **not** currently sort by follower count — it sorts by `activeMonthsCount` and `mentionCount`, both of which are computed from `SocialPost` event history, not from `Author.followerCount`. This ADR does not change that. The question of whether `authorFollowerCountAtPublish` should ever be exposed as a `sortBy` option on that endpoint — enabling reach-weighted expert ranking — is deliberately left as an Open Question rather than decided here. ADR-0007's Negative consequence ("API consumers that just want 'the best expert' must implement their own composite ranking") is the already-accepted framing; this ADR does not resolve the composite-ranking question, only the schema-level gap.

---
**What problem are we solving?**  
`Author` is normalized and keyed by `(tenantId, platformId, externalAuthorId)`, and `Author.followerCount` is upserted to the most recently seen value on every new ingestion. Because `SocialPost` only stored `authorId`, any historical reach or influencer analysis against a post from months ago was forced to use the author's *current* follower count. A post published when an account had 10,000 followers but now has 100,000 would incorrectly appear as a 100,000-follower post in time-series analysis.

**Who is affected?**  
Data engineers, tenant business analysts, topic-center analysts, and social-selling strategists who perform reach, influencer, or historical time-series analysis on `SocialPost` data.

**What is the proposed solution at a glance?**  
Add a single, optional, point-in-time field — `author_follower_count_at_publish` — to `SocialPost`. It is populated once at ingest from the connector's reported author follower count for that specific post and is never updated after write. `Author.followerCount` continues to represent the current, most-recently-seen value. The two values are complementary.

**What business value do we expect?**  
Reach and influencer classification queries can now use the audience size that existed at the moment a post was published, making historical comparisons materially more accurate and enabling more credible influencer and crisis-impact analysis.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable accurate historical reach analysis | Reach/influencer queries can distinguish the author's follower count at publish time from the current follower count. |
| 2 | Preserve the normalized author model | Only one point-in-time field is added to `SocialPost`; no other author profile fields are embedded per post. |
| 3 | Improve data integrity for time-series analysis | `author_follower_count_at_publish` on any given `SocialPost` row does not change after initial ingest. |
| 4 | Keep the exception additive and low-risk | Connectors that do not supply or do not meaningfully have a follower count leave the column `NULL` with no migration burden. |

---

**Positive consequences (from ADR):**
**Positive**
- Closes the named trade-off in ADR-0004 for the class of connectors — individual social-platform accounts with follower counts that vary over time — where the gap has real analytical consequences: reach analysis, influencer classification, and historical time-series queries now have access to the value that was true at publication time, not just at query time.
- The per-post value is immutable after ingest, making it straightforward to reason about in historical queries without worrying about it changing under read. Unlike `Author.followerCount`, which is expected to drift as the upsert pattern runs over time, `author_follower_count_at_publish` on any given row is a stable, append-only fact.
- Connectors that do not provide this value (Newswire, GNews, Wikipedia) incur no schema change burden beyond a `NULL`-able column they never populate — the exception is additive, not restructuring.
- The two-field discipline — `Author.followerCount` (current, mutable, upserted) vs. `SocialPost.author_follower_count_at_publish` (point-in-time, immutable) — gives future consumers a clear, explicit semantic distinction between "what the author's reach is today" and "what it was when this post was published," rather than conflating the two.
- Makes the `AuthorTopicSignal` / expert-finder discussion (ADR-0007's named "Open Question" on composite ranking) more concretely answerable when that decision eventually comes: the raw signal now exists in the schema rather than needing to be reconstructed retroactively.

**Negative**
- **Partially reintroduces per-post author data** — the exact trade-off ADR-0004 argued against — scoped to one field. This is a deliberate, accepted reversal on exactly one dimension. It adds per-row storage that ADR-0004's model was designed to avoid. At v1's anticipated data volumes this is not a concern, but it is a real, permanent schema addition.
- **Adds a `NULL` interpretation question** that did not exist before: `NULL` could mean "this connector does not report follower counts at ingest" (Newswire, GNews, Wikipedia), "this connector supports it but the platform did not return a value for this specific post" (platform API returned the post without an author-stats payload), or "this post was ingested before this column existed" (historical rows). These three cases are semantically distinct; a future consumer that depends on this field must be aware of which case it is in. The exact `NULL` semantics are left as an Open Question and should be documented in the Story that actually adds this column.
- **Does not retroactively populate existing rows.** Any `SocialPost` rows already written before this column is added will have `NULL` for `author_follower_count_at_publish`, even for connectors that subsequently provide the value. This is not a defect — it is correct behavior for a point-in-time snapshot — but it means any analysis relying on this field will have a "before/after" gap at the migration date.
- **The expert-finder question is deferred, not closed.** ADR-0007's `sortBy=activeMonths|mentionCount` design was accepted knowing it doesn't incorporate follower count into reach-weighted expert ranking. This ADR enables that ranking to be implemented later, but does not decide it. If `sortBy=followerCountAtPublish` is never added to the expert-finder endpoint, this field's analytical value is limited to raw query access, not a first-class API sort signal — a real limitation worth naming rather than assuming it gets added automatically.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall add one nullable `INTEGER` column named `author_follower_count_at_publish` to the `SocialPost` schema. | Must | Schema inspection shows exactly one new nullable integer column; no other author profile fields are added to `SocialPost`. | Engineering |
| BR-002 | The system shall populate `author_follower_count_at_publish` at the initial ingestion of a post, using the follower count the connector reports for that post's author at that moment. | Must | A test ingests a post and the stored `author_follower_count_at_publish` matches the connector's reported value. | Engineering |
| BR-003 | The system shall keep `author_follower_count_at_publish` immutable after initial write. | Must | A later post from the same author with a different reported follower count does not alter the already-stored value on earlier posts. | Engineering |
| BR-004 | The system shall not derive or reconcile `author_follower_count_at_publish` from `Author.followerCount` after the initial write. | Must | A test confirms that `Author.followerCount` upserts leave `author_follower_count_at_publish` unchanged on existing posts. | Engineering |
| BR-005 | The system shall allow connectors to declare whether they can provide a follower count at publish time (e.g., `canProvideFollowerCountAtPublish`). | Should | Connector-type definitions include a boolean capability flag analogous to `supportedQueryFeatures`; unmodified connectors default to not providing the value. | Engineering |
| BR-006 | The system shall leave `author_follower_count_at_publish` `NULL` for connectors where the value is not meaningful (e.g., organization/publication-as-Author connectors such as Newswire, GNews, and Wikipedia). | Must | Tests for Newswire/GNews/Wikipedia-style connectors produce `NULL` for the field with no connector code changes. | Engineering |
| BR-007 | The system shall not retroactively update `author_follower_count_at_publish` on pre-existing `SocialPost` rows when the column is added. | Must | Existing rows retain `NULL` after the migration; no backfill job is triggered. | Engineering |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Add **one optional, point-in-time field** to `SocialPost` to capture the author's follower count as reported by the platform connector at the moment of ingestion of that specific post. This is a scoped, documented exception to ADR-0004's normalized Author model — deliberately the minimum exception that addresses the named trade-off, not a reopening of the "embed author fields per post" alternative ADR-0004 rejected.

Specifically:

- **A single field, at ingest time only.** The field is populated once, from whatever the connector/platform returns for that author at the time that specific post is fetched and normalized. It is never updated after initial write — it is a point-in-time snapshot of what the platform reported, not a mutable author profile field.
- **Never backfilled from `Author.followerCount`.** The field is not derived from, updated by, or reconciled against `Author.followerCount` after ingest — doing so would defeat the point-in-time purpose and reintroduce the very staleness problem this field is designed to capture distinctly from. If a connector does not supply a follower count alongside the post payload, the field is left `NULL` — explicitly a first-class representation of "not available from this connector at this point in time," not a default zero.
- **`Author.followerCount` is unchanged.** ADR-0004's Author model continues exactly as designed: `Author.followerCount` is still the most-recently-seen upserted value for the author's current subscriber count. The new per-post field captures a distinct, point-in-time value — the two are complementary, not redundant.
- **Scope is one field only.** This exception covers follower count and nothing else. Per-post snapshots of any other author profile field — `handle`, `displayName`, `profileLocation`, `verifiedStatus` — remain out of scope. ADR-0004's normalized approach is maintained in full for all other Author fields. Each future connector that would argue for a per-post snapshot of a different author field must make that case under a new ADR or amendment — this ADR does not open a general "author fields per post" exception.
- **Connectors where the field is not meaningful leave it `NULL`.** This follows the same discipline ADR-0024's and ADR-0026's decisions already establish for `Author.followerCount` itself: Newswire (issuer-as-Author, organizational identity) and GNews (publication-as-Author) both leave `Author.followerCount` unpopulated, for the same reason — it is not a meaningful attribute for an organization or publication. The point-in-time per-post field inherits the same logic: if the connector's own API does not return a meaningful follower count alongside the post at ingest, the field is `NULL`. ADR-0042's Wikipedia connector (article-as-Author, also organizational in nature) would similarly leave it `NULL`.

**Implementation defaults (adjustable via Amendment Log; does not require superseding this ADR):**

- **Exact column name on `SocialPost`:** `author_follower_count_at_publish` (snake_case, consistent with the rest of this project's Postgres naming conventions). This is an implementation default — renamed via an Amendment Log entry, not a new ADR, if a better name is established at implementation time.
- **Type:** `INTEGER`, `NULL`-able. Matches the type of `Author.follower_count` in the existing migration (`migrations/0004_create_authors.sql`), keeping the two values directly comparable in queries. A future Amendment Log entry may revise this to `BIGINT` if any supported platform returns follower counts that overflow `INTEGER` — flagged as a consideration for Reddit's connector implementation, since subreddit subscriber counts can exceed 40 million.
- **Connector-level `canProvideFollowerCountAtPublish` flag:** connectors that supply this value at ingest time signal it via a capability declaration, analogous to ADR-0021's `supportedQueryFeatures` matrix. The exact shape of this declaration (a boolean field on the connector's capability manifest, or a naming convention in `normalize()`'s returned payload) is an implementation-time task, not fixed by this ADR.
- **No API surface change is mandated by this ADR.** Whether `GET /posts` (cursor-paginated per ADR-0011) exposes `authorFollowerCountAtPublish` in its response shape, and whether `GET /topics/:topic/authors` (ADR-0007's expert-finder endpoint) ever accepts it as a `sortBy` parameter, are implementation-time and future-ADR decisions — see Open Questions. This ADR only adds the field to the storage schema; it does not mandate an API change.

---

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor, Product Owner, Technical Lead | High | A scoped, durable decision that closes ADR-0004's named trade-off without re-denormalizing the author model. |
| Data Engineer | Implements and maintains the `SocialPost` data model | High | A clear, one-column, one-time-write rule with unambiguous `NULL` semantics. |
| Tenant Business Analyst / Topic-Center Analyst | Consumer of reach and influencer analytics | High | Accurate historical follower counts for time-series and trend analysis. |
| Social-Selling Strategist | User of influencer discovery and prospecting | Medium | A reliable per-post reach signal for ranking and outreach lists. |
| Platform Operations | Storage and archival management | Low | Minimal additive storage; no backfill or reprocessing of historical rows. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.9 | epic-3-data-model-storage-and-archival.md | As data engineer supporting reach/influencer analysis on historical posts, I want `SocialPost` to carry the author's follower count as reported by the connec... | `SocialPost` gains one new, nullable field — `authorFollowerCountAtPublish` (Postgres column `author_follower_count_at_publish`, `INTEGER`, nullable, per ADR... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.author_follower_count_at_publish` | Nullable point-in-time follower count for the author at the post's ingest/publish time. | Connector `normalize()` output for the specific post's author | Engineering | Public author metadata; tenant-scoped under RLS |
| `Author.followerCount` | Most-recently-seen current follower count for the author; continues to be upserted. | Connector author payload | Engineering | Public author metadata; tenant-scoped under RLS |
| `SocialConnector.canProvideFollowerCountAtPublish` | Boolean capability flag indicating whether a connector can supply a point-in-time follower count. | Connector capability manifest | Engineering | Configuration; tenant-scoped where applicable |
| `IngestionRun` | Existing audit anchor; unchanged, but the point-in-time value is captured during the run that creates the post. | Ingestion pipeline | Engineering | Operational; tenant-scoped |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `author_follower_count_at_publish` is set exactly once, at the initial creation of a `SocialPost`. |
| BRU-002 | If the connector does not return a follower count for the post's author, `author_follower_count_at_publish` is `NULL`. |
| BRU-003 | `author_follower_count_at_publish` may never be updated, backfilled, or reconciled from `Author.followerCount`. |
| BRU-004 | Only `followerCount` may be stored as a point-in-time author field on `SocialPost`; all other author attributes remain on the normalized `Author` entity. |
| BRU-005 | `NULL` on `author_follower_count_at_publish` can represent (a) a connector for which the value is not meaningful, (b) a connector that did not return the value for that post, or (c) a row ingested before the column existed; these cases must be documented in the implementation. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0004 — normalized `Author` entity | Decided / prerequisite | Engineering | Already accepted; this ADR is a scoped exception to it. |
| D-002 | ADR-0021 — connector `supportedQueryFeatures` pattern | Pattern / precedent | Engineering | Already accepted; capability flag modeled on this pattern. |
| D-003 | Story 3.9 — point-in-time author follower count on `SocialPost` | Implementation | Engineering | Built 2026-08-12 (`social-listening-core@34e9dfb`). |
| D-004 | Real individual-account connectors (Reddit, X, LinkedIn, etc.) | Future connector build-out | Engineering / Product | Future Epic 2 stories; field is ready for them. |
| D-005 | Future ADR or amendment for `GET /topics/:topic/authors` follower-count sorting | Downstream decision | Product | Open question; not required for this BRD. |

---

- Individual-account social connectors (Reddit, X, LinkedIn, etc.) return the author follower count alongside or near the post payload at fetch time.
- Public author metadata such as follower count is permitted to be stored under relevant platform API terms.
- The additional nullable integer per post is acceptable at v1 data volumes.
- This field is primarily for analytical and operational use, not for real-time scoring until a future ADR or amendment explicitly decides that.

**The durable decision — this is what would need superseding, not just amending:**

Add **one optional, point-in-time field** to `SocialPost` to capture the author's follower count as reported by the platform connector at the moment of ingestion of that specific post. This is a scoped, documented exception to ADR-0004's normalized Author model — deliberately the minimum exception that addresses the named trade-off, not a reopening of the "embed author fields per post" alternative ADR-0004 rejected.

Specifically:

- **A single field, at ingest time only.** The field is populated once, from whatever the connector/platform returns for that author at the time that specific post is fetched and normalized. It is never updated after initial write — it is a point-in-time snapshot of what the platform reported, not a mutable author profile field.
- **Never backfilled from `Author.followerCount`.** The field is not derived from, updated by, or reconciled against `Author.followerCount` after ingest — doing so would defeat the point-in-time purpose and reintroduce the very staleness problem this field is designed to capture distinctly from. If a connector does not supply a follower count alongside the post payload, the field is left `NULL` — explicitly a first-class representation of "not available from this connector at this point in time," not a default zero.
- **`Author.followerCount` is unchanged.** ADR-0004's Author model continues exactly as designed: `Author.followerCount` is still the most-recently-seen upserted value for the author's current subscriber count. The new per-post field captures a distinct, point-in-time value — the two are complementary, not redundant.
- **Scope is one field only.** This exception covers follower count and nothing else. Per-post snapshots of any other author profile field — `handle`, `displayName`, `profileLocation`, `verifiedStatus` — remain out of scope. ADR-0004's normalized approach is maintained in full for all other Author fields. Each future connector that would argue for a per-post snapshot of a different author field must make that case under a new ADR or amendment — this ADR does not open a general "author fields per post" exception.
- **Connectors where the field is not meaningful leave it `NULL`.** This follows the same discipline ADR-0024's and ADR-0026's decisions already establish for `Author.followerCount` itself: Newswire (issuer-as-Author, organizational identity) and GNews (publication-as-Author) both leave `Author.followerCount` unpopulated, for the same reason — it is not a meaningful attribute for an organization or publication. The point-in-time per-post field inherits the same logic: if the connector's own API does not return a meaningful follower count alongside the post at ingest, the field is `NULL`. ADR-0042's Wikipedia connector (article-as-Author, also organizational in nature) would similarly leave it `NULL`.

**Implementation defaults (adjustable via Amendment Log; does not require superseding this ADR):**

- **Exact column name on `SocialPost`:** `author_follower_count_at_publish` (snake_case, consistent with the rest of this project's Postgres naming conventions). This is an implementation default — renamed via an Amendment Log entry, not a new ADR, if a better name is established at implementation time.
- **Type:** `INTEGER`, `NULL`-able. Matches the type of `Author.follower_count` in the existing migration (`migrations/0004_create_authors.sql`), keeping the two values directly comparable in queries. A future Amendment Log entry may revise this to `BIGINT` if any supported platform returns follower counts that overflow `INTEGER` — flagged as a consideration for Reddit's connector implementation, since subreddit subscriber counts can exceed 40 million.
- **Connector-level `canProvideFollowerCountAtPublish` flag:** connectors that supply this value at ingest time signal it via a capability declaration, analogous to ADR-0021's `supportedQueryFeatures` matrix. The exact shape of this declaration (a boolean field on the connector's capability manifest, or a naming convention in `normalize()`'s returned payload) is an implementation-time task, not fixed by this ADR.
- **No API surface change is mandated by this ADR.** Whether `GET /posts` (cursor-paginated per ADR-0011) exposes `authorFollowerCountAtPublish` in its response shape, and whether `GET /topics/:topic/authors` (ADR-0007's expert-finder endpoint) ever accepts it as a `sortBy` parameter, are implementation-time and future-ADR decisions — see Open Questions. This ADR only adds the field to the storage schema; it does not mandate an API change.

---

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `author_follower_count_at_publish` is a point-in-time, immutable fact on each post row. | Data Integrity | Must | Contract tests prove the value never changes after initial insert. |
| NFR-002 | The storage cost of the additional column must not materially change ingestion or archival economics. | Performance / Scalability | Should | One nullable 32-bit integer per row; no change to `rawPayload` retention or archival behavior. |
| NFR-003 | Follower count data is treated as public author metadata and remains tenant-scoped under RLS. | Security / Compliance | Must | Existing tenant RLS on `SocialPost` and `Author` is unchanged and contract-tested. |
| NFR-004 | The column type must support anticipated v1 platform follower counts without overflow. | Maintainability | Should | `INTEGER` is sufficient for all v1 connectors; `BIGINT` upgrade path is documented for future platforms. |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes the named trade-off in ADR-0004 for the class of connectors — individual social-platform accounts with follower counts that vary over time — where the gap has real analytical consequences: reach analysis, influencer classification, and historical time-series queries now have access to the value that was true at publication time, not just at query time.
- The per-post value is immutable after ingest, making it straightforward to reason about in historical queries without worrying about it changing under read. Unlike `Author.followerCount`, which is expected to drift as the upsert pattern runs over time, `author_follower_count_at_publish` on any given row is a stable, append-only fact.
- Connectors that do not provide this value (Newswire, GNews, Wikipedia) incur no schema change burden beyond a `NULL`-able column they never populate — the exception is additive, not restructuring.
- The two-field discipline — `Author.followerCount` (current, mutable, upserted) vs. `SocialPost.author_follower_count_at_publish` (point-in-time, immutable) — gives future consumers a clear, explicit semantic distinction between "what the author's reach is today" and "what it was when this post was published," rather than conflating the two.
- Makes the `AuthorTopicSignal` / expert-finder discussion (ADR-0007's named "Open Question" on composite ranking) more concretely answerable when that decision eventually comes: the raw signal now exists in the schema rather than needing to be reconstructed retroactively.

**Negative**
- **Partially reintroduces per-post author data** — the exact trade-off ADR-0004 argued against — scoped to one field. This is a deliberate, accepted reversal on exactly one dimension. It adds per-row storage that ADR-0004's model was designed to avoid. At v1's anticipated data volumes this is not a concern, but it is a real, permanent schema addition.
- **Adds a `NULL` interpretation question** that did not exist before: `NULL` could mean "this connector does not report follower counts at ingest" (Newswire, GNews, Wikipedia), "this connector supports it but the platform did not return a value for this specific post" (platform API returned the post without an author-stats payload), or "this post was ingested before this column existed" (historical rows). These three cases are semantically distinct; a future consumer that depends on this field must be aware of which case it is in. The exact `NULL` semantics are left as an Open Question and should be documented in the Story that actually adds this column.
- **Does not retroactively populate existing rows.** Any `SocialPost` rows already written before this column is added will have `NULL` for `author_follower_count_at_publish`, even for connectors that subsequently provide the value. This is not a defect — it is correct behavior for a point-in-time snapshot — but it means any analysis relying on this field will have a "before/after" gap at the migration date.
- **The expert-finder question is deferred, not closed.** ADR-0007's `sortBy=activeMonths|mentionCount` design was accepted knowing it doesn't incorporate follower count into reach-weighted expert ranking. This ADR enables that ranking to be implemented later, but does not decide it. If `sortBy=followerCountAtPublish` is never added to the expert-finder endpoint, this field's analytical value is limited to raw query access, not a first-class API sort signal — a real limitation worth naming rather than assuming it gets added automatically.

---

## 12. Assumptions and Dependencies
- Individual-account social connectors (Reddit, X, LinkedIn, etc.) return the author follower count alongside or near the post payload at fetch time.
- Public author metadata such as follower count is permitted to be stored under relevant platform API terms.
- The additional nullable integer per post is acceptable at v1 data volumes.
- This field is primarily for analytical and operational use, not for real-time scoring until a future ADR or amendment explicitly decides that.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The new column adds permanent per-row storage, partially reintroducing per-post author data. | High | Low | Scope is limited to one nullable integer; no other author fields are embedded; archival and `rawPayload` retention remain unchanged. | Engineering |
| R-002 | `NULL` semantics are ambiguous (connector not applicable vs. platform omitted vs. pre-migration). | High | Medium | Document the three cases in the migration and `SocialPost` model when Story 3.9 is implemented; ensure consumers understand them. | Engineering / Product |
| R-003 | Without a downstream API sort or `AuthorTopicSignal` use, the field's analytical value may be limited to raw queries. | Medium | Medium | Track as an open question for a future ADR/amendment on `GET /topics/:topic/authors` `sortBy` options. | Product |
| R-004 | `INTEGER` may overflow if a future platform has >2.1 billion followers. | Low | High | Default to `INTEGER` for v1; note a clear path to `BIGINT` migration if such a connector is added. | Engineering |
| R-005 | Storage and query patterns may be misunderstood as a general license to embed author fields per post. | Medium | Medium | Governance: any additional per-post author field requires a new ADR or supersession; this ADR explicitly scopes to one field. | Product / Engineering |

---

## 14. Appendix
- ADR: `../../adr/0049-point-in-time-author-follower-count-on-social-post.md`
- BRD: `../Business-Requirements/BRD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md`
- Feature design: `docs/product-research/feature-designs/05-influencer-discovery.md``
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above