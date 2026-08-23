# Business Requirements Document (BRD) — Data Retention and Archival Policy

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Data Retention and Archival Policy |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0018-data-retention-and-archival-policy.md, ../Business-Requirements/BRD-0018-Data-Retention-And-Archival-Policy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0018-data-retention-and-archival-policy.md and the business requirements in BRD-0018-Data-Retention-And-Archival-Policy.md into functional design for **Data Retention And Archival Policy**.
The platform ingests high volumes of social posts and records every ingestion attempt in `IngestionRun`. By design, `SocialPost` carries an immutable `rawPayload` (the original platform JSON) and `IngestionRun` is an audit anchor for every post. Without a retention policy, these tables grow without bound, threatening primary storage cost, query performance, and the future multi-year topic-aggregation capability the product was designed to support.

This BRD establishes a tiered, field-level retention and archival policy: analytically valuable fields remain hot in Postgres indefinitely, while the heaviest and least-queried data (`rawPayload` and `IngestionRun` rows) move to cheaper archival storage after bounded, configurable windows. The policy preserves the "never discarded" guarantee for raw payloads and the immutable audit-anchor property for ingestion runs, while keeping the cost and performance of primary storage predictable as the platform scales.

The accepted defaults are 90 days for `rawPayload` and 18 months for `IngestionRun`, with both windows exposed as configuration rather than hardcoded constants.

---

### 2.2 Scope
**In scope:**
- Field-level tiered retention for `SocialPost` data: analytically relevant fields retained indefinitely hot; `rawPayload` moved to archival storage after a configurable window
- Archival of `IngestionRun` audit rows after a configurable window, without hard deletion
- Replacement of hot `rawPayload` values with a pointer/reference to the archived object
- Monthly range partitioning of `SocialPost` and `IngestionRun` as the archival mechanism
- Configurable retention windows for `rawPayload` and `IngestionRun`
- Azure Blob Storage as the target archival tier, keyed by post/run identifier
- Retrieval path for archived `rawPayload` to support support/debug investigations

**Out of scope:**
- Tenant offboarding and GDPR Article 17 right-to-erasure handling (owned by ADR-0039 / ADR-0043 and Stories 3.7 / 3.8)
- Backfill of historical rows that predate the archival feature, unless explicitly requested by a later story
- Hard deletion of archived data for active tenants, except within a scoped tenant-deletion flow
- Real-time latency guarantees for retrieval of archived payloads

## 3. Context and Background
Two tables grow without bound by design:

- `SocialPost` — described in §6 as "high-volume and unbounded." Each row carries `rawPayload` (§4.2), the full original platform JSON, explicitly "never discarded."
- `IngestionRun` — a new row per poll or webhook trigger, per tenant, per platform (ADR-0005), which at any meaningful polling frequency across many tenants accumulates quickly.

Working against unconstrained retention: the linked design conversation that produced this spec anticipated topic-volume graphs spanning **years** ("i can see a count per day on a topic graph where the graph can be set to years"), and that capability — while explicitly deferred to a future subsystem (ADR-0008) — depends on `SocialPost.publishedAt` and `enrichment.entities`/`keyPhrases` still existing that far back. So "keep everything forever" and "delete aggressively" are both wrong defaults here: the former makes primary storage cost and query performance degrade indefinitely, the latter breaks a capability this platform was explicitly designed to support later.
The platform ingests high volumes of social posts and records every ingestion attempt in `IngestionRun`. By design, `SocialPost` carries an immutable `rawPayload` (the original platform JSON) and `IngestionRun` is an audit anchor for every post. Without a retention policy, these tables grow without bound, threatening primary storage cost, query performance, and the future multi-year topic-aggregation capability the product was designed to support.

This BRD establishes a tiered, field-level retention and archival policy: analytically valuable fields remain hot in Postgres indefinitely, while the heaviest and least-queried data (`rawPayload` and `IngestionRun` rows) move to cheaper archival storage after bounded, configurable windows. The policy preserves the "never discarded" guarantee for raw payloads and the immutable audit-anchor property for ingestion runs, while keeping the cost and performance of primary storage predictable as the platform scales.

