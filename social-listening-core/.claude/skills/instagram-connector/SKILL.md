---
name: instagram-connector
description: The Instagram Business & Creator SocialConnector (Meta Graph API, Tier 3 user-bound credential, single-row carousel modeling with gallery children in rawPayload, 30-day/100-item lookback bounds, newest-first short-circuit incremental polling, Graph API error code reclassification). Read this before touching src/connectors/instagram/** or adding Instagram API routes.
---

# Instagram Business connector — Tier 3 OAuth Ingestion Poller

## What this is

`instagramConnector.ts`/`pollInstagram.ts` ingest published media (Photos, Videos, Reels, Carousels) from connected Instagram Business and Creator accounts via the Meta Graph API (`GET /{ig-user-id}/media`). Instagram accounts are discovered via their linked parent Facebook Pages during the OAuth flow. Stored as Tier-3 user-bound credentials (`owner_type: 'user'`).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0068 | Instagram connector scope, business/creator account model, single-row carousel modeling, 30-day / 100-item pagination precedence, Graph API error reclassification (`190`/`10`/`100` $\rightarrow$ `reconnect_required`) | 2.24 |
| ADR-0028 §3 | Tier 3 credential ownership — user-activated only, never created by Tenant-Admin | 2.24 |
| ADR-0004 | Organization / Profile as Author model (`instagram:<igUserId>`) | 2.24 |
| ADR-0061 | Real Tier-3 poll scheduling (`pollUser(tenantId, userId)`) | 1.15 / 2.24 |
| ADR-0064 | Country-level geospatial extraction and normalization (`geoCountry`, ISO 3166-1 alpha-2, discarding raw coordinates) | 2.20 / 2.24 |
| ADR-0070 | Ingestion watchdog timeout and stalled/reconnect alert publishing | 1.16 / 2.24 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.24.instagram-connector.contract.test.ts` — verifies single-row carousel modeling with ordered `children` (max 10, with `childrenTruncated`), 30-day / 100-item lookback precedence, newest-first short-circuit halting, geospatial extraction, and error reclassification with alert publishing.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves `INSTAGRAM_PROVIDER_ID` (`'instagram'`) appears nowhere in any core ingestion/orchestration file (ADR-0048 §1).

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/instagram/instagramConnector.ts` (connector object) and `src/connectors/instagram/pollInstagram.ts` (poller fan-out over `instagramConnectedAccountsStore.ts`), wired into `bootstrapConnectors.ts` via `registerSocialConnector({ ...instagramConnector, pollUser: pollInstagram, pollCadenceMs: THIRTY_MINUTES_MS })`.
- **Extension points used:** `SocialConnector` interface (`src/connectors/types.ts`), `registerSocialConnector()` (`src/connectors/registry.ts`).
- **No-core-change verification:** Checked mechanically by `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts`.

## Load-bearing constraints — do not change casually

- **Registered with `pollUser` only (Tier-3)** — never `.poll` without `userId`. Instagram credentials belong to individual users.
- **Single-row carousel modeling** — Each carousel creates exactly one `social_posts` row; child items are stored in `rawPayload.children` in original Meta display order (capped at 10 items).
- **Lookback bounds precedence** — Bounded to 30 days or 100 items (whichever is reached first) on initial ingestion; incremental ticks stop on first encountered existing ID.
- **Error reclassification** — Graph API codes `190` (expired token), `10` (permission revoked), and `100` (unlinked account) reclassify to `http_401` / `reconnect_required` and publish a `ConnectorIngestionAlertEvent`.
- **Geospatial policy (ADR-0064)** — Location is extracted strictly at the country level (ISO 3166-1 alpha-2) when available; raw coordinates are discarded.
