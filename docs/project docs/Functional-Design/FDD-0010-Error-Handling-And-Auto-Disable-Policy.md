# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0010 Error Handling and Auto-Disable Policy — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0010-error-handling-and-auto-disable-policy.md, ../Business-Requirements/BRD-0010-Error-Handling-And-Auto-Disable-Policy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0010-error-handling-and-auto-disable-policy.md and the business requirements in BRD-0010-Error-Handling-And-Auto-Disable-Policy.md into functional design for **Error Handling And Auto Disable Policy**.
SocialEngage’s ingestion pipeline must handle platform failures in a way that protects both the tenant and the platform. Currently, a single broken credential, malformed watchlist, or transient rate-limit can either burn quota through blind retries or produce misleading failures for conditions that self-resolve. This initiative establishes a clear, per-tenant error-handling and auto-disable policy.

The proposed policy distinguishes **retryable** errors (rate limits, transient network failures, 5xx responses) from **non-retryable** errors (401/403 responses, malformed watchlists). Retryable errors are retried automatically with exponential backoff. Non-retryable errors are surfaced immediately, and the connector is marked `failing`. After a sustained rate-relative failure threshold (defined by ADR-0023 and corrected by the 2026-08-12 ADR-0010/0023 Clarification notes), the connector auto-disables for that tenant with a clear reason. OAuth connectors attempt token refresh automatically before the failure is surfaced to the tenant.

All behavior is scoped per tenant: one tenant’s failing or disabled connector must never affect another tenant’s ingestion for the same platform. The result is fewer wasted retries, less operational noise, clearer tenant visibility, and stronger multi-tenant isolation.

---

### 2.2 Scope
**In scope:**
- Classification of ingestion errors into **retryable** and **non-retryable** categories per connector.
- Exponential-backoff automatic retry for retryable errors.
- Immediate `failing` status for non-retryable errors, with no blind retry.
- Automatic OAuth token refresh before surfacing a credential failure to the tenant.
- Per-tenant connector `failing` derivation and auto-disable when the accepted failure threshold is exceeded.
- Clear, tenant-visible reason for the `failing` / auto-disable state.
- Per-tenant isolation: failure state, retry state, and auto-disable are scoped to `(tenantId, platformId)` only.
- Correction of the 2026-08-12 implementation gap: `deriveConnectorHealth()` must exclude retryable failures when counting toward the `failing` / auto-disable threshold.

**Out of scope:**
- Manual tenant-facing re-enable / activate workflow (covered by ADR-0051 and Story 6.15).
- Per-connector tuning of the numeric threshold defaults (governed by ADR-0023).
- Email, push, or in-app alerting mechanisms for auto-disable events.
- Cross-tenant failure aggregation or operational dashboards.
- Real-time credential validation before connection (an open item tracked in ADR-0051).

## 3. Context and Background
Ingestion failures have different causes with different correct responses: a rate limit or transient network blip should resolve itself, but an expired credential or malformed watchlist will not resolve by retrying, and retrying it anyway just burns quota and hides a problem the tenant needs to fix. Failures also must stay isolated per tenant per §8, so one tenant's broken connector can't degrade another's.
SocialEngage’s ingestion pipeline must handle platform failures in a way that protects both the tenant and the platform. Currently, a single broken credential, malformed watchlist, or transient rate-limit can either burn quota through blind retries or produce misleading failures for conditions that self-resolve. This initiative establishes a clear, per-tenant error-handling and auto-disable policy.

The proposed policy distinguishes **retryable** errors (rate limits, transient network failures, 5xx responses) from **non-retryable** errors (401/403 responses, malformed watchlists). Retryable errors are retried automatically with exponential backoff. Non-retryable errors are surfaced immediately, and the connector is marked `failing`. After a sustained rate-relative failure threshold (defined by ADR-0023 and corrected by the 2026-08-12 ADR-0010/0023 Clarification notes), the connector auto-disables for that tenant with a clear reason. OAuth connectors attempt token refresh automatically before the failure is surfaced to the tenant.

