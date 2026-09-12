# ADR-0131: Crisis template bundle refinements — automated baseline calibration and escalation trees

**Status:** Accepted (2026-08-28)

**Authorizes:** refinements to ADR-0079: dynamic baseline calculation (rolling 14-day standard deviation) and multi-tier notification escalation matrices.

**Source:** Story 17.3 (`docs/user-stories/epic-17-adr-0129-to-0133.md`), extending ADR-0079's crisis-template bundle and reusing ADR-0091's delivery infrastructure.

---

## Context

### 1. ADR-0079's thresholds are static and its delivery is deferred intent-only
ADR-0079 (Accepted 2026-08-23, amended 2026-08-25) lets a tenant activate a crisis template with `default_thresholds` such as `{ volume_spike_pct: 50, negative_sentiment_pct: 60 }` — fixed numbers, the same for every watchlist regardless of that watchlist's own normal baseline. A watchlist that normally sees 5 mentions/hour and one that normally sees 500 mentions/hour are held to the same static percentage-spike threshold, which is exactly the false-positive/missed-signal failure mode BRD-0079 §6 names as a pain point of the *manual* process this feature was meant to replace. ADR-0079's own Amendment (2026-08-25) also established that v1 activation stores `thresholds`/`notification_channel_ids` as **intent only** — no live evaluation, no delivery — deferring real alerting to ADR-0091.

### 2. ADR-0091 is now Accepted and built — but only for three delivery channels
Unlike the situation ADR-0079's Amendment faced (ADR-0091 Proposed, Story 10.9 Blocked), that gap is now partially closed: ADR-0091 (Accepted 2026-08-28) is Accepted, its Story 10.9 is Built (`social-listening-core@fdb9bb8`), and it ships a real `alert_rules` table, an `AlertEvaluationWorker`, and three real, working delivery channels — **in-app** (`tenant_alerts`), **email** (Azure Communication Services / tenant SMTP), and **webhook** (signed `POST` to a tenant-configured URL, ADR-0092 signing convention). Verified by grep across both repos' `src/`, `migrations/`, and `contracts/` directories (2026-08-28, re-confirmed for this ADR): **no SMS, PagerDuty, Twilio, or telephony/voice-broadcast client or integration exists anywhere in the codebase**, and no Accepted ADR authorizes one. ADR-0091 §4's Decision text is exhaustive on this point — it names exactly three channels and no others.

### 3. Story 17.3 asks for a fourth tier of delivery mechanism the codebase doesn't have
Story 17.3's Acceptance Criteria specify a three-tier escalation: Tier 1 to a Slack/Teams webhook, Tier 2 to SMS/PagerDuty, Tier 3 to an executive phone-call broadcast. Tier 1 maps cleanly onto ADR-0091's existing generic signed webhook — Slack and Teams both accept arbitrary signed `POST` payloads to an incoming-webhook URL, which is exactly ADR-0091 §4's webhook shape. Tier 2 (SMS/PagerDuty) and Tier 3 (executive phone call) are not webhook-shaped at all: they require a named vendor (Twilio, PagerDuty, or equivalent), a purchased/provisioned account, an accepted API contract, and — per this project's established discipline — an Accepted ADR before any of that is built. None of that exists today.

### 4. This project has already resolved an identical problem once, for the immediately-preceding version of this same feature
ADR-0079's own "Correction (2026-08-25)" and "Amendment (2026-08-25)" sections document the precedent: when Story 9.3 hit an ADR that assumed infrastructure (`alert_rules`, notification channels) that did not exist and was not backed by any Accepted ADR, the implementing agent stopped rather than freelance a schema, and the resolution was to **defer** — build only what a real, Accepted ADR supports, and store the rest as recorded intent with a named, not-yet-numbered follow-on. ADR-0020 (distributed rate-limit gate, deferred until a second concurrent instance is ever actually run) is this project's other standing precedent for the same general bias: don't build speculative infrastructure ahead of an accepted design.

This ADR applies that same precedent here, in a **partially resolved** form: unlike ADR-0079's situation, a real delivery mechanism (ADR-0091's webhook) already exists and is genuinely reusable for Tier 1. Only Tier 2/Tier 3's specific vendor integrations are missing.

---

