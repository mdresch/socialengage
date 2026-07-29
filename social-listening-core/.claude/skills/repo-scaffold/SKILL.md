---
name: repo-scaffold
description: The top-level project scaffold for social-listening-core — its independent package identity, build/test tooling, and the no-coupling-to-admin boundary. Read this before adding root-level config (package.json, tsconfig, CI) to this repo.
---

# social-listening-core repo scaffold

## What this is

The root-level project setup for `social-listening-core`: `package.json`, `tsconfig.json`, `jest.config.js`. It establishes that this repo is an independently versioned, independently buildable npm package — not a workspace member sharing a root with `social-listening-admin`. This is the backend half of ADR-0001's two-repository split; `social-listening-admin` (a sibling directory) is the only other repo it has any relationship to, and that relationship is REST-only, defined entirely from admin's side (see admin's `core-api-client` `SKILL.md`).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0001 | Split into `social-listening-core` / `social-listening-admin`; core is deployable, testable, and versionable independent of any UI | 1.1 |

## Contracts that constrain this component

- `contracts/epic-1/story-1.1.independent-repo-scaffold.contract.test.ts` — asserts `package.json` declares its own independent `name`/`version`/`build`/`test` scripts, has no dependency on `social-listening-admin`, and that no parent `package.json` unifies the two repos under a shared workspace root.

## How to extend this safely

- Add `src/` and its own contracts as later stories require actual backend behavior (Story 1.2's Postgres setup, Story 5.4's RLS, Story 5.3's Key Vault credential storage, etc. — see `docs/implementation-plan.md` Phase 0). None of that exists yet; this scaffold intentionally has no `src/` directory.
- Any new root-level dependency is fine as long as it isn't `social-listening-admin` itself and doesn't require a shared workspace file at the parent (`socialengage/`) level — that would violate independent deployability.
- CI workflow (`docs/templates/ci-workflow.md`) and the Husky pre-commit hook (`docs/templates/pre-commit-hook.md`) are documented as "copy in during Phase 0" but are not yet copied into this repo — do that as its own tracked step, not silently bundled into an unrelated story.

## Load-bearing constraints — do not change casually

- Never add `social-listening-admin` as a dependency, and never create a `package.json` at the workspace root (`socialengage/package.json`) that declares both repos as `workspaces` members — either would reintroduce the joint-versioning coupling ADR-0001 argued against.
- `enforce-contract-first.cjs` (the `PreToolUse` hook) only blocks writes under `<repo>/src/**` once a contract exists in `<repo>/contracts/`. This repo now has one contract, so the hook will no longer block `src/` writes here — but that's a floor, not a substitute for actually writing a contract for whatever specific behavior a future story adds.

## Known gaps / deferred work

- No `src/` yet — this story (1.1) only needed to prove the repository-boundary property, not implement any backend behavior. The connector framework, ingestion, storage, and REST API itself are Phase 1+ work.
- TypeScript is pinned to `6.0.3` (`typescript@6.0.3`, exact) rather than the registry's `latest` (`7.0.2` at scaffold time) — TypeScript 7 doesn't yet expose the JS compiler API `ts-jest` needs (`ts-jest`'s peer range is `>=4.3 <7`). Revisit the pin once `ts-jest` (or an alternative TS-7-native transform) supports it.
