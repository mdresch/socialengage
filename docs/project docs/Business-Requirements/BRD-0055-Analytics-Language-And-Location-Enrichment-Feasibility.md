# BRD-0055: Analytics Language and Location Enrichment Feasibility

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Analytics Language and Location Enrichment Feasibility — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-17 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-17 | BRD Writer Agent | Initial draft from ADR-0055, feature design 08, and Story 8.5 |
| 1.0 | 2026-08-17 | BRD Writer Agent | Approved with Menno as sponsor, product owner, and technical lead |

---

## 2. Executive Summary

The Analytics Dashboard was introduced in Epic 8 to give tenant users an at-a-glance view of monitored content. The reference design that inspired it included a "Languages Breakdown" widget and Location-oriented visualisations, but no one had confirmed whether the data pipeline actually captured these fields. This BRD documents the findings of ADR-0055, which investigated both independently.

**Language** is already computed and persisted by both real AI provider connectors on every successful enrichment, and the `GET /v1/posts` endpoint already returns the value unfiltered in the `enrichment` JSON blob. The only missing piece is client-side surfacing: `postDisplay.ts` does not currently read `enrichment.detectedLanguage`. This means a low-cost, `social-listening-admin`-only change can deliver the Languages breakdown.

**Location** remains not feasible. No real connector populates `post_geo_location`, and the dashboard's actual data source (`SocialPostSummary`) omits that field. A technically-free GNews-only "Source Country" adjacent option was identified and deliberately declined as a Location substitute to avoid misrepresenting publisher headquarters as conversation geography.

The proposed solution is therefore surgical: extend `PostEnrichmentSummary` to expose `language`, add a Languages breakdown widget to the Analytics Dashboard, and explicitly leave Location and GNews-only source country out of scope.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Surface AI-detected language in the Analytics Dashboard with no backend work | Story 8.5 ships using only `social-listening-admin` changes, with `social-listening-core` untouched |
| 2 | Close the reference-design gap for the Languages widget | A Languages breakdown renders on the Sources or Conversations tab with real, derived data |
| 3 | Avoid speculative investment in Location when no per-post geo-data exists | Location features remain explicitly deferred; no engineering effort is spent on `post_geo_location` or fabricated country widgets |
| 4 | Preserve honest data representation | Every widget renders an empty state when data is absent; no fabricated or mislabeled numbers are shown |

---

## 4. Scope

### 4.1 In Scope

- Extend `PostEnrichmentSummary` and `extractEnrichmentSummary()` in `postDisplay.ts` to read `enrichment.detectedLanguage` and expose a `language: string | null` field (ISO 639-1 code).
- Add a Languages breakdown widget to the Analytics Dashboard, computed client-side from the already-fetched `SocialPostSummary[]` set.
- Provide a human-readable display-name mapping for at least the ISO 639-1 codes the real enrichment pipeline can produce.
- Place the Languages widget on the Sources tab or the Conversations tab (implementation-time judgment, not fixed here).
- Support click-to-filter: selecting a language narrows the currently displayed post set to posts whose `enrichment.detectedLanguage` matches.
- Render the existing `EmptyState` component when no enriched posts are available for the selected date range.
- Exclude posts that have no `enrichment` blob at all from the Languages aggregation (they are not treated as an "unknown" language).

### 4.2 Out of Scope

- Any change to `social-listening-core` (new endpoints, migrations, columns, connector logic, or AI model changes).
- A per-post or per-conversation Location feature, including maps, region filters, or geo-density visualisations.
- A GNews-only "Source Country" widget, even though the field is technically available in `rawPayload`.
- Surfacing the new `language` field on the post feed or post detail view (Story 6.11/6.16) — a reasonable follow-up, but not this BRD.
- Use of GNews's raw `lang` field as the primary language signal.

### 4.3 Assumptions

- A tenant that has credentialed and activated an AI provider already has `detectedLanguage` stored for every enriched post.
- `GET /v1/posts` will continue returning the unfiltered `enrichment` object.
- Client-side aggregation remains a sufficient and acceptable pattern per ADR-0054.
- The implementation can reuse the same date-filtered post fetch loop that Stories 8.1–8.3 built.

