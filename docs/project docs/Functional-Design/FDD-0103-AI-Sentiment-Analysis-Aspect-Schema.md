# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0103 AI Sentiment Analysis Aspect Schema — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0103, BRD-0103, feature design 03) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0103 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0103, BRD-0103, `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`, Story 12.5, Story 12.6, ADR-0002, ADR-0071, ADR-0087 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0103 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the schema and behaviors below may still change before acceptance.

Today `social_posts.enrichment.sentiment` is a single string (`positive` / `negative` / `neutral` / `mixed`). This is too coarse to tell a user *what* a post is positive or negative about, carries no confidence or language information, and has no structured way to record a human correction. This document defines the functional behavior of a richer, canonical `enrichment.sentiment` object — document-level sentiment plus optional aspect-based sentiment, confidence, detected language, and a human-override audit block — and how the AI provider contract, the human-override endpoint, backward-compatibility migration, and downstream consumers (dashboards, alerts, digests) must behave around it.

### 2.2 Scope

**In scope:**
- The canonical `enrichment.sentiment` object shape: `overall`, `confidence`, `language`, optional `aspects[]`, optional `overridden`.
- The `AIProviderConnector.analyzeSentiment(text, language?)` contract and its provider-agnostic behavior across Azure AI Language and Azure OpenAI.
- Automatic language detection when `language` is not supplied.
- Human override of `sentiment.overall` / `sentiment.aspects` via the existing `PATCH /v1/posts/:id/enrichment` endpoint, and the resulting `overridden` audit block.
- Backward-compatible migration of legacy string `sentiment` values to the new object shape.
- Query compatibility for existing filters/dashboards (`enrichment->'sentiment'->>'overall'`).
- Re-enrichment behavior with respect to previously overridden fields.

**Out of scope:**
- Aspect-level daily rollups in `SentimentDailyCount` (ADR-0087); v1 continues to count `overall` only.
- Continuous (-1 to +1) sentiment scores.
- Persisting the full, provider-specific raw AI response.
- Deciding a fixed vs. free-form aspect category taxonomy (open question, deferred).
- Emotion/sarcasm detection.

### 2.3 Target Audience

Backend engineers implementing `enrichPost()` and the AI provider connectors, frontend engineers building the sentiment UI (Story 12.6), QA authoring contract tests, and the Product Owner validating the schema against downstream analytics needs.

---

## 3. Context and Background

`enrichPost()` already calls `AIProviderConnector.analyze()` and stores `sentiment`, `keyPhrases`, and `entities` in the `social_posts.enrichment` JSONB column (ADR-0002). A human-override path already exists at `PATCH /v1/posts/:id/enrichment` (ADR-0071), and `SentimentDailyCount` already precomputes daily `overall` sentiment counts (ADR-0087). Feature design `03-ai-sentiment-analysis.md` and downstream feature designs (`09-real-time-alerts`, `08-dashboards-and-analytics`, `24-daily-digest-email`) all assume `sentiment` is available and queryable.

