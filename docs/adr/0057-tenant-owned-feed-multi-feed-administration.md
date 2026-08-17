# ADR-0057: Multi-feed administration for the tenant-owned-feed connector — list, edit, and remove, resolving ADR-0050 Open Question 2

**Status:** Proposed

**Source:** Resolves [ADR-0050](0050-tenant-owned-domain-rss-content-feed-connector.md)'s own Open Question 2 — *"Multiple-domain and multiple-feed support per tenant... is an implementation question — the verification-state storage model above supports it conceptually, but the UX and the per-domain `Author` identity separation need explicit design at Story time"* — left open at that ADR's acceptance (2026-08-11) and never picked up since. Requested directly by Menno, 2026-08-17: *"what needs to change to enable the feeds to be administered?"*, followed by *"let's build the new ADR."*

---

## Context

### The storage layer already anticipated this; nothing built on top of it did

`migrations/0026_create_tenant_owned_feed_activations.sql`'s own header comment states this plainly: *"A tenant may hold more than one row (multiple verified domains) — no uniqueness constraint forces one row per tenant; ADR-0050 Open Question 2 leaves multi-domain UX unresolved, but the storage model already supports it."* Verified directly, not assumed:

- No uniqueness constraint on `(tenant_id, domain)` or `(tenant_id, feed_url)` — `createActivation()` (`tenantOwnedFeedStore.ts`) always `INSERT`s a fresh row.
- `getVerifiedActivations(tenantId)` already selects **every** `status = 'verified'` row for a tenant, not one.
- `pollTenantOwnedFeed.ts` already iterates the full result of `getVerifiedActivations()` — the poller has supported multiple feeds per tenant since Story 1.13's scheduler first called it.

**Nothing above the storage layer exposes this.** `tenantOwnedFeedRouter.ts` has exactly two routes:

```
POST /v1/connectors/tenant-owned-feed/connect       — create one activation
POST /v1/connectors/tenant-owned-feed/verify-domain — verify one activation by id
```

No `GET` (list, or even fetch-one-by-id — `getActivation()` exists at the store level but is never mounted as an HTTP route, called only internally by `verify-domain`), no `PATCH`, no `DELETE`. `TenantOwnedFeedSetup.tsx` (`social-listening-admin`) mirrors this: a single-activation client-state machine (`activation`/`activationId` state) that, once one feed reaches `verified`, renders a terminal "connected and active" view with no path back to the connect form. A tenant who wants a second feed has no way to reach it through the product.

This component's own `SKILL.md` (`social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md`) already names two matching gaps under "Known gaps": *"no schema change needed if/when the Admin UI adds multi-domain management"* (confirming the schema was deliberately built ahead of this exact need) and *"No admin-UI screens [beyond connect/verify]."*

### A real, pre-existing role-gating inconsistency, found while investigating this gap

`connect` and `verify-domain` both authorize via bare `requireTenantUser()` — resolving only `tenantId`, with **no role check**. Confirmed directly by reading `tenantOwnedFeedRouter.ts` in full: neither handler ever reads `identity.role`. This means any `tenant_user` — not just `tenant_admin` — can today register a domain-ownership claim and feed URL on behalf of the whole tenant.

Every other tenant-wide connector action in this codebase is `tenant_admin`-only, confirmed directly against `connectorsRouter.ts`: connect (`role !== 'tenant_admin'` → 403), disconnect, activate, and deactivate all gate on this exact check when `ownerType === 'tenant'` (ADR-0028 Tier 2, ADR-0051 Decision §1). A domain-ownership claim — asserting the tenant controls a DNS zone, the exact trust primitive ADR-0050 Decision §3 built this connector around — is at least as consequential a tenant-wide action as connecting a credential. This is an inconsistency, not a deliberate exception; nothing in ADR-0050 argues `tenant-owned-feed` should be treated differently from every other tenant-wide connector action.

### What stays untouched

