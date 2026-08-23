# Business Requirements Document: IngestionRun as the Audit Anchor for Every Post

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Social Listening Platform – IngestionRun as the Audit Anchor for Every Post |
| Version | 1.0 |
| Date | 2026-08-24 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-24 | AI Business & Requirements Analyst | Initial BRD derived from ADR-0005 and Story 3.2 |

---

## 2. Executive Summary

Social posts enter the platform through multiple triggers (scheduled polls, webhooks) and across many connector versions. When data issues arise — duplicate posts, bad enrichment, connector bugs, or unexpected content — the operations team currently has no first-class, queryable record of exactly which process, at what time, and with which connector version, acquired a given post.

This BRD establishes `IngestionRun` as the immutable acquisition and audit anchor for every `SocialPost`. Each ingestion execution will create an `IngestionRun` record that captures trigger type, connector version, start/completion times, status, counts of posts ingested and skipped, an error summary, and a retryable flag. Every `SocialPost` will carry a non-null `acquisitionId` referencing the run that produced it. This design also enables `ConnectorHealth` to be derived from `IngestionRun` history rather than maintained as separate mutable state.

The expected outcome is a fully traceable data pipeline: support and operations staff can answer provenance questions in a single query, the platform can report per-run efficiency, and the system avoids the "black box" problem that motivated the rebuild.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure every ingested post has a queryable, immutable provenance record | 100% of `SocialPost` rows have a non-null `acquisitionId` referencing an existing `IngestionRun` |
| 2 | Enable fast root-cause analysis for data-quality incidents | Support engineer can retrieve a post's trigger type, connector version, and run status in a single query |
| 3 | Derive connector health from actual run history, not mutable side state | `ConnectorHealth` is computed from `IngestionRun` records per ADR-0009 |
| 4 | Make ingestion efficiency visible per execution | Every `IngestionRun` reports `postsIngested` and `postsSkipped` without scanning the post table |
| 5 | Preserve audit traceability for compliance and data ownership | `IngestionRun` data remains queryable and resolvable even after archival per ADR-0018 |

---

## 4. Scope

### 4.1 In Scope

- The `IngestionRun` entity and its required fields: `triggerType`, `connectorVersion`, `startedAt`, `completedAt`, `status`, `postsIngested`, `postsSkipped`, `errorSummary`, and `retryable`.
- The `acquisitionId` foreign key on `SocialPost` that references `IngestionRun`.
- Mandatory creation of an `IngestionRun` before posts can be inserted for that execution.
- Support for both `poll` and `webhook` trigger types.
- Derivation of `ConnectorHealth` from `IngestionRun` history.
- A queryable relationship that lets a support user move from a single `SocialPost` to its originating run in one request.

### 4.2 Out of Scope

- Long-term retention and archival policy for `IngestionRun` rows (defined separately in ADR-0018 and Story 3.5).
- Log-based audit trails as the primary provenance mechanism.
- Storing connector version or trigger type directly on `SocialPost` instead of via `acquisitionId`.
- Real-time event publication on `IngestionRun` state changes (covered by ADR-0012/ADR-0017).
- Per-Page fan-out for Facebook (covered by ADR-0060/Story 6.27).

### 4.3 Assumptions

- Every ingestion execution is initiated by a known connector version and a known trigger type (`poll` or `webhook`).
- Multi-tenant isolation at the database layer is already in place (ADR-0015).
- `IngestionRun` is an append-only, immutable record; corrections are represented by new runs, not mutations.

### 4.4 Constraints

- `IngestionRun` volume grows with polling frequency, tenant count, and platform count.
- A retention/archival decision must be made before storage becomes a concern.
- Closing an `IngestionRun` and inserting its posts is a sequenced pipeline step.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Operations Engineer | Investigates data and ingestion issues | High | One-query traceability from post to run |
| Support Engineer | Handles tenant data-quality tickets | High | Clear trigger type, connector version, and error summary |
| Data Steward / Sole Operator | Owns data governance and retention | High | Immutable, auditable provenance records |
| Platform Administrator | Monitors platform and connector health | Medium | Derived connector health from run history |
| Compliance / Audit | Reviews data handling and traceability | Medium | Persistent, non-repudiable acquisition records |
| Tenant Administrator | Uses connector status and post views | Low | Confidence that platform data is traceable |

---

## 6. Current State (As-Is)

Posts can be created through ingestion, but there is no first-class record of the ingestion execution that produced them. Provenance information is either absent or only available through system logs, which are difficult to query relationally and cannot support derived health metrics. As a result:

