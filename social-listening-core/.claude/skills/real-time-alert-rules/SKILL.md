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
