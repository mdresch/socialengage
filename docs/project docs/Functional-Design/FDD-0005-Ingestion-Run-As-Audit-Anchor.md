# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0005 IngestionRun as Audit Anchor — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0005 is Accepted) |
| Related Documents | ADR-0005, ADR-0009, ADR-0015, ADR-0018, BRD-0005, Story 3.2 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0005 (`IngestionRun` as the immutable acquisition/audit anchor for every post) and BRD-0005 into a functional design for how SocialEngage records provenance for every ingested post, and how that record becomes the sole source connector health is derived from.

### 2.2 Scope

- **In scope:** the `IngestionRun` entity and lifecycle (open → ingest → close); the mandatory `SocialPost.acquisitionId` link; immutability of a closed run; how `postsIngested`/`postsSkipped`/`errorSummary`/`retryable` are populated; how a single post's run can be looked up.
- **Out of scope:** the derivation logic that turns `IngestionRun` history into `ConnectorHealth` status (ADR-0009/FDD-0009, which consumes this entity but is designed separately); retention/archival policy for old runs (ADR-0018/FDD-0018); real-time event publication on run state changes (ADR-0012/ADR-0017); per-Page fan-out for Facebook (ADR-0060).

### 2.3 Target Audience

Backend engineers implementing connectors and the ingestion pipeline; operations/support engineers investigating data-quality incidents; the technical lead validating provenance and immutability guarantees.

---

## 3. Context and Background

- **Problem/opportunity:** posts arrive via multiple trigger types (poll or webhook) across many connector versions over time. When something goes wrong with a tenant's data (bad enrichment, unexpected duplicates, a connector bug), the system needs to answer "which process, at what time, with what connector version, brought this data in" for any given post — today, that answer requires reconstructing events from logs, which don't support relational queries or derived health metrics.
- **Business/user value:** a single, immutable, queryable audit trail per post; `ConnectorHealth` derived from real run history instead of separately maintained mutable state, eliminating a class of drift bugs; per-run visibility into ingestion efficiency (`postsIngested`/`postsSkipped`) without scanning the post table.
- **Source requirements:** ADR-0005; BRD-0005 (BR-001–BR-007, BRU-001–BRU-006); Story 3.2 (Epic 3).
- **Constraints/dependencies:** every post insert has a mandatory dependency on an open `IngestionRun` existing first, adding sequencing to the pipeline (create run → ingest posts → close run); `IngestionRun` volume grows with polling frequency × tenant × platform count — retention/archival is explicitly deferred to ADR-0018, not solved here.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Ensure every ingested post has a queryable, immutable provenance record | 100% of `SocialPost` rows have a non-null `acquisitionId` referencing an existing `IngestionRun` |
| G2 | Enable fast root-cause analysis for data-quality incidents | A support engineer retrieves a post's trigger type, connector version, and run status in a single query |
| G3 | Derive connector health from actual run history, not mutable side state | `ConnectorHealth` is computed from `IngestionRun` records (ADR-0009), no separate mutable health state exists |
| G4 | Make ingestion efficiency visible per execution | Every `IngestionRun` reports `postsIngested` and `postsSkipped` without scanning the post table |
| G5 | Preserve audit traceability, including after archival | `IngestionRun` data remains resolvable even after archival per ADR-0018 |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `IngestionRun` open (start of an ingestion execution)

- **Description:** every ingestion execution — a scheduled poll cycle or an incoming webhook/push event — begins by creating a new `IngestionRun` row before any post is written.
- **Triggers:** the ingestion scheduler firing a poll cycle for a `(tenant, connector)` pair, or a push/webhook event arriving from a platform that supports it.
- **Inputs:** `triggerType` (`poll` | `webhook`), `connectorVersion` (the version identifier of the connector code executing this run), `startedAt` (now).
- **Processing:** insert a new `IngestionRun` row with `status` set to an in-progress state, `startedAt` populated, `completedAt`/`postsIngested`/`postsSkipped`/`errorSummary` left unset until close.
- **Outputs:** a new `IngestionRun.id`, which becomes the `acquisitionId` every post produced by this execution will reference.
- **Error handling:** if the run cannot be created (e.g., a database error), the execution must not proceed to insert any posts — BRU-002's ordering ("open before ingest") is a hard precondition, not a best-effort ordering.
- **Edge cases:** a webhook delivering zero posts (e.g., a heartbeat/ping event) still opens and closes a run, with `postsIngested = 0`.

