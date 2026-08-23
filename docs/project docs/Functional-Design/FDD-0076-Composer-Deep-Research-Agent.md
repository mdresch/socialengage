# Business Requirements Document — ADR-0076: Composer Deep Research Agent

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — ADR-0076: Composer Deep Research Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0076-composer-deep-research-agent.md, ../Business-Requirements/BRD-0076-Composer-Deep-Research-Agent.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0076-composer-deep-research-agent.md and the business requirements in BRD-0076-Composer-Deep-Research-Agent.md into functional design for **Composer Deep Research Agent**.
Social-engagement authors currently draft messages in the Polypost Composer without a quick, tenant-safe way to check what the broader public conversation is saying about the topics in their post. Before publishing, they must leave the product and manually research news, blogs, and social sources, or risk publishing a message that is misaligned, stale, or factually unsupported.

The **Composer Deep Research Agent** adds an on-demand research capability to the Polypost Composer. A tenant user can click a **Deep Research** button while drafting a post; the agent extracts key phrases and related topics from the draft, runs one-off web searches through the tenant's own Brave and/or Bing search providers, and returns a concise context summary and a side-by-side comparison of the user's draft against the public conversation. Every summary is backed by a list of citable web sources, and the entire operation runs on the tenant's own provider credentials so that data ownership and cost remain with the tenant.

This initiative is expected to increase message quality, reduce manual research time, and strengthen the composer's value as an intelligence layer for tenant-brand, social-selling, and social-care users.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Caching, persistence, or history of research results.
- Asynchronous or background research jobs; scheduled or repeated research.
- Media, image, video, or attachment analysis; v1 uses the draft text only.
- A generic `SearchProvider` connector abstraction (deferred to ADR-0120).
- Streaming or multi-turn research output.
- Client-side mock or fallback data for research results.
- Full-page fetching or content extraction beyond the snippets returned by Brave/Bing.

## 3. Context and Background
**Status:** Accepted (2026-08-23)

**Accepted by Menno 2026-08-23.** Authorizes a new on-demand "Deep Research" capability inside the Polypost Composer that reads the post the user is drafting, extracts key phrases and topics, runs one-off search queries through the tenant's connected Brave/Bing search providers, and returns a concise context summary the author can compare against their own message.

**Source:** Menno request (2026-08-22): *"in the composer page have a deep research AI Agent review the post message and underneath have the deep research findings summarized for the end user to compare to their own post. The deep research agent should pull the details from the post message in the composer and perform some key phrasses found in the message and do search queiries on similarity and related topics and the topics that are described in the posts. The outcome from the search agents should be used by the deep research agent to search for relevant context in the final summary for the end users."*

---
Social-engagement authors currently draft messages in the Polypost Composer without a quick, tenant-safe way to check what the broader public conversation is saying about the topics in their post. Before publishing, they must leave the product and manually research news, blogs, and social sources, or risk publishing a message that is misaligned, stale, or factually unsupported.

The **Composer Deep Research Agent** adds an on-demand research capability to the Polypost Composer. A tenant user can click a **Deep Research** button while drafting a post; the agent extracts key phrases and related topics from the draft, runs one-off web searches through the tenant's own Brave and/or Bing search providers, and returns a concise context summary and a side-by-side comparison of the user's draft against the public conversation. Every summary is backed by a list of citable web sources, and the entire operation runs on the tenant's own provider credentials so that data ownership and cost remain with the tenant.

