# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0064 Location and Geospatial Insights from Posts and Authors — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Architecture Documentation, translated from ADR-0064 / BRD-0064 |
| Reviewer(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0064; BRD-0064; ADR-0054 (Analytics scope/data-source strategy); ADR-0055 (Language/location feasibility); ADR-0056 (dateline extraction); ADR-0062 (Overview tab enhancements); Story 2.20; Story 8.10; `docs/product-research/feature-designs/08-dashboards-and-analytics.md` |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0064 and BRD-0064 into a functional design for country-level geospatial insights derived from real connector data — replacing the previously deferred "Location Insights" gap (ADR-0054 Decision §4, ADR-0062 Decision §8) with a privacy-first, zero-migration, country-level design.

ADR-0064's Status is **Accepted** (2026-08-20), and BRD-0064 is **Approved**; this FDD reflects an already-approved and already-built design (Story 2.20, Story 8.10), not a draft for review.

### 2.2 Scope

- **In scope:**
  - Country-level extraction and normalization logic for GNews, Newswire, and tenant-owned-feed connectors.
  - The `geoCountry`/`geoCountryName`/`geoRegion`/`geoSource`/`geoConfidence` fields stored inside `social_posts.enrichment` (JSONB).
  - `PostEnrichmentSummary` surfacing of the new fields in `social-listening-admin`.
  - Client-side aggregation (`computeCountryBreakdown()`) and the "Location & Geospatial Insights" Overview widget: Top Countries list + SVG country choropleth.
  - Click-to-filter (`activeCountryFilter`) integration with the shared Overview filter model.
  - Sentiment suppression threshold for low-sample countries.
- **Out of scope:**
  - Precise latitude/longitude extraction, storage, or the legacy `post_geo_location` table.
  - Sub-national (city/region/state) mapping.
  - Geocoding unstructured author profile location free-text.
  - Paid external geocoding services.
  - Any new `social-listening-core` analytics/aggregation endpoint (all aggregation is client-side per ADR-0054 Decision §3).
  - Facebook country extraction (explicitly left `null` in v1).

### 2.3 Target Audience

Backend engineers (`social-listening-core` enrichment/connectors), frontend engineers (`social-listening-admin` Analytics Dashboard), QA, and the product owner reviewing traceability from BRD-0064 through implementation.

---

## 3. Context and Background

- **Problem:** ADR-0054 Decision §4 explicitly excluded Location Insights because no connector populated `post_geo_location` and `SocialPostSummary` excluded it. ADR-0055 confirmed precise post-level geolocation is extremely sparse across real and hypothetical connectors, author profile location is unstructured/unreliable free text, no uniform schema exists across platforms, and storing precise coordinates raises privacy/compliance risk. As a result, the ADR-0062-specified Location Insights SVG world map was never built, leaving a visible gap in the Overview tab.
- **Business/user value:** Country-level insight still unlocks crisis/incident awareness, regional sentiment and reputation tracking, source coverage analysis, watchlist-to-geography correlation (once ADR-0063 lands), and operational prioritization for regional teams — without requiring precise point-level data.
- **Source requirements:** ADR-0064 (Accepted 2026-08-20); BRD-0064 (Approved 2026-08-20); follow-up to ADR-0054, ADR-0055, ADR-0056, ADR-0062.
- **Constraints:**
  - Must not require a database schema migration or a new `social-listening-core` endpoint — new fields live entirely inside the existing `social_posts.enrichment` JSONB column, already passed through `SocialPostSummary` unfiltered.
  - Must not store precise coordinates or increase privacy/compliance surface area.
  - Must use only the project's real connectors (`gnews`, `newswire`, `tenant-owned-feed`, `facebook`).
  - Must render honest empty/"Unknown" states — never fabricated or placeholder map data.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable country-level spatial analytics in the Analytics Dashboard | Overview tab renders a Top Countries list and country choropleth map using real data |
| G2 | Deliver insights only from data that actually exists | GNews, Newswire, and tenant-owned-feed country signals are extracted and normalized without fabrication; Facebook stays `null` |
| G3 | Maintain a privacy-first, low-risk design | No precise coordinates or individual location traces stored; country-level aggregation only |
| G4 | Keep implementation and deployment lightweight | Zero schema migrations; all new fields live inside existing `enrichment` JSONB |
| G5 | Provide a foundation for future geospatial expansion | Schema supports `geoRegion`, `geoSource`, `geoConfidence` for later enrichment without rework |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Country Extraction — GNews Connector

- **Description:** Extracts a high-confidence, source-derived country code from GNews search results.
- **Triggers:** Every GNews article ingested by `pollGNewsSearch.ts`.
- **Inputs:** `GNewsArticle.source.country` from the GNews API response.
- **Processing:** Read the lowercase country code; normalize to uppercase ISO 3166-1 alpha-2 (e.g. `'us'` → `'US'`); derive `geoCountryName` (e.g. `'United States'`); set `geoSource = 'source'`; set `geoConfidence = 'high'`.
- **Outputs:** `geoCountry`, `geoCountryName`, `geoSource`, `geoConfidence` populated on the article's enrichment payload.
- **Error handling:** If `source.country` is absent or unmappable, all geo fields remain `null` — no error is raised, no guess is made.
- **Edge cases:** GNews does not expose precise coordinates or per-post author profile objects; no attempt is made to derive them.

### 5.2 Feature / Capability: Country Extraction — Newswire Connector

- **Description:** Extracts country from explicit feed fields when present, falling back to unambiguous source-domain mapping, otherwise leaving the post unmapped.
- **Triggers:** Every Newswire item ingested by `pollNewswireFeeds.ts`.
- **Inputs:** Feed item's `sourceCountry`/`country` field (if present); source publication domain.
- **Processing:**
  1. If an explicit `sourceCountry`/`country` value exists in the feed item, use it directly: `geoSource = 'post'`, `geoConfidence = 'high'`.
  2. Otherwise, attempt to map the source publication domain only where the mapping is unambiguous: `geoSource = 'source'`, `geoConfidence = 'medium'`.
  3. If neither yields an unambiguous result, leave `geoCountry`, `geoCountryName`, `geoSource`, and `geoConfidence` all `null`.
  4. AI-based dateline extraction (ADR-0056's `inferOriginLocation`) is named as a future, optional enhancement path (`geoSource = 'inferred'`) but not activated by this design.
- **Outputs:** Geo fields populated only when confidence is defensible; otherwise explicitly `null`.
- **Error handling:** Ambiguous or multinational-publisher domains are deliberately not mapped, to avoid false country assignment.
- **Edge cases:** A wire item from a multinational outlet with no explicit country field stays `null` rather than guessed — coverage is intentionally reduced to avoid incorrect mapping.

### 5.3 Feature / Capability: Country Extraction — Tenant-Owned-Feed Connector

- **Description:** Extracts country only from explicit, structured fields already present in a tenant's arbitrary RSS/JSON feed; never geocodes free text.
- **Triggers:** Every item ingested by `pollTenantOwnedFeed.ts`.
- **Inputs:** Feed item fields: `country`, `countryCode`, `geo.country`, `sourceCountry` (whichever is present).
- **Processing:** Inspect the known field names in order of specificity; normalize any found value to uppercase ISO 3166-1 alpha-2; set provenance/confidence according to which field matched. Free-text `location` fields are never parsed or geocoded in v1.
- **Outputs:** Geo fields populated when an explicit structured field exists; otherwise `null`.
- **Error handling:** No mapping attempted for unstructured or ambiguous values — cannot assume uniformity across arbitrary tenant feeds.
- **Edge cases:** A tenant feed with no geo-related fields at all yields fully `null` geo fields for every item — expected and honest, not an error.

### 5.4 Feature / Capability: Country Field Non-Population — Facebook Connector

- **Description:** Explicitly leaves all geo fields `null` for Facebook Page posts in v1.
- **Triggers:** Every Facebook post ingested.
- **Inputs:** N/A — no geo-relevant field exists in the standard Graph API feed payload.
- **Processing:** No extraction attempted; fields left `null` by design, not by omission/bug.
- **Outputs:** `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, `geoConfidence` all `null`.
- **Error handling:** N/A.
- **Edge cases:** Page-level location, if ever exposed, is unstructured and out of scope; not parsed.

### 5.5 Feature / Capability: Enrichment Schema Storage (Zero-Migration)

- **Description:** Persists the five normalized geo fields inside the existing `social_posts.enrichment` JSONB column, avoiding any database migration or new endpoint.
- **Triggers:** Every post insert/enrichment step across all four connectors.
- **Inputs:** The extracted geo values from 5.1–5.4 (or nulls).
- **Processing:** Widen the `AnalyzeResult`/enrichment contract with optional, nullable `camelCase` fields: `geoCountry: string | null`, `geoCountryName: string | null`, `geoRegion: string | null`, `geoSource: 'post' | 'source' | 'inferred' | 'unknown' | null`, `geoConfidence: 'high' | 'medium' | 'low' | null`. These fields round-trip through the existing `enrichment` persistence path with no new columns or migrations. The legacy `post_geo_location` table remains unused.
- **Outputs:** `social_posts.enrichment` rows carrying the new fields for every post, past behavior otherwise unchanged.
- **Error handling:** Missing/absent fields default to `null`, never a fabricated placeholder value.
- **Edge cases:** `geoRegion` is schema-supported but not populated by any v1 extraction rule — reserved for future use.

### 5.6 Feature / Capability: `PostEnrichmentSummary` Surfacing (Admin UI)

- **Description:** Widens the admin UI's own enrichment summary type/extractor so the new geo fields reach the Analytics Dashboard without any change to the `GET /v1/posts` contract.
- **Triggers:** Every `SocialPostSummary` processed by `extractEnrichmentSummary()` in `social-listening-admin/src/app/tenant/posts/postDisplay.ts`.
- **Inputs:** The raw `enrichment` object already present on each fetched post.
- **Processing:** Read and pass through `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, `geoConfidence` into the returned `PostEnrichmentSummary`.
- **Outputs:** A typed, UI-consumable `PostEnrichmentSummary` including the geo fields.
- **Error handling:** Missing fields default to `null`, matching the persistence layer.
- **Edge cases:** No behavior change for posts predating this feature — their `enrichment` simply lacks the new keys and they surface as `null`.

### 5.7 Feature / Capability: Client-Side Country Aggregation (`computeCountryBreakdown`)

- **Description:** A pure client-side aggregation function that groups the currently filtered post set by country for the Top Countries list and choropleth map.
- **Triggers:** Every render/recompute of the Overview tab's filtered post set (any filter change).
- **Inputs:** `SocialPostSummary[]` (already filtered by the shared `useMemo` pipeline).
- **Processing:**
  - Groups posts by `enrichment.geoCountry`.
  - Counts total posts, computes percentage volume share, and computes sentiment breakdown (`positive`/`neutral`/`negative`) per country.
  - Returns a ranked array of countries by volume descending.
  - Posts where `geoCountry === null` are placed into a dedicated `{ countryCode: 'UNKNOWN', name: 'Unknown / Unmapped', count, share }` bucket — never hidden, omitted, or averaged away.
  - **Suppression rule:** for any country (including named ones) with fewer than 3 posts in the current filter window, `sentiment` is returned as `null` rather than a real split, to avoid misleading small-sample bias.
- **Outputs:** A ranked country breakdown array consumed by both the Top Countries list and the choropleth map.
- **Error handling:** N/A — pure function over already-validated input; no I/O.
- **Edge cases:** Zero filtered posts yields an empty breakdown, rendered via the standard `EmptyState` component, never a fabricated fallback.

### 5.8 Feature / Capability: Location & Geospatial Insights Widget

- **Description:** The Overview tab widget (`id="widget-location-insights"`) presenting the Top Countries ranked list and an inline SVG country choropleth map.
- **Triggers:** Rendered whenever the Overview tab is displayed with a non-empty filtered post set.
- **Inputs:** The output of `computeCountryBreakdown()`.
- **Processing:**
  - **Top Countries list:** ranks countries by volume, showing country flag/code, name, post count, and percentage share, plus the explicit "Unknown" row.
  - **Choropleth map:** an inline SVG world map with country polygons colored by post-count density on a graduated palette; countries with 0 posts render in a neutral tone; hovering shows a tooltip with country name, post count, and sentiment breakdown; the "Unknown" bucket is shown as a status legend badge beside the map, never assigned arbitrary map coordinates.
  - No D3, Mapbox, or other heavy mapping library is used (ADR-0062 Decision §9 / ADR-0064 Decision §4).
- **Outputs:** Rendered widget reflecting the currently active filters.
- **Error handling:** Zero matched posts renders the standard `EmptyState` component, not a broken layout or fabricated map fill.
- **Edge cases:** A tenant whose connectors yield no mappable country data at all shows a 100% "Unknown" breakdown honestly, rather than a misleading full or empty map.

### 5.9 Feature / Capability: Click-to-Filter (`activeCountryFilter`)

- **Description:** Lets a user click a country row or map polygon to filter the entire Overview dashboard by that country, composing with all other active filters.
- **Triggers:** User click on a Top Countries row or a choropleth map polygon.
- **Inputs:** The clicked country's ISO 3166-1 alpha-2 code.
- **Processing:** Sets `activeCountryFilter` to the clicked code; this composes with all other active filters using **AND** semantics in the shared `useMemo` filtering pipeline (ADR-0062 Decision §3). Renders a dismissible chip in the filter chips bar and updates the URL query parameter `?country=` via `window.history.replaceState`. Clicking an already-active country a second time clears the filter (toggle-off), matching the `×` chip behavior.
- **Outputs:** A narrowed filtered post set reflected across every widget on the tab.
- **Error handling:** N/A — client-side state transition only.
- **Edge cases:** Clicking the "Unknown" row/badge, if interactive, filters to posts with `geoCountry === null` using the same mechanism (implementation detail owned by Story 8.10).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant User | Views country-level volume, sentiment, and the choropleth map on the Overview tab |
| Tenant Business Analyst | Analyzes market coverage and regional trends, compares to watchlists |
| Tenant Brand Reputation Manager | Monitors regional reputation and crisis-driven spikes |
| Topic-Center Analyst | Investigates topic traction by geography |
| Platform Administrator | Confirms no new infrastructure or PII exposure introduced |
| Backend Engineer | Owns connector-level extraction and enrichment schema (Story 2.20) |
| Frontend Engineer | Owns aggregation, widget rendering, and filter integration (Story 8.10) |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 2.20 | Core backend engineer | Extract, normalize, and store country-level geospatial metadata from `gnews`, `newswire`, and `tenant-owned-feed` payloads into `social_posts.enrichment` | Downstream consumers can query/aggregate by country without storing sensitive coordinates or geocoding | Widens the enrichment contract with `geoCountry`/`geoCountryName`/`geoRegion`/`geoSource`/`geoConfidence`; per-connector extraction rules for GNews (source-derived, high confidence), Newswire (explicit-then-domain-fallback), tenant-owned-feed (explicit structured fields only). **Built 2026-08-20.** |
| Story 8.10 | Tenant User / Tenant-Admin | See country-level conversation volume, regional sentiment distribution, and an interactive choropleth map on the Overview tab | Identify which geographic markets are driving conversation and spot regional sentiment variation | `PostEnrichmentSummary` widened; `computeCountryBreakdown()` groups/ranks/suppresses low-sample sentiment; Location & Geospatial Insights widget (Top Countries + choropleth) built with no heavy mapping library; click-to-filter `activeCountryFilter` with AND-composition and URL sync; `EmptyState` on zero matches. **Built 2026-08-20.** |

### 6.3 Workflow Diagrams / Steps

**Ingestion-time extraction flow:**
1. A connector (GNews, Newswire, tenant-owned-feed, or Facebook) fetches a post/article during its normal ingestion pass.
2. The connector's per-platform extraction rule (5.1–5.4) inspects the payload for a country signal.
3. If found unambiguously, the country is normalized to uppercase ISO 3166-1 alpha-2 and the four related fields (`geoCountryName`, `geoSource`, `geoConfidence`, plus reserved `geoRegion`) are set accordingly.
4. If no unambiguous signal exists, all geo fields are left `null`.
5. The post (with its enrichment payload, geo fields included) is persisted normally via the existing `social_posts.enrichment` write path — no schema change, no new endpoint.

**Dashboard rendering / filter flow:**
1. The Analytics Overview tab fetches `SocialPostSummary[]` via the existing `GET /v1/posts` contract (unchanged).
2. `extractEnrichmentSummary()` surfaces the geo fields into `PostEnrichmentSummary` for each post.
3. The shared `useMemo` filter pipeline applies all currently active filters (date, source, sentiment, keyword, language, author, and any `activeCountryFilter`).
4. `computeCountryBreakdown()` runs over the filtered set, producing a ranked country list with an explicit Unknown bucket and per-country sentiment (suppressed under the 3-post threshold).
5. The widget renders the Top Countries list and choropleth map from that breakdown.
6. A click on a country row/polygon sets `activeCountryFilter`, narrowing the filtered set and re-triggering steps 3–5 across every widget on the tab; a second click on the same country clears it.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Connector payloads: `GNewsArticle.source.country` (GNews); `sourceCountry`/`country`/source domain (Newswire); `country`/`countryCode`/`geo.country`/`sourceCountry` (tenant-owned-feed); none (Facebook).
- The already-fetched `SocialPostSummary[]` (via `GET /v1/posts`, unchanged contract) consumed client-side by the Analytics Dashboard.

### 7.2 Data Outputs

- Five new fields inside `social_posts.enrichment` (JSONB) per post: `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, `geoConfidence`.
- `PostEnrichmentSummary` objects widened with the same five fields for UI consumption.
- Client-side derived country breakdown (`computeCountryBreakdown()` output): ranked country list with counts, shares, and (possibly suppressed) sentiment.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `social_posts.enrichment` (existing JSONB column, widened) | `geoCountry: string \| null` (ISO 3166-1 alpha-2, uppercase); `geoCountryName: string \| null`; `geoRegion: string \| null` (reserved, unpopulated in v1); `geoSource: 'post' \| 'source' \| 'inferred' \| 'unknown' \| null`; `geoConfidence: 'high' \| 'medium' \| 'low' \| null` | Embedded within each `social_posts` row; no new table, no foreign key |
| `PostEnrichmentSummary` (admin UI type, widened) | Same five geo fields, mirrored from `enrichment` | Derived 1:1 from a fetched `SocialPostSummary`'s `enrichment` |
| Country breakdown entry (client-side, transient) | `countryCode` (ISO alpha-2 or `'UNKNOWN'`), `name`, `count`, `share`, `sentiment: { positive, neutral, negative } \| null` | Aggregated from `PostEnrichmentSummary[]`; not persisted anywhere |

### 7.4 Validation Rules

- `geoCountry`, when present, must be a two-letter uppercase ISO 3166-1 alpha-2 code; lowercase source values are normalized on ingestion.
- `geoSource` is restricted to `'post' | 'source' | 'inferred' | 'unknown' | null`.
- `geoConfidence` is restricted to `'high' | 'medium' | 'low' | null`.
- A country entry's `sentiment` must be `null` (not a fabricated split) whenever its filtered post count is below 3.
- The "Unknown / Unmapped" bucket must always be present in the breakdown output, even when its count is 0, and must never be assigned map coordinates.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BRU-001 | `geoCountry` is stored as an uppercase ISO 3166-1 alpha-2 code when present; otherwise `null`. | Enrichment schema |
| BRU-002 | `geoSource` is `'post'` for explicit feed-level country, `'source'` for publisher/source-derived country, `'inferred'` for AI/dateline-derived country (future), `'unknown'` when no mapping is possible. | Enrichment schema |
| BRU-003 | `geoConfidence` is `'high'` for explicit connector country fields, `'medium'` for unambiguous source-derived mapping, `'low'` for inferred text, `null` when unknown. | Enrichment schema |
| BRU-004 | Free-text location fields and author profile locations are not geocoded in v1. | All connectors |
| BRU-005 | Facebook Page posts in the standard feed do not populate `geoCountry` in v1. | Facebook connector |
| BRU-006 | The "Unknown / Unmapped" bucket is always rendered; it is never hidden or merged into another country. | Dashboard widget |
| BRU-007 | Country sentiment scores are not shown for fewer than three posts in the filtered range. | Dashboard aggregation |
| BRU-008 | No fabricated or sample data is presented as real; empty states are used when no data exists. | Dashboard widget |
| BRU-009 | Country mapping is only performed when the source signal is unambiguous; aggressive or heuristic guessing is not applied. | Newswire/tenant-owned-feed extraction |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `pollGNewsSearch.ts` | Internal, write | Extracts source-derived country from `GNewsArticle.source.country` | In-process function call |
| `pollNewswireFeeds.ts` | Internal, write | Extracts explicit or unambiguous source-derived country | In-process function call |
| `pollTenantOwnedFeed.ts` | Internal, write | Extracts explicit structured country fields from arbitrary tenant feeds | In-process function call |
| `social_posts.enrichment` (JSONB column) | Internal, storage | Persists the five geo fields with no schema migration | JSONB |
| `GET /v1/posts` (`social-listening-core`) | Outbound, unchanged | Continues returning `enrichment` in full, now including the geo fields | REST / JSON over HTTPS |
| `postDisplay.ts` / `extractEnrichmentSummary()` (`social-listening-admin`) | Internal, read | Surfaces geo fields into `PostEnrichmentSummary` | In-process function call |
| Overview tab shared `useMemo` filter pipeline (Story 8.7) | Internal, read/write | Supplies the filtered post set to `computeCountryBreakdown()`; receives `activeCountryFilter` updates | In-process function call / React state |
| Browser URL (`?country=`) | Outbound, state sync | Reflects the active country filter for shareable/bookmarkable state | `window.history.replaceState` |

---

## 10. Non-Functional Considerations

- **Performance:** All aggregation is client-side over the already-fetched `SocialPostSummary[]`; no new backend aggregation endpoint is introduced for v1 (NFR-002). Should remain performant at current tenant/post-volume scale; pre-aggregated server endpoints are named as a future option if volume growth demands it (R-005).
- **Security / access control:** All widget data flows through the existing tenant-RLS-scoped `GET /v1/posts` call; no cross-tenant leakage risk is introduced (NFR-006).
- **Privacy / compliance:** Country-level aggregation only — no precise coordinates or individual location traces are stored or displayed (NFR-001), directly addressing the compliance risk that caused ADR-0054/ADR-0055 to defer location insights originally.
- **Scalability:** Zero schema migrations; new fields live entirely inside the existing `enrichment` JSONB, so no capacity planning is required beyond what already exists for post storage (NFR-003).
- **Maintainability:** Rendered via lightweight SVG/Recharts/TopoJSON-style paths; no D3 or Mapbox dependency is added to the bundle (NFR-005).
- **Trust/usability:** All rendered data is real; fabricated, sample, or hardcoded fallback values are explicitly disallowed (NFR-004) — the "Unknown" bucket exists specifically to keep coverage gaps honest rather than hidden.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A connector payload has no usable country signal | N/A (silent) | All five geo fields left `null`; post ingests normally |
| Newswire/tenant-feed source is ambiguous (e.g. multinational publisher) | N/A (silent) | No country is guessed; fields remain `null` rather than risk an incorrect mapping |
| A country in the current filter window has fewer than 3 posts | Sentiment simply not shown for that country (no error message) | `sentiment: null` returned instead of a real split, to prevent misleading small-sample bias |
| Zero matched posts in the selected filter range | Standard `EmptyState` component | No fabricated fallback map or list is rendered |
| A post predates this feature's deployment (no geo fields in its `enrichment`) | Counted under "Unknown / Unmapped" | Treated identically to any other unmapped post — no special-cased error |

---

## 12. Assumptions and Dependencies

- GNews continues to expose `source.country` in search responses at the observed reliability.
- Newswire and tenant-owned feeds will only carry explicit, unambiguous country signals in v1; broader coverage via curated domain mapping or AI dateline extraction (ADR-0056) is a future, not current, enhancement.
- Client-side aggregation from `GET /v1/posts` remains viable for the expected post-volume scale.
- Users understand v1 insights are country-level only, and that not every post is mappable.
- Depends on ADR-0054 (analytics data-source strategy, client-side aggregation precedent), ADR-0055 (feasibility groundwork), ADR-0056 (named future enhancement path for `inferred` provenance), and ADR-0062 (Overview tab grid, filter model, and the "no heavy mapping library" constraint from Decision §9).
- Story 2.20 (backend extraction) is a prerequisite for Story 8.10 (frontend widget); both are already Built as of 2026-08-20.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | If a future connector exposes author profile location as free text, should the system geocode it to ISO country, via which provider, and at what confidence threshold — considering cost, rate limits, and tenant data residency? | Product Owner | Deferred for v1 |
| Q2 | Is there a demonstrated tenant need for region/state/city-level aggregates beyond country level? | Product Owner | Deferred; revisit only if a connector explicitly provides sub-national data |
| Q3 | Should a small, curated domain→country allowlist be maintained to improve Newswire coverage without aggressive guessing? | Technical Lead | Open — trade-off between maintenance burden and coverage gain |
| Q4 | For the choropleth, should "Unknown" appear only as a separate legend/card, or also as a count in the Top Countries list? | Frontend Engineer (Story 8.10) | Resolved at implementation time; both are shown per the built widget |
| Q5 | What is the confirmed coverage threshold (N) for suppressing country-level sentiment on small samples? | Product Owner | Resolved at N=3 posts in Story 8.10's implementation |

---

## 14. Appendix

### Glossary

- **ISO 3166-1 alpha-2:** Two-letter country code standard (e.g. `US`, `GB`, `NL`) used as the canonical v1 country identifier.
- **Geo field:** The set of `geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, and `geoConfidence` persisted in `enrichment`.
- **Geo source:** Provenance tracker indicating whether the country came from the post, the publisher source, was inferred, or is unknown.
- **Geo confidence:** Indicator of reliability for the country assignment (`high`, `medium`, `low`, `null`).
- **Unknown / Unmapped bucket:** A dedicated aggregate row for posts whose `geoCountry` is `null`; always shown, never hidden.
- **Choropleth map:** A thematic map where country polygons are colored by a statistical value (post count in this case).

### Reference Links

- ADR-0064 — `docs/adr/0064-location-and-geospatial-insights-from-posts-and-authors.md`
- BRD-0064 — `docs/project docs/Business-Requirements/BRD-0064-Location-And-Geospatial-Insights-From-Posts-And-Authors.md`
- ADR-0054 — Analytics dashboard scope and data-source strategy
- ADR-0055 — Language and location enrichment feasibility
- ADR-0056 — AI-inferred origin location from Newswire dateline text
- ADR-0062 — Analytics Dashboard Overview enhancements
- `docs/product-research/feature-designs/08-dashboards-and-analytics.md` — related feature design context
- Story 2.20 — `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`
- Story 8.10 — `docs/user-stories/epic-8-analytics-dashboard.md`

### Related Product-Research Documents

`docs/product-research/feature-designs/08-dashboards-and-analytics.md` provides high-level dashboard/analytics context relevant to this feature. No `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for Location and Geospatial Insights (confirmed by BRD-0064 §16 "Missing source").

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | Architecture Documentation | Regenerated as a genuine Functional Design Document, replacing a defective prior version that duplicated the BRD's flat requirements table |
