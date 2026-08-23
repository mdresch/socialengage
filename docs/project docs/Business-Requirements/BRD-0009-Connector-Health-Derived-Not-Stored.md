# Business Requirements Document: Connector Health Derived from IngestionRun History, Not Stored State

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Connector Health Derived from IngestionRun History, Not Stored State |
| Version | 1.0 |
| Date | 2026-08-24 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-24 | AI Business & Requirements Analyst | Initial BRD derived from ADR-0009, ADR-0023, Story 4.3, Story 2.5, and Story 6.5 |

---

## 2. Executive Summary

Tenants and platform operators need an accurate, real-time view of connector status per source. A traditional approach stores `ConnectorHealth` as a mutable record that is updated after every ingestion attempt, but this creates a second source of truth that can drift from actual run outcomes when failures, retries, or concurrent runs occur.

This BRD establishes that `ConnectorHealth` is never stored as independent, mutable state. Instead, all health fields — `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` — are derived by querying `IngestionRun` history at read time. The only health-related state that is read from a separate source is `credentialStatus`, which lives on the `Credential` entity. The expected outcome is a single source of truth for connector operational status, simpler maintenance, and health values that always reflect what actually happened during ingestion.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate stale or drifting connector health records | `ConnectorHealth` is computed directly from `IngestionRun` rows with no authoritative backing table of its own |
| 2 | Give tenants and operators a trustworthy status signal | A connector that has just failed is never still displayed as `healthy` because of a missed update |
| 3 | Enable threshold tuning without schema migrations | `failing` rule can be redefined by updating derivation logic, with no historical data to rewrite |
| 4 | Keep health reads performant as ingestion volume grows | `GET /v1/connectors` health reads complete within target latency for expected run volume |
| 5 | Preserve clear separation between run health and credential health | `credentialStatus` is always sourced from `Credential`, never from `IngestionRun` outcomes |

---

## 4. Scope

### 4.1 In Scope

- Derivation of `ConnectorHealth` from `IngestionRun` history per `(tenantId, platformId)`.
- Health status categories: `healthy`, `degraded`, `failing`, and `disconnected`.
- Derived fields: `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures`.
- `failing` threshold defined by the rate-relative rule in ADR-0023.
- `credentialStatus` values (`valid`, `expiring_soon`, `expired`, `revoked`) read from `Credential`.
- `GET /v1/connectors` and `GET /v1/connectors/:platformId` returning derived health.
- Tenant-facing and platform-facing connector status displays based on the derived data.

### 4.2 Out of Scope

- A persistent `ConnectorHealth` table or row that is independently updated.
- Long-term historical time-series storage of health states.
- Connector auto-disable or retry policies (covered by ADR-0010 / Story 2.3 and ADR-0023 / Story 2.5).
- Read-through caching implementation details (covered by ADR-0022 / Story 4.4).
- Alerting and notification rules beyond the health state itself.

### 4.3 Assumptions

- `IngestionRun` is the authoritative, append-only audit record of every ingestion attempt (ADR-0005).
- An index exists on `(tenantId, platformId, startedAt)` or equivalent to keep health reads efficient.
- The admin UI polls connector health endpoints for live status.

### 4.4 Constraints

- Health reads must complete fast enough for a frequently polled admin UI.
- Health endpoints must never expose tenant content (post bodies, watchlist queries, or user data).
- Threshold changes apply at read time and may reclassify historical run sequences.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Monitors own connectors | High | See an accurate, non-stale status per connected source |
| Sole-Operator | Runs the platform alone | High | Trust health indicators across all tenants without inspecting logs |
| Platform-Admin | Investigates cross-tenant issues | Medium | View connector status without accessing tenant content |
| API Consumer | Builds on `GET /v1/connectors` | Medium | Get reliable, consistent health state from a single endpoint |
| Legal / Compliance | Verifies data handling | Low | Confirm that health views do not leak tenant content |

---

## 6. Current State (As-Is)

Connector status could be maintained as a separate, mutable record. After each `IngestionRun` completes, the system would have to update that record in the same transaction or as a follow-up event. Under retries, partial failures, or concurrent runs, the stored record can drift from the true run history, causing a connector to appear healthy after failures have already started or to remain failing after recovery.

