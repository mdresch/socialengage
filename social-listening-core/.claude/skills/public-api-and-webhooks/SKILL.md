---
name: public-api-and-webhooks
description: Rate-limited public API access, webhook subscription CRUD, and HMAC-signed webhook delivery worker with exponential backoff and dead-lettering conforming to ADR-0106.
---

# Public API and Webhooks Skill

## Overview
Implements ADR-0106:
- Versioned public API routes under `/v1/`.
- Per-tenant rate limiting with standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
- Webhook subscription lifecycle endpoints (`GET`, `POST`, `PATCH`, `DELETE`, `POST /test` on `/v1/webhooks/subscriptions`).
- Webhook event delivery with `HMAC-SHA256` payload signature (`X-SocialEngage-Signature`), exponential retry backoff, and dead-lettering after 10 failed delivery attempts.

## Key Types & Interfaces
```ts
export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export function computeWebhookSignature(secret: string, payloadBody: string): string;
export function deliverWebhookWithRetry(opts: WebhookDeliveryOptions): Promise<WebhookDeliveryResult>;
```
