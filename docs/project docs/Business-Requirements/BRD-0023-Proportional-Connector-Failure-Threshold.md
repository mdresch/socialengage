# Business Requirements Document (BRD) — Proportional Connector Failure Threshold

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Proportional (Rate-Relative) Connector Failure Threshold |
| ADR | ADR-0023 |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial BRD derived from ADR-0023 and related user stories |

---

## 2. Executive Summary

**What problem are we solving?**  
The existing auto-disable rule treats every connector as if it runs at the same frequency: “≥10 failed ingestion runs in the last hour.” A fast-polling connector that attempts 200 polls per hour and hits 10 transient failures (5%) looks identical to a slow-polling connector that attempts 10 polls and fails every single one (100%). This flat count conflates a minor blip with a genuinely broken connector and can cause unfair, premature auto-disables for high-frequency sources.

**Who is affected?**  
Tenant administrators and platform operators who rely on `ConnectorHealth` to decide whether a connector is healthy, degraded, or failing. It also affects tenants whose high-frequency connectors may otherwise be disabled on noise.

**What is the proposed solution at a glance?**  
Replace the flat failure count with a rate-relative threshold that is evaluated per `(tenantId, platformId)` over a trailing 1-hour window: a connector becomes `failing` when at least 50% of its attempts in that window failed **and** at least 5 attempts occurred in the window. A hard 20-consecutive-failure absolute ceiling is retained as a backstop for slow or low-volume connectors. Retryable failures (rate-limit, network, 5xx) are excluded from the counts, and the absolute-ceiling path must support a bounded half-open probe so a fixed connector can recover.

**What business value do we expect?**  
Fairer, more defensible health judgments across connectors with different polling cadences; fewer false-positive auto-disables; and faster, bounded detection of truly broken low-frequency connectors. This reduces tenant-visible disruption, protects quota from wasted retries, and lowers support burden.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce false-positive auto-disables for high-frequency, mostly-healthy connectors | Number of `failing` transitions caused by <50% failure-rate blips in the trailing hour trends to zero |
| 2 | Detect persistently broken low-frequency connectors within bounded time | Any connector that fails every run is marked `failing` within 20 consecutive non-retryable failures or the rate rule, whichever is earlier |
| 3 | Align connector health judgment with actual attempt volume | Fast- and slow-polling connectors under equivalent failure conditions reach `failing` status consistently in contract tests |
| 4 | Preserve per-tenant isolation and existing `degraded` semantics | One tenant’s connector status cannot cause another tenant’s same-platform connector to change |

---

## 4. Scope

### 4.1 In Scope

- Replacing the flat “≥10 failures/hour” `failing` derivation for `ConnectorHealth` with a rate-relative rule.
- Evaluation window: trailing 1 hour, scoped to a single `(tenantId, platformId)` pair.
- Launch defaults: ≥50% of attempts failed **and** ≥5 attempts in the window; or ≥20 consecutive non-retryable failures.
- Excluding `retryable` failed `IngestionRun`s from both the rate and the consecutive-failure counts.
- A bounded half-open probe/recovery path for connectors that tripped the 20-consecutive-failure ceiling.
- Updates to the existing contracts for Story 2.3 (auto-disable wiring) and Story 4.3 (derived health) where those contracts depended on the superseded flat threshold.
- Multi-tenant isolation: a connector failure for one tenant must not affect another tenant’s same platform connector.

### 4.2 Out of Scope

- Varying the threshold by `deliveryMode` (push vs. poll) — deferred until a push-mode connector is actually on the roadmap.
- Changing the definition of `degraded` or `healthy`.
- Adding a dedicated persisted `ConnectorHealth` table; health remains derived from `IngestionRun` history.
- UI-level health visualization changes (covered by other stories/epics).
- Retuning the 50% / 5-attempt / 20-consecutive numeric defaults without an Amendment Log entry.

### 4.3 Assumptions

- Every `IngestionRun` row records `status`, `retryable`, `tenantId`, `platformId`, and an attempt timestamp.
- The current connector roster is poll-mode; push-mode handling is intentionally deferred.
- Existing Stories 2.3 and 4.3 have already shipped with the flat rule; this change will heal their contracts rather than silently rewrite them.

### 4.4 Constraints

