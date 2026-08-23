# ADR-0076: Composer Deep Research Agent — Context Summary from Post Text, Key Phrases, and Search Results

**Status:** Accepted (2026-08-23)

**Accepted by Menno 2026-08-23.** Authorizes a new on-demand "Deep Research" capability inside the Polypost Composer that reads the post the user is drafting, extracts key phrases and topics, runs one-off search queries through the tenant's connected Brave/Bing search providers, and returns a concise context summary the author can compare against their own message.

**Source:** Menno request (2026-08-22): *"in the composer page have a deep research AI Agent review the post message and underneath have the deep research findings summarized for the end user to compare to their own post. The deep research agent should pull the details from the post message in the composer and perform some key phrasses found in the message and do search queiries on similarity and related topics and the topics that are described in the posts. The outcome from the search agents should be used by the deep research agent to search for relevant context in the final summary for the end users."*

---

## Context

### 1. The Polypost Composer already drafts multi-platform posts
ADR-0072 (Accepted) gives `social-listening-admin` a `/tenant/compose` page where a user authors one message, sees live previews for seven target networks, and can call an Azure OpenAI-backed copy assistant (`/api/composer/ai-assist`). That assistant is a local, admin-side rewrite helper — it does not use `social-listening-core` or the tenant's own connectors.

### 2. The project already has real search and AI providers in `social-listening-core`
- **Brave Search API** (ADR-0065, Story 2.21) and **Bing Search API** (ADR-0066, Story 2.22) are active watchlist-sourcing connectors that query public web/news search APIs.
- **Azure AI Language** (ADR-0038, Story 2.8) and **Azure OpenAI** (ADR-0038, Story 2.9) are `AIProviderConnector` implementations that enrich ingested posts.
- These are all tenant-credential-gated (ADR-0028, ADR-0034) and RLS-scoped (ADR-0015).

### 3. The requested feature is a multi-step "research" operation, not a rewrite
The user wants the composer to surface *context*, not to edit the post. This is closer to an intelligence / research step than to the existing `ai-assist` copy modes. It therefore should not live in the admin-local `ai-assist` route; it should consume the tenant's real search and AI providers through `social-listening-core`, so the cost and data ownership stay with the tenant.

---

## Decision

### 1. New `POST /v1/composer/research` endpoint in `social-listening-core`
A new tenant-scoped, `app_user` / RLS-gated endpoint accepts the current post draft and orchestrates the research pipeline in `social-listening-core`.

**Request body**
```ts
{
  text: string;                    // the draft post message
  targetPlatforms?: string[];      // optional list of intended platforms
  maxSearchResultsPerQuery?: number; // default 5, hard cap 10
}
```

**Response body** (HTTP 200)
```ts
{
  keyPhrases: string[];
  relatedTopics: string[];
  searchQueries: string[];
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    provider: 'brave-search' | 'bing-search';
  }>;
  contextSummary: string;
  comparison: string;
}
```

- `contextSummary` — a few paragraphs of what the current public/web conversation says about the extracted topics.
- `comparison` — a concise comparison of the user's own post to that context (e.g., angles covered, angles missing, tone differences, factual claims to verify).

### 2. Multi-step orchestration inside `social-listening-core`
The endpoint runs a fixed, short pipeline:

1. **Key-phrase/topic extraction:** call the tenant's active `AIProviderConnector` (currently Azure OpenAI only — Azure AI Language cannot perform this generative extraction) to produce `keyPhrases` and `relatedTopics` from `text`.
2. **Search query generation:** the same or a second LLM call turns the key phrases into a small set of search queries (`searchQueries`), or the extraction call also emits candidate queries in one structured response.
3. **One-off search dispatch:** for each query, the endpoint calls the tenant's connected Brave and/or Bing search providers using the same credentials and query builders the polling connectors already use. It collects the top `maxSearchResultsPerQuery` snippets.
4. **Synthesis:** the LLM receives the original post text, the key phrases, the related topics, and the search result snippets, and produces `contextSummary` and `comparison`.

**v1 is synchronous.** The endpoint completes within one HTTP request. A 413/422 `RESEARCH_TOO_LARGE` is returned if the text, query count, or result set exceeds configured caps.

