# Business Requirements Document (BRD) — Location and Geospatial Insights from Posts and Authors

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Location and Geospatial Insights from Posts and Authors |
| Version | 1.0 |
| Date | 2026-08-20 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-20 | BRD Writer Agent | Initial draft from ADR-0064, Story 2.20, Story 8.10, and Feature Design 08 |

---

## 2. Executive Summary

The Analytics Dashboard currently has a visible gap: location-based insights were deliberately deferred because precise per-post geolocation (`post_geo_location`) is not populated by any real connector, and storing or displaying sparse point coordinates would risk privacy compliance and mislead users with fabricated maps. This initiative solves that gap by adopting a realistic, privacy-first v1 approach: normalising and surfacing country-level geospatial insights from the post data that already exists.

The proposed solution persists ISO 3166-1 alpha-2 country codes and related provenance metadata inside `social_posts.enrichment` (JSONB), requiring no database migration. It then renders a "Top Countries & Regional Distribution" widget on the Analytics Overview tab, including a ranked Top Countries list and an inline SVG world choropleth map. All data is real connector data; an explicit "Unknown / Unmapped" bucket ensures the product is honest about coverage gaps.

This unlocks crisis and incident awareness, regional reputation tracking, source coverage analysis, and operational prioritisation for regional teams — without storing sensitive precise coordinates, without paid geocoding services, and without placeholder or sample data.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable country-level spatial analytics in the tenant-facing Analytics Dashboard | Overview tab renders Top Countries list and country choropleth map using real data |
| 2 | Deliver insights from data that actually exists today | GNews, Newswire, and tenant-owned-feed country signals are extracted and normalised without fabrication |
| 3 | Maintain a privacy-first, low-risk design | No precise coordinates or individual location traces are stored; country-level aggregation only |
| 4 | Keep implementation and deployment lightweight | Zero schema migrations; all new fields live inside existing `enrichment` JSONB |
| 5 | Provide a foundation for future geospatial expansion | Enrichment schema supports region, source, and confidence fields for later enrichment |

---

## 4. Scope

### 4.1 In Scope

- Extracting and normalising country-level geospatial metadata from real connectors:
  - GNews (`GNewsArticle.source.country`)
  - Newswire (`sourceCountry`, `country`, or unambiguous source domain)
  - Tenant-owned feeds (`country`, `countryCode`, `geo.country`, `sourceCountry`)
  - Facebook explicitly left null in v1
- Persisting normalised geo fields in `social_posts.enrichment` (JSONB):
  - `geoCountry` (ISO 3166-1 alpha-2, uppercase)
  - `geoCountryName`
  - `geoRegion`
  - `geoSource` (`post`, `source`, `inferred`, `unknown`)
  - `geoConfidence` (`high`, `medium`, `low`, `null`)
- Surfacing the fields through the existing `GET /v1/posts` contract
- Rendering the "Location & Geospatial Insights" widget on the Analytics Overview tab:
  - Top Countries ranked list (volume, share, explicit "Unknown" row)
  - Country choropleth map (SVG, colour by post count, hover tooltip, no D3/Mapbox)
  - Click-to-filter interaction (sets `activeCountryFilter`, composes with other filters)
- Suppressing sentiment scores for countries with fewer than three posts
- Always showing the "Unknown / Unmapped" bucket separately from the map

### 4.2 Out of Scope

- Precise latitude/longitude extraction or storage
- Storing point geometry in `post_geo_location`
- Sub-national (city/region/state) mapping in v1
- Geocoding unstructured author profile location free-text
- Paid external geocoding services in v1
- A standalone Location tab (replaced by the Overview widget per ADR-0064)
- Placeholder, fabricated, or hardcoded sample map data

### 4.3 Assumptions

- GNews continues to expose `source.country` in search responses.
- Newswire and tenant-owned feeds will only carry explicit, unambiguous country signals in v1.
- Client-side aggregation from `GET /v1/posts` remains viable for the expected data volume.
- Users understand that v1 insights are country-level only and that not every post is mappable.

### 4.4 Constraints

