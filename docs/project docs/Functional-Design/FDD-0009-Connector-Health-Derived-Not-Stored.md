# Business Requirements Document: Connector Health Derived from IngestionRun History, Not Stored State

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document: Connector Health Derived from IngestionRun History, Not Stored State |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0009-connector-health-derived-not-stored.md, ../Business-Requirements/BRD-0009-Connector-Health-Derived-Not-Stored.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0009-connector-health-derived-not-stored.md and the business requirements in BRD-0009-Connector-Health-Derived-Not-Stored.md into functional design for **Connector Health Derived Not Stored**.
Tenants and platform operators need an accurate, real-time view of connector status per source. A traditional approach stores `ConnectorHealth` as a mutable record that is updated after every ingestion attempt, but this creates a second source of truth that can drift from actual run outcomes when failures, retries, or concurrent runs occur.

This BRD establishes that `ConnectorHealth` is never stored as independent, mutable state. Instead, all health fields — `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` — are derived by querying `IngestionRun` history at read time. The only health-related state that is read from a separate source is `credentialStatus`, which lives on the `Credential` entity. The expected outcome is a single source of truth for connector operational status, simpler maintenance, and health values that always reflect what actually happened during ingestion.

---

### 2.2 Scope
**In scope:**
- Derivation of `ConnectorHealth` from `IngestionRun` history per `(tenantId, platformId)`.
- Health status categories: `healthy`, `degraded`, `failing`, and `disconnected`.
- Derived fields: `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures`.
- `failing` threshold defined by the rate-relative rule in ADR-0023.
- `credentialStatus` values (`valid`, `expiring_soon`, `expired`, `revoked`) read from `Credential`.
- `GET /v1/connectors` and `GET /v1/connectors/:platformId` returning derived health.
- Tenant-facing and platform-facing connector status displays based on the derived data.

**Out of scope:**
- A persistent `ConnectorHealth` table or row that is independently updated.
- Long-term historical time-series storage of health states.
- Connector auto-disable or retry policies (covered by ADR-0010 / Story 2.3 and ADR-0023 / Story 2.5).
- Read-through caching implementation details (covered by ADR-0022 / Story 4.4).
- Alerting and notification rules beyond the health state itself.

## 3. Context and Background
Tenants and the admin UI need to see connector status (healthy/degraded/failing/disconnected) per `(tenantId, platformId)`. If health were tracked as its own mutable record, it would need to be kept in sync with every ingestion attempt's outcome — a second place that can drift from the actual run history, especially under concurrent runs or partial failures.
Tenants and platform operators need an accurate, real-time view of connector status per source. A traditional approach stores `ConnectorHealth` as a mutable record that is updated after every ingestion attempt, but this creates a second source of truth that can drift from actual run outcomes when failures, retries, or concurrent runs occur.

This BRD establishes that `ConnectorHealth` is never stored as independent, mutable state. Instead, all health fields — `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` — are derived by querying `IngestionRun` history at read time. The only health-related state that is read from a separate source is `credentialStatus`, which lives on the `Credential` entity. The expected outcome is a single source of truth for connector operational status, simpler maintenance, and health values that always reflect what actually happened during ingestion.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate stale or drifting connector health records | `ConnectorHealth` is computed directly from `IngestionRun` rows with no authoritative backing table of its own |
| 2 | Give tenants and operators a trustworthy status signal | A connector that has just failed is never still displayed as `healthy` because of a missed update |
| 3 | Enable threshold tuning without schema migrations | `failing` rule can be redefined by updating derivation logic, with no historical data to rewrite |
| 4 | Keep health reads performant as ingestion volume grows | `GET /v1/connectors` health reads complete within target latency for expected run volume |
| 5 | Preserve clear separation between run health and credential health | `credentialStatus` is always sourced from `Credential`, never from `IngestionRun` outcomes |

---