### 4.4 Constraints

- No new `social-listening-core` endpoint, column, migration, connector change, or contract test for the backend is authorized or required.
- No widget may render fabricated, placeholder, or hardcoded sample data.
- Location may not be approximated by `source.country` or any other publisher metadata that does not actually describe where the conversation is taking place.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Tenant-Admin | Primary consumer of the Analytics Dashboard | High | See which languages content is written in, without opening individual posts |
| Tenant-Business-Analyst | Uses dashboard for reporting and shareable insights | High | Filter and export data by language, understand the linguistic composition of coverage |
| Product Owner (Menno) | Decision owner for ADR-0055 | High | Low-cost, honest delivery of Language; no speculative Location work |
| Frontend Engineering | Builds the `social-listening-admin` widget | High | Clear scope that stays within client-side code and existing contracts |
| Customer Success / Sales | Communicates roadmap and dashboard value | Medium | A concrete, shippable Languages widget; honest positioning on Location limitations |

---

## 6. Current State (As-Is)

`PostEnrichmentSummary` in `social-listening-admin/src/app/tenant/posts/postDisplay.ts` declares `sentiment`, `sentimentScores`, `entities`, `keyPhrases`, and `modelUsed`, but not `language` or `detectedLanguage`. `extractEnrichmentSummary()` never reads `enrichment.detectedLanguage`, even though the value is present in the `enrichment` object on every post that has been enriched.

On the backend, both real AI provider connectors already compute `detectedLanguage`:

- `azureAiLanguageConnector.ts` makes a `LanguageDetection` Azure AI Language call and maps `detectedLanguage` into the `AnalyzeResult`.
- `azureOpenAiConnector.ts` requires `detectedLanguage` as a structured-output field and instructs the model to return an ISO 639-1 code.

This value is written unfiltered into `social_posts.enrichment` (JSONB) by every real ingest path and by the manual-enrichment route. `GET /v1/posts` returns `enrichment` as `unknown`, so the data already reaches the dashboard without any transformation.

For Location, `social_posts.post_geo_location` is a nullable column that no connector populates, and `SocialPostSummary` does not return it. The dashboard's data source therefore has no per-post or per-conversation geography to aggregate.

### Pain points

- The reference design promised a Languages Breakdown, but it was not buildable for v1 because the client-side parsing gap was not yet identified.
- Tenants cannot understand the linguistic makeup of their coverage without reading posts one at a time.
- Location was raised as a desirable dashboard dimension, but no trustworthy data source exists, risking either non-delivery or misleading visualisations.

---

## 7. Future State (To-Be)

`extractEnrichmentSummary()` will read `enrichment.detectedLanguage` and surface it as `PostEnrichmentSummary.language` (a string ISO 639-1 code, or `null` when absent). The Analytics Dashboard will include a Languages breakdown widget that aggregates the `language` field across the date-filtered, fetched post set.

The widget will:

- Count posts per detected language.
- Map each ISO 639-1 code to a human-readable display name.
- Render an `EmptyState` when the selected range contains no enriched posts.
- Allow the user to click a language to filter the dashboard's post set to that language, consistent with other click-to-filter interactions in Epic 8.

