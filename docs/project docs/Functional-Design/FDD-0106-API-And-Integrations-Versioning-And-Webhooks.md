# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0106 API and Integrations — Versioning and Webhooks — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0106, BRD-0106, feature design 11) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0106 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0106, BRD-0106, `docs/product-research/feature-designs/11-api-and-integrations.md`, Story 12.11, Story 12.12, ADR-0017, ADR-0012/0013, ADR-0091, ADR-0033, ADR-0088 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0106 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the contracts below may still change before acceptance.

SocialEngage has an internal `/v1` API and Service Bus events, but no formal public API surface, no rate-limit protection, and no way for tenants to receive events in real time without polling. This document defines the functional behavior of: publishing a subset of existing endpoints as a documented public API surface under bearer-token auth; per-tenant sliding-window rate limiting; tenant-configured webhook subscriptions; HMAC-signed, retried webhook delivery sourced from Service Bus events; and the URL-based versioning/deprecation convention that protects external consumers from breaking changes.

### 2.2 Scope

**In scope:**
- Public API surface: `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, `POST /v1/analytics/query`, all bearer-token authenticated via Entra External ID.
- Generated `GET /v1/openapi.json`.
- Per-tenant rate limiting (global 1000 req/min; 100 req/min for `GET /v1/posts` and `POST /v1/analytics/query`) with `X-RateLimit-*` response headers.
- Webhook subscription CRUD (`GET/POST/PATCH/DELETE /v1/webhooks/subscriptions[/:id]`).
- `WebhookDeliveryWorker`: consumes Service Bus events, POSTs signed payloads to active subscriptions, retries with exponential backoff, dead-letters after exhaustion.
- URL-based API versioning (`/v1/`, `/v2/`) and `Sunset` header deprecation signaling.

**Out of scope:**
- A generated full client SDK (OpenAPI spec only).
- Long-lived, scoped API keys (v1 uses Entra bearer tokens only; API keys are a future ADR).
- Query-string-based versioning (`?version=2`).
- Third-party integration platforms (Zapier, Power Automate) as the only integration path.
- Exposing every Service Bus event to webhooks; only a curated event list is available in v1.

### 2.3 Target Audience

Backend engineers implementing the public API gateway, rate limiter, and webhook delivery worker (Story 12.11); frontend engineers building the Integrations/webhooks admin page (Story 12.12); QA authoring cross-tenant isolation and delivery-retry contract tests; Tenant Admins configuring integrations; Platform Admins monitoring API/webhook health.

---

## 3. Context and Background

ADR-0017 already established `/v1/` URL path versioning, and Entra External ID bearer-token auth plus RLS already protect the internal API (ADR-0033: no `X-Tenant-Id` trust). Service Bus already emits events such as `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` for internal consumption (ADR-0012/0013). What's missing is a formal, documented, rate-limited public surface and a push mechanism (webhooks) so tenants can integrate with Slack, Teams, Zapier, CRMs, or their own systems without reverse-engineering internal endpoints or polling.

This design must not introduce a second, unprotected API path — the public surface reuses the exact same `tenant-auth-middleware` and RLS-protected data access as internal calls, with rate limiting and webhooks layered on top.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Provide a stable, documented public API surface | `GET /v1/openapi.json` is generated and matches the public `/v1` contracts |
| G2 | Protect the platform and tenants from abuse | Per-tenant rate limits enforced with informative `X-RateLimit-*` headers; throttled requests return `429` |
| G3 | Enable real-time tenant integrations | Tenants create webhook subscriptions and receive curated Service Bus events at their own HTTPS endpoints |
| G4 | Preserve multi-tenant isolation | Public calls pass through the same auth/RLS path as internal calls; no new `X-Tenant-Id`-trusting path is introduced |
| G5 | Support long-term API evolution | Breaking changes require a new major version path; deprecated endpoints carry a `Sunset` header |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Public API surface

- **Description:** Exposes a curated, documented subset of existing `/v1` endpoints as the tenant-facing public API.
- **Triggers:** An external system (built by or for a tenant) calls a public endpoint.
- **Inputs:** An `Authorization: Bearer <Entra token>` header plus each endpoint's normal query/body parameters.
- **Processing:** Requests are routed through the same `tenant-auth-middleware` and identity-resolution path as internal admin-UI calls (ADR-0033); no separate, less-protected code path exists for "public" traffic. `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, and `POST /v1/analytics/query` (ADR-0088) are the initial public surface.
- **Outputs:** The same response shapes as the internal API for these endpoints.
- **Error handling:** A request without a valid bearer token returns `401 Unauthorized`. A token that resolves to a tenant/user without access to the requested resource returns the same not-found/forbidden behavior as the internal API — never a distinguishable "public API" error path that could leak existence.
- **Edge cases:** A public request scoped to a watchlist/provider the resolved user cannot access behaves identically to the same request made from the admin UI.