- Must not require a database schema migration or new `social-listening-core` endpoints.
- Must not store precise coordinates or increase privacy/compliance surface area.
- Must use only the project’s real connectors (`gnews`, `newswire`, `tenant-owned-feed`, `facebook`).
- Must render honest empty states and explicit "Unknown" buckets — no fabricated data.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User | Views the Analytics Overview tab | High | At-a-glance geographic distribution without technical complexity |
| Tenant-Business-Analyst | Analyses market coverage and regional trends | High | Filterable, real country breakdowns that can be compared to watchlists |
| Tenant-Brand-Reputation-Manager | Monitors regional reputation and crises | High | Country-level sentiment and regional volume spikes |
| Topic-Center-Analyst | Investigates topic traction by geography | Medium | Region-level conversation volume and source coverage |
| Platform-Admin | Operates the platform and reviews usage | Low | No new infrastructure or PII exposure |
| Menno | Product Owner / Technical Lead / Sponsor | High | Pragmatic, zero-migration, privacy-first delivery |

---

## 6. Current State (As-Is)

The platform ingests posts from four real connectors and enriches them into `social_posts.enrichment` (JSONB). Previous architecture decisions excluded location insights because `post_geo_location` was not populated and point-level geolocation was unavailable or restricted across real social APIs.

**Pain points:**
- The Analytics Dashboard Overview tab has a visible gap where the "Location Insights" widget was originally specified but not built.
- Users cannot see which countries are driving conversation volume.
- Regional sentiment, crisis awareness, and coverage distribution are unavailable without manually reading posts.
- Source-derived location data exists for some connectors (e.g., GNews `source.country`) but is not normalised or surfaced.

---

## 7. Future State (To-Be)

After ingestion, each post’s `enrichment` will optionally include a normalised country code, display name, region, provenance, and confidence. The Analytics Overview tab will include a "Location & Geospatial Insights" widget that:

1. Ranks countries by post volume in the current filtered range.
2. Renders an inline SVG choropleth world map coloured by post count per country.
3. Always shows an "Unknown / Unmapped" bucket alongside the map.
4. Lets users click a country or map polygon to filter the entire dashboard by that country.
5. Suppresses sentiment scores for countries with fewer than three posts to avoid misleading small-sample interpretations.