All behavior is scoped per tenant: one tenant’s failing or disabled connector must never affect another tenant’s ingestion for the same platform. The result is fewer wasted retries, less operational noise, clearer tenant visibility, and stronger multi-tenant isolation.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate wasted quota on unrecoverable errors | Non-retryable errors (401/403, malformed watchlist) receive zero blind retries and are surfaced within one ingestion attempt |
| 2 | Reduce tenant-visible noise from transient issues | Retryable errors (rate limit, 5xx, network) resolve via automatic retry without creating tenant-facing failures |
| 3 | Ensure per-tenant failure isolation | A second tenant’s connector for the same platform continues ingesting while the first tenant’s connector is auto-disabled (verified by isolation contract test) |
| 4 | Provide clear, actionable connector health visibility | Every auto-disable records and exposes a reason via `ConnectorHealth` that the tenant can act on |
| 5 | Support fair, frequency-aware thresholding | Fast- and slow-polling connectors are judged by failure rate, not a flat count that penalizes low-frequency connectors |

---

**Positive consequences (from ADR):**
**Positive**
- Distinguishing retryable from non-retryable errors avoids two failure modes at once: wasting retries (and rate-limit budget, per ADR-0003) on errors that can't self-resolve, and giving up too early on errors that would have cleared on their own.
- Automatic OAuth refresh-before-fail means the common case (an expired-but-refreshable token) never bothers the tenant; only a genuinely broken credential does.
- Auto-disable after a threshold, with the run history it's derived from being visible via `ConnectorHealth` (ADR-0009), means a tenant is never left ingesting nothing with no explanation — the state is `failing`/`disconnected` with a reason, not silence.

**Negative**
- The failure classification (which specific errors are retryable vs. not) has to be implemented per-connector, since what counts as a transient vs. permanent error is platform-specific; a connector author must get this right or risk masking real problems as "just retry" or over-alerting on transient issues.
- The 10-consecutive-failures threshold is a single global placeholder (§10) rather than tuned per platform; a platform with naturally flakier infrastructure could trip auto-disable more often than one that's simply more stable, even when neither indicates a real tenant-facing problem.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall classify every ingestion failure as retryable or non-retryable at the connector level. | Must | Connector classification is persisted on the `ingestion_runs` row and verified for each supported connector. | Connector Author / Platform Engineer |
| BR-002 | The system shall retry retryable errors (rate limit, transient network, 5xx) with exponential backoff. | Must | A contract test confirms a transient failure is retried and does not mark the ingestion as failed. | Platform Engineer |
| BR-003 | The system shall not blindly retry non-retryable errors (401/403, malformed watchlist) and shall mark the connector `failing`. | Must | A contract test confirms a 401/403 or malformed-watchlist error results in immediate `failing` with no further retry. | Platform Engineer |
| BR-004 | The system shall attempt automatic OAuth token refresh before surfacing an auth-related credential failure. | Must | A contract test confirms a refreshable token is retried once; the failure is only surfaced if the refresh itself fails. | Platform Engineer |
| BR-005 | The system shall auto-disable a connector for a tenant after the accepted non-retryable failure threshold is crossed. | Must | Auto-disable is triggered at ≥50% of ≥5 non-retryable attempts in a trailing hour or ≥20 consecutive non-retryable failures. | Platform Engineer |
| BR-006 | The system shall record and expose a clear reason for the `failing` / auto-disable state. | Must | `ConnectorHealth` includes an `error_summary` or reason that the tenant can read and act on. | Product Owner |
| BR-007 | The system shall enforce per-tenant isolation for all failure, retry, and auto-disable state. | Must | An isolation contract test confirms that disabling tenant A’s connector does not affect tenant B’s connector for the same platform. | Platform Engineer |
| BR-008 | The system shall exclude retryable failures from the `failing` / auto-disable threshold. | Must | `deriveConnectorHealth()` selects the `retryable` column and counts only non-retryable failed runs. | Platform Engineer |

