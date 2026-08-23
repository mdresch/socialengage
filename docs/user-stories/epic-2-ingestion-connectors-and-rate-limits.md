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

**Source:** ADR-0042 (Accepted 2026-08-08) · **Status:** Built 2026-08-17 · **Built:** 2026-08-17 — social-listening-core@591b0b8. **A real, confirmed drafting gap, not a new decision:** ADR-0042's own acceptance note (2026-08-08) states directly that "a story would be added to Epic 2 only at this ADR's acceptance, not before," the same "no story until acceptance" precedent every connector-selection ADR in this series follows (ADR-0024/0026/0050) — but that story was never actually drafted, confirmed directly by grepping every `docs/user-stories/epic-*.md` file for `ADR-0042` and finding zero matches, four days after acceptance. Closed here.

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

---

## Story 2.14 — Wikipedia discovery search driven by the tenant's own watchlist terms

**Source:** ADR-0042 §5 (Accepted 2026-08-08) · **Status:** Built 2026-08-18 · **Built:** 2026-08-18 — social-listening-core@c802b64. No new ADR needed — ADR-0042 Decision §5 already named this directly as implementation-time work ("Exact AST-to-CirrusSearch-syntax translation is an implementation-time task, not fixed by this ADR"), the same "resolve an already-Accepted ADR's own named open item directly" precedent Story 5.8 (§5's `domain` column), Story 5.11 (§5's endpoint shape), and Story 5.17 (§9's audit mechanics) already established.

**Drafted 2026-08-18, at Menno's own direct request**, found live while activating the Wikipedia connector in the Tenant Admin UI: the connector has no way to be told which article/topic to track. Confirmed directly against the real code, not assumed: `pollWikipedia(tenantId, query = DEFAULT_QUERY)` (`src/connectors/wikipedia/pollWikipedia.ts:19,117-119`) defaults `query` to the module-level literal `DEFAULT_QUERY = 'Anthropic'`, and `bootstrapConnectors.ts:72` — the one real production call site (`live-ingestion-polling-scheduler` SKILL.md) — calls `pollWikipedia(tenantId)` with no query argument at all. Every tenant's every poll cycle searches the same hardcoded literal, regardless of what that tenant actually watches for. This is the exact, already-named gap Story 2.13's own SKILL.md "Known gaps" section flags: "No real per-watchlist discovery query — shared gap with GNews." This story closes it for Wikipedia only; GNews's identical gap (ADR-0026, `docs/open-items-and-deferred-work.md`) is unaffected and stays its own separate, undesigned item.

**As a** tenant who has activated the Wikipedia connector,
**I want** its discovery search to use the topic(s) I've actually defined in my own watchlist(s) targeting Wikipedia, instead of the one hardcoded literal every tenant currently shares,
**so that** activating the connector lets me track my own brand or topic, not "Anthropic."

**Acceptance Criteria**
- `pollWikipedia()`'s discovery phase no longer calls `fetchWikipediaSearch()` with a fixed, shared `DEFAULT_QUERY` — it derives its search query from the tenant's own active watchlists whose `platformIds` include `'wikipedia'` (the same `listActiveWatchlistsForTenant()` call the connector already makes, at `pollWikipedia.ts:129`, moved earlier and now also driving discovery, not only post-ingestion event matching) — proven by a test asserting two tenants with differently-termed wikipedia-targeted watchlists each produce a search call reflecting their own terms, never a shared literal.
- A tenant with zero active watchlists targeting `wikipedia` performs no discovery search at all for that poll cycle — proven by a test confirming `fetchWikipediaSearch()` is not called when no matching watchlist exists. Re-poll of already-tracked articles (Phase 2, `recentchanges`) is unaffected either way — a tenant who previously discovered articles keeps re-polling them for edits even with no active watchlist right now.
- For a `keyword`/`hashtag`/`account`-typed watchlist (`matchType`, `watchlistStore.ts`'s `Watchlist.terms`), the discovery query is built from that watchlist's own `terms` array — proven directly against a real MediaWiki `search` API call for a real, known term, confirming the submitted query matches the watchlist's own terms, not `DEFAULT_QUERY`.
- A tenant with more than one active wikipedia-targeted watchlist gets one separate discovery search per watchlist, each capable of producing its own newly-discovered `Author`/`SocialPost` rows — proven by a test with two distinct watchlists confirming two distinct `fetchWikipediaSearch()` calls, one per watchlist's own terms, with no cross-watchlist term concatenation.
- `boolean`-typed watchlists (`Watchlist.booleanQuery`) are explicitly excluded from driving discovery in this story — real AND/OR/NOT-to-CirrusSearch-operator translation remains ADR-0042's own still-open, unverified gap (Decision §5/Open Questions: CirrusSearch's exact native-query surface was never confirmed to this project's primary-source bar) — proven by a test confirming a `boolean`-typed watchlist produces no discovery search call from this story's own new code path (silently skipped, not mistranslated).
- Regression: whole-article fallback matching for event-publishing purposes (Story 2.13 AC7, `publishSocialPostIngestedEvents()`) is unchanged — a post discovered via a keyword-driven search call is still evaluated against every matching watchlist's full AST (including `boolean` ones) exactly as today. This story only changes what drives the discovery *search call itself*, never what counts as a match once content is fetched.
- **A real, discovered constraint, corrected here rather than silently designed around:** Story 2.13's own passing contract (`story-2.13.wikipedia-connector.contract.test.ts`, its final test) calls `pollWikipedia(tenantId, TEST_ARTICLE)` — an explicit, literal `query` override — which this story must not break (`implement-story`'s own "never rewrite a passing contract" hard rule). `pollWikipedia()`'s `query?: string` parameter is therefore kept, not removed: when explicitly supplied, behavior is unchanged from today (one search call using that literal, exactly as Story 2.13's own test already proves); only the **omitted-query path** changes — `bootstrapConnectors.ts:72`'s own real production call site, which has never passed one — from "silently default to the shared `DEFAULT_QUERY` literal" to "derive from the tenant's own active wikipedia-targeted watchlists." `DEFAULT_QUERY` itself is removed once nothing references it.

**Explicitly out of scope:** full boolean AST-to-CirrusSearch operator translation (AND/OR/NOT, quoted phrases, `intitle:`/`insource:`) — named, not solved, matching ADR-0042's own still-open verification gap; `recentchanges`-driven re-poll behavior for already-tracked articles (Story 2.13 Phase 2) is unchanged; GNews's identical, separately-tracked `DEFAULT_QUERY` gap (`pollGNewsSearch.ts`) is not touched by this story.

**Documentation Steward correction, 2026-08-19.** This story's own header, and Story 2.13's above it, both already carried a correct, real `**Built:**` field naming a real shipped commit (2.13: `social-listening-core@591b0b8`; 2.14: `@c802b64` — both confirmed directly against `docs/implementation-log.md`'s own matching 2026-08-17/2026-08-18 entries), but each `**Status:**` field still read "Ready" rather than "Built" — the same gap the "Built convention" exists to catch. Both now read "Built" with the matching date; no Acceptance Criteria text changed. (Story 2.13's own older 2026-08-17 correction note above, which reads "Status remains Ready, Built: not yet," is left untouched — it accurately describes this story's state at the moment it was written, earlier the same day the connector was actually built; per this file's own append-only convention, that note stays as history, not edited to match the now-current field above it.)

---

## Story 2.15 — Facebook connector: tenant's own connected Page, posts only, Tier 3 credential

**Built:** 2026-08-18 — social-listening-core@50a5914

