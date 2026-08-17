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

**Source:** ADR-0038 (Accepted 2026-08-06) · **Status:** Built 2026-08-10 (`social-listening-core`, real Azure AI Language endpoint — see `docs/implementation-log.md`). Sourced from a new ADR because the concrete provider choice, once Menno's own follow-up widened the comparison to include general-purpose-LLM structured extraction, is a genuine, hard-to-reverse, primary-source-researched selection — the same bar ADR-0024/0026 already established for connector-provider selection, not ordinary CRUD/UI surface.

**2026-08-10 — a real, confirmed AC drift, corrected here rather than silently patched.** AC3 below claims `analyze()` maps into `SocialPost.enrichment`'s "exact existing shape... no reshaping of the already-shipped type." That claim was checked directly against the real, shipped code at implementation time and found false: the only shipped, contract-tested shape before this story was `entities: string[]` (Story 4.2's own fixture), and `AIProviderConnector.analyze()`'s return type (Story 2.1) had no `sentimentScores`, no per-entity `category`/`confidenceScore`, and no `modelUsed` at all. Real calls against the live Azure AI Language endpoint (`AZURE_AI_LANGUAGE_ENDPOINT`/`KEY` in `.env`) confirmed entities are naturally `{text, category, confidenceScore}[]`, not bare strings — this story widened `AnalyzeResult`/`enrichment.entities` to that real shape (additive change to `src/connectors/types.ts`), with Menno's explicit sign-off after reviewing the real API research. Story 4.2's own already-passing contract required a corresponding, dated, explicitly-authorized edit (its AC3 SQL moved from `jsonb_array_elements_text` to `jsonb_array_elements` + `->>'text'`) — see that story's own file and `.claude/skills/provider-connector-framework/SKILL.md`'s Load-bearing constraints for the full account. AC3's bullet text below is left as originally drafted, per this doc series' "don't rewrite history" convention — this note is the correction of record.

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

