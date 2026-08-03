# Open items and deferred work — overview

**As of 2026-07-30, all 25 stories (all 5 epics) have a passing contract and a logged commit — see `docs/implementation-log.md`.** The original 23 plus two later additions: Story 2.6/ADR-0024 (Newswire connector) and Story 1.4/ADR-0025 (persistent local dev database — dev tooling, not production architecture, a deliberate named exception; see its own Acceptance note). "Done" there means: every story's own Acceptance Criteria are genuinely met, proven against real infrastructure, not mocked. It does **not** mean the subsystem is production-ready or that every capability named anywhere in the spec/ADRs is fully wired end to end. This document consolidates every deliberately-deferred item scattered across the 15 component `SKILL.md`s, the ADR series, and `docs/implementation-plan.md`, into one place — so "what's actually left" doesn't require re-reading all of them. **Refreshed 2026-07-30** after Stories 2.6 and 1.4 landed — see the dated notes below for exactly what changed.

Nothing here is a surprise gap — every item below was a deliberate scope decision at the time (usually "prove the mechanism, not the whole pipeline," this session's recurring pattern), documented where it was decided. This overview doesn't re-litigate any of them, just collects them.

## How to read this

- **Section A** is the big one: real, substantial work the story-by-story ADR process never covered, because it isn't architecturally interesting enough to warrant an ADR (CRUD surface, the admin UI, wiring real connectors together). This is most of what's left before this is a usable product.
- **Section B** is narrower gaps *within* already-shipped stories — a component does exactly what its contract requires, and no more.
- **Section C** is explicitly out of scope for this subsystem entirely, not deferred.
- **Section D** is decisions not yet made (need a human go/no-go), not just work not yet done.
- **Section E** is process/tooling debt.

---

## A. "Also build, not storied" — real work with no ADR/story of its own

Per `docs/implementation-plan.md`'s own framing: the ADR series covers architecturally significant decisions, not ordinary CRUD or UI surface (ADR-0025 is the one deliberate, flagged exception — see its own Acceptance note). This is real, necessary work, called out per phase so it isn't invisible:

| Phase | Not-yet-built, no story covers it |
|---|---|
| **1 (MVP)** | **The RSS/News connector shipped 2026-08-01** (Story 2.7/ADR-0026, GNews API) — see the dated note below. Watchlist CRUD (Story 1.5) and connector connect/disconnect (Stories 1.6/1.7) are also now complete. Still not built: the admin UI itself. **2026-08-04: the admin UI's own user stories are now drafted** (`docs/user-stories/epic-6-admin-ui.md`, Stories 6.1–6.6), covering the connect flow (6.3), watchlist management (6.4), and connector status view (6.5) named here — plus a prerequisite auth/session story (6.1, sourced from a new ADR-0036, Proposed) and a role-gated routing shell (6.2). **Two real, previously unnamed backend gaps surfaced by that drafting pass:** no `social-listening-core` endpoint exposes a signed-in caller's resolved role/identity over HTTP (blocks Story 6.1), and Story 6.5's status view needs a "list this tenant's connectors" endpoint that doesn't exist either (only single-platform `GET /v1/connectors/:platformId` does). The 2026-08-03 design mockup (`docs/design/admin-ui-mockup-2026-08-03.html`) remains a layout/flow reference only, not yet reconciled screen-by-screen against these stories. |
| **2 (Enrichment)** | The real `AIProviderConnector` (Azure AI Language); `POST /ai-providers/:id/connect`, `GET /ai-providers/:id/models`, `POST /ai-providers/:id/select-model`; wiring enrichment into the ingestion pipeline after normalization (this is *why* `sentiment`/`engagementMetrics` don't exist on `social_posts` yet — see Section B) |
| **3 (Eventing)** | A throwaway/internal test subscriber — without one, ADR-0012/0013's per-tenant filtering design is unverified against a real consumer, only against this repo's own contract tests |
| **4 (Scale-out)** | **The Newswire connector (Story 2.6, ADR-0024) shipped 2026-07-30** — a real connector, out of spec §10's original build-order sequence (RSS/News shipped 2026-08-01, see Phase 1's row; Reddit still unbuilt). A third connector (Reddit, or whichever platform is prioritized next) would still be what exercises Story 3.6's AST/capability-matrix machinery and Story 2.4's dead-lettering under more than one real, differently-paced connector at once — Newswire and GNews run independently of each other, not concurrently exercised by the same test. |
| **5 (Production readiness)** | The entire phase: security review, load/chaos testing against the isolation guarantees this whole ADR series argued for (RLS, per-tenant rate limits, per-tenant event filtering), operational runbooks for the failure modes ADR-0009/0010/0023 describe, real authentication (see Section B), final go-live checks |

**Build-order deviation, worth being upfront about:** Newswire (Phase 4) shipped before RSS/News or Reddit (Phase 1) — the original spec §10 sequence. ADR-0024 explicitly sanctioned this ahead-of-order drafting (same pattern as ADR-0017/0019), so Phase 1's own MVP connector stayed entirely unbuilt for a while even after a later-phase one ran for real. **Resolved 2026-08-01:** Story 2.7 (RSS/News's actual connector, GNews API, ADR-0026) is now built and contract-verified against live GNews results and a real Key Vault — see `.claude/skills/gnews-connector/SKILL.md`. Phase 1's own MVP deliverable (storied half) is complete; Reddit (Phase 1's second platform) remains unbuilt, and Phase 1's "also build, not storied" CRUD/admin-UI work (row above) remains open.