### 5.1 Architecture Decision
- **Retryable errors** (rate limit, transient network, 5xx) → exponential backoff, automatic retry.
- **Non-retryable errors** (401/403, malformed watchlist) → immediate `failing` status, surfaced to the tenant, no blind retry.
- OAuth token refresh is attempted automatically before failing; it only surfaces to the user if the refresh itself fails.
- After the failure threshold (§5, §10: 10 consecutive failures as a placeholder) is crossed, the connector auto-disables for that tenant with a clear reason, rather than failing silently and indefinitely.
- All of this isolation is per-tenant: one tenant's failing/expired connector never affects another tenant's ingestion.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Owns connector credentials and watchlists; must fix non-retryable failures | High | Clear reason when a connector is `failing` or auto-disabled; no false positives from rate limits |
| Tenant User | Consumes ingested posts and analytics | Medium | Continuous ingestion for their tenant; no impact from other tenants’ failures |
| Platform Operator | Runs `social-listening-core` and pays for platform quota | High | Fair resource usage; one tenant cannot degrade another; reduced retry noise |
| Connector Author | Implements platform-specific connectors | High | A clear error-classification contract and verification harness |
| Customer Support (future) | May triage connector health issues | Low-Medium | Traceable failure reasons and run history |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.3 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant relying on continuous ingestion, I want transient errors retried automatically with backoff, non-retryable errors surfaced immediately without blin... | Rate-limit hits, transient network failures, and 5xx responses trigger exponential backoff and automatic retry.; 401/403 responses and malformed-watchlist er... |
| Story 2.12 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant-Admin whose connector is hitting transient rate limits, I want a run of purely retryable failures to never, by itself, trip the connector-level `fa... | `deriveConnectorHealth()`'s query additionally selects `retryable` from `ingestion_runs`.; `recentFailures` and `consecutiveFailures` (the two counters feedi... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.retryable` | Boolean or classification flag indicating whether the failed run is retryable. | `runIngestionAttempt` after connector classification. | Connector / Ingestion Pipeline | Operational |
| `ingestion_runs.error_summary` | Human-readable or structured reason for the failure. | Connector at failure time. | Connector / Ingestion Pipeline | Operational |
| `ingestion_runs.status` | Outcome of the run: `success`, `failure`, `skipped`, etc. | Ingestion pipeline. | Ingestion Pipeline | Operational |
| `ConnectorHealth.status` | Derived health label: `healthy`, `degraded`, `failing`, `disconnected`. | Derived from `ingestion_runs` by `deriveConnectorHealth()`. | Health Derivation | Operational |
| `ConnectorHealth.consecutiveFailures` | Count of consecutive non-retryable failures. | Derived from `ingestion_runs`. | Health Derivation | Operational |
| `ConnectorHealth.reason` | Summary reason for `failing` or `disconnected` state. | Derived from `ingestion_runs.error_summary`. | Health Derivation | Operational |
| `credentials.refresh_token` | OAuth refresh token used for automatic token refresh. | Tenant-supplied, envelope-encrypted (ADR-0014). | Tenant / Credential Store | Highly sensitive |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Retryable errors are defined as: rate limit, transient network failure, and HTTP 5xx responses. These are retried automatically with exponential backoff. |
| BRU-002 | Non-retryable errors are defined as: HTTP 401/403 responses and malformed-watchlist errors. These are surfaced immediately and not blindly retried. |
| BRU-003 | For OAuth connectors, a token refresh is attempted automatically before a credential failure is surfaced to the tenant. Only a failed refresh becomes tenant-visible. |
| BRU-004 | The auto-disable threshold counts only non-retryable failed `IngestionRun` rows. Retryable failures do not by themselves cause `failing` or auto-disable. |
| BRU-005 | The auto-disable threshold is the rate-relative rule from ADR-0023: ≥50% of ≥5 non-retryable attempts in the trailing hour, or ≥20 consecutive non-retryable failures. |
| BRU-006 | All failure state, auto-disable state, and run history are scoped per `(tenantId, platformId)`; no cross-tenant leakage is permitted. |
| BRU-007 | When a connector is auto-disabled, the system records a clear reason and makes it visible through `ConnectorHealth`. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0009: `ConnectorHealth` derived from `ingestion_runs` | Architectural | Project Owner | Already accepted; implementation exists. |
| D-002 | ADR-0023: Proportional, rate-relative failure threshold | Architectural | Project Owner | Already accepted; implemented 2026-07-30. |
| D-003 | ADR-0015: Multi-tenant RLS isolation | Architectural | Project Owner | Already accepted; already shipped. |
| D-004 | ADR-0014: Envelope-encrypted credential storage | Architectural | Project Owner | Already accepted; already shipped. |
| D-005 | ADR-0002: `ProviderConnector` framework and error-classification contract | Architectural | Project Owner | Already accepted; already shipped. |
| D-006 | ADR-0051: Connector activation / deactivation controls | Architectural | Project Owner | Accepted; manual re-enable UI is out of scope for this BRD but related. |

---

