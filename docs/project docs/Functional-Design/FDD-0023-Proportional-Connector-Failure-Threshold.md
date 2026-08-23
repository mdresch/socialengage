# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0023 Proportional (Rate-Relative) Connector Failure Threshold — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0023 is Accepted; documents shipped design, healed per its own 2026-08-12/2026-08-17 Clarifications — Stories 2.5, 2.12) |
| Related Documents | ADR-0023, BRD-0023, ADR-0009, ADR-0010, ADR-0051, Stories 2.3, 2.5, 2.12, 4.3 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0023 (proportional, rate-relative connector failure threshold for auto-disable) and BRD-0023 into the functional design for how `deriveConnectorHealth()` decides a connector is `failing`, replacing the original flat "≥10 failures/hour" placeholder with a rate-relative rule plus an absolute ceiling, both excluding retryable failures, with a bounded half-open recovery probe once the ceiling trips. ADR-0023 is Accepted (2026-07-29) and has two later Clarifications (2026-08-12: exclude retryable failures; 2026-08-17: half-open recovery for the ceiling) that are part of its own Decision, both incorporated below as shipped behavior, not open items.

### 2.2 Scope

**In scope:**
- Rate-relative `failing` rule: ≥50% of non-retryable attempts failed in the trailing 1-hour window, with a minimum 5-attempt floor.
- Absolute ceiling: ≥20 consecutive non-retryable failures, independent of window or rate.
- Exclusion of `retryable = true` (and `NULL`, treated as non-retryable) failures from both counts as appropriate (`retryable = NULL` is treated as non-retryable per BRU-003).
- Per-`(tenantId, platformId)` isolation of the threshold evaluation.
- A bounded half-open probe recovery path once the 20-consecutive ceiling trips, so `shouldAttemptIngestion()` does not block a `failing` connector forever.
- Partial supersession of only the flat-threshold clauses in ADR-0009 and ADR-0010; `degraded`/`healthy`/`disconnected` semantics are unchanged.

**Out of scope:**
- Varying the threshold by `deliveryMode` (push vs. poll) — deferred until a push-mode connector is on the roadmap.
- A persisted, authoritative health table — health remains derived from `IngestionRun`.
- UI-level health visualization changes.
- Retuning the 50%/5/20 numeric defaults without a logged Amendment.

### 2.3 Target Audience

Backend engineers implementing/maintaining `deriveConnectorHealth()` and `shouldAttemptIngestion()`, QA authoring parity/threshold contract tests, platform operators triaging auto-disabled connectors.

---

## 3. Context and Background

ADR-0009 originally derived `failing` as a flat "≥10 failed `IngestionRun`s within the last hour" — carried over unchanged from the design spec's own explicitly-named placeholder. That flat count conflates very different situations: a connector polled every couple of minutes accumulating 10 failures out of 200 attempts (5%, likely transient) looks identical to a connector polled hourly failing 10 out of 10 attempts (100%, clearly broken). ADR-0023 replaces the flat count with a rate-relative rule.

