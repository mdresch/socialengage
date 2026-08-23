# Business Requirements Document: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-20 |
| Author(s) | Product Owner / BRD Writer Agent |
| Approver(s) | Menno, Business Sponsor |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-20 | Product Owner / BRD Writer Agent | Initial BRD derived from ADR-0071 and related stories |

---

## 2. Executive Summary

AI-enriched social posts frequently contain heuristic misclassifications that cannot be corrected today. Once Azure AI Language and OpenAI pipelines write sentiment, key phrases, language, country, and summary values to a post, those fields are effectively immutable for tenant analysts. As a result, downstream analytics, crisis alerts, and reporting inherit and amplify AI errors, undermining trust in the platform's insights.

This BRD defines the business requirements for ADR-0071: a human-in-the-loop capability that lets authorized tenant users and administrators review and edit enrichment attributes directly from the Posts page while preserving the original AI output and a full audit trail. A secondary "Enrichment Details" drawer will slide in beside the existing Post Details drawer so analysts can compare the original post text with the corrected enrichment values in context. The solution also protects human edits by preventing automated re-enrichment from overwriting them unless the user explicitly forces a re-run.

The expected outcome is higher data accuracy, stronger analyst trust, immediate analytics corrections, and full traceability of every human override.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Improve accuracy of AI-enriched post data | Reduction in tenant-reported sentiment/key-phrase misclassifications |
| 2 | Maintain full traceability of human corrections | Every override stores the original AI values, modified fields, user, and timestamp |
| 3 | Protect analyst corrections from accidental AI overwrite | Automated re-enrichment yields a `409 Conflict` unless the user explicitly opts into a forced re-run |
| 4 | Deliver a contextual, low-friction editing experience | Analysts can edit enrichment values while the original post text remains visible side-by-side |
| 5 | Keep analytics and reporting immediately consistent | Corrected values feed the existing dashboard aggregations without dedicated backfill or schema migrations |

---

## 4. Scope

### 4.1 In Scope

- Manual editing of the following enrichment fields for an individual social post:
  - Sentiment classification and score
  - Key phrases
  - Detected language
  - Geospatial country / region
  - Summary / grounding notes
- A secondary "Enrichment Details" drawer launched from the existing Post Details drawer
- Cascading dual-drawer interaction on large viewports and a full-width overlay fallback on compact viewports
- In-place persistence of corrected values with audit metadata (`override.isOverridden`, `overriddenFields`, `originalValues`, `aiHistory`)
- Role-based authorization for both `tenant_user` and `tenant_admin`
- Backend validation, sanitization, and cross-field consistency rules
- Re-enrichment precedence guard that rejects automated re-runs over overridden posts unless `force: true`
- Accessibility (a11y) compliance for both drawers, including focus trapping and `Escape` handling

### 4.2 Out of Scope

- Batch editing of multiple posts' enrichment values
- Custom training-set export UI
- New database tables or schema migrations beyond the existing `social_posts.enrichment` JSONB structure
- Generic modal-based editing that obscures the post body
- Real-time collaborative editing of the same post

### 4.3 Assumptions

- The existing Azure AI Language and OpenAI enrichment pipelines continue to produce the top-level values to be overridden.
- The existing `social_posts.enrichment` JSONB column can store override metadata without schema migration.
- All analytics and reporting aggregations read top-level `enrichment.*` fields, so corrected values are reflected immediately.
- Tenant users and administrators have the necessary bearer-session authentication and RLS context already in place.

### 4.4 Constraints

- Must use the existing `social_posts` table and `enrichment` JSONB column.
- Must not degrade the performance of the posts feed, post detail, or analytics reads.
- Must comply with the project's a11y standards and keyboard-navigation conventions.
- Must be role-gated within the existing tenant identity model.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Analysts | Primary users correcting AI misclassifications | High | Side-by-side view of post text and enrichment; fast, safe editing; clear audit trail |
| Tenant Administrators | Authorize and sometimes perform corrections | High | Confidence that tenant data is accurate and protected from accidental AI overwrite |
| Platform Product Owner | Feature owner and requirements approval | High | A solution that improves data quality without scope creep or heavy migration |
| Data / Analytics Consumers | Use enriched posts for dashboards and alerts | Medium | Corrected values reflected immediately in aggregations |
| Menno | Business Sponsor and Technical Lead | High | End-to-end acceptance of HITL control, traceability, and drawer UX |

