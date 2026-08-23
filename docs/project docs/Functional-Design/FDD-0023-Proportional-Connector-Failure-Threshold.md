# Business Requirements Document (BRD) — Proportional Connector Failure Threshold

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Proportional Connector Failure Threshold |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0023-proportional-connector-failure-threshold.md, ../Business-Requirements/BRD-0023-Proportional-Connector-Failure-Threshold.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0023-proportional-connector-failure-threshold.md and the business requirements in BRD-0023-Proportional-Connector-Failure-Threshold.md into functional design for **Proportional Connector Failure Threshold**.
**What problem are we solving?**  
The existing auto-disable rule treats every connector as if it runs at the same frequency: “≥10 failed ingestion runs in the last hour.” A fast-polling connector that attempts 200 polls per hour and hits 10 transient failures (5%) looks identical to a slow-polling connector that attempts 10 polls and fails every single one (100%). This flat count conflates a minor blip with a genuinely broken connector and can cause unfair, premature auto-disables for high-frequency sources.

**Who is affected?**  
Tenant administrators and platform operators who rely on `ConnectorHealth` to decide whether a connector is healthy, degraded, or failing. It also affects tenants whose high-frequency connectors may otherwise be disabled on noise.

**What is the proposed solution at a glance?**  
Replace the flat failure count with a rate-relative threshold that is evaluated per `(tenantId, platformId)` over a trailing 1-hour window: a connector becomes `failing` when at least 50% of its attempts in that window failed **and** at least 5 attempts occurred in the window. A hard 20-consecutive-failure absolute ceiling is retained as a backstop for slow or low-volume connectors. Retryable failures (rate-limit, network, 5xx) are excluded from the counts, and the absolute-ceiling path must support a bounded half-open probe so a fixed connector can recover.

**What business value do we expect?**  
Fairer, more defensible health judgments across connectors with different polling cadences; fewer false-positive auto-disables; and faster, bounded detection of truly broken low-frequency connectors. This reduces tenant-visible disruption, protects quota from wasted retries, and lowers support burden.

---

### 2.2 Scope
**In scope:**
- Replacing the flat “≥10 failures/hour” `failing` derivation for `ConnectorHealth` with a rate-relative rule.
- Evaluation window: trailing 1 hour, scoped to a single `(tenantId, platformId)` pair.
- Launch defaults: ≥50% of attempts failed **and** ≥5 attempts in the window; or ≥20 consecutive non-retryable failures.
- Excluding `retryable` failed `IngestionRun`s from both the rate and the consecutive-failure counts.
- A bounded half-open probe/recovery path for connectors that tripped the 20-consecutive-failure ceiling.
- Updates to the existing contracts for Story 2.3 (auto-disable wiring) and Story 4.3 (derived health) where those contracts depended on the superseded flat threshold.
- Multi-tenant isolation: a connector failure for one tenant must not affect another tenant’s same platform connector.

**Out of scope:**
- Varying the threshold by `deliveryMode` (push vs. poll) — deferred until a push-mode connector is actually on the roadmap.
- Changing the definition of `degraded` or `healthy`.
- Adding a dedicated persisted `ConnectorHealth` table; health remains derived from `IngestionRun` history.
- UI-level health visualization changes (covered by other stories/epics).
- Retuning the 50% / 5-attempt / 20-consecutive numeric defaults without an Amendment Log entry.

## 3. Context and Background
ADR-0009 derives `failing` status as "≥10 failed `IngestionRun`s within the last hour" — a flat absolute count, explicitly carried over from the spec's own placeholder. This number doesn't account for how differently connectors are actually invoked: a platform polled every couple of minutes and a platform polled hourly both accumulate runs at very different rates, so a flat count-per-hour conflates two very different situations — 10 failures out of 10 attempts (100% failure, clearly broken) and 10 failures out of 200 attempts (5% failure, probably a transient blip) would trigger identically.
**What problem are we solving?**  
The existing auto-disable rule treats every connector as if it runs at the same frequency: “≥10 failed ingestion runs in the last hour.” A fast-polling connector that attempts 200 polls per hour and hits 10 transient failures (5%) looks identical to a slow-polling connector that attempts 10 polls and fails every single one (100%). This flat count conflates a minor blip with a genuinely broken connector and can cause unfair, premature auto-disables for high-frequency sources.

