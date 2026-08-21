---
name: linkedin-connector
description: The LinkedIn SocialConnector (LinkedIn REST API v2, confidential client OAuth 2.0, token lifecycle with persisted refreshTokenExpiresAt, 60-day access token refresh, Rest.li rate-limit header parsing with epoch ms conversion, 1-hour polling guardrails, and graceful scope degradation). Read this before touching src/connectors/linkedin/** or adding LinkedIn API routes.
---

# LinkedIn connector — Confidential Client OAuth & Ingestion Poller

## What this is

`linkedinConnector.ts`/`pollLinkedIn.ts` ingest published posts and member engagement from connected LinkedIn accounts via the LinkedIn REST API (`/rest/posts` and `/v2/ugcPosts`). Stored as Tier-3 user-bound credentials (`owner_type: 'user'`) using confidential client OAuth 2.0 with client secret.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0069 | LinkedIn connector architecture: confidential client OAuth, persisted `refreshTokenExpiresAt`, 60-day access token refresh, Rest.li rate-limit header extraction with epoch ms conversion, 1-hour scheduler guardrails, graceful scope degradation, best-effort non-blocking revocation | 2.25 |
| ADR-0028 §3 | Tier 3 credential ownership — user-activated only, never created by Tenant-Admin | 2.25 |
| ADR-0004 | Member Profile / Organization as Author model (`linkedin:<memberId>`) | 2.25 |
| ADR-0061 | Real Tier-3 poll scheduling (`pollUser(tenantId, userId)`) | 1.15 / 2.25 |
| ADR-0018 | Data retention policy: raw API response JSON discarded from permanent storage | 2.25 |
| ADR-0070 | Ingestion watchdog timeout and stalled/reconnect alert publishing | 1.16 / 2.25 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.25.linkedin-connector.contract.test.ts` — verifies confidential client code exchange, `refreshTokenExpiresAt` initialization (365 days), token refresh lifecycle with refresh token retention, `invalid_grant` classification (`expired` vs `revoked`), Rest.li header parsing with epoch seconds conversion, 1-hour cadence guardrail validation, and best-effort disconnect handling.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves `LINKEDIN_PROVIDER_ID` (`'linkedin'`) appears nowhere in any core ingestion/orchestration file (ADR-0048 §1).

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/linkedin/linkedinConnector.ts` (connector object) and `src/connectors/linkedin/pollLinkedIn.ts`, wired into `bootstrapConnectors.ts` via `registerSocialConnector({ ...linkedinConnector, pollUser: pollLinkedIn, pollCadenceMs: ONE_HOUR_MS })`.
- **Extension points used:** `SocialConnector` interface (`src/connectors/types.ts`), `registerSocialConnector()` (`src/connectors/registry.ts`).
- **No-core-change verification:** Checked mechanically by `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts`.

## Load-bearing constraints — do not change casually

- **Registered with `pollUser` only (Tier-3)** — LinkedIn credentials belong to individual authorized users.
- **1-hour polling cadence guardrail** — Marketing API rate limit constraints require standard polling intervals $\ge$ 3600 seconds. Intervals $< 3600$s are strictly rejected unless verified partner status and `linkedin.org.enabled` flag are active.
- **Persisted `refreshTokenExpiresAt`** — Refresh token expiry (1 year from initial issuance or last refresh rotation) is stored explicitly; evaluates `invalid_grant` errors deterministically as `expired` ($now > expiry$) or `revoked` ($now \le expiry$).
- **Rest.li header unit conversion** — `x-restli-gateway-ratelimit-reset` epoch seconds must be converted to epoch milliseconds ($sec \times 1000$).
- **Graceful scope degradation** — Missing partner/organization scopes log an informational note and allow member post ingestion to continue without failing connector health.
- **Best-effort revocation** — Disconnect calls revoke endpoint preferring refresh token, logging non-200 responses as `WARN` without blocking credential erasure or tenant data purging.
