# Business Requirements Document (BRD) – AI Sentiment Analysis Aspect Schema

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – AI Sentiment Analysis Aspect Schema BRD |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (derived from ADR-0103 and related artifacts) |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft for review — ADR-0103 is currently Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0103, feature design 03, and Epic 12 stories |

---

## 2. Executive Summary

Social listening currently produces a single `sentiment` string for each post, which is too coarse for users who need to understand *what* a post is positive or negative about. This Business Requirements Document captures the business need for a richer, aspect-based sentiment schema stored in `social_posts.enrichment.sentiment`, with per-language support, confidence scores, and a human-override path.

The proposed solution introduces a canonical `enrichment.sentiment` object that carries an `overall` label, a numeric `confidence` score, the detected `language`, an optional array of `aspects` (each with its own label, confidence, and evidence text), and an `overridden` audit block when a human corrects the result. This allows brand-reputation managers, social-care agents, and analysts to triage mentions more precisely, track sentiment shifts by topic or product area, and trust the underlying AI output because corrections are visible and preserved.

The expected business value is faster triage, more actionable analytics, and a foundation for explainable sentiment widgets in the post feed and dashboard. It also unblocks downstream capabilities such as real-time alerts and daily digests that already consume `sentiment`.

**Note:** The source ADR-0103 is currently **Proposed**. This BRD is a draft for review and will be finalized after ADR acceptance.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make sentiment signals more actionable by exposing what a post is positive/negative about | Users can identify negative- or positive-aspect trends without reading every post |
| 2 | Support multi-language listening with per-post language attribution | Sentiment is queryable and aggregatable by `language` |
| 3 | Preserve human judgment through a visible override path | Analyst corrections are recorded in `overridden` and used by downstream features |
| 4 | Maintain backward compatibility with existing `sentiment` data and queries | Existing strings migrate to the new object shape without breaking dashboards |

---

## 4. Scope

### 4.1 In Scope

- A new canonical `enrichment.sentiment` object with `overall`, `confidence`, `language`, optional `aspects`, and optional `overridden` fields.
- `AIProviderConnector.analyzeSentiment()` contract capable of returning aspect-based sentiment.
- Provider-agnostic support for Azure AI Language and Azure OpenAI.
- Automatic language detection when `language` is not supplied.
- Human override semantics via `PATCH /v1/posts/:id/enrichment`.
- Backward compatibility: migration of existing string `sentiment` values to the new object shape.
- Query guidance for dashboards and filters using `enrichment->'sentiment'->>'overall'`.
- Aspect aggregation as a future-queryable structure (`sentiment.aspects[].label`).

### 4.2 Out of Scope

- Aspect-level daily rollups in `SentimentDailyCount` (ADR-0087) for v1; only `overall` counts are required.
- Continuous sentiment scores (-1 to +1) in v1.
- Storing the full, provider-specific raw AI response in `enrichment`.
- Free-form vs. fixed aspect-category decision in v1 (open question).
- Emotion, sarcasm, or zero-shot multilingual capabilities beyond the chosen schema shape.

### 4.3 Assumptions

- `enrichPost()` and `AIProviderConnector` already exist (Story 2.1, ADR-0002).
- `PATCH /v1/posts/:id/enrichment` human-override path already exists (ADR-0071).
- `SentimentDailyCount` (ADR-0087) already produces `overall` counts.
- Downstream consumers (alerts, dashboard, daily digest) can be updated to read the new `sentiment` object.

### 4.4 Constraints

- The schema must remain queryable and aggregatable in Postgres JSONB.
- The change must not break existing dashboards, filters, or API responses that read `enrichment.sentiment`.
- The provider-agnostic contract must not leak Azure-specific payload shapes into the canonical stored object.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Brand-Reputation-Manager | Primary user of sentiment trend and volume views | High | Understand what is driving negative or positive shifts at a glance |
| Tenant-Reader | Consumer of post list and detail views | High | See sentiment labels with confidence and evidence without technical context |
| Tenant-User | Operator who filters posts and triggers re-enrichment | Medium | Filter by `overall` and, later, by aspect; correct sentiment when wrong |
| Tenant-Social-Care-Agent | Inbox triage and response user | Medium | Sort by negative `overall` and confidence; see aspect-level complaints |
| Topic-Center-Analyst | Correlates topic volume with sentiment | Medium | Link sentiment change to deteriorating themes and aspects |
| Platform-Admin | Operates the multi-tenant service | Low | Provider-agnostic enrichment does not introduce per-tenant data leakage |

---

## 6. Current State (As-Is)

**Current process:**
1. A post is ingested and `enrichPost()` calls `AIProviderConnector.analyze()`.
2. The provider returns `sentiment`, `keyPhrases`, and `entities`.
3. The `sentiment` value is stored as a plain string in `social_posts.enrichment.sentiment`.
4. The post feed, filters, dashboard, and downstream features read that string.

