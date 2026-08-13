# Epic 4: Derived Data, Analytics & Health

## Story 4.1 — Raw author-topic signals for expert-finding

**Source:** ADR-0007 · **Status:** Ready

**As an** API consumer (e.g., a future Social Selling subsystem),
**I want** `GET /topics/:topic/authors` backed by a periodically refreshed `AuthorTopicSignal` view exposing raw signals — `mentionCount`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown` — with no baked-in composite score,
**so that** I can apply my own ranking logic (e.g. weighting sustained engagement over burst activity) instead of being locked into one opinionated formula.

**Acceptance Criteria**
- `AuthorTopicSignal` contains no `expertiseScore` or equivalent computed field — only raw counts/dates/breakdowns.
- `GET /topics/:topic/authors` accepts `sortBy=activeMonths|mentionCount` and sorts accordingly.
- The view is refreshed on a schedule (see Story 4.4, ADR-0022), not recomputed live on every request.

---

## Story 4.2 — Deferred topic time-series aggregation

**Source:** ADR-0008 · **Status:** Ready

**As a** subsystem architect scoping this subsystem's boundaries,
**I want** `SocialPost` to consistently capture `enrichment.entities`, `enrichment.keyPhrases`, and `publishedAt` without this subsystem building a `TopicDailyCount` table or any charting UI,
**so that** a future insights/dashboard subsystem can build topic-volume-over-time aggregation directly from this data, without this subsystem taking on visualization scope it wasn't meant to own.

**Acceptance Criteria**
- Every enriched `SocialPost` has `enrichment.entities`, `enrichment.keyPhrases`, and `publishedAt` populated and queryable.
- No `TopicDailyCount` table, materialized view, or charting endpoint exists in `social-listening-core`.
- A query against raw `SocialPost` rows (grouping by day and topic) can reconstruct what `TopicDailyCount` would contain, confirming no data is missing for a future subsystem to build on.

**Documentation Steward correction, 2026-08-13.** This story's own AC1/AC3 text above (drafted before Story 2.8 existed) still describes `enrichment.entities` as if its element shape were never in question — it wasn't specified either way at draft time, but Story 2.8 (ADR-0038, built 2026-08-10, `social-listening-core@f70b07d`) settled it against real, live Azure AI Language API output: `entities` is `{text, category, confidenceScore}[]`, not bare `string[]`, a real, dated, Menno-approved widening of `AnalyzeResult`/`SocialPost.enrichment` (`src/connectors/types.ts`). This story's own contract (`contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts`) already carries the full dated correction in its own header comment and updated AC3 query (`jsonb_array_elements` + `->>'text'`, not `jsonb_array_elements_text`) — this note only closes the gap that this human-readable epic file itself never got a matching pointer, despite `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`'s own Story 2.8 dated note saying the correction lived "in both files." AC1/AC3's own original wording is left as drafted, per this doc series' "don't rewrite history" convention — this note is the correction of record for this file.

---

## Story 4.3 — Derived connector health from IngestionRun history

**Source:** ADR-0009 · **Status:** Ready
*(Story 2.5 / ADR-0023, accepted 2026-07-29 and implemented 2026-07-30, supersedes the flat threshold named in AC2 below — per ADR-0009's "Supersession update" note. This story's own contract needed no assertion changes; see `docs/user-stories/README.md`'s "Known cross-story conflict" note.)*

**As a** tenant administrator,
**I want** `GET /connectors` to report health computed live from `IngestionRun` history — never a separately stored, independently updatable health record —
**so that** the status I see can never drift from what actually happened during ingestion.

**Acceptance Criteria**
- `ConnectorHealth` has no backing table of its own (aside from the read-cache in Story 4.4, which is explicitly reconstructable, not authoritative).
- `failing` is derived from a connector-level failure threshold (originally the flat ≥10/hour placeholder; superseded 2026-07-30 by Story 2.5's rate-relative rule — ≥50% of ≥5 attempts in the trailing hour, or ≥20 consecutive failures); `degraded` as recent failures with a success within the last hour; `disconnected` as zero recorded runs; `healthy` otherwise.
- `credentialStatus` is read from the `Credential` entity directly, not derived from run history.
- A test that manually inserts a known sequence of `IngestionRun`s and asserts the resulting derived status for all four states passes without any separate health-table writes.

---

## Story 4.4 — Derived-data caching and refresh strategy

**Source:** ADR-0022 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`; 60s TTL, hourly refresh, and in-process cache locality all kept as originally proposed, per ADR-0022's Acceptance note)

**As a** platform operator supporting frequent `GET /connectors` polling from the admin UI,
**I want** `ConnectorHealth` served from a short-TTL read-through cache that's always reconstructable from `IngestionRun`, and `AuthorTopicSignal` refreshed hourly via a scheduled job,
**so that** reads stay fast without ever introducing a second, independently-updatable copy of either value.

**Acceptance Criteria**
- `GET /connectors` reads are served from a cache with a 60-second TTL (implementation default); on expiry, the cache recomputes from `IngestionRun`, not from any other stored state.
- The cache is in-process (per `social-listening-core` instance), not backed by Redis or any shared store — confirmed by verifying `GET /connectors` continues to serve correct (if slower) results with Redis unavailable, since it has no dependency on it. This is a deliberate difference from Story 2.4's `RequestGate` state, which does require shared storage for correctness; this cache doesn't, because every instance can independently recompute the same correct value.
- Flushing the `ConnectorHealth` cache at any time and immediately re-reading produces the same result as before the flush (proving it's a pure derivation cache, not a second source of truth).
- A test hitting two different `social-listening-core` instances in quick succession may observe brief cross-instance staleness (different cache-refresh timing) — documented as acceptable, not treated as a bug.
- `AuthorTopicSignal` refreshes on an hourly schedule via `pg_cron` (implementation default), confirmed by checking the view's last-refreshed timestamp advances hourly under load.
