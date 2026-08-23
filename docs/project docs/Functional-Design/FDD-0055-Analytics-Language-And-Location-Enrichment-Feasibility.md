# BRD-0055: Analytics Language and Location Enrichment Feasibility

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0055: Analytics Language and Location Enrichment Feasibility |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0055-analytics-language-and-location-enrichment-feasibility.md, ../Business-Requirements/BRD-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0055-analytics-language-and-location-enrichment-feasibility.md and the business requirements in BRD-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md into functional design for **Analytics Language And Location Enrichment Feasibility**.
The Analytics Dashboard was introduced in Epic 8 to give tenant users an at-a-glance view of monitored content. The reference design that inspired it included a "Languages Breakdown" widget and Location-oriented visualisations, but no one had confirmed whether the data pipeline actually captured these fields. This BRD documents the findings of ADR-0055, which investigated both independently.

**Language** is already computed and persisted by both real AI provider connectors on every successful enrichment, and the `GET /v1/posts` endpoint already returns the value unfiltered in the `enrichment` JSON blob. The only missing piece is client-side surfacing: `postDisplay.ts` does not currently read `enrichment.detectedLanguage`. This means a low-cost, `social-listening-admin`-only change can deliver the Languages breakdown.

**Location** remains not feasible. No real connector populates `post_geo_location`, and the dashboard's actual data source (`SocialPostSummary`) omits that field. A technically-free GNews-only "Source Country" adjacent option was identified and deliberately declined as a Location substitute to avoid misrepresenting publisher headquarters as conversation geography.

The proposed solution is therefore surgical: extend `PostEnrichmentSummary` to expose `language`, add a Languages breakdown widget to the Analytics Dashboard, and explicitly leave Location and GNews-only source country out of scope.

---

### 2.2 Scope
**In scope:**
- Extend `PostEnrichmentSummary` and `extractEnrichmentSummary()` in `postDisplay.ts` to read `enrichment.detectedLanguage` and expose a `language: string | null` field (ISO 639-1 code).
- Add a Languages breakdown widget to the Analytics Dashboard, computed client-side from the already-fetched `SocialPostSummary[]` set.
- Provide a human-readable display-name mapping for at least the ISO 639-1 codes the real enrichment pipeline can produce.
- Place the Languages widget on the Sources tab or the Conversations tab (implementation-time judgment, not fixed here).
- Support click-to-filter: selecting a language narrows the currently displayed post set to posts whose `enrichment.detectedLanguage` matches.
- Render the existing `EmptyState` component when no enriched posts are available for the selected date range.
- Exclude posts that have no `enrichment` blob at all from the Languages aggregation (they are not treated as an "unknown" language).

**Out of scope:**
- Any change to `social-listening-core` (new endpoints, migrations, columns, connector logic, or AI model changes).
- A per-post or per-conversation Location feature, including maps, region filters, or geo-density visualisations.
- A GNews-only "Source Country" widget, even though the field is technically available in `rawPayload`.
- Surfacing the new `language` field on the post feed or post detail view (Story 6.11/6.16) — a reasonable follow-up, but not this BRD.
- Use of GNews's raw `lang` field as the primary language signal.

## 3. Context and Background
See ADR Context.
The Analytics Dashboard was introduced in Epic 8 to give tenant users an at-a-glance view of monitored content. The reference design that inspired it included a "Languages Breakdown" widget and Location-oriented visualisations, but no one had confirmed whether the data pipeline actually captured these fields. This BRD documents the findings of ADR-0055, which investigated both independently.

**Language** is already computed and persisted by both real AI provider connectors on every successful enrichment, and the `GET /v1/posts` endpoint already returns the value unfiltered in the `enrichment` JSON blob. The only missing piece is client-side surfacing: `postDisplay.ts` does not currently read `enrichment.detectedLanguage`. This means a low-cost, `social-listening-admin`-only change can deliver the Languages breakdown.

**Location** remains not feasible. No real connector populates `post_geo_location`, and the dashboard's actual data source (`SocialPostSummary`) omits that field. A technically-free GNews-only "Source Country" adjacent option was identified and deliberately declined as a Location substitute to avoid misrepresenting publisher headquarters as conversation geography.

The proposed solution is therefore surgical: extend `PostEnrichmentSummary` to expose `language`, add a Languages breakdown widget to the Analytics Dashboard, and explicitly leave Location and GNews-only source country out of scope.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Surface AI-detected language in the Analytics Dashboard with no backend work | Story 8.5 ships using only `social-listening-admin` changes, with `social-listening-core` untouched |
| 2 | Close the reference-design gap for the Languages widget | A Languages breakdown renders on the Sources or Conversations tab with real, derived data |
| 3 | Avoid speculative investment in Location when no per-post geo-data exists | Location features remain explicitly deferred; no engineering effort is spent on `post_geo_location` or fabricated country widgets |
| 4 | Preserve honest data representation | Every widget renders an empty state when data is absent; no fabricated or mislabeled numbers are shown |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a real, previously-unresearched gap at very low cost: Language requires no backend change at all, because the data has already been computed and persisted by already-shipped code (Story 2.8/2.9) since before Epic 8 even started.
- No historical backfill is needed — any post enriched since Story 2.8/2.9 shipped already carries `detectedLanguage` in its stored `enrichment` blob.
- Keeps the Location question honestly closed rather than reopened on hope: re-investigating it independently, rather than assuming ADR-0054's conclusion still holds, is exactly the discipline this project's own traceability standard requires — and it surfaced one genuine new nuance (GNews `source.country`) worth naming even though it doesn't change the bottom line.

