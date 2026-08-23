# Business Requirements Document (BRD) — AI-Inferred Origin Location from Newswire Dateline Text

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — AI-Inferred Origin Location from Newswire Dateline Text |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, ../Business-Requirements/BRD-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0056-ai-inferred-origin-location-newswire-dateline-extraction.md and the business requirements in BRD-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md into functional design for **AI Inferred Origin Location Newswire Dateline Extraction**.
Newswire press releases often open with a wire-service "dateline" that names the city and state or country where the release was issued (e.g., `PROVIDENCE, R.I., Aug. 17, 2026 /PRNewswire/ --`). If this dateline can be reliably extracted from the post's own body text, an AI provider could infer a likely origin location without relying on connector-provided geo-metadata. This BRD documents the business requirements for a future, conditionally invoked AI inference capability scoped to Newswire content only.

The capability is **named and architecturally specified, but not built in v1** (per ADR-0056 Decision §5). The design keeps the existing shared enrichment schema unchanged, avoids wasted AI calls on non-Newswire content, and stores any inferred location as an honestly labeled enrichment key inside the existing unfiltered `enrichment` JSONB blob. It is intended to be revisited only when a consuming Location feature or a real tenant request triggers further investment.

---

### 2.2 Scope
**In scope:**
- Architecture for an optional `AIProviderConnector.inferOriginLocation?()` method, implemented only by the Azure OpenAI provider.
- Conditional invocation of that method from the Newswire ingestion loop (`ingestNewswireItems()`) only.
- A cheap, local, non-AI structural pre-check that searches the composed `enrichmentText` for a dateline-shaped pattern (`CITY[, STATE/COUNTRY], Month Day, Year` plus an optional wire marker such as `/PRNewswire/`).
- A second gate that confirms the active enrichment model for the post was Azure OpenAI (`enrichment?.modelUsed`).
- Storage of the result as `enrichment.inferredOriginLocation: { text: string; confidence: number } | null` inside the existing unfiltered `enrichment` JSONB blob.
- Clear UI/copy rules that any future rendering of the field must carry an "AI-inferred" qualifier and must not use the same visual affordance as a verified `post_geo_location` value.
- v1 scoping that uses a content-based pre-check rather than a hardcoded feed URL allowlist.

**Out of scope:**
- Building or shipping the capability now (no consuming feature or story exists).
- Adding an origin-location field to the shared, every-call `ENRICHMENT_SCHEMA` / `AnalyzeResult` contract.
- Hardcoding a `feedUrl === PRNewswire` allowlist.
- Extending the inference call site beyond Newswire (GNews, tenant-owned-feed, or other connectors).
- Any new database column, migration, or `SocialPostSummary` schema change.
- A consuming Location tab, map widget, or export feature (awaiting a future Location decision).

## 3. Context and Background
See ADR Context.
Newswire press releases often open with a wire-service "dateline" that names the city and state or country where the release was issued (e.g., `PROVIDENCE, R.I., Aug. 17, 2026 /PRNewswire/ --`). If this dateline can be reliably extracted from the post's own body text, an AI provider could infer a likely origin location without relying on connector-provided geo-metadata. This BRD documents the business requirements for a future, conditionally invoked AI inference capability scoped to Newswire content only.

The capability is **named and architecturally specified, but not built in v1** (per ADR-0056 Decision §5). The design keeps the existing shared enrichment schema unchanged, avoids wasted AI calls on non-Newswire content, and stores any inferred location as an honestly labeled enrichment key inside the existing unfiltered `enrichment` JSONB blob. It is intended to be revisited only when a consuming Location feature or a real tenant request triggers further investment.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve a buildable path to a future Location/Geo widget without pre-building an unused data capability | The design is accepted and ready to implement when a prioritized consumer exists |
| 2 | Avoid unnecessary AI provider cost and token usage | No Azure OpenAI call is spent unless the post's text contains a dateline-shaped pattern and the tenant's active provider is Azure OpenAI |
| 3 | Maintain the project's anti-fabrication and honest-labeling discipline | Any inferred location is always stored and rendered with an explicit "AI-inferred" qualifier and a confidence score |
| 4 | Reuse existing storage and API contracts with zero migration | The inferred value fits within the current `enrichment` JSONB field already returned by `SocialPostSummary` |

---

