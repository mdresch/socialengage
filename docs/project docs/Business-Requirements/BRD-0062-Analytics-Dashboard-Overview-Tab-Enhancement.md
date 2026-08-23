# Business Requirements Document — Analytics Dashboard Overview Tab Enhancement

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0062 — Analytics Dashboard Overview Tab Enhancement |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent (synthesised from ADR-0062, feature design, and user stories) |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial BRD drafted from ADR-0062, `feature-designs/08-dashboards-and-analytics.md`, and Epic 8 user stories |

---

## 2. Executive Summary

The Tenant Analytics Dashboard's **Overview** tab currently presents only three high-level KPI cards plus a volume chart and a period-over-period comparison. While the other dashboard tabs (Sentiment, Conversations, Sources) already expose rich, interactive visualisations, the Overview tab is too sparse to serve as the at-a-glance command centre executives and brand-reputation managers need.

This initiative delivers a richer, multi-dimensional **Overview** tab: a three-column responsive grid of named widgets, a seven-dimension client-side filter model, active filter chips, shareable deep-link URLs, a client-side statistical volume forecast with crisis and sentiment indicators, and an AI-powered **Spike Storyteller** that explains volume anomalies in context. The work keeps the project's established discipline of real data only: every new widget is backed by data already available in `GET /v1/posts` and `SocialPostSummary[]`; widgets that require data not yet available (Location, Watchlist/Topic coverage) are explicitly deferred; and fabricated placeholders, simulation stubs, and the heavy D3 charting library are rejected.

The expected business value is a self-service, shareable executive view that lets tenants spot trends, compose multi-dimensional filters, and get AI-assisted explanations of spikes—without exporting data or switching between tabs.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Transform the Overview tab into an at-a-glance command centre | Overview tab exposes 8 named widgets, 7 filter dimensions, and shareable filtered views |
| 2 | Enable multi-dimensional slice-and-dice analysis | Users can compose filters across source, author, keyword, language, sentiment, and date drill-down with immediate feedback |
| 3 | Provide honest, in-context volume forecasting | Statistical 7-day projection is visible and clearly labelled as a projection, not observed data |
| 4 | Reduce time to understand volume spikes | AI Spike Storyteller generates a narrative for a selected spike, surfaced within the same view |
| 5 | Support stakeholder collaboration | Deep-link share state copies a stable URL that hydrates the same filter configuration |
| 6 | Maintain the "no fabricated data" product discipline | All widgets use real fields from existing `GET /v1/posts`; excluded dimensions are explicit and documented |

---

## 4. Scope

### 4.1 In Scope

- Three-column responsive Overview tab grid (`grid-cols-1 lg:grid-cols-12`) with the following eight named widget slots and stable `id` attributes:
  - `widget-sentiment-gauge` (inline SVG tri-arc ring)
  - `widget-authors-by-source` (SVG donut + per-source row list)
  - `widget-timeline-volume` (Volume & Projections Timeline, including Crisis Alert Radar and Sentiment Trajectory)
  - `widget-wordcloud` (Key Phrases / Word Cloud)
  - `widget-languages` (Languages Distribution)
  - `widget-sources-volume` (Sources Volume Breakdown)
  - `widget-top-authors` (Top Authors Feed)
  - `widget-spike-storyteller` (AI Spike Storyteller, conditional on `activeDateFilter`)
- Seven client-side filter dimensions adopted from the specification:
  - `selectedDateRange` (existing `GlobalDateRangePicker`)
  - `activeDateFilter` (chart-bar drill-down)
  - `activeSourceFilter` (`rawPayload.providerId`)
  - `activeAuthorFilter` (`extractAuthor()`)
  - `activeKeywordFilter` (`enrichment.keyPhrases`)
  - `activeLanguageFilter` (`enrichment.detectedLanguage`)
  - `activeSentimentFilter` (`enrichment.sentiment`)
