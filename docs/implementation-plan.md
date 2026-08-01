# Implementation & Delivery Plan — Social Listening / Insights Subsystem

Sequences the [user stories](user-stories/README.md) — grounded in the [ADRs](adr/README.md) — into build phases. Originally 23 stories/ADRs (2026-07-29); 25 after Story 2.6/ADR-0024 and Story 1.4/ADR-0025 were each added and accepted the same day they were drafted (2026-07-30); now **26**, after Story 2.7/ADR-0026 (RSS/News connector — GNews API) was drafted 2026-07-31 and accepted by Menno later the same day — see `docs/adr/README.md`'s footnotes 6/7/8. Unlike the first two additions, ADR-0026 wasn't self-accepted by the same session that drafted it (the drafting persona doesn't hold acceptance authority), so Story 2.7 was briefly Blocked before Menno's separate review — it is now Ready, same as every other story in this plan. This is a dependency-ordered plan, not a calendar: no durations or sprint lengths are estimated. This is a solo-developer personal project (confirmed 2026-07-29), so "no team-scale process" is a deliberate choice throughout this plan (see Phase 0's testing/CI recommendation and Phase 4's note on multi-instance work), not just an absence of data to estimate against.

## How to read this

- **Ready** stories (26 of 26, as of 2026-07-31) are sourced from Accepted ADRs and can be built as written. "Ready" is not the same as "built yet," though: several Ready stories (e.g. 2.4, 2.5, 3.5, 3.6, 4.4) are still deliberately scheduled for a later phase — see each one's own scheduling note. Story 2.7 was Ready-but-unbuilt as of 2026-07-31; it's been built since, 2026-08-01 — see Phase 1's own note below.
- **Blocked** stories (0 of 26, as of 2026-07-31) — historical again. Story 2.7 was briefly Blocked between ADR-0026's drafting (2026-07-31) and Menno's acceptance of it the same day; a phase that includes a Blocked story needs that ADR accepted before the phase can close, and that constraint no longer applies to Phase 1.
- **This plan is not the whole scope.** The 23 stories cover architecturally significant decisions — that's what the ADR series was for. Ordinary CRUD surface (watchlist create/read/update/delete, connector connect/disconnect endpoints, the admin UI's screens) was never architecturally interesting enough to warrant its own ADR, but it's real, necessary work that has to happen alongside the storied work. It's called out per phase below so it isn't invisible.
- **Not covered at all:** Brand Reputation & Alerts, Social Care, Social Selling — explicitly deferred to be designed separately once this subsystem ships (spec §1, §9). Nothing in this plan builds toward them beyond leaving the REST API and Service Bus events they'll eventually consume. See [`docs/future-subsystems.md`](future-subsystems.md) for what's parked against each one, rather than just "out of scope."
- **How each story actually gets built** (scope discipline, contract-first testing, component `SKILL.md`s, permanent regression suite) is a separate concern from *when* — see [`docs/implementation-methodology.md`](implementation-methodology.md), operationalized as the `implement-story` Claude Code skill. This plan says what and when; that document and skill say how, uniformly, for every story in every phase below.

## Decisions resolved 2026-07-29

Three things needed an answer that nothing in the ADR series or spec resolved on its own — two were spec's own long-standing open questions (§10), one was a judgment call surfaced by phasing the work. All three are now decided (see spec §10 for the authoritative record):

