# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0131 Crisis Template Bundle and Activation Refinements |
|| Version | 1.0 |
|| Date | 2026-09-09 |
|| Author(s) | Business & Requirements Analyst persona |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved for Build |
|| Related Documents | ADR-0131 (Accepted 2026-08-28; real Decision content 2026-09-09), BRD-0131 (v1.0), ADR-0079, ADR-0091, ADR-0092, ADR-0044, Story 17.3 |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 1.0 | 2026-09-09 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, written alongside ADR-0131's own Decision content ahead of Story 17.3 implementation. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0131's Decision (Accepted 2026-08-28; Decision content written 2026-09-09) and BRD-0131 (v1.0) into a functional design for **crisis threshold baseline calibration and multi-tier escalation**. The feature replaces ADR-0079's static percentage thresholds with a rolling 14-day statistical baseline per watchlist, drives dynamic Z-score-based incident tiering, and adds a stateful escalation engine whose Tier 1 action dispatches for real through ADR-0091's existing webhook mechanism while Tier 2/Tier 3 actions are fully modeled but recorded as audited intent only, pending a future SMS/PagerDuty/telephony ADR.

### 2.2 Scope

- **In scope:**
  - `crisis_baseline_metrics`, `crisis_escalation_rules`, `crisis_incident_logs` tables, with RLS and time-bucket indexing.
  - `CrisisBaselineCalibrationWorker` — continuous rolling 14-day mean/stddev calculation per watchlist, per hour-of-day/day-of-week bucket, for mention velocity and negative-sentiment ratio.
  - Z-score evaluation and dynamic tier assignment (2.0σ / 3.0σ / 4.5σ), gated by a negative-sentiment floor.
  - A stateful escalation engine: real Tier 1 webhook dispatch (reusing ADR-0091), fully modeled Tier 2/3 state machine and audit trail (recorded intent only), and ack-timeout tracking.
  - `POST /v1/crisis/incidents/:id/acknowledge` and `POST /v1/crisis/incidents/:id/resolve`.

- **Out of scope:**
  - Any live SMS, PagerDuty, or telephony/voice-broadcast dispatch — no vendor client is built.
  - Frontend UI for escalation-rule configuration or incident review (named, not-yet-numbered follow-on).
  - Auto-promotion of an incident's tier from elapsed ack-timeout alone.
  - Baseline trend history/visualization beyond the current rolling window.

### 2.3 Target Audience

Backend engineers implementing the tables, calibration worker, evaluation engine, and lifecycle endpoints; QA writing contract tests; product stakeholders reviewing the Tier 2/3 delivery resolution.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** ADR-0079's static percentage thresholds treat every watchlist identically regardless of its own normal volume, producing false positives on low-volume watchlists and missed signals on high-volume ones (BRD-0131 §6). No escalation tiering, acknowledgment tracking, or incident audit trail exists today.
- **Business/user value:** Per-watchlist statistical accuracy, a real working first-tier notification channel (reusing already-shipped infrastructure), and a fully auditable multi-tier escalation trail (BRD-0131 §2, §3).
- **Source requirements:** ADR-0131 (Accepted 2026-08-28), BRD-0131 (v1.0), Story 17.3 in `docs/user-stories/epic-17-adr-0129-to-0133.md`.
- **Constraints and dependencies:**
  - Reuses ADR-0091's Accepted, Built webhook mechanism for Tier 1 as-is — no new delivery code path for Tier 1.
  - Does not build any SMS/PagerDuty/telephony client — no Accepted ADR authorizes one, and none is fabricated here (ADR-0131 §4).
  - Tenant isolation is mandatory across all three new tables.
  - `crisis_incident_logs` origin data (Z-score, baseline snapshot, tier) must be immutable once recorded.

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
||---|---|---|
|| G1 | Replace static thresholds with per-watchlist statistical baselines | Every calibrated bucket has a real `mean_14d`/`stddev_14d` driving Z-score evaluation |
|| G2 | Assign incidents to dynamic tiers correctly | Tier boundaries (2.0σ/3.0σ/4.5σ) plus sentiment floor are applied exactly as specified, one incident per triggering observation |
|| G3 | Deliver real Tier 1 notification | Tier 1 dispatch succeeds via ADR-0091's webhook mechanism and is verified by a contract test asserting a real HTTP call |
|| G4 | Fully model Tier 2/3 without fabricating live delivery | Tier 2/3 produce `recorded_intent` audit entries; no outbound SMS/PagerDuty/telephony call is made or claimed |
|| G5 | Provide a deterministic, auditable incident lifecycle | Acknowledge halts the ack-timeout sweep; resolve requires non-empty root-cause notes; both are covered by contract tests |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `crisis_baseline_metrics` calibration

