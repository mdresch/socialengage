# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0057 Tenant-Owned Feed Multi-Feed Administration — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0057-tenant-owned-feed-multi-feed-administration.md, ../Business-Requirements/BRD-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0057-tenant-owned-feed-multi-feed-administration.md and the business requirements in BRD-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md into functional design for **Tenant Owned Feed Multi Feed Administration**.
SocialEngage's tenant-owned-domain content-feed connector already supports multiple verified domains and feeds at the storage and polling layers, but the product currently exposes only a single-feed setup flow. A tenant that has verified one domain has no supported path to add a second domain or a second feed under an already-verified domain. This Business Requirements Document (BRD) formalizes the business need to administer tenant-owned feeds after the initial setup: viewing all configured feeds, editing feed URLs, and removing feeds, while fixing a pre-existing under-authorization gap in the connect/verify endpoints.

The proposed solution introduces tenant-admin-only list, edit, and soft-remove capabilities, plus a same-domain multi-feed shortcut that skips redundant DNS TXT verification when the tenant has already proven domain ownership. The result is a scalable, auditable feed-management experience that closes the gap between what the platform already supports and what tenants can actually reach through the product.

---

### 2.2 Scope
**In scope:**
- REST endpoints to list, update feed URL, and soft-remove tenant-owned feed activations.
- Storing and exposing the new `removed` status value for `tenant_owned_feed_activations`.
- Re-authorizing `connect` and `verify-domain` to `tenant_admin` only.
- Auto-verification of additional feeds registered under an already-verified same domain.
- Admin UI replacement of the single-activation `TenantOwnedFeedSetup` state machine with a real per-tenant feed list.
- Per-row actions in the Admin UI: "Verify now" (pending only), "Edit feed URL" (any status), "Remove" (any status, with confirmation).
- Visual distinction between per-feed status and the separate, tenant-wide connector activation state.
- Persistent "Connect another feed" action, never gated on the absence of existing feeds.

**Out of scope:**
- A hard cap on the number of feeds per tenant at v1.
- Scheduled cleanup of stale `pending` or `removed` rows.
- A token-regeneration/retry endpoint for expired `pending` activations (remove-and-reconnect is the supported path).
- Platform-Admin cross-tenant feed visibility.
- Changes to Newswire's hardcoded, non-tenant-configurable feed set.
- Hard deletion of already-ingested `SocialPost` or `Author` rows tied to a removed feed.

## 3. Context and Background
See ADR Context.
SocialEngage's tenant-owned-domain content-feed connector already supports multiple verified domains and feeds at the storage and polling layers, but the product currently exposes only a single-feed setup flow. A tenant that has verified one domain has no supported path to add a second domain or a second feed under an already-verified domain. This Business Requirements Document (BRD) formalizes the business need to administer tenant-owned feeds after the initial setup: viewing all configured feeds, editing feed URLs, and removing feeds, while fixing a pre-existing under-authorization gap in the connect/verify endpoints.

The proposed solution introduces tenant-admin-only list, edit, and soft-remove capabilities, plus a same-domain multi-feed shortcut that skips redundant DNS TXT verification when the tenant has already proven domain ownership. The result is a scalable, auditable feed-management experience that closes the gap between what the platform already supports and what tenants can actually reach through the product.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenants to manage multiple owned-domain feeds from the Admin UI | A Tenant-Admin can list, edit feed URL, and remove any feed in the tenant-owned-feed connector screen |
| 2 | Close the authorization gap on tenant-wide connector actions | `connect` and `verify-domain` are gated to `tenant_admin` only, consistent with all other tenant-wide connectors |
| 3 | Preserve a complete domain-verification audit trail | Removed feeds remain queryable with status history; no hard deletion is required to stop polling |
| 4 | Reduce unnecessary DNS friction for legitimate same-domain multi-feed configurations | A second feed under an already-verified domain is auto-verified without requiring another TXT record |
| 5 | Keep ongoing operating costs visible and unbounded-by-default | Feed count remains uncapped at v1, with explicit cost/load monitoring and review triggers identified |

---