**Positive consequences (from ADR):**
**Positive**
- Fully specifies a real, technically sound, buildable design (Decision §1–§4) so that if/when the trigger in Decision §5 occurs, no re-investigation is needed — the architecture placement, storage shape, honesty/labeling requirement, and scoping mechanism are all already decided.
- Confirms directly (Decision §2) that this data-storage path carries none of ADR-0054's `post_geo_location`/`SocialPostSummary` structural blocker — a genuinely easier path than the one ADR-0054/ADR-0055 already declined, named honestly rather than conflated with it.
- Keeps this project's "don't build ahead of a demonstrated need" discipline applied consistently, matching ADR-0054/ADR-0055's own posture for the exact same category of question, rather than treating "Menno asked about it" as itself sufficient grounds to build.
- Independently re-verifies (not merely re-cites) the PR Newswire premise, and surfaces a real refinement (dateline position is not fixed at line zero) the original live-`curl` check did not have — a genuine, if small, improvement on the evidence this ADR would otherwise have just repeated.

**Negative**
- **Nothing ships from this ADR.** If Menno judges the value of having this ready outweighs the "don't build ahead of demonstrated need" discipline, that is a real, visible tension this ADR does not pre-resolve in either direction — named, not smoothed over, per this role's charter.
- **GlobeNewswire-sourced posts get no inferred location, permanently, under this design** — not a temporary v1 gap but a structural consequence of the wire's own real content shape (Context), unless a future GlobeNewswire feed category is found to behave differently (not ruled out, Open Questions).
- **Coverage is further narrowed to tenants with Azure OpenAI specifically active and credentialed** — a tenant using only Azure AI Language (which cannot perform this kind of inference at all) gets no inferred location regardless of connector or content, a real, named asymmetry between the two otherwise-swappable providers.
- **This session's own GlobeNewswire re-verification could not be completed independently** (three `WebFetch` timeouts) — this ADR's GlobeNewswire finding rests on the orchestrating session's prior live evidence, honestly flagged as such rather than presented as freshly reproduced.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Business Sponsor / Product Owner) | Decision authority; requested the feasibility investigation | High | A buildable, honest, low-risk path that is not built ahead of need |
| Tenant Users / Tenant-Admins | Potential future consumers of Location analytics | Medium | Trustworthy, clearly labeled location signals when a Location feature ships |
| AI / Backend Engineers | Implementers of the future inference pipeline | High | A precise architecture with clear gates, storage shape, and rate-limit behavior |
| Data / Analytics Engineers | Future consumers of the `enrichment` JSONB field | Medium | A stable, documented, non-breaking enrichment key |

---

### 6.2 User Stories
No related user stories found.

## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `enrichment.inferredOriginLocation.text` | AI-inferred origin location text (e.g., city/state/country string) | Azure OpenAI generative completion, triggered from Newswire ingestion | Backend Engineering | Low — derived from already-ingested, public press-release text |
| `enrichment.inferredOriginLocation.confidence` | Self-reported LLM confidence score for the inference | Azure OpenAI generative completion | Backend Engineering | Low |
| `enrichmentText` | Composed `title + bodyMarkdown` text checked for a dateline pattern | Newswire ingestion loop | Backend Engineering | Same as existing post content |
| `enrichment.modelUsed` | Provider that performed the standard enrichment | Existing `enrichPost()` result | Backend Engineering | Low |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `inferredOriginLocation` is never conflated with `post_geo_location` or any future verified geo-coordinate field. |
| BRU-002 | The confidence value is required and stored as a self-reported LLM confidence, not a calibrated probability. |
| BRU-003 | No AI call is made for GNews, tenant-owned-feed, or non-Newswire connectors for this purpose. |
| BRU-004 | If the dateline pre-check fails, `inferredOriginLocation` remains `null` and no second Azure OpenAI call is attempted. |
| BRU-005 | If the tenant's active provider is Azure AI Language, `inferredOriginLocation` is always `null` because that provider cannot perform free-text generative inference. |
| BRU-006 | Any future rendering must label the value "AI-inferred" and must not visually equate it to a verified location. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0054 (Location tab deferred / Analytics Dashboard scope) | Prior decision | Product Owner | Already accepted; will gate when Location is revisited |
| D-002 | ADR-0055 (Language/location enrichment feasibility, including the GNews `source.country` alternative) | Prior decision | Product Owner | Already accepted; future Location decision must choose between/including this signal and `source.country` |
| D-003 | ADR-0038 (Azure OpenAI as second enrichment provider, `ENRICHMENT_SCHEMA` design) | Prior architecture | Engineering | Already implemented |
| D-004 | ADR-0053 (Canonical Markdown body text and connector-specific `enrichmentText` composition) | Prior architecture | Engineering | Already implemented |
| D-005 | ADR-0028 (Tenant-owned credentials / `RequestGate` rate-limit model) | Prior architecture | Engineering | Already implemented |
| D-006 | A future consuming feature (Location tab, map widget, or tenant request) | Business trigger | Product Owner | Not yet committed |

