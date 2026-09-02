---
name: core-api-client
description: The sole sanctioned path from social-listening-admin to social-listening-core — a fetch-based REST client. Read this before adding any admin feature that needs data from core.
---

# Core API client

## What this is

`src/lib/core-client.ts` is the only module in `social-listening-admin` allowed to talk to `social-listening-core`. It does so exclusively over HTTP (`fetch`), against a configurable base URL — never via a database driver, never via an in-process import of core's source. It exists so the two-repository split decided in ADR-0001 stays real in code, not just in the repo layout.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0001 | Split into `social-listening-core` / `social-listening-admin`; admin talks to core only via REST, never the database directly | 1.1 |
| ADR-0017 | Core's REST API is versioned under `/v1/`; this client's request paths must include the version prefix | 1.3 |
| ADR-0036 §2, §5 | This module is also the sole choke point that attaches `Authorization: Bearer <token>` to authenticated calls, sourced from the admin UI's own server-side session | 6.1 |
| ADR-0075 | Outbound Social Post Publishing via Platform APIs (`publishOutboundPost` → `POST /v1/outbound/posts`) | 11.7/11.8 |
| ADR-0115 | Media upload, asset targeting, and link-card support (`uploadOutboundMedia` → `POST /v1/outbound/media`) | 13.10 |
| ADR-0116 | Semantic drift detection (`getTopicDrift` → `GET /v1/topics/:id/drift?start=...&end=...`) | 13.12 |

## Contracts that constrain this component

- `contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts` — asserts (a) no Postgres/DB driver in `package.json`, (b) no committed DB connection string, (c) no local/file dependency on `social-listening-core`, (d) no admin source file imports `social-listening-core` directly, (e) `src/lib/core-client.ts` exists and reaches core via `fetch`, not a DB driver, (f) admin is an independently versioned package with no shared workspace root tying it to core.
- `contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` — asserts (a) no second ad hoc `fetch`-with-`Authorization`-header call exists anywhere else in `src/`, (b) `authenticatedCoreFetch()` actually attaches `Bearer <accessToken>` sourced from the session, (c) `fetchResolvedIdentity()` degrades to `null` rather than throwing while `GET /v1/me` doesn't exist in core yet.
- `contracts/epic-13/story-13.10.media-upload-and-asset-targeting-ui.contract.test.ts` — asserts (a) `uploadOutboundMedia()` calls `POST /v1/outbound/media` with a `FormData` body and returns `{ mediaId, url, mimeType, sizeBytes }`, (b) `PublishOutboundPostInput` carries `assets`, `assetTargets` and `scheduledFor`, (c) `getConnectorTargets()` calls `GET /v1/connectors/:platformId/targets`.
- `contracts/epic-13/story-13.12.semantic-drift-ui.contract.test.ts` — asserts `getTopicDrift()` calls `GET /v1/topics/:id/drift?start=...&end=...` and returns a `TopicDriftResult` with `driftScore`, `warning`, `topClustersNow/Then`, and `samplePostsNow/Then`.

## How to extend this safely

- Every future admin feature that needs core data (connect/disconnect a platform, manage watchlists, connector status, etc. — Phase 1) must call through this module, adding a typed function here rather than calling `fetch` directly from a component or page.
- The base URL is read from an environment variable (`CORE_API_BASE_URL`), never hardcoded, so admin and core stay independently deployable (ADR-0001's third Acceptance Criterion).
- Every path is under `/v1/` (ADR-0017, Story 1.3 — see core's `.claude/skills/http-api-versioning/SKILL.md`): `checkCoreHealth()` calls `/v1/health`. Any new endpoint call added here must include its version prefix too — core has no unversioned routes.
- **Any new authenticated call added here goes through `authenticatedCoreFetch(path, init)`** (Story 6.1 / ADR-0036 §2), which reads the caller's session itself via `next/headers`' `cookies()` and attaches the bearer token — callers never construct the `Authorization` header themselves. See `.claude/skills/admin-auth-session/SKILL.md` for the session mechanism this reads from. The one exception is `uploadOutboundMedia()`, which passes a `FormData` body directly and lets `fetch` set the multipart `Content-Type` with the correct boundary.

## Load-bearing constraints — do not change casually

- Never add a Postgres/database driver package to this repo's `package.json` — the contract test enforces this mechanically, but the underlying reason is ADR-0001's "admin never accesses the database directly."
- Never import anything from `../social-listening-core/src/...` (or any path into core's source) from admin code — that would silently reintroduce the in-process coupling ADR-0001 explicitly rejected as an alternative.
- Keep this the single choke point: if a second ad hoc `fetch` call to core appears elsewhere in `src/`, fold it into this module instead of letting the boundary fragment. This now includes the `Authorization` header specifically (Story 6.1's own contract greps `src/` for exactly this).
- `fetchResolvedIdentity(accessToken)` takes an explicit token, not the session — see `.claude/skills/admin-auth-session/SKILL.md`'s own load-bearing note on why (its only caller is the sign-in callback, before the session cookie is a readable request cookie).

## Known gaps / deferred work

- **`GET /v1/me` does not exist in `social-listening-core` yet** (ADR-0036 §5's own named prerequisite) — confirmed absent from `src/identity/identityResolution.ts` and every `versions/v1/*Router.ts` there. `fetchResolvedIdentity()` always resolves `null` until it's built.
- Real endpoint calls beyond the health check and the identity bootstrap don't exist yet — those are Phase 1/Epic 6's later stories (6.3+), against core routes that don't all exist yet either.
- Request/response typing shared with core's API shape isn't established yet; revisit once core has real endpoints (Phase 1) to type against.
- The access token `authenticatedCoreFetch()` attaches today is scoped to whatever the admin app registration actually requested (currently Microsoft Graph's default resource) — not a `social-listening-core`-scoped delegated permission, which doesn't exist on either app registration yet. See `.claude/skills/admin-auth-session/SKILL.md`'s own "Known gaps" for the same note.
