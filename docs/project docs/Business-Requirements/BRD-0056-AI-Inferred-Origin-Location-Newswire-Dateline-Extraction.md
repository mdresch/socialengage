# Business Requirements Document (BRD) — AI-Inferred Origin Location from Newswire Dateline Text

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | AI-Inferred Origin Location from Newswire Dateline Extraction — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-17 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-17 | AI Business & Requirements Analyst | Initial draft from ADR-0056 |
| 1.0 | 2026-08-17 | Menno | Approved as drafted, no revisions |

---

## 2. Executive Summary

Newswire press releases often open with a wire-service "dateline" that names the city and state or country where the release was issued (e.g., `PROVIDENCE, R.I., Aug. 17, 2026 /PRNewswire/ --`). If this dateline can be reliably extracted from the post's own body text, an AI provider could infer a likely origin location without relying on connector-provided geo-metadata. This BRD documents the business requirements for a future, conditionally invoked AI inference capability scoped to Newswire content only.

The capability is **named and architecturally specified, but not built in v1** (per ADR-0056 Decision §5). The design keeps the existing shared enrichment schema unchanged, avoids wasted AI calls on non-Newswire content, and stores any inferred location as an honestly labeled enrichment key inside the existing unfiltered `enrichment` JSONB blob. It is intended to be revisited only when a consuming Location feature or a real tenant request triggers further investment.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve a buildable path to a future Location/Geo widget without pre-building an unused data capability | The design is accepted and ready to implement when a prioritized consumer exists |
| 2 | Avoid unnecessary AI provider cost and token usage | No Azure OpenAI call is spent unless the post's text contains a dateline-shaped pattern and the tenant's active provider is Azure OpenAI |
| 3 | Maintain the project's anti-fabrication and honest-labeling discipline | Any inferred location is always stored and rendered with an explicit "AI-inferred" qualifier and a confidence score |
| 4 | Reuse existing storage and API contracts with zero migration | The inferred value fits within the current `enrichment` JSONB field already returned by `SocialPostSummary` |

---

## 4. Scope

### 4.1 In Scope

- Architecture for an optional `AIProviderConnector.inferOriginLocation?()` method, implemented only by the Azure OpenAI provider.
- Conditional invocation of that method from the Newswire ingestion loop (`ingestNewswireItems()`) only.
- A cheap, local, non-AI structural pre-check that searches the composed `enrichmentText` for a dateline-shaped pattern (`CITY[, STATE/COUNTRY], Month Day, Year` plus an optional wire marker such as `/PRNewswire/`).
- A second gate that confirms the active enrichment model for the post was Azure OpenAI (`enrichment?.modelUsed`).
- Storage of the result as `enrichment.inferredOriginLocation: { text: string; confidence: number } | null` inside the existing unfiltered `enrichment` JSONB blob.
- Clear UI/copy rules that any future rendering of the field must carry an "AI-inferred" qualifier and must not use the same visual affordance as a verified `post_geo_location` value.
- v1 scoping that uses a content-based pre-check rather than a hardcoded feed URL allowlist.

### 4.2 Out of Scope

- Building or shipping the capability now (no consuming feature or story exists).
- Adding an origin-location field to the shared, every-call `ENRICHMENT_SCHEMA` / `AnalyzeResult` contract.
- Hardcoding a `feedUrl === PRNewswire` allowlist.
- Extending the inference call site beyond Newswire (GNews, tenant-owned-feed, or other connectors).
- Any new database column, migration, or `SocialPostSummary` schema change.
- A consuming Location tab, map widget, or export feature (awaiting a future Location decision).

### 4.3 Assumptions

- PR Newswire-sourced items continue to carry a dateline in their body text.
- GlobeNewswire-sourced items continue to lack a dateline-shaped body, so the pre-check will fail and no API cost will be incurred.
- The tenant's active, credentialed provider for Newswire enrichment is Azure OpenAI when the inference is to run.

### 4.4 Constraints

