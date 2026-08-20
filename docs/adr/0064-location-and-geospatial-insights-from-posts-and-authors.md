# ADR-0064: Location and geospatial insights from posts and authors

**Status:** Proposed (2026-08-19)

**Source:** Follow-up to ADR-0054 (Analytics scope/data-source strategy), ADR-0055 (Language and location enrichment feasibility), ADR-0056 (AI-inferred origin location from Newswire dateline text), and ADR-0062 (Analytics Dashboard Overview enhancements). This ADR evaluates the feasibility of collecting, normalising, and surfacing location/geospatial insights in the analytics dashboards using data available from the project's real connectors, and makes the case for a pragmatic, privacy-conscious v1 implementation.

## Context

### Why location was deferred previously

ADR-0054 Decision §4 explicitly excluded Location Insights: *"no connector populates `post_geo_location`; `SocialPostSummary` excludes it."* ADR-0055 (2026-08-13) examined feasibility in detail and concluded:

- **Post-level precise geolocation is extremely sparse.** Most commercial/social APIs do not return precise latitude/longitude for the vast majority of posts. When present, it is typically limited to a small subset of user-generated content (and increasingly restricted by platform policy changes).
- **Author profile location is common but unstructured.** Many platforms expose a free-text "location" field on author profiles. That field is user-entered, often ambiguous ("London", "NYC", "Earth"), can be fictional, and cannot be treated as a verified post location.
- **No uniform schema across platforms.** Platforms expose location at different granularities (point, place, city, region, country) with different field names. Normalisation is required before any spatial visualisation is meaningful.
- **Privacy considerations.** Storing precise coordinates risks identifying individuals and increases compliance surface area (GDPR/other regional considerations). Country-level aggregation is typically sufficient for the executive analytics use case this project targets.

As a result, the Location Insights SVG world map described in the ADR-0062 specification was **not built** (ADR-0062 Decision §8). That remains a visible gap in the Overview tab layout.

### Business case for spatial insights

Despite the data limitations, location remains a high-value dimension for the analytics product. Surfacing spatial insights (even at country/region level) unlocks:

- **Crisis & incident awareness:** Detect regional spikes in conversation volume (e.g. severe weather, outages, regulatory events) faster than scanning global time-series alone.
- **Regional sentiment & reputation:** Understand how sentiment varies by market/country to support regional teams without requiring full post inspection.
- **Coverage & source distribution:** Identify which countries/regions are over- or under-represented in the ingested corpus relative to watchlists or brand footprint.
- **Watchlist alignment:** Once ADR-0063 is implemented, correlate watchlist matches to geography to answer "where is this topic gaining traction?"
- **Operational prioritisation:** Route signals to the right regional owners when combined with existing filters (source, language, sentiment).

These use cases do **not** require plotting individual precise points on a map. They require consistent, normalised country (and optionally sub-region) aggregates computed from the real dataset.

### Review of geolocation data points by platform (within project scope)

The project currently has **four real connectors**: `gnews`, `newswire`, `tenant-owned-feed`, and `facebook` (Page-scope). The specification for ADR-0062 referenced a broader 8-platform roster, but those platforms are not implemented connectors. This ADR therefore evaluates feasibility against the real connectors first, and notes what would be required if additional connectors were added in future.

| Platform / Connector | Post-level precise geo (lat/lon) | Post-level place/country | Author profile location | Reliability | Notes / constraints |
|---|---|---|---|---|---|
| **GNews** (`gnews`) | **Not available** | **Country-level available** | **Not provided** | **High (source-derived)** | GNews API returns `GNewsArticle.source.country` (e.g. `us`, `gb`, `nl`). It does not expose precise coordinates or per-post author profile objects in standard search. Country is publisher-declared. |
| **Newswire** (`newswire`) | **Not available** | **Varies by source feed / Dateline** | **Not provided** | **Medium** | Aggregates press release and newswire feeds. Ingest items may include `sourceCountry` or infer country via dateline extraction per ADR-0056 (`inferOriginLocation`). Precise coordinates are absent. |
| **Tenant-owned-feed** (`tenant-owned-feed`) | **Depends on source system** | **Depends on source system** | **Depends on source system** | **Variable** | Ingests arbitrary tenant RSS/JSON feeds. Some sources include `geo:lat/lon`, `location`, or `country`; others include none. Cannot assume uniformity. |
| **Facebook** (`facebook`) | **Not available** | **Not available in feed payload** | **Page location (unstructured)** | **Low** | Tenant-owned Page posts do not carry post-level coordinates in standard Graph API feed calls. |
| **X/Twitter (hypothetical)** | Very sparse (removed/limited) | Place objects exist but rare | Free-text profile (unreliable) | Low–Medium | Historically had `coordinates`/`place`, but availability is low and policy-restricted. Profile location is free-text. Not in project scope. |
| **LinkedIn (hypothetical)** | **Not available** | **Not available** | Free-text profile | Low | No post-level geo in public APIs; profile location is free-text. Not in scope. |
| **Instagram/YouTube (hypothetical)** | Very limited | Varies | Free-text | Low | Platform API restrictions limit post geo to small subsets. Not in scope. |