### 5.2 Feature / Capability: Post ingestion linked to the open run

- **Description:** every `SocialPost` produced during an execution is written with a non-null `acquisitionId` pointing at that execution's `IngestionRun`.
- **Triggers:** each individual post the connector's `normalize()` output produces during the open run.
- **Inputs:** the normalized post payload; the currently open run's `id`.
- **Processing:** the post insert sets `SocialPost.acquisitionId = IngestionRun.id`; posts that are filtered out or recognized as duplicates are not inserted but are counted toward the run's `postsSkipped` tally instead.
- **Outputs:** persisted `SocialPost` rows, each traceable to exactly one run.
- **Error handling:** a `SocialPost` insert attempted without a valid `acquisitionId` (or against a run that isn't open) must fail — schema/contract tests enforce this as a hard constraint (BR-004), not a soft validation.
- **Edge cases:** a post that fails enrichment but is still ingested — still counted in `postsIngested` (enrichment failure is separate from ingestion success, per ADR-0010/ADR-0023); a duplicate detected mid-run is counted in `postsSkipped`, not `postsIngested`.

### 5.3 Feature / Capability: `IngestionRun` close (completion of an ingestion execution)

- **Description:** once the execution finishes (successfully or not), the run is closed by populating its remaining fields; the row becomes immutable from that point on.
- **Triggers:** the ingestion execution reaching a terminal state — all posts processed, or an unrecoverable failure encountered.
- **Inputs:** the final counts of `postsIngested`/`postsSkipped`; the outcome `status`; if applicable, an `errorSummary` and a `retryable` classification.
- **Processing:** set `completedAt = now`; set `status` to the terminal outcome (e.g., success, failed, partial); set `postsIngested`/`postsSkipped` to their final counts; if the run ended in a non-success status, record `errorSummary` and whether the failure is `retryable` (BRU-004).
- **Outputs:** a closed, immutable `IngestionRun` row available for provenance lookups and connector-health derivation.
- **Error handling:** once closed, the run is never mutated again — a correction is represented by a new run, never an edit to the closed one (BRU-005/NFR-001).
- **Edge cases:** an execution that crashes before it can explicitly close its run — the run should still resolve to a well-defined terminal state (e.g., a supervising process marks it failed/retryable) rather than being left open indefinitely; the exact recovery mechanism is an implementation detail of the ingestion pipeline, but "runs are never left open forever" is the functional expectation.

### 5.4 Feature / Capability: Single-query provenance lookup

- **Description:** given a `SocialPost`, a support/operations engineer (or a system consumer) can retrieve its originating run's details in one query.
- **Triggers:** a support investigation into a specific post's provenance (e.g., "why does this look like a duplicate," "what connector version produced this").
- **Inputs:** a `SocialPost` identifier.
- **Processing:** join `SocialPost.acquisitionId` to `IngestionRun.id` to retrieve `triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, and (if relevant) `errorSummary`/`retryable`.
- **Outputs:** the full run record associated with that post, without needing to reconstruct it from logs.
- **Error handling:** a post with a broken/missing `acquisitionId` reference should be structurally impossible given BR-003/BR-004's enforced foreign key — this is a data-integrity guarantee, not a query-time special case.
- **Edge cases:** a post whose originating run has since been archived (ADR-0018) — the lookup must still resolve, per G5/NFR-004's "remains resolvable even after archival" requirement.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Ingestion Pipeline (system actor) | Opens, populates, and closes `IngestionRun` rows; links every `SocialPost` to its run |
| Connector (system actor) | Supplies `connectorVersion`, `triggerType`, and normalized post output consumed during the run |
| Operations/Support Engineer | Queries a post's originating run for incident triage |
| Platform Administrator | Monitors connector health, which is derived from `IngestionRun` history (ADR-0009) |
| Data Steward | Owns retention/archival policy applied to `IngestionRun` rows over time (ADR-0018) |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 3.2) | operations/support engineer | have every `SocialPost` linked to an immutable `IngestionRun` record capturing trigger type, connector version, timing, status, counts, and error summary | I can trace any post back to exactly which process, at what time, with what connector version, produced it — without reconstructing it from logs | (1) every `SocialPost` has a non-null `acquisitionId` referencing an existing `IngestionRun`; (2) a run records `triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`/`postsSkipped`, `errorSummary` when applicable; (3) given a post, its run's `connectorVersion` and `triggerType` are retrievable in a single query; (4) `ConnectorHealth` derives from run history with no separate mutable state; (5) runs are immutable once created |

### 6.3 Workflow Diagrams / Steps

**Workflow: A poll-triggered ingestion execution**

1. Scheduler fires a poll cycle for `(tenant, connector)`.
2. Pipeline opens an `IngestionRun`: `triggerType = 'poll'`, `connectorVersion` set, `startedAt = now`, status in-progress.
3. Connector fetches and normalizes posts from the platform.
4. For each normalized post: if new, insert `SocialPost` with `acquisitionId` set to this run; if a duplicate/filtered item, increment `postsSkipped` instead.
5. On completion, close the run: `completedAt = now`, final `postsIngested`/`postsSkipped`, `status` set (success/failed/partial), `errorSummary`/`retryable` populated if not a clean success.
6. Run becomes immutable; any correction is a new run, not an edit.

**Workflow: A webhook-triggered ingestion execution**

1. Platform delivers a push/webhook event.
2. Pipeline opens an `IngestionRun` with `triggerType = 'webhook'`, same as above.
3. Steps 3–6 proceed identically to the poll workflow.

**Workflow: Support engineer traces a post's provenance**

1. Engineer has a `SocialPost` ID from a ticket/incident.
2. Engineer queries the post joined to its `IngestionRun` via `acquisitionId`.
3. Result surfaces `triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, and any `errorSummary`/`retryable` flag — sufficient to triage without touching logs.

---

## 7. Data Requirements

### 7.1 Data Inputs

Connector-supplied `connectorVersion` and normalized post output; scheduler- or webhook-supplied `triggerType`; execution timing and outcome status generated by the pipeline itself.

### 7.2 Data Outputs

`IngestionRun` rows (one per execution); `SocialPost` rows each linked to exactly one run; derived `ConnectorHealth` views (consumed by ADR-0009, not produced here); provenance query results for support/operations use.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `IngestionRun` | `id`, `triggerType` (`poll`\|`webhook`), `connectorVersion`, `startedAt`, `completedAt`, `status`, `postsIngested`, `postsSkipped`, `errorSummary`, `retryable` | One `IngestionRun` produces many `SocialPost` rows; consumed by `ConnectorHealth` derivation (ADR-0009) |
| `SocialPost` | `acquisitionId` (FK to `IngestionRun`, non-null) plus its own per-event fields | Many `SocialPost` rows reference one `IngestionRun` |
| `ConnectorHealth` (referenced, not owned here) | derived view, computed from `IngestionRun` history for a tenant/platform | Reads `IngestionRun`; owned by ADR-0009/FDD-0009 |

### 7.4 Validation Rules

- A `SocialPost` cannot be created without a valid `acquisitionId` referencing an existing `IngestionRun` (BRU-001) — enforced by schema/contract tests, not just application logic (BR-003).
- An `IngestionRun` must be opened before posts are ingested and closed once the execution completes (BRU-002).
- `postsSkipped` includes duplicates, filtered-out items, and any other non-persisted items for that run (BRU-003).
- `errorSummary` is recorded whenever a run completes with a non-success status, including its `retryable` classification (BRU-004).
- `IngestionRun` is immutable after creation — run-level corrections are represented by a new run, never a mutation of an existing one (BRU-005).
- `ConnectorHealth` is derived only from `IngestionRun` records for the relevant tenant and platform (BRU-006).
- `IngestionRun` data is isolated by tenant using RLS (NFR-003).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A `SocialPost` cannot be created without a valid `acquisitionId` referencing an existing `IngestionRun`. | `SocialPost` |
| BR2 | An `IngestionRun` must be opened before posts are ingested and closed once the attempt completes. | Ingestion pipeline |
| BR3 | `postsSkipped` includes duplicates, filtered-out, and otherwise non-persisted items for that run. | `IngestionRun` |
| BR4 | `errorSummary` is recorded when a run completes with a non-success status, including retryable classification. | `IngestionRun` |
| BR5 | `IngestionRun` is immutable after creation; run-level corrections must be represented by a new run. | `IngestionRun` |
| BR6 | `ConnectorHealth` is derived only from `IngestionRun` records for the relevant tenant and platform. | `ConnectorHealth` (ADR-0009) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Ingestion scheduler / webhook handler | Inbound trigger | Initiates `IngestionRun` open with `triggerType`/`connectorVersion` | In-process |
| `SocialConnector.normalize()` (ADR-0002) | Inbound to this model | Supplies normalized post output written under the open run | In-process |
| `ConnectorHealth` derivation (ADR-0009) | Outbound consumer | Reads `IngestionRun` history to compute health status; no data written back | In-process / REST (for status display) |
| Retention/archival (ADR-0018) | Downstream lifecycle | Applies tiered retention to `IngestionRun` rows over time while keeping them resolvable | In-process |
| Postgres with RLS (ADR-0015/ADR-0016) | Storage | Persists `IngestionRun` and `SocialPost`, tenant-isolated | Postgres wire protocol |

---

## 10. Non-Functional Considerations

- **Performance:** a provenance query for a single post should return in under one second for recent data (NFR-002).
- **Security/access control:** `IngestionRun` data is isolated by tenant via RLS (NFR-003); no cross-tenant visibility into another tenant's run history.
- **Scalability:** `IngestionRun` volume grows with polling frequency × tenant × platform count; retention/archival (configurable, not hardcoded — NFR-004) is required before this becomes a storage concern, and is addressed by ADR-0018 rather than here.
- **Reliability/availability:** `postsIngested`/`postsSkipped` counts must be accurate and consistent with the actual rows produced by the run (NFR-005).
- **Audit and logging:** immutability after creation (NFR-001) is itself the audit guarantee — a closed run is never edited, only ever superseded by a new one.
- **Accessibility/localization:** not applicable — internal backend audit entity with no direct UI surface (surfaced indirectly via connector-status screens elsewhere).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `IngestionRun` fails to open (e.g., DB error) | N/A (internal) | Execution must not proceed to insert any posts for that attempt |
| `SocialPost` insert attempted without a valid `acquisitionId` | N/A (caught by schema/contract enforcement) | Insert rejected — hard constraint, not a soft validation |
| Execution crashes before explicitly closing its run | N/A (operational) | Run must still resolve to a well-defined terminal state, not remain open indefinitely |
| Run completes with a non-success status | Surfaced indirectly via connector health/status views | `errorSummary` and `retryable` populated at close; feeds ADR-0009/ADR-0010/ADR-0023 |
| Attempted mutation of an already-closed run | N/A (should be structurally prevented) | Rejected; corrections must be a new run (BR5) |

---

## 12. Assumptions and Dependencies

- Every ingestion execution is initiated by a known connector version and a known trigger type (`poll` or `webhook`).
- Multi-tenant isolation at the database layer is already in place (ADR-0015).
- `IngestionRun` is append-only and immutable; corrections are represented by new runs, not mutations.
- Dependency: ADR-0009 consumes `IngestionRun` history to derive `ConnectorHealth` — this ADR only produces the data, not the derivation logic.
- Dependency: ADR-0018 defines retention/archival policy for `IngestionRun` rows, explicitly out of scope here.
- Dependency: ADR-0002 (connector contract) supplies `connectorVersion` and normalized post output consumed during a run.
- Dependency: ADR-0010/ADR-0023 govern retryable/non-retryable error classification, which `errorSummary`/`retryable` reflect at run close.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What is the exact recovery mechanism for a run left open by a crashed execution (supervising process, timeout-based auto-close, etc.)? | Technical Lead | Implementation detail, not fully specified by this ADR; resolve at build time |
| Q2 | What retention/archival tiers and timings apply to `IngestionRun` rows? | Data Steward | Resolved by ADR-0018/FDD-0018 |

---

## 14. Appendix

- **Glossary:** see BRD-0005 §15 (`IngestionRun`, `acquisitionId`, `ConnectorHealth`, `triggerType`, `connectorVersion`, `postsSkipped`, `retryable`).
- **Reference links:** `docs/adr/0005-ingestion-run-as-audit-anchor.md`; `docs/project docs/Business-Requirements/BRD-0005-Ingestion-Run-As-Audit-Anchor.md`; `docs/user-stories/epic-3-data-model-storage-and-archival.md` (Story 3.2); `docs/adr/0009-connector-health-derived-not-stored.md`; `docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md`; `docs/adr/0018-data-retention-and-archival-policy.md`.
- **Feature design/deep research:** none found — BRD-0005's own "Missing Sources" note confirms no dedicated `docs/product-research/feature-designs/` or `reports/` file exists for ADR-0005; the rationale is captured directly in the design spec (§4.3) and the ADR.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0005/BRD-0005/Story 3.2 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
