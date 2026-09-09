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