---

## 6. Current State (As-Is)

**Current process:**

1. Posts are ingested from connectors and enriched by Azure AI Language and OpenAI.
2. Enrichment results are written to `social_posts.enrichment` as a JSONB value.
3. A user selects a post on `/tenant/posts` and sees the Post Details drawer, which displays the post body and an AI Enrichment card.
4. The enrichment card is read-only; no API or UI affordance allows a tenant user to correct sentiment, key phrases, language, country, or summary.
5. Re-enrichment can be triggered, but there is no logic to detect or protect prior human corrections.

**Pain points:**

- Sarcasm, jargon, and regional dialects are frequently misclassified.
- Analysts cannot correct sentiment or key phrases, so dashboards and alerts remain skewed.
- There is no audit trail or lineage for any future manual corrections.
- Context switching to a modal or another screen would break the analyst's reading flow.

---

## 7. Future State (To-Be)

**New or improved process:**

1. An analyst opens the Post Details drawer for a post on `/tenant/posts`.
2. The AI Enrichment card now includes an "Edit enrichment details" icon button.
3. Clicking the button opens the Enrichment Details drawer alongside the Post Details drawer, pushing the first drawer left on large viewports or overlaying it on compact viewports.
4. The analyst edits sentiment, key phrases, language, country, and summary with validated controls.
5. Saving the changes persists the updated values in-place, records the user, timestamp, and original values, and lists which fields were overridden.
6. The posts feed and analytics immediately reflect the corrected values.
7. If an automated or on-demand re-enrichment job targets an overridden post, it is rejected unless the user confirms a forced re-run.
8. Forced re-runs archive the previous AI output and the previous override state so lineage is never lost.

**Expected capabilities:**

