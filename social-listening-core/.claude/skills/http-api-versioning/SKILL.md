---
name: http-api-versioning
description: The Express app, /v1/ router mount, and RFC 8594 deprecation-header mechanism for social-listening-core's REST API. Read this before adding any new endpoint, or before ever introducing a /v2/.
---

# HTTP API versioning

## What this is

The REST API surface for `social-listening-core`: an Express app (`src/http/app.ts`) that mounts every route under a version prefix (`src/http/versions/v1/router.ts`), plus a reusable deprecation-header mechanism (`src/http/deprecation.ts`) for when a version is eventually superseded. It exists so ADR-0017's compatibility policy — breaking changes only ever ship as a new version, with the old one kept running and marked deprecated for a window — is a property of the running server, not just a documented convention consumers have to trust.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0017 | URI path versioning (`/v1/`, `/v2/`, ...), 90-day minimum deprecation window, RFC 8594 `Deprecation`/`Sunset` headers | 1.3 |

## Contracts that constrain this component

- `contracts/epic-1/story-1.3.api-versioning.contract.test.ts` — every route is reachable under `/v1/...` and no unversioned route exists; `deprecateVersion()` emits correct RFC 8594 headers and rejects a `sunsetAt` earlier than the 90-day minimum; `/v1/health` has a fixed, asserted response shape.

## How to extend this safely

- **Adding a new endpoint to the current version:** add a route to `src/http/versions/v1/router.ts` (or a sub-router it mounts, once there are enough endpoints to warrant splitting by resource), and add its own response-shape assertion to that endpoint's owning story's contract test — following `/v1/health`'s pattern in this story's contract. This is the concrete mechanism behind ADR-0017's AC3 ("a contract check that fails the build if a response shape changes unexpectedly"): each endpoint's shape is only actually guarded if its story's contract asserts it explicitly. There is no separate generic schema-diffing tool — the accumulated contract suite *is* the check.
- **Ever introducing `/v2/`:** create `src/http/versions/v2/router.ts`, mount it in `app.ts` alongside (not instead of) `/v1`, and only fork the specific handlers that actually changed — per ADR-0017's explicit instruction not to duplicate the whole API wholesale. Wrap the old `/v1` router with `deprecateVersion(successorShippedAt, sunsetAt)` at that point, where `sunsetAt` is computed via `minimumSunsetDate(successorShippedAt)` or later.
- **HTTP framework:** Express, a pragmatic Phase 0 pick — no ADR mandates it. Revisit only if a concrete need arises (e.g. Fastify's built-in JSON-schema validation, if response-shape contracts ever outgrow hand-written assertions); don't switch speculatively.

## Load-bearing constraints — do not change casually

- **Every router mount in `app.ts` must be under a version prefix.** Mounting anything at the app root (no `/v1` etc.) reintroduces exactly the unversioned-route gap this story's AC1 exists to prevent — the contract test's "no unversioned route exists" check only catches paths it knows to probe, not every possible future mistake, so this is a convention to hold deliberately, not something enforced for all future routes automatically.
- **`deprecateVersion()`'s window check is a hard `throw`, not a lint warning.** A caller passing a `sunsetAt` less than `MIN_DEPRECATION_WINDOW_DAYS` (90, per ADR-0017's Amendment Log — check there before assuming this number is still current) after `successorShippedAt` gets an exception at wiring time, not a silently-too-short deprecation window discovered by a consumer later.
- **`Deprecation`/`Sunset` header values are `toUTCString()` — RFC 7231 HTTP-date format`, not ISO 8601.** RFC 8594 specifies HTTP-date; consumers parsing these headers will expect that format specifically.

## Known gaps / deferred work

- Only `/v1/health` exists — a placeholder proving the versioning/deprecation mechanism works, not a real business endpoint. Real endpoints (connectors, watchlists, posts, ...) are Phase 1+ stories, each adding to `src/http/versions/v1/router.ts` and this story's contract-test pattern, not to this file.
- No OpenAPI spec or schema-registry tooling — deferred per `docs/adr/README.md`'s "not captured as ADRs" list, revisited before the first downstream subsystem integrates.
- `social-listening-admin/src/lib/core-client.ts` was updated in this same pass to call `/v1/health` instead of the unversioned `/health` Story 1.1 originally wrote — see that repo's `.claude/skills/core-api-client/SKILL.md`.
