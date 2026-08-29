---
name: webhook-management-ui
description: Webhook subscription management UI components including WebhookForm and WebhooksView with HMAC secret support, event filtering, delivery health badges, and sample event test pings per ADR-0106.
---

# Webhook Management UI Skill

## Overview
Implements Story 12.12 (ADR-0106):
- `WebhookForm`: Captures endpoint URL, selectable event types (`post.ingested`, `alert.triggered`, `connector.health.changed`, `mention.threshold.crossed`), and HMAC signing secret.
- `WebhooksView`: Lists tenant subscriptions, displays delivery status badges (`Success`, `Failed`, `Pending`), retry counts, and offers inline testing (`Test Ping`), enabling/disabling, and deletion.

## Components
- `src/components/webhooks/WebhookForm.tsx`
- `src/components/webhooks/WebhooksView.tsx`
