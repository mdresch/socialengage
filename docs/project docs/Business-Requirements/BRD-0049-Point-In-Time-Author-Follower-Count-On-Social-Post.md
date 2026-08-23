# BRD-0049: Point-in-Time Author Follower Count on `SocialPost`

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Point-in-Time Author Follower Count on `SocialPost` – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-12 |
| Author(s) | Business Requirements Analyst |
| Approver(s) | Menno (Sponsor / Product Owner) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-12 | Business Requirements Analyst | Initial BRD synthesized from ADR-0049, Story 3.9, and the influencer-discovery feature design. |

---

## 2. Executive Summary

**What problem are we solving?**  
`Author` is normalized and keyed by `(tenantId, platformId, externalAuthorId)`, and `Author.followerCount` is upserted to the most recently seen value on every new ingestion. Because `SocialPost` only stored `authorId`, any historical reach or influencer analysis against a post from months ago was forced to use the author's *current* follower count. A post published when an account had 10,000 followers but now has 100,000 would incorrectly appear as a 100,000-follower post in time-series analysis.

**Who is affected?**  
Data engineers, tenant business analysts, topic-center analysts, and social-selling strategists who perform reach, influencer, or historical time-series analysis on `SocialPost` data.

**What is the proposed solution at a glance?**  
Add a single, optional, point-in-time field — `author_follower_count_at_publish` — to `SocialPost`. It is populated once at ingest from the connector's reported author follower count for that specific post and is never updated after write. `Author.followerCount` continues to represent the current, most-recently-seen value. The two values are complementary.

**What business value do we expect?**  
Reach and influencer classification queries can now use the audience size that existed at the moment a post was published, making historical comparisons materially more accurate and enabling more credible influencer and crisis-impact analysis.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable accurate historical reach analysis | Reach/influencer queries can distinguish the author's follower count at publish time from the current follower count. |
| 2 | Preserve the normalized author model | Only one point-in-time field is added to `SocialPost`; no other author profile fields are embedded per post. |
| 3 | Improve data integrity for time-series analysis | `author_follower_count_at_publish` on any given `SocialPost` row does not change after initial ingest. |
| 4 | Keep the exception additive and low-risk | Connectors that do not supply or do not meaningfully have a follower count leave the column `NULL` with no migration burden. |

---

## 4. Scope

### 4.1 In Scope

- Add one nullable `INTEGER` column, `author_follower_count_at_publish`, to the `SocialPost` storage schema.
- Populate that column once at post-ingest time from the connector's `normalize()` output for that specific post's author.
- Keep the value immutable: no later `Author.followerCount` upsert, reconciliation, or backfill may modify it.
- Leave `Author.followerCount` unchanged as the most-recently-seen current value.
- Add connector-level signaling of the capability to provide a follower count at publish time (e.g., `SocialConnector.canProvideFollowerCountAtPublish`), modeled on the existing `supportedQueryFeatures` pattern.
- Ensure the field remains `NULL` for connectors where the value is not meaningful (e.g., Newswire, GNews, Wikipedia/organization-as-Author connectors).
- Document the `NULL` semantics for the field in the migration and/or model code when implemented.

### 4.2 Out of Scope

- Retroactive backfill of `author_follower_count_at_publish` for existing `SocialPost` rows.
- Any mandated change to the `GET /posts` or `GET /topics/:topic/authors` API response shapes.
- Adding `sortBy=followerCountAtPublish` or similar to the expert-finder endpoint.
- Embedding any other author profile field (`handle`, `displayName`, `profileLocation`, `verifiedStatus`) on `SocialPost`.
- Reopening the full "embed author per post" design that ADR-0004 rejected.
- Use of the `IngestionRun.rawPayload` archival store as a substitute for a queryable column.

### 4.3 Assumptions

- Individual-account social connectors (Reddit, X, LinkedIn, etc.) return the author follower count alongside or near the post payload at fetch time.
- Public author metadata such as follower count is permitted to be stored under relevant platform API terms.
- The additional nullable integer per post is acceptable at v1 data volumes.
- This field is primarily for analytical and operational use, not for real-time scoring until a future ADR or amendment explicitly decides that.

### 4.4 Constraints

- PostgreSQL with tenant-scoped RLS; any schema change must remain RLS-compatible.
- The project adheres to snake_case column naming (`author_follower_count_at_publish`).
- The `INTEGER` type is the default; a future `BIGINT` revision may be needed if a connector with >2.1 billion followers is added.
- No existing `SocialPost` rows may be modified to preserve point-in-time semantics.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor, Product Owner, Technical Lead | High | A scoped, durable decision that closes ADR-0004's named trade-off without re-denormalizing the author model. |
| Data Engineer | Implements and maintains the `SocialPost` data model | High | A clear, one-column, one-time-write rule with unambiguous `NULL` semantics. |
| Tenant Business Analyst / Topic-Center Analyst | Consumer of reach and influencer analytics | High | Accurate historical follower counts for time-series and trend analysis. |
| Social-Selling Strategist | User of influencer discovery and prospecting | Medium | A reliable per-post reach signal for ranking and outreach lists. |
| Platform Operations | Storage and archival management | Low | Minimal additive storage; no backfill or reprocessing of historical rows. |

