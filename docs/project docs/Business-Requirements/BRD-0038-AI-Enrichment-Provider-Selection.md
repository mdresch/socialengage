# Business Requirements Document — AI Enrichment Provider Selection

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – AI Enrichment Provider Selection – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Technical Lead) |
| Status | Accepted |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | BRD Writer Agent | Initial draft from ADR-0038, feature design 03, and Epic 2 stories 2.8/2.9 |

---

## 2. Executive Summary

SocialEngage's ingestion pipeline already defines an `AIProviderConnector` abstraction and an `enrichment` data shape, but no real provider had been connected. Downstream product capabilities — sentiment filtering, entity-based analytics, and key-phrase reporting — depend on `SocialPost.enrichment` being populated with real data. Without a concrete AI provider, the platform cannot deliver the social-listening value proposition described in the design spec.

This BRD captures the business decision documented in **ADR-0038**: select **Azure AI Language** as the first concrete `AIProviderConnector` implementation, and name a **general-purpose, Azure-hosted LLM** (ultimately Azure OpenAI Service) as the deliberate, sequenced second provider. This sequencing closes the functional gap immediately with a shape-matched, low-risk provider, while proving the abstraction's swappability with a structurally different extraction paradigm.

The expected business value is real, queryable enrichment data for every tenant; retention of the already-Azure-native operational, credential, and billing model; and a validated plug-in architecture that lets future AI models be swapped without re-engineering the ingestion pipeline.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the `AIProviderConnector.analyze()` implementation gap | `SocialPost.enrichment` is populated by a real provider for every ingested post that has a connected tenant credential |
| 2 | Validate the provider-connector abstraction | A second `AIProviderConnector` is added and exercised without changes to core ingestion orchestration code |
| 3 | Preserve Azure-native operational consistency | Both providers run within the existing Azure subscription/credential envelope, with no new third-party vendor relationship required |
| 4 | Maintain tenant-owned cost and billing | No SocialEngage-operated shared AI subscription exists; each tenant uses its own provider account/credential |
| 5 | Keep enrichment additive to ingestion | A missing or failed AI provider does not block the base post-ingestion flow |

---

## 4. Scope

### 4.1 In Scope

- Selection of Azure AI Language as the first concrete `AIProviderConnector`.
- Selection of an Azure-hosted LLM (Azure OpenAI Service) as the deliberate second provider to prove swappability.
- Implementation of `AIProviderConnector.analyze()` against Azure AI Language, returning `sentiment`, `sentimentScores`, `keyPhrases`, `entities`, `detectedLanguage`, and `modelUsed`.
- Wiring enrichment into the ingestion pipeline after content normalization.
- Tenant-owned, envelope-encrypted credential storage for each provider.
- Per-model rate limiting and retryable/non-retryable failure handling.
- Provider registration and failover behavior that does not alter core pipeline code.
- Manual re-enrichment endpoint (`POST /v1/posts/:id/enrich`) and feed display of enrichment fields.

### 4.2 Out of Scope

- Aspect-based or per-sentence sentiment in v1.
- Direct, non-Azure-hosted OpenAI or Anthropic API integrations as the primary path.
- Resolution of the GDPR/third-party-data-processing question for enrichment.
- Final binding of exact per-record pricing for Azure AI Language or the LLM tier; that remains an implementation-time cost-verification step.
- Automatic, full-corpus re-enrichment when new models deploy.

### 4.3 Assumptions

- Azure AI Language and Azure OpenAI Service remain available and commercially usable under tenant-owned Azure subscriptions.
- The `AIProviderConnector` interface from Story 2.1 is stable enough to support two providers.
- Tenants are willing to create and supply their own AI-service credentials (tier-2, Tenant-Admin-created).

### 4.4 Constraints

- The platform is Azure-native (Postgres, Key Vault, Entra, Azure AI services).
- The project is solo/self-funded, so cost proportionality is required for any provider.
- `SocialPost.enrichment`'s data shape is already shipped and depended on by Stories 4.1, 4.2, and 5.1; reshaping it is costly.
- SocialEngage must never act as a billing intermediary for AI services.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Business Sponsor / Technical Lead) | Product owner and architect | High | Defensible, primary-source-grounded provider choice and validated abstraction |
| Tenant-Brand-Reputation-Manager | End user of sentiment/entity analytics | High | Real, accurate, explainable enrichment driving brand-health metrics |
| Tenant-Admin | Credential owner / budget controller | High | Use own Azure account; no unexpected SocialEngage billing |
| Tenant-User / Tenant-Reader | Post-feed consumer | Medium | Clear sentiment chips and confidence labels; no technical jargon |
| Platform Maintainer | Operator of the connector framework | Medium | Provider-agnostic registration, isolated per-tenant failures, and easy model swaps |
| Microsoft (Azure AI Language / Azure OpenAI) | Third-party service provider | Medium | Tenant-direct commercial relationship, API terms satisfied |

