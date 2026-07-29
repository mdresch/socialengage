# Epic 2: Ingestion, Connectors & Rate Limits

## Story 2.1 — Unified provider connector framework

**Source:** ADR-0002 · **Status:** Ready

**As a** core backend engineer,
**I want** a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`,
**so that** adding a new social platform or swapping the AI enrichment provider means implementing and registering one interface, with no changes to the core ingestion pipeline.

**Acceptance Criteria**
- `ProviderConnector` exposes `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`.
- `SocialConnector` adds `deliveryMode: 'push' | 'poll'`, auth methods appropriate to `authMode`, and `normalize()`; a connector for a platform without push support (e.g. Reddit, YouTube, RSS) can declare `deliveryMode: 'poll'` with no core pipeline changes required.
- `AIProviderConnector` adds `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, and `analyze()`.
- Registering a new connector (social or AI) requires no edits to core ingestion orchestration code — verified by adding a second reference connector of each kind without touching the pipeline.

---

## Story 2.2 — Per-tenant, per-provider rate limiting

**Source:** ADR-0003 · **Status:** Ready

**As a** multi-tenant platform operator,
**I want** every outbound platform/AI request gated by a shared `RequestGate` scoped to `(tenantId, providerId)` — and `(tenantId, providerId, modelId)` for AI enrichment — with live rate-limit headers taking priority over static declared config,
**so that** one tenant's usage never throttles another tenant sharing the same platform.

**Acceptance Criteria**
- Two tenants issuing requests to the same platform concurrently are gated independently — one tenant hitting its limit does not delay or block the other's requests.
- When a connector implements `parseRateLimitHeaders()`, the gate's enforcement reflects the platform's live reported state, not just the static `RateLimitConfig`.
- A request that would exceed the limit is queued and retried after window reset, never dropped without a trace (bounded per Story 2.4, ADR-0020).
- AI enrichment requests are gated per model (`getModelRateLimit(modelId)`), not only per AI provider.

---

## Story 2.3 — Retryable/non-retryable error handling with per-tenant auto-disable

**Source:** ADR-0010 · **Status:** Ready
*(See Story 2.5 / ADR-0023, accepted 2026-07-29 — the flat threshold below is what's currently shipped; ADR-0023's rate-relative rule supersedes it once Story 2.5 is actually built, per ADR-0010's "Supersession update" note. This story's own code/contract are unaffected until then — see `docs/user-stories/README.md`'s "Known cross-story conflict" note.)*

**As a** tenant relying on continuous ingestion,
**I want** transient errors retried automatically with backoff, non-retryable errors surfaced immediately without blind retries, and a connector auto-disabled after sustained failures — all scoped to my tenant alone,
**so that** a broken credential or a bad watchlist doesn't silently waste quota forever, and another tenant's ingestion is never affected by mine.

**Acceptance Criteria**
- Rate-limit hits, transient network failures, and 5xx responses trigger exponential backoff and automatic retry.
- 401/403 responses and malformed-watchlist errors immediately mark the connector `failing` with no further blind retries.
- An OAuth connector attempts token refresh automatically before surfacing a credential failure to the tenant; only a failed refresh surfaces.
- A connector auto-disables after ≥10 failed `IngestionRun`s within the trailing hour (current placeholder threshold; see Story 2.5), with a clear reason recorded and visible to that tenant.
- A second tenant's connector for the same platform is provably unaffected by the first tenant's auto-disable (isolation test: disable tenant A's X connector, confirm tenant B's X ingestion continues).

---

## Story 2.4 — Bounded rate-limit queues, request-level dead-lettering, and distributed gate state

**Source:** ADR-0020 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`; numbers kept flat and queue-depth rejection folds into existing `ConnectorHealth` states, per ADR-0020's Acceptance note)
**Solo-project note:** this story bundles two independent concerns — queue TTL/depth/dead-lettering (relevant even on a single instance, once real traffic exists) and distributed gate state (only load-bearing once more than one `social-listening-core` instance runs concurrently, which may not happen for a long time on a solo-operated deployment — see `docs/implementation-plan.md` Phase 4). The first half can be picked up on its own merits; the second half specifically should wait for an actual multi-instance need, not be built speculatively.

**As a** platform operator running `social-listening-core` across more than one process instance,
**I want** queued rate-limited requests bounded by TTL and depth, individually-poisoned requests dead-lettered separately from connector-level auto-disable, and `RequestGate` state held in shared storage rather than local process memory,
**so that** a rate-limit backlog can't grow without bound, one bad request can't degrade the shared worker pool, and rate-limit enforcement stays correct regardless of which process instance handles a given tenant's request.

**Acceptance Criteria**
- A queued request older than its TTL (default 6 hours) is abandoned, not delivered, and the abandonment is recorded via the relevant `IngestionRun`'s `postsSkipped`/`errorSummary`.
- A queue for a given `(tenantId, providerId)` rejects new requests outright once it reaches its depth ceiling (default 1,000), rather than growing further.
- A single request that fails 3 consecutive execution attempts routes to a dead-letter path, independent of whether that tenant-platform pair has crossed the connector-level auto-disable threshold (Story 2.3/2.5).
- Running two `social-listening-core` process instances concurrently, both handling requests for the same `(tenantId, providerId)`, enforces the same rate limit correctly (verified by a test that would fail under a local-in-memory gate).

---

## Story 2.5 — Proportional, rate-relative connector failure threshold

**Source:** ADR-0023 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`; 50%/5-attempt floor/20-consecutive kept as launch defaults, per ADR-0023's Acceptance note)
*(Supersedes the flat threshold in Story 2.3 / ADR-0009-0010, per each ADR's "Supersession update" note — but only once this story is actually built; see `docs/user-stories/README.md`'s "Known cross-story conflict" note.)*

**As a** tenant with connectors polling at very different frequencies,
**I want** auto-disable triggered by failure *rate* relative to attempt volume, with a minimum attempt floor and an absolute ceiling as a backstop,
**so that** a fast-polling connector's transient blip and a slow-polling connector's persistent failure are judged fairly, instead of both being held to the same flat count.

**Acceptance Criteria**
- A connector with ≥50% of attempts failing in the trailing 1-hour window, and at least 5 attempts in that window, is marked `failing`.
- A connector with fewer than 5 attempts in the window does not trigger the rate-based rule regardless of failure percentage (the floor).
- A connector is marked `failing` after 20 consecutive failures regardless of window or rate, even if its polling frequency is too low to reach the 5-attempt floor within an hour.
- A test comparing a high-frequency connector (many attempts/hour) and a low-frequency one (few attempts/hour) under equivalent "mostly broken" conditions confirms both are correctly flagged without one being penalized unfairly relative to the other.
