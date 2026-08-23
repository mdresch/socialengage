# BRD-0054: Tenant-facing Analytics Dashboard — Scope and Data-Source Strategy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Tenant-facing Analytics Dashboard — Scope and Data-Source Strategy |
| Version | 1.0 |
| Date | 2026-08-17 |
| Author(s) | BRD Writer Agent (synthesized from ADR-0054, Feature Design 08, and Epic 8 user stories) |
| Approver(s) | Menno (Sponsor, Product Owner, Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-17 | BRD Writer Agent | Initial draft from ADR-0054, Feature Design 08, and Epic 8 |
| 1.0 | 2026-08-17 | BRD Writer Agent | Approved with ADR-0054 acceptance |

---

## 2. Executive Summary

**Problem being solved:** `social-listening-admin` currently ships no tenant-facing analytics or dashboard route. `docs/design/frontend-design-specification.md` §10 explicitly deferred "Rich Analytics & Charting Dashboards" to a future analytics/reporting subsystem (citing ADR-0008), leaving tenants to interpret listening value one post at a time through the post feed.

**Who is affected:** Tenant Users, Tenant-Admins, and Tenant-Business-Analysts need an at-a-glance view of listening volume, sentiment, key phrases, and source distribution. Platform administrators need confidence that the dashboard stays within the project's established security, data-integrity, and scope disciplines.

**Proposed solution at a glance:** A new `/tenant/analytics` route in `social-listening-admin` with a tabbed dashboard (Overview, Sentiment, Conversations, Sources), a global date-range filter, and client-side aggregation over the existing `GET /v1/posts` endpoint. Every widget uses real data already returned by the API — `enrichment.sentiment`, `enrichment.keyPhrases`, `rawPayload.providerId`, and `publishedAt` — with no fabricated or placeholder data and no new backend endpoint or aggregation table.

**Expected business value:** Dashboards make the value of ingestion immediately visible to non-analysts, improve tenant retention by reducing the need for manual data export, and establish a real, data-honest v1 baseline that can be extended only when future data sources justify additional widgets.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Give tenants self-service visibility into listening volume, sentiment, and source mix | Tenant can open `/tenant/analytics` and see accurate, real-data KPIs within a selected date range |
| 2 | Eliminate the deferred analytics gap without adding speculative backend aggregation | v1 ships using only `GET /v1/posts` client-side aggregation; no new `social-listening-core` endpoint or `TopicDailyCount` table |
| 3 | Protect data integrity by refusing to ship fabricated, sample, or silent-fallback data | No widget presents hardcoded values as if they were real; empty states are used when real data is absent |
| 4 | Provide a foundation for future dashboard depth | Tab shell, filter model, and aggregation patterns can be extended when real data and new ADRs justify it |

---

## 4. Scope

### 4.1 In Scope

- New `/tenant/analytics` route in `social-listening-admin`, role-gated to Tenant User and Tenant-Admin.
- A tab shell with four tabs: **Overview**, **Sentiment**, **Conversations**, and **Sources**.
- A global, real date-range filter (`GlobalDateRangePicker`) that filters the underlying `GET /v1/posts` query by `publishedAt` and re-aggregates all active widgets.
- **Overview tab:** total matched post count, compact sentiment split, and compact source breakdown (reusing the same client-side aggregates used by the other tabs).
- **Sentiment tab:** sentiment donut (positive/neutral/negative), sentiment-over-time chart bucketed by day, Top Fans/Top Critics by author and sentiment, and positive/negative key-phrase clouds.
- **Conversations tab:** key-phrase word cloud sized by real frequency and a phrase-frequency-over-time chart bucketed by day.
- **Sources tab:** post-volume and sentiment breakdown per real `providerId` (`gnews`, `newswire`, `tenant-owned-feed`).
- Client-side computation from `SocialPostSummary[]` returned by `GET /v1/posts`, plus `enrichment` and `rawPayload.providerId` fields.
- Vanilla CSS design tokens; `recharts` is the charting library.

### 4.2 Out of Scope

- **Location tab** — no real geo data is available via `GET /v1/posts` and no connector populates `postGeoLocation`.
- **Intentions and Tags widgets** — the real `PostEnrichmentSummary` schema has no such fields.
- **Per-widget CSV/JSON export** (`onExportWidgetData`) — author-rights and export governance remain unresolved for v1.
- AI storytelling ("Explain the Spike"), predictive forecasting/early-warning, D3 topic-cluster networks, real-time pulse-maps, 1-click PDF/slide export, and automated action workflows.
- Server-side aggregation endpoints or `TopicDailyCount`-style tables.
- Generic social-platform icons/labels (X/Twitter, LinkedIn, Facebook, etc.); only real project connectors are shown.
- Cleanup of `src/lib/mockData.ts` and `src/lib/types.ts` — noted as a separate follow-up.

### 4.3 Assumptions

- `GET /v1/posts` and `enrichment` already return the fields needed for the in-scope widgets.
- `GlobalDateRangePicker.tsx` is non-fabricated and reusable as drafted.
- Recharts and vanilla CSS design tokens are already available in `social-listening-admin`.
- The tenant user has already authenticated and holds a role with access to `/tenant/analytics`.

### 4.4 Constraints

- No new `social-listening-core` contract, endpoint, column, or migration is authorized for v1.
- No widget may use fabricated, hardcoded, or silent-fallback data.
- Date-bucketed time-series charts use the selected date range and `publishedAt`; exact timezone and multi-month bucketing behavior are left to implementation (ADR-0054 Open Question 7).
- Client-side aggregation over cursor-paginated `GET /v1/posts` is the accepted scale trade-off (ADR-0008 and ADR-0054).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary dashboard user and tenant configuration owner | High | Accurate, self-service view of content volume, sentiment, and sources |
| Tenant User | Reads dashboard for day-to-day brand monitoring | High | Easy-to-understand widgets, honest empty states, no misleading sample data |
| Tenant-Business-Analyst | Uses the dashboard for reporting and decision support | High | Filterable, exportable (future), real-data insights without manual roll-ups |
| Topic-Center-Analyst | Investigates trends and topics | Medium | Phrase and sentiment views that reflect actual monitored content |
| Platform-Admin | Operates platform-wide services | Medium | No cross-tenant data leakage; dashboard respects RLS and existing auth |
| Menno | Sponsor, Product Owner, and Technical Lead | High | Scope discipline, real data only, and minimal speculative backend work |

---

## 6. Current State (As-Is)

**Current process:**

1. `social-listening-admin` exposes no `/analytics` route.
2. The approved frontend design spec §10 explicitly deferred "Rich Analytics & Charting Dashboards" to a future analytics/reporting subsystem.
3. A pre-existing, uncommitted prototype exists under `social-listening-admin/src/app/tenant/analytics/` but is not implementation-ready:
   - Imports a `./types` module that does not exist.
   - References `ad-*` CSS classes that are not defined.
   - Mixes real computed data with hardcoded fallback arrays (`TOP_FANS`, `TOP_CRITICS`, `SENTIMENT_HISTORY`, `MAIN_PHRASES`, `PHRASES_HISTORY`, `INTENTIONS`, `TAGS`, and fully static `LocationDashboardTab`).
4. Tenants currently interpret listening activity through the paginated post feed only.

**Pain points:**

- No at-a-glance view of brand health or content mix.
- The existing prototype would mislead users by rendering fabricated data without visual distinction from real data.
- Deferred analytics functionality leaves the value of the ingestion stack hidden from non-analysts.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A tenant user navigates to **Analytics** in the left nav and lands on `/tenant/analytics?tab=overview`.
2. The user selects a global date range (presets or custom); the dashboard pages through `GET /v1/posts` for the tenant and date range.
3. Client-side aggregation computes the widgets for the active tab.
4. The user switches between Overview, Sentiment, Conversations, and Sources tabs; tab state is reflected in the URL query string.
5. Every number is derived from real fetched posts; zero matches render an honest `EmptyState`.

**Expected capabilities:**

- Dashboard shell with deep-linkable tab state and global date filter.
- Overview KPIs for total posts, sentiment split, and source mix.
- Sentiment tab with donut, time-series, top authors, and key-phrase clouds.
- Conversations tab with phrase cloud and phrase-over-time chart.
- Sources tab with per-connector volume and sentiment breakdown.
- Zero new backend aggregation surface or speculative data model.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a new tenant-facing Analytics section at `/tenant/analytics` | Must | Route exists, is listed in left nav, and is accessible to Tenant User and Tenant-Admin roles | Menno / Implementer |
| BR-002 | The dashboard shall provide a global date-range filter that drives every widget | Must | Selecting a preset or custom range re-fetches and re-aggregates all widgets for the active tab | Menno / Implementer |
| BR-003 | The Overview tab shall display total matched posts, a compact sentiment split, and a compact source breakdown | Must | All three KPIs are computed from real `GET /v1/posts` data and re-aggregate when the date range changes | Menno / Implementer |
| BR-004 | The Sentiment tab shall display a sentiment donut, sentiment-over-time chart, Top Fans, Top Critics, and positive/negative key-phrase clouds | Must | All widgets compute from real `enrichment.sentiment`, `enrichment.keyPhrases`, `author`, and `publishedAt`; no hardcoded fallback data | Menno / Implementer |
| BR-005 | The Conversations tab shall display a key-phrase word cloud and a phrase-frequency-over-time chart | Must | Phrase frequency and time series are computed from real `enrichment.keyPhrases` and `publishedAt`; no `MAIN_PHRASES` or `PHRASES_HISTORY` fallbacks | Menno / Implementer |
| BR-006 | The Sources tab shall display post volume and sentiment split per real content connector | Must | Breakdown groups by `rawPayload.providerId` for only `gnews`, `newswire`, and `tenant-owned-feed`; no generic social-platform labels | Menno / Implementer |
| BR-007 | The dashboard shall render an honest empty state when no posts match the selected filters | Must | Every tab shows the existing `EmptyState` component on zero matches; no sample data is displayed | Menno / Implementer |
| BR-008 | The dashboard shall compute all v1 widgets client-side from existing `GET /v1/posts` data | Must | No new `social-listening-core` endpoint, stored column, migration, or aggregation table is introduced | Menno / Implementer |
| BR-009 | Tab selection and filter state shall be deep-linkable | Should | URL contains `?tab=<tab>` and filter state is reflected in query parameters consistent with the post feed | Menno / Implementer |
| BR-010 | Widget interactions shall filter the underlying post set consistently | Should | Selecting an author, phrase, or source applies a filter to the active post set and can open the existing Post Detail `Slideover` | Menno / Implementer |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard widgets must only display data the authenticated tenant is authorized to see | Security | Must | RLS-protected `GET /v1/posts` is the sole data source; no cross-tenant data is rendered |
| NFR-002 | Client-side aggregation must handle large post volumes within the accepted scale ceiling | Performance | Should | Fetch loop pages through `GET /v1/posts`; scale limitations are documented and not hidden |
| NFR-003 | Charts and interactive elements must be keyboard-focusable and use color-blind-friendly palettes | Accessibility | Should | Recharts/inline SVG widgets meet project a11y conventions; chart alt text is present |
| NFR-004 | Dashboard components must use the approved vanilla CSS design tokens | Maintainability | Must | No Tailwind utility classes from the reference design are ported as production code |
| NFR-005 | The dashboard must remain maintainable with no dead demo-data dependencies | Maintainability | Must | No import or dependency on `src/lib/mockData.ts` or `src/lib/types.ts` |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only `gnews`, `newswire`, and `tenant-owned-feed` may appear as source labels in the Sources tab. |
| BRU-002 | No widget may present hardcoded, sample, or fabricated data as if it were real tenant data. |
| BRU-003 | When a real aggregate yields zero results, the dashboard must render an empty state, not a fallback array. |
| BRU-004 | The global date filter must apply to `publishedAt` and re-fetch/re-aggregate the active tab's data. |
| BRU-005 | Author names in Top Fans/Top Critics must come from the existing `extractAuthor()` normalization, not from a static demo list. |
| BRU-006 | `enrichment.keyPhrases` may only be shown in phrase clouds/frequency charts when they come from real post enrichment. |
| BRU-007 | Per-widget CSV/JSON export is not permitted in v1; any future export must be reconciled with ADR-0039/Story 6.13's tenant export mechanism. |
| BRU-008 | Client-side aggregation must consume only `GET /v1/posts` and fields already returned in `SocialPostSummary`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPostSummary[]` | Paginated list of posts for the tenant and date range | `GET /v1/posts` (`social-listening-core`) | Backend / RLS | Tenant-confidential |
| `enrichment.sentiment` | Post-level positive/neutral/negative classification | `enrichment` JSONB on `social_posts` | AI enrichment pipeline | Tenant-confidential |
| `enrichment.keyPhrases` | Extracted key phrases from the post | `enrichment` JSONB on `social_posts` | AI enrichment pipeline | Tenant-confidential |
| `rawPayload.providerId` | Ingestion connector identifier (`gnews`, `newswire`, `tenant-owned-feed`) | `social_posts` raw payload | Connector layer | Low |
| `publishedAt` | Original publication timestamp | `social_posts` | Connector layer | Low |
| `author` (normalized) | Normalized author/publication name | `extractAuthor()` / `postDisplay.ts` | Backend | Tenant-confidential; attribution |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Total matched post count | Shows listening volume for the selected date range | Tenant User / Admin | On demand |
| Sentiment split (positive / neutral / negative) | High-level brand-health view | Tenant User / Admin / Analyst | On demand |
| Sentiment-over-time chart | Tracks sentiment trends day by day | Tenant User / Admin / Analyst | On demand |
| Top Fans / Top Critics | Identifies authors driving positive/negative conversation | Tenant Analyst / Brand Manager | On demand |
| Positive / negative key-phrase clouds | Surfaces language and topics by sentiment | Tenant Analyst | On demand |
| Phrase-frequency-over-time chart | Shows how key-phrase volume changes over time | Tenant Analyst | On demand |
| Source breakdown by volume and sentiment | Compares real content connectors | Tenant User / Admin | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Client-side aggregation becomes slow for tenants with many posts | Medium | High | Document the accepted scale ceiling; move to server-side rollups only when real usage demonstrates the need | Menno |
| R-002 | Users expect a Location tab because the design reference shows one | Medium | Medium | Clearly omit the Location tab and document the missing real geo-data source (ADR-0054 Decision §4, Open Question 1) | Menno |
| R-003 | A future reader mistakenly uses `src/lib/mockData.ts` or `src/lib/types.ts` as live data | Low | Medium | Note dead code in BRD appendices and ADR-0054 Open Questions; schedule cleanup | Menno |
| R-004 | Stakeholders request the Intentions/Tags widgets before real fields exist | Low | Medium | Reference the BRD out-of-scope list and the missing `intention`/`tag` schema fields; do not build placeholders | Menno |
| R-005 | Per-widget export is requested before author-rights/consent governance is decided | Low | High | Defer per-widget export in v1; any future export must align with ADR-0039/Story 6.13 | Menno |
| R-006 | Prototype components with undefined `ad-*` CSS classes create implementation drift | Medium | Medium | Implement a real, non-trivial CSS block in `globals.css` as part of Story 8.1; do not reuse undefined classes | Menno / Implementer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `GET /v1/posts` cursor pagination (Story 6.11, ADR-0011) | Internal | Backend / Core | Already built and shipped |
| D-002 | `postDisplay.ts` `extractEnrichmentSummary()` and `extractAuthor()` | Internal | `social-listening-admin` | Already built and shipped |
| D-003 | `GlobalDateRangePicker.tsx` non-fabricated draft | Internal | `social-listening-admin` | Already drafted and reviewed |
| D-004 | `recharts` dependency in `social-listening-admin/package.json` | Internal | `social-listening-admin` | Already present |
| D-005 | Vanilla CSS design tokens in `globals.css` (frontend spec §3) | Internal | `social-listening-admin` | Already established; new `ad-*` block needed |
| D-006 | `docs/design/frontend-design-specification.md` §5/§9/§10/§11 updates | Internal | Product Owner | Follow-up once ADR-0054 is accepted (not in this BRD's scope) |
| D-007 | ADR-0008 narrow supersession documentation | Internal | ADR Owner | ADR-0008 receives a matching supersession note per governance convention |

---

## 14. Acceptance Criteria

- A Tenant User or Tenant-Admin can open `/tenant/analytics` and see a tabbed dashboard.
- The global date-range filter re-fetches `GET /v1/posts` and re-aggregates all active widgets.
- The Overview tab shows real total post count, sentiment split, and source breakdown.
- The Sentiment tab shows a real sentiment donut, day-bucketed sentiment-over-time chart, real Top Fans/Top Critics, and real positive/negative key-phrase clouds.
- The Conversations tab shows a real key-phrase word cloud and a real day-bucketed phrase-frequency-over-time chart.
- The Sources tab shows post volume and sentiment for only `gnews`, `newswire`, and `tenant-owned-feed`.
- No widget renders fabricated, sample, or hardcoded data; zero results display an empty state.
- No new `social-listening-core` endpoint, column, migration, or `TopicDailyCount` table is introduced.
- The Location tab, Intentions/Tags widgets, and per-widget export are not present in v1.
- The route, nav item, and tab state are consistent with the frontend design spec conventions.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialPostSummary` | The shape returned by `GET /v1/posts`; includes `id`, `createdAt`, `rawPayload`, `publishedAt`, and `enrichment`. |
| `enrichment` | JSONB data produced by the AI provider pipeline, including `sentiment`, `sentimentScores`, `entities`, and `keyPhrases`. |
| `providerId` | The connector that ingested the post. In this project the real values are `gnews`, `newswire`, and `tenant-owned-feed`. |
| `postGeoLocation` | A nullable column on `social_posts` that no connector currently populates and that is not included in `SocialPostSummary`. |
| Client-side aggregation | Computing widget values in the browser by paging through `GET /v1/posts` results rather than using a pre-computed server aggregation. |
| `TopicDailyCount` | A deferred server-side time-series aggregation table; not built in v1 per ADR-0008 and ADR-0054. |
| RLS | Row-Level Security in Postgres; ensures dashboard data is tenant-scoped. |
| `EmptyState` | The project's existing component for honest zero-data UI, from the frontend design spec §6.7. |

---

## 16. Appendices

### Reference documents

- [ADR-0054: Tenant-facing Analytics Dashboard — v1 scope, client-side data-source strategy, and a scoped, narrow supersession of ADR-0008's charting deferral](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md)
- [ADR-0008: Defer topic time-series and charting](../adr/0008-defer-topic-time-series-and-charting.md)
- [Feature Design 08: Dashboards and analytics](../product-research/feature-designs/08-dashboards-and-analytics.md)
- [Epic 8 user stories: Analytics Dashboard](../user-stories/epic-8-analytics-dashboard.md)
- `docs/design/frontend-design-specification.md` §10 and §11 (deferred analytics and Gemini Designs reference)
- `docs/design/frontend-design-future-devs.md` (brainstorm content only, not in scope)

### Note on deep-research brief

A matching `docs/product-research/reports/<feature>-deep-research.md` brief for the Dashboards and Analytics feature was not found in the repository at the time this BRD was drafted. The relevant competitive-research recommendations in the BRD are drawn from Feature Design 08's own "Research-based recommendations" section.

### Related clarifications and future ADRs

- [ADR-0055: Analytics language and location enrichment feasibility](../adr/0055-analytics-language-and-location-enrichment-feasibility.md) — confirms the Location tab remains non-buildable and identifies `GNewsArticle.source.country` as a declined substitute.
- [ADR-0056: AI-inferred origin location — Newswire dateline extraction](../adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md) — investigates a second potential location signal and recommends not building it yet.
- [ADR-0062: Analytics Dashboard — Overview Tab Enhancement](../adr/0062-analytics-dashboard-overview-tab-enhancement.md) — Proposed; if accepted, would partially supersede v1 scope with an "AI Spike Storyteller" and one new `POST /v1/posts/explain-spike` endpoint. Not part of this BRD's v1 scope.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