- Active filter chips bar with `×` dismiss and "Clear all" controls.
- Deep-link share state using URL query parameters (`tab`, `dateRange`, `source`, `author`, `keyword`, `language`, `sentiment`).
- Statistical volume forecast (`projectedVolume[n] = lastVolume × 0.85ⁿ + 850 × (1 − 0.85ⁿ)`) for up to 7 days, with clear labelling.
- Crisis Alert Radar and per-day Sentiment Trajectory inside the Volume widget.
- AI Spike Storyteller, powered by one new on-demand backend endpoint `POST /v1/posts/explain-spike` proxied through `POST /api/posts/explain-spike`.
- Filtered-post-count control in the Overview header that opens the existing Posts Slideout Drawer.
- Recharts and inline SVG as the only charting mechanisms; D3 is not added.
- Client-side aggregation from `GET /v1/posts` for all widgets except the Spike Storyteller.

### 4.2 Out of Scope

- **Location Insights (SVG world map)** — no real geo data; `post_geo_location` is absent from `SocialPostSummary` per ADR-0054.
- **Watchlist/Topic filter (`selectedTopic`) and Watchlist Coverage widget** — requires ADR-0063 and Story 3.11 implementation; deliberately deferred to Story 8.9.
- **Region, Intention, and Tag filters** — no real backing fields in `PostEnrichmentSummary`.
- **AI-backed predictive forecast endpoint** (`POST /api/predictive-forecast`) — the statistical client-side fallback is the accepted v1 mechanism.
- **Simulation stubs**: machine translation, team assignment, response compose — they call non-existent services.
- **Unsplash author avatars** — deterministic initial-letter avatars are used instead.
- **D3 charting library** — Recharts and inline SVG are sufficient.
- **8-platform social-media roster** in Authors by Source — only the three real connectors (`gnews`, `newswire`, `tenant-owned-feed`) are shown.
- **Per-widget CSV/JSON export** — still undecided (ADR-0054 Open Question 3).

### 4.3 Assumptions

- `GET /v1/posts` returns the `SocialPostSummary[]` shape with `enrichment.keyPhrases`, `enrichment.detectedLanguage`, `enrichment.sentiment`, `rawPayload.providerId`, and `publishedAt`.
- The existing `GlobalDateRangePicker` and paginated fetch loop from Stories 8.1–8.4 are reused.
- Azure OpenAI credentials are available for tenants that want the Spike Storyteller; unconfigured tenants see a graceful "not configured" message.
- Story 8.7 is implemented before Story 8.8.

### 4.4 Constraints

- Client-side aggregation only, except for the single on-demand `explain-spike` endpoint.
- No fabricated or placeholder data may be presented as real.
- All authenticated core API calls must route through the same-origin Next.js API proxy (ADR-0036).
- Widget `id` attributes must match the ADR-specified names verbatim for E2E and analytics instrumentation.
- Only the three real connectors are represented in source/author widgets.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Tenant-Admin | Primary daily user of the Analytics dashboard | High | Quickly understand brand health, slice data, and share views |
| Tenant-Business-Analyst | Uses dashboard for reporting and insight | High | Multi-dimensional filters and exportable underlying data |
| Tenant-Brand-Reputation-Manager | Monitors crisis signals | Medium | Crisis Alert Radar and sentiment trajectory at a glance |
| Platform-Admin | Oversees platform usage | Low | Usage and cost widgets without exposing tenant content |
| Menno | Sponsor, Product Owner, Technical Lead | High | Real data, no fabricated scope, and clean architecture |

---

## 6. Current State (As-Is)

**Current process:**

1. A tenant user navigates to `/tenant/analytics`.
2. The user selects a date range using `GlobalDateRangePicker`.
3. The Overview tab renders three KPI cards (total posts, sentiment split, source breakdown) and a real volume-over-time chart.
4. If "Compare to previous period" is enabled, a second `computeAnalyticsSummary()` fetch is performed.
5. Other tabs (Sentiment, Conversations, Sources) provide richer, focused analysis.

**Pain points:**