**Source:** ADR-0059 (Accepted 2026-08-18) · **Status:** Built 2026-08-18 — a real, unresolved precondition named up front, not a formality: ADR-0059 Decision §3 found that onboarding any real, unaffiliated tenant's Page requires SocialEngage's own registered Meta App to clear Business Verification and pass permission-by-permission App Review (`pages_show_list`, `pages_read_engagement`), neither of which is confirmed achievable for a solo-developer project — App Review approval is a discretionary human review, not a mechanical check (ADR-0059's own review-round addition). This story's own contract can be built and proven against a Menno-administered test Page under Standard Access (the degenerate, no-App-Review case ADR-0059 Decision §3 itself names) without either gate being cleared first; **onboarding any real tenant's Page beyond that test case is blocked on Business Verification/App Review succeeding, separately from this story's own build-and-test completion.** Named here rather than silently assumed resolved.

**As a** Tenant-Admin or Tenant User who personally administers a Facebook Page,
**I want** to connect that Page as a `SocialConnector` source, using my own Facebook login,
**so that** my own Page's published posts and their engagement metrics show up alongside every other connector's content in my tenant's post feed — without SocialEngage ever holding or pooling my Facebook credential.

**Acceptance Criteria**
- A registered `SocialConnector` (`providerId` distinct from every existing connector, `authMode: 'oauth'`, `deliveryMode: 'poll'` for v1, per ADR-0059 Decision §2/§4) targets the Graph API's Page-feed endpoint (`GET /{page-id}/feed` or `/posts`) — registered without any change to core ingestion orchestration, proven by the same no-core-path-edit evidence ADR-0048/Story 2.10 requires of every connector registration.
- The connect flow exchanges Facebook Login for Business for a long-lived Page access token and stores it as a **Tier 3, user-bound credential** (ADR-0028 §3, per ADR-0059 Decision §4) — `platform_credentials.owner_type = 'user'`, tied to the connecting individual's own `user_id` — proven by a test asserting the stored credential's ownership shape, and a second test confirming a Tenant-Admin cannot create or activate this credential on another user's behalf (the same negative-path proof ADR-0028's own Reddit-shaped Tier 3 precedent establishes).
- Only the tenant's connected Page's **own published posts** are ingested as `SocialPost` rows — no comment ingestion, no mention/tag discovery — proven by a test confirming the connector's fetch surface never calls a comments/mentions endpoint, matching ADR-0059 Decision §5's explicit v1 exclusion (deferred over an unresolved third-party author-rights question).
- Each normalized post's `Author` resolves to the connected **Page**, not the individual who authored the post or the individual who holds the connecting credential: `externalAuthorId` = the Page's own `id`, `handle`/`displayName` = the Page's name, `followerCount` populated from the Page's own fan/follower count (the first organization-as-Author connector where this field is both available and populated, per ADR-0059 Decision §5's named divergence from Newswire/GNews/Wikipedia/tenant-owned-feed) — proven by asserting the resolved `Author` row's shape, the same proof pattern as Story 2.6 AC2/Story 2.7 AC2/Story 2.11 AC5/Story 2.13 AC4.
- `supportedQueryFeatures` (ADR-0021) is declared empty — no native search/query surface exists (ADR-0059 Decision §1/§6) — watchlist matching is 100% ADR-0006 post-fetch fallback against the Page's own post text, proven by a test confirming a watchlist match is found via fallback matching against fetched post content, never via a native query parameter.
- `getRateLimitConfig()` reflects the Pages API's real, confirmed ceiling — 4,800 × the Page's own Engaged Users, per rolling 24-hour window (ADR-0059 Decision §4, verified directly against `developers.facebook.com`'s Rate Limiting overview) — implemented as its own shape, not a drop-in reuse of any flat-number connector's `RequestGate` config; if the Page's own Engaged Users figure cannot be resolved at implementation time, ship with an explicitly-labeled conservative placeholder and a dated note, never a silently invented number presented as confirmed (same discipline as Story 2.13 AC8).
- A credential-invalidation error (password change, Page-admin removal, grant revocation, Meta API returning an authorization/permission error) surfaces as a **distinct, named connector-health state** — e.g. "Facebook connection expired — reconnect required" — not folded into the generic `failing`/`unhealthy` state every other connector's ordinary rate-limit or transient failures already produce (ADR-0059 Decision §4's review-round addition, an implementation-time refinement of `deriveConnectorHealth()`, ADR-0009) — proven by a test that simulates a Meta API authorization-error response and confirms the derived health state is distinguishable from an ordinary retryable-failure state.
- A poll cycle against an already-connected Page with zero new posts since the last check is a correct no-op (no duplicate `SocialPost` rows) — proven across two consecutive poll cycles, the same proof pattern as every prior connector's own AC4.

**A hard, binding constraint on whichever future Admin UI story surfaces this connector (not built by this backend-only story):** per ADR-0059 Decision §2's review-round strengthening, the connector's UI label must never render the bare platform name "Facebook" — the recommended default display name is **"Facebook Page (Owned Feed)"**, or an equivalent that names both the platform and the owned-content-only scope in the label itself, not only in surrounding copy. Named here so the future UI story inherits it rather than rediscovering it.

**Explicitly out of scope, per ADR-0059's own Decision and Open Questions:** genuine public-content social listening (discovering posts from Pages/accounts a tenant doesn't own) — verified not buildable against Meta's current API, not merely deferred; comment/mention ingestion — deferred over the unresolved third-party personal-data/author-rights question, needs a dedicated `docs/legal/legal-compliance-register.md` pass before any v2 design; `deliveryMode: 'push'` via Meta's Page Webhooks — a named, confirmed-feasible v2 enhancement, not built here; OAuth token re-consent/rotation UX beyond the basic invalidation-detection AC above; actually submitting SocialEngage's own Meta App for Business Verification and App Review — a real, one-time, project-level administrative step this story's own build does not itself perform (see Status line).

---

## Story 2.16 — `azureAiLanguageConnector.analyze()` throws a classified error instead of crashing on a rejected document

**Built:** 2026-08-18 — social-listening-core@3fedac3

**Source:** No new ADR needed — this corrects an implementation gap against ADR-0038's own already-Accepted Decision text (enrichment is best-effort, additive, never a hard dependency of ingestion succeeding) and `enrichPost.ts`'s own already-stated contract ("Never throws... a programming error... all resolve to `undefined`"), the same "implementation catches up to an already-stated policy" category Story 2.12 already used for `deriveConnectorHealth()`. **Status:** Built 2026-08-18.

