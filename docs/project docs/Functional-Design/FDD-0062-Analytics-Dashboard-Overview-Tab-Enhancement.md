# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0062 Analytics Dashboard Overview Tab Enhancement — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0062-analytics-dashboard-overview-tab-enhancement.md, ../Business-Requirements/BRD-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0062-analytics-dashboard-overview-tab-enhancement.md and the business requirements in BRD-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md into functional design for **Analytics Dashboard Overview Tab Enhancement**.
The Tenant Analytics Dashboard's **Overview** tab currently presents only three high-level KPI cards plus a volume chart and a period-over-period comparison. While the other dashboard tabs (Sentiment, Conversations, Sources) already expose rich, interactive visualisations, the Overview tab is too sparse to serve as the at-a-glance command centre executives and brand-reputation managers need.

This initiative delivers a richer, multi-dimensional **Overview** tab: a three-column responsive grid of named widgets, a seven-dimension client-side filter model, active filter chips, shareable deep-link URLs, a client-side statistical volume forecast with crisis and sentiment indicators, and an AI-powered **Spike Storyteller** that explains volume anomalies in context. The work keeps the project's established discipline of real data only: every new widget is backed by data already available in `GET /v1/posts` and `SocialPostSummary[]`; widgets that require data not yet available (Location, Watchlist/Topic coverage) are explicitly deferred; and fabricated placeholders, simulation stubs, and the heavy D3 charting library are rejected.

The expected business value is a self-service, shareable executive view that lets tenants spot trends, compose multi-dimensional filters, and get AI-assisted explanations of spikes—without exporting data or switching between tabs.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- **Location Insights (SVG world map)** — no real geo data; `post_geo_location` is absent from `SocialPostSummary` per ADR-0054.
- **Watchlist/Topic filter (`selectedTopic`) and Watchlist Coverage widget** — requires ADR-0063 and Story 3.11 implementation; deliberately deferred to Story 8.9.
- **Region, Intention, and Tag filters** — no real backing fields in `PostEnrichmentSummary`.
- **AI-backed predictive forecast endpoint** (`POST /api/predictive-forecast`) — the statistical client-side fallback is the accepted v1 mechanism.
- **Simulation stubs**: machine translation, team assignment, response compose — they call non-existent services.
- **Unsplash author avatars** — deterministic initial-letter avatars are used instead.
- **D3 charting library** — Recharts and inline SVG are sufficient.
- **8-platform social-media roster** in Authors by Source — only the three real connectors (`gnews`, `newswire`, `tenant-owned-feed`) are shown.
- **Per-widget CSV/JSON export** — still undecided (ADR-0054 Open Question 3).

## 3. Context and Background
See ADR Context.
The Tenant Analytics Dashboard's **Overview** tab currently presents only three high-level KPI cards plus a volume chart and a period-over-period comparison. While the other dashboard tabs (Sentiment, Conversations, Sources) already expose rich, interactive visualisations, the Overview tab is too sparse to serve as the at-a-glance command centre executives and brand-reputation managers need.

This initiative delivers a richer, multi-dimensional **Overview** tab: a three-column responsive grid of named widgets, a seven-dimension client-side filter model, active filter chips, shareable deep-link URLs, a client-side statistical volume forecast with crisis and sentiment indicators, and an AI-powered **Spike Storyteller** that explains volume anomalies in context. The work keeps the project's established discipline of real data only: every new widget is backed by data already available in `GET /v1/posts` and `SocialPostSummary[]`; widgets that require data not yet available (Location, Watchlist/Topic coverage) are explicitly deferred; and fabricated placeholders, simulation stubs, and the heavy D3 charting library are rejected.

The expected business value is a self-service, shareable executive view that lets tenants spot trends, compose multi-dimensional filters, and get AI-assisted explanations of spikes—without exporting data or switching between tabs.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Transform the Overview tab into an at-a-glance command centre | Overview tab exposes 8 named widgets, 7 filter dimensions, and shareable filtered views |
| 2 | Enable multi-dimensional slice-and-dice analysis | Users can compose filters across source, author, keyword, language, sentiment, and date drill-down with immediate feedback |
| 3 | Provide honest, in-context volume forecasting | Statistical 7-day projection is visible and clearly labelled as a projection, not observed data |
| 4 | Reduce time to understand volume spikes | AI Spike Storyteller generates a narrative for a selected spike, surfaced within the same view |
| 5 | Support stakeholder collaboration | Deep-link share state copies a stable URL that hydrates the same filter configuration |
| 6 | Maintain the "no fabricated data" product discipline | All widgets use real fields from existing `GET /v1/posts`; excluded dimensions are explicit and documented |

---

