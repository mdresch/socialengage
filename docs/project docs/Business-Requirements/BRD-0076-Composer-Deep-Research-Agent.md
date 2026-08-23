# Business Requirements Document — ADR-0076: Composer Deep Research Agent

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Composer Deep Research Agent — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Business Sponsor / Product Owner |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | BRD Writer Agent | Initial BRD derived from ADR-0076 and associated user stories |

---

## 2. Executive Summary

Social-engagement authors currently draft messages in the Polypost Composer without a quick, tenant-safe way to check what the broader public conversation is saying about the topics in their post. Before publishing, they must leave the product and manually research news, blogs, and social sources, or risk publishing a message that is misaligned, stale, or factually unsupported.

The **Composer Deep Research Agent** adds an on-demand research capability to the Polypost Composer. A tenant user can click a **Deep Research** button while drafting a post; the agent extracts key phrases and related topics from the draft, runs one-off web searches through the tenant's own Brave and/or Bing search providers, and returns a concise context summary and a side-by-side comparison of the user's draft against the public conversation. Every summary is backed by a list of citable web sources, and the entire operation runs on the tenant's own provider credentials so that data ownership and cost remain with the tenant.

This initiative is expected to increase message quality, reduce manual research time, and strengthen the composer's value as an intelligence layer for tenant-brand, social-selling, and social-care users.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Give tenant authors reliable, real-world context before they publish a post | A tenant user can trigger deep research and receive a context summary, comparison, and sources for any draft with at least 10 non-whitespace characters |
| 2 | Protect tenant data ownership and control provider costs | All web-search and AI calls consume the tenant's own Brave/Bing and Azure OpenAI credentials; no SocialEngage-owned shared service is used |
| 3 | Improve author confidence and reduce factually unsupported posts | Returned results include direct source links so authors can verify claims before publishing |
| 4 | Extend the Polypost Composer from a drafting tool to a pre-publish intelligence layer | Deep Research is available as a first-class control inside the composer, integrated with the existing UI patterns (toolbar, panel, proxy route) |

---

## 4. Scope

### 4.1 In Scope

- A new **Deep Research** button and collapsible panel inside the Polypost Composer (`social-listening-admin`).
- A synchronous `POST /v1/composer/research` endpoint in `social-listening-core` that accepts the current post draft and optional tuning parameters.
- Extraction of `keyPhrases` and `relatedTopics` from the draft text using the tenant's active Azure OpenAI AI provider.
- Generation of a small set of web search queries from the extracted key phrases.
- One-off web search calls to the tenant's connected Brave and/or Bing search providers.
- Synthesis of a `contextSummary` and a `comparison` of the draft against the public conversation.
- Return of a citable `sources` list for each research call.
- Tenant-scoped role gating (`tenant_admin` / `tenant_user` allowed; `platform_admin` rejected).
- A dedicated `RequestGate` key per `(tenantId, providerId, 'research')` so research traffic is isolated from ingestion, reply, and publish traffic.
- Clear, actionable error states for missing or incapable AI providers, missing search providers, role violations, and oversize requests.

### 4.2 Out of Scope

- Caching, persistence, or history of research results.
- Asynchronous or background research jobs; scheduled or repeated research.
- Media, image, video, or attachment analysis; v1 uses the draft text only.
- A generic `SearchProvider` connector abstraction (deferred to ADR-0120).
- Streaming or multi-turn research output.
- Client-side mock or fallback data for research results.
- Full-page fetching or content extraction beyond the snippets returned by Brave/Bing.

### 4.3 Assumptions

- The Polypost Composer (`ADR-0072`) and the `tenant/compose` page are already built.
- Tenant identity resolution and role gating are available through the existing authentication stack.
- Brave/Bing search provider credentials and Azure OpenAI credentials can already be activated per tenant.
- The `AIProviderConnector` optional-method pattern (`reply?()`, `publish?()`) is acceptable for adding `research?()`.

### 4.4 Constraints

