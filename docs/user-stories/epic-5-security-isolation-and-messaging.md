# Epic 5: Security, Isolation & Messaging

## Story 5.1 — Thin ingestion events with REST fetch on demand

**Source:** ADR-0012 · **Status:** Ready

**As a** downstream subsystem developer (e.g. Brand Reputation & Alerts),
**I want** `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` to carry only IDs and the minimal fields needed to decide whether to act, with full post data fetched via REST on demand,
**so that** I'm never holding a second, potentially-stale copy of post content alongside the core's own database.

**Acceptance Criteria**
- `SocialPostIngestedEvent` contains `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, `occurredAt` — no post text, engagement metrics, or raw payload.
- `ConnectorHealthChangedEvent` contains only status-transition fields (`previousStatus`, `newStatus`, `tenantId`, `platformId`, `occurredAt`).
- A subscriber can retrieve full post data for any `postId` received in an event via `GET /posts/:id`.

---

## Story 5.2 — Per-tenant event filtering via Service Bus subscription rules

**Source:** ADR-0013 · **Status:** Ready

**As a** downstream subsystem serving only a subset of tenants,
**I want** my Service Bus subscription to receive events only for the tenants I actually serve, filtered at the messaging layer,
**so that** I never receive — and can't accidentally process or leak — another tenant's events, without having to implement my own tenant filter.

**Acceptance Criteria**
- `tenantId` is emitted as a Service Bus application property on every event message, not only inside the JSON payload body (required for SQL subscription filters to evaluate it at all — see ADR-0013's Clarification).
- A subscription with a SQL filter on `tenantId` receives events only for matching tenants, verified by publishing events for two tenants and confirming a single-tenant-scoped subscription receives only one tenant's events.
- Adding a new downstream subsystem with a different tenant subset requires only a new subscription filter — no change to the publisher.

---

## Story 5.3 — Envelope-encrypted credential storage with OAuth-first auth

**Source:** ADR-0014 · **Status:** Ready

**As a** tenant connecting a social platform or AI provider,
**I want** my OAuth tokens and API keys encrypted at rest via Azure Key Vault–backed envelope encryption, with OAuth used wherever the platform supports it,
**so that** a database compromise alone can't expose my credentials in plaintext, and my access is scoped/revocable wherever the platform allows it.

**Acceptance Criteria**
- Credential values are never stored or logged in plaintext at any point in the write path — verified by inspecting stored rows and application logs.
- Connecting a platform that supports OAuth (X, LinkedIn, YouTube/Google, Meta) uses the OAuth flow; API-key entry is only offered for platforms without OAuth support (e.g. some RSS/newswire providers).
- Revoking a Key Vault key renders previously-stored credentials unreadable, confirming the envelope-encryption dependency is real, not cosmetic.

---

## Story 5.4 — Tenant isolation via Postgres Row-Level Security

**Source:** ADR-0015 · **Status:** Ready

**As a** platform operator responsible for multi-tenant data isolation,
**I want** every table carrying `tenantId` protected by a Postgres RLS policy, not only by application-level `WHERE tenantId = ?` filtering,
**so that** a missed filter in application code (a new endpoint, an ad hoc script, a migration) still can't return another tenant's rows.

**Acceptance Criteria**
- Every table with a `tenantId` column has an active RLS policy before it accepts writes — enforced by a CI/migration check that fails if a new `tenantId`-bearing table lacks one.
- A query executed without setting the expected tenant session context returns zero rows (fails closed), not another tenant's data.
- A deliberately-unfiltered test query (no `WHERE tenantId`) against a table with two tenants' data returns only the session's own tenant's rows.

---

## Story 5.5 — Event schema versioning via Service Bus message property

**Source:** ADR-0019 · **Status:** Ready (accepted 2026-07-29, ahead of its natural phase — see ADR-0019's Acceptance note); implementation still waits for Phase 3, when events are first published

**As a** downstream subsystem consuming ingestion events long-term,
**I want** every event to carry a `schemaVersion` as a Service Bus application property (not only in the payload), with additive changes leaving it unchanged and breaking changes bumping it through a coordinated cutover,
**so that** I can filter, route, or reject on schema version without deserializing a payload shape I don't understand, consistent with how `tenantId` filtering already has to work (Story 5.2).

**Acceptance Criteria**
- Every published event carries a `schemaVersion` Service Bus application property, starting at `1`.
- Adding a new optional payload field to an existing event type does not change `schemaVersion`.
- A breaking change to an existing event type's shape (field removed/renamed/retyped) increments `schemaVersion`, and the publisher emits both the old and new version in parallel until all known subscribers confirm they've upgraded.
- A subscriber can filter or reject messages by `schemaVersion` using a Service Bus subscription rule, without deserializing the message body.