- **ADR-0051's tenant-wide connector activation** (`connector_activations`, the `ActivateDeactivateButton` on this same screen) is confirmed orthogonal to per-feed state: it is one on/off switch for the whole `tenant-owned-feed` connector per tenant, independent of how many individual feed activations exist underneath it — the exact separation Story 6.17 already established and documented. This ADR adds no new activation mechanism and does not touch `shouldAttemptIngestion()`.
- **Newswire's own feed set** (`DEFAULT_NEWSWIRE_FEED_URLS`, two hardcoded global RSS/Atom URLs polled identically for every tenant) is not tenant-configurable, and nothing here proposes making it so — this ADR is scoped to `tenant-owned-feed` only, the one connector whose entire premise is a tenant configuring their own feed.
- **Platform-Admin cross-tenant feed visibility does not exist anywhere today** (`platform-admin-console/SKILL.md` has zero references to "feed" or "tenant-owned-feed"). Real, but a different audience/screen — named in Open Questions below as a deliberately separate, out-of-scope question, not folded in here.

---

## Decision

**1. Three new REST endpoints under `/v1/connectors/tenant-owned-feed/`, all `tenant_admin`-only:**

```
GET    /v1/connectors/tenant-owned-feed/activations      — list every activation for the caller's tenant
PATCH  /v1/connectors/tenant-owned-feed/:id               — { feedUrl } only
DELETE /v1/connectors/tenant-owned-feed/:id               — soft-remove
```

- **`GET .../activations`** returns every row for the caller's tenant regardless of status (`pending`/`verified`/`expired`/the new `removed`, see below): `{ id, domain, feedUrl, status, txtRecordHost, txtRecordValue, tokenExpiresAt, verifiedAt, createdAt }`. `txtRecordValue` is recomputed via the already-existing `expectedTxtRecordValue()` (derived from the stored `verification_token`), never separately persisted. **A direct, useful side effect:** this closes the pre-existing "TXT instructions aren't re-fetchable after a reload" gap `tenant-owned-feed-connector-setup/SKILL.md` already names — today's `Activation` object only ever exists in ephemeral client state from a fresh `connect` response.
- **`PATCH /:id`** accepts `{ feedUrl }` only — `domain` is never accepted via this route (a request that includes it is a `400`). `feedUrl` has nothing to do with the DNS-ownership proof; `domain` is the exact thing that proof is *of*. Allowing an in-place domain edit would let a verified activation silently point at a different, unverified domain without ever re-proving ownership of it — the single failure mode ADR-0050's entire TXT-verification design exists to prevent. A tenant who needs to monitor a different domain removes the old activation and connects a new one. `feedUrl` may be edited regardless of the activation's current status (`pending` or `verified`) — a tenant who made a typo in the URL shouldn't have to restart domain verification to fix it.
- **`DELETE /:id`** is a **soft removal**, not a SQL `DELETE`: it transitions `status` to a new `'removed'` value. **A PostgreSQL `CHECK` constraint cannot be altered in place** — the migration must `DROP` and re-`ADD` it under its own (auto-generated, since the original `CREATE TABLE` never named it explicitly) constraint name: `ALTER TABLE tenant_owned_feed_activations DROP CONSTRAINT tenant_owned_feed_activations_status_check; ALTER TABLE tenant_owned_feed_activations ADD CONSTRAINT tenant_owned_feed_activations_status_check CHECK (status IN ('pending','verified','expired','removed'));` — named explicitly here so the Story doesn't rediscover this mid-implementation. No new `GRANT` needed, since setting `'removed'` is an `UPDATE`, already granted to `app_user`. `getVerifiedActivations()` already filters on `status = 'verified'`, so a `removed` row stops being polled with **zero change to the poller itself**. Already-ingested `SocialPost`/`Author` rows tied to that domain are never touched — the same "never discarded" framing ADR-0018 already established for `raw_payload`, and the same soft-revocation shape this project uses everywhere else a tenant-facing action needs to be reversible-in-spirit even when the underlying resource stops being active (`access_ends_at` over hard user deletion, Story 3.8's grace-period tenant offboarding over immediate deletion).