- v1 is synchronous; the entire pipeline (extraction + search + synthesis) must complete within one HTTP request.
- Hard caps apply: maximum 10 key phrases, 5 search queries, and 10 search results per query (default 5).
- `platform_admin` users are forbidden from using research in order to preserve the zero-tenant-content boundary (`ADR-0030`).
- Azure AI Language is not a capable provider for this feature; v1 requires Azure OpenAI.
- No SocialEngage-owned shared AI or search account may be used.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User (primary) | Drafts and publishes posts in the Polypost Composer | High | One-click research, readable summary, verifiable sources, fast enough to not break flow |
| Social-Selling / Brand Strategist | Uses the composer for outreach and thought leadership | High | Confidence that the angle is relevant and not duplicated; easy citation |
| Tenant-Brand-Reputation Manager | Wants to avoid misinformation or tone mismatches | High | Comparison against current conversation; ability to spot missing or overstated angles |
| Tenant-Social-Care Agent | May use research before replying publicly (future) | Medium | Quick context on a topic or complaint |
| Product Team | Owns the composer roadmap | Medium | Reuses accepted architecture, stays within scope, produces measurable usage |
| Operations / Platform Admin | Monitors cost, rate limits, and tenant isolation | Medium | Research traffic isolated from ingestion; costs billed to tenant accounts |

---

## 6. Current State (As-Is)

**Current process:**

1. A tenant user drafts a message in the Polypost Composer.
2. The user can request an AI copy assist, but that assistant is an admin-local rewrite helper; it does not access the public web or the tenant's own search connectors.
3. If the user wants to know what the broader conversation is saying, they must open a separate browser, search manually, and mentally compare results to their draft.
4. The user returns to the composer and decides whether to revise the draft before publishing.

**Pain points:**

- Research is disconnected from the drafting workflow, creating friction and context switching.
- There is no built-in way to compare the draft's claims or tone against current public sources.
- The existing AI assist cannot cite real sources, so authors cannot verify its suggestions.
- Any web research that is performed inside the product would currently require bypassing the tenant-credential and row-level security model.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A tenant user drafts a post in the Polypost Composer.
2. When the draft has at least 10 non-whitespace characters, the user clicks the **Deep Research** button in the composer toolbar.
3. The admin UI calls a same-origin proxy `POST /api/composer/research`, which forwards the request to `POST /v1/composer/research` in `social-listening-core` with the current session and tenant context.
4. `social-listening-core` extracts `keyPhrases` and `relatedTopics` using the tenant's active Azure OpenAI AI provider.
5. It generates a short set of search queries and runs one-off web searches through the tenant's connected Brave and/or Bing search providers.
6. It sends the original draft, key phrases, related topics, and search snippets back to Azure OpenAI to produce a `contextSummary` and a `comparison`.
7. The result is returned to the composer, where a collapsible `DeepResearchPanel` displays the key phrases, related topics, context summary, comparison, and an expandable list of citable sources.
8. The user reviews the summary, checks sources, and edits the draft accordingly before publishing.

**Expected capabilities:**