### 5.2 Feature / Capability: Generated OpenAPI specification

- **Description:** Publishes a machine-readable description of the public API surface.
- **Triggers:** `GET /v1/openapi.json` is requested, or regenerated at build/deploy time.
- **Inputs:** The route/schema definitions of the public endpoints.
- **Processing:** The spec is generated (not hand-maintained) from the actual public endpoint definitions, so it cannot silently drift from the real contract.
- **Outputs:** A valid OpenAPI JSON document describing paths, parameters, and response shapes for the public surface only (internal-only endpoints are excluded).
- **Error handling:** If generation fails, the previous valid spec should continue to be served rather than returning a broken document.
- **Edge cases:** A newly added public endpoint must appear in the next generated spec without a manual documentation step.

### 5.3 Feature / Capability: Per-tenant rate limiting

- **Description:** Protects the public API from abuse by capping request volume per tenant.
- **Triggers:** Every public API request.
- **Inputs:** The resolved tenant identity and the target endpoint.
- **Processing:** A sliding-window counter (Redis or Postgres) tracks requests per tenant. The global limit is 1000 requests/minute per tenant; `GET /v1/posts` and `POST /v1/analytics/query` have a lower limit of 100 requests/minute (BRU-002, BRU-003). Limits are enforced per tenant, not per user. The counter must be correct across multiple concurrent API instances (NFR-005).
- **Outputs:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every rate-limited response.
- **Error handling:** A request exceeding the limit is rejected with `429 Too Many Requests` and the same rate-limit headers indicating when the window resets.
- **Edge cases:** A tenant issuing requests from multiple concurrent processes/instances must still be capped correctly by the shared sliding-window counter, not per-instance counters that could be individually bypassed.

### 5.4 Feature / Capability: Webhook subscription management

- **Description:** Lets a tenant register, list, update, and remove webhook subscriptions.
- **Triggers:** A Tenant-Admin (or a role permitted to administer integrations) calls the subscription endpoints, typically via the `WebhooksView`/`WebhookForm` UI (Story 12.12).
- **Inputs:** `POST`/`PATCH` body: `{ url: string; events: Array<'post.ingested'|'alert.triggered'|'connector.health.changed'|'mention.threshold.crossed'>; secret: string; active: boolean }`.
- **Processing:**
  - `GET /v1/webhooks/subscriptions` returns only the caller's tenant's subscriptions.
  - `POST /v1/webhooks/subscriptions` creates a subscription; `url` must be HTTPS (BRU-005); the record is stored tenant-RLS-scoped.
  - `PATCH /v1/webhooks/subscriptions/:id` and `DELETE /v1/webhooks/subscriptions/:id` operate only on subscriptions belonging to the caller's tenant.
  - Only users whose role permits integration administration may manage subscriptions (BRU-004).
  - The `secret` is stored encrypted or hashed at rest, never in plaintext (NFR-003).
- **Outputs:** The created/updated/deleted subscription record (with `secret` never echoed back in plaintext after creation).
- **Error handling:** A non-HTTPS `url` is rejected with a validation error. `PATCH`/`DELETE` against a subscription id belonging to another tenant returns `404`, not `403` (avoids confirming existence).
- **Edge cases:** Deactivating (`active: false`) a subscription stops delivery without deleting its configuration or history.

### 5.5 Feature / Capability: Webhook delivery

- **Description:** Delivers curated Service Bus events to active tenant subscriptions as signed HTTPS POSTs.
- **Triggers:** A Service Bus event matching a subscription's `events` list is published (e.g., `post.ingested`, `alert.triggered`, `connector.health.changed`, `mention.threshold.crossed`).
- **Inputs:** The Service Bus event payload and the set of active, matching subscriptions for that tenant.
- **Processing:**
  - `WebhookDeliveryWorker` consumes the event and, for each active matching subscription, constructs the delivery payload: `{ eventType, tenantId, timestamp, payload }`.
  - The payload is signed: `X-SocialEngage-Signature = HMAC-SHA256(secret, body)` (BRU-006).
  - The signed payload is POSTed to the subscription's `url`.
  - On failure (non-2xx response, timeout, connection error), the delivery is retried with exponential backoff, up to 10 attempts over 24 hours (BRU-007).
  - After exhausting retries, the delivery is moved to a dead-letter queue for inspection/replay rather than silently dropped.
