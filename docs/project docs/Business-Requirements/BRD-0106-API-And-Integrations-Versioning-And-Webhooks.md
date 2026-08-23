# BRD-0106: API and Integrations — Versioning and Webhooks

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0106: API and Integrations — Versioning and Webhooks |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (automated draft from ADR-0106) |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft — for review; may change because the source ADR is **Proposed** |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0106, feature design 11, and Epic 12 stories |

---

## 2. Executive Summary

**What problem are we solving?** SocialEngage already exposes an internal `/v1` API and publishes Service Bus events, but it lacks a formal public API surface, rate-limit protection, and a native way for tenants to receive real-time events. Tenants who want to build integrations today must either poll the API or wait for manual exports, which is slow, expensive, and limits the product’s embeddability in customer workflows.

**Who is affected?** The primary beneficiaries are `Tenant-Business-Analyst`, `Tenant-Admin`, and `Tenant-User` personas who need to push posts into CRM/support/BI tools, trigger automation from alerts or mention thresholds, and build custom dashboards. `Platform-Admin` benefits from operational visibility into API usage and webhook health.

**What is the proposed solution at a glance?** Publish a stable, versioned public API under `/v1/` protected by Entra External ID bearer tokens and per-tenant rate limits. Add tenant-configured webhook subscriptions that the platform signs with HMAC-SHA256 and delivers from existing Service Bus events, with exponential backoff, retry limits, and dead-lettering for failed deliveries.

**What business value do we expect?** This turns SocialEngage into an extensible platform that customers can embed in their own stacks, increases switching costs, enables channel and automation scenarios, and protects the platform from API abuse.

> **Note:** Because the source ADR-0106 is currently **Proposed**, this BRD is a draft for review and may change once the ADR is accepted or revised.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a stable, documented public API surface | `GET /v1/openapi.json` is generated and the public `/v1` endpoints return consistent, versioned contracts |
| 2 | Protect the platform and tenants from API abuse | Per-tenant rate limits are enforced with `X-RateLimit-*` headers; no tenant exceeds configured limits without explicit throttling |
| 3 | Enable real-time tenant integrations via webhooks | Tenants can create subscriptions and receive `ServiceBus` events (e.g., `post.ingested`, `alert.triggered`) at their own HTTPS endpoints |
| 4 | Preserve multi-tenant isolation and security | All public calls pass through the same `tenant-auth-middleware` and RLS path as internal calls; no `X-Tenant-Id` trust is introduced |
| 5 | Support long-term API evolution without breaking consumers | URL-based major versioning (`/v1/`, `/v2/`) and `Sunset` headers are used for deprecation |

---

## 4. Scope

### 4.1 In Scope

- Public API surface for the existing v1 endpoints: `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, and `POST /v1/analytics/query`.
- Bearer-token authentication using the tenant’s Entra External ID setup.
- Generated `GET /v1/openapi.json` specification for the public surface.
- Per-tenant rate limiting (global 1,000 requests/minute; 100/minute for `GET /v1/posts` and `POST /v1/analytics/query`).
- Sliding-window rate-limit counter infrastructure backed by Redis or Postgres.
- Webhook subscription CRUD: `GET /v1/webhooks/subscriptions`, `POST /v1/webhooks/subscriptions`, `PATCH /v1/webhooks/subscriptions/:id`, `DELETE /v1/webhooks/subscriptions/:id`.
- Webhook delivery worker that consumes `ServiceBus` events and POSTs to active subscriptions.
- HMAC-SHA256 payload signing (`X-SocialEngage-Signature`).
- Exponential-backoff retry (up to 10 attempts over 24 hours) and dead-letter queue for exhausted deliveries.
- URL-based versioning (`/v1/`, `/v2/`) and `Sunset` headers for deprecated endpoints.

### 4.2 Out of Scope

- A generated full SDK in v1 (`GET /v1/openapi.json` is provided, but no SDK build pipeline).
- Long-lived, scoped API keys for v1 (Entra bearer tokens are used; API keys are a future ADR).
- Query-based API versioning (`?version=2`).
- Third-party integration platforms (e.g., Zapier, Power Automate) as the only integration path.
- All `ServiceBus` events in v1; only a curated set of public events is exposed initially.

### 4.3 Assumptions

- ADR-0017 (URL path versioning) is already accepted and `/v1/` is the current convention.
- Entra External ID bearer-token authentication is already in place for the existing API.
- ADR-0033 (no `X-Tenant-Id` trust; identity resolved server-side) remains in effect.
- Redis or Postgres is available for the sliding-window rate-limit counter.
- `ServiceBus` already emits `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.

