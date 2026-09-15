---
name: webhook-notifications
description: Webhook subscriptions management, HMAC-SHA256 signature signing, and event delivery dispatcher (ADR-0092, Story 10.11).
---

# Webhook Notifications (ADR-0092)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.11.webhook-notifications.contract.test.ts` — Story 10.11 contract test.

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
