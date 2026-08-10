---
name: azure-ai-language-connector
description: The first real AIProviderConnector implementation (Azure AI Language) and enrichPost() — the best-effort per-post enrichment hook wired into GNews's and Newswire's own ingest functions. Read this before touching azureAiLanguageConnector.ts, enrichPost.ts, before adding a second AIProviderConnector (Story 2.9), or before changing what enrichPost() is called with.
---

# Azure AI Language connector — the first real AIProviderConnector

## What this is

`ADR-0002`'s `AIProviderConnector` interface existed since Story 2.1 but had never been implemented against a real provider — every downstream story (4.1, 4.2, 5.1) assumed `SocialPost.enrichment` was populated, but nothing populated it. Story 2.8 closes that gap: `azureAiLanguageConnector.ts` calls the real Azure AI Language `:analyze-text` endpoint (sentiment, key phrases, entities, language detection — one call per capability, per Microsoft's own SDK guidance for a single small document); `enrichPost.ts` is the one shared, best-effort function GNews's and Newswire's own ingest functions both call ahead of `insertSocialPost()`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0038 | Azure AI Language as the first concrete `AIProviderConnector`; a general-purpose LLM named as the deliberate second-provider candidate (Story 2.9, not built here) | 2.8 |
| ADR-0027 | Connector is a technical intermediary only — the tenant holds their own Azure AI Language account/credential, never SocialEngage | 2.8 (verified: no fallback credential exists anywhere in this module) |
| ADR-0014 | Envelope-encrypted credential storage — no new pattern for this provider's two-part (endpoint+key) credential, just a JSON-encoded plaintext | 2.8 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts` — a registered connector with a distinct `providerId`; `analyze()` rejects with no credential, never falling back to a shared key; a real call against the real Azure resource maps into `AnalyzeResult`'s widened shape; `enrichPost()` is called from both `pollGNewsSearch.ts` and `pollNewswireFeeds.ts`, and its result round-trips through `insertSocialPost()` into `SocialPost.enrichment`; two tenants acquire independently via `acquireForAiModel()`; a transient (retryable) failure retries with backoff and eventually succeeds or gives up gracefully; a non-retryable failure (bad credential) gives up immediately; either way, `enrichPost()` never throws.

## How to extend this safely

- **A new connector wanting enrichment**: call `enrichPost(tenantId, text)` right before its own `insertSocialPost()` call, passing the result straight into `insertSocialPost()`'s `enrichment` parameter — the exact pattern `pollGNewsSearch.ts`/`pollNewswireFeeds.ts` both already use. Never call `azureAiLanguageConnector.analyze()` directly from a new connector — `enrichPost()` is the one place credential resolution, gating, and retry/graceful-degradation all live; duplicating that logic per-connector is exactly what this function exists to prevent.
- **Story 2.9's second `AIProviderConnector`** (an LLM-based extractor, per ADR-0038 §2's own named direction): register it alongside `azureAiLanguageConnector`, but `enrichPost()` itself is single-provider today — wiring in a real provider-selection/fallback mechanism between two live `AIProviderConnector`s is Story 2.9's own scope, not assumed or half-built here.
- **A new Azure AI Language capability** (e.g. PII detection, summarization): add another `callAnalyzeText(..., 'NewKind', text)` call to the `Promise.all` in `analyze()`, map its response into a new or existing `AnalyzeResult` field, and update `getModelCapabilities()` accordingly.

## Load-bearing constraints — do not change casually

- **`enrichPost()` never throws — every failure path resolves to `undefined`.** A missing credential, a non-retryable failure, or a retryable failure that exhausts its own 3-attempt budget all degrade to "this post ingests without enrichment," never a failed ingestion (Story 2.8's own AC5/AC6). If you're tempted to let an enrichment failure propagate to `runIngestionAttempt()`, don't — that would make a real Azure outage or rate-limit spike start failing post ingestion project-wide, which enrichment being "additive to the pipeline" explicitly rules out.
- **The tenant's own credential is a JSON string `{endpoint, key}`, not a bare API key like GNews's.** `readCredential()`/`storeCredential()` still only handle a single opaque string per credential row (ADR-0014, no new storage pattern) — this provider just chooses to put two real pieces of information inside that one string. `parseCredential()` is the one place that (de)structures it; don't bypass it.
- **Never add a project-level/shared Azure AI Language key anywhere in this module, as an env var fallback or otherwise.** ADR-0027's "technical intermediary only, no pooling" principle is structurally enforced here by `analyze()` simply throwing when no `credential` is supplied — there is no fallback branch to accidentally add one to.
- **One call per capability (Sentiment, KeyPhrases, Entities, LanguageDetection), not the combined `begin_analyze_actions`-style batch endpoint.** Confirmed directly against Microsoft's own SDK guidance (ADR-0038 Research): the combined endpoint is recommended for larger/batched documents, not this project's actual workload (one post at a time). Four real HTTP calls per `enrichPost()` invocation is deliberate, not an oversight to "optimize" into one call without re-checking that guidance first.
- **`gatedAcquire()` treats one `enrichPost()`/`analyze()` invocation as one unit of rate-limited work**, even though it fans out to 4 real Azure requests internally. `getModelRateLimit()`'s own `requestsPerWindow` (1,000/30 days, a template default) is sized with that fan-out already accounted for — don't gate per-capability-call, only per `analyze()` call.
- **`AZURE_AI_LANGUAGE_ENDPOINT`/`AZURE_AI_LANGUAGE_KEY` in `.env` are a real, dedicated test-fixture credential** (mirroring `GNEWS_API_KEY`'s own established pattern) — used directly by this story's own contract test to prove `analyze()` against the real endpoint. Never a SocialEngage-operated production credential; in production every tenant supplies their own via the ordinary connect flow (Story 1.6/6.3), stored the same way as any other `api_key`-authMode connector's credential.

## Known gaps / deferred work

- **Story 2.9's second `AIProviderConnector` (an LLM-based extractor) is not built here** — ADR-0038 §2's own named, deliberate second step, proving `AIProviderConnector` swappability the same way Reddit is planned to validate the social-connector side. `enrichPost()` today is hardcoded to Azure AI Language only.
- **Azure AI Language's exact S-tier cost beyond the free tier (5,000 shared text records/month) was never verified to this project's own primary-source bar** (ADR-0038's own named, still-open gap) — the 1,000-analyze()-calls/30-day rate-limit default here is a template, not a cost-optimized number.
- **The GDPR-adjacent third-party-data-processing question ADR-0038 §4 names (post content, potentially including public individuals' names/opinions, now genuinely flows to Microsoft) is not resolved here** — named honestly in the ADR, not silently built past.
- **No admin-UI-specific connect flow was built for this provider** — Story 6.3's existing generic `api_key`-authMode connect/disconnect screen already handles it without any connector-specific UI code, since `authMode: 'api_key'` is all that screen keys off. The two-part `{endpoint,key}` credential is entered as a single JSON-string value through that same generic form — a real, slightly awkward UX gap (a tenant must hand-construct the JSON) worth a future dedicated form, not solved here.
