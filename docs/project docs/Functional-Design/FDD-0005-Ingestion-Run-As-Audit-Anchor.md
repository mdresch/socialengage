# Business Requirements Document: IngestionRun as the Audit Anchor for Every Post

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document: IngestionRun as the Audit Anchor for Every Post |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0005-ingestion-run-as-audit-anchor.md, ../Business-Requirements/BRD-0005-Ingestion-Run-As-Audit-Anchor.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0005-ingestion-run-as-audit-anchor.md and the business requirements in BRD-0005-Ingestion-Run-As-Audit-Anchor.md into functional design for **Ingestion Run As Audit Anchor**.
Social posts enter the platform through multiple triggers (scheduled polls, webhooks) and across many connector versions. When data issues arise — duplicate posts, bad enrichment, connector bugs, or unexpected content — the operations team currently has no first-class, queryable record of exactly which process, at what time, and with which connector version, acquired a given post.

This BRD establishes `IngestionRun` as the immutable acquisition and audit anchor for every `SocialPost`. Each ingestion execution will create an `IngestionRun` record that captures trigger type, connector version, start/completion times, status, counts of posts ingested and skipped, an error summary, and a retryable flag. Every `SocialPost` will carry a non-null `acquisitionId` referencing the run that produced it. This design also enables `ConnectorHealth` to be derived from `IngestionRun` history rather than maintained as separate mutable state.

The expected outcome is a fully traceable data pipeline: support and operations staff can answer provenance questions in a single query, the platform can report per-run efficiency, and the system avoids the "black box" problem that motivated the rebuild.

---

### 2.2 Scope
**In scope:**
- The `IngestionRun` entity and its required fields: `triggerType`, `connectorVersion`, `startedAt`, `completedAt`, `status`, `postsIngested`, `postsSkipped`, `errorSummary`, and `retryable`.
- The `acquisitionId` foreign key on `SocialPost` that references `IngestionRun`.
- Mandatory creation of an `IngestionRun` before posts can be inserted for that execution.
- Support for both `poll` and `webhook` trigger types.
- Derivation of `ConnectorHealth` from `IngestionRun` history.
- A queryable relationship that lets a support user move from a single `SocialPost` to its originating run in one request.

**Out of scope:**
- Long-term retention and archival policy for `IngestionRun` rows (defined separately in ADR-0018 and Story 3.5).
- Log-based audit trails as the primary provenance mechanism.
- Storing connector version or trigger type directly on `SocialPost` instead of via `acquisitionId`.
- Real-time event publication on `IngestionRun` state changes (covered by ADR-0012/ADR-0017).
- Per-Page fan-out for Facebook (covered by ADR-0060/Story 6.27).

## 3. Context and Background
Posts arrive via multiple trigger types (poll or webhook) across many connector versions over time. When something goes wrong with a tenant's data (bad enrichment, unexpected duplicates, a connector bug), the system needs to answer "which process, at what time, with what connector version, brought this data in" for any given post. Connector health (ADR-0009) also needs a historical record to derive status from.
Social posts enter the platform through multiple triggers (scheduled polls, webhooks) and across many connector versions. When data issues arise — duplicate posts, bad enrichment, connector bugs, or unexpected content — the operations team currently has no first-class, queryable record of exactly which process, at what time, and with which connector version, acquired a given post.

This BRD establishes `IngestionRun` as the immutable acquisition and audit anchor for every `SocialPost`. Each ingestion execution will create an `IngestionRun` record that captures trigger type, connector version, start/completion times, status, counts of posts ingested and skipped, an error summary, and a retryable flag. Every `SocialPost` will carry a non-null `acquisitionId` referencing the run that produced it. This design also enables `ConnectorHealth` to be derived from `IngestionRun` history rather than maintained as separate mutable state.

The expected outcome is a fully traceable data pipeline: support and operations staff can answer provenance questions in a single query, the platform can report per-run efficiency, and the system avoids the "black box" problem that motivated the rebuild.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure every ingested post has a queryable, immutable provenance record | 100% of `SocialPost` rows have a non-null `acquisitionId` referencing an existing `IngestionRun` |
| 2 | Enable fast root-cause analysis for data-quality incidents | Support engineer can retrieve a post's trigger type, connector version, and run status in a single query |
| 3 | Derive connector health from actual run history, not mutable side state | `ConnectorHealth` is computed from `IngestionRun` records per ADR-0009 |
| 4 | Make ingestion efficiency visible per execution | Every `IngestionRun` reports `postsIngested` and `postsSkipped` without scanning the post table |
| 5 | Preserve audit traceability for compliance and data ownership | `IngestionRun` data remains queryable and resolvable even after archival per ADR-0018 |

---

**Positive consequences (from ADR):**
**Positive**
- Provides a single, immutable audit trail per post: exactly which run, connector version, and trigger type produced it, without needing to reconstruct this from logs.
- `ConnectorHealth` (ADR-0009) can be entirely derived from `IngestionRun` history instead of being separately tracked mutable state, eliminating a class of drift bugs.
- `postsSkipped` (e.g., duplicates) on the run record gives visibility into ingestion efficiency per run without scanning the post table.

