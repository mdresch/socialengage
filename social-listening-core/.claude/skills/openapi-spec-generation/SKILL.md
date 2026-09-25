---
name: openapi-spec-generation
description: How social-listening-core generates its OpenAPI 3.0 document from real, live routes — read this before adding a new HTTP route that should appear in the spec, or before touching src/http/openapi/** or scripts/generateOpenApiSpec.ts.
---

# OpenAPI spec generation

## What this is

Generates `openapi.json` at the repo root from the backend's real, currently-registered
routes, with no dependency on any frontend code. It exists to satisfy ADR-0144/TDS-0144's
repository-topology decision: the backend publishes a versioned OpenAPI contract as a CI
artifact, and each frontend candidate (Next.js, Angular, Blazor) generates its own typed
client from that published spec rather than importing backend types directly.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0144 | Repository topology: backend/frontend split via a versioned OpenAPI contract, no shared source | 20.1 |

## Contracts that constrain this component

- `contracts/epic-20/story-20.1.openapi-spec-generation.contract.test.ts` — locks down: (1) `generateOpenApiDocument()` produces a structurally valid OpenAPI 3.0.x document; (2) the document is sourced from the real registry real route modules populate at import time, including the real, currently-registered watchlist and health operations; (3) the documented `GET /v1/watchlists` operation matches a live, real production route (booted via `createApp()` + supertest); (4) the generated document contains no frontend-repository reference.

## How to extend this safely

A route opts into the generated spec by calling `registerOpenApiOperation(method, path, operation)` from `src/http/openapi/registry.ts`, at module load time, next to where the route itself is defined — see the call sites in `src/http/versions/v1/router.ts` (`GET /v1/health`) and `src/http/versions/v1/watchlistsRouter.ts` (`GET /v1/watchlists`, `GET /v1/watchlists/{id}`). **This registration call must be placed after all of that module's own `import` statements**, not interleaved with them — ES module imports are hoisted regardless of textual position, but placing executable code between imports is easy to misread and to break on the next edit (this was found and fixed during Story 20.1's own healing pass).

Only the routes FDD-0144's watchlist reference screen actually needs (Stories 20.3–20.5) are registered so far. Adding a new route's documentation is additive: call `registerOpenApiOperation` for it in its own router module; no other file needs to change. There is deliberately no hand-authored spec for the ~40 other existing route groups — see "Known gaps" below.

To regenerate `openapi.json` locally: `npm run openapi:generate` (wraps `scripts/generateOpenApiSpec.ts`, which imports the real `src/http/versions/v1/router` module — the same one `createApp()` uses — so that module's import-time `registerOpenApiOperation()` side effects have actually run before the document is assembled).

## Load-bearing constraints — do not change casually

- **The registry is populated by import-time side effects, not runtime route introspection.** Walking Express 5's router tree after the fact was evaluated and rejected: Express 5's `Layer`/matcher internals discard the original path string after registration, so there is no reliable way to recover `/v1/watchlists/{id}`-shaped path strings from a live `Router` instance. This means `scripts/generateOpenApiSpec.ts` must import the real route module (triggering registration) before calling `generateOpenApiDocument()` — generating the doc without that import silently produces an empty (or stale) `paths` object, not an error.
- **The registry (`registry.ts`'s module-level `Map`) is process-global.** Anything that imports a route module more than once in the same process (in practice: the contract test importing `../../src/http/versions/v1/router` directly, in addition to whatever `createApp()` imports) relies on registration being idempotent (last write per method+path wins) — it is not additive/duplicating, since `registerOpenApiOperation` just does a `Map.set`.
- **`openapi.json` is generated, not checked in** — see `.gitignore`'s Story 20.1 entry. It's a CI build artifact (TDS-0144's CI/CD summary: build → test → publish OpenAPI spec as artifact → deploy), regenerated fresh every run from whatever routes are actually registered at that commit.

## Known gaps / deferred work

- ~~**Story 20.1's other two acceptance criteria are infrastructure, not code, and are not covered by this skill or its contract:** (1) "`social-listening-core` repo builds and passes CI with no frontend code present" — already true today (this package has zero frontend dependencies and lives in its own subdirectory; no code change was needed), but the actual standalone-repository split has not been performed; (2) "original combined repo history is preserved via `git filter-repo` or clean-cut" — TDS-0144's repository split procedure is a one-time manual git operation (extract history into a new repo, push to a new remote) that is explicitly Menno's call per ADR-0144's own Open Items, not something a Jest contract can encode or that should be run autonomously. See `docs/implementation-log.md`'s Story 20.1 entry.~~ — **Documentation Steward correction, 2026-09-25:** stale as of 2026-09-17, `social-listening-core@4c9db6f2` — the standalone-repository split (AC1/AC3) was performed as a follow-up pass the same day this contract landed: `social-listening-core` now exists as its own private repo at `https://github.com/mdresch/social-listening-core` (clean-cut extraction, not `git filter-repo`), with its own CI building/testing/publishing `openapi.json`. All three of Story 20.1's ACs are now satisfied; see `docs/implementation-log.md`'s two Story 20.1 entries (this OpenAPI-generation pass, then the repo-extraction follow-up) and `docs/user-stories/epic-20-adr-0144.md`'s Story 20.1, now `**Status:** Built`.
- **No CI workflow step wires `npm run openapi:generate` into an actual pipeline yet.** The script and package.json script exist; a `.github/workflows` step to run it and upload `openapi.json` as a build artifact has not been added.
- **Only 3 of ~40 route groups are registered** (`GET /v1/health`, `GET /v1/watchlists`, `GET /v1/watchlists/{id}`) — intentionally scoped to what Stories 20.3–20.5's reference screen needs, not full API coverage. Adding coverage for other routes is ongoing, additive work per future stories, not a gate on this one.
- **No request/response JSON Schema fidelity** beyond a minimal, honest `summary` + per-status-code `description` — no request body schemas, parameter schemas, or response body shapes are generated yet.

## Relations to other components

- Depends on `src/http/versions/v1/router.ts` and `src/http/versions/v1/watchlistsRouter.ts` calling `registerOpenApiOperation()` at their own module load time — verified by the contract's AC1 (checks the real, currently-registered paths) and AC2 (a real `createApp()` + supertest call against the real production `GET /v1/watchlists` route).
- `scripts/generateOpenApiSpec.ts` is the real CI entry point; it is the only caller of `generateOpenApiDocument()` outside the contract test itself.
