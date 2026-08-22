---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# API and integrations

### What it is
A documented REST API and pre-built integrations that let other systems consume SocialEngage data or trigger actions.

### End-user benefits
- **Workflow integration:** push posts into CRM, support, or BI tools.
- **Automation:** trigger actions from volume spikes, sentiment changes, or new mentions.
- **Custom frontends:** build internal dashboards on top of the same data.

### Core details
- SocialEngage already has `/v1` API endpoints and Service Bus events (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`).
- A public API surface would mean stable versioning (ADR-0017), rate limiting, and better auth documentation.
- Webhooks could be delivered from existing Service Bus topics.

### Implementation complexity
**Low for v1; medium for a public, versioned API.** The internal API exists. The work is documentation, versioning discipline, and external developer onboarding.

### Growth and reach
APIs embed the product into customers' stacks, increasing switching costs and enabling channel partners.

---

## Technical design

- **Data flow:** external system authenticates via Entra External ID or a scoped API key → calls `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/connectors/health` → `tenant-auth-middleware` validates token and `resolveIdentity()` → request proceeds through RLS-protected stores.
- **Component interactions:** the existing `/v1` Express router is the public API surface. Versioning uses `Deprecation` headers per ADR-0017. Webhooks are delivered from Service Bus topics by a new `webhook_subscriptions` dispatcher.
- **REST/Service Bus contracts:** `Authorization: Bearer` (Entra) or `X-API-Key`; `GET /v1/posts`, `GET /v1/watchlists`, `GET /v1/ingestion_runs`, `POST /v1/webhook/subscriptions`, `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` can be pushed to subscribed HTTPS endpoints.
- **Storage:** `webhook_subscriptions` (tenant-scoped, RLS) stores URL, event types, secret; rate-limit and call logs stored for audit.
- **Security considerations:** API keys are tenant-scoped and rotate; webhooks signed with HMAC-SHA256; rate limiting on all external endpoints; no `X-Tenant-Id` trust (ADR-0033); OAuth2/Entra is the primary auth.

## Backend principles

- **Versioned from day one.** ADR-0017's `Deprecation` header and URL path versioning ensure we can introduce breaking changes without breaking consumers. `/v1` is the first public contract.
- **RLS and identity for every call.** External requests are no different from internal ones: they go through the same `tenant-auth-middleware`, `resolveIdentity()`, and `withTenant()` RLS. Do not create a separate, un-RLS public API path.
- **Webhooks reuse Service Bus.** The existing `ServiceBusPublisher` already emits `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`. Webhook delivery is a consumer of those events plus a `webhook_subscriptions` table.
- **Contract-test targets.** Verify that the public `/v1` endpoints return the same shapes as the internal ones, that deprecated headers are present, that webhooks are signed and delivered, and that cross-tenant access is denied.

## Frontend / UI principles

- **User flow:** tenant admin opens "Integrations" → generates an API key or registers a webhook URL → selects event types → sees delivery log.
- **Component hierarchy:** `IntegrationsPage` → `ApiKeyManager` (generate/revoke/copy) → `WebhookForm` (URL, events, secret) → `WebhookDeliveryLog`.
- **State management:** Server state for keys and webhooks; client state for form and delivery log filter.
- **Accessibility and responsive design:** API keys are masked by default with a secure "copy" button; webhook event checkboxes are grouped; delivery log has keyboard-accessible retry/cancel actions.

## Open questions

- Do we support long-lived API keys or only Entra bearer tokens for public API access?
- Should webhooks be at tenant level or user level?
- How do we handle webhook retries and dead-lettering?
- Do we publish an OpenAPI/Swagger spec or only Postman collection?
- Which event types are public v1 (ingested post, health change)?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **API keys or Entra tokens?** | **Entra bearer tokens (short-lived) for v1**. Do not support long-lived static API keys as the default. If keys are needed for sandbox/internal tools, scope them tightly, rotate them, and store them hashed. | 2026 API auth best practices (Requestly, safeguard.sh, Redteam) prefer short-lived OAuth tokens over static keys; WorkOS notes API keys and OAuth have different lifecycles and should not be shoehorned into one schema. |
| **Webhooks tenant or user?** | **Tenant-level subscriptions**, but individual users can manage them if they have the right role. Webhook events are tenant-scoped, not personal. | Webhook subscriptions are typically account/tenant resources; user-level subscriptions would create cross-tenant exposure and management overhead. |
| **Webhook retries and dead-lettering?** | Use **exponential backoff with jitter**, **5–8 attempts over ~24 hours**, respect `429 Retry-After`, do **not** retry 4xx, and move exhausted deliveries to a **dead-letter queue** with a replay action. Add idempotency keys and a per-destination circuit breaker. | Svix, Hookbase, Webhooker, AllClearStack, and Transactional all prescribe the same pattern: backoff + jitter + cap + dead-letter. |
| **OpenAPI or Postman?** | **OpenAPI/Swagger spec** hosted at `/v1/docs/openapi.yaml` and generate the Postman collection from it. OpenAPI is the single source of truth. | API documentation best practices; OpenAPI-first lets both Swagger UI and Postman import the same definition. |
| **Public v1 event types?** | `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` only. Keep the public surface minimal; more events can be added in `/v1.1` with deprecation headers (ADR-0017). | Enterprise SaaS APIs typically launch with the smallest event set that proves value; Hootsuite's API also gates permissions by operation. |

### Sources consulted

- Requestly: API key vs. OAuth — https://requestly.com/blog/api-key-vs-oauth/
- safeguard.sh: API authentication best practices — https://safeguard.sh/resources/blog/api-authentication-best-practices
- WorkOS: API keys vs. OAuth — https://workos.com/blog/api-keys-vs-oauth
- Redteam: API keys vs. OAuth tokens — https://www.redteamworldwide.com/api-key-vs-oauth/
- Svix: webhook retry best practices — https://www.svix.com/resources/webhook-best-practices/retries/
- Hookbase: webhook retries — https://www.hookbase.app/blog/webhook-retries-exponential-backoff
- Webhooker: exponential backoff — https://webhooker.eu/blog/webhook-retries-exponential-backoff
- AllClearStack: webhook retry logic — https://allclearstack.com/blog/webhook-retry-logic-exponential-backoff-idempotency-dead-letter-queues
- Transactional: webhook reliability patterns — https://usetransactional.com/blog/webhook-reliability-patterns
- Hootsuite API permissions matrix — https://developer.hootsuite.com/docs/api-permissions-matrix

## Persona acceptance

- **Tenant-Business-Analyst (primary):** can authenticate with an Entra token, query `GET /v1/posts` with filters, and receive stable, versioned, paginated responses.
- **Platform-Admin (primary):** can query platform-level health and tenant metadata endpoints for operational dashboards.
- **Tenant-User (secondary):** can connect the platform to a CRM or support tool through a webhook and trust signed, retried delivery.
- **Tenant-Admin (secondary):** can create and rotate webhook subscriptions and API keys from the tenant settings UI.

## AI enhancements

- **Webhook payload summarization:** the AI writes a compact, human-readable summary of a webhook event.
- **Natural-language API query builder:** a helper that turns a question into the right `GET /v1/posts` query parameters.
- **Integration recommendation:** based on tenant usage, the AI suggests which CRM/support tool to connect.
- **Anomaly detection on API usage:** flag unusual access patterns per key/tenant.
