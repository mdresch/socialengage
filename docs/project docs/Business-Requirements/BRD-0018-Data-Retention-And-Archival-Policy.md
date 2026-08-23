# Business Requirements Document (BRD) — Data Retention and Archival Policy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Social Listening / Insights — Data Retention and Archival Policy Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent (on behalf of Menno, Sole Operator) |
| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0018, Story 3.5, and project context |
| 1.0 | 2026-08-19 | Menno | Approved following the 2026-07-29 ADR-0018 acceptance |

---

## 2. Executive Summary

The platform ingests high volumes of social posts and records every ingestion attempt in `IngestionRun`. By design, `SocialPost` carries an immutable `rawPayload` (the original platform JSON) and `IngestionRun` is an audit anchor for every post. Without a retention policy, these tables grow without bound, threatening primary storage cost, query performance, and the future multi-year topic-aggregation capability the product was designed to support.

This BRD establishes a tiered, field-level retention and archival policy: analytically valuable fields remain hot in Postgres indefinitely, while the heaviest and least-queried data (`rawPayload` and `IngestionRun` rows) move to cheaper archival storage after bounded, configurable windows. The policy preserves the "never discarded" guarantee for raw payloads and the immutable audit-anchor property for ingestion runs, while keeping the cost and performance of primary storage predictable as the platform scales.

