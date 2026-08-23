# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0106: API and Integrations — Versioning and Webhooks |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft — for review; may change because the source ADR is **Proposed**) |
| Related Documents | ADR-0106, BRD-0106, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

**What problem are we solving?** SocialEngage already exposes an internal `/v1` API and publishes Service Bus events, but it lacks a formal public API surface, rate-limit protection, and a native way for tenants to receive real-time events. Tenants who want to build integrations today must either poll the API or wait for manual exports, which is slow, expensive, and limits the product’s embeddability in customer workflows.

This FDD translates the accepted architecture and business requirements from ADR-0106 and BRD-0106 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Public API surface for the existing v1 endpoints: `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, and `POST /v1/analytics/query`.
- Bearer-token authentication using the tenant’s Entra External ID setup.
- Generated `GET /v1/openapi.json` specification for the public surface.
- Per-tenant rate limiting (global 1,000 requests/minute; 100/minute for `GET /v1/posts` and `POST /v1/analytics/query`).
- Sliding-window rate-limit counter infrastructure backed by Redis or Postgres.
- Webhook subscription CRUD: `GET /v1/webhooks/subscriptions`, `POST /v1/webhooks/subscriptions`, `PATCH /v1/webhooks/subscriptions/:id`, `DELETE /v1/webhooks/subscriptions/:id`.
- Webhook delivery worker that consumes `ServiceBus` events and POSTs to active subscriptions.
- HMAC-SHA256 payload signing (`X-SocialEngage-Signature`).
- Exponential-backoff retry (up to 10 attempts over 24 hours) and dead-letter queue for exhausted deliveries.
- URL-based versioning (`/v1/`, `/v2/`) and `Sunset` headers for deprecated endpoints.
- **Out of scope:** - A generated full SDK in v1 (`GET /v1/openapi.json` is provided, but no SDK build pipeline).
- Long-lived, scoped API keys for v1 (Entra bearer tokens are used; API keys are a future ADR).
- Query-based API versioning (`?version=2`).
- Third-party integration platforms (e.g., Zapier, Power Automate) as the only integration path.
- All `ServiceBus` events in v1; only a curated set of public events is exposed initially.
- **Assumptions and constraints:** - ADR-0017 (URL path versioning) is already accepted and `/v1/` is the current convention.
- Entra External ID bearer-token authentication is already in place for the existing API.
- ADR-0033 (no `X-Tenant-Id` trust; identity resolved server-side) remains in effect.
- Redis or Postgres is available for the sliding-window rate-limit counter.
- `ServiceBus` already emits `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. The core API is already at `/v1/`
`docs/product-research/feature-designs/11-api-and-integrations.md` describes a public API and integrations. `ADR-0017` already established URL path versioning (`/v1/`). This ADR adds the public API surface, rate limiting, and webhooks.

### 2. Tenants want real-time event delivery
Alerts and post events should be pushable to tenant endpoints so users can build their own workflows (Slack, Teams, Zapier, etc.) without polling.