## Decision

### 1. New `crisis_baseline_metrics` table — rolling 14-day per-watchlist statistical baseline
Platform-computed, tenant-scoped, one row per `(watchlist_id, metric_type, hour_of_day, day_of_week)` bucket. A `Tenant-Brand-Reputation-Manager` never writes this table directly; a scheduled worker maintains it.

```sql
CREATE TABLE crisis_baseline_metrics (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  watchlist_id       uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  metric_type        text NOT NULL,        -- 'mention_velocity' | 'negative_sentiment_ratio'
  day_of_week        smallint NOT NULL,    -- 0 (Sunday) .. 6 (Saturday), per Postgres EXTRACT(DOW)
  hour_of_day        smallint NOT NULL,    -- 0..23, UTC
  mean_14d           numeric NOT NULL,     -- rolling 14-day mean (mu) for this bucket
  stddev_14d         numeric NOT NULL,     -- rolling 14-day population standard deviation (sigma) for this bucket
  sample_count       int NOT NULL DEFAULT 0,   -- number of historical hourly observations folded into mean_14d/stddev_14d
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

-- Time-bucket lookup path: "give me this watchlist's baseline for the bucket the current hour falls into"
CREATE INDEX idx_crisis_baseline_metrics_bucket_lookup
  ON crisis_baseline_metrics (watchlist_id, metric_type, day_of_week, hour_of_day);

ALTER TABLE crisis_baseline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_baseline_metrics FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON crisis_baseline_metrics
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

`updated_at` is intentionally omitted per ADR-0044 §4's exempt-list discipline extended one step further: this table is written exclusively by the calibration worker via `INSERT ... ON CONFLICT (watchlist_id, metric_type, day_of_week, hour_of_day) DO UPDATE`, never by a user-facing PATCH, so `last_calibrated_at` (application-set, by the worker) fully covers the "when was this last recalculated" need without a trigger.

RLS carries only the tenant predicate, not a `user_id` ownership predicate — baselines are a computed property of a `watchlist`, which is itself owned by a single user (ADR-0044 §5c); any tenant user who can see the parent `watchlist_id` (via the incident/escalation surface, not this table directly) needs the same baseline data, so ownership is inherited from the `watchlist`, not independently re-enforced here.

### 2. New `crisis_escalation_rules` table — per-tenant tier configuration
One row per `(tenant_id, watchlist_id)` (or a tenant-wide default row with `watchlist_id IS NULL`), holding the deterministic escalation matrix.

```sql
CREATE TABLE crisis_escalation_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  watchlist_id          uuid REFERENCES watchlists(id) ON DELETE CASCADE,  -- NULL = tenant-wide default
  tier1_z_threshold     numeric NOT NULL DEFAULT 2.0,
  tier2_z_threshold     numeric NOT NULL DEFAULT 3.0,
  tier3_z_threshold     numeric NOT NULL DEFAULT 4.5,
  negative_sentiment_floor_pct numeric NOT NULL DEFAULT 40,  -- both the Z-score AND this floor must be met
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
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();  -- per ADR-0044 §4, reusing the existing trigger function

ALTER TABLE crisis_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_escalation_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON crisis_escalation_rules
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

**`tier1_delivery.channel` is always `'webhook'`** and is dispatched for real through ADR-0091's existing webhook delivery mechanism (§4 below). **`tier2_delivery.channel` and `tier3_delivery.channel` are always `'intent_only'`** in this v1 — see §4's resolution of the delivery question. The `vendor`/`recipients` fields on tiers 2/3 are captured and validated for shape, exactly as ADR-0079's Amendment captured `notificationChannelIds` as intent before real infrastructure existed — but they drive an audit-log entry, not a live third-party API call.

### 3. New `crisis_incident_logs` table — incident lifecycle and full audit trail
The stateful record an incident's Z-score evaluation, tier, acknowledgment, escalation actions, and resolution all attach to.