The business value is faster triage (know *what* is driving a negative mention, not just that it's negative), better analytics (group by aspect, by language), and trustworthy AI output (visible, preserved human corrections). This design must not break the existing consumers of `enrichment.sentiment` while it changes its shape from a string to a structured object.

Constraints: the schema must remain queryable/aggregatable in Postgres JSONB without a new table; the provider-agnostic contract must not leak Azure-specific payload shapes into the stored object; existing dashboards/filters/API responses must keep working through the transition.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make sentiment signals actionable at the aspect level | Users can identify what a post is positive/negative about via `sentiment.aspects` without reading the raw text |
| G2 | Support multi-language listening | `sentiment.language` is populated (detected or supplied) and queryable/aggregatable |
| G3 | Preserve human judgment visibly | Overrides are recorded in `sentiment.overridden` and used in preference to the AI-derived value by all downstream consumers |
| G4 | Preserve backward compatibility | Legacy string `sentiment` values migrate to the object shape without breaking any existing dashboard, filter, or API contract test |
| G5 | Keep the contract provider-agnostic | Both Azure AI Language and Azure OpenAI implementations of `AIProviderConnector.analyzeSentiment()` return the identical canonical shape |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Canonical `enrichment.sentiment` schema

- **Description:** Defines the stored shape of sentiment for a post: an overall document-level label, a confidence score, the detected/declared language, an optional array of aspect-level sentiments, and an optional override audit block.
- **Triggers:** A post is enriched (initial ingestion enrichment, manual re-enrichment via `POST /v1/posts/:id/enrich`, or a human override via `PATCH`).
- **Inputs:** `body_markdown` (canonical post text), optionally a known `language`, and (for override) a user-submitted `overall`/`aspects` payload.
- **Processing:**
  - On enrichment, the value returned by `AIProviderConnector.analyzeSentiment()` is written verbatim into `social_posts.enrichment.sentiment` (see 5.2).
  - `overall` and every `aspects[].label` must be one of `positive`, `negative`, `neutral`, `mixed` (BRU-001).
  - `confidence` must be a number in `[0.0, 1.0]` (BRU-002).
  - `language` must be an ISO 639-1 code, or the literal `unknown` when it cannot be determined (BRU-003).
  - `aspects` is optional; when present, each entry carries `aspect` (free-text label), `label`, `confidence`, and `evidence` (the supporting sentence/phrase).
  - `overridden`, when present, carries `by` (user id), `at` (ISO 8601 timestamp), and an optional `reason`.
- **Outputs:** The `enrichment.sentiment` JSONB value on `social_posts`, readable by the post feed, dashboards, alerts, and the daily digest.
- **Error handling:** A malformed value from a provider (wrong label domain, out-of-range confidence) is rejected by the connector normalization layer before storage; `enrichPost()` falls back to the provider-failure shape (5.2) rather than storing an invalid object.
- **Edge cases:** A post with no analyzable text (e.g., empty body, unsupported script) still produces a valid `sentiment` object via the provider-failure fallback, never a null/missing field.

### 5.2 Feature / Capability: `AIProviderConnector.analyzeSentiment()` contract

- **Description:** A provider-agnostic method that any AI provider connector implements to produce the canonical sentiment object from post text.
- **Triggers:** Called by `enrichPost()` during ingestion enrichment or manual/bulk re-enrichment.
- **Inputs:** `text: string` (the post body), `language?: string` (optional hint; when omitted the provider detects it).
- **Processing:**
  - Both the Azure AI Language implementation and the Azure OpenAI implementation must normalize their native response into the exact canonical shape defined in 5.1 — no provider-specific fields pass through.
  - When `language` is not supplied, the provider performs language detection and populates `language` with the result.
  - When the provider cannot analyze the text (unsupported input, API failure, empty text), it returns `overall: 'neutral'`, `confidence: 0`, `language: 'unknown'`, and omits `aspects`.
- **Outputs:** A canonical sentiment object as defined in 5.1, with no `overridden` block (that is only ever added by the override path, 5.3).
- **Error handling:** Provider-level exceptions (timeouts, quota errors, malformed responses) are caught inside the connector and converted to the fallback shape rather than propagating and blocking ingestion — enrichment failure must never block post ingestion (consistent with the existing enrichment pipeline's fail-open behavior).
- **Edge cases:** Mixed-language text (e.g., code-switching) is handled per provider capability; the connector still returns a single best-effort `language` value, not an array.

### 5.3 Feature / Capability: Human override of sentiment

- **Description:** Extends the existing `PATCH /v1/posts/:id/enrichment` endpoint (ADR-0071) to accept corrections to `sentiment.overall` and/or `sentiment.aspects`.
- **Triggers:** An authorized user (per ADR-0071's existing role gate) submits a `PATCH` with a revised `sentiment.overall` and/or `sentiment.aspects` value.
- **Inputs:** The `PATCH` body containing the corrected `overall` label and/or `aspects` array, and the acting user's identity (from the resolved session/token).
- **Processing:**
  - The corrected value(s) replace the corresponding field(s) in `social_posts.enrichment.sentiment`.
  - An `overridden` block is added/updated: `by` = acting user id, `at` = current timestamp, `reason` = optional caller-supplied text.
  - `enrichment.override` (the existing top-level override flag from ADR-0071) is set to `true`.
  - Dashboards, alerts, and the daily digest must read the overridden value in preference to any AI-derived value for that field.
- **Outputs:** The updated post's `enrichment.sentiment` including the new `overridden` block, returned in the `PATCH` response and reflected in subsequent `GET /v1/posts` reads.
- **Error handling:** A submitted `overall`/`aspects[].label` outside the allowed label domain, or a `confidence` outside `[0.0, 1.0]` if supplied, is rejected with a validation error; the existing `enrichment.sentiment` is left unchanged.
- **Edge cases:** Overriding only `aspects` while leaving `overall` untouched (or vice versa) is permitted — the two are independently correctable.

### 5.4 Feature / Capability: Backward-compatible migration of legacy sentiment

- **Description:** Ensures posts enriched before this schema change (whose `enrichment.sentiment` is a plain string) continue to work with the new object-shaped consumers.
- **Triggers:** A legacy post is read (e.g., via `GET /v1/posts`) or edited (re-enriched or overridden).
- **Inputs:** The existing `enrichment.sentiment` string value (`'positive' | 'negative' | 'neutral' | 'mixed'`).
- **Processing:** The legacy string is migrated to `{ overall: <old string>, confidence: 0.5 }` (BRU-006), with no `language` or `aspects` populated. Migration happens transparently on read or on the next write (re-enrichment or override), not as a one-time bulk backfill.
- **Outputs:** A canonical-shaped `sentiment` object indistinguishable in structure from a freshly enriched one (aside from missing optional fields), safe for all downstream consumers.
- **Error handling:** If a stored value is neither a recognized legacy string nor a valid canonical object, it is treated as unmigrated/corrupt and handled the same as the provider-failure fallback (5.2) rather than surfaced raw to clients.
- **Edge cases:** A post with no `sentiment` key at all (pre-dates enrichment entirely) is left absent, not synthesized, until it is actually enriched.

### 5.5 Feature / Capability: Query and aggregation compatibility

- **Description:** Preserves the ability of dashboards, filters, and reports to query sentiment after the shape change.
- **Triggers:** Any dashboard widget, post-feed filter, or reporting query that filters or groups by sentiment.
- **Inputs:** JSONB queries against `social_posts.enrichment`.
- **Processing:** All existing `overall`-based filters are rewritten (functionally, not necessarily literally in this FDD) to read `enrichment->'sentiment'->>'overall'` instead of `enrichment->>'sentiment'`. New aspect-aware queries can additionally read `enrichment->'sentiment'->'aspects'`.
- **Outputs:** Filtered/aggregated post sets equivalent to pre-change behavior for `overall`-based queries, plus new aspect-queryable structure for future use.
- **Error handling:** Queries against posts still in legacy string form must be covered by the migration behavior (5.4) so they do not silently return zero rows.
- **Edge cases:** `SentimentDailyCount` (ADR-0087) continues to count `overall` only in v1; aspect-level rollups are explicitly deferred.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Brand-Reputation-Manager | Reviews sentiment trend/volume and what is driving shifts |
| Tenant-Reader | Views sentiment labels, confidence, and evidence on posts |
| Tenant-User | Filters the post feed by sentiment; can trigger re-enrichment or override |
| Tenant-Social-Care-Agent | Triages inbox by negative `overall` and confidence |
| Topic-Center-Analyst | Correlates topic volume with sentiment/aspect change |
| Platform-Admin | Ensures provider-agnostic enrichment introduces no cross-tenant leakage |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.5) | backend engineer | `enrichment.sentiment` to support `overall`, `confidence`, `language`, and `aspects` with override | sentiment analysis is richer, multi-lingual, and correctable | Schema matches ADR-0103; `AIProviderConnector` supports aspect extraction; `PATCH` records `overridden`; legacy strings migrate; `SentimentDailyCount` still counts `overall` |
| US2 (Story 12.6) | Tenant-User | the post detail and dashboard to show overall and aspect-level sentiment with a confidence badge | I can see not just positive/negative, but what the post is about | `SentimentBadge` shows `overall`/`confidence`; `SentimentAspectsList` shows each aspect; override UI available to Tenant-Admin/Tenant-User; language shown when non-default |

### 6.3 Workflow Diagrams / Steps

**Enrichment workflow:**
1. A post is ingested (or a manual re-enrichment is requested via `POST /v1/posts/:id/enrich`).
2. `enrichPost()` calls `AIProviderConnector.analyzeSentiment(body_markdown, detectedLanguage?)`.
3. The provider (Azure AI Language or Azure OpenAI) returns the canonical sentiment object, or the fallback shape on failure.
4. `enrichPost()` writes the object into `social_posts.enrichment.sentiment`, preserving any existing `overridden` block per the re-enrichment rule (step 5).
5. If the existing `sentiment` already has an `overridden` block, re-enrichment does not overwrite the overridden field(s) unless the caller explicitly requests the override be cleared.
6. Downstream consumers (post feed, dashboard, alerts, daily digest) read the updated `enrichment.sentiment`.

**Override workflow:**
1. An authorized user views a post's sentiment (`overall`, `aspects`, confidence, evidence) in the post detail UI.
2. The user submits a correction via the override UI, which calls `PATCH /v1/posts/:id/enrichment` with the revised `overall` and/or `aspects`.
3. The backend validates the label domain and confidence range, updates `enrichment.sentiment`, adds the `overridden` block (`by`, `at`, optional `reason`), and sets `enrichment.override = true`.
4. The updated sentiment, now overridden, is reflected immediately in the post detail, feed filters, and (on next aggregation cycle) dashboards.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Post body text (`body_markdown`) and optionally a known/detected `language`, supplied to `AIProviderConnector.analyzeSentiment()`.
- Human-submitted override payload (`overall`, `aspects`, optional `reason`) via `PATCH /v1/posts/:id/enrichment`.
- Legacy `enrichment.sentiment` string values already stored on existing posts.

### 7.2 Data Outputs

- The canonical `enrichment.sentiment` JSONB object stored on `social_posts`, consumed by `GET /v1/posts`, the post feed UI, dashboard widgets, real-time alerts, and the daily digest email.
- Query-derived aggregates (e.g., `overall` distribution) surfaced in `SentimentDailyCount` and ad hoc dashboard queries.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `social_posts.enrichment.sentiment` (JSONB field, not a new table) | `overall: 'positive'\|'negative'\|'neutral'\|'mixed'`; `confidence: number (0.0–1.0)`; `language: string (ISO 639-1 or 'unknown')`; `aspects?: SentimentAspect[]`; `overridden?: SentimentOverride` | Embedded within `social_posts.enrichment`; one per `social_posts` row |
| `SentimentAspect` (embedded object) | `aspect: string`; `label: 'positive'\|'negative'\|'neutral'\|'mixed'`; `confidence: number`; `evidence: string` | Zero-or-more per `sentiment.aspects[]` |
| `SentimentOverride` (embedded object) | `by: string (user_id)`; `at: string (ISO 8601)`; `reason?: string` | Zero-or-one per `sentiment.overridden`; references a `users` row via `by` |
| `SentimentDailyCount` (ADR-0087, existing) | Precomputed daily counts keyed by `overall` | Derived from `social_posts.enrichment.sentiment.overall`; unchanged by this ADR except reading the new path |

### 7.4 Validation Rules

- `overall` and every `aspects[].label` must be one of `positive`, `negative`, `neutral`, `mixed` (BRU-001).
- `confidence` (top-level and per-aspect) must be a number in `[0.0, 1.0]` inclusive (BRU-002).
- `language` must be a valid ISO 639-1 code or the literal string `unknown` (BRU-003).
- A provider that cannot analyze text must return exactly `overall: 'neutral'`, `confidence: 0`, `language: 'unknown'` (BRU-004).
- `overridden.by`, `overridden.at` are required whenever `overridden` is present; `overridden.reason` is optional (BRU-005).
- Legacy string values migrate to `{ overall: <old>, confidence: 0.5 }` with no `language`/`aspects` (BRU-006).
- Re-enrichment must not silently overwrite an `overridden` field (BRU-007).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `overall` and `aspects[].label` are restricted to the four-value label domain | Storage, provider connector, override endpoint |
| BR2 | `confidence` is numeric in `[0.0, 1.0]` | Storage, provider connector, override endpoint |
| BR3 | `language` is ISO 639-1 or `unknown` | Provider connector, storage |
| BR4 | Provider failure yields the fixed fallback shape (`neutral`/`0`/`unknown`) rather than a null or partial object | Provider connector |
| BR5 | An override records `by`, `at`, and sets `enrichment.override = true` | `PATCH /v1/posts/:id/enrichment` |
| BR6 | Downstream consumers prefer the overridden value over the AI-derived value for any overridden field | Dashboards, alerts, daily digest, post feed |
| BR7 | Legacy string sentiment migrates to the canonical shape on read or write, never left as a bare string for new consumers | Read path, write path |
| BR8 | Re-enrichment does not clear an existing override unless explicitly requested | `enrichPost()` re-run path |
| BR9 | Aspect-level counts are not required in `SentimentDailyCount` for v1 | Precomputed aggregation |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `AIProviderConnector` (Azure AI Language) | Outbound call | Produce canonical sentiment object from post text | Provider SDK / REST, normalized to JSON |
| `AIProviderConnector` (Azure OpenAI) | Outbound call | Alternate provider for canonical sentiment object | Provider SDK / REST, normalized to JSON |
| `social_posts.enrichment` (Postgres JSONB) | Read/Write | Persist the canonical sentiment object per post | JSONB, tenant-scoped via RLS |
| `PATCH /v1/posts/:id/enrichment` (existing, ADR-0071) | Inbound API | Accept human corrections to `sentiment.overall`/`sentiment.aspects` | REST/JSON |
| `GET /v1/posts` | Outbound API response | Expose `enrichment.sentiment` to the post feed and dashboards | REST/JSON |
| `SentimentDailyCount` (ADR-0087) | Read (derived) | Precomputed `overall` daily counts consumed by dashboards | Postgres aggregation |
| Real-time alerts, daily digest (feature designs 09, 24) | Read | Consume `sentiment.overall`/`aspects` (preferring overridden values) to trigger notifications | Internal read of `enrichment.sentiment` |

---

## 10. Non-Functional Considerations

- **Performance:** Sentiment analysis remains part of the existing async, per-post enrichment path; no new synchronous latency is introduced on ingestion.
- **Security / access control:** Overrides go through the existing role-gated `PATCH /v1/posts/:id/enrichment` (ADR-0071); no new authorization surface is introduced. Provider calls carry no PII beyond post text already in scope for enrichment.
- **Scalability:** The schema stays within the existing `social_posts.enrichment` JSONB column — no new table for v1, so no additional join/index scaling concerns beyond existing JSONB query patterns.
- **Reliability / availability:** Provider failure must fail open to the fixed fallback shape rather than blocking ingestion or leaving `sentiment` absent.
- **Audit and logging:** Every override is recorded in `sentiment.overridden` (`by`, `at`, `reason`), providing a durable, queryable audit trail of human corrections.
- **Compatibility:** All existing contract tests for post feed, filters, and dashboards must continue to pass against the new object shape (NFR-001).
- **Maintainability:** No provider-specific fields leak into the canonical stored object (NFR-002).
- **Data integrity:** Re-enrichment must not silently overwrite an override (NFR-003).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| AI provider cannot analyze the text (timeout, unsupported input, API error) | None (transparent to the ingesting flow) | `enrichPost()` stores the fallback shape (`overall: 'neutral'`, `confidence: 0`, `language: 'unknown'`); ingestion is not blocked |
| Override submission has an invalid `overall`/`aspects[].label` value | Validation error identifying the invalid field | `PATCH` request rejected; existing `enrichment.sentiment` left unchanged |
| Override submission has `confidence` outside `[0.0, 1.0]` | Validation error identifying the invalid field | `PATCH` request rejected; existing `enrichment.sentiment` left unchanged |
| Legacy string `sentiment` encountered on read | None (transparent) | Migrated in-flight to `{ overall: <old>, confidence: 0.5 }` before being returned/used |
| Re-enrichment attempted on a post with an existing override | None (transparent) | Overridden field(s) are preserved; only non-overridden fields are refreshed, unless the caller explicitly requests the override be cleared |
| Stored `sentiment` value is neither a valid legacy string nor a valid canonical object | None (transparent) | Treated as the provider-failure fallback shape rather than surfaced raw |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- `enrichPost()` and the `AIProviderConnector` interface already exist and are stable (Story 2.1, ADR-0002).
- `PATCH /v1/posts/:id/enrichment` and its role gating already exist (ADR-0071).
- `SentimentDailyCount` already produces `overall` counts (ADR-0087).
- Downstream consumers (alerts, dashboard, daily digest) can be updated to read the new object shape.

**Dependencies:**
- `AIProviderConnector` / enrichment pipeline (ADR-0002) — already in place.
- Human override endpoint (ADR-0071) — already in place.
- `SentimentDailyCount` (ADR-0087) — already in place.
- Feature design `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`.
- Story 12.5 (backend) and Story 12.6 (frontend), both currently Blocked pending ADR-0103 acceptance.

**Pending decisions:** ADR-0103 is Proposed; the schema, thresholds, and aspect taxonomy below are subject to change until it is Accepted.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | How many aspect categories should the provider return in v1 — a fixed set or free-form? | Product Owner | Before Story 12.5 implementation |
| Q2 | Should the AI provider return aspects in the post's original language or a canonical (e.g., English) set? | Product Owner | Before Story 12.5 implementation |
| Q3 | What confidence threshold determines the `overall` label assignment — 0.6? 0.7? | Technical Lead | Before Story 12.5 implementation |
| Q4 | Should `SentimentDailyCount` include aspect-level rollups now or in v2? | Product Owner | Post-v1, revisit with ADR-0087 owner |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| `enrichment` | JSONB column on `social_posts` storing AI-derived fields such as `sentiment`, `keyPhrases`, and `entities`. |
| `overall` sentiment | The document-level label (`positive`, `negative`, `neutral`, `mixed`) for the entire post. |
| `aspects` | Optional aspect-based sentiment array describing what the post is positive/negative about, with evidence. |
| `confidence` | A 0.0–1.0 score indicating the AI provider's certainty for a label or aspect. |
| `overridden` | Audit block recording a human correction to an AI-derived `sentiment` value. |
| `AIProviderConnector` | The provider-agnostic interface used to enrich posts through Azure AI Language or Azure OpenAI. |

### Reference links

- ADR-0103: `docs/adr/0103-ai-sentiment-analysis-aspect-schema.md` (Proposed)
- BRD-0103: `docs/project docs/Business-Requirements/BRD-0103-AI-Sentiment-Analysis-Aspect-Schema.md`
- Feature design: `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`
- Related ADRs: ADR-0071 (human-in-the-loop enrichment overrides), ADR-0087 (precomputed sentiment counts), ADR-0002 (`AIProviderConnector`)
- Related user stories: Story 12.5 (backend, `docs/user-stories/epic-12-adr-0101-to-0108.md`), Story 12.6 (frontend, same file)

### Missing sources

- No `docs/product-research/reports/ai-sentiment-analysis-deep-research.md` deep-research brief was found for this feature; none is referenced.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
