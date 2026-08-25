# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0076 Composer Deep Research Agent — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated from ADR-0076 / BRD-0076) |
| Reviewer(s) | Menno — Product Owner / Sole Developer |
| Status | Approved |
| Related Documents | ADR-0076, BRD-0076, ADR-0072 (Polypost Composer), ADR-0065/0066 (Brave/Bing search connectors), ADR-0038 (AI enrichment provider selection), ADR-0027 (connector as technical intermediary), ADR-0028/0034 (credentials), ADR-0015 (RLS), ADR-0003 (rate limiting), ADR-0030/0032 (identity/`platform_admin` boundary), ADR-0048 (no-core-pipeline-change), ADR-0120 (future `SearchProviderConnector`), ADR-0121 (future caching/re-trigger), Stories 2.31, 2.32, 3.17, 6.41 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0076 (Accepted, 2026-08-23) and BRD-0076 into a functional design for an on-demand "Deep Research" capability inside the Polypost Composer: it reads the user's draft post, extracts key phrases and topics, runs one-off search queries through the tenant's own connected Brave/Bing search providers, and returns a context summary and comparison the author can use before publishing.

ADR-0076's status is Accepted; this FDD reflects a settled design. As of this writing, Story 2.31 (search helpers) is Built; Stories 2.32, 3.17, and 6.41 are Ready but not yet built — this FDD describes the full target design regardless of build status.

### 2.2 Scope

- **In scope:** `POST /v1/composer/research` in `social-listening-core`; the multi-step orchestration pipeline (extraction → query generation → one-off search → synthesis); the optional `AIProviderConnector.research?()` method (Azure OpenAI only in v1); internal `searchForResearch(query, limit)` helpers on the Brave and Bing connectors; the dedicated `research` `RequestGate` key; the `Deep Research` button, `DeepResearchPanel`, and `/api/composer/research` proxy route in `social-listening-admin`.
- **Out of scope:** caching, persistence, or history of research results (deferred to ADR-0121); asynchronous/background research or scheduled/repeated research; media, image, or video analysis (draft text only); a generic `SearchProviderConnector` abstraction or a `SocialConnector.search?()` method (deferred to ADR-0120); full-page fetching or content extraction beyond Brave/Bing snippets; any client-side mock or fallback data for research results; use of a SocialEngage-owned shared AI/search account.

### 2.3 Target Audience

Backend and frontend engineers implementing Stories 2.31/2.32/3.17/6.41, QA writing contract tests, and the Product Owner reviewing acceptance criteria.

---

## 3. Context and Background