- Each connector can classify its own errors into retryable and non-retryable kinds.
- `IngestionRun` records are already persisted with `status`, `error_summary`, and a `retryable` flag.
- Multi-tenant row-level security (ADR-0015) already isolates data by tenant.
- OAuth connectors store refreshable credentials via the envelope-encrypted credential model (ADR-0014).
- `ConnectorHealth` is derived from `ingestion_runs` rather than stored as a mutable entity (ADR-0009).

- **Retryable errors** (rate limit, transient network, 5xx) → exponential backoff, automatic retry.
- **Non-retryable errors** (401/403, malformed watchlist) → immediate `failing` status, surfaced to the tenant, no blind retry.
- OAuth token refresh is attempted automatically before failing; it only surfaces to the user if the refresh itself fails.
- After the failure threshold (§5, §10: 10 consecutive failures as a placeholder) is crossed, the connector auto-disables for that tenant with a clear reason, rather than failing silently and indefinitely.
- All of this isolation is per-tenant: one tenant's failing/expired connector never affects another tenant's ingestion.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Auto-disable and failure state for one tenant must never affect another tenant. | Reliability / Isolation | Must | Multi-tenant contract test passes and no shared mutable state is used. |
| NFR-002 | Error classification must be extensible per connector without changes to core orchestration. | Maintainability | Must | Adding a new connector requires only local classification rules, not edits to `runIngestionAttempt` or `deriveConnectorHealth`. |
| NFR-003 | `ConnectorHealth` reason and status must be queryable in under one second for the tenant API. | Performance / Usability | Should | 95th-percentile query response time under 1s in contract tests. |
| NFR-004 | Failure classification and auto-disable behavior must be traceable from `ingestion_runs` history. | Auditability / Maintainability | Should | Every `failing` state can be explained by a deterministic query of recent `ingestion_runs`. |

---

## 11. Error Handling and Exceptions
**Positive**
- Distinguishing retryable from non-retryable errors avoids two failure modes at once: wasting retries (and rate-limit budget, per ADR-0003) on errors that can't self-resolve, and giving up too early on errors that would have cleared on their own.
- Automatic OAuth refresh-before-fail means the common case (an expired-but-refreshable token) never bothers the tenant; only a genuinely broken credential does.
- Auto-disable after a threshold, with the run history it's derived from being visible via `ConnectorHealth` (ADR-0009), means a tenant is never left ingesting nothing with no explanation — the state is `failing`/`disconnected` with a reason, not silence.

**Negative**
- The failure classification (which specific errors are retryable vs. not) has to be implemented per-connector, since what counts as a transient vs. permanent error is platform-specific; a connector author must get this right or risk masking real problems as "just retry" or over-alerting on transient issues.
- The 10-consecutive-failures threshold is a single global placeholder (§10) rather than tuned per platform; a platform with naturally flakier infrastructure could trip auto-disable more often than one that's simply more stable, even when neither indicates a real tenant-facing problem.

## 12. Assumptions and Dependencies
- Each connector can classify its own errors into retryable and non-retryable kinds.
- `IngestionRun` records are already persisted with `status`, `error_summary`, and a `retryable` flag.
- Multi-tenant row-level security (ADR-0015) already isolates data by tenant.
- OAuth connectors store refreshable credentials via the envelope-encrypted credential model (ADR-0014).
- `ConnectorHealth` is derived from `ingestion_runs` rather than stored as a mutable entity (ADR-0009).

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A connector author misclassifies an error as retryable, masking a real tenant-fixable problem. | Medium | High | Provide a documented classification rubric; require per-connector contract tests that assert the `retryable` flag for representative error fixtures. | Connector Author / Tech Lead |
| R-002 | The failure threshold is miscalibrated for a platform with naturally flaky infrastructure, causing unnecessary auto-disables. | Medium | Medium | Use the rate-relative rule (ADR-0023) and exclude retryable failures; review thresholds against real telemetry after launch. | Platform Ops / Product Owner |
| R-003 | An OAuth refresh loop could produce repeated failures if a refresh token is also invalid. | Low | Medium | Treat a failed refresh as a non-retryable credential failure; do not retry the refresh itself. | Platform Engineer |
| R-004 | Tenants do not understand why a connector was auto-disabled and open support tickets. | Medium | Medium | Surface a clear reason via `ConnectorHealth` and link to connector-specific troubleshooting guidance. | Product Owner / UX |

---

## 14. Appendix
- ADR: `../../adr/0010-error-handling-and-auto-disable-policy.md`
- BRD: `../Business-Requirements/BRD-0010-Error-Handling-And-Auto-Disable-Policy.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above