The accepted defaults are 90 days for `rawPayload` and 18 months for `IngestionRun`, with both windows exposed as configuration rather than hardcoded constants.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve multi-year topic aggregation and analytics | `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain queryable indefinitely; topic-count graphs can span years |
| 2 | Bound primary Postgres storage growth | Storage growth rate is driven by lightweight aggregation fields, not unbounded raw JSON payloads |
| 3 | Maintain immutable audit traceability for every post | Every `SocialPost.acquisitionId` continues to resolve to its originating `IngestionRun` even after archival |
| 4 | Reduce infrastructure cost without data loss | `rawPayload` and `IngestionRun` rows move to a cheaper storage tier and remain retrievable on demand |
| 5 | Keep retention policy operationally configurable | Changing hot-retention windows requires a configuration change, not a code deployment or ADR amendment |

---

**Positive consequences (from ADR):**
**Positive**
- The specific capability the original design conversation anticipated (multi-year topic graphs) stays possible, because the fields it depends on are never purged — only the heaviest, least-reused field (`rawPayload`) is tiered.
- Archiving `IngestionRun` instead of deleting it preserves the "immutable audit anchor" property (ADR-0005) rather than quietly breaking it once rows age out.
- Tiering by field rather than by whole-row deletion means primary storage growth is bounded by the actually-expensive part (raw JSON payloads), not by the analytically valuable part, which is a better fit for this system's own stated future use of the data.

**Negative**
- Requires building and operating an actual archival mechanism (blob export + pointer rewrite, or equivalent) — this is new infrastructure, not a configuration flag, and needs its own implementation design.
- A `SocialPost` older than 90 days no longer has its full raw payload immediately queryable; recovering it means a blob fetch, not a JSONB query. Any tooling that assumed `rawPayload` was always live-queryable (e.g., ad hoc debugging via `rawPayload->>'field'`) needs to account for the two-tier reality.
- The specific numbers (90 days for `rawPayload`, 18 months for `IngestionRun`) are accepted implementation defaults, not derived from any stated requirement in the spec — they may need revisiting once real storage cost data and actual reference patterns for aged raw payloads/runs are available. Being configurable rather than hardcoded lowers the cost of that revision.
- Monthly partitioning is a real schema commitment (partition key choice, partition-maintenance automation) made this early, before there's real volume data to validate the partition granularity against.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | `SocialPost.rawPayload` shall remain hot for a configurable window (default 90 days) and then be moved to cheaper archival storage with its Postgres value replaced by a pointer | Must | A post older than the configured window has `rawPayload` in blob storage and a pointer in the row; hot fields remain queryable | Data Engineer |
| BR-002 | Analytically relevant `SocialPost` fields shall be retained indefinitely in hot Postgres storage | Must | `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain queryable without needing the archive tier | Data Engineer |
| BR-003 | `IngestionRun` rows shall be archived, not hard-deleted, after a configurable window (default 18 months) | Must | Runs older than the window are removed from hot Postgres but remain resolvable through their archived record; no active-tenant run is hard-deleted | Data Engineer |
| BR-004 | Archival shall operate by detaching and exporting whole monthly partitions rather than row-by-row mutation | Should | Oldest eligible partition is exported to blob and detached; no long row-by-row `UPDATE`/`DELETE` runs against hot tables | Data Engineer |
| BR-005 | Both the `rawPayload` and `IngestionRun` hot-retention windows shall be exposed as configuration | Must | Time-to-archive values are read from configuration; changing them does not require a code change | Platform Operator |
| BR-006 | Archived `rawPayload` shall remain retrievable through the pointer, preserving the "never discarded" guarantee | Must | A support or export flow can fetch the original raw JSON from the archival pointer | Data Engineer |
| BR-007 | The archival target shall be object/blob storage keyed by the post or run identifier | Should | Blob names are deterministic and traceable back to the original hot-row identifier | Data Engineer |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Retention is tiered — hot primary storage plus cheaper archival storage — rather than a single uniform retention rule, and the tiering boundary is drawn per field/data-category rather than per table, since different fields within the same table have very different value-over-time profiles. Analytically valuable fields (the ones downstream aggregation depends on) are retained far longer than the bulky, rarely-re-read raw payload. Audit-anchor data (`IngestionRun`) is archived, never hard-deleted, because other rows hold foreign keys into it.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **Aggregation-relevant fields** (`tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, `enrichment.*` excluding raw payload) — retained indefinitely in primary Postgres storage. These are exactly the fields the deferred `TopicDailyCount` (ADR-0008) and `AuthorTopicSignal` (ADR-0007) need, including for the multi-year graphing capability raised in the original design discussion.
- **`rawPayload` (JSONB)** — the bulkiest and least-frequently-queried field, and the one most directly responsible for table bloat at "high-volume and unbounded" scale. Accepted: retain in the hot Postgres row for **90 days** (configurable), then move to cheaper archival storage (Azure Blob Storage, keyed by post ID) and replace the JSONB column's content with a pointer/reference. This preserves §4.2's "never discarded" guarantee — the data still exists and is still traceable to the post it came from — without keeping the heaviest field hot indefinitely.
- **`IngestionRun`** — primarily operational/audit data (ADR-0005's "which process, at what time, with what connector version" trail), not analytical data queried by tenants. Accepted: retain individual run rows for **18 months** (configurable), after which they move to the same archival tier as aged-out `rawPayload`. Because every `SocialPost.acquisitionId` is a foreign key into `IngestionRun` (ADR-0005), archiving (not hard-deleting) is the required approach here — a hard delete would either orphan the FK or require cascading through every post it produced, neither of which is acceptable given `IngestionRun` is meant to be an *immutable* audit anchor.
- **Configurability:** both windows are exposed as configuration (e.g., a per-deployment or per-tenant setting), not hardcoded constants — so changing them going forward is an operational change, not a code change or an ADR amendment.
- **Mechanism:** implement the hot-tier boundary via monthly range partitioning on both `SocialPost` and `IngestionRun` (partitioned by `publishedAt`/`startedAt` respectively). Archival then becomes "detach and export the oldest partition," not a row-by-row delete/update sweep — cheaper, and avoids long-running mutation locks on a high-volume table.

**Explicitly not addressed by this ADR:** tenant offboarding / right-to-erasure requests (e.g. GDPR Article 17). That's a distinct legal/compliance question — who initiates deletion, what "deleted" means for archived/blob-tier data, what the SLA is — that deserves its own decision with input beyond what this ADR can respons‌ibly originate. Flagging it here so it isn't lost, not resolving it.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator / Data Steward (Sole Operator) | Owns storage cost, data governance, and operational retention policy | High | Predictable storage growth, auditable data, no accidental data loss |
| Tenant Admin | Accountable for tenant data and deletion rights | Medium | Clear retention limits and self-service export/deletion path |
| Data Analyst / Tenant User | Builds multi-year topic and author analytics | High | Aggregation fields remain hot and queryable indefinitely |
| Operations / Support Engineer | Investigates ingestion issues and aged post provenance | Medium | Archived `rawPayload` and `IngestionRun` remain retrievable on demand |
| Compliance / Auditor | Verifies data handling and audit-trail integrity | Medium | Audit-anchor records are preserved, not silently purged |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.5 | epic-3-data-model-storage-and-archival.md | As platform operator managing storage cost on an unbounded, high-volume table, I want `rawPayload` and `IngestionRun` moved to cheaper archival storage after... | A `SocialPost` older than 90 days (configurable — see ADR-0018's Amendment Log) has its `rawPayload` replaced by a pointer to archival blob storage, while `t... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `social_posts.rawPayload` | Original full JSON from the source platform | Connector `normalize()` output | Platform Operator | High — raw provider content |
| `social_posts.rawPayload` archival pointer | Reference to the archived blob object, replacing the hot JSONB value | Archival process | Platform Operator | High — same as raw payload |
| `social_posts` aggregation fields (`tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, `enrichment.*`) | Fields required for downstream analytics and multi-year topic graphs | Ingestion normalization | Data Analyst / Product | Mixed — business data |
| `ingestion_runs` operational row | Trigger type, connector version, timing, outcome, and counts | Ingestion scheduler | Platform Operator | Operational — audit |
| `social_posts.acquisitionId` | Foreign reference from a post to its originating `IngestionRun` | Ingestion process | Data Engineer | High — audit provenance |
| `retention.rawPayloadDays` | Configurable hot-retention window for `rawPayload` | Deployment configuration | Platform Operator | Low |
| `retention.ingestionRunMonths` | Configurable hot-retention window for `IngestionRun` | Deployment configuration | Platform Operator | Low |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `SocialPost.rawPayload` shall never be discarded; after it leaves the hot row it must remain in archival storage keyed by the post ID |
| BRU-002 | `IngestionRun` rows shall be archived, not hard-deleted, for active tenants |
| BRU-003 | The hot-retention windows for `rawPayload` and `IngestionRun` are independently configurable |
| BRU-004 | Archival shall operate on whole monthly partitions; partial months remain hot |
| BRU-005 | Every `SocialPost.acquisitionId` reference to an `IngestionRun` must remain resolvable after that run is archived |
| BRU-006 | The only permitted exception to the no-hard-delete rule for `IngestionRun` is a scoped tenant-deletion flow, and only after all `SocialPost` rows referencing the run are also deleted |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0005 — `IngestionRun` as the audit anchor for every post | Internal / Architecture | Data Engineer | Resolved |
| D-002 | ADR-0008 — `TopicDailyCount` (future multi-year topic aggregation) | Internal / Product | Product Owner | Future |
| D-003 | ADR-0007 — `AuthorTopicSignal` (future author/topic analytics) | Internal / Product | Product Owner | Future |
| D-004 | ADR-0039 / ADR-0043 — tenant offboarding and data deletion | Internal / Compliance | Product Owner | Accepted 2026-08-06 / 2026-08-07 |
| D-005 | Azure Blob Storage provisioning and access policy | Infrastructure | Platform Operator | Provisioned |
| D-006 | Monthly range partitioning schema (migration `0012`) | Internal / Data | Data Engineer | Resolved by Story 3.5 |
| D-007 | Story 3.5 — Tiered data retention and archival implementation | Internal / Delivery | Data Engineer | Built 2026-07-30 |

---

- Azure Blob Storage is provisioned and reachable from the application
- `SocialPost` and `IngestionRun` can be range-partitioned by a non-null timestamp column
- The application can enforce, at the application layer, that `SocialPost.acquisitionId` remains resolvable after `IngestionRun` archival

**The durable decision — this is what would need superseding, not just amending:**

Retention is tiered — hot primary storage plus cheaper archival storage — rather than a single uniform retention rule, and the tiering boundary is drawn per field/data-category rather than per table, since different fields within the same table have very different value-over-time profiles. Analytically valuable fields (the ones downstream aggregation depends on) are retained far longer than the bulky, rarely-re-read raw payload. Audit-anchor data (`IngestionRun`) is archived, never hard-deleted, because other rows hold foreign keys into it.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **Aggregation-relevant fields** (`tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, `enrichment.*` excluding raw payload) — retained indefinitely in primary Postgres storage. These are exactly the fields the deferred `TopicDailyCount` (ADR-0008) and `AuthorTopicSignal` (ADR-0007) need, including for the multi-year graphing capability raised in the original design discussion.
- **`rawPayload` (JSONB)** — the bulkiest and least-frequently-queried field, and the one most directly responsible for table bloat at "high-volume and unbounded" scale. Accepted: retain in the hot Postgres row for **90 days** (configurable), then move to cheaper archival storage (Azure Blob Storage, keyed by post ID) and replace the JSONB column's content with a pointer/reference. This preserves §4.2's "never discarded" guarantee — the data still exists and is still traceable to the post it came from — without keeping the heaviest field hot indefinitely.
- **`IngestionRun`** — primarily operational/audit data (ADR-0005's "which process, at what time, with what connector version" trail), not analytical data queried by tenants. Accepted: retain individual run rows for **18 months** (configurable), after which they move to the same archival tier as aged-out `rawPayload`. Because every `SocialPost.acquisitionId` is a foreign key into `IngestionRun` (ADR-0005), archiving (not hard-deleting) is the required approach here — a hard delete would either orphan the FK or require cascading through every post it produced, neither of which is acceptable given `IngestionRun` is meant to be an *immutable* audit anchor.
- **Configurability:** both windows are exposed as configuration (e.g., a per-deployment or per-tenant setting), not hardcoded constants — so changing them going forward is an operational change, not a code change or an ADR amendment.
- **Mechanism:** implement the hot-tier boundary via monthly range partitioning on both `SocialPost` and `IngestionRun` (partitioned by `publishedAt`/`startedAt` respectively). Archival then becomes "detach and export the oldest partition," not a row-by-row delete/update sweep — cheaper, and avoids long-running mutation locks on a high-volume table.

**Explicitly not addressed by this ADR:** tenant offboarding / right-to-erasure requests (e.g. GDPR Article 17). That's a distinct legal/compliance question — who initiates deletion, what "deleted" means for archived/blob-tier data, what the SLA is — that deserves its own decision with input beyond what this ADR can respons‌ibly originate. Flagging it here so it isn't lost, not resolving it.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Retention windows must be changeable without a code deployment | Maintainability | Must | Window values are sourced from environment/deployment configuration and are not compiled constants |
| NFR-002 | Query performance against hot aggregation fields must not degrade as `rawPayload` is archived | Performance | Must | Topic and author aggregation queries continue to use only the hot table; archive is not on the critical read path |
| NFR-003 | Archival must not hold long-running locks on the hot tables | Reliability | Must | Partition `DETACH`/`ATTACH` or equivalent is used; row-level mutation is avoided for bulk archival |
| NFR-004 | Archived `rawPayload` retrieval must be available for support/debug use cases | Usability | Should | A documented path exists to resolve an archived pointer back to the original JSON |
| NFR-005 | `IngestionRun` must not be hard-deleted for active tenants; exceptions are only within an approved tenant-deletion flow | Compliance | Must | No production code path hard-deletes an `IngestionRun` unless it is part of a scoped tenant-deletion job |

---

## 11. Error Handling and Exceptions
**Positive**
- The specific capability the original design conversation anticipated (multi-year topic graphs) stays possible, because the fields it depends on are never purged — only the heaviest, least-reused field (`rawPayload`) is tiered.
- Archiving `IngestionRun` instead of deleting it preserves the "immutable audit anchor" property (ADR-0005) rather than quietly breaking it once rows age out.
- Tiering by field rather than by whole-row deletion means primary storage growth is bounded by the actually-expensive part (raw JSON payloads), not by the analytically valuable part, which is a better fit for this system's own stated future use of the data.

**Negative**
- Requires building and operating an actual archival mechanism (blob export + pointer rewrite, or equivalent) — this is new infrastructure, not a configuration flag, and needs its own implementation design.
- A `SocialPost` older than 90 days no longer has its full raw payload immediately queryable; recovering it means a blob fetch, not a JSONB query. Any tooling that assumed `rawPayload` was always live-queryable (e.g., ad hoc debugging via `rawPayload->>'field'`) needs to account for the two-tier reality.
- The specific numbers (90 days for `rawPayload`, 18 months for `IngestionRun`) are accepted implementation defaults, not derived from any stated requirement in the spec — they may need revisiting once real storage cost data and actual reference patterns for aged raw payloads/runs are available. Being configurable rather than hardcoded lowers the cost of that revision.
- Monthly partitioning is a real schema commitment (partition key choice, partition-maintenance automation) made this early, before there's real volume data to validate the partition granularity against.

## 12. Assumptions and Dependencies
- Azure Blob Storage is provisioned and reachable from the application
- `SocialPost` and `IngestionRun` can be range-partitioned by a non-null timestamp column
- The application can enforce, at the application layer, that `SocialPost.acquisitionId` remains resolvable after `IngestionRun` archival

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Archival export or pointer mechanism fails, causing data loss or orphaned references | Medium | High | Build and contract-test the archive job; keep `rawPayload` in blob with deterministic keys; enforce resolvability at the application layer | Data Engineer |
| R-002 | Aged `rawPayload` is no longer directly JSONB-queryable, breaking ad hoc debugging | Medium | Medium | Document two-tier access; update support tools to fetch from archival pointer when needed | Operations |
| R-003 | Monthly partitioning granularity does not match real ingestion volume patterns | Medium | Medium | Make partition size and retention windows configurable; revisit after real volume data is available | Data Engineer |
| R-004 | Default 90-day / 18-month windows may not reflect actual cost or access patterns | Low | Medium | Keep windows configurable and schedule a post-launch review once cost and query data are available | Data Steward |
| R-005 | Right-to-erasure / tenant offboarding is not addressed by this policy | Medium | High | Rely on ADR-0039 / ADR-0043 and Stories 3.7 / 3.8; track as an explicit dependency | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0018-data-retention-and-archival-policy.md`
- BRD: `../Business-Requirements/BRD-0018-Data-Retention-And-Archival-Policy.md`
- Feature design: `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: _No deep-research report found._
- User stories: see extracted stories above