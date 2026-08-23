# Business Requirements Document — BRD-0010: Error Handling and Auto-Disable Policy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Error Handling and Auto-Disable Policy (ADR-0010) – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Project Owner / Technical Lead |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0010, Design Spec §5, and related user stories |
| 1.0 | 2026-08-19 | BRD Writer Agent | Filled BRD template with accepted decisions, scope, and acceptance criteria |

---

## 2. Executive Summary

SocialEngage’s ingestion pipeline must handle platform failures in a way that protects both the tenant and the platform. Currently, a single broken credential, malformed watchlist, or transient rate-limit can either burn quota through blind retries or produce misleading failures for conditions that self-resolve. This initiative establishes a clear, per-tenant error-handling and auto-disable policy.

The proposed policy distinguishes **retryable** errors (rate limits, transient network failures, 5xx responses) from **non-retryable** errors (401/403 responses, malformed watchlists). Retryable errors are retried automatically with exponential backoff. Non-retryable errors are surfaced immediately, and the connector is marked `failing`. After a sustained rate-relative failure threshold (defined by ADR-0023 and corrected by the 2026-08-12 ADR-0010/0023 Clarification notes), the connector auto-disables for that tenant with a clear reason. OAuth connectors attempt token refresh automatically before the failure is surfaced to the tenant.

All behavior is scoped per tenant: one tenant’s failing or disabled connector must never affect another tenant’s ingestion for the same platform. The result is fewer wasted retries, less operational noise, clearer tenant visibility, and stronger multi-tenant isolation.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate wasted quota on unrecoverable errors | Non-retryable errors (401/403, malformed watchlist) receive zero blind retries and are surfaced within one ingestion attempt |
| 2 | Reduce tenant-visible noise from transient issues | Retryable errors (rate limit, 5xx, network) resolve via automatic retry without creating tenant-facing failures |
| 3 | Ensure per-tenant failure isolation | A second tenant’s connector for the same platform continues ingesting while the first tenant’s connector is auto-disabled (verified by isolation contract test) |
| 4 | Provide clear, actionable connector health visibility | Every auto-disable records and exposes a reason via `ConnectorHealth` that the tenant can act on |
| 5 | Support fair, frequency-aware thresholding | Fast- and slow-polling connectors are judged by failure rate, not a flat count that penalizes low-frequency connectors |

---

## 4. Scope

### 4.1 In Scope

- Classification of ingestion errors into **retryable** and **non-retryable** categories per connector.
- Exponential-backoff automatic retry for retryable errors.
- Immediate `failing` status for non-retryable errors, with no blind retry.
- Automatic OAuth token refresh before surfacing a credential failure to the tenant.
- Per-tenant connector `failing` derivation and auto-disable when the accepted failure threshold is exceeded.
- Clear, tenant-visible reason for the `failing` / auto-disable state.
- Per-tenant isolation: failure state, retry state, and auto-disable are scoped to `(tenantId, platformId)` only.
- Correction of the 2026-08-12 implementation gap: `deriveConnectorHealth()` must exclude retryable failures when counting toward the `failing` / auto-disable threshold.

### 4.2 Out of Scope

- Manual tenant-facing re-enable / activate workflow (covered by ADR-0051 and Story 6.15).
- Per-connector tuning of the numeric threshold defaults (governed by ADR-0023).
- Email, push, or in-app alerting mechanisms for auto-disable events.
- Cross-tenant failure aggregation or operational dashboards.
- Real-time credential validation before connection (an open item tracked in ADR-0051).

### 4.3 Assumptions

- Each connector can classify its own errors into retryable and non-retryable kinds.
- `IngestionRun` records are already persisted with `status`, `error_summary`, and a `retryable` flag.
- Multi-tenant row-level security (ADR-0015) already isolates data by tenant.
- OAuth connectors store refreshable credentials via the envelope-encrypted credential model (ADR-0014).
- `ConnectorHealth` is derived from `ingestion_runs` rather than stored as a mutable entity (ADR-0009).

### 4.4 Constraints

- Auto-disable must never halt another tenant’s ingestion for the same platform.
- Classification rules must be connector-specific because platform error semantics differ.
- The failure threshold must use the rate-relative rule accepted in ADR-0023 (≥50% of ≥5 attempts in a trailing hour, or ≥20 consecutive non-retryable failures).
- All changes must fit the existing `ProviderConnector` framework (ADR-0002) and `IngestionRun` audit model (ADR-0005).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Owns connector credentials and watchlists; must fix non-retryable failures | High | Clear reason when a connector is `failing` or auto-disabled; no false positives from rate limits |
| Tenant User | Consumes ingested posts and analytics | Medium | Continuous ingestion for their tenant; no impact from other tenants’ failures |
| Platform Operator | Runs `social-listening-core` and pays for platform quota | High | Fair resource usage; one tenant cannot degrade another; reduced retry noise |
| Connector Author | Implements platform-specific connectors | High | A clear error-classification contract and verification harness |
| Customer Support (future) | May triage connector health issues | Low-Medium | Traceable failure reasons and run history |