### 3. Rate limiting is required for a public API
A public API must be protected against abuse. Per-tenant and per-key rate limits are needed.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a stable, documented public API surface | `GET /v1/openapi.json` is generated and the public `/v1` endpoints return consistent, versioned contracts |
| 2 | Protect the platform and tenants from API abuse | Per-tenant rate limits are enforced with `X-RateLimit-*` headers; no tenant exceeds configured limits without explicit throttling |
| 3 | Enable real-time tenant integrations via webhooks | Tenants can create subscriptions and receive `ServiceBus` events (e.g., `post.ingested`, `alert.triggered`) at their own HTTPS endpoints |
| 4 | Preserve multi-tenant isolation and security | All public calls pass through the same `tenant-auth-middleware` and RLS path as internal calls; no `X-Tenant-Id` trust is introduced |
| 5 | Support long-term API evolution without breaking consumers | URL-based major versioning (`/v1/`, `/v2/`) and `Sunset` headers are used for deprecation |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, and `POST /v1/analytics/query` as public endpoints. | Must | All listed endpoints are reachable and return the same stable shapes as the internal API | Product Owner |
| BR-002 | The system shall require a valid Entra External ID bearer token for every public endpoint. | Must | Requests without a token receive `401 Unauthorized`; tokens resolve to a tenant/user identity | Product Owner |
| BR-003 | The system shall serve a generated `GET /v1/openapi.json` spec describing the public surface. | Must | The spec is valid OpenAPI and matches the public `/v1` contracts | Product Owner |
| BR-004 | The system shall enforce per-tenant rate limits and return `X-RateLimit-*` headers. | Must | Global limit is 1,000 req/min/tenant; `GET /v1/posts` and `POST /v1/analytics/query` are 100 req/min; throttled requests return `429 Too Many Requests` | Product Owner |
| BR-005 | The system shall provide `GET /v1/webhooks/subscriptions` to list tenant webhook subscriptions. | Must | Returns only the current tenant’s subscriptions; supports pagination if needed | Product Owner |
| BR-006 | The system shall provide `POST /v1/webhooks/subscriptions` to create a subscription. | Must | Body accepts `url`, `events`, `secret`, and `active`; validates `url` as HTTPS; stores under tenant RLS | Product Owner |
| BR-007 | The system shall provide `PATCH /v1/webhooks/subscriptions/:id` and `DELETE /v1/webhooks/subscriptions/:id`. | Must | Updates/deletes only the requesting tenant’s subscription; returns `404` for cross-tenant IDs | Product Owner |
| BR-008 | The system shall deliver `ServiceBus` events to active subscriptions as HTTPS POSTs. | Must | Payload includes `eventType`, `tenantId`, `timestamp`, and `payload` | Product Owner |
| BR-009 | The system shall sign every webhook payload with `HMAC-SHA256(secret, body)`. | Must | `X-SocialEngage-Signature` header is present and verifiable by the consumer | Product Owner |
| BR-010 | The system shall retry failed deliveries with exponential backoff, up to 10 attempts over 24 hours. | Must | Retry schedule and attempt count are observable in the delivery log; retries stop at 10 or 24 hours | Product Owner |
| BR-011 | The system shall move exhausted webhook deliveries to a dead-letter queue. | Must | After 10 failed attempts, the delivery is removed from the active queue and surfaced for replay | Product Owner |
| BR-012 | The system shall support URL-based API versioning (`/v1/`, `/v2/`) and `Sunset` headers. | Should | New major versions are introduced for breaking changes; deprecated endpoints return a `Sunset` header | Product Owner |
| BR-013 | The admin UI shall provide an Integrations page to manage webhook subscriptions. | Should | `WebhooksView` lists subscriptions; `WebhookForm` captures URL, events, and secret; a test action sends a sample event | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary consumer of the public API for BI and custom dashboards | High | Stable, paginated, versioned responses; clear OpenAPI spec |
| Platform-Admin | Operational owner of platform health and API usage | High | Visibility into rate-limit hits, webhook delivery health, and tenant abuse |
| Tenant-Admin | Configures integrations and webhooks in tenant settings | High | Secure API access, webhook subscription CRUD, delivery logs |
| Tenant-User | Uses integrations built by others or connects CRM/support tools | Medium | Trustworthy, signed, retried webhook delivery |
| Backend Engineer | Implements and maintains the API and delivery worker | High | Clear contracts, rate-limit primitives, and retry/dead-letter semantics |
| Product Owner | Prioritizes public API and integration roadmap | Medium | Evidence of adoption and reduced support burden |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.11 | backend engineer | rate-limited public API access and HMAC-signed webhook delivery from Service Bus events, | tenants can integrate with the platform. | Public endpoints under `/v1/` are reachable with Entra bearer tokens.; Rate limiting returns `X-RateLimit-*` headers.; `POST /v1/webhooks/subscriptions`, `GET/PATCH/DELETE` endpoints exist. |
| 12.12 | `Tenant-Admin` | a webhooks page where I can add, edit, and remove event subscriptions, | I can wire my own systems to the platform. | `WebhooksView` lists active subscriptions.; `WebhookForm` captures `url`, `events`, and `secret`.; Delivery status (success, failure, retry count) is visible per subscription. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `webhook_subscriptions.url` | HTTPS endpoint that receives webhook events | Tenant input | Tenant-Admin | High (destination for tenant data) |
| `webhook_subscriptions.events` | Curated list of event types the subscription receives | Tenant input | Tenant-Admin | Medium |
| `webhook_subscriptions.secret` | Shared secret used for HMAC-SHA256 signing | System generated or tenant input | Tenant-Admin | Critical (must not be exposed) |
| `webhook_subscriptions.active` | Whether the subscription is currently enabled | Tenant input | Tenant-Admin | Low |
| `webhook_subscriptions.tenant_id` | Tenant the subscription belongs to | Resolved from identity | System | Medium |
| `rate_limit_counters` | Sliding-window request counts per tenant and endpoint | Middleware | System | Low |
| `webhook_delivery_log` | Delivery attempts: timestamp, status, retry count, error, payload size | Delivery worker | System | Medium |
| `dead_letter_webhook_deliveries` | Exhausted deliveries awaiting replay or investigation | Delivery worker | System | Medium |
| `openapi_spec` | Generated JSON description of public `/v1` endpoints | Build/runtime | Product | Low |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | Every public API request must present a valid Entra External ID bearer token; anonymous access is not allowed. |
| BRU-002 | Rate limits are enforced per tenant, not per user, and use a sliding-window counter in Redis or Postgres. |
| BRU-003 | `GET /v1/posts` and `POST /v1/analytics/query` have a lower rate limit (100 req/min) than the tenant global limit (1,000 req/min). |
| BRU-004 | Webhook subscriptions are tenant-scoped; users may manage them only if their role permits integration administration. |
| BRU-005 | Webhook `url` values must use HTTPS. |
| BRU-006 | Every webhook delivery payload must include an `X-SocialEngage-Signature` header equal to `HMAC-SHA256(secret, body)`. |
| BRU-007 | Failed webhook deliveries are retried with exponential backoff for up to 10 attempts or 24 hours, whichever comes first, then dead-lettered. |
| BRU-008 | Breaking API changes require a new major URL version (`/v2/`). Deprecations are announced via a `Sunset` header. |
| BRU-009 | The public API is not permitted to introduce a separate, non-RLS access path or to trust `X-Tenant-Id`. |
| BRU-010 | The v1 public API does not support long-lived API keys; that capability is reserved for a future ADR. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Rate-limit enforcement must add less than 10 ms p99 latency to each request | Performance | Must | Measured in production or load tests over a 7-day window |
| NFR-002 | Public endpoints must reuse existing `tenant-auth-middleware` and RLS; no `X-Tenant-Id` trust is permitted | Security | Must | Verified by contract tests that cross-tenant access is denied |
| NFR-003 | Webhook HMAC secrets must be stored encrypted or hashed at rest | Security | Must | Security review confirms no plaintext secret storage |
| NFR-004 | Webhook delivery must achieve at least 99.5% success rate for healthy receiver endpoints | Reliability | Should | Measured over 30 days; unhealthy endpoints do not count against the metric |
| NFR-005 | Rate-limit state must be correct across multiple concurrent API instances | Scalability | Must | Sliding-window counter works under parallel load and rolling deploys |
| NFR-006 | The public API and webhook contracts must include deprecation headers and stable request/response shapes | Maintainability | Should | Contract tests verify `Sunset` headers and shape invariants |
| NFR-007 | All public access and webhook delivery attempts must be auditable per tenant | Compliance | Should | Logs include tenant, user/key, endpoint, timestamp, and outcome |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Low tenant adoption of the public API and webhooks | Medium | Medium | Provide OpenAPI/Postman, documentation, and sample integrations; measure requests and subscriptions weekly | Product Owner |
| R-002 | API abuse or DDoS from a compromised tenant token | Medium | High | Enforce strict rate limits, token rotation, and anomaly detection; short-lived Entra tokens reduce blast radius | Platform-Admin |
| R-003 | Unreliable tenant endpoints cause webhook retry storms | High | Medium | Cap retries at 10/24h, use exponential backoff with jitter, add per-destination circuit breakers | Backend Engineer |
| R-004 | Cross-tenant data leakage through a new public path | Low | High | Reuse existing `tenant-auth-middleware` and RLS; contract tests for cross-tenant denial; no `X-Tenant-Id` trust | Security Lead |
| R-005 | Increased infrastructure cost from delivery workers and rate-limit counters | Medium | Medium | Start with Redis/Postgres counter; monitor queue depth and worker CPU; autoscale workers if needed | Platform-Admin |
| R-006 | Consumer confusion when `/v1` is deprecated for `/v2` | Medium | Medium | Provide `Sunset` headers, migration guides, and a minimum 6-month deprecation window | Product Owner |