- One-click research from the composer, scoped to the active tenant.
- Automatic extraction of topics and related public conversation.
- A comparison that helps the author see what is well-covered, what is missing, and what may need verification.
- Direct links to search-result sources for manual verification.
- Clear error states when the required providers are not connected or the request is too large.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The Polypost Composer shall expose a **Deep Research** button in the composer toolbar | Must | Button appears to the right of the existing AI assist and document-import controls; it is disabled when the draft text has fewer than 10 non-whitespace characters | Product Owner |
| BR-002 | The admin UI shall call a same-origin proxy that forwards deep-research requests to `social-listening-core` | Must | `POST /api/composer/research` attaches the session bearer token and forwards to `POST /v1/composer/research` without bypassing the core API boundary | Product Owner |
| BR-003 | The core endpoint shall accept the current draft and optional tuning parameters | Must | Request body accepts `{ text: string, targetPlatforms?: string[], maxSearchResultsPerQuery?: number }` | Product Owner |
| BR-004 | The system shall extract key phrases and related topics from the draft using the tenant's own Azure OpenAI provider | Must | The response includes `keyPhrases: string[]` and `relatedTopics: string[]`; if no capable AI provider is connected, the endpoint returns `422 AI_PROVIDER_NOT_CAPABLE` | Product Owner |
| BR-005 | The system shall generate and execute one-off web searches through the tenant's Brave and/or Bing providers | Must | The endpoint returns `sources` with `title`, `url`, `snippet`, and `provider` for each result; if no search provider is connected, it returns `422 SEARCH_PROVIDER_UNAVAILABLE` | Product Owner |
| BR-006 | The system shall synthesize a `contextSummary` and a `comparison` of the draft against the public conversation | Must | Response includes a `contextSummary` and a `comparison`, both produced from the original draft, extracted topics, and the collected search snippets | Product Owner |
| BR-007 | The system shall enforce request caps and reject oversize requests | Must | Maximum 10 key phrases, 5 search queries, and 10 search results per query; exceeding these caps returns `422 RESEARCH_TOO_LARGE` | Product Owner |
| BR-008 | The endpoint shall be available to `tenant_admin` and `tenant_user` identities and reject `platform_admin` | Must | Authenticated `tenant_admin` and `tenant_user` receive results; `platform_admin` receives `403` | Product Owner |
| BR-009 | The UI panel shall render the research result and its sources in a readable format | Must | `DeepResearchPanel` shows key phrases, related topics, Markdown-formatted `contextSummary` and `comparison`, and an expandable `sources` list with external links | Product Owner |
| BR-010 | Research calls shall consume a dedicated `RequestGate` key per tenant, provider, and operation type | Must | Each research call is gated by `(tenantId, providerId, 'research')` and does not consume ingestion, reply, or publish gate quota | Product Owner |
| BR-011 | The panel shall surface clear loading, success, and error states | Must | States include `loading` (spinner and timeout), `error` (with actionable messages for 422, 403, and network/5xx cases), and `success` (rendered result) | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Research results shall not persist or be cached in v1 | Security / Compliance | Must | No `social_posts`, `post_watchlist_matches`, or UI localStorage writes occur as a result of a research call; the result is returned and displayed ephemerally |
| NFR-002 | All AI and search calls shall use the tenant's own connected credentials | Security / Compliance | Must | Contract tests verify that research calls do not fall back to a shared, SocialEngage-owned service |
| NFR-003 | The endpoint shall be scoped to the caller's tenant through row-level security and identity resolution | Security | Must | `platform_admin` is rejected; no tenant data leaks to another tenant |
| NFR-004 | The research endpoint shall be synchronous and return within a time window that keeps the composer usable | Performance | Should | End-to-end response completes within a single HTTP request; failure modes are visible and recoverable for the user |
| NFR-005 | Errors from search providers shall be classified using the same taxonomy as the existing Brave/Bing polling connectors | Reliability | Should | `http_401`, `http_403`, `rate_limited`, `http_5xx` are mapped to `ClassifiableError` so the research endpoint can surface them cleanly |
| NFR-006 | The implementation shall reuse the existing `AIProviderConnector` optional-method pattern without duplicating the connector interface | Maintainability | Should | `research?()` is added to `AIProviderConnector`; Azure OpenAI implements it; Azure AI Language does not |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `platform_admin` identity may not use the Composer Deep Research feature, in order to preserve the zero-tenant-content boundary. |
| BRU-002 | Deep Research v1 requires an active Azure OpenAI `AIProviderConnector`; Azure AI Language is not a capable provider and must not be used. |
| BRU-003 | All web-search and AI calls must consume the tenant's own provider credentials from `platform_credentials`; no SocialEngage-owned shared service may be used. |
| BRU-004 | Research results are ephemeral and shall not be persisted in v1, including in the UI's local draft state. |
| BRU-005 | A research call may use at most 10 key phrases, 5 generated search queries, and 10 search results per query; defaults are 5 key phrases, 3 queries, and 5 results per query. |
| BRU-006 | The Deep Research button is disabled with a tooltip when the draft text is shorter than 10 non-whitespace characters. |
| BRU-007 | Search helpers must be read-only and must not persist posts, emit `SocialPostIngestedEvent`, or modify `post_watchlist_matches`. |
| BRU-008 | Each provider consumed by a research call uses a `RequestGate` key named `research`, separate from `poll`, `reply`, and `publish`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Draft post text (`text`) | The message the user is composing | Polypost Composer input | Tenant User | Tenant content |
| Target platforms (`targetPlatforms`) | Optional list of intended social networks | Polypost Composer | Tenant User | Low |
| Max results per query (`maxSearchResultsPerQuery`) | Optional cap on search results, default 5, hard cap 10 | Polypost Composer / core | Tenant User | Low |
| Key phrases (`keyPhrases`) | Extracted important phrases from the draft | Azure OpenAI | Tenant | Tenant content / AI output |
| Related topics (`relatedTopics`) | Extracted related themes from the draft | Azure OpenAI | Tenant | Tenant content / AI output |
| Search queries (`searchQueries`) | Generated queries sent to search providers | Azure OpenAI | Tenant | Low |
| Search result sources (`sources`) | Title, URL, snippet, and provider for each result | Brave / Bing search APIs | Public web / Tenant | Public web data with source attribution |
| Context summary (`contextSummary`) | LLM-written summary of public conversation | Azure OpenAI | Tenant | AI-generated content |
| Comparison (`comparison`) | LLM-written comparison of draft to context | Azure OpenAI | Tenant | AI-generated content |
| Provider credentials (`platform_credentials`) | Encrypted tenant-owned credentials for search and AI | Tenant configuration | Tenant-Admin | Highly sensitive, protected by Key Vault / RLS |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Research calls per tenant | Track adoption of the deep research feature | Product / Operations | Daily |
| Average response time and p95 latency | Monitor synchronous endpoint performance | Engineering / Operations | Real-time / Daily |
| Cap-rejection rate (`RESEARCH_TOO_LARGE`) | Understand how often requests hit v1 limits | Product / Engineering | Daily |
| AI / search provider error rates | Detect credential, quota, or connectivity issues | Engineering / Operations | Real-time / Daily |
| Source distribution by provider (`brave-search` vs `bing-search`) | Understand which search providers tenants use | Product | Weekly |
| Correlation with draft edits or publish rate (future) | Measure impact on post quality | Product | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The synchronous multi-call pipeline (extraction + search + synthesis) is slow and expensive per call | High | Medium | Restrict v1 to explicit user-triggered research, enforce caps, use a dedicated `RequestGate`, and defer caching/background to later ADR | Product Owner |
| R-002 | The feature is unusable for tenants without an active Azure OpenAI connector | Medium | High | UI disables the button with a clear tooltip; error state explains the missing AI provider | Product Owner |
| R-003 | Research results can become stale immediately after generation | Medium | Low | Keep v1 ephemeral with no cache; users can re-trigger research when they update the draft | Product Owner |
| R-004 | A tenant's draft text and search data are sent to an external AI service | Medium | High | Use the tenant's own Azure OpenAI credential, never a shared service; keep data within the tenant's trust boundary | Technical Lead |
| R-005 | The LLM may produce incomplete or inaccurate context, or hallucinate claims | Medium | High | Always return citable `sources`; comparison language is framed as suggestions for the user to verify, not as fact | Product Owner |
| R-006 | Research bursts could starve ingestion polls on shared rate-limit infrastructure | Low | Medium | Use a separate `research` `RequestGate` key so ingestion, reply, and publish traffic are not affected | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0072 — Polypost Composer and multi-network preview | Architecture | Product Owner | Already Accepted |
| D-002 | ADR-0065 / ADR-0066 — Brave and Bing search connectors | Architecture | Engineering | Already Accepted; internal `searchForResearch` helpers built under Story 2.31 |
| D-003 | ADR-0038 — AI Enrichment Provider Selection (`AIProviderConnector`) | Architecture | Engineering | Already Accepted; `research?()` built under Story 2.32 |
| D-004 | ADR-0028 — Credential creation by ownership tier | Architecture | Engineering | Already Accepted; tenant credentials used for search and AI |
| D-005 | ADR-0015 — Tenant isolation via row-level security | Architecture | Engineering | Already Accepted |
| D-006 | ADR-0032 / ADR-0030 — Identity resolution and `platform_admin` boundary | Architecture | Engineering | Already Accepted |
| D-007 | ADR-0003 — Per-tenant per-provider rate limiting (`RequestGate`) | Architecture | Engineering | Already Accepted |
| D-008 | Story 2.31 — Brave and Bing one-off research search helpers | Implementation | Engineering | Not yet built |
| D-009 | Story 2.32 — Azure OpenAI `research?()` capability | Implementation | Engineering | Not yet built |
| D-010 | Story 3.17 — Composer deep research REST endpoint | Implementation | Engineering | Not yet built |
| D-011 | Story 6.41 — Composer Deep Research panel UI | Implementation | Engineering | Not yet built |

