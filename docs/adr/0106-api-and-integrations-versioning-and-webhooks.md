# ADR-0106: API and integrations — versioning and webhooks

**Status:** Proposed (2026-08-23)

**Authorizes:** the public API versioning convention (`/v1/`), rate limiting, and tenant-configured webhooks that deliver `ServiceBus` events to the tenant's own endpoints.

**Source:** `docs/product-research/feature-designs/11-api-and-integrations.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The core API is already at `/v1/`
`docs/product-research/feature-designs/11-api-and-integrations.md` describes a public API and integrations. `ADR-0017` already established URL path versioning (`/v1/`). This ADR adds the public API surface, rate limiting, and webhooks.

### 2. Tenants want real-time event delivery
Alerts and post events should be pushable to tenant endpoints so users can build their own workflows (Slack, Teams, Zapier, etc.) without polling.

### 3. Rate limiting is required for a public API
A public API must be protected against abuse. Per-tenant and per-key rate limits are needed.

---

## Decision

### 1. Public API surface
- The existing `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, and `POST /v1/analytics/query` (ADR-0088) become the public API surface.
- All public endpoints require a bearer token from the tenant's Entra External ID setup.
- `GET /v1/openapi.json` is a generated OpenAPI spec, but not a full SDK in v1.

### 2. API keys (future)
- v1 uses the existing Entra bearer token.
- A future ADR may add long-lived API keys with restricted scopes.

### 3. Rate limiting
- Global: 1000 requests per minute per tenant.
- `GET /v1/posts` and `POST /v1/analytics/query` have lower limits: 100 per minute.
- Rate limits are enforced by a sliding-window counter in Redis or Postgres.
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 4. Webhooks
```
GET    /v1/webhooks/subscriptions
POST   /v1/webhooks/subscriptions
PATCH  /v1/webhooks/subscriptions/:id
DELETE /v1/webhooks/subscriptions/:id
```

**Subscription body**
```ts
{
  url: string;
  events: Array<'post.ingested' | 'alert.triggered' | 'connector.health.changed' | 'mention.threshold.crossed'>;
  secret: string;              // used for HMAC-SHA256 signature
  active: boolean;
}
```

### 5. Webhook delivery
- A `WebhookDeliveryWorker` consumes `ServiceBus` events and POSTs them to active subscriptions.
- Each payload includes:
  ```ts
  {
    eventType: string;
    tenantId: string;
    timestamp: string;
    payload: object;
  }
  ```
- The `X-SocialEngage-Signature` header is `HMAC-SHA256(secret, body)`.
- Failed deliveries are retried with exponential backoff (up to 10 attempts over 24 hours), then moved to a dead-letter queue.

### 6. Versioning and deprecation
- API versions are URL-based: `/v1/`, `/v2/`.
- A `Sunset` header is sent for endpoints scheduled for deprecation.
- Breaking changes require a new major version.

---

## Consequences

1. **Public integration surface:** tenants can build on the API and receive real-time events.
2. **Rate-limit protection:** the platform is protected from abuse.
3. **Webhook reliability:** retries and HMAC signing make webhooks trustworthy.
4. **Operational cost:** webhook delivery and rate-limit tracking add infrastructure.

---

## Alternatives considered

1. **Use query-based versioning (`?version=2`) instead of path versioning.**
   - *Rejected:* path versioning is simpler for caches and routing. The project already uses `/v1/`.

2. **Deliver webhooks via long polling instead of push.**
   - *Rejected:* long polling is more complex for the consumer. Push webhooks are the standard pattern.

3. **Use a third-party integration platform (Zapier/Power Automate) as the only integration path.**
   - *Rejected:* it adds cost and vendor lock-in. A native webhook + API is the foundation.

---

## Open questions

- Which `ServiceBus` events should be available to webhooks in v1? All or a curated list?
- Should webhook subscriptions be per-tenant or per-user?
- How are webhook delivery failures surfaced to the tenant?
- Should the OpenAPI spec be generated automatically or maintained by hand?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0017` (API versioning), `ADR-0012`/`ADR-0013` (events), `ADR-0091` (alert rules)