---

## 6. Current State (As-Is)

Ingestion failures today are not uniformly distinguished by recoverability. Without a shared policy:

- A revoked credential or bad watchlist could be retried repeatedly, wasting platform quota and delaying the tenant’s awareness of a problem they must fix themselves.
- A transient rate-limit or 5xx could be treated as a terminal failure, creating unnecessary tenant-visible noise for a condition expected to self-resolve.
- A connector with a broken credential could fail silently and indefinitely, leaving the tenant with no ingestion and no explanation.
- Because failure state is not fully isolated per tenant, one tenant’s failing connector can affect the perception or processing of another tenant sharing the same platform.

The 2026-08-12 clarification confirmed a specific implementation gap: `deriveConnectorHealth()` was not selecting the `retryable` column from `ingestion_runs`, so every failed run counted equally toward the `failing` threshold — including rate-limited runs that should not by themselves trigger auto-disable.

---

## 7. Future State (To-Be)

After this initiative is implemented:

- Every ingestion failure is classified at the connector level as **retryable** or **non-retryable** before it is persisted.
- Retryable errors trigger automatic retries with exponential backoff, bounded by existing rate-limit gating (ADR-0003 / Story 2.2).
- Non-retryable errors immediately mark the tenant-platform connector as `failing`, with a clear reason, and no blind retry is attempted.
- OAuth connectors attempt an automatic token refresh before a 401/403 is surfaced; only a failed refresh becomes a tenant-visible credential failure.
- `ConnectorHealth` is derived from `ingestion_runs` while **excluding retryable failures** from the rate-relative failure count (per the 2026-08-12 ADR-0010/0023 clarification).
- When the accepted failure threshold is crossed, the connector auto-disables for that tenant with a recorded reason.
- All state and behavior are scoped to the individual tenant: another tenant using the same platform continues to ingest without disruption.

**Expected capabilities:**
- Retryable-error backoff and retry.
- Non-retryable-error immediate failing status.
- Automatic OAuth refresh-before-fail.
- Rate-relative, non-retryable-only auto-disable threshold.
- Per-tenant failure and disable isolation.
- Tenant-visible `ConnectorHealth` with reason and run history.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Auto-disable and failure state for one tenant must never affect another tenant. | Reliability / Isolation | Must | Multi-tenant contract test passes and no shared mutable state is used. |
| NFR-002 | Error classification must be extensible per connector without changes to core orchestration. | Maintainability | Must | Adding a new connector requires only local classification rules, not edits to `runIngestionAttempt` or `deriveConnectorHealth`. |
| NFR-003 | `ConnectorHealth` reason and status must be queryable in under one second for the tenant API. | Performance / Usability | Should | 95th-percentile query response time under 1s in contract tests. |
| NFR-004 | Failure classification and auto-disable behavior must be traceable from `ingestion_runs` history. | Auditability / Maintainability | Should | Every `failing` state can be explained by a deterministic query of recent `ingestion_runs`. |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector health status distribution | Track how many connectors are `healthy`, `degraded`, `failing`, or `disconnected` per tenant. | Product team / Platform Ops | Daily |
| Retryable vs. non-retryable error rate | Measure pipeline noise vs. real tenant-fixable problems. | Product team / Platform Ops | Hourly / Daily |
| Auto-disable count per tenant and platform | Identify frequent credential or watchlist issues. | Customer Support / Product team | Weekly |
| Quota impact of avoided blind retries | Estimate platform cost savings from non-retryable classification. | Platform Ops / Finance | Monthly |
| Time from `failing` to tenant action (future) | Understand how quickly tenants resolve surfaced problems. | Product team | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A connector author misclassifies an error as retryable, masking a real tenant-fixable problem. | Medium | High | Provide a documented classification rubric; require per-connector contract tests that assert the `retryable` flag for representative error fixtures. | Connector Author / Tech Lead |
| R-002 | The failure threshold is miscalibrated for a platform with naturally flaky infrastructure, causing unnecessary auto-disables. | Medium | Medium | Use the rate-relative rule (ADR-0023) and exclude retryable failures; review thresholds against real telemetry after launch. | Platform Ops / Product Owner |
| R-003 | An OAuth refresh loop could produce repeated failures if a refresh token is also invalid. | Low | Medium | Treat a failed refresh as a non-retryable credential failure; do not retry the refresh itself. | Platform Engineer |
| R-004 | Tenants do not understand why a connector was auto-disabled and open support tickets. | Medium | Medium | Surface a clear reason via `ConnectorHealth` and link to connector-specific troubleshooting guidance. | Product Owner / UX |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0009: `ConnectorHealth` derived from `ingestion_runs` | Architectural | Project Owner | Already accepted; implementation exists. |
| D-002 | ADR-0023: Proportional, rate-relative failure threshold | Architectural | Project Owner | Already accepted; implemented 2026-07-30. |
| D-003 | ADR-0015: Multi-tenant RLS isolation | Architectural | Project Owner | Already accepted; already shipped. |
| D-004 | ADR-0014: Envelope-encrypted credential storage | Architectural | Project Owner | Already accepted; already shipped. |
| D-005 | ADR-0002: `ProviderConnector` framework and error-classification contract | Architectural | Project Owner | Already accepted; already shipped. |
| D-006 | ADR-0051: Connector activation / deactivation controls | Architectural | Project Owner | Accepted; manual re-enable UI is out of scope for this BRD but related. |

