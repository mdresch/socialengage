# Environment & tooling gotchas

A cross-cutting index of recurring **environment/tooling** surprises — not logic bugs, not story-scope decisions — found the hard way across this project's real build history. Each one previously lived only inside the `SKILL.md` of whichever component happened to be touched when it was found, discoverable only by touching that component again. This file exists so a symptom that smells environmental gets checked against known history *before* re-deriving the root cause from scratch.

**How to use this:** before spending real time root-causing a failure that only happens sometimes, only happens under the full suite / parallel run, or only started after touching auth, the Azure CLI, or a dependency version — scan the relevant section below first. Each entry cites its Implementation Log commit and/or the component `SKILL.md` that carries the full narrative; this file is a terse index, not a replacement for either.

**Maintenance:** add an entry here whenever `heal-contract-failure` or `implement-story` roots out a genuinely environmental cause that isn't already covered — cite the story/commit, keep it terse, link out rather than duplicating the full narrative. Don't silently delete an entry that could still recur even if a specific instance is fixed; mark it resolved/superseded with a dated note instead, same convention as everywhere else in this project's docs.

---

## Real Azure / external-service timing

- **Cold Key Vault key operations exceed Jest's 5000ms default timeout.** A real RSA key create/delete round trip routinely runs long enough to blow the default — symptom is an `afterAll` cleanup hook timing out, not the actual assertion. Fix: explicit `jest.setTimeout(...)`, not reliance on the default. Hit twice for the identical reason (Stories 1.6 and 5.3) before being treated as a known class — see `docs/implementation-log.md`'s `438d93e` and `4fb55bf` entries.
- **Even an explicit 30s Key Vault timeout can go marginal under a long, real, cumulative full-suite run** (a 790s run vs. the usual ~250–300s) — not a logic regression, just real network load stacking up. Current stable value is 60000ms (`docs/implementation-log.md`'s Story 1.7 entry).
- **Microsoft Graph has (at least) two distinct transient-conflict shapes, and they need separate retry predicates, not one merged check:** a 400 "conflicting object" (`isConflictingObjectError`, fixed 2026-08-07 in `grantRoles()`/`revokeRoles()`) and a 409 "concurrent requests" (`isConcurrentTenantRequestError`, fixed 2026-08-10 in the break-glass password-reset/TAP calls, `docs/implementation-log.md`'s `99b58c3` entry). Both need exponential backoff with jitter (up to 8 attempts, capped at 30s) — see `platform-admin-access/SKILL.md`.
- **GNews's free-tier daily quota exhaustion (`403`) is a real, time-based ceiling from heavy real-API test usage — not a flake.** Don't retry it and don't treat it as a regression; it clears on its own once the daily quota resets (`docs/implementation-log.md`'s Story 2.9 healing-pass entry).
- **The Entra break-glass "conflicting object in the directory" test flake (Stories 5.7/5.13) is a known, still-recurring pattern under parallel contention against the same real, shared Entra tenant** — passes cleanly in true isolation, fails intermittently under full-suite parallel load. Treat a lone failure here as this known pattern *only if it doesn't also reproduce in isolation* — if it does reproduce standalone, that's a real regression, not this.

## Azure CLI / credential context

- **`az login --tenant <other-tenant>` for unrelated work (e.g. provisioning a new Entra External ID tenant) silently switches the Azure CLI's active subscription context**, breaking `DefaultAzureCredential`'s CLI-credential fallback for real Service Bus/Key Vault calls against the *original* subscription. Symptom looks exactly like an auth regression in contracts that haven't been touched at all. Fix: `az account set --subscription "<name>"` back to the working subscription — not a code issue, verify with a direct diagnostic script before assuming otherwise (`docs/implementation-log.md`'s `438d93e` entry).

## Jest parallel-worker collisions against shared real resources

