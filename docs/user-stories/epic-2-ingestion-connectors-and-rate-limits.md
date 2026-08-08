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
*(Story 2.5 / ADR-0023, accepted 2026-07-29 and implemented 2026-07-30, supersedes the flat threshold this story originally shipped with — per ADR-0010's "Supersession update" note. AC4 below reflects the current, rate-relative behavior; see `docs/user-stories/README.md`'s "Known cross-story conflict" note for what did and didn't change in this story's own contract.)*

**As a** tenant relying on continuous ingestion,
**I want** transient errors retried automatically with backoff, non-retryable errors surfaced immediately without blind retries, and a connector auto-disabled after sustained failures — all scoped to my tenant alone,
**so that** a broken credential or a bad watchlist doesn't silently waste quota forever, and another tenant's ingestion is never affected by mine.

**Acceptance Criteria**
- Rate-limit hits, transient network failures, and 5xx responses trigger exponential backoff and automatic retry.
- 401/403 responses and malformed-watchlist errors immediately mark the connector `failing` with no further blind retries.
- An OAuth connector attempts token refresh automatically before surfacing a credential failure to the tenant; only a failed refresh surfaces.
- A connector auto-disables once the connector-level failure threshold is crossed (originally the flat ≥10/hour placeholder; superseded 2026-07-30 by Story 2.5's rate-relative rule — see that story below), with a clear reason recorded and visible to that tenant.
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

**Source:** ADR-0023 · **Status:** Ready — implemented 2026-07-30 (50%/5-attempt floor/20-consecutive kept as launch defaults, per ADR-0023's Acceptance note)
*(Supersedes the flat threshold in Story 2.3 / ADR-0009-0010, per each ADR's "Supersession update" note — now in effect; see `docs/user-stories/README.md`'s "Known cross-story conflict" note for what changed in those stories' own contracts.)*

**As a** tenant with connectors polling at very different frequencies,
**I want** auto-disable triggered by failure *rate* relative to attempt volume, with a minimum attempt floor and an absolute ceiling as a backstop,
**so that** a fast-polling connector's transient blip and a slow-polling connector's persistent failure are judged fairly, instead of both being held to the same flat count.

**Acceptance Criteria**
- A connector with ≥50% of attempts failing in the trailing 1-hour window, and at least 5 attempts in that window, is marked `failing`.
- A connector with fewer than 5 attempts in the window does not trigger the rate-based rule regardless of failure percentage (the floor).
- A connector is marked `failing` after 20 consecutive failures regardless of window or rate, even if its polling frequency is too low to reach the 5-attempt floor within an hour.
- A test comparing a high-frequency connector (many attempts/hour) and a low-frequency one (few attempts/hour) under equivalent "mostly broken" conditions confirms both are correctly flagged without one being penalized unfairly relative to the other.

---

## Story 2.6 — Newswire connector: direct wire-service RSS, issuer-as-Author

**Source:** ADR-0024 · **Status:** Ready — accepted 2026-07-30 (GlobeNewswire + PR Newswire v1 scope, AccessWire/Business Wire deferred, per ADR-0024's Acceptance note)

**As a** tenant tracking companies via press releases,
**I want** a real `SocialConnector` that polls GlobeNewswire's and PR Newswire's free public RSS feeds and normalizes each item into a `SocialPost` whose `Author` is the issuing organization,
**so that** watchlist matching works against real press-release data the same way it already works against any other platform, without paying for or depending on an aggregator.

**Acceptance Criteria**
- A registered `SocialConnector` (`authMode: 'none'`, `deliveryMode: 'poll'`, a distinct `providerId`) polls at least one real GlobeNewswire feed and at least one real PR Newswire feed and normalizes new items into `SocialPost` rows via the existing ingestion pipeline (`ADR-0002`'s framework, `runIngestionAttempt()`) — this is the first story in this project to prove that pipeline against a genuinely live, real-world feed rather than a synthetic fixture.
- Each normalized post's `Author` resolves to the issuing organization, not an individual account: `externalAuthorId` set from the feed's issuer identifier, `followerCount` left unpopulated — proven by asserting the resolved `Author` row's shape after a real poll.
- `supportedQueryFeatures` (ADR-0021) is declared accurately for both feeds (expected minimal/empty at v1) and watchlist matching correctly falls back to whole-query post-fetch matching, not a silent no-op.
- Polling never requires an API key or account for either source, and a poll cycle against a feed with zero new items since the last check is a correct no-op (no duplicate `SocialPost` rows), proven across two consecutive poll cycles.
- Cross-wire duplicate handling (the same release appearing on both GlobeNewswire and PR Newswire) behaves per whatever this story's own implementation decides (ADR-0024 leaves the exact strategy open) — the test proves the decision was made deliberately, not left unhandled by accident.

---

## Story 2.7 — RSS/News connector: GNews API, publication-as-Author

**Source:** ADR-0026 · **Status:** Ready (drafted 2026-07-31 by the AI Business & Requirements Analyst persona, left Proposed rather than self-accepted the same day since that persona doesn't hold ADR-acceptance authority — see ADR-0026's own Status line; accepted by Menno later the same day, 2026-07-31)

**As a** tenant tracking general news coverage of a topic, company, or organization,
**I want** a real `SocialConnector` that polls GNews API's Search endpoint using a per-tenant API key and normalizes each returned article into a `SocialPost` whose `Author` is the source publication,
**so that** watchlist matching works against real general-news data the same way it already works against every other platform — closing Phase 1's own longest-standing gap, the "actual RSS/News connector implementation" that stayed unbuilt even after Story 2.6/ADR-0024 (a later, Phase-4 connector) shipped ahead of it.

**Acceptance Criteria**
- A registered `SocialConnector` (`authMode: 'apiKey'`, `deliveryMode: 'poll'`, a `providerId` distinct from Newswire's) authenticates using a per-tenant-supplied GNews API key — stored via ADR-0014's existing envelope-encrypted credential model, no new credential-storage pattern — and polls GNews's `/api/v4/search` endpoint, normalizing returned articles into `SocialPost` rows via the existing ingestion pipeline (`runIngestionAttempt()`).
- Each normalized post's `Author` resolves to the article's source publication, not an individual journalist: `externalAuthorId` set from the article's `source.id` (or `source.name` when `id` is absent), `followerCount` left unpopulated — proven by asserting the resolved `Author` row's shape after a real poll, the same proof pattern as Story 2.6 AC2.
- `supportedQueryFeatures` (ADR-0021) is declared accurately to reflect GNews's real native support for `AND`/`OR`/`NOT` and phrase search within its `q` parameter — a materially richer native capability than Newswire's minimal/empty declaration — with watchlist matching translating what it can of the boolean AST natively and falling back to whole-query post-fetch matching for whatever it can't express.
- Polling stays within the connected tenant's own free-tier ceiling (100 requests/day, up to 10 articles/request) without exceeding it, and a poll cycle against zero new articles since the last checkpoint is a correct no-op (no duplicate `SocialPost` rows), proven across two consecutive poll cycles.
- The connector's use is scoped to GNews's free-tier "non-commercial projects" permission (ADR-0026) — a real, accepted constraint given this project's own documented non-commercial status (`Business-Case-v6.0.md` §4/§9), named and recorded rather than silently assumed permanent.

---

## Story 2.8 — Concrete AI enrichment provider connector: Azure AI Language

**Source:** ADR-0038 (Accepted 2026-08-06) · **Status:** Ready. Sourced from a new ADR because the concrete provider choice, once Menno's own follow-up widened the comparison to include general-purpose-LLM structured extraction, is a genuine, hard-to-reverse, primary-source-researched selection — the same bar ADR-0024/0026 already established for connector-provider selection, not ordinary CRUD/UI surface.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes the single largest functional gap in the product: `AIProviderConnector` (Story 2.1/ADR-0002) defines `analyze()`/`listModels()`/`getModelRateLimit()`/`getModelCapabilities()`, but no story in Epics 1–6 implements it against a real provider — Stories 4.1, 4.2, and 5.1 all assume `enrichment.entities`/`keyPhrases`/`sentiment` are already populated, confirmed directly against the current codebase (no `src/connectors/*` directory targets an AI provider today, only GNews and Newswire).

**As a** tenant relying on this platform's own enrichment promise (spec §2's "enriching posts with sentiment, entities, and key phrases"),
**I want** ingested posts actually enriched by a real, registered `AIProviderConnector` using my own tenant-owned Azure AI Language credential,
**so that** `enrichment.sentiment`/`sentimentScores`/`keyPhrases`/`entities` are real, queryable data — not a shape every downstream story (4.1, 4.2, 5.1) assumes exists but nothing has ever populated.

**Acceptance Criteria**
- A registered `AIProviderConnector` (`providerId` distinct from any `SocialConnector`'s) authenticates against Azure AI Language using a per-tenant-supplied credential — stored per ADR-0014's existing envelope-encrypted credential model, `owner_type = 'tenant'` (ADR-0028 tier 2, Tenant-Admin-created), no new credential-storage pattern.
- **The tenant directly activates and holds their own Azure AI Language account/subscription/credential. SocialEngage stores and uses that credential only as a technical pass-through (ADR-0014's existing envelope encryption) — no SocialEngage-operated shared subscription exists, no SocialEngage-to-Microsoft billing relationship exists, and SocialEngage never accepts payment from the tenant or pays Microsoft on the tenant's behalf** (ADR-0027, ADR-0028's Amendment Log, ADR-0038 §3) — verified by a test confirming the connector rejects operating with no tenant-supplied credential present (no fallback to any project-level/shared key).
- `analyze()` calls Azure AI Language's sentiment analysis, key phrase extraction, named entity recognition, and language detection capabilities for a given post's text, and maps the result into `SocialPost.enrichment`'s exact existing shape (`sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'`, `sentimentScores: { positive, neutral, negative }`, `keyPhrases: string[]`, `entities: { text, category, confidenceScore }[]`, `detectedLanguage`, `modelUsed`) — no reshaping of the already-shipped type.
- Enrichment is wired into the ingestion pipeline after normalization (per the design spec's own pipeline diagram and `docs/implementation-plan.md` Phase 2's own framing), populating `enrichment.*` on the same `SocialPost` row the ingestion pipeline already writes — not a separate, out-of-band update.
- Per-model rate limiting (Story 2.2's existing `getModelRateLimit(modelId)` gating) applies to every Azure AI Language capability this connector calls, proven by a test confirming two tenants' enrichment calls are gated independently, the same isolation guarantee every other connector already has.
- A tenant with no Azure AI Language credential connected sees ingestion continue normally with `enrichment` left unpopulated (`undefined`/absent), not a failed or blocked ingestion — enrichment is additive to the pipeline, never a hard dependency of post ingestion succeeding.
- A failed or rate-limited Azure AI Language call is handled per this project's existing retryable/non-retryable error policy (ADR-0010/ADR-0023, Story 2.3/2.5) — proven by a test that a transient enrichment failure retries with backoff and does not mark the post's ingestion itself as failed.
- Azure AI Language's free-tier eligibility for this project's actual per-tenant usage pattern is confirmed clean at drafting time (ADR-0038's own Research section) — this story's contract does not need to re-verify Azure's own terms, only that the connector code respects the credential the tenant actually holds (whichever tier they've activated).

**Named as a required follow-up, not this story's own scope (per ADR-0038 §2/Open Questions):** a second `AIProviderConnector` implementation (an Azure-hosted LLM, per ADR-0038's own recommendation) to prove AI-provider swappability the same way Reddit is planned to validate the social-connector side — not designed or built by this story.

---

## Story 2.9 — Second AIProviderConnector: Azure-hosted LLM swappability validation

**Source:** Story 2.1 connector-abstraction contract, Story 2.8 follow-up note, and ADR-0038 §2/Open Questions · **Status:** Ready

**As a** platform maintainer,
**I want** a second, distinct `AIProviderConnector` implementation targeting an Azure-hosted LLM for enrichment tasks,
**so that** `AIProviderConnector` swappability is proven by real execution rather than assumed from interface shape alone.

**Acceptance Criteria**
- A second `AIProviderConnector` implementation is added and registered alongside the existing Azure AI Language connector, implementing the full required interface (`providerId`, `authMode`, `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, `analyze()`).
- Adding this connector requires no changes to core ingestion orchestration/pipeline code; registration/configuration is sufficient.
- Enrichment through both providers demonstrates isolated provider-specific behavior for rate limiting, credential usage, and retryable/non-retryable error handling under each connector's own configuration.
- Provider swap and provider removal are both validated by contract/integration tests: enrichment succeeds when either provider is selected, and fails over or skips according to configured behavior without breaking base ingestion.
- Removing one provider does not degrade tenants using the other provider, proven by tenant-scoped test coverage.

