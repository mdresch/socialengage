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

---

## Story 5.6 — Authentication via Microsoft Entra External ID

**Source:** ADR-0029 · **Status:** Ready — ADR-0029 accepted 2026-08-03 ("reviewed ADR 0029 and approved"). Scheduled in Phase 4.5, first in that phase's own dependency chain (`docs/implementation-plan.md`) — Story 5.7 depends on this story's caller identity and is also Ready — ADR-0030 accepted 2026-08-03.

**As a** person signing in to SocialEngage (an invited tenant user, a Tenant-Admin, or Platform Admin),
**I want** to authenticate through Microsoft Entra External ID rather than a self-declared header,
**so that** my identity is cryptographically verified before I can act as any tenant at all.

**Acceptance Criteria**
- `social-listening-core` validates a bearer token's signature and issuer against the Entra external tenant's own published JWKS/OIDC discovery document — no request is authorized on an unverified or unsigned token.
- Token validation uses standard OIDC/JWT verification only — no Entra-specific SDK call or Graph API call occurs on the request-authorization path.
- The token's `sub` claim is extracted and available to downstream identity resolution (Story 5.9) as an opaque string — never parsed for, or trusted to carry, tenant/role/license information of any kind.
- A request bearing an invalid, expired, or wrong-issuer token is rejected (`401`) before any application logic runs.
- A request with no `Authorization` header at all is rejected (`401`), not silently treated as an anonymous/default-tenant request.

---

## Story 5.7 — Platform Admin's audited, narrowly-scoped RLS bypass

**Source:** ADR-0030 · **Status:** Ready — ADR-0030 accepted 2026-08-03, revised at review to add a narrow break-glass mechanism (Tenant-Admin credential reset only, no other tenant-data access). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), second in that phase's dependency chain — depends on Story 5.6 (Ready) for the caller identity a Platform Admin action authenticates; Story 5.8 is also Ready — ADR-0031 accepted 2026-08-03.

**Acceptance Criteria note, added 2026-08-03:** this story's contract must also cover ADR-0030 §3's break-glass addition — a test that a Platform-Admin-authenticated caller can trigger a credential reset for a named tenant's Tenant-Admin identity, that the action is logged per the same audit requirement as tenant-creation/suspension writes, and that no code path this story adds grants Platform Admin read/write access to `users`, `watchlists`, `social_posts`, or `platform_credentials` beyond that one narrow action.

**Second note, added 2026-08-03, during implementation:** per ADR-0030's own Clarification (added the same day), the break-glass mechanism is two explicit, separately-recorded phases — a request (no Entra action), and a Platform Admin's own separate act of picking it up for execution (the only step that touches Entra) — never one automated action chaining them. An already-executed request must reject a second execution attempt.

**Third note, added 2026-08-03, during implementation:** per ADR-0030's own second Clarification (same day), execution also issues a real Temporary Access Pass, not only a password reset — a password reset alone does not restore access for a Tenant-Admin locked out by a lost MFA device, verified directly against Microsoft's own documentation. Both actions happen within the same JIT elevation window and are revoked together. The TAP code itself must never appear in the audit log.

**As a** platform operator provisioning or suspending a SocialEngage tenant,
**I want** my actions to run through a database role that can see the tenant registry but nothing else, with every write durably logged,
**so that** platform administration never becomes an unaudited, implicit path to any tenant's own data.

**Acceptance Criteria**
- A dedicated Postgres role (e.g. `platform_admin_role`) is granted the `BYPASSRLS` attribute and `SELECT`/`INSERT`/`UPDATE` **only** on the `tenants` table and its own Platform Admin identity table — verified by a test asserting it has no grant on `users`, `watchlists`, `social_posts`, or `platform_credentials`.
- Every write performed through `platform_admin_role` is recorded in a durable, queryable log entry (actor identity, operation, target tenant, timestamp) — verified by a test that performs a tenant-suspension write and confirms a corresponding log row exists.
- A Tenant-Admin action (e.g. creating a tenant-wide credential) does **not** use `platform_admin_role` at any point — verified by confirming it runs entirely under the ordinary `app_user`/tenant-scoped session.
- No code path grants Platform Admin read or write access to any individual tenant's `users`, `watchlists`, `social_posts`, or `platform_credentials` rows.

---

## Story 5.8 — `tenants` table with its own RLS policy

**Source:** ADR-0031 · **Status:** Ready — ADR-0031 accepted 2026-08-03, revised at review to add sign-up domain capture (`tenants.domain`, for future same-domain sign-up routing). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), third in that phase's dependency chain — depends on Story 5.7 (Ready) for the bypass role; Story 5.9 is also Ready — ADR-0032 accepted 2026-08-03.

**Acceptance Criteria note, added 2026-08-03:** this story's contract must also cover ADR-0031 §5's `domain` column — nullable, a partial unique index enforcing uniqueness only when non-null, and a test confirming the column exists and accepts `NULL`. The public-email-provider exclusion and the sign-up "rerouting" UX itself are explicitly **not** this story's job (ADR-0031's own Open Questions defer both to whoever builds candidate ADR #4's story) — this story only needs to prove the column and its constraint, not domain-matching logic.

