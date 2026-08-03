# ADR-0033: Retire `X-Tenant-Id` as the tenant-identity trust mechanism

**Status:** Accepted (2026-08-03) — drafted by the AI Business & Requirements Analyst persona, reviewed and accepted by Menno as drafted, no revisions. Fifth of a seven-ADR batch; assumes ADR-0029 (Entra authentication), ADR-0030 (bypass mechanism), ADR-0031/ADR-0032 (`tenants`/`users` schemas and the identity-resolution path).
**Acceptance note (2026-08-03):** Accepted by Menno, verbatim: *"ADR 0033 remove X Tenant for bearer token. Is Approved."* This also satisfies §Open-Questions' own flagged request for "Menno's own explicit sign-off" on rejecting a staged, both-mechanisms transition (§5/Alternatives Considered) — accepted as drafted, no staged transition. The remaining Open Question (exact test-harness replacement mechanism) stays open.
**Source:** `docs/adr/README.md`'s 2026-07-30 governance note (candidate ADR #5); `Business-Case-v6.0.md` Risk R-04 and §2 Gap Analysis ("`X-Tenant-Id` remains an unauthenticated client-supplied placeholder"); ADR-0017 (API versioning/compatibility policy, whose exception this ADR must reason through explicitly, not silently bypass).

## Context

Every `/v1` router in `social-listening-core` (`connectorsRouter.ts`, `watchlistsRouter.ts`, `postsRouter`, `topicsRouter`, and every contract test exercising them — 132/132 currently passing, per `docs/implementation-plan.md`) trusts a client-supplied `X-Tenant-Id` header as its entire tenant-identity boundary, verified directly in `connectorsRouter.ts`: `const tenantId = req.header('X-Tenant-Id')`. `Business-Case-v6.0.md`'s own Risk R-04 rates this "High (certain, if triggered)... release-blocking... once external users are contemplated." ADR-0029–0032 now give this project a real authentication mechanism and a real path from a validated token to a resolved `(tenantId, userId, role)`. This ADR is the mechanical cutover: retiring the header everywhere it is currently trusted.

## Decision

### 1. `X-Tenant-Id` is removed as a trust source, everywhere, in favor of `Authorization: Bearer <token>`

Every `/v1` request must carry `Authorization: Bearer <Entra-issued access token>`, validated per ADR-0029 (issuer + JWKS, standard OIDC), resolved to `(tenantId, userId, role)` per ADR-0032 §5's identity-resolution bypass. This resolution happens in **one piece of authentication middleware, applied once, at the top of the router stack** — not duplicated per route, and not left to each route handler to re-implement.

### 2. Minimal blast radius by design: every downstream function signature is unchanged

`withTenant(tenantId, ...)`, `storeCredential(tenantId, ...)`, `getCachedConnectorHealth(tenantId, ...)`, and every other tenant-scoped function in this codebase keep their exact existing signatures. **Only the source of the `tenantId` value passed into them changes** — from `req.header('X-Tenant-Id')` to the middleware-resolved value attached to `req` by the new authentication middleware. This is deliberately the entire point of this ADR's design: change exactly one seam (the very top of the request pipeline), not every function's own contract.

### 3. Security requirement: a stray `X-Tenant-Id` header must be ignored, never merged or trusted

If a client still sends an `X-Tenant-Id` header after this ships, it **must** be ignored server-side — never read, never merged with, never allowed to override the token-resolved tenant. Today's code trusts this header as the entire tenant boundary; this is a real, currently-live spoofing vector (any caller can claim any `tenantId` today), not a hypothetical one this ADR is being cautious about in the abstract.

### 4. ADR-0017 compatibility-policy exception — named and reasoned through explicitly, not silently skipped