**Who is affected?**  
Tenant administrators and platform operators who rely on `ConnectorHealth` to decide whether a connector is healthy, degraded, or failing. It also affects tenants whose high-frequency connectors may otherwise be disabled on noise.

**What is the proposed solution at a glance?**  
Replace the flat failure count with a rate-relative threshold that is evaluated per `(tenantId, platformId)` over a trailing 1-hour window: a connector becomes `failing` when at least 50% of its attempts in that window failed **and** at least 5 attempts occurred in the window. A hard 20-consecutive-failure absolute ceiling is retained as a backstop for slow or low-volume connectors. Retryable failures (rate-limit, network, 5xx) are excluded from the counts, and the absolute-ceiling path must support a bounded half-open probe so a fixed connector can recover.

**What business value do we expect?**  
Fairer, more defensible health judgments across connectors with different polling cadences; fewer false-positive auto-disables; and faster, bounded detection of truly broken low-frequency connectors. This reduces tenant-visible disruption, protects quota from wasted retries, and lowers support burden.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce false-positive auto-disables for high-frequency, mostly-healthy connectors | Number of `failing` transitions caused by <50% failure-rate blips in the trailing hour trends to zero |
| 2 | Detect persistently broken low-frequency connectors within bounded time | Any connector that fails every run is marked `failing` within 20 consecutive non-retryable failures or the rate rule, whichever is earlier |
| 3 | Align connector health judgment with actual attempt volume | Fast- and slow-polling connectors under equivalent failure conditions reach `failing` status consistently in contract tests |
| 4 | Preserve per-tenant isolation and existing `degraded` semantics | One tenant’s connector status cannot cause another tenant’s same-platform connector to change |

---

**Positive consequences (from ADR):**
**Positive**
- A connector polled every few minutes and one polled hourly are now judged by comparable standards (failure *rate*, not absolute count), removing an unfairness the flat threshold had by construction.
- The attempt-count floor prevents a low-frequency, low-sample-size connector from being disabled off noise (e.g., one bad poll out of two).
- The absolute ceiling preserves the original intent of the placeholder threshold — genuinely broken connectors still get caught — for the specific case a pure percentage rule would handle poorly (very low attempt volume).