**Pain points:**
- A single `positive`/`negative`/`neutral` label cannot distinguish “positive about price, negative about support.”
- There is no stored confidence, language, or evidence to support or explain the label.
- Analysts can override enrichment (ADR-0071), but the sentiment schema does not have a dedicated override shape.
- Downstream features that want aspect-level aggregation have no structured source to query.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A post is ingested and `enrichPost()` invokes `AIProviderConnector.analyzeSentiment(text, language?)`.
2. The provider returns the canonical `enrichment.sentiment` object: `overall`, `confidence`, `language`, optional `aspects`, and an `overridden` block if corrected.
3. The object is stored in `social_posts.enrichment.sentiment` JSONB.
4. The post feed shows `overall` plus an aspect list; the dashboard groups by `overall` or aspect; downstream alerts and digests consume `overall` or `aspects`.
5. An analyst with permission can `PATCH /v1/posts/:id/enrichment` to change `sentiment.overall` or `sentiment.aspects`; the `overridden` block is added, `enrichment.override` is set to `true`, and dashboards use the corrected value.

**Expected capabilities:**
- Aspect-level sentiment (“positive about product, negative about support”).
- Confidence and language surfaced per post.
- Human override with audit history preserved.
- Backward-compatible queries for `overall` while aspect queries are enabled.
- Provider-agnostic contract ready for Azure AI Language and Azure OpenAI.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store `enrichment.sentiment` as a canonical object with `overall`, `confidence`, `language`, optional `aspects`, and optional `overridden` fields | Must | Schema matches ADR-0103 and passes contract tests | Product Owner |
| BR-002 | The system shall allow `AIProviderConnector.analyzeSentiment(text, language?)` to return aspect-based sentiment and confidence | Must | Azure AI Language and Azure OpenAI both return the canonical shape | Product Owner |
| BR-003 | The system shall detect the post language when it is not supplied to the provider | Should | Provider returns `language` for known input; `unknown` for unanalyzable text | Product Owner |
| BR-004 | The system shall support human override of `sentiment.overall` and `sentiment.aspects` via `PATCH /v1/posts/:id/enrichment` | Must | `overridden` block is recorded and `enrichment.override` becomes `true` | Product Owner |
| BR-005 | The system shall migrate existing string `sentiment` values to the new object shape on read or edit | Must | Old `{ overall: <old>, confidence: 0.5 }` shape is produced without loss | Product Owner |
| BR-006 | The system shall keep queries that filter by `sentiment` working against the new object | Must | `enrichment->'sentiment'->>'overall'` returns the label | Product Owner |
| BR-007 | The system shall enable dashboards to group by `overall` and, structurally, by aspect label | Should | `sentiment.aspects[].label` is queryable and aggregatable | Product Owner |
| BR-008 | The UI shall show `overall` sentiment, a confidence badge, and a list of aspects with evidence | Should | Post detail and dashboard widgets render the new fields | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The new schema must not break existing `sentiment` consumers | Compatibility | Must | All existing contract tests for post feed, filters, and dashboard continue to pass |
| NFR-002 | Provider-agnostic enrichment must not leak provider-specific fields into `enrichment` | Maintainability | Must | Only canonical schema is stored; provider-specific data is discarded |
| NFR-003 | Re-enrichment must not overwrite human-overridden fields unless explicitly requested | Data Integrity | Must | Contract tests verify that re-running `enrichPost()` preserves `overridden` values |
| NFR-004 | Aspect storage must remain within the existing `social_posts.enrichment` JSONB column | Scalability | Should | No new table required for v1; aspect counts are not pre-aggregated yet |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `overall` and each `aspects[].label` may only be `positive`, `negative`, `neutral`, or `mixed`. |
| BRU-002 | `confidence` is a number between 0.0 and 1.0 inclusive. |
| BRU-003 | `language` is an ISO 639-1 code; when it cannot be determined it must be `unknown`. |
| BRU-004 | A provider that cannot analyze the text must return `overall: 'neutral'`, `confidence: 0`, and `language: 'unknown'`. |
| BRU-005 | When a human overrides `sentiment`, the `overridden` block must record `by` (user_id), `at` (ISO 8601), and an optional `reason`; `enrichment.override` must be `true`. |
| BRU-006 | Existing `enrichment.sentiment` strings are treated as legacy and migrated to `{ overall: <old>, confidence: 0.5 }`. |
| BRU-007 | Re-enrichment is not permitted to overwrite an overridden field unless the override is explicitly cleared. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `enrichment.sentiment.overall` | Document-level sentiment label | AI provider connector | Tenant | None |
| `enrichment.sentiment.confidence` | Overall confidence score (0.0–1.0) | AI provider connector | Tenant | None |
| `enrichment.sentiment.language` | Detected ISO 639-1 language code | AI provider or connector | Tenant | None |
| `enrichment.sentiment.aspects` | Array of aspect objects: `aspect`, `label`, `confidence`, `evidence` | AI provider connector | Tenant | None |
| `enrichment.sentiment.overridden.by` | `user_id` of the user who overrode the sentiment | User action | Tenant | User reference |
| `enrichment.sentiment.overridden.at` | ISO 8601 timestamp of override | User action | Tenant | None |
| `enrichment.sentiment.overridden.reason` | Optional reason for the override | User action | Tenant | None |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Overall sentiment distribution | Track brand health and campaign impact | Tenant-Brand-Reputation-Manager | Daily / ad hoc |
| Confidence distribution | Identify low-confidence posts that may need review | Tenant-User / Analyst | Ad hoc |
| Aspect-level sentiment (queryable) | Understand *what* topics drive positive/negative sentiment | Topic-Center-Analyst | Ad hoc |
| Sentiment by language | Compare brand health across markets | Tenant-Brand-Reputation-Manager | Weekly |
| Override count | Audit human corrections and model drift | Platform-Admin / Product Owner | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Existing dashboards and queries break if `enrichment.sentiment` is no longer a string | Medium | High | Migrate on read/edit and maintain JSONB query patterns; run full contract suite | Technical Lead |
| R-002 | Providers return different shapes or missing aspect fields | Medium | Medium | Enforce the canonical `AIProviderConnector.analyzeSentiment()` contract; normalize in connector | Technical Lead |
| R-003 | Aspect categories are not standardized, making aggregation inconsistent | Medium | Medium | Defer fixed category set to v2; document open question and revisit before dashboard aspect rollups | Product Owner |
| R-004 | Human overrides are accidentally lost during re-enrichment | Low | High | Enforce re-enrichment rule: do not overwrite `overridden` unless explicitly requested; contract test it | Technical Lead |
| R-005 | Confidence thresholds differ by provider, affecting `overall` label assignment | Medium | Medium | Document threshold open question and align per provider in connector normalization layer | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AIProviderConnector` interface and enrichment pipeline (ADR-0002) | Internal | Technical Lead | Already in place |
| D-002 | Human override `PATCH /v1/posts/:id/enrichment` (ADR-0071) | Internal | Technical Lead | Already in place |
| D-003 | `SentimentDailyCount` precomputed counts (ADR-0087) | Internal | Technical Lead | Already in place |
| D-004 | `docs/product-research/feature-designs/03-ai-sentiment-analysis.md` | Reference | Product Owner | Already in place |
| D-005 | Backend story 12.5 and frontend story 12.6 | Implementation | Product Owner / Technical Lead | Ready when ADR is accepted |

---

## 14. Acceptance Criteria

- AC1: The `enrichment.sentiment` schema matches the canonical object defined in ADR-0103.
- AC2: `AIProviderConnector` contract supports aspect extraction and returns the canonical shape for Azure AI Language and Azure OpenAI.
- AC3: `PATCH /v1/posts/:id/enrichment` updates `sentiment.overall` or `sentiment.aspects` and records the `overridden` block.
- AC4: Existing string `sentiment` values are migrated on read or edit to `{ overall: <old>, confidence: 0.5 }`.
- AC5: `SentimentDailyCount` (ADR-0087) continues to count `overall` sentiment.
- AC6: Provider failure falls back to `overall: 'neutral'`, `confidence: 0`, `language: 'unknown'`.
- AC7: Re-enrichment does not overwrite overridden fields unless the override is explicitly cleared.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `enrichment` | JSONB column on `social_posts` storing AI-derived fields such as `sentiment`, `keyPhrases`, and `entities`. |
| `overall` sentiment | The document-level label (`positive`, `negative`, `neutral`, `mixed`) for the entire post. |
| `aspects` | Optional aspect-based sentiment array describing *what* the post is positive/negative about, with evidence. |
| `confidence` | A 0.0–1.0 score indicating the AI provider's certainty for a label or aspect. |
| `overridden` | Audit block recording a human correction to an AI-derived `sentiment` value. |
| `AIProviderConnector` | The provider-agnostic interface used to enrich posts through Azure AI Language or Azure OpenAI. |
| `SentimentDailyCount` | Precomputed daily rollups of `overall` sentiment counts (ADR-0087). |

---

## 16. Appendices

### Reference documents

- **ADR-0103:** `docs/adr/0103-ai-sentiment-analysis-aspect-schema.md` (Proposed)
- **Feature design:** `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`
- **Scoping plan:** `docs/product-research/feature-adr-scoping.md`
- **Related ADRs:**
  - `ADR-0071` (human-in-the-loop enrichment overrides)
  - `ADR-0087` (precomputed sentiment counts)
  - `ADR-0002` (`AIProviderConnector`)

### Related user stories

- **Story 12.5** (backend): AI sentiment aspect schema — implements the canonical `enrichment.sentiment` shape and `AIProviderConnector` aspect support.
- **Story 12.6** (frontend): AI sentiment aspect UI — exposes `overall`/aspect sentiment with confidence and override UI.

### Missing sources

- No `docs/product-research/reports/ai-sentiment-analysis-deep-research.md` file was found for this feature. This section is reserved and should be updated if a deep-research brief is produced.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
