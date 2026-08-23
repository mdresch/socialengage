# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – AI Sentiment Analysis Aspect Schema BRD |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review — ADR-0103 is currently Proposed and may change) |
| Related Documents | ADR-0103, BRD-0103, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Social listening currently produces a single `sentiment` string for each post, which is too coarse for users who need to understand *what* a post is positive or negative about. This Business Requirements Document captures the business need for a richer, aspect-based sentiment schema stored in `social_posts.enrichment.sentiment`, with per-language support, confidence scores, and a human-override path.

This FDD translates the accepted architecture and business requirements from ADR-0103 and BRD-0103 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A new canonical `enrichment.sentiment` object with `overall`, `confidence`, `language`, optional `aspects`, and optional `overridden` fields.
- `AIProviderConnector.analyzeSentiment()` contract capable of returning aspect-based sentiment.
- Provider-agnostic support for Azure AI Language and Azure OpenAI.
- Automatic language detection when `language` is not supplied.
- Human override semantics via `PATCH /v1/posts/:id/enrichment`.
- Backward compatibility: migration of existing string `sentiment` values to the new object shape.
- Query guidance for dashboards and filters using `enrichment->'sentiment'->>'overall'`.
- Aspect aggregation as a future-queryable structure (`sentiment.aspects[].label`).
- **Out of scope:** - Aspect-level daily rollups in `SentimentDailyCount` (ADR-0087) for v1; only `overall` counts are required.
- Continuous sentiment scores (-1 to +1) in v1.
- Storing the full, provider-specific raw AI response in `enrichment`.
- Free-form vs. fixed aspect-category decision in v1 (open question).
- Emotion, sarcasm, or zero-shot multilingual capabilities beyond the chosen schema shape.
- **Assumptions and constraints:** - `enrichPost()` and `AIProviderConnector` already exist (Story 2.1, ADR-0002).
- `PATCH /v1/posts/:id/enrichment` human-override path already exists (ADR-0071).
- `SentimentDailyCount` (ADR-0087) already produces `overall` counts.
- Downstream consumers (alerts, dashboard, daily digest) can be updated to read the new `sentiment` object.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Sentiment is more than a single label
`docs/product-research/feature-designs/03-ai-sentiment-analysis.md` describes sentiment analysis. The current `enrichment` JSONB has a `sentiment` string. The product needs richer, aspect-based sentiment (e.g. positive about product, negative about support) and multi-language support.

### 2. Human-in-the-loop overrides exist
`ADR-0071` already added `PATCH /v1/posts/:id/enrichment` for human overrides. The sentiment schema must support overrides without breaking the downstream pipeline.

### 3. Downstream features consume sentiment
`09-real-time-alerts`, `08-dashboards-and-analytics`, and `24-daily-digest-email` all use `sentiment`. The new schema must remain queryable and aggregatable.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make sentiment signals more actionable by exposing what a post is positive/negative about | Users can identify negative- or positive-aspect trends without reading every post |
| 2 | Support multi-language listening with per-post language attribution | Sentiment is queryable and aggregatable by `language` |
| 3 | Preserve human judgment through a visible override path | Analyst corrections are recorded in `overridden` and used by downstream features |
| 4 | Maintain backward compatibility with existing `sentiment` data and queries | Existing strings migrate to the new object shape without breaking dashboards |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Brand-Reputation-Manager | Primary user of sentiment trend and volume views | High | Understand what is driving negative or positive shifts at a glance |
| Tenant-Reader | Consumer of post list and detail views | High | See sentiment labels with confidence and evidence without technical context |
| Tenant-User | Operator who filters posts and triggers re-enrichment | Medium | Filter by `overall` and, later, by aspect; correct sentiment when wrong |
| Tenant-Social-Care-Agent | Inbox triage and response user | Medium | Sort by negative `overall` and confidence; see aspect-level complaints |
| Topic-Center-Analyst | Correlates topic volume with sentiment | Medium | Link sentiment change to deteriorating themes and aspects |
| Platform-Admin | Operates the multi-tenant service | Low | Provider-agnostic enrichment does not introduce per-tenant data leakage |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.5 | backend engineer | `enrichment.sentiment` to support `overall`, `confidence`, `language`, and `aspects` with override, | sentiment analysis is richer, multi-lingual, and correctable. | `enrichment.sentiment` schema matches ADR-0103.; `AIProviderConnector` contract supports aspect extraction.; `PATCH /v1/posts/:id/enrichment` updates `sentiment` and records the `overridden` block. |
| 12.6 | `Tenant-User` | the post detail and dashboard to show overall and aspect-level sentiment with a confidence badge, | I can see not just positive/negative, but what the post is about. | `SentimentBadge` shows `overall` and `confidence`.; `SentimentAspectsList` shows each aspect, label, and confidence.; Override UI lets `Tenant-Admin` or `Tenant-User` correct sentiment. |