**Found live, 2026-08-18, while investigating why Wikipedia watchlists (Stories 2.13/2.14) return zero ingested posts despite the connector being activated and correctly discovering real articles.** Direct inspection of the persistent local dev database confirmed every real `ingestion_runs` row for `wikipedia` is permanently stuck at `status: 'running'`, `posts_ingested: 0` — no post has ever reached `social_posts` for this connector. Reproduced directly against the real Azure AI Language endpoint with a real ~37KB Wikipedia article body (the actual shape `ingestWikipediaRevisions()` sends, per `htmlToMarkdown()`'s own real output for a large article): `azureAiLanguageConnector.analyze()` throws a raw, unclassified `TypeError` — `Cannot read properties of undefined (reading 'entities')` — not a `ClassifiableError`. Root cause, confirmed by reading `callAnalyzeText()`/`analyze()` directly: Azure AI Language enforces a per-document size limit; when a document is rejected, `results.documents` comes back empty/undefined instead of containing an analyzed document, but `analyze()` unconditionally indexes `entitiesRes.results.documents[0]` (and the three sibling `Res.results.documents[0]` reads) with no check. `enrichPost.ts`'s own `tryProvider()` does catch this (`if (!(err instanceof ClassifiableError)) return undefined` — "a programming error must not break ingestion either"), so it fails over to Azure OpenAI silently, with **zero logging or visibility** — this has been happening for every real Wikipedia post ever processed, invisibly, until this session's direct investigation.

**As a** developer relying on `enrichPost.ts`'s own stated contract,
**I want** a document Azure AI Language rejects to surface as a real, classified, loggable failure for *that provider* — not an unhandled crash that happens to get masked by a defensive catch-all one layer up,
**so that** a systematic enrichment failure (e.g. every Wikipedia post silently never getting Azure AI Language enrichment) is diagnosable instead of invisible, and so `tryProvider()`'s crash-catching branch stays reserved for genuine, unanticipated programming errors — not a known, structurally-expected response shape this connector should have handled itself.

**Acceptance Criteria**
- `callAnalyzeText()` (or `analyze()`, whichever proves the more direct fix point) checks each capability response for a present, analyzable document (`results.documents[0]` exists) before reading any field off it. When a document is missing/rejected, it throws `ClassifiableError('network', ...)` — the same classification this connector's own adjacent `if (!response.ok)` branch already uses for "a 4xx that isn't 401/403/429," keeping this connector internally consistent rather than introducing a special-cased new `ErrorKind` for one connector — proven by a test that mocks a real Azure AI Language response shape with `results.documents` empty (the actual shape a rejected/oversized document produces) and asserts a `ClassifiableError` is thrown, never a raw `TypeError`.
- `enrichPost.ts`'s own `tryProvider()` behavior for this now-classified error is exercised end to end: a rejected-document response from Azure AI Language causes `tryProvider()` to fail over to the next provider in `PROVIDERS` (Azure OpenAI) exactly as it already does today for any other classified, non-retryable-exhausted failure — proven by re-running Story 2.9's own existing failover proof pattern against this specific input shape, confirming no regression in the fail-over path itself.
- **A real, pre-existing, adjacent inaccuracy corrected in the same pass, not left inconsistent beside the new fix:** `callAnalyzeText()`'s own doc comment (currently: *"classified as 'network' as the closest existing non-retryable bucket"*) is factually wrong — `'network'` is in `errorClassification.ts`'s own `RETRYABLE_KINDS` set, confirmed directly by reading it. The comment is corrected to state plainly that this reuses `'network'` because it is this project's existing convention for "a generic 4xx from a real provider" (see the identical pattern in `gnewsConnector.ts`/`newswireConnector.ts`/`azureOpenAiConnector.ts`/`tenantOwnedFeedConnector.ts`/`wikipediaConnector.ts`, all confirmed via direct grep), not because it is non-retryable — it is retryable, and this story does not change that. No behavior changes from this correction; it is a comment-accuracy fix only.
- All four capability calls inside `analyze()` (`SentimentAnalysis`, `KeyPhraseExtraction`, `EntityRecognition`, `LanguageDetection`) get the same missing-document guard, not only the one (`EntityRecognition`) this session's reproduction happened to surface first — proven by a test confirming each of the four call sites independently throws the same classified error under the same missing-document condition, not just the one already observed.

**Explicitly out of scope:** whether a generic 4xx being retryable (`'network'`, project-wide convention, confirmed identical across every connector) is the right default — a real, separate, existing-since-day-one design question this story does not revisit, named here so it isn't confused with what this story actually changes; capping/truncating the enrichment *input* text before it reaches `enrichPost()` (the separate "size mismatch" fix option, tracked as its own follow-on, not bundled here since this story's own AC list is scoped to the crash itself, not the broader size question); adding a `fetch()` timeout to any connector (a separate, broader hardening gap named in this session's investigation, not this story's scope); the real, currently-orphaned `ingestion_runs` rows already stuck at `'running'` in the dev database (an operational data cleanup, not a code change); Azure OpenAI's own real 429 rate-limiting behavior (unrelated to this specific crash — Azure OpenAI already returns a properly classified `ClassifiableError('rate_limit', ...)` today, confirmed directly, and is retried correctly per its own existing, unmodified logic).

---

## Story 2.17 — Azure OpenAI's structured enrichment call also returns a stored `summary` field

**Built:** 2026-08-18 — social-listening-core@6a9b628

**Source:** No new ADR needed — additive widening of `AnalyzeResult` (ADR-0002/ADR-0038's own already-Accepted `AIProviderConnector` interface), the same "widen the interface, existing callers unaffected" pattern Story 2.8/2.9 already established for `sentimentScores`/`entities`/`overallConfidence`. **Status:** Built 2026-08-18.

**Requested directly by Menno, 2026-08-18, following this session's live Wikipedia-enrichment investigation (Story 2.16).** Azure OpenAI's existing single structured-output call (`azureOpenAiConnector.ts`'s `callChatCompletions()`) already reads the *entire* input text and returns `sentiment`/`sentimentScores`/`entities`/`keyPhrases`/`detectedLanguage`/`overallConfidence` in one real HTTP request — confirmed directly this session that it accepts a full ~37KB Wikipedia article body without any size-based rejection (unlike Azure AI Language's real, confirmed 5,120-character document limit, Story 2.16). Menno's own framing: extend that same call's JSON schema to also request a concise summary, so a real, human-readable summary becomes available on every post Azure OpenAI ends up enriching, at zero additional API calls — not a separate summarization pass.

**A real, honest scope limitation, named up front, not discovered later:** `enrichPost.ts`'s `PROVIDERS` order tries Azure AI Language *first* (Menno's own confirmed intentional default, 2026-08-12) and it succeeds for most ordinary-length content (GNews, Newswire, most Wikipedia revisions) — Azure AI Language's four capabilities have no summarization output of their own (real Azure AI Language document summarization is a separate, asynchronous endpoint, verified this session — a materially heavier build, not this story's scope). **`summary` will therefore only be populated for posts that actually reach Azure OpenAI** — today, primarily posts Azure AI Language rejects or fails on. Menno's own stated plan for verifying this — deactivating the Azure AI Language connector for a test tenant so every post routes to Azure OpenAI — is exactly this limitation made visible, not a workaround for a bug.

**As a** developer or future UI consumer of `SocialPost.enrichment`,
**I want** a concise, LLM-generated summary of a post's content captured as part of the same structured-output call that already analyzes it,
**so that** a real summary is available for reuse (e.g., a future compact list/card view) without a dedicated summarization pass or any extra API cost beyond what `enrichPost()` already spends when Azure OpenAI runs.

**Acceptance Criteria**
- `AnalyzeResult` (`types.ts`) gains an optional `summary?: string` field — additive, matching every prior widening of this interface; `azureAiLanguageConnector.ts` is unaffected and continues to leave it `undefined`, which is correct, not a gap (mirrors how `overallConfidence` is already `undefined` for that provider).
- `azureOpenAiConnector.ts`'s `ENRICHMENT_SCHEMA` gains a `summary: { type: 'string' }` property, added to `required` (Azure OpenAI's own structured-output `strict: true` mode requires every schema property be listed as required, confirmed against this connector's own existing five required fields) — proven by a real call against the real Azure OpenAI resource returning a non-empty `summary` string alongside the five existing fields, the same real-infrastructure bar Story 2.9's own AC3 already established for this connector.
- The system prompt (`callChatCompletions()`) is extended to explicitly instruct the model to also produce a concise summary of the input text as part of its single-pass answer, folded into the same self-review instruction Story 2.9 already added (2026-08-10) — not a second, separate instruction block requiring a second call.
- A real `enrichPost()` call, for a tenant with Azure AI Language deactivated and Azure OpenAI active/credentialed, returns a result whose `summary` is a non-empty string genuinely shorter than the real input text supplied — proven directly against real Azure infrastructure, not a mocked response, matching Story 2.8/2.9's own established real-call bar for this connector's happy path.
- The returned `summary` round-trips through `insertSocialPost()` into `SocialPost.enrichment.summary` unchanged — no new migration, no new column, since `enrichment` is already an unfiltered JSONB blob (the same storage path Story 2.8 AC4 already proved for every other `AnalyzeResult` field) — proven by querying the stored row directly, the same proof pattern Story 2.8 AC4 already used.
- A tenant whose enrichment is actually served by Azure AI Language (the common case — ordinary-length content, both providers connected and active) has `enrichment.summary` absent/`undefined`, not a placeholder or an empty string — proven by a test confirming Azure AI Language's own successful result carries no `summary` key, so a future reader of stored data doesn't misinterpret "no summary" as "summarization failed" when it simply never ran.

**Explicitly out of scope:** any UI surfacing of the new `summary` field (a separate, not-yet-scoped follow-on if wanted); giving Azure AI Language its own summarization capability (the real, separate, asynchronous Document Summarization endpoint named in this session's option discussion — a materially heavier build, not pursued here); reordering `PROVIDERS` so Azure OpenAI runs for every post (would make `summary` universal, but reverses Menno's own already-confirmed intentional provider-ordering default — a separate decision, not made by this story); correcting Story 2.16's own found-live retryable-classification inefficiency for oversized-document fail-over (named in this session's discussion, tracked separately, not bundled into this story's own scope).