- Must partially supersede only the flat threshold clauses of ADR-0009 and ADR-0010; nothing else in those ADRs may change.
- Must remain backward-compatible with the read-cache architecture in Story 4.4.
- Must not introduce any persistent authoritative health table.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Monitors connector health, reactivates or reconnects failing connectors | High | Fair, accurate status; clear reason when auto-disabled |
| Platform Operations | Operates ingestion fleet, triages rate limits and outages | High | Health signal that reflects real attempt volume and error class |
| Product Owner | Owns connector reliability roadmap | Medium | Bounded, tunable policy that can be improved with real traffic data |
| Support / Customer Success | Handles tenant tickets about stopped ingestion | Medium | Fewer false-positive “connector down” incidents |
| Development / Architecture | Implements and tests `deriveConnectorHealth()` | High | Clear rules, explicit numeric defaults, recovery behavior |

---

## 6. Current State (As-Is)

**Current process:**
1. Each ingestion attempt writes a row to `ingestion_runs` with a success or failed status.
2. `deriveConnectorHealth()` counts failed runs in the last hour and marks the connector `failing` when it sees ≥10 failures in that hour.
3. `shouldAttemptIngestion()` stops scheduling the connector once it is `failing`.
4. The same threshold applies regardless of how many attempts were made in the hour.

**Pain points:**
- A fast-polling connector can be disabled after a small percentage blip, while a slow-polling connector with a 100% failure rate may take far longer to trigger the same flat count.
- There is no attempt-count floor, so very low sample sizes can produce misleading 100% failure rates.
- The original threshold was a spec placeholder, not derived from real connector traffic.
- Later inspection found that `retryable` failures were being counted identically to non-retryable ones, and that the 20-consecutive-failure ceiling could permanently lock out a connector because no recovery path was defined.

---

## 7. Future State (To-Be)

**New or improved process:**
1. `deriveConnectorHealth()` evaluates the most recent 1-hour window of `IngestionRun`s for the `(tenantId, platformId)` pair.
2. It computes `recentFailures / recentAttempts` excluding any `retryable = true` rows.
3. If `recentAttempts ≥ 5` and the failure rate is ≥50%, the connector is `failing`.
4. Independently, if the connector has accumulated ≥20 consecutive non-retryable failures (regardless of time window or rate), it is `failing`.
5. When the 20-consecutive-failure ceiling trips, the system permits exactly one probe attempt after a bounded cooldown; a successful probe clears the streak, and a failed probe restarts the cooldown.
6. `degraded` continues to mean “some recent non-retryable failures but a success within the last hour.”