- **Description:** A scheduled worker (`CrisisBaselineCalibrationWorker`) maintains a rolling 14-day mean and standard deviation of mention velocity and negative-sentiment ratio, per watchlist, per `(day_of_week, hour_of_day)` bucket.
- **Triggers:** Fixed-interval schedule (implementation detail — e.g. hourly, aligned to the top of the hour).
- **Inputs:** Post-ingestion history matching each watchlist covered by an active `crisis_escalation_rules` row; sentiment-enrichment data (Azure AI Language, ADR-0016); precomputed daily-count views (ADR-0087/ADR-0123) where available, falling back to raw event/post history.
- **Processing:**
  1. For each active watchlist referenced by a `crisis_escalation_rules` row (directly or via a tenant-wide default), compute hourly mention counts and negative-sentiment ratios over the trailing 14 days.
  2. Group into `(day_of_week, hour_of_day)` buckets and compute `mean_14d`, `stddev_14d`, `sample_count` per bucket, per `metric_type`.
  3. `UPSERT` into `crisis_baseline_metrics` via `ON CONFLICT (watchlist_id, metric_type, day_of_week, hour_of_day) DO UPDATE`.
- **Outputs:** Current `crisis_baseline_metrics` rows, one per calibrated bucket — not a growing history table.
- **Error handling:** A bucket with fewer than the minimum sample-count floor (implementation detail, suggested 14) or a resulting `stddev_14d = 0` is written with that low `sample_count`/zero `stddev_14d` as-is; the *evaluation* engine (5.2), not the worker, is responsible for treating it as not-yet-calibrated and suppressing evaluation.
- **Edge cases:** A brand-new watchlist has no rows for any bucket until it accumulates enough history — crisis evaluation is inactive for that watchlist until then (a named v1 gap, ADR-0131 Consequences).

### 5.2 Feature / Capability: Z-score evaluation and dynamic tier assignment

- **Description:** For each new hourly observation on a watchlist with a calibrated bucket, computes `Z = (Observed Hourly Volume − mean_14d) / stddev_14d` and assigns an incident tier if both the Z-score and the negative-sentiment floor are met.
- **Triggers:** Reuses ADR-0091 §3's existing `AlertEvaluationWorker` event subscription (`SocialPostIngestedEvent`) — this evaluation logic is additive to that worker's existing rule-type dispatch, not a second, parallel event consumer.
- **Inputs:** The current hourly observation (mention count, negative-sentiment ratio) for the watchlist; the matching `crisis_baseline_metrics` bucket for the current `(day_of_week, hour_of_day)`; the watchlist's `crisis_escalation_rules` thresholds.
- **Processing:**
  1. Look up the calibrated bucket for the current `(day_of_week, hour_of_day)`. If absent, or `stddev_14d = 0`, or `sample_count` below the minimum floor, skip evaluation entirely for this observation.
  2. Compute `Z = (observed − mean_14d) / stddev_14d`.
  3. Determine the highest tier whose `tier{N}_z_threshold` is met by `Z`, provided `negative_sentiment_pct ≥ negative_sentiment_floor_pct`. If no tier's Z-score condition is met, or the sentiment floor is not met, no incident is created.
  4. Insert exactly one `crisis_incident_logs` row at the qualifying tier, snapshotting `observed_value`, `baseline_mean`, `baseline_stddev`, `z_score`, `negative_sentiment_pct`, and setting `ack_timeout_at = now() + crisis_escalation_rules.ack_timeout_minutes`.