**1a. Registering an additional feed under a domain the tenant has already verified skips DNS TXT verification for that new row.** `connect` checks whether the caller's tenant already holds a `status = 'verified'` activation for the same `domain` (a plain equality check against already-tenant-scoped rows, no new query shape). If so, the new row is still created with a generated token/`txtRecordHost`/`tokenExpiresAt` (schema unchanged, no nullable-column migration needed) but is **immediately marked `verified` server-side** — the tenant is never shown TXT-record instructions or asked to wait for DNS propagation a second time for a domain they've already proven they control. Domain ownership is a property of the domain, not of any one feed URL under it; re-proving it per feed would be pure friction with no security benefit. Two example.com feeds (`/feed1.xml`, `/feed2.xml`) are both explicitly a supported, intended shape — **a feature, not a duplicate-domain bug** — the same "multiple feeds per verified domain" case ADR-0050 Decision §5 already named for cross-domain configurations (`blog.acme.com` and `newsroom.acme.com`), now extended to same-domain, multiple-feed-URL configurations too.

**2. `connect` and `verify-domain` both gain the `tenant_admin` role check every other tenant-wide connector action already uses** — closing the inconsistency found above, in scope for this ADR since it touches the exact same router this ADR is otherwise extending. A `tenant_user` calling either now receives `403`, matching `connectorsRouter.ts`'s own established copy pattern (*"Only a tenant_admin may..."*).

**3. No cap on the number of feeds a tenant may register.** Left unbounded at v1. No real, demonstrated constraint backs a specific number today — unlike the license-seat ceiling (a real, ADR-0032-backed business rule), a feed-count cap here would be invented, not derived. Named as a real, open cost/load question in Consequences and Open Questions, not silently ignored.

**4. No token-regeneration/retry endpoint for an expired `pending` activation.** A tenant whose verification token expired (`status = 'expired'`, or simply past `token_expires_at` with no scheduled transition — see the pre-existing, still-open "no stale-token cleanup" gap this ADR does not close) restarts by `DELETE`-ing the stale activation and calling `connect` again. This is the smallest mechanism that closes the loop — a dedicated "regenerate token, keep the same row" endpoint would be a second way to reach the same end state for a case (an abandoned or mistyped setup attempt) that doesn't need one.

**5. Store gains three new functions** (`tenantOwnedFeedStore.ts`): `listActivations(tenantId)`, `updateFeedUrl(tenantId, id, feedUrl)`, `removeActivation(tenantId, id)` — each `withTenant()`-scoped like every existing function in this file, no new RLS policy needed (the existing `tenant_isolation` policy already covers every row regardless of status). **`listActivations()` is deliberately unfiltered by status (Admin UI needs to show `removed`/`expired` rows too, for history) — every *other* consumer of this table must keep using `getVerifiedActivations()`, never `listActivations()`, to decide what to actually poll or count as active.** Verified directly while drafting this ADR: today, exactly two functions read this table (`getActivation()`, `getVerifiedActivations()`), called from exactly two places (`tenantOwnedFeedRouter.ts`, `pollTenantOwnedFeed.ts`), both already correctly scoped — no dashboard counter, health check, or metrics path exists yet that could accidentally count a `removed` row as active. Named here as a load-bearing constraint for whichever future code adds one, not because a live bug exists today.

**6. Admin UI: `TenantOwnedFeedSetup.tsx`'s single-activation state machine is replaced by a real list.** One row per activation (domain, feed URL, status, verified/expiry date), with per-row actions: "Verify now" (`pending` only), "Edit feed URL" (any status), "Remove" (any status, behind a `ConfirmModal` — Design Spec §2's "Confirmed irreversibility" principle: even though removal is a soft state transition server-side, from the tenant's own vantage point it stops a working feed, and deserves the same confirm treatment as any other consequential action in this app, e.g. watchlist deletion). A persistent "Connect another feed" action reuses the existing connect → publish-TXT-record → verify flow unconditionally — never gated on "only if no feed exists yet," the exact gate that makes today's screen single-feed-only (per Decision §1a, this flow silently skips the TXT-record step entirely when the domain is already verified). **The existing tenant-wide `ActivateDeactivateButton` (ADR-0051) stays exactly where and as it is, unrelated to this per-feed list — but the list screen must say so explicitly:** a real, verified, per-feed row does not mean that feed is being polled if the tenant-wide connector switch is off. The list's own empty/inactive-state copy must make this distinction visible (e.g. a banner when the connector-wide switch is off: "N feeds configured, but this connector is currently deactivated — none of them are being polled") — otherwise a tenant sees "Verified" on every row and has no way to understand why nothing is being ingested, the exact confusing state this bullet exists to prevent.