**Positive consequences (from ADR):**
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

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a tenant-scoped list of all tenant-owned feed activations. | Must | Returns every row for the caller's tenant, including `pending`, `verified`, `expired`, and `removed`, with id, domain, feedUrl, status, txtRecordHost, txtRecordValue, tokenExpiresAt, verifiedAt, and createdAt. | Product Owner |
| BR-002 | The system shall allow a Tenant-Admin to edit the feed URL of an existing activation. | Must | `PATCH` accepts `{ feedUrl }` only; requests containing `domain` are rejected with `400`; edits work for `pending` and `verified` statuses. | Product Owner |
| BR-003 | The system shall allow a Tenant-Admin to soft-remove an activation. | Must | `DELETE` transitions `status` to `removed`; ingested posts/authors are not deleted; the row stops being polled automatically. | Product Owner |
| BR-004 | The system shall auto-verify a new feed under a domain the tenant has already verified. | Must | `connect` checks for an existing `verified` activation with the same `domain`; if found, the new row is created and immediately `verified` without showing TXT instructions. | Product Owner |
| BR-005 | The system shall require `tenant_admin` role for `connect` and `verify-domain`. | Must | A caller whose resolved role is not `tenant_admin` receives `403` for both endpoints. | Product Owner |
| BR-006 | The Admin UI shall display a real per-tenant feed list with per-row actions. | Must | List shows domain, feed URL, status, and dates; actions include "Verify now" (pending only), "Edit feed URL" (any status), and "Remove" (any status with confirmation). | Product Owner |
| BR-007 | The system shall preserve a full audit trail of activations, including removed ones. | Must | `removed` rows remain in the database and remain queryable through the list endpoint; no hard delete is performed. | Product Owner |
| BR-008 | The Admin UI shall make the tenant-wide connector activation state visible on the same screen. | Must | A verified per-feed row is not presented as "currently polling" when the tenant-wide connector switch is off. | Product Owner |
| BR-009 | The system shall not impose a feed-count ceiling at v1. | Must | No arbitrary limit is enforced on the number of activations per tenant. | Product Owner |

