# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0054 Tenant-facing Analytics Dashboard — Scope and Data-Source Strategy — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, ../Business-Requirements/BRD-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md and the business requirements in BRD-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md into functional design for **Tenant Facing Analytics Dashboard Scope And Data Source Strategy**.
**Problem being solved:** `social-listening-admin` currently ships no tenant-facing analytics or dashboard route. `docs/design/frontend-design-specification.md` §10 explicitly deferred "Rich Analytics & Charting Dashboards" to a future analytics/reporting subsystem (citing ADR-0008), leaving tenants to interpret listening value one post at a time through the post feed.

**Who is affected:** Tenant Users, Tenant-Admins, and Tenant-Business-Analysts need an at-a-glance view of listening volume, sentiment, key phrases, and source distribution. Platform administrators need confidence that the dashboard stays within the project's established security, data-integrity, and scope disciplines.

**Proposed solution at a glance:** A new `/tenant/analytics` route in `social-listening-admin` with a tabbed dashboard (Overview, Sentiment, Conversations, Sources), a global date-range filter, and client-side aggregation over the existing `GET /v1/posts` endpoint. Every widget uses real data already returned by the API — `enrichment.sentiment`, `enrichment.keyPhrases`, `rawPayload.providerId`, and `publishedAt` — with no fabricated or placeholder data and no new backend endpoint or aggregation table.

**Expected business value:** Dashboards make the value of ingestion immediately visible to non-analysts, improve tenant retention by reducing the need for manual data export, and establish a real, data-honest v1 baseline that can be extended only when future data sources justify additional widgets.

---

### 2.2 Scope
**In scope:**
- New `/tenant/analytics` route in `social-listening-admin`, role-gated to Tenant User and Tenant-Admin.
- A tab shell with four tabs: **Overview**, **Sentiment**, **Conversations**, and **Sources**.
- A global, real date-range filter (`GlobalDateRangePicker`) that filters the underlying `GET /v1/posts` query by `publishedAt` and re-aggregates all active widgets.
- **Overview tab:** total matched post count, compact sentiment split, and compact source breakdown (reusing the same client-side aggregates used by the other tabs).
- **Sentiment tab:** sentiment donut (positive/neutral/negative), sentiment-over-time chart bucketed by day, Top Fans/Top Critics by author and sentiment, and positive/negative key-phrase clouds.
- **Conversations tab:** key-phrase word cloud sized by real frequency and a phrase-frequency-over-time chart bucketed by day.
- **Sources tab:** post-volume and sentiment breakdown per real `providerId` (`gnews`, `newswire`, `tenant-owned-feed`).
- Client-side computation from `SocialPostSummary[]` returned by `GET /v1/posts`, plus `enrichment` and `rawPayload.providerId` fields.
- Vanilla CSS design tokens; `recharts` is the charting library.

**Out of scope:**
- **Location tab** — no real geo data is available via `GET /v1/posts` and no connector populates `postGeoLocation`.
- **Intentions and Tags widgets** — the real `PostEnrichmentSummary` schema has no such fields.
- **Per-widget CSV/JSON export** (`onExportWidgetData`) — author-rights and export governance remain unresolved for v1.
- AI storytelling ("Explain the Spike"), predictive forecasting/early-warning, D3 topic-cluster networks, real-time pulse-maps, 1-click PDF/slide export, and automated action workflows.
- Server-side aggregation endpoints or `TopicDailyCount`-style tables.
- Generic social-platform icons/labels (X/Twitter, LinkedIn, Facebook, etc.); only real project connectors are shown.
- Cleanup of `src/lib/mockData.ts` and `src/lib/types.ts` — noted as a separate follow-up.

## 3. Context and Background
See ADR Context.
**Problem being solved:** `social-listening-admin` currently ships no tenant-facing analytics or dashboard route. `docs/design/frontend-design-specification.md` §10 explicitly deferred "Rich Analytics & Charting Dashboards" to a future analytics/reporting subsystem (citing ADR-0008), leaving tenants to interpret listening value one post at a time through the post feed.