- **Outputs:** A delivery attempt log entry per try (timestamp, status, retry count, error, payload size) and, on success, a 2xx response from the tenant's endpoint.
- **Error handling:** Persistent failures for one subscription must not block delivery to other subscriptions or other tenants; a circuit-breaker-style backoff per destination prevents retry storms against a single unreliable endpoint (mitigates R-003).
- **Edge cases:** A subscription's `events` list changing mid-flight (e.g., an event type removed) must not retroactively affect already-queued deliveries for that event type, but should stop new ones from being enqueued.

### 5.6 Feature / Capability: API versioning and deprecation

- **Description:** Governs how breaking changes are introduced and communicated without breaking existing public API consumers.
- **Triggers:** A breaking change is planned for a public endpoint, or an existing version is scheduled for retirement.
- **Inputs:** N/A (a platform/engineering decision, not a runtime input).
- **Processing:** Breaking changes require a new major URL version (e.g., `/v2/`); the prior version (`/v1/`) continues to function. Endpoints scheduled for deprecation include a `Sunset` header indicating the retirement date.
- **Outputs:** A `Sunset` HTTP header on responses from endpoints slated for removal.
- **Error handling:** N/A — this is a governance/communication mechanism, not a runtime failure path.
- **Edge cases:** A tenant still calling a `Sunset`-flagged endpoint after its retirement date should receive a clear error (e.g., `410 Gone` or similar) rather than a silent behavior change.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Business-Analyst | Consumes the public API for BI/custom dashboards |
| Tenant-Admin | Configures webhook subscriptions and integrations |
| Tenant-User | Benefits from integrations built by others (CRM/support tool connections) |
| Platform-Admin | Monitors API usage, rate-limit hits, and webhook delivery health |
| Backend Engineer | Implements and maintains the API, rate limiter, and delivery worker |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.11) | backend engineer | rate-limited public API access and HMAC-signed webhook delivery from Service Bus events | tenants can integrate with the platform | Public endpoints reachable with Entra bearer tokens; rate limiting returns `X-RateLimit-*` headers; webhook CRUD endpoints exist; `WebhookDeliveryWorker` signs payloads and retries with backoff; failed deliveries dead-lettered after 10 attempts |
| US2 (Story 12.12) | Tenant-Admin | a webhooks page where I can add, edit, and remove event subscriptions | I can wire my own systems to the platform | `WebhooksView` lists active subscriptions; `WebhookForm` captures `url`/`events`/`secret`; delivery status (success, failure, retry count) visible per subscription; users can test a subscription with a sample event |

### 6.3 Workflow Diagrams / Steps

**Public API call workflow:**
1. External system obtains an Entra External ID bearer token for the tenant.
2. It calls a public endpoint (e.g., `GET /v1/posts`) with the bearer token.
3. `tenant-auth-middleware` resolves identity and tenant context; rate-limit middleware checks/increments the sliding-window counter and attaches `X-RateLimit-*` headers.
4. If under the limit, the request proceeds through the normal RLS-protected data path and returns the standard response shape; if over, `429` is returned.

**Webhook subscription workflow:**
1. Tenant-Admin opens the Integrations page and creates a subscription (`url`, `events`, `secret`, `active`).
2. `POST /v1/webhooks/subscriptions` validates the HTTPS `url`, stores the subscription tenant-scoped with the `secret` encrypted/hashed.
3. The admin can list (`GET`), edit (`PATCH`), deactivate/remove (`PATCH`/`DELETE`), and test the subscription from `WebhooksView`.

**Webhook delivery workflow:**
1. A Service Bus event (e.g., `post.ingested`) is published.
2. `WebhookDeliveryWorker` finds active subscriptions for that tenant whose `events` list includes the event type.
3. For each match, it builds the payload, signs it with `HMAC-SHA256(secret, body)`, and POSTs it to `url`.
4. On success, the attempt is logged as delivered. On failure, it is retried with exponential backoff up to 10 attempts over 24 hours, then dead-lettered.
5. Delivery status (success/failure/retry count) is surfaced per subscription in `WebhooksView`.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Entra External ID bearer tokens on every public request.
- Webhook subscription create/update payloads (`url`, `events`, `secret`, `active`).
- Service Bus events (`post.ingested`, `alert.triggered`, `connector.health.changed`, `mention.threshold.crossed`) consumed by the delivery worker.

### 7.2 Data Outputs

