---
name: composer-research
description: POST /v1/composer/research Deep Research orchestration for the Polypost Composer (Story 3.17, ADR-0076). Read before touching the research pipeline, composer router, or how the endpoint calls Azure OpenAI and Brave/Bing search.
---

# Composer Deep Research

## What this is

`POST /v1/composer/research` (Story 3.17, ADR-0076) is the backend endpoint
that powers the Polypost Composer's **Deep Research** button. It is a
synchronous, read-only, tenant-scoped orchestration: extract key phrases and
related topics from a draft post, run one-off web searches through the tenant's
own Brave and/or Bing search providers, and synthesize a public-conversation
context summary and a side-by-side comparison. It does not create or modify
`social_posts`, `post_watchlist_matches`, or any other tenant content.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0076 | Composer Deep Research pipeline, `POST /v1/composer/research`, `AIProviderConnector.research?()`, and Brave/Bing one-off search helpers | 3.17 |
| ADR-0121 | Composer Deep Research caching, re-trigger (?refresh=true), research_runs cost telemetry, and tenant daily/monthly caps | 14.4 |
| ADR-0120 | SearchProviderConnector abstraction and connector registry integration | 14.3 |
| ADR-0048 | `SocialConnector` contract remains unchanged — `searchForResearch()` is an internal helper, not a new `SocialConnector` method | — |
| ADR-0003 | `RequestGate` key per `(tenantId, providerId, 'research')` for AI and search | 3.17 |
| ADR-0030 §2 | `platform_admin` zero-tenant-content boundary — `platform_admin` gets `403` | 5.7 |
| ADR-0032 | `tenant_admin` and `tenant_user` may both call the composer | 5.9 |
| ADR-0028 / ADR-0034 | Tenant-owned credentials for search and AI; no SocialEngage-owned shared service | 1.7 |
| ADR-0038 | Azure OpenAI is the v1 research-capable `AIProviderConnector`; Azure AI Language does not implement `research?()` | 2.9 |

## Files that make this work

- `migrations/0075_create_research_cache_and_runs.sql` — `tenant_settings`, `research_cache`, and `research_runs` tables with RLS and grants.
- `src/composer/composerResearchStore.ts` — persistence helpers for research cache lookup, cache write, runs telemetry, and tenant cap verification.
- `src/composer/composerResearchService.ts` — pure orchestration (extraction, search, synthesis, cache interception, caps, error codes).
- `src/http/versions/v1/composerRouter.ts` — `POST /v1/composer/research` route handler passing `refresh` flag and caller `userId`.
- `src/http/versions/v1/router.ts` — mounts `composerRouter` under `/v1/composer`.
- `src/connectors/azureOpenAi/azureOpenAiConnector.ts` — `research?()` generative call (Story 2.32).
- `src/connectors/braveSearch/braveSearchConnector.ts` — `searchForResearch()` helper (Story 2.31).
- `src/connectors/bingSearch/bingSearchConnector.ts` — `searchForResearch()` helper (Story 2.31).
- `src/connectors/connectorActivationStore.ts` — `isConnectorActive()` used to discover active AI and search providers.
- `src/connectors/requestGate.ts` — `acquireForAiModel()` with the `research` model key.
- `contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts`.
- `contracts/epic-14/story-14.4.composer-deep-research-caching.contract.test.ts`.

## Relations to other components

*(Documentation Steward addition, 2026-08-26, per `docs/implementation-methodology.md`'s 2026-08-13 relationship-assertion convention — the underlying facts already existed above under "Files that make this work"; this section restates them under the standard, greppable heading.)*

- Calls `azureOpenAiConnector.research?()` at the real production call site (this endpoint, `POST /v1/composer/research`) — relationship asserted by `story-3.17.composer-deep-research.contract.test.ts`.
- Calls `braveSearchConnector`'s and `bingSearchConnector`'s `searchForResearch()` at the same real call site — relationship asserted by the same contract.
- Calls `isConnectorActive()` (`connector-activation`) to discover which AI/search providers the tenant has connected, and `acquireForAiModel()` (`provider-connector-framework`'s `requestGate.ts`) under the `research` model key.
- Queries and persists `research_cache` and `research_runs` via `withTenant()` with RLS protection — asserted by `story-14.4.composer-deep-research-caching.contract.test.ts`.

## Contracts that constrain this component

- `contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts` — valid request returns the `ComposerResearchResult` shape; missing/incapable AI provider returns `422 AI_PROVIDER_NOT_CAPABLE`; missing search provider returns `422 SEARCH_PROVIDER_UNAVAILABLE`; `platform_admin` gets `403`; `maxSearchResultsPerQuery` > 10 returns `422 RESEARCH_TOO_LARGE`; no `social_posts` or `post_watchlist_matches` are created.
- `contracts/epic-14/story-14.4.composer-deep-research-caching.contract.test.ts` — verifies cache hit returns cached result with 0 LLM calls; `?refresh=true` re-runs pipeline and updates cache; `research_runs` records telemetry; daily cap (429) and monthly cap (422) enforcement; RLS isolation across tenants.
- `contracts/epic-2/story-2.32.azure-openai-research-capability.contract.test.ts` — `AIProviderConnector.research?()` exists on Azure OpenAI and returns the `ResearchResult` shape; Azure AI Language does not implement it.

## Load-bearing constraints — do not change casually

- The pipeline is read-only regarding core social data: no `social_posts` inserts, no `post_watchlist_matches` writes. Caching and telemetry are isolated to `research_cache` and `research_runs`.
- AI and search discovery must happen before any provider call that consumes quota. If no capable AI provider is active, return `422 AI_PROVIDER_NOT_CAPABLE` before Azure OpenAI is called. If no Brave/Bing search provider is active, return `422 SEARCH_PROVIDER_UNAVAILABLE` before the extraction stage issues a paid AI call.
- Daily request cap and monthly cost cap checks must be performed before any provider call. Exceeding daily cap returns `429 RESEARCH_DAILY_CAP_EXCEEDED`. Exceeding monthly cap returns `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED`.
- Cache key `text_hash` is computed as `sha256(tenantId + ':' + normalizedText + ':' + aiProviderId + ':' + searchProviderIds.sort().join(','))`. Normalization lowercases and strips surrounding whitespace.
- `?refresh=true` forces a live pipeline execution and overwrites the existing row in `research_cache` (`ON CONFLICT (tenant_id, text_hash) DO UPDATE`).
- Cache expiry defaults to 24 hours (`tenant_settings.research_cache_ttl_hours`, max 168h). Expired rows are ignored on lookup.
- Every research attempt records a row in `research_runs` with `cache_hit`, `tokens_in`, `tokens_out`, and `estimated_cost_usd`. Telemetry logging errors must not fail the request.
- The route is behind `requireTenantUserIdentity()`; `platform_admin` is rejected at the middleware layer before the service is called.

## How to extend this safely

- Adding another research-capable AI provider: implement `research?()` on a new `AIProviderConnector`, then update `loadAiCredential()` to iterate a provider list instead of hard-coding `azureOpenAiConnector`. Keep `Azure AI Language` unimplemented.
- Adding a generic `SearchProvider` interface: already implemented via `SearchProviderConnector` (ADR-0120, Story 14.3).
- Adding `research_reasoning_effort` or other synthesis tuning: resolve it through ADR-0076's resolved-question process (tenant-scoped setting with `low`/`medium`/`high`, default `medium`) and pass it through `ResearchOptions`.