Location will remain explicitly out of scope. The GNews-only `source.country` option will not be built as a Location substitute and will be tracked only as an open question for a future, separate decision.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose `enrichment.detectedLanguage` through `PostEnrichmentSummary` as a `language` field | Must | `extractEnrichmentSummary()` returns `language: string \| null` for every enriched post; the field reads `enrichment.detectedLanguage` | Product Owner |
| BR-002 | The system shall render a Languages breakdown widget on the Analytics Dashboard | Must | A language-distribution widget appears on either the Sources or Conversations tab, counts posts per language, and updates when the date range or filters change | Product Owner |
| BR-003 | The system shall map ISO 639-1 language codes to human-readable display names | Should | At minimum the codes produced by the real connectors (e.g. `en` → `English`) display correctly; other known codes fall back to the code itself | Frontend Lead |
| BR-004 | The system shall exclude posts without an `enrichment` blob from the Languages aggregation | Must | Posts with no `enrichment` do not appear in the breakdown and are not counted as an "unknown" language | Product Owner |
| BR-005 | The system shall let users click a language to filter the dashboard post set | Should | Selecting a language in the widget sets the active language filter and narrows the displayed posts to that `detectedLanguage` | Product Owner |
| BR-006 | The system shall render an honest empty state when no language data is available | Must | Zero enriched posts in the selected range shows the existing `EmptyState` component, never a fabricated sample breakdown | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No backend endpoint, column, migration, connector, or AI model change is introduced | Maintainability | Must | `social-listening-core` remains unchanged; all implementation is in `social-listening-admin` |
| NFR-002 | The Languages widget derives its data from the same client-side aggregation pipeline used by other Epic 8 widgets | Performance | Should | Reuses the existing `GET /v1/posts` fetch loop and `useMemo` / computed-summary pattern; no additional per-widget backend call is added |
| NFR-003 | The dashboard never presents fabricated, placeholder, or hardcoded values as real data | Integrity | Must | All numbers are computed from the filtered post set; any fallback is an explicit empty or "no data" state |
| NFR-004 | Widget text and labels are accessible and responsive | Accessibility / Usability | Should | Chart/legend labels are readable, keyboard-focusable where interactive, and adapt to mobile viewports per the existing design system |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The `language` value must be derived solely from `enrichment.detectedLanguage`; GNews's `rawPayload.lang` must not be used as the primary signal. |
| BRU-002 | Posts without an `enrichment` object must be excluded from the Languages breakdown, the same as unenriched posts are excluded from Sentiment and Sources aggregations. |
| BRU-003 | `rawPayload.source.country` must not be surfaced as a Location, region, or geography dimension. |
| BRU-004 | A GNews-only "Source Country" widget, if ever pursued, must be explicitly labeled as such and must never be titled or positioned as "Location". |
| BRU-005 | The Languages widget must use the existing `EmptyState` component for zero-data cases, not a hardcoded or sample breakdown. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `enrichment.detectedLanguage` | ISO 639-1 language code computed by the active AI provider connector | `social_posts.enrichment` (JSONB), returned by `GET /v1/posts` | Existing enrichment pipeline | Low — derived text-property, no PII |
| `PostEnrichmentSummary.language` | Derived UI field exposing `enrichment.detectedLanguage` or `null` | `extractEnrichmentSummary()` in `postDisplay.ts` | Frontend | Low |
| `rawPayload.lang` | Optional source-declared language field on GNews articles only | Raw GNews API response | GNews connector | Low |
| `rawPayload.source.country` | Country code of the GNews publisher's declared location | Raw GNews API response | GNews connector | Low — publisher metadata, not audience geo |
| `post_geo_location` | Per-post geographic location column (not used, not populated) | `social_posts` table | Backend | N/A for this BRD |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Languages breakdown | Show the distribution of detected languages across the selected posts | Tenant User / Tenant-Admin / Tenant-Business-Analyst | Per dashboard view, updated on date-range or filter change |
| Language-filtered post set | Let users drill into posts written in a specific language | Tenant-Business-Analyst / Tenant-Reader | On user selection |
| Empty-state coverage | Identify when no enriched posts exist for the selected range | Tenant User | Per dashboard view |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Language coverage is only as complete as a tenant's enrichment coverage | Medium | Medium | Render an honest empty state and align messaging with existing Sentiment/Key-Phrase widgets | Product Owner |
| R-002 | Widening `PostEnrichmentSummary` also affects the post feed/detail view | Medium | Low | Only add the field to the shared summary; do not render it on the feed or detail unless a separate, explicit story follows | Frontend Lead |
| R-003 | Stakeholders may still ask for Location despite this BRD excluding it | Medium | Medium | Keep the GNews source-country option as a tracked open question and reference ADR-0054/0055 when discussing roadmap | Product Owner |
| R-004 | Mislabeling `source.country` as a Location dimension | Low | High | Enforce BRU-003/BRU-004; do not build the widget in this scope | Product Owner |
| R-005 | The chosen widget placement (Sources vs. Conversations tab) is later revisited | Medium | Low | Leave exact tab placement and styling to implementation, noting the open question; re-evaluate after user feedback | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0054 accepted and the client-side Analytics Dashboard data strategy in place | Governing decision | Product Owner | Already resolved 2026-08-17 |
| D-002 | Stories 8.1–8.3 built (tab shell, date-range filter, paginated `GET /v1/posts` fetch loop) | Internal / prior work | Engineering | Already built 2026-08-17 |
| D-003 | Existing `PostEnrichmentSummary` / `extractEnrichmentSummary()` shared surface in `postDisplay.ts` | Internal / shared component | Engineering | Already available |
| D-004 | ISO 639-1 code → display-name mapping (static lookup or small library) | Internal / UI detail | Engineering | Resolved during Story 8.5 implementation |
| D-005 | Azure AI Language and Azure OpenAI connectors already returning `detectedLanguage` | External / pre-existing capability | Engineering | Already shipped in Stories 2.8/2.9 |

