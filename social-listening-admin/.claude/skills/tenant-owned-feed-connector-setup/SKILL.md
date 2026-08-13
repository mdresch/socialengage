---
name: tenant-owned-feed-connector-setup
description: The real setup flow at /tenant/connectors/tenant-owned-feed for the tenant-owned-feed connector (ADR-0050) — a two-step domain+feedUrl-then-DNS-TXT-verify flow, structurally distinct from Story 6.3's single-credential ConnectForm. Read this before touching src/app/tenant/connectors/tenant-owned-feed/**, the tenant-owned-feed functions in src/lib/core-client.ts, or the two new proxy routes under src/app/api/connectors/tenant-owned-feed/.
---

# Tenant-owned-feed connector setup UI

## What this is

`/tenant/connectors/tenant-owned-feed` is the only path by which a real tenant can configure the `tenant-owned-feed` connector (Story 2.11) — the backend's `POST /v1/connectors/tenant-owned-feed/connect` and `POST /v1/connectors/tenant-owned-feed/verify-domain` (ADR-0050 Decision §3) existed with zero frontend caller before this story. The flow is a real state machine: submit `{domain, feedUrl}` → receive DNS TXT-record instructions → publish the record at the tenant's own registrar → click "Verify now" (re-clickable, since DNS propagation can take minutes to 72 hours) → transition to a verified/active state once the backend confirms the TXT record.

This is a dedicated screen, not a fifth entry in Story 6.3's `PLATFORMS` array — `ConnectForm.tsx`/`DisconnectButton.tsx` assume a single-field-or-JSON credential submitted once; this connector has `authMode: 'none'` (no credential at all) and a pending/verified activation state neither of those components has any notion of.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0050 | Tenant-owned-domain RSS/content-feed connector, DNS TXT domain-ownership gate, `authMode: 'none'` | 2.11 (backend), 6.12 (this screen) |

## Contracts that constrain this component

- `contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts` — the screen is its own dedicated route (not folded into Story 6.3's `PLATFORMS`); the connect form calls the real `POST /connect` via `core-client.ts`'s `connectTenantOwnedFeed()`; a successful response's `txtRecordHost`/`txtRecordValue`/`expiresAt` are rendered as plain instructions with real "up to 72 hours" propagation copy, never under an `alert` role; "Verify now" calls the real `POST /verify-domain` via `verifyTenantOwnedFeedDomain()` and is re-clickable (never disabled after one call); a `pending` response shows retry-later copy, never a hard failure; a `verified` response transitions to an active state; `connectorActivationId` persists via a `?activationId=` URL search param, read back by `page.tsx` on the next render, so the pending "Verify now" state survives a navigate-away-and-back without a fresh connect call; `core-client.ts` stays the sole Bearer-attachment choke point.

## How to extend this safely

- **This is v1: one domain, one feed, per ADR-0050 Open Question 2.** There is no list of a tenant's own past/other activations rendered here, because no `GET`-by-tenant listing endpoint exists for this connector yet (only `connect` and `verify-domain`, both keyed by a single `connectorActivationId`). Adding multi-domain support needs a new backend list endpoint first — a real, named gap, not an oversight.
- **`activationId` (component state, seeded from the `?activationId=` URL param) is the only state that survives a page reload.** The full TXT-instruction object (`activation`) is populated only by a fresh `connectTenantOwnedFeed()` response and is genuinely lost on reload — there is no `GET /v1/connectors/tenant-owned-feed/:id`-shaped endpoint to re-fetch it. The pending branch must render (and "Verify now" must still work) from `activationId` alone; don't make it depend on `activation` also being present.
- **Adding automatic re-check polling** (ADR-0050 Decision §3's own 1-minute-then-15-minute cadence) is explicitly named as a future Admin UI concern, not built here — this project has no background-job/timer infrastructure for a Client Component to drive one safely; a manual, re-clickable "Verify now" is the v1 mechanism.

## Load-bearing constraints — do not change casually

- **`core-client.ts` is the sole place a bearer token is attached (ADR-0036 §2).** `TenantOwnedFeedSetup.tsx` (a Client Component) never calls `social-listening-core` directly — it calls this repo's own same-origin proxy routes (`/api/connectors/tenant-owned-feed/connect|verify-domain`), which call `core-client.ts`'s `connectTenantOwnedFeed()`/`verifyTenantOwnedFeedDomain()`.
- **A `pending` verify-domain response is never treated as an error.** DNS propagation is outside the tenant's control once the record is published (ADR-0050 Context) — the UI must keep offering "Verify now" and must not show error styling for a `pending` result.
- **`domain`/`feedUrl` submission never JSON-encodes or reshapes the two fields** — unlike `ConnectForm.tsx`'s multi-field credential encoding, this connector's backend expects `{domain, feedUrl}` as two plain top-level fields (Story 2.11's own route shape), not a single opaque `credential` string.

## Known gaps / deferred work

- **No way to re-fetch a lost activation's TXT instructions.** If a tenant reloads the page after connecting but before verifying, `activationId` survives (via the URL) but the displayed `txtRecordHost`/`txtRecordValue` text does not — no backend endpoint exists to re-fetch it by id. A real fix needs a new `GET /v1/connectors/tenant-owned-feed/:id`-shaped endpoint; not built here.
- **Multi-domain/multi-feed management UI is out of v1 scope** (ADR-0050 Open Question 2) — this screen supports configuring one domain/feed at a time.
- **No automatic re-check polling** — "Verify now" is manual/re-clickable only (ADR-0050 Decision §3's own named Admin UI deferral).