- The Overview tab is visually and functionally sparse compared to the other tabs.
- Users cannot filter by source, author, keyword, language, or sentiment directly from the Overview tab.
- There is no way to share a specific filtered view with a colleague.
- Volume spikes require the user to switch to the post feed and manually investigate.
- The tab does not expose a forward-looking projection or crisis indicator.

---

## 7. Future State (To-Be)

**New or improved process:**

1. The tenant user lands on `/tenant/analytics?tab=overview`.
2. The Overview tab renders a responsive three-column grid of eight named widgets.
3. The user applies one or more filters (source, author, keyword, language, sentiment, or a date drill-down) by clicking widgets or using existing controls.
4. Active filters appear as colour-coded chips; the user can remove filters individually or clear all.
5. The URL is updated in-place; the user can click "Share" to copy a deep-link to the current filter state.
6. The Volume & Projections Timeline shows historical volume plus a statistical 7-day forecast, a Crisis Alert Radar, and a per-day Sentiment Trajectory.
7. Clicking a spike on the Volume chart sets `activeDateFilter` and reveals the AI Spike Storyteller, which explains the spike using up to 50 posts from a ±1 day window.
8. A filtered-post-count control in the header opens the Posts Slideout Drawer, listing every matching post.

**Expected capabilities:**

- Multi-dimensional filtering with immediate client-side composition.
- Shareable, URL-driven filter state.
- Forward-looking (but honestly labelled) volume projection.
- In-context AI explanation of volume spikes.
- Consistent empty states and no fabricated data.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The Overview tab shall render a three-column responsive grid with the eight named widget slots defined in ADR-0062 | Must | All widget `id` attributes match verbatim; layout is responsive and renders without horizontal overflow on desktop | Product Owner |
| BR-002 | The system shall support seven client-side filter dimensions: source, author, keyword, language, sentiment, date drill-down, and selected date range | Must | Each dimension composes with AND semantics and can be cleared independently | Product Owner |
| BR-003 | The system shall display an active filter chips bar when any filter is active | Must | Chips are colour-coded, dismissible, and include a "Clear all" control | Product Owner |
| BR-004 | The system shall support deep-link share state for the seven adopted filter dimensions | Must | URL parameters hydrate on mount and `Share` copies a stable URL to the clipboard with a confirmation | Product Owner |
| BR-005 | The Volume & Projections Timeline shall display a 7-day client-side statistical forecast series | Must | Forecast formula is `v(n) = lastVolume × 0.85ⁿ + 850 × (1 − 0.85ⁿ)` and is visually labelled as a projection | Product Owner |
| BR-006 | The Volume & Projections Timeline shall display a Crisis Alert Radar and a per-day Sentiment Trajectory | Must | Crisis level is derived from 48-hour negative-sentiment momentum; trajectory is a −10 to +10 per-day series with no fabricated confidence intervals | Product Owner |
| BR-007 | The Sentiment Gauge shall render as an inline SVG tri-arc ring | Must | Gauge is driven by `summary.sentimentSplit` percentages; zero data renders a neutral placeholder | Product Owner |
| BR-008 | Authors by Source shall show unique-author counts for the three real connectors | Must | Clicking a source row sets `activeSourceFilter`; only `gnews`, `newswire`, and `tenant-owned-feed` are represented | Product Owner |
| BR-009 | The Word Cloud / Key Phrases widget shall derive phrases from real `enrichment.keyPhrases` | Must | Clicking a phrase sets `activeKeywordFilter`; no static fallback arrays | Product Owner |
| BR-010 | The Languages Distribution widget shall derive values from real `enrichment.detectedLanguage` | Must | Clicking a language sets `activeLanguageFilter`; no fabricated breakdowns | Product Owner |
| BR-011 | The Sources Volume Breakdown widget shall show real `providerId` volume | Must | Clicking a source segment sets `activeSourceFilter` | Product Owner |
| BR-012 | The Top Authors Feed shall show real authors ranked by post count with initials avatars | Must | Clicking an author sets `activeAuthorFilter`; no external CDN images | Product Owner |
| BR-013 | The AI Spike Storyteller shall be available when a user clicks a volume-spike date | Must | Widget calls `POST /api/posts/explain-spike` and renders `narrative`, `postsAnalysed`, and `generatedAt`; unconfigured AI renders an honest message; custom prompt supports re-fire | Product Owner |
| BR-014 | The Overview header shall show a filtered-post-count control that opens the Posts Slideout Drawer | Must | Count recomputes on every filter change; zero count still opens the drawer to an empty state | Product Owner |
| BR-015 | All widgets shall render real data or an empty state, never fabricated sample data | Must | Contract tests and visual inspection confirm no hardcoded fallbacks | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Client-side aggregation shall remain performant for the existing `GET /v1/posts` result set size | Performance | Must | No p99 latency regression for the current tenant post volume; if >5,000 posts per view becomes common, ADR-0008 `TopicDailyCount` deferral is revisited |
| NFR-002 | The new `explain-spike` endpoint and proxy shall respect existing tenant-scoped authentication and RLS | Security | Must | `requireTenantUser()` authorises both `tenant_user` and `tenant_admin`; contract tests verify no cross-tenant leakage |
| NFR-003 | Charts and widgets shall be keyboard-focusable and use colour-blind-safe palettes | Accessibility | Should | Axe/linter passes; interactive elements have visible focus states and labels |
| NFR-004 | No D3 charting library shall be introduced; Recharts and inline SVG are the only charting mechanisms | Maintainability | Must | Dependency audit confirms `d3` is not added to `social-listening-admin` |
| NFR-005 | Forecast and AI output shall be honestly labelled as projections / AI-generated | Usability | Must | Tooltips and copy explicitly distinguish projected/AI-generated values from observed data |
| NFR-006 | The `explain-spike` endpoint shall not persist or cache spike narratives | Compliance | Must | Endpoint is stateless and produces no stored aggregation or PII retention beyond the existing `GET /v1/posts` contract |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | All active filter dimensions compose with **AND** semantics; adding a filter narrows the post set, never replaces another active dimension. |
| BRU-002 | Clicking an already-active filter segment/row toggles that one dimension off, equivalent to clicking the chip's `×`. |
| BRU-003 | Only the three real connectors (`gnews`, `newswire`, `tenant-owned-feed`) are represented in source and author widgets; no placeholder platforms. |
| BRU-004 | The AI Spike Storyteller is visible only when `activeDateFilter` is non-null; clearing the date drill-down un-renders the widget. |
| BRU-005 | `POST /v1/posts/explain-spike` is available to both `tenant_user` and `tenant_admin`; it is a read-and-explain operation, not a write. |
| BRU-006 | The `customPrompt` field refines the composed analysis question but does not replace the server-derived ±1 day context posts. |
| BRU-007 | The server pages `GET /v1/posts` for a ±1 day window around the spike date, newest-first, capped at 50 posts. |
| BRU-008 | Widget `id` attributes (`widget-sentiment-gauge`, `widget-authors-by-source`, `widget-timeline-volume`, `widget-wordcloud`, `widget-languages`, `widget-sources-volume`, `widget-top-authors`, `widget-spike-storyteller`) must be preserved verbatim. |
| BRU-009 | A day with zero enriched posts in the Sentiment Trajectory is excluded (a gap), not rendered as a fabricated `0`. |
| BRU-010 | No confidence interval is rendered for the statistical forecast or Sentiment Trajectory. |
| BRU-011 | The `?watchlist` URL parameter is reserved and not read or written until Story 8.9. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `publishedAt` | Post publication timestamp for volume/forecast bucketing | `GET /v1/posts` `SocialPostSummary` | Backend / Data | Business content |
| `rawPayload.providerId` | Connector identifier (`gnews`, `newswire`, `tenant-owned-feed`) | `GET /v1/posts` `SocialPostSummary` | Backend / Data | Business content |
| `extractAuthor()` output | Author name derived from post payload | `GET /v1/posts` `SocialPostSummary` + `postDisplay.ts` | Frontend | Business content |
| `enrichment.sentiment` | Positive / neutral / negative sentiment label | `GET /v1/posts` `PostEnrichmentSummary` | Backend / AI | Business content |
| `enrichment.keyPhrases` | Array of extracted key phrases | `GET /v1/posts` `PostEnrichmentSummary` | Backend / AI | Business content |
| `enrichment.detectedLanguage` | ISO 639-1 language code | `GET /v1/posts` `PostEnrichmentSummary` | Backend / AI | Business content |
| `spikeDate` | ISO-8601 date selected on the volume chart | User input → `POST /v1/posts/explain-spike` | Frontend | Business content |
| `customPrompt` | Optional user-provided refinement to the spike explanation | User input → `POST /v1/posts/explain-spike` | Frontend | Business content |
| `narrative` | AI-generated prose explanation of a volume spike | Azure OpenAI via `POST /v1/posts/explain-spike` | Backend / AI | Business content (tenant-scoped) |
| `postsAnalysed` | Count of posts fed into the spike explanation | `POST /v1/posts/explain-spike` response | Backend | Business content |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Total matched posts | Shows volume in the selected filter window | Tenant users | Real-time (client-side) |
| Sentiment split (%) | At-a-glance brand-health composition | Tenant users / Brand-reputation managers | Real-time |
| Source / author / keyword / language breakdowns | Drives multi-dimensional filtering decisions | Tenant analysts | Real-time |
| Volume & Projections Timeline | Historical volume plus short-term projection | Tenant users / Executives | Real-time |
| Crisis Alert Radar status (`stable` / `elevated` / `crisis`) | Flags negative-sentiment momentum | Brand-reputation managers | Real-time |
| Sentiment Trajectory (−10 to +10 per day) | Tracks day-over-day sentiment direction | Tenant users / Analysts | Real-time |
| Spike Storyteller `postsAnalysed` | Indicates how many posts informed an AI explanation | Tenant users | On demand |
| Shared view deep-link usage | Tracks collaboration / adoption | Product team | Event-driven (clipboard action) |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The single new `social-listening-core` endpoint (`POST /v1/posts/explain-spike`) adds cross-repo coordination | Medium | Medium | Build backend contract first, then frontend proxy; Story 8.8 is sequenced after Story 8.7 | Technical Lead |
| R-002 | Location Insights and Watchlist Coverage widgets are absent at launch, leaving visible layout gaps | Medium | Medium | Document as explicit, ADR-justified exclusions; layout left to Story 8.7 implementation judgment | Product Owner |
| R-003 | A tenant without Azure OpenAI credentials sees a degraded Spike Storyteller experience | High | Low | Render an honest "not configured" message; do not fabricate a narrative | Product Owner |
| R-004 | Region, Intention, and Tag filters are unavailable, limiting the `+Add filters` modal content | Medium | Low | Build only the adopted real dimensions; defer the modal's full value until data exists | Product Owner |
| R-005 | Crisis Alert Radar thresholds are implementation-time judgment, not contractual architecture | Medium | Low | Keep thresholds local to Story 8.7; revisit only if they become a product commitment | Technical Lead |
| R-006 | Client-side aggregation may become a bottleneck as post volume grows | Low | High | Monitor p99 latency; revisit materialised views or server-side rollups if >5,000 posts per view becomes common | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `GET /v1/posts` endpoint and `SocialPostSummary[]` shape | Internal / Existing | Backend team | Available |
| D-002 | Recharts charting library | Internal / Existing | Frontend team | Available |
| D-003 | Azure OpenAI credentials for `explain-spike` | External / Tenant-owned | Tenant admin | Runtime-configurable |
| D-004 | ADR-0063 / Story 3.11 for `selectedTopic` and Watchlist Coverage widget | Internal / Deferred | Backend + Frontend team | Story 8.9 |
| D-005 | Story 8.7 (Overview grid, filter chips, deep-link, forecast) | Internal / Pre-requisite | Frontend team | Built 2026-08-19 |
| D-006 | Story 8.8 (AI Spike Storyteller endpoint + widget) | Internal / Pre-requisite | Backend + Frontend team | Ready |
| D-007 | ADR-0054 (client-side aggregation strategy) and ADR-0055 (language field) | Internal / Existing | Architecture | Accepted |