```sql
CREATE TABLE crisis_incident_logs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  watchlist_id            uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  escalation_rule_id      uuid NOT NULL REFERENCES crisis_escalation_rules(id),
  metric_type             text NOT NULL,      -- 'mention_velocity' | 'negative_sentiment_ratio'
  observed_value          numeric NOT NULL,   -- observed hourly volume or sentiment ratio that triggered evaluation
  baseline_mean           numeric NOT NULL,   -- mu_14d at evaluation time (snapshot, not a live join)
  baseline_stddev         numeric NOT NULL,   -- sigma_14d at evaluation time (snapshot)
  z_score                 numeric NOT NULL,   -- (observed_value - baseline_mean) / baseline_stddev
  negative_sentiment_pct  numeric NOT NULL,   -- negative-sentiment ratio at evaluation time, checked against the floor
  tier                    smallint NOT NULL,  -- 1, 2, or 3
  status                  text NOT NULL DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved'
  acknowledged_by_user_id uuid REFERENCES users(id),
  acknowledged_at         timestamptz,
  ack_timeout_at          timestamptz NOT NULL,  -- created_at + escalation_rule.ack_timeout_minutes at time of tier trigger
  resolved_by_user_id     uuid REFERENCES users(id),
  resolved_at             timestamptz,
  root_cause_notes        text,               -- mandatory at resolution time, enforced at the application layer
  escalation_action_log   jsonb NOT NULL DEFAULT '[]',  -- append-only array of dispatched/recorded escalation actions, see below
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crisis_incident_logs_tier_check CHECK (tier IN (1, 2, 3)),
  CONSTRAINT crisis_incident_logs_status_check CHECK (status IN ('open', 'acknowledged', 'resolved')),
  CONSTRAINT crisis_incident_logs_resolved_requires_notes
    CHECK (status <> 'resolved' OR (root_cause_notes IS NOT NULL AND length(trim(root_cause_notes)) > 0))
);

-- Time-bucket index for the escalation engine's own poll ("which open incidents have crossed ack_timeout_at?")
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

`crisis_incident_logs` has no `updated_at` and no update trigger by design — per ADR-0044 §4's exempt-list pattern, this table is treated as **append-only with two well-defined state transitions** (`open → acknowledged`, `open|acknowledged → resolved`), each writing its own dedicated timestamp column (`acknowledged_at`, `resolved_at`) rather than a generic `updated_at`. This mirrors ADR-0005's `IngestionRun` immutability precedent: an incident's origin data (`observed_value`, `baseline_mean`, `baseline_stddev`, `z_score`, `tier`) is a snapshot at trigger time and must never be silently rewritten by a later recalibration of `crisis_baseline_metrics`.

`escalation_action_log` entries follow this shape (validated at the application layer, not by a JSON-Schema `CHECK` constraint — consistent with how `alert_rules.threshold`/`delivery` in ADR-0091 §1 are validated in application code, not in SQL):

```ts
interface EscalationActionLogEntry {
  tier: 1 | 2 | 3;
  action: 'dispatched' | 'recorded_intent';   // 'dispatched' = real delivery attempted; 'recorded_intent' = §4 below
  channel: 'webhook' | 'sms' | 'pagerduty' | 'executive_phone_broadcast';
  recipientOrTarget: string;                   // webhook URL, phone number, PagerDuty service key, etc. — as configured, not resolved against a real vendor for tier 2/3
  attemptedAt: string;                         // ISO 8601
  outcome: 'delivered' | 'failed' | 'not_attempted_intent_only';
  detail?: string;                             // e.g. HTTP status for a real webhook dispatch, or "would have paged Brand Reputation Manager via PagerDuty" for intent-only tiers
}
```

### 4. Tier 2/Tier 3 delivery resolution — reuse ADR-0091's webhook for Tier 1; record Tier 2/3 as audited intent, do not build SMS/PagerDuty/telephony now

**Decision: mirror ADR-0079's Amendment pattern exactly, but only for the two tiers that actually lack infrastructure.**

- **Tier 1 gets real, working dispatch.** `crisis_escalation_rules.tier1_delivery` is dispatched by calling ADR-0091's existing webhook delivery path (`alert_rules.delivery.webhooks` / the webhook-signing convention in ADR-0092) with a `tier1_delivery.webhookUrls` entry as the target. This is architecturally sound to reuse as-is: Slack and Teams incoming webhooks accept an arbitrary signed `POST`, which is precisely what ADR-0091 §4/§6 already builds and Story 10.9 already ships. No new delivery code is introduced for Tier 1 — the escalation engine constructs an alert-shaped payload (§6 below) and calls the same dispatch function ADR-0091's `AlertEvaluationWorker` already uses. Every Tier 1 dispatch writes a `dispatched` / `delivered`-or-`failed` `escalation_action_log` entry with the real HTTP outcome.
- **Tier 2 (SMS/PagerDuty) and Tier 3 (executive phone-call broadcast) are fully modeled but not live-dispatched.** The schema (`crisis_escalation_rules.tier2_delivery`/`tier3_delivery`), the state machine (tier computation, `ack_timeout_minutes` tracking, deterministic escalation ordering), and the audit trail (`crisis_incident_logs.escalation_action_log`) are all real and fully testable — a contract test can assert that a Tier 2 incident produces exactly one `recorded_intent` log entry for the configured `vendor`/`recipients`, at the correct time, following the correct ack-timeout state transition. What does **not** happen is an actual outbound call to Twilio, PagerDuty, or any telephony API — because none is integrated, none is Accepted, and inventing one now would repeat exactly the mistake ADR-0079's Correction found and its Amendment fixed: building a schema and a code path against a vendor/API contract with no ADR behind it.
- **Named follow-on, not silently dropped:** once a real SMS/PagerDuty/telephony ADR is proposed and accepted (with a chosen vendor, an accepted API contract, and — given this data is fundamentally alerting a human being by phone — a deliverability/cost/on-call-rotation design that does not yet exist anywhere in this project), a follow-on story wires `tier2_delivery`/`tier3_delivery`'s `recorded_intent` action into a real `dispatched` one, with no schema migration needed beyond the `escalation_action_log.action` value actually observed changing from `recorded_intent` to `dispatched` at runtime. `crisis_escalation_rules`'s `tier2_delivery`/`tier3_delivery` JSONB shape is deliberately vendor-agnostic (`vendor`/`recipients` as free-form fields, not `pagerdutyServiceKey`/`twilioPhoneNumber`-specific columns) so that whichever vendor that future ADR picks does not require a breaking schema change here.

**Why this, not "build a minimal Tier-2/3 client now":** the same reasoning ADR-0079's Amendment gave against a "minimal `alert_rules` table now" applies with equal force here, with an even sharper edge — SMS/PagerDuty/telephony are not internal architecture choices this project controls (unlike a first-party `alert_rules` table), they are paid, credentialed, third-party vendor integrations. Choosing Twilio vs. a PagerDuty Events API vs. a telephony broadcast provider is a real vendor-selection decision (cost, deliverability, contractual terms) that belongs in its own ADR with its own Alternatives-considered section — not decided as a side effect of this incident-escalation feature. Building even a "minimal" SMS client now would mean either (a) picking a vendor without the deliberation that decision deserves, or (b) building a fake/no-op client that looks real but isn't — worse than an honest `recorded_intent` audit entry, because it invites a future engineer to assume delivery is live when it isn't.

**Why not defer Tier 1 too, for symmetry with ADR-0079's original "defer everything" resolution:** ADR-0079 deferred *all* delivery because *no* delivery mechanism existed at all at the time — deferring was the only option that didn't fabricate infrastructure. That is no longer true for webhook delivery: ADR-0091 is Accepted and Story 10.9 is Built. Deferring Tier 1 anyway, when a real, working, already-shipped mechanism fits it exactly, would be over-applying the precedent past the reason it existed — the point of ADR-0079's Amendment was never "defer everything on principle," it was "don't build infrastructure a real ADR hasn't authorized." Tier 1's infrastructure is already authorized.

### 5. Baseline calibration worker
- A new scheduled worker, `CrisisBaselineCalibrationWorker`, runs on a fixed interval (implementation detail — e.g. hourly, aligned to the top of each hour so `hour_of_day`/`day_of_week` buckets are stable) and, for every active `watchlist` referenced by at least one `crisis_escalation_rules` row (or covered by a tenant-wide default row), recomputes `mean_14d`/`stddev_14d`/`sample_count` for both `metric_type` values, per `(day_of_week, hour_of_day)` bucket, over the trailing 14 days of hourly observations.
- Source data for "mention velocity" is hourly post counts matching the watchlist (the same underlying data ADR-0091's `volume` rule type and ADR-0087's precomputed daily views already aggregate — this worker reuses `watchlist_daily_counts`-style precomputed aggregates where available, per ADR-0123's own "Implementation Learnings" precedent of using `watchlist_daily_counts` for bounded-latency historical queries, falling back to raw `SocialPostIngestedEvent`/post-table history otherwise).
- Source data for "negative sentiment ratio" is the hourly ratio of posts with negative sentiment (Azure AI Language enrichment, ADR-0016) to total matched posts for the watchlist.
- The worker writes via `INSERT ... ON CONFLICT (watchlist_id, metric_type, day_of_week, hour_of_day) DO UPDATE`, so `crisis_baseline_metrics` always holds exactly one current row per bucket — never a growing history table. This is an explicit, intentional design choice: baseline history itself is not retained past the current rolling calculation, because nothing in Story 17.3's Acceptance Criteria asks for baseline trend analysis, only for the current rolling 14-day mu/sigma to drive live Z-score evaluation.
- A bucket with `sample_count` below a reasonable minimum (implementation detail, suggested floor: 14 — i.e. at least one observation per day of the trailing window) must not produce a usable `stddev_14d` of `0` that would make every subsequent observation an infinite Z-score; the evaluation engine (§6) treats a bucket with `stddev_14d = 0` or `sample_count` below the floor as **not yet calibrated**, and suppresses tier evaluation for that bucket entirely rather than firing on divide-by-zero. This is a genuine v1 gap for brand-new watchlists (no crisis alerting until 14 days of history exist) — named directly in Consequences below, not glossed over.

### 6. Z-score evaluation and dynamic tier triggering
For each new hourly observation on a watchlist with a calibrated bucket (§5):

```
Z = (Observed Hourly Volume − mean_14d) / stddev_14d
```

- **Tier 1** triggers when `Z ≥ crisis_escalation_rules.tier1_z_threshold` (default 2.0) **and** `negative_sentiment_pct ≥ crisis_escalation_rules.negative_sentiment_floor_pct` (default 40%).
- **Tier 2** triggers when `Z ≥ tier2_z_threshold` (default 3.0) under the same sentiment-floor condition.
- **Tier 3** triggers when `Z ≥ tier3_z_threshold` (default 4.5) under the same sentiment-floor condition.
- Tiers are evaluated highest-first: an observation crossing the Tier 3 threshold creates exactly one `crisis_incident_logs` row with `tier = 3`, not three separate rows for tiers 1/2/3. This mirrors ADR-0091 §5's "one row per trigger, not one per matching post" discipline, applied to tiers instead of posts.
- An observation that meets the Z-score bar for a tier but **not** the sentiment floor does not open an incident at all — both conditions are required, per Story 17.3's Acceptance Criteria ("when accompanied by elevated negative sentiment"), not just the statistical anomaly alone. This is a deliberate false-positive guard: a legitimate, non-crisis viral moment (e.g. a positive PR win) can produce a large Z-score without qualifying as a reputation crisis.
- Evaluation is triggered from the same event path ADR-0091 §3 already uses (`SocialPostIngestedEvent` consumption, tenant-scoped), reusing the existing `AlertEvaluationWorker`'s event subscription rather than standing up a second, competing event consumer — this evaluation logic is additive to that worker's rule-type dispatch, not a parallel pipeline.

### 7. Stateful escalation engine
- On incident creation (`crisis_incident_logs.status = 'open'`), the engine immediately dispatches the Tier 1 action for that incident's tier (i.e. a Tier 3 incident's *own* tier action is dispatched, escalation across tiers is not sequential re-triggering of tiers 1→2→3 for the same incident — the tier is decided once, at creation, per §6) and sets `ack_timeout_at = now() + escalation_rule.ack_timeout_minutes` (default 15 minutes).
- A background sweep (same worker family as the calibration worker, or a dedicated lightweight poller — implementation detail) checks `crisis_incident_logs` where `status = 'open' AND ack_timeout_at < now()` (using `idx_crisis_incident_logs_open_ack_timeout`) and, for each, appends an `escalation_action_log` entry for the next escalation action per the tier's own `*_delivery` configuration — Tier 1's own timeout does not auto-promote to Tier 2; each incident's tier is fixed at creation (§6), and the ack-timeout mechanism governs re-notification/reminder cadence at that same tier, not tier promotion. (Re-evaluation of the underlying metric can independently open a *new*, higher-tier incident if the anomaly worsens — that is a new `crisis_incident_logs` row, not a mutation of the existing one, consistent with the append-only/snapshot design in §3.)
- `POST /v1/crisis/incidents/:id/acknowledge` sets `status = 'acknowledged'`, `acknowledged_by_user_id`, `acknowledged_at`, and halts the ack-timeout sweep for that incident (an `acknowledged` incident is excluded from the `WHERE status = 'open'` sweep query by construction).
- `POST /v1/crisis/incidents/:id/resolve` sets `status = 'resolved'`, `resolved_by_user_id`, `resolved_at`, and requires `root_cause_notes` to be a non-empty string — enforced by both the `crisis_incident_logs_resolved_requires_notes` CHECK constraint (§3) and an application-layer 422 (per ADR-0044 §2's `validation_failed` mapping) so the client gets an actionable error rather than a raw constraint-violation 500.

### 8. Incident lifecycle API — request/response contracts

```ts
// POST /v1/crisis/incidents/:id/acknowledge
// Request body
interface AcknowledgeIncidentRequest {
  // No body fields required beyond the authenticated caller identity (user_id, tenant_id)
  // resolved server-side per ADR-0033 Bearer-token identity resolution — nothing client-supplied
  // is trusted for "who acknowledged this."
}