This initiative is expected to increase message quality, reduce manual research time, and strengthen the composer's value as an intelligence layer for tenant-brand, social-selling, and social-care users.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Give tenant authors reliable, real-world context before they publish a post | A tenant user can trigger deep research and receive a context summary, comparison, and sources for any draft with at least 10 non-whitespace characters |
| 2 | Protect tenant data ownership and control provider costs | All web-search and AI calls consume the tenant's own Brave/Bing and Azure OpenAI credentials; no SocialEngage-owned shared service is used |
| 3 | Improve author confidence and reduce factually unsupported posts | Returned results include direct source links so authors can verify claims before publishing |
| 4 | Extend the Polypost Composer from a drafting tool to a pre-publish intelligence layer | Deep Research is available as a first-class control inside the composer, integrated with the existing UI patterns (toolbar, panel, proxy route) |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User (primary) | Drafts and publishes posts in the Polypost Composer | High | One-click research, readable summary, verifiable sources, fast enough to not break flow |
| Social-Selling / Brand Strategist | Uses the composer for outreach and thought leadership | High | Confidence that the angle is relevant and not duplicated; easy citation |
| Tenant-Brand-Reputation Manager | Wants to avoid misinformation or tone mismatches | High | Comparison against current conversation; ability to spot missing or overstated angles |
| Tenant-Social-Care Agent | May use research before replying publicly (future) | Medium | Quick context on a topic or complaint |
| Product Team | Owns the composer roadmap | Medium | Reuses accepted architecture, stays within scope, produces measurable usage |
| Operations / Platform Admin | Monitors cost, rate limits, and tenant isolation | Medium | Research traffic isolated from ingestion; costs billed to tenant accounts |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.31 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer, I want internal one-off search helpers inside the Brave and Bing connectors, so that the composer deep research endpoint can run li... | See epic file. |
| Story 2.32 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer, I want an optional `research?()` method on `AIProviderConnector` that Azure OpenAI implements, so that the composer deep research e... | See epic file. |
| Story 3.17 | epic-3-data-model-storage-and-archival.md | As tenant user, I want a `POST /v1/composer/research` endpoint in `social-listening-core`, so that I can submit my draft post text and receive a deep-researc... | See epic file. |
| Story 6.41 | epic-6-tenant-admin-ui.md | As tenant user, I want a "Deep Research" button and panel inside the Polypost Composer, so that I can compare my draft post against the public conversation s... | See epic file. |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The Polypost Composer (`ADR-0072`) and the `tenant/compose` page are already built.
- Tenant identity resolution and role gating are available through the existing authentication stack.
- Brave/Bing search provider credentials and Azure OpenAI credentials can already be activated per tenant.
- The `AIProviderConnector` optional-method pattern (`reply?()`, `publish?()`) is acceptable for adding `research?()`.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Research results shall not persist or be cached in v1 | Security / Compliance | Must | No `social_posts`, `post_watchlist_matches`, or UI localStorage writes occur as a result of a research call; the result is returned and displayed ephemerally |
| NFR-002 | All AI and search calls shall use the tenant's own connected credentials | Security / Compliance | Must | Contract tests verify that research calls do not fall back to a shared, SocialEngage-owned service |
| NFR-003 | The endpoint shall be scoped to the caller's tenant through row-level security and identity resolution | Security | Must | `platform_admin` is rejected; no tenant data leaks to another tenant |
| NFR-004 | The research endpoint shall be synchronous and return within a time window that keeps the composer usable | Performance | Should | End-to-end response completes within a single HTTP request; failure modes are visible and recoverable for the user |
| NFR-005 | Errors from search providers shall be classified using the same taxonomy as the existing Brave/Bing polling connectors | Reliability | Should | `http_401`, `http_403`, `rate_limited`, `http_5xx` are mapped to `ClassifiableError` so the research endpoint can surface them cleanly |
| NFR-006 | The implementation shall reuse the existing `AIProviderConnector` optional-method pattern without duplicating the connector interface | Maintainability | Should | `research?()` is added to `AIProviderConnector`; Azure OpenAI implements it; Azure AI Language does not |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The Polypost Composer (`ADR-0072`) and the `tenant/compose` page are already built.
- Tenant identity resolution and role gating are available through the existing authentication stack.
- Brave/Bing search provider credentials and Azure OpenAI credentials can already be activated per tenant.
- The `AIProviderConnector` optional-method pattern (`reply?()`, `publish?()`) is acceptable for adding `research?()`.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The synchronous multi-call pipeline (extraction + search + synthesis) is slow and expensive per call | High | Medium | Restrict v1 to explicit user-triggered research, enforce caps, use a dedicated `RequestGate`, and defer caching/background to later ADR | Product Owner |
| R-002 | The feature is unusable for tenants without an active Azure OpenAI connector | Medium | High | UI disables the button with a clear tooltip; error state explains the missing AI provider | Product Owner |
| R-003 | Research results can become stale immediately after generation | Medium | Low | Keep v1 ephemeral with no cache; users can re-trigger research when they update the draft | Product Owner |
| R-004 | A tenant's draft text and search data are sent to an external AI service | Medium | High | Use the tenant's own Azure OpenAI credential, never a shared service; keep data within the tenant's trust boundary | Technical Lead |
| R-005 | The LLM may produce incomplete or inaccurate context, or hallucinate claims | Medium | High | Always return citable `sources`; comparison language is framed as suggestions for the user to verify, not as fact | Product Owner |
| R-006 | Research bursts could starve ingestion polls on shared rate-limit infrastructure | Low | Medium | Use a separate `research` `RequestGate` key so ingestion, reply, and publish traffic are not affected | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0076-composer-deep-research-agent.md`
- BRD: `../Business-Requirements/BRD-0076-Composer-Deep-Research-Agent.md`
- Feature design: `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- Feature design: `docs/product-research/feature-designs/ai-enhancements.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Feature design: `docs/product-research/feature-designs/<composer-deep-research>.md``
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Deep research: `docs/product-research/reports/<composer-deep-research>-deep-research.md``
- User stories: see extracted stories above