**Negative**
- Materially more complex than a flat count: `ConnectorHealth`'s derivation (ADR-0009) now needs both attempt count and failure count per window, not just a failure count, and two threshold rules instead of one.
- Three numbers (50%, 5-attempt floor, 20 consecutive) are this ADR's own estimates, not derived from real failure-pattern data across actual connectors — likely need tuning once real tenant/platform traffic exists.
- Changes what `ConnectorHealth`'s `failing` derivation actually computes (ADR-0009's Decision text describes the old flat rule) — this ADR should be read alongside ADR-0009, not in isolation; ADR-0009 itself isn't edited, per this series' convention of not rewriting an Accepted ADR's original text (see README governance conventions).

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Auto-disable is triggered by failure *rate* relative to actual attempt volume for that `(tenantId, platformId)` pair within the evaluation window, not a flat absolute count — so connectors invoked at very different frequencies aren't held to the same absolute threshold. A minimum attempt-count floor applies alongside the rate threshold, so a connector with very few attempts in the window doesn't trigger off statistical noise (e.g., 1 failure out of 2 attempts looking identical to 100% failure on a high-volume connector). A separate absolute ceiling still applies regardless of rate, so a persistently broken low-frequency connector (one that fails every single time it runs, but only runs a handful of times an hour) still gets caught within a bounded time, rather than needing an implausibly long window to accumulate enough attempts to trip a purely rate-based rule.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Evaluation window: **1 hour**, unchanged from ADR-0009's existing base unit.
- Rate threshold: `failing` when **≥50%** of attempts in the window failed, **and** at least **5 attempts** occurred in the window (the floor, to avoid a single failed attempt on a low-frequency connector reading as "100% failure").
- Absolute ceiling: `failing` when **≥20 consecutive failures** have occurred, regardless of rate or the 1-hour window — catches a connector that's broken on every run but polls infrequently enough that it wouldn't otherwise hit the attempt floor within an hour.
- `degraded` (ADR-0009's existing intermediate state) continues to mean "some recent failures, but a successful run within the last hour" — unchanged by this ADR.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Monitors connector health, reactivates or reconnects failing connectors | High | Fair, accurate status; clear reason when auto-disabled |
| Platform Operations | Operates ingestion fleet, triages rate limits and outages | High | Health signal that reflects real attempt volume and error class |
| Product Owner | Owns connector reliability roadmap | Medium | Bounded, tunable policy that can be improved with real traffic data |
| Support / Customer Success | Handles tenant tickets about stopped ingestion | Medium | Fewer false-positive “connector down” incidents |
| Development / Architecture | Implements and tests `deriveConnectorHealth()` | High | Clear rules, explicit numeric defaults, recovery behavior |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.5 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant with connectors polling at very different frequencies, I want auto-disable triggered by failure *rate* relative to attempt volume, with a minimum a... | A connector with ≥50% of attempts failing in the trailing 1-hour window, and at least 5 attempts in that window, is marked `failing`.; A connector with fewer... |
| Story 2.12 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant-Admin whose connector is hitting transient rate limits, I want a run of purely retryable failures to never, by itself, trip the connector-level `fa... | `deriveConnectorHealth()`'s query additionally selects `retryable` from `ingestion_runs`.; `recentFailures` and `consecutiveFailures` (the two counters feedi... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun.status` | Attempt result: `succeeded` or `failed` | `ingestion_runs` table | Platform / Ingestion | Operational |
| `IngestionRun.retryable` | Boolean: whether the failure is transient and may be retried | `ingestion_runs` table, written by `runIngestionAttempt.ts` | Platform / Ingestion | Operational |
| `IngestionRun.tenantId` / `platformId` | Scope keys for health aggregation | `ingestion_runs` table | Platform / Ingestion | Multi-tenant (RLS) |
| `IngestionRun.createdAt` / `attemptedAt` | Timestamp for trailing-window evaluation | `ingestion_runs` table | Platform / Ingestion | Operational |
| Derived `ConnectorHealth` | Read-only status: `healthy`, `degraded`, `failing`, `disconnected` | Computed from `ingestion_runs` | Product / Engineering | Tenant-visible operational status |

No new authoritative health table is introduced; health remains a derived view.

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A connector is `failing` if `recentNonRetryableFailures / recentNonRetryableAttempts ≥ 50%` within the trailing 1-hour window and `recentNonRetryableAttempts ≥ 5`. |
| BRU-002 | A connector is `failing` if it has accumulated `≥20` consecutive non-retryable `IngestionRun`s, regardless of the 1-hour window or failure rate. |
| BRU-003 | `retryable = true` failed runs are not counted as failures for either BRU-001 or BRU-002; `retryable = NULL` is treated as non-retryable. |
| BRU-004 | Failure thresholds are evaluated independently for each `(tenantId, platformId)` pair. |
| BRU-005 | `degraded` means `recentNonRetryableFailures > 0` and at least one success occurred within the last hour; this is unchanged by the rate-relative rule. |
| BRU-006 | A connector that became `failing` through the consecutive-failure ceiling must be allowed one probe attempt after a bounded cooldown; a successful probe clears the consecutive-failure streak. |

---

## 9. Interfaces and Integrations
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

- Every `IngestionRun` row records `status`, `retryable`, `tenantId`, `platformId`, and an attempt timestamp.
- The current connector roster is poll-mode; push-mode handling is intentionally deferred.
- Existing Stories 2.3 and 4.3 have already shipped with the flat rule; this change will heal their contracts rather than silently rewrite them.

**The durable decision — this is what would need superseding, not just amending:**

Auto-disable is triggered by failure *rate* relative to actual attempt volume for that `(tenantId, platformId)` pair within the evaluation window, not a flat absolute count — so connectors invoked at very different frequencies aren't held to the same absolute threshold. A minimum attempt-count floor applies alongside the rate threshold, so a connector with very few attempts in the window doesn't trigger off statistical noise (e.g., 1 failure out of 2 attempts looking identical to 100% failure on a high-volume connector). A separate absolute ceiling still applies regardless of rate, so a persistently broken low-frequency connector (one that fails every single time it runs, but only runs a handful of times an hour) still gets caught within a bounded time, rather than needing an implausibly long window to accumulate enough attempts to trip a purely rate-based rule.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Evaluation window: **1 hour**, unchanged from ADR-0009's existing base unit.
- Rate threshold: `failing` when **≥50%** of attempts in the window failed, **and** at least **5 attempts** occurred in the window (the floor, to avoid a single failed attempt on a low-frequency connector reading as "100% failure").
- Absolute ceiling: `failing` when **≥20 consecutive failures** have occurred, regardless of rate or the 1-hour window — catches a connector that's broken on every run but polls infrequently enough that it wouldn't otherwise hit the attempt floor within an hour.
- `degraded` (ADR-0009's existing intermediate state) continues to mean "some recent failures, but a successful run within the last hour" — unchanged by this ADR.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Deriving connector health must not add more than a fixed, predictable query cost per connector status read. | Performance | Should | Query plan reviewed; no unbounded table scan beyond the 1-hour window plus the 20-most-recent ceiling scan. |
| NFR-002 | Threshold defaults must be centrally configurable and documented in an Amendment Log. | Maintainability | Should | A documented, versioned place to adjust 50%/5/20 without code change; no magic numbers in business rules. |
| NFR-003 | The new rule must keep the existing contract suite passing for Stories 2.3 and 4.3. | Reliability | Must | Existing contracts re-verified with the rate-relative rule; any changed assertion is documented with a dated note, not a silent rewrite. |

---

## 11. Error Handling and Exceptions
**Positive**
- A connector polled every few minutes and one polled hourly are now judged by comparable standards (failure *rate*, not absolute count), removing an unfairness the flat threshold had by construction.
- The attempt-count floor prevents a low-frequency, low-sample-size connector from being disabled off noise (e.g., one bad poll out of two).
- The absolute ceiling preserves the original intent of the placeholder threshold — genuinely broken connectors still get caught — for the specific case a pure percentage rule would handle poorly (very low attempt volume).

**Negative**
- Materially more complex than a flat count: `ConnectorHealth`'s derivation (ADR-0009) now needs both attempt count and failure count per window, not just a failure count, and two threshold rules instead of one.
- Three numbers (50%, 5-attempt floor, 20 consecutive) are this ADR's own estimates, not derived from real failure-pattern data across actual connectors — likely need tuning once real tenant/platform traffic exists.
- Changes what `ConnectorHealth`'s `failing` derivation actually computes (ADR-0009's Decision text describes the old flat rule) — this ADR should be read alongside ADR-0009, not in isolation; ADR-0009 itself isn't edited, per this series' convention of not rewriting an Accepted ADR's original text (see README governance conventions).

## 12. Assumptions and Dependencies
- Every `IngestionRun` row records `status`, `retryable`, `tenantId`, `platformId`, and an attempt timestamp.
- The current connector roster is poll-mode; push-mode handling is intentionally deferred.
- Existing Stories 2.3 and 4.3 have already shipped with the flat rule; this change will heal their contracts rather than silently rewrite them.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Threshold defaults (50%/5/20) do not match real connector traffic patterns once live | Medium | Medium | Treat as launch defaults; capture tuning in the Amendment Log once real traffic exists. | Product Owner |
| R-002 | The consecutive-failure ceiling permanently locks out a connector until manual intervention | High | High | Implement the bounded half-open probe requirement (BR-006) before or with this BRD. | Technical Lead |
| R-003 | Retryable failures continue to be counted as non-retryable | Medium | High | Complete Story 2.12 before declaring this requirement fully met; verify contract tests for retryable-only fixtures. | Engineering |
| R-004 | Existing contracts for Stories 2.3 and 4.3 are silently rewritten instead of healed | Medium | Medium | Any changed assertion gets a dated note and references this BRD/ADR-0023; keep the original AC intent. | Engineering |
| R-005 | Push-mode connectors, when added later, may need different rules | Medium | Low | Log as a known gap; revisit when a push-mode connector is scheduled. | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0023-proportional-connector-failure-threshold.md`
- BRD: `../Business-Requirements/BRD-0023-Proportional-Connector-Failure-Threshold.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above