---

## 14. Acceptance Criteria

- The Overview tab renders the 3-column grid with the eight verbatim `widget-*` `id` attributes.
- All seven adopted filter dimensions are wired into the shared `useMemo` pipeline and compose with AND semantics.
- Active filter chips render correctly, can be dismissed individually, and "Clear all" resets the filter state.
- Deep-link URL parameters (`dateRange`, `source`, `author`, `keyword`, `language`, `sentiment`) hydrate the filter state on mount.
- The Volume & Projections Timeline displays actual volume and a dashed forecast series with an honest projection label.
- The Crisis Alert Radar and Sentiment Trajectory render inside `widget-timeline-volume` without separate top-level `id`s.
- The AI Spike Storyteller calls `POST /api/posts/explain-spike` and renders the returned `narrative`, `postsAnalysed`, and `generatedAt`.
- The `explain-spike` contract test verifies prompt composition with and without `customPrompt`, and the `AI_UNAVAILABLE` branch when no credential is found.
- No fabricated sample data, static fallback arrays, or simulation stubs are present in the shipped Overview tab.
- All widgets use the existing `EmptyState` component when the filtered post set is empty.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Active filter** | A non-default value of a filter dimension that narrows the displayed post set. |
| **AI Spike Storyteller** | An on-demand AI-generated narrative that explains why post volume spiked on a selected date. |
| **Client-side aggregation** | Computing widget values in the browser from the fetched `SocialPostSummary[]` rather than pre-computing them on the server. |
| **Crisis Alert Radar** | A banner inside the Volume widget that signals negative-sentiment momentum as `stable`, `elevated`, or `crisis`. |
| **Deep-link share state** | URL query parameters that encode the current Overview tab filter selection so the view can be copied and shared. |
| **Sentiment Trajectory** | A per-day sentiment score on a −10 to +10 scale, computed from `computeSentimentHistory()`. |
| **SocialPostSummary** | The tenant-scoped post shape returned by `GET /v1/posts`, including `rawPayload`, `publishedAt`, and `enrichment`. |
| **Statistical volume forecast** | A client-side exponential mean-reversion projection of future post volume, clearly labelled as not real data. |
| **Watchlist** | A saved Boolean/keyword/hashtag query used to segment posts; its Overview integration is deferred to Story 8.9. |
| **Widget slot** | A stable `id`-named container in the Overview grid used for E2E selection and analytics instrumentation. |

