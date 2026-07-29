# Implementation & Delivery Plan — Social Listening / Insights Subsystem

Sequences the 23 [user stories](user-stories/README.md) — grounded in the [23 ADRs](adr/README.md) — into build phases. This is a dependency-ordered plan, not a calendar: no durations or sprint lengths are estimated. This is a solo-developer personal project (confirmed 2026-07-29), so "no team-scale process" is a deliberate choice throughout this plan (see Phase 0's testing/CI recommendation and Phase 4's note on multi-instance work), not just an absence of data to estimate against.

## How to read this

- **Ready** stories (18 of 23, as of 2026-07-29) are sourced from Accepted ADRs and can be built as written.
- **Blocked** stories (5 of 23) are sourced from Proposed ADRs. A phase that includes a Blocked story needs that ADR accepted before the phase can close — not before the phase can *start*, since most Blocked work sits later in the sequence anyway.
- **This plan is not the whole scope.** The 23 stories cover architecturally significant decisions — that's what the ADR series was for. Ordinary CRUD surface (watchlist create/read/update/delete, connector connect/disconnect endpoints, the admin UI's screens) was never architecturally interesting enough to warrant its own ADR, but it's real, necessary work that has to happen alongside the storied work. It's called out per phase below so it isn't invisible.
- **Not covered at all:** Brand Reputation & Alerts, Social Care, Social Selling — explicitly deferred to be designed separately once this subsystem ships (spec §1, §9). Nothing in this plan builds toward them beyond leaving the REST API and Service Bus events they'll eventually consume.
- **How each story actually gets built** (scope discipline, contract-first testing, component `SKILL.md`s, permanent regression suite) is a separate concern from *when* — see [`docs/implementation-methodology.md`](implementation-methodology.md), operationalized as the `implement-story` Claude Code skill. This plan says what and when; that document and skill say how, uniformly, for every story in every phase below.

## Decisions resolved 2026-07-29

Three things needed an answer that nothing in the ADR series or spec resolved on its own — two were spec's own long-standing open questions (§10), one was a judgment call surfaced by phasing the work. All three are now decided (see spec §10 for the authoritative record):

1. **Which platform ships first:** RSS/News first (poll-only, API-key auth, no paid tier — cheapest way to validate the full pipeline without also debugging OAuth and rate-limit-tier economics in the same pass), then Reddit second (poll, OAuth, real rate limits, real boolean-query needs) specifically to prove the `ProviderConnector` abstraction (ADR-0002) generalizes rather than having been shaped around only the first connector.
2. **Testing strategy and CI/CD:** deliberately lightweight, matching a solo-developer project rather than team-scale process — GitHub Actions on push/PR running lint, type-check, and unit tests for both repos, plus one integration-test tier against an ephemeral/dockerized Postgres (RLS and JSONB behavior need real Postgres, not a mock). No CODEOWNERS, no OpenAPI-first contract-testing pipeline yet — consistent with those already being deferred in `docs/adr/README.md`'s "explicitly not drafted" list, for the same underlying reason: that's process built for contributors and consumers that don't exist yet.
3. **ADR-0017 (API versioning) and ADR-0019 (event schema versioning) are now Accepted**, ahead of the phases that would otherwise touch them — both were cheap to decide now and expensive to retrofit after real endpoints/consumers exist. The other five still-Proposed ADRs (0018, 0020, 0021, 0022, 0023) don't have that asymmetry and stay Proposed until the phase that actually needs them, per the schedule below.

---

## Phase 0 — Foundations (decisions + scaffolding, no ingestion yet)

**Goal:** two deployable-but-empty repos, a tenant-isolated database, and credential storage — nothing that ingests a post yet, but everything a connector will need to plug into.

**Stories:** 1.1 (repo split), 1.2 (Postgres + JSONB), 5.4 (RLS on every tenant table), 5.3 (Key Vault envelope-encrypted credential storage), 1.3 (API versioning — decided ahead of schedule, see above).
**Also build, not storied:** `/v1/` route scaffold (empty, per the now-accepted ADR-0017); lightweight GitHub Actions CI per the decision above; local dev environment (Postgres + Key Vault emulator or dev tenant).

**Deliverable:** `social-listening-core` and `social-listening-admin` both deploy successfully to a dev environment; a smoke-test tenant can be created with RLS-isolated tables and a stored, encrypted dummy credential — with no connector, watchlist, or post yet.

---

## Phase 1 — MVP: one connector, end to end

**Goal:** the smallest real slice — one platform, one tenant, one watchlist, posts flowing from that platform into a queryable API, with visible health status. This is the phase that proves the architecture, not just the first platform.

**Stories:** 2.1 (connector framework), 3.1 (Author), 3.2 (IngestionRun), 2.2 (per-tenant rate limiting), 2.3 (error handling + flat auto-disable threshold), 3.3 (connector-side/fallback watchlist matching), 3.4 (cursor pagination on `GET /posts`), 4.3 (derived `ConnectorHealth`).
**Also build, not storied:** the first connector implementation itself (platform chosen in Phase 0); `POST/GET/PATCH/DELETE /watchlists` CRUD; `POST /connectors/:platformId/connect` + `DELETE .../disconnect`; the admin UI's connect flow, watchlist management screen, and connector status view (the "minimal admin UI" scope named in the original design conversation).

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

**Stories:** 3.6 (watchlist AST + capability matrix — becomes valuable once a 3rd+ connector makes native/fallback drift a real risk), 2.4 (bounded queues, DLQ, distributed `RequestGate` state), 2.5 (proportional failure threshold, replacing 2.3's flat rule — best tuned once real differently-paced connectors exist to tune it against), 4.4 (derived-data caching — needed once read volume justifies it), 3.5 (tiered retention/archival — needed once storage volume, not correctness, is the driver).
**Also build, not storied:** third and fourth connectors (whichever platforms are prioritized next).

**Solo-project note on Story 2.4 specifically:** its whole premise (ADR-0020) is correctness under more than one `social-listening-core` instance running concurrently. For a solo-operated deployment, that condition may not arise for a long time, if ever — there's no team driving a scaling need, and a single instance may simply be enough. Don't build the Redis-backed distributed gate speculatively; a single-instance in-process `RequestGate` already satisfies ADR-0003 correctly on its own. Treat 2.4 as "build when you actually deploy a second concurrent instance," not "build in Phase 4 on schedule" — it may end up the last story in this entire plan to actually get built, or never, and that's fine.

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
| 0 | 1.1, 1.2, 1.3, 5.3, 5.4 | — |
| 1 | 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.3 | — |
| 2 | 4.1, 4.2 | — |
| 3 | 5.1, 5.2, 5.5 | — |
| 4 | — | 2.4 (may never trigger — see Phase 4's solo-project note), 2.5, 3.5, 3.6, 4.4 |
| 5 | — | — |

Every story appears exactly once. As of 2026-07-29, 18 of 23 are Ready (1.3 and 5.5 moved up after ADR-0017/0019 were accepted ahead of schedule); the remaining 5 stay Blocked in Phase 4, where they naturally belong.