- **A Service Bus subscription created with no SQL filter receives *any* message published to that topic by *any* concurrently-running contract file** — Jest's default parallel workers all share one real, fixed topic name. Symptom: intermittent `tenantId`/`schemaVersion` mismatches that look like a publish-logic bug but aren't. Fix: always scope a test's own subscription with a SQL filter on that test's own random `tenantId` (`createTenantFilteredSubscription`/`createIsolatedSubscription` pattern — `ingestion-events/SKILL.md`, `docs/implementation-log.md`'s `34e2a61` entry).
- **Two contract files each spawning a real `next dev` server race on Next's own dev-server lock file**, which is keyed by project `distDir`, not by port — different ports do not save you. Root-caused directly from `next/dist/build/lockfile.js`, not assumed. Fix: give each spawning contract its own `NEXT_DIST_DIR` in its child-process env (`docs/implementation-log.md`'s `832f7b3` entry).
- **Spawning `next dev` regenerates `next-env.d.ts`/`tsconfig.json` as a side effect.** Commit them as-is; don't hand-edit — that's Next's own stated convention for both files (`docs/implementation-log.md`'s `c89ee47` entry).

## Local dev environment / scripts

- **A custom dev-orchestration script can silently never load `.env` at all**, even while `npm test` works fine, if only Jest's own global-setup wires `dotenv` and nothing calls it from the dev script. Symptom: an `.env` var (e.g. `PORT`) appears to have "no effect" on `npm run dev`. Don't assume a dev script loads `.env` just because tests pass — verify directly (`docs/implementation-log.md`'s `15756e0` entry, `scripts/withDevEnv.js`).
- **`dotenv.config()` needs `{ quiet: true }` whenever anything downstream parses that script's own stdout as JSON** — dotenv's default startup banner corrupts it.
- **A fixture file literally named `.env` is silently caught by the repo's own blanket `.env`/`.env.*` `.gitignore` pattern and will never actually commit**, even after `git add`. Check `git status --ignored`, don't assume staging worked; name test fixtures something like `test-fixture.env` instead of adding a `.gitignore` exception.
- **A doc comment whose prose contains a literal `*/` prematurely closes the surrounding `/** ... */` block comment** — a real `SyntaxError`, not a lint nit. Watch for this specifically when a comment documents something containing `*/` (a glob pattern, a code snippet, a list like `AZURE_*/PORT`).

## Auth / identity wiring

- **A missing OAuth scope naming the downstream API's own app registration makes `jwtVerify()` fail with "signature verification failed" on every cross-service call** — looks exactly like a token/crypto bug, is actually Entra never minting a token audienced for that API at all. The fix is a delegated scope (e.g. `access_as_user`, "Expose an API"), granted and admin-consented on the calling app's registration — distinct from an `Application`-type app role, which is for M2M/`client_credentials` and doesn't fix this (`docs/implementation-log.md`'s `dba9895` entry).
- **Entra's `oid` (the Object ID shown in the admin center) and a token's own `sub` claim are genuinely different values** in this project's tenant. Hand-seeding an identity row using `oid` when `resolveIdentity()` matches on `sub` silently breaks sign-in for that seeded account with no obvious error. Always seed from a real captured token's `sub`, never the admin center's displayed ID.

## npm / transitive dependency surprises

- **A transitive dependency going ESM-only in a newer major version breaks CommonJS/ts-jest** with `SyntaxError: Cannot use import statement outside a module` — pinning your own *direct* dependency's version doesn't help, since the offending package is transitive. Root-cause via `npm view <pkg>@<version> type` across versions to find the last CJS-compatible release, then fix via `package.json`'s `overrides` field pinned to that release — not by changing the direct dependency you actually wanted. Hit via `htmlparser2` v10+ (pulled in by `sanitize-html`), Story 3.10 — see `canonical-markdown-conversion/SKILL.md`.
- **`ts-node`'s per-file, on-demand type-checking does not eagerly load a stray ambient `.d.ts` file the way a full `tsc`/`ts-jest` Program does.** Passes cleanly under `tsc --noEmit` and the Jest suite, fails only when something spawns `ts-node` directly against a real process (e.g. a contract that spawns the real `server.ts`, the pattern Story 1.10 uses), with `TS7016`. tsconfig's own `include` glob isn't enough for `ts-node`'s reachability analysis — fix with an explicit `/// <reference path="./x.d.ts" />` in the file that actually needs the ambient types. Hit in `src/content/htmlToMarkdown.ts`, Story 3.10.

---

*First compiled 2026-08-13, during a methodology retrospective, from `docs/implementation-log.md`'s own healing-pass entries and existing component `SKILL.md`s — not a new discovery pass, a consolidation of what had already been found and documented piecemeal.*