**Positive consequences (from ADR):**
**Positive**

- The Overview tab becomes a genuine at-a-glance command centre with real multi-dimensional filtering, replacing the current three-card summary. Every widget slot is filled with either a real-data widget or an explicit, documented exclusion — no silent gaps.
- The AI Spike Storyteller adds genuinely new analytical value: a user who notices an unusual volume spike can get an AI-generated narrative in-context, reusing the existing Azure OpenAI infrastructure at no new provider-onboarding cost.
- The statistical forecast is available immediately and honestly labelled — a real user benefit with no server round-trip required.
- Deep-link share state allows capturing and sharing an exact filter configuration — a real collaboration feature at very low implementation cost.
- Treating watchlists/topics as a hard dependency explicitly mapped to ADR-0063 protects the architecture from half-baked stubs while recognising their vital product importance.
- The filter model covers all real, enrichment-backed dimensions (source, author, keyword, language, sentiment, date drill-down) — the full set the data actually supports today, with no fabricated or approximate dimension included.

**Negative**

- **One new `social-listening-core` endpoint** (`POST /v1/posts/explain-spike`) — a partial supersession of ADR-0054 Decision §3's intent. Story 8.8 inherits a real cross-repo implementation dependency.
- **Location Insights widget: still absent.** A visible gap in the left column; with Location absent, the left column has two widgets (Sentiment Gauge, Authors by Source) rather than three.
- **Watchlist features are blocked:** The overview page launches without topic segmentation or the Watchlist Coverage widget until ADR-0063 is written, approved, and implemented. The centre column has one fewer widget than the specification's layout assumes.
- **No simulation stubs** (translation, team assignment, response compose). The Posts Drawer is less demo-complete than the specification envisions — the correct trade-off for a real product, but a divergence from the spec.
- **Author avatars: initials only.** No photo-realistic thumbnails in the Top Authors Feed.
- **Three filter dimensions unbuilt** (`activeRegionFilter`, `activeIntentionFilter`, `activeTagFilter`). The `+Add filters` modal, if built, has limited non-redundant content until those fields gain real backing data.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Tenant-Admin | Primary daily user of the Analytics dashboard | High | Quickly understand brand health, slice data, and share views |
| Tenant-Business-Analyst | Uses dashboard for reporting and insight | High | Multi-dimensional filters and exportable underlying data |
| Tenant-Brand-Reputation-Manager | Monitors crisis signals | Medium | Crisis Alert Radar and sentiment trajectory at a glance |
| Platform-Admin | Oversees platform usage | Low | Usage and cost widgets without exposing tenant content |
| Menno | Sponsor, Product Owner, Technical Lead | High | Real data, no fabricated scope, and clean architecture |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 8.7 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want the Overview tab to show a rich, filterable view with a statistical volume forecast, active filter chips, and a sharea... | Overview tab renders in a 3-column responsive grid (`col-span-12` full-width fallback → `col-span-4`/`col-span-8` splits at the `lg:` breakpoint), with eight... |
| Story 8.8 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want to click into a volume spike on the timeline and get a short AI-generated narrative explaining what drove it, so that ... | **`social-listening-core` endpoint — `POST /v1/posts/explain-spike`** (ADR-0062 Decision §6), authorized with `requireTenantUser()` (not `requireTenantAdmin(... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- `GET /v1/posts` returns the `SocialPostSummary[]` shape with `enrichment.keyPhrases`, `enrichment.detectedLanguage`, `enrichment.sentiment`, `rawPayload.providerId`, and `publishedAt`.
- The existing `GlobalDateRangePicker` and paginated fetch loop from Stories 8.1–8.4 are reused.
- Azure OpenAI credentials are available for tenants that want the Spike Storyteller; unconfigured tenants see a graceful "not configured" message.
- Story 8.7 is implemented before Story 8.8.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Client-side aggregation shall remain performant for the existing `GET /v1/posts` result set size | Performance | Must | No p99 latency regression for the current tenant post volume; if >5,000 posts per view becomes common, ADR-0008 `TopicDailyCount` deferral is revisited |
| NFR-002 | The new `explain-spike` endpoint and proxy shall respect existing tenant-scoped authentication and RLS | Security | Must | `requireTenantUser()` authorises both `tenant_user` and `tenant_admin`; contract tests verify no cross-tenant leakage |
| NFR-003 | Charts and widgets shall be keyboard-focusable and use colour-blind-safe palettes | Accessibility | Should | Axe/linter passes; interactive elements have visible focus states and labels |
| NFR-004 | No D3 charting library shall be introduced; Recharts and inline SVG are the only charting mechanisms | Maintainability | Must | Dependency audit confirms `d3` is not added to `social-listening-admin` |
| NFR-005 | Forecast and AI output shall be honestly labelled as projections / AI-generated | Usability | Must | Tooltips and copy explicitly distinguish projected/AI-generated values from observed data |
| NFR-006 | The `explain-spike` endpoint shall not persist or cache spike narratives | Compliance | Must | Endpoint is stateless and produces no stored aggregation or PII retention beyond the existing `GET /v1/posts` contract |

---

## 11. Error Handling and Exceptions
**Positive**

- The Overview tab becomes a genuine at-a-glance command centre with real multi-dimensional filtering, replacing the current three-card summary. Every widget slot is filled with either a real-data widget or an explicit, documented exclusion — no silent gaps.
- The AI Spike Storyteller adds genuinely new analytical value: a user who notices an unusual volume spike can get an AI-generated narrative in-context, reusing the existing Azure OpenAI infrastructure at no new provider-onboarding cost.
- The statistical forecast is available immediately and honestly labelled — a real user benefit with no server round-trip required.
- Deep-link share state allows capturing and sharing an exact filter configuration — a real collaboration feature at very low implementation cost.
- Treating watchlists/topics as a hard dependency explicitly mapped to ADR-0063 protects the architecture from half-baked stubs while recognising their vital product importance.
- The filter model covers all real, enrichment-backed dimensions (source, author, keyword, language, sentiment, date drill-down) — the full set the data actually supports today, with no fabricated or approximate dimension included.

**Negative**

- **One new `social-listening-core` endpoint** (`POST /v1/posts/explain-spike`) — a partial supersession of ADR-0054 Decision §3's intent. Story 8.8 inherits a real cross-repo implementation dependency.
- **Location Insights widget: still absent.** A visible gap in the left column; with Location absent, the left column has two widgets (Sentiment Gauge, Authors by Source) rather than three.
- **Watchlist features are blocked:** The overview page launches without topic segmentation or the Watchlist Coverage widget until ADR-0063 is written, approved, and implemented. The centre column has one fewer widget than the specification's layout assumes.
- **No simulation stubs** (translation, team assignment, response compose). The Posts Drawer is less demo-complete than the specification envisions — the correct trade-off for a real product, but a divergence from the spec.
- **Author avatars: initials only.** No photo-realistic thumbnails in the Top Authors Feed.
- **Three filter dimensions unbuilt** (`activeRegionFilter`, `activeIntentionFilter`, `activeTagFilter`). The `+Add filters` modal, if built, has limited non-redundant content until those fields gain real backing data.

---

## 12. Assumptions and Dependencies
- `GET /v1/posts` returns the `SocialPostSummary[]` shape with `enrichment.keyPhrases`, `enrichment.detectedLanguage`, `enrichment.sentiment`, `rawPayload.providerId`, and `publishedAt`.
- The existing `GlobalDateRangePicker` and paginated fetch loop from Stories 8.1–8.4 are reused.
- Azure OpenAI credentials are available for tenants that want the Spike Storyteller; unconfigured tenants see a graceful "not configured" message.
- Story 8.7 is implemented before Story 8.8.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The single new `social-listening-core` endpoint (`POST /v1/posts/explain-spike`) adds cross-repo coordination | Medium | Medium | Build backend contract first, then frontend proxy; Story 8.8 is sequenced after Story 8.7 | Technical Lead |
| R-002 | Location Insights and Watchlist Coverage widgets are absent at launch, leaving visible layout gaps | Medium | Medium | Document as explicit, ADR-justified exclusions; layout left to Story 8.7 implementation judgment | Product Owner |
| R-003 | A tenant without Azure OpenAI credentials sees a degraded Spike Storyteller experience | High | Low | Render an honest "not configured" message; do not fabricate a narrative | Product Owner |
| R-004 | Region, Intention, and Tag filters are unavailable, limiting the `+Add filters` modal content | Medium | Low | Build only the adopted real dimensions; defer the modal's full value until data exists | Product Owner |
| R-005 | Crisis Alert Radar thresholds are implementation-time judgment, not contractual architecture | Medium | Low | Keep thresholds local to Story 8.7; revisit only if they become a product commitment | Technical Lead |
| R-006 | Client-side aggregation may become a bottleneck as post volume grows | Low | High | Monitor p99 latency; revisit materialised views or server-side rollups if >5,000 posts per view becomes common | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0062-analytics-dashboard-overview-tab-enhancement.md`
- BRD: `../Business-Requirements/BRD-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md``
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Feature design: `docs/product-research/feature-designs/ai-enhancements.md`
- Deep research: `docs/product-research/reports/08-dashboards-and-analytics-deep-research.md``
- User stories: see extracted stories above