**Positive consequences (from ADR):**
**Positive**
- Single source of truth: because health is a query over `IngestionRun` (ADR-0005), there is no possibility of health state drifting from what actually happened during ingestion.
- No additional write path or transaction to keep a separate health record consistent with run outcomes — one less place for a bug to cause a tenant to see a stale "healthy" status after failures started.
- The derivation rules are simple enough to express as a query/view, and can be tuned (e.g., the failure threshold) without a data migration since nothing is stored.

**Negative**
- Every health read does aggregation work over recent `IngestionRun` rows rather than a single-row lookup; this needs an index on `(tenantId, platformId, startedAt)` (or similar) to stay cheap as run volume grows, and may warrant caching if `GET /connectors` is polled frequently by the admin UI.
- The failure threshold (10 consecutive failures/hour) is explicitly called out in §10 as a placeholder — changing it retroactively changes historical health interpretations, since nothing was actually stored at the time.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
`ConnectorHealth` is not separately tracked mutable state. `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are all derived from querying `IngestionRun` history at read time:
- `failing`: ≥10 failed runs within the last hour for that `(tenantId, platformId)`
- `degraded`: some recent failures, but a successful run within the last hour
- `disconnected`: no runs recorded
- `healthy`: otherwise

`credentialStatus` (`valid`/`expiring_soon`/`expired`/`revoked`) is the one field on `ConnectorHealth` that is genuinely separate state, living on `Credential` rather than being derived from run history.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Monitors own connectors | High | See an accurate, non-stale status per connected source |
| Sole-Operator | Runs the platform alone | High | Trust health indicators across all tenants without inspecting logs |
| Platform-Admin | Investigates cross-tenant issues | Medium | View connector status without accessing tenant content |
| API Consumer | Builds on `GET /v1/connectors` | Medium | Get reliable, consistent health state from a single endpoint |
| Legal / Compliance | Verifies data handling | Low | Confirm that health views do not leak tenant content |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.12 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant-Admin whose connector is hitting transient rate limits, I want a run of purely retryable failures to never, by itself, trip the connector-level `fa... | `deriveConnectorHealth()`'s query additionally selects `retryable` from `ingestion_runs`.; `recentFailures` and `consecutiveFailures` (the two counters feedi... |
| Story 4.3 | epic-4-derived-data-analytics-and-health.md | As tenant administrator, I want `GET /connectors` to report health computed live from `IngestionRun` history — never a separately stored, independently updat... | `ConnectorHealth` has no backing table of its own (aside from the read-cache in Story 4.4, which is explicitly reconstructable, not authoritative).; `failing... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun` (tenantId, platformId, startedAt, status, postsIngested, postsSkipped, errorSummary) | Append-only audit record of every ingestion attempt | `social-listening-core` ingestion pipeline | Platform / Engineering | Operational metadata |
| `Credential.credentialStatus` | Separate credential lifecycle state: `valid`, `expiring_soon`, `expired`, `revoked` | `Credential` table | Tenant-Admin / Engineering | Credential metadata, not secret material |
| Index on `(tenantId, platformId, startedAt)` | Supports efficient aggregation of recent runs for health derivation | Database schema | Engineering | Operational metadata |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `ConnectorHealth` is never stored as a mutable, authoritative record. |
| BRU-002 | `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are computed exclusively from `IngestionRun` history at read time. |
| BRU-003 | `credentialStatus` is sourced only from the `Credential` entity, not from run outcomes. |
| BRU-004 | The `failing` threshold is the rate-relative rule in ADR-0023, superseding the earlier flat `≥10 failed runs within the last hour` placeholder. |
| BRU-005 | Health reads and displays are tenant-content-free: they must not include posts, watchlists, or user data. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0005 – `IngestionRun` as the audit anchor for every post | Internal / Architecture | Engineering | Already accepted |
| D-002 | ADR-0023 – rate-relative `failing` threshold | Internal / Architecture | Engineering | Already accepted; supersedes ADR-0009 flat placeholder |
| D-003 | ADR-0022 / Story 4.4 – derived-data caching and refresh strategy | Internal / Performance | Engineering | Ready; not required for correctness |
| D-004 | ADR-0010 / Story 2.3 – retryable/non-retryable error handling and auto-disable | Internal / Related feature | Engineering | Already accepted; separate from health derivation |
| D-005 | `Design Spec §5 'Connector Health'` (cited in ADR-0009 but not located as a standalone file) | Source reference | Product Owner | Referenced in ADR only |

---

- `IngestionRun` is the authoritative, append-only audit record of every ingestion attempt (ADR-0005).
- An index exists on `(tenantId, platformId, startedAt)` or equivalent to keep health reads efficient.
- The admin UI polls connector health endpoints for live status.

`ConnectorHealth` is not separately tracked mutable state. `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are all derived from querying `IngestionRun` history at read time:
- `failing`: ≥10 failed runs within the last hour for that `(tenantId, platformId)`
- `degraded`: some recent failures, but a successful run within the last hour
- `disconnected`: no runs recorded
- `healthy`: otherwise