**Negative**
- Language coverage is only as complete as enrichment coverage generally — a tenant with no AI provider ever credentialed/active sees no language data, the same limitation Sentiment/Key-Phrase widgets already have and already accept.
- The GNews-only "Source Country" option, though technically free to build, is named and left unbuilt — a real, if minor, missed opportunity if Menno judges the mislabeling risk (Decision §2, Context) acceptable with sufficiently careful copy; this ADR does not make that call.
- Widening `PostEnrichmentSummary` touches a function also used by the existing post feed/detail view (Story 6.11/6.16) — a shared-surface change, not purely additive to Epic 8 alone, though it changes nothing about those screens unless a future story chooses to render the new field there too.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose `enrichment.detectedLanguage` through `PostEnrichmentSummary` as a `language` field | Must | `extractEnrichmentSummary()` returns `language: string \| null` for every enriched post; the field reads `enrichment.detectedLanguage` | Product Owner |
| BR-002 | The system shall render a Languages breakdown widget on the Analytics Dashboard | Must | A language-distribution widget appears on either the Sources or Conversations tab, counts posts per language, and updates when the date range or filters change | Product Owner |
| BR-003 | The system shall map ISO 639-1 language codes to human-readable display names | Should | At minimum the codes produced by the real connectors (e.g. `en` → `English`) display correctly; other known codes fall back to the code itself | Frontend Lead |
| BR-004 | The system shall exclude posts without an `enrichment` blob from the Languages aggregation | Must | Posts with no `enrichment` do not appear in the breakdown and are not counted as an "unknown" language | Product Owner |
| BR-005 | The system shall let users click a language to filter the dashboard post set | Should | Selecting a language in the widget sets the active language filter and narrows the displayed posts to that `detectedLanguage` | Product Owner |
| BR-006 | The system shall render an honest empty state when no language data is available | Must | Zero enriched posts in the selected range shows the existing `EmptyState` component, never a fabricated sample breakdown | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Tenant-Admin | Primary consumer of the Analytics Dashboard | High | See which languages content is written in, without opening individual posts |
| Tenant-Business-Analyst | Uses dashboard for reporting and shareable insights | High | Filter and export data by language, understand the linguistic composition of coverage |
| Product Owner (Menno) | Decision owner for ADR-0055 | High | Low-cost, honest delivery of Language; no speculative Location work |
| Frontend Engineering | Builds the `social-listening-admin` widget | High | Clear scope that stays within client-side code and existing contracts |
| Customer Success / Sales | Communicates roadmap and dashboard value | Medium | A concrete, shippable Languages widget; honest positioning on Location limitations |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 8.5 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want to see which languages my monitored content is actually written in, so that I understand the linguistic makeup of what... | `PostEnrichmentSummary` (`postDisplay.ts`) gains a `language: string | null` field, read from `enrichment.detectedLanguage` — the same field both real `AIPro... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `enrichment.detectedLanguage` | ISO 639-1 language code computed by the active AI provider connector | `social_posts.enrichment` (JSONB), returned by `GET /v1/posts` | Existing enrichment pipeline | Low — derived text-property, no PII |
| `PostEnrichmentSummary.language` | Derived UI field exposing `enrichment.detectedLanguage` or `null` | `extractEnrichmentSummary()` in `postDisplay.ts` | Frontend | Low |
| `rawPayload.lang` | Optional source-declared language field on GNews articles only | Raw GNews API response | GNews connector | Low |
| `rawPayload.source.country` | Country code of the GNews publisher's declared location | Raw GNews API response | GNews connector | Low — publisher metadata, not audience geo |
| `post_geo_location` | Per-post geographic location column (not used, not populated) | `social_posts` table | Backend | N/A for this BRD |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | The `language` value must be derived solely from `enrichment.detectedLanguage`; GNews's `rawPayload.lang` must not be used as the primary signal. |
| BRU-002 | Posts without an `enrichment` object must be excluded from the Languages breakdown, the same as unenriched posts are excluded from Sentiment and Sources aggregations. |
| BRU-003 | `rawPayload.source.country` must not be surfaced as a Location, region, or geography dimension. |
| BRU-004 | A GNews-only "Source Country" widget, if ever pursued, must be explicitly labeled as such and must never be titled or positioned as "Location". |
| BRU-005 | The Languages widget must use the existing `EmptyState` component for zero-data cases, not a hardcoded or sample breakdown. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0054 accepted and the client-side Analytics Dashboard data strategy in place | Governing decision | Product Owner | Already resolved 2026-08-17 |
| D-002 | Stories 8.1–8.3 built (tab shell, date-range filter, paginated `GET /v1/posts` fetch loop) | Internal / prior work | Engineering | Already built 2026-08-17 |
| D-003 | Existing `PostEnrichmentSummary` / `extractEnrichmentSummary()` shared surface in `postDisplay.ts` | Internal / shared component | Engineering | Already available |
| D-004 | ISO 639-1 code → display-name mapping (static lookup or small library) | Internal / UI detail | Engineering | Resolved during Story 8.5 implementation |
| D-005 | Azure AI Language and Azure OpenAI connectors already returning `detectedLanguage` | External / pre-existing capability | Engineering | Already shipped in Stories 2.8/2.9 |

---

- A tenant that has credentialed and activated an AI provider already has `detectedLanguage` stored for every enriched post.
- `GET /v1/posts` will continue returning the unfiltered `enrichment` object.
- Client-side aggregation remains a sufficient and acceptable pattern per ADR-0054.
- The implementation can reuse the same date-filtered post fetch loop that Stories 8.1–8.3 built.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No backend endpoint, column, migration, connector, or AI model change is introduced | Maintainability | Must | `social-listening-core` remains unchanged; all implementation is in `social-listening-admin` |
| NFR-002 | The Languages widget derives its data from the same client-side aggregation pipeline used by other Epic 8 widgets | Performance | Should | Reuses the existing `GET /v1/posts` fetch loop and `useMemo` / computed-summary pattern; no additional per-widget backend call is added |
| NFR-003 | The dashboard never presents fabricated, placeholder, or hardcoded values as real data | Integrity | Must | All numbers are computed from the filtered post set; any fallback is an explicit empty or "no data" state |
| NFR-004 | Widget text and labels are accessible and responsive | Accessibility / Usability | Should | Chart/legend labels are readable, keyboard-focusable where interactive, and adapt to mobile viewports per the existing design system |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes a real, previously-unresearched gap at very low cost: Language requires no backend change at all, because the data has already been computed and persisted by already-shipped code (Story 2.8/2.9) since before Epic 8 even started.
- No historical backfill is needed — any post enriched since Story 2.8/2.9 shipped already carries `detectedLanguage` in its stored `enrichment` blob.
- Keeps the Location question honestly closed rather than reopened on hope: re-investigating it independently, rather than assuming ADR-0054's conclusion still holds, is exactly the discipline this project's own traceability standard requires — and it surfaced one genuine new nuance (GNews `source.country`) worth naming even though it doesn't change the bottom line.

**Negative**
- Language coverage is only as complete as enrichment coverage generally — a tenant with no AI provider ever credentialed/active sees no language data, the same limitation Sentiment/Key-Phrase widgets already have and already accept.
- The GNews-only "Source Country" option, though technically free to build, is named and left unbuilt — a real, if minor, missed opportunity if Menno judges the mislabeling risk (Decision §2, Context) acceptable with sufficiently careful copy; this ADR does not make that call.
- Widening `PostEnrichmentSummary` touches a function also used by the existing post feed/detail view (Story 6.11/6.16) — a shared-surface change, not purely additive to Epic 8 alone, though it changes nothing about those screens unless a future story chooses to render the new field there too.

---

## 12. Assumptions and Dependencies
- A tenant that has credentialed and activated an AI provider already has `detectedLanguage` stored for every enriched post.
- `GET /v1/posts` will continue returning the unfiltered `enrichment` object.
- Client-side aggregation remains a sufficient and acceptable pattern per ADR-0054.
- The implementation can reuse the same date-filtered post fetch loop that Stories 8.1–8.3 built.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Language coverage is only as complete as a tenant's enrichment coverage | Medium | Medium | Render an honest empty state and align messaging with existing Sentiment/Key-Phrase widgets | Product Owner |
| R-002 | Widening `PostEnrichmentSummary` also affects the post feed/detail view | Medium | Low | Only add the field to the shared summary; do not render it on the feed or detail unless a separate, explicit story follows | Frontend Lead |
| R-003 | Stakeholders may still ask for Location despite this BRD excluding it | Medium | Medium | Keep the GNews source-country option as a tracked open question and reference ADR-0054/0055 when discussing roadmap | Product Owner |
| R-004 | Mislabeling `source.country` as a Location dimension | Low | High | Enforce BRU-003/BRU-004; do not build the widget in this scope | Product Owner |
| R-005 | The chosen widget placement (Sources vs. Conversations tab) is later revisited | Medium | Low | Leave exact tab placement and styling to implementation, noting the open question; re-evaluate after user feedback | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0055-analytics-language-and-location-enrichment-feasibility.md`
- BRD: `../Business-Requirements/BRD-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above