- Granular, validated human correction of every enrichment attribute.
- Full preservation of original AI predictions and re-enrichment history.
- Protected edits via an explicit re-enrichment precedence guard.
- Accessible, responsive dual-drawer workflow.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Authorized tenant users and administrators can open an enrichment editing drawer from the post details panel | Must | Clicking the edit icon opens `EnrichmentEditDrawer` without dismissing the post details drawer | Product Owner |
| BR-002 | Users can modify sentiment and sentiment score for an enriched post | Must | Valid `positive`, `neutral`, or `negative` sentiment selected; score auto-normalized if omitted | Product Owner |
| BR-003 | Users can add, remove, and reorder key phrases | Must | Up to 50 phrases, each up to 200 characters; duplicates removed; blank and HTML-stripped entries discarded | Product Owner |
| BR-004 | Users can correct the detected language and geospatial country/region | Must | Language restricted to ISO 639-1; country normalized to ISO 3166-1 alpha-2 or cleared | Product Owner |
| BR-005 | Users can edit the summary / grounding notes | Must | Field accepts up to 1,000 characters or is left empty | Product Owner |
| BR-006 | The system records the original AI values and a full override audit trail | Must | `override.isOverridden`, `overriddenByUserId`, `overriddenAt`, `overriddenFields`, and `originalValues` persisted | Product Owner |
| BR-007 | The system preserves prior AI generation passes in an immutable history | Must | `aiHistory[]` accumulates previous automated outputs across forced re-enrichments | Product Owner |
| BR-008 | Automated and on-demand re-enrichment respect the human override and require explicit force | Must | `isOverridden === true` and `force !== true` returns `409 Conflict` with override metadata; `force: true` archives and resets | Product Owner |
| BR-009 | The UI indicates which posts have been manually edited | Must | An "Edited by user" badge appears when `override.isOverridden === true`, with user and timestamp tooltip | Product Owner |
| BR-010 | Large and compact viewports both support the editing workflow | Should | Side-by-side cascading layout at `>= 1200px`; full-width overlay with back button below | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Edited enrichment values are reflected in analytics within the same database transaction | Performance | Must | No dedicated backfill or batch job required; `SocialPostSummary` returned immediately |
| NFR-002 | Only bearer-authenticated, RLS-authorized tenant users or administrators may override | Security | Must | Unauthorized or cross-tenant calls return `404 Not Found` or `403 Forbidden` |
| NFR-003 | The dual-drawer interface meets the project's a11y standards | Accessibility | Must | Focus trapped in the active drawer; `Escape` closes only the edit drawer and returns focus to the trigger; `role="dialog"` and `aria-modal="true"` applied |
| NFR-004 | Drawer layout is usable at the defined responsive breakpoints | Usability | Should | Layout switches cleanly at 1200px without horizontal scroll or clipped controls |
| NFR-005 | The implementation uses the existing `social_posts.enrichment` JSONB structure | Maintainability | Must | No new table, migration, or column required for core override persistence |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A post enrichment override is allowed only for authenticated `tenant_user` or `tenant_admin` roles within the same tenant context. |
| BRU-002 | Valid sentiment values are `positive`, `neutral`, and `negative`. |
| BRU-003 | If `sentiment` is supplied without a `sentimentScore`, the system auto-assigns a default score: `positive` → 0.8, `neutral` → 0.5, `negative` → 0.2. |
| BRU-004 | Key phrases may be empty but are capped at 50 phrases; each phrase is capped at 200 characters after HTML stripping, trimming, and blank removal. |
| BRU-005 | Key phrase deduplication is case-insensitive and preserves the casing of the first occurrence. |
| BRU-006 | `detectedLanguage` must be a valid ISO 639-1 two-letter code or `null`; malformed values are rejected. |
| BRU-007 | `geoCountry` is normalized to uppercase ISO 3166-1 alpha-2 or `null`; `geoCountryName` is cleared when `geoCountry` is `null` and derived/validated when `geoCountry` is set. |
| BRU-008 | `summary` is optional, up to 1,000 characters, or `null`; it maps to both `enrichment.summary` and `enrichment.groundingContext`. |
| BRU-009 | Once a post has been overridden, any automated or on-demand re-enrichment returns `409 Conflict` unless the request explicitly passes `force: true`. |
| BRU-010 | A forced re-enrichment must reset `override.isOverridden` to `false`, archive the previous AI values into `aiHistory[]`, and update `originalValues` with the new AI output. |
| BRU-011 | `overriddenFields[]` must list exactly the top-level enrichment keys modified in a given override request. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `social_posts.enrichment` | JSONB column containing all AI-enriched values and override metadata | Azure AI Language / OpenAI + user overrides | Backend | Tenant-confidential |
| `enrichment.override.isOverridden` | Boolean flag indicating whether any top-level value has been manually changed | User edit action | Backend | Tenant-confidential |
| `enrichment.override.overriddenAt` | ISO 8601 UTC timestamp of the last override | System clock | Backend | Operational |
| `enrichment.override.overriddenByUserId` | ID of the authenticated user who performed the override | Session identity | Backend | Personal data (user ID) |
| `enrichment.override.overriddenFields` | Array of field names changed in the last override | UI form / API payload | Backend | Operational |
| `enrichment.override.originalValues` | Snapshot of the AI-generated values before the first human override | Current `enrichment` top-level values | Backend | Tenant-confidential |
| `enrichment.override.aiHistory` | Array of previous AI generation passes and their values | Prior `enrichment` snapshots | Backend | Tenant-confidential |
| `SocialPostSummary` | Existing API response shape carrying the updated enrichment | `PATCH /v1/posts/:id/enrichment` | Backend | Tenant-confidential |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Volume of overridden posts by tenant | Track adoption of human-in-the-loop correction | Product / Operations | Monthly |
| Most frequently overridden fields | Identify which AI attributes analysts correct most often | Data Science / Product | Monthly |
| Re-enrichment conflict rate | Count `409 Conflict` responses or forced re-runs | Engineering / Product | Weekly |
| Post-correction sentiment distribution | Validate that overrides improve analytics accuracy | Tenant Analysts / Executives | Real-time (dashboards) |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Analysts override correct AI values, introducing human error | Medium | Medium | Validation rules, audit trail, and future ML quality monitoring on `originalValues` vs. overrides | Product Owner |
| R-002 | Client state becomes out of sync between the feed and the open drawers | Medium | High | Optimistic update with rollback on PATCH failure; refresh via the existing `SocialPostSummary` contract | Engineering Lead |
| R-003 | Dual-drawer focus and keyboard navigation create a11y regressions | Medium | High | Focus trap, `Escape` handling, and `aria-modal` attributes tested against a11y checklist | UX Lead |
| R-004 | Automated background re-enrichment silently overwrites manual edits | Low | High | Precedence guard returns `409 Conflict` unless `force: true`; frontend forces explicit confirmation | Engineering Lead |
| R-005 | Invalid key phrases or language/country codes corrupt tenant analytics | Low | Medium | Strict validation, sanitization, and cross-field normalization before persistence | Engineering Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0038 (Azure AI Language enrichment) | Architectural | Menno | Accepted |
| D-002 | ADR-0055 (Detected language normalization) | Architectural | Menno | Accepted |
| D-003 | ADR-0064 (Geospatial country normalization) | Architectural | Menno | Accepted |
| D-004 | ADR-0065 (Grounding summary) | Architectural | Menno | Accepted |
| D-005 | Story 3.13 — Post Enrichment Overrides API and Re-Enrichment Precedence Guard | Implementation | Engineering | Built |
| D-006 | Story 6.31 — Human-in-the-Loop Post Enrichment Cascading Edit Drawer | Implementation | Engineering | Built |
| D-007 | Existing `PATCH /v1/posts/:id/enrichment` API and `SocialPostSummary` shape | Technical | Engineering | Built |
| D-008 | `PostDetailPanel.tsx` and posts feed state management | Technical | Engineering | Built |