---

## 16. Appendices

### Reference documents

- **ADR-0062** — `docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md` (source of record for decisions, scope, and consequences).
- **Feature design** — `docs/product-research/feature-designs/08-dashboards-and-analytics.md` (high-level product context, persona acceptance, open questions, and research recommendations).
- **Deep-research brief** — *No `docs/product-research/reports/08-dashboards-and-analytics-deep-research.md` file was found; this source was explicitly missing and is noted here per the BRD Writer Agent instructions.*
- **User stories** — `docs/user-stories/epic-8-analytics-dashboard.md`:
  - **Story 8.7** — Overview Tab Enhancement (grid, filter model, forecast, chips, deep-link).
  - **Story 8.8** — AI Spike Storyteller (`POST /v1/posts/explain-spike` + frontend widget).
  - **Story 8.9** — `selectedTopic` watchlist filter and Watchlist Coverage widget (dependent on ADR-0063 / Story 3.11).
  - **Story 8.10** — Location & Geospatial Insights (dependent on ADR-0064 / Story 2.18).

### Supporting notes

- The deep-research brief for this feature could not be located. Where research recommendations were needed, the BRD relied on the feature design's "Research-based recommendations" table and the ADR's own verification notes.
- All widget and filter decisions trace to ADR-0062; this BRD does not authorise any implementation beyond the accepted scope.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