---

---

## 12. Assumptions and Dependencies

- ADR-0017 (URL path versioning) is already accepted and `/v1/` is the current convention.
- Entra External ID bearer-token authentication is already in place for the existing API.
- ADR-0033 (no `X-Tenant-Id` trust; identity resolved server-side) remains in effect.
- Redis or Postgres is available for the sliding-window rate-limit counter.
- `ServiceBus` already emits `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0017 (URL path versioning `/v1/`) | Architecture | Menno / Technical Lead | Accepted |
| D-002 | ADR-0088 (`POST /v1/analytics/query`) | Architecture | Product Owner | Accepted |
| D-003 | ADR-0012 / ADR-0013 (Service Bus event contracts) | Architecture | Backend Engineer | Accepted |
| D-004 | ADR-0091 (alert rules and thresholds) | Architecture | Backend Engineer | Accepted |
| D-005 | Entra External ID bearer-token authentication | External / Security | Identity Team | In production |
| D-006 | Redis or Postgres for sliding-window rate-limit counters | Infrastructure | Platform-Admin | Provisioned |
| D-007 | Story 12.11 (Public API versioning and webhooks backend) | Story | Backend Engineer | Ready |
| D-008 | Story 12.12 (Webhook management UI) | Story | Frontend Engineer | Ready (depends on Story 12.11) |

---

---

## 13. Open Questions

- Which `ServiceBus` events should be available to webhooks in v1? All or a curated list?
- Should webhook subscriptions be per-tenant or per-user?
- How are webhook delivery failures surfaced to the tenant?
- Should the OpenAPI spec be generated automatically or maintained by hand?

---

---

## 14. Appendix

### Reference Documents

- ADR-0106: `docs/adr/0106-api-and-integrations-versioning-and-webhooks.md`
- BRD-0106: `docs/project docs/Business-Requirements/BRD-0106-API-And-Integrations-Versioning-And-Webhooks.md`
- Feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0106 and BRD-0106. |