---

## 14. Acceptance Criteria

- [ ] An authorized tenant user or administrator can open a post and see an "Edit enrichment details" button on the AI Enrichment card.
- [ ] Clicking the button opens a second drawer that keeps the original post details visible on large screens or provides a clear back path on compact screens.
- [ ] The form allows editing sentiment, key phrases, language, country, and summary, with all validation and sanitization rules applied.
- [ ] Saving an override updates the post's `enrichment` JSONB, sets `override.isOverridden = true`, records `overriddenByUserId`, `overriddenAt`, and `overriddenFields`, and preserves `originalValues` and `aiHistory`.
- [ ] The updated values are immediately visible in the posts feed and in dashboard aggregations.
- [ ] Running re-enrichment on an overridden post without `force: true` returns `409 Conflict` and shows a confirmation before proceeding when the user elects to force.
- [ ] The interface meets the a11y standards: focus trap, `Escape` behavior, `role="dialog"`, `aria-modal="true"`, and descriptive labels.

---

## 15. Glossary

| Term | Definition |
|---|---|
| HITL | Human-in-the-Loop — a workflow where a human reviews or corrects automated outputs. |
| Enrichment | AI-derived attributes added to an ingested post, including sentiment, key phrases, language, country, and summary. |
| JSONB | PostgreSQL binary JSON type used to store the `social_posts.enrichment` object. |
| Override | A manual user correction stored alongside the original AI-generated enrichment values. |
| `aiHistory` | An array of prior AI generation snapshots retained for lineage and ML quality analysis. |
| `originalValues` | The initial AI-generated values captured before the first human override. |
| `force: true` | An explicit flag required to overwrite a manually overridden post with a new AI re-enrichment. |
| RLS | Row-Level Security in PostgreSQL, used here to enforce tenant isolation. |
| a11y | Accessibility — the practice of making the UI usable by people with disabilities. |
| ISO 639-1 | Standard two-letter language codes (e.g., `en`, `nl`, `de`). |
| ISO 3166-1 alpha-2 | Standard two-letter country codes (e.g., `US`, `NL`, `DE`). |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI](../../adr/0071-human-in-the-loop-post-enrichment-overrides-and-cascading-drawer-ui.md)
- [Story 3.13 — Post Enrichment Overrides API and Re-Enrichment Precedence Guard](../../user-stories/epic-3-data-model-storage-and-archival.md)
- [Story 6.31 — Human-in-the-Loop Post Enrichment Cascading Edit Drawer](../../user-stories/epic-6-tenant-admin-ui.md)
- Related architecture decisions:
  - [ADR-0038](../../adr/0038-ai-sentiment-analysis.md) (Azure AI Language enrichment)
  - [ADR-0055](../../adr/0055-detected-language-normalization.md) (language normalization)
  - [ADR-0064](../../adr/0064-geospatial-country-normalization.md) (country normalization)
  - [ADR-0065](../../adr/0065-grounding-summary.md) (grounding summary)

### 16.2 Notes

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for ADR-0071 at the time of writing; this BRD was synthesized directly from the ADR and its related user stories.
- The ADR is **Accepted** as of 2026-08-20; therefore, this BRD is approved for implementation and no draft caveat is required.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-20 |
| Product Owner | Menno | | 2026-08-20 |
| Technical Lead | Menno | | 2026-08-20 |
| Other Stakeholder | | | |