- Public API responses (same shapes as internal endpoints).
- `X-RateLimit-*` response headers.
- Signed webhook HTTP POSTs to tenant endpoints.
- Delivery log entries and dead-letter queue records.
- Generated `GET /v1/openapi.json`.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `webhook_subscriptions` | `id`, `tenant_id`, `url (HTTPS)`, `events: string[]`, `secret (encrypted/hashed)`, `active: boolean`, `created_at`, `updated_at` | Tenant-scoped; referenced by delivery attempts |
| `rate_limit_counters` | Tenant id, endpoint/scope key, sliding-window count, window reset time | Keyed per tenant (and per lower-limit endpoint where applicable) |
| `webhook_delivery_log` | `subscription_id`, `event_type`, `attempt_number`, `timestamp`, `status`, `error?`, `payload_size` | One or more rows per delivery attempt, references `webhook_subscriptions` |
| `dead_letter_webhook_deliveries` | `subscription_id`, `event_type`, `payload`, `attempts_exhausted_at`, `last_error` | References `webhook_subscriptions`; awaiting replay/investigation |
| `openapi_spec` (generated artifact) | Generated JSON document describing public `/v1` endpoints | Derived from route/schema definitions, not a persisted business entity |

### 7.4 Validation Rules

- Every public request must present a valid Entra External ID bearer token; anonymous access is not allowed (BRU-001).
- Rate limits are per-tenant, not per-user, via a sliding-window counter (BRU-002); `GET /v1/posts` and `POST /v1/analytics/query` use the lower 100/min limit (BRU-003).
- Webhook `url` must be HTTPS (BRU-005).
- Webhook management requires a role that permits integration administration (BRU-004).
- Every delivery payload carries a valid `X-SocialEngage-Signature = HMAC-SHA256(secret, body)` (BRU-006).
- Failed deliveries retry with exponential backoff up to 10 attempts or 24 hours, whichever comes first, then dead-letter (BRU-007).
- Breaking changes require a new major version path; deprecations carry a `Sunset` header (BRU-008).
- No separate, non-RLS public access path is permitted; `X-Tenant-Id` is never trusted (BRU-009).
- No long-lived API keys in v1 (BRU-010).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Every public request requires a valid Entra bearer token | Public API middleware |
| BR2 | Rate limits are enforced per tenant via a sliding-window counter, correct across concurrent instances | Rate-limit middleware |
| BR3 | `GET /v1/posts` and `POST /v1/analytics/query` carry a stricter 100/min limit than the 1000/min global | Rate-limit middleware |
| BR4 | Webhook subscriptions are tenant-scoped and role-gated | Webhook subscription endpoints |
| BR5 | Webhook `url` must be HTTPS | Subscription create/update |
| BR6 | Every delivery is HMAC-SHA256 signed | `WebhookDeliveryWorker` |
| BR7 | Failed deliveries retry with exponential backoff, capped at 10 attempts / 24 hours, then dead-letter | `WebhookDeliveryWorker` |
| BR8 | Breaking changes require a new major version; deprecated endpoints carry `Sunset` | API versioning governance |
| BR9 | The public API never introduces a separate non-RLS data path or trusts `X-Tenant-Id` | All public endpoints |
| BR10 | `secret` values are stored encrypted/hashed, never plaintext | `webhook_subscriptions` storage |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/analytics/dashboard`, `POST /v1/analytics/query` | Inbound API | Public API surface | REST/JSON, bearer auth |
| `GET /v1/openapi.json` | Inbound API | Public API specification | JSON (OpenAPI) |
| Rate-limit middleware (Redis or Postgres) | Internal | Sliding-window request counting per tenant | In-process middleware + counter store |
| `GET/POST/PATCH/DELETE /v1/webhooks/subscriptions[/:id]` | Inbound API | Webhook subscription CRUD | REST/JSON, bearer auth, tenant RLS |
| Service Bus | Inbound event source | Source events for webhook delivery | Azure Service Bus |
| `WebhookDeliveryWorker` | Outbound call | Delivers signed event payloads to tenant endpoints | HTTPS POST, HMAC-SHA256 signed |
| Tenant's own HTTPS endpoint | Outbound (external) | Receives webhook deliveries | HTTPS POST/JSON |
| `WebhooksView` / `WebhookForm` (admin UI) | Internal | Tenant-facing subscription management | React UI calling the subscription API |

---

## 10. Non-Functional Considerations

- **Performance:** Rate-limit enforcement must add under 10 ms p99 latency per request (NFR-001).
- **Security / access control:** Public endpoints reuse `tenant-auth-middleware` and RLS; no `X-Tenant-Id` trust (NFR-002). Webhook secrets are stored encrypted/hashed at rest (NFR-003).
- **Reliability / availability:** Webhook delivery targets at least 99.5% success rate for healthy receiver endpoints over 30 days (NFR-004); persistent per-destination failures are isolated via backoff/circuit-breaking so they don't degrade delivery to other tenants.
- **Scalability:** Rate-limit state must be correct across multiple concurrent API instances and rolling deploys (NFR-005).
- **Maintainability:** The public contract is versioned and stable; `Sunset` headers and shape invariants are contract-tested (NFR-006).
- **Audit and logging:** All public access and webhook delivery attempts are auditable per tenant — tenant, user/key, endpoint, timestamp, outcome (NFR-007).
- **Compliance:** No cross-tenant data leakage through the public path; contract tests must prove isolation (mitigates R-004).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Missing/invalid bearer token on a public request | `401 Unauthorized` | Request rejected before any data access |
| Rate limit exceeded | `429 Too Many Requests` with `X-RateLimit-*` headers | Request rejected; counter and reset time reported |
| Webhook subscription created with non-HTTPS `url` | Validation error | Subscription rejected, not stored |
| `PATCH`/`DELETE` on a subscription belonging to another tenant | `404 Not Found` | No existence disclosed; treated as if the id does not exist |
| Webhook delivery attempt fails (timeout, non-2xx, connection error) | None (tenant-side, surfaced in delivery log/UI) | Retried with exponential backoff, up to 10 attempts over 24 hours |
| Webhook delivery exhausts all retries | Delivery shown as failed/dead-lettered in `WebhooksView` | Moved to dead-letter queue for inspection/replay, not silently dropped |
| A `Sunset`-flagged endpoint is called after its retirement date | Clear deprecation/removal error | Request rejected rather than silently changing behavior |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- ADR-0017 (`/v1/` path versioning) is already accepted.
- Entra External ID bearer-token authentication is already in place for the existing API.
- ADR-0033 (no `X-Tenant-Id` trust) remains in effect for the public surface.
- Redis or Postgres is available for the sliding-window rate-limit counter.
- Service Bus already emits `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.