- Support staff cannot quickly answer which process, connector version, and trigger type produced a given post.
- Connector health is not derived from actual run history.
- The number of posts skipped or failed per execution is not visible without scanning the post table.
- Root-cause analysis for duplicates, bad enrichment, or connector bugs requires reconstructing events from logs.

---

## 7. Future State (To-Be)

After implementation, the ingestion pipeline will always open an `IngestionRun` before persisting posts, then close that run once the attempt completes. Every `SocialPost` will be linked to the run that produced it via a non-null `acquisitionId`.

Expected capabilities:

- A support engineer can retrieve the originating `IngestionRun` for any post in a single query.
- `ConnectorHealth` is derived from `IngestionRun` history instead of being stored as mutable state.
- Each run reports `postsIngested` and `postsSkipped` for immediate visibility into ingestion efficiency.
- Error summaries are tied to the run that generated them, enabling rapid incident triage.
- The design supports later retention and archival policies without losing the ability to resolve a post's acquisition record.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall create exactly one `IngestionRun` per ingestion execution | Must | A run row exists before any of that execution's posts are inserted | Product Owner |
| BR-002 | `IngestionRun` shall record `triggerType`, `connectorVersion`, `startedAt`, `completedAt`, `status`, `postsIngested`, `postsSkipped`, `errorSummary`, and `retryable` | Must | All fields are populated appropriately on close; `status` is one of a defined set | Product Owner |
| BR-003 | Every `SocialPost` shall have a non-null `acquisitionId` referencing an existing `IngestionRun` | Must | Schema and contract tests reject any post insert without a valid `acquisitionId` | Technical Lead |
| BR-004 | The system shall prevent a `SocialPost` from being created before its `IngestionRun` exists | Must | Insert without a valid `acquisitionId` fails validation or foreign-key constraint | Technical Lead |
| BR-005 | A support engineer shall be able to retrieve a post's originating `IngestionRun` details in a single query | Must | Given a `SocialPost` ID, the run's trigger type, connector version, and status are returned | Product Owner |
| BR-006 | `ConnectorHealth` shall be derived from `IngestionRun` history per ADR-0009 | Must | No mutable `ConnectorHealth` state is required; health is a query over runs | Technical Lead |
| BR-007 | `IngestionRun` shall support both `poll` and `webhook` trigger types | Must | Both trigger types are accepted, valid values are enforced, and the field is queryable | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `IngestionRun` rows are immutable after creation; errors are recorded, not edited | Audit / Compliance | Must | Contract tests demonstrate that an accepted run is never updated in place |
| NFR-002 | Provenance query for a single post returns in under one second for recent data | Performance | Should | Measured against production-like post volume |
| NFR-003 | `IngestionRun` data is isolated by tenant using RLS | Security | Must | RLS policies prevent cross-tenant access to run records |
| NFR-004 | Retention and archival are configurable, not hardcoded | Maintainability | Must | Time-to-archive values are read from configuration (ADR-0018) |
| NFR-005 | `postsIngested` and `postsSkipped` counts per run must be accurate and consistent | Reliability | Must | Skipped/ingested counts match the actual rows produced by the run |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `SocialPost` cannot be created without a valid `acquisitionId` referencing an existing `IngestionRun`. |
| BRU-002 | An `IngestionRun` must be opened before posts are ingested and closed once the attempt completes. |
| BRU-003 | `postsSkipped` includes duplicates, filtered-out, and otherwise non-persisted items for that run. |
| BRU-004 | `errorSummary` is recorded when a run completes with a non-success status, including retryable classification. |
| BRU-005 | `IngestionRun` is immutable after creation; run-level corrections must be represented by a new run. |
| BRU-006 | `ConnectorHealth` is derived only from `IngestionRun` records for the relevant tenant and platform. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun.id` | Unique identifier for the ingestion execution | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.triggerType` | `poll` or `webhook` | Ingestion scheduler / webhook handler | Technical Lead | Operational |
| `IngestionRun.connectorVersion` | Version identifier of the connector that executed the run | Connector framework | Technical Lead | Operational |
| `IngestionRun.startedAt` / `completedAt` | Execution timestamps | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.status` | Outcome of the run (e.g., `success`, `failed`, `partial`) | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.postsIngested` | Count of `SocialPost` rows produced by this run | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.postsSkipped` | Count of items not persisted (e.g., duplicates) | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.errorSummary` | Summary of any errors or failures | Ingestion pipeline | Technical Lead | Operational |
| `IngestionRun.retryable` | Whether the failure is eligible for retry | Ingestion pipeline | Technical Lead | Operational |
| `SocialPost.acquisitionId` | Foreign key to the `IngestionRun` that produced the post | Ingestion pipeline | Technical Lead | Operational |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Ingestion runs by platform and trigger type | Track connector activity and trigger mix | Operations / Platform Admin | Hourly / Daily |
| Posts ingested vs. skipped per run | Measure ingestion efficiency and duplicate rates | Operations / Data Steward | Per run / Hourly |
| Error and retry rate by connector version | Identify problematic connector versions | Operations / Engineering | Daily |
| Connector health derived from run history | Surface platform health and outages | Platform Admin / Tenant Admin | Real-time / Hourly |
| Run audit trail for a given post | Support incident resolution | Support / Operations | Ad hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `IngestionRun` table grows rapidly with polling frequency and tenant count | High | Medium | Implement retention and archival policy per ADR-0018; partition monthly | Data Steward |
| R-002 | Forcing run creation before post insert adds pipeline sequencing complexity | Medium | Medium | Enforce the ordering in the ingestion pipeline and contract tests; keep retries idempotent | Technical Lead |
| R-003 | Querying connector health from run history becomes slow at scale | Medium | Medium | Use indexes and materialized/derived views; partition by time and tenant | Technical Lead |
| R-004 | Retention policy for old runs is not defined in this BRD | Medium | High | Treat ADR-0018 as a dependency and schedule retention before storage concerns arise | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0009: `ConnectorHealth` derived from `IngestionRun` history | Internal / Architecture | Technical Lead | Shipped with Story 3.2 |
| D-002 | ADR-0015: database-level multi-tenant isolation and RLS | Internal / Architecture | Technical Lead | Already accepted |
| D-003 | ADR-0018: tiered retention and archival for `IngestionRun` | Internal / Architecture | Data Steward | Scheduled separately |
| D-004 | Story 3.2 — IngestionRun as the audit anchor for every post | Implementation | Product Owner | Ready |
| D-005 | Design Spec §4.3 "IngestionRun (acquisition tracking)" | Reference | Product Owner | Referenced by ADR-0005 |