This provides a realistic, honest, privacy-safe spatial dimension to the dashboard using only existing API data and no schema migration.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The enrichment pipeline shall extract and normalise country-level ISO 3166-1 alpha-2 codes from GNews, Newswire, and tenant-owned feeds where an unambiguous signal exists. | Must | GNews `source.country` → `geoCountry` uppercase; Newswire explicit/source-derived values mapped; tenant feed explicit fields normalised; Facebook left `null`. | Product Owner |
| BR-002 | The system shall persist `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, and `geoConfidence` inside `social_posts.enrichment` (JSONB). | Must | All five fields round-trip through `insertSocialPost()`; no new columns or migrations. | Technical Lead |
| BR-003 | `GET /v1/posts` and `PostEnrichmentSummary` shall surface the new geo fields without changing the endpoint contract. | Must | `SocialPostSummary.enrichment` returns the geo fields; `social-listening-admin` `postDisplay.ts` returns them in `PostEnrichmentSummary`. | Technical Lead |
| BR-004 | The Analytics Overview tab shall render a ranked "Top Countries" list with volume, share, and an explicit "Unknown" row. | Must | Top N countries by volume, percentage share, and an `UNKNOWN` bucket never omitted. | Product Owner |
| BR-005 | The Overview tab shall render an inline SVG country choropleth map coloured by post count. | Must | Countries with 0 posts use a neutral tone; hover tooltip shows name, count, and sentiment; no D3/Mapbox. | Product Owner |
| BR-006 | Country-level sentiment shall be suppressed for fewer than three posts in the filtered range. | Must | Countries with `count < 3` return `sentiment: null`; all others show real split. | Product Owner |
| BR-007 | The "Unknown / Unmapped" volume shall always be visible, but never drawn on the map itself. | Must | Unknown bucket shown in the Top Countries list and/or a legend badge; not assigned to arbitrary coordinates. | Product Owner |
| BR-008 | Clicking a country row or map polygon shall set and clear an `activeCountryFilter` with the same AND-composition semantics as other dashboard filters. | Should | Filter chip appears, `?country=` query param updates, second click clears. | Product Owner |
| BR-009 | All Location & Geospatial widgets shall respect the active global date, source, author, keyword, language, and sentiment filters. | Must | Widgets recompute from the same filtered `SocialPostSummary[]` used by other Overview widgets. | Technical Lead |
| BR-010 | Zero matched posts in the selected range shall render the standard `EmptyState` component. | Must | No fabricated fallback map or list. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Country-level aggregation only; no precise coordinates stored or displayed. | Privacy / Compliance | Must | No `post_geo_location` writes; no lat/lon in `enrichment`; architecture review confirms country-only surface. |
| NFR-002 | Insights computed client-side from existing `GET /v1/posts`; no new backend aggregation endpoints for v1. | Performance / Maintainability | Must | `social-listening-core` adds no new analytics endpoints; aggregation is pure frontend transforms. |
| NFR-003 | Zero database schema migrations. | Maintainability | Must | Geo fields live inside `enrichment` JSONB; no new tables, columns, or migrations. |
| NFR-004 | All rendered data is real; no placeholder, sample, or hardcoded fallback values. | Usability / Trust | Must | Contract and manual tests confirm fabricated defaults removed. |
| NFR-005 | Use lightweight SVG / Recharts; avoid heavy mapping libraries. | Maintainability | Should | Bundle does not add D3 or Mapbox; map rendered via SVG/TopoJSON/GeoJSON. |
| NFR-006 | All data access respects tenant RLS and existing permissions. | Security | Must | Dashboard widgets show only the current tenant’s posts; no cross-tenant leakage. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `geoCountry` is stored as an uppercase ISO 3166-1 alpha-2 code (e.g., `US`, `GB`, `NL`) when present; otherwise `null`. |
| BRU-002 | `geoSource` is set to `post` for explicit feed-level country, `source` for publisher/source-derived country, `inferred` for AI/dateline-derived country (future), and `unknown` when no mapping is possible. |
| BRU-003 | `geoConfidence` is `high` for explicit connector country fields, `medium` for unambiguous source-derived mapping, `low` for inferred text, and `null` when unknown. |
| BRU-004 | Free-text location fields and author profile locations are not geocoded in v1. |
| BRU-005 | Facebook Page posts in the standard feed do not populate `geoCountry` in v1. |
| BRU-006 | The "Unknown / Unmapped" bucket is always rendered; it is never hidden or merged into another country. |
| BRU-007 | Country sentiment scores are not shown for fewer than three posts. |
| BRU-008 | No fabricated or sample data is presented as real; empty states are used when no data exists. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `geoCountry` | ISO 3166-1 alpha-2 uppercase country code | Connector payloads and source domain mapping | Tenant Data / System | Non-PII when country-level only |
| `geoCountryName` | Human-readable country display name | Derived from `geoCountry` | System | Non-PII |
| `geoRegion` | Optional sub-region or super-region code | Derived from `geoCountry` | System | Non-PII |
| `geoSource` | Provenance of the country assignment | Connector payload metadata | System | Non-PII |
| `geoConfidence` | Confidence level for the country assignment | System-assigned based on extraction rule | System | Non-PII |

All fields are persisted inside the existing `social_posts.enrichment` JSONB column. No new tables, columns, or PII categories are introduced.

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Top Countries by volume | Identify the largest geographic markets driving conversation | Tenant User / Analyst | Real-time (client-side) on filter change |
| Country distribution share | Understand coverage split across markets | Tenant Business Analyst | Real-time (client-side) on filter change |
| Regional volume over time | Spot regional spikes and trends | Tenant Brand Reputation Manager | Real-time (client-side) on filter change |
| Country × sentiment table | Compare regional sentiment | Tenant Business Analyst | Real-time (client-side) on filter change |
| World choropleth map | Visual, at-a-glance geographic heatmap | Tenant User / Executive | Real-time (client-side) on filter change |
| "Unknown / Unmapped" count | Honest disclosure of data coverage gap | All users | Real-time (client-side) on filter change |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Sparse coverage for Newswire, Facebook, and tenant-owned feeds leaves many posts as "Unknown" | Medium | Medium | Render explicit Unknown bucket and avoid hiding gaps; set expectations that v1 is country-level only. | Product Owner |
| R-002 | Users expect city/pin-level heatmaps that v1 cannot deliver | Medium | Medium | Scope is clearly communicated as country-level; honest choropleth with no point overlay. | Product Owner |
| R-003 | Source domain mapping may introduce ambiguous or incorrect country assignments | Low | Medium | Only map when unambiguous; use high/medium confidence distinction; consider curated domain allowlist later. | Technical Lead |
| R-004 | Widget diverges from the original ADR-0062 SVG world map specification | Low | Low | Documented and accepted in ADR-0064; country choropleth with Unknown bucket is the realistic replacement. | Product Owner |
| R-005 | Client-side aggregation may become slow if post volumes grow | Low | Medium | Stay client-side for v1; pre-aggregated server endpoints can be added later when p99 latency or volume thresholds are crossed. | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0054 (Analytics Dashboard scope and data-source strategy) | Decision / Source | Menno | Accepted 2026-08-17 |
| D-002 | ADR-0055 (Language and location enrichment feasibility) | Decision / Source | Menno | Accepted 2026-08-17 |
| D-003 | ADR-0056 (AI-inferred origin location from Newswire dateline text) | Decision / Source | Menno | Accepted 2026-08-17; optional future enrichment |
| D-004 | ADR-0062 (Analytics Dashboard Overview enhancements) | Decision / Source | Menno | Accepted 2026-08-19 |
| D-005 | Story 2.20 — Country-level geospatial extraction in `social-listening-core` | Story / Deliverable | Development team | Built 2026-08-20 |
| D-006 | Story 8.7 — Overview 3-column grid and filter model | Story / Deliverable | Development team | Built 2026-08-19 |
| D-007 | `docs/product-research/feature-designs/08-dashboards-and-analytics.md` | Reference | Product | Available |

No `docs/product-research/reports/<feature>-deep-research.md` file exists for this feature; the BRD draws on the ADR and the user stories instead.

---

## 14. Acceptance Criteria

1. GNews `source.country` is normalised to uppercase ISO 3166-1 alpha-2 and stored in `enrichment.geoCountry` with `geoSource: 'source'`, `geoConfidence: 'high'`.
2. Newswire and tenant-owned feeds populate `geoCountry` only when an explicit or unambiguous source country signal exists; otherwise all geo fields remain `null`.
3. Facebook posts leave `geoCountry` and related fields `null` in v1.
4. `GET /v1/posts` returns the new geo fields inside `enrichment` with zero changes to the endpoint contract.
5. `PostEnrichmentSummary` in `social-listening-admin` reads and returns the five geo fields.
6. The Analytics Overview renders a ranked "Top Countries" list including an explicit "Unknown / Unmapped" row.
7. The Overview renders an inline SVG world choropleth map coloured by post count, with a hover tooltip showing country name, post count, and sentiment breakdown.
8. Clicking a country list row or map polygon sets `activeCountryFilter`, updates the URL `?country=`, and composes with other active filters; a second click clears it.
9. Sentiment breakdown per country is suppressed when the filtered post count for that country is fewer than three.
10. The "Unknown" bucket is always visible and never rendered on the map as a polygon.
11. Zero matched posts render the existing `EmptyState` component; no fabricated or placeholder data is shown.
12. No database schema migrations, new `social-listening-core` analytics endpoints, or heavy mapping libraries are introduced.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **ISO 3166-1 alpha-2** | Two-letter country code standard (e.g., `US`, `GB`, `NL`) used as the canonical v1 country identifier. |
| **Geo field** | The set of `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, and `geoConfidence` persisted in `enrichment`. |
| **Geo source** | Provenance tracker indicating whether the country came from the post, the publisher source, was inferred, or is unknown. |
| **Geo confidence** | Indicator of reliability for the country assignment (`high`, `medium`, `low`, `null`). |
| **Unknown / Unmapped bucket** | A dedicated aggregate row for posts whose `geoCountry` is `null`; always shown, never hidden. |
| **Choropleth map** | A thematic map where country polygons are coloured by a statistical value (post count in this case). |
| **Top Countries** | A ranked list widget showing the countries with the most posts in the current filtered range. |
| **Source-derived mapping** | Mapping a country from publisher or source metadata rather than from a per-post explicit geo field. |

---

## 16. Appendices

### Reference documents

- `docs/adr/0064-location-and-geospatial-insights-from-posts-and-authors.md` — source ADR (Accepted 2026-08-20).
- `docs/product-research/feature-designs/08-dashboards-and-analytics.md` — high-level dashboard and analytics feature design.
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.20 (country-level geospatial extraction and normalisation).
- `docs/user-stories/epic-8-analytics-dashboard.md` — Story 8.10 (Location & Geospatial Insights widget with choropleth map).

### Related ADRs

- ADR-0054 — Analytics dashboard scope and data-source strategy
- ADR-0055 — Language and location enrichment feasibility
- ADR-0056 — AI-inferred origin location from Newswire dateline text
- ADR-0062 — Analytics Dashboard Overview enhancements

### Missing source

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the Location and Geospatial Insights feature. The business requirements above were synthesised from the accepted ADR, the user stories, and the dashboards feature design.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-20 |
| Product Owner | Menno | | 2026-08-20 |
| Technical Lead | Menno | | 2026-08-20 |
| Other Stakeholder | | | |