The accepted defaults are 90 days for `rawPayload` and 18 months for `IngestionRun`, with both windows exposed as configuration rather than hardcoded constants.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve multi-year topic aggregation and analytics | `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain queryable indefinitely; topic-count graphs can span years |
| 2 | Bound primary Postgres storage growth | Storage growth rate is driven by lightweight aggregation fields, not unbounded raw JSON payloads |
| 3 | Maintain immutable audit traceability for every post | Every `SocialPost.acquisitionId` continues to resolve to its originating `IngestionRun` even after archival |
| 4 | Reduce infrastructure cost without data loss | `rawPayload` and `IngestionRun` rows move to a cheaper storage tier and remain retrievable on demand |
| 5 | Keep retention policy operationally configurable | Changing hot-retention windows requires a configuration change, not a code deployment or ADR amendment |

---

## 4. Scope

### 4.1 In Scope

- Field-level tiered retention for `SocialPost` data: analytically relevant fields retained indefinitely hot; `rawPayload` moved to archival storage after a configurable window
- Archival of `IngestionRun` audit rows after a configurable window, without hard deletion
- Replacement of hot `rawPayload` values with a pointer/reference to the archived object
- Monthly range partitioning of `SocialPost` and `IngestionRun` as the archival mechanism
- Configurable retention windows for `rawPayload` and `IngestionRun`
- Azure Blob Storage as the target archival tier, keyed by post/run identifier
- Retrieval path for archived `rawPayload` to support support/debug investigations

### 4.2 Out of Scope

- Tenant offboarding and GDPR Article 17 right-to-erasure handling (owned by ADR-0039 / ADR-0043 and Stories 3.7 / 3.8)
- Backfill of historical rows that predate the archival feature, unless explicitly requested by a later story
- Hard deletion of archived data for active tenants, except within a scoped tenant-deletion flow
- Real-time latency guarantees for retrieval of archived payloads

### 4.3 Assumptions

- Azure Blob Storage is provisioned and reachable from the application
- `SocialPost` and `IngestionRun` can be range-partitioned by a non-null timestamp column
- The application can enforce, at the application layer, that `SocialPost.acquisitionId` remains resolvable after `IngestionRun` archival

### 4.4 Constraints

- PostgreSQL range-partitioning requires the partition key to be part of the primary key, shaping schema design for `SocialPost`
- `IngestionRun` must never be hard-deleted for an active tenant because `SocialPost.acquisitionId` holds a reference to it
- The default hot-retention windows (90 days / 18 months) are implementation defaults and may be revisited once real cost and access-pattern data are available

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator / Data Steward (Sole Operator) | Owns storage cost, data governance, and operational retention policy | High | Predictable storage growth, auditable data, no accidental data loss |
| Tenant Admin | Accountable for tenant data and deletion rights | Medium | Clear retention limits and self-service export/deletion path |
| Data Analyst / Tenant User | Builds multi-year topic and author analytics | High | Aggregation fields remain hot and queryable indefinitely |
| Operations / Support Engineer | Investigates ingestion issues and aged post provenance | Medium | Archived `rawPayload` and `IngestionRun` remain retrievable on demand |
| Compliance / Auditor | Verifies data handling and audit-trail integrity | Medium | Audit-anchor records are preserved, not silently purged |

---

## 6. Current State (As-Is)

`SocialPost` is designed to be a high-volume, unbounded table and explicitly retains `rawPayload` (the full original platform JSON) forever. `IngestionRun` also grows continuously: one new row is written for every polling or webhook trigger, per tenant, per platform. With many tenants and frequent polling, this creates an ever-growing set of operational/audit rows.

At the same time, the product roadmap anticipates multi-year topic-volume graphs and other long-term aggregations. Because these capabilities depend on `SocialPost.publishedAt` and `enrichment.*` data surviving for years, aggressive whole-row deletion is not an acceptable default. Left unaddressed, primary storage cost and query performance degrade indefinitely.

---

## 7. Future State (To-Be)

The platform operates with a two-tier storage model: a hot Postgres tier for active querying and a cheaper Azure Blob Storage tier for older, less-frequently-accessed data.

- `SocialPost` analytical fields (`tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, `enrichment.*` excluding `rawPayload`) remain in primary Postgres storage indefinitely.
- `SocialPost.rawPayload` is retained hot for a default of 90 days (configurable), then moved to Azure Blob Storage and replaced in the row by a pointer to the archived object.
- `IngestionRun` rows are retained hot for a default of 18 months (configurable), then archived as whole partitions to Azure Blob Storage; the rows are not hard-deleted so `SocialPost.acquisitionId` remains resolvable.
- Both tables use monthly range partitioning. Archival is performed by detaching and exporting the oldest eligible whole partition, avoiding long-running row-by-row mutation.
- Both retention windows are exposed as configuration, so future changes are operational, not architectural.
- Retrieval of archived `rawPayload` or `IngestionRun` data for support, compliance, or tenant-export purposes remains possible through the archival pointer.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | `SocialPost.rawPayload` shall remain hot for a configurable window (default 90 days) and then be moved to cheaper archival storage with its Postgres value replaced by a pointer | Must | A post older than the configured window has `rawPayload` in blob storage and a pointer in the row; hot fields remain queryable | Data Engineer |
| BR-002 | Analytically relevant `SocialPost` fields shall be retained indefinitely in hot Postgres storage | Must | `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain queryable without needing the archive tier | Data Engineer |
| BR-003 | `IngestionRun` rows shall be archived, not hard-deleted, after a configurable window (default 18 months) | Must | Runs older than the window are removed from hot Postgres but remain resolvable through their archived record; no active-tenant run is hard-deleted | Data Engineer |
| BR-004 | Archival shall operate by detaching and exporting whole monthly partitions rather than row-by-row mutation | Should | Oldest eligible partition is exported to blob and detached; no long row-by-row `UPDATE`/`DELETE` runs against hot tables | Data Engineer |
| BR-005 | Both the `rawPayload` and `IngestionRun` hot-retention windows shall be exposed as configuration | Must | Time-to-archive values are read from configuration; changing them does not require a code change | Platform Operator |
| BR-006 | Archived `rawPayload` shall remain retrievable through the pointer, preserving the "never discarded" guarantee | Must | A support or export flow can fetch the original raw JSON from the archival pointer | Data Engineer |
| BR-007 | The archival target shall be object/blob storage keyed by the post or run identifier | Should | Blob names are deterministic and traceable back to the original hot-row identifier | Data Engineer |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Retention windows must be changeable without a code deployment | Maintainability | Must | Window values are sourced from environment/deployment configuration and are not compiled constants |
| NFR-002 | Query performance against hot aggregation fields must not degrade as `rawPayload` is archived | Performance | Must | Topic and author aggregation queries continue to use only the hot table; archive is not on the critical read path |
| NFR-003 | Archival must not hold long-running locks on the hot tables | Reliability | Must | Partition `DETACH`/`ATTACH` or equivalent is used; row-level mutation is avoided for bulk archival |
| NFR-004 | Archived `rawPayload` retrieval must be available for support/debug use cases | Usability | Should | A documented path exists to resolve an archived pointer back to the original JSON |
| NFR-005 | `IngestionRun` must not be hard-deleted for active tenants; exceptions are only within an approved tenant-deletion flow | Compliance | Must | No production code path hard-deletes an `IngestionRun` unless it is part of a scoped tenant-deletion job |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `SocialPost.rawPayload` shall never be discarded; after it leaves the hot row it must remain in archival storage keyed by the post ID |
| BRU-002 | `IngestionRun` rows shall be archived, not hard-deleted, for active tenants |
| BRU-003 | The hot-retention windows for `rawPayload` and `IngestionRun` are independently configurable |
| BRU-004 | Archival shall operate on whole monthly partitions; partial months remain hot |
| BRU-005 | Every `SocialPost.acquisitionId` reference to an `IngestionRun` must remain resolvable after that run is archived |
| BRU-006 | The only permitted exception to the no-hard-delete rule for `IngestionRun` is a scoped tenant-deletion flow, and only after all `SocialPost` rows referencing the run are also deleted |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Monthly archival volume (raw payloads and runs exported) | Track how much data is leaving the hot tier | Platform Operator | Monthly |
| Hot vs. archived storage size and cost | Manage infrastructure spend | Platform Operator / Finance | Monthly |
| Query latency for hot aggregation fields | Verify analytical read performance | Data Engineer | Weekly |
| Archived `rawPayload` retrieval count | Monitor support and debug access to the archive tier | Operations | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Archival export or pointer mechanism fails, causing data loss or orphaned references | Medium | High | Build and contract-test the archive job; keep `rawPayload` in blob with deterministic keys; enforce resolvability at the application layer | Data Engineer |
| R-002 | Aged `rawPayload` is no longer directly JSONB-queryable, breaking ad hoc debugging | Medium | Medium | Document two-tier access; update support tools to fetch from archival pointer when needed | Operations |
| R-003 | Monthly partitioning granularity does not match real ingestion volume patterns | Medium | Medium | Make partition size and retention windows configurable; revisit after real volume data is available | Data Engineer |
| R-004 | Default 90-day / 18-month windows may not reflect actual cost or access patterns | Low | Medium | Keep windows configurable and schedule a post-launch review once cost and query data are available | Data Steward |
| R-005 | Right-to-erasure / tenant offboarding is not addressed by this policy | Medium | High | Rely on ADR-0039 / ADR-0043 and Stories 3.7 / 3.8; track as an explicit dependency | Product Owner |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- AC1: A `SocialPost` older than the configured `rawPayload` hot-retention window has its `rawPayload` replaced by an archival pointer, while `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain live and queryable.
- AC2: An `IngestionRun` older than the configured run hot-retention window is archived, not hard-deleted, and every `SocialPost.acquisitionId` referencing it continues to resolve.
- AC3: Both retention windows are read from configuration rather than hardcoded constants; changing them does not require a code change.
- AC4: `SocialPost` and `IngestionRun` are partitioned monthly, and archival operates by detaching and exporting the oldest eligible partition.
- AC5: Fetching an archived `rawPayload` through its pointer succeeds, confirming the "never discarded" guarantee still holds after archival.
- AC6: For active tenants, no `IngestionRun` row is hard-deleted.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Archival storage | A cheaper object/blob tier (Azure Blob Storage) used for data that is no longer needed in the hot query path |
| Hot storage | The primary PostgreSQL database tier used for active queries and aggregations |
| `rawPayload` | The full original JSON returned by the source platform, stored with every `SocialPost` |
| `IngestionRun` | An immutable record of an ingestion attempt, including trigger type, connector version, timing, and outcome |
| Monthly range partitioning | Dividing a table into partitions by month so an entire month can be detached and archived as one unit |
| Pointer / reference | A value stored in the hot row that identifies the archived object containing the original data |
| Aggregation-relevant fields | The `SocialPost` fields required for downstream analytics, dashboards, and multi-year topic graphs |
| Tenant offboarding | The export and deletion of a departed tenant's data, handled separately under ADR-0039 / ADR-0043 |