**Dependencies:**
- ADR-0017 (URL path versioning) — accepted.
- ADR-0088 (`POST /v1/analytics/query`) — accepted.
- ADR-0012/ADR-0013 (Service Bus event contracts) — accepted.
- ADR-0091 (alert rules and thresholds) — accepted.
- Entra External ID bearer-token authentication — in production.
- Redis or Postgres for rate-limit counters — provisioned.
- Story 12.11 (backend) and Story 12.12 (frontend), both currently Blocked pending ADR-0106 acceptance.

**Pending decisions:** ADR-0106 is Proposed; open questions below must be resolved before or during Story 12.11/12.12 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Which Service Bus events should be available to webhooks in v1 — all or a curated list? | Product Owner | Before Story 12.11 implementation |
| Q2 | Should webhook subscriptions be per-tenant or per-user? | Product Owner | Before Story 12.11 implementation |
| Q3 | How are webhook delivery failures surfaced to the tenant (in-app only, email, both)? | Product Owner | Before Story 12.12 implementation |
| Q4 | Should the OpenAPI spec be generated automatically or maintained by hand? | Technical Lead | Before Story 12.11 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| API versioning | Changing the major URL path (`/v1/`, `/v2/`) to introduce breaking changes without breaking older consumers. |
| Bearer token | Short-lived access token in the `Authorization` header, issued by Entra External ID. |
| Dead-letter queue | Queue holding deliveries that failed after all retries, for inspection or replay. |
| HMAC-SHA256 | Keyed-hash message authentication code proving webhook payload integrity/origin. |
| Rate limiting | Restricting the number of requests a tenant can make in a time window. |
| Sliding-window counter | A rate-limit algorithm tracking request counts over a rolling time window. |
| Sunset header | HTTP header announcing planned deprecation of an endpoint or API version. |
| Webhook | An HTTPS callback the platform POSTs to a tenant-controlled endpoint when an event occurs. |

### Reference links

- ADR-0106: `docs/adr/0106-api-and-integrations-versioning-and-webhooks.md` (Proposed)
- BRD-0106: `docs/project docs/Business-Requirements/BRD-0106-API-And-Integrations-Versioning-And-Webhooks.md`
- Feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- Related ADRs: ADR-0017 (API versioning), ADR-0012/ADR-0013 (Service Bus events), ADR-0091 (alert rules), ADR-0033 (no `X-Tenant-Id` trust), ADR-0088 (`POST /v1/analytics/query`)
- Related user stories: Story 12.11 (backend), Story 12.12 (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing sources

- No `docs/product-research/reports/11-api-and-integrations-deep-research.md` deep-research brief was found for this feature.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