// Response (HTTP 200)
interface AcknowledgeIncidentResponse {
  incidentId: string;
  status: 'acknowledged';
  acknowledgedByUserId: string;
  acknowledgedAt: string;   // ISO 8601
}

// POST /v1/crisis/incidents/:id/resolve
// Request body
interface ResolveIncidentRequest {
  rootCauseNotes: string;   // required, non-empty; validated before any write (422 per ADR-0044 §2 if missing/blank)
}

// Response (HTTP 200)
interface ResolveIncidentResponse {
  incidentId: string;
  status: 'resolved';
  resolvedByUserId: string;
  resolvedAt: string;       // ISO 8601
  rootCauseNotes: string;
}
```

Error mapping for both endpoints follows ADR-0044 §2 verbatim (not re-decided here): unknown/cross-tenant `:id` → 404 `not_found`; caller authenticated but lacking the required role → 403 `forbidden`; missing/blank `rootCauseNotes` on resolve → 422 `validation_failed`; already-`resolved` incident receiving another acknowledge/resolve call → 409 `{ code: "invalid_state_transition", current_status: "resolved" }` (a new, incident-specific 409 case, following §2's existing 409 pattern for state conflicts rather than inventing a new HTTP code).

### 9. Role gating
Acknowledge and resolve both require the caller to hold `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` (the same role pair ADR-0079 §"Acceptance note" and BRD-0079 §5 already scope crisis-template activation to) — an application-layer role check per ADR-0030 §1's precedent, not an RLS mechanism, since any tenant user can legitimately *view* an incident (visibility is RLS-enforced tenant isolation per §1–§3's policies) but only the two named roles may change its lifecycle state.

---

## Consequences

### Positive
1. **Dynamic, per-watchlist thresholds replace static percentage spikes** — a low-volume and a high-volume watchlist are each held to their own statistical normal, directly closing the false-positive/missed-signal gap named in BRD-0079 §6 and Story 17.3's own rationale.
2. **Tier 1 ships as real, working notification** — reusing ADR-0091's Accepted, Built webhook mechanism means brand-reputation teams get an actual, live Slack/Teams alert for the most common (lowest-severity) tier immediately, not "eventually once a future ADR lands."
3. **Tier 2/3's state machine, timers, and audit trail are fully real and testable now**, even though live third-party dispatch isn't — a `Tenant-Admin` can configure escalation rules, and QA can write a contract test asserting the exact sequence of `recorded_intent` log entries, well before any vendor integration exists.
4. **No competing, throwaway SMS/PagerDuty schema is built** that a future telephony ADR would have to reconcile with or discard — the same benefit ADR-0079's Amendment named for deferring `alert_rules`.
5. **Full incident audit trail** (`crisis_incident_logs.escalation_action_log`, `root_cause_notes`) gives every incident — Tier 1 through Tier 3 — a durable, queryable record regardless of which tiers were live-dispatched vs. intent-only.

### Negative
1. **Tier 2 and Tier 3 do not page or call anyone in v1.** A `Tenant-Brand-Reputation-Manager` who configures a Tier 2 escalation and later has a Tier 2 incident fire will **not** receive an SMS or PagerDuty page — only an audit-log entry recording that one would have been sent. This must be disclosed plainly in whatever UI surfaces escalation-rule configuration (a follow-on frontend story, not yet numbered, per the pattern ADR-0079's Amendment set for Story 9.4's disclosure requirement) — not left implicit.
2. **New watchlists have no crisis alerting for their first 14 days** (§5's calibration-floor gap) — a genuinely new risk this feature introduces that ADR-0079's static-threshold model didn't have, since static thresholds don't need history to evaluate. Worth flagging as a real trade-off, not just a footnote: a brand-new tenant activating a crisis template gets *less* protection in week one than the old static-threshold model would have given them, in exchange for *better* protection once calibrated.
3. **Two additional worker processes** (calibration, ack-timeout sweep) add operational surface — this is a solo-developer project (CLAUDE.md), so any new always-on background process is a real maintenance and monitoring cost, not a free architectural add.
4. **Vendor selection for Tier 2/3 remains an open, unresolved dependency** — this ADR deliberately does not pick Twilio vs. PagerDuty vs. any alternative; a future ADR must still do that work before Tier 2/3 becomes real.

---

## Alternatives considered

1. **Build a minimal, first-party SMS client now (e.g. a single Twilio integration) scoped narrowly to Tier 2/3.**
   - *Rejected:* repeats exactly the mistake ADR-0079's Correction found — picking a vendor and building against its API without an Accepted ADR backing that choice. Vendor selection (cost, deliverability, contract terms) deserves its own deliberation, not a side effect of this feature.

2. **Defer all three tiers, including Tier 1, for symmetry with ADR-0079's original all-or-nothing deferral.**
   - *Rejected:* ADR-0079 deferred everything because nothing existed. ADR-0091's webhook mechanism now exists, is Accepted, and is Built — deferring Tier 1 anyway would withhold a real capability for no architectural reason, over-applying a precedent past why it existed.

3. **Model Tier 2/3 delivery with vendor-specific columns (`pagerduty_service_key`, `twilio_phone_number`) instead of a generic `vendor`/`recipients` JSONB shape.**
   - *Rejected:* would bake in a vendor choice this ADR explicitly does not make, and would likely require a breaking schema change once a real telephony ADR picks an actual vendor. The generic shape costs nothing now and avoids that future migration.

4. **Auto-promote an unacknowledged Tier 1 incident to Tier 2, then Tier 3, purely on ack-timeout elapsing (a "silence escalates severity" model).**
   - *Rejected for v1:* conflates two different signals — "the anomaly got statistically worse" (which should open a new, correctly-tiered incident per the real Z-score, §6) with "nobody has looked at this yet" (which should re-notify at the *same* tier, not fabricate a more severe one the underlying data doesn't support). Re-notification-at-same-tier is simpler to reason about and doesn't risk paging an executive (Tier 3) for an incident the data only ever supported as Tier 1. Named here so a future revision can revisit deliberately, not accidentally.

5. **Store baseline history over time (not just the current rolling window) to support trend analysis.**
   - *Rejected for v1:* nothing in Story 17.3's Acceptance Criteria asks for baseline trend visualization; the "current rolling mu/sigma only" design (§5) is the smallest thing that satisfies the stated requirement. Noted as a natural v1.5 extension, not built speculatively now (same ADR-0020-style discipline).

---

## Open Questions

- [x] **[Q-0131-1]** **What are the concrete Z-score thresholds for each tier?** **Resolved:** Tier 1 ≥ 2.0σ, Tier 2 ≥ 3.0σ, Tier 3 ≥ 4.5σ, per Story 17.3's own Acceptance Criteria — encoded as `crisis_escalation_rules` defaults, per-tenant-configurable.
- [x] **[Q-0131-2]** **What delivery mechanism backs each tier?** **Resolved in §4:** Tier 1 — real dispatch via ADR-0091's existing webhook mechanism. Tier 2/3 — fully modeled state machine and audit trail, recorded as intent only; live dispatch is a named follow-on gated on a future, not-yet-proposed SMS/PagerDuty/telephony ADR.
- [x] **[Q-0131-3]** **Does an unacknowledged incident auto-escalate to a higher tier on ack-timeout, or only re-notify at the same tier?** **Resolved in §7 and Alternative 4:** re-notify at the same tier; tier promotion happens only via a new incident opened from a genuinely worse Z-score, never from silence alone.
- [x] **[Q-0131-4]** **How does the evaluation engine handle a watchlist with fewer than 14 days of history (no valid stddev yet)?** **Resolved in §5:** buckets below a minimum sample-count floor are treated as not-yet-calibrated and suppressed from tier evaluation entirely, rather than dividing by zero or firing on an unreliable baseline. Named as a real Consequence (v1 gap for brand-new watchlists), not silently absorbed.
- [ ] **[Q-0131-5]** **What is the platform-level ceiling, if any, on the calibration worker's polling frequency and the ack-timeout sweep's polling frequency?** Left to the implementing story to size against real load, consistent with ADR-0020's precedent of not inventing limits ahead of usage data.
- [ ] **[Q-0131-6]** **Which vendor(s) should a future SMS/PagerDuty/telephony ADR evaluate, and who bears the cost?** Explicitly out of this ADR's scope — named here as the trigger for that future ADR, not answered.

---

## Footnotes

- Related feature stories: Story 17.3 (`docs/user-stories/epic-17-adr-0129-to-0133.md`)
- Related ADRs: `ADR-0079` (crisis template bundle and activation, the ADR this refines — its own 2026-08-28 "Pending supersession note" already anticipated this refinement), `ADR-0091` (real-time alert rules and delivery — Accepted, Built; source of Tier 1's real webhook dispatch and this ADR's `AlertEvaluationWorker` event-subscription reuse), `ADR-0092` (webhook signing convention, reused unchanged for Tier 1), `ADR-0044` (watchlist CRUD, RLS pattern, `updated_at`/exempt-list, and error-mapping conventions this ADR follows throughout), `ADR-0087` (precomputed daily views, reused by the calibration worker where available), `ADR-0123` (alert-rules refinements — precedent for using `watchlist_daily_counts`-style precomputed aggregates for bounded-latency historical queries), `ADR-0005` (`IngestionRun` immutability — the precedent for `crisis_incident_logs`' append-only/snapshot design), `ADR-0020` (deferred distributed rate-limit gate — the general precedent for not building speculative infrastructure ahead of real need, applied here to Q-0131-5/6), `ADR-0030` §1 (application-layer role check pattern, reused in §9), `ADR-0033` (Bearer-token identity resolution, reused in §8's acknowledge/resolve identity handling).
- Business-requirements companion: `docs/project docs/Business-Requirements/BRD-0131-Crisis-Template-Bundle-And-Activation-Refinements.md`
- Functional-design companion: `docs/project docs/Functional-Design/FDD-0131-Crisis-Template-Bundle-And-Activation-Refinements.md`

---

## Amendment Log

- 2026-09-09 — Initial real Decision content drafted (this ADR's body was a one-line stub from 2026-08-28 acceptance until this pass). Drafted by the Business & Requirements Analyst persona ahead of `implement-story` picking up Story 17.3, following the exact investigative pattern ADR-0079's 2026-08-25 Correction/Amendment established: grep-verified (2026-08-28/2026-09-09) that no SMS/PagerDuty/telephony integration or Accepted ADR exists anywhere in either repo before deciding how to resolve Story 17.3's Tier 2/3 delivery requirement. Resolution: Tier 1 reuses ADR-0091's real, Accepted, Built webhook mechanism; Tier 2/3 are fully modeled (schema, state machine, audit trail) but recorded as intent only, with a named follow-on gated on a future SMS/PagerDuty/telephony ADR. This ADR remains **Accepted** — this pass supplies the Decision content the acceptance was recorded against but never actually written down; it does not reopen or reverse the 2026-08-28 acceptance itself.