---

## Consequences

**Positive**
- Resolves ADR-0050 Open Question 2 for real, closing a two-session-old gap between what the storage/polling layers already support and what a tenant can actually reach.
- Fixes a real, pre-existing under-authorization bug (`connect`/`verify-domain` missing the `tenant_admin` check every comparable action already has) as a natural consequence of touching this router, not as an unrelated drive-by.
- Closes the SKILL.md-named "TXT instructions lost on reload" gap as a side effect of the new list endpoint, without a dedicated fix for it.
- Soft-removal preserves the full domain-verification audit trail (when a domain was verified, when it stopped being polled) rather than erasing it — consistent with this project's established preference for reversible-in-spirit state transitions over hard deletes.
- No schema surprise: the table was already built to support this (per its own migration comment); the only genuinely new persisted concept is the `'removed'` status value.

**Negative**
- **Cost/load now scales with an unbounded feed count per tenant**, each polled independently on its own 30-minute cadence (ADR-0050's own default). Nothing here bounds it. A tenant registering many feeds increases outbound HTTP volume and `ingestion_runs` row growth linearly, with no ceiling and no alerting on an unusually large count. Named, not solved — see Open Questions.
- **`removed` rows accumulate with no purge job**, joining the already-named "no stale-`pending`-row cleanup" gap as a second, related un-scheduled-cleanup concern for the same table. Neither this ADR nor the codebase today has any scheduled job mechanism for either.
- **Editing `feedUrl` on a `pending` (not yet verified) activation is a real edge case this ADR resolves narrowly** (allowed, with no interaction with the verification token) but a future implementer could reasonably assume it should also reset the token TTL — it deliberately does not, since `feedUrl` and domain-ownership verification are orthogonal concerns; worth a code comment at implementation time, not just this ADR text.
- **The role-gate correction on `connect`/`verify-domain` is a behavior change for any real tenant currently relying on a `tenant_user` session to configure this connector** (unlikely in practice — no production tenant history exists yet — but not zero-risk if one does).

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Hard `DELETE` instead of soft-removal** | Rejected. Erases the domain-verification audit trail; requires a new `GRANT DELETE` the table doesn't have today; inconsistent with every other revocation pattern in this project (`accessEndsAt`, tenant offboarding's grace period + export). |
| **Allow `domain` to be edited in place via `PATCH`** | Rejected. Breaks the entire meaning of DNS TXT verification — a verified row would silently point at an unverified domain. Remove-and-reconnect is the correct, safe path for a genuine domain change. |
| **A hard cap on feed count per tenant** | Considered; deferred, not built. No real, demonstrated constraint (support burden, cost data, abuse pattern) backs any specific number today — inventing one would be the same category of unjustified ceiling this project has explicitly avoided elsewhere (contrast the license-seat ceiling, which is a real ADR-0032 business rule). Left as a named Open Question, revisited if real usage ever justifies it. |
| **A token-regenerate/retry endpoint for an expired `pending` row** | Considered; deferred. Adds a second path to the same end state (a working, verified activation) that remove-and-reconnect already reaches, for a case that doesn't need the extra complexity — the same "smallest mechanism for the actual requirement" standard ADR-0052 §1 and ADR-0053's own Amendment Log already applied. |
| **Also design Platform-Admin cross-tenant feed visibility in this same ADR** | Considered; deferred to a separate, not-yet-drafted candidate ADR. Different audience and screen (Epic 7, not Epic 6); folding it in here would grow this ADR past the one gap it was asked to close (ADR-0050 Open Question 2), and Platform-Admin console feature parity is its own decision, not implied by tenant-side feed CRUD. |
| **Leave `tenant_user` able to connect/verify (don't correct the role gate)** | Rejected. The inconsistency with every other tenant-wide connector action in this codebase has no stated rationale anywhere in ADR-0050 or its Story — it reads as an oversight, not a deliberate choice, and a domain-ownership claim is exactly the kind of consequential, tenant-wide action this project already restricts to `tenant_admin` everywhere else. |
| **Require a full DNS TXT re-verification for every feed, even a second one under an already-verified domain** | Rejected (added in the 2026-08-17 review pass — see Amendment Log). Domain ownership is a property of the domain, not of any individual feed URL beneath it; a tenant who already proved they control `example.com` gains nothing from proving it again to add `example.com/feed2.xml`, and loses real time to DNS propagation for no security benefit. Decision §1a instead auto-verifies a same-domain additional feed server-side. |

---

## Open Questions

The following are explicitly not resolved by this ADR:

1. **Feed-count ceiling.** Left unbounded at v1 (Decision §3). Revisit only if real tenant usage or measured cost/load data ever justifies a specific number — not speculatively.
2. **Scheduled cleanup for stale `pending` and now-`removed` rows.** Neither this ADR nor any prior one designs a background job for either. `tenant-owned-feed-connector/SKILL.md` already names the `pending`-expiry half of this gap; this ADR adds the `removed`-retention half without closing either.
3. **Platform-Admin cross-tenant feed visibility.** A real, confirmed gap (zero references anywhere in the Platform-Admin console today) found while investigating this ADR's own scope — deliberately left for a separate, future, not-yet-drafted ADR rather than folded in here.
4. **Whether editing `feedUrl` on a `pending` activation should interact with the verification token's TTL.** This ADR's answer is "no, they're orthogonal" (Decision §1), but the reasoning is asserted here, not exhaustively tested against every edge case an implementer might invent — worth a dated note at Story time if a real case surfaces that argues otherwise.

---

## Amendment Log

- **2026-08-17** — Drafted, requested directly by Menno ("what needs to change to enable the feeds to be administered?", followed by "let's build the new ADR"). Investigated directly before drafting, not assumed: read `tenantOwnedFeedStore.ts`, `tenantOwnedFeedRouter.ts`, `TenantOwnedFeedSetup.tsx`, migration `0026`'s own header comment, `tenant-owned-feed-connector/SKILL.md`'s "Known gaps" section, and `connectorsRouter.ts`'s existing `tenant_admin` role-gate pattern, to confirm both the storage-layer's already-built multi-feed support and the specific, real gap in what's exposed above it — including the previously-unflagged `connect`/`verify-domain` role-gating inconsistency, found while reading the router for this ADR's own purposes, not reported separately elsewhere first. Left **Proposed** — Menno (Sponsor) reviews and accepts separately.
- **2026-08-17, later the same day** — Revised in place following an external review Menno relayed (four numbered points). Each independently checked against the actual codebase, not accepted on trust, per this series' own established discipline for handling outside review input (e.g. ADR-0053's own Copilot-review pass): **(1) accepted** — Decision §1's `DELETE` bullet now states the exact `DROP CONSTRAINT`/`ADD CONSTRAINT` shape explicitly, since PostgreSQL cannot alter a `CHECK` constraint in place and the original `CREATE TABLE` never named it, a real syntax gotcha worth heading off before Story time. **(2) investigated, not a live bug, guard-rail added anyway** — re-grepped the full codebase for every reader of `tenant_owned_feed_activations`: exactly two functions (`getActivation()`, `getVerifiedActivations()`), exactly two call sites (`tenantOwnedFeedRouter.ts`, `pollTenantOwnedFeed.ts`), both already correctly scoped — no dashboard counter or health check exists today that could miscount a `removed` row. Decision §5 gained an explicit `listActivations()`-is-deliberately-unfiltered / other-consumers-must-use-`getVerifiedActivations()` note as a forward guard, not a fix for a bug that doesn't exist yet. **(3) accepted as a genuine, substantive finding — new Decision §1a added**: registering a second feed under an already-`verified` domain now skips DNS TXT verification entirely (auto-verified server-side), rather than forcing a redundant re-proof of ownership already established — closes real, avoidable friction the original draft left in by not distinguishing "new domain" from "additional feed on a known-good domain." Same-domain multiple feeds confirmed explicitly as an intended feature, not a duplicate-registration bug, matching a new Alternatives Considered row. **(4) accepted** — Decision §6 now states explicitly that the per-feed list UI must visually distinguish per-feed verification status from the separate, tenant-wide `ActivateDeactivateButton` state, so a tenant doesn't see "Verified" on every row while wondering why nothing is being ingested. Still **Proposed** — this revision is presented for Menno's review together with the original draft, not separately re-accepted piecemeal.