**The connective tissue: partially closed 2026-07-30, extended 2026-08-01, still not fully closed.** Story 2.6's Newswire connector was the first to actually call `runIngestionAttempt()` → `RequestGate` (`acquireForProvider()`, with real gate-error reclassification) → `upsertAuthor()`/`insertSocialPost()`, proven against genuinely live feeds, not a synthetic fixture. Story 2.7's GNews connector is the second, and the first to do so using a real per-tenant credential (`authMode: 'api_key'`) rather than no auth at all — see `.claude/skills/newswire-connector/SKILL.md` and `.claude/skills/gnews-connector/SKILL.md`. What neither does: call watchlist matching (`resolveWatchlistAstDispatch()`/`matchPostsForWatchlistAst()`) or `publishEvent()` as part of its own ingestion flow — both are proven correct independently (Stories 3.3/3.6, 5.1/5.2/5.5) but still not wired into any real connector's actual attempt(), same as before. So the full chain — poll → gate → normalize → **match** → **enrich** → **publish** — still has two unwired links, not five, now proven against two independent real connectors instead of one.

**Also explicitly out of scope for this whole plan, not just deferred:** Brand Reputation & Alerts, Social Care, Social Selling subsystems — designed separately once this subsystem ships (spec §1, §9). Nothing here builds toward them beyond leaving the REST API and Service Bus events they'll eventually consume.

---

## B. Deferred sub-scope within already-shipped stories

Grouped by theme. Each component's own `SKILL.md` ("Known gaps / deferred work" section) is the authoritative, more detailed version — this is the index.

### Real-connector wiring (partially resolved 2026-07-30, extended 2026-08-01 — see below)
- **Resolved for two real connectors:** Story 2.6's Newswire connector and Story 2.7's GNews connector both call `runIngestionAttempt()` and `acquireForProvider()` (`RequestGate`, with real `QueueTtlExceededError`/`QueueDepthExceededError` reclassification) for real, against live feeds/search results — no longer just example/synthetic fixtures. GNews is also the first to do so authenticating with a real per-tenant credential (`authMode: 'api_key'`), where Newswire needed none. *(`provider-connector-framework`, `connector-health-and-error-handling`, `social-post-lineage`, `newswire-connector`, `gnews-connector` SKILL.mds)*
- **Still open:** no real connector calls `translateWatchlistQuery()`/AST matching or `publishEvent()` as part of its own attempt() — Newswire declares `supportedQueryFeatures: []` and GNews declares a real, richer `['AND', 'OR', 'NOT', 'TERM']` (both proven against real fetched content), but neither invokes matching from inside its actual ingestion flow; `publishEvent()` still has no real connector-triggered caller at all. *(`watchlist-matching`, `ingestion-events` SKILL.mds)*
- `acquireForAiModel()`'s equivalent reclassification is still unexercised by any real caller — no real `AIProviderConnector` exists yet (Phase 2 work). *(`connector-health-and-error-handling` SKILL.md)*
- No real OAuth token-exchange flow exists for any platform (Newswire is `authMode: 'none'`, needs no auth at all; RSS/News's real connector, GNews, is `authMode: 'api_key'`, built 2026-08-01, proving that auth mode for real — OAuth becomes real once Reddit or another OAuth platform is built, the missing third data point ADR-0026 itself names). Token rotation/refresh-before-expiry (ADR-0010's stated behavior) isn't implemented either. *(`credential-envelope-encryption`, `provider-connector-framework`)*