Two later, real-world Clarifications extend the Decision and are treated as part of it, not as separate open work:
- **2026-08-12** — direct code inspection (during ADR-0051 drafting) found `connectorHealth.ts` counted every `status = 'failed'` row identically regardless of the `retryable` flag `ingestion_runs` already carries, meaning a run of purely rate-limited (retryable) failures could trip the rate rule or the ceiling exactly as a genuinely broken connector would — contrary to this ADR's own stated intent to distinguish "clearly broken" from "probably a transient blip."
- **2026-08-17** — a live incident (a tenant's GNews connector legitimately failed 20 times consecutively for a real, now-fixed configuration bug, then remained permanently stuck in `failing` even after the fix and reactivation) revealed the 20-consecutive ceiling had no recovery path at all: `shouldAttemptIngestion()` blocked unconditionally once `failing`, so the very success that would clear the streak could never occur. Menno's explicit direction (given a choice of "fix it properly" / "manually unstick the one connector" / "both") was fix it properly — a half-open circuit-breaker probe.

Source requirements: BRD-0023 §§6–7, Stories 2.3 (original, pre-ADR-0023, healed), 2.5 (this ADR's own implementation story), 2.12 (retryable exclusion), 4.3 (derived health, re-verified unaffected).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Judge connectors by failure rate, not absolute count, so polling cadence doesn't bias the result | Fast- and slow-polling connectors under equivalent failure conditions reach `failing` consistently |
| G2 | Avoid tripping on low-sample-size noise | A connector with <5 attempts in the window never trips the rate rule regardless of its failure percentage |
| G3 | Still catch a persistently broken low-frequency connector within bounded time | 20 consecutive non-retryable failures trips `failing` even if the 1-hour rate rule isn't met |
| G4 | Never let a transient/rate-limited failure pattern count toward auto-disable | Purely retryable failure runs trip neither the rate rule nor the ceiling |
| G5 | Guarantee a `failing` connector can recover once actually fixed | The ceiling path allows exactly one bounded probe attempt rather than blocking forever |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Rate-Relative `failing` Derivation

- **Description:** Computes `failing` status as a ratio of non-retryable failures to non-retryable attempts within a trailing 1-hour window, scoped to a single `(tenantId, platformId)` pair.
- **Triggers:** Any read of `ConnectorHealth` (via the cache defined in ADR-0022, on cache miss/expiry) or any `shouldAttemptIngestion()` gating check before a poll.
- **Inputs:** `IngestionRun` rows for the `(tenantId, platformId)` pair within the trailing 1-hour window: `status`, `retryable`, `createdAt`/`attemptedAt`.
- **Processing:**
  - Filter to non-retryable rows only (`retryable = true` rows are excluded entirely from both numerator and denominator; `retryable = NULL` is treated as non-retryable).
  - Compute `recentNonRetryableFailures / recentNonRetryableAttempts`.
  - If `recentNonRetryableAttempts ≥ 5` (the floor) and the ratio is `≥ 50%`, the connector is `failing` under this rule.
  - This rule naturally self-heals as the 1-hour window ages older failures out.
- **Outputs:** A `failing`/not-`failing` determination contributing to the connector's derived `ConnectorHealth`.
- **Error handling:** Fewer than 5 non-retryable attempts in the window never trips this rule, regardless of how high the percentage looks (e.g., 1 failure out of 1 attempt does not trigger).
- **Edge cases:** A window with 0 non-retryable attempts (all retryable, or none at all) trivially does not trip this rule; a connector alternating just above/below 50% at the 5-attempt boundary is evaluated fresh on every read (no hysteresis).

### 5.2 Feature / Capability: Absolute Consecutive-Failure Ceiling

- **Description:** An independent backstop that marks a connector `failing` after 20 consecutive non-retryable failures, regardless of the 1-hour window or the rate rule — catches a low-frequency connector that fails every run but never accumulates the 5-attempt floor within an hour.
- **Triggers:** Same as 5.1 — any `ConnectorHealth` read or gating check.
- **Inputs:** `IngestionRun` history for the `(tenantId, platformId)` pair, scanned backward from most recent.
- **Processing:** Scans backward through run history (excluding retryable rows from the streak count) until either a success is found (streak resets/clears) or 20 consecutive non-retryable failures are counted (ceiling trips). This scan is unbounded in time — unlike the rate rule, it has no window to age out of.
- **Outputs:** A `failing` determination independent of, and OR'd with, the rate rule's determination.
- **Error handling:** A success anywhere in the backward scan clears the streak count back to zero for this rule.
- **Edge cases:** A streak interspersed with retryable failures only counts the non-retryable ones toward the 20; because the scan is unbounded backward, once tripped it has no time dimension to decay through on its own — this is exactly why the half-open probe (5.3) is required.

### 5.3 Feature / Capability: Half-Open Recovery Probe for the Ceiling Path

- **Description:** Once a connector is `failing` specifically via the 20-consecutive ceiling, `shouldAttemptIngestion()` allows exactly one probe attempt through after a bounded cooldown, rather than blocking unconditionally forever.
- **Triggers:** A scheduled poll/fetch attempt for a connector currently `failing` via the ceiling, where `lastAttemptAt` is older than the configured cooldown.
- **Inputs:** Current `failing` state and which rule tripped it (rate rule vs. ceiling), `lastAttemptAt`, the cooldown duration.
- **Processing:**
  1. `shouldAttemptIngestion()` still runs the normal activation/credential check for the probe attempt — the half-open allowance does not bypass those checks, only the unconditional `failing`-blocks-everything short-circuit.
  2. If the probe succeeds, a fresh `succeeded` `IngestionRun` is written; `deriveConnectorHealth()`'s scan-from-newest-until-a-success logic reads this and clears `consecutiveFailures`, ending the `failing` state via the ceiling path (the rate rule is evaluated independently and may or may not still apply).
  3. If the probe fails, the cooldown simply restarts — the connector is not hammered with repeated attempts.
- **Outputs:** Either a cleared `failing` (ceiling) state, or a restarted cooldown.
- **Error handling:** This corrects the pre-2026-08-17 behavior where a connector tripped via the ceiling could never leave `failing` without an operator manually altering `ingestion_runs` history out of band.
- **Edge cases:** A connector tripped via the rate rule (not the ceiling) does not need this mechanism — the rate rule already self-heals as the window ages; the half-open probe applies specifically and only to the ceiling path.

### 5.4 Feature / Capability: Retryable-Failure Exclusion

- **Description:** Ensures transient failures (rate-limiting, network errors, 5xx responses) marked `retryable = true` on their `IngestionRun` row never count toward either the rate rule or the ceiling.
- **Triggers:** Every evaluation of 5.1 and 5.2.
- **Inputs:** The `retryable` boolean on each `IngestionRun` row (written by `runIngestionAttempt.ts`'s error classification, per ADR-0010).
- **Processing:** Both the rate-rule numerator/denominator and the ceiling's consecutive-streak scan filter out `retryable = true` rows entirely (they do not count as failures, attempts, or streak-breakers); `retryable = NULL` rows are treated as non-retryable (count as failures).
- **Outputs:** Failure/attempt counts that reflect only genuinely non-retryable failure patterns.
- **Error handling:** A run of purely retryable failures (e.g. sustained rate-limiting) trips neither the rate rule nor the ceiling — matching this ADR's stated intent that a rate-limit hit is the paradigm transient case, not a "clearly broken" signal.
- **Edge cases:** A mixed run of retryable and non-retryable failures counts only the non-retryable ones toward both thresholds; a long run of retryable failures interspersed with occasional non-retryable ones resets neither count on its own (retryable rows are simply skipped, not treated as successes).

### 5.5 Feature / Capability: Per-Tenant Isolation

- **Description:** Every threshold evaluation is scoped to a single `(tenantId, platformId)` pair.
- **Triggers:** Every `ConnectorHealth` derivation.
- **Inputs:** `tenantId`, `platformId` on each `IngestionRun` row.
- **Processing:** Aggregation queries filter by both keys; no cross-tenant or cross-platform aggregation ever occurs.
- **Outputs:** An independent `failing`/`degraded`/`healthy`/`disconnected` status per tenant per connector.
- **Error handling:** N/A — isolation is structural (query scoping), not a runtime-detected condition.
- **Edge cases:** Tenant A's connector tripping `failing` for platform X has zero effect on Tenant B's connector for the same platform X.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Monitors connector health, reactivates/reconnects failing connectors |
| Platform Operations | Operates the ingestion fleet, triages rate limits and outages |
| Scheduler / ingestion pipeline | Calls `shouldAttemptIngestion()` before every poll |
| Engineering | Implements and tests `deriveConnectorHealth()` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 2.5) | Platform operator | Judge connector health by failure rate relative to attempt volume, not a flat count | Fast- and slow-polling connectors are judged fairly | ≥50% of ≥5 non-retryable attempts fails; 4 or fewer attempts never trips the rule |
| US2 (Story 2.12) | Platform operator | Exclude retryable (transient) failures from the threshold math | A rate-limited connector isn't mistaken for a broken one | Purely retryable runs trip neither the rate rule nor the ceiling |
| US3 (2026-08-17 Clarification) | Tenant-Admin whose connector was auto-disabled and then fixed | Have the connector actually recover once the underlying cause is fixed | I don't need to manually intervene in the database to unstick it | One probe attempt allowed after a bounded cooldown once tripped via the ceiling; success clears the streak |

### 6.3 Workflow Diagrams / Steps

**Health derivation (on read or scheduling check):**
1. Load `IngestionRun` history for `(tenantId, platformId)`.
2. Filter out `retryable = true` rows for both counts.
3. Evaluate rate rule: is `recentNonRetryableAttempts ≥ 5` and `recentNonRetryableFailures / recentNonRetryableAttempts ≥ 50%`? If yes → `failing`.
4. Independently evaluate ceiling: scan backward until a success or 20 consecutive non-retryable failures. If 20 reached first → `failing`.
5. If neither rule trips: evaluate `degraded` (recent non-retryable failures with a success within the last hour) vs. `healthy` vs. `disconnected` (zero recorded runs) per ADR-0009's unchanged logic.

**Recovery from ceiling-tripped `failing`:**
1. Scheduler calls `shouldAttemptIngestion()`.
2. If `failing` via ceiling and `lastAttemptAt` older than cooldown → allow one probe through to the normal activation/credential check.
3. Probe succeeds → `IngestionRun` written as `succeeded` → next health read clears the ceiling-driven `failing` state.
4. Probe fails → cooldown restarts; no further attempts until cooldown elapses again.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `IngestionRun` rows: `status`, `retryable`, `tenantId`, `platformId`, `createdAt`/`attemptedAt` — all pre-existing fields.
- Configured threshold constants: 50% rate, 5-attempt floor, 20-consecutive ceiling, half-open cooldown duration.

### 7.2 Data Outputs

- Derived `ConnectorHealth.status` (`healthy`/`degraded`/`failing`/`disconnected`) per `(tenantId, platformId)`.
- No new persisted table — output is a read-time derivation, cached per ADR-0022.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `IngestionRun` (existing, unmodified schema) | `id`, `tenantId`, `platformId`, `status` (`succeeded`/`failed`), `retryable` (boolean, nullable), `attemptedAt`/`createdAt` | Source data for both the rate rule and the ceiling; `retryable` is read by this ADR's logic but was previously ignored |
| `ConnectorHealth` (derived, not persisted) | `status`, contributing `recentNonRetryableAttempts`/`recentNonRetryableFailures`, `consecutiveNonRetryableFailures` | Computed from `IngestionRun`; cached per ADR-0022; combined with `isActive` per ADR-0051/Story 1.12 |
| Half-open probe state (implicit, derived from `IngestionRun` history) | `lastAttemptAt`, whether currently within cooldown | Governs whether `shouldAttemptIngestion()` allows a probe through for a ceiling-tripped connector |

### 7.4 Validation Rules

- `retryable = NULL` is treated identically to `retryable = false` (non-retryable) for both threshold counts (BRU-003).
- The rate rule never fires with fewer than 5 non-retryable attempts in the window, regardless of percentage.
- The ceiling scan only counts consecutive non-retryable failures; any success or the presence of enough retryable-only gaps does not itself reset the streak (retryable rows are skipped, not treated as resets) — only an actual success resets it.
- No new authoritative health table may be introduced; health remains fully derivable from `IngestionRun` at any time.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A connector is `failing` if `recentNonRetryableFailures / recentNonRetryableAttempts ≥ 50%` within the trailing 1-hour window and `recentNonRetryableAttempts ≥ 5`. | Rate rule (5.1) |
| BR2 | A connector is `failing` if it has accumulated ≥20 consecutive non-retryable `IngestionRun`s, regardless of window or rate. | Ceiling (5.2) |
| BR3 | `retryable = true` failed runs are excluded from both BR1 and BR2; `retryable = NULL` is treated as non-retryable. | Exclusion (5.4) |
| BR4 | Failure thresholds are evaluated independently per `(tenantId, platformId)` pair. | Isolation (5.5) |
| BR5 | `degraded` means recent non-retryable failures exist but a success occurred within the last hour — unchanged by this ADR. | Health derivation (5.1/5.2, inherited from ADR-0009) |
| BR6 | A connector `failing` via the ceiling must be allowed exactly one probe attempt after a bounded cooldown; a successful probe clears the streak. | Recovery (5.3) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `IngestionRun` table (Postgres) | Inbound (read) | Source data for threshold evaluation | SQL |
| `deriveConnectorHealth()` | Internal | Implements the rate rule, ceiling, and `degraded`/`healthy`/`disconnected` logic | In-process function |
| `shouldAttemptIngestion()` | Internal | Gates scheduled polls; implements half-open probe allowance | In-process function, called by the polling scheduler |
| `ConnectorHealth` cache (ADR-0022) | Internal | Caches the derived result for 60 seconds | In-process |
| `GET /connectors`, `GET /v1/connectors/:platformId` | Outbound | Surfaces `failing`/`degraded`/`healthy`/`disconnected` to the admin UI | REST / JSON |
| `connector_activations` (ADR-0051) | Inbound (read) | Provides the activation/credential context the probe still checks before proceeding | SQL |

---

## 10. Non-Functional Considerations

- **Performance:** Evaluation cost per read is bounded — a 1-hour window query plus a bounded (20-row) backward scan for the ceiling; no unbounded table scan.
- **Reliability:** The rule set must keep Stories 2.3 and 4.3's existing contracts passing, healed (not silently rewritten) to reflect the rate-relative rule, per BRD-0023 NFR-003.
- **Maintainability:** Threshold defaults (50%/5/20, cooldown duration) should be centrally configurable and documented via Amendment Log rather than embedded as magic numbers.
- **Fairness/correctness:** The core property this ADR exists to deliver — fast- and slow-polling connectors judged by comparable standards — is the primary non-functional target, verified by side-by-side contract tests (BRD-0023 AC-6).
- **Recoverability:** A `failing` connector, once its underlying cause is fixed, must be able to leave `failing` without manual operator intervention (2026-08-17 Clarification) — this was a defect in the original design, now corrected.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| <5 non-retryable attempts in the window, any failure rate | Connector shows `healthy`/`degraded`, not `failing` | Rate rule does not fire; ceiling evaluated independently |
| 20 consecutive non-retryable failures | Connector shows `failing`, polling stops | `shouldAttemptIngestion()` blocks scheduled polls except the bounded half-open probe |
| Purely retryable failure run (e.g. sustained rate-limiting) | Connector remains `healthy`/`degraded` | Neither rate rule nor ceiling counts retryable rows as failures |
| Ceiling-tripped connector, cooldown not yet elapsed | Connector still shows `failing` | No probe attempted; scheduler skips this connector until cooldown elapses |
| Ceiling-tripped connector, cooldown elapsed, probe succeeds | Connector returns to `healthy`/`degraded` | Streak cleared by the fresh `succeeded` run; normal scheduling resumes |
| Ceiling-tripped connector, cooldown elapsed, probe fails | Connector remains `failing` | Cooldown restarts; no repeated hammering |
| One tenant's connector trips `failing` | Only that tenant's connector affected | No cross-tenant or cross-platform bleed (per-pair isolation) |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- Every `IngestionRun` row records `status`, `retryable`, `tenantId`, `platformId`, and an attempt timestamp (already true).
- The current connector roster is entirely poll-mode; push-mode handling is intentionally deferred.
- Stories 2.3 and 4.3 shipped against the original flat rule and are healed, not silently rewritten, when Story 2.5 lands.

**Dependencies:**
- ADR-0009 (`ConnectorHealth` derivation) — partially superseded (only the flat-threshold clause).
- ADR-0010 (error classification / auto-disable policy) — partially superseded (only the flat-threshold clause); already distinguishes retryable vs. non-retryable conceptually.
- ADR-0022 (derived-data caching) — the 60-second `ConnectorHealth` cache sits in front of this derivation, unaffected by this ADR.
- ADR-0051 (connector activation) — `shouldAttemptIngestion()`'s activation/credential check still runs even during a half-open probe.
- Story 2.5 (this ADR's implementation), Story 2.12 (retryable exclusion, built 2026-08-12), Story 2.3 (original, healed), Story 4.3 (re-verified, unaffected).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Are 50%/5-attempt-floor/20-consecutive the right numbers long-term? | Product Owner | Launch defaults accepted without real traffic data; tune later once real connector traffic exists (logged via Amendment Log) |
| Q2 | Should the threshold vary by `deliveryMode` (push vs. poll)? | Product Owner | Deferred — no push-mode connector is currently on the roadmap; revisit when one is scheduled |
| Q3 | What is the right half-open cooldown duration? | Technical Lead | Set at implementation (Story 2.5/healing pass); not separately re-litigated here |

---

## 14. Appendix

**Glossary:** see BRD-0023 §15 for `ConnectorHealth`, `failing`, `degraded`, rate-relative threshold, attempt-count floor, absolute ceiling, `retryable`, `deliveryMode`, and half-open probe definitions.

**Reference links:**
- [ADR-0023: Proportional (rate-relative) connector failure threshold for auto-disable](../../adr/0023-proportional-connector-failure-threshold.md)
- [BRD-0023](../Business-Requirements/BRD-0023-Proportional-Connector-Failure-Threshold.md)
- [ADR-0009: Derived `ConnectorHealth` status] (referenced; partially superseded, not independently re-verified in this pass)
- [ADR-0010: Error classification and auto-disable policy] (referenced; partially superseded, not independently re-verified in this pass)
- [ADR-0051: Connector activation] (referenced; not independently re-verified in this pass)
- [Story 2.3, 2.5, 2.12 — Epic 2](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 4.3 — Epic 4](../../user-stories/epic-4-derived-data-analytics-and-health.md)
- [`docs/user-stories/README.md` — Known cross-story conflict note](../../user-stories/README.md)

**Missing sources:** No dedicated `docs/product-research/feature-designs/<feature>.md` or deep-research report exists for this threshold — the ADR itself states the original design spec used the flat threshold only as a placeholder, and BRD-0023's own Appendix confirms tangential mentions elsewhere lack sufficient feature-design detail.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown (including the two 2026-08-12/08-17 Clarifications as shipped behavior), real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