---

## 14. Acceptance Criteria

- `PostEnrichmentSummary` gains a `language: string | null` field, read from `enrichment.detectedLanguage`.
- The Analytics Dashboard renders a Languages breakdown widget on the Sources or Conversations tab.
- The widget aggregates real `language` values from the date-filtered `SocialPostSummary[]` set.
- At least the ISO 639-1 codes produced by the real connectors are mapped to human-readable display names.
- Posts without `enrichment` are excluded from the widget, not shown as "unknown language".
- Zero enriched posts in the selected range renders the existing `EmptyState` component.
- Clicking a language in the widget filters the post set to that language, consistent with other dashboard widgets.
- No `social-listening-core` endpoint, column, migration, connector, or AI model is added or modified.
- Location features, including any use of `source.country` as a Location signal, are not built.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `detectedLanguage` | ISO 639-1 language code returned by an AI provider connector as part of the `AnalyzeResult` enrichment object. |
| `PostEnrichmentSummary` | Client-side TypeScript interface that represents the subset of `enrichment` fields the UI understands and renders. |
| `enrichment` | JSONB object stored on each `social_posts` row, produced by the active AI provider connector and returned unfiltered by `GET /v1/posts`. |
| ISO 639-1 | Two-letter coding system for the representation of languages (e.g. `en` for English, `nl` for Dutch). |
| `rawPayload` | The original, connector-specific response payload attached to a post, distinct from AI-derived `enrichment`. |
| Source Country | The country declared by a GNews publisher (`source.country` in the GNews API), describing the outlet, not the content's subject or audience. |
| Location (per this BRD) | Per-post or per-conversation geography, not available in the current data set because no connector populates `post_geo_location`. |

---

## 16. Appendices

### Reference documents

- ADR-0055 — `docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md` (Accepted 2026-08-17) — the primary source for decisions, consequences, and alternatives.
- ADR-0054 — `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md` (Accepted 2026-08-17) — governing data strategy and client-side aggregation boundary.
- Feature design — `docs/product-research/feature-designs/08-dashboards-and-analytics.md` — high-level dashboard intent, persona acceptance, and technical design context.
- User stories — `docs/user-stories/epic-8-analytics-dashboard.md`, specifically **Story 8.5 — Languages breakdown widget** — implementation intent and acceptance criteria.

### Research and analysis

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature. The source ADR contains the direct codebase verification and analysis (e.g. `azureAiLanguageConnector.ts`, `azureOpenAiConnector.ts`, `postDisplay.ts`, `pollGNewsSearch.ts`, `socialPostStore.ts`).

### Notes

- ADR-0055 also spawned a separate, related investigation tracked as ADR-0056 (`docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md`) for AI-inferred Newswire dateline extraction. That ADR is out of scope for this BRD and is not adopted here.
- The Location tab referenced in the Google AI Studio design and in `docs/design/Google AI Studio/src/components/LocationDashboardTab.tsx` remains not buildable because the dashboard's data source lacks any per-post geography.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-17 |
| Product Owner | Menno | — | 2026-08-17 |
| Technical Lead | Menno | — | 2026-08-17 |
| Other Stakeholder | — | — | — |
