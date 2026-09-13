---
name: real-time-alert-rules
description: Real-time alert rules definition, cooldown enforcement, notifications, and alerts inbox (ADR-0091, Story 10.9).
---

# Real-Time Alert Rules & Alerts Inbox (ADR-0091)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.9.real-time-alert-rules.contract.test.ts` — Story 10.9 contract test.

## Purpose
Allows workspace administrators and analysts to define threshold-based alert rules (volume spikes, negative sentiment cascades, influential posts, connector errors, keyword bursts) with per-rule cooldown suppression and an actionable in-app triage inbox.

## Invariants
1. **Rule Types:** Constrained to `volume_spike`, `negative_sentiment_spike`, `influential_post`, `connector_error`, `keyword_burst`.
2. **Cooldown Suppression:** Enforces `cooldown_minutes` (default 60m) per rule before another alert record can be generated in `tenant_alerts`.
3. **Inbox Triage Lifecycle:** Alerts transition through `active` -> `acknowledged` -> `resolved` (or `snoozed`).
4. **Tenant Isolation:** All alert rules and notifications are strictly isolated by `tenant_id` with standard RLS.

## Endpoints
- `POST /v1/alerts/rules`: Create alert rule
- `GET /v1/alerts/rules`: List tenant alert rules
- `GET /v1/alerts/rules/:id`: Get single alert rule
- `PATCH /v1/alerts/rules/:id`: Update alert rule
- `DELETE /v1/alerts/rules/:id`: Delete alert rule
- `GET /v1/alerts/inbox`: List inbox alerts (filterable by status)
- `PATCH /v1/alerts/inbox/:alertId`: Update alert status (`acknowledged`, `resolved`, `snoozed`)

## Relations to other components

- **`alert_rules` table** — stores rule definitions (type, threshold, cooldown, watchlist scope); scoped by `tenant_id` with RLS.
- **`tenant_alerts` table** — generated alert records (`active`, `acknowledged`, `resolved`, `snoozed`) written by the alert evaluation engine when a rule's threshold is crossed and its cooldown window has elapsed.
- **`social_posts` table** — `volume_spike` and `keyword_burst` rule evaluations scan recent ingested posts filtered by `tenant_id` and optionally by watchlist.
- **`watchlist_posts` join table** — when a rule targets a specific watchlist, the evaluation query joins through `watchlist_posts` to scope the threshold check.
- **`webhook-notifications` skill** — when an alert fires, the alert engine can trigger webhook delivery to subscribed endpoints for external notification (Slack, PagerDuty, custom backends). **Documentation Steward note, 2026-09-13: not yet backed by a real-call-site contract.** `alertEvaluationWorker.ts`/`alertRulesStore.ts` contain no reference to `webhookDispatcher`/`deliverWebhookWithRetry` at all — the only real, non-contract call site for webhook delivery found in the codebase is `crisisEscalationEngine.ts` (Story 12.11/ADR-0091), not the alert-rules engine described in this file. Flagged for Menno to route to `qa-contract-author` if this wiring is intended but missing, rather than authored here.
- **`real-time-alert-ui` admin SKILL.md** — the frontend `AlertRulesView` and `AlertsInboxView` components (Story 10.10) consuming `GET/POST/PATCH/DELETE /v1/alerts/**`.