### 5.1 Architecture Decision
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

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures and maintains the tenant's owned-domain feeds | High | Add, list, edit, and remove feeds without engineering help |
| Tenant User | Consumes ingested posts from tenant-owned feeds | Medium | Trust that only authorized tenant admins can claim domain ownership |
| Product Owner (Menno) | Sponsor and decision owner | High | Close ADR-0050 Open Question 2; keep scope honest and bounded |
| Engineering / Technical Lead | Implements core and Admin UI changes | High | Clear requirements that follow existing patterns and avoid speculative ceilings |
| Operations / Cost Owner | Monitors cloud/ingestion costs | Medium | Visibility into unbounded feed count and its cost/load implications |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 6.20 | epic-6-tenant-admin-ui.md | As Tenant-Admin who wants to monitor more than one of my own domains/feeds, I want to see, add, edit, and remove every feed I've configured, not just the one... | `GET /v1/connectors/tenant-owned-feed/activations` (new, `tenant_admin` only) lists every activation for the caller's tenant regardless of status (`pending`/... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_owned_feed_activations.id` | Unique activation identifier | Store/API | Engineering | Internal |
| `tenant_owned_feed_activations.tenant_id` | Tenant owner of the activation | Store/API | Engineering | Internal |
| `tenant_owned_feed_activations.domain` | Verified or claimed domain | Admin input / DNS verification | Product | Business-critical |
| `tenant_owned_feed_activations.feed_url` | RSS/Atom feed URL to poll | Admin input | Product | Business-critical |
| `tenant_owned_feed_activations.status` | `pending` / `verified` / `expired` / `removed` | System | Engineering | Internal |
| `tenant_owned_feed_activations.verification_token` | Token used to derive the TXT record value | System | Engineering | Internal |
| `tenant_owned_feed_activations.txt_record_host` | Hostname used for DNS TXT record | System | Engineering | Internal |
| `tenant_owned_feed_activations.token_expires_at` | Token expiry timestamp | System | Engineering | Internal |
| `tenant_owned_feed_activations.verified_at` | When the domain was verified | System | Engineering | Internal |
| `tenant_owned_feed_activations.created_at` | Activation creation timestamp | System | Engineering | Internal |
| `connector_activations.is_active` | Tenant-wide on/off switch for the connector (separate from per-feed status) | ADR-0051 | Engineering | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Only a `tenant_admin` may perform tenant-wide tenant-owned-feed administration (`list`, `edit`, `remove`, `connect`, `verify-domain`). |
| BRU-002 | The `domain` of an activation may not be edited in place; a tenant wanting a different domain must remove the old activation and connect a new one. |
| BRU-003 | The `feedUrl` of an activation may be edited regardless of `pending` or `verified` status, and the edit does not affect the verification token or its TTL. |
| BRU-004 | Removing an activation is a soft removal: `status` becomes `removed`; the underlying data is retained. |
| BRU-005 | A feed may be added under a domain already verified by the same tenant without a second DNS TXT verification step. |
| BRU-006 | No maximum number of tenant-owned feeds is enforced at v1. |
| BRU-007 | `removed` and `expired` activations must not be counted or polled as active feeds. |
| BRU-008 | Already-ingested `SocialPost` and `Author` rows are not deleted when an activation is removed. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0050 tenant-owned-domain connector design | Internal / architectural | Product Owner | Already accepted |
| D-002 | ADR-0051 tenant-wide connector activation switch | Internal / architectural | Product Owner | Already accepted |
| D-003 | Story 6.20 — multi-feed administration implementation | Internal / delivery | Engineering | Built 2026-08-17 |
| D-004 | `tenant_owned_feed_activations` `CHECK` constraint migration | Internal / technical | Engineering | Built with Story 6.20 |
| D-005 | `TenantOwnedFeedSetup.tsx` Admin UI list redesign | Internal / delivery | Engineering | Built with Story 6.20 |
| D-006 | Platform-Admin cross-tenant feed visibility (future) | Internal / future | Product Owner | Out of scope for BRD-0057 |

---

- The storage layer (`tenant_owned_feed_activations`) already supports one-to-many rows per tenant; no schema redesign is needed beyond widening the `status` `CHECK` constraint.
- DNS TXT-record domain ownership verification remains the trust primitive for new domains.
- The tenant-wide connector activation switch (`connector_activations`) remains a separate concept managed by ADR-0051.

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

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All new administration endpoints must reject non-`tenant_admin` callers. | Security | Must | Contract tests prove `403` for `tenant_user` and any other non-admin role. |
| NFR-002 | List queries must remain scoped to the caller's tenant. | Security | Must | `withTenant()`-equivalent scoping is applied; no cross-tenant leakage. |
| NFR-003 | Feed polling must ignore removed or non-verified activations. | Reliability | Must | Existing `getVerifiedActivations()` filter continues to be the only polling source; `removed` rows are never polled. |
| NFR-004 | Soft removal must not delete or modify ingested `SocialPost`/`Author` rows. | Data integrity | Must | Existing rows remain queryable after removal. |
| NFR-005 | The feed list endpoint must return within 2 seconds for tenants with up to 100 activations. | Performance | Should | Latency measured in contract tests or production monitoring at the 95th percentile. |
| NFR-006 | The Admin UI must communicate the difference between per-feed status and the tenant-wide connector switch. | Usability | Must | Screen copy or banner explains that verified feeds are not polled while the connector-wide switch is off. |

---

## 11. Error Handling and Exceptions
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

## 12. Assumptions and Dependencies
- The storage layer (`tenant_owned_feed_activations`) already supports one-to-many rows per tenant; no schema redesign is needed beyond widening the `status` `CHECK` constraint.
- DNS TXT-record domain ownership verification remains the trust primitive for new domains.
- The tenant-wide connector activation switch (`connector_activations`) remains a separate concept managed by ADR-0051.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Unbounded feed count increases outbound poll and storage costs | Medium | High | Monitor feed count and poll volume; set a review trigger for a future cap or throttling once real usage data exists | Operations |
| R-002 | `removed` and `expired` rows accumulate with no scheduled cleanup | Medium | Medium | Document as a known gap; schedule a future ADR/story for a cleanup job | Product Owner |
| R-003 | Tenants confuse per-feed verification with the tenant-wide connector switch | Medium | High | UI explicitly distinguishes the two states with copy and a banner when the connector-wide switch is off | Product Owner |
| R-004 | Existing `tenant_user` workflows break when `connect`/`verify-domain` become `tenant_admin`-only | Low | Medium | Communicate the role change; the pre-existing behavior was inconsistent and unauthorized | Product Owner |
| R-005 | Editing `feedUrl` on a `pending` activation could be misinterpreted as resetting the token TTL | Low | Low | Document in code and skill that `feedUrl` and token TTL are orthogonal | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0057-tenant-owned-feed-multi-feed-administration.md`
- BRD: `../Business-Requirements/BRD-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above