`credentialStatus` (`valid`/`expiring_soon`/`expired`/`revoked`) is the one field on `ConnectorHealth` that is genuinely separate state, living on `Credential` rather than being derived from run history.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `GET /v1/connectors` health reads shall complete within 200ms at the 95th percentile for expected tenant run volume | Performance | Should | Measured under contract test load |
| NFR-002 | The system shall not introduce an independently updatable `ConnectorHealth` store | Maintainability | Must | Schema and code review confirms no backing table or mutable row |
| NFR-003 | Health derivation shall remain correct under concurrent ingestion for the same tenant-platform pair | Reliability | Must | Concurrent run contract test passes |
| NFR-004 | Health endpoints shall enforce multi-tenant isolation | Security | Must | A tenant cannot read another tenant's connector health |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Single source of truth: because health is a query over `IngestionRun` (ADR-0005), there is no possibility of health state drifting from what actually happened during ingestion.
- No additional write path or transaction to keep a separate health record consistent with run outcomes — one less place for a bug to cause a tenant to see a stale "healthy" status after failures started.
- The derivation rules are simple enough to express as a query/view, and can be tuned (e.g., the failure threshold) without a data migration since nothing is stored.

**Negative**
- Every health read does aggregation work over recent `IngestionRun` rows rather than a single-row lookup; this needs an index on `(tenantId, platformId, startedAt)` (or similar) to stay cheap as run volume grows, and may warrant caching if `GET /connectors` is polled frequently by the admin UI.
- The failure threshold (10 consecutive failures/hour) is explicitly called out in §10 as a placeholder — changing it retroactively changes historical health interpretations, since nothing was actually stored at the time.

## 12. Assumptions and Dependencies
- `IngestionRun` is the authoritative, append-only audit record of every ingestion attempt (ADR-0005).
- An index exists on `(tenantId, platformId, startedAt)` or equivalent to keep health reads efficient.
- The admin UI polls connector health endpoints for live status.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Health read cost grows with `IngestionRun` volume and polling frequency | High | Medium | Maintain index on `(tenantId, platformId, startedAt)`; use optional read-through cache per Story 4.4 | Engineering |
| R-002 | Changing the `failing` threshold retroactively reclassifies historical run sequences | Medium | Low | Document threshold version and apply rule at read time; no stored state to rewrite | Product Owner |
| R-003 | Frequent UI polling amplifies read load | Medium | Medium | Implement short-TTL cache (Story 4.4), debounce UI refresh, and monitor latency | Engineering |
| R-004 | Tenants misinterpret `disconnected` as a credential failure | Medium | Low | UI distinguishes `disconnected` (no runs) from `credentialStatus` = `expired`/`revoked` | Product Owner / UX |

---

## 14. Appendix
- ADR: `../../adr/0009-connector-health-derived-not-stored.md`
- BRD: `../Business-Requirements/BRD-0009-Connector-Health-Derived-Not-Stored.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md``
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Deep research: _No deep-research report found._
- User stories: see extracted stories above