**Expected capabilities:**
- Comparable health judgment across connectors with very different polling cadences.
- Protection from one-off or small-sample noise via the 5-attempt floor.
- Bounded detection of persistently broken low-volume connectors via the 20-consecutive-failure ceiling.
- Recovery from the absolute-ceiling path through a half-open probe attempt.
- Continued per-tenant, read-only derivation from `IngestionRun` history.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall mark a connector `failing` when ≥50% of non-retryable attempts in the trailing 1-hour window failed, provided at least 5 attempts occurred in that window. | Must | Contract test passes for 5/10, 10/20, and 50/100 failure patterns; test fails for 4 attempts or 49% rate. | Product Owner |
| BR-002 | The system shall not trigger the rate-based `failing` rule when fewer than 5 attempts are recorded in the window. | Must | A 2-attempt, 1-failure fixture stays `healthy` or `degraded`, never `failing`. | Product Owner |
| BR-003 | The system shall mark a connector `failing` after 20 consecutive non-retryable failures, regardless of time window or failure rate. | Must | A fixture with 20 sequential non-retryable failures, each from the same `(tenantId, platformId)`, yields `failing` even if the 1-hour rate rule is not met. | Product Owner |
| BR-004 | The system shall exclude retryable failures from both the rate and consecutive-failure counts. | Must | A fixture of 20 consecutive `retryable = true` failures does not trip either threshold; mixed fixtures count only non-retryable failures. | Product Owner |
| BR-005 | The system shall apply the failure threshold per `(tenantId, platformId)` pair and not across tenants or platforms. | Must | Isolation test: tenant A’s failing connector does not change tenant B’s same-platform connector status. | Product Owner |
| BR-006 | When a connector is `failing` due to the 20-consecutive-failure ceiling, the system shall allow exactly one probe attempt after a bounded cooldown, instead of blocking forever. | Must | A connector that tripped the ceiling attempts once after cooldown; success clears `failing`, failure restarts cooldown. | Product Owner |
| BR-007 | The `degraded` state shall remain “recent non-retryable failures with at least one success in the last hour.” | Must | Contract tests for mixed success/failure fixtures still return `degraded`, not `failing`. | Product Owner |
| BR-008 | Health shall continue to be derived from `IngestionRun` history with no authoritative health table. | Must | No new write-side health table is introduced; read cache remains reconstructable. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Deriving connector health must not add more than a fixed, predictable query cost per connector status read. | Performance | Should | Query plan reviewed; no unbounded table scan beyond the 1-hour window plus the 20-most-recent ceiling scan. |
| NFR-002 | Threshold defaults must be centrally configurable and documented in an Amendment Log. | Maintainability | Should | A documented, versioned place to adjust 50%/5/20 without code change; no magic numbers in business rules. |
| NFR-003 | The new rule must keep the existing contract suite passing for Stories 2.3 and 4.3. | Reliability | Must | Existing contracts re-verified with the rate-relative rule; any changed assertion is documented with a dated note, not a silent rewrite. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A connector is `failing` if `recentNonRetryableFailures / recentNonRetryableAttempts ≥ 50%` within the trailing 1-hour window and `recentNonRetryableAttempts ≥ 5`. |
| BRU-002 | A connector is `failing` if it has accumulated `≥20` consecutive non-retryable `IngestionRun`s, regardless of the 1-hour window or failure rate. |
| BRU-003 | `retryable = true` failed runs are not counted as failures for either BRU-001 or BRU-002; `retryable = NULL` is treated as non-retryable. |
| BRU-004 | Failure thresholds are evaluated independently for each `(tenantId, platformId)` pair. |
| BRU-005 | `degraded` means `recentNonRetryableFailures > 0` and at least one success occurred within the last hour; this is unchanged by the rate-relative rule. |
| BRU-006 | A connector that became `failing` through the consecutive-failure ceiling must be allowed one probe attempt after a bounded cooldown; a successful probe clears the consecutive-failure streak. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun.status` | Attempt result: `succeeded` or `failed` | `ingestion_runs` table | Platform / Ingestion | Operational |
| `IngestionRun.retryable` | Boolean: whether the failure is transient and may be retried | `ingestion_runs` table, written by `runIngestionAttempt.ts` | Platform / Ingestion | Operational |
| `IngestionRun.tenantId` / `platformId` | Scope keys for health aggregation | `ingestion_runs` table | Platform / Ingestion | Multi-tenant (RLS) |
| `IngestionRun.createdAt` / `attemptedAt` | Timestamp for trailing-window evaluation | `ingestion_runs` table | Platform / Ingestion | Operational |
| Derived `ConnectorHealth` | Read-only status: `healthy`, `degraded`, `failing`, `disconnected` | Computed from `ingestion_runs` | Product / Engineering | Tenant-visible operational status |

No new authoritative health table is introduced; health remains a derived view.

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector status distribution | Track % of connectors in `healthy` / `degraded` / `failing` over time | Product / Operations | Daily |
| Auto-disable rate by platform | Identify platforms with disproportionate `failing` transitions | Operations / Support | Weekly |
| False-positive rate | Compare rate of auto-disables that resolve within the hour vs. genuine outages | Product Owner | Monthly |
| Retryable vs. non-retryable failure mix | Validate that retryable failures are not driving `failing` decisions | Engineering | Weekly |
| Consecutive-ceiling recovery rate | Measure successful half-open probes that clear the 20-failure streak | Engineering | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Threshold defaults (50%/5/20) do not match real connector traffic patterns once live | Medium | Medium | Treat as launch defaults; capture tuning in the Amendment Log once real traffic exists. | Product Owner |
| R-002 | The consecutive-failure ceiling permanently locks out a connector until manual intervention | High | High | Implement the bounded half-open probe requirement (BR-006) before or with this BRD. | Technical Lead |
| R-003 | Retryable failures continue to be counted as non-retryable | Medium | High | Complete Story 2.12 before declaring this requirement fully met; verify contract tests for retryable-only fixtures. | Engineering |
| R-004 | Existing contracts for Stories 2.3 and 4.3 are silently rewritten instead of healed | Medium | Medium | Any changed assertion gets a dated note and references this BRD/ADR-0023; keep the original AC intent. | Engineering |
| R-005 | Push-mode connectors, when added later, may need different rules | Medium | Low | Log as a known gap; revisit when a push-mode connector is scheduled. | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0009 (derived `ConnectorHealth` status) | Architecture | Menno | Accepted; partial supersession noted |
| D-002 | ADR-0010 (error/auto-disable policy) | Architecture | Menno | Accepted; partial supersession noted |
| D-003 | Story 2.3 (retryable/non-retryable error handling with per-tenant auto-disable) | Implementation | Engineering | Healed to rate-relative rule |
| D-004 | Story 4.3 (derived connector health from `IngestionRun` history) | Implementation | Engineering | Re-verified, no assertion changes needed |
| D-005 | Story 2.12 (exclude retryable failures from `failing` derivation) | Implementation | Engineering | Built 2026-08-12 |
| D-006 | Story 1.11 (activation-aware `shouldAttemptIngestion`) | Implementation | Engineering | Provides gating context for half-open probe |
| D-007 | `ingestion_runs` table with `retryable` column | Data | Engineering | Already exists |

---

## 14. Acceptance Criteria

- AC-1: A connector with ≥50% non-retryable failures in the trailing 1-hour window and at least 5 attempts is derived as `failing`.
- AC-2: A connector with 4 or fewer attempts in the window does not become `failing` under the rate rule, regardless of failure percentage.
- AC-3: A connector with 20 consecutive non-retryable failures becomes `failing` even if the 1-hour rate rule is not met.
- AC-4: A run of purely retryable failures does not become `failing` under either the rate rule or the consecutive-failure ceiling.
- AC-5: A mixed run of retryable and non-retryable failures counts only the non-retryable runs toward both thresholds.
- AC-6: A side-by-side test of a high-frequency and a low-frequency connector under equivalent “mostly broken” conditions flags both correctly and does not unfairly penalize either.
- AC-7: A connector that tripped the 20-consecutive-failure ceiling is permitted exactly one probe attempt after a bounded cooldown, and a successful probe clears the `failing` state.
- AC-8: `degraded` continues to mean “some recent non-retryable failures with a success in the last hour.”
- AC-9: Health remains a derived read from `IngestionRun` history; no authoritative health table is introduced.
- AC-10: A failing connector for one tenant has no effect on another tenant’s same-platform connector.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `ConnectorHealth` | The live, derived status of a connector: `healthy`, `degraded`, `failing`, or `disconnected`. |
| `failing` | A connector status meaning the system should stop attempting ingestion until the condition clears or an operator intervenes. |
| `degraded` | A connector status meaning there are recent non-retryable failures but also a recent success; ingestion may continue. |
| `IngestionRun` | A single record of an ingestion attempt, including `status` and `retryable`. |
| Rate-relative threshold | A `failing` rule based on the ratio of failed attempts to total attempts in a window, not an absolute count. |
| Attempt-count floor | The minimum number of attempts required before the rate rule can fire. |
| Absolute ceiling | A backstop rule that fires after a fixed number of consecutive non-retryable failures, independent of rate or window. |
| `retryable` | A flag indicating a transient failure (rate-limit, network, 5xx) that should not count toward auto-disable. |
| `deliveryMode` | Whether a connector is push- or poll-mode; threshold-by-mode variation is explicitly deferred. |
| Half-open probe | A single allowed ingestion attempt after a cooldown, used to test whether a `failing` connector has recovered. |

---

## 16. Appendices

### Reference documents

- [ADR-0023: Proportional (rate-relative) connector failure threshold for auto-disable](../../adr/0023-proportional-connector-failure-threshold.md)
- [ADR-0009: Derived `ConnectorHealth` status](../../adr/0009-connector-health-derivation.md) *(partially superseded only on flat threshold)*
- [ADR-0010: Error classification and auto-disable policy](../../adr/0010-error-classification-and-auto-disable.md) *(partially superseded only on flat threshold)*
- [docs/user-stories/README.md – Known cross-story conflict](../../user-stories/README.md)

### Related user stories

- [Story 2.3 — Retryable/non-retryable error handling with per-tenant auto-disable](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 2.5 — Proportional, rate-relative connector failure threshold](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 2.12 — `deriveConnectorHealth()` excludes retryable failures from the `failing` derivation](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 4.3 — Derived connector health from `IngestionRun` history](../../user-stories/epic-4-derived-data-analytics-and-health.md)

### Missing source material

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` was authored for the proportional connector failure threshold. The ADR explicitly notes that the original design spec used the flat threshold only as a placeholder. The two tangential mentions in `01-multi-source-ingestion.md` and `09-real-time-alerts.md` do not provide sufficient feature-design detail for this BRD.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