**Conclusion from platform review:** For the real connectors, **country-level is the only spatial dimension that is consistently present (GNews) or plausibly derivable with reasonable effort (Newswire/tenant feeds)**. Precise lat/lon is not reliably available across any real connector. Author profile location exists only as free-text in hypothetical connectors and is not present in the real connector payloads today.

## Decision

### 1. Adopt country-level as the v1 spatial unit

This ADR adopts **ISO 3166-1 alpha-2 country code** as the canonical v1 spatial dimension. Rationale:

- **Consistent across real connectors:** GNews provides country directly; Newswire/tenant feeds can often be mapped to country via source country, explicit country fields, or dateline extraction (ADR-0056).
- **Sufficient for the stated use cases:** Crisis awareness, regional sentiment, coverage distribution all work at country/region level.
- **Privacy-safe by default:** Aggregates by country avoid storing precise coordinates or individual location traces.
- **Enables simple visualisation:** Country choropleth (world map) and ranked country lists are feasible without point-clustering complexity.

Sub-national (city/region/state) is **deferred** for v1. City-level data is too sparse and ambiguous across real connectors to justify building a reliable map without heavy geocoding (Open Question 1).

### 2. Normalised geo schema in `enrichment`

Add normalised geo fields to the data model in standard `camelCase` (matching `PostEnrichmentSummary` and `AnalyzeResult` conventions), persisted in `social_posts.enrichment` (consistent with ADR-0055 and ADR-0056):

| Field | Type | Required? | Notes |
|---|---|---|---|
| `geoCountry` | `string \| null` | No | ISO 3166-1 alpha-2 (e.g. `US`, `GB`, `NL`). Stored in uppercase. `null` if unknown/unmappable. |
| `geoCountryName` | `string \| null` | No | Human-readable country name (for UI display, e.g. "United States", "United Kingdom"). Derived from ISO code. |
| `geoRegion` | `string \| null` | No | Optional sub-region (e.g. `EU`, `NA`, or UN subregion). Deferred for v1 population but schema allows future population. |
| `geoSource` | `'post' \| 'source' \| 'inferred' \| 'unknown'` | No | Provenance: `'post'` if explicit country on the post; `'source'` if derived from publisher/source; `'inferred'` if derived via dateline extraction (ADR-0056) or geocoding; `'unknown'` otherwise. |
| `geoConfidence` | `'high' \| 'medium' \| 'low' \| null` | No | Confidence in the mapping. `high` for GNews explicit source country, `medium` for source-derived/feed metadata, `low` if inferred from ambiguous text. |

**Storage location and zero-migration advantage:**
These fields are stored directly within `social_posts.enrichment` (`JSONB`). Because `SocialPostSummary` returned by `GET /v1/posts` already exposes `enrichment: unknown` in full and unfiltered (as verified in ADR-0055 and ADR-0056), **no database migration and no `social-listening-core` endpoint change is required**. The legacy `post_geo_location` table remains unused in v1; no point geometry is stored.

### 3. Extraction logic per real connector