**Source:** Story 2.1 connector-abstraction contract, Story 2.8 follow-up note, and ADR-0038 §2/Open Questions · **Status:** Built 2026-08-10 (`social-listening-core`, real Azure OpenAI Service resource, `gpt-5-mini` — see ADR-0038's own Amendment Log for the Claude-in-Foundry-vs-Azure-OpenAI research and the `gpt-4o-mini`→`gpt-5-mini` deployment correction, and `docs/implementation-log.md` for the full build account).

**As a** platform maintainer,
**I want** a second, distinct `AIProviderConnector` implementation targeting an Azure-hosted LLM for enrichment tasks,
**so that** `AIProviderConnector` swappability is proven by real execution rather than assumed from interface shape alone.

**Acceptance Criteria**
- A second `AIProviderConnector` implementation is added and registered alongside the existing Azure AI Language connector, implementing the full required interface (`providerId`, `authMode`, `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, `analyze()`).
- Adding this connector requires no changes to core ingestion orchestration/pipeline code; registration/configuration is sufficient.
- Enrichment through both providers demonstrates isolated provider-specific behavior for rate limiting, credential usage, and retryable/non-retryable error handling under each connector's own configuration.
- Provider swap and provider removal are both validated by contract/integration tests: enrichment succeeds when either provider is selected, and fails over or skips according to configured behavior without breaking base ingestion.
- Removing one provider does not degrade tenants using the other provider, proven by tenant-scoped test coverage.

---

## Story 2.10 — Connector Registration Transparency

**Source:** ADR-0048 (Accepted 2026-08-11) · **Status:** Ready — built 2026-08-12.

**As a developer integrating new connectors into SocialEngage,**
**I want robust automated checks ensuring that connector registration does not alter core pipeline paths,**
**So that the modular architecture of ingestion and orchestration remains intact while accelerating PR approval and compliance verification.**

**Acceptance Criteria:**

- Every connector registration is backed by tests proving untouched core ingestion paths.
- A CI guardrail runs focused diff checks or contract tests for each PR involving new connectors.
- Documentation for each connector transparently cites registration location, used extension points, and verification details.
- Applies uniformly to social and AI connectors.

**Notes:**

- This story's implementation must reference ADR-0048's Consequences and Decision sections explicitly in its Jest contract test.

**Built 2026-08-12.** `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` (12/12) mechanically greps a designated `CORE_FILES` set (`runIngestionAttempt.ts`, `ingestionRunStore.ts`, `errorClassification.ts`, `registry.ts`, `requestGate.ts`, `rateLimitResolution.ts`, `connectorHealth.ts`, `connectorHealthCache.ts`, `types.ts`, `connectorsRouter.ts`) for any of the four real connectors' own `providerId` string literals — none found, proving ADR-0048 §1's invariant already held for real, shipped connectors, now durably enforced rather than only narratively asserted. The check itself IS the CI guardrail (§2) — an ordinary Jest contract test under the `npm test` step every PR already runs, not a separate script, per ADR-0048's own left-open "dedicated CI script vs. contract-test gate" question, resolved in favor of this project's established "the accumulated contract suite is the check" convention. Each real connector's own SKILL.md (`gnews-connector`, `newswire-connector`, `azure-ai-language-connector`, `azure-openai-connector`) gained a "Registration transparency (ADR-0048)" section citing its registration location, extension points used, and verification method (§3); `provider-connector-framework/SKILL.md` gained a matching cross-reference and Load-bearing constraint. The check runs identically across both `SocialConnector` (GNews, Newswire) and `AIProviderConnector` (Azure AI Language, Azure OpenAI) instances (§4). No production code changed — this story verifies an already-true invariant and makes it durably, mechanically checked. Full `social-listening-core` suite after: 51/51 suites, 355/355 tests passing.

---

## Story 2.11 — Tenant-owned-domain RSS/content-feed connector with DNS TXT verification

**Source:** ADR-0050 (Accepted 2026-08-11) · **Status:** Ready — built 2026-08-12

**Drafted 2026-08-11, at ADR-0050's acceptance**, per the ADR-0024/0026 "no story until acceptance" precedent this ADR's own Status line named ahead of time. Follows Story 2.6 (Newswire/ADR-0024) and Story 2.7 (GNews/ADR-0026) as the established shape for a connector-selection story sourced from a connector-selection ADR.

**As a** tenant wanting to monitor my own company's blog or newsroom feed,
**I want** a connector that polls my own domain's RSS/Atom feed only after I've proven — via a DNS TXT record challenge — that I actually control that domain,
**so that** I can track my own owned publication the same way I already track third-party sources, without SocialEngage or any tenant being able to configure monitoring of a domain they don't control.

**Acceptance Criteria**
- A registered `SocialConnector` (`providerId` `tenant-owned-feed` or equivalent distinct identifier, `authMode: 'none'`, `deliveryMode: 'poll'`, per ADR-0050 Decision §1/§2) is registered without any change to core ingestion orchestration — proven by the same no-core-path-edit evidence ADR-0048/Story 2.10 requires of every connector registration, not a separately-argued weaker claim.
- `POST /connectors/tenant-owned-feed/connect` accepts `{ domain, feedUrl }`, generates a unique verification token, and returns TXT record instructions (`txtRecordHost`, `txtRecordValue`, `expiresAt`) per ADR-0050 Decision §3's own sequence — proven by a test asserting the response shape.
- Polling of the configured `feedUrl` never begins while the domain's verification state is pending — proven by a test confirming a connector activation left in `pending` never triggers a fetch of the configured feed.
- `POST /connectors/tenant-owned-feed/verify-domain` looks up the TXT record at the designated host and marks the domain verified only when the token matches; a missing or mismatched record returns a pending/retry response, not a hard failure — proven by tests for both outcomes (match; no match/missing).
- Once verified, polling begins and each new feed item is normalized into a `SocialPost` via the existing ingestion pipeline (`runIngestionAttempt()`) — proven by a poll cycle against a real or fixture RSS/Atom feed producing `SocialPost` rows.
- Each normalized post's `Author` resolves to the tenant's own verified domain/publication, not an individual: `externalAuthorId` set to the verified domain, `followerCount` left unpopulated — proven by asserting the resolved `Author` row's shape, the same proof pattern as Story 2.6 AC2/Story 2.7 AC2, and citing ADR-0004's own new "organization-as-Author clause" (added at ADR-0050's acceptance) as the governing rule rather than arguing the exception from scratch.
- No historical backfill: items published before the connector begins polling are not retroactively ingested — proven by a test confirming only items observed after polling starts produce `SocialPost` rows, the same limitation as Newswire (Story 2.6).
- v1 requires an explicit, tenant-supplied feed URL; no autodiscovery of a feed URL from a homepage — proven by a test confirming the connect endpoint requires `feedUrl` and performs no HTML-fetch/autodiscovery step, per ADR-0050's own v1 scope decision.
- A verified domain need not match `tenants.domain` (ADR-0031) — proven by a test connecting and verifying a domain different from the tenant's own sign-up email domain, per ADR-0050 Decision §5.
- `supportedQueryFeatures` (ADR-0021) is declared accurately (expected empty/none at v1) and watchlist matching correctly falls back to whole-query post-fetch matching, the same fallback pattern as Newswire (Story 2.6 AC3).
- Every outbound feed fetch sets a compliant, self-identifying `User-Agent` header, per the same respectful-polling discipline ADR-0024's own research established.
- A poll cycle against a verified feed with zero new items since the last check is a correct no-op (no duplicate `SocialPost` rows), proven across two consecutive poll cycles, the same proof pattern as Story 2.6 AC4/Story 2.7 AC4.

**Notes:**
- Exact TXT record host-level scoping (subdomain- vs. apex-level, ADR-0050 Open Question 1), token TTL, re-check cadence, and poll interval are implementation defaults per ADR-0050's own Amendment Log — this story's contract targets whatever the current implementation defaults are at build time (7-day token TTL; 1-minute-then-15-minute re-check backoff; 30-minute poll interval, respecting a feed's own `<ttl>` hint if larger), not fixed independently by this story.
- Multiple-domain/multiple-feed support per tenant (ADR-0050 Open Question 2) and third-party CMS hosting-platform terms considerations (ADR-0050 Open Question 3) are named but not resolved by this story — single domain, single feed is the v1 scope this story's contract proves.

---

## Story 2.12 — `deriveConnectorHealth()` excludes retryable failures from the `failing` derivation

**Source:** ADR-0010 §Clarification (2026-08-12), ADR-0023 §Clarification (2026-08-12) · **Status:** Built 2026-08-12 — no new ADR needed. This corrects an implementation gap against ADR-0010's own already-Accepted Decision text ("retryable errors → automatic retry; non-retryable → immediate `failing` status"), per that ADR's own dated Clarification and ADR-0023's matching one — not a new decision, the same "implementation catches up to an already-stated policy" category ADR-0009/0010's own prior "Supersession update" notes already used for Story 2.5.

**Drafted 2026-08-12, from a real, confirmed gap found while drafting ADR-0051 (connector activation) and directly connected by Menno to a historical Microsoft Social Engagement failure mode** — a connector disconnected merely for exhausting its rate-limit quota. Direct code inspection confirmed the modern codebase reproduces the same anti-pattern by omission: `runIngestionAttempt.ts` already classifies and persists `retryable` on every `ingestion_runs` row it writes, but `connectorHealth.ts`'s `deriveConnectorHealth()` never selects that column — every failed run counts identically toward ADR-0023's rate-relative `failing` derivation and the 20-consecutive-failure ceiling, regardless of whether the failure was a rate-limit/network/5xx (retryable) or a revoked credential/malformed watchlist (non-retryable). `shouldAttemptIngestion()` then halts ingestion on that undifferentiated signal — a real behavioral effect, not a cosmetic label.

**As a** Tenant-Admin whose connector is hitting transient rate limits,
**I want** a run of purely retryable failures to never, by itself, trip the connector-level `failing`/auto-disable threshold,
**so that** a connector merely being rate-limited is never treated the same as one with a genuinely broken credential — directly closing the historical failure mode this project exists to avoid repeating.

**Acceptance Criteria**
- `deriveConnectorHealth()`'s query additionally selects `retryable` from `ingestion_runs`.
- `recentFailures` and `consecutiveFailures` (the two counters feeding ADR-0023's rate-relative/ceiling rules) count only non-retryable failed runs — a run of purely retryable failures (e.g. sustained `rate_limit`/`network`/`http_5xx`) never crosses either threshold on its own, proven by a test that reproduces Story 2.3 AC4's/2.5's own current failure-count fixture but with `retryable: true` runs instead, and confirms `status` stays `healthy`/`degraded`, never `failing`.
- A run of purely non-retryable failures (e.g. `http_401`/`malformed_watchlist`) still crosses both thresholds exactly as today — this story narrows what counts as a failure for this purpose, it does not raise or lower the 50%-rate/5-attempt-floor/20-consecutive numbers ADR-0023 already accepted.
- A **mixed** run (some retryable, some non-retryable failures) counts only the non-retryable ones toward `recentFailures`/`consecutiveFailures` — proven directly, since this is the exact case a purely-retryable-vs-purely-non-retryable pair of tests can't distinguish on its own.
- `degraded` vs. `healthy` (unaffected by ADR-0023's own rate-relative rule, per that ADR's Context) stays defined the same way — `recentFailures > 0 && recentSuccesses > 0`, still counting only non-retryable failures per the point above, so a connector recovering from a purely-retryable blip reads `healthy`, not `degraded`, once its retryable failures no longer count.
- `shouldAttemptIngestion()` (Story 1.11's own now-activation-aware version) is unaffected in its own logic — it continues to call `deriveConnectorHealth()` and check `status !== 'failing'` exactly as today; this story only changes what `deriveConnectorHealth()` itself computes.
- Story 2.3's and Story 2.5's own already-passing contracts are re-verified against this narrowed definition — if either's existing fixture happens to already use only non-retryable `ClassifiableError` kinds (as both currently do, confirmed directly: `malformed_watchlist` throughout), no assertion should need to change; if any does, it gets the same dated-note treatment this story's own commit establishes, not a silent rewrite.

**Explicitly out of scope:** any change to ADR-0023's own accepted numeric defaults (50% rate, 5-attempt floor, 20-consecutive ceiling); any change to `deriveConnectorHealth()`'s `credentialStatus`, `lastSuccessfulFetchAt`, or `lastAttemptAt` fields; wiring `shouldAttemptIngestion()` into a real scheduler (none exists yet, per ADR-0051 Decision §7 — separate, future work).

**Built 2026-08-12.** `deriveConnectorHealth()` (`connectorHealth.ts`) now selects `retryable` from `ingestion_runs` and excludes any run with `retryable = true` from `recentFailures`/`consecutiveFailures` — a retryable failure is fully invisible to the derivation (neither a failure nor a successful attempt), while a `NULL` `retryable` value (an unclassified failure, e.g. Story 4.3's own fixture helper) is treated conservatively, as non-retryable. See `contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts` (5/5) and `docs/implementation-log.md`. Full `social-listening-core` suite after: 55/55 suites, 399/399 tests passing (two transient, unrelated real-network/Key-Vault timeouts during the first full-suite run — Story 1.11's own Key Vault key-delete `afterAll` and Story 2.8's real Azure AI Language call — confirmed gone on isolated re-runs, not caused by this change).

---

## Story 2.13 — Wikipedia connector: MediaWiki Action API, revision re-poll cadence, article-as-Author

**Source:** ADR-0042 (Accepted 2026-08-08) · **Status:** Ready · **Built:** 2026-08-17 — social-listening-core@591b0b8. **A real, confirmed drafting gap, not a new decision:** ADR-0042's own acceptance note (2026-08-08) states directly that "a story would be added to Epic 2 only at this ADR's acceptance, not before," the same "no story until acceptance" precedent every connector-selection ADR in this series follows (ADR-0024/0026/0050) — but that story was never actually drafted, confirmed directly by grepping every `docs/user-stories/epic-*.md` file for `ADR-0042` and finding zero matches, four days after acceptance. Closed here.

**Drafted 2026-08-12**, found while checking every Accepted ADR in the series against every epic file's own `Source:` citations for exactly this category of gap, at Menno's own direct request ("im also missing the stories to build the wikipedia ingestion?"). Only one other Accepted ADR (ADR-0047) is similarly absent from every epic file, and that one is a deliberate, already-documented no-story meta-ADR (cross-story reference conventions) — ADR-0042 is the sole genuine gap.

**As a** tenant tracking public perception of their own brand, organization, or a topic with a Wikipedia presence,
**I want** a real `SocialConnector` that re-polls a tracked Wikipedia article as it gets edited — not just once at first discovery — normalizing each qualifying revision into a `SocialPost`,
**so that** I find out when my own Wikipedia article actually changes (a reputation-relevant edit, a dispute, vandalism), not just that it existed once when I started tracking it.

**Acceptance Criteria**
- A registered `SocialConnector` (`providerId` distinct from every existing connector, `authMode: 'none'`, `deliveryMode: 'poll'`, per ADR-0042 Decision §1) targets the MediaWiki Action API directly (`en.wikipedia.org/w/api.php`) — no aggregator, no account, no key — registered without any change to core ingestion orchestration, proven by the same no-core-path-edit evidence ADR-0048/Story 2.10 requires of every connector registration (its own `CORE_FILES`/`REAL_CONNECTORS` constants extended, per that story's own documented convention).
- Every outbound request sets a compliant, connector-identifying `User-Agent` header (per Wikimedia's own User-Agent Policy, ADR-0042 Decision §1) — proven by asserting the header is present and non-generic on every real or fixture request this story's contract makes.
- The connector re-polls an already-tracked article via the `recentchanges` API (filtered by `rctitle`/`rcstart`), producing a new `SocialPost` for each qualifying revision, not a single static snapshot at first discovery — proven by a test that simulates two distinct revisions of the same tracked article across two poll cycles and confirms two distinct `SocialPost` rows, both resolving to the same `Author`.
- Each normalized post's `Author` resolves to the specific Wikipedia article, keyed by the page's stable `pageid` (not its title, which can change on a page move): `externalAuthorId` = `pageid`, `handle`/`displayName` = the article's current title, `followerCount` left unpopulated — proven by asserting the resolved `Author` row's shape, the same proof pattern as Story 2.6 AC2/Story 2.7 AC2/Story 2.11 AC5, citing ADR-0004's own now-generalized organization-as-Author clause as context but not claiming an identical shape to Newswire's/GNews's (ADR-0042 Decision §3 itself draws this distinction — this connector's `Author` is a persistent platform-native document identity, not an independently-existing real-world organization).
- `SocialPost.url` is set to the specific ingested revision's own permalink (`?oldid=<revid>`), not the bare article URL — the attribution mechanism Wikimedia's own Terms of Use §7 names (ADR-0042 Decision §4) — proven by asserting the stored URL includes the revision id, distinct from the article's canonical URL.
- A newly discovered article (one matching a watchlist's query for the first time, via the `search` API) has its current content ingested as of discovery; no historical backfill of revisions predating discovery is performed — proven by a test confirming only the current revision is ingested on first discovery, the same no-backfill limitation Newswire (Story 2.6) and GNews (Story 2.7) already establish.
- `supportedQueryFeatures` (ADR-0021) is declared to reflect only what this pass actually confirms reachable through the standard `action=query&list=search` endpoint — per ADR-0042's own named verification gap (Decision §5/Open Questions: CirrusSearch's exact native-query surface through the standard API was not confirmed at ADR-drafting time) — with watchlist matching correctly falling back to whole-article post-fetch matching for anything not confirmed, the same fallback pattern every connector to date uses. This story does not itself resolve that open verification gap; it declares the connector's `supportedQueryFeatures` conservatively (empty, or whatever this story's own direct verification confirms) rather than assuming CirrusSearch's documented operators are reachable unverified.
- `getRateLimitConfig()` uses a conservative, explicitly-named placeholder value — ADR-0042 Decision §5 itself states no confirmed numeric rate-limit ceiling exists at drafting time ("Wikimedia publishes a dedicated rate-limits policy... referenced but not fetched to an exact numeric ceiling... do not invent a number, verify before RequestGate is sized against it"). This story must either verify a real number directly against `mediawiki.org/wiki/Wikimedia_APIs/Rate_limits` before sizing `RequestGate`, or ship with an explicitly-labeled conservative placeholder and a dated note — never a silently invented number presented as confirmed.
- A poll cycle against an already-tracked article with zero qualifying `recentchanges` entries since the last check is a correct no-op (no duplicate `SocialPost` rows), proven across two consecutive poll cycles, the same proof pattern as every prior connector's own AC4.

**Explicitly out of scope, per ADR-0042's own Open Questions:** a materiality threshold for re-ingestion (every qualifying `recentchanges` entry produces a `SocialPost`, unfiltered by edit size/minor-edit-flag, left as a future tuning pass); backfilling a newly discovered article's revision history beyond its current content at discovery; RAG/embedding-oriented chunked ingestion granularity (whole-article `SocialPost.text` storage only); the CC BY-SA "Adapted Material" question for AI-enrichment output derived from Wikipedia text (ADR-0042's own named, unanalyzed edge case) — enrichment (Story 2.8/2.9) applies unmodified, this story does not add or change any enrichment-specific handling for Wikipedia content.

**Documentation Steward correction, 2026-08-17.** The paragraph previously here, beginning "Built 2026-08-12," was a copy-paste error — it verbatim describes Story 2.11's own tenant-owned-feed implementation (`migrations/0026_create_tenant_owned_feed_activations.sql`, `dnsVerification.ts`, `tenantOwnedFeedConnector.ts`), not Wikipedia. Confirmed directly, not assumed: no `contracts/**/*2.13*`/`*wikipedia*` file existed at the time this was found, no `src/connectors/wikipedia/` directory existed, and `docs/implementation-log.md` has no Story 2.13 entry — this story was never actually built. Corrected in place per this file's own "not re-verified every session, treat the log as authoritative" framing (`CLAUDE.md`), removed rather than left to mislead a future reader into believing Wikipedia ingestion already ships. **Status remains Ready, Built: not yet**, as the corrected field above now states plainly.