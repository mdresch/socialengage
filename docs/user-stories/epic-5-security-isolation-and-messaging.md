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

---

## Story 5.11 — `GET /v1/me`: expose a signed-in caller's own resolved identity over HTTP

**Source:** ADR-0036 §5 (Accepted 2026-08-04) · **Status:** Ready — ADR-0036 accepted 2026-08-04 ("ADR 0036 is approved"). This story resolves ADR-0036's own still-open "exact path, response shape, and name of the new core-side identity-exposure endpoint" Open Question at drafting time — the same way Story 5.8 resolved ADR-0031 §5's `domain`-column details and Story 6.7 resolved several of ADR-0037's own named open items directly, rather than treating an Accepted ADR's own flagged Open Question as a blocker to drafting the story it names as a prerequisite.

**No new ADR drafted for this story.** ADR-0036 §5 already decided the endpoint is required, additive, read-only, and — per its own Clarification, added after a Security & Architecture Reviewer finding pre-acceptance — must derive identity exclusively from `req.identity`, never a client-supplied override. ADR-0036 §5 explicitly characterizes it as "ordinary CRUD-adjacent surface... no new architectural decision of its own," the same category Stories 1.5 and 6.2–6.6 already build without their own ADR. What ADR-0036 left open was the path/response-shape bikeshed only, resolved directly below — not a fresh architectural question needing its own governance record.

**Confirmed as a real, unbuilt gap directly against the codebase, not assumed:** `src/identity/identityResolution.ts`'s `resolveIdentity()` is called only internally, from `createTenantAuthMiddleware()` (`src/http/auth/tenantAuthMiddleware.ts`), which attaches its result to `req.identity`. None of the four existing `versions/v1/*Router.ts` files (`postsRouter.ts`, `topicsRouter.ts`, `connectorsRouter.ts`, `watchlistsRouter.ts`) or `router.ts` (`createV1Router()`) itself mount anything at `/v1/me`, or expose `resolveIdentity()`'s result over HTTP at all. **Blocks Story 6.2 (role-gating) and Story 6.6 (Platform Admin console)** — both drafted Ready but not buildable without it (`docs/open-decisions.md` §1). Story 6.1 is already built, and its own `fetchResolvedIdentity()` (`social-listening-admin/src/lib/core-client.ts`) already calls `GET /v1/me` by that exact path and degrades to `null` on any non-2xx response — this story's route path is therefore not a fresh design choice, it is building the other half of an interface Story 6.1 already committed to on the client side.

