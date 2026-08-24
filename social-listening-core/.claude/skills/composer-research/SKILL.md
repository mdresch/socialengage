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
| ADR-0048 | `SocialConnector` contract remains unchanged — `searchForResearch()` is an internal helper, not a new `SocialConnector` method | — |
| ADR-0003 | `RequestGate` key per `(tenantId, providerId, 'research')` for AI and search | 3.17 |
| ADR-0030 §2 | `platform_admin` zero-tenant-content boundary — `platform_admin` gets `403` | 5.7 |
| ADR-0032 | `tenant_admin` and `tenant_user` may both call the composer | 5.9 |
| ADR-0028 / ADR-0034 | Tenant-owned credentials for search and AI; no SocialEngage-owned shared service | 1.7 |
| ADR-0038 | Azure OpenAI is the v1 research-capable `AIProviderConnector`; Azure AI Language does not implement `research?()` | 2.9 |

## Files that make this work

- `src/composer/composerResearchService.ts` — pure orchestration (extraction, search, synthesis, caps, error codes).
- `src/http/versions/v1/composerRouter.ts` — `POST /v1/composer/research` route handler.
- `src/http/versions/v1/router.ts` — mounts `composerRouter` under `/v1/composer`.
- `src/connectors/azureOpenAi/azureOpenAiConnector.ts` — `research?()` generative call (Story 2.32).
- `src/connectors/braveSearch/braveSearchConnector.ts` — `searchForResearch()` helper (Story 2.31).
- `src/connectors/bingSearch/bingSearchConnector.ts` — `searchForResearch()` helper (Story 2.31).
- `src/connectors/connectorActivationStore.ts` — `isConnectorActive()` used to discover active AI and search providers.
- `src/connectors/requestGate.ts` — `acquireForAiModel()` with the `research` model key.
- `contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts`.

## Contracts that constrain this component

- `contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts` — valid request returns the `ComposerResearchResult` shape; missing/incapable AI provider returns `422 AI_PROVIDER_NOT_CAPABLE`; missing search provider returns `422 SEARCH_PROVIDER_UNAVAILABLE`; `platform_admin` gets `403`; `maxSearchResultsPerQuery` > 10 returns `422 RESEARCH_TOO_LARGE`; no `social_posts` or `post_watchlist_matches` are created.
- `contracts/epic-2/story-2.32.azure-openai-research-capability.contract.test.ts` — `AIProviderConnector.research?()` exists on Azure OpenAI and returns the `ResearchResult` shape; Azure AI Language does not implement it.

## Load-bearing constraints — do not change casually

- The pipeline is read-only: no persistence, no `social_posts` inserts, no `post_watchlist_matches` writes.
- AI and search discovery must happen before any provider call that consumes quota. If no capable AI provider is active, return `422 AI_PROVIDER_NOT_CAPABLE` before Azure OpenAI is called. If no Brave/Bing search provider is active, return `422 SEARCH_PROVIDER_UNAVAILABLE` before the extraction stage issues a paid AI call.
- The Azure OpenAI `research?()` method is called twice: once for extraction/key-phrase generation (with an empty `searchSnippets` array) and once for synthesis (with the collected Brave/Bing snippets).
- `maxSearchResultsPerQuery` default is `5`, hard cap is `10`. Exceeding `10` returns `422 RESEARCH_TOO_LARGE`.
- AI output caps are `maxKeyPhrases: 10`, `maxSearchQueries: 5`; the endpoint truncates the returned arrays to these lengths.
- `RequestGate` uses the `research` key: `acquireForAiModel(tenantId, azureOpenAiConnector, 'research')`. Brave and Bing `searchForResearch()` already acquire their own `research` keys.
- Provider errors from a single search provider (e.g., `rate_limited`, `http_401`) are caught per query/provider; if at least one other search provider returns snippets, the pipeline continues. If all providers fail, the last error is surfaced.
- The route is behind `requireTenantUserIdentity()`; `platform_admin` is rejected at the middleware layer before the service is called.

## How to extend this safely

- Adding another research-capable AI provider: implement `research?()` on a new `AIProviderConnector`, then update `loadAiCredential()` to iterate a provider list instead of hard-coding `azureOpenAiConnector`. Keep `Azure AI Language` unimplemented.
- Adding a generic `SearchProvider` interface: defer to ADR-0120; do not add a `SocialConnector.search?()` method without an ADR.
- Adding `research_reasoning_effort` or other synthesis tuning: resolve it through ADR-0076's resolved-question process (tenant-scoped setting with `low`/`medium`/`high`, default `medium`) and pass it through `ResearchOptions`.
- Caching or background research: explicitly out of scope for v1 (ADR-0121).