---

## 14. Acceptance Criteria

1. A tenant user can open the Polypost Composer, type a draft, and click **Deep Research** to receive a result.
2. A valid request to `POST /v1/composer/research` returns all `ComposerResearchResult` fields: `keyPhrases`, `relatedTopics`, `searchQueries`, `sources`, `contextSummary`, and `comparison`.
3. If no capable AI provider is connected, the endpoint returns `422` with code `AI_PROVIDER_NOT_CAPABLE` and the UI displays an actionable message.
4. If no search provider is connected, the endpoint returns `422` with code `SEARCH_PROVIDER_UNAVAILABLE` and the UI disables the feature with a tooltip.
5. Requests that exceed the v1 caps return `422 RESEARCH_TOO_LARGE`.
6. `platform_admin` calls receive `403`.
7. `DeepResearchPanel` displays key phrases, related topics, a formatted `contextSummary`, a formatted `comparison`, and an expandable `sources` list with external links.
8. No `social_posts` or `post_watchlist_matches` rows are created or modified as a result of a research call.
9. Research calls use the separate `research` `RequestGate` and do not consume ingestion, reply, or publish quota.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Composer / Polypost Composer** | The multi-platform drafting interface where a tenant user authors one post and sees live previews for target networks. |
| **Deep Research Agent** | The on-demand, tenant-scoped feature that extracts topics, searches the public web, and synthesizes a context summary and comparison for a draft post. |
| **Key phrases** | Important terms or entities identified from the draft post text. |
| **Related topics** | Broader themes or subjects connected to the draft's content. |
| **Context summary** | A short narrative of what the current public/web conversation says about the extracted topics. |
| **Comparison** | A concise analysis of the user's draft relative to the context summary, noting angles covered, missing angles, tone differences, and claims to verify. |
| **Sources** | Citable search-result snippets returned by the tenant's Brave and/or Bing search providers, each with a title, URL, snippet, and provider name. |
| **AIProviderConnector** | The interface through which tenant AI providers (e.g., Azure OpenAI, Azure AI Language) are plugged into the core. |
| **RequestGate** | The per-tenant, per-provider rate-limiting mechanism used to isolate different workloads. |
| **Tenant-scoped** | All data and credentials are bound to a single tenant and protected by row-level security. |
| **`platform_admin`** | A platform-level administrator role that must not access tenant content. |
| **`searchForResearch`** | Internal helper functions in the Brave and Bing connectors that perform read-only, one-off web searches for the research pipeline. |