### 4.4 Constraints

- v1 must not create a separate, un-RLS public API path; it reuses the same tenant-auth and RLS flow.
- Breaking API changes require a new major version path.
- Webhook subscriptions are tenant-scoped, with user management allowed only for users with the correct role.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary consumer of the public API for BI and custom dashboards | High | Stable, paginated, versioned responses; clear OpenAPI spec |
| Platform-Admin | Operational owner of platform health and API usage | High | Visibility into rate-limit hits, webhook delivery health, and tenant abuse |
| Tenant-Admin | Configures integrations and webhooks in tenant settings | High | Secure API access, webhook subscription CRUD, delivery logs |
| Tenant-User | Uses integrations built by others or connects CRM/support tools | Medium | Trustworthy, signed, retried webhook delivery |
| Backend Engineer | Implements and maintains the API and delivery worker | High | Clear contracts, rate-limit primitives, and retry/dead-letter semantics |
| Product Owner | Prioritizes public API and integration roadmap | Medium | Evidence of adoption and reduced support burden |

---

## 6. Current State (As-Is)

**Current process:**

1. The SocialEngage core API has internal `/v1` endpoints (`posts`, `watchlists`, `analytics`, etc.) used by the admin UI.
2. `ServiceBus` already publishes events such as `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` for internal consumption.
3. Authentication is handled by Entra External ID, and RLS enforces tenant isolation for internal calls.
4. There is no documented public API surface, no rate limiting, and no webhook mechanism for tenants.

**Pain points:**

- Tenants cannot build on the platform without reverse-engineering internal endpoints.
- External consumers risk being broken by undocumented contract changes.
- The platform has no protection against accidental or malicious API abuse.
- Tenants must poll for updates, increasing cost and latency.
- There is no native path to push alerts, posts, or connector-health changes into external systems such as Slack, Teams, or CRMs.

---

## 7. Future State (To-Be)

**New or improved process:**

1. External systems authenticate with an Entra External ID bearer token and call the documented public `/v1/` endpoints.
2. Every public request passes through the same `tenant-auth-middleware`, `resolveIdentity()`, and RLS-protected stores as internal requests.
3. Rate-limit middleware enforces per-tenant limits and returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
4. Tenant admins open the Integrations page, create a webhook subscription with a URL, event list, and secret, and save it.
5. The `WebhookDeliveryWorker` consumes `ServiceBus` events and POSTs signed payloads to active subscriptions.
6. Failed deliveries are retried with exponential backoff for up to 10 attempts over 24 hours, then moved to a dead-letter queue.
7. When a major API version is deprecated, the platform sends a `Sunset` header with a defined end-of-life date.

**Expected capabilities:**