**Who is affected:** Tenant Users, Tenant-Admins, and Tenant-Business-Analysts need an at-a-glance view of listening volume, sentiment, key phrases, and source distribution. Platform administrators need confidence that the dashboard stays within the project's established security, data-integrity, and scope disciplines.

**Proposed solution at a glance:** A new `/tenant/analytics` route in `social-listening-admin` with a tabbed dashboard (Overview, Sentiment, Conversations, Sources), a global date-range filter, and client-side aggregation over the existing `GET /v1/posts` endpoint. Every widget uses real data already returned by the API — `enrichment.sentiment`, `enrichment.keyPhrases`, `rawPayload.providerId`, and `publishedAt` — with no fabricated or placeholder data and no new backend endpoint or aggregation table.

**Expected business value:** Dashboards make the value of ingestion immediately visible to non-analysts, improve tenant retention by reducing the need for manual data export, and establish a real, data-honest v1 baseline that can be extended only when future data sources justify additional widgets.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Give tenants self-service visibility into listening volume, sentiment, and source mix | Tenant can open `/tenant/analytics` and see accurate, real-data KPIs within a selected date range |
| 2 | Eliminate the deferred analytics gap without adding speculative backend aggregation | v1 ships using only `GET /v1/posts` client-side aggregation; no new `social-listening-core` endpoint or `TopicDailyCount` table |
| 3 | Protect data integrity by refusing to ship fabricated, sample, or silent-fallback data | No widget presents hardcoded values as if they were real; empty states are used when real data is absent |
| 4 | Provide a foundation for future dashboard depth | Tab shell, filter model, and aggregation patterns can be extended when real data and new ADRs justify it |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a real, previously-deferred gap at Menno's own direct request, using data this subsystem already captures — no new backend surface, no new stored aggregation, keeping ADR-0008's core cost-avoidance rationale (don't commit to an aggregation grain before a real consumer's requirements are known) fully intact.
- Replaces an already-started but broken/partially-fabricated prototype (non-existent `./types` import, undefined CSS classes, silent fake-data fallbacks, and two widgets — Intentions, Tags — with no real backing field at all) with an honestly-scoped v1 that has none of those defects.
- The three-connector "Sources" scope (`gnews`/`newswire`/`tenant-owned-feed`) matches this project's actual roster rather than inheriting the Google AI Studio reference's generic social-platform assumption, avoiding a dashboard that implies coverage this project doesn't have.
- `GlobalDateRangePicker.tsx` is confirmed reusable as-is — a real, complete component with no fabricated data, closing one of Story 8.1's pieces before it starts.

