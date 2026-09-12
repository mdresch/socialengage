---
name: real-time-alert-rules
description: Real-time alert rules definition, cooldown enforcement, notifications, and alerts inbox (ADR-0091, Story 10.9).
---

# Real-Time Alert Rules & Alerts Inbox (ADR-0091, ADR-0123)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.9.real-time-alert-rules.contract.test.ts` — Story 10.9 contract test.
- `social-listening-core/contracts/epic-15/story-15.1.alert-rules-refinements.contract.test.ts` — Story 15.1 contract test (ADR-0123: exclusions, rolling daily cap, pre-save preview).

## Purpose
Allows workspace administrators and analysts to define threshold-based alert rules (volume spikes, negative sentiment cascades, influential posts, connector errors, keyword bursts) with per-rule cooldown suppression, noise exclusions, a rolling daily cap, a pre-save volume preview, and an actionable in-app triage inbox.

## Invariants
1. **Rule Types:** Constrained to `volume_spike`, `negative_sentiment_spike`, `influential_post`, `connector_error`, `keyword_burst`.
2. **Cooldown Suppression:** Enforces `cooldown_minutes` (default 60m) per rule before another alert record can be generated in `tenant_alerts`.
3. **Noise Exclusions (ADR-0123 §1):** `excluded_watchlist_ids` and `excluded_topic_ids` are independent, short-circuiting disjunctive filters evaluated before threshold checks. A post matching either is suppressed without writing to `tenant_alerts`.
4. **Rolling Daily Cap (ADR-0123 §2):** `max_alerts_per_day` (default 20, bounded 1–500) limits a rule to that many `tenant_alerts` rows in a rolling 24-hour window; it operates alongside `cooldown_minutes`, not instead of it.
5. **Inbox Triage Lifecycle:** Alerts transition through `active` -> `acknowledged` -> `resolved` (or `snoozed`).
6. **Tenant Isolation:** All alert rules and notifications are strictly isolated by `tenant_id` with standard RLS.
7. **Pre-Save Preview (ADR-0123 §4):** `POST /v1/alert-rules/preview` (and alias `POST /v1/alerts/rules/preview`) is strictly read-only against `watchlist_daily_counts` — it never writes `alert_rules` or `tenant_alerts` rows and enforces `lookbackDays` ∈ [1, 30].

## Endpoints
- `POST /v1/alerts/rules` (or `POST /v1/alert-rules`): Create alert rule
- `GET /v1/alerts/rules` (or `GET /v1/alert-rules`): List tenant alert rules
- `GET /v1/alerts/rules/:id` (or `GET /v1/alert-rules/:id`): Get single alert rule
- `PATCH /v1/alerts/rules/:id` (or `PATCH /v1/alert-rules/:id`): Update alert rule
- `DELETE /v1/alerts/rules/:id` (or `DELETE /v1/alert-rules/:id`): Delete alert rule
- `POST /v1/alert-rules/preview` (alias `POST /v1/alerts/rules/preview`): Pre-save volume preview simulation
- `GET /v1/alerts/inbox`: List inbox alerts (filterable by status)
- `PATCH /v1/alerts/inbox/:alertId`: Update alert status (`acknowledged`, `resolved`, `snoozed`)