- **Problem:** Tenant users draft posts in the Polypost Composer (ADR-0072) with no quick, tenant-safe way to see what the public conversation is saying about the post's topics. They must leave the product, manually search, and mentally compare results — with no citable sources and no connection to the composer's drafting flow.
- **Why not the existing AI assist?** The composer's existing `/api/composer/ai-assist` route is an admin-local rewrite helper using a shared, env-based Azure OpenAI credential; it has no access to the tenant's own Brave/Bing search connectors and does not consume `social-listening-core`'s credential/RLS model. A rewrite tool and a research tool are different concerns.
- **Business/user value:** improves message quality, reduces manual research time, and gives the composer a genuine pre-publish intelligence layer, while keeping research cost and data ownership with the tenant (consistent with ADR-0027 — no SocialEngage-owned shared service is used).
- **Source requirements:** ADR-0076, BRD-0076, Stories 2.31, 2.32, 3.17, 6.41.
- **Constraints/dependencies:** must reuse tenant-scoped `platform_credentials` for both search (Brave/Bing) and AI (Azure OpenAI) — never a shared account; must reuse the `AIProviderConnector` optional-method pattern already established for `reply?()`/`publish?()`; must not add a new `SocialConnector` method (ADR-0048's no-core-pipeline-change discipline); must use a `RequestGate` key distinct from ingestion, reply, and outbound-post traffic (ADR-0003); v1 is strictly synchronous, single-HTTP-request, and ephemeral (no persistence).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Give tenant authors reliable, real-world context before publishing | A tenant user triggers deep research on a draft with at least 10 non-whitespace characters and receives a context summary, comparison, and sources |
| G2 | Protect tenant data ownership and control provider costs | All AI and search calls use the tenant's own Brave/Bing and Azure OpenAI credentials; no SocialEngage-owned shared service is used |
| G3 | Improve author confidence and reduce factually unsupported posts | Every result includes direct source links so authors can verify claims |
| G4 | Extend the composer into a pre-publish intelligence layer without duplicating the connector interface | `research?()` is added to `AIProviderConnector` as an optional method; `SocialConnector` and `bootstrapConnectors.ts` remain unchanged |
| G5 | Keep research traffic from starving other workloads | Research calls use a dedicated `RequestGate` key, isolated from ingestion, reply, and publish |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `AIProviderConnector.research?()` (optional connector method)

- **Description:** An optional method on `AIProviderConnector` that performs key-phrase/topic/query extraction and, in a second call, synthesizes the final context summary and comparison from collected search snippets. Only Azure OpenAI implements it in v1; Azure AI Language does not (it is a per-sentence NER/sentiment/classification service, not a generative synthesis engine).
- **Triggers:** Invoked twice per research call by the `POST /v1/composer/research` orchestration: once for extraction, once for synthesis.
- **Inputs:** Extraction stage: `text` (the draft). Synthesis stage: `text`, `searchSnippets: SearchSnippet[]`, and `options: ResearchOptions` (including the tenant-scoped `research_reasoning_effort` setting, default `medium`).
- **Processing:** Extraction produces `keyPhrases`, `relatedTopics`, and candidate `searchQueries` from the draft text. Synthesis receives the original text, the extracted phrases/topics, and the collected search snippets, and produces `contextSummary` and `comparison`.
- **Outputs:** A `ResearchResult`-shaped payload feeding directly into the endpoint's response fields.
- **Error handling:** If the tenant's only active AI provider is Azure AI Language (which does not implement `research?()`), the endpoint returns `422 AI_PROVIDER_NOT_CAPABLE`. This mirrors the `reply_not_supported` pattern from ADR-0073.
- **Edge cases:** Draft text that is technically ≥10 non-whitespace characters but semantically thin (e.g., emoji-only); Azure OpenAI credential valid but rate-limited mid-call; extraction returning zero usable key phrases (synthesis still attempts a best-effort summary from whatever context is available).

### 5.2 Feature / Capability: `searchForResearch(query, limit)` (internal connector helper, Brave and Bing)

- **Description:** An internal, read-only, one-off search helper added to each of the Brave and Bing connectors' own code — not a new method on the `SocialConnector` contract (per ADR-0048's no-core-pipeline-change discipline, and per the ADR's explicit rejection of a generic `SocialConnector.search?()` for v1).
- **Triggers:** Invoked by the research orchestration once per generated search query, for each connected/active search provider.
- **Inputs:** `query: string`, `limit: number` (bounded by `maxSearchResultsPerQuery`, default 5, hard cap 10).
- **Processing:** Reuses the existing credential retrieval (`getLatestCredentialId`), query builder, and HTTP fetch machinery already used by the Brave/Bing polling connectors; issues a single search request and returns the top `limit` snippets.
- **Outputs:** A list of `{ title, url, snippet, provider }` entries.
- **Error handling:** Provider-side errors (`http_401`, `http_403`, `rate_limited`, `http_5xx`) are classified using the same taxonomy as the existing polling connectors, surfacing as a `ClassifiableError` the endpoint can map cleanly.
- **Edge cases:** Neither Brave nor Bing connected/active for the tenant (endpoint returns `422 SEARCH_PROVIDER_UNAVAILABLE`); one of the two connected but rate-limited (the other, if connected, still contributes results); a query returning zero results (contributes nothing to `sources` without failing the whole request). Per BRU-007, these helpers must be strictly read-only — they must not persist posts, emit `SocialPostIngestedEvent`, or modify `post_watchlist_matches`.

### 5.3 Feature / Capability: `POST /v1/composer/research`

- **Description:** The tenant-scoped, RLS-gated REST endpoint that orchestrates the full research pipeline for a composer draft.
- **Triggers:** The `social-listening-admin` proxy route (`/api/composer/research`) forwarding a user-initiated "Deep Research" click.
- **Inputs:** JSON body `{ text: string; targetPlatforms?: string[]; maxSearchResultsPerQuery?: number }`; bearer/Entra session.
- **Processing (fixed, short pipeline):**
  1. Authenticate the caller; resolve tenant and role. Reject `platform_admin` identities with `403` (ADR-0030 §2). `tenant_admin` and `tenant_user` are both permitted (ADR-0032) — the same audience as the composer itself.
  2. **Key-phrase/topic extraction:** call the tenant's active `AIProviderConnector.research?()` (extraction stage) on `text`. If no capable AI provider is connected and active, return `422 AI_PROVIDER_NOT_CAPABLE`.
  3. **Search query generation:** derive `searchQueries` from the extracted key phrases (either the same extraction call or a second structured LLM response), bounded to a default of 3 / hard cap of 5.
  4. **One-off search dispatch:** for each query, call the tenant's connected Brave and/or Bing `searchForResearch()` helper(s), collecting up to `maxSearchResultsPerQuery` (default 5, hard cap 10) snippets per query. If no search provider is connected and active, return `422 SEARCH_PROVIDER_UNAVAILABLE`.
  5. **Synthesis:** call `AIProviderConnector.research?()` (synthesis stage) with the original text, key phrases, related topics, and collected snippets, producing `contextSummary` and `comparison`.
  6. Enforce caps throughout: max 10 key phrases, max 5 search queries, max 10 search results per query. Exceeding any cap returns `413`/`422 RESEARCH_TOO_LARGE`.
  7. Acquire the `research` `RequestGate` slot per `(tenantId, providerId, 'research')` for each provider consumed (search and AI), distinct from `poll`, `reply`, and `publish` gate keys.
- **Outputs:** `200 OK` with `{ keyPhrases, relatedTopics, searchQueries, sources, contextSummary, comparison }` (the `ComposerResearchResult` shape).
- **Error handling:** `422 AI_PROVIDER_NOT_CAPABLE` (no capable AI provider), `422 SEARCH_PROVIDER_UNAVAILABLE` (no active search provider), `413`/`422 RESEARCH_TOO_LARGE` (caps exceeded), `403` (`platform_admin`), classified provider errors (`http_401`, `http_403`, `rate_limited`, `http_5xx`) surfaced from the search/AI calls.
- **Edge cases:** Draft text right at the caps boundary; only one of Brave/Bing connected (research still proceeds using the available provider); Azure OpenAI connected but transiently rate-limited mid-pipeline (surfaced as a provider error, not silently degraded); no `social_posts` or `post_watchlist_matches` rows are ever created or modified by this endpoint (it is entirely read-only against tenant content).

### 5.4 Feature / Capability: Deep Research button, `DeepResearchPanel`, and proxy route (UI)

- **Description:** The `PolypostComposer` surface that lets a user trigger research on their current draft and review the result.
- **Triggers:** User clicks the **Deep Research** toolbar button (positioned to the right of the existing AI-assist and document-import controls).
- **Inputs:** The current draft text; the caller's session/role.
- **Processing:**
  - The button is disabled when the draft text has fewer than 10 non-whitespace characters, and disabled with a tooltip for `platform_admin` sessions (the composer page itself remains visible to all roles).
  - On click, the UI calls the same-origin proxy `POST /api/composer/research`, which attaches the session bearer token and forwards to `POST /v1/composer/research` — never a client-side `useApp()` context or mock/fallback data.
  - A collapsible `DeepResearchPanel` renders below the editor once research is triggered, showing `keyPhrases` and `relatedTopics` (collapsible list), `contextSummary` and `comparison` (formatted Markdown), and an expandable `sources` list rendered as expandable cards (`<details>`/accordion-style `SourceCard`s, each showing title, provider, and snippet, with the full URL as a link — per the ADR's Resolved Question 4; inline citations inside `contextSummary` are deferred).
  - The panel manages three states: `loading` (spinner, cancel timeout), `error` (actionable messages for `422 AI_PROVIDER_NOT_CAPABLE`, `422 SEARCH_PROVIDER_UNAVAILABLE`, `403`, and network/5xx), and `success` (rendered result).
- **Outputs:** A displayed research result the user can read and use to revise their draft; the result is never written to `localStorage` or any persistent draft state.
- **Error handling:** Each error code maps to a distinct, actionable UI message rather than a generic failure.
- **Edge cases:** User edits the draft after research completes (the panel's result becomes stale but is not auto-invalidated in v1 — the user must re-trigger); user closes the panel or refreshes the page (result is discarded, per the ephemeral-by-design requirement); very fast repeated clicks (the button should not allow overlapping in-flight requests, though the exact debounce mechanism is an implementation detail).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-User | Primary author triggering research on their own draft |
| Social-Selling / Brand Strategist | Uses research to confirm relevance and avoid duplicated angles |
| Tenant-Brand-Reputation-Manager | Uses the comparison to catch tone mismatches or unsupported claims |
| Tenant-Social-Care-Agent | Potential future user of research before replying publicly |
| Platform-Admin | Must be rejected from the feature entirely (zero-tenant-content boundary) |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (key) |
|---|---|---|---|---|
| Story 2.31 — Brave and Bing one-off research search helpers (Built, `social-listening-core@4949200`) | Core backend engineer | Add internal one-off search helpers inside the Brave and Bing connectors | The composer deep research endpoint can run live web searches without re-implementing polling loops | `searchForResearch(query, limit)` added to each connector, reusing existing credential retrieval and query builder |
| Story 2.32 — Azure OpenAI `research?()` capability (Ready, not yet built) | Core backend engineer | Add an optional `research?()` method on `AIProviderConnector` that Azure OpenAI implements | The composer deep research endpoint can extract key phrases and synthesize a context summary | `AIProviderConnector` gains an optional `research?()` method; Azure OpenAI implements it; Azure AI Language does not |
| Story 3.17 — Composer deep research REST endpoint (Ready, not yet built) | Tenant user | Call a `POST /v1/composer/research` endpoint with my draft text | I receive a deep-research summary I can compare to my own message | Endpoint mounted, authenticated, RLS-scoped; orchestrates extraction → search → synthesis; enforces `AI_PROVIDER_NOT_CAPABLE`/`SEARCH_PROVIDER_UNAVAILABLE`/`RESEARCH_TOO_LARGE`/`403`; separate `research` `RequestGate`; no `social_posts`/`post_watchlist_matches` side effects |
| Story 6.41 — Composer Deep Research panel UI (Ready, depends on Story 3.17) | Tenant user | See a "Deep Research" button and panel inside the Polypost Composer | I can compare my draft post against the public conversation surfaced by the deep research agent | Toolbar button disabled under 10 non-whitespace chars; `DeepResearchPanel` renders all result fields; proxy route `/api/composer/research`; loading/error/success states; button disabled with tooltip for `platform_admin`; result never persisted to `localStorage` |

### 6.3 Workflow Diagrams / Steps

**Primary flow — successful research:**

1. Tenant user drafts a post in the Polypost Composer; once the draft reaches ≥10 non-whitespace characters, the **Deep Research** button becomes enabled.
2. User clicks **Deep Research**. UI calls the same-origin proxy `POST /api/composer/research`, which attaches the session and forwards to `POST /v1/composer/research`.
3. Server authenticates the caller and rejects `platform_admin` identities with `403`.
4. Server calls the tenant's active `AIProviderConnector.research?()` (extraction stage) on the draft text to produce `keyPhrases`, `relatedTopics`, and candidate `searchQueries`. If no capable AI provider, returns `422 AI_PROVIDER_NOT_CAPABLE`.
5. For each search query, server calls the tenant's connected Brave and/or Bing `searchForResearch()` helper(s), collecting snippets up to the per-query cap. If no search provider connected, returns `422 SEARCH_PROVIDER_UNAVAILABLE`.
6. Server calls `AIProviderConnector.research?()` (synthesis stage) with the original text, extracted phrases/topics, and collected snippets to produce `contextSummary` and `comparison`.
7. Server checks all caps (key phrases, queries, results per query); if any is exceeded, returns `422 RESEARCH_TOO_LARGE` (this check can short-circuit earlier stages once a cap is known to be exceeded).
8. Server returns `200 OK` with the full `ComposerResearchResult`.
9. UI's `DeepResearchPanel` transitions from `loading` to `success`, rendering key phrases, related topics, context summary, comparison, and expandable source cards.
10. User reviews the summary and sources, edits the draft as needed, and may re-trigger research on the revised draft (no automatic re-trigger).

**Error flow — missing provider:**

1. User clicks **Deep Research** without an active Azure OpenAI (or capable AI) provider connected.
2. Server returns `422 AI_PROVIDER_NOT_CAPABLE`.
3. UI shows an actionable error state explaining the missing AI provider.

**Error flow — role rejection:**

1. A `platform_admin` session attempts to trigger research (button is disabled with a tooltip in the UI; a direct API call is still rejected server-side).
2. Server returns `403`.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Draft post text (`text`) from the Polypost Composer.
- Optional `targetPlatforms` and `maxSearchResultsPerQuery` tuning parameters.
- Caller identity, tenant, and role from the Entra-backed session.
- The tenant's active `platform_credentials` for Brave, Bing, and Azure OpenAI.
- The tenant-scoped setting `tenant_settings.research_reasoning_effort` (`low` | `medium` | `high`, default `medium`), shown as an advanced option in the UI when Azure OpenAI is active.

### 7.2 Data Outputs

- `keyPhrases: string[]`, `relatedTopics: string[]`, `searchQueries: string[]` — AI-extracted structures.
- `sources: Array<{ title, url, snippet, provider }>` — search-result citations.
- `contextSummary: string`, `comparison: string` — AI-synthesized narrative output.
- None of these outputs are persisted; they exist only in the HTTP response and the browser's in-memory panel state.

### 7.3 Data Model / Entities

Deep Research introduces no new persisted tables — v1 is explicitly ephemeral (no caching/persistence; NFR-001). The relevant entities are all existing ones it reads from or extends:

| Entity | Key Attributes (in this feature's scope) | Relationships |
|---|---|---|
| `platform_credentials` (existing) | Tenant-owned credentials for `brave-search`, `bing-search`, and `azure-openai`, active/inactive state | Read-only source of the credentials used for both search and AI calls; never a shared/SocialEngage-owned credential |
| `AIProviderConnector` (existing interface, extended) | New optional `research?(text, searchSnippets, options): Promise<ResearchResult>` method | Implemented by Azure OpenAI only in v1; not implemented by Azure AI Language |
| Brave / Bing connectors (existing, extended internally) | New internal `searchForResearch(query, limit)` helper (not part of the `SocialConnector` contract) | Reuses each connector's existing credential retrieval and query-builder code |
| `RequestGate` (existing mechanism) | New key dimension `'research'` alongside `'poll'`, `'reply'`, `'outbound'`/`'outbound_post'` | Scoped per `(tenantId, providerId, 'research')` |
| `tenant_settings` (existing table, extended) | New field `research_reasoning_effort` (`low` \| `medium` \| `high`, default `medium`) | Tenant-scoped configuration consumed by the Azure OpenAI `research?()` call |
| `ComposerResearchResult` (response shape, not persisted) | `keyPhrases`, `relatedTopics`, `searchQueries`, `sources`, `contextSummary`, `comparison` | Ephemeral — exists only in the HTTP response/UI state, never written to `social_posts`, `post_watchlist_matches`, or browser storage |

### 7.4 Validation Rules

- `text` must be non-empty and, per the UI gate, effectively ≥10 non-whitespace characters (server-side enforcement may mirror this, though the exact server-side minimum is an implementation detail).
- `maxSearchResultsPerQuery` defaults to 5, hard-capped at 10.
- Key phrases capped at 10 (default 5); search queries capped at 5 (default 3).
- Caller role must resolve to `tenant_admin` or `tenant_user`; `platform_admin` is rejected before any provider call is made.
- No AI or search call may use a credential outside the caller's own tenant.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A `platform_admin` identity may not use the Composer Deep Research feature. | `POST /v1/composer/research`, UI button |
| BR2 | Deep Research v1 requires an active Azure OpenAI `AIProviderConnector`; Azure AI Language is not a capable provider. | `research?()` dispatch |
| BR3 | All web-search and AI calls must consume the tenant's own provider credentials from `platform_credentials`; no SocialEngage-owned shared service may be used. | Entire pipeline |
| BR4 | Research results are ephemeral and must not be persisted in v1, including in the UI's local draft state. | Endpoint response, UI panel |
| BR5 | A research call may use at most 10 key phrases, 5 generated search queries, and 10 search results per query; defaults are 5 key phrases, 3 queries, 5 results per query. | `POST /v1/composer/research` |
| BR6 | The Deep Research button is disabled with a tooltip when the draft text is shorter than 10 non-whitespace characters. | UI |
| BR7 | Search helpers must be read-only and must not persist posts, emit `SocialPostIngestedEvent`, or modify `post_watchlist_matches`. | `searchForResearch()` helpers |
| BR8 | Each provider consumed by a research call uses a `RequestGate` key named `research`, separate from `poll`, `reply`, and `publish`. | Rate limiting |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `PolypostComposer` (Admin UI) | Outbound to proxy | Render Deep Research button and host `DeepResearchPanel` | HTTPS/JSON via BFF session |
| `POST /api/composer/research` (Admin UI proxy) | Outbound to core | Attach session bearer token; forward to core endpoint | HTTPS/JSON, same-origin proxy |
| `POST /v1/composer/research` | Inbound from proxy / API caller | Orchestrate the research pipeline | REST/JSON, Entra bearer session |
| `AIProviderConnector.research?()` (Azure OpenAI) | Outbound to Azure OpenAI | Extraction and synthesis LLM calls | Provider-specific REST (tenant credential) |
| `searchForResearch()` (Brave / Bing connectors) | Outbound to Brave / Bing | One-off web search for context snippets | Provider-specific REST (tenant credential) |
| `RequestGate` | Internal | Rate-limit research calls per `(tenantId, providerId, 'research')` | Internal service call |
| `tenant_settings` | Internal (read) | Supply `research_reasoning_effort` for the Azure OpenAI call | Postgres, RLS-scoped |

---

## 10. Non-Functional Considerations

- **Performance:** The full pipeline (extraction + search + synthesis) completes within a single synchronous HTTP request; end-to-end latency is inherently higher than a single `enrichPost()` call, which is accepted because the user explicitly triggers it (NFR-004, Should).
- **Security / access control:** RLS and identity resolution scope every call to the caller's own tenant; `platform_admin` is rejected before any provider call; no tenant data leaks across tenants (NFR-003).
- **Scalability:** A dedicated `research` `RequestGate` key isolates research bursts from ingestion polls, replies, and outbound posts (BR8, NFR-006 related).
- **Reliability / availability:** Search and AI provider errors are classified using the same taxonomy as the existing polling connectors (`http_401`, `http_403`, `rate_limited`, `http_5xx` → `ClassifiableError`), so failures surface cleanly rather than as opaque 500s (NFR-005).
- **Audit and logging:** No persistence of research content itself; operational metrics (calls per tenant, cap-rejection rate, provider error rates) are tracked at the reporting level, not as durable per-call audit rows (Section 11 of BRD-0076).
- **Accessibility:** `DeepResearchPanel`'s loading/error/success states follow the same accessible patterns as other composer panels (spinner, actionable error text, focus handling).
- **Localization / internationalization:** No new localization requirement beyond existing UI copy conventions; AI-generated `contextSummary`/`comparison` text quality is provider-dependent, not something this FDD controls.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| No capable AI provider connected/active | "Deep Research requires an active Azure OpenAI connection" style actionable message | `422 AI_PROVIDER_NOT_CAPABLE` |
| No active Brave/Bing search provider | Feature disabled with tooltip, or actionable error if triggered directly | `422 SEARCH_PROVIDER_UNAVAILABLE` |
| Request exceeds key-phrase/query/result caps | "Draft or research scope too large" style message | `413`/`422 RESEARCH_TOO_LARGE` |
| `platform_admin` attempts to use the feature | Button disabled with tooltip; direct API call rejected | `403` |
| Search or AI provider returns `http_401`/`http_403`/`rate_limited`/`http_5xx` | Actionable error state reflecting the classified failure | Classified via `ClassifiableError`, surfaced to the panel's `error` state; no partial/garbled result shown |
| Network/5xx failure mid-pipeline | Generic actionable error with retry guidance | Panel shows `error` state; user may retry by re-clicking Deep Research |

---

## 12. Assumptions and Dependencies

- ADR-0072 (Polypost Composer) and `/tenant/compose` are already accepted and built.
- Tenant identity resolution and role gating are available through the existing authentication stack (ADR-0029/0032).
- Brave/Bing search credentials and Azure OpenAI credentials can already be activated per tenant (ADR-0028/0034).
- The `AIProviderConnector` optional-method pattern (mirroring `reply?()`/`publish?()`) is an acceptable, already-precedented way to add `research?()`.
- Story 2.31's `searchForResearch()` helpers are a prerequisite for Story 3.17's endpoint; Story 3.17 is a prerequisite for Story 6.41's UI.
- The generalized `SearchProviderConnector` abstraction (if the pattern repeats beyond Brave/Bing) is explicitly deferred to ADR-0120, not built speculatively here.
- Caching/persistence and cost-justification for repeated research on the same text are explicitly deferred to ADR-0121.
- The `research_reasoning_effort` tenant setting and its UI exposure as an "advanced option" are part of this design per the ADR's Resolved Question 3, but their exact implementation contract is left to Story 3.17/6.41.

---

## 13. Open Questions

Per the ADR, most of its original open questions were resolved during acceptance review (endpoint path, `SearchProvider` generalization deferred to ADR-0120, `reasoning_effort` as a tenant setting, citation rendering as expandable cards, caching deferred to ADR-0121). The following remain open at the FDD level:

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the server-side minimum draft-text length exactly mirror the UI's 10-non-whitespace-character gate, or allow a slightly different threshold? | Technical Lead | At Story 3.17 implementation time |
| Q2 | Should a research call be cancellable mid-flight from the UI (beyond the panel's "cancel timeout" loading affordance)? | Product Owner | At Story 6.41 implementation time |
| Q3 | Should `RESEARCH_TOO_LARGE` short-circuit before any provider call, or only after an initial extraction reveals the request exceeds caps? | Technical Lead | At Story 3.17 implementation time |

---

## 14. Appendix

**Glossary**

| Term | Definition |
|---|---|
| Composer / Polypost Composer | The multi-platform drafting interface where a tenant user authors one post and sees live previews for target networks (ADR-0072). |
| Deep Research Agent | The on-demand, tenant-scoped feature that extracts topics, searches the public web, and synthesizes a context summary and comparison for a draft post. |
| Key phrases | Important terms or entities identified from the draft post text. |
| Related topics | Broader themes or subjects connected to the draft's content. |
| Context summary | A short narrative of what the current public/web conversation says about the extracted topics. |
| Comparison | A concise analysis of the user's draft relative to the context summary, noting angles covered, missing angles, tone differences, and claims to verify. |
| Sources | Citable search-result snippets returned by the tenant's Brave and/or Bing search providers. |
| `AIProviderConnector` | The interface through which tenant AI providers (Azure OpenAI, Azure AI Language) are plugged into the core; gains an optional `research?()` method. |
| `searchForResearch` | Internal, read-only helper functions in the Brave and Bing connectors performing one-off web searches for the research pipeline. |
| `RequestGate` | The per-tenant, per-provider rate-limiting mechanism used to isolate different workloads. |

**Reference links**

- [ADR-0076: Composer Deep Research Agent](../../adr/0076-composer-deep-research-agent.md)
- [BRD-0076: Composer Deep Research Agent](../Business-Requirements/BRD-0076-Composer-Deep-Research-Agent.md)
- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../../adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md)
- [ADR-0065: Active Watchlist Sourcing via Brave Search API](../../adr/0065-active-watchlist-sourcing-via-brave-search-api.md)
- [ADR-0066: Active Watchlist Sourcing via Bing Search API](../../adr/0066-active-watchlist-sourcing-via-bing-search-api.md)
- [ADR-0038: AI Enrichment Provider Selection](../../adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md)
- [ADR-0027: Connector Is a Technical Intermediary, Not a Contracting Party](../../adr/0027-connector-is-technical-intermediary-not-contracting-party.md)
- [ADR-0028: Credential Creation Authority by Ownership Tier](../../adr/0028-credential-creation-authority-scoped-by-ownership-tier.md)
- [ADR-0034: Connector Connect/Disconnect CRUD, Ownership-Tier-Aware](../../adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md)
- [ADR-0015: Tenant Isolation via Postgres Row-Level Security](../../adr/0015-tenant-isolation-via-postgres-row-level-security.md)
- [ADR-0003: Per-Tenant Per-Provider Rate Limiting](../../adr/0003-per-tenant-per-provider-rate-limiting.md)
- [ADR-0030: Admin-Tier Design / Platform-Admin RLS Exception](../../adr/0030-admin-tier-design-platform-admin-rls-exception.md)
- [ADR-0032: Users Table Shape and RLS](../../adr/0032-users-table-shape-and-rls.md)
- [ADR-0048: No-Core-Pipeline-Change Verification for New Connector Registration](../../adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md)
- [ADR-0120: Search Provider Connector](../../adr/0120-search-provider-connector.md) (future generalization)
- [ADR-0121: Composer Deep Research Caching, Re-Trigger, and Cost Justification](../../adr/0121-composer-deep-research-caching-retrigger-cost.md) (future caching/re-trigger)
- [Feature design: Composed post author mention suggestions](../../product-research/feature-designs/13-composed-post-author-mention-suggestions.md) — identifies this feature as a dependency and reuses `AIProviderConnector.research?()`
- [Feature design: AI enhancement opportunities](../../product-research/feature-designs/ai-enhancements.md) — lists the deep research agent under Publishing and Scheduling
- [Feature design: Semantic search / RAG](../../product-research/feature-designs/28-semantic-search-rag.md) — cites ADR-0076 as a research orchestrator and proposes a future RAG layer
- Stories: [Story 2.31 — Brave and Bing one-off research search helpers](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md), [Story 2.32 — Azure OpenAI `research?()` capability](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md), [Story 3.17 — Composer deep research REST endpoint](../../user-stories/epic-3-data-model-storage-and-archival.md), [Story 6.41 — Composer Deep Research panel UI](../../user-stories/epic-6-tenant-admin-ui.md)

**Revision history**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer | Regenerated from ADR-0076/BRD-0076 with a genuine per-capability Section 5 breakdown, replacing the prior defective BRD-duplicate/flat-table version. |