**Epic placement, not Epic 6, despite sharing ADR-0036 as its source:** this story's entire implementation is `social-listening-core` backend work — an HTTP-exposed identity-resolution endpoint, the same category as Story 5.6 (Entra auth), Story 5.9 (`resolveIdentity()` itself), and Story 5.10 (`X-Tenant-Id` retirement) — not `social-listening-admin` UI/screen work, which is Epic 6's own explicitly stated scope ("Covers `social-listening-admin`," `docs/user-stories/epic-6-admin-ui.md`'s own opening line). Numbered as the next sequential story in Epic 5, following this series' established convention for a late-discovered necessary addition: a genuine next whole number in its own epic, never a decimal insertion tying it to whichever story surfaced the need (the same pattern ADR-0024/0026/0027/0028 followed as "genuine Nth ADRs," not decimal insertions — this story series has never used sub-decimal numbering anywhere, e.g. no "6.1.1" exists in this file set). This mirrors Story 1.7's own already-established precedent of being numbered in one epic (Epic 1) while scheduled in a different phase (Phase 4.5, `docs/implementation-plan.md`) — an ADR/story's epic and its practical build-order relationship are already treated as separate axes in this project, not something this story invents.

**As an** admin UI (or any future authenticated REST caller) that holds a validated bearer token but has no way to know its own resolved tenant/role/Platform-Admin identity,
**I want** a `GET /v1/me` endpoint that returns exactly what `resolveIdentity()` already computed for my own request, and nothing a client-supplied override could spoof me into seeing instead,
**so that** I can role-gate my own UI (Story 6.2) or console (Story 6.6) without ever decoding an Entra token claim for role/tenant information — which ADR-0029 §2 already forbids outright.

**Acceptance Criteria**
- `GET /v1/me` is mounted in `createV1Router()` (`src/http/versions/v1/router.ts`) behind the same `authMiddleware` (`createTenantAuthMiddleware()`) every other substantive `/v1` route already uses — not a second, parallel auth mechanism.
- A request with a missing, invalid, expired, or wrong-issuer bearer token is rejected `401` before this route's own handler runs — the same behavior Story 5.6's contract already proves for other routes, verified here only to confirm this route inherits it via the shared middleware, not reimplementing it.
- A validly-signed token whose `sub` resolves to no `users` row and no `platform_admins` row is rejected `403` — already `createTenantAuthMiddleware()`'s own existing behavior (`resolveIdentity()` returning `null`); verified here only to confirm this route doesn't bypass it.
- On success, returns `200` with a JSON body that is exactly `resolveIdentity()`'s own already-computed, camelCase `ResolvedIdentity` shape, unmodified: `{ "type": "tenant_user", "tenantId": string, "userId": string, "role": string }` for a tenant caller, or `{ "type": "platform_admin", "adminId": string }` for a Platform Admin caller — verified directly against three real resolved identities (`tenant_admin`, `tenant_user`, `platform_admin`), each getting back its own correct shape.
- **Derives the returned identity exclusively from `req.identity` — never from a `tenantId`, `userId`, `adminId`, or `role` supplied via query parameter, request body, or any header.** Verified directly: a test sends each of those as a spoofed override alongside a valid, different token and confirms zero effect on the response (ADR-0036 §5's own Clarification, added after a Security & Architecture Reviewer finding). This is this story's single most load-bearing assertion, not an incidental one — the whole reason ADR-0036 amended itself before acceptance.
- `GET` only — no `POST`/`PATCH`/`DELETE` verb is accepted at `/v1/me`; there is nothing for this endpoint to write.
- This story is additive-only: mounted alongside `/posts`, `/topics`, `/connectors`, `/watchlists` in `createV1Router()`, never nested inside any of them; no existing route's behavior, contract, or authorization changes as a result of building it.

**Named as a required follow-up, not this story's own scope:** `social-listening-admin`'s Story 6.1 contract (`social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts`) has its own AC8 assertion, "`fetchResolvedIdentity()` resolves to null rather than throwing while the endpoint does not exist" — written correctly against the gap this story closes. Once this endpoint is real, that assertion describes a state that no longer holds and needs a dated update (the same "don't silently rewrite already-shipped, passing contracts" discipline Story 2.3's AC4 rewrite under Story 2.5 already established in this series) — real, necessary follow-up work in `social-listening-admin`, not built or edited by this story, which is `social-listening-core`-only scope.

---

## Story 5.12 — Platform Admin tenant management REST surface

**Source:** ADR-0030, ADR-0031 (both Accepted) · **Status:** Ready — no new ADR needed. Both governing ADRs already fully locked the authorization boundary (which columns `platform_admin_role` may write, which tables it may touch at all) at the database layer; this story exposes that already-designed boundary over HTTP, the same "ordinary CRUD-adjacent surface, no new architectural decision" category Story 5.11 already established when resolving ADR-0036 §5's analogous gap.

**Built 2026-08-05** (`social-listening-core`, `contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts`, full suite 38/38 suites — see `docs/implementation-log.md`). **Also closed a real, confirmed-missing piece of ADR-0037 §9 while building AC4:** that section decided `platform_admin_role` should gain `UPDATE(domain)` on `tenants`, but no migration ever actually granted it — confirmed directly, no prior migration file referenced it. `migrations/0020_grant_platform_admin_domain_update.sql` is that missing grant, not a new decision. This unblocks Story 6.6's own first of three named backend prerequisites.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes Story 6.6's own named gap, confirmed directly against `tenants/SKILL.md`'s own "Known gaps" section: "No HTTP/REST surface exists for `tenants` yet."

**As** Platform Admin,
**I want** REST endpoints to list, create, and administer tenants,
**so that** I can operate the platform's tenant registry without hand-writing SQL against production.

**Acceptance Criteria**
- `GET /v1/admin/tenants` lists every tenant (`id`, `name`, `domain`, `status`, `licenseSeatCount`, `activeSeatCount`, `createdAt`) — reachable only through a `platform_admin` resolved identity (Story 5.11's `GET /v1/me` shape); a `tenant_admin`/`tenant_user` identity receives `403`.
- `POST /v1/admin/tenants` creates a tenant via `tenantStore.ts`'s existing `createTenant()`, running exclusively through `platform_admin_role` — proven by a test confirming the underlying query executes under that role, never `app_user`.
- `PATCH /v1/admin/tenants/:id` updates `status` and `license_seat_count` only — a request attempting to set `active_seat_count` is rejected (ignored or `400`), proven directly against `tenants/SKILL.md`'s own already-locked column-scoped grant (`platform_admin_role` is DB-level denied from writing `active_seat_count` — this route cannot widen that even if it tried).
- `PATCH /v1/admin/tenants/:id` may also update `domain`, per ADR-0037 §9's own already-Accepted grant extension — a real, audited recovery path for a wrong or squatted domain value, not new authority this story invents.
- **A test confirms no `app_user`/tenant-scoped session can reach any of these three endpoints** — the same explicit non-access proof `tenants/SKILL.md`'s own contract already applies at the store layer, re-proven here at the HTTP layer.
- Every write performed through these endpoints is logged via the existing `platform_admin_audit_log`/`logPlatformAdminAction()` mechanism (ADR-0030 §5) — reusing, not duplicating, Story 5.7's/5.8's own already-shipped audit path.

**Enhancement, 2026-08-12, at Menno's own direct request** (found live — no path anywhere renames a tenant after creation): `PATCH /v1/admin/tenants/:id` also accepts `name`, the same additive pattern already established for `domain`. Required a new grant migration (0029, `GRANT UPDATE (name) ON tenants TO platform_admin_role`) — migration 0017's original grant is column-scoped to `status`/`license_seat_count` only, confirmed directly via a real `aclcheck_error` while building this, the same gap migration 0020 had already closed for `domain`.

---

## Story 5.13 — Platform Admin break-glass request/execute REST surface

**Source:** ADR-0030 (Accepted) · **Status:** Ready — no new ADR needed. ADR-0030 §3 and its two Clarifications already fully designed the two-phase mechanism this story exposes over HTTP; Story 5.7 already builds and contract-tests the underlying store/mechanism layer.

**Built 2026-08-06** (`social-listening-core`, `contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts`, full suite 39/39 suites — see `docs/implementation-log.md`). Reused Story 5.7's own real-Entra-tenant test-cost discipline: exactly one real execute call in the whole contract, reused for the 409-on-retry check rather than triggering a second real Entra sequence. `targetUserId` is still caller-supplied — the Tenant-Admin-lookup-by-tenant-name gap (`platform-admin-access/SKILL.md`'s own named "Known gap") is unaffected, still open. This is the second of Story 6.6's three named backend prerequisites to close (after Story 5.12); Story 5.14 (audit-log query) is the last.

**Clarified 2026-08-12 — this story's own AC1 scoped the "Request" endpoint to `platform_admin` only, which reads as narrower than ADR-0030 §3's own "the affected Tenant-Admin... submits a request" Decision text.** Resolved directly with Menno, no code change: the intake channel is an external Jira Service Management customer portal (a Tenant-Admin who's actually locked out can't authenticate into the admin UI to use an in-app screen anyway), human-reviewed by the Platform Admin before they submit the request through this story's own already-built endpoint — a deliberate, explicit human-in-the-loop manual trigger, not an automated Jira→API integration. See ADR-0030's own matching 2026-08-12 Clarification for the full account.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes Story 6.6's own named gap: break-glass (Story 5.7) is store/mechanism-level only, confirmed directly against `platform-admin-access/SKILL.md`'s "Known gaps" section — no HTTP surface exists.

**As** Platform Admin,
**I want** REST endpoints to record a break-glass request and separately execute it,
**so that** I can recover a locked-out Tenant-Admin's access through the console (Story 6.6), preserving ADR-0030 §3's own two-phase, human-reviewed design — never one automated action.

**Acceptance Criteria**
- `POST /v1/admin/tenants/:id/break-glass/request` records a pending request (target tenant, who/what reported it, `status: 'requested'`) — performs no Entra-side action at all, per ADR-0030's own Clarification.
- `POST /v1/admin/tenants/:id/break-glass/requests/:requestId/execute` is a **separate** endpoint from the one above — a request cannot request-and-execute in one call; this story's contract must prove they are two distinct HTTP calls, not two branches of one handler.
- Executing a request performs the real two-identity JIT grant → password reset + TAP issuance → revoke sequence (Story 5.7's already-shipped mechanism), reachable only through a `platform_admin` resolved identity.
- **An already-executed request rejects a second execution attempt** — `409` or equivalent, proven directly, the same idempotency guarantee Menno named explicitly for this story.
- The generated temporary password and TAP code are returned **once**, in the execute response only, to the calling Platform Admin — never logged, never persisted, never returned by any other endpoint (including the list/audit views, Story 5.14) — re-proving Story 5.7's own already-established constraint at the HTTP layer.
- A test confirms no `app_user`/tenant-scoped session, and no unauthenticated caller, can reach either endpoint.
- Every request and execution is logged via `platform_admin_audit_log` — the TAP code and password itself never appear in that log entry's own detail, re-proving Story 5.7's own constraint here too.

---

## Story 5.14 — Platform Admin audit-log query REST surface

**Source:** ADR-0030 (Accepted) · **Status:** Ready — no new ADR needed. `platform_admin_audit_log`'s schema and write path already exist (Story 5.7); this story adds a read-only query endpoint over already-existing, already-Platform-Admin-scoped data.

**Built 2026-08-06** (`social-listening-core`, `contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts`, full suite 40/40 — see `docs/implementation-log.md`). Third and last of Story 6.6's three named backend prerequisites (5.12/5.13/5.14) to close.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes Story 6.6's own named gap: `platform_admin_audit_log` has no query endpoint, confirmed directly — no router file exposes it.

**As** Platform Admin,
**I want** a read-only REST endpoint to query the audit log,
**so that** I can review every bypassed write (tenant provisioning/suspension, break-glass executions, self-service-signup provisioning, domain-match escalations) without querying the database directly.

**Acceptance Criteria**
- `GET /v1/admin/audit-log` returns audit entries (`actorIdentity`, `operation`, `targetTenantId`, `detail`, `createdAt`), reachable only through a `platform_admin` resolved identity.
- Supports filtering by `tenantId`, a date range (`from`/`to`), and `actorIdentity` (query parameters) — a request with no filters returns the full log, paginated per this project's existing cursor-based pagination convention (ADR-0011).
- `GET` only — no write verb is accepted at this path; this is a read-only surface over an already-append-only table.
- A test confirms no `app_user`/tenant-scoped session, and no unauthenticated caller, can reach this endpoint.
- No entry's `detail` field ever contains a TAP code or temporary password value — re-proving Story 5.7's/5.13's own already-established constraint that these are never logged, at the one endpoint that would otherwise be the easiest place to leak them.

---

## Story 5.15 — Self-service tenant sign-up backend endpoint

**Source:** ADR-0037 (Accepted) · **Status:** Ready — no new ADR needed. ADR-0037 §1–§9 already exhaustively designed this endpoint's own behavior, schema, and role; this story builds directly against an already-Accepted ADR's own "Named as required, not designed here" list, the same relationship Story 6.7 already has to this same ADR for the UI half.

**Built 2026-08-06** (`social-listening-core`, `contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts`, full suite 41/41 — see `docs/implementation-log.md`). Closes Story 6.7's own named cross-repo dependency. `domain_signup_attempts` now exists and is being written to (Story 5.15 is its sole writer); Story 5.16's own Tenant-Admin-facing read of that table is the next piece of this same gap.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes Story 6.7's own explicitly-named dependency, verbatim: "a new `POST /v1/tenants/self-service-signup`-shaped `social-listening-core` endpoint... Named as required, not designed here."

**As a** brand-new user who is not yet part of any SocialEngage tenant,
**I want** a backend endpoint that provisions my own tenant and makes me its first Tenant-Admin,
**so that** the admin UI's sign-up screen (Story 6.7) has a real endpoint to call.

**Acceptance Criteria**
- `POST /v1/tenants/self-service-signup` is the **one** route in this project accepting a validly-signed Entra bearer token that resolves to no `users` row and no `platform_admins` row (ADR-0037 §5's own named, narrow exception to ADR-0029 §4) — every other route's existing behavior (reject an unmatched caller) is unaffected, proven by a regression test against at least one existing protected route.
- Before attempting tenant creation, the endpoint checks for an existing, unlinked `invited` `users` row matching the caller's validated email, in any tenant (ADR-0037 §6) — if found, the caller is routed through the existing invite-link mechanism (ADR-0032 §6) instead; no second tenant is ever created for an already-invited person.
- A caller whose `sub` already resolves to an existing `users` or `platform_admins` row is rejected (`400`/`409`, "you already belong to a tenant") — never reaches the tenant-creation path (ADR-0037 §7's decided floor).
- The caller's email domain is checked against the public-email-provider denylist (ADR-0037 §4) before capture; a denylisted domain leaves `tenants.domain` `NULL` on the created tenant.
- Tenant creation runs through a new, dedicated `tenant_signup_role` (`BYPASSRLS`, `INSERT`-only on `tenants`, `INSERT`-only on `platform_admin_audit_log`) — never `platform_admin_role`, never widening its own already-locked grant (ADR-0037 §1).
- A domain-match constraint violation (an existing tenant already claims this domain) is caught and translated into ADR-0037 §3's own decided rejection response — vague, never naming the matched organization — and, per §8b, writes a `domain_signup_attempts` row (Story 5.16 reads this data; this story is the sole writer).
- On success, the first `users` row (`role: 'tenant_admin'`) is inserted via the ordinary `app_user`/`withTenant(newTenantId, ...)` path — never through `tenant_signup_role`, which has no grant on `users` at all.
- Every `tenant_signup_role` write (the `tenants` INSERT) is logged via the existing `platform_admin_audit_log`/`logPlatformAdminAction()` mechanism, `actorIdentity` set to a clearly self-service-labeled value (e.g. `self-service-signup:<sub>`), never conflated with a real Platform Admin's own identity (ADR-0037 §2).
- A partial failure (tenant INSERT succeeds, first-user INSERT fails) surfaces a real, actionable error to the caller — the exact recovery mechanics are an open implementation question this story's own AC does not resolve (ADR-0037's own explicit deferral).

**Named as a required follow-up, not this story's own scope:** rate-limiting/abuse prevention (Story 5.18) is a precondition for exposing this endpoint to real, untrusted traffic (ADR-0037 §7) — this story's own Acceptance Criteria do not require it, the same explicit scope split Story 6.7 already names for its own UI half.

---

## Story 5.16 — Same-Domain Invite Assist backend surface and Platform-Admin escalation

**Source:** ADR-0037 §8b/§8c (Accepted) · **Status:** Ready — no new ADR needed. ADR-0037 §8b/§8c already exhaustively decided the data model, per-domain aggregation, and escalation-logging mechanics this story exposes; only the backend half of `docs/open-decisions.md` §1's own named gap ("has no owning story").

**Built 2026-08-06** (`social-listening-core`, `contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts`, full suite 42/42 — see `docs/implementation-log.md`). Closes the backend half of ADR-0037 §8b/§8c's own gap; Story 6.10 (the Tenant-Admin-facing screen) is the remaining piece.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes half of a real, confirmed gap: ADR-0037 §8b names the Same-Domain Invite Assist as required, admin-UI-facing work "not yet named by any of Epic 6's existing stories." This story is the backend REST surface a Tenant-Admin-facing screen (Story 6.10) needs to consume; Story 5.15 is this table's sole writer.

**As a** Tenant-Admin,
**I want** to see, and act on, same-domain sign-up attempts against my own tenant,
**so that** a legitimate not-yet-invited colleague's attempt is visible and actionable, not silently lost, without SocialEngage inventing a request-approval queue.

**Acceptance Criteria**
- `GET /v1/tenants/domain-signup-attempts` returns the caller's own tenant's `domain_signup_attempts` rows, RLS-scoped exactly like every other tenant-content table (ADR-0015's ordinary policy, never a bypass role) — reachable by `tenant_admin` only, `403` for `tenant_user`.
- The response aggregates by domain — one item per domain, with a distinct-verified-email count and an escalation flag (crossing ADR-0037 §8b's own template 3-attempts/30-day default) — not one row per individual attempt, per ADR-0037 §8b's own already-decided anti-flooding aggregation.
- Each domain item expands, on request (a nested field or a second endpoint), to the full list of distinct verified email addresses behind it — the same underlying data surfaced two ways, per ADR-0037 §8b's own decided shape, needed so the one-click invite action (Story 6.10) has a specific address to target.
- A background/inline check, triggered whenever a domain's attempt count crosses the escalation threshold, writes a distinguishably-labeled entry to the existing `platform_admin_audit_log` (§8c) — including the verified email addresses behind the pattern, per ADR-0037's own post-acceptance decision — reusing, not duplicating, the existing audit mechanism.
- This story does not implement real-time alerting (Slack/email/on-call) — the escalation write to `platform_admin_audit_log` is durably logged and reviewable, not paged, per ADR-0037 §8c's own explicit scope limit.
- A test confirms cross-tenant isolation: a Tenant-Admin of tenant A cannot see tenant B's `domain_signup_attempts` rows via this endpoint.

---

## Story 5.17 — Audit trail for `access_ends_at` writes

**Source:** ADR-0032 §9 (Accepted) · **Status:** Ready — no new ADR needed; this story resolves ADR-0032 §9's own named Open Question (the exact audit mechanism) directly, the same way Story 5.8 resolved ADR-0031 §5's `domain`-column details and Story 5.11 resolved ADR-0036 §5's endpoint shape — an implementation-time mechanics question, not a fresh architectural one, since the underlying principle (every `access_ends_at` write is auditable) is already decided.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes ADR-0032 §9's own explicitly-deferred gap: "Auditing of `access_ends_at` writes is explicitly not this story's job... deferred to whoever resolves ADR-0030/ADR-0031's shared audit-log question." Only concrete once Story 1.9 exists to actually write the field.

**Mechanics decided here, directly, rather than left open a second time:** `access_ends_at` writes happen via the ordinary `app_user`/`withTenant()` path (Story 1.9), not through any `BYPASSRLS` role — `platform_admin_audit_log` is granted only to `platform_admin_role`/`tenant_signup_role` and is structurally scoped to Platform-Admin-bypassed writes (ADR-0030 §5's own framing); reusing it for an ordinary tenant-scoped write would either require a new, out-of-category grant on that table for `app_user`, or misrepresent a tenant-initiated action as a Platform-Admin one. **This story instead adds a new, tenant-scoped `user_access_audit_log` table**, RLS-scoped exactly like every other tenant-content table (ADR-0015's ordinary policy) — the same "don't reuse a structurally different actor's audit table" discipline ADR-0032 §3 already applied to keep Platform Admin out of `users`, and ADR-0037 §8b already applied when it created a new `domain_signup_attempts` table rather than reusing `platform_admin_audit_log`.

**As a** Tenant-Admin (or Platform Admin, for the break-glass path),
**I want** every change to a user's `access_ends_at` durably recorded — who changed it, when, and the before/after value,
**so that** an offboarding or reactivation decision has a real, queryable history, not just the row's current state.

**Acceptance Criteria**
- `user_access_audit_log` (new table): `id`, `tenant_id`, `user_id`, `changed_by` (the acting user's own `id`), `previous_value` (nullable timestamptz), `new_value` (nullable timestamptz), `changed_at` — RLS policy identical in shape to every other tenant-scoped table.
- Every `PATCH /v1/tenants/users/:id` write to `access_ends_at` (Story 1.9) inserts exactly one row here, in the same transaction as the `users` update — proven by a test confirming the audit row and the `users` update either both commit or neither does.
- Setting `access_ends_at` (immediate or scheduled), and clearing it back to `NULL`, are both captured — a cleared value's `new_value` is `NULL`, proven directly.
- A Tenant-Admin can query their own tenant's `user_access_audit_log` (`GET /v1/tenants/users/:id/access-history` or equivalent) — RLS-scoped, `tenant_admin` only.
- The break-glass path (Story 5.13) does not write `access_ends_at` at all (it resets a credential, not access status) — this story's contract confirms the two mechanisms remain independent, not conflated.
- A test confirms cross-tenant isolation: a Tenant-Admin of tenant A cannot see tenant B's access-history rows.

**2026-08-10 — a real, confirmed schema/AC drift, corrected here rather than silently patched.** Story 1.9 (built 2026-08-09/10, ahead of this story) already had to create this exact table to make its own `PATCH /v1/tenants/users/:id` work — `migrations/0024_create_user_access_audit_log.sql`'s own header comment says as much: "Story 5.17 was drafted to own this design; Story 1.9 is the first caller." What it actually shipped uses `target_user_id`/`actor_user_id`/`old_value`/`occurred_at` (plus an `operation` column), not this story's own AC1 bullet's `user_id`/`changed_by`/`previous_value`/`changed_at`. **Not re-migrated now** — those names are already load-bearing in Story 1.9's own passing contract; the underlying principle AC1 actually cares about (every write auditable, tenant-scoped RLS, before/after values, who/when) is fully satisfied under the real names. This is the same "implementation-time mechanics, not a fresh architectural question" category Story 5.8/5.11 already established for comparable naming-only deltas.

**Story 5.17 built the same day.** `social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts` (7/7 passing) adds the one genuinely new piece — `GET /v1/tenants/users/:id/access-history` (`listAccessHistory()` in `identityResolution.ts`), proving AC4 (tenant_admin-only read), AC3 from the read side (both set and clear visible, in order), AC6 (cross-tenant isolation on this new endpoint specifically — Story 1.9's own AC8 isolation test predates this endpoint), and AC5 (a structural check that `breakGlassCredentialReset.ts` never references `access_ends_at`/`user_access_audit_log` at all). AC2's "same transaction" requirement is the pre-existing `withTenant()` BEGIN/COMMIT/ROLLBACK guarantee every tenant-scoped write in this codebase already depends on — not re-derived per-story. **Full suite at merge: 297/302 passing, 5 pre-existing failures in Story 5.7's own break-glass contract (a real, live Microsoft Graph 409, "concurrent requests being made to the tenant") — confirmed unrelated to this story (no code overlap, reproduces identically in isolation/`--runInBand`) and confirmed pre-existing, not a regression this story introduced. Tracked as its own known gap, not silently left unmentioned — see `docs/implementation-log.md`.**

---

## Story 5.18 — Self-service sign-up rate limiting and abuse prevention

**Source:** ADR-0040 (Accepted 2026-08-06) · **Status:** Ready. A genuinely undecided, hard-to-reverse new mechanism (a new keying scheme, real DoS/availability stakes if built wrong) — ADR-0037 §7 itself already named this as "not designed here... a precondition, not an optional hardening pass," the same bar that earned ADR-0020 its own ADR for an analogous rate-limit-mechanism decision.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes ADR-0037 §7's own named, undesigned precondition and `docs/open-decisions.md` §1's matching entry. Story 6.7 explicitly disclaims building this on the UI side; this is the backend mechanism gating the one endpoint (Story 5.15) reachable without a resolved identity.

**As a** platform operator exposing the one unauthenticated-until-resolved endpoint in this project,
**I want** sign-up attempts rate-limited by IP address and by verified email domain,
**so that** a script or a determined actor cannot cheaply flood tenant creation, without relying solely on ADR-0037 §8a's email-OTP-verification precondition to carry the whole weight of abuse prevention.

**Acceptance Criteria**
- A new, dedicated rate-limiting mechanism — structurally independent of `RequestGate` (ADR-0003/ADR-0020), which stays scoped to `(tenantId, providerId)` — rejects `POST /v1/tenants/self-service-signup` with `429` once either threshold below is crossed within its own rolling window.
- Per-IP-address: a configurable default of 10 attempts per rolling 24-hour window (ADR-0040 §3's own template default) — proven by a test that a caller exceeding this threshold receives `429`, and a caller from a different IP is unaffected.
- Per-verified-email-domain: a configurable default of 5 attempts per rolling 24-hour window, reusing the same `domain_signup_attempts` data Story 5.16 already reads (ADR-0040 §1) — proven by a test that several distinct verified emails at one domain, exceeding this threshold, are rejected, while a different domain is unaffected.
- A `429` rejection under this mechanism is distinct from ADR-0037 §3's domain-match rejection — it does not itself write a `domain_signup_attempts` row or trigger Story 5.16's own escalation logic (ADR-0040 §4) — proven by a test confirming the two code paths remain independent.
- Both thresholds and window lengths are read from configuration, not hardcoded, per this project's own established "implementation default, not blocking acceptance" convention (ADR-0017–0023's precedent).
- Storage for the attempt counters is in-process for a single-instance deployment, consistent with this project's own solo-deployment posture (ADR-0020's own precedent for deferring distributed state) — named explicitly in this story's own `SKILL.md` as a known limitation if this project is ever run as more than one concurrent instance, not silently assumed away.

**2026-08-10 — a real interpretive decision, named honestly rather than silently assumed.** This story's own AC3 (above) says the domain-keyed limit reuses "the same `domain_signup_attempts` data Story 5.16 already reads" — but ADR-0040 §2 itself unambiguously decides in-process storage for this mechanism, and `domain_signup_attempts` (a real Postgres table, written only on an *already-rejected* domain-match, never for a denylisted/public-email domain, which never collides and so never gets a row) cannot literally *be* that in-process counter without contradicting §2. Read as directional (the same concept of "domain," not a literal query against that table) — confirmed the more protective reading too: keying on the **raw** domain (before `selfServiceSignup.ts`'s own public-email-provider denylist filtering) is the only way this mechanism bounds repeated attempts against a denylisted domain like `gmail.com`, which `uq_tenants_domain` structurally cannot (a denylisted domain is stored `NULL` and never collides, per ADR-0037 §4).

**Story 5.18 built the same day.** `social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts` (7/7 passing) adds `signupRateLimit.ts` (a new, dedicated, in-process per-IP/per-raw-domain rolling-window counter, structurally independent of `connectors/requestGate.ts`) and wires it into `selfServiceSignupRouter.ts` ahead of any DB work. Both thresholds/windows are `SIGNUP_RATE_LIMIT_*` env-configurable, defaulting to ADR-0040 §3's own template values (10/24h IP, 5/24h domain). A `429` under this mechanism writes no `domain_signup_attempts` row, proven directly. **This closes ADR-0037 §7's own long-standing precondition** — `POST /v1/tenants/self-service-signup` (Story 5.15) is now safe to expose to real, untrusted traffic for the first time, per that ADR's own Consequences note. See `docs/implementation-log.md`.