---

## 14. Acceptance Criteria

- Every `SocialPost` insert has a non-null `acquisitionId` referencing an existing `IngestionRun`.
- `IngestionRun` records `triggerType` (`poll` / `webhook`), `connectorVersion`, `startedAt`, `completedAt`, `status`, `postsIngested`, `postsSkipped`, and `errorSummary` when applicable.
- Given a `SocialPost` ID, a support engineer can retrieve its originating run's `connectorVersion` and `triggerType` in a single query.
- `ConnectorHealth` is derived from `IngestionRun` history with no separately stored mutable health state.
- `IngestionRun` rows are immutable once created.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **IngestionRun** | An immutable record of a single ingestion execution, capturing how and when a batch of posts was acquired. |
| **acquisitionId** | The foreign key on `SocialPost` that references the `IngestionRun` that produced the post. |
| **ConnectorHealth** | A derived view of a connector's recent status and reliability, computed from `IngestionRun` history. |
| **triggerType** | The mechanism that initiated the ingestion execution — `poll` or `webhook`. |
| **connectorVersion** | The version identifier of the connector code that executed the ingestion. |
| **postsSkipped** | The number of items the ingestion run considered but did not persist (e.g., duplicates or filtered items). |
| **retryable** | A flag indicating whether a failed run is eligible for automatic retry. |

---

## 16. Appendices

### Reference Documents

- [ADR-0005: `IngestionRun` as the immutable acquisition/audit anchor for every post](../../adr/0005-ingestion-run-as-audit-anchor.md)
- [ADR-0009: `ConnectorHealth` is fully derived from `IngestionRun` history](../../adr/0009-connector-health-derived-not-stored.md)
- [ADR-0018: Tiered data retention and archival](../../adr/0018-tiered-data-retention-and-archival.md)
- [Epic 3: Data Model, Storage & Archival – Story 3.2](../../user-stories/epic-3-data-model-storage-and-archival.md)

### Missing Sources

- The ADR cites `Design Spec §4.3 "IngestionRun (acquisition tracking)"` as its source. A dedicated `docs/product-research/feature-designs/<feature>.md` file or `docs/product-research/reports/<feature>-deep-research.md` file for ADR-0005 was not found. The BRD is therefore derived directly from the ADR, the Epic 3 user story, and related ADRs.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