---

## 6. Current State (As-Is)

The `AIProviderConnector` interface exists but has no real provider implementation. `SocialPost.enrichment` is defined in the data model, but posts are persisted without enrichment data. Several downstream user stories — 4.1 (watchlist matching), 4.2 (post search/filter), and 5.1 (post API) — already assume `enrichment.sentiment`, `enrichment.keyPhrases`, and `enrichment.entities` are populated. The design spec originally named Azure AI Language only as an illustrative example; a real, comparable evaluation of general-purpose LLM structured extraction had not been performed.

**Pain points:**
- The largest remaining functional gap in ingestion: a defined AI connector with no real backend.
- Downstream product features cannot function as designed without populated enrichment.
- A default-to-Azure-AI-Language decision risked ignoring the genuine cost and latency advantages of a single-call LLM extractor.
- Credential/billing ownership for AI providers needed explicit confirmation across both provider candidates.

---

## 7. Future State (To-Be)

After this initiative, every ingested post whose tenant has connected a provider credential will pass through `enrichPost()` after normalization. `enrichPost()` is provider-agnostic: it invokes the registered `AIProviderConnector.analyze()` implementation and writes the returned structured enrichment into `social_posts.enrichment`. Azure AI Language is the first operational provider. A second, Azure OpenAI Service-based connector proves the interface's swappability without touching the ingestion orchestration code.