---

## 16. Appendices

### Reference documents

- [ADR-0076: Composer Deep Research Agent — Context Summary from Post Text, Key Phrases, and Search Results](../../../docs/adr/0076-composer-deep-research-agent.md)
- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../../../docs/adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md)
- [ADR-0065: Active Watchlist Sourcing via Brave Search API](../../../docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md)
- [ADR-0066: Active Watchlist Sourcing via Bing Search API](../../../docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md)
- [ADR-0038: AI Enrichment Provider Selection](../../../docs/adr/0038-ai-enrichment-provider-selection.md)
- [ADR-0028: Credential Creation Authority by Ownership Tier](../../../docs/adr/0028-credential-creation-authority-by-ownership-tier.md)
- [ADR-0015: Tenant Isolation via Postgres Row-Level Security](../../../docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md)
- [ADR-0003: Per-Tenant Per-Provider Rate Limiting](../../../docs/adr/0003-per-tenant-per-provider-rate-limiting.md)

### User stories

- [Story 2.31 — Brave and Bing one-off research search helpers](../../../docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 2.32 — Azure OpenAI `research?()` capability](../../../docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 3.17 — Composer deep research REST endpoint](../../../docs/user-stories/epic-3-data-model-storage-and-archival.md)
- [Story 6.41 — Composer Deep Research panel UI](../../../docs/user-stories/epic-6-tenant-admin-ui.md)

### Consulted product-research files

- [Composed post author mention suggestions](../../../docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md) — identifies the Composer Deep Research Agent as a dependency and reuses `AIProviderConnector.research?()`
- [AI enhancement opportunities](../../../docs/product-research/feature-designs/ai-enhancements.md) — lists the deep research agent under the Publishing and Scheduling capability
- [Semantic search / RAG](../../../docs/product-research/feature-designs/28-semantic-search-rag.md) — cites ADR-0076 as a research orchestrator and proposes a future RAG layer

### Missing sources

- No dedicated `docs/product-research/feature-designs/<composer-deep-research>.md` file was found for ADR-0076.
- No dedicated `docs/product-research/reports/<composer-deep-research>-deep-research.md` brief was found for ADR-0076.
- The BRD was derived from the ADR, the related user stories, and the consulted cross-cutting product-research files listed above.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-23 |
| Product Owner | Menno | | 2026-08-23 |
| Technical Lead | Menno | | 2026-08-23 |
| Other Stakeholder | | | |