**Documentation Steward correction, 2026-08-19.** Stories 2.15, 2.16, and 2.17 above each already carried a correct, real `**Built:**` field naming a real shipped commit (2.15: `social-listening-core@50a5914`; 2.16: `@3fedac3`; 2.17: `@6a9b628` — every hash confirmed directly against `docs/implementation-log.md`'s own matching 2026-08-18 entries), but each `**Status:**` field still read "Ready." In all three, the `**Built:**` line was also placed *before* the `**Source:**/**Status:**` line rather than after it — the inverse of this file's own usual ordering (see Story 2.13/2.14 above), a likely reason this instance wasn't already caught by casual scanning. All three now read "Built 2026-08-18"; no Acceptance Criteria text changed.

---

## Story 2.18 — Facebook connector captures post-level engagement counts (reactions, comments, shares)

**Built:** 2026-08-18 — social-listening-core@35e35c3

**Source:** ADR-0059 Decision §2 · **Status:** Built 2026-08-18

**As a** core backend engineer / downstream consumer of Facebook posts,
**I want** post-level engagement counts (`reactions`, `comments`, `shares`) captured during Page post polling,
**so that** engagement metrics are preserved in `rawPayload` for downstream analytics without schema changes.

**Acceptance Criteria**
- `fetchFacebookPagePosts()` requests `reactions.summary(total_count).limit(0).as(reactions)` and `comments.summary(total_count).limit(0).as(comments)` alongside standard post fields.
- `FacebookPagePost` interface in `facebookConnector.ts` gains optional `reactions`, `comments`, and `shares` summary objects.
- `shares` is treated as optional/absent when a post has 0 shares (per Meta Graph API convention).
- Raw engagement counts flow through `normalize()` into `SocialPost.rawPayload` unmodified.

---

## Story 2.19 — Tenant-owned feed: per-feed display name, and per-item author (byline) extraction

**Built:** 2026-08-20 — social-listening-core@2f52c0f (backend half only — see Explicitly out of scope below for the admin-side UI, Story 6.28)

**Source:** ADR-0050's own 2026-08-20 Amendment Log entry — two additive, backward-compatible extensions of the already-Accepted ADR-0050, neither requiring re-acceptance. **Status:** Built 2026-08-20.

**Requested directly by Menno, 2026-08-20**, having just been given the connector setup screen's own URL (`/tenant/connectors/tenant-owned-feed`): *"give feeds ... a name. Let the feed owner give the feed a separate name. This allow for a feed identification name instead of the generic tenant-owned-feed selection and review the feeds for a mandatory field that is designated to be the Author of the article/project/posts."* Clarified directly with Menno (`AskUserQuestion`) that "mandatory field... designated to be the Author" meant adding real per-article byline extraction from the feed itself (`<dc:creator>`/`<author>`), not merely confirming the already-existing domain-as-Author invariant — ADR-0050's own Consequences/Open Question 5 had explicitly reserved that as "a separate, named design decision... not in scope for this ADR," so a short Amendment Log entry was drafted (not a re-opened Decision) before implementing.

**As a** tenant with more than one connected feed (Story 6.20/ADR-0057's own multi-feed support),
**I want** to give each feed my own chosen name, and have each ingested post's real byline surfaced when the feed itself provides one,
**so that** I can tell my feeds apart by something more meaningful than a raw domain string, and readers of the ingested content can see who actually wrote it, not just my organization's own domain-as-Author placeholder.

**Acceptance Criteria**
- `tenant_owned_feed_activations` gains an optional, nullable `name` column (`migrations/0037`) — never required, never defaulted; unset renders as `domain` in the setup UI.
- `POST /v1/connectors/tenant-owned-feed/connect` accepts an optional `name` (a non-empty string when supplied — a `400` on an empty/whitespace-only value); the created activation's `name` is returned in the response and by `GET .../activations`.
- `PATCH /v1/connectors/tenant-owned-feed/:id` accepts `feedUrl` and/or `name` independently — at least one must be present (`400` otherwise); `name: null` explicitly clears a previously-set name. `domain` remains permanently rejected, unchanged.
- `feedItemParser.ts`'s `parseFeedItems()` extracts a per-item byline (`ParsedFeedItem.author`) when the feed provides one, tried in priority order: RSS's Dublin Core `<dc:creator>` (WordPress and most CMS platforms' own de facto standard), RSS 2.0's own flat `<author>` (extracted as-is — the spec says email, but real feeds often put a plain name there instead), Atom's nested `<author><name>`. `null`, never fabricated, when the feed provides none of these.
- `ingestTenantOwnedFeedItems()` denormalizes `activation.name` into `rawPayload.feedName` (the key is genuinely absent, not `null`, when the activation has no name set) and the parsed item's own byline into `rawPayload.author` — while the post's real `authorId`/`Author` row still resolves to the verified domain, unchanged, proving both additions are display-only and do not touch Author/providerId modeling.
- `social-listening-admin`'s `postDisplay.ts`: `extractAuthor()` already checks `rawPayload.author` first in its precedence chain (established by the same-day Newswire/Facebook fixes) — the byline above is picked up with zero admin-side code change. `extractUrl()`/provider-badge/Analytics-grouping behavior is unaffected; `rawPayload.feedName` is denormalized for possible future display use but nothing reads it for grouping/filtering yet.

**Explicitly out of scope:** replacing organization-as-Author (the verified domain) with individual-as-Author for the `Author` entity/topic-signals/Analytics grouping — a real, separate, not-yet-decided design question named in ADR-0050's own Amendment Log entry, not resolved here; a name-uniqueness constraint (none decided — a label, not an id); using `name`/`feedName` as an Analytics Dashboard/Provider-filter grouping key (still keyed on the fixed `tenant-owned-feed` `providerId`); any admin-side UI surfacing of the feed's own `name` in the connector setup screen itself — that is a separate, admin-repo story (Story 6.28).

---

## Story 2.20 — Country-level geospatial extraction and normalization on post enrichment

**Source:** ADR-0064 (Proposed 2026-08-19) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-core

**As a** core backend engineer,
**I want** the ingestion and enrichment pipelines to extract, normalize, and store country-level geospatial metadata from connector payloads (`gnews`, `newswire`, `tenant-owned-feed`) into `social_posts.enrichment`,
**so that** downstream consumers (such as the Analytics Dashboard) can query and aggregate post volume and sentiment by country without storing sensitive coordinate point data or executing ad-hoc geocoding.

**Acceptance Criteria**
- `AnalyzeResult` / enrichment contract in `social-listening-core/src/connectors/types.ts` is widened with optional, nullable geospatial fields in `camelCase`:
  - `geoCountry?: string | null` (ISO 3166-1 alpha-2 uppercase, e.g. `'US'`, `'GB'`, `'NL'`)
  - `geoCountryName?: string | null` (derived human-readable name, e.g. `'United States'`)
  - `geoRegion?: string | null` (optional sub-region, e.g. `'EU'`, `'NA'`)
  - `geoSource?: 'post' | 'source' | 'inferred' | 'unknown' | null` (provenance tracker)
  - `geoConfidence?: 'high' | 'medium' | 'low' | null`
- **GNews connector extraction (`pollGNewsSearch.ts`):**
  - Reads `GNewsArticle.source.country` from the GNews search response.
  - Normalizes country code to uppercase ISO 3166-1 alpha-2 (e.g. `'us'` → `'US'`).
  - Sets `geoCountry: 'US'`, `geoCountryName: 'United States'`, `geoSource: 'source'`, `geoConfidence: 'high'`.
- **Newswire connector extraction (`pollNewswireFeeds.ts`):**
  - Inspects explicit `sourceCountry` or `country` if present in feed item: sets `geoSource: 'post'`, `geoConfidence: 'high'`.
  - Fallback: maps unambiguous wire source domains to country where determined: sets `geoSource: 'source'`, `geoConfidence: 'medium'`.
  - If no unambiguous country signal is found: leaves `geoCountry: null`, `geoCountryName: null`, `geoSource: null`, `geoConfidence: null`.
- **Tenant-owned feed extraction (`pollTenantOwnedFeed.ts`):**
  - Inspects explicit feed metadata/tag fields (`country`, `countryCode`, `geo.country`, `sourceCountry`).
  - Normalizes explicit valid country codes to ISO 3166-1 alpha-2 uppercase; sets `geoSource: 'post'`, `geoConfidence: 'high'`.
  - If absent/unstructured: leaves `geoCountry: null`. Does not attempt unstructured text geocoding in v1 (ADR-0064 §3).
- **Facebook connector (`pollFacebookPage.ts`):**
  - Leaves `geoCountry: null` (Page-level posts in standard feed do not carry reliable post coordinates).
- **Storage & wire contract (zero migration):**
  - Extracted geo fields are persisted directly inside `social_posts.enrichment` (`JSONB`), round-tripping through `insertSocialPost()`.
  - `SocialPostSummary` returned by `GET /v1/posts` exposes `enrichment` containing the new geo fields with zero database schema migrations and zero SQL alterations.
- Contract test verifies that GNews items with `source.country` and Newswire/Tenant-feed items with explicit country tags populate `enrichment.geoCountry`, `geoCountryName`, `geoSource`, and `geoConfidence` accurately, while feeds without country tags default to `null`/`undefined` without failure.

**Explicitly out of scope:** Sub-national/city-level geocoding (Open Question 1); storing precise lat/lon points in `post_geo_location`; geocoding unstructured author profile location strings; any UI visualization changes (handled in Story 8.10).

---

## Story 2.21 — Active Watchlist Sourcing via Brave Search API: Polling connector, query transformation, and junction linking

**Source:** ADR-0065 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 2.1 (Provider connector framework), Story 1.13 / Story 1.14 (Live polling scheduler), Story 3.11 (Post-watchlist match persistence, `post_watchlist_matches`), Story 3.6 (Boolean AST parser)

**As a** Tenant User or Tenant-Admin,
**I want** the platform to actively query the Brave Search API for my active watchlists, validate matching articles, and ingest them as social posts linked to their respective watchlists,
**so that** my monitored topics are proactively discovered across the web and news index rather than waiting for them to randomly cross generic feeds.

**Acceptance Criteria**
- **Connector Implementation (`braveSearchConnector.ts`):**
  - Implements `SocialConnector` with `providerId: 'brave-search'`, `authMode: 'api_key'`, `deliveryMode: 'poll'`, and `poll(tenantId: string)`.
  - Registered in `connectorRegistry.ts` under `brave-search`.
- **Active Watchlist Querying & Pacing Loop:**
  - `poll(tenantId)` retrieves all active watchlists for the tenant (`listActiveWatchlistsForTenant(tenantId)`).
  - Iterates over active watchlists sequentially with a **1.2-second pacing delay** between requests to strictly respect Brave's 1 req/sec rate limit and avoid HTTP 429 errors.
  - Constructs queries per watchlist match type:
    - `keyword`/`hashtag`/`account`: formats terms into an OR-expression (e.g. `"term1" OR "term2"`).
    - `boolean_query`: passes the AST boolean expression formatted for Brave search syntax.
  - Calls Brave Search endpoint (`/res/v1/news/search` by default, or `/res/v1/web/search`) with the tenant's `X-Subscription-Token` header, lookback `freshness` window, and result pagination.
- **Dual Discovery & Validation Filter:**
  - Discovered search result candidate items (title + snippet/description) are evaluated in-process against the triggering watchlist's exact rules (`matchesWatchlist()` or `matchesAst()`).
  - Only candidate items that strictly satisfy the rule predicate are ingested, ensuring zero false-positive drift between active search and passive ingestion.
- **Publication / Domain as Author (ADR-0004 Generalization):**
  - Maps `Author` from the article's source domain and publication name:
    - `author.id = 'brave-search:' + domain`
    - `author.username = domain` (e.g. `bbc.com`, `techcrunch.com`)
    - `author.displayName = sourceName || domain`
    - `author.platform = 'brave-search'`
- **Canonical Ingestion & Multi-Watchlist Junction Linking:**
  - Normalizes article into `SocialPost` using canonicalized `url` as `externalId` on `(tenant_id, 'brave-search', externalId)` for deduplication.
  - Links successfully ingested post to the triggering watchlist in `post_watchlist_matches` via `insertPostWatchlistMatches()`.
  - Discovered articles immediately become queryable via `GET /v1/posts?watchlistId=<id>` (Story 3.11) and flow into standard AI enrichment.
- **Quota & Error Handling:**
  - Handles HTTP 401/403 by marking connector `failing` (invalid credential).
  - Handles HTTP 429 with backoff and records quota telemetry.
  - Staggers next poll cycle with 1–4 hour default cadence.

**Explicitly out of scope:** Full-text scraping of external web pages; client-side web scraping; admin UI connector setup screen (handled in Story 6.30).

---

## Story 2.22 — Active Watchlist Sourcing via Bing Search API (Azure): Polling connector, candidate evaluation cap, and URL canonicalisation

**Source:** ADR-0066 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 2.1 (Provider connector framework), Story 1.13 / Story 1.14 (Live polling scheduler), Story 3.11 (Post-watchlist match persistence, `post_watchlist_matches`), Story 3.6 (Boolean AST parser)

**As a** Tenant User or Tenant-Admin,
**I want** the platform to actively query the Bing Search API (Azure) for my active watchlists, validate matching news and web articles, and ingest them as social posts linked to their respective watchlists,
**so that** my monitored topics benefit from Azure-aligned enterprise search discovery and index depth.

**Acceptance Criteria**
- **Connector Implementation (`bingSearchConnector.ts`):**
  - Implements `SocialConnector` with `providerId: 'bing-search'`, `authMode: 'api_key'`, `deliveryMode: 'poll'`, and `poll(tenantId: string)`.
  - Registered in `connectorRegistry.ts` under `bing-search`.
- **Active Watchlist Querying & Pacing Loop:**
  - `poll(tenantId)` retrieves all active watchlists for the tenant (`listActiveWatchlistsForTenant(tenantId)`).
  - Iterates over active watchlists sequentially with a per-tenant pacing delay to respect Azure Cognitive Services rate limits and avoid cross-tenant thundering herds.
  - Constructs queries per watchlist match type:
    - `keyword`/`hashtag`/`account`: formats terms into an OR-expression (e.g. `"term1" OR "term2"`).
    - `boolean_query`: passes the AST boolean expression formatted for Bing search syntax.
  - Sets `mkt` and `setLang` based on tenant locale settings (defaulting to `en-US`).
- **Deterministic Auto Endpoint Fallback (`endpoint: 'auto'`):**
  - Calls `/v7.0/news/search` first with `count = 25` and mapped `freshness` (`Day` for lookback $\le$ 48h, `Week` for 3–7d, `Month` for $>$ 7d).
  - If the news search yields **fewer than 5 validated results**, automatically falls back to `/v7.0/search` (Web) in the same tick to broaden candidate discovery.
- **Candidate Evaluation Cap & Dual AST Validation:**
  - Evaluates the top **25–50** candidate items (title + snippet/description) in-process against `matchesWatchlist()` or `matchesAst()`.
  - Only candidates strictly meeting the rule criteria are ingested, guaranteeing 100% precision with passive feeds.
- **Multi-Step URL Canonicalisation & Deduplication:**
  - Unwraps/resolves redirects where available.
  - Strips marketing/tracking parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`, `ref`).
  - Normalizes scheme/host (lowercase, standardizes `www.`) and strips trailing fragments.
  - Deduplicates on `(tenant_id, 'bing-search', externalId)` using canonical URL.
- **Publication / Base Domain as Author (ADR-0004 Generalization):**
  - Maps `Author` from provider and base domain:
    - `author.id = 'bing-search:' + baseDomain`
    - `author.username = baseDomain` (e.g. `bbc.co.uk`, `reuters.com`)
    - `author.displayName = provider[0].name || baseDomain`
    - `author.platform = 'bing-search'`
- **Canonical Ingestion, Multi-Watchlist Junction Linking & Telemetry:**
  - Ingests normalized post into `social_posts` and writes `(post_id, watchlist_id, tenant_id)` to `post_watchlist_matches`.
  - Emits tenant-scoped telemetry metrics: API call counts, query volume, endpoint used, candidate yield, and **estimated Azure cost** scoped by `tenantId`, `platformId='bing-search'`, and `watchlistId`.
  - Staggers next poll cycle with 1–4 hour default cadence.

**Explicitly out of scope:** Full-text scraping of external web pages; admin UI connector setup screen (handled in Story 6.32).

---

## Story 2.23 — Facebook connector: Graph API `from` extraction, hosting Page post dependency, and two-tier author resolution

**Source:** ADR-0067 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 2.15 (Facebook connector), Story 2.18 (Facebook engagement counts), Story 6.27 (Facebook multiple Pages per user)

**As a** core backend engineer / social listening analyst,
**I want** `pollFacebookPage()` and `fetchFacebookPagePosts()` to extract the `from` object from Meta Graph API, record the explicit hosting Facebook Page ID/Name (`rawPayload.pageId`, `rawPayload.pageName`), and resolve post authorship using a two-tier hierarchy (`from.name` true author falling back to `pageName`),
**so that** ingested Facebook posts accurately reflect who wrote the post and clearly link to the hosting Page that published it.

**Acceptance Criteria**
- **Graph API Field Widening (`facebookConnector.ts`):**
  - `fetchFacebookPagePosts()` requests `from{id,name}` in its `fields` query parameter alongside standard post and engagement summary fields.
  - `FacebookPagePost` interface in `facebookConnector.ts` gains optional `from?: { id: string; name: string }`.
- **Hosting Page Post Dependency (`pollFacebook.ts`):**
  - Every ingested post's `rawPayload` is populated unconditionally with `pageId: pageMeta.id` and `pageName: pageMeta.name`, establishing an explicit dependency on the hosting Facebook Page.
- **Two-Tier Author Resolution Hierarchy (`pollFacebook.ts`):**
  - **True Author (`from.name`):** When Graph API returns a distinct author object where `post.from?.id` exists and `post.from.name` is non-empty:
    - Upserts/links `Author` with `authorExternalId = "facebook:" + post.from.id` and `displayName = post.from.name`.
    - Sets `rawPayload.author = post.from.name` and `rawPayload.from = post.from`.
  - **Page Name Fallback:** When `post.from` is absent, or `post.from.id === pageMeta.id` (published directly as the Page):
    - Upserts/links `Author` with `authorExternalId = "facebook:" + pageMeta.id` and `displayName = pageMeta.name`.
    - Sets `rawPayload.author = pageMeta.name`.
- **Deduplication & Event Ingestion:**
  - Preserves deduplication key on `(tenant_id, 'facebook', externalId)`.
  - Emits `publishSocialPostIngestedEvents()` with the resolved `authorExternalId`.
- **Contract Verification:**
  - Jest contract test in `contracts/epic-2/story-2.23.facebook-page-dependency-and-author-resolution.contract.test.ts` asserts:
    - Post with individual `from` object maps `rawPayload.author` to the creator's name and `rawPayload.pageName` to the Page name.
    - Post without `from` or with `from.id === pageMeta.id` falls back cleanly to `rawPayload.author = pageMeta.name` and `rawPayload.pageName = pageMeta.name`.
    - `fetchFacebookPagePosts` correctly parses `from` object when returned by Graph API.

**Explicitly out of scope:** Ingesting personal timeline feeds (`/me/posts`); admin UI post display enhancements (handled in Story 6.33).

---

## Story 2.24 — Instagram Business Connector: Tier-3 OAuth Poller, Single-Row Carousel Normalization, Lookback Pagination, and Error Reclassification

**Source:** ADR-0068 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 2.15 (Facebook connector), Story 2.18 (Engagement counts), Story 2.20 (Country geospatial normalization), Story 6.27 (Multi-asset credential model), Story 1.16 (Watchdog reconciliation & alerts)

**As a** core backend engineer / social listening analyst,
**I want** a dedicated `instagram` ingestion connector in `social-listening-core` that queries the Instagram Graph API (`/{ig-user-id}/media`) for connected Instagram Business and Creator accounts,
**so that** published photos, videos, Reels, and carousels are ingested with single-row carousel modeling, bounded lookback pagination, deterministic error handling, and hosting profile attribution.

**Acceptance Criteria**

- **Instagram Connector Client (`instagramConnector.ts`):**
  - Implements `fetchInstagramMedia(igUserId, accessToken, options)` calling `GET /{ig-user-id}/media`.
  - Requests fields: `id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count,children{id,media_type,media_url,thumbnail_url},location`.
  - Supports cursor-based pagination with `limit = 25` (max 50).
- **Lookback Bounds Precedence & Incremental Halting:**
  - **Initial Ingestion Cap:** On initial account ingestion, paginates until **whichever condition is reached first**:
    1. The oldest fetched item's `timestamp` is older than `(now - 30 days)`, **OR**
    2. Total fetched items reach **100 media items**.
  - **Incremental Short-Circuit:** Periodic scheduler ticks stop pagination immediately upon encountering an item whose `externalId` already exists in `social_posts` for that `(tenantId, 'instagram', igUserId)`.
- **Single-Row Carousel Modeling & Gallery Persistence (`pollInstagram.ts`):**
  - Creates exactly **one `SocialPostSummary` row** in `social_posts` per media item returned by `/media` (`externalId: instagram_{igUserId}_{mediaId}`).
  - For `media_type === 'CAROUSEL_ALBUM'`, stores child media objects in `rawPayload.children` in the **exact original display order** returned by Meta Graph API, capped at 10 items (setting `rawPayload.childrenTruncated = true` if exceeding 10).
- **Media Previews & URL Stability:**
  - `permalink` is stored as the immutable canonical post URL (`SocialPost.url`).
  - `media_url` and `thumbnail_url` are stored in `rawPayload` as best-effort preview URLs.
  - Published Reels (`media_type === 'VIDEO'`) are ingested; ephemeral 24h Stories are excluded.
- **Caption Fallback & Author Normalization:**
  - `caption` is converted to canonical markdown. If empty, falls back deterministically to `[Instagram Photo]`, `[Instagram Video]`, or `[Instagram Carousel]`.
  - Author mapped as `author.id = "instagram:" + igUserId`, `author.displayName = username`, `author.username = username`.
  - Unconditionally stores `rawPayload.igUserId`, `rawPayload.username`, and parent `rawPayload.pageName`.
- **Geospatial Normalization (ADR-0064):**
  - If `location.country` is present, extracts uppercase ISO 3166-1 alpha-2 code (`geoCountry`), setting `geoSource: 'post'`, `geoConfidence: 'high'`. Discards raw coordinates. Defaults to `geoCountry = null`.
- **Pacing & Rate Limiting:**
  - Sequential polling across configured Instagram accounts within a user tick with 1.2s inter-account jitter.
  - Honors `Retry-After` headers on HTTP 429/Error 4/17 with exponential backoff.
- **Deterministic Error Reclassification & Alerts (ADR-0070):**
  - Reclassifies Graph API errors `190` (expired/invalid token), `10` (permission revoked), and `100` (account unlinked) into `http_401` / `reconnect_required`.
  - Marks account status in `instagram_connected_accounts` as requiring reconnect and emits `ConnectorIngestionAlertEvent` (`alertType: 'reconnect_required'`).
- **Contract Verification:**
  - Jest contract test in `contracts/epic-2/story-2.24.instagram-connector.contract.test.ts` asserts:
    - Standard photo, video/Reel, and carousel media mapping.
    - Carousel single-row creation with ordered `rawPayload.children` (and truncation flag if >10).
    - 30-day / 100-item pagination precedence and newest-first halting.
    - Graph API errors `190`/`10`/`100` reclassified to `reconnect_required` with alert emission.

**Explicitly out of scope:** Personal Instagram timeline scraping (prohibited); ephemeral Stories ingestion; admin UI setup screens (handled in Story 6.34).

---

## Story 2.25 — LinkedIn Connector: Confidential Client OAuth, Token Lifecycle with Persisted Expiry, Rest.li Rate Limiting, and 1-Hour Poller Guardrails

**Source:** ADR-0069 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 2.1 (Unified connector interface), Story 2.2 (Rate limiting request gate), Story 1.16 / ADR-0070 (Watchdog reconciliation & alerts)

**As a** core backend engineer / social listening analyst,
**I want** a dedicated `linkedin` ingestion connector in `social-listening-core` implementing OAuth 2.0 confidential client flow, 60-day access token refresh with persisted `refreshTokenExpiresAt`, Rest.li rate-limit header parsing, scheduler-level 1-hour polling guardrails, and graceful scope degradation,
**so that** our platform securely ingests LinkedIn posts and engagement while strictly adhering to LinkedIn Marketing API constraints and GDPR data retention policies.

**Acceptance Criteria**

- **LinkedIn Connector Client (`linkedinConnector.ts`):**
  - Implements `SocialConnector` for `providerId = 'linkedin'` with `authMode: 'oauth'`, `deliveryMode: 'poll'`.
  - Generates authorize URL with cryptographically secure, tenant-scoped `state` parameter cached server-side (TTL 10m).
  - Validates `state` and exchanges authorization code for tokens using confidential client credentials (`client_id` + `client_secret`).
  - Persists credential in Azure Key Vault via envelope encryption (ADR-0014) with explicit `refreshTokenExpiresAt` (now + 365 days).
- **Token Refresh & Lifecycle Management (`refreshToken()`):**
  - Invoked automatically before returning a 401 error.
  - Updates `access_token` (60-day expiry). If a new `refresh_token` is present in the response, updates `refreshTokenExpiresAt` to `now + 365 days`; if omitted, retains existing refresh token and expiry.
  - Surfaces `credentialStatus: 'expiring_soon'` when access token is within 7 days of expiry or refresh token is within 30 days of `refreshTokenExpiresAt`.
  - On `invalid_grant` failure: evaluates `now > refreshTokenExpiresAt` to set `credentialStatus = 'expired'` (if expired) or `credentialStatus = 'revoked'` (if revoked/password changed), transitioning connector to `reconnect_required`.
- **Rest.li Rate-Limit Header Extraction (`parseRateLimitHeaders()`):**
  - Defensively parses `x-restli-gateway-ratelimit-remaining`, `x-restli-gateway-ratelimit-reset` (converting epoch seconds to milliseconds), and `x-restli-gateway-ratelimit-limit` (with fallbacks to standard `x-ratelimit-*`).
  - Dynamic live header state overrides the baseline 100 requests/day config; queued runs create an `IngestionRun` audit record.
- **Scheduler-Enforced Polling Guardrails:**
  - The Tier-3 poll scheduler strictly rejects any configured polling interval < 3600 seconds (1 hour) unless `linkedin.org.enabled === true` AND partner tier is verified.
- **Graceful Scope Degradation:**
  - Supports member scopes (`openid`, `profile`, `email`, `w_member_social`, `r_member_social`).
  - If organization scopes (`w_organization_social`, `r_organization_social`) are missing or partner approval is pending, continues member post polling without failing the connector.
- **Best-Effort Idempotent Revocation & Disconnect:**
  - `disconnect()` calls `https://www.linkedin.com/oauth/v2/revoke` passing the refresh token (fallback: access token).
  - Logs non-200 responses at `WARN` level without blocking credential erasure or tenant-scoped data purging (ADR-0018).
- **Data Normalization (`normalize()`):**
  - Maps post to `SocialPost` and author to `Author` (`author.id = "linkedin:" + memberId`, `author.displayName = firstName + ' ' + lastName`).
  - Discards raw JSON response payloads from permanent storage (ADR-0018).
- **Contract Verification:**
  - Jest contract test in `contracts/epic-2/story-2.25.linkedin-connector.contract.test.ts` asserts:
    - Confidential client code exchange and `refreshTokenExpiresAt` initialization.
    - Refresh token retention logic and `invalid_grant` reason classification.
    - Rest.li header parsing with epoch seconds to ms conversion.
    - Scheduler rejection of <3600s interval without partner flag.
    - Best-effort disconnect with non-blocking revoke failure handling.

**Explicitly out of scope:** Public client PKCE flow; admin UI connection management screens (handled in Story 6.35).

---

## Story 2.26 — Connector Reply Framework and Outbound Rate Gate

**Source:** ADR-0073 (Accepted 2026-08-22) · **Status:** Ready
**Built:** 2026-08-23 — social-listening-core@e3df7d9

**As a** core backend engineer,
**I want** an optional `reply?()` method on `SocialConnector` and an outbound execution path,
**so that** connectors can implement reply behavior without forcing every existing connector to support it.

**Acceptance Criteria**

1. `SocialConnector` interface gains an optional method:

   ```ts
   reply?(
     post: SocialPostSummary,
     body: string,
     credential: Credential
   ): Promise<{ externalId: string; externalUrl: string }>
   ```

2. A new `outboundEngagementService` (or equivalent) in `social-listening-core` invokes the optional `reply()`, catches `ClassifiableError`, and maps results to the `outbound_activities` row shape. Connectors without `reply()` immediately fail with code `reply_not_supported`.

3. The existing `errorClassification.ts` gains reply-specific codes (`missing_permission`, `post_not_found`, `reconnect_required`, `rate_limited`) without changing ingest error handling.

4. The `RequestGate` is extended (or a sibling `outboundGate` is added) to track `outbound` calls separately per `(tenantId, providerId)`. Connectors may optionally expose `getOutboundRateLimitConfig?()`; if absent, `getRateLimitConfig()` is reused for the outbound gate as a conservative fallback.

5. Jest contract test uses a stub `SocialConnector` that implements `reply()` returning a mock `externalId`/`externalUrl`, and a second stub without `reply()` to assert `reply_not_supported`.

**Explicitly out of scope:** Facebook/Instagram/LinkedIn-specific reply logic; admin UI; `GET /v1/posts/:id/replies` (Story 3.14).

---

## Story 2.27 — Facebook Page Reply Implementation

**Source:** ADR-0073 (Accepted 2026-08-22) · **Status:** Ready
**Built:** not yet

**As a** Tenant User managing a connected Facebook Page,
**I want** the `facebook` connector to implement `reply()`,
**so that** I can post a comment on an ingested Facebook Page post from within SocialEngage.

**Acceptance Criteria**

1. `facebookConnector.ts` implements `reply()` using the stored long-lived Page access token. Before or during this story, the exact Meta Graph API permission required (likely `pages_manage_engagement`) is primary-source verified and added to the OAuth scope list; `facebook-connector/SKILL.md` and Story 6.23/6.27 UI copy are updated to reflect the final permission.

2. `reply()` calls `POST /{post-id}/comments` with `message` and the Page access token, then maps the response to `externalId` and an `externalUrl` of the form `https://www.facebook.com/{post-id}/?comment_id={externalId}` (or equivalent verified permalink).

3. Meta error codes are reclassified:
   - `190`, `10` → `reconnect_required`
   - Permission-denied / insufficient scope → `missing_permission`
   - `4`, `17`, `32`, `80000` → `rate_limited`
   - Invalid post id / `803` → `post_not_found`

4. Existing Facebook Page credentials that predate the new scope return `missing_permission` cleanly, so the UI can prompt the user to reconnect.

5. `pollFacebook.ts` and ingestion are unaffected; `reply()` is reachable only via the outbound engagement path.

6. Jest contract test verifies the request body, token usage, and successful mapping. If the test Meta App does not hold the write scope, the Graph API call is HTTP-mocked and the test asserts the generated request shape and `externalUrl` construction.

**Explicitly out of scope:** Instagram, LinkedIn, or any other platform reply; replies to public/third-party posts; media or attachment replies; automated scheduled replies.

---

## Story 2.28 — Connector Publish Framework and Outbound Post Rate Gate

**Source:** ADR-0075 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 3.14 (base `outbound_activities` table)

**As a** core backend engineer,
**I want** an optional `publish?()` method on `SocialConnector` and a dedicated outbound post execution path,
**so that** connectors can implement real post publishing without forcing every existing connector to support it.

**Acceptance Criteria**

1. `SocialConnector` interface gains an optional method:

   ```ts
   publish?(
     tenantId: string,
     userId: string,
     payload: OutboundPostPayload,
     credential: Credential
   ): Promise<{ externalId: string; externalUrl: string }>
   ```

   where `OutboundPostPayload` contains `text`, `perPlatformOverrides`, `media`, `linkPreview`, `targetAssetId`, and `targetAssetType`.

2. A new `outboundPublishService` (or an extension of `outboundEngagementService`) invokes the optional `publish()`, catches `ClassifiableError`, and maps results to the `outbound_activities` row shape. Connectors without `publish()` immediately fail with code `publish_not_supported`.

3. `errorClassification.ts` gains post-specific codes (`missing_permission`, `target_asset_not_found`, `reconnect_required`, `rate_limited`, `media_not_supported`) without changing ingest/reply error handling.

4. The `RequestGate` is extended (or a sibling `outboundPostGate` is added) to track `outbound_post` calls separately per `(tenantId, providerId)`. Connectors may optionally expose `getOutboundRateLimitConfig?()`; if absent, `getRateLimitConfig()` is reused for the post gate as a conservative fallback.

5. Jest contract test uses a stub `SocialConnector` that implements `publish()` returning a mock `externalId`/`externalUrl`, and a second stub without `publish()` to assert `publish_not_supported`.

**Explicitly out of scope:** Facebook/Instagram/LinkedIn-specific publish logic; admin UI; `GET /v1/outbound/posts`; `POST /v1/outbound/posts` endpoint (Story 3.15); scheduled dispatch processing; image/video media upload.

---

## Story 2.29 — Facebook Page Post Publishing

**Source:** ADR-0075 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 2.28 (connector publish framework), Story 6.23/6.27 (Facebook Page credential and enumeration)

**As a** Tenant User managing a connected Facebook Page,
**I want** the `facebook` connector to implement `publish()`,
**so that** I can publish a new post to one of my connected Facebook Pages from within SocialEngage.

**Acceptance Criteria**

1. `facebookConnector.ts` implements `publish()`. Before or during this story, the exact Meta Graph API permission required for Page feed publishing (likely `pages_manage_posts`) is primary-source verified and added to the OAuth scope list; `facebook-connector/SKILL.md` and Story 6.23/6.27 UI copy are updated to reflect the final permission.
2. `publish()` resolves the Page access token from the stored credential, calls `POST /{page-id}/feed` with `message`, and maps the returned post id to `externalId` and an `externalUrl` of the form `https://www.facebook.com/{page-id}/posts/{externalId}` (or equivalent verified permalink).
3. Meta error codes are reclassified:
   - `190`, `10` → `reconnect_required`
   - Permission-denied / insufficient scope → `missing_permission`
   - `4`, `17`, `32`, `80000` → `rate_limited`
   - Invalid page id / `803` → `target_asset_not_found`
4. Existing Facebook Page credentials that predate the new scope return `missing_permission` cleanly, so the UI can prompt the user to reconnect.
5. `pollFacebook.ts` and ingestion are unaffected; `publish()` is reachable only via the outbound post path.
6. Jest contract test verifies the request body, token usage, and successful mapping. If the test Meta App does not hold the write scope, the Graph API call is HTTP-mocked and the test asserts the generated request shape and `externalUrl` construction.

**Explicitly out of scope:** Instagram or any other platform publish; publishing to third-party Pages; media or attachment posts; scheduled posts; editing or deleting a published post.

---

## Story 2.30 — LinkedIn Post Publishing

**Source:** ADR-0075 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 2.28 (connector publish framework), Story 2.25 (LinkedIn connector and token lifecycle)

**As a** Tenant User with a connected LinkedIn profile or organization,
**I want** the `linkedin` connector to implement `publish()`,
**so that** I can publish a new post to my own LinkedIn profile or organization from within SocialEngage.

**Acceptance Criteria**

1. `linkedinConnector.ts` implements `publish()`. Before or during this story, the exact LinkedIn UGC Posts API and required scopes (`w_member_social` and/or `w_organization_social`) are primary-source verified; the existing scope-degradation logic is updated if the new scopes are not already requested.
2. `publish()` calls `POST /v2/ugcPosts` (or the successor primary-source-verified endpoint) with the `target_asset_id` as the author URN and the outgoing `text` as commentary. It maps the returned `id` to `externalId` and to an `externalUrl` of the form `https://www.linkedin.com/feed/update/urn:li:share:{externalId}` (or equivalent verified permalink).
3. LinkedIn/Rest.li error codes are reclassified:
   - token/permission failures → `reconnect_required` or `missing_permission`
   - `403` quota/rate limit → `rate_limited`
   - invalid author URN → `target_asset_not_found`
4. Existing LinkedIn credentials that predate the required scope return `missing_permission` cleanly, so the UI can prompt the user to reconnect.
5. `pollLinkedIn.ts` and ingestion are unaffected; `publish()` is reachable only via the outbound post path.
6. Jest contract test verifies the request body, token usage, and successful mapping. The live Graph API call is HTTP-mocked unless the test LinkedIn App holds the write scope.

**Explicitly out of scope:** Instagram or any other platform publish; publishing to third-party profiles/organizations; media or attachment posts; scheduled posts; editing or deleting a published post; organization share targeting.

---

## Story 2.31 — Brave and Bing one-off research search helpers

**Source:** ADR-0076 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 2.21 (Brave Search active watchlist connector), Story 2.22 (Bing Search active watchlist connector)

**As a** core backend engineer,
**I want** internal one-off search helpers inside the Brave and Bing connectors,
**so that** the composer deep research endpoint can run live web searches without re-implementing polling loops.

**Acceptance Criteria**

1. A new `searchForResearch(query, limit)` function is added inside the Brave Search and Bing Search connector code. It reuses the existing credential retrieval (`getLatestCredentialId`), query builder, and HTTP fetch machinery.

2. It returns an array of search result objects with `title`, `url` (canonicalized), `snippet` (Markdown/normalized), and `provider` (`'brave-search'` or `'bing-search'`).

3. It does not persist posts, touch `post_watchlist_matches`, or emit `SocialPostIngestedEvent`. It is a read-only, ephemeral research helper.

4. It consumes a tenant-scoped `RequestGate` key per `(tenantId, providerId, 'research')`, distinct from the `poll` gate, so research calls do not starve ingestion.

5. It handles the same error classifications as the polling connector (`http_401`, `http_403`, `rate_limited`, `http_5xx`) and maps them to `ClassifiableError` for the research endpoint to surface.

6. Jest contract test asserts the request shape, the URL canonicalization, the `provider` field, and that `social_posts` and `post_watchlist_matches` are not modified.

**Explicitly out of scope:** A generic `SearchProvider` interface; real-time streaming; persistence of search results; media or image search.

---

## Story 2.32 — Azure OpenAI `research?()` capability

**Source:** ADR-0076 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 2.9 (Azure OpenAI as second `AIProviderConnector`)

**As a** core backend engineer,
**I want** an optional `research?()` method on `AIProviderConnector` that Azure OpenAI implements,
**so that** the composer deep research endpoint can extract key phrases and synthesize a context summary.

**Acceptance Criteria**

1. `AIProviderConnector` interface gains an optional method:

   ```ts
   research?(
     text: string,
     searchSnippets: Array<{ title: string; url: string; snippet: string; provider: string }>,
     options: { maxKeyPhrases: number; maxRelatedTopics: number; maxSearchQueries: number }
   ): Promise<{
     keyPhrases: string[];
     relatedTopics: string[];
     searchQueries: string[];
     contextSummary: string;
     comparison: string;
   }>
   ```

2. `azureOpenAiConnector` implements `research()` using a single `chat/completions` structured-output call (JSON schema). The implementation may split the work into two calls in v1 — one for extraction/query generation and one for final synthesis — but the contract test only asserts the final shape.

3. `azureAiLanguageConnector` does not implement `research()` (leaves it undefined), because the task requires generative synthesis.

4. The prompt instructs the model to: (a) extract `keyPhrases` and `relatedTopics` from the input, (b) generate `searchQueries` for the search helpers, and (c) given the search result snippets, produce a `contextSummary` of the public conversation and a `comparison` to the user's original post.

5. The call uses the tenant's own Azure OpenAI credential (endpoint, key, deployment) and is gated by the `isConnectorActive(tenantId, 'azure-openai', 'tenant')` check already in `enrichPost.ts`.

6. Jest contract test asserts the shape and that a tenant without a connected Azure OpenAI credential gets `undefined` from `research()` (same `ClassifiableError` path as `analyze()`).

**Explicitly out of scope:** Streaming research output; multi-turn conversation; other AI providers; media or image analysis.