**As a** Tenant-Admin,
**I want** to see my own tenant's name, status, and seat counts through the same tenant-scoped session I already use for everything else,
**so that** viewing my own tenant's settings needs no special-case authorization path.

**Acceptance Criteria**
- `tenants` has an active RLS policy scoped by `id` (not a separate `tenant_id` column), following ADR-0015's `NULLIF(..., '')`-normalized, fail-closed pattern.
- A tenant-scoped session (`app.tenant_id` set) reading `tenants` sees exactly one row — its own.
- `platform_admin_role` can create a new tenant row, and update `status`/`license_seat_count` on any tenant row; it cannot write `active_seat_count`.
- `active_seat_count` is incremented/decremented by the same application transaction that changes a `users` row's status, never by `platform_admin_role`.
- A new user invitation is rejected once `active_seat_count >= license_seat_count` for that tenant.

---

## Story 5.9 — `users` table, RLS, and request-time identity resolution

**Source:** ADR-0032 · **Status:** Ready — ADR-0032 accepted 2026-08-03, revised at review to replace `status`'s `'suspended'` value with a nullable `access_ends_at` timestamp (§9). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), fourth in that phase's dependency chain — depends on Story 5.8 (Ready) for the `tenants.id` foreign-key target; Story 5.10 is also Ready — ADR-0033 accepted 2026-08-03.

**As an** authenticated caller,
**I want** my Entra identity resolved to my SocialEngage tenant, role, and status before any tenant-scoped query runs,
**so that** every subsequent request I make is correctly and automatically scoped to my own tenant, never one I merely claim.

**Acceptance Criteria**
- `users` has an active RLS policy identical in shape to every other tenant-scoped table (`tenant_id = current_setting('app.tenant_id', ...)`).
- A narrowly-scoped, `SELECT`-only bypass role (distinct from `platform_admin_role`) resolves an authenticated request's `sub` claim to `(tenant_id, user_id, role, status)` by querying `users` (and, if no match, the separate Platform Admin table) — this role has no grant beyond the specific columns needed for that lookup, and no write grant at all.
- Once resolved, the request's subsequent queries run through the ordinary `withTenant(resolvedTenantId, ...)` path — no bypass role is used for anything beyond the initial identity lookup in the same request.
- A `sub` matching no `users` row and no Platform Admin row is rejected (`401`/`403`), even though the token itself is validly signed by Entra.
- Tenant-Admin creates a `users` row in `invited` status with no `external_subject`; at the first successful sign-in matching that row's email, `external_subject` is populated from the token and `status` moves to `active`.
- Platform Admin is not a row in `users` — verified by confirming its own separate table has no `tenant_id` column and returns zero rows under any ordinary tenant-scoped session.

**Acceptance Criteria note, added 2026-08-03 (ADR-0032 §9):** `status`'s value set is `'invited' | 'active'` only — no `'suspended'` value exists. A user is resolved as currently active only when `status = 'active' AND (access_ends_at IS NULL OR access_ends_at > now())`; a test must confirm a user with a past `access_ends_at` resolves as not-active, a user with a future `access_ends_at` still resolves as active, and clearing `access_ends_at` back to `NULL` restores active resolution. Auditing of `access_ends_at` writes is explicitly not this story's job (ADR-0032's own Open Questions defer the audit mechanism to whoever resolves ADR-0030/ADR-0031's shared audit-log question).

---

## Story 5.10 — Retire `X-Tenant-Id` as a trust mechanism

**Source:** ADR-0033 · **Status:** Ready — ADR-0033 accepted 2026-08-03, as drafted, no revisions. Scheduled in Phase 4.5 (`docs/implementation-plan.md`), fifth and last of that phase's own dependency chain — depends on Story 5.9 (Ready) for the resolution path it relies on. Story 1.7 (Epic 1) is also Ready — ADR-0034 accepted 2026-08-03; Phase 4.5 has no Blocked stories left.

**As a** platform operator responsible for this project's own stated security posture,
**I want** every `/v1` endpoint to derive tenant identity exclusively from a validated bearer token, never from a client-supplied header,
**so that** the spoofing vector this project's own risk register (`Business-Case-v6.0.md` Risk R-04) has named since before any tenant existed is actually closed, not merely documented.

**Acceptance Criteria**
- No `/v1` route reads `req.header('X-Tenant-Id')` to determine tenant identity — verified by a repository-wide check (or equivalent test) that no route handler references it as a trust source.
- A request that includes an `X-Tenant-Id` header is unaffected by its value — the resolved, token-derived tenant is used regardless of what the header claims, verified by a test sending a mismatched header and confirming no behavior change or leak.
- Every existing tenant-scoped function's signature (`withTenant`, `storeCredential`, `getCachedConnectorHealth`, etc.) is unchanged — only the call site supplying `tenantId` changes.
- A request with a missing or invalid `Authorization` token is rejected (`401`) before reaching any route handler that previously trusted `X-Tenant-Id`.