This is a breaking change to every `/v1` endpoint's authentication contract (removes a required header, requires a new one) — exactly the category ADR-0017 says "requires a new version, with the old version kept running unmodified alongside it for a deprecation window." **This ADR takes the position that a `/v2/` bump and 90-day deprecation window are not warranted for this specific, one-time cutover**, for a stated reason: ADR-0017's own rationale is protecting "a documented consumer expectation" of an independently-deployed consumer *not in the room* when a breaking change ships. Per `docs/adr/README.md`'s own "OpenAPI-first... consumer contract ownership" deferred item, **no such independent downstream consumer exists yet** — the only current consumer, `social-listening-admin`, is updated in the same coordinated cutover as this change, by the same project, not an unaware third party discovering a break after the fact. **This exception applies only to this one authentication-mechanism cutover.** Any future breaking change, once a real independent downstream consumer exists (the first candidate being Brand Reputation & Alerts, per `docs/future-subsystems.md`), must follow ADR-0017's full policy without a similar exception — this ADR does not weaken ADR-0017 generally, it names one bounded, reasoned departure from it.

### 5. Test/dev-harness impact — named as a build-time concern, not designed here

A large share of this project's existing 132 contract tests set `X-Tenant-Id` directly as their way of establishing tenant context under test (Stories 1.5, 1.6, and every epic-3/4/5 test touching a tenant-scoped table). Each of these needs a replacement mechanism once `X-Tenant-Id` stops being trusted — e.g. a test-only auth bypass, a locally-minted JWT signed by a test key matching a test JWKS, or an explicit test seam that injects a resolved identity directly, bypassing real Entra calls in test. **This is flagged here as real, substantial rework across most of this project's existing test suite, not a small detail** — left to whoever implements this ADR's story (the AI Delivery Agent), so it isn't discovered mid-build as a surprise.

## Consequences

**Positive**
- Closes `Business-Case-v6.0.md`'s Risk R-04 directly — the single dependency every other row in that document's own dependency matrix sits behind.
- The "one seam, not every function" design (§2) keeps this genuinely foundational change's *code* blast radius small, even though its *test* blast radius (§5) is large.

**Negative**
- **This is, without qualification, the largest blast-radius change in this entire seven-ADR batch.** Every one of this project's ~130+ existing contract tests that sets `X-Tenant-Id` needs rework to keep passing once the header stops being trusted — this is stated plainly, not softened, because minimizing the *production* code seam (§2) does not shrink the *test* rework (§5) at all.
- Any transitional period accepting both mechanisms (kept for safety while tests are migrated) reopens the exact spoofing vector §3 exists to close, unless the header is demoted to fully inert (read, logged, and discarded) rather than genuinely accepted as a fallback — a real operational tension between "make the migration easier" and "close the security gap immediately," named here rather than resolved by wishful thinking.

## Alternatives Considered

- **Keep `X-Tenant-Id` as a secondary, defense-in-depth signal alongside real authentication** — rejected: a coexisting, client-trusted alternate tenant source reopens exactly the spoofing vector §3 closes, unless demoted to advisory-only (logged, never acted on), which provides no real benefit over removing it outright.
- **A transition period accepting both mechanisms**, to reduce the one-shot size of the test rework in §5 — considered, and named as a legitimate, rejected-for-now option rather than silently dismissed: rejected because it directly conflicts with §3's security requirement for as long as it lasts, and this project has no external caller today whose migration needs to be staged — the "reduce rework pain" benefit accrues only to this project's own test suite, which can be reworked directly instead.

## Open Questions for decision

- **The exact test-harness replacement mechanism** (§5) — minted test JWTs vs. an explicit test-mode auth bypass vs. something else — left to implementation.
- **Whether a staged, both-mechanisms transition is actually safer** given how much test code is touched at once, weighed against §3's security requirement — named in Alternatives Considered as rejected, but flagged here as worth Menno's own explicit sign-off given the real size of the one-shot rework, not treated as a closed question by this ADR alone.

## Amendment Log

- 2026-08-03 — Initial proposal, drafted by the AI Business & Requirements Analyst persona.