---

## 16. Appendices

### Reference documents

- [ADR-0018: Data retention and archival policy](../../adr/0018-data-retention-and-archival-policy.md)
- [Epic 3: Data Model, Storage & Archival — Story 3.5](../../user-stories/epic-3-data-model-storage-and-archival.md)
- [ADR-0005: IngestionRun as the audit anchor for every post](../../adr/0005-ingestion-run-as-audit-anchor.md)
- [ADR-0008: TopicDailyCount](../../adr/0008-topic-daily-count.md)
- [ADR-0007: AuthorTopicSignal](../../adr/0007-author-topic-signal.md)
- [ADR-0039: Tenant offboarding data lifecycle: export and deletion](../../adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md)
- [ADR-0043: Self-service, Tenant-Admin-initiated tenant deletion](../../adr/0043-self-service-tenant-admin-initiated-tenant-deletion.md)

### Missing source note

No dedicated product-research feature-design or deep-research brief exists for ADR-0018. The requirement was surfaced from the `SocialPost` / `IngestionRun` data-model design and from ADR-0005's negative consequences, not from a pre-existing feature-design document. This BRD therefore draws its scope, rules, and acceptance criteria from the ADR itself and from the related `epic-3-data-model-storage-and-archival.md` user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Data Steward / Sole Operator | Menno | | 2026-08-19 |
