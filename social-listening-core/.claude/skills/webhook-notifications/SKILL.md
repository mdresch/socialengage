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

**Documentation Steward correction, 2026-09-10.** The `ADR-0092` citation in this file's own frontmatter description and H1 is wrong: real `ADR-0092` (`docs/adr/0092-author-initiated-takedown.md`) is "Author-initiated takedown," unrelated to webhooks. This component's real contract (`contracts/epic-10/story-10.11.webhook-notifications.contract.test.ts`) and its build commit (`social-listening-core@fdb9bb8`, "Batch 5") both predate the point where ADR-0092/Story 10.11 were reassigned to takedown content in `docs/user-stories/epic-10-adr-0086-to-0094.md` — no ADR in the current 0086–0094 range actually documents this webhook-subscriptions-and-delivery feature; the closest adjacent decision is ADR-0091's own "webhook" delivery channel for alert rules, and a separately-built, later, broader "public API versioning and webhooks" feature exists under Story 12.11/12.12 (ADR-0106) — not confirmed to be the same underlying mechanism as this component. Not fixed by inventing a correct ADR number here (a content/traceability call for Menno); flagged plainly instead. Same finding applies to `youtube-data-connector/SKILL.md` (cites `ADR-0093`, actually "DSR self-service portal") and `ai-insights-digest/SKILL.md` (cites `ADR-0094`, actually "Compliance audit pack") — both corrected with a matching note.