### Distributed / multi-instance correctness
- **Redis-backed distributed `RequestGate` state (ADR-0020's other half, Story 2.4) is deliberately not built.** Only load-bearing once a second concurrent `social-listening-core` instance actually runs — for a solo deployment that may never happen. Treated as "build when the need is real," possibly never, not "build on schedule." *(`provider-connector-framework`, `connector-health-and-error-handling`)*

### Derived-data caching & refresh (Story 4.4)
- `avgEngagement`/`sentimentBreakdown` on `AuthorTopicSignal` are never populated — `social_posts` has no `engagementMetrics`/`sentiment` source column yet (blocked on Phase 2's enrichment pipeline, Section A).
- Only `GET /v1/connectors/:platformId` exists — no "list all connectors for a tenant" endpoint (no connector/platform registry query is storied).
- The optional `?fresh=true` cache-bypass param ADR-0022 names is not built (explicitly optional).
- `pg_cron` is only enabled on the local ephemeral test container — no production/Azure-side enablement (allow-listing the extension, setting `cron.database_name` on the real Azure Database for PostgreSQL Flexible Server instance) has been done.
*(`derived-data-caching-and-refresh` SKILL.md)*

### Retention & archival (Story 3.5)
- **Nothing schedules `archiveAgedRawPayloads()`/`archiveAgedIngestionRuns()` periodically** — both are proven correct when called directly. The same `pg_cron` pattern Story 4.4 just established could schedule this; it just hasn't been done.
- Partition-maintenance automation (extending the `-24..+3` month window ahead of need) isn't scheduled — current headroom is generous but not unbounded.
- No batching/pagination within a single archival run (fine at current scale).
*(`data-retention-and-archival` SKILL.md)*

### Eventing (Stories 5.1/5.2/5.5)
- No real coordinated schema-version cutover exists — ADR-0019 itself treats "is this operationally realistic" as open, to revisit once a real downstream subscriber exists.
- `sentiment` on `SocialPostIngestedEvent` has no real source yet (same enrichment-pipeline dependency as above).
- `schemaVersion` isn't mirrored into the JSON payload body (ADR-0019 calls this optional).
*(`ingestion-events` SKILL.md)*

### Security / authentication
- **Resolved 2026-08-03/2026-08-04 for `/v1` endpoints generally:** real authentication now exists (Story 5.6, ADR-0029) and `X-Tenant-Id` is fully retired as a trust mechanism (Story 5.10, ADR-0033) — every `/v1` route except `/v1/health` requires a real bearer token, resolved via `resolveIdentity()` (Story 5.9). This bullet is kept, corrected, rather than deleted, per this doc's own convention.
- **Still open, confirmed 2026-08-04: no endpoint exposes a resolved caller's own identity/role back to that caller.** `resolveIdentity()`'s result is attached to `req.identity` for route handlers to read internally, but nothing returns it over HTTP — a real gap, since the admin UI (`docs/user-stories/epic-6-admin-ui.md`, Story 6.1) needs exactly this to role-gate its own screens and cannot infer role from the Entra token itself (ADR-0029 §2 forbids it). See ADR-0036 §5.
- **Still open, confirmed 2026-08-04: no HTTP/REST surface exists for `tenants` or Platform Admin actions (provisioning, seat management, break-glass, audit log)** — `tenants/SKILL.md` and `platform-admin-access/SKILL.md` both state this directly; only store/mechanism-level code exists (Stories 5.7/5.8). Blocks Story 6.6 (Platform Admin console).
- **Still open, confirmed 2026-08-04: this project has no decided real-production secrets-management strategy for any application-level secret** (Entra client secrets, database credentials, and now the admin UI's own session-cookie encryption key, ADR-0036 §1) — distinct from ADR-0014's Key Vault envelope encryption, which is scoped specifically to tenant-supplied platform credentials, not this project's own operational secrets. Everything today is a local `.env`, gitignored, with no deployed environment to provision one for. Surfaced by a Security & Architecture Reviewer finding against ADR-0036; not solved narrowly for that one key — a real, project-wide gap once a real deployment target exists.
- Key Vault throttling/outage has no dedicated `ErrorKind` yet (generic `network`/`http_5xx` may already cover it — revisit if a real Key Vault-dependent connector call shows otherwise).
- Test-run Key Vault keys are soft-deleted, not purged (90-day Azure retention) — periodic manual vault purge is a housekeeping task, not automated.
*(`posts-api`, `connector-health-and-error-handling`, `credential-envelope-encryption` SKILL.mds)*

### Watchlist matching (Stories 3.3/3.6)
- No persisted `Watchlist` entity/table or CRUD endpoints exist — only the `WatchlistTerms`/AST value types (the real table is Phase 1's "also build, not storied" work, Section A).
- No connector/watchlist status view surfaces `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` field anywhere real — proven correct at the data level only.
- **Partially resolved 2026-07-30:** the Newswire connector (Story 2.6) declares a real `supportedQueryFeatures: []`, proven to correctly dispatch to fallback (not silently pass everything through) against real fetched content — no longer only a reference fixture's shape. Still no real connector implements `translateWatchlistQuery()` itself (native, connector-side filtering) — Newswire's feeds have no such capability to translate into.
- No quoted multi-word phrase support in the AST grammar (not in ADR-0021's v1 node types).
*(`watchlist-matching` SKILL.md)*

### Connector-health rule tuning
- ADR-0023's `deliveryMode`-based threshold variation (push vs. poll should arguably use different failure thresholds) remains an open, deliberately-deferred question per that ADR's own Acceptance note.
*(`connector-health-and-error-handling` SKILL.md)*

### Enrichment
- Nothing populates `enrichment.entities`/`keyPhrases`/`publishedAt` from real posts yet — needs the real `AIProviderConnector` (Section A). `entities` is currently just a plain string array; the real pipeline may need a richer shape (confidence scores, entity types) — that decision is deferred to whoever builds it.
*(`social-post-enrichment` SKILL.md)*

---

## C. Explicitly out of scope (not deferred — a boundary, not a gap)

- **Brand Reputation & Alerts, Social Care, Social Selling** — separate subsystems, designed later (spec §1, §9). See [`docs/future-subsystems.md`](future-subsystems.md) for what's parked against each — not tracked here in any more detail than this one line.
- **Tenant offboarding / right-to-erasure (GDPR Article 17)** — explicitly out of ADR-0018's own scope; not addressed anywhere in this subsystem yet.
- **Geocoding of `profileLocation`** — explicitly out of scope, spec §9, no decision made to record.
- **Capability-based connector composition / registry** — premature for a two-branch (`SocialConnector`/`AIProviderConnector`) hierarchy; revisit only if a third, structurally different provider type materializes.
- **OpenAPI-first contract governance, connector certification, sandbox/test harness, DR/replay strategy, CODEOWNERS** — reasonable platform-maturity investments, but ahead of where this subsystem is (pre-implementation of any downstream consumer). **Revisit trigger:** before the first downstream subsystem (likely Brand Reputation & Alerts) begins integrating.
- **Consumer contract ownership** (who owns backward compatibility as the producer/consumer graph grows) — flagged as a likely future ADR candidate once a second or third real downstream consumer exists. Not pinned to a number yet.

---

## D. Not yet decided (needs a human go/no-go, not just unbuilt)

- **ADR-0004's point-in-time author snapshot** (retaining `followerCount`-at-publish-time on `SocialPost` despite `Author` being normalized) — flagged during review as a genuine trade-off, not a strict improvement (it partially reintroduces the per-post duplication ADR-0004 argued against). Needs an explicit decision before it's even drafted as an ADR, let alone built.

---

## E. Process / tooling debt

- **TypeScript pinned to `6.0.3`**, not the registry's latest (`7.0.2` at scaffold time) — `ts-jest`'s peer range doesn't yet support TS 7's compiler API. Revisit once `ts-jest` (or an alternative) supports it.
- **No migration/query-builder/ORM** — plain `.sql` files applied directly via the `pg` client. Deliberately minimal for now; revisit if hand-written SQL migrations become genuinely cumbersome.
- **Docker required locally for tests** — `jest.global-setup.js` brings up an ephemeral Postgres container automatically; this is a real local-dev prerequisite as of Phase 0.
- **Resolved 2026-07-30 (Story 1.4, ADR-0025):** there's now also a persistent local dev Postgres (`docker-compose.dev.yml`, port `5435`, own named volume), fully independent of the ephemeral test container above — `npm run db:dev:up`/`db:dev:migrate`/`dev` runs the real server against real, surviving data. Deliberately not storied originally (`docs/implementation-plan.md`'s Phase 0 line), captured as an ADR anyway after real friction (a concurrent test run wiping a running demo server) was hit in practice — see ADR-0025's own Acceptance note.
- **A benign Jest teardown warning** ("worker process failed to exit gracefully") sometimes prints during parallel Key Vault contract runs — confirmed cosmetic (exit code `0`, disappears entirely under `--runInBand`); not something to chase.
- **No OpenAPI spec or schema-registry tooling** — deferred with the same "no downstream consumers yet" reasoning as Section C's platform-maturity items.

---

*This document is a point-in-time snapshot (2026-07-30), not itself append-only or auto-verified like `docs/implementation-log.md`. As new stories/phases close some of these items, update this file directly rather than leaving it stale — it has no CI check keeping it honest the way the Implementation Log does.*