**Negative**
- Every post insert has a mandatory dependency on an open `IngestionRun` row existing first, which adds a bit of sequencing to the ingestion pipeline (create run → ingest posts → close run).
- `IngestionRun` volume grows with polling frequency × tenant × platform count; retention/archival policy for old runs isn't addressed in this spec and will need a decision before it becomes a storage concern.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
Every ingestion execution creates an `IngestionRun` record (`triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`/`postsSkipped`, `errorSummary`, `retryable`). Every `SocialPost` carries an `acquisitionId` foreign key to the `IngestionRun` that produced it.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Operations Engineer | Investigates data and ingestion issues | High | One-query traceability from post to run |
| Support Engineer | Handles tenant data-quality tickets | High | Clear trigger type, connector version, and error summary |
| Data Steward / Sole Operator | Owns data governance and retention | High | Immutable, auditable provenance records |
| Platform Administrator | Monitors platform and connector health | Medium | Derived connector health from run history |
| Compliance / Audit | Reviews data handling and traceability | Medium | Persistent, non-repudiable acquisition records |
| Tenant Administrator | Uses connector status and post views | Low | Confidence that platform data is traceable |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.2 | epic-3-data-model-storage-and-archival.md | As operations engineer investigating a data issue, I want every `SocialPost` linked via `acquisitionId` to the `IngestionRun` that produced it, with that run... | Every `SocialPost` insert has a non-null `acquisitionId` referencing an existing `IngestionRun`.; `IngestionRun` records `triggerType` (`poll`/`webhook`), `c... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A `SocialPost` cannot be created without a valid `acquisitionId` referencing an existing `IngestionRun`. |
| BRU-002 | An `IngestionRun` must be opened before posts are ingested and closed once the attempt completes. |
| BRU-003 | `postsSkipped` includes duplicates, filtered-out, and otherwise non-persisted items for that run. |
| BRU-004 | `errorSummary` is recorded when a run completes with a non-success status, including retryable classification. |
| BRU-005 | `IngestionRun` is immutable after creation; run-level corrections must be represented by a new run. |
| BRU-006 | `ConnectorHealth` is derived only from `IngestionRun` records for the relevant tenant and platform. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0009: `ConnectorHealth` derived from `IngestionRun` history | Internal / Architecture | Technical Lead | Shipped with Story 3.2 |
| D-002 | ADR-0015: database-level multi-tenant isolation and RLS | Internal / Architecture | Technical Lead | Already accepted |
| D-003 | ADR-0018: tiered retention and archival for `IngestionRun` | Internal / Architecture | Data Steward | Scheduled separately |
| D-004 | Story 3.2 — IngestionRun as the audit anchor for every post | Implementation | Product Owner | Ready |
| D-005 | Design Spec §4.3 "IngestionRun (acquisition tracking)" | Reference | Product Owner | Referenced by ADR-0005 |

---

- Every ingestion execution is initiated by a known connector version and a known trigger type (`poll` or `webhook`).
- Multi-tenant isolation at the database layer is already in place (ADR-0015).
- `IngestionRun` is an append-only, immutable record; corrections are represented by new runs, not mutations.

Every ingestion execution creates an `IngestionRun` record (`triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`/`postsSkipped`, `errorSummary`, `retryable`). Every `SocialPost` carries an `acquisitionId` foreign key to the `IngestionRun` that produced it.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `IngestionRun` rows are immutable after creation; errors are recorded, not edited | Audit / Compliance | Must | Contract tests demonstrate that an accepted run is never updated in place |
| NFR-002 | Provenance query for a single post returns in under one second for recent data | Performance | Should | Measured against production-like post volume |
| NFR-003 | `IngestionRun` data is isolated by tenant using RLS | Security | Must | RLS policies prevent cross-tenant access to run records |
| NFR-004 | Retention and archival are configurable, not hardcoded | Maintainability | Must | Time-to-archive values are read from configuration (ADR-0018) |
| NFR-005 | `postsIngested` and `postsSkipped` counts per run must be accurate and consistent | Reliability | Must | Skipped/ingested counts match the actual rows produced by the run |

---

## 11. Error Handling and Exceptions
**Positive**
- Provides a single, immutable audit trail per post: exactly which run, connector version, and trigger type produced it, without needing to reconstruct this from logs.
- `ConnectorHealth` (ADR-0009) can be entirely derived from `IngestionRun` history instead of being separately tracked mutable state, eliminating a class of drift bugs.
- `postsSkipped` (e.g., duplicates) on the run record gives visibility into ingestion efficiency per run without scanning the post table.

**Negative**
- Every post insert has a mandatory dependency on an open `IngestionRun` row existing first, which adds a bit of sequencing to the ingestion pipeline (create run → ingest posts → close run).
- `IngestionRun` volume grows with polling frequency × tenant × platform count; retention/archival policy for old runs isn't addressed in this spec and will need a decision before it becomes a storage concern.

## 12. Assumptions and Dependencies
- Every ingestion execution is initiated by a known connector version and a known trigger type (`poll` or `webhook`).
- Multi-tenant isolation at the database layer is already in place (ADR-0015).
- `IngestionRun` is an append-only, immutable record; corrections are represented by new runs, not mutations.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `IngestionRun` table grows rapidly with polling frequency and tenant count | High | Medium | Implement retention and archival policy per ADR-0018; partition monthly | Data Steward |
| R-002 | Forcing run creation before post insert adds pipeline sequencing complexity | Medium | Medium | Enforce the ordering in the ingestion pipeline and contract tests; keep retries idempotent | Technical Lead |
| R-003 | Querying connector health from run history becomes slow at scale | Medium | Medium | Use indexes and materialized/derived views; partition by time and tenant | Technical Lead |
| R-004 | Retention policy for old runs is not defined in this BRD | Medium | High | Treat ADR-0018 as a dependency and schedule retention before storage concerns arise | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0005-ingestion-run-as-audit-anchor.md`
- BRD: `../Business-Requirements/BRD-0005-Ingestion-Run-As-Audit-Anchor.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above