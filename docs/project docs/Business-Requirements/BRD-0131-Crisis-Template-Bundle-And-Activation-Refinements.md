# BRD-0131 — Crisis Template Bundle and Activation Refinements

> **Status note:** ADR-0131 is *Accepted* (2026-08-28). This BRD was drafted 2026-09-09, alongside ADR-0131's own real Decision content — the ADR was accepted against a one-line stub and its actual Decision (dynamic baseline calibration, multi-tier escalation, and the Tier 2/3 delivery resolution) is written down for the first time in this pass, immediately ahead of Story 17.3 implementation. This BRD reflects that Decision.

## 1. Document Control

|| Field | Value |
|---|---|
|| Document Title | Crisis Template Bundle and Activation Refinements – Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-09-09 |
|| Author(s) | Business & Requirements Analyst persona |
|| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved (source ADR-0131 Accepted 2026-08-28; this BRD's content written 2026-09-09) |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|
|| 1.0 | 2026-09-09 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, drafted ahead of Story 17.3 implementation and consistent with ADR-0131's own Decision written the same pass. |

---

## 2. Executive Summary

ADR-0079's crisis-template activation feature (Accepted 2026-08-23) gives a `Tenant-Brand-Reputation-Manager` a one-click way to start monitoring for a common reputation-crisis scenario, but its thresholds are static percentages applied identically to every watchlist regardless of that watchlist's own normal volume — a low-traffic brand and a high-traffic brand are held to the same spike percentage, which reproduces the false-positive/missed-signal problem the manual process it replaced already suffered from (BRD-0079 §6). ADR-0079's v1 also never delivers a live alert at all: thresholds and notification-channel identifiers are stored as intent only, deferred pending real alert infrastructure.

That infrastructure gap has since partially closed. ADR-0091 (Accepted 2026-08-28, Story 10.9 Built) now ships a real `alert_rules` engine with three working delivery channels: in-app, email, and signed webhook.

This BRD defines the **crisis threshold baseline calibration and escalation matrix** capability: a rolling 14-day statistical baseline (mean and standard deviation) computed per watchlist, per hour-of-day/day-of-week bucket, driving a Z-score-based, three-tier incident model in place of ADR-0079's static thresholds; and a stateful escalation engine that tracks acknowledgment and deterministically escalates unresolved incidents. **Tier 1 escalation is delivered for real, reusing ADR-0091's already-Accepted, already-built webhook mechanism** (Slack/Teams incoming webhooks accept the same signed `POST` shape ADR-0091 already ships). **Tier 2 (SMS/PagerDuty) and Tier 3 (executive phone-call broadcast) are fully modeled — schema, state machine, and audit trail — but not live-dispatched**, because no SMS, PagerDuty, or telephony integration exists anywhere in the codebase and no Accepted ADR authorizes one; those tiers record an auditable "would have paged X via Y at time T" entry instead, with a named follow-on to a future, not-yet-proposed SMS/PagerDuty/telephony ADR.

The expected business value is materially fewer false-positive and missed-signal crisis alerts (thresholds now reflect each watchlist's own statistical normal rather than a one-size-fits-all percentage), a real, working first-tier notification channel where today none exists at all, and a fully auditable escalation trail for every incident regardless of which tiers are live versus intent-only — while explicitly not fabricating a paid third-party vendor integration ahead of the deliberate vendor-selection decision that deserves its own ADR.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|---|
|| 1 | Replace static percentage thresholds with per-watchlist statistical baselines | Every calibrated watchlist has a rolling 14-day mean/stddev per hour-of-day/day-of-week bucket driving Z-score evaluation, not a fixed percentage |
|| 2 | Reduce false-positive and missed-signal crisis alerts | Fewer low-volume watchlists trigger on the same absolute spike a high-volume watchlist would need; measured qualitatively via reduced support/tuning requests once shipped |
|| 3 | Deliver real, working Tier 1 notification immediately | Tier 1 incidents dispatch a real, signed webhook via the existing ADR-0091 mechanism — not stored intent |
|| 4 | Provide a fully auditable, testable escalation trail for all three tiers, even where live third-party dispatch does not yet exist | Every incident's `escalation_action_log` records a `dispatched` (Tier 1) or `recorded_intent` (Tier 2/3) entry with timestamp, target, and outcome |
|| 5 | Avoid fabricating a speculative SMS/PagerDuty/telephony integration ahead of a real, deliberate vendor decision | No paid third-party delivery client is introduced in this feature; a named follow-on ADR is the explicit trigger for Tier 2/3 going live |

---

## 4. Scope

### 4.1 In Scope

- `crisis_baseline_metrics` — a platform-computed, tenant-scoped table storing rolling 14-day mean/standard deviation of mention velocity and negative-sentiment ratio, per watchlist, bucketed by hour-of-day and day-of-week.
- A `CrisisBaselineCalibrationWorker` that continuously recalculates those buckets from ingested post/sentiment history.
- `crisis_escalation_rules` — a per-tenant (or per-watchlist) table storing the three Z-score tier thresholds, the negative-sentiment floor, the acknowledgment timeout, and each tier's delivery configuration.
- Z-score evaluation (`Z = (Observed Hourly Volume − mean_14d) / stddev_14d`) against calibrated baselines, gated by a minimum negative-sentiment floor, producing dynamically tiered incidents (Tier 1 ≥ 2.0σ, Tier 2 ≥ 3.0σ, Tier 3 ≥ 4.5σ).
- `crisis_incident_logs` — the incident lifecycle and audit-trail table: open/acknowledged/resolved state, ack-timeout tracking, and an append-only `escalation_action_log`.
- A stateful escalation engine that dispatches Tier 1 for real via ADR-0091's existing webhook mechanism, and records Tier 2/Tier 3 actions as auditable intent only.
- `POST /v1/crisis/incidents/:id/acknowledge` and `POST /v1/crisis/incidents/:id/resolve` lifecycle endpoints.
- **Not building:** any SMS, PagerDuty, or telephony/voice-broadcast client or vendor integration — see §4.2 and ADR-0131 §4 for the full reasoning.

### 4.2 Out of Scope

- Any live SMS, PagerDuty, or executive phone-call-broadcast dispatch. No vendor is chosen, no account is provisioned, no API contract is accepted. This is explicitly deferred to a future, not-yet-proposed SMS/PagerDuty/telephony ADR.
- A frontend UI for configuring `crisis_escalation_rules` or viewing `crisis_incident_logs` — this BRD covers the backend (Story 17.3) only; a frontend follow-on is not yet numbered.
- Auto-promotion of an incident's tier purely from an elapsed ack-timeout ("silence escalates severity") — ack-timeout drives re-notification at the *same* tier, not tier promotion; a worsening metric opens a new, independently-tiered incident instead (ADR-0131 §7, Alternative 4).
- Baseline trend history/visualization beyond the current rolling 14-day window — `crisis_baseline_metrics` holds only the current calibrated bucket, not a time series of past calibrations.
- Retroactively changing ADR-0079's or ADR-0091's own shipped Decision/Consequences text — this feature is additive, reusing ADR-0091's webhook mechanism as-is.

### 4.3 Assumptions

- ADR-0091's `alert_rules`/webhook delivery mechanism (Accepted, Story 10.9 Built) is stable and reusable as-is for Tier 1 dispatch — verified directly, not assumed, by reading ADR-0091 §4/§6 and confirming Story 10.9's Built status.
- No SMS, PagerDuty, Twilio, or telephony/voice-broadcast integration exists anywhere in either repo (`social-listening-core`, `social-listening-admin`) as of 2026-09-09 — verified by grep across `src/`, `migrations/`, and `contracts/` in both repos.
- Watchlists (ADR-0044) and post-ingestion/sentiment-enrichment data (ADR-0016) already exist and are the source data the calibration worker reads from.
- A watchlist with fewer than 14 days of ingestion history will not have a usable baseline; this is a named, accepted v1 gap, not silently ignored (see §4.4 and Risks §12).

### 4.4 Constraints

- Tenant data must remain isolated: one tenant cannot see another tenant's baselines, escalation rules, or incidents — enforced by RLS on all three new tables.
- A calibration bucket with fewer than a minimum sample count (or a zero standard deviation) must not be used to evaluate a Z-score — it must be treated as not-yet-calibrated and suppressed, not divided-by-zero.
- Root-cause notes are mandatory before an incident can be marked resolved; the system must not allow a silent, undocumented resolution.
- Tier assignment happens once, at incident creation, from the real observed Z-score — it is never inferred purely from how long an incident has gone unacknowledged.
- No new paid, credentialed third-party vendor integration is introduced by this feature.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|---|
|| `Tenant-Brand-Reputation-Manager` (primary) | Configures escalation rules; owns Tier 1/2 response | High | Real Tier 1 webhook notification now; an honest signal about what Tier 2/3 do and don't do yet |
|| `Tenant-Admin` (primary) | Configures escalation rules; oversees crisis response | High | Confidence that thresholds reflect real per-watchlist behavior, not one-size-fits-all percentages |
|| `Tenant-Social-Care-Agent` (secondary) | Receives Tier 1 Slack/Teams triage notifications | Medium | A real, working webhook alert to their triage channel, not a stored-but-undelivered intent |
|| On-call crisis responder (secondary, role TBD by future frontend story) | Acknowledges and resolves incidents | Medium | A clear API to acknowledge (stop the clock) and resolve (with root-cause notes) an incident |
|| Executive stakeholders (Tier 3 recipients, future) | Would be paged for the most severe incidents once a telephony ADR lands | Low today | Not silently promised delivery that isn't real; the system must not claim Tier 3 phone calls happen in v1 |

---

## 6. Current State (As-Is)

**Current process (ADR-0079 v1):** A tenant activates a crisis template with a fixed static threshold (e.g. "50% volume spike"). No baseline is calculated. No alert is ever actually delivered — v1 stores threshold and notification-channel data as intent only, per ADR-0079's own 2026-08-25 Amendment. A brand-reputation team gets a monitoring `watchlist` but no automated notification at all, and any threshold that is technically live elsewhere (via ADR-0091, once a tenant separately creates a real `alert_rule`) is a fixed percentage that is equally wrong for a low-volume and a high-volume watchlist.

**Pain points:**
- Static thresholds produce false positives on naturally bursty low-volume watchlists and miss genuine anomalies on high-volume ones.
- No escalation model exists at all — an alert (where one exists via ADR-0091) is a single notification with no tiering, no acknowledgment tracking, and no deterministic "what happens if nobody responds."
- No incident audit trail exists — there is no `crisis_incident_logs`-equivalent record of what happened, when, and how it was resolved.

---

## 7. Future State (To-Be)

**New or improved process:** Each watchlist covered by a `crisis_escalation_rules` row is continuously calibrated by the `CrisisBaselineCalibrationWorker` against its own rolling 14-day history, bucketed by hour-of-day and day-of-week. When a new observation's Z-score crosses a configured tier threshold *and* negative sentiment is elevated, the system opens a `crisis_incident_logs` row at the correct tier. Tier 1 incidents immediately dispatch a real, signed webhook to the configured Slack/Teams channel via ADR-0091's existing delivery mechanism. Tier 2/3 incidents record a full audit entry describing what *would* have been dispatched (SMS/PagerDuty/executive phone call) and to whom, without a live third-party call. An on-call responder acknowledges the incident (halting the ack-timeout clock) and eventually resolves it with mandatory root-cause notes, producing a permanent, queryable incident history.

**Expected capabilities:**
- Per-watchlist, per-hour-bucket statistical baselines that adapt to each watchlist's own normal behavior.
- Dynamic, Z-score-driven tier assignment (2.0σ / 3.0σ / 4.5σ) gated by a negative-sentiment floor.
- Real Tier 1 webhook delivery, reusing already-shipped infrastructure.
- Fully modeled, fully testable Tier 2/3 escalation logic and audit trail, honestly labeled as not-yet-live.
- Deterministic acknowledgment-timeout tracking and a mandatory-root-cause-notes resolution flow.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | The system shall maintain a rolling 14-day statistical baseline (mean, standard deviation) per watchlist, metric type, hour-of-day, and day-of-week | Must | `crisis_baseline_metrics` has one row per `(watchlist_id, metric_type, day_of_week, hour_of_day)` with `mean_14d`, `stddev_14d`, `sample_count`, `last_calibrated_at` | Product Owner |
|| BR-002 | The system shall continuously recalculate baselines via a scheduled worker | Must | `CrisisBaselineCalibrationWorker` upserts `crisis_baseline_metrics` on a fixed interval, reading from post-ingestion and sentiment-enrichment history | Product Owner |
|| BR-003 | The system shall evaluate observed hourly volume against the calibrated baseline using a Z-score | Must | `Z = (Observed Hourly Volume − mean_14d) / stddev_14d`, computed only for calibrated buckets (`stddev_14d > 0` and `sample_count` above a minimum floor) | Product Owner |
|| BR-004 | The system shall assign incidents to one of three dynamic tiers based on Z-score and a negative-sentiment floor | Must | Tier 1 (Z ≥ 2.0σ), Tier 2 (Z ≥ 3.0σ), Tier 3 (Z ≥ 4.5σ), each additionally requiring `negative_sentiment_pct ≥` a configurable floor (default 40%); exactly one incident row per triggering observation, at its highest qualifying tier | Product Owner |
|| BR-005 | The system shall let a tenant configure per-watchlist (or tenant-default) escalation rules | Must | `crisis_escalation_rules` stores tier thresholds, sentiment floor, `ack_timeout_minutes` (default 15), and per-tier delivery configuration | Product Owner |
|| BR-006 | The system shall dispatch a real, working notification for Tier 1 incidents | Must | Tier 1 dispatch reuses ADR-0091's existing signed-webhook delivery mechanism; the resulting HTTP outcome is recorded in `escalation_action_log` | Product Owner |
|| BR-007 | The system shall fully model, but not live-dispatch, Tier 2 and Tier 3 escalation actions | Must | `crisis_escalation_rules.tier2_delivery`/`tier3_delivery` and `crisis_incident_logs.escalation_action_log` record `recorded_intent` entries (vendor, target, timestamp) for Tier 2/3, with no outbound SMS/PagerDuty/telephony call made | Product Owner |
|| BR-008 | The system shall track unacknowledged incidents against a configurable timeout | Must | Each incident stores `ack_timeout_at`; a sweep identifies incidents where `status = 'open' AND ack_timeout_at < now()` for re-notification at the same tier | Product Owner |
|| BR-009 | The system shall provide an endpoint to acknowledge an incident, recording responder identity and halting escalation timers | Must | `POST /v1/crisis/incidents/:id/acknowledge` sets `status = 'acknowledged'`, `acknowledged_by_user_id`, `acknowledged_at`; the incident is excluded from further ack-timeout sweeps | Product Owner |
|| BR-010 | The system shall provide an endpoint to resolve an incident with mandatory root-cause notes | Must | `POST /v1/crisis/incidents/:id/resolve` requires non-empty `rootCauseNotes`; rejects with 422 if missing; sets `status = 'resolved'`, `resolved_by_user_id`, `resolved_at` | Product Owner |
|| BR-011 | The system shall isolate all three new tables by tenant via RLS | Must | `crisis_baseline_metrics`, `crisis_escalation_rules`, `crisis_incident_logs` each carry a `tenant_id` RLS policy matching the existing project pattern (ADR-0044 §5b) | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | Ack-timeout sweep queries must remain fast as incident volume grows | Performance | Must | `idx_crisis_incident_logs_open_ack_timeout` (partial index on `status = 'open'`) keeps sweep queries indexed rather than full-table-scanned |
|| NFR-002 | Baseline/escalation/incident data must not be visible or editable by other tenants | Security | Must | Contract tests prove cross-tenant 404 behavior for all three tables |
|| NFR-003 | The system must not silently claim Tier 2/3 delivery is live when it is not | Transparency / Trust | Must | `escalation_action_log.action` explicitly distinguishes `dispatched` from `recorded_intent`; no UI or API response implies a Tier 2/3 page or call occurred |
|| NFR-004 | Incident origin data must be immutable once recorded | Reliability / Auditability | Must | `crisis_incident_logs` has no `updated_at`/generic-update trigger; `z_score`/`baseline_mean`/`baseline_stddev` are snapshots, never rewritten by a later recalibration |
|| NFR-005 | Calibration must not fire on divide-by-zero for uncalibrated watchlists | Reliability | Must | A bucket with `stddev_14d = 0` or `sample_count` below the minimum floor is excluded from Z-score evaluation entirely |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility, Transparency/Trust.

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | A Z-score is only computed for a `(watchlist_id, metric_type, day_of_week, hour_of_day)` bucket that has been calibrated (`stddev_14d > 0`, `sample_count` at or above the minimum floor). |
|| BRU-002 | An incident requires both a qualifying Z-score **and** a qualifying negative-sentiment ratio; a Z-score spike alone (e.g. positive viral attention) does not open an incident. |
|| BRU-003 | Exactly one `crisis_incident_logs` row is created per triggering observation, at its single highest-qualifying tier — not one row per tier crossed. |
|| BRU-004 | Tier is fixed at incident creation and never auto-promoted by elapsed time; only a new, independently-evaluated observation can open a new, higher-tier incident. |
|| BRU-005 | Tier 1 delivery is always dispatched for real via ADR-0091's existing webhook mechanism. |
|| BRU-006 | Tier 2 and Tier 3 delivery are always recorded as intent only (`recorded_intent`) in v1; no live SMS, PagerDuty, or telephony call is made. |
|| BRU-007 | An incident cannot be marked `resolved` without non-empty `rootCauseNotes`. |
|| BRU-008 | Acknowledging an incident halts its ack-timeout sweep; it does not resolve it. |
|| BRU-009 | Acknowledge and resolve both require the caller to hold `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`. |
|| BRU-010 | All three new tables are tenant-isolated by RLS; no cross-tenant visibility exists at any point. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
|| `crisis_baseline_metrics` | Rolling 14-day mean/stddev of mention velocity and negative-sentiment ratio, per watchlist, per hour/day-of-week bucket | `CrisisBaselineCalibrationWorker` | Platform (computed from tenant data) | Tenant-scoped statistical data, not PII |
|| `crisis_escalation_rules` | Per-tenant/per-watchlist tier thresholds, sentiment floor, ack timeout, and per-tier delivery configuration | Tenant configuration (`Tenant-Admin`/`Tenant-Brand-Reputation-Manager`) | Tenant | Tenant business configuration; may include contact identifiers for future Tier 2/3 vendor (stored as intent, not resolved) |
|| `crisis_incident_logs` | Full incident lifecycle: trigger snapshot, tier, acknowledgment, resolution, and escalation-action audit trail | Evaluation engine + acknowledge/resolve endpoints | Tenant | Tenant operational data; `root_cause_notes` may contain sensitive business context |
|| `escalation_action_log` | Append-only JSON array on `crisis_incident_logs` recording each dispatched or recorded-intent escalation action | Escalation engine | Tenant | Tenant operational/audit data |
|| `ack_timeout_at` | Deadline after which an unacknowledged open incident is re-notified at the same tier | Escalation engine, computed at incident creation | Tenant | Internal scheduling data |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| Incidents opened per tier per tenant | Track crisis frequency and tier distribution | Product / Engineering | Weekly |
|| Mean time to acknowledge / resolve | Measure responsiveness of crisis response teams | Product / Operations | Weekly |
|| Calibration coverage (% of active watchlists with a calibrated bucket) | Track the "new watchlist, no baseline yet" gap named in Risks | Engineering | Weekly |
|| Tier 1 webhook delivery success/failure rate | Monitor real dispatch reliability | Engineering / Operations | Daily |
|| Tier 2/3 `recorded_intent` volume | Build the business case for prioritizing a future SMS/PagerDuty/telephony ADR | Product Owner | Monthly |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
|| R-001 | A brand-reputation team configures Tier 2/3 expecting a real SMS/PagerDuty page, not knowing it is intent-only | High (without disclosure) | High | Any UI surfacing escalation-rule configuration must plainly disclose Tier 2/3 is audit-only in v1 (a named, not-yet-numbered frontend follow-on); the API/data model itself distinguishes `dispatched` from `recorded_intent` so this cannot be silently misrepresented | Product Owner |
|| R-002 | New watchlists have no crisis alerting for their first 14 days (uncalibrated baseline) | Medium | Medium | Named explicitly in ADR-0131 Consequences; consider (future) falling back to ADR-0079's static-threshold model until a watchlist is calibrated, not decided in this pass | Product Owner |
|| R-003 | Two new always-on worker processes (calibration, ack-timeout sweep) add operational load for a solo-developer project | Medium | Low | Reuse existing scheduling patterns and precomputed views (ADR-0087/ADR-0123) where possible rather than building new infrastructure from scratch | Engineering Lead |
|| R-004 | A future SMS/PagerDuty/telephony ADR never gets proposed, leaving Tier 2/3 permanently intent-only | Medium | Medium | Tier 2/3 `recorded_intent` volume (§11) is tracked specifically to build the business case for prioritizing that follow-on ADR | Product Owner |
|| R-005 | Divide-by-zero or spurious Z-scores from an uncalibrated bucket | Low (mitigated by design) | High | `stddev_14d = 0` or below-floor `sample_count` explicitly suppresses evaluation for that bucket (BRU-001) | Engineering Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
|| D-001 | ADR-0079 — crisis template bundle and activation (Accepted, amended 2026-08-25) | Internal / Architectural | Engineering Lead | In place; this feature refines its static-threshold model |
|| D-002 | ADR-0091 — real-time alert rules and delivery (Accepted 2026-08-28, Story 10.9 Built) | Internal / Architectural | Engineering Lead | In place; Tier 1 reuses its webhook mechanism directly |
|| D-003 | ADR-0092 — webhook signing convention | Internal / Architectural | Engineering Lead | In place; reused unchanged for Tier 1 |
|| D-004 | ADR-0016 — Azure AI Language sentiment enrichment | Internal / Architectural | Engineering Lead | In place; source for negative-sentiment-ratio baseline data |
|| D-005 | ADR-0087 / ADR-0123 — precomputed daily views | Internal / Architectural | Engineering Lead | In place where available; calibration worker falls back to raw event/post history otherwise |
|| D-006 | Story 17.3 — Crisis threshold baseline calibration and escalation matrix (backend) | Internal / Implementation | Engineering Lead | Ready; this BRD's own subject |
|| D-007 | A future, not-yet-proposed SMS/PagerDuty/telephony ADR | Internal / Architectural | Engineering Lead / Menno | Not started; explicit trigger for Tier 2/3 going live |
|| D-008 | A frontend follow-on story (not yet numbered) for escalation-rule configuration and incident review UI | Internal / Implementation | Engineering Lead | Not started; must carry the Tier 2/3 disclosure requirement named in R-001 |

---

## 14. Acceptance Criteria

- `crisis_baseline_metrics`, `crisis_escalation_rules`, and `crisis_incident_logs` are created with RLS tenant isolation and the indexes defined in ADR-0131 §1–§3.
- The calibration worker upserts baseline buckets from real ingestion/sentiment history; an uncalibrated bucket does not produce a usable Z-score.
- Incidents are opened at the correct dynamic tier (2.0σ / 3.0σ / 4.5σ) only when the negative-sentiment floor is also met.
- Tier 1 incidents dispatch a real, signed webhook via ADR-0091's existing mechanism; the outcome is recorded in `escalation_action_log`.
- Tier 2 and Tier 3 incidents record a `recorded_intent` audit entry and make no live SMS/PagerDuty/telephony call.
- `POST /v1/crisis/incidents/:id/acknowledge` and `POST /v1/crisis/incidents/:id/resolve` behave per ADR-0131 §8's contracts, including the mandatory-root-cause-notes rule and the standard ADR-0044 §2 error mapping.
- Cross-tenant access to any of the three new tables is blocked.
- Executable contract test citation: `social-listening-core/contracts/epic-17/story-17.3.crisis-baseline-escalation.contract.test.ts`.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| Baseline | The rolling 14-day mean and standard deviation of a metric (mention velocity or negative-sentiment ratio) for a specific watchlist, hour-of-day, and day-of-week bucket. |
|| Z-score | `(Observed Hourly Volume − mean_14d) / stddev_14d` — how many standard deviations an observation is from that bucket's own statistical normal. |
|| Tier | One of three severity levels (1, 2, 3) an incident is assigned at creation, based on which Z-score threshold it crosses and whether the sentiment floor is met. |
|| Escalation rule | A tenant's configuration of tier thresholds, sentiment floor, ack timeout, and per-tier delivery target. |
|| Incident | A `crisis_incident_logs` row: the record of one triggering observation, its tier, its lifecycle state, and its escalation audit trail. |
|| Recorded intent | An `escalation_action_log` entry describing an escalation action that *would* have been dispatched to a real vendor (SMS/PagerDuty/telephony) but was not, because no such integration exists yet. |
|| Ack timeout | The configured window (default 15 minutes) after which an unacknowledged open incident is re-notified at its own tier. |

---

## 16. Appendices

### Reference documents

- ADR-0131 — `docs/adr/0131-crisis-template-bundle-and-activation-refinements.md` (source, Accepted 2026-08-28; real Decision content written 2026-09-09)
- ADR-0079 — `docs/adr/0079-crisis-template-bundle-and-activation.md` (the ADR this feature refines)
- ADR-0091 — `docs/adr/0091-real-time-alert-rules-and-delivery.md` (source of Tier 1's real webhook mechanism)
- User stories — `docs/user-stories/epic-17-adr-0129-to-0133.md`, Story 17.3
- Related ADRs — ADR-0044 (watchlist CRUD/RLS conventions), ADR-0092 (webhook signing), ADR-0016 (sentiment enrichment), ADR-0087/ADR-0123 (precomputed views), ADR-0020 (deferred speculative infrastructure precedent), ADR-0005 (immutability precedent for `crisis_incident_logs`)

### Missing source

- No dedicated deep-research report exists for this feature at this time.

---

## 17. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
