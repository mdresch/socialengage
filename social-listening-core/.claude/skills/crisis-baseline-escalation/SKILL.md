---
name: crisis-baseline-escalation
description: Crisis threshold baseline calibration and multi-tier escalation matrix (Story 17.3, ADR-0131, BRD-0131, FDD-0131) — rolling 14-day per-watchlist Z-score baselines, dynamic tier assignment, and a stateful escalation engine (real Tier 1 webhook, recorded-intent-only Tier 2/3). Read this before touching src/crisis/crisisBaselineStore.ts, src/crisis/crisisEscalationEngine.ts, src/crisis/crisisIncidentStore.ts, src/http/versions/v1/crisisIncidentsRouter.ts, or migration 0081.
---

# Crisis Baseline Calibration and Escalation Matrix

## What this is

Replaces ADR-0079's static percentage thresholds with a rolling 14-day statistical baseline (`crisis_baseline_metrics`) computed per watchlist, per `(day_of_week, hour_of_day)` bucket. New hourly observations are evaluated against that baseline as a Z-score; a qualifying Z-score *and* an elevated negative-sentiment ratio open exactly one `crisis_incident_logs` row at the correct dynamic tier (1/2/3). A stateful escalation engine immediately dispatches that tier's action and re-notifies at the same tier (never promotes) while an incident stays unacknowledged past `ack_timeout_at`.

**Tier 1 is a real, working dispatch** — it reuses ADR-0091's Accepted, Built, signed-webhook delivery mechanism (`deliverWebhookWithRetry` in `src/webhooks/webhookDispatcher.ts`) unchanged. **Tier 2 (SMS/PagerDuty) and Tier 3 (executive phone-call broadcast) are fully modeled — schema, state machine, audit trail — but record `recorded_intent` only.** No SMS, PagerDuty, or telephony/voice-broadcast integration exists anywhere in this codebase and none is authorized by any Accepted ADR; building one here would repeat the exact mistake ADR-0079's 2026-08-25 Correction/Amendment found and fixed for Story 9.3. See ADR-0131 §4 for the full reasoning and the named follow-on (a future, not-yet-proposed SMS/PagerDuty/telephony ADR).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0131 | Rolling 14-day baseline calibration, Z-score dynamic tiers, stateful escalation engine, Tier 1 real dispatch / Tier 2-3 recorded intent, incident lifecycle API | 17.3 (backend) |
| ADR-0079 | Crisis template bundle & activation — the static-threshold predecessor this feature refines | 9.3 |
| ADR-0091 | Real-time alert rules and delivery — source of Tier 1's real webhook dispatch mechanism, reused unchanged | 10.9 |
| ADR-0092 | Webhook signing convention — reused unchanged for Tier 1 | 10.11/12.11 |
| ADR-0044 | Watchlist CRUD, RLS pattern, `updated_at` trigger convention, ADR-0044 §2 error-mapping shape (`{code: ...}`) — all reused throughout this component | — |
| ADR-0016 | Azure AI Language sentiment enrichment — source of `enrichment->>'sentiment'`, used for both baseline calibration and live evaluation | — |

## Contracts that constrain this component

- `contracts/epic-17/story-17.3.crisis-baseline-escalation.contract.test.ts` — verifies:
  - RLS tenant isolation across all three new tables.
  - Calibration worker upserts real `mean_14d`/`stddev_14d`/`sample_count` from `post_watchlist_matches`/`social_posts` history.
  - An uncalibrated bucket (`stddev_14d = 0` or `sample_count` below the floor) is excluded from Z-score evaluation — never divides by zero.
  - Z-score tier assignment (2.0σ/3.0σ/4.5σ) requires the negative-sentiment floor to also be met.
  - Tier 1 incident creation performs a **real HTTP round trip** to a local test webhook server — the actual production call path, not a mock of the dispatch function itself.
  - Tier 2/3 record `recorded_intent` only, with no outbound call.
  - The ack-timeout sweep re-notifies at the same tier and never promotes it.
  - `POST /v1/crisis/incidents/:id/acknowledge` — role-gated, idempotent re-acknowledge, 409 on an already-resolved incident.
  - `POST /v1/crisis/incidents/:id/resolve` — mandatory non-empty `rootCauseNotes`, cross-tenant 404.
  - Exactly one incident row per triggering observation, at its single highest-qualifying tier.

## Key Invariants

1. **Bucket granularity means the 14-day sample floor is small, not literally 14.** A `(watchlist_id, metric_type, day_of_week, hour_of_day)` bucket recurs only weekly, so a 14-calendar-day trailing window yields at most ~2-3 samples per bucket — `MIN_SAMPLE_COUNT` in `crisisEscalationEngine.ts` is deliberately `2`, not the ADR's "suggested" 14 (which the ADR itself calls an implementation detail, and which would make every bucket permanently uncalibrated if taken literally against this bucket shape).
2. **Tier is fixed at incident creation, never auto-promoted by elapsed time.** The ack-timeout sweep re-notifies at the *same* tier and pushes `ack_timeout_at` forward; only a fresh, independently-evaluated observation can open a new, higher-tier incident.
3. **Tier 1 real, Tier 2/3 recorded-intent — never blur the two.** `escalation_action_log.action` (`'dispatched'` vs `'recorded_intent'`) and `outcome` (`'delivered'`/`'failed'` vs `'not_attempted_intent_only'`) must never be conflated; no field name or response shape may imply a Tier 2/3 page or call occurred.
4. **`crisis_incident_logs` origin fields are immutable snapshots.** `observed_value`/`baseline_mean`/`baseline_stddev`/`z_score`/`tier` are never rewritten by a later baseline recalibration — no `updated_at`/generic trigger exists on this table by design.
5. **No escalation-rule CRUD endpoint in this story.** `createEscalationRule`/`getEscalationRuleForWatchlist` are store-level functions only; a configuration UI/API is a named, not-yet-numbered frontend follow-on (BRD-0131 §4.2), out of Story 17.3's own Acceptance Criteria.
6. **`users.role` was widened by exactly one value** (migration 0081) to add `tenant_brand_reputation_manager` alongside the pre-existing `tenant_admin`/`tenant_user` — the first time this project's role model has grown past two tenant-scoped roles. Acknowledge/resolve are application-layer-gated (not RLS) to `tenant_admin` or `tenant_brand_reputation_manager`.
