---
name: facebook-connector
description: The real Facebook SocialConnector (Meta Graph API, a tenant's own connected Page's own posts only, Tier 3/user-bound credential) — this project's first authMode:'oauth' connector. Read this before touching src/connectors/facebook/**, src/http/versions/v1/facebookOAuthRouter.ts, or before adding a second OAuth-based connector.
---

# Facebook connector — the first `authMode: 'oauth'` connector

## What this is

`facebookConnector.ts`/`pollFacebook.ts` ingest a tenant's own connected Facebook Page's own published posts via the real Meta Graph API (`GET /{page-id}/feed`) — never comments, never mentions, never public content the tenant doesn't own. `facebookOAuthRouter.ts` is the dedicated backend half of the real OAuth connect flow: exchanging an authorization code for a long-lived Page access token and storing it as a Tier 3 (user-bound) credential, never Tier 2. This is the narrowed scope ADR-0059 landed on after finding genuine public-content social listening is not buildable against Meta's current API at all — see that ADR's own Decision §1.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0059 | Facebook connector narrowed to a tenant's own connected Page, posts only; Tier 3 (user-bound) credential only, no Tier 2 path; organization-as-Author; a distinct `reconnect_required` health state for credential-invalidation | 2.15 |
| ADR-0028 §3 | Tier 3 credential ownership — user-activated only, never created by Tenant-Admin | 2.15 (the operative test this connector's credential tier is checked against) |
| ADR-0004 | Organization-as-Author clause (2026-08-11 generalization) — this connector is a real, fourth instance, argued explicitly (ADR-0059 Decision §5), no new Pending-supersession note needed | 2.15 |
| ADR-0052 §6 | Real Tier-3 poll scheduling (`poll(tenantId, userId)`) named as future, not-yet-built work — this connector is the first real consumer that would need it | not yet built (see Known gaps) |

## Contracts that constrain this component

- `contracts/epic-2/story-2.15.facebook-connector.contract.test.ts` — a registered `SocialConnector` (`authMode: 'oauth'`, `deliveryMode: 'poll'`, distinct `providerId`) targeting the real Graph API Page-feed endpoint, registered with no core pipeline change; the dedicated OAuth router stores a real Tier 3 credential (`owner_type = 'user'`, tied to the caller's own resolved `userId`, never a client-supplied one) — the generic `POST /:platformId/connect` rejects this platform outright, closing the only possible Tier-2 bypass; only the Page's own posts are ever fetched (no comment/mention endpoint referenced); `Author` resolves to the Page with a real, populated `followerCount`; `supportedQueryFeatures` is empty; `getRateLimitConfig()` returns an explicitly-labeled placeholder; a credential-class (401/403) failure surfaces `ConnectorHealth.status === 'reconnect_required'`, distinct from an ordinary non-credential failure; two consecutive real poll cycles produce no duplicate `SocialPost` rows. The OAuth code-exchange step itself is proven against a mocked Meta boundary (no real interactive authorization code is obtainable non-interactively); everything else runs against real Graph API infrastructure (a real Meta Developer App and a real test Page).
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves `FACEBOOK_PROVIDER_ID` (`'facebook'`) appears nowhere in any core ingestion/orchestration file (ADR-0048 §1).

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/facebook/facebookConnector.ts` (the connector object), `src/connectors/facebook/pollFacebook.ts` (its own poll function, invoked directly — never through the scheduler yet, see Known gaps), wired into `bootstrapConnectors.ts` via a plain `registerSocialConnector(facebookConnector)` call — deliberately **not** the `{...connector, poll, pollCadenceMs}` wrapper every other poll-mode connector uses (see Load-bearing constraints).
- **Extension points used:** the `SocialConnector` interface (`src/connectors/types.ts`), `registerSocialConnector()` (`src/connectors/registry.ts`), and a new dedicated router (`facebookOAuthRouter.ts`) mounted at `/v1/connectors/facebook/oauth` — the same "more specific path before the generic `/connectors` mount" pattern `tenantOwnedFeedRouter.ts` already established for its own structurally-different connect flow.
- **No-core-change verification:** `contracts/epic-2/story-2.10...contract.test.ts` mechanically greps every designated core file for the literal string `facebook` and fails if found.

## How to extend this safely

- **A new field from the Page-feed response**: extend `FacebookPagePost`'s interface and the `fields=` query param in `fetchFacebookPagePosts()` together — deliberately request only what `normalize()`/Author-modeling actually consume, never a broader field set that could pull in comment-shaped data incidentally (ADR-0059 Decision §5's own author-rights boundary).
- **Comment/mention ingestion, if ever built**: this is a real, deliberately deferred v2 design question (ADR-0059 Decision §5's own unresolved third-party personal-data/author-rights question) — needs a `docs/legal/legal-compliance-register.md` pass first, not just a code change. Don't add a `/comments` call here without that.
- **A second OAuth-based connector**: the ephemeral session-cache pattern in `facebookOAuthRouter.ts` (an in-process, short-TTL `Map` keyed by a single-use `sessionToken`, holding real provider tokens server-side only) is a reasonable template — but check whether the new provider's own OAuth mechanics (refresh tokens, token lifetimes, multi-step account selection) actually match this shape before copying it wholesale.

## Load-bearing constraints — do not change casually

- **`facebookConnector` is registered with no `.poll`/`.pollCadenceMs` properties at all — deliberately.** The live-ingestion-polling-scheduler (ADR-0052) only enumerates `ownerType: 'tenant'` activations; this connector is Tier-3-only by design (ADR-0059 Decision §4) and can never have a tenant-wide one. `pollScheduler.ts`'s own `if (connector.poll && connector.pollCadenceMs !== undefined)` guard safely skips any connector missing either property — this is not a workaround, it's the correct behavior until real Tier-3 scheduler support exists (see Known gaps). Do not add a `.poll` wrapper here without first building that scheduler support — a wrapper with the wrong signature (`poll(tenantId)`, no `userId`) would either crash or silently poll nothing.
- **The credential tier is Tier 3, always — `getLatestCredentialId`/`readCredential`/`storeCredential` are only ever called with `ownerType: 'user'` for this `providerId`, never `'tenant'`.** `connectorsRouter.ts`'s generic `POST /:platformId/connect` rejects `authMode: 'oauth'` platforms outright (both `ownerType` values) — this is the actual enforcement mechanism for ADR-0059 Decision §4's "no Tier 2 path at all" rule; removing that guard would reopen a real bypass.
- **The OAuth exchange endpoint never returns a Page's own access token to the caller — only `id`/`name`/`category`.** The real token is cached server-side only (the in-process `sessions` Map in `facebookOAuthRouter.ts`), keyed by a random, single-use `sessionToken`, and is only ever written to storage (via `storeCredential`) inside `/select-page`, never round-tripped through the client. This is ADR-0036's "no bearer token in browser JS" posture, applied to Meta's own tokens.
- **`deriveConnectorHealth()`'s `reconnect_required` check looks only at the single most recent run (`runs[0]`, already ordered DESC).** A later successful run naturally becomes `runs[0]` and clears the status — don't scan further back or add a "sticky until manually cleared" mechanic; that would misrepresent a tenant who already reconnected as still needing to.
- **`is_credential_failure` (migration `0032`) is computed once, at the exact two `completeIngestionRun({status:'failed'})` call sites in `runIngestionAttempt.ts`, using the already-existing `isCredentialError()` classification — not a new, parallel error-inspection path.** Any future connector whose failures should also surface `reconnect_required` gets this automatically, for free, the moment it throws `ClassifiableError('http_401'|'http_403', ...)` — no per-connector wiring needed.

## Known gaps / deferred work

- **No real, automatic Tier-3 poll scheduling exists.** `pollFacebook(tenantId, userId)` works correctly when called directly (proven by this story's own contract) but nothing in the real running server calls it on a schedule — ADR-0052 Decision §6 already named this exact gap (`poll(tenantId, userId)`, a `RequestGate` key of `(tenantId, userId, providerId)`) as future, not-yet-built work, before this connector even existed. Real production ingestion for this connector requires either that scheduler extension or a manual/cron-external trigger — neither is built here.
- **`getRateLimitConfig()` returns a conservative, explicitly-labeled flat placeholder (200 requests/24h), not the real per-Page number.** ADR-0059 Decision §4's own confirmed ceiling (4,800 × the Page's own Engaged Users) is genuinely per-Page dynamic; `ProviderConnector.getRateLimitConfig()` is synchronous/zero-arg with no credential context to resolve a specific Page's real Engaged Users at that call site. A real per-connector-instance rate-limit shape is named, not designed, in ADR-0059's own Open Questions.
- **Comment/mention ingestion is not built** — ADR-0059 Decision §5's own deferred third-party author-rights question, needs a dedicated legal pass first.
- **`deliveryMode: 'push'` via Meta's Page Webhooks is not built** — ADR-0059's own named, confirmed-feasible v2 enhancement.
- **OAuth token re-consent/rotation UX beyond the `reconnect_required` health signal itself is not built** — a tenant sees the status change, but nothing yet drives them back through the reconnect flow automatically; that's Story 6.23's own job (a separate, not-yet-built Admin UI story).
- **SocialEngage's own Meta App has not actually been submitted for Business Verification/App Review.** This story's own contract runs against the degenerate "Menno-administered test Page" case ADR-0059 Decision §3 itself names as not requiring either — onboarding any real, unaffiliated tenant's Page is still gated on both, separately from this code existing.

## Relations to other components

- Calls `runIngestionAttempt()` (`ingestion/runIngestionAttempt.ts`) via `pollFacebook()`, `upsertAuthor()`/`insertSocialPost()`/`findSocialPostByExternalId()` (`social-post-lineage`), `enrichPost()` (`azure-ai-language-connector`/`azure-openai-connector`), `htmlToMarkdown()` (`canonical-markdown-conversion`), `acquireForProvider()` (`provider-connector-framework`), `listActiveWatchlistsForTenant()`/`publishSocialPostIngestedEvents()` (`ingestion-events`) — the identical call shape every other real connector's own ingest function already uses, verified directly by this story's own contract, not only in isolation.
- `facebookOAuthRouter.ts` calls `storeCredential()`/`setConnectorActivation()` (`credential-envelope-encryption`/`connector-activation`) directly — the same underlying storage mechanism `connectorsRouter.ts`'s generic `/connect` endpoint uses, just via its own dedicated router rather than that shared one.
- `connectorHealth.ts`'s new `reconnect_required` derivation is read by anything that already calls `deriveConnectorHealth()`/`getCachedConnectorHealth()` — no new call site was added, the existing `GET /v1/connectors/:platformId` endpoint (`connector-health-and-error-handling`/`derived-data-caching-and-refresh`) surfaces it automatically.
