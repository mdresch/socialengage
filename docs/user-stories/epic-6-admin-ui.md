# Epic 6: Admin UI

Covers `social-listening-admin` — confirmed empty as of 2026-08-04 (no Next.js scaffold; only `src/lib/core-client.ts` and Story 1.1's own contract exist). Two sources feed this epic: **ADR-0036** (Story 6.1 only — the authentication/session/role-gating mechanism, the one architecturally significant decision in this batch, per that ADR's own reasoning for why it warrants one when Stories 1.5/1.6/1.7 didn't) and **Phase 1/Phase 3's own "also build, not storied" framing** (`docs/implementation-plan.md`) for Stories 6.2–6.6, following Story 1.5's own precedent for ordinary CRUD/UI surface that doesn't need an ADR.

**A note on sequencing vs. Status.** Per this project's own convention, "Ready" tracks whether a story's *source* is settled (an Accepted ADR, or unstoried CRUD precedent already established) — it is not the same as "buildable first." Story 6.1 is genuinely **Blocked** (ADR-0036 is Proposed, not Accepted). Stories 6.2–6.6 are not sourced from ADR-0036 and don't inherit its Blocked status, but every one of them has a real, practical build-order dependency on Story 6.1 existing first (there is no admin UI to add a screen to otherwise) — noted individually below, the same way Stories 3.5/2.4/4.4 are Ready but scheduled later for their own reasons.

---

## Story 6.1 — Next.js scaffold and Entra sign-in (server-side session)

**Source:** ADR-0036 · **Status:** Blocked — pending ADR-0036 acceptance. Also has a real cross-repo prerequisite: `social-listening-core` needs a new `GET /v1/me`-shaped endpoint (ADR-0036 §5) that does not exist today — confirmed directly against `src/identity/identityResolution.ts` and every `versions/v1/*Router.ts` file. That endpoint is `social-listening-core` work, out of this repo's/this document's own scope to build, and must exist before this story's AC6 can be verified end-to-end.

**As an** admin UI developer standing up the first real screen this project has ever shipped,
**I want** `social-listening-admin` scaffolded as a real Next.js app with a working Entra External ID sign-in that never exposes a bearer token to browser JavaScript,
**so that** every later screen in this epic has a real, secure session and a real caller identity to build against, instead of each one inventing its own auth handling.

**Acceptance Criteria**
- `social-listening-admin` is a real Next.js (App Router) application — `next`/`react` are real dependencies, a `pages/`-or-`app/`-rooted structure exists — while Story 1.1's own contract test (`contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts`) continues to pass unmodified: no Postgres driver added, `src/lib/core-client.ts` remains the sole path to core, the package stays independently versioned.
- Visiting any route while unauthenticated redirects to a sign-in page (Next.js Middleware, ADR-0036 §4's coarse-grained layer).
- Sign-in performs a real Authorization Code + PKCE exchange against the real Entra external tenant Story 5.6 provisioned (`getsocialengage.onmicrosoft.com`) — proven against a real, live sign-in, not a mock, the same evidentiary bar Story 5.6 held itself to for the backend half of this same tenant.
- On success, the resulting tokens are stored only in an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie — verified directly (e.g. inspecting response headers/cookie flags in the contract test) that no token value is ever present in a server-rendered HTML payload, a client-readable cookie, or any value reachable from browser JavaScript (ADR-0036 §1).
- `src/lib/core-client.ts` is extended so every authenticated call it makes attaches `Authorization: Bearer <token>` sourced from the server-side session — no other file constructs this header (ADR-0036 §2); verified by a structural check (the same technique `core-api-client/SKILL.md`'s own existing contract uses) that no second ad hoc `fetch`-with-bearer-header call exists anywhere else in `src/`.
- After sign-in, the admin UI calls the new core `GET /v1/me`-shaped endpoint (ADR-0036 §5) and stores the resolved `{ type, tenantId?, userId?, role?, adminId? }` shape in the server-side session for later stories' role-gating — never derived from any Entra token claim directly (ADR-0029 §2).
- **`GET /v1/me`'s own core-side contract (ADR-0036 §5's Clarification, added after a Security & Architecture Reviewer finding) proves it derives identity exclusively from `req.identity` — never a client-supplied `tenantId`/`userId`/similar.** Verified directly: a request carrying a query parameter, body field, or header attempting to claim a different identity than the caller's own validated token has zero effect on the response.
- An expired or invalidated session redirects to sign-in again on the next request, rather than rendering a broken page or a raw fetch error.
- **The session cookie enforces ADR-0036 §6's decided 8-hour absolute lifetime, server-side, regardless of activity** — added after a second Security & Architecture Reviewer finding that leaving session lifetime itself undecided (not just the rotation mechanism) left a hijacked cookie valid indefinitely. Verified directly: a session whose 8-hour ceiling has passed is rejected and redirects to sign-in on its next request, even if the caller was actively using it right up to that boundary — no silent renewal past the ceiling.
- Signing out clears the session cookie server-side and redirects to a signed-out state — no token remains valid for reuse from that browser afterward.

---

## Story 6.2 — Role-gated routing shell (Tenant-Admin/Tenant User vs. Platform Admin)

**Source:** ADR-0035 (governing structural constraint, cited per that ADR's own recommendation) and ADR-0036 §4 · **Status:** Ready in the sense that both governing ADRs are Accepted (ADR-0035) or will be settled by Story 6.1's own acceptance (ADR-0036) — practically sequenced immediately after Story 6.1, which it cannot be built without.

**As** a signed-in caller — a Tenant-Admin, a Tenant User, or a Platform Admin,
**I want** the admin UI to render only the screens my resolved identity is actually allowed to see,
**so that** a Platform Admin session never renders tenant content, and a Tenant User session never renders Tenant-Admin-only or Platform-Admin-only actions.

**This is the first Platform-Admin-facing screen shell to exist in this project — per ADR-0035's own text, this story is where that ADR's role-gated-routing decision gets its first real, testable contract**, cited directly rather than treated as a fresh design question.

**Acceptance Criteria**
- Two structurally separate route trees exist: a tenant-facing tree (for `tenant_admin`/`tenant_user` resolved identities) and a Platform-Admin-facing tree (for `platform_admin` resolved identities), gated by Story 6.1's session-stored resolved identity.
- A `platform_admin` identity requesting any tenant-facing route is redirected/rejected, and vice versa — proven directly (a test session of each type attempting the other tree's route), not just by the absence of a visible link.
- Within the tenant-facing tree, an action this project's backend already restricts to `tenant_admin` (e.g. Story 1.7's tenant-wide connect) is not rendered as available for a `tenant_user` session — but the story's own Acceptance Criteria and code comments state explicitly that this is a UX convenience only; the real boundary remains `social-listening-core`'s own 403 (Story 1.7), unaffected by anything built here.
- Cites ADR-0035 directly (in a `SKILL.md` or equivalent component doc) as the governing structural constraint for why this is one app with two route trees, not two deployables.

---

## Story 6.3 — Connector connect/disconnect flow

**Source:** Phase 1 "also build, not storied" (`docs/implementation-plan.md`), against Story 1.7's real REST surface (ADR-0034) and ADR-0027's disclosure requirement · **Status:** Ready — practically sequenced after Stories 6.1/6.2.

**As a** Tenant-Admin or tenant user connecting a platform,
**I want** a screen that lets me connect or disconnect a platform credential, tenant-wide or personal as my role allows,
**so that** I can set up a connector without engineering help, and without being misled about who I'm actually signing up with.

**Acceptance Criteria**
- Lists the platforms with a real, shipped connector today (GNews/RSS-News, Newswire) with their current connection state, calling `GET`-equivalent state and `POST/DELETE /v1/connectors/:platformId/connect|disconnect` (Story 1.7) via `core-client.ts`.
- The connect flow offers an `ownerType: 'tenant'` option only when the signed-in session's resolved role is `tenant_admin` (Story 6.2's role-gating) — always offers `ownerType: 'user'` for the caller's own personal credential, per ADR-0028 Tier 3.
- **Per ADR-0027's own named Consequences requirement** ("the eventual Admin UI's connector connect-flow needs its own copy/UX design that makes it unambiguous... they are signing up with the data source directly, not through SocialEngage"): before submitting a credential, the flow's copy states plainly that the caller is creating their own account/API key directly with the named provider (e.g. GNews), under that provider's own terms — not through SocialEngage, and SocialEngage is never an intermediary in that signup or its billing (ADR-0027's own "no intermediary in billing or pricing" bullet, restated as UI copy for the first time here).
- A `403` from the backend (e.g. a `tenant_user` attempting a tenant-wide connect despite the UI's own role-gating, or a stale session) surfaces the real reason to the caller, not a generic failure.
- Disconnecting a credential requires an explicit confirm step before the `DELETE` call is made (destructive action).

---

## Story 6.4 — Watchlist management screen

**Source:** Phase 1 "also build, not storied" (`docs/implementation-plan.md`), against Story 1.5's real REST surface · **Status:** Ready — practically sequenced after Story 6.1.

**As a** tenant user,
**I want** to create, view, edit, and delete my tenant's watchlists from the admin UI,
**so that** I can define what content is monitored without calling the REST API directly.

**Acceptance Criteria**
- Lists all watchlists for the current tenant (`GET /v1/watchlists`, RLS-filtered per Story 1.5), showing name, match type, active state, and scoped platforms.
- A create/edit form supports all four match types (`keyword`, `hashtag`, `account`, `boolean`) with the correct input for each — a terms list for the first three, a boolean-query text input (with no client-side syntax validation beyond what Story 1.5's own API already performs, per that story's own named "no watchlist validation beyond JSON schema" gap) for the fourth.
- Platform scoping (`platformIds`) offers only platforms the tenant has actually connected (Story 6.3), not an unfiltered static list.
- Deleting a watchlist requires an explicit confirm step (Story 1.5 performs a hard delete, no soft-delete/undo exists at the API layer — the UI must not imply one is available).
- Toggling `isActive` calls `PATCH /v1/watchlists/:id` with only that field, per Story 1.5's own PATCH-only-provided-fields semantics — the UI never resubmits the full record on a partial change.

---

## Story 6.5 — Connector status view

**Source:** Phase 1 "also build, not storied" (`docs/implementation-plan.md`), against Story 4.3's derived `ConnectorHealth` · **Status:** Ready, with a named, real backend gap — practically sequenced after Story 6.1/6.3.

**A real, confirmed gap this story depends on, not previously named in `docs/implementation-plan.md`:** only `GET /v1/connectors/:platformId` (single-platform health) exists today — confirmed via `docs/open-items-and-deferred-work.md` §B's own "no 'list all connectors for a tenant' endpoint" note and a direct check of `social-listening-core`'s router files. This screen needs to know *which* platforms a tenant has connected before it can query each one's health; Story 6.3's own connect/disconnect UI can supply that list from its own state for a v1 version of this screen, but a real "list this tenant's connectors" core endpoint is a cleaner long-term fix, named here as a follow-up, not built by this story.

**As a** tenant user or Tenant-Admin,
**I want** to see each connected platform's current health status at a glance,
**so that** I know whether posts are actually flowing in before I go looking for missing data.

**Acceptance Criteria**
- For each platform the tenant has connected (per Story 6.3's own state, pending a real list endpoint — see the gap named above), shows `GET /v1/connectors/:platformId`'s derived status (`healthy`/`degraded`/`failing`) and last successful poll time.
- Surfaces `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` field (per `docs/open-items-and-deferred-work.md` §B: "no connector/watchlist status view surfaces [this] anywhere real" — this is the first place it does) wherever a watchlist's boolean query includes a feature a given connector can't natively evaluate, so a tenant understands why a match might rely on fallback filtering rather than native support.
- A `failing` connector is visually distinguished from `degraded`/`healthy`, consistent with ADR-0009/ADR-0023's own severity ordering.
- No tenant-content data (post text, raw payload) is shown on this screen — health/status only, consistent with this project's own tenant-data-visibility boundaries elsewhere (ADR-0030 §2's Platform Admin analogue, applied here as a general "status views show status, not content" principle for this screen specifically).

---

## Story 6.6 — Platform Admin console (Phase 3 "beyond the Phase 1 minimum")

**Source:** ADR-0030 (Admin-tier design), ADR-0031 (`tenants` table shape), ADR-0035 (structural constraint) — all Accepted. **A real, substantial, previously-unnamed backend gap this story depends on:** confirmed directly against `.claude/skills/tenants/SKILL.md` ("No HTTP/REST surface exists for `tenants` yet... a future Admin UI story would add `POST/GET/PATCH` routes calling into `tenantStore.ts`") and `.claude/skills/platform-admin-access/SKILL.md` (break-glass request/execute and the audit log are store/mechanism-level only, Stories 5.7/5.8, with no HTTP surface either). **This story cannot be built against `social-listening-core` as it exists today** — every screen below needs a corresponding core REST endpoint that does not yet exist. · **Status:** Ready (its governing ADRs are Accepted) but blocked in practice on real, substantial `social-listening-core` work this document does not build — named here so it isn't discovered as a surprise mid-story, per this project's own stated practice (`docs/implementation-plan.md`'s own "not to be discovered as a surprise mid-phase" framing for a comparable gap in Phase 4.5).

**As** Platform Admin (in practice, Menno, the Sole Operator persona — `Stakeholder-Register.md`),
**I want** a console to provision/suspend tenants, adjust license seats, execute a break-glass Tenant-Admin credential reset, and review the audit log of every such action,
**so that** I can operate the platform without hand-writing SQL against production, while the zero-tenant-data-access boundary (ADR-0030 §2) stays real and enforced.

**A design-time reference exists, explicitly not implementation-ready:** `docs/design/platform-admin-console-mockup-2026-08-03.html` covers exactly these four screens (tenant list, tenant detail, break-glass confirmation, audit log), grounded in ADR-0030/0031. Per `docs/design/README.md`'s own stated limitation, it is plain HTML/JS, not Next.js, and is a layout/flow reference only — not yet reconciled screen-by-screen against ADR-0030 §3's two-phase break-glass workflow or ADR-0032 §9's `access_ends_at` model, and not to be ported or copy-pasted as code.

**Acceptance Criteria**
- Tenant list screen: name, domain, status, seat ceiling/active count, created date (ADR-0031's schema) — reading from a new `GET /v1/admin/tenants`-shaped core endpoint (does not exist yet — named as a required prerequisite, not built here).
- Tenant provisioning (create) and adjustment (status, `license_seat_count` only — never `active_seat_count`, per `tenants/SKILL.md`'s own column-scoped grant) via new core endpoints backed by `tenantStore.ts`'s existing functions, exercised only through `platform_admin_role` (ADR-0030 §2), never `app_user`.
- Break-glass flow implements ADR-0030 §3's own two-phase design exactly: a **request** step (recorded, no Entra action) separate from an **execute** step a Platform Admin explicitly picks up — never a single automated action, matching `breakGlassCredentialReset.ts`'s already-built mechanism (Story 5.7). The UI never displays the generated temporary password or the Temporary Access Pass code anywhere logged or persisted — shown once, per that mechanism's own load-bearing constraint.
- Audit log view surfaces every Platform-Admin-bypassed write (`platform_admin_audit_log`, Story 5.7) — acting identity, operation, target tenant, timestamp — read-only.
- No screen in this console renders any tenant-content table (`users`, `watchlists`, `social_posts`, `platform_credentials`, or anything a tenant would recognize as its own data) — verified directly against ADR-0030 §2's locked boundary, not merely asserted by the absence of a menu item.
- Infrastructure/operational metrics (server health, storage, connectivity) are explicitly out of this story's scope — `docs/design/README.md`'s own dated note defers this to "once this project's actual operational limitations... are well enough known," not decided or built here.

**Named as required, not designed here:** the new core-side endpoints this story depends on (`GET/POST/PATCH /v1/admin/tenants`, break-glass request/execute endpoints, an audit-log query endpoint) are real `social-listening-core` scope, following that project's own contract-first discipline, for the AI Delivery Agent or Menno to build — not designed or implemented by this document.
