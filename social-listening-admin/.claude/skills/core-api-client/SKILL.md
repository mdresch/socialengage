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

## Contracts that constrain this component

- `contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts` — asserts (a) no Postgres/DB driver in `package.json`, (b) no committed DB connection string, (c) no local/file dependency on `social-listening-core`, (d) no admin source file imports `social-listening-core` directly, (e) `src/lib/core-client.ts` exists and reaches core via `fetch`, not a DB driver, (f) admin is an independently versioned package with no shared workspace root tying it to core.

## How to extend this safely

- Every future admin feature that needs core data (connect/disconnect a platform, manage watchlists, connector status, etc. — Phase 1) must call through this module, adding a typed function here rather than calling `fetch` directly from a component or page.
- The base URL is read from an environment variable (`CORE_API_BASE_URL`), never hardcoded, so admin and core stay independently deployable (ADR-0001's third Acceptance Criterion).
- When Story 1.3 (ADR-0017, `/v1/` API versioning) lands in core, this client's request paths should be updated to include the version prefix — check that story before adding new endpoint calls here.

## Load-bearing constraints — do not change casually

- Never add a Postgres/database driver package to this repo's `package.json` — the contract test enforces this mechanically, but the underlying reason is ADR-0001's "admin never accesses the database directly."
- Never import anything from `../social-listening-core/src/...` (or any path into core's source) from admin code — that would silently reintroduce the in-process coupling ADR-0001 explicitly rejected as an alternative.
- Keep this the single choke point: if a second ad hoc `fetch` call to core appears elsewhere in `src/`, fold it into this module instead of letting the boundary fragment.

## Known gaps / deferred work

- No actual endpoint calls exist yet — there is no admin UI feature to call one for (those are Phase 1 work, per `docs/implementation-plan.md`). This module currently only proves the mechanism (a working `fetch`-based call against a configurable base URL) via a placeholder health check.
- Next.js scaffolding for the admin UI itself is deferred to the first story that actually needs a page/route — not required by Story 1.1's Acceptance Criteria.
- Request/response typing shared with core's API shape isn't established yet; revisit once core has real endpoints (Phase 1) to type against.