- Stable, versioned public REST API with an auto-generated OpenAPI spec.
- Per-tenant, sliding-window rate limiting with informative headers.
- Tenant-controlled webhook subscriptions for curated real-time events.
- HMAC-signed, retried, auditable webhook delivery.
- Deprecation and versioning discipline that protects existing consumers.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

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

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Public API requests per tenant | Track adoption and detect abuse | Product / Platform-Admin | Hourly / Daily |
| Rate-limit hits (429s) per endpoint | Identify abusive or inefficient consumers | Platform-Admin | Real-time dashboard |
| Webhook delivery success / failure rate | Measure integration reliability | Product / Platform-Admin | Hourly |
| Webhook retry and dead-letter counts | Surface broken endpoints and queue health | Platform-Admin | Hourly |
| Subscription count per tenant | Track integration uptake | Product | Weekly |
| API version distribution | Guide deprecation planning | Product / Engineering | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Low tenant adoption of the public API and webhooks | Medium | Medium | Provide OpenAPI/Postman, documentation, and sample integrations; measure requests and subscriptions weekly | Product Owner |
| R-002 | API abuse or DDoS from a compromised tenant token | Medium | High | Enforce strict rate limits, token rotation, and anomaly detection; short-lived Entra tokens reduce blast radius | Platform-Admin |
| R-003 | Unreliable tenant endpoints cause webhook retry storms | High | Medium | Cap retries at 10/24h, use exponential backoff with jitter, add per-destination circuit breakers | Backend Engineer |
| R-004 | Cross-tenant data leakage through a new public path | Low | High | Reuse existing `tenant-auth-middleware` and RLS; contract tests for cross-tenant denial; no `X-Tenant-Id` trust | Security Lead |
| R-005 | Increased infrastructure cost from delivery workers and rate-limit counters | Medium | Medium | Start with Redis/Postgres counter; monitor queue depth and worker CPU; autoscale workers if needed | Platform-Admin |
| R-006 | Consumer confusion when `/v1` is deprecated for `/v2` | Medium | Medium | Provide `Sunset` headers, migration guides, and a minimum 6-month deprecation window | Product Owner |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- Public endpoints under `/v1/` are reachable and require a valid Entra External ID bearer token.
- Rate-limiting returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers for every request.
- `POST /v1/webhooks/subscriptions`, `GET /v1/webhooks/subscriptions`, `PATCH /v1/webhooks/subscriptions/:id`, and `DELETE /v1/webhooks/subscriptions/:id` are implemented and scoped to the tenant.
- `WebhookDeliveryWorker` consumes `ServiceBus` events, POSTs them to active subscriptions, and signs each payload with `HMAC-SHA256(secret, body)`.
- Failed webhook deliveries are retried with exponential backoff and dead-lettered after 10 attempts or 24 hours.
- `WebhooksView` and `WebhookForm` allow a `Tenant-Admin` to add, edit, remove, and test webhook subscriptions.
- Cross-tenant access attempts are denied and contract tests confirm RLS isolation.
- `GET /v1/openapi.json` is generated and valid.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **API versioning** | The practice of changing the major URL path (`/v1/`, `/v2/`) to introduce breaking changes while preserving older consumers. |
| **Bearer token** | A short-lived access token included in the `Authorization` header, issued by Entra External ID. |
| **Dead-letter queue** | A queue that holds messages that could not be delivered after all retries, so they can be inspected or replayed. |
| **Entra External ID** | Microsoft’s cloud identity service used for authentication and token issuance. |
| **HMAC-SHA256** | A keyed-hash message authentication code that proves payload integrity and origin. |
| **Rate limiting** | A control that restricts the number of requests a tenant can make in a time window. |
| **RLS (Row-Level Security)** | Database policies that enforce tenant isolation at the row level. |
| **Service Bus** | Azure messaging service that emits events consumed by internal and webhook workers. |
| **Sliding-window counter** | A rate-limit algorithm that tracks request counts over a rolling time window. |
| **Sunset header** | An HTTP header that announces the planned deprecation of an endpoint or API version. |
| **Webhook** | An HTTPS callback that the platform POSTs to a tenant-controlled endpoint when an event occurs. |

---

## 16. Appendices

### Reference documents

- **ADR-0106** — `docs/adr/0106-api-and-integrations-versioning-and-webhooks.md` (Proposed)
- **Feature design 11** — `docs/product-research/feature-designs/11-api-and-integrations.md`
- **Feature-to-ADR scoping** — `docs/product-research/feature-adr-scoping.md`
- **Epic 12 user stories** — `docs/user-stories/epic-12-adr-0101-to-0108.md`
  - Story 12.11 — Public API versioning and webhooks (backend)
  - Story 12.12 — Webhook management UI (frontend)

### Missing source

- A deep-research brief at `docs/product-research/reports/11-api-and-integrations-deep-research.md` could not be found and was not used in this BRD.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | [Name] | | |