**Negative**
- **Client-side aggregation over paginated `GET /v1/posts` does not scale gracefully** — a tenant with a large post volume faces either many sequential page fetches to compute one accurate aggregate or an accepted approximation; this ADR does not resolve that ceiling, only names it (Decision §3, Open Questions).
- **The Location tab ships nothing in v1** — a real, visible gap against the Google AI Studio reference's own screen inventory, with no committed timeline to close it (Decision §4).
- **The Intentions/Tags widgets from the reference design are dropped entirely**, not adapted — a tenant familiar with the Microsoft Social Engagement-style reference mockup will not find an equivalent in this project's dashboard, because no underlying data supports one.
- **`src/lib/mockData.ts`/`types.ts` remain dead, already-committed, generically-themed code** this ADR does not clean up (Open Questions) — a real, if minor, standing confusion risk for a future reader who finds it and assumes it's live.
- **Per-widget CSV/JSON export (the prototype's `onExportWidgetData` affordance) is explicitly scoped out of v1** without this ADR deciding whether or how a future version should reconcile it with ADR-0039's already-governed tenant-level export mechanism — named, not resolved (Open Questions).

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary dashboard user and tenant configuration owner | High | Accurate, self-service view of content volume, sentiment, and sources |
| Tenant User | Reads dashboard for day-to-day brand monitoring | High | Easy-to-understand widgets, honest empty states, no misleading sample data |
| Tenant-Business-Analyst | Uses the dashboard for reporting and decision support | High | Filterable, exportable (future), real-data insights without manual roll-ups |
| Topic-Center-Analyst | Investigates trends and topics | Medium | Phrase and sentiment views that reflect actual monitored content |
| Platform-Admin | Operates platform-wide services | Medium | No cross-tenant data leakage; dashboard respects RLS and existing auth |
| Menno | Sponsor, Product Owner, and Technical Lead | High | Scope discipline, real data only, and minimal speculative backend work |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 6.18 | epic-6-tenant-admin-ui.md | As Tenant User or Tenant-Admin, I want the search box and Provider/Sentiment/Watchlist filters on `/tenant/posts` to search and filter across everything my t... | `page.tsx` fetches the tenant's full post set via a real, paginated loop (reusing `listPosts(cursor, limit)`'s already-extended `limit` param, the identical ... |
| Story 8.1 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want a new Analytics section with a date-range filter and an at-a-glance summary of post volume, sentiment, and source brea... | New route `/tenant/analytics` (Tenant User, Tenant-Admin — same role scope as `/tenant/posts`, Story 6.11), added to the left nav (`Analytics`, per `frontend... |
| Story 8.2 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want to see how sentiment breaks down and trends over the selected date range, and who's driving the most positive and nega... | Sentiment donut (positive/neutral/negative), computed from real `enrichment.sentiment` across the fetched, date-filtered post set for the current tenant — th... |
| Story 8.3 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want to see which phrases and topics are actually showing up most often in my monitored content, and how that's trending, s... | Key-phrase word cloud, sized by real frequency of `enrichment.keyPhrases` across the fetched, date-filtered post set — reusing and cleaning up the real deriv... |
| Story 8.4 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want the Overview tab to show a real volume trend and sentiment split at a glance, and to see whether either is up or down ... | A new pure function in `analyticsData.ts` (day-bucketed, reusing the exact `enumerateDays()` rule `computeSentimentHistory`/`computePhraseHistory` already es... |
| Story 8.6 | epic-8-analytics-dashboard.md | As Tenant User or Tenant-Admin, I want to see, at a glance, which of my connected sources is trending positive or negative and how each source's volume is mo... | `SentimentPost` (`analyticsData.ts`) gains a `providerId: string` field (`extractProviderBadge(post.rawPayload)`, already imported) — the one piece missing f... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPostSummary[]` | Paginated list of posts for the tenant and date range | `GET /v1/posts` (`social-listening-core`) | Backend / RLS | Tenant-confidential |
| `enrichment.sentiment` | Post-level positive/neutral/negative classification | `enrichment` JSONB on `social_posts` | AI enrichment pipeline | Tenant-confidential |
| `enrichment.keyPhrases` | Extracted key phrases from the post | `enrichment` JSONB on `social_posts` | AI enrichment pipeline | Tenant-confidential |
| `rawPayload.providerId` | Ingestion connector identifier (`gnews`, `newswire`, `tenant-owned-feed`) | `social_posts` raw payload | Connector layer | Low |
| `publishedAt` | Original publication timestamp | `social_posts` | Connector layer | Low |
| `author` (normalized) | Normalized author/publication name | `extractAuthor()` / `postDisplay.ts` | Backend | Tenant-confidential; attribution |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- `GET /v1/posts` and `enrichment` already return the fields needed for the in-scope widgets.
- `GlobalDateRangePicker.tsx` is non-fabricated and reusable as drafted.
- Recharts and vanilla CSS design tokens are already available in `social-listening-admin`.
- The tenant user has already authenticated and holds a role with access to `/tenant/analytics`.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard widgets must only display data the authenticated tenant is authorized to see | Security | Must | RLS-protected `GET /v1/posts` is the sole data source; no cross-tenant data is rendered |
| NFR-002 | Client-side aggregation must handle large post volumes within the accepted scale ceiling | Performance | Should | Fetch loop pages through `GET /v1/posts`; scale limitations are documented and not hidden |
| NFR-003 | Charts and interactive elements must be keyboard-focusable and use color-blind-friendly palettes | Accessibility | Should | Recharts/inline SVG widgets meet project a11y conventions; chart alt text is present |
| NFR-004 | Dashboard components must use the approved vanilla CSS design tokens | Maintainability | Must | No Tailwind utility classes from the reference design are ported as production code |
| NFR-005 | The dashboard must remain maintainable with no dead demo-data dependencies | Maintainability | Must | No import or dependency on `src/lib/mockData.ts` or `src/lib/types.ts` |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Closes a real, previously-deferred gap at Menno's own direct request, using data this subsystem already captures — no new backend surface, no new stored aggregation, keeping ADR-0008's core cost-avoidance rationale (don't commit to an aggregation grain before a real consumer's requirements are known) fully intact.
- Replaces an already-started but broken/partially-fabricated prototype (non-existent `./types` import, undefined CSS classes, silent fake-data fallbacks, and two widgets — Intentions, Tags — with no real backing field at all) with an honestly-scoped v1 that has none of those defects.
- The three-connector "Sources" scope (`gnews`/`newswire`/`tenant-owned-feed`) matches this project's actual roster rather than inheriting the Google AI Studio reference's generic social-platform assumption, avoiding a dashboard that implies coverage this project doesn't have.
- `GlobalDateRangePicker.tsx` is confirmed reusable as-is — a real, complete component with no fabricated data, closing one of Story 8.1's pieces before it starts.

**Negative**
- **Client-side aggregation over paginated `GET /v1/posts` does not scale gracefully** — a tenant with a large post volume faces either many sequential page fetches to compute one accurate aggregate or an accepted approximation; this ADR does not resolve that ceiling, only names it (Decision §3, Open Questions).
- **The Location tab ships nothing in v1** — a real, visible gap against the Google AI Studio reference's own screen inventory, with no committed timeline to close it (Decision §4).
- **The Intentions/Tags widgets from the reference design are dropped entirely**, not adapted — a tenant familiar with the Microsoft Social Engagement-style reference mockup will not find an equivalent in this project's dashboard, because no underlying data supports one.
- **`src/lib/mockData.ts`/`types.ts` remain dead, already-committed, generically-themed code** this ADR does not clean up (Open Questions) — a real, if minor, standing confusion risk for a future reader who finds it and assumes it's live.
- **Per-widget CSV/JSON export (the prototype's `onExportWidgetData` affordance) is explicitly scoped out of v1** without this ADR deciding whether or how a future version should reconcile it with ADR-0039's already-governed tenant-level export mechanism — named, not resolved (Open Questions).

---

## 12. Assumptions and Dependencies
- `GET /v1/posts` and `enrichment` already return the fields needed for the in-scope widgets.
- `GlobalDateRangePicker.tsx` is non-fabricated and reusable as drafted.
- Recharts and vanilla CSS design tokens are already available in `social-listening-admin`.
- The tenant user has already authenticated and holds a role with access to `/tenant/analytics`.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Client-side aggregation becomes slow for tenants with many posts | Medium | High | Document the accepted scale ceiling; move to server-side rollups only when real usage demonstrates the need | Menno |
| R-002 | Users expect a Location tab because the design reference shows one | Medium | Medium | Clearly omit the Location tab and document the missing real geo-data source (ADR-0054 Decision §4, Open Question 1) | Menno |
| R-003 | A future reader mistakenly uses `src/lib/mockData.ts` or `src/lib/types.ts` as live data | Low | Medium | Note dead code in BRD appendices and ADR-0054 Open Questions; schedule cleanup | Menno |
| R-004 | Stakeholders request the Intentions/Tags widgets before real fields exist | Low | Medium | Reference the BRD out-of-scope list and the missing `intention`/`tag` schema fields; do not build placeholders | Menno |
| R-005 | Per-widget export is requested before author-rights/consent governance is decided | Low | High | Defer per-widget export in v1; any future export must align with ADR-0039/Story 6.13 | Menno |
| R-006 | Prototype components with undefined `ad-*` CSS classes create implementation drift | Medium | Medium | Implement a real, non-trivial CSS block in `globals.css` as part of Story 8.1; do not reuse undefined classes | Menno / Implementer |

---

## 14. Appendix
- ADR: `../../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md`
- BRD: `../Business-Requirements/BRD-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above