| Connector | Extraction strategy (v1) | Mapping |
|---|---|---|
| **GNews** | Read `GNewsArticle.source.country` from response. | Map to ISO 3166-1 alpha-2 (uppercase). Set `geoSource = 'source'`, `geoConfidence = 'high'`. |
| **Newswire** | 1. Prefer explicit `sourceCountry`/`country` if present in feed item.<br>2. Fallback: map source publication domain where unambiguous.<br>3. Optional future AI dateline extraction per ADR-0056 (`inferOriginLocation`). | Only populate when mapping is unambiguous. Otherwise leave `null`. Set `geoSource = 'post'` if explicit in feed, `'source'` if domain-mapped, or `'inferred'` if ADR-0056 is active; confidence `high`/`medium`. |
| **Tenant-owned-feed** | Inspect common fields: `country`, `countryCode`, `geo.country`, `sourceCountry`. Do **not** attempt to geocode free-text `location` fields in v1 (Open Question 1). | Only use explicit country codes/values present in the feed. Normalise to ISO alpha-2. Set provenance accordingly. |
| **Facebook** | Leave `null` in v1. | Page location is unstructured and not returned in feed items. |

No attempt is made in v1 to parse author profile location text for any connector. This avoids the cost and ambiguity of geocoding unstructured text.

### 4. Spatial insights to surface in dashboards

With country-level data available (even if sparse), the following widgets/visualisations become feasible without fabricating data:

| Insight | Visualisation | Data source | Notes |
|---|---|---|---|
| **Top countries by volume** | Ranked list (bar chart or table) | `geoCountry` counts over filtered posts | Shows which countries generate the most conversation in the current filter set. Handles `null` as "Unknown" row (explicit, never hidden). |
| **Country distribution (share)** | Donut/Pie chart | Country volume share | Useful for coverage view. "Unknown" is shown as its own slice to avoid misleading percentages. |
| **Regional volume over time** | Multi-series line/area by top N countries | Country + `publishedAt` | Top 5–10 countries by total volume in range to avoid chart noise. |
| **Regional sentiment** | Country × sentiment table or small multiples | `geoCountry` + `enrichment.sentiment` | Average/majority sentiment per country (only shown for countries with >= N posts to avoid small-sample noise). |
| **World choropleth (country-level)** | SVG choropleth map | Country volume (normalised) | Uses ISO alpha-2 country codes and a lightweight country geometry set (e.g. static TopoJSON/SVG map). No point plotting. Colour scale by post count per country. "Unknown" shown separately (not on map). |

These replace the previously-deferred "Location Insights" widget with a realistic set: a **Top Countries** list + **Country choropleth** (or optionally the country distribution chart). The full D3 point map is not adopted, adhering to ADR-0062 Decision §9.

### 5. API & UI changes

- **Enrichment pipeline:** Update connector ingestion/enrichment mappers in `social-listening-core` to populate `geoCountry`, `geoCountryName`, `geoSource`, `geoConfidence` inside `enrichment` per the rules above.
- **`PostEnrichmentSummary`:** Widen `PostEnrichmentSummary` and `extractEnrichmentSummary()` in `social-listening-admin/src/app/tenant/posts/postDisplay.ts` to surface the `geoCountry`, `geoCountryName`, `geoSource`, `geoConfidence` properties.
- **Analytics aggregation:** Extend client-side aggregations (consistent with ADR-0054 Decision §3) to group by `geoCountry` when computing country-level insights. No new core aggregation endpoints required for v1.
- **UI:** Replace "Location Insights" slot (ADR-0062 Decision §8) with **"Top Countries & Regional Distribution"**. Render: (a) Top Countries ranked list, (b) country choropleth map (SVG) coloured by volume. Both respect the active filters (date range, source, sentiment, etc.). The "Unknown" bucket is always visible in the list.

## Consequences

**Positive**

- **Unblocks Location Insights in a realistic form.** Delivers genuine spatial value using data that actually exists (especially GNews) without waiting for perfect post-level geo.
- **Privacy-first by design.** Country-level only, no precise coordinates stored. Avoids the compliance risks of point-level mapping.
- **Honest about data coverage.** The "Unknown" bucket makes it explicit how much of the corpus has mappable geography — no misleading map fill.
- **Zero migration surface.** Stored within existing JSONB `enrichment` column, passing through `SocialPostSummary` unfiltered with no core database migrations.
- **Low implementation surface.** Visualisations built with existing Recharts/SVG approach (no heavy mapping library required per ADR-0062 Decision §9).
- **Aligns with real connectors.** Matches what GNews provides and what Newswire/tenant feeds can reasonably supply.
- **Sets foundation for future.** Schema supports region and confidence, allowing future expansion if connectors add richer geo or if ADR-0056 dateline extraction is enabled.