---

## 14. Acceptance Criteria

- A rate-limit, transient network, or 5xx failure triggers exponential-backoff retry and does not by itself mark the connector `failing`.
- A 401/403 or malformed-watchlist error immediately marks the connector `failing` and is not blindly retried.
- An OAuth connector attempts automatic token refresh before a credential failure is surfaced to the tenant.
- A connector auto-disables once the non-retryable failure threshold is crossed, with a clear reason recorded and visible to the tenant.
- A second tenant’s connector for the same platform continues to ingest normally when the first tenant’s connector is auto-disabled.
- `deriveConnectorHealth()` selects `retryable` from `ingestion_runs` and counts only non-retryable failures toward the rate-relative and consecutive-failure thresholds.
- The existing contract tests for Story 2.3, Story 2.5, and Story 2.12 continue to pass under the corrected definition.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Retryable error | An ingestion failure caused by a condition expected to resolve without tenant action, such as a rate limit, transient network issue, or 5xx platform response. |
| Non-retryable error | An ingestion failure caused by a condition that will not resolve by retrying, such as an invalid credential (401/403) or a malformed watchlist, requiring tenant intervention. |
| `ConnectorHealth` | A derived, per-tenant, per-platform status object that reflects recent ingestion success and failure patterns. |
| Auto-disable | The automatic transition of a connector to a `failing` / disabled state for a specific tenant when the accepted non-retryable failure threshold is exceeded. |
| OAuth token refresh | An automatic attempt to obtain a new access token using a stored refresh token before treating an authentication error as tenant-visible. |
| Rate-relative threshold | A failure threshold that compares the number of failures to the number of attempts in a trailing window, rather than using a flat count. |

---

## 16. Appendices

### 16.1 Source Architecture Decision Record

- `docs/adr/0010-error-handling-and-auto-disable-policy.md` (Accepted 2026-07-28; 2026-08-12 Clarification note)

### 16.2 Source Design Specification

- `docs/project docs/2026-07-28-social-listening-ingestion-design.md`, §5 “Error handling”

### 16.3 Product Research

No `docs/product-research/feature-designs/<feature>.md` file or `docs/product-research/reports/<feature>-deep-research.md` file was found for ADR-0010. The ADR’s source material is the Design Spec §5 noted above.

### 16.4 Related Architecture Decision Records

- `docs/adr/0009-connector-health-derived.md`
- `docs/adr/0023-proportional-rate-relative-failure-threshold.md`
- `docs/adr/0003-rate-limiting-policy.md`
- `docs/adr/0015-tenant-isolation-rls.md`
- `docs/adr/0014-credential-envelope-encryption.md`
- `docs/adr/0002-provider-connector-framework.md`
- `docs/adr/0051-connector-activation.md`

### 16.5 Related User Stories

- **Epic 2 – Story 2.3**: *Retryable/non-retryable error handling with per-tenant auto-disable* (ADR-0010)
- **Epic 2 – Story 2.5**: *Proportional, rate-relative connector failure threshold* (ADR-0023)
- **Epic 2 – Story 2.12**: *`deriveConnectorHealth()` excludes retryable failures from the `failing` derivation* (ADR-0010 / ADR-0023 Clarification, 2026-08-12)

### 16.6 Cross-Story Conflict Note

Stories 2.3 and 4.3 were originally built against the flat “≥10 failures/hour” placeholder. ADR-0023 (Story 2.5) superseded that threshold on 2026-07-30 with a rate-relative rule, and Story 2.12 (2026-08-12) corrected the implementation to exclude retryable failures from that threshold. Those notes are captured in this BRD’s business rules, scope, and acceptance criteria.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