### 3. Reuse tenant credentials, never a SocialEngage-owned shared service
- **Search:** Uses the tenant's own `brave-search` and/or `bing-search` credentials from `platform_credentials` (ADR-0028, ADR-0034). If neither is connected and active, the endpoint returns `422 SEARCH_PROVIDER_UNAVAILABLE` and the UI disables the Deep Research button with a tooltip.
- **AI:** Uses the tenant's own Azure OpenAI `AIProviderConnector` (or a future second LLM provider) through the same `enrichPost`/`AIProviderConnector` machinery. Azure AI Language is not a viable provider for this task; if it is the only active AI provider, the endpoint returns `422 AI_PROVIDER_NOT_CAPABLE`.

This keeps the project consistent with ADR-0027 (no intermediation, tenant pays the providers directly).

### 4. New `research?()` capability on `AIProviderConnector` (optional method)
The `AIProviderConnector` interface gains an optional `research?(text: string, searchSnippets: SearchSnippet[], options: ResearchOptions): Promise<ResearchResult>` method. Only Azure OpenAI implements it in v1. Azure AI Language is intentionally left unimplemented.

This mirrors the existing `reply?()` and `publish?()` pattern on `SocialConnector` (ADR-0073, ADR-0075): the interface is extended, not duplicated.

### 5. One-off search helpers on the Brave/Bing connectors (internal, not a new `SocialConnector` method)
Instead of adding a generic `search()` to the `SocialConnector` contract, v1 introduces an internal `searchForResearch(query, limit)` helper in each search connector's own code. It uses the existing credential store, query builder, and rate-limit gate. This limits blast radius and keeps ADR-0048's no-core-pipeline-change discipline: the `SocialConnector` interface and `bootstrapConnectors.ts` are unchanged.

**Open Question 2 (below) asks whether a future ADR should generalize this into a shared `SearchProvider` interface or expose `search?()` on `SocialConnector`.**

### 6. `RequestGate` key for research
Deep research consumes a separate `RequestGate` key per `(tenantId, providerId, 'research')`, distinct from ingestion polls (ADR-0003), replies (ADR-0073), and outbound posts (ADR-0075). This isolates research bursts from production social listening.

### 7. UI integration in `social-listening-admin`
- A new **"Deep Research"** button in the `PolypostComposer` toolbar.
- A new collapsible `DeepResearchPanel` below the editor that appears once the user requests research.
- The panel shows `keyPhrases`, `relatedTopics`, `contextSummary`, `comparison`, and an expandable list of `sources` with direct links.
- The admin UI calls `POST /v1/composer/research` through a same-origin proxy route (`/api/composer/research`) that attaches the session and forwards to `social-listening-core`, matching the pattern used by other admin-core calls.
- The UI does not implement a client-side `useApp()` context or mock/fallback data for research results.

### 8. Tenant scoping and role gating
- The endpoint is available to any resolved `tenant_admin` or `tenant_user` identity (ADR-0032) — the same audience as the composer.
- `platform_admin` identity is rejected (403), preserving the zero-tenant-content boundary (ADR-0030 §2).

### 9. Boundaries and caps for v1
- Synchronous only; no background job, no `scheduled_for`.
- Max 5 key phrases and 3 generated search queries per research call (default), capped at 10 key phrases / 5 queries.
- Max 10 search results per query, default 5.
- Search result snippets only; no full-page fetch, no content extraction beyond what Brave/Bing return.
- No image/video analysis: the `text` field is the only input. Media attachments on the draft are ignored by v1.
- No persistence: research results are ephemeral and returned in the response. A future ADR can decide caching/audit storage.

---

## Consequences

### Positive

- Gives the composer a genuinely useful intelligence layer before the user publishes.
- Reuses already-accepted infrastructure: tenant credentials, RLS, `AIProviderConnector`, Brave/Bing search, `RequestGate`.
- Keeps research costs in the tenant's own provider accounts, consistent with ADR-0027.
- Provides citations (`sources`) so the user can verify the summary.

### Negative

- Synchronous, multi-call pipeline (extraction + search + synthesis) is inherently slower and more expensive than a single LLM call.
- LLM reasoning cost for a research pass may exceed a single `enrichPost()` call. This is acceptable because the user explicitly triggers it.
- Research results can be stale immediately; no refresh mechanism in v1.
- Requires Azure OpenAI to be connected and active for the feature to work at all.

### Risk / Note