**Negative**

- **Sparse coverage for some connectors.** Newswire, Facebook, and tenant-owned-feed will often have `geoCountry = null`. GNews provides country for most results but not all. The widget will show a meaningful "Unknown" segment.
- **No city/precise mapping.** Use cases requiring city-level heatmaps or pin maps cannot be met with v1. That is a deliberate trade-off.
- **No author-profile geocoding in v1.** Even if hypothetically added later, free-text profile location is low-confidence and would require an external geocoding service (cost, rate limits).
- **Country mapping edge cases.** Source-derived mapping (Newswire) can be ambiguous for multinational publications. The v1 rule (only populate when unambiguous) avoids errors but reduces coverage.
- **Still not the full spec map.** Diverges from ADR-0062's SVG world map description (which implied a fuller map experience). This is the correct divergence given data reality.

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Store precise lat/lon when present** | Rejected. Not reliably present for any real connector. Storing sparse points creates a misleading map (mostly empty) and increases privacy/compliance surface area with little user value. |
| **Geocode free-text author profile location** | Deferred. Requires external geocoding provider (cost), needs confidence thresholds, and free-text is often unreliable. No real connector exposes author profile location today, so not justified for v1. Named as Open Question 1. |
| **Infer country from post language** | Rejected. Language ≠ country (e.g. English posts from US/GB/NL/IN/CA). High error rate would mislead users. Language is already a separate dimension (ADR-0055). |
| **Show a placeholder "Location coming soon" map** | Rejected. Same category of defect this project consistently rejects (no fabricated/placeholder UI presenting as real). The v1 approach shows only real, mapped data with explicit "Unknown". |
| **Derive country from source domain heuristics aggressively** | Rejected for v1. Aggressive heuristics create false mappings (multinational outlets). v1 only maps when unambiguous; can revisit with a curated domain→country map in future if coverage need is demonstrated. |
| **Build the full choropleth with point overlay** | Rejected. No point data exists. Point overlay would be empty or fabricated. Country choropleth with "Unknown" bucket matches available data. |

## Open Questions

1. **Geocoding free-text location (future)** — If a future connector exposes author profile location (free-text), should the system geocode it to ISO country? If yes, which provider (e.g. Azure Maps, OpenStreetMap Nominatim) and what confidence threshold is required to populate `geoCountry`? Also need to consider cost, rate limits, and tenant data residency. Deferred for v1.
2. **Sub-national mapping** — Is there a demonstrated tenant need for region/state/city-level aggregates? For v1 country is sufficient. If revisited, likely limited to connectors that explicitly provide it (rare) rather than inference.
3. **Domain→country mapping list** — Should we maintain a small, curated allowlist of source domains → country (e.g. major wire services with known primary country)? This could improve Newswire coverage without aggressive guessing. Trade-off: maintenance burden vs. coverage gain.
4. **Handling "Unknown" in visualisations** — The ADR states "Unknown" is always shown. For the choropleth map, should "Unknown" be shown in a separate legend/card (not on the map) or as a count in the Top Countries list only? Implementation detail left to story follow-up, but principle is established.
5. **Coverage threshold for country insights** — Should country-level sentiment/aggregates be hidden when a country has < N posts in the filtered range (to avoid misleading small samples)? The ADR suggests this for sentiment (Decision §4) — worth confirming the threshold (e.g. N=5) in implementation.

---

*Drafted 2026-08-19, updated 2026-08-20 to address the gap identified in ADR-0054 and ADR-0062. Reconciled with ADR-0055 (Language/Location feasibility), ADR-0056 (AI-inferred dateline extraction), and verified against real connector capabilities (gnews, newswire, tenant-owned-feed, facebook) and existing enrichment model. The approach prioritises data realism, privacy, zero-migration schema extension via `enrichment` JSONB, and alignment with the project's "no fabricated data" discipline. Left **Proposed** per project ADR-acceptance authority convention.*
