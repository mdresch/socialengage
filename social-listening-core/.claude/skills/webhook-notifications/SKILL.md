---
name: webhook-notifications
description: Webhook subscriptions management, HMAC-SHA256 signature signing, and event delivery dispatcher. Built by commit `fdb9bb8` (2026-08-27) under contract `story-10.11.webhook-notifications`; the "ADR-0092, Story 10.11" citation this file previously carried was wrong — ADR-0092 is Author-initiated takedown (see `docs/adr/0092-author-initiated-takedown.md`), unrelated to webhooks.
---

# Webhook Notifications

**Documentation Steward correction, 2026-09-11:** this component previously cited ADR-0092/Story 10.11 as its governing decision — wrong on both counts (ADR-0092 governs author-initiated takedown; the real Story 10.11 in `docs/user-stories/epic-10-adr-0086-to-0094.md` is also author-initiated takedown, confirmed unrelated to this feature). The correct governing ADR for tenant webhooks is almost certainly **ADR-0106** ("API and integrations — versioning and webhooks," Accepted 2026-08-28) — `docs/adr/README.md` credits ADR-0106 with "Stories 12.11 (backend) and 12.12 (UI) built," and a second, later, correctly-cited webhook implementation does exist at `social-listening-core/contracts/epic-12/story-12.11.public-api-and-webhooks.contract.test.ts` / `social-listening-admin/contracts/epic-12/story-12.12.webhook-management-ui.contract.test.ts` (commits dated 2026-08-29, three days after this component). **This means this component and Story 12.11/12.12 are very likely a real, previously-uncaught duplicate build of the same tenant-webhooks feature, built twice under two different story numbers two days apart** — a substantive finding flagged for Menno to reconcile (retire one, or confirm they are genuinely non-overlapping), not decided or merged here.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.11.webhook-notifications.contract.test.ts` — the contract test's own filename, kept as-is (renaming a passing contract file is a code change outside this role's scope); its "Story 10.11" number does not correspond to the real Story 10.11 ("Author-initiated takedown") in `docs/user-stories/epic-10-adr-0086-to-0094.md`.

## Purpose
Enables tenants to receive real-time webhook HTTP POST notifications on external systems (e.g., Slack, PagerDuty, Zapier, custom backend) when alerts or critical events occur.

## Invariants
1. **HMAC Signature:** Payloads are signed with the subscription's secret key using HMAC-SHA256 (`X-Signature-SHA256: hex`).
2. **Delivery Audit:** Every delivery attempt is logged in `webhook_delivery_attempts` with status code, latency, and error message.
3. **Tenant Isolation:** Webhook subscriptions and delivery histories are strictly bounded per tenant via RLS.

## Endpoints
- `POST /v1/webhooks/subscriptions`: Create webhook subscription
- `GET /v1/webhooks/subscriptions`: List subscriptions
- `DELETE /v1/webhooks/subscriptions/:id`: Delete subscription
- `POST /v1/webhooks/subscriptions/:id/test`: Trigger test ping verification

## Relations to other components

- **`webhook_subscriptions` table** — stores subscription URL, event types, HMAC secret key, and `tenant_id` (RLS-scoped); each subscription is the target for delivery.
- **`webhook_delivery_attempts` table** — immutable audit log of every delivery attempt (status code, latency, error); referenced by `POST /v1/webhooks/subscriptions/:id/test` to show recent delivery history.
- **`real-time-alert-rules` skill** — the alert evaluation engine is the primary caller of the webhook dispatcher; when an alert fires, the dispatcher fans out HTTP POSTs to all active subscriptions for the tenant.
- **`webhookDispatcher.ts` (src/webhooks/)** — the outbound HTTP fanout engine; signs each payload with HMAC-SHA256 and records a `webhook_delivery_attempts` row regardless of response code.
- **`webhook-management-ui` admin SKILL.md** — the frontend `WebhookSubscriptionsView` component (Story 10.12) consuming CRUD endpoints and the test-ping route.