- **Outputs:** A new `crisis_incident_logs` row at the correct tier, or no row if conditions aren't met.
- **Error handling:** An uncalibrated bucket never produces a Z-score (divide-by-zero is structurally prevented by the calibration gate in step 1, not caught after the fact).
- **Edge cases:** An observation meeting the Z-score bar but not the sentiment floor does not open an incident — a legitimate high-volume, non-negative event (e.g. viral positive coverage) is not treated as a crisis.

### 5.3 Feature / Capability: Stateful escalation engine — Tier 1 real dispatch, Tier 2/3 recorded intent

- **Description:** On incident creation, dispatches the configured action for that incident's own tier — Tier 1 via a real webhook call, Tier 2/3 via an audit-only `recorded_intent` entry — and tracks the ack-timeout for re-notification at the same tier.
- **Triggers:** Immediately on `crisis_incident_logs` row creation (5.2); subsequently, a periodic ack-timeout sweep.
- **Inputs:** The new incident's `tier`; the corresponding `crisis_escalation_rules.tier{N}_delivery` configuration.
- **Processing:**
  1. **Tier 1:** Construct an alert-shaped payload (per §7.3's `Tier1WebhookPayload`) and dispatch it through ADR-0091's existing signed-webhook delivery function, targeting `tier1_delivery.webhookUrls`. Record the real HTTP outcome (`delivered`/`failed`) as an `escalation_action_log` entry with `action: 'dispatched'`.
  2. **Tier 2/Tier 3:** Construct a `recorded_intent` `escalation_action_log` entry describing the vendor/target/channel from `tier2_delivery`/`tier3_delivery`, with `outcome: 'not_attempted_intent_only'`. No outbound HTTP/SMS/telephony call is made.
  3. **Ack-timeout sweep:** A periodic process queries `crisis_incident_logs WHERE status = 'open' AND ack_timeout_at < now()` (using `idx_crisis_incident_logs_open_ack_timeout`) and appends another action-log entry at the *same* tier (re-notification), resetting `ack_timeout_at` forward by `ack_timeout_minutes`. Tier is never promoted by this sweep.
- **Outputs:** `crisis_incident_logs.escalation_action_log` grows by one entry per dispatch/recorded-intent/re-notification action.
- **Error handling:** A failed Tier 1 webhook dispatch (non-2xx or network failure) is recorded with `outcome: 'failed'` and `detail` carrying the HTTP status/error — it does not retry indefinitely within this design; retry policy is an implementation detail left to whoever builds the worker, consistent with how ADR-0091's own webhook delivery does not specify a retry policy either.
- **Edge cases:** A Tier 3 incident's own creation only ever dispatches the Tier 3 action once at creation — it does not also fire Tier 1 and Tier 2 actions for the same incident (tiers are mutually exclusive per incident, not cumulative).

### 5.4 Feature / Capability: `POST /v1/crisis/incidents/:id/acknowledge`

- **Description:** Records the acknowledging responder and halts the ack-timeout sweep for that incident.
- **Triggers:** An authorized user (role gate, §5.6) confirms they are handling the incident.
- **Inputs:** Path parameter `id` (`crisis_incident_logs.id`); no required request body fields — responder identity is resolved server-side from the authenticated session (ADR-0033), never client-supplied.
- **Processing:** Sets `status = 'acknowledged'`, `acknowledged_by_user_id`, `acknowledged_at = now()`. Because the ack-timeout sweep (5.3) filters on `status = 'open'`, an acknowledged incident is automatically excluded from further re-notification without a separate flag.
- **Outputs:** `{ incidentId, status: 'acknowledged', acknowledgedByUserId, acknowledgedAt }` (see §7.4 for the full interface).
- **Error handling:** Unknown/cross-tenant `id` → 404; caller lacking `Tenant-Brand-Reputation-Manager`/`Tenant-Admin` → 403; already-`resolved` incident → 409 `invalid_state_transition`.
- **Edge cases:** Acknowledging an already-`acknowledged` incident is idempotent — no error, no state change, `acknowledged_at` is not overwritten (implementation detail: a no-op 200, not a 409, since re-acknowledging isn't a meaningful state conflict the way acknowledging a resolved incident is).

### 5.5 Feature / Capability: `POST /v1/crisis/incidents/:id/resolve`

- **Description:** Archives the incident with mandatory root-cause notes and a resolution timestamp.
- **Triggers:** The responder has completed triage and closes out the incident.
- **Inputs:** Path parameter `id`; request body `{ rootCauseNotes: string }` — required, non-empty.
- **Processing:** Validates `rootCauseNotes` is present and non-blank (422 if not, before any write); sets `status = 'resolved'`, `resolved_by_user_id`, `resolved_at = now()`, `root_cause_notes`.
- **Outputs:** `{ incidentId, status: 'resolved', resolvedByUserId, resolvedAt, rootCauseNotes }` (see §7.4).
- **Error handling:** Same 404/403 pattern as acknowledge; missing/blank `rootCauseNotes` → 422 `validation_failed`; already-`resolved` incident → 409 `invalid_state_transition`.
- **Edge cases:** Resolving an incident that was never acknowledged is allowed — acknowledgment and resolution are independent state transitions, not a strict sequence (an incident can be resolved directly if the responder handles it immediately without a separate ack step).

### 5.6 Role gating

Both lifecycle endpoints require the caller to hold `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` — an application-layer role check (ADR-0030 §1 pattern), not RLS. Read visibility of incidents (not itself an endpoint specified by Story 17.3, left to the frontend follow-on) is RLS-enforced tenant isolation only, with no additional role gate.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Tenant-Brand-Reputation-Manager | Configures escalation rules; acknowledges/resolves incidents; is the real recipient of Tier 1 webhook notifications |
|| Tenant-Admin | May also configure escalation rules and acknowledge/resolve incidents |
|| On-call crisis responder | Whoever acknowledges/resolves in practice — role-gated to the same two roles above; no separate "responder" role is introduced |
|| ADR-0091 webhook delivery mechanism (system actor) | Invoked by Tier 1 dispatch, unmodified |
|| CrisisBaselineCalibrationWorker (system actor) | Maintains `crisis_baseline_metrics` |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 17.3 | brand reputation manager or on-call crisis responder | have automated rolling 14-day statistical baseline calibration and multi-tier incident escalation | crisis alerts reflect true statistical anomalies rather than brittle static post counts, and unacknowledged critical incidents deterministically escalate | `crisis_baseline_metrics`/`crisis_escalation_rules`/`crisis_incident_logs` created with RLS and time-bucket indexing; calibration worker computes rolling 14-day mu/sigma; Z-score evaluation triggers tiers per the specified thresholds; escalation engine tracks ack timeout and deterministically escalates (Tier 1 real webhook, Tier 2/3 recorded intent); acknowledge/resolve endpoints behave per §5.4/§5.5 |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — an incident opens, escalates, and resolves:**

1. `CrisisBaselineCalibrationWorker` maintains `crisis_baseline_metrics` on a fixed schedule (5.1).
2. A new hourly observation arrives via the existing ingestion-event path; the evaluation logic (5.2, additive to ADR-0091's `AlertEvaluationWorker`) computes a Z-score against the calibrated bucket.
3. If the Z-score and sentiment floor both qualify, exactly one `crisis_incident_logs` row is created at the correct tier.
4. The escalation engine (5.3) immediately dispatches that tier's action: a real webhook call for Tier 1, or a `recorded_intent` audit entry for Tier 2/3.
5. If the incident remains `open` past `ack_timeout_at`, the sweep re-notifies at the same tier and pushes `ack_timeout_at` forward.
6. A responder calls `POST /v1/crisis/incidents/:id/acknowledge` (5.4), halting the sweep.
7. The responder calls `POST /v1/crisis/incidents/:id/resolve` (5.5) with `rootCauseNotes`, closing the incident permanently.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Post-ingestion history and sentiment enrichment per watchlist (existing pipeline, ADR-0016).
- Tenant-configured escalation rules (`crisis_escalation_rules`).
- Authenticated caller identity for acknowledge/resolve (`user_id`, `tenant_id`, role) via existing session/RLS mechanism.

### 7.2 Data Outputs

- `crisis_baseline_metrics` rows (current calibrated state, not a history table).
- `crisis_incident_logs` rows, including the append-only `escalation_action_log`.
- Real webhook HTTP calls for Tier 1 only.

### 7.3 Data Model / Entities — full SQL schema

```sql
CREATE TABLE crisis_baseline_metrics (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  watchlist_id       uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  metric_type        text NOT NULL,        -- 'mention_velocity' | 'negative_sentiment_ratio'
  day_of_week        smallint NOT NULL,    -- 0..6, Postgres EXTRACT(DOW)
  hour_of_day        smallint NOT NULL,    -- 0..23, UTC
  mean_14d           numeric NOT NULL,
  stddev_14d         numeric NOT NULL,
  sample_count       int NOT NULL DEFAULT 0,
  last_calibrated_at timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crisis_baseline_metrics_metric_type_check
    CHECK (metric_type IN ('mention_velocity', 'negative_sentiment_ratio')),
  CONSTRAINT crisis_baseline_metrics_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT crisis_baseline_metrics_hour_of_day_check CHECK (hour_of_day BETWEEN 0 AND 23),
  CONSTRAINT crisis_baseline_metrics_unique_bucket
    UNIQUE (watchlist_id, metric_type, day_of_week, hour_of_day)
);

CREATE INDEX idx_crisis_baseline_metrics_tenant_watchlist
  ON crisis_baseline_metrics (tenant_id, watchlist_id);
CREATE INDEX idx_crisis_baseline_metrics_bucket_lookup
  ON crisis_baseline_metrics (watchlist_id, metric_type, day_of_week, hour_of_day);

ALTER TABLE crisis_baseline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_baseline_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crisis_baseline_metrics
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

---

CREATE TABLE crisis_escalation_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  watchlist_id          uuid REFERENCES watchlists(id) ON DELETE CASCADE,  -- NULL = tenant-wide default
  tier1_z_threshold     numeric NOT NULL DEFAULT 2.0,
  tier2_z_threshold     numeric NOT NULL DEFAULT 3.0,
  tier3_z_threshold     numeric NOT NULL DEFAULT 4.5,
  negative_sentiment_floor_pct numeric NOT NULL DEFAULT 40,
  ack_timeout_minutes   int NOT NULL DEFAULT 15,
  tier1_delivery        jsonb NOT NULL DEFAULT '{"channel": "webhook", "webhookUrls": []}',
  tier2_delivery        jsonb NOT NULL DEFAULT '{"channel": "intent_only", "vendor": "pagerduty_or_sms", "recipients": []}',
  tier3_delivery        jsonb NOT NULL DEFAULT '{"channel": "intent_only", "vendor": "executive_phone_broadcast", "recipients": []}',
  is_active             boolean NOT NULL DEFAULT true,
  created_by_user_id    uuid NOT NULL REFERENCES users(id),
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crisis_escalation_rules_tier_order_check
    CHECK (tier1_z_threshold < tier2_z_threshold AND tier2_z_threshold < tier3_z_threshold)
);

CREATE UNIQUE INDEX idx_crisis_escalation_rules_scope
  ON crisis_escalation_rules (tenant_id, COALESCE(watchlist_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TRIGGER set_crisis_escalation_rules_updated_at
  BEFORE UPDATE ON crisis_escalation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE crisis_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_escalation_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crisis_escalation_rules
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

---

CREATE TABLE crisis_incident_logs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  watchlist_id            uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  escalation_rule_id      uuid NOT NULL REFERENCES crisis_escalation_rules(id),
  metric_type             text NOT NULL,
  observed_value          numeric NOT NULL,
  baseline_mean           numeric NOT NULL,
  baseline_stddev         numeric NOT NULL,
  z_score                 numeric NOT NULL,
  negative_sentiment_pct  numeric NOT NULL,
  tier                    smallint NOT NULL,
  status                  text NOT NULL DEFAULT 'open',
  acknowledged_by_user_id uuid REFERENCES users(id),
  acknowledged_at         timestamptz,
  ack_timeout_at          timestamptz NOT NULL,
  resolved_by_user_id     uuid REFERENCES users(id),
  resolved_at             timestamptz,
  root_cause_notes        text,
  escalation_action_log   jsonb NOT NULL DEFAULT '[]',
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crisis_incident_logs_tier_check CHECK (tier IN (1, 2, 3)),
  CONSTRAINT crisis_incident_logs_status_check CHECK (status IN ('open', 'acknowledged', 'resolved')),
  CONSTRAINT crisis_incident_logs_resolved_requires_notes
    CHECK (status <> 'resolved' OR (root_cause_notes IS NOT NULL AND length(trim(root_cause_notes)) > 0))
);

CREATE INDEX idx_crisis_incident_logs_open_ack_timeout
  ON crisis_incident_logs (ack_timeout_at)
  WHERE status = 'open';
CREATE INDEX idx_crisis_incident_logs_tenant_watchlist_created
  ON crisis_incident_logs (tenant_id, watchlist_id, created_at DESC);

ALTER TABLE crisis_incident_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_incident_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crisis_incident_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

**`escalation_action_log` entry shape (application-validated, TS):**

```ts
interface EscalationActionLogEntry {
  tier: 1 | 2 | 3;
  action: 'dispatched' | 'recorded_intent';
  channel: 'webhook' | 'sms' | 'pagerduty' | 'executive_phone_broadcast';
  recipientOrTarget: string;
  attemptedAt: string;   // ISO 8601
  outcome: 'delivered' | 'failed' | 'not_attempted_intent_only';
  detail?: string;
}
```

**Tier 1 webhook payload (reuses ADR-0091 §6's alert payload shape, tier-specific fields added):**

```ts
interface Tier1WebhookPayload {
  incidentId: string;
  tenantId: string;
  watchlistId: string;
  tier: 1;
  triggeredAt: string;       // ISO 8601
  zScore: number;
  observedValue: number;
  negativeSentimentPct: number;
  summary: string;           // one-sentence description, e.g. "Mention velocity 3.1σ above 14-day baseline"
}
```

### 7.4 TS Request/Response Interfaces — lifecycle endpoints

```ts
// POST /v1/crisis/incidents/:id/acknowledge
interface AcknowledgeIncidentRequest {
  // No client-supplied body fields; responder identity resolved server-side (ADR-0033)
}

interface AcknowledgeIncidentResponse {
  incidentId: string;
  status: 'acknowledged';
  acknowledgedByUserId: string;
  acknowledgedAt: string;    // ISO 8601
}

// POST /v1/crisis/incidents/:id/resolve
interface ResolveIncidentRequest {
  rootCauseNotes: string;    // required, non-empty
}

interface ResolveIncidentResponse {
  incidentId: string;
  status: 'resolved';
  resolvedByUserId: string;
  resolvedAt: string;        // ISO 8601
  rootCauseNotes: string;
}
```

### 7.5 Validation Rules

- A Z-score is computed only for buckets with `stddev_14d > 0` and `sample_count` at or above the minimum floor.
- An incident requires both a qualifying Z-score for some tier and `negative_sentiment_pct ≥ negative_sentiment_floor_pct`.
- `rootCauseNotes` must be a non-empty, trimmed string before `resolve` writes anything.
- `tenant_id` on every created row must match the authenticated caller's tenant, never client-supplied.
- `crisis_escalation_rules_tier_order_check` enforces `tier1 < tier2 < tier3` thresholds at the database level, not just in application code.

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | A Z-score is only computed for a calibrated bucket (`stddev_14d > 0`, `sample_count` above the floor). | Evaluation engine |
|| BR2 | An incident requires both a qualifying Z-score and a qualifying negative-sentiment ratio. | Evaluation engine |
|| BR3 | Exactly one incident row is created per triggering observation, at its single highest-qualifying tier. | Evaluation engine |
|| BR4 | Tier is fixed at incident creation; ack-timeout elapsing re-notifies at the same tier, never promotes it. | Escalation engine |
|| BR5 | Tier 1 delivery is always a real dispatch via ADR-0091's webhook mechanism. | Escalation engine |
|| BR6 | Tier 2/3 delivery is always `recorded_intent` only in v1; no live SMS/PagerDuty/telephony call is made. | Escalation engine |
|| BR7 | An incident cannot be `resolved` without non-empty `rootCauseNotes`. | Resolve endpoint |
|| BR8 | Acknowledging halts the ack-timeout sweep; it does not resolve the incident. | Acknowledge endpoint |
|| BR9 | Acknowledge and resolve require `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`. | Both lifecycle endpoints |
|| BR10 | All three new tables are tenant-isolated by RLS with no bypass. | Data model |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
||---|---|---|---|
|| ADR-0091 webhook delivery mechanism | Outbound from escalation engine (Tier 1 only) | Dispatches a real, signed Slack/Teams-compatible webhook | HTTPS `POST`, JSON, signed per ADR-0092 |
|| `AlertEvaluationWorker` (ADR-0091 §3) | Internal, event subscription reused | Supplies the `SocialPostIngestedEvent` stream this feature's Z-score evaluation is additive to | Existing internal event bus |
|| Azure AI Language sentiment enrichment (ADR-0016) | Internal, data source | Supplies negative-sentiment ratio for both baseline calibration and live evaluation | Existing internal enrichment pipeline |
|| Precomputed daily-count views (ADR-0087/ADR-0123) | Internal, data source | Bounded-latency historical data for the calibration worker, where available | Existing internal views |
|| Crisis incident lifecycle API (this feature) | Inbound | Acknowledge/resolve incidents | HTTPS REST, JSON (`POST /v1/crisis/incidents/:id/acknowledge`, `POST /v1/crisis/incidents/:id/resolve`) |
|| SMS/PagerDuty/telephony vendor (not built) | N/A | **Not integrated in v1** — Tier 2/3 record intent only, per ADR-0131 §4 | N/A |

---

## 10. Non-Functional Considerations

- **Performance:** The ack-timeout sweep must remain indexed (`idx_crisis_incident_logs_open_ack_timeout`, a partial index on `status = 'open'`) as incident volume grows (BRD-0131 NFR-001).
- **Security / access control:** All three tables are RLS-isolated per tenant (NFR-002); acknowledge/resolve are role-gated to `Tenant-Brand-Reputation-Manager`/`Tenant-Admin` (§5.6).
- **Transparency / trust:** `escalation_action_log.action` must never let a Tier 2/3 `recorded_intent` entry be mistaken for a real dispatch — no field name or UI copy should imply delivery occurred (NFR-003).
- **Reliability / auditability:** `crisis_incident_logs` origin fields (`z_score`, `baseline_mean`, `baseline_stddev`, `tier`) are immutable snapshots; no generic `updated_at`/trigger exists on this table (NFR-004).
- **Reliability:** Uncalibrated buckets are excluded from evaluation, preventing divide-by-zero or spurious Z-scores (NFR-005).
- **Maintainability:** `crisis_baseline_metrics` holds only the current calibrated state (upsert, not append), keeping the table bounded regardless of tenant/watchlist growth.

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| Unknown or cross-tenant incident `id` | Incident not found | 404 `not_found` (ADR-0044 §2 mapping) |
|| Caller lacks required role | Access denied / insufficient permissions | 403 `forbidden` |
|| Missing/blank `rootCauseNotes` on resolve | Root-cause notes are required to resolve an incident | 422 `validation_failed`, before any write |
|| Acknowledge/resolve called on an already-`resolved` incident | This incident is already resolved | 409 `invalid_state_transition` |
|| Re-acknowledging an already-`acknowledged` incident | (no error shown) | 200, idempotent no-op |
|| Tier 1 webhook dispatch fails (non-2xx/network error) | (internal; incident remains open) | `escalation_action_log` entry with `outcome: 'failed'`; incident state unaffected |
|| Uncalibrated bucket (no baseline yet) | (no incident created; not user-facing) | Evaluation skipped for that observation; no error raised |

---

## 12. Assumptions and Dependencies

- ADR-0091's webhook delivery mechanism (Accepted, Story 10.9 Built) is reused unchanged for Tier 1 — verified, not assumed.
- No SMS/PagerDuty/telephony integration exists anywhere in either repo as of 2026-09-09 (verified by grep, both repos, `src/`/`migrations/`/`contracts/`).
- Watchlists (ADR-0044) and sentiment enrichment (ADR-0016) are already built and stable.
- A frontend follow-on for escalation-rule configuration and incident review is not yet numbered and is out of this document's scope.

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
||---|---|---|---|
|| Q1 | What platform-level ceiling, if any, bounds the calibration worker's and ack-timeout sweep's polling frequency? | Engineering | Before implementation of Story 17.3, sized against real load |
|| Q2 | Which vendor(s) should a future SMS/PagerDuty/telephony ADR evaluate, and who bears the cost? | Product / Menno | Explicitly deferred to that future ADR, not this document |

---

## 14. Appendix

### Glossary

- **Baseline:** Rolling 14-day mean/stddev of a metric for a specific watchlist/hour-of-day/day-of-week bucket.
- **Z-score:** `(Observed Hourly Volume − mean_14d) / stddev_14d`.
- **Tier:** One of three severity levels (1, 2, 3) assigned at incident creation.
- **Recorded intent:** An audit-log entry describing an escalation action that would have been dispatched to a real vendor but was not, because no such integration exists yet.
- **Ack timeout:** The window (default 15 minutes) after which an unacknowledged open incident is re-notified at the same tier.

### Reference links

- ADR: `docs/adr/0131-crisis-template-bundle-and-activation-refinements.md`
- BRD: `docs/project docs/Business-Requirements/BRD-0131-Crisis-Template-Bundle-And-Activation-Refinements.md`
- Related ADRs: `ADR-0079` (feature this refines), `ADR-0091` (source of Tier 1's real webhook mechanism), `ADR-0092` (webhook signing), `ADR-0044` (RLS/PATCH/error-mapping conventions), `ADR-0016` (sentiment enrichment), `ADR-0087`/`ADR-0123` (precomputed views), `ADR-0005` (immutability precedent), `ADR-0020` (deferred speculative infrastructure precedent)
- Related user story: Story 17.3, `docs/user-stories/epic-17-adr-0129-to-0133.md`
- Executable contract test citation: `social-listening-core/contracts/epic-17/story-17.3.crisis-baseline-escalation.contract.test.ts`

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
