# Epic 6: Tenant Admin UI

Covers `social-listening-admin` — confirmed empty as of 2026-08-04 (no Next.js scaffold; only `src/lib/core-client.ts` and Story 1.1's own contract exist). Three sources feed this epic: **ADR-0036** (Story 6.1 — the authentication/session/role-gating mechanism), **ADR-0037** (Story 6.7 — self-service tenant sign-up, added same day), both reasoned architecturally significant enough for their own ADR per this series' own established bar, unlike Stories 1.5/1.6/1.7's ordinary CRUD precedent; and **Phase 1/Phase 3's own "also build, not storied" framing** (`docs/implementation-plan.md`) for Stories 6.2–6.14 (excluding 6.6, relocated — see below), following Story 1.5's own precedent for ordinary CRUD/UI surface that doesn't need an ADR.

**Retitled 2026-08-12, at Menno's own direct request ("to avoid confusion... have separate the Epic 6 Tenant Admin UI Designs").** This epic was "Admin UI," covering both tenant-facing screens and the single Platform Admin console screen (Story 6.6). It's now **Epic 6: Tenant Admin UI** — every story here is scoped to `tenant_admin`/`tenant_user` resolved identities (plus Story 6.1, the shared scaffold both tiers sit on top of). **Story 6.6 (Platform Admin console) is relocated to a new `docs/user-stories/epic-7-platform-admin-ui.md`, keeping its historical "6.6" ID unchanged** — per Menno's own explicit choice, this is a regrouping, not a renumbering: every prior reference to "Story 6.6" (`docs/implementation-log.md`, `docs/implementation-plan.md`'s traceability table, this file's own git history) stays literally correct with no edits needed. See `epic-7-platform-admin-ui.md` for its full text and the reasoning for why it now has its own epic, including its planned connection to Epic 4 (Derived Data, Analytics & Health).

**A note on sequencing vs. Status.** Per this project's own convention, "Ready" tracks whether a story's *source* is settled (an Accepted ADR, or unstoried CRUD precedent already established) — it is not the same as "buildable first." **ADR-0036 accepted 2026-08-04** ("ADR 0036 is approved") — Story 6.1 is now **Ready**. Stories 6.2–6.6 were not sourced from ADR-0036 and were already Ready, but every one of them has a real, practical build-order dependency on Story 6.1 existing first (there is no admin UI to add a screen to otherwise) — noted individually below, the same way Stories 3.5/2.4/4.4 are Ready but scheduled later for their own reasons. **ADR-0037 accepted 2026-08-04 as well** ("ADR 0037 is approved as well") — Story 6.7 (below) is now **Ready** too, also practically sequenced after Story 6.1.

---

## Story 6.1 — Next.js scaffold and Entra sign-in (server-side session)

**Source:** ADR-0036 · **Status:** Ready — ADR-0036 accepted 2026-08-04 ("ADR 0036 is approved"). Also has a real cross-repo prerequisite: `social-listening-core` needs a new `GET /v1/me`-shaped endpoint (ADR-0036 §5) that does not exist today — confirmed directly against `src/identity/identityResolution.ts` and every `versions/v1/*Router.ts` file. That endpoint is `social-listening-core` work, out of this repo's/this document's own scope to build, and must exist before this story's AC6 can be verified end-to-end. **2026-08-05: that endpoint now has its own story, Story 5.11** (`docs/user-stories/epic-5-security-isolation-and-messaging.md`, Epic 5, Ready, not yet built) — sourced from ADR-0036 §5 directly, no new ADR. This story's own dependency is unchanged: still blocked in practice until Story 5.11 is actually built, not merely drafted. **2026-08-05, later the same day: Story 5.11 is now built** (`contracts/epic-5/story-5.11.get-v1-me.contract.test.ts`, `docs/implementation-log.md`) — this story's AC6 dependency is satisfied.
**Built:** 2026-08-04 — social-listening-admin@c643553

**Implemented 2026-08-04 — already built and contract-verified** (`social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts`, 18/18 assertions passing against real infrastructure, no mock — see `docs/implementation-log.md`). Every AC above is met except the one this Status line already named as blocked (the `GET /v1/me` round trip — `fetchResolvedIdentity()` is built and degrades gracefully to `null` while that endpoint doesn't exist, proven directly, not assumed). Real infrastructure provisioned for this story specifically: a dedicated Entra app registration (`social-listening-admin`, confidential Web client, exact-match redirect URI) and a dedicated test user in the same real tenant Story 5.6 provisioned — never `ENTRA_TEST_TARGET_USER_ID`, which Story 5.7/5.8's own break-glass contracts reset the password of. **Auth.js/NextAuth.js verified directly, not just web-searched, per ADR-0036 §3's own instruction:** its documented `microsoft-entra-id` provider names only workforce issuer forms, and its generic custom-OIDC-provider path has no confirmed support for Entra External ID/CIAM either — confirms, doesn't overturn, ADR-0036's own default; the bespoke Authorization Code + PKCE flow (via `openid-client`) was built as specified. **One implementation-time naming correction from ADR-0036 §4's own text:** "Next.js Middleware" is `src/proxy.ts` here, not `src/middleware.ts` — Next.js 16 renamed and moved the convention to the Node.js runtime (the deprecated `middleware.ts` convention still defaults to Edge), which turned out load-bearing, not cosmetic, for this story's own server-side session store (see `social-listening-admin/.claude/skills/admin-auth-session/SKILL.md`'s own "Load-bearing constraints"). The session cookie itself ended up a `{ sid }` reference into an in-memory, `globalThis`-anchored store, not the tokens directly — confirmed necessary, not a design preference: Entra's real `id_token`/`access_token`/`refresh_token` together exceed the ~4KB per-cookie limit browsers enforce, and a browser silently drops an oversized `Set-Cookie` rather than erroring.

**As an** admin UI developer standing up the first real screen this project has ever shipped,
**I want** `social-listening-admin` scaffolded as a real Next.js app with a working Entra External ID sign-in that never exposes a bearer token to browser JavaScript,
**so that** every later screen in this epic has a real, secure session and a real caller identity to build against, instead of each one inventing its own auth handling.

**Acceptance Criteria**
- `social-listening-admin` is a real Next.js (App Router) application — `next`/`react` are real dependencies, a `pages/`-or-`app/`-rooted structure exists — while Story 1.1's own contract test (`contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts`) continues to pass unmodified: no Postgres driver added, `src/lib/core-client.ts` remains the sole path to core, the package stays independently versioned.
- Visiting any route while unauthenticated redirects to a sign-in page (Next.js Middleware, ADR-0036 §4's coarse-grained layer).
- Sign-in performs a real Authorization Code + PKCE exchange against the real Entra external tenant Story 5.6 provisioned (`getsocialengage.onmicrosoft.com`) — proven against a real, live sign-in, not a mock, the same evidentiary bar Story 5.6 held itself to for the backend half of this same tenant.
- **The authorization request's `redirect_uri` matches an exact-match value registered on `social-listening-admin`'s own Entra app registration — never a wildcard or pattern** (ADR-0036 §3, added at review). Verified directly: the app registration's configured redirect URI(s) are exact strings, one per real environment, and a sign-in attempt with a mismatched `redirect_uri` is rejected by Entra itself before this app's own code ever runs.
- **The session cookie's own encryption key has real entropy and is never committed to source control** (ADR-0036 §1, added at review) — verified directly: the key is sourced from an environment variable, is at least 256 bits of real randomness (not a short or human-chosen value), and no `.env` file containing a real value is tracked in git.
- On success, the resulting tokens are stored only in an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie — verified directly (e.g. inspecting response headers/cookie flags in the contract test) that no token value is ever present in a server-rendered HTML payload, a client-readable cookie, or any value reachable from browser JavaScript (ADR-0036 §1).
- `src/lib/core-client.ts` is extended so every authenticated call it makes attaches `Authorization: Bearer <token>` sourced from the server-side session — no other file constructs this header (ADR-0036 §2); verified by a structural check (the same technique `core-api-client/SKILL.md`'s own existing contract uses) that no second ad hoc `fetch`-with-bearer-header call exists anywhere else in `src/`.
- After sign-in, the admin UI calls the new core `GET /v1/me`-shaped endpoint (ADR-0036 §5) and stores the resolved `{ type, tenantId?, userId?, role?, adminId? }` shape in the server-side session for later stories' role-gating — never derived from any Entra token claim directly (ADR-0029 §2).
- **`GET /v1/me`'s own core-side contract (ADR-0036 §5's Clarification, added after a Security & Architecture Reviewer finding) proves it derives identity exclusively from `req.identity` — never a client-supplied `tenantId`/`userId`/similar.** Verified directly: a request carrying a query parameter, body field, or header attempting to claim a different identity than the caller's own validated token has zero effect on the response.
- An expired or invalidated session redirects to sign-in again on the next request, rather than rendering a broken page or a raw fetch error.
- **The session cookie enforces ADR-0036 §6's decided 8-hour absolute lifetime, server-side, regardless of activity** — added after a second Security & Architecture Reviewer finding that leaving session lifetime itself undecided (not just the rotation mechanism) left a hijacked cookie valid indefinitely. Verified directly: a session whose 8-hour ceiling has passed is rejected and redirects to sign-in on its next request, even if the caller was actively using it right up to that boundary — no silent renewal past the ceiling.
- Signing out clears the session cookie server-side and redirects to a signed-out state — no token remains valid for reuse from that browser afterward.

---

## Story 6.2 — Role-gated routing shell (Tenant-Admin/Tenant User vs. Platform Admin)

**Source:** ADR-0035 (governing structural constraint, cited per that ADR's own recommendation) and ADR-0036 §4 · **Status:** Ready — both governing ADRs are now Accepted (ADR-0035; ADR-0036 as of 2026-08-04) — practically sequenced immediately after Story 6.1, which it cannot be built without.
**Built:** 2026-08-05 — social-listening-admin@443819e

**Built 2026-08-05** (`social-listening-admin@443819e`, `contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts`, full suite 28/28 — see `docs/implementation-log.md`). Traceability caught up after the fact — this Status line, the Implementation Log entry, and the commit itself landed separately rather than together per `implement-story`'s own Step 8/9, a real process gap worth naming, not silently smoothed over.

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
**Built:** 2026-08-05 — social-listening-admin@67430b7

**Built 2026-08-05** (`social-listening-admin@67430b7`, `contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts`, full suite 31/31 — see `docs/implementation-log.md`). Same traceability-caught-up-after-the-fact note as Story 6.2 above applies here too.

**Documentation Steward correction, 2026-08-13 — this entry never recorded a real healing pass the same-day 2026-08-05 "Built" mark needed, unlike the matching corrections already present on Stories 6.4/6.5 below.** Confirmed directly against `docs/implementation-log.md` and current source: the 2026-08-05 build was a static placeholder — a hardcoded `[gnews, newswire]` array with hardcoded `connected` booleans, no credential-entry form, and no API call anywhere in `core-client.ts` to the real connect/disconnect endpoints. **Healed 2026-08-10** (`social-listening-admin@1dbd26a`, Menno's explicit authorization) into the real flow described in this story's AC list above: `getConnectorStatus()`/`connectPlatform()`/`disconnectPlatform()` in `core-client.ts`, real same-origin proxy routes, `ConnectForm.tsx`/`DisconnectButton.tsx`, and — at Menno's explicit direction, beyond this story's original two-connector AC scope — `azure-ai-language` and `azure-openai` (Story 2.8/2.9) added to the platform list alongside GNews/Newswire. See `social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md` for the current, accurate record of what this screen actually does, and this file's own Story 6.15/6.16/6.17 entries for later additions layered on top of this same screen.

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

## Story 6.4 — Watchlist management screen, real rework against ADR-0044's ownership/PATCH/locking contract

**Source:** Phase 1 "also build, not storied" (`docs/implementation-plan.md`), against Story 1.5's real REST surface (as reworked 2026-08-12 by ADR-0044) · **Status:** Ready
**Built:** 2026-08-12 — social-listening-admin@fded97b

**Built 2026-08-12 (real rework, superseding the erroneous 2026-08-05 "Built" note above).** `social-listening-admin/src/app/tenant/watchlists/page.tsx` is now a real async Server Component: a real `GET /v1/watchlists` call (no fixture data), `WatchlistForm.tsx` (create + RFC 7396 merge-patch edit, `If-Match`/version-based optimistic locking, `409`/`428`/`422` each handled distinctly), `WatchlistRow.tsx` (a dedicated single-field `isActive` toggle, and a two-click delete confirm), and `src/app/api/watchlists/route.ts`/`src/app/api/watchlists/[id]/route.ts` (thin same-origin proxies to four new `core-client.ts` functions: `listWatchlists()`, `createWatchlist()`, `updateWatchlist()`, `deleteWatchlist()`). Platform scoping is deliberately narrowed to real `SocialConnector` platforms only (`gnews`, `newswire`) — not Story 6.3's broader connect/disconnect list, which also includes AI enrichment providers a watchlist cannot legitimately be scoped to. New contract: `contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts` (25/25, real behavioral assertions — mocked-fetch core-client unit tests and Route Handler proxy tests, no jsdom in this repo, the same split Stories 6.3/6.8 already established). **A real cross-component regression was found and healed in the same pass, not worked around:** `contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts`'s own "Story 6.4" block still called the old synchronous fixture `WatchlistsPage()` directly, unmocked — once the real page started calling `cookies()` for real, that broke with Next.js's own "cookies called outside a request scope" error. Root-caused directly (stashed the change, confirmed the ripple contract passed on the clean baseline, confirmed it failed once restored) before fixing — healed via `heal-contract-failure`, upgrading that block to the identical real-session-plus-real-fetch-mocking pattern the Story 6.3 block in that same file already established for the identical prior migration (2026-08-10). Full `social-listening-admin` contract suite after: 12/12 suites, 153/153 tests passing. See `docs/implementation-log.md` for the commit.

**Built 2026-08-05** (`social-listening-admin@57926be`, `contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts`, full suite 34/34 — see `docs/implementation-log.md`).

**Correction, 2026-08-12 — this story was never actually built, and its own original Acceptance Criteria are now additionally stale.** Confirmed directly, not assumed: `social-listening-admin/src/app/tenant/watchlists/page.tsx` renders a hardcoded local fixture array — no `fetch`, no import from `core-client.ts`, no `/api/watchlists` Route Handler exists anywhere in the repo. The create/edit form's own `<button type="submit">` has no `onSubmit` handler; the delete-confirm button has no `onClick`. Nothing on this screen has ever called `social-listening-core`. This passed its own contract because that contract (`story-6.4...contract.test.ts`) only does `fs.readFileSync` + string-literal checks (`toContain('keyword')`, `toContain('boolean')`, etc.) — it asserts the file *contains certain words*, not that it does anything. **Independently, even a naive real implementation of the original AC list below would now be wrong**: this session's Story 1.5 rework (ADR-0044, `social-listening-core@aaf6bd7`) requires an `If-Match` header on every `PATCH` (missing → `428`, stale → `409 version_conflict`) and scopes every watchlist to `(tenantId, userId)` ownership with no Tenant-Admin oversight override — none of which existed when this story's original AC list (below, for the historical record) was written.

**Original Acceptance Criteria (2026-08-05, now superseded by the revised list further down — kept here, not deleted, per this project's own "don't rewrite history" convention):**
- Lists all watchlists for the current tenant (`GET /v1/watchlists`, RLS-filtered per Story 1.5), showing name, match type, active state, and scoped platforms.
- A create/edit form supports all four match types (`keyword`, `hashtag`, `account`, `boolean`) with the correct input for each — a terms list for the first three, a boolean-query text input for the fourth.
- Platform scoping (`platformIds`) offers only platforms the tenant has actually connected (Story 6.3), not an unfiltered static list.
- Deleting a watchlist requires an explicit confirm step (Story 1.5 performs a hard delete, no soft-delete/undo exists at the API layer).
- Toggling `isActive` calls `PATCH /v1/watchlists/:id` with only that field, per Story 1.5's own PATCH-only-provided-fields semantics.

**As a** tenant user or Tenant-Admin,
**I want** to create, view, edit, and delete *my own* watchlists from the admin UI, respecting the same version-checked, ownership-private contract the backend now enforces,
**so that** I can define what content I monitor without calling the REST API directly, and without the UI implying I can see or manage anyone else's watchlists — including as a Tenant-Admin.

**Revised Acceptance Criteria (2026-08-12, ADR-0044-aware — this is what a rebuild of this story must satisfy)**
- A real `GET /v1/watchlists` call renders the caller's own watchlists only — name, match type, active state, scoped platforms, and the returned `version` (stored per-row, needed for every subsequent edit). No fixture data anywhere in the render path.
- The create form performs a real `POST /v1/watchlists`; a `422 validation_failed` (the `matchType` ↔ `terms`/`booleanQuery` invariant) surfaces the real `details` array, not a generic error.
- The edit form performs a real `PATCH /v1/watchlists/:id`, sending `If-Match: "<version>"` from the row's last-known `version` on every request, and RFC 7396 merge-patch semantics (only fields actually changed are sent — never the full record). Toggling `isActive` alone still sends only that field, carried forward unchanged from the original AC.
- A `409 version_conflict` response (someone/something else changed the row first) is handled distinctly from a generic failure — at minimum, refetch and show the caller the row changed underneath them before they retry; a `428 precondition_required` (should be structurally unreachable if the client always tracks `version`, but must not crash if it happens) gets its own clear message too.
- Delete performs a real `DELETE /v1/watchlists/:id` behind the existing confirm step (hard delete, no undo — carried forward unchanged).
- Platform scoping (`platformIds`) still offers only platforms the tenant has actually connected (Story 6.3) — carried forward unchanged.
- The screen never implies oversight of another user's watchlists — no "all tenant watchlists" view, no author/owner column suggesting a Tenant-Admin can browse others'. A Tenant-Admin session sees exactly the same "my own watchlists" scope as a Tenant User session, matching the backend's own deliberate no-oversight-override rule (ADR-0044 §5c).
- This story's own contract must make real behavioral assertions (a real or realistically mocked fetch, real DOM interaction proving the form actually submits and the list actually updates) — a source-string-containment check is not sufficient evidence this screen works, per this correction's own root cause.

---

## Story 6.5 — Connector status view, real rework (fixture data replaced with the real endpoint)

**Source:** Phase 1 "also build, not storied" (`docs/implementation-plan.md`), against Story 4.3's derived `ConnectorHealth` · **Status:** Built (real rework, 2026-08-12), with a named, real backend gap (unchanged, see below) — previously marked "Built" in error on 2026-08-05; see the rework note below for the fix and this line for the real build.
**Built:** 2026-08-12 — social-listening-admin@4046e75

**Built 2026-08-12 (real rework, superseding the erroneous 2026-08-05 "Built" note above).** `social-listening-admin/src/app/tenant/connectors/status/page.tsx` is now a real async Server Component: a real `GET /v1/connectors/:platformId` call per connected platform (per Story 6.3's own connected-platform list — the "no list-all-connectors endpoint" gap named below is unchanged, unrelated to this fix), rendering the real `ConnectorHealth` shape (`status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`), a `failing` connector visually distinguished from `degraded`/`healthy`, no tenant-content data anywhere. **AC2 (surfacing `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes`) is a real, confirmed gap this rework found and named rather than silently dropped or faked:** that function is core-internal only, with no REST endpoint exposing its result anywhere — its own doc comment (`social-listening-core/src/watchlists/dispatch.ts`) already says as much. Building one is real, non-trivial `social-listening-core` scope outside this story's own Source line (Story 4.3's `ConnectorHealth` only); the screen's own copy names the gap explicitly instead. New contract: `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts` (10/10, real behavioral assertions — a real-session-plus-fetch-mocking page render plus structural source checks). **Proactively healed the identical known ripple this session's Story 6.4 build had already surfaced and fixed once**, before it could fail on its own run: `contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts`'s own "Story 6.5" block still called the old synchronous fixture `ConnectorStatusPage()` directly — upgraded to the same real-session-plus-fetch-mocking pattern used for Story 6.4's own fix, per that file's own now-twice-used precedent. Full `social-listening-admin` contract suite after: 12/12 suites, 160/160 tests passing. See `docs/implementation-log.md` for the commit.

**Enhanced 2026-08-12, later the same day, at Menno's own direct request ("could you provide an indicator of inactive or active on the connector page?").** The screen previously omitted any platform whose `credentialStatus` was `null` entirely — a tenant had no way to see GNews/Azure AI Language/Azure OpenAI even existed as options until connecting one. Now every platform in `PLATFORMS` is always listed, with a plain "Active"/"Inactive" indicator as the primary signal (derived from the same `connected` boolean already computed), and the finer `ConnectorHealth` status shown as secondary detail only when Active. Also fixed a real, previously-unnoticed bug in the same pass: `loadConnectorStatusRow()` discarded the already-fetched `ConnectorHealth` object for any unconnected platform (`health: connected ? health : null`) even though the fetch had already succeeded — wasteful, and actively wrong once inactive platforms are rendered too. Contract extended to 15/15. Full suite: 12/12 suites, 183/183 tests passing.

**Built 2026-08-05** (`social-listening-admin@99caf05`, `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts`, full suite 37/37 — see `docs/implementation-log.md`).

**Correction, 2026-08-12 — this story was never actually built either, same root cause as Story 6.4 above.** Confirmed directly: `social-listening-admin/src/app/tenant/connectors/status/page.tsx` renders a hardcoded `gnews`/`newswire`/`reddit` fixture array — it never imports `core-client.ts` or calls `GET /v1/connectors/:platformId`. This component's own SKILL.md explicitly documents extending the *fixture* as the intended pattern going forward, which would have kept baking in fake data indefinitely. The real `getConnectorStatus()` client function does exist and is genuinely used — but only on the Story 6.3 connect/disconnect screen, and only to derive a boolean `connected` flag plus the raw `credentialStatus` string; the full `ConnectorHealth` shape (`status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`) is never rendered from real data anywhere. Same contract-test weakness as Story 6.4: `story-6.5...contract.test.ts` only does source-string checks (`toContain('healthy')` etc.), which cannot detect fixture-only data.

**A real, confirmed gap this story depends on, not previously named in `docs/implementation-plan.md`:** only `GET /v1/connectors/:platformId` (single-platform health) exists today — confirmed via `docs/open-items-and-deferred-work.md` §B's own "no 'list all connectors for a tenant' endpoint" note and a direct check of `social-listening-core`'s router files. This screen needs to know *which* platforms a tenant has connected before it can query each one's health; Story 6.3's own connect/disconnect UI can supply that list from its own state for a v1 version of this screen, but a real "list this tenant's connectors" core endpoint is a cleaner long-term fix, named here as a follow-up, not built by this story. **This gap is unchanged by the 2026-08-12 correction** — it was never the reason this screen doesn't work; the fixture-data problem is orthogonal and is what actually needs fixing.

**As a** tenant user or Tenant-Admin,
**I want** to see each connected platform's current health status at a glance, from real data,
**so that** I know whether posts are actually flowing in before I go looking for missing data.

**Acceptance Criteria (unchanged in substance from 2026-08-05 — the fix is making these real, not rewriting what they ask for)**
- For each platform the tenant has connected (per Story 6.3's own state, pending a real list endpoint — see the gap named above), shows a **real** `GET /v1/connectors/:platformId` call's derived status (`healthy`/`degraded`/`failing`/`disconnected`), `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` — no fixture data anywhere in the render path.
- Surfaces `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` field wherever a watchlist's boolean query includes a feature a given connector can't natively evaluate, so a tenant understands why a match might rely on fallback filtering rather than native support.
- A `failing` connector is visually distinguished from `degraded`/`healthy`, consistent with ADR-0009/ADR-0023's own severity ordering.
- No tenant-content data (post text, raw payload) is shown on this screen — health/status only, consistent with this project's own tenant-data-visibility boundaries elsewhere (ADR-0030 §2's Platform Admin analogue, applied here as a general "status views show status, not content" principle for this screen specifically).
- This story's own contract must make real behavioral assertions (a real or realistically mocked fetch proving the rendered status actually came from `getConnectorStatus()`, not a local constant) — a source-string-containment check is not sufficient, per this correction's own root cause.

---

## Story 6.6 — relocated to Epic 7 (Platform Admin UI)

**Relocated 2026-08-12.** Story 6.6 (Platform Admin console) is now documented in full — unchanged, same historical "6.6" ID, same text, same dated correction/revision notes — in [`docs/user-stories/epic-7-platform-admin-ui.md`](epic-7-platform-admin-ui.md). It was moved out of this file as part of splitting the former "Epic 6: Admin UI" into a Tenant Admin epic (this file) and a Platform Admin epic, at Menno's own direct request to avoid confusion between the two audiences. No content changed, only location — every existing cross-reference to "Story 6.6" elsewhere in this project (`docs/implementation-log.md`, `docs/implementation-plan.md`'s traceability table) remains accurate as written.

---

## Story 6.7 — Self-service sign-up: new user becomes first Tenant-Admin of a new tenant

**Source:** ADR-0037 (Accepted 2026-08-04) · **Status:** Ready — ADR-0037 accepted 2026-08-04 ("ADR 0037 is approved as well"), together with three direct instructions folded into the ADR's new §8 (email-verification precondition; a Tenant-Admin-facing "Same-Domain Invite Assist" proposal on domain-match rejection; a Platform-Admin-visible escalation signal for repeated attempts). Also has two real cross-repo prerequisites, neither of which exists today: (1) a new `POST /v1/tenants/self-service-signup`-shaped `social-listening-core` endpoint (ADR-0037's own "Named as required, not designed here" section) that accepts a validated-but-otherwise-unmatched Entra bearer token and provisions a tenant plus its first Tenant-Admin atomically; (2) `GET /v1/me` (ADR-0036 §5, built 2026-08-05 as Story 5.11 — see Story 6.1's own updated Status line above), needed after a successful sign-up to hydrate the admin UI's session with the caller's newly-resolved `tenant_admin` identity, exactly the way Story 6.1 already depends on it for ordinary sign-in. **Also practically sequenced after Story 6.1** — this story reuses Story 6.1's own BFF session mechanism (server-side session cookie, `core-client.ts`'s single bearer-attachment choke point) rather than inventing a second one; it does not exist as a standalone screen outside that session shape.
**Built:** 2026-08-09 — social-listening-admin@2b44637

**2026-08-06 — the first of this story's two cross-repo prerequisites is now built.** `POST /v1/tenants/self-service-signup` exists, contract-verified, in `social-listening-core` (Story 5.15) — see `docs/implementation-log.md`. Both named prerequisites are now satisfied (`GET /v1/me` since Story 5.11); this story's own remaining status is purely about this document's own not-yet-built UI work. **Not yet safe for real, untrusted traffic** — `docs/implementation-plan.md`'s own caution stands: Story 5.18 (rate-limiting, ADR-0040, Ready but unbuilt) is a precondition before this endpoint is exposed publicly, per ADR-0037 §7.

**2026-08-09 — Story 6.7 built.** `social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts` (17/17 passing — 10 assertions against real infrastructure: a real `client.discovery()` call and a real spawned `next dev` server proving the actual `prompt=create` redirect against the real Entra External ID tenant, plus 7 unit-level assertions covering `completeSelfServiceSignup()`'s dispatch of every one of core's documented response shapes), full `social-listening-admin` contract suite green after the change (9/9 suites, 75/75 tests, including Story 6.1's own real live sign-in E2E — no regression). Reuses Story 6.1's own BFF session mechanism end to end: a new `/sign-up` entry point collects only the tenant name (never email/domain — those are Entra- and core-derived, per ADR-0037 §5's anti-spoofing requirement), triggers Entra's sign-up dialog via the standard `prompt=create` authorization parameter (verified directly against Microsoft's own docs, not assumed — see `.claude/skills/self-service-signup-ui/SKILL.md`), and on return dispatches core's `POST /v1/tenants/self-service-signup` response to the right screen: success establishes the ordinary session and lands on `/`; a domain-match 409 shows the vague, non-org-naming `/sign-up/domain-taken` page (ADR-0037 §3/§8d); an already-belongs 409 shows `/sign-up/already-have-account`; any other failure shows an actionable `/sign-up/error`. **§8b/§8c (Same-Domain Invite Assist, Platform-Admin escalation visibility) and §7 (rate-limiting) remain out of this story's own Acceptance Criteria, unbuilt** — named in this component's own SKILL.md, not silently assumed done. See `docs/implementation-log.md`.

**As a** brand-new user who is not yet part of any SocialEngage tenant,
**I want** to sign up and, if I'm the first person from my organization to do so, become the Tenant-Admin of a newly-created tenant for my organization,
**so that** I can start using SocialEngage without waiting for a Platform Admin or an existing Tenant-Admin to provision anything for me by hand.

**Acceptance Criteria**
- A "Sign up" entry point exists alongside Story 6.1's sign-in page, distinct from it, and triggers Entra External ID's own self-service sign-up user flow (confirmed available, ADR-0029 §4) via the same Authorization Code + PKCE mechanism Story 6.1 already established — no second, parallel auth mechanism is introduced.
- On return from a successful Entra sign-up/sign-in, the admin UI calls the new core self-service-signup endpoint (ADR-0037) with the caller's validated bearer token — never a client-supplied tenant name, email, or identity value beyond what the endpoint itself derives from the token, mirroring `GET /v1/me`'s own already-decided anti-spoofing requirement (ADR-0036 §5's Clarification).
- **A caller whose email domain (after ADR-0037 §4's public-email-provider exclusion) matches an already-onboarded tenant's `domain` is shown a specific, distinguishable message directing them to request an invite from their own organization's existing Tenant-Admin** (ADR-0037 §3) — never silently joined to that tenant, and never shown a generic failure indistinguishable from any other error. **The message never names the matched organization** (ADR-0037 §3, decided at review after a Security & Architecture Reviewer finding on 2026-08-04) — verified directly: the response contains no tenant name, ID, seat count, or other identifying detail, only the generic "an account for this domain already exists, ask your admin for an invite" copy. **It additionally reassures the caller their request has been shared with their organization's admin, without confirming that organization's identity** (ADR-0037 §8d, decided at acceptance) — this story's own copy stops there; it does not promise or implement any outbound follow-up (e.g. an email once invited) back to the rejected caller, since this project has no outbound-notification capability anywhere yet (ADR-0037 §8d's own named scope limit).
- **This endpoint's own domain-matching and denylist logic (ADR-0037 §3/§4) may only trust the caller's email once this project has confirmed email OTP verification is actually enabled on `social-listening-admin`'s own configured Entra user flow** (ADR-0037 §8a) — a configuration check for whoever builds this story, not new code, but a real precondition, not an assumption.
- **This story's own scope stops at recording each domain-match rejection** (a write the backend endpoint makes to the new tenant-scoped `domain_signup_attempts` table, ADR-0037 §8b) — surfacing that record to the matched tenant's own Tenant-Admin as the "Same-Domain Invite Assist" proposal, and escalating repeated attempts to `platform_admin_audit_log` for Platform-Admin review (ADR-0037 §8b/§8c), is real, named, required work that belongs to whichever admin-UI story ends up owning the Tenant-Admin's own dashboard — not yet named by any of Epic 6's existing stories (6.1–6.6 predate this decision) — and is explicitly **not** built by this story alone.
- **A caller whose email already has an unlinked `invited` row in some tenant (ADR-0037 §6) is routed through the existing invite-link flow instead** — this story does not duplicate ADR-0032 §6's own already-designed link mechanism, and must not create a second, unrelated tenant for an already-invited person.
- **A caller who already resolves to an existing `users` or `platform_admins` row is rejected with a clear "you already have an account" message** (ADR-0037 §7's decided floor), never silently allowed to create a second tenant.
- On success, the new tenant's name is collected from the user as part of the sign-up form (the endpoint does not invent one) before the provisioning call is made; the caller lands on the ordinary tenant-facing admin UI as a `tenant_admin`, with `GET /v1/me` (once built) confirming that resolved role for Story 6.2's own role-gating to key off, the same as any other sign-in.
- **Per ADR-0027's own disclosure discipline, restated here for the same reason Story 6.3 restates it for connectors:** the sign-up screen's copy makes clear that creating a SocialEngage account is free/self-service at this step, without implying anything about seat licensing, pricing, or contractual terms this project has not yet decided at the business layer — this story does not invent commercial copy that ADR-0027/`Business-Case-v6.0.md` haven't already settled.
- A network or backend failure mid-provisioning (e.g. the tenant `INSERT` succeeds but the first-user `INSERT` fails) surfaces a real, actionable error to the caller rather than a silent partial state — the exact recovery mechanics (retry, manual Platform Admin cleanup) are named as an open implementation question for whoever builds the backend endpoint, not resolved by this story's own Acceptance Criteria.
- **This story explicitly does not implement, and its own Acceptance Criteria do not require, any rate-limiting or abuse-prevention behavior** — ADR-0037 §7 names that as a precondition for exposing the backend endpoint to real, untrusted traffic, tracked there, not silently assumed satisfied by this UI-side story.

**Named as required, not designed here** (restating ADR-0037's own list for this story's direct dependents): `POST /v1/tenants/self-service-signup` and its underlying `tenant_signup_role`/migration — real `social-listening-core` scope, for the AI Delivery Agent or Menno to build, following that project's own contract-first discipline, not designed or implemented by this document.

---

## Story 6.8 — Tenant-Admin: user invitation and management screen

**Source:** Phase 1/Phase 3 "also build, not storied" (`docs/implementation-plan.md`), against Story 1.9's real REST surface · **Status:** Built 2026-08-10 — no new ADR needed, Story 1.5/6.3/6.4's own precedent for ordinary CRUD/UI surface against an already-real REST surface. Practically sequenced after Stories 1.9 and 6.2 (role-gating) both existing.
**Built:** 2026-08-10 — social-listening-admin@6b7fc00 (backfilled 2026-08-17, per the Built convention's forward-only rule, while touching this story again — the field records the original build commit only, per its own fixed two-shape format; this screen has since been extended multiple times, most recently a 2026-08-17 visual redesign — see `docs/implementation-log.md` for the full commit history, not this single field)

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes a real, confirmed gap: no Epic 6 screen lets a Tenant-Admin invite anyone, despite the flow being designed at ADR level (ADR-0032 §6) and referenced as already-working in Story 5.9's own Acceptance Criteria — no screen exists to actually drive it.

**As a** Tenant-Admin,
**I want** a screen to invite new users into my tenant, see who belongs to it, and end a user's access,
**so that** I can manage my own tenant's membership without calling the REST API directly.

**Acceptance Criteria**
- Lists all users for the current tenant (`GET /v1/tenants/users`, RLS-filtered per Story 1.9), showing email, role, status, and `access_ends_at` (or "active indefinitely" when `NULL`).
- An invite form (`POST /v1/tenants/users`) is offered only when the signed-in session's resolved role is `tenant_admin` (Story 6.2's role-gating) — not rendered at all for a `tenant_user` session, consistent with Story 6.3's own UX-convenience framing (the real boundary stays Story 1.9's own `403`).
- The invite form surfaces a clear, specific error when the tenant is at its license-seat ceiling (Story 1.9's `409`) — not a generic failure message.
- Setting or clearing a user's `access_ends_at` (`PATCH /v1/tenants/users/:id`) requires an explicit confirm step before the call is made, distinguishing an immediate offboarding from a scheduled future expiration in the UI's own copy.
- A `403` from the backend (e.g. a `tenant_user` session attempting an invite despite the UI's own role-gating) surfaces the real reason to the caller, the same pattern Story 6.3 already established.
- This screen's own access-history view (if built here) reads Story 5.17's `user_access_audit_log` via its own read endpoint — named as a natural companion, not required by this story's own Acceptance Criteria to ship in the same pass.

**2026-08-10 — Story 6.8 built.** `social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts` (14/14 passing), full `social-listening-admin` contract suite green after the change (10/10 suites, 89/89 tests — no regression). A new `/tenant/users` screen lists every tenant user (email, role, status, `access_ends_at` shown as "active indefinitely" when `null`), visible to both resolved roles; an invite form and a per-user access control are additionally gated on `identity.role === 'tenant_admin'` (UX convenience only, Story 1.9's own `403` remains the real boundary). Both Client Components (`InviteUserForm.tsx`, `AccessControl.tsx`) call same-origin Route Handlers (`/api/tenant-users`, `/api/tenant-users/:id`) that proxy straight through to new `core-client.ts` functions (`listTenantUsers`/`inviteTenantUser`/`setUserAccessEndsAt`) — core-client.ts stays the sole Bearer-attachment choke point, re-verified structurally. `AccessControl`'s own confirm gate is a real two-click flow (the first click only sets pending UI state, never fires the PATCH) whose copy distinguishes an immediate offboard from a scheduled one; a 409 seat-ceiling response and a 403 role-gate response each get their own specific, non-generic copy. The access-history view (Story 5.17's `user_access_audit_log`) remains unbuilt, per this story's own named "natural companion, not required" scope limit. See `docs/implementation-log.md`.

---

## Story 6.9 — Tenant settings screen

**Source:** Phase 1/Phase 3 "also build, not storied" (`docs/implementation-plan.md`), against Story 1.8's real REST surface · **Status:** Built 2026-08-10 — no new ADR needed, Story 1.5/6.3/6.4's own precedent. Practically sequenced after Story 1.8 exists.
**Built:** 2026-08-10 — social-listening-admin@9ec62fa

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Companion UI to Story 1.8 — no screen currently lets a Tenant-Admin or tenant user view their own tenant's own settings from the admin UI.

**As a** Tenant-Admin or tenant user,
**I want** to see my own tenant's name, status, domain, and seat counts from the admin UI,
**so that** I don't have to call the REST API directly to know my own tenant's current state.

**Acceptance Criteria**
- Reads `GET /v1/tenants/me` (Story 1.8) and displays `name`, `status`, `domain`, `licenseSeatCount`, `activeSeatCount`, `createdAt` — read-only, no edit form (writes to `status`/`licenseSeatCount`/`domain` remain Platform-Admin-only, Story 5.12).
- Visible to both `tenant_admin` and `tenant_user` resolved identities (Story 6.2's role-gating) — no role gate on this read-only view.
- Seat counts are shown as "used of licensed" (e.g. "7 of 10 seats used"), not raw numbers alone, so a Tenant-Admin can see at a glance whether they're near their own license ceiling before attempting an invite (Story 6.8).
- No tenant-content data (posts, watchlists, credentials) is shown on this screen — settings/administrative metadata only, consistent with this project's own "status views show status, not content" principle already applied to Story 6.5.

**2026-08-10 — Story 6.9 built.** `social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts` (10/10 passing), full `social-listening-admin` contract suite green after the change (11/11 suites, 99/99 tests — no regression). A new `/tenant/settings` screen reads `GET /v1/tenants/me` via a new `getMyTenant()` in `core-client.ts` and renders `name`/`status`/`domain`/seat counts (as "N of M seats used")/`createdAt`, read-only, gated only on the ordinary `'tenant'` shell — no additional role check, so both `tenant_admin` and `tenant_user` see the identical screen, per this story's own AC2. See `docs/implementation-log.md`.

---

## Story 6.10 — Same-Domain Invite Assist view (Tenant-Admin dashboard)

**Source:** ADR-0037 §8b (Accepted), against Story 5.16's real REST surface · **Status:** Built 2026-08-10 — no new ADR needed, ADR-0037 §8b already exhaustively decided the mechanism this screen surfaces; only the screen itself is undesigned. Practically sequenced after Story 5.16 exists.
**Built:** 2026-08-10 — social-listening-admin@3661ce9

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno. Renumbered from Menno's own proposed "Story 6.11" — his listed Epic 6 items (6.8, 6.9, 6.11) skip 6.10 with nothing named to fill it; corrected silently to the next actual sequential number in Epic 6, per this project's own numbering convention (see `docs/user-stories/README.md`'s dated note on this batch for the full accounting).** Closes ADR-0037 §8b's own explicitly-named gap: "which admin-UI story/screen owns building the Same-Domain Invite Assist — none of Epic 6's existing stories (6.1–6.6) name it."

**As a** Tenant-Admin,
**I want** to see same-domain sign-up attempts against my own tenant, with a one-click way to invite a legitimate colleague,
**so that** a not-yet-invited person from my own organization's domain isn't invisible to me just because self-service sign-up rejected them.

**Acceptance Criteria**
- Reads `GET /v1/tenants/domain-signup-attempts` (Story 5.16), showing one item per domain (always the caller's own tenant's matched domain, per Story 5.16's own RLS scoping) with a distinct-verified-email count.
- An item that has crossed ADR-0037 §8b's own escalation threshold is visually distinguished with materially more prominence than a first attempt — not just a bigger number in the same UI element, per ADR-0037 §8b's own decided treatment.
- Expanding an item reveals the full list of distinct verified email addresses behind it (Story 5.16's own expand-on-demand data), each with a one-click "invite this person" action that pre-fills Story 6.8's own invite-creation form with that email — never an automatic invite, never an auto-join; the Tenant-Admin's own act of confirming the invite remains the only thing that actually grants access (ADR-0037 §8b).
- Visible only to `tenant_admin` resolved identities (Story 6.2's role-gating) — `403`/not rendered for `tenant_user`.
- No org-identifying detail about a *different* tenant is ever shown here — this view only ever surfaces attempts matched to the caller's own tenant's own domain, consistent with ADR-0037 §3's own anti-enumeration decision, which this screen must not accidentally undermine by displaying data cross-tenant.

**2026-08-10 — Story 6.10 built, closing out Epic 6.** `social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts` (13/13 passing), full `social-listening-admin` contract suite green after the change (12/12 suites, 112/112 tests — no regression). A new `/tenant/invite-assist` screen reads Story 5.16's already-built `GET /v1/tenants/domain-signup-attempts` via a new `listDomainSignupAttempts()` in `core-client.ts`, rendering one item per domain (a native `<details>` element expands to the full email list Story 5.16 already returns inline — no second network call), an escalated domain marked with a distinct `⚠ Escalated` label rather than just a bigger count, and a per-email "Invite this person" link to `/tenant/users?inviteEmail=<email>`. **Also touches Story 6.8's own files, as required directly by this story's own AC3 text** ("pre-fills Story 6.8's own invite-creation form"): `tenant/users/page.tsx` now reads an optional `?inviteEmail=` search param and `InviteUserForm.tsx` accepts an `initialEmail` prop — a read-only seed, never an auto-submit; Story 6.8's own contract continues to pass unmodified. This screen's own role gate is a whole-page redirect before any data fetch (AC4's stricter "403/not rendered" requirement), deliberately distinct from Story 6.8's own in-page-only invite-form gate — see this component's own SKILL.md. See `docs/implementation-log.md`.

**Correction, 2026-08-12 — "closing out Epic 6" (the line directly above) was premature.** A drafting pass this session, cross-referencing what `social-listening-admin` actually renders against every real backend endpoint that exists, found: (a) Stories 6.4 and 6.5 above were never actually wired to `social-listening-core` at all, despite being marked "Built" — corrected in place above, not here; (b) `GET /v1/posts`/`GET /v1/posts/:id` (Phase 1, fully built and contract-verified since early in this project) have no frontend surface anywhere — for a social-listening product, the single largest gap between "backend exists" and "a human can use it"; (c) the `tenant-owned-feed` connector (Story 2.11, ADR-0050, built 2026-08-12) has no way to be connected by a real tenant — its two-step domain+feedUrl-then-DNS-verify flow doesn't fit Story 6.3's existing single-credential `ConnectForm`. Stories 6.11 and 6.12 below close (b) and (c). Epic 6 is not "done" until those are picked up too.

---

## Story 6.11 — Post feed (browse ingested posts)

**Source:** Phase 1/Phase 3 "also build, not storied" (`docs/implementation-plan.md`), against Story 3.4's real `GET /v1/posts` REST surface (ADR-0011 cursor pagination) and Story 5.1's `GET /v1/posts/:id` (ADR-0012) · **Status:** Built (2026-08-12) — see the dated note below.
**Built:** 2026-08-12 — social-listening-admin@d8ba590

**2026-08-12 — Story 6.11 built.** `social-listening-admin/src/app/tenant/posts/page.tsx` (list, real `GET /v1/posts`) and `src/app/tenant/posts/[id]/page.tsx` (detail, real `GET /v1/posts/:id`) are real, contract-verified Server Components — no fixture data anywhere. `postDisplay.ts` (new, pure, no JSX) derives title/snippet per-shape (looks only for a `title` field, optionally `description` — never branches on `providerId`, so it works unmodified for GNews, Newswire, and tenant-owned-feed alike, and falls back to raw JSON for anything else), the provider badge, and an enrichment summary (sentiment/entities/keyPhrases, shown only when present). Pagination is the real, opaque `nextCursor` via a `?cursor=` "next page" link — never a page-number control, never a client-constructed cursor. `authorId`/`acquisitionId` are shown as their raw values on the detail screen — no REST endpoint exists yet to resolve either into a friendlier name (confirmed directly: no `/v1/authors` route, `getIngestionRunForPost()` has no HTTP route mounted), named as a real, deferred gap in this component's own `SKILL.md`, not silently faked. A 404 renders a real "not found" state. **Also corrected `social-listening-core/.claude/skills/posts-api/SKILL.md`'s stale `X-Tenant-Id` load-bearing-constraint note** (stale since Story 5.10/ADR-0033, never fixed until now) — the real router already used `requireTenantUser()`, confirmed directly. New contract: `contracts/epic-6/story-6.11.post-feed.contract.test.ts` (24/24, real Server Component renders against a real encrypted session and mocked fetch, per this story's own AC5 and the Story 6.4/6.5 "string-containment checks are not sufficient" lesson — no source-string-only assertions). Full `social-listening-admin` suite after: 14/14 suites, 225/225 tests passing. See `docs/implementation-log.md` for the commit.

**2026-08-18, later the same day — real, found-live regression fixed: Facebook posts rendered as raw JSON, never a real title.** Menno reported directly: "the facebook post title as it is now not normalized for regular characters it seems to be a json rather then a title." Confirmed immediately: `extractDisplayText()` (`postDisplay.ts`) only ever recognized a `title` field — Facebook's own `rawPayload` shape (Story 2.15/ADR-0059, shipped after this story) has no `title` at all, only `message`, so every real Facebook post fell all the way through to this function's own raw-JSON fallback, exactly matching the reported symptom. Fixed by extending `extractDisplayText()` with two more fallback checks, in order: `message` (Facebook's own post text) and, for a media-only post with no message, `permalink_url` — never branching on `providerId`, keeping the same shape-based (not connector-name-based) dispatch this function already used. **A second, real finding surfaced while adding a real test for the fix, not assumed:** the three pre-existing "per-shape title extraction" tests in `story-6.11.post-feed.contract.test.ts` (GNews/Newswire/mystery-connector) render `page.tsx`'s own `Page()` and `JSON.stringify()` its return value — but `Page()` only ever returns `<PostsFeedClient posts={posts} .../>`, a single element whose `props.posts` carries the raw, unprocessed post data straight through; `PostsFeedClient` (a Client Component) is never actually invoked by that check. Those three tests would pass identically even with `extractDisplayText()` fully broken — which is exactly how this regression shipped invisibly across two later stories (2.15, 2.18) with no contract catching it. Fixed by adding two **direct unit tests** calling `extractDisplayText()` itself (the only way to actually prove its behavior) rather than extending the same non-discriminating pattern; the three pre-existing tests were left as-is, not rewritten — fixing their own tautology is separate, broader scope than this regression. Full `social-listening-admin` suite: 36/36 suites minus Story 6.1's 3 pre-existing, environmental Entra-sign-in failures (unrelated — see that story's own dated note elsewhere in this log). See `docs/implementation-log.md` for the commit.

**Drafted 2026-08-12**, from a direct cross-reference pass over `social-listening-admin`'s actual routes against `social-listening-core`'s real REST surface, requested by Menno specifically to find backend work with no way for any audience to see it. Closes the single largest such gap found: `GET /v1/posts`/`GET /v1/posts/:id` have existed, fully built and contract-verified, since Phase 1 — real cursor pagination, a real response shape, five real connectors now feeding it — and precisely zero frontend surface exists anywhere in `social-listening-admin` for either endpoint. For a product whose entire premise is social *listening*, this is the gap where none of the ingestion work built across this whole project has ever been visible to a human being through the UI.

**As a** tenant user or Tenant-Admin,
**I want** to see the posts my tenant's connected platforms have actually collected,
**so that** I can confirm ingestion is working and actually read what's been gathered, instead of only being able to infer it from a connector's health status.

**Acceptance Criteria**
- A `/tenant/posts` screen calls the real `GET /v1/posts` and renders each post: whatever title/text is derivable from `rawPayload` (heterogeneous per connector — GNews articles have `title`/`description`, Newswire/tenant-owned-feed items have `title`/`link`; a reasonable per-shape extraction with a raw-JSON fallback is acceptable v1 for connector shapes it doesn't specifically handle), `publishedAt`, and a provider badge derived from `rawPayload.providerId`.
- Pagination uses the real, opaque `nextCursor` ("load more"/"next page" only) — never a page-number control, never a client-constructed cursor value, per ADR-0011's own opaque-cursor contract.
- `enrichment` fields (sentiment, entities, keyPhrases), when present on a post, are shown — when absent (a connector that doesn't enrich, or enrichment not yet wired for that post), the screen shows no enrichment section rather than an empty/placeholder one.
- Selecting a post calls the real `GET /v1/posts/:id` and shows its fuller detail (adds `authorId`-derived context if resolvable, `acquisitionId` lineage) — 404s for an unknown/cross-tenant id are handled with a real "not found" state, not a crash.
- This story's own contract makes real behavioral assertions (a real or realistically mocked fetch, real pagination interaction) — per the same "string-containment checks are not sufficient" lesson Stories 6.4/6.5's corrections above name explicitly.

**Explicitly out of scope, named as real backend dependencies for a later story, not built here:** filtering by `watchlistId` or `platformId` — no such filter exists on `GET /v1/posts` yet (`posts-api/SKILL.md`'s own "Known gaps" already names this; the only place a watchlist and a post are even implicitly linked today is `SocialPostIngestedEvent.watchlistId`, a Service Bus message property, not a REST-queryable field, and that publishing path isn't wired into real ingestion yet either); full-text or date-range search; any change to `GET /v1/posts`'s own response shape.

**Also corrects, while touching this component's own SKILL.md:** `posts-api/SKILL.md`'s "Load-bearing constraints" section still describes `X-Tenant-Id` as the trust mechanism for these routes — stale since Story 5.10/ADR-0033 retired that header project-wide; confirmed directly (`postsRouter.ts` already calls `requireTenantUser()`) and corrected as part of whoever picks up this story, not a separate line item.

---

## Story 6.12 — Tenant-owned-feed connector setup UI

**Source:** ADR-0050 (Accepted) · **Status:** Ready — no new ADR needed, ADR-0050 already fully specifies the connect/verify flow; same precedent Story 6.3 used for the original connect/disconnect screen against ADR-0034's REST surface.
**Built:** 2026-08-13 — social-listening-admin@e1e9913

**Drafted 2026-08-12**, same cross-reference pass as Story 6.11 above. Closes a gap in work built the same day: the `tenant-owned-feed` connector (Story 2.11) has real `POST /v1/connectors/tenant-owned-feed/connect` and `POST /v1/connectors/tenant-owned-feed/verify-domain` endpoints, but no tenant can reach them — confirmed directly, zero references to `tenant-owned-feed` anywhere in `social-listening-admin`. Story 6.3's existing connect screen structurally cannot absorb this connector as a simple platform-list addition: its `ConnectForm`/`DisconnectButton` components assume a single-field (or JSON-encoded multi-field) credential submission, not a two-step domain+feedUrl-then-DNS-TXT-verification flow with its own `pending`/`verified` state.

**As a** tenant wanting to monitor my own company's blog or newsroom feed,
**I want** a setup flow that walks me through proving domain ownership and then activates polling,
**so that** I can actually use the tenant-owned-feed connector this project built, not just know it exists in the backend.

**Acceptance Criteria**
- A dedicated connect flow (a new screen or a clearly distinct section of the connectors screen — not shoehorned into Story 6.3's existing single-credential `ConnectForm`) offers a form for `domain` and `feedUrl`, calling the real `POST /connect`.
- On success, the returned `txtRecordHost`, `txtRecordValue`, and `expiresAt` are displayed clearly as literal instructions to publish at the tenant's own DNS registrar — plain-language copy that this can take anywhere from minutes to 72 hours to propagate (matching ADR-0050's own Context research), not framed as an error or a stuck state.
- A re-clickable "Verify now" button calls the real `POST /verify-domain`: a `pending` response is shown as "not yet verified, DNS propagation can take a while — try again shortly," never a hard failure; a `verified` response transitions the screen to an active/connected state.
- The activation's `connectorActivationId` persists across the pending state (e.g. in the URL or component state) so a tenant can navigate away and come back to re-click "Verify now" without restarting the whole connect flow.
- This story's own contract makes real behavioral assertions, not source-string checks — same standard as every other story in this drafting pass.

**Explicitly out of scope:** automatic background re-check polling (the backend's own 1-minute-then-15-minute re-check cadence, ADR-0050's own implementation default, is documented as an Admin UI concern, not server-enforced — a manual, re-clickable verify button is sufficient for v1, and this project has no background-job infrastructure to run one anyway); multi-domain/multi-feed management UI (ADR-0050's own Open Question 2, deliberately unresolved — this story's v1 is one domain, one feed, matching the backend's own v1 scope exactly).

**Built 2026-08-13.** A dedicated `/tenant/connectors/tenant-owned-feed` screen (not folded into Story 6.3's `PLATFORMS`/`ConnectForm`), linked from the main connectors page. `core-client.ts` gains `connectTenantOwnedFeed()`/`verifyTenantOwnedFeedDomain()` calling the real `POST /v1/connectors/tenant-owned-feed/connect` and `.../verify-domain` (Story 2.11, ADR-0050), proxied through two new same-origin routes, keeping `core-client.ts` the sole Bearer-attachment choke point. `TenantOwnedFeedSetup.tsx` (Client Component) runs the real state machine: a domain/feedUrl form → on a real `201`, renders the returned `txtRecordHost`/`txtRecordValue`/`expiresAt` as plain DNS-publish instructions with real "up to 72 hours" propagation copy (never under an error/alert role) → a re-clickable "Verify now" button that treats a `pending` response as retry-later copy, never a hard failure, and a `verified` response as a real active/connected state. `connectorActivationId` persists via a `?activationId=` URL search param (`page.tsx` reads it back on the next render) — the pending "Verify now" branch is driven by `activationId` alone, not the fuller `activation` object, so a tenant returning after a reload can still re-verify without restarting the whole connect flow (a real, named gap: the TXT instructions themselves are not re-fetchable after a reload, since no `GET`-by-id endpoint exists yet — see this component's own SKILL.md). New contract: `contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts` (21/21). Full `social-listening-admin` suite after: 16/16 suites, 261/261 tests passing. See `docs/implementation-log.md`.

---

## Story 6.13 — Self-service tenant deletion/offboarding UI

**Source:** ADR-0043 (Accepted) · **Status:** Ready — no new ADR needed, ADR-0043 already fully specifies the request/export/grace-period/cancel/confirm flow; same "ordinary CRUD/UI surface against an already-real REST surface" precedent as Story 6.3.
**Built:** 2026-08-13 — social-listening-admin@500a4b9

**Drafted 2026-08-12**, from a second, exhaustive cross-reference pass (every mounted `/v1` router against every `core-client.ts` function, not sampling) requested by Menno after the first drafting pass found Stories 6.4/6.5/6.6's fixture-data problem. Found the single largest remaining gap: `POST /v1/tenants/self-service-deletion/request`, `POST .../export`, `DELETE /v1/tenants/self-service-deletion` (cancel), and `POST .../confirm` (Story 3.8, the full request → export → 30-day-grace-period → cancel-or-confirm → irreversible-async-delete flow) are real, contract-verified, and completely absent from `social-listening-admin` — zero references anywhere in the repo. A Tenant-Admin who wants to offboard their own tenant today has no way to do it except calling the REST API directly, for a flow whose final step is genuinely irreversible.

**As a** Tenant-Admin,
**I want** to request, review, and either cancel or confirm deletion of my own tenant through the admin UI,
**so that** I can actually exercise the self-service offboarding this project already built, without needing to script REST calls for an irreversible action.

**Acceptance Criteria**
- A `/tenant/settings/delete` (or similarly placed, clearly-separated) screen, visible only to `tenant_admin` resolved identities (Story 6.2's role-gating) — `tenant_user` sessions never see an entry point to this flow.
- A **request** control calls the real `POST /request`; on success, displays the returned `graceEndsAt` plainly ("your tenant will be deleted on/after `<date>` unless you cancel") — not framed as immediate. A `409` (a request is already active) is shown as the real current state, not a generic error.
- An **export** control (available once a request is active) calls the real `POST /export`, offering both the JSON and CSV (`{"format":"csv"}`) forms named in the endpoint's own contract; re-triggerable any number of times before confirmation, matching the backend's own "not a one-shot" design.
- A **cancel** control calls the real `DELETE /v1/tenants/self-service-deletion` behind an explicit confirm step of its own (distinct from the request/confirm steps below) — available any time between request and confirmation; once cancelled, the screen returns to its normal, no-pending-deletion state.
- A **confirm** control is only enabled once `graceEndsAt` has genuinely passed — calling it before that (a `409 grace_period_not_elapsed`, which the backend returns with the real remaining `graceEndsAt`) is prevented client-side where possible, but the UI must also handle the backend still rejecting it (clock skew, a stale render) rather than assuming client-side timing is authoritative. Confirming requires its own explicit, high-friction confirm step — this is the one irreversible action in this entire admin UI, and the copy must say so plainly (final, cannot be undone, all tenant data including posts/watchlists/credentials will be permanently deleted).
- After a successful confirm (`202`, `status: 'deleting'`), the screen reflects that deletion is now in progress and asynchronous — it does not imply the tenant is already gone, and does not attempt to poll for completion (no such status-check endpoint exists; the tenant's own session will simply stop working once deletion actually completes, which this story does not need to specially detect).
- This story's own contract makes real behavioral assertions for every control (a real or realistically mocked fetch proving each button calls its named endpoint with the right method/body) — not source-string checks, same standard as every other story in this drafting pass.

**Explicitly out of scope:** any UI for Platform Admin to see or influence a tenant's own deletion request beyond what the audit log (Story 6.6) already shows — ADR-0043's own decision is that Platform Admin only ever sees the audit trail, never interferes; polling/notifying when the async deletion job actually completes (no backend signal exists for this today).

**Built 2026-08-13.** A dedicated `/tenant/settings/delete` screen, gated on `tenant_admin` specifically (redirects a `tenant_user` session to `/tenant/settings`, and a `platform_admin` session to `/`, rather than only hiding a control). `core-client.ts` gains `requestTenantSelfServiceDeletion()`/`requestTenantSelfServiceExport()`/`cancelTenantSelfServiceDeletion()`/`confirmTenantSelfServiceDeletion()` calling the real `POST /v1/tenants/self-service-deletion/request`/`.../export`/`DELETE /v1/tenants/self-service-deletion`/`.../confirm` (Story 3.8, ADR-0043), proxied through four new same-origin routes, keeping `core-client.ts` the sole Bearer-attachment choke point. `TenantDeletionPanel.tsx` (Client Component) runs the real state machine: "Request deletion" → on a real `202`, shows `graceEndsAt` plainly ("unless you cancel before then"); a `409` (already active) shows the real current state rather than a generic error — a real, named gap, since that `409`'s body carries no `graceEndsAt`, so the panel's own client-side grace-period gate is skipped (never falsely enabled or disabled) when the value is unknown, deferring to the backend's own real `409 grace_period_not_elapsed` enforcement. Export offers both JSON and CSV, re-triggerable any number of times, downloaded via a client-side `Blob`. Cancel and confirm each get their own separate two-click pending-confirm sub-state (never a shared one, and never a native `window.confirm()`) — confirm's own copy is deliberately higher-friction, stating plainly that the action is final and cannot be undone, since this is the one truly irreversible action in this entire admin UI. A successful `202` confirm shows a static "deletion in progress" state and never polls, since no completion-status endpoint exists. **A real cross-component regression was found and healed via `heal-contract-failure` during this same build:** an initial version added a `tenant_admin`-only "Delete this tenant" link to the shared `/tenant/settings` screen, which broke Story 6.9's own sealed contract (that story's AC2 explicitly requires "no additional role gate" on that screen) — reverted in full, restoring that file exactly. `/tenant/settings/delete` therefore has no in-app link anywhere today, reachable only by direct navigation — a real, named gap (this app has no shared nav shell to add one to without touching Story 6.9's own screen), documented in this component's own SKILL.md rather than silently worked around. New contract: `contracts/epic-6/story-6.13.tenant-deletion-offboarding.contract.test.ts` (36/36, real fetch-mocked assertions per control, per this story's own AC7). Full `social-listening-admin` suite after: 17/17 suites, 287/287 tests passing. See `docs/implementation-log.md`.

---

## Story 6.14 — Access-history view (extends Story 6.8's user management screen)

**Source:** ADR-0032 §9 (Accepted), against Story 5.17's real REST surface · **Status:** Built 2026-08-17 — no new ADR needed. Already named as a real, deliberate gap in Story 6.8's own text ("a natural companion, not required by this story's own Acceptance Criteria to ship in the same pass") and its own 2026-08-10 build note ("remains unbuilt, per this story's own named scope limit") — this story closes that named gap, it doesn't discover a new one.
**Built:** 2026-08-17 — social-listening-admin@a27aa10

**Drafted 2026-08-12**, same exhaustive sweep as Story 6.13 above. `GET /v1/tenants/users/:id/access-history` (Story 5.17) is real, `tenant_admin`-scoped, RLS-filtered, and has no frontend caller anywhere.

**As a** Tenant-Admin,
**I want** to see the history of `access_ends_at` changes for a given user in my tenant,
**so that** I can audit who changed a colleague's access and when, not just the user's current state.

**Acceptance Criteria**
- Extends Story 6.8's own `/tenant/users` screen (per-user, not a separate top-level route) — e.g. an expandable section or a per-row "view access history" action, consistent with Story 6.10's own precedent of one story legitimately touching another's already-shipped files when the extension is real and named.
- Calls the real `GET /v1/tenants/users/:id/access-history`, rendering each entry's `operation`, `oldValue`/`newValue`, `occurredAt`, and `actorUserId` (resolved to the acting user's own email/display where feasible — a raw UUID alone is not sufficient to answer "who did this").
- Visible only to `tenant_admin` resolved identities, matching the endpoint's own role restriction — not rendered at all for a `tenant_user` session (the same "in-page gate, not a whole-route redirect" pattern Story 6.8's own AC2 already established, per that story's own SKILL.md distinguishing it from Story 6.10's stricter whole-page gate).
- Story 6.8's own existing, already-passing contract continues to pass unmodified — this is an additive extension, not a rework.
- This story's own new assertions make real behavioral checks (a real or realistically mocked fetch), not source-string checks.

---

## Story 6.15 — Activate/deactivate controls on the connectors and connector-status screens

**Source:** ADR-0051 (Accepted 2026-08-12) · **Status:** Ready — no new ADR needed, the same "ordinary UI/CRUD surface" category Stories 6.3/6.4/6.5 already established. Depends on Story 1.11 (`POST .../activate|deactivate`, built) and **Story 1.12** (`GET /v1/connectors/:platformId` returning real `isActive`, Ready but not yet built as of this drafting) — this story cannot correctly render current activation state on page load until Story 1.12 ships; it can be built and its own contract written against Story 1.12's not-yet-existing field in the meantime, the same "contract written, implementation waits on a named dependency" sequencing Story 1.9 already used for Story 5.17.
**Built:** 2026-08-12 — social-listening-admin@cc7cae2

**Drafted 2026-08-12, at Menno's own direct request**, alongside Stories 1.12 and 2.12, closing out the three named "deliberately out of scope" items from Story 1.11's own text that are ready to be storied now (the fourth, live credential validation, and the fifth, auto-deactivation, are not — see this session's own separate note on why).

**As a** Tenant-Admin or tenant user,
**I want** to turn a connector on or off directly from the screens where I already manage it,
**so that** pausing a connector — instead of disconnecting it and losing the credential — is something I can actually do, not just something the API supports.

**Acceptance Criteria**
- `core-client.ts` gains `activatePlatform(platformId, ownerType)` / `deactivatePlatform(platformId, ownerType, userId?)`, mirroring `connectPlatform()`/`disconnectPlatform()`'s own raw `{status, body}` outcome pattern (a `403`/`400` here is a real, expected outcome the UI must react to, not an exception) — and a new `/api/connectors/[platformId]/activate/route.ts` / `.../deactivate/route.ts` pair, mirroring the existing `.../connect`/`.../disconnect` proxy routes exactly.
- `getConnectorStatus()`'s return type gains `isActive: boolean` (Story 1.12's new field) — both `tenant/connectors/page.tsx` (Story 6.3) and `tenant/connectors/status/page.tsx` (Story 6.5) read it instead of inferring "active" purely from `credentialStatus !== null` / `authMode === 'none'`, closing the actual UI-visible instance of the bug ADR-0051 was drafted to fix: Newswire is no longer hardcoded "Active (no credential required)" — it renders Inactive until a Tenant-Admin explicitly activates it.
- A new `ActivateDeactivateButton.tsx` (client component, mirroring `DisconnectButton.tsx`'s own two-click-confirm pattern for deactivate specifically — deactivating a tenant-wide connector on someone else's behalf, or any connector at all, deserves the same "are you sure" step disconnect already gets; a plain single-click toggle is sufficient for activate, which is non-destructive) is rendered on both screens, for every platform (`authMode: 'api_key'` and `authMode: 'none'` alike) — not gated behind `connected`/credential presence the way `ConnectForm`/`DisconnectButton` are, since activation is now explicitly independent of credential state.
- `ownerType: 'user'` activate/deactivate controls are rendered only for platforms whose `authMode` is not `'none'` (mirrors Story 6.3's existing `ConnectForm` exclusion for `authMode: 'none'` platforms) — the UI never offers a control the backend would `400`.
- A `tenant_user` (non-admin) sees only their own personal (`ownerType: 'user'`) activate/deactivate control; a `tenant_admin` sees both the tenant-wide control and their own personal one, mirroring `ConnectForm`'s existing `allowTenantWide` gate exactly.
- Deactivating a connector never removes or hides its `ConnectForm`/`DisconnectButton` — the credential-management controls and the activation control are visibly distinct actions on the page, not a single combined toggle, per ADR-0051 Decision §3's own "not two names for the same operation" requirement.
- `story-6.2.resolved-identity-migration-ripple.contract.test.ts`'s own existing blocks for both pages are re-verified against the new markup — extended if the new controls' presence changes what those blocks assert on, per this file's own established precedent for exactly this kind of ripple.

**Explicitly out of scope:** any visual redesign of either screen beyond adding the new controls; a combined/merged "connector settings" view unifying connect/disconnect/activate/deactivate into one control (ADR-0051 Decision §3 explicitly wants them visually distinct, not merged); surfacing `GET /v1/connectors/:platformId`'s activation-vs-health combination in any way Story 1.12 doesn't already provide.

---

**A note on why the other two "deliberately out of scope" items from Story 1.11 are not drafted as stories here, added 2026-08-12:**

- **Live credential validation** — ADR-0051 Open Question 2 explicitly names this as needing its own cost/value tradeoff weighed first (confirmed: none of the four real connectors has an existing lightweight validation call; a real one means new, real, cost-incurring provider API calls — Azure OpenAI's per-invocation billing specifically). This project's own "1.2.3.4 all require an ADR to be drafted first" discipline (established earlier this same session, for the connector-activation work itself) applies here too: this is a genuine new architectural decision with a real cost consequence, not ordinary CRUD/UI surface work. Drafting a story ahead of that ADR would be building ahead of a decision that hasn't been made, not just ahead of a demonstrated need.
- **System-driven auto-deactivation** — ADR-0051 Open Question 1 explicitly says this should be revisited "only once both [a scheduler and real quota-consumption tracking] exist" — confirmed directly, again, that neither exists anywhere in this project today. This is ADR-0028's own "not yet buildable — deferred to a later ADR's own story" category (`docs/user-stories/README.md`'s own No-story ADR convention, footnote-cited precedent), not a story that can be meaningfully written yet: there is no scheduler for an auto-deactivation policy to hook into, and no quota-tracking mechanism for it to trigger against. Drafting Acceptance Criteria now would mean inventing both prerequisites speculatively inside this story, which is exactly the kind of "designing an automatic disable path prematurely" ADR-0051 Decision §7 itself warned against — the same MSE-repeat risk this whole ADR exists to avoid.

**Explicitly out of scope:** access-history for the Tenant-Admin's own account (the endpoint itself has no special case for this — if it's needed, it's already covered structurally, just not called out as its own AC); any change to `access_ends_at`'s own write path (Story 1.9, unaffected).

**Built 2026-08-12.** `core-client.ts` gains `activatePlatform()`/`deactivatePlatform()` and `ConnectorStatus.isActive`; new proxy routes `/api/connectors/[platformId]/activate|deactivate/route.ts`, mirroring `connect`/`disconnect` exactly; new `ActivateDeactivateButton.tsx` (client component, single-click activate, two-click-confirm deactivate mirroring `DisconnectButton`), rendered on both `tenant/connectors/page.tsx` and `tenant/connectors/status/page.tsx` for every platform — tenant-wide gated on `tenant_admin`, personal gated on `authMode !== 'none'`. Both pages' Active/Inactive derivation now reads real `isActive` (Story 1.12), replacing the old `credentialStatus !== null` / `authMode === 'none'` inference — closing the actual UI-visible instance of the Newswire-always-active bug ADR-0051 was drafted to fix. **A real, necessary limitation named, not silently glossed over:** `GET /v1/connectors/:platformId` only exposes tenant-wide `isActive` (Story 1.12's own named scope limit) — the personal `ActivateDeactivateButton` on both screens always starts from an assumed `isActive={false}`, not a real per-user read, since none exists yet. **Story 6.5's own already-passing contract needed a real, deliberate rewrite, not an addition:** its assertion that Newswire "always renders Active, regardless of credentialStatus" was correct under the pre-ADR-0051 model and is now the opposite of correct — rewritten with a dated note per this project's "regression, not rewrite" convention, alongside two other structural assertions renamed from `connected`/`!connected` to `isActive`/`!isActive`. See `contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts` (13/13) and `docs/implementation-log.md`. Full `social-listening-admin` suite after: 13/13 suites, 197/197 tests passing.

---

## Story 6.16 — Manual "run enrichment now" button on the post detail screen

**Source:** Story 6.11's own post detail screen, against Story 2.8/2.9's already-built `enrichPost()` · **Status:** Built 2026-08-12 — no new ADR needed, exposes an already-real internal function over a new REST endpoint, the same "ordinary CRUD-adjacent surface, no new architectural decision" category `GET /v1/me` and Story 1.12 already established.
**Built:** 2026-08-12 — social-listening-admin@21da4f5 (core half: social-listening-core@51a2b40)

**Drafted 2026-08-12, requested directly by Menno while manually testing Story 6.11's post detail screen** — real posts ingested before either AI provider had a stored credential permanently show `enrichment: null` (confirmed directly: `enrichPost()` is only ever called inline during ingestion, nothing re-processes an already-stored post). Menno asked for a button, not a one-off backfill script, so this is real, reusable, ordinary product surface, not a throwaway fix.

**As a** tenant user or Tenant-Admin viewing a post with no enrichment,
**I want** a button that runs enrichment for that specific post right now,
**so that** a post ingested before an AI provider was connected doesn't stay permanently unenriched.

**Acceptance Criteria**
- A new `POST /v1/posts/:id/enrich` (tenant-scoped via `requireTenantUser()`, same pattern as every other `/v1/posts` route) derives the post's enrichment text the same way its own connector's ingest function already does (GNews: `[title, description].filter(Boolean).join('. ')`; Newswire/tenant-owned-feed: `title`) from the post's real, stored `rawPayload` — no new/different text-derivation rule invented for this endpoint.
- Calls the real, already-built `enrichPost(tenantId, text)` (Story 2.8/2.9, unchanged) and persists a non-`undefined` result onto the post's own `enrichment` column; a 404 for an unknown/cross-tenant id (RLS), matching `GET /v1/posts/:id`'s own existing behavior.
- `enrichPost()` returning `undefined` (no AI provider currently credentialed and active) is a real, honest, non-error outcome — the endpoint responds `200` with the post's `enrichment` still `null`, not a failure the caller must treat as exceptional; the button must distinguish "ran, nothing enriched it" from "ran, here's the result."
- The post detail screen (`/tenant/posts/:id`) shows the button only when `post.enrichment` is currently `null` — never offered for an already-enriched post (no "re-enrich" semantics, this story's own scope is filling a real gap, not overwriting existing data).
- On success with a real result, the screen re-renders with the new enrichment shown, same layout Story 6.11 already established (sentiment/key phrases/entities/`modelUsed`); on a "ran, nothing enriched it" response, a clear, specific message is shown (e.g. "No AI provider is currently connected and active for this tenant") — not a generic error.

**Explicitly out of scope:** re-enrichment of an already-enriched post (overwriting a real, prior result); a bulk/tenant-wide backfill of every unenriched post (this is a real, separate feature — a background job or bulk endpoint — not requested here); any change to `enrichPost()`, `PROVIDERS`, or the activation-gating logic itself (Story 2.9's own already-built, already-correct behavior).

**Built 2026-08-12.** `social-listening-core` gains `POST /v1/posts/:id/enrich` (`postsRouter.ts`, extended `socialPostStore.ts` — `deriveEnrichmentText()`, `setPostEnrichment()`) — derives enrichment text by the same rule every real connector's own ingest function already applies inline (`title`, plus `description` when present; one rule covers both real shapes without a `providerId` branch), calls the real, unmodified `enrichPost()`, persists a real result, 404s the same way `GET /v1/posts/:id` does, and returns a real `200` with `enrichment: null` (not an error) when no AI provider is currently connected and active. `social-listening-admin` gains `runPostEnrichment()` in `core-client.ts`, a same-origin proxy route (`/api/posts/[id]/enrich/route.ts`), and a new `RunEnrichmentButton.tsx` (Client Component, mirrors `ActivateDeactivateButton.tsx`'s own raw `{status, body}` pattern) rendered on `/tenant/posts/:id` only when `post.enrichment` is currently `null`. New contracts: `social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts` (5/5, real Azure AI Language calls) and `social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts` (9/9). Full suites after: `social-listening-core` 403/408 passing (5 pre-existing, unrelated `GNews returned 403` failures — confirmed real free-tier quota exhaustion, not caused by this story); `social-listening-admin` 15/15 suites, 235/235 tests. See `docs/implementation-log.md` for both commits.

---

## Story 6.19 — Render the post detail body as real, formatted Markdown

**Source:** Story 3.10/ADR-0053's already-built `body_markdown` field, against Story 6.11's own post detail screen · **Status:** Ready — no new ADR needed, exposes an already-real, already-populated column over REST (`SocialPostSummary`/`SocialPostFull`, unmodified queries widened, not a new endpoint), the same "ordinary CRUD-adjacent surface, no new architectural decision" category Story 6.16 already established for this exact pair of screens.
**Built:** 2026-08-17 — social-listening-admin@4f099a6 (core half: social-listening-core@aa4f317)

**Requested directly by Menno** ("could you ensure the body that is presented in the UI is rendered to Markdown language? it now displays raw markdown"), found to be a real, confirmed gap on investigation, not a rendering-only bug: `social_posts.body_markdown` (Story 3.10, all three real connectors' `ingestX()` functions already populate it — clean prose, HTML stripped, converted via the canonical `htmlToMarkdown()` pipeline) has never been exposed by `GET /v1/posts`/`GET /v1/posts/:id` at all — confirmed directly against `socialPostStore.ts`'s `SocialPostSummary`/`SocialPostFull` interfaces and their own SQL queries, neither of which selects `body_markdown`. What the UI shows today is `rawPayload.description` — for Newswire/tenant-owned-feed, confirmed live to still contain raw, un-stripped HTML tags (`<p>...</p>`), rendered as literal escaped text since React never treats a string prop as HTML. No Markdown-rendering library exists anywhere in `social-listening-admin` today either — even once fetched, `body_markdown` would need real rendering, not just display.

**As a** tenant user or Tenant-Admin viewing a post's detail,
**I want** the ingested article body shown as real, formatted text — real headers, bold, lists, links — not raw HTML tags or unrendered Markdown syntax,
**so that** I can actually read the content the way it was meant to be read, not decode markup by eye.

**Acceptance Criteria**
- `SocialPostSummary`/`SocialPostFull` (`socialPostStore.ts`) gain `bodyMarkdown: string | null`, read from the already-populated `social_posts.body_markdown` column — the three existing queries (`queryFirstPage`, `queryAfterCursor`, `getSocialPostById`) widened to select it, no new query, no new endpoint, no migration.
- `social-listening-admin`'s own `SocialPostSummary` type (`core-client.ts`) gains the matching `bodyMarkdown` field — `SocialPostFull` inherits it automatically (`extends SocialPostSummary`).
- A real Markdown-rendering dependency is added (renders to real React elements, not `dangerouslySetInnerHTML` — no hand-rolled regex parsing, no raw-HTML injection risk) and used to render `post.bodyMarkdown` on both post-detail surfaces: `PostsFeedClient.tsx`'s Slideover ("Ingested Article Body") and the standalone `/tenant/posts/:id` route, real headers/bold/lists/links rendering as actual formatted HTML.
- A post with `bodyMarkdown: null` (ingested before Story 3.10 shipped, or a future connector that never populates it) falls back to the existing plain-text `snippet` display — never a blank body, never a crash.
- The post-card's own short teaser snippet (`PostsFeedClient.tsx`'s list view, not the detail view) is unaffected — this story only changes the fuller detail body, not the compact card preview.

**Explicitly out of scope:** any change to `htmlToMarkdown()`/Story 3.10's own conversion pipeline (already correct, already shipped) — this story only exposes and renders its existing output; any change to `rawPayload`/the card-list snippet extraction; a future connector that doesn't populate `bodyMarkdown` — the honest `null`-falls-back-to-snippet behavior already covers that case without a new decision.

**Dated correction, 2026-08-17, same day — AC5 above superseded.** Requested directly by Menno after using the `/tenant/posts` list view live: the card-list snippet's own out-of-scope status (AC5) meant it kept reading raw `rawPayload.description` unchanged, which for Newswire/tenant-owned-feed posts is un-stripped HTML (`<p>...</p>`) — the same class of defect this story already fixed on the detail view, just never propagated to the card. The card-list snippet now also prefers a bounded prefix of `bodyMarkdown` when present, flattened to plain text via `react-markdown`'s own `allowedElements={[]}`/`unwrapDisallowed` (a real parse-then-strip, not hand-rolled regex — same standard as AC3's rendering path), falling back to the original `rawPayload`-derived snippet when `bodyMarkdown` is `null`. Deliberately still flattened, not block-rendered, on the card: headings/lists would break the existing 3-line CSS clamp — full, block-formatted Markdown remains a Slideover/detail-route-only behavior. See `post-feed/SKILL.md`'s own matching dated entry and `story-6.19.post-body-markdown-rendering.contract.test.ts`'s own dated AC5 correction for the details.

---

## Story 6.17 — Tenant-wide activate/deactivate control on the tenant-owned-feed connector screen

**Source:** ADR-0051 (Accepted 2026-08-12), extending Story 6.15's own already-built wiring pattern to a screen Story 6.15 never covered · **Status:** Ready — no new ADR needed. This is not a new architectural decision: ADR-0051 already fully decided the two-table, ownership-scoped activation mechanism and its REST surface; ADR-0028/ADR-0034 already decided the `tenant_admin`-only authorization split for the tenant-wide scope. This story wires an already-decided, already-built, already-generic backend mechanism onto one more screen — the identical "expose/wire an already-decided policy over REST, no new decision" category Story 6.16's own text used to justify skipping a new ADR for `POST /v1/posts/:id/enrich`, and the category Story 6.15 itself already established for wiring the same mechanism onto the Story 6.3/6.5 screens.
**Built:** 2026-08-13 — social-listening-admin@d0eb088

**Drafted 2026-08-13, from a real, freshly-confirmed gap found by direct code inspection, not assumed from either story's own "Built" text.** `tenant-owned-feed` (ADR-0050, Story 2.11/6.12) has two entirely separate pieces of persisted state that nothing in this project has ever connected:

1. **Domain verification** — `tenant_owned_feed_activations.status = 'verified'` (`tenantOwnedFeedStore.ts`), set by `markVerified()`, itself only ever called from `POST /v1/connectors/tenant-owned-feed/verify-domain` (`tenantOwnedFeedRouter.ts`).
2. **Tenant-wide connector activation** — `connector_activations.is_active` (ADR-0051, Story 1.11) — the generic, ownership-scoped table every poll-mode connector is now gated on via `shouldAttemptIngestion()` (`connectorHealth.ts`), which Story 1.13/ADR-0052's new live-polling scheduler (`pollScheduler.ts`) calls, defaulting `ownerType: 'tenant'`, before ever invoking `tenantOwnedFeedConnector`'s registered `poll()`.

**Confirmed directly, not inferred, that nothing anywhere ever bridges these two:** `tenantOwnedFeedStore.ts`'s `markVerified()` runs one `UPDATE tenant_owned_feed_activations ...` and nothing else — no call into `setConnectorActivation()`, no reference to `connector_activations` anywhere in `tenantOwnedFeedRouter.ts` or `tenantOwnedFeedStore.ts`. `social-listening-admin/src/app/tenant/connectors/page.tsx`'s `PLATFORMS` array (the only place `ActivateDeactivateButton` — Story 6.15 — is rendered) lists exactly `gnews`, `newswire`, `azure-ai-language`, `azure-openai`; `tenant-owned-feed` was deliberately left out of that array by Story 6.12, because its two-step DNS-TXT flow doesn't fit `ConnectForm`'s single-credential shape — but nothing filled the resulting gap on the connector's *own* dedicated screen either. `social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/{page.tsx,TenantOwnedFeedSetup.tsx}` has zero references to `activate`, `deactivate`, or `isActive` anywhere. **Net effect, confirmed against the real code path the scheduler now actually runs (Story 1.13, built the same day this gap was found):** a tenant can DNS-verify any number of tenant-owned-feed domains, and `shouldAttemptIngestion(tenantId, 'tenant-owned-feed')` will still always return `false` — `isConnectorActive()` finds no `connector_activations` row at all for this `(tenantId, 'tenant-owned-feed')` pair, and ADR-0051 Decision §1's own lazy-creation rule reads "no row" identically to "explicitly deactivated." A real tenant with three DNS-verified feeds sees zero ingested posts from any of them, for a reason that has nothing to do with DNS, ADR-0050's own verification flow, or the Story 1.13 scheduler itself — all three are working exactly as designed.

**A related documentation-accuracy finding, named here rather than silently worked around:** ADR-0051's own Context section states, describing ADR-0050's connector, that "ADR-0050's own verification-state machine (pending/verified/expired/failed) already functions as a de facto activation gate for that connector" — read against the code above, this is not accurate for the shipped implementation: `markVerified()` never touches `connector_activations`, so domain verification and tenant-wide connector activation are two structurally independent signals with no code path connecting them, not one mechanism serving both purposes. This is a descriptive claim in ADR-0051's Context (not its Decision), so it doesn't block this story, but it's worth a dated correction note on ADR-0051 at some point — flagged here, not fixed by this story, since correcting ADR text is outside a drafting-only story's own scope and outside this persona's authority to accept.

**Also directly confirmed, this story needs zero backend changes.** `POST /v1/connectors/:platformId/activate` and `.../deactivate` (`connectorsRouter.ts`, Story 1.11) are already fully generic on the `:platformId` route parameter — no registry lookup, no hardcoded platform allow-list gates which `platformId` values may be activated; the only registry-dependent check (`authModeForbidsUserScope()`) applies solely to `ownerType: 'user'`, which this story doesn't use (see AC3). The `social-listening-admin` BFF proxy routes (`/api/connectors/[platformId]/activate|deactivate/route.ts`), `core-client.ts`'s `getConnectorStatus()`/`activatePlatform()`/`deactivatePlatform()`, and `ActivateDeactivateButton.tsx` itself (Story 6.15) are likewise already fully generic on `platformId` — none of them special-case or allow-list the four platforms Story 6.15 happened to render them for. This is a `social-listening-admin`-only story: reusing four already-shipped, already-contract-verified pieces on one more screen, not building anything new underneath them.

**As a** Tenant-Admin who has already DNS-verified one or more tenant-owned-feed domains,
**I want** to actually turn tenant-owned-feed polling on from the same screen where I set it up,
**so that** a verified domain doesn't sit silently un-ingested forever because activation is a separate, undiscoverable step on a different screen.

**Acceptance Criteria**
- `/tenant/connectors/tenant-owned-feed` (`TenantOwnedFeedPage`/`TenantOwnedFeedSetup.tsx`, Story 6.12) reads the connector's real current tenant-wide activation state via the already-existing `getConnectorStatus('tenant-owned-feed')` (Story 1.12's `isActive` field) on page load — no new `core-client.ts` function.
- Renders the already-existing `ActivateDeactivateButton` component (Story 6.15, unmodified) with `platformId="tenant-owned-feed"` and `ownerType="tenant"`, calling the already-existing `POST /v1/connectors/tenant-owned-feed/activate|deactivate` via the already-existing generic proxy routes and `activatePlatform()`/`deactivatePlatform()` — no new backend route, no new proxy route, no new `core-client.ts` function.
- **Gated `tenant_admin`-only for both activate and deactivate, mirroring the exact authorization split `connector-activation/SKILL.md` (`social-listening-core/.claude/skills/connector-activation/SKILL.md`) already documents for `ownerType: 'tenant'`** — ADR-0028 Tier 2/ADR-0034's own tenant-wide gate, the same split `ConnectorsPage`'s existing `isTenantAdmin` check (`identity?.type === 'tenant_user' && identity.role === 'tenant_admin'`) already implements; a `tenant_user` session must not see the control rendered at all on this screen (client-side, in addition to the backend's own real `403`). No offboarding-override asymmetry applies here (the asymmetry only exists for `ownerType: 'user'`'s activate-is-self-only vs. deactivate-is-self-or-`tenant_admin` split) — this connector has no personal/`user`-scoped activation at all (see next bullet), so only the tenant-wide, `tenant_admin`-only path is relevant.
- **No `ownerType: 'user'` control is offered on this screen** — `tenant-owned-feed` is `authMode: 'none'` with no personal/Tier-3 credential concept (ADR-0050 §2, confirmed: the connector has no per-user scope anywhere, and once Story 1.13's `bootstrapConnectors()` registers it, `authModeForbidsUserScope('tenant-owned-feed')` resolves `true` and the backend would `400` a `ownerType: 'user'` call) — mirrors Story 6.15 AC3's own `authMode === 'none'` exclusion exactly, never inventing a control the backend would reject.
- The screen's existing "Domain verified — this feed is now connected and active." copy (`TenantOwnedFeedSetup.tsx`, currently shown unconditionally once `verified === true`) is corrected to reflect real tenant-wide activation state, not domain-verification state alone — a verified-but-not-yet-active domain must say so plainly (e.g. "Domain verified. Activate this connector below to begin polling.") rather than falsely claiming the feed is already active, and the activate control from this story's own AC2 must be reachable from that same state, not only from the separate `/tenant/connectors` screen.
- This story's own contract makes real behavioral assertions (a real or realistically mocked fetch proving the rendered button calls `POST /v1/connectors/tenant-owned-feed/activate` or `.../deactivate` with `ownerType: 'tenant'`, and that a `tenant_user` session never renders the control) — not source-string checks, same standard as every other story in this drafting pass.
- No `story-6.2.resolved-identity-migration-ripple.contract.test.ts` block exists yet for the `tenant-owned-feed` screen (confirmed: Story 6.12 did not add one) — this story is not required to add one either, since it changes markup on a page that contract doesn't yet cover; named here as a pre-existing gap, not created or required to be closed by this story.

**Explicitly out of scope:** any change to per-domain verification state (`tenant_owned_feed_activations`, ADR-0050) — this story is only about the tenant-wide `connector_activations` switch, orthogonal to which domains are DNS-verified; multi-domain activation nuance (ADR-0050 Open Question 2 remains open — this story's single tenant-wide `is_active` flag covers/gates every verified domain for this tenant identically, the same all-or-nothing scope Story 6.15 already established for every other connector); correcting ADR-0051's own Context-section claim about ADR-0050 (named above, left for a separate dated-note pass, not this persona's authority to accept); any change to `pollTenantOwnedFeed()`, `shouldAttemptIngestion()`, or the Story 1.13 scheduler itself (all working exactly as designed — this story closes the missing *human action* that was never wired to trigger them, not a defect in any of the three).

---

## Story 6.18 — Post feed search/filter operates over all matched posts, not just the current page

**Source:** ADR-0011 (cursor pagination, Accepted) — no new ADR needed; `GET /v1/posts` itself is unchanged, this is purely a client-side data-fetching pattern change, the same "page through everything client-side, no new backend endpoint" shape ADR-0054 Decision §3 already established for the Analytics Dashboard (Story 8.1's `fetchAnalyticsSummary.ts`) · **Status:** Built 2026-08-17
**Built:** 2026-08-17 — social-listening-admin@a97cf30

**Context found while scoping this story, at Menno's own direct request:** `PostsFeedClient.tsx`'s search box and Provider/Sentiment/Watchlist filters (added during this session's earlier healing pass, not part of Story 6.11's own original Acceptance Criteria — that story explicitly named "filtering... full-text or date-range search" as out of scope, since no such filter exists on `GET /v1/posts` itself) operate entirely client-side over whatever `page.tsx` fetches — a single, default-sized page (20 posts) via `listPosts(cursor)`. The header text is honest about this today ("X of Y **on this page**... more pages available") but that's exactly the gap Menno flagged: search/filter only ever sees the current page, not the tenant's full matched post set.

**As a** Tenant User or Tenant-Admin,
**I want** the search box and Provider/Sentiment/Watchlist filters on `/tenant/posts` to search and filter across everything my tenant has ingested, not just the 20 most recent posts,
**so that** searching for an older post or a less-common provider/sentiment combination actually finds it, instead of silently missing anything not on the first page.

**Acceptance Criteria**
- `page.tsx` fetches the tenant's full post set via a real, paginated loop (reusing `listPosts(cursor, limit)`'s already-extended `limit` param, the identical `fetchAllPosts()`-shaped pattern `fetchAnalyticsSummary.ts` (Story 8.1) already established, including its `MAX_PAGES` defensive circuit breaker — not an approximation ceiling) — never a single-page fetch presented as if it were the whole set.
- `PostsFeedClient.tsx`'s existing search/filter logic is otherwise unchanged (same fields searched, same filter predicates) — this story widens what data it operates *over*, not how it matches.
- The server-round-trip `?cursor=` "Next page" link is replaced with a client-side "Show more" control revealing more of the already-fetched, already-filtered result set in batches (implementation's own reasonable batch size, e.g. 20) — never eagerly rendering thousands of post cards into the DOM at once just because they were all fetched upfront.
- The header count text is corrected to match the new reality — no more "on this page" / "more pages available" framing once the full set is loaded; reflects real total-matched vs. real total-fetched counts.
- Zero regressions to Story 6.11's own existing behavior (post detail Slideover, raw-JSON inspection, `RunEnrichmentButton`, empty states) — this story only changes the fetch/pagination shape feeding `PostsFeedClient`.

**Explicitly out of scope:** any change to `GET /v1/posts` itself or `social-listening-core` (matches ADR-0054 Decision §3's own precedent — no new query params, no server-side search); the client-side aggregation scale ceiling this pattern inherits (named, not resolved, the same way ADR-0054 Open Question 2 already named it for Analytics — a tenant with a very large post volume faces the same real cost); any new filter dimension beyond the four (search/Provider/Sentiment/Watchlist) already built.

---

## Story 6.20 — Multi-feed administration for the tenant-owned-feed connector (list, edit, remove)

**Source:** [ADR-0057](../adr/0057-tenant-owned-feed-multi-feed-administration.md), Accepted 2026-08-17 — resolves ADR-0050's own Open Question 2, left open since that ADR's 2026-08-11 acceptance · **Status:** Ready
**Built:** 2026-08-17 — social-listening-admin@be1764d (core half: social-listening-core@e9d797f)

**Requested directly by Menno** ("what needs to change to enable the feeds to be administered?", then "let's build the new ADR"). The storage/polling layers already supported multiple feeds per tenant (`tenant_owned_feed_activations` has no uniqueness constraint; `getVerifiedActivations()`/`pollTenantOwnedFeed()` already iterate every verified row) — but nothing above them exposed it: `tenantOwnedFeedRouter.ts` had exactly two routes (`connect`, `verify-domain`), and `TenantOwnedFeedSetup.tsx` was a single-activation state machine with no path to a second feed once one was verified.

**As a** Tenant-Admin who wants to monitor more than one of my own domains/feeds,
**I want** to see, add, edit, and remove every feed I've configured, not just the one I set up first,
**so that** I'm not limited to a single tenant-owned feed for lack of any way to reach a second one through the product.

**Acceptance Criteria**
- `GET /v1/connectors/tenant-owned-feed/activations` (new, `tenant_admin` only) lists every activation for the caller's tenant regardless of status (`pending`/`verified`/`expired`/`removed`): `{ id, domain, feedUrl, status, txtRecordHost, txtRecordValue, tokenExpiresAt, verifiedAt, createdAt }`. `txtRecordValue` is recomputed via the already-existing `expectedTxtRecordValue()`, never separately persisted.
- `PATCH /v1/connectors/tenant-owned-feed/:id` (new, `tenant_admin` only) accepts `{ feedUrl }` only — a request that includes `domain` is a `400`. Editable regardless of the activation's current status (`pending` or `verified`).
- `DELETE /v1/connectors/tenant-owned-feed/:id` (new, `tenant_admin` only) is a soft removal — transitions `status` to a new `'removed'` value (migration widens the existing `CHECK` constraint via `DROP CONSTRAINT`/`ADD CONSTRAINT`, since PostgreSQL cannot alter a `CHECK` constraint in place; no new `GRANT` needed). `getVerifiedActivations()` already filters on `status = 'verified'`, so a removed row stops being polled with zero poller change. Already-ingested `SocialPost`/`Author` rows are never touched.
- `connect` and `verify-domain` both gain the same `tenant_admin` role check every other tenant-wide connector action in this codebase already uses (they previously had none) — a `tenant_user` calling either now receives `403`.
- `connect` auto-verifies a new activation server-side, skipping DNS TXT verification entirely, when the caller's tenant already holds a `status = 'verified'` activation for the same `domain` — domain ownership doesn't need re-proving per feed URL. Two feeds under one already-verified domain is explicitly a supported, intended shape.
- `tenantOwnedFeedStore.ts` gains `listActivations(tenantId)`, `updateFeedUrl(tenantId, id, feedUrl)`, `removeActivation(tenantId, id)` — each `withTenant()`-scoped like every existing function in this file.
- Admin UI: `TenantOwnedFeedSetup.tsx`'s single-activation state machine is replaced by a real per-tenant feed list (domain, feed URL, status, verified/expiry date), with per-row actions — "Verify now" (`pending` only), "Edit feed URL" (any status), "Remove" (any status, behind a `ConfirmModal`, per Design Spec §2's "Confirmed irreversibility" principle) — plus a persistent "Connect another feed" action reusing the existing connect → publish-TXT-record → verify flow unconditionally, never gated on "only if none exist yet."
- The list screen visually distinguishes per-feed verification status from the separate, tenant-wide `ActivateDeactivateButton` (ADR-0051) state — a tenant must be able to tell, without guessing, that a verified feed still isn't being polled while the connector-wide switch is off.

**Explicitly out of scope:** any cap on feed count per tenant (left unbounded, ADR-0057's own named Open Question); a scheduled cleanup job for stale `pending` or `removed` rows (pre-existing gap, not closed by this story); a token-regenerate/retry endpoint for an expired `pending` activation (remove-and-reconnect is the sanctioned path); Platform-Admin cross-tenant feed visibility (a real, separate gap ADR-0057 named as a candidate future ADR, not this story's scope); any change to Newswire's own hardcoded, non-tenant-configurable feed set.

---

## Story 6.21 — Expose the Wikipedia connector in the Tenant Admin UI

**Source:** Story 2.13's own real, generic `POST/DELETE /v1/connectors/:platformId/activate|deactivate` surface (ADR-0051), against a connector that already exists (`wikipedia`, `authMode: 'none'`) · **Status:** Built 2026-08-18 · **Built:** 2026-08-18 — social-listening-admin@21c30bf — no new ADR needed, the same "ordinary UI/CRUD surface, exposes an already-built, already-generic mechanism" category Stories 6.15/6.16/6.18/6.19/6.20 already established.

**Drafted and requested directly by Menno, 2026-08-17/18, immediately after Story 2.13 (Wikipedia connector) was built** — confirmed directly, not assumed: `tenant/connectors/page.tsx`'s and `tenant/connectors/status/page.tsx`'s own hand-curated `PLATFORMS` arrays (Stories 6.3/6.5/6.15) list `gnews`/`newswire`/`azure-ai-language`/`azure-openai` only. Neither array has a `wikipedia` entry, so a Tenant-Admin has no way to see the connector exists or activate it — even though the backend's own connect/activate/deactivate REST surface is already fully generic on `platformId` (ADR-0051) and needs no change at all. This is the exact, already-named limitation both components' own SKILL.mds state plainly: "there is no 'list all registered connectors' backend endpoint... a new core connector must be added here by hand."

**As a** Tenant-Admin,
**I want** to see Wikipedia listed alongside my other connectors and be able to activate it,
**so that** a connector that's real and fully built on the backend isn't invisible in the product.

**Acceptance Criteria**
- `tenant/connectors/page.tsx`'s `PLATFORMS` array gains a `wikipedia` entry: `authMode: 'none'`, `credentialFields: []`, `personalScopeAllowed: false` — the identical shape Newswire's own entry already uses, since both are public, no-account, tenant-wide-only connectors.
- Because Wikipedia will render on the same screen as the four existing connectors, it needs its own visually distinct `icon`/`color` pair, not a reused one — reusing `globe`/`blue` (GNews's own pair) would make the two connectors indistinguishable at a glance on the same list. `PlatformDef['icon']`/`['color']` (`ConnectorsClient.tsx`) each gain one new value (an encyclopedia/book glyph, a fifth distinct color), with matching CSS added to `globals.css` following the existing `cv-platform-icon-<color>`/`cv-card-subtitle-<color>` pattern exactly (background/border/text triple, same pastel style as the existing four).
- `tenant/connectors/status/page.tsx`'s own separately-duplicated `PLATFORMS` array (no icon/color fields — a plainer shape) also gains a `wikipedia` entry: `authMode: 'none'`, `category: 'Ingestion'`, `personalScopeAllowed: false`.
- Both screens' existing, already-generic rendering logic — `ActivateDeactivateButton` (tenant-wide only, since `authMode: 'none'` and `personalScopeAllowed: false`), `StatusBadge`, real `getConnectorStatus('wikipedia')` calls — require zero further change; adding the `PLATFORMS` entries alone is sufficient, per both components' own "adding a fifth platform" extension-point documentation.
- Both components' own SKILL.mds are updated to note this is now a fifth, not fourth, connector, and that a new icon/color pair was needed (a real, small exception to the previously-documented "no other file needs to change" claim, which held for four same-shaped credentialed/no-credential connectors but not for one needing its own visual identity).

**Explicitly out of scope:** any change to `core-client.ts`, the connect/disconnect/activate/deactivate REST endpoints, or `social-listening-core` at all (Story 2.13's own backend work is already complete and fully generic); a "list all registered connectors" backend endpoint closing the manually-maintained-`PLATFORMS` gap for good (both SKILL.mds' own already-named, not-yet-built future fix, unaffected by this story); any credential form for Wikipedia (`authMode: 'none'`, same as Newswire — nothing to submit).

---

## Story 6.22 — Add Wikipedia to the watchlist screen's platform-source list

**Source:** Story 2.13's own real, generic `SocialConnector` (`wikipedia`, `authMode: 'none'`) · **Status:** Built 2026-08-18 · **Built:** 2026-08-18 — social-listening-admin@8182706 — no new ADR needed, the same "ordinary UI/CRUD surface, exposes an already-built, already-generic mechanism" category Story 6.21 already established for this exact connector on a different screen.

**Drafted and requested directly by Menno, 2026-08-18, immediately after Story 2.14 (Wikipedia watchlist-driven discovery) shipped** — Menno activated the connector, tried to point a watchlist at it, and found Wikipedia isn't offered as a platform source when creating or editing a watchlist at all. Confirmed directly against the real code, not assumed: `tenant/watchlists/page.tsx`'s own `SOCIAL_PLATFORMS` constant — a separate, independently-maintained hardcoded list from `tenant/connectors/page.tsx`'s `PLATFORMS` array (`watchlist-management/SKILL.md`'s own "Governing decisions" section names this as deliberate — a watchlist can only legitimately target real `SocialConnector` platforms, not AI enrichment providers) — still reads `[{ id: 'gnews', ... }, { id: 'newswire', ... }]` only. It was correct when Story 6.4 was rebuilt (2026-08-12), the day before Wikipedia (Story 2.13, built 2026-08-17) existed as a real `SocialConnector` at all — nobody has updated it since, so Story 2.14's own new watchlist-driven discovery (which depends entirely on a tenant being able to create a `wikipedia`-targeted watchlist) has no way to be exercised from the UI.

**As a** tenant who wants to track a Wikipedia article,
**I want** Wikipedia offered as a platform source when creating or editing a watchlist,
**so that** I can actually point a watchlist at it — Story 2.14's own backend discovery logic has nothing to search for until I can.

**Acceptance Criteria**
- `tenant/watchlists/page.tsx`'s `SOCIAL_PLATFORMS` constant gains a `{ id: 'wikipedia', name: 'Wikipedia', authMode: 'none' }` entry — the identical shape Newswire's own entry already uses, since both are public, no-account connectors treated as always "connected" (`loadConnectedPlatforms()`'s existing `authMode === 'none'` branch, unmodified).
- Creating a new watchlist shows a selectable "Wikipedia" row in the Ingestion Platform Sources list (`WatchlistForm.tsx`'s own existing, already-generic `connectedPlatforms.map()` rendering) — no change to `WatchlistForm.tsx` itself required, proven by confirming it needs none.
- An existing watchlist with `platformIds` including `'wikipedia'` displays "Wikipedia" (not the raw id) in `WatchlistRow.tsx`'s platform summary — its existing `connectedPlatforms.find(...) ?? id` fallback already handles this once the entry exists in `connectedPlatforms`, proven by confirming no change to `WatchlistRow.tsx` itself is required either.
- `watchlist-management/SKILL.md` is updated to note Wikipedia as a third real `SocialConnector` platform now offered here, and that this list is independently maintained from `tenant/connectors/page.tsx`'s own `PLATFORMS` array — a second place a new real `SocialConnector` must be added by hand, not automatically picked up.

**Explicitly out of scope:** `tenant-owned-feed` (Story 2.11, also a real `SocialConnector` missing from this same `SOCIAL_PLATFORMS` list) — its "connected" state is per-domain/multi-feed (Story 6.20), not the simple credential-or-none boolean `loadConnectedPlatforms()` already handles for `gnews`/`newswire`/`wikipedia`, so folding it in here would be a materially different, undesigned change; named as a separate, real, still-open gap, not solved by this story. A generic "derive this list from the real connector registry instead of a hand-maintained array" fix — the same future improvement both `tenant/connectors/*` SKILL.mds already name for their own `PLATFORMS` arrays — is also not this story's scope.

---

## Story 6.23 — Facebook connector: OAuth connect flow with Page selection

**Built:** 2026-08-18 — social-listening-admin@535338f

**Source:** ADR-0059 (Accepted 2026-08-18), against Story 2.15's real backend surface · **Status:** Ready, with the same precondition Story 2.15 itself carries, inherited rather than repeated in full: this story's own OAuth flow and Page picker can be built and proven against a Menno-administered test Page under Meta's Standard Access (no App Review needed for that degenerate case, per ADR-0059 Decision §3) — onboarding any real, unaffiliated tenant's Page still requires SocialEngage's own Meta App to separately clear Business Verification and App Review first. Not blocked on Story 2.15 being fully built first — both can be developed in parallel against the same ADR, but this story's own end-to-end proof needs Story 2.15's OAuth exchange/token storage to exist.

**Drafted 2026-08-18, at Menno's own direct request**, immediately after ADR-0059's acceptance: Facebook is this project's first `authMode: 'oauth'` connector (every existing connector uses `'none'` or `'apiKey'`) and its first Tier-3-only connector (ADR-0059 Decision §4 — no `ownerType: 'tenant'` path exists for it at all, unlike every platform Story 6.3's existing `ConnectForm` already handles). Story 6.3's own connect flow assumes a single-step form submission (an API key field, or nothing for `authMode: 'none'`) — it has no redirect-based OAuth mechanism, and no concept of a provider returning a *list* of connectable assets (Meta's `/me/accounts`, the Pages the authenticating individual's own account administers) that the caller must choose among before a connection is actually made. Both gaps are real, not cosmetic — a plain reuse of `ConnectForm` cannot represent either. This story also gives ADR-0028's own still-open, named UX question (`docs/open-decisions.md`: "the user-activation flow's exact UX — how a user learns a tier-3/user-bound credential is available to activate — undesigned, blocks Story 6.3") its first concrete, built instance, though it resolves that question only for this one connector, not as a general pattern — named here, not overclaimed.

**As a** tenant user or Tenant-Admin who personally administers a Facebook Page,
**I want** to connect it by signing in with my own Facebook account and choosing which Page I administer to connect,
**so that** I can set up the connector without anyone else on my team creating or holding the credential on my behalf, and without accidentally connecting the wrong Page if I administer more than one.

**Acceptance Criteria**
- `tenant/connectors/page.tsx`'s `PLATFORMS` array gains a `facebook` entry: `authMode: 'oauth'`, `personalScopeAllowed: true`, and a new `tenantScopeAllowed: false`-equivalent flag (or the nearest existing mechanism) that suppresses the `ownerType: 'tenant'` option **unconditionally, even for a `tenant_admin` session** — a real, deliberate divergence from every existing platform's entry, where `tenant_admin` always sees a tenant-wide option (Story 6.3 AC2). This is not an oversight to fix later; it is ADR-0059 Decision §4's own binding Tier-3-only rule, and this AC exists specifically so it isn't silently dropped by reusing `ConnectForm`'s existing role-gating logic unmodified.
- Its connector label, wherever rendered (this screen, the connector-status screen, any future watchlist platform-source list), reads **"Facebook Page (Owned Feed)"** — never the bare platform name "Facebook" — per ADR-0059 Decision §2's own hard naming constraint, named directly in that ADR as binding on "whichever story implements Story 6.3-equivalent UI work for this connector." This story is that story.
- Clicking "Connect" starts a real OAuth redirect to Facebook Login for Business (not a `ConnectForm` credential-field submission) and a callback route exchanges the returned code for a long-lived Page-eligible User access token via `social-listening-core`'s own OAuth-exchange endpoint (Story 2.15) — proven by a test confirming the redirect target and callback handling, with the actual Meta-side exchange mocked at the boundary (the same "mock the external provider, prove our own code" pattern Story 6.3's GNews credential form already uses for its own external boundary).
- After a successful token exchange, the flow calls Meta's `/me/accounts` (via `social-listening-core`, not directly from the browser — the long-lived token must never reach client-side JS, matching ADR-0036's own "no bearer token in browser JS" posture applied here to this provider's own token) and renders the returned list of Pages the connecting individual administers as a **selectable picker** — each row showing the Page's name and (if returned) its category, not just a raw id — proven by a test asserting the picker renders one row per returned Page and that no Page from the list is pre-selected.
- Selecting a Page and confirming stores the connector activation scoped to that specific Page — the connector's stored credential/activation record carries the chosen Page's own `id` (Decision §5's `Author.externalAuthorId`), not just "this user is connected to Facebook generically" — proven by a test confirming the specific Page id submitted by the picker is the one persisted, distinguishing a user who administers multiple Pages from one who administers one.
- **A real, named edge case, not glossed over:** if `/me/accounts` returns zero Pages (the connecting individual's Facebook account administers none), the flow shows a clear, specific message — e.g. "No Facebook Pages found for this account — you need to be an admin of a Page to connect it" — never a blank picker or a generic error, proven by a test simulating an empty `/me/accounts` response.
- The connected state, once a Page is selected, displays the connected Page's own name (not the generic "Facebook Page (Owned Feed)" label alone) so the tenant can tell *which* Page is feeding data — proven by a test asserting the connected-state view renders the stored Page name.
- Disconnecting requires the same explicit confirm step every other connector's `DisconnectButton` already requires (Story 6.3 AC4, unchanged pattern) — and, per ADR-0059 Decision §4's Tier-3 consequence, disconnecting or losing access is understood by the UI's own copy to mean only the connecting individual (never Tenant-Admin on their behalf) can reconnect — proven by confirming no "reconnect on this user's behalf" control is rendered for any other role.
- The "reconnect required" connector-health state Story 2.15 AC7 introduces is surfaced distinctly on both `tenant/connectors/page.tsx` and `tenant/connectors/status/page.tsx` — reusing `StatusBadge`'s existing rendering mechanism with a new, distinctly-labeled state rather than folding it into the generic failing/unhealthy badge — and clicking it re-enters this same OAuth-plus-picker flow from the top, proven by a test confirming the reconnect action targets the same connect entry point, not a dead end.

**Explicitly out of scope:** comment/mention ingestion UI (Story 2.15 doesn't build the backend for it either, per ADR-0059 Decision §5); a "switch to a different Page" flow once one is already connected without first disconnecting (not designed here — named as a real, plausible future refinement, not solved); any change to `tenant/watchlists/page.tsx`'s `SOCIAL_PLATFORMS` list (Story 6.22's own pattern) to offer Facebook as a watchlist platform source — a separate, small follow-on story once this connector is actually connectable, not bundled in here; actually submitting SocialEngage's own Meta App for Business Verification/App Review (an administrative step outside any code change, per Story 2.15's own Status line).

---

## Story 6.24 — Connector status screen groups Connectors and AI Providers into separate sections, with honest AI-provider metrics

**Source:** No new ADR needed — resolves `connector-status-view/SKILL.md`'s own already-named "Known gaps" entry from 2026-08-12 ("a real UX mismatch, deliberately left unaddressed for now... options considered, not decided: reword the copy for AI providers specifically, or give them real success/failure tracking"), the same "resolve an already-named, deliberately-deferred gap directly" category Story 2.14/6.22 already established for ADR-level open items, applied here to a SKILL.md-documented one instead. **Status:** Ready.
**Built:** 2026-08-19 — social-listening-admin@5d76e44

**Built 2026-08-19.** `ConnectorStatusClient.tsx` now partitions `rows` into two visually separate, headed sections — "Connectors" (`category === 'Ingestion'`) and "AI Providers" (`category === 'Enrichment'`) — via a single pass over the real, unfiltered `rows` prop that buckets each row's card into one of two arrays (never two separately-filtered `.map()` calls — see the regression note below for why). AI Provider cards render a plain `active`/`inactive` `StatusBadge` off real `isActive` with an explicit `'Active'`/`'Inactive'` label override (never the health-derived variant, since an `AIProviderConnector`'s `health.status` is permanently `'disconnected'`), and no metrics grid — a one-line `cs-ai-note` explains it's invoked on demand instead. Connector cards keep the real metrics grid, now showing each platform's own real poll interval (`POLL_INTERVAL_MINUTES`, mirroring `bootstrapConnectors.ts`'s real `pollCadenceMs` constants) instead of a universal wrong "2 minutes," and the real global retry ceiling ("Threshold: 20 retries before alert," mirroring `CONSECUTIVE_FAILURE_CEILING`) instead of a wrong "5." The KPI strip's "Total Feeds" now counts the Connectors section only. New contract: `contracts/epic-6/story-6.24.connector-status-ai-provider-grouping.contract.test.ts` (9/9).

**A real cross-component regression was found and healed via `heal-contract-failure` during this same build, not folded in silently.** The first implementation pass split rendering into two separately-named, separately-`.filter()`'d arrays (`connectorRows.map(renderConnectorCard)` / `aiProviderRows.map(renderAIProviderCard)`), which broke two pre-existing, already-shipped contracts: Story 6.5 AC6 (`expect(source).toMatch(/rows\.map/)`, asserting every platform is still mapped from the real `rows` prop, not a pre-filtered subset) and Story 6.15 AC3 (`rowsBlock = source.slice(source.indexOf('rows.map('))`, asserting `ActivateDeactivateButton` renders before `cs-metrics-grid` within the per-row block) — both real, source-text-anchored checks this new structure no longer satisfied, since neither array was literally named/derived via `rows.map(`. Per the Cross-Component Regression Protocol (never weaken the foreign contract; narrow the new change instead), the implementation was restructured to a single `rows.map((row) => { ... })` callback that inlines each card's markup (both the AI and Connector branches) and pushes the result into the correct bucket array — genuinely satisfying both older contracts' real intent (every row is still processed by one real `rows.map(` call; `ActivateDeactivateButton` still textually precedes `cs-metrics-grid` in source) rather than gaming the check. Confirmed via `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts` and `contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts`, both green after.

**Full `social-listening-admin` suite at merge: 35/35 suites minus Story 6.1's own already-documented Entra-sign-in suite (see `docs/implementation-log.md` for the full account) — 34/35 suites, 502/521 tests.** Story 6.1's failure was more extensive this session (19/19 tests in that file, not the narrower 3-test `.env`-redirect-URI failure logged against Stories 6.27/6.11) — the real, spawned `next dev --experimental-https -H socialengage.test` server never became reachable at all in this environment. Confirmed unrelated by direct attribution, not assumed: Story 6.24's own diff touches only `ConnectorStatusClient.tsx`, `globals.css`, and this story's own new contract — nothing in the sign-in/session/dev-server-spawn surface that file exercises. Left uninvestigated further as out of this story's own scope (a local HTTPS-cert/dev-server environment dependency, not a code regression) — named here for whoever next touches Story 6.1's own area, since this is a materially different failure shape than the two prior sessions' narrower one.

**Requested directly by Menno, 2026-08-18**, after observing the real, structural cause of the "Paused"-badge-next-to-"Deactivate"-button contradiction on the connector status screen: `deriveConnectorHealth()` (`social-listening-core/src/connectors/connectorHealth.ts`) returns `status: 'disconnected'` whenever a `platformId` has zero `ingestion_runs` rows — correct for `SocialConnector`s (real poll history), but `azure-ai-language`/`azure-openai` are `AIProviderConnector`s, invoked inline by `enrichPost()` and structurally never accumulate their own `ingestion_runs` row, ever, regardless of real usage. The status page's `deriveVariant()` (`ConnectorStatusClient.tsx`) maps that permanent `'disconnected'` to the `'inactive'` badge variant, whose design-system default label is "Paused" — a genuinely permanent, misleading reading for either AI provider, confirmed live (Azure OpenAI showing real `isActive: true`/"Deactivate" next to a "Paused" badge that can never say otherwise). Menno's own direction: group the two kinds of platform into visually separate, clearly labeled sections on this screen ("Connectors" vs. "AI Providers") "to highlight the differences," rather than trying to force AI providers into polling-connector badge semantics that don't describe them.

**As a** Tenant-Admin reviewing connector health,
**I want** ingestion connectors and AI enrichment providers shown in clearly separate, honestly-labeled sections,
**so that** I can tell at a glance which platforms are pollable content sources with real health history and which are on-demand AI providers with a fundamentally different operating model — instead of reading a "Paused" badge on a provider that is, in fact, active and working.

**Acceptance Criteria**
- `ConnectorStatusClient.tsx` renders two labeled sections — **"Connectors"** and **"AI Providers"** — derived from each platform's existing `category` field (`'Ingestion'` → Connectors, `'Enrichment'` → AI Providers), not a single flat card list — proven by a test asserting `gnews`/`newswire`/`wikipedia`/`tenant-owned-feed` render under the Connectors heading and `azure-ai-language`/`azure-openai` render under the AI Providers heading.
- Within the **AI Providers** section, cards render a simple **Active/Inactive** badge derived directly from real `isActive` (Story 1.12) — never the health-derived `healthy`/`degraded`/`failing`/`disconnected` variant `deriveVariant()` produces for Connectors — proven by a test confirming an AI provider with `isActive: true` renders an Active-shaped badge regardless of `health.status`, and one with `isActive: false` renders Inactive.
- Within the **AI Providers** section, the Last Successful Ingestion / Last Polling Attempt / Consecutive Retry Count metrics grid is **not rendered at all** — replaced by a short, honest note (e.g., "Invoked on demand during content enrichment — not independently polled.") — proven by a test confirming no `cs-metrics-grid` (or equivalent) renders for either AI provider card, and that the explanatory note is present instead.
- Within the **Connectors** section (unchanged badge/metrics mechanism), the hardcoded, incorrect "Interval: every 2 minutes" sub-label is replaced with each real platform's own poll cadence — 15 minutes for `gnews`/`newswire`, 30 minutes for `wikipedia`/`tenant-owned-feed` (`bootstrapConnectors.ts`'s real `pollCadenceMs` constants, 2026-08-18) — sourced from a small, explicitly-commented client-side constant naming that it must be kept in sync manually until a real endpoint exposes cadence (no such endpoint exists today; building one is separate, not this story's scope) — proven by a test asserting each Connectors-section card shows its own real interval, not a universal wrong "2 minutes."
- The hardcoded, incorrect "Threshold: 5 retries before alert" sub-label is corrected to the real, single, global ceiling — **20** (`CONSECUTIVE_FAILURE_CEILING`, `connectorHealth.ts`) — proven by a test asserting every Connectors-section card shows "Threshold: 20 retries before alert."
- The KPI strip's "Total Feeds" count reflects only the **Connectors** section's own row count, not AI providers (which are not feeds) — "Healthy Ingestion"/"Attention / Degraded" were already implicitly Connectors-only (AI providers' permanent `'disconnected'` status never matched either filter), named here explicitly rather than left an unstated side effect — proven by a test confirming `totalCount` equals the Connectors-section row count, not all rows.
- Both sections continue to render `ActivateDeactivateButton` exactly as today (Story 6.15) — this story changes what's *displayed* around each card, not the activation mechanism itself, for either section.

**Explicitly out of scope:** giving AI providers real success/failure tracking based on actual `enrichPost()` outcomes (the SKILL.md's own other named option, a materially heavier build — a new tracking mechanism, not a display change — deferred, not chosen here); a real backend endpoint exposing per-platform poll cadence (the Interval fix above is an honest, explicitly-labeled client-side constant, not a claim that this is now dynamically sourced); any change to `tenant/connectors/page.tsx` (Story 6.3's own connect/disconnect screen) — this story's scope is the status screen only; the same grouping applied there is a separate, not-yet-scoped follow-on if wanted.

---

## Story 6.25 — Post feed shows most-recently-ingested posts first

**Built:** 2026-08-18 — social-listening-admin@6550716

**Source:** No new ADR needed — a display-order fix over data ADR-0011's already-Accepted cursor pagination already provides in full; no change to the pagination mechanism itself. **Status:** Built 2026-08-18.

**Requested directly by Menno, 2026-08-18.** Confirmed directly against the real backend, not assumed: `GET /v1/posts` (`socialPostStore.ts`'s `queryFirstPage`/`queryAfterCursor`) orders every page `ORDER BY seq ASC` — `seq` is a monotonic, insertion-ordered identity column (ADR-0011/Story 3.4), so the very first page returned is the **oldest**-ingested posts, and cursor-following walks toward progressively newer ones. `social-listening-admin`'s own `fetchAllPosts()` (`tenant/posts/page.tsx`, Story 6.18) already pages through the tenant's **entire** post set into memory before `PostsFeedClient` ever renders or filters anything — it hands that array through unmodified, so the feed's card order (and the order "Show more" reveals further posts in) is oldest-ingested-first today, the opposite of what a Tenant-Admin scanning for new activity wants.

**A deliberately minimal, low-risk fix, not a pagination redesign:** rather than reversing `ORDER BY seq ASC` to `DESC` inside `queryFirstPage`/`queryAfterCursor` (which would flip the cursor's own keyset comparison direction — a real, non-trivial change to ADR-0011's already-contract-verified mechanism, Story 3.4's own tests), this story reverses the already-fully-fetched, in-memory array once, client-side, after `fetchAllPosts()` resolves — the backend's own pagination mechanism, cursor encoding, and `seq ASC` ordering are all completely unchanged.

**As a** Tenant-Admin scanning the post feed for recent activity,
**I want** the most recently ingested posts shown first, with the oldest posts only reached once I've revealed everything else,
**so that** I see what's new without having to page or scroll through months of old content first.

**Acceptance Criteria**
- `fetchAllPosts()` (`tenant/posts/page.tsx`) returns posts in most-recently-ingested-first order — the fully-fetched array is reversed once, after paging completes, before being passed to `PostsFeedClient` — proven by a test asserting the returned array's first element is the post with the highest `seq`-implied recency (the last one paged in) and the last element is the first one paged in.
- `PostsFeedClient.tsx`'s existing `filteredPosts`/`visiblePosts` derivation (Story 6.18, `.filter()` + `.slice(0, visibleCount)`, no existing `.sort()`) requires no change — order is preserved end to end from the already-corrected `posts` prop, proven by a test confirming a filtered/searched result set keeps the same relative (newest-first) order as the input, not re-sorted or re-shuscrambled by the filter step.
- The Slideover/detail-view post-selection mechanism (Story 6.11/6.19) is unaffected — this story changes list order only, never which post a given click opens.
- Regression: Story 6.18's own existing contract (full-set search/filter over the complete fetched array) continues to pass unmodified — this story does not change *which* posts are fetched or filtered, only the order they arrive and render in.

**Explicitly out of scope:** changing `GET /v1/posts`'s own backend `ORDER BY seq ASC` or cursor keyset direction (a separate, higher-risk change to an already-contract-verified mechanism, not needed since the admin UI already fetches the complete set before rendering); any change to how `visibleCount`/"Show more" reveals results (unchanged mechanism, now just revealing in the corrected order); sorting by `publishedAt` instead of ingestion order (`seq`) — Menno's own request specifically named "most recent ingested," matching `seq`'s real semantics, not the original post's own publish timestamp, which can differ (e.g. a backfilled or re-polled older article).

---

## Story 6.26 — Post feed's Provider filter derives its options from real data, not a hardcoded list

**Built:** 2026-08-18 — social-listening-admin@03c37c9

**Source:** No new ADR needed — an ordinary CRUD/UI-surface fix, the same category Story 6.21/6.22 already established for the identical bug on two other screens. **Status:** Built 2026-08-18.

**Requested directly by Menno, 2026-08-18**, after real Wikipedia posts started landing in the feed (following this session's Story 2.16/2.17 fixes and a stale-credential correction) but Wikipedia had no way to be selected in the post feed's own Provider filter. Confirmed directly against the real code: `PostsFeedClient.tsx`'s Provider `<select>` is three static `<option>` elements — `gnews`, `newswire`, `tenant-owned-feed` — Wikipedia was never added, and no future connector will appear either unless someone remembers to hardcode it in yet again. **This is the third real instance of the identical bug category**, not a one-off: Story 6.21 found the same drift in `tenant/connectors/page.tsx`'s `PLATFORMS` array, Story 6.22 found it again in `tenant/watchlists/page.tsx`'s separately-maintained `SOCIAL_PLATFORMS` list. A third hand-maintained list on a third screen is the pattern itself being the problem, not a missing entry — Menno's own framing ("I would expect the connector [to] become available automatically") names the actual fix directly: derive the filter's own options from the real, already-fetched post data, not a list that has to be remembered.

**As a** Tenant-Admin filtering the post feed,
**I want** the Provider filter to always list every platform actually present in my own ingested posts,
**so that** a newly-ingesting connector (Wikipedia today, whatever comes next) is filterable immediately, without needing its own follow-up "add it to the list" story every time.

**Acceptance Criteria**
- The Provider `<select>`'s options (beyond the fixed "All Providers" entry) are computed from the distinct `provider` values actually present in `flat` (the already-extracted, already-fetched full post set, Story 6.18) — via `extractProviderBadge()`'s own existing output, not a new extraction path — proven by a test confirming a fetched set containing a `wikipedia`-sourced post renders a "Wikipedia"-labeled option with no code change beyond this story's own fix, and a set with no such post renders none.
- Each dynamically-derived option's **display label** uses a small, explicitly-named lookup table (`gnews` → "GNews", `newswire` → "Newswire", `tenant-owned-feed` → "Tenant Feed", `wikipedia` → "Wikipedia") for the platforms already known today, falling back to the raw `providerId` string itself for any value not in that table — proven by a test confirming an unmapped/future `providerId` still renders as a selectable option (using its raw id as the label), never silently hidden the way today's hardcoded list hides Wikipedia entirely. This keeps the fix's core guarantee (every real provider is always selectable) independent of whether anyone remembers to add a pretty label for it.
- Options render in a stable, deterministic order (alphabetical by label) — proven by a test with providers supplied out of order confirming sorted render order.
- Existing filter behavior (`selectedProvider !== 'ALL' && post.provider.toLowerCase() !== selectedProvider.toLowerCase()`) is unchanged — this story changes only which options are offered, never the matching logic itself, proven by re-running Story 6.11's own existing Provider-filter assertions unmodified.
- Regression: Story 6.18's full-set fetch/filter behavior and Story 6.25's newest-first ordering are both unaffected — proven by confirming their own existing contracts still pass unmodified.

**Explicitly out of scope:** applying the same dynamic-derivation fix to `tenant/connectors/page.tsx`'s `PLATFORMS` array or `tenant/watchlists/page.tsx`'s `SOCIAL_PLATFORMS` list — those two screens list *connectable* platforms (including ones with zero posts yet), a genuinely different derivation (registered connectors, not observed post data) than this filter's "what's actually in my data" question; named as a related, plausible future follow-on, not solved here; any change to the Sentiment/Watchlist filters' own option lists (unaffected, out of this story's scope).

---

## Story 6.27 — Facebook: support connecting more than one Page per user

**Source:** ADR-0060 (Accepted 2026-08-18) · **Status:** Ready.

**Built:** 2026-08-18 — social-listening-admin@b58b323 (core half: social-listening-core@b58b323)

**Named directly by Menno, 2026-08-18**, while live-testing Story 6.23's real Page picker: he administers many real Facebook Pages, but the tenant's own license seat count (max 5) makes "have a different team member connect each Page" — the only path Story 6.23 currently supports — impractical at his actual scale, verbatim: *"I truly have many many pages i just dont have the seat count max 5 to load all the pages by a different user. Leave it for now and a new story to follow."* ADR-0060 was then drafted at his direct request ("could you please draft the ADR for multiple Facebook Pages"), revised in place once against a four-point external-review pass, and accepted the same day, verbatim: *"yes and i can now Approve the ADR 00060"*. This story expands ADR-0060's own Decision §1–§6 into real, buildable Acceptance Criteria — it does not decide anything ADR-0060 itself left undecided (see "Explicitly out of scope" below).

**A real, explicit dependency worth stating plainly, not discovered as a surprise later:** this story's own scope is storage, credential, and Admin UI only — exactly the same honest boundary Story 2.15 and Story 6.23 already stated for the single-Page case. Nothing in this story makes a connected Page's `pollFacebook(tenantId, userId)` actually get called by anything: confirmed directly (repo-wide grep) that this function has zero real call sites in the running server today, and ADR-0060 Decision §3's own per-Page fan-out lives entirely *inside* `pollFacebook()` — it composes with, but does not by itself close, the separate Tier-3 scheduler-triggering gap. That gap is [ADR-0061](../adr/0061-tier-3-poll-scheduler-per-user-enumeration.md) and **Story 1.15** (`docs/user-stories/epic-1-repository-and-api-foundation.md`), a distinct ADR/story pair Menno confirmed should stay separate from this one. A tenant can complete every Acceptance Criterion below — connect several Pages, see them listed, see per-Page health badges — without Story 1.15 also being built, but no real ingestion will actually occur until it is.

**As a** tenant user who personally administers more than one Facebook Page,
**I want** to connect several of my own Pages under one Facebook sign-in, see each one's own status, and manage them individually,
**so that** I don't need a separate team member (and a separate license seat) for every Page I administer myself.

**Acceptance Criteria**

*Backend — storage (ADR-0060 Decision §1/§2)*
- A new `facebook_connected_pages` table exists exactly as ADR-0060 Decision §1 specifies (`id`, `tenant_id`, `user_id`, `page_id`, `page_name`, `credential_id` → `platform_credentials`, `status` `CHECK IN ('connected', 'removed', 'orphaned')`, `created_at`, `updated_at`, `UNIQUE (tenant_id, user_id, page_id)`), RLS-scoped by the standard `tenant_isolation` policy — proven by a migration test confirming a second row for the same user with a *different* `page_id` succeeds, and an `INSERT` colliding on `(tenant_id, user_id, page_id)` is rejected at the constraint level (the store layer below upserts instead of relying on the constraint to reject).
- `platform_credentials`'s own existing exported functions (`storeCredential`, `readCredential`, `getLatestCredentialId`, `deleteCredential`) are completely unchanged — proven by re-running every existing contract test for GNews connect/disconnect and other tenant-wide credential flows unmodified, confirming zero regression.
- `credentialStore.ts` gains a new, additive `deleteCredentialById(tenantId, credentialId)` function that deletes exactly one row by its own primary key — proven by a test confirming it removes only the targeted row and leaves every sibling `platform_credentials` row (same tenant/platform/owner) untouched.

*Backend — connect/select flow (ADR-0060 Decision §5)*
- `facebookOAuthRouter.ts`'s `/select-page` accepts `pageIds: string[]` (plural) and processes each independently: one Page's write failure never aborts or rolls back another Page's already-succeeded write — proven by a test simulating a failure on one `pageId` among several, asserting the others still succeed.
- `/select-page`'s response is `{ connected: { pageId, pageName }[], errors: { pageId, reason }[] }` — proven by tests for (a) all selections succeeding (non-empty `connected`, empty `errors`), and (b) a partial outcome (both arrays non-empty). `reason` is a short, generic, non-sensitive string (e.g. `"Failed to store credential"`) — it never echoes a raw internal exception message, matching this project's existing error-response discipline of not leaking internals to the client.
- Re-selecting a `page_id` that is already `status = 'connected'` for that user **upserts** the existing `facebook_connected_pages` row (refreshes `credential_id` and `page_name`, leaves `status = 'connected'`) rather than violating the `UNIQUE` constraint or creating a duplicate — proven by a test re-selecting an already-connected Page and confirming exactly one row still exists for it afterward, with a refreshed `credential_id`.

*Backend — orphaned-Page detection (ADR-0060 Decision §1, added at review)*
- A re-run of `/exchange` (a full re-consent) whose returned Page list no longer includes a `page_id` that was previously `status = 'connected'` for that user auto-transitions that row's `status` to `'orphaned'` — proven by a test simulating a second `/exchange` call returning one fewer Page than a prior connected set, and asserting the missing Page's own row is now `'orphaned'`, every other connected row unchanged.
- `orphaned` rows are excluded from polling identically to `removed` rows (see the next section) — proven by a test confirming an `orphaned` row is never passed to `pollFacebook()`'s per-Page loop.

*Backend — polling and health (ADR-0060 Decision §3/§4)*
- `pollFacebook(tenantId, userId)` lists every `status = 'connected'` row in `facebook_connected_pages` for that user and runs one independent `runIngestionAttempt()` per Page, **sequentially** (one Page's attempt fully completes, including its own `gatedAcquire()` call, before the next begins — never `Promise.all()`) — proven by a test with three connected Pages confirming three separate `IngestionRun` rows are created, one per Page, in sequence.
- One Page's `ClassifiableError` does not prevent the next Page in the loop from being attempted — proven by a test where the second of three Pages throws, asserting the first and third Pages each still get their own successful `IngestionRun`.
- `ingestion_runs` gains a new, nullable `page_id` column (migration mirroring `0032`'s own `is_credential_failure` precedent), populated only by Facebook's own per-Page poll path — proven by a test confirming a non-Facebook connector's `IngestionRun` still writes `page_id = NULL` with no behavior change to any existing query or contract.
- `deriveConnectorHealth(tenantId, platformId, pageId?)` gains the new optional third parameter: omitted, behavior is byte-for-byte unchanged (every existing contract test for every other connector re-run unmodified, proving no regression); supplied, the query filters to that Page's own `ingestion_runs` rows only — proven by a test with two connected Pages under one user, one with only successful runs and one with only failed non-retryable runs, confirming `deriveConnectorHealth(tenantId, 'facebook', pageA)` and `deriveConnectorHealth(tenantId, 'facebook', pageB)` return different statuses for the same tenant/platform.

*Backend — REST endpoints (ADR-0060 Decision §5)*
- `GET /v1/connectors/facebook/pages` returns `{ parentConnectionActive: boolean, pages: [{ id, pageId, pageName, status, connectorHealth }] }`, scoped to the caller's own resolved `userId` (never a `tenant_admin`-gated, cross-user query) — proven by a test confirming it returns only the calling user's own rows even when other users in the same tenant have their own connected Pages. `parentConnectionActive` is computed via the already-existing `isConnectorActive(tenantId, 'facebook', 'user', userId)` — proven by a test toggling that user's own personal activation and confirming the field flips accordingly.
- `DELETE /v1/connectors/facebook/pages/:id` soft-removes (sets `status = 'removed'`) and calls the new `deleteCredentialById()` against that row's own `credential_id` — proven by a test confirming the row survives with `status = 'removed'` and its credential is gone (a subsequent `readCredential()` for that id throws).
- Both endpoints treat another user's row (or a nonexistent id) as `404`, never `403` — proven by a test confirming a caller cannot see or remove a different user's connected Page, matching ADR-0044 §5c's own established "another user's private resource is 404, never 403" convention.

*Admin UI (ADR-0060 Decision §6)*
- `FacebookPagePickerModal` becomes multi-select — checkboxes replace the current `radiogroup`, with a "Connect N selected Pages" action calling the revised plural `/select-page` — proven by a test confirming multiple checked rows are all included in the submitted `pageIds` array.
- The picker's confirmation step renders both the `connected` and `errors` arrays from a partial-success response — proven by a test simulating a partial outcome and confirming both a success list and a per-Page error message are visible, never collapsed into one opaque pass/fail state.
- The single `facebookConnectedPage` name + one `ActivateDeactivateButton` footer is replaced by a real per-Page list: one row per `connected` or `orphaned` Page (name, its own `ConnectorHealth` badge via the new per-Page health call, an individual "Disconnect this Page" action calling the new `DELETE` endpoint) and a persistent "Connect another Page" action re-entering the OAuth flow — proven by a test rendering multiple connected Pages and confirming one row and one health badge per Page.
- An `orphaned` row renders with its own distinct, honestly-labeled state (e.g. "Access lost — reconnect to restore this Page"), visually distinct from `connected`'s health badge and from a deliberate `removed` disconnect — proven by a test confirming an `orphaned` row never renders as if it were still healthy.
- The existing per-user `ActivateDeactivateButton` (`ownerType: 'user'`) stays exactly where it is — one switch covering all of that user's connected Pages collectively. When `parentConnectionActive` (from the new `GET .../pages` response) is `false`, the per-Page list renders an explicit banner (e.g. *"N Pages connected, but your personal Facebook connection is currently deactivated — none of them are being polled"*) rather than showing every row as if it were actively polling — proven by a test toggling `parentConnectionActive` and confirming the banner's presence/absence.
- **A judgment call this story makes that ADR-0060 itself left undesigned, flagged for Menno's review before this is built:** the card-level `reconnect_required` action is redesigned so the per-Page list's own row-level action carries the actual remediation (re-entering the OAuth flow scoped to reconnecting that one Page), while the card-level badge becomes a pure rollup signal ("one or more Pages need attention — see your Page list") rather than a single "Reconnect Facebook" link that forces re-selecting every already-healthy Page again — proven by a test confirming the card-level action no longer restarts the full multi-Page flow when only one Page is unhealthy.

---

## Story 6.28 — Tenant-owned feed: friendly naming in the connector setup UI

**Source:** ADR-0050's own 2026-08-20 Amendment Log entry (the same entry that sourced Story 2.19's backend half) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-admin@cc38b6a

**Documentation Steward note, added 2026-08-24:** this story's own entry was entirely missing from this file until this correction — real, shipped, contract-tested work (`contracts/epic-6/story-6.28.tenant-owned-feed-friendly-naming.contract.test.ts`) had zero write-up here despite `docs/user-stories/README.md`'s Epics table and Story 2.19's own epic-2 entry both already referring to it by name and number as real, storied work, and despite every one of its list-mates in README's own "unstoried/ADR CRUD/UI surface" enumeration (a category meaning "no brand-new dedicated ADR," not "no write-up here" — 6.24, 6.25, 6.29–6.35 are all in that same list and all have full `## Story` sections in this file) getting a real entry. Reconstructed from the real commit (`social-listening-admin@cc38b6a`) and its own `tenant-owned-feed-connector-setup/SKILL.md` update, not invented — see `docs/implementation-log.md`'s Story 2.19 entry for the backend half this pairs with.

**As a** tenant-owner administering more than one tenant-owned feed (Story 6.20's multi-feed list),
**I want** to set and edit a friendly name for each feed in the connector setup UI,
**so that** I can tell my feeds apart by something more meaningful than a raw domain string, matching the real per-feed `name` column Story 2.19 already added on the backend.

**Acceptance Criteria**
- The connect modal gains an optional Name field; a non-empty value is sent as `name`, an empty value is never sent at all (the backend's own "never defaulted" invariant, Story 2.19 AC1).
- The edit modal is pre-filled from the activation's current `name` and always re-sends `name` on submit — an explicit empty value clears the name (`null`, distinct from "not sent"), never silently left unchanged.
- The multi-feed list's per-row primary label shows `name` when set, falling back to `domain`; `domain` itself is still always shown as a secondary line, never hidden.
- Both proxy routes (`connect`, `[id]` PATCH) forward `name` through to `social-listening-core` correctly; the `[id]` PATCH route distinguishes "`name` not sent" from "`name` sent as `null`" via `hasOwnProperty`, matching Story 2.19's own backend semantics exactly.
- `core-client.ts`'s `connectTenantOwnedFeed()`/`updateTenantOwnedFeedActivation()` carry `name` through; `updateTenantOwnedFeedActivation()`'s signature widens from positional `(id, feedUrl)` to `(id, updates: { feedUrl?, name? })`, with Story 6.20's own pre-existing contract test updated to the new call shape (a real, dated, non-weakening update — see that story's own dated note above).

**Explicitly out of scope:** surfacing `rawPayload.feedName` (Story 2.19's own per-post denormalization) anywhere in the Posts feed or Analytics Dashboard — nothing in `postDisplay.ts`/`PostsFeedClient.tsx`/`OverviewTab.tsx` reads it yet, named as a real, open gap in this component's own `SKILL.md` rather than silently left undocumented; a name-uniqueness constraint (none decided, a label not an id, per Story 2.19's own matching out-of-scope note).

---

## Story 6.29 — Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action

**Source:** ADR-0070 (Accepted 2026-08-20) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-admin@be6c4cd

**Documentation Steward correction, 2026-08-24.** This story's own `**Built:**` field named only the repo, no commit hash (`2026-08-20 (`social-listening-admin`)`), unlike this file's own established fixed-shape convention. `docs/implementation-log.md`'s own matching entry (`## 2026-08-20 — Story 6.29 — social-listening-admin@be6c4cd`) names the real commit — added here directly.
**Depends on:** Story 1.16 (Ingestion watchdog, stalled status derivation, retry API endpoint in `social-listening-core`), Story 6.5 (Connector status view), Story 6.24 (Connectors & AI providers grouping)

**As a** Tenant-Admin or Tenant User,
**I want** to see clear, real-time ingestion status badges (including `Stalled`), actionable alert banners when ingestion stops, and an on-demand "Force Retry / Re-sync" action,
**so that** I am immediately aware when ingestion has stalled and can proactively trigger a recovery attempt without database intervention.

**Acceptance Criteria**

- **Connector Status View (`/tenant/connectors/status` & `/tenant/connectors`):**
  - Widens `StatusBadge` variants to include `'stalled'` (rendered as Amber/Orange with label "Stalled / No Ingestion").
  - Renders explicit operational metrics for each Ingestion Connector card:
    - **Last Ingestion Attempt:** Relative timestamp (e.g. "10 mins ago") + ISO tooltip.
    - **Last Successful Ingestion:** Relative timestamp (e.g. "25 mins ago") + ISO tooltip (reflecting `lastSuccessfulFetchAt`).
    - **Ingestion Cadence:** Displays platform poll cadence (e.g. "Poll interval: 15m").
- **On-Demand "Force Retry / Re-sync" Button:**
  - Rendered on each Ingestion Connector card for `tenant_admin` users (and for Tier-3 connectors, the user owning the credential) when the connector is active.
  - Clicking invokes `POST /v1/connectors/:id/retry` (or `POST /v1/connectors/:id/users/:userId/retry` for Tier-3) via `/api/connectors/[id]/retry` proxy route.
  - While request is in-flight, displays a loading spinner and disables repeat clicks.
  - On success, displays a toast notification ("Ingestion run triggered") and refreshes connector metrics immediately.
  - On 409 conflict ("Run already in progress"), shows an informative message without failing abruptly.
- **Global Ingestion Alert Banner:**
  - If any active connector for the tenant is in `stalled`, `failing`, or `reconnect_required` status, renders a prominent alert banner at the top of `/tenant/analytics` (Overview tab) and `/tenant/connectors`.
  - Banner details the affected platform(s), reason (e.g. "Ingestion stalled — no posts received in > 24 hours"), and provides direct actions ("Re-sync now" or "Reconnect account").
  - Dismissible for the current browser session, but reappears if status remains unresolved on next page load.

**Explicitly out of scope:** External push notifications (email/SMS/Slack alerts — downstream services, not admin UI scope).

---

## Story 6.30 — Brave Search API Connector Setup, Activation, and Status Screen

**Source:** ADR-0065 (Accepted 2026-08-20) · **Status:** Built 2026-08-21
**Built:** 2026-08-21 — social-listening-admin@dedfb6b
**Depends on:** Story 2.21 (`brave-search` backend connector in `social-listening-core`), Story 6.3 (Connector connect/disconnect), Story 6.5 (Connector status view), Story 6.24 (Connectors & AI providers grouping)

**Documentation Steward correction, 2026-08-24.** This story's own Status line read "Ready" directly beside its own already-populated `**Built:**` field — confirmed against `docs/implementation-log.md`'s matching entry (`## 2026-08-21 — Story 6.30... — socialengage@dedfb6b`). Corrected directly.

**As a** Tenant Administrator,
**I want** to connect, activate, manage, and monitor the Brave Search API connector using my organization's Brave API key from the admin portal,
**so that** our tenant can actively discover web and news content for our watchlists without backend developer assistance.

**Acceptance Criteria**

- **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**
  - Adds `brave-search` to `PLATFORMS` array in both client components:
    - `id: 'brave-search'`, `name: 'Brave Search'`, `description: 'Active web & news search discovery for watchlists'`
    - `category: 'Ingestion'`, `authMode: 'api_key'`
    - `tenantScopeAllowed: true`, `personalScopeAllowed: false` (Tier-2 platform credential, ADR-0028)
    - `icon: 'search'` or dedicated Brave icon glyph
- **Connect Modal & Credential Submission (`ConnectModal`):**
  - When clicking "Connect" on the Brave Search card, opens `ConnectModal` with:
    - Dedicated field for Brave Search API Key (`X-Subscription-Token`).
    - Explicit ADR-0027 billing disclaimer noting that the tenant creates their own API account directly with Brave Search.
  - Submits credential to `/api/connectors/brave-search/connect` via `POST` with `ownerType: 'tenant'`.
  - On success, updates card state to connected with a masked credential indicator.
- **Activation & Deactivation Controls:**
  - Renders `ActivateDeactivateButton` (`ownerType: 'tenant'`) gated on `tenant_admin` role.
  - Toggling active state correctly calls `/api/connectors/brave-search/activate` or `/api/connectors/brave-search/deactivate`.
- **Connector Status & Telemetry (`/tenant/connectors/status`):**
  - Renders `brave-search` in the "Connectors" section (Ingestion), distinct from "AI Providers".
  - Shows operational metrics: Last Ingestion Attempt, Last Successful Ingestion, and polling cadence (e.g. "Poll interval: 1h–4h").
  - Displays health status badge (`Healthy`, `Degraded`, `Failing`, `Stalled`).
  - Gated on `tenant_admin`: renders "Re-sync now" button (Story 6.29) triggering on-demand retry for active Brave Search connector.

**Explicitly out of scope:** Billing/reselling Brave Search credits (prohibited by ADR-0027); client-side search query execution (runs purely in backend scheduler, Story 2.21).

---

## Story 6.31 — Human-in-the-Loop Post Enrichment Cascading Edit Drawer

**Source:** ADR-0071 (Accepted 2026-08-20) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-admin@9260f6f
**Depends on:** Story 3.13 (Post enrichment override API & precedence guard in `social-listening-core`), Story 6.15 (Post detail panel), Story 6.16 (Post enrichment display & re-enrichment action)

**Documentation Steward correction, 2026-08-24 — real drift, the "Built convention" class this file exists to catch.** This story's own header read `**Status:** Ready` / `**Built:** not yet` despite `docs/implementation-log.md` already carrying a full, matching build entry (`## 2026-08-20 — Story 6.31 — social-listening-admin`, 10/10 contract, same files-touched list). That log entry itself carries `**Full commit:** \`pending\`` — a real gap, unfixable here since the log is read-only for this role — but the real commit is unambiguous: `git diff-tree --no-commit-id --name-only -r 9260f6f` matches the log entry's own file list exactly (that commit itself is the one that added the log entry, hence its own `docs/implementation-log.md` self-reference). Corrected directly with the real hash.

**As a** Tenant User or Tenant-Admin,
**I want** to click an edit button on the post details enrichment card to open an Enrichment Details drawer side-by-side with the post,
**so that** I can correct sentiment, add/remove key phrases, and update country or language attributes with real-time feedback and audit history.

**Acceptance Criteria**

- **Edit Trigger on Enrichment Card (`PostDetailPanel.tsx`):**
  - Renders an edit icon button (`aria-label="Edit enrichment details"`, pencil icon) in the header of the AI Enrichment card.
  - Clicking "Edit" opens the secondary `EnrichmentEditDrawer` without dismissing the active post drawer.
- **Cascading Multi-Drawer Layout & Responsive Behavior:**
  - **Large Viewports (`>= 1200px`):** The primary `PostDetailPanel` translates leftward smoothly (`transform: translateX(-420px)` or side-by-side container) while `EnrichmentEditDrawer` slides in flush to the right viewport edge.
  - **Compact Viewports (`< 1200px`):** `EnrichmentEditDrawer` renders as a full-width overlay over the post panel with a back navigation arrow returning to the post details view.
- **Enrichment Form Controls (`EnrichmentEditDrawer.tsx`):**
  - **Sentiment Segmented Control:** Interactive toggle buttons for `Positive` (green), `Neutral` (slate), `Negative` (red).
  - **Key Phrases Tag Editor:** Tag pills with remove (`×`) buttons, plus a text input and "+ Add" button to append new phrases (with duplicate prevention and max 50 phrase ceiling).
  - **Language Selector:** Dropdown of standard ISO 639-1 languages.
  - **Country / Region Selector:** Country dropdown supporting ISO 3166-1 alpha-2 codes or "Unknown / Unmapped".
  - **Summary / Notes Field:** Multi-line textarea for analyst notes / corrected summary (max 1,000 characters).
- **Optimistic Update, Submission, & Rollback:**
  - Submitting "Save Changes" invokes `PATCH /api/posts/[id]/enrichment` (Next.js proxy route) with the modified fields.
  - Optimistically updates the post's enrichment in `PostsFeedClient` and closes the secondary edit drawer.
  - While saving, the button shows a loading spinner and is disabled against double-clicks.
  - On failure, rolls back local state and displays an error toast notification.
- **Visual "Edited by user" Badge & Lineage Indicator:**
  - When a post has `enrichment.override.isOverridden === true`, the enrichment card displays an amber/blue "Edited by user" pill badge with a tooltip showing who edited the post and when (`overriddenAt`).
- **Accessibility (a11y) & Keyboard Flow:**
  - Both drawers carry `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Focus is trapped within `EnrichmentEditDrawer` while open.
  - Pressing `Escape` closes **only** the `EnrichmentEditDrawer`, returns the primary post drawer to resting position, and returns focus to the Edit button.
- **Re-Enrichment Conflict Handling:**
  - If a user triggers `RunEnrichmentButton` on an overridden post, a confirmation modal is shown before proceeding.
  - Confirming passes `force: true` to `/api/posts/[id]/enrich`.

**Explicitly out of scope:** Batch multi-post enrichment editing (deferred); custom training-set export UI.

---

## Story 6.32 — Bing Search API (Azure) Connector Setup, Activation, and Status Screen

**Source:** ADR-0066 (Accepted 2026-08-20) · **Status:** Built 2026-08-21
**Built:** 2026-08-21 — social-listening-admin (commit hash not recoverable — see the dated note below)
**Depends on:** Story 2.22 (`bing-search` backend connector in `social-listening-core`), Story 6.3 (Connector connect/disconnect), Story 6.5 (Connector status view), Story 6.24 (Connectors & AI providers grouping)

**Documentation Steward correction, 2026-08-24 — real drift, the "Built convention" class, with an additional real gap this pass could not fully close.** This story's own header read `**Status:** Ready` / `**Built:** not yet`, but `docs/implementation-log.md`'s own matching entry (`## 2026-08-21 — Story 6.32... — socialengage@pending`) already describes a full "Delivered Story 6.32" pass touching real UI files (`ConnectorsClient.tsx`, `page.tsx`, `status/page.tsx`, `watchlists/page.tsx`), and the real Bing Search UI code (`IconBingSearch()`, the `'bing-search'` icon case) is genuinely present in `social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx` at current HEAD — confirmed by direct inspection, not assumed. But the log's own `Full commit` field itself reads `pending`, never backfilled, and `git log --all` finds no commit anywhere in this repository's reachable history whose message or touched files match this delivery beyond `0c24532` (contract-test-only, not the real implementation). Corrected the Status/`**Built:**` mismatch directly; the commit hash itself is honestly left unresolved rather than guessed — flagged for Menno as a real, standing traceability gap (the implementing commit for Story 6.32's UI genuinely exists in the working tree but is not identifiable in git history under any reviewed hash).

**As a** Tenant Administrator,
**I want** to connect, activate, manage, and monitor the Bing Search API connector using my organization's Azure subscription key from the admin portal,
**so that** our tenant can actively discover web and news content for our watchlists via Azure-aligned search infrastructure.

**Acceptance Criteria**

- **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**
  - Adds `bing-search` to `PLATFORMS` array in both client components:
    - `id: 'bing-search'`, `name: 'Bing Search (Azure)'`, `description: 'Azure AI Services active web & news search discovery for watchlists'`
    - `category: 'Ingestion'`, `authMode: 'api_key'`
    - `tenantScopeAllowed: true`, `personalScopeAllowed: false` (Tier-2 platform credential, ADR-0028)
    - `icon: 'search'` or dedicated Microsoft / Bing icon glyph
- **Connect Modal & Credential Submission (`ConnectModal`):**
  - When clicking "Connect" on the Bing Search card, opens `ConnectModal` with:
    - Dedicated field for Azure Cognitive Services / Bing Search API Key (`Ocp-Apim-Subscription-Key`).
    - Optional Azure custom endpoint URL input (defaulting to standard Bing Search v7 endpoint).
    - Explicit ADR-0027 billing disclaimer noting that the tenant provisions their own Azure Cognitive Services resource directly with Microsoft.
  - Submits credential to `/api/connectors/bing-search/connect` via `POST` with `ownerType: 'tenant'`.
  - On success, updates card state to connected with a masked credential indicator.
- **Activation & Deactivation Controls:**
  - Renders `ActivateDeactivateButton` (`ownerType: 'tenant'`) gated on `tenant_admin` role.
  - Toggling active state correctly calls `/api/connectors/bing-search/activate` or `/api/connectors/bing-search/deactivate`.
- **Connector Status & Telemetry (`/tenant/connectors/status`):**
  - Renders `bing-search` in the "Connectors" section (Ingestion), distinct from "AI Providers".
  - Shows operational metrics: Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 1h–4h"), and estimated Azure call volume.
  - Displays health status badge (`Healthy`, `Degraded`, `Failing`, `Stalled`).
  - Gated on `tenant_admin`: renders "Re-sync now" button (Story 6.29) triggering on-demand retry for active Bing Search connector.

**Explicitly out of scope:** Billing/reselling Azure transactions (prohibited by ADR-0027); client-side search query execution (runs purely in backend scheduler, Story 2.22).

---

## Story 6.33 — Facebook connector: Display hosting Page attribution and author distinction in Post Feed and Details Drawer

**Source:** ADR-0067 (Accepted 2026-08-20) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-admin@b0dc89e

**Documentation Steward correction, 2026-08-24.** Header read "Ready"/"not yet" despite `docs/implementation-log.md` already carrying a matching build entry (`## 2026-08-20 — Story 6.33 — social-listening-admin`, files-touched list matching `b0dc89e` exactly). Corrected directly.
**Depends on:** Story 2.23 (Facebook connector Graph API `from` extraction & Page dependency in `social-listening-core`), Story 6.11 (Display derivation helpers), Story 6.14 (Post feed client)

**As a** Tenant User or Tenant-Admin reviewing ingested social posts,
**I want** Facebook posts in the feed and details drawer to clearly indicate which Facebook Page published the post and show the post's author,
**so that** I can easily distinguish content published across our organization's various connected brand/regional Facebook Pages and understand whether a post was authored by a specific creator or by the Page itself.

**Acceptance Criteria**

- **Display Derivation Helpers (`postDisplay.ts`):**
  - `extractFacebookPageContext(rawPayload)` (or equivalent helper) parses `pageId`, `pageName`, `author`, and detects if authorship is identical to the hosting Page (`author === pageName`).
  - `extractAuthor(rawPayload)` cleanly resolves `rawPayload.author` (the true author or page name set by Story 2.23) as the top priority.
- **Post Card Presentation (`PostsFeedClient.tsx`):**
  - For posts where `provider === 'facebook'`, the post card header renders:
    - Platform badge (`Facebook Page`).
    - Explicit hosting Page attribution tag/badge (e.g. `📍 Page: Acme Global`).
    - Author attribution (e.g. `By: John Doe` when the author differs from the Page, or `Acme Global` when published directly as the Page).
- **Post Detail Panel & Slideover (`PostDetailPanel.tsx` & `PostsFeedClient.tsx`):**
  - Renders a prominent **Hosting Facebook Page** row in the Ingestion Telemetry / Details section showing `pageName` and Meta `pageId`.
  - In the Slideover header subtitle, displays `Published on Facebook Page: [Page Name]` alongside publication time.
- **Post Feed Search Matching:**
  - `searchQuery` filter in `PostsFeedClient` matches against `pageName` (in addition to existing `title`, `snippet`, `author`, and key phrases), enabling users to search for posts from a specific Facebook Page.
- **Contract Verification:**
  - Jest contract test in `social-listening-admin/contracts/epic-6/story-6.33.facebook-page-attribution-display.contract.test.ts` asserts:
    - Post card renders hosting Page name and author distinction cleanly.
    - Post detail panel renders hosting Page ID and name in metadata view.
    - Post feed search query filtering matches on Facebook Page name.

**Explicitly out of scope:** Filtering by Facebook Page ID via a dedicated dropdown (future extension); editing Facebook Page connection settings from the feed.

---

## Story 6.34 — Instagram Business Connector Setup, Multi-Account Picker, and Post Feed/Drawer Presentation

**Source:** ADR-0068 (Accepted 2026-08-20) · **Status:** Built 2026-08-21
**Built:** 2026-08-21 — social-listening-admin@986a93c

**Documentation Steward correction, 2026-08-24.** Header read "Ready"/"not yet" despite `docs/implementation-log.md` already carrying a matching build entry (`## 2026-08-21 — Story 6.34... — socialengage@pending`); `986a93c`'s own real diff (new Instagram OAuth/account routes) matches. Corrected directly.
**Depends on:** Story 2.24 (Instagram connector backend in `social-listening-core`), Story 6.3 (Connector connect/disconnect), Story 6.5 (Connector status view), Story 6.14 (Post feed client), Story 6.27 (Multi-asset picker pattern)

**As a** Tenant Administrator or User,
**I want** to connect our organization's Instagram Business and Creator accounts via Meta OAuth, select which accounts to ingest using an account picker modal, monitor connector health on the status screen, and review rich Instagram posts (including carousel galleries and Reels) in the post feed and details drawer,
**so that** our team can easily manage visual brand listening alongside our other social channels.

**Acceptance Criteria**

- **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**
  - Adds `instagram` to `PLATFORMS` definition:
    - `id: 'instagram'`, `name: 'Instagram Business'`, `subtitle: 'Meta Graph API Ingestion Source'`
    - `description: 'Ingests published photos, videos, carousels, and reels directly from your connected Instagram Business and Creator accounts via Meta Graph API.'`
    - `category: 'Ingestion'`, `authMode: 'oauth'`
    - `personalScopeAllowed: true`, `tenantScopeAllowed: false` (Tier-3 user credential)
    - `icon: 'instagram'`, `color: 'pink'` (or gradient-aligned badge)
- **OAuth Connect Flow & Multi-Account Picker Modal (`InstagramAccountPickerModal.tsx`):**
  - Initiates OAuth via `/api/connectors/instagram/connect` with required scopes (`instagram_basic`, `pages_show_list`, `pages_read_engagement`).
  - Upon OAuth callback, queries `GET /me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}`.
  - Displays modal listing all discovered Instagram Business/Creator accounts linked to the user's Facebook Pages, with account avatar, handle (`@username`), parent Facebook Page name, and checkboxes.
  - Submits selected accounts to `/api/connectors/instagram/accounts` (`POST`) to register them in `instagram_connected_accounts`.
- **Connector Status, Health, & Alerts (`/tenant/connectors/status`):**
  - Renders `instagram` in the "Connectors" (Ingestion) section with connected account count.
  - Shows operational telemetry: Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 15m").
  - Displays `reconnect_required` badge (and surfaces global `IngestionAlertBanner`) when Graph API returns errors `190`/`10`/`100`.
  - Gated on credential owner or `tenant_admin`: renders "Re-sync now" button for on-demand polling.
- **Post Feed Card Presentation (`PostsFeedClient.tsx`):**
  - For posts where `provider === 'instagram'`, post card header displays:
    - `Instagram Business` badge.
    - Hosting account badge (e.g. `📍 @acmeglobal`).
    - Publication timestamp.
  - Renders visual media preview if `mediaUrl` or `thumbnailUrl` is available in `rawPayload` (with graceful fallback to canonical link).
  - Displays engagement counters (`❤️ {likeCount}` · `💬 {commentsCount}`).
- **Post Detail Panel & Carousel Gallery (`PostDetailPanel.tsx`):**
  - For `mediaType === 'CAROUSEL_ALBUM'`, renders an interactive or multi-thumbnail carousel gallery derived from `rawPayload.children` (in preserved display order).
  - If `rawPayload.childrenTruncated === true`, displays a subtle "View full gallery on Instagram" link pointing to `url`.
  - Details telemetry row displays **Hosting Instagram Account:** `@username (ID: {igUserId})` and parent Facebook Page name.
- **Contract Verification:**
  - Jest contract test in `social-listening-admin/contracts/epic-6/story-6.34.instagram-connector-ui.contract.test.ts` asserts:
    - Platform definition registers `instagram` with Tier-3 scope and correct metadata.
    - Post card renders hosting handle `@username` and media preview gracefully.
    - Post detail panel renders carousel gallery from `rawPayload.children`.
    - Connector status screen displays operational metrics and `reconnect_required` badge.

**Explicitly out of scope:** Ingesting personal Instagram account timelines; direct publishing/replying from admin UI.

---

## Story 6.35 — LinkedIn Connector Setup Screen, Scope Degradation Badge, and Post Feed/Drawer Presentation

**Source:** ADR-0069 (Accepted 2026-08-20) · **Status:** Built 2026-08-21
**Built:** 2026-08-21 — social-listening-admin@89eb97c

**Documentation Steward correction, 2026-08-24.** Header read "Ready"/"not yet" despite `docs/implementation-log.md` already carrying a matching build entry (`## 2026-08-21 — Story 6.35... — socialengage@pending`); `89eb97c`'s own real diff (new LinkedIn OAuth routes) matches. Corrected directly.
**Depends on:** Story 2.25 (LinkedIn connector backend in `social-listening-core`), Story 6.3 (Connector connect/disconnect), Story 6.5 (Connector status view), Story 6.14 (Post feed client)

**As a** Tenant Administrator or User,
**I want** to connect our organization's LinkedIn member and company accounts via OAuth, view connector operational health and scope availability on the status screen, and view ingested LinkedIn posts in the post feed and details drawer,
**so that** our team can monitor professional network discussions and company page interactions seamlessly.

**Acceptance Criteria**

- **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**
  - Adds `linkedin` to `PLATFORMS` definition:
    - `id: 'linkedin'`, `name: 'LinkedIn'`, `subtitle: 'OAuth Ingestion Source'`
    - `description: 'Ingests published posts, comments, reactions, and company page analytics via LinkedIn REST API.'`
    - `category: 'Ingestion'`, `authMode: 'oauth'`
    - `personalScopeAllowed: true`, `tenantScopeAllowed: false` (Tier-3 user credential)
    - `icon: 'linkedin'`, `color: 'blue'`
- **OAuth Connect & Callback Flow:**
  - Initiates OAuth via `/api/connectors/linkedin/connect`, generating cryptographically secure `state` parameter cached server-side (TTL 10m).
  - Handles callback at `/api/connectors/linkedin/callback`, verifying `state` and linking credential to tenant and user.
- **Graceful Scope Degradation & Status Screen (`/tenant/connectors/status`):**
  - Renders `linkedin` in the "Connectors" (Ingestion) section.
  - If organization scopes (`w_organization_social`, `r_organization_social`) are pending or missing, displays a non-blocking informational badge / callout:
    > *"Organization features unavailable — partner scope approval pending."*
  - Shows operational telemetry: Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 1h").
  - Surfaces `expiring_soon` badge when token is within 7 days of 60-day expiry or refresh token is within 30 days of 1-year ceiling.
  - Displays `reconnect_required` badge and alert banner if token is revoked or refresh fails.
  - Gated on credential owner or `tenant_admin`: renders "Re-sync now" button for on-demand polling.
- **Post Feed Card Presentation (`PostsFeedClient.tsx`):**
  - For posts where `provider === 'linkedin'`, post card header displays:
    - `LinkedIn` badge.
    - Author attribution (e.g. `By: John Smith` or `Acme Corp`).
    - Publication timestamp.
  - Renders body text from canonical markdown.
  - Displays engagement counters (reactions, comments, shares).
- **Post Detail Panel & Drawer (`PostDetailPanel.tsx`):**
  - Details telemetry row displays **Provider:** `LinkedIn`, **Author ID:** `linkedin:{memberId}`, and post permalink.
- **Contract Verification:**
  - Jest contract test in `social-listening-admin/contracts/epic-6/story-6.35.linkedin-connector-ui.contract.test.ts` asserts:
    - Platform definition registers `linkedin` with Tier-3 scope and correct metadata.
    - Post card renders LinkedIn badge, author name, and engagement counts.
    - Status screen displays scope degradation notice when organization scopes are missing.
    - Connector status screen displays operational metrics and `reconnect_required` badge on token revocation.

**Explicitly out of scope:** In-app LinkedIn ad campaign creation; direct message monitoring.

---

## Story 6.36 — Cross-Platform Polypost Composer & Multi-Network Preview Engine

**Source:** ADR-0072 (Accepted 2026-08-22) · **Status:** Built 2026-08-22
**Built:** 2026-08-22 — social-listening-admin@f459114
**Depends on:** Story 6.2 (Role-gated routing shell), Story 6.11 (Post feed)

**As a** Tenant Administrator or Content Marketer,
**I want** a unified, real-time cross-platform social post composition workspace with side-by-side network preview rails, OpenGraph link card scraping, drag-and-drop media attachments with accessibility Alt-Text, document importing, and generative AI copy assistance,
**so that** I can draft, proof, refine, and adapt social content accurately across all target networks without leaving the application.

**Acceptance Criteria**

- **Dedicated Route & Modal Integration:**
  - Standalone page accessible at `/tenant/compose` in the tenant navigation shell.
  - On-demand modal overlay (`ComposePostModal.tsx`) accessible via the "✍️ Compose Post" button on `/tenant/posts`.
- **Synchronous Multi-Network Preview Rails (`PlatformPreviewRails.tsx`):**
  - Renders 7 dedicated, pixel-accurate platform preview cards:
    - **LinkedIn (`LinkedInPreviewCard.tsx`):** Professional avatar header, connection degree badge, 3,000-char tracking, formatted commentary with truncation, media gallery, and interactive OpenGraph link card.
    - **Instagram (`InstagramPreviewCard.tsx`):** Mobile profile header, location chip, aspect-ratio-scaled media container, interactive like/comment action bar, and caption formatting.
    - **Facebook (`FacebookPreviewCard.tsx`):** Page header with verified badge, post message body, rich OpenGraph card, and engagement metrics.
    - **Bluesky (`BlueskyPreviewCard.tsx`):** AT Protocol handle formatting, domain link previews, and strict 300-grapheme counter.
    - **Mastodon (`MastodonPreviewCard.tsx`):** Federated handle layout, optional Content Warning (CW) folding, and 500-char counter.
    - **Threads (`ThreadsPreviewCard.tsx`):** Meta Threads clean typography, reply line styling, and media containers.
    - **X/Twitter (`XPreviewCard.tsx`):** Handle layout, verified badge, circular 280-char progress ring, and link summary cards.
- **Media Upload, Drag-and-Drop, and Accessibility Alt-Text (`PolypostComposer.tsx`):**
  - Toolbar **"📷 Upload Images"** button invoking native file picker (`image/png, image/jpeg, image/webp, image/gif`).
  - Native drag-and-drop file dropzone over the draft text area with visual drop indicators.
  - Image thumbnails with individual editable **"Alt text (for accessibility)"** input fields, file size indicators, and removal controls.
- **Automated OpenGraph Link Card Previews (`CardLinkPreview.tsx`):**
  - Auto-detects URLs within post text and asynchronously scrapes OpenGraph metadata (`og:title`, `og:description`, `og:image`, `og:site_name`).
  - Displays rich visual card preview across LinkedIn, Facebook, X, and Bluesky preview rails with graceful fallback.
- **Document & Markdown File Importer (`documentImport.ts`):**
  - Imports `.md`, `.markdown`, `.txt`, and `.docx` (Microsoft Word) files directly into the active draft.
  - Provides options to **"Replace Draft"** or **"Append to Draft"**.
- **Multi-Draft Management & Resilient Local Autosave (`draftStorage.ts` & `DraftHistoryDrawer.tsx`):**
  - Multi-draft tabs allowing authors to create, switch, rename, duplicate, and delete concurrent drafts.
  - Debounced (500ms) automatic persistence to browser `localStorage` isolated per tenant (`socialengage:drafts:${tenantId}`).
- **Azure OpenAI Copywriter Assistant (`/api/ai/compose-assist`):**
  - Provides pre-engineered generative AI prompts: Fix Spelling & Grammar, Make Concise, Generate Viral Hook, Expand & Elaborate, Professional Tone, and Hashtag Suggestions.
  - Displays real-time suggestions with one-click **"Apply to Draft"** or **"Discard"** options.

**Explicitly out of scope:** Direct automated scheduled posting (social network write APIs / webhooks); paid ad placement.

---

## Story 6.37 — Post Feed and Post Detail Facebook Page & Matched Watchlist Attribution

**Source:** ADR-0067 (Accepted 2026-08-20; amended 2026-08-22) · **Status:** Built 2026-08-22
**Built:** 2026-08-22 — social-listening-admin@b40041f (core half: social-listening-core@b40041f)

**As a** Tenant Administrator or Content Analyst,
**I want** the post feed and detail drawer to show the hosting Facebook Page for a post and the watchlist that matched it,
**so that** I can trace a post back to its source Page and the listening target that surfaced it without opening the raw payload.

**Acceptance Criteria**
- `page.tsx` loads the caller's own connected Facebook Pages via `listFacebookPages()` and passes the list as a `facebookPages` prop to `PostsFeedClient` and `PostDetailPanel`.
- `extractFacebookPageContext()` resolves the hosting Page for a Facebook `rawPayload` using, in order, explicit `pageId`/`pageName`, the `from` object, the `externalId` prefix, the caller's connected Pages list, and the post URL.
- The post feed shows `Page: <PageName>` for a Facebook post and, when a distinct author is present, the author name.
- The post detail panel shows a clickable link to the hosting Facebook Page, the page id, and a distinct author when present.
- `extractWatchlistId()` and `flattenPost()` resolve the matched watchlist for any post from `watchlistId`, `discoveringWatchlistId`, `matchedWatchlistId` (and legacy snake_case) in `rawPayload`, falling back to a local term-match search against the caller's own watchlists scoped by platform.
- The post feed and detail panel render a `Matched Watchlist: <watchlistName>` chip that links to `/tenant/watchlists`.
- `pollWikipedia.ts` in `social-listening-core` denormalizes `watchlistId` and `discoveringWatchlistId` onto the `rawPayload` of ingested Wikipedia revisions when the revision title matches a watchlist term, so the watchlist chip renders without client-side re-derivation.

**Explicitly out of scope:** Server-side watchlist-to-post matching (this story uses client-side fallback for legacy posts only); backfilling watchlist attribution for posts ingested before this change; outbound Facebook publishing.

---

**Documentation Steward correction, 2026-08-19.** Ten stories in this epic — 6.8, 6.14, 6.18, 6.19, 6.20, 6.21, 6.22, 6.23, 6.25, and 6.26 — each already carried a correct, real `**Built:**` field naming a real shipped commit (6.8: `social-listening-admin@6b7fc00`; 6.14: `@a27aa10`; 6.18: `@a97cf30`; 6.19: `@4f099a6`/core `@aa4f317`; 6.20: `@be1764d`/core `@e9d797f`; 6.21: `@21c30bf`; 6.22: `@8182706`; 6.23: `@535338f`; 6.25: `@6550716`; 6.26: `@03c37c9` — every hash confirmed directly against `docs/implementation-log.md`'s own matching entries), but each story's own `**Status:**` line still read "Ready," giving no hint of that from the fixed-shape header alone — the same class of drift `docs/user-stories/README.md`'s "Built convention" (added 2026-08-13) already names for Stories 5.18/6.7. For 6.23/6.25/6.26 specifically, the `**Built:**` field was placed *before* the `**Source:**/**Status:**` line rather than after it, the inverse of every other story's own ordering in this file — a likely reason this specific instance wasn't already caught by casual visual scanning. All ten Status lines now read "Built <date>," matching each story's own `**Built:**` field and the Log; no Acceptance Criteria text changed. (Story 6.8's own narrative context — a 2026-08-10 original build, `**Built:**` field date backfilled 2026-08-17 per the field's own forward-only, single-commit convention — is unaffected; only the Status word itself was stale.)

---

## Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab

**Source:** ADR-0073 (Accepted 2026-08-22) · **Status:** Ready
**Built:** 2026-08-23 — social-listening-admin@ae5d16a

**As a** Tenant User or Tenant-Admin,
**I want** to click "Reply" on a post, compose the reply in a drawer, and see it listed,
**so that** I can engage with my own posts without leaving the SocialEngage admin UI.

**Acceptance Criteria**

1. `PostDetailPanel` shows a "Reply" button only when the post's `provider_id` is supported *and* the caller has an active Tier-3 credential for that provider. Otherwise the button is disabled with a tooltip explaining the missing credential.

2. Clicking "Reply" opens a cascading `ReplyComposerDrawer` (same slide/push pattern as `EnrichmentEditDrawer`) with a text composer reusing `PolypostComposer`'s platform-aware text area and character counter. Media upload and AI assist are disabled for v1 replies.

3. Submitting the reply calls `POST /v1/posts/:id/replies`. On `201 Created` the drawer closes, the reply is optimistically appended to a new "Replies" tab, and a success toast appears. On failure an error toast appears and the row is shown with status `failed`.

4. A "Replies" tab in `PostDetailPanel` fetches `GET /v1/posts/:id/replies` and displays each reply's body, `sent`/`failed` badge, timestamp, and a link to the live reply (`externalUrl`) when `status === 'sent'`.

5. The component handles loading, empty, and error states; empty state reads "No replies yet."

6. Jest page/contract test asserts: button hidden for unsupported/unconnected providers, composer submits and updates the list, and failed replies display the error status.

**Explicitly out of scope:** Media/attachment replies; editing or deleting sent replies; bulk reply; Instagram/LinkedIn-specific UI differences (use the generic composer for v1).

---

## Story 6.39 — Polypost Composer Real Publish Flow

**Source:** ADR-0075 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 3.15 (`POST /v1/outbound/posts` endpoint), Story 2.29 (Facebook Page `publish()`)

**As a** Tenant User or Tenant-Admin,
**I want** the Polypost Composer's Publish button to create real outbound posts on my selected Facebook Pages instead of simulating,
**so that** the posts I author in the composer actually go live on the platform.

**Acceptance Criteria**

1. `src/lib/core-client.ts` gains `publishPost(payload): Promise<{ rows: OutboundActivity[]; status: number }>` calling `POST /v1/outbound/posts`, and a same-origin proxy `src/app/api/outbound/posts/route.ts` is added to attach the session and forward to core.
2. `PolypostComposer.tsx` is updated: the `PublishTargetsDialog` collects selected Facebook Page `targetAssetId`s and the `handleConfirmPublish` function calls `publishPost()` with the composer state (text, overrides, selected Pages, optional link preview). On `201`/`207` the dialog closes and a per-Page status toast/list is shown; on `422`/`429`/`5xx` a per-Page error toast is shown.
3. Non-Facebook selected platforms (LinkedIn, etc.) are rendered in the `PublishTargetsDialog` as disabled with an explanatory note until their connector `publish()` is implemented (Story 2.30 and later).
4. The success message lists the actual `external_url` for each successfully published Page, or the normalized `error_code` for each failed one.
5. The composer still validates platform selection and content before opening the dialog, and `handleOpenPublishDialog` now also fails early if no active Facebook Pages are available.
6. Jest contract test asserts that `PolypostComposer` renders the platform-aware publish button and that the `PublishTargetsDialog` is wired to a `publishPost`-shaped fetch, either by source inspection or a server-renderable mock that does not call real networks.

**Explicitly out of scope:** Scheduled posts (the UI can still capture a `scheduleDate` but the API uses it only if the backend scheduler exists); image media upload in published posts; outbound post history screen; editing/deleting sent posts; LinkedIn publish in the composer (Story 2.30 and a follow-up UI story).

---

## Story 6.40 — Tenant settings screen: styled workspace profile, export actions, and offboarding link

**Source:** ADR-0074 (Accepted 2026-08-23) · **Status:** Ready — depends on Story 3.16 (backend endpoints)
**Built:** not yet
**Depends on:** Story 3.16 (`/v1/tenants/me/export/workspace` and posts CSV), existing `GET /v1/tenants/me` (Story 1.8), existing `/tenant/settings/delete` (Story 6.13)

**As a** Tenant-Admin or tenant user,
**I want** the Tenant Settings page to present workspace metadata in styled cards and offer real export/offboarding actions,
**so that** the Google AI Studio design is implemented using only real `social-listening-core` data.

**Acceptance Criteria**

1. The `/tenant/settings` page renders the tenant's `name`, `domain`, `activeSeatCount`/`licenseSeatCount` (as "N of M active"), and `createdAt` inside a styled "Workspace Configuration" card, using only `getMyTenant()` data. No mock/fallback values are used.

2. The page is gated only on the ordinary `'tenant'` shell (Story 6.2) and remains visible to both `tenant_admin` and `tenant_user`. The offboarding/decommission section is rendered only when `session.identity.role === 'tenant_admin'`, linking to the existing `/tenant/settings/delete` page (Story 6.13) — a role-gated affordance, not a role gate on the page itself.

3. Two export buttons are offered: "Export Full Workspace (JSON)" and "Export Matched Posts (CSV)". They initiate downloads from the real `social-listening-core` endpoints built by Story 3.16. They are disabled with an explanatory state (not hidden) when the endpoints are unreachable or the caller lacks `tenant_admin` role for the full-workspace export.

4. The export buttons are not implemented through any client-side `useApp()` context or `exportTenantData()` helper; they are real links/proxy handlers via `core-client.ts` (ADR-0036 §2), using the session bearer token server-side or a same-origin proxy.

5. The `createdAt` date is formatted with `toLocaleDateString()`; `domain` renders as plain text, with a fallback to "—" when null.

6. Jest contract test asserts: the page renders all workspace metadata; `tenant_admin` sessions see the offboarding card and workspace export button; `tenant_user` sessions see the settings page but are not offered the full-workspace export or offboarding link; no `<form>`/`<input>` edit affordance exists.

**Explicitly out of scope:** Editing tenant metadata; client-side `lucide-react` icons unless the dependency is added separately; workspace export for `tenant_user`; any behavior that does not map to a real `social-listening-core` endpoint.

---

## Story 6.41 — Composer Deep Research panel UI

**Source:** ADR-0076 (Accepted 2026-08-23) · **Status:** Ready — depends on Story 3.17
**Built:** not yet
**Depends on:** Story 6.36 (Polypost Composer), Story 3.17 (`POST /v1/composer/research`)

**As a** tenant user,
**I want** a "Deep Research" button and panel inside the Polypost Composer,
**so that** I can compare my draft post against the public conversation surfaced by the deep research agent.

**Acceptance Criteria**

1. `PolypostComposer.tsx` gains a new toolbar button labeled **"Deep Research"** (to the right of the existing AI assist and document-import controls). It is disabled when the draft text is empty or too short (< 10 non-whitespace characters).

2. A new `DeepResearchPanel.tsx` renders below the editor text area when the user triggers research. It displays:
   - a collapsible list of `keyPhrases` and `relatedTopics`,
   - the `contextSummary` as formatted Markdown,
   - the `comparison` as formatted Markdown,
   - an expandable `sources` list with `title`, `snippet`, and `url` (external link).

3. A new same-origin proxy route `POST /api/composer/research` attaches the session bearer token and forwards the request to `POST /v1/composer/research` in `social-listening-core`.

4. The panel handles the three main states: `loading` (with a spinner and cancel timeout), `error` (422 `AI_PROVIDER_NOT_CAPABLE`, 422 `SEARCH_PROVIDER_UNAVAILABLE`, network/5xx, with actionable helper text), and `success` (rendering the result).

5. The button is disabled with a tooltip for `platform_admin` sessions, preserving the zero-tenant-content boundary. The composer page itself remains visible to all roles.

6. The research result is not persisted to `localStorage` draft state. It is ephemeral and disappears when the user closes the panel or refreshes the page.

7. Jest contract test asserts: the "Deep Research" button is present in `PolypostComposer`; `DeepResearchPanel` renders all `ComposerResearchResult` fields when given a mock result; the proxy route is wired to `POST /v1/composer/research`; and the component tree does not call `fetch` during synchronous render.

**Explicitly out of scope:** Media analysis; real-time research updates; research history/permalink; client-side `lucide-react` icons unless the dependency is added separately.