---

- PR Newswire-sourced items continue to carry a dateline in their body text.
- GlobeNewswire-sourced items continue to lack a dateline-shaped body, so the pre-check will fail and no API cost will be incurred.
- The tenant's active, credentialed provider for Newswire enrichment is Azure OpenAI when the inference is to run.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No Azure OpenAI call is spent for posts that fail the structural pre-check or use Azure AI Language | Cost / Efficiency | Must | Verified by contract tests that count `inferOriginLocation` invocations per scenario |
| NFR-002 | The pre-check executes locally without network I/O | Performance | Must | No HTTP request or external dependency during the pre-check step |
| NFR-003 | The `enrichment` JSONB remains additive and backward-compatible | Maintainability | Must | Existing `SocialPostSummary` consumers continue to work; new key is optional |
| NFR-004 | The design does not require a database migration or new table column | Maintainability | Must | No new `.sql` migration file for this feature |

---

## 11. Error Handling and Exceptions
**Positive**
- Fully specifies a real, technically sound, buildable design (Decision §1–§4) so that if/when the trigger in Decision §5 occurs, no re-investigation is needed — the architecture placement, storage shape, honesty/labeling requirement, and scoping mechanism are all already decided.
- Confirms directly (Decision §2) that this data-storage path carries none of ADR-0054's `post_geo_location`/`SocialPostSummary` structural blocker — a genuinely easier path than the one ADR-0054/ADR-0055 already declined, named honestly rather than conflated with it.
- Keeps this project's "don't build ahead of a demonstrated need" discipline applied consistently, matching ADR-0054/ADR-0055's own posture for the exact same category of question, rather than treating "Menno asked about it" as itself sufficient grounds to build.
- Independently re-verifies (not merely re-cites) the PR Newswire premise, and surfaces a real refinement (dateline position is not fixed at line zero) the original live-`curl` check did not have — a genuine, if small, improvement on the evidence this ADR would otherwise have just repeated.

**Negative**
- **Nothing ships from this ADR.** If Menno judges the value of having this ready outweighs the "don't build ahead of demonstrated need" discipline, that is a real, visible tension this ADR does not pre-resolve in either direction — named, not smoothed over, per this role's charter.
- **GlobeNewswire-sourced posts get no inferred location, permanently, under this design** — not a temporary v1 gap but a structural consequence of the wire's own real content shape (Context), unless a future GlobeNewswire feed category is found to behave differently (not ruled out, Open Questions).
- **Coverage is further narrowed to tenants with Azure OpenAI specifically active and credentialed** — a tenant using only Azure AI Language (which cannot perform this kind of inference at all) gets no inferred location regardless of connector or content, a real, named asymmetry between the two otherwise-swappable providers.
- **This session's own GlobeNewswire re-verification could not be completed independently** (three `WebFetch` timeouts) — this ADR's GlobeNewswire finding rests on the orchestrating session's prior live evidence, honestly flagged as such rather than presented as freshly reproduced.

---

## 12. Assumptions and Dependencies
- PR Newswire-sourced items continue to carry a dateline in their body text.
- GlobeNewswire-sourced items continue to lack a dateline-shaped body, so the pre-check will fail and no API cost will be incurred.
- The tenant's active, credentialed provider for Newswire enrichment is Azure OpenAI when the inference is to run.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Building a data capability that has no consuming feature, creating dead code | High (if built now) | Medium | Do not build until a real Location tab decision or tenant request triggers it (Decision §5) | Product Owner |
| R-002 | GlobeNewswire-sourced posts never carry datelines, so coverage is limited | High | Low | Structural pre-check degrades honestly; no API cost spent; no wire-specific hardcoding | Engineering |
| R-003 | Azure AI Language tenants cannot use this feature, creating provider asymmetry | Medium | Low | Method is optional and `undefined` for that provider; gate is explicit | Engineering |
| R-004 | An AI-inferred signal could be presented with false precision | Medium | High | Require "AI-inferred" label, confidence score, and distinct visual treatment in any future UI | Product / UX |
| R-005 | A second real Azure OpenAI HTTP call per passing post increases tenant cost | Medium | Medium | Only called after both gates pass; counted against existing rate-limit budget | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md`
- BRD: `../Business-Requirements/BRD-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: _No related user stories found._