- The existing `ai-assist` route in `social-listening-admin` is admin-local and uses a shared `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_KEY` env-based credential. **This ADR deliberately does not follow that pattern for research.** Deep research requires tenant-scoped search and AI because it consumes paid provider quota and must be bound to the tenant's own connectors. If Menno prefers a shared AI fallback for research, that is an explicit scope/cost decision, not a default.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Implement the research entirely inside `social-listening-admin`'s `ai-assist` route using the existing admin-local Azure OpenAI and no `social-listening-core` search** | Rejected. The existing `ai-assist` route has no access to the tenant's Brave/Bing credentials and would have to bypass `social-listening-core`'s credential/RLS model. A copy-rewrite and a research tool are also different concerns. |
| **Add a generic `SocialConnector.search?()` method** | Rejected for v1. The active watchlist sourcing connectors are not yet proven as general one-off search providers. v1 uses internal helper functions to avoid a core-pipeline interface change. A future ADR can generalize if the pattern repeats. |
| **Use Azure AI Language for key-phrase extraction and summary** | Rejected. Azure AI Language is a per-sentence NER/sentiment/classification service; it cannot synthesize multi-source context or write a comparative summary. The feature needs a generative LLM. |
| **Persist research results to `social_posts` or a `research` table** | Rejected for v1. v1 is an ephemeral composer aid. Persistence is a separate architectural decision. |

---

## Open Questions

1. **Exact endpoint path:** `POST /v1/composer/research` vs. `POST /v1/posts/research` vs. `POST /v1/outbound/research`. Decide at implementation time. The proposal leans toward `/v1/composer/research` because the consumer is the composer and the operation is not a published post.
2. **Generalize search to a shared `SearchProvider` interface?** If other features later want one-off search, a future ADR should extract `searchForResearch` into a first-class `SearchProviderConnector` abstraction rather than re-implementing it per connector.
3. **Azure OpenAI `reasoning_effort` setting:** Research may benefit from a higher reasoning effort than `enrichPost()`; whether to make this a tenant setting or a fixed default is left for the implementation contract.
4. **Citation rendering in the UI:** Whether sources are shown as a simple list, expandable cards, or linked inline within the `contextSummary` is a UI/UX decision, not an architectural one.
5. **Caching and re-trigger:** Should repeated research for the same text be cached per tenant? v1 says no; a later ADR can decide if costs justify it.

## Resolved Questions

Resolved 2026-08-23:

1. **Exact endpoint path:** `POST /v1/composer/research`. The `PolypostComposer` calls it through a same-origin proxy at `/api/composer/research`.
2. **Generalize search to a shared `SearchProvider` interface?** Defer to ADR-0120 *SearchProviderConnector*, which designs the shared one-off search abstraction for Brave, Bing, and future providers.
3. **Azure OpenAI `reasoning_effort` setting:** Make it a tenant-scoped setting `tenant_settings.research_reasoning_effort` with values `low` | `medium` | `high` and default `medium`. The composer UI shows it as an advanced option when Azure OpenAI is active.
4. **Citation rendering in the UI:** Use expandable cards (`<details>`/accordion-style `SourceCard`s) for `sources` in `DeepResearchPanel`. Each card shows title, provider, and a snippet; the full URL is a link. Inline citations inside `contextSummary` are deferred.
5. **Caching and re-trigger:** Defer to ADR-0121 *Composer Deep Research Caching, Re-Trigger, and Cost Justification*.

---

## User Stories

This ADR directly sources the following implementation stories, all blocked on its acceptance:

- **Story 2.31 — Brave and Bing one-off research search helpers** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`): the connector-internal `searchForResearch()` helpers and `RequestGate` `research` key.
- **Story 2.32 — Azure OpenAI `research?()` capability** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`): the optional `AIProviderConnector.research?()` method and Azure OpenAI implementation.
- **Story 3.17 — Composer deep research REST endpoint** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`): `POST /v1/composer/research` orchestration, caps, and error codes.
- **Story 6.41 — Composer Deep Research panel UI** (`docs/user-stories/epic-6-tenant-admin-ui.md`): the "Deep Research" button, `DeepResearchPanel`, and `POST /api/composer/research` proxy.

## Related Documents

- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0065: Active Watchlist Sourcing via Brave Search API
- ADR-0066: Active Watchlist Sourcing via Bing Search API
- ADR-0038: AI Enrichment Provider Selection
- ADR-0027: Connector is a Technical Intermediary, Not a Contracting Party
- ADR-0028: Credential Creation Authority by Ownership Tier
- ADR-0015: Tenant Isolation via Postgres Row-Level Security
- ADR-0003: Per-Tenant Per-Provider Rate Limiting