1. **Which platform ships first:** RSS/News first (poll-only, API-key auth, no paid tier — cheapest way to validate the full pipeline without also debugging OAuth and rate-limit-tier economics in the same pass), then Reddit second (poll, OAuth, real rate limits, real boolean-query needs) specifically to prove the `ProviderConnector` abstraction (ADR-0002) generalizes rather than having been shaped around only the first connector.
2. **Testing strategy and CI/CD:** deliberately lightweight, matching a solo-developer project rather than team-scale process — GitHub Actions on push/PR running lint, type-check, and unit tests for both repos, plus one integration-test tier against an ephemeral/dockerized Postgres (RLS and JSONB behavior need real Postgres, not a mock). No CODEOWNERS, no OpenAPI-first contract-testing pipeline yet — consistent with those already being deferred in `docs/adr/README.md`'s "explicitly not drafted" list, for the same underlying reason: that's process built for contributors and consumers that don't exist yet.
3. **All 23 ADRs in this series are now Accepted (2026-07-29).** ADR-0017 (API versioning) and ADR-0019 (event schema versioning) were accepted ahead of the phases that would otherwise touch them — both were cheap to decide now and expensive to retrofit after real endpoints/consumers exist. ADR-0018 (data retention and archival) — `rawPayload` at 90 days, `IngestionRun` at 18 months, both configurable — and ADR-0020–0023 were accepted on their normal schedule, not early for a scheduling reason; each simply resolved its own open implementation-default questions at acceptance (see each ADR's "Acceptance note"). Being Accepted doesn't pull a story's *build* forward, though: Stories 3.5, 2.4, 2.5, 3.6, and 4.4 are all Ready now but stay scheduled for Phase 4 below, same as before acceptance — only the "needs an ADR decision before this phase can close" gate is gone, not the phase sequencing itself. One acceptance has a real code consequence worth flagging here: ADR-0023's rate-relative failure threshold partially supersedes the flat rule Stories 2.3 and 4.3 already shipped with (see ADR-0009's and ADR-0010's "Supersession update" notes) — their code stays as shipped until Story 2.5 is actually built, which is when that healing happens, not now.

---

## Phase 0 — Foundations (decisions + scaffolding, no ingestion yet)

**Goal:** two deployable-but-empty repos, a tenant-isolated database, and credential storage — nothing that ingests a post yet, but everything a connector will need to plug into.

**Stories:** 1.1 (repo split), 1.2 (Postgres + JSONB), 5.4 (RLS on every tenant table), 5.3 (Key Vault envelope-encrypted credential storage), 1.3 (API versioning — decided ahead of schedule, see above), 1.4 (persistent local dev database, ADR-0025, accepted 2026-07-30 — the Postgres half of the "local dev environment" line below, promoted out of unstoried tooling after real friction was hit in practice; see ADR-0025's own Acceptance note for why this is a deliberate exception).
**Also build, not storied:** `/v1/` route scaffold (empty, per the now-accepted ADR-0017); lightweight GitHub Actions CI per the decision above; the Key Vault half of a local dev environment (an emulator or dev tenant — the Postgres half is now Story 1.4 above).

**Deliverable:** `social-listening-core` and `social-listening-admin` both deploy successfully to a dev environment; a smoke-test tenant can be created with RLS-isolated tables and a stored, encrypted dummy credential — with no connector, watchlist, or post yet.

---

## Phase 1 — MVP: one connector, end to end

**Goal:** the smallest real slice — one platform, one tenant, one watchlist, posts flowing from that platform into a queryable API, with visible health status. This is the phase that proves the architecture, not just the first platform.

**Stories:** 2.1 (connector framework), 3.1 (Author), 3.2 (IngestionRun), 2.2 (per-tenant rate limiting), 2.3 (error handling + flat auto-disable threshold), 3.3 (connector-side/fallback watchlist matching), 3.4 (cursor pagination on `GET /posts`), 4.3 (derived `ConnectorHealth`), 2.7 (RSS/News connector: GNews API, publication-as-Author — ADR-0026, drafted and accepted by Menno 2026-07-31, **built 2026-08-01**; see below).
**Also build, not storied:** `POST/GET/PATCH/DELETE /watchlists` CRUD; `POST /connectors/:platformId/connect` + `DELETE .../disconnect`; the admin UI's connect flow, watchlist management screen, and connector status view (the "minimal admin UI" scope named in the original design conversation).

**2026-07-31 update — the "first connector implementation itself" line above is now Story 2.7, not unstoried scope.** RSS/News was chosen as a *category* 2026-07-29 (poll-only, API-key auth, no paid tier) but never given a concrete provider — the gap ADR-0024's own Context flagged explicitly, and the single oldest unbuilt piece of this plan even after Story 2.6 (a later, Phase-4 connector) shipped ahead of it. ADR-0026 (drafted 2026-07-31 by the AI Business & Requirements Analyst persona) selects **GNews API** as the concrete provider, verified directly against `gnews.io`/`docs.gnews.io`, with a publication-as-Author modeling departure mirroring ADR-0024's issuer-as-Author exception. Accepted by Menno later the same day. See ADR-0026 and Story 2.7 for the full decision and its Amendment Log (including two candidates, NewsAPI.org and Currents API, whose free tiers were verified to explicitly forbid the real/production use this connector needs).

**2026-08-01 update — Story 2.7 built, closing Phase 1's own longest-standing gap.** `src/connectors/gnews/gnewsConnector.ts`/`pollGNewsSearch.ts` poll GNews's real Search endpoint using a per-tenant, envelope-encrypted API key (ADR-0014/ADR-0027 — never a SocialEngage-held credential), normalizing articles into `SocialPost` with `Author` resolving to the source publication. Contract proven against genuinely live GNews results and a real Azure Key Vault, same bar as Story 2.6.

**2026-08-01 update — Story 1.5 (watchlist CRUD) complete.** `POST/GET/PATCH/DELETE /v1/watchlists` REST surface implemented with full tenant isolation via RLS (`tenant_isolation` policy). Includes `src/watchlists/watchlistStore.ts` (CRUD operations), `src/http/versions/v1/watchlistsRouter.ts` (HTTP layer), `migrations/0014_create_watchlists.sql` (schema), and `contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts` (15 acceptance criteria). All contracts pass, including cross-tenant isolation (AC7), X-Tenant-Id header validation (AC8-11), and default value handling (AC14). This closes the watchlist CRUD gap in Phase 1's "also build, not storied" work.

**2026-08-01 update — Story 2.6 (Newswire connector) complete.** GlobeNewswire and PR Newswire RSS feeds now ingesting via `src/connectors/newswire/newswireConnector.ts` with `pollNewswireFeeds()`. All contracts pass, including AC1 (real items from both wires) and AC3 (fallback behavior for unsupported query features). Phase 1 now has **two working connectors** (GNews API + Newswire RSS).

**2026-08-01 update — Story 1.6 (Connector connect/disconnect) complete.** `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect` endpoints implemented in `src/http/versions/v1/connectorsRouter.ts`, with `deleteCredential()` added to `src/credentials/credentialStore.ts`. All 8 contracts pass, including tenant isolation via RLS (AC6). See `contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts` and `.claude/skills/credential-envelope-encryption/SKILL.md`.

Phase 1 now closes on its own original terms ("one platform, one tenant, one watchlist... end to end") for the storied half of that deliverable. The "also build, not storied" half has **watchlist CRUD complete** and **connector connect/disconnect endpoints complete (Story 1.6)** — only admin UI (connect flow, watchlist management screen, connector status view) remains open, see below.

**Deliverable:** a tenant can connect one real platform through the admin UI, create a watchlist, and see matching posts appear via `GET /posts` within one polling cycle — with `GET /connectors` correctly showing `healthy`, and correctly flipping to `degraded`/`failing` when the connection is deliberately broken in a test.

---

## Phase 2 — Enrichment and AI-provider swappability

**Goal:** posts get sentiment/entities/key phrases, and the AI provider is proven swappable the same way the social connector was in Phase 1 — not just implemented once and assumed generic.

**Stories:** 4.1 (`AuthorTopicSignal` raw signals), 4.2 (confirm `TopicDailyCount`-supporting fields are captured — this one is largely a verification, not new build).
**Also build, not storied:** the first `AIProviderConnector` implementation (Azure AI Language, per spec §2); `POST /ai-providers/:id/connect`, `GET /ai-providers/:id/models`, `POST /ai-providers/:id/select-model`; wiring enrichment into the ingestion pipeline after normalization.
**Recommended validation, mirroring Phase 1's two-connector proof:** stand up a second `AIProviderConnector` (even a trivial/mock one) specifically to confirm swapping AI providers really does need zero core pipeline changes, the same way Reddit validated the social side in Phase 1.

**Deliverable:** ingested posts carry `sentiment`, `keyPhrases`, `entities`, `detectedLanguage`, and `modelUsed`; `GET /topics/:topic/authors?sortBy=mentionCount` returns real, non-empty results for a topic with enough history.

---

## Phase 3 — Eventing and admin UI completion

**Goal:** the subsystem starts actually behaving like a platform other subsystems can build on, even though none exist yet — publish real events, and finish the admin UI beyond the Phase 1 minimum.

**Stories:** 5.1 (thin `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent`), 5.2 (per-tenant Service Bus subscription filtering), 5.5 (`schemaVersion` message property — decision already made in Phase 0, built here).
**Also build, not storied:** a throwaway or internal test subscriber, since there's no real downstream subsystem yet to validate against — without one, ADR-0012/0013's design is unverified in practice.

**Deliverable:** every ingested post publishes a correctly-filtered, correctly-versioned event within a defined latency of being written; a test subscriber scoped to one tenant provably never receives another tenant's events.

---

## Phase 4 — Multi-connector scale-out and hardening

**Goal:** everything that only matters once there's more than one connector, more than one instance, or real data volume — deliberately sequenced after Phase 1–3 prove the architecture on a small footprint, not before.

**Stories:** 3.6 (watchlist AST + capability matrix — becomes valuable once a 3rd+ connector makes native/fallback drift a real risk), 2.4 (bounded queues, DLQ, distributed `RequestGate` state), 2.5 (proportional failure threshold, replacing 2.3's flat rule — best tuned once real differently-paced connectors exist to tune it against), 4.4 (derived-data caching — needed once read volume justifies it), 3.5 (tiered retention/archival — needed once storage volume, not correctness, is the driver), 2.6 (Newswire connector — GlobeNewswire + PR Newswire direct RSS, ADR-0024, accepted 2026-07-30, outside the original 23-ADR scope).
**Also build, not storied:** third and fourth connectors (whichever platforms are prioritized next) — Story 2.6/ADR-0024 is the first of these to get its own ADR, because of the issuer-as-Author modeling decision it needed, not because connector selection itself became storied work generally.

**Solo-project note on Story 2.4 specifically:** its whole premise (ADR-0020) is correctness under more than one `social-listening-core` instance running concurrently. For a solo-operated deployment, that condition may not arise for a long time, if ever — there's no team driving a scaling need, and a single instance may simply be enough. Don't build the Redis-backed distributed gate speculatively; a single-instance in-process `RequestGate` already satisfies ADR-0003 correctly on its own. Treat the distributed-gate half as "build when you actually deploy a second concurrent instance," not "build in Phase 4 on schedule" — it may end up the last piece of this entire plan to actually get built, or never, and that's fine. **Update 2026-07-30:** the other half — bounded queue TTL/depth ceiling and per-request dead-lettering, "relevant even on a single instance" per ADR-0020's own framing — has shipped (see `docs/implementation-log.md`); only the distributed-gate half remains deferred by this note.

**Deliverable:** `social-listening-core` runs correctly as more than one instance under load; a genuinely-broken low-frequency connector and a flaky high-frequency one are both judged fairly by auto-disable; storage growth is bounded without losing analytically-relevant history.

---

## Phase 5 — Production readiness

**Goal:** the cross-cutting work that doesn't map to any single ADR — security review, load/chaos testing against the isolation guarantees this whole series argued for (RLS, per-tenant rate limits, per-tenant event filtering), operational runbooks for the failure modes ADR-0009/0010/0023 describe, and final go-live checks.
**Not storied, not phase-specific to any ADR** — this phase exists because "ADR-driven" and "production-ready" aren't the same bar, and nothing above claims otherwise.

**Deliverable:** a go-live decision, backed by evidence that the isolation and resilience properties this whole ADR series was built around actually hold under test, not just on paper.

---

## Traceability

| Phase | Ready stories | Blocked stories (ADR must be accepted to close the phase) |
|---|---|---|
| 0 | 1.1, 1.2, 1.3, 1.4, 5.3, 5.4 | — |
| 1 | 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.3, 2.7 | — |
| 2 | 4.1, 4.2 | — |
| 3 | 5.1, 5.2, 5.5 | — |
| 4 | 2.4 (may never trigger — see Phase 4's solo-project note), 2.5, 3.5, 3.6, 4.4, 2.6 | — |
| 5 | — | — |

Every story from the original 23-ADR series appears exactly once, plus Story 2.6 (ADR-0024), Story 1.4 (ADR-0025), and Story 2.7 (ADR-0026) — three genuine additions. The first two were both accepted 2026-07-30, the day each was drafted (see `docs/adr/README.md`'s footnotes 6/7); **Story 2.7/ADR-0026 (drafted 2026-07-31) briefly broke that pattern** — it was drafted by the AI Business & Requirements Analyst persona, which does not hold ADR-acceptance authority, and was left Proposed for Menno's own review rather than self-accepted the same day (see ADR-0026's Status line and footnote 8) — **Menno accepted it later the same day.** All 26 of 26 stories are Ready, and **Story 2.7 is now built (2026-08-01)** — Phase 1 closes on its own original terms ("one platform... end to end") for the storied half of that deliverable; the "also build, not storied" CRUD/admin-UI half remains open (see Phase 1's own "Also build, not storied" line above). Phase 4's six stories remain scheduled there on their own merits (multi-connector/multi-instance/volume triggers), not because any ADR is still pending. Unlike every other addition here, Story 1.4/ADR-0025 is dev tooling, not production architecture — see its own Acceptance note for why it's an ADR anyway.