---

## 7. Future State (To-Be)

`ConnectorHealth` is computed at read time as a query over recent `IngestionRun` rows for a given `(tenantId, platformId)`. The `failing` rule uses the rate-relative threshold from ADR-0023. `degraded` is reported when there are recent failures but a successful run within the last hour. `disconnected` is reported when no runs have been recorded. `healthy` is reported otherwise. `credentialStatus` is read directly from `Credential`. The tenant and platform admin UIs display the derived status without storing or modifying it.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall derive `ConnectorHealth.status` from `IngestionRun` history per `(tenantId, platformId)` | Must | No separately stored `ConnectorHealth` table is authoritative for status | Product Owner |
| BR-002 | `failing` status shall follow the rate-relative rule: ≥50% of ≥5 attempts failing in the trailing hour, or ≥20 consecutive failures | Must | Matches ADR-0023 acceptance tests and Story 2.5 contract | Product Owner |
| BR-003 | `degraded` status shall be reported when recent failures exist and a successful run occurred within the last hour | Must | Contract test with mixed success/failure sequence passes | Product Owner |
| BR-004 | `disconnected` status shall be reported when no `IngestionRun` rows exist for the tenant-platform pair | Must | New or unrun connector returns `disconnected` | Product Owner |
| BR-005 | `healthy` status shall be reported when none of the above conditions apply | Must | All-success run history returns `healthy` | Product Owner |
| BR-006 | The system shall derive `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` from `IngestionRun` | Must | Values match the latest and count of recent runs in contract tests | Product Owner |
| BR-007 | `credentialStatus` shall be read from the `Credential` entity, not derived from run history | Must | Credential expiry/revocation is independent of run outcomes | Product Owner |
| BR-008 | `GET /v1/connectors` and `GET /v1/connectors/:platformId` shall expose the derived health | Must | Admin UI receives live, non-fixture health data per Story 6.5 | Product Owner |
| BR-009 | Health endpoints shall not expose post bodies, watchlist queries, or user content | Must | Response contains only status, timestamps, counts, and credential status | Product Owner |
| BR-010 | Failure-threshold constants shall be tunable without a data migration | Should | Changing threshold logic does not require rewriting `IngestionRun` rows | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `GET /v1/connectors` health reads shall complete within 200ms at the 95th percentile for expected tenant run volume | Performance | Should | Measured under contract test load |
| NFR-002 | The system shall not introduce an independently updatable `ConnectorHealth` store | Maintainability | Must | Schema and code review confirms no backing table or mutable row |
| NFR-003 | Health derivation shall remain correct under concurrent ingestion for the same tenant-platform pair | Reliability | Must | Concurrent run contract test passes |
| NFR-004 | Health endpoints shall enforce multi-tenant isolation | Security | Must | A tenant cannot read another tenant's connector health |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `ConnectorHealth` is never stored as a mutable, authoritative record. |
| BRU-002 | `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are computed exclusively from `IngestionRun` history at read time. |
| BRU-003 | `credentialStatus` is sourced only from the `Credential` entity, not from run outcomes. |
| BRU-004 | The `failing` threshold is the rate-relative rule in ADR-0023, superseding the earlier flat `≥10 failed runs within the last hour` placeholder. |
| BRU-005 | Health reads and displays are tenant-content-free: they must not include posts, watchlists, or user data. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun` (tenantId, platformId, startedAt, status, postsIngested, postsSkipped, errorSummary) | Append-only audit record of every ingestion attempt | `social-listening-core` ingestion pipeline | Platform / Engineering | Operational metadata |
| `Credential.credentialStatus` | Separate credential lifecycle state: `valid`, `expiring_soon`, `expired`, `revoked` | `Credential` table | Tenant-Admin / Engineering | Credential metadata, not secret material |
| Index on `(tenantId, platformId, startedAt)` | Supports efficient aggregation of recent runs for health derivation | Database schema | Engineering | Operational metadata |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector status distribution per tenant | Identify `failing`/`degraded` sources quickly | Tenant-Admin, Sole-Operator | Real-time / on poll |
| Count of `failing` connectors across the platform | Surface operational incidents | Platform-Admin | Real-time |
| `GET /v1/connectors` read latency | Monitor whether derivation cost stays acceptable | Engineering | Continuous |
| Consecutive-failure count per connector | Triage persistent connector problems | Tenant-Admin, Support | Real-time |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Health read cost grows with `IngestionRun` volume and polling frequency | High | Medium | Maintain index on `(tenantId, platformId, startedAt)`; use optional read-through cache per Story 4.4 | Engineering |
| R-002 | Changing the `failing` threshold retroactively reclassifies historical run sequences | Medium | Low | Document threshold version and apply rule at read time; no stored state to rewrite | Product Owner |
| R-003 | Frequent UI polling amplifies read load | Medium | Medium | Implement short-TTL cache (Story 4.4), debounce UI refresh, and monitor latency | Engineering |
| R-004 | Tenants misinterpret `disconnected` as a credential failure | Medium | Low | UI distinguishes `disconnected` (no runs) from `credentialStatus` = `expired`/`revoked` | Product Owner / UX |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0005 – `IngestionRun` as the audit anchor for every post | Internal / Architecture | Engineering | Already accepted |
| D-002 | ADR-0023 – rate-relative `failing` threshold | Internal / Architecture | Engineering | Already accepted; supersedes ADR-0009 flat placeholder |
| D-003 | ADR-0022 / Story 4.4 – derived-data caching and refresh strategy | Internal / Performance | Engineering | Ready; not required for correctness |
| D-004 | ADR-0010 / Story 2.3 – retryable/non-retryable error handling and auto-disable | Internal / Related feature | Engineering | Already accepted; separate from health derivation |
| D-005 | `Design Spec §5 'Connector Health'` (cited in ADR-0009 but not located as a standalone file) | Source reference | Product Owner | Referenced in ADR only |