**Expected capabilities:**
- Real, queryable sentiment, key-phrase, entity, and language data in `SocialPost.enrichment`.
- Tenant-scoped provider credentials stored with the same envelope-encrypted, Key-Vault-backed mechanism used by GNews and Newswire.
- Per-tenant, per-model rate limiting and independent failure handling.
- Live ingestion and manual re-enrichment both use the same `enrichPost()` path.
- A validated plug-in path for future AI providers.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | AI enrichment must stay within the Azure-native operational and credential model. | Architecture | Must | Both providers use Azure-hosted endpoints, Key Vault credentials, and tenant-owned Azure subscriptions. |
| NFR-002 | Provider failures must not break ingestion for the entire tenant or platform. | Reliability | Must | A failed or missing provider credential results in unpopulated enrichment only; post insertion succeeds. |
| NFR-003 | Provider-connector additions must require only registration, not core pipeline changes. | Maintainability | Must | Adding the second provider is verified by contract tests to require no edits to `runIngestionAttempt()` or equivalent. |
| NFR-004 | Cost must be proportionate to the task and charged to the tenant. | Cost | Must | No SocialEngage-operated shared subscription; per-tenant cost is settled directly with Microsoft. |
| NFR-005 | Enrichment output must be schema-conformant and deterministic for a given input/model. | Quality | Should | `AnalyzeResult` contract tests assert valid enum values, required fields, and type correctness. |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `social_posts.enrichment` JSONB | Structured output from AI provider: sentiment, scores, key phrases, entities, language, model | Azure AI Language / Azure OpenAI | Tenant | Public-third-party content; may include names/opinions from posts |
| `credentials` (envelope-encrypted) | Tenant-owned provider endpoint and key; `owner_type = 'tenant'` | Tenant-supplied, stored by SocialEngage | Tenant Admin | Secret/key material |
| `connector_health` / `ingestion_runs` | Provider-specific health, rate-limit, and retry state | Generated by connector framework | Platform | Operational |
| `watchlist` / `post` relationship | Enrichment is used downstream for matching and filtering | Existing platform data | Tenant | Business data |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Enrichment coverage rate | Share of ingested posts with populated `enrichment` per provider | Product team / Platform maintainer | Daily |
| Provider usage by tenant | Track per-tenant AI call volume for cost and health | Platform maintainer / Tenant Admin | Daily |
| Average enrichment latency | Monitor per-post round-trip time and capacity planning | Technical Lead | Real-time / hourly |
| Sentiment distribution | Count of positive/negative/neutral/mixed posts per watchlist | Brand Reputation Manager | On-demand |
| Entity and key-phrase frequency | Identify trending topics and entities | Brand Reputation Manager / Analyst | On-demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure AI Language's exact per-record S-tier price remains unverified | Medium | Medium | Verify directly against `azure.microsoft.com/en-us/pricing/details/language/` before production cost planning | Product Owner |
| R-002 | LLM self-reported confidence may not match the calibrated-probability semantics `SocialPost.enrichment` implies | Medium | Medium | Validate the second provider's output against Azure AI Language on a real sample; document any field-semantics clarification when the second provider is added | Technical Lead |
| R-003 | Sending post content to a third party raises GDPR/data-processing questions | Medium | High | Track as an open item; resolve alongside the tenant offboarding/right-to-erasure work (ADR-0039 / `docs/open-items-and-deferred-work.md` §C) | Product Owner |
| R-004 | Azure AI Language's per-capability call shape for small documents creates more round trips than a single LLM call | High (accepted) | Medium | Sequence the lower-risk provider first; realize the single-call efficiency with the second provider | Technical Lead |
| R-005 | Chosen LLM model may deprecate or change pricing before production | Medium | Medium | Use `list-models` and the Azure Retail Prices API at provisioning time; document model-selection drift in the ADR/BRD amendment log | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A registered `AIProviderConnector` authenticates against Azure AI Language using a tenant-owned, envelope-encrypted credential and returns `SocialPost.enrichment` in the existing shape.
- Enrichment is wired into the ingestion pipeline after normalization, populating the same `SocialPost` row without a separate out-of-band update.
- A missing or failed provider credential leaves `enrichment` absent but does not fail base post ingestion.
- Per-model rate limiting and retryable/non-retryable failure handling are proven per tenant.
- A second `AIProviderConnector` (Azure OpenAI Service) is registered and exercised with no changes to core ingestion orchestration.
- Provider swap and removal do not degrade tenants using another provider.
- Manual re-enrichment via `POST /v1/posts/:id/enrich` is safe and idempotent.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `AIProviderConnector` | The provider-connector abstraction that enriches a post with sentiment, key phrases, entities, and language. |
| `enrichment` | The JSONB `social_posts.enrichment` blob containing AI-derived analysis results. |
| Tenant-owned credential | A provider API key/endpoint held by the tenant and stored by SocialEngage only as a technical pass-through. |
| Tier-2 credential | A connector credential owned by the tenant and created by a Tenant Admin (per ADR-0028). |
| Text record | Azure AI Language's billing unit, up to 1,000 characters per record; longer documents count as multiple records. |
| Structured output / JSON schema | A model output constrained to a declared JSON schema, with guaranteed field presence and type validity. |
| Provider swappability | The ability to add or switch `AIProviderConnector` implementations without altering core ingestion code. |

---

## 16. Appendices

### Reference documents
- **ADR-0038:** `docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md` — the accepted architecture decision this BRD is based on.
- **Feature design 03 — AI sentiment analysis:** `docs/product-research/feature-designs/03-ai-sentiment-analysis.md` — end-user benefits, persona acceptance, and open questions.
- **Epic 2 — Ingestion, Connectors & Rate Limits:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — contains Story 2.8 and Story 2.9.
- **Implementation plan:** `docs/implementation-plan.md` — Phase 2 placement of enrichment wiring and second-provider validation.
- **Ingestion design spec:** `docs/project docs/2026-07-28-social-listening-ingestion-design.md` §2/§3.1 — original illustrative Azure AI Language placement.

### Related user stories
- **Story 2.1** — `AIProviderConnector` interface and `enrichPost()` pipeline hook.
- **Story 2.2** — Per-model rate limiting.
- **Story 2.3 / 2.5** — Retryable and non-retryable error handling.
- **Story 2.8** — Concrete Azure AI Language `AIProviderConnector`.
- **Story 2.9** — Azure OpenAI Service second `AIProviderConnector` swappability validation.
- **Story 4.1 / 4.2 / 5.1** — Downstream consumers of `SocialPost.enrichment`.
- **Story 6.16** — Manual re-enrichment endpoint.

### Missing source
- **No deep-research brief exists** for `03-ai-sentiment-analysis` or for `AI enrichment provider selection` in `docs/product-research/reports/` at the time this BRD was produced. The business case, pricing, and competitive analysis are drawn directly from the primary-source research recorded in ADR-0038.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno |  |  |
| Product Owner | Menno |  |  |
| Technical Lead | Menno |  |  |
| Other Stakeholder |  |  |  |
