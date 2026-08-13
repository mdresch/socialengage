---
name: tenant-owned-feed-connector
description: The tenant-owned-domain RSS/content-feed SocialConnector (ADR-0050) — DNS TXT domain-ownership verification gate, then poll/normalize like any other connector, domain-as-Author. Read this before touching src/connectors/tenantOwnedFeed/**, src/http/versions/v1/tenantOwnedFeedRouter.ts, or the tenant_owned_feed_activations table.
---

# Tenant-owned-feed connector

## What this is

The fourth real, non-example `SocialConnector` (ADR-0050) and the first where the tenant is both operator and content publisher: a tenant proves they control a domain via a DNS TXT record challenge, then SocialEngage polls that domain's own RSS/Atom feed — no vendor, no API key, no third-party content source. `Author` resolves to the verified domain itself (organization-as-Author, ADR-0004's now-generalized clause), never an individual. Structurally distinct from Newswire (third-party wire feeds) and GNews (third-party news API): this is the first connector with a domain-ownership trust gate at all.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0050 | Tenant-owned-domain connector selection: `providerId: tenant-owned-feed`, `authMode: 'none'`, `deliveryMode: 'poll'`, DNS TXT verification required (durable, not optional), domain-as-Author, verified domain need not match `tenants.domain` (ADR-0031) | 2.11 |
| ADR-0004 (Supersession update, 2026-08-11) | The generalized "organization-as-Author" clause this connector cites, rather than arguing the exception from scratch — the third connector (after Newswire/ADR-0024, GNews/ADR-0026) to need it | 2.11 |
| ADR-0048 | This connector's own registration proof — see Story 2.10's own contract, which greps for `tenant-owned-feed`'s providerId literal same as every other real connector | 2.10 (proves), 2.11 (subject) |
| ADR-0021 | `supportedQueryFeatures: []` — whole-query post-fetch matching fallback, same as Newswire | 3.6 |
| ADR-0053 | `ParsedFeedItem` gains RSS-shaped (`description`/`contentEncoded`) and Atom-shaped (`summary`/`content`) body fields plus `rawXml`; `ingestTenantOwnedFeedItems()` populates `body_markdown`/`body_markdown_version` via the shared `htmlToMarkdown()` utility and composes `enrichmentText` as `[title, body_markdown].filter(Boolean).join('. ')`, replacing the previous title-only `enrichPost()` call | 3.10 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts` — registered connector shape; `POST .../connect` response shape (`txtRecordHost`/`txtRecordValue`/`expiresAt`); polling never begins while `pending`; `POST .../verify-domain` both outcomes (match → verified; no match/missing → pending, not a hard failure); a real poll cycle against a real feed produces `SocialPost` rows once verified; `Author.externalAuthorId` is the verified domain, `followerCount` unpopulated; no historical backfill; `feedUrl` required, no autodiscovery; a verified domain need not match `tenants.domain`; `supportedQueryFeatures` empty + fallback matching; every fetch sets a real, inspectable `User-Agent` header (proven against a real local HTTP server, not assumed); idempotent re-poll across two consecutive cycles.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — this connector's own `providerId` literal (`'tenant-owned-feed'`) is absent from every designated core file.
- `contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts` — `feedItemParser.ts`'s widened RSS+Atom body fields and `rawXml` (against RSS and Atom fixtures, not a live fetch); `ingestTenantOwnedFeedItems()`'s richest-field precedence (identical to Newswire's own), `body_markdown`/`body_markdown_version` population via `ingestTenantOwnedFeedItems()` directly, `raw_payload.rawXml` propagation, and the new `enrichmentText` composition. See `.claude/skills/canonical-markdown-conversion/SKILL.md` for the shared conversion pipeline itself.

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector.ts` (the connector object, `providerId: TENANT_OWNED_FEED_PROVIDER_ID`), registered via `registerSocialConnector()` the same way GNews/Newswire are (test-only today — see `provider-connector-framework/SKILL.md`'s own note that `registerSocialConnector()` has no real production call site yet for any `SocialConnector`).
- **Extension points used:** the `SocialConnector` interface (`src/connectors/types.ts`), `runIngestionAttempt()`'s generic `attempt()` callback shape, and — uniquely for this connector — a dedicated router (`tenantOwnedFeedRouter.ts`) mounted at its own path in `router.ts`, deliberately never added as routes inside the shared `connectorsRouter.ts`. No other core file was touched to add this connector.
- **No-core-change verification:** `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` mechanically greps every designated core file for the literal string `tenant-owned-feed` and fails if found.

## Data Model

```sql
-- migrations/0026_create_tenant_owned_feed_activations.sql
tenant_owned_feed_activations
  id                  UUID PK
  tenant_id           UUID
  domain              TEXT        -- tenant-supplied; need not match tenants.domain (ADR-0050 §5)
  feed_url            TEXT        -- tenant-supplied, explicit — no autodiscovery (v1 scope)
  verification_token  TEXT
  txt_record_host     TEXT        -- _socialengage-verify.<domain>
  status              TEXT        -- 'pending' | 'verified' | 'expired'
  token_expires_at    TIMESTAMPTZ -- 7-day TTL (implementation default)
  verified_at         TIMESTAMPTZ
```

RLS tenant-scoped, same pattern as every other tenant table. No uniqueness constraint on `(tenant_id, domain)` — a tenant may hold more than one row (ADR-0050 Open Question 2, storage-level support only; no multi-domain UX built here).

## How to extend this safely

- **Changing TXT record host-level scoping** (ADR-0050 Open Question 1 — currently subdomain-level, `_socialengage-verify.<domain>` at whatever domain the tenant supplied): `buildTxtRecordHost()` in `dnsVerification.ts` is the one place this is decided.
- **Changing token TTL / re-check cadence / poll interval**: `TOKEN_TTL_MS` (`dnsVerification.ts`), the Admin UI's own re-check polling schedule (not enforced server-side — `verify-domain` is a synchronous, on-demand check, not a background job), and `getRateLimitConfig()` (`tenantOwnedFeedConnector.ts`) respectively — all named implementation defaults in ADR-0050's own Amendment Log, not fixed by this story.
- **Multiple domains/feeds per tenant** (ADR-0050 Open Question 2): the storage model (no per-tenant uniqueness constraint) and `pollTenantOwnedFeed()` (iterates every verified activation, not just one) already support this — no schema change needed if/when the Admin UI adds multi-domain management.
- **Respecting a feed's own `<ttl>` hint as a poll-interval floor** (ADR-0050 Open Question 4): not implemented — `getRateLimitConfig()` returns a fixed 30-minute window regardless of what the feed itself advertises.

## Load-bearing constraints — do not change casually

- **Polling a `pending` or `expired` activation must never happen.** `pollTenantOwnedFeed()` only ever iterates `getVerifiedActivations()`'s own result — a query filtered to `status = 'verified'` at the SQL layer, not a runtime check inside the fetch loop. Don't "optimize" this into fetching all activations and filtering in application code; the DB-layer filter is the actual guarantee this story's AC3 depends on.
- **`checkTxtRecord()`'s `resolveTxt` parameter is a real, un-mocked default (`dns.promises.resolveTxt`) with an injectable override used in exactly one test** (the "record matches" success path — this project has no domain it can publish a real, controllable TXT record for). Every other DNS-lookup test in this component's own contract uses the real resolver against a real domain. Don't widen this seam to cover cases that CAN be proven against real DNS (e.g., "no record" — a real lookup against a domain that genuinely has none).
- **`registry.ts`, `runIngestionAttempt.ts`, and every other file in Story 2.10's own `CORE_FILES` list must never reference `'tenant-owned-feed'` as a literal.** This connector's own two HTTP routes (`connect`, `verify-domain`) are a *separate* router (`tenantOwnedFeedRouter.ts`), mounted at `/connectors/tenant-owned-feed` **before** the generic `/connectors` mount in `router.ts` — never added as routes inside `connectorsRouter.ts` itself, which would both violate ADR-0048 and (since Express resolves `/:platformId/connect` as a wildcard match) never actually be reachable anyway once the generic router's own route claimed the path first.
- **`Author.externalAuthorId` is the verified `domain`, fixed per activation — never derived from a per-item field.** RSS's own `<author>` element (when present at all) is an individual's email address, not an organization identity; this connector never reads it.
- **Every outbound feed fetch sets `TENANT_OWNED_FEED_USER_AGENT`.** Unlike Newswire/GNews (which predate this requirement and don't set one — a separate, pre-existing gap, not fixed here), ADR-0050 explicitly names this as an AC for this connector specifically.
- **`enrichPost()`'s text argument is no longer bare `item.title` (Story 3.10, 2026-08-13)** — it's `[item.title, bodyMarkdown].filter(Boolean).join('. ')`, where `bodyMarkdown` is the richest of `item.contentEncoded`/`item.content`/`item.description`/`item.summary`, converted via `htmlToMarkdown()` and collapsed to `undefined` when empty. Don't revert to bare `title`.
- **A single `??` precedence chain covers both RSS and Atom shapes for one item** (`contentEncoded ?? content ?? description ?? summary ?? null`) — safe because a given item only ever populates one format's own fields; the "wrong" format's fields stay `null` from `feedItemParser.ts` itself. Don't add per-format branching here; the parser's own shape already makes it unnecessary.

## Known gaps / deferred work

- **No autodiscovery** — `feedUrl` must be supplied explicitly (ADR-0050's own v1 scope decision, Open Question 3 names third-party CMS-hosting ToS considerations as a related, unresolved question).
- **No admin-UI screens** — `connect`/`verify-domain` are REST endpoints only; the two-step "publish TXT record, then click verify" UX and the pending-state re-check polling loop are Epic 6 UI work, not built here.
- **`<ttl>` feed hint not respected** — see "How to extend this safely" above.
- **No individual per-item author identity** — see ADR-0050's own Consequences; a CMS-specific API integration or a separate Author-identity-resolution ADR would be needed, out of scope here.
- **Token expiry (`status = 'expired'`) is a stored state, but nothing yet transitions a `pending` row past its `token_expires_at` into `expired`** — no scheduled job exists; `verify-domain` would currently keep returning `pending` indefinitely for a token that's actually expired rather than surfacing that distinction. Named here as a real, not-yet-built gap.

## Relations to other components

- **`provider-connector-framework`**: implements `SocialConnector`, registered the same way GNews/Newswire are.
- **`connector-health-and-error-handling`**: `fetchTenantOwnedFeed()`'s `ClassifiableError` reclassification follows the exact pattern that SKILL.md prescribes.
- **`social-post-lineage`**: `ingestTenantOwnedFeedItems()` calls `upsertAuthor()`/`insertSocialPost()` the same way every other real connector does.
- **`watchlist-matching`**: `supportedQueryFeatures: []` means every watchlist against this connector falls back to whole-query post-fetch matching (ADR-0021).
- **`canonical-markdown-conversion`**: `ingestTenantOwnedFeedItems()` calls the shared `htmlToMarkdown()` utility, same as Newswire and GNews.