### 6.3 Workflow Diagrams / Steps

### 1. New `enrichment.sentiment` schema
```ts
{
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;            // 0.0–1.0
  language: string;              // ISO 639-1, e.g. 'en'
  aspects?: Array<{
    aspect: string;              // e.g. 'product', 'support', 'price'
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    confidence: number;
    evidence: string;            // the sentence or phrase supporting the label
  }>;
  overridden?: {
    by: string;                  // user_id
    at: string;                  // ISO 8601
    reason?: string;
  };
}
```

### 2. AI provider contract
- `AIProviderConnector.analyzeSentiment(text: string, language?: string)` returns the schema above.
- `Azure AI Language` and `Azure OpenAI` are both valid providers; the schema is provider-agnostic.
- The provider should detect language if not provided.
- If the provider cannot analyze the text, it returns `overall: 'neutral'`, `confidence: 0`, and `language: 'unknown'`.

### 3. Override semantics
- `PATCH /v1/posts/:id/enrichment` can update `sentiment.overall` or `sentiment.aspects`.
- When overridden, the `overridden` block is added and `enrichment.override` is set to `true`.
- Dashboards and alerts use the overridden value.
- Re-enrichment (if ever re-run) should not overwrite an overridden field unless explicitly requested.

### 4. Backwards compatibility
- Existing `enrichment.sentiment` strings are migrated to the new object as `{ overall: <old>, confidence: 0.5 }`.
- Code that reads `enrichment.sentiment` as a string should be updated to read `enrichment.sentiment.overall`.
- Queries that filter by `sentiment` use `enrichment->'sentiment'->>'overall'`.

### 5. Aspect aggregation
- Aspect labels are stored in `sentiment.aspects[].label`.
- Dashboards can group by `overall` or by aspect.
- `SentimentDailyCount` (ADR-0087) counts `overall` only. Aspect-level counts can be added later.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. New `enrichment.sentiment` schema
```ts
{
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;            // 0.0–1.0
  language: string;              // ISO 639-1, e.g. 'en'
  aspects?: Array<{
    aspect: string;              // e.g. 'product', 'support', 'price'
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    confidence: number;
    evidence: string;            // the sentence or phrase supporting the label
  }>;
  overridden?: {
    by: string;                  // user_id
    at: string;                  // ISO 8601
    reason?: string;
  };
}
```

### 2. AI provider contract
- `AIProviderConnector.analyzeSentiment(text: string, language?: string)` returns the schema above.
- `Azure AI Language` and `Azure OpenAI` are both valid providers; the schema is provider-agnostic.
- The provider should detect language if not provided.
- If the provider cannot analyze the text, it returns `overall: 'neutral'`, `confidence: 0`, and `language: 'unknown'`.

### 3. Override semantics
- `PATCH /v1/posts/:id/enrichment` can update `sentiment.overall` or `sentiment.aspects`.
- When overridden, the `overridden` block is added and `enrichment.override` is set to `true`.
- Dashboards and alerts use the overridden value.
- Re-enrichment (if ever re-run) should not overwrite an overridden field unless explicitly requested.