---

## 14. Acceptance Criteria

- `ConnectorHealth` has no authoritative backing table; it is purely a derivation from `IngestionRun`.
- A contract test that inserts a known sequence of `IngestionRun` rows and asserts the resulting status for `healthy`, `degraded`, `failing`, and `disconnected` passes without any health-table writes.
- The `failing` rule matches ADR-0023: ≥50% of ≥5 attempts in the trailing hour, or ≥20 consecutive failures.
- `credentialStatus` is sourced from `Credential`, not from run history.
- `GET /v1/connectors` and `GET /v1/connectors/:platformId` return the derived health without tenant content in the response.
- The tenant admin connector status screen renders real `GET /v1/connectors/:platformId` data (Story 6.5).

---

## 15. Glossary

| Term | Definition |
|---|---|
| `ConnectorHealth` | The derived operational status of a connector for a `(tenantId, platformId)` pair. |
| `IngestionRun` | The immutable, append-only record of a single connector ingestion attempt. |
| `Credential` | The stored connector credential, including a `credentialStatus` independent of run outcomes. |
| `failing` | A connector whose recent failure rate or consecutive failures exceed the defined threshold. |
| `degraded` | A connector with recent failures but at least one success within the last hour. |
| `disconnected` | A connector with no recorded `IngestionRun` rows. |
| `healthy` | A connector that does not meet any of the other status conditions. |

---

## 16. Appendices

### Supporting and reference documents

- `docs/adr/0009-connector-health-derived-not-stored.md` — source ADR.
- `docs/adr/0023-rate-relative-connector-failure-threshold.md` — accepted supersession of the `failing` threshold.
- `docs/adr/0005-ingestion-run-as-audit-anchor.md` — `IngestionRun` foundation for health derivation.
- `docs/user-stories/epic-4-derived-data-analytics-and-health.md` — Story 4.3.
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.5.
- `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.5.

### Related feature-design context

- `docs/product-research/feature-designs/01-multi-source-ingestion.md` — ingestion framework and `IngestionRun` anchoring.
- `docs/product-research/feature-designs/17-platform-operations-dashboard.md` — platform-wide health and telemetry context.

### Missing source note

- `Design Spec §5 "Connector Health"` is cited by ADR-0009 as its source, but no matching standalone section or file was located during BRD synthesis. The decision content above is drawn directly from the ADR text and the related user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
