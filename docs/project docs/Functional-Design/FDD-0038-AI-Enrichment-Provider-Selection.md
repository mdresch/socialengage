# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0038 AI Enrichment Provider Selection — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md, ../Business-Requirements/BRD-0038-AI-Enrichment-Provider-Selection.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md and the business requirements in BRD-0038-AI-Enrichment-Provider-Selection.md into functional design for **AI Enrichment Provider Selection**.
SocialEngage's ingestion pipeline already defines an `AIProviderConnector` abstraction and an `enrichment` data shape, but no real provider had been connected. Downstream product capabilities — sentiment filtering, entity-based analytics, and key-phrase reporting — depend on `SocialPost.enrichment` being populated with real data. Without a concrete AI provider, the platform cannot deliver the social-listening value proposition described in the design spec.

This BRD captures the business decision documented in **ADR-0038**: select **Azure AI Language** as the first concrete `AIProviderConnector` implementation, and name a **general-purpose, Azure-hosted LLM** (ultimately Azure OpenAI Service) as the deliberate, sequenced second provider. This sequencing closes the functional gap immediately with a shape-matched, low-risk provider, while proving the abstraction's swappability with a structurally different extraction paradigm.

The expected business value is real, queryable enrichment data for every tenant; retention of the already-Azure-native operational, credential, and billing model; and a validated plug-in architecture that lets future AI models be swapped without re-engineering the ingestion pipeline.

---

### 2.2 Scope
**In scope:**
- Selection of Azure AI Language as the first concrete `AIProviderConnector`.
- Selection of an Azure-hosted LLM (Azure OpenAI Service) as the deliberate second provider to prove swappability.
- Implementation of `AIProviderConnector.analyze()` against Azure AI Language, returning `sentiment`, `sentimentScores`, `keyPhrases`, `entities`, `detectedLanguage`, and `modelUsed`.
- Wiring enrichment into the ingestion pipeline after content normalization.
- Tenant-owned, envelope-encrypted credential storage for each provider.
- Per-model rate limiting and retryable/non-retryable failure handling.
- Provider registration and failover behavior that does not alter core pipeline code.
- Manual re-enrichment endpoint (`POST /v1/posts/:id/enrich`) and feed display of enrichment fields.

**Out of scope:**
- Aspect-based or per-sentence sentiment in v1.
- Direct, non-Azure-hosted OpenAI or Anthropic API integrations as the primary path.
- Resolution of the GDPR/third-party-data-processing question for enrichment.
- Final binding of exact per-record pricing for Azure AI Language or the LLM tier; that remains an implementation-time cost-verification step.
- Automatic, full-corpus re-enrichment when new models deploy.

## 3. Context and Background
`docs/project docs/2026-07-28-social-listening-ingestion-design.md` §2/§3.1 names Azure AI Language as this project's own illustrative AI-enrichment provider (Azure-native tech stack, "Azure AI Language today; OpenAI, Claude, or others later"), and `SocialPost.enrichment`'s own shipped shape (`sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'`, `sentimentScores: { positive, neutral, negative }`, `keyPhrases: string[]`, `entities: { text, category, confidenceScore }[]`) is modeled directly on Azure AI Language's actual Text Analytics response shape — this is a materially stronger degree of prior specificity than existed for RSS/News before ADR-0026 (where only the *category* — poll-only, API-key, no paid tier — had been decided, no concrete provider). ADR-0028 (Accepted) separately resolved the credential-ownership/billing question specifically for this provider: `AIProviderConnector` credentials are tenant-owned, tier-2 (Tenant-Admin-created), cost settled directly between the tenant and Microsoft/Azure, no SocialEngage-operated shared subscription (ADR-0028 §1's "Resolved 2026-08-03" note; `Project Management Plans/Cost-Management-Plan.md` C-14).

Two things nonetheless make this a genuine, undecided ADR-level question rather than a settled implementation detail this story can build against silently:

1. **The design spec's own illustrative choice predates the current maturity of general-purpose-LLM structured output.** OpenAI's `strict: true` JSON-schema-constrained output (verified directly below) and comparable tool-use-based structured output from Anthropic's Claude models did not exist in a form mature enough to treat as a production-reliable alternative when the spec's worked example was written. Menno's own instruction is that this maturity shift is real and must be weighed now, not assumed away by the spec's original illustrative pick.
2. **A real, verified efficiency argument favors an LLM approach that nothing in this project's existing documents has weighed:** a single LLM call can plausibly return all four `enrichment` fields at once, where Azure AI Language's action-specific endpoints (the ones its own SDK guidance recommends for anything short of large/batch documents — see Decision §1 below) are typically called once per capability. This changes the real per-post latency and cost profile in a way worth a primary-source-grounded comparison, not a default assumption either way.

This is squarely the kind of decision this series reserves an ADR for: hard to reverse (`SocialPost.enrichment`'s shipped shape, and every downstream story that reads it — 4.1, 4.2, 5.1 — already assumes a specific field shape), a real vendor/data-flow/cost consequence, and — per Menno's own direct instruction — not to be settled by defaulting to the spec's illustrative example without a genuine comparison.
SocialEngage's ingestion pipeline already defines an `AIProviderConnector` abstraction and an `enrichment` data shape, but no real provider had been connected. Downstream product capabilities — sentiment filtering, entity-based analytics, and key-phrase reporting — depend on `SocialPost.enrichment` being populated with real data. Without a concrete AI provider, the platform cannot deliver the social-listening value proposition described in the design spec.

This BRD captures the business decision documented in **ADR-0038**: select **Azure AI Language** as the first concrete `AIProviderConnector` implementation, and name a **general-purpose, Azure-hosted LLM** (ultimately Azure OpenAI Service) as the deliberate, sequenced second provider. This sequencing closes the functional gap immediately with a shape-matched, low-risk provider, while proving the abstraction's swappability with a structurally different extraction paradigm.

The expected business value is real, queryable enrichment data for every tenant; retention of the already-Azure-native operational, credential, and billing model; and a validated plug-in architecture that lets future AI models be swapped without re-engineering the ingestion pipeline.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the `AIProviderConnector.analyze()` implementation gap | `SocialPost.enrichment` is populated by a real provider for every ingested post that has a connected tenant credential |
| 2 | Validate the provider-connector abstraction | A second `AIProviderConnector` is added and exercised without changes to core ingestion orchestration code |
| 3 | Preserve Azure-native operational consistency | Both providers run within the existing Azure subscription/credential envelope, with no new third-party vendor relationship required |
| 4 | Maintain tenant-owned cost and billing | No SocialEngage-operated shared AI subscription exists; each tenant uses its own provider account/credential |
| 5 | Keep enrichment additive to ingestion | A missing or failed AI provider does not block the base post-ingestion flow |

---

**Positive consequences (from ADR):**
**Positive**
- Closes the single largest functional gap in the product (no story anywhere implements `AIProviderConnector.analyze()` against a real provider) with a provider already shape-matched to shipped code, avoiding a costly reshape of `SocialPost.enrichment` under first-implementation pressure.
- Gives Menno's own LLM-based suggestion a real, primary-source-grounded evaluation and a concrete, reasoned place in this project's own roadmap (the second-provider swappability proof Phase 2 already calls for) rather than either adopting it uncritically or dismissing it.
- Keeps the credential/billing model exactly as ADR-0028 already resolved it — no new authorization or ownership-tier decision required for either candidate, provided the LLM candidate is pursued via its Azure-hosted form as recommended.

**Negative**
- **This ADR does not fully close the cost comparison Menno asked for** — Azure AI Language's own S-tier per-record price was not verified to this project's own primary-source bar this session; a real, material number is still missing before a confident production cost projection exists for either candidate.
- **Sequencing the LLM-based candidate second, not first, means the real efficiency win Menno identified (fewer round trips, likely lower cost) is not realized by Story 2.8 itself** — it is deliberately deferred to whichever future story builds the second `AIProviderConnector`, a real, named trade-off (lower first-implementation risk, later realized efficiency gain) rather than a costless sequencing choice.
- **The GDPR-adjacent third-party-data-processing question (Decision §4) is left open by this ADR**, the same way ADR-0018 already left tenant offboarding open — a real, accepted gap, not silently resolved by naming a provider.
- Building against Azure AI Language's per-capability call shape (rather than a single combined call) for a single small document, per Microsoft's own SDK guidance, means Story 2.8's own real per-post latency will be closer to several round trips than the single-call shape an LLM-based approach would offer — a real, accepted cost of sequencing the lower-risk provider first.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall register and use an Azure AI Language `AIProviderConnector` as the first AI enrichment provider. | Must | A real Azure AI Language call returns `sentiment`, `sentimentScores`, `keyPhrases`, `entities`, `detectedLanguage`, and `modelUsed` matching `SocialPost.enrichment`'s existing shape. | Technical Lead |
| BR-002 | The system shall wire enrichment into the ingestion pipeline after normalization. | Must | Each post written by the ingestion pipeline has `enrichment` populated on the same row; failure does not fail ingestion. | Technical Lead |
| BR-003 | The system shall support a second, Azure-hosted LLM `AIProviderConnector` to prove swappability. | Must | A second provider (Azure OpenAI Service) is registered and executes enrichment with no changes to core ingestion orchestration code. | Technical Lead |
| BR-004 | The system shall require a tenant-owned credential for each AI provider. | Must | Connector rejects operating without a tenant-supplied credential; no project-level/shared key fallback exists. | Product Owner |
| BR-005 | The system shall apply per-model rate limiting independently per tenant. | Must | Two tenants' enrichment calls are gated independently and do not share rate-limit capacity. | Technical Lead |
| BR-006 | The system shall handle provider failures and rate limits as retryable or non-retryable per existing policy. | Must | Transient failures retry with backoff; non-retryable failures leave `enrichment` absent and do not mark the post's ingestion as failed. | Technical Lead |
| BR-007 | The system shall support manual re-enrichment of a post via `POST /v1/posts/:id/enrich`. | Should | Authenticated tenant user can trigger re-enrichment; result overwrites the existing `enrichment` JSONB blob safely. | Product Owner |
| BR-008 | The post feed and analytics shall display enrichment-derived labels and filters. | Should | Sentiment chips and key-phrase/entity filters are visible in the post feed and usable in dashboard widgets. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Business Sponsor / Technical Lead) | Product owner and architect | High | Defensible, primary-source-grounded provider choice and validated abstraction |
| Tenant-Brand-Reputation-Manager | End user of sentiment/entity analytics | High | Real, accurate, explainable enrichment driving brand-health metrics |
| Tenant-Admin | Credential owner / budget controller | High | Use own Azure account; no unexpected SocialEngage billing |
| Tenant-User / Tenant-Reader | Post-feed consumer | Medium | Clear sentiment chips and confidence labels; no technical jargon |
| Platform Maintainer | Operator of the connector framework | Medium | Provider-agnostic registration, isolated per-tenant failures, and easy model swaps |
| Microsoft (Azure AI Language / Azure OpenAI) | Third-party service provider | Medium | Tenant-direct commercial relationship, API terms satisfied |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.8 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant relying on this platform's own enrichment promise (spec §2's "enriching posts with sentiment, entities, and key phrases"), I want ingested posts ac... | A registered `AIProviderConnector` (`providerId` distinct from any `SocialConnector`'s) authenticates against Azure AI Language using a per-tenant-supplied c... |
| Story 2.9 | epic-2-ingestion-connectors-and-rate-limits.md | As platform maintainer, I want a second, distinct `AIProviderConnector` implementation targeting an Azure-hosted LLM for enrichment tasks, so that `AIProvide... | A second `AIProviderConnector` implementation is added and registered alongside the existing Azure AI Language connector, implementing the full required inte... |
| Story 2.16 | epic-2-ingestion-connectors-and-rate-limits.md | As developer relying on `enrichPost.ts`'s own stated contract, I want a document Azure AI Language rejects to surface as a real, classified, loggable failure... | `callAnalyzeText()` (or `analyze()`, whichever proves the more direct fix point) checks each capability response for a present, analyzable document (`results... |
| Story 2.17 | epic-2-ingestion-connectors-and-rate-limits.md | As developer or future UI consumer of `SocialPost.enrichment`, I want a concise, LLM-generated summary of a post's content captured as part of the same struc... | `AnalyzeResult` (`types.ts`) gains an optional `summary?: string` field — additive, matching every prior widening of this interface; `azureAiLanguageConnecto... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `social_posts.enrichment` JSONB | Structured output from AI provider: sentiment, scores, key phrases, entities, language, model | Azure AI Language / Azure OpenAI | Tenant | Public-third-party content; may include names/opinions from posts |
| `credentials` (envelope-encrypted) | Tenant-owned provider endpoint and key; `owner_type = 'tenant'` | Tenant-supplied, stored by SocialEngage | Tenant Admin | Secret/key material |
| `connector_health` / `ingestion_runs` | Provider-specific health, rate-limit, and retry state | Generated by connector framework | Platform | Operational |
| `watchlist` / `post` relationship | Enrichment is used downstream for matching and filtering | Existing platform data | Tenant | Business data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A tenant must own and activate its own AI provider account and credential; SocialEngage stores and uses the credential only as a technical pass-through. |
| BRU-002 | SocialEngage shall not operate a shared AI subscription, accept payment for AI usage from tenants, or pay AI providers on tenants' behalf. |
| BRU-003 | AI enrichment is additive to post ingestion; a missing or failed enrichment must not block the base ingestion flow. |
| BRU-004 | All AI provider integrations must prefer the Azure-hosted route (Azure AI Language, Azure OpenAI Service) to preserve the existing operational and data-flow model. |
| BRU-005 | For cost proportionality, the first LLM provider candidate must target a cheap-tier model; escalation to a stronger model is allowed only if a real accuracy gap is demonstrated. |
| BRU-006 | Exact model version and pricing tier are implementation-time decisions, not architecture requirements, and must be verified against primary sources before production commitment. |
| BRU-007 | The `SocialPost.enrichment` data shape already shipped and is depended on by downstream stories; the first provider must map to it without reshaping. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AIProviderConnector` interface (Story 2.1 / ADR-0002) | Internal | Technical Lead | Already built |
| D-002 | Envelope-encrypted credential storage (ADR-0014) | Internal | Technical Lead | Already built |
| D-003 | Tenant-owned credential and billing model (ADR-0027 / ADR-0028) | Internal / Policy | Product Owner | Already accepted |
| D-004 | Retryable/non-retryable error policy (ADR-0010 / ADR-0023) | Internal | Technical Lead | Already built |
| D-005 | Azure AI Language service and tenant subscription | External | Tenant Admin | Tenant-supplied |
| D-006 | Azure OpenAI Service resource and `gpt-5-mini` availability | External | Tenant Admin | For Story 2.9 |
| D-007 | `docs/product-research/feature-designs/03-ai-sentiment-analysis.md` | Reference | Product Owner | Already exists |
| D-008 | Tenant offboarding / GDPR resolution (ADR-0039) | Internal / Legal | Product Owner | Future work |

---

- Azure AI Language and Azure OpenAI Service remain available and commercially usable under tenant-owned Azure subscriptions.
- The `AIProviderConnector` interface from Story 2.1 is stable enough to support two providers.
- Tenants are willing to create and supply their own AI-service credentials (tier-2, Tenant-Admin-created).

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | AI enrichment must stay within the Azure-native operational and credential model. | Architecture | Must | Both providers use Azure-hosted endpoints, Key Vault credentials, and tenant-owned Azure subscriptions. |
| NFR-002 | Provider failures must not break ingestion for the entire tenant or platform. | Reliability | Must | A failed or missing provider credential results in unpopulated enrichment only; post insertion succeeds. |
| NFR-003 | Provider-connector additions must require only registration, not core pipeline changes. | Maintainability | Must | Adding the second provider is verified by contract tests to require no edits to `runIngestionAttempt()` or equivalent. |
| NFR-004 | Cost must be proportionate to the task and charged to the tenant. | Cost | Must | No SocialEngage-operated shared subscription; per-tenant cost is settled directly with Microsoft. |
| NFR-005 | Enrichment output must be schema-conformant and deterministic for a given input/model. | Quality | Should | `AnalyzeResult` contract tests assert valid enum values, required fields, and type correctness. |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes the single largest functional gap in the product (no story anywhere implements `AIProviderConnector.analyze()` against a real provider) with a provider already shape-matched to shipped code, avoiding a costly reshape of `SocialPost.enrichment` under first-implementation pressure.
- Gives Menno's own LLM-based suggestion a real, primary-source-grounded evaluation and a concrete, reasoned place in this project's own roadmap (the second-provider swappability proof Phase 2 already calls for) rather than either adopting it uncritically or dismissing it.
- Keeps the credential/billing model exactly as ADR-0028 already resolved it — no new authorization or ownership-tier decision required for either candidate, provided the LLM candidate is pursued via its Azure-hosted form as recommended.

**Negative**
- **This ADR does not fully close the cost comparison Menno asked for** — Azure AI Language's own S-tier per-record price was not verified to this project's own primary-source bar this session; a real, material number is still missing before a confident production cost projection exists for either candidate.
- **Sequencing the LLM-based candidate second, not first, means the real efficiency win Menno identified (fewer round trips, likely lower cost) is not realized by Story 2.8 itself** — it is deliberately deferred to whichever future story builds the second `AIProviderConnector`, a real, named trade-off (lower first-implementation risk, later realized efficiency gain) rather than a costless sequencing choice.
- **The GDPR-adjacent third-party-data-processing question (Decision §4) is left open by this ADR**, the same way ADR-0018 already left tenant offboarding open — a real, accepted gap, not silently resolved by naming a provider.
- Building against Azure AI Language's per-capability call shape (rather than a single combined call) for a single small document, per Microsoft's own SDK guidance, means Story 2.8's own real per-post latency will be closer to several round trips than the single-call shape an LLM-based approach would offer — a real, accepted cost of sequencing the lower-risk provider first.

## 12. Assumptions and Dependencies
- Azure AI Language and Azure OpenAI Service remain available and commercially usable under tenant-owned Azure subscriptions.
- The `AIProviderConnector` interface from Story 2.1 is stable enough to support two providers.
- Tenants are willing to create and supply their own AI-service credentials (tier-2, Tenant-Admin-created).

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure AI Language's exact per-record S-tier price remains unverified | Medium | Medium | Verify directly against `azure.microsoft.com/en-us/pricing/details/language/` before production cost planning | Product Owner |
| R-002 | LLM self-reported confidence may not match the calibrated-probability semantics `SocialPost.enrichment` implies | Medium | Medium | Validate the second provider's output against Azure AI Language on a real sample; document any field-semantics clarification when the second provider is added | Technical Lead |
| R-003 | Sending post content to a third party raises GDPR/data-processing questions | Medium | High | Track as an open item; resolve alongside the tenant offboarding/right-to-erasure work (ADR-0039 / `docs/open-items-and-deferred-work.md` §C) | Product Owner |
| R-004 | Azure AI Language's per-capability call shape for small documents creates more round trips than a single LLM call | High (accepted) | Medium | Sequence the lower-risk provider first; realize the single-call efficiency with the second provider | Technical Lead |
| R-005 | Chosen LLM model may deprecate or change pricing before production | Medium | Medium | Use `list-models` and the Azure Retail Prices API at provisioning time; document model-selection drift in the ADR/BRD amendment log | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md`
- BRD: `../Business-Requirements/BRD-0038-AI-Enrichment-Provider-Selection.md`
- Feature design: `docs/product-research/feature-designs/03-ai-sentiment-analysis.md``
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above