---

## 6. Current State (As-Is)

**Current process:**
1. A connector fetches a post and normalizes the author.
2. The `Author` entity is upserted by `(tenantId, platformId, externalAuthorId)`.
3. `Author.followerCount` is overwritten with the most recently seen value.
4. `SocialPost` stores only `authorId`, with no per-post author snapshot.
5. Reach/influencer queries join `SocialPost` to `Author` and read `Author.followerCount` regardless of when the post was published.

**Pain points:**
- A historical post appears to have the audience size the author has *today*, not at publish time.
- Reach and influencer time-series analysis can be materially wrong for fast-growing or shrinking accounts.
- The gap was already named as a trade-off in ADR-0004 but had no concrete mechanism to close it.

---

## 7. Future State (To-Be)

**New or improved process:**
1. The connector fetches a post and reports the author's follower count for that post in its `normalize()` output.
2. During `SocialPost` creation, the system writes the reported value into `author_follower_count_at_publish`.
3. `SocialPost.author_follower_count_at_publish` is never updated again.
4. `Author.followerCount` continues to be upserted to the most-recently-seen value for the author as a whole.
5. Consumers can query either the point-in-time value on the post or the current value on `Author`, choosing the right signal for the analysis.

**Expected capabilities:**
- Historical reach analysis uses the follower count at the time the post was published.
- Influencer and topic time-series views can compare `then` vs. `now` audience.
- The normalized author model is preserved for all other author attributes.
- The change is additive: connectors that do not provide the value continue to store `NULL`.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `author_follower_count_at_publish` is a point-in-time, immutable fact on each post row. | Data Integrity | Must | Contract tests prove the value never changes after initial insert. |
| NFR-002 | The storage cost of the additional column must not materially change ingestion or archival economics. | Performance / Scalability | Should | One nullable 32-bit integer per row; no change to `rawPayload` retention or archival behavior. |
| NFR-003 | Follower count data is treated as public author metadata and remains tenant-scoped under RLS. | Security / Compliance | Must | Existing tenant RLS on `SocialPost` and `Author` is unchanged and contract-tested. |
| NFR-004 | The column type must support anticipated v1 platform follower counts without overflow. | Maintainability | Should | `INTEGER` is sufficient for all v1 connectors; `BIGINT` upgrade path is documented for future platforms. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `author_follower_count_at_publish` is set exactly once, at the initial creation of a `SocialPost`. |
| BRU-002 | If the connector does not return a follower count for the post's author, `author_follower_count_at_publish` is `NULL`. |
| BRU-003 | `author_follower_count_at_publish` may never be updated, backfilled, or reconciled from `Author.followerCount`. |
| BRU-004 | Only `followerCount` may be stored as a point-in-time author field on `SocialPost`; all other author attributes remain on the normalized `Author` entity. |
| BRU-005 | `NULL` on `author_follower_count_at_publish` can represent (a) a connector for which the value is not meaningful, (b) a connector that did not return the value for that post, or (c) a row ingested before the column existed; these cases must be documented in the implementation. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.author_follower_count_at_publish` | Nullable point-in-time follower count for the author at the post's ingest/publish time. | Connector `normalize()` output for the specific post's author | Engineering | Public author metadata; tenant-scoped under RLS |
| `Author.followerCount` | Most-recently-seen current follower count for the author; continues to be upserted. | Connector author payload | Engineering | Public author metadata; tenant-scoped under RLS |
| `SocialConnector.canProvideFollowerCountAtPublish` | Boolean capability flag indicating whether a connector can supply a point-in-time follower count. | Connector capability manifest | Engineering | Configuration; tenant-scoped where applicable |
| `IngestionRun` | Existing audit anchor; unchanged, but the point-in-time value is captured during the run that creates the post. | Ingestion pipeline | Engineering | Operational; tenant-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Historical reach by post | Use `author_follower_count_at_publish` to size the audience a post had at publish time. | Tenant Business Analyst, Topic-Center Analyst | Ad-hoc / dashboard |
| Point-in-time coverage by connector | Measure what share of posts per connector/platform have a non-`NULL` point-in-time follower count. | Data Engineer, Platform Operations | Monthly |
| Influencer/expert ranking (future) | Potential future use of point-in-time reach in `AuthorTopicSignal` or expert-finder scoring. | Social-Selling Strategist, Tenant Business Analyst | Future / deferred |
| Follower-drift analysis | Compare `author_follower_count_at_publish` with `Author.followerCount` to identify fast-growing authors. | Topic-Center Analyst | Ad-hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The new column adds permanent per-row storage, partially reintroducing per-post author data. | High | Low | Scope is limited to one nullable integer; no other author fields are embedded; archival and `rawPayload` retention remain unchanged. | Engineering |
| R-002 | `NULL` semantics are ambiguous (connector not applicable vs. platform omitted vs. pre-migration). | High | Medium | Document the three cases in the migration and `SocialPost` model when Story 3.9 is implemented; ensure consumers understand them. | Engineering / Product |
| R-003 | Without a downstream API sort or `AuthorTopicSignal` use, the field's analytical value may be limited to raw queries. | Medium | Medium | Track as an open question for a future ADR/amendment on `GET /topics/:topic/authors` `sortBy` options. | Product |
| R-004 | `INTEGER` may overflow if a future platform has >2.1 billion followers. | Low | High | Default to `INTEGER` for v1; note a clear path to `BIGINT` migration if such a connector is added. | Engineering |
| R-005 | Storage and query patterns may be misunderstood as a general license to embed author fields per post. | Medium | Medium | Governance: any additional per-post author field requires a new ADR or supersession; this ADR explicitly scopes to one field. | Product / Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0004 — normalized `Author` entity | Decided / prerequisite | Engineering | Already accepted; this ADR is a scoped exception to it. |
| D-002 | ADR-0021 — connector `supportedQueryFeatures` pattern | Pattern / precedent | Engineering | Already accepted; capability flag modeled on this pattern. |
| D-003 | Story 3.9 — point-in-time author follower count on `SocialPost` | Implementation | Engineering | Built 2026-08-12 (`social-listening-core@34e9dfb`). |
| D-004 | Real individual-account connectors (Reddit, X, LinkedIn, etc.) | Future connector build-out | Engineering / Product | Future Epic 2 stories; field is ready for them. |
| D-005 | Future ADR or amendment for `GET /topics/:topic/authors` follower-count sorting | Downstream decision | Product | Open question; not required for this BRD. |

---

## 14. Acceptance Criteria

- `SocialPost` gains exactly one new, nullable `INTEGER` field — `author_follower_count_at_publish` — and no other author profile fields are added to `SocialPost`.
- The field is populated once at ingest time from the connector's reported follower count for that specific post's author.
- The stored value on a post does not change when the same author is later upserted with a different `Author.followerCount`.
- The field remains `NULL` for organization/publication-as-Author connectors and for any connector that does not supply the value.
- Existing `SocialPost` rows created before the column existed retain `NULL`; no backfill is performed.
- `Author.followerCount` continues to behave as before (most-recently-seen upserted value).

---

## 15. Glossary

| Term | Definition |
|---|---|
| `Author` | The normalized entity keyed by `(tenantId, platformId, externalAuthorId)` that stores current, per-account author facts. |
| `SocialPost` | The per-event post entity; each row represents one fetched post. |
| `author_follower_count_at_publish` | The new nullable `INTEGER` column on `SocialPost` that stores the author's follower count as reported by the connector at the moment the post was ingested. |
| `Author.followerCount` | The most-recently-seen follower count on the normalized `Author` row, updated on upsert. |
| Point-in-time | A value that is captured at a specific moment and not modified afterward; in this case, at post ingest time. |
| Connector | A `SocialConnector` implementation that fetches and normalizes posts from a platform. |
| `normalize()` | The connector function that transforms platform-specific post/author payloads into the shared internal model. |
| `canProvideFollowerCountAtPublish` | A connector capability flag indicating that the connector can return a follower count for a post's author at ingest time. |
| `AuthorTopicSignal` | The existing derived signal table used by the expert-finder endpoint; not modified by this BRD. |

---

## 16. Appendices

### Reference Documents

- `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md` — source ADR.
- `docs/adr/0004-author-normalized-separately-from-post.md` — baseline normalized `Author` model that this ADR partially excepts.
- `docs/adr/0021-unified-boolean-query-ast-and-connector-capabilities.md` — connector capability pattern.
- `docs/user-stories/epic-3-data-model-storage-and-archival.md` — Story 3.9, which implements this decision.
- `docs/product-research/feature-designs/05-influencer-discovery.md` — related downstream use case that may consume point-in-time follower counts in the future.

### Missing Sources

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was located for this specific data-model exception; the business context was synthesized from ADR-0049, Story 3.9, and the influencer-discovery feature design.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