- Must not modify the shared `ENRICHMENT_SCHEMA` or every-call `AnalyzeResult` contract.
- Must not add a database migration or new `social_posts` column.
- Must respect the tenant's existing `RequestGate`/rate-limit budget for Azure OpenAI.
- Must not introduce attribution or author-rights changes beyond the existing enrichment pipeline.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Business Sponsor / Product Owner) | Decision authority; requested the feasibility investigation | High | A buildable, honest, low-risk path that is not built ahead of need |
| Tenant Users / Tenant-Admins | Potential future consumers of Location analytics | Medium | Trustworthy, clearly labeled location signals when a Location feature ships |
| AI / Backend Engineers | Implementers of the future inference pipeline | High | A precise architecture with clear gates, storage shape, and rate-limit behavior |
| Data / Analytics Engineers | Future consumers of the `enrichment` JSONB field | Medium | A stable, documented, non-breaking enrichment key |

---

## 6. Current State (As-Is)

Today, every connector's `enrichmentText` is composed inside its own ingestion loop and passed to the shared `enrichPost(tenantId, text)` function. `enrichPost()` has no connector or provider-source awareness; it iterates the `PROVIDERS` list and returns the first successful `AnalyzeResult` without the caller knowing which provider ran. `AnalyzeResult`/`ENRICHMENT_SCHEMA` is a single, always-required, five-field structured output used on every Azure OpenAI call.

`SocialPostSummary` already returns the unfiltered `enrichment` JSONB blob, so new additive enrichment keys are already wire-visible without migration. However, no field currently distinguishes which Newswire wire a `ParsedRssItem` came from, and `enrichPost()` has no concept of connector-specific enrichment.

---

## 7. Future State (To-Be)

When the capability is built, the Newswire ingestion loop will:

1. Compose `enrichmentText` from title + `bodyMarkdown` as today.
2. Run a cheap local pre-check for a dateline-shaped pattern anywhere in the text, not only at position zero.
3. Call `enrichPost()` for the standard structured enrichment.
4. If the pre-check passes and `enrichment.modelUsed === 'azure-openai'`, re-resolve the tenant's Azure OpenAI credential and call `inferOriginLocation?()`.
5. Merge the returned `{ text, confidence }` object (or `null`) into `enrichment.inferredOriginLocation` at insert time.
6. Return `SocialPostSummary` unchanged, now carrying the new key inside its existing `enrichment` blob.