### 4. Backwards compatibility
- Existing `enrichment.sentiment` strings are migrated to the new object as `{ overall: <old>, confidence: 0.5 }`.
- Code that reads `enrichment.sentiment` as a string should be updated to read `enrichment.sentiment.overall`.
- Queries that filter by `sentiment` use `enrichment->'sentiment'->>'overall'`.

### 5. Aspect aggregation
- Aspect labels are stored in `sentiment.aspects[].label`.
- Dashboards can group by `overall` or by aspect.
- `SentimentDailyCount` (ADR-0087) counts `overall` only. Aspect-level counts can be added later.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The new schema must not break existing `sentiment` consumers | Compatibility | Must | All existing contract tests for post feed, filters, and dashboard continue to pass |
| NFR-002 | Provider-agnostic enrichment must not leak provider-specific fields into `enrichment` | Maintainability | Must | Only canonical schema is stored; provider-specific data is discarded |
| NFR-003 | Re-enrichment must not overwrite human-overridden fields unless explicitly requested | Data Integrity | Must | Contract tests verify that re-running `enrichPost()` preserves `overridden` values |
| NFR-004 | Aspect storage must remain within the existing `social_posts.enrichment` JSONB column | Scalability | Should | No new table required for v1; aspect counts are not pre-aggregated yet |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Existing dashboards and queries break if `enrichment.sentiment` is no longer a string | Medium | High | Migrate on read/edit and maintain JSONB query patterns; run full contract suite | Technical Lead |
| R-002 | Providers return different shapes or missing aspect fields | Medium | Medium | Enforce the canonical `AIProviderConnector.analyzeSentiment()` contract; normalize in connector | Technical Lead |
| R-003 | Aspect categories are not standardized, making aggregation inconsistent | Medium | Medium | Defer fixed category set to v2; document open question and revisit before dashboard aspect rollups | Product Owner |
| R-004 | Human overrides are accidentally lost during re-enrichment | Low | High | Enforce re-enrichment rule: do not overwrite `overridden` unless explicitly requested; contract test it | Technical Lead |
| R-005 | Confidence thresholds differ by provider, affecting `overall` label assignment | Medium | Medium | Document threshold open question and align per provider in connector normalization layer | Product Owner |

---

---

## 12. Assumptions and Dependencies

- `enrichPost()` and `AIProviderConnector` already exist (Story 2.1, ADR-0002).
- `PATCH /v1/posts/:id/enrichment` human-override path already exists (ADR-0071).
- `SentimentDailyCount` (ADR-0087) already produces `overall` counts.
- Downstream consumers (alerts, dashboard, daily digest) can be updated to read the new `sentiment` object.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AIProviderConnector` interface and enrichment pipeline (ADR-0002) | Internal | Technical Lead | Already in place |
| D-002 | Human override `PATCH /v1/posts/:id/enrichment` (ADR-0071) | Internal | Technical Lead | Already in place |
| D-003 | `SentimentDailyCount` precomputed counts (ADR-0087) | Internal | Technical Lead | Already in place |
| D-004 | `docs/product-research/feature-designs/03-ai-sentiment-analysis.md` | Reference | Product Owner | Already in place |
| D-005 | Backend story 12.5 and frontend story 12.6 | Implementation | Product Owner / Technical Lead | Ready when ADR is accepted |

---

---

## 13. Open Questions

- How many aspect categories should the provider return in v1? A fixed set or free-form?
- Should the AI provider be asked to return aspects in the post language or a canonical set?
- How is `confidence` thresholded for `overall` label assignment? 0.6? 0.7?
- Should `SentimentDailyCount` include aspect-level rollups now or in v2?

---

---

## 14. Appendix

### Reference Documents

- ADR-0103: `docs/adr/0103-ai-sentiment-analysis-aspect-schema.md`
- BRD-0103: `docs/project docs/Business-Requirements/BRD-0103-AI-Sentiment-Analysis-Aspect-Schema.md`
- Feature design: `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0103 and BRD-0103. |