Any future UI that renders `inferredOriginLocation` must display it as "AI-inferred" and must not use the same visual affordance as a verified `post_geo_location` value.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide an optional `AIProviderConnector.inferOriginLocation?(text, credential?)` method, implemented only by Azure OpenAI | Must | Method exists on `AIProviderConnector`, returns `Promise<{ text: string; confidence: number } \| null>`, and is `undefined` for Azure AI Language | Product Owner |
| BR-002 | The method shall be invoked only from the Newswire `ingestNewswireItems()` loop | Must | No call site in `pollGNewsSearch.ts`, `pollTenantOwnedFeed.ts`, `enrichPost.ts`, or manual re-enrichment | Product Owner |
| BR-003 | The system shall run a cheap, local pre-check for a dateline-shaped pattern anywhere in the composed `enrichmentText` before any AI call | Must | Pattern matches `CITY[, STATE/COUNTRY], Month Day, Year` with an optional wire marker; not anchored to position zero; does not call Azure OpenAI | Product Owner |
| BR-004 | The system shall confirm the active provider was Azure OpenAI before calling `inferOriginLocation?()` | Must | `enrichment?.modelUsed` is checked after `enrichPost()` returns; Azure AI Language skips the inference | Product Owner |
| BR-005 | The system shall store the result as `enrichment.inferredOriginLocation: { text: string; confidence: number } \| null` | Must | No new column or migration; additive JSONB key; visible through `SocialPostSummary` unchanged | Product Owner |
| BR-006 | The system shall count the second Azure OpenAI HTTP round trip against the tenant's existing `RequestGate` budget | Must | Uses `getRateLimitConfig()` and `gatedAcquire()` for `providerId: 'azure-openai'` | Product Owner |
| BR-007 | The system shall not add an origin-location field to the shared `ENRICHMENT_SCHEMA` | Must | `ENRICHMENT_SCHEMA` / `AnalyzeResult` unchanged; all required fields remain as today | Product Owner |
| BR-008 | Any future UI rendering this field shall display an "AI-inferred" qualifier and avoid map-pin affordances reserved for verified `post_geo_location` | Must | Copy reads e.g., "Likely origin (AI-inferred): Providence, RI"; no identical visual treatment to verified coordinates | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No Azure OpenAI call is spent for posts that fail the structural pre-check or use Azure AI Language | Cost / Efficiency | Must | Verified by contract tests that count `inferOriginLocation` invocations per scenario |
| NFR-002 | The pre-check executes locally without network I/O | Performance | Must | No HTTP request or external dependency during the pre-check step |
| NFR-003 | The `enrichment` JSONB remains additive and backward-compatible | Maintainability | Must | Existing `SocialPostSummary` consumers continue to work; new key is optional |
| NFR-004 | The design does not require a database migration or new table column | Maintainability | Must | No new `.sql` migration file for this feature |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `inferredOriginLocation` is never conflated with `post_geo_location` or any future verified geo-coordinate field. |
| BRU-002 | The confidence value is required and stored as a self-reported LLM confidence, not a calibrated probability. |
| BRU-003 | No AI call is made for GNews, tenant-owned-feed, or non-Newswire connectors for this purpose. |
| BRU-004 | If the dateline pre-check fails, `inferredOriginLocation` remains `null` and no second Azure OpenAI call is attempted. |
| BRU-005 | If the tenant's active provider is Azure AI Language, `inferredOriginLocation` is always `null` because that provider cannot perform free-text generative inference. |
| BRU-006 | Any future rendering must label the value "AI-inferred" and must not visually equate it to a verified location. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `enrichment.inferredOriginLocation.text` | AI-inferred origin location text (e.g., city/state/country string) | Azure OpenAI generative completion, triggered from Newswire ingestion | Backend Engineering | Low — derived from already-ingested, public press-release text |
| `enrichment.inferredOriginLocation.confidence` | Self-reported LLM confidence score for the inference | Azure OpenAI generative completion | Backend Engineering | Low |
| `enrichmentText` | Composed `title + bodyMarkdown` text checked for a dateline pattern | Newswire ingestion loop | Backend Engineering | Same as existing post content |
| `enrichment.modelUsed` | Provider that performed the standard enrichment | Existing `enrichPost()` result | Backend Engineering | Low |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Inferred origin location coverage | Count/percentage of Newswire posts with a non-null `inferredOriginLocation` | Product team / Tenant admins | On demand, when feature ships |
| Inference confidence distribution | Understand reliability of the LLM signal before surfacing it | Product team / Engineers | On demand |
| Azure OpenAI request volume for `inferOriginLocation` | Monitor per-tenant cost and rate-limit impact | Engineering / Operations | Per polling batch / On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Building a data capability that has no consuming feature, creating dead code | High (if built now) | Medium | Do not build until a real Location tab decision or tenant request triggers it (Decision §5) | Product Owner |
| R-002 | GlobeNewswire-sourced posts never carry datelines, so coverage is limited | High | Low | Structural pre-check degrades honestly; no API cost spent; no wire-specific hardcoding | Engineering |
| R-003 | Azure AI Language tenants cannot use this feature, creating provider asymmetry | Medium | Low | Method is optional and `undefined` for that provider; gate is explicit | Engineering |
| R-004 | An AI-inferred signal could be presented with false precision | Medium | High | Require "AI-inferred" label, confidence score, and distinct visual treatment in any future UI | Product / UX |
| R-005 | A second real Azure OpenAI HTTP call per passing post increases tenant cost | Medium | Medium | Only called after both gates pass; counted against existing rate-limit budget | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0054 (Location tab deferred / Analytics Dashboard scope) | Prior decision | Product Owner | Already accepted; will gate when Location is revisited |
| D-002 | ADR-0055 (Language/location enrichment feasibility, including the GNews `source.country` alternative) | Prior decision | Product Owner | Already accepted; future Location decision must choose between/including this signal and `source.country` |
| D-003 | ADR-0038 (Azure OpenAI as second enrichment provider, `ENRICHMENT_SCHEMA` design) | Prior architecture | Engineering | Already implemented |
| D-004 | ADR-0053 (Canonical Markdown body text and connector-specific `enrichmentText` composition) | Prior architecture | Engineering | Already implemented |
| D-005 | ADR-0028 (Tenant-owned credentials / `RequestGate` rate-limit model) | Prior architecture | Engineering | Already implemented |
| D-006 | A future consuming feature (Location tab, map widget, or tenant request) | Business trigger | Product Owner | Not yet committed |

---

## 14. Acceptance Criteria

- AC-1: When built, `inferOriginLocation?()` is defined on `AIProviderConnector` and implemented only by Azure OpenAI.
- AC-2: The Newswire ingestion loop calls `inferOriginLocation?()` only after the local dateline pre-check passes and `enrichment.modelUsed` confirms Azure OpenAI.
- AC-3: No new column or `SocialPostSummary` schema change is introduced; `inferredOriginLocation` is written into the existing `enrichment` JSONB blob.
- AC-4: `ENRICHMENT_SCHEMA` and the shared `AnalyzeResult` contract remain unchanged.
- AC-5: The second Azure OpenAI call is routed through the existing `gatedAcquire()` / `RequestGate` rate-limit path.
- AC-6: Any future UI that reads `inferredOriginLocation` displays it with an "AI-inferred" qualifier and a confidence value, and does not use the same visual affordance as a verified `post_geo_location`.
- AC-7: The feature is not shipped until the trigger in ADR-0056 Decision §5 is met (a real Location tab decision or a real tenant request).

---

## 15. Glossary

| Term | Definition |
|---|---|
| Dateline | A wire-service journalistic convention at the start of a press release that names the city and state/country of origin, often followed by a date and a wire marker such as `/PRNewswire/`. |
| `enrichment` | The unfiltered JSONB blob on `social_posts` that stores AI-derived analysis (sentiment, entities, key phrases, language, etc.). |
| `enrichmentText` | The text composed for AI analysis, currently `title + bodyMarkdown` as defined by ADR-0053. |
| `AIProviderConnector` | The provider-agnostic interface that both Azure AI Language and Azure OpenAI implement for post enrichment. |
| `inferredOriginLocation` | A proposed enrichment key (`{ text, confidence }`) that stores an AI-inferred, textually grounded origin location, never to be conflated with a verified geo-coordinate. |
| `post_geo_location` | A not-yet-implemented, future verified geo-coordinate field that ADR-0054 investigated and deferred. |

---

## 16. Appendices

### A. Source Documents

- [ADR-0056: AI-provider-inferred origin location from a Newswire post's own dateline text — feasibility, architecture, and v1-scope recommendation](../adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md) — primary source, accepted 2026-08-17.
- [ADR-0054: Tenant-facing Analytics Dashboard scope and data-source strategy](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) — prior decision deferring Location.
- [ADR-0055: Analytics language and location enrichment feasibility](../adr/0055-analytics-language-and-location-enrichment-feasibility.md) — prior related investigation.

### B. Missing Related Materials

- No `docs/product-research/feature-designs/<feature>.md` file exists for this capability. ADR-0056 was drafted as a feasibility/architecture ADR at Menno's direct request and does not reference a separate feature design.
- No `docs/product-research/reports/<feature>-deep-research.md` brief exists for this feature.
- No user story is drafted for ADR-0056. Per the ADR's Acceptance note and Decision §5, the "name it, don't build it now" recommendation stands; this keeps the capability ready to be storied once a consuming feature or tenant request is committed.

### C. Related User-Stories References

- `docs/user-stories/README.md` records that ADR-0056 was accepted 2026-08-17 with no story drafted.
- `docs/user-stories/epic-8-analytics-dashboard.md` references ADR-0056 in the historical context of the Location tab, which was later resolved by ADR-0064 (country-level geospatial aggregation, Story 8.10). ADR-0056 itself was not sourced into an Epic 8 story.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | Approved as drafted | 2026-08-17 |
| Product Owner | Menno | Approved as drafted | 2026-08-17 |
| Technical Lead | Menno | Approved as drafted | 2026-08-17 |
| Other Stakeholder | — | — | — |
