# ADR-0064: Location and geospatial insights from posts and authors

**Status:** Proposed (2026-08-19)

**Source:** Follow-up to ADR-0054 (Analytics scope/data-source strategy), ADR-0055 (Language and location enrichment feasibility), and ADR-0062 (Analytics Dashboard Overview enhancements). This ADR evaluates the feasibility of collecting, normalising, and surfacing location/geospatial insights in the analytics dashboards using data available from the project's real connectors, and makes the case for a pragmatic, privacy-conscious v1 implementation.

## Context

### Why location was deferred previously

ADR-0054 Decision §4 explicitly excluded Location Insights: *"no connector populates `post_geo_location`; `SocialPostSummary` excludes it."* ADR-0055 (2026-08-13) examined feasibility in detail and concluded:

- **Post-level precise geolocation is extremely sparse.** Most commercial/social APIs do not return precise latitude/longitude for the vast majority of posts. When present, it is typically limited to a small subset of user-generated content (and increasingly restricted by platform policy changes).
- **Author profile location is common but unstructured.** Many platforms expose a free-text "location" field on author profiles. That field is user-entered, often ambiguous ("London", "NYC", "Earth"), can be fictional, and cannot be treated as a verified post location.
- **No uniform schema across platforms.** Platforms expose location at different granularities (point, place, city, region, country) with different field names. Normalisation is required before any spatial visualisation is meaningful.
- **Privacy considerations.** Storing precise coordinates risks identifying individuals and increases compliance surface area (GDPR/other regional considerations). Country-level aggregation is typically sufficient for the executive analytics use case this project targets.

As a result, the Location Insights SVG world map described in the ADR-0062 specification was **not built** (ADR-0062 Decision §8). That remains a visible gap in the Overview tab layout.

### Business case for spatial insights

Despite the data limitations, location remains a high-value dimension for the analytics product. Surfacing spatial insights (even at country/region level) would unlock:

- **Crisis & incident awareness:** Detect regional spikes in conversation volume (e.g. severe weather, outages, regulatory events) faster than scanning global time-series alone.
- **Regional sentiment & reputation:** Understand how sentiment varies by market/country to support regional teams without requiring full post inspection.
- **Coverage & source distribution:** Identify which countries/regions are over- or under-represented in the ingested corpus relative to watchlists or brand footprint.
- **Watchlist alignment:** Once ADR-0063 is implemented, correlate watchlist matches to geography to answer "where is this topic gaining traction?"
- **Operational prioritisation:** Route signals to the right regional owners when combined with existing filters (source, language, sentiment).

These use cases do **not** require plotting individual precise points on a map. They require consistent, normalised country (and optionally sub-region) aggregates computed from the real dataset.

### Review of geolocation data points by platform (within project scope)

The project currently has **three real connectors**: `gnews`, `newswire`, and `tenant-owned-feed`. The specification for ADR-0062 referenced a broader 8-platform roster, but those platforms are not implemented connectors. This ADR therefore evaluates feasibility against the real connectors first, and notes what would be required if additional connectors were added in future.

| Platform / Connector | Post-level precise geo (lat/lon) | Post-level place/country | Author profile location | Reliability | Notes / constraints |
|---|---|---|---|---|---|
| **GNews** (`gnews`) | **Not available** | **Country-level available** | **Not provided** | **High (source-derived)** | GNews API returns results with a `country` code (e.g. `us`, `gb`, `nl`) and source metadata. It does not expose precise coordinates or per-post author profile objects with location in the standard search response. Country is the most consistent spatial field. |
| **Newswire** (`newswire`) | **Not available** | **Varies by source feed** | **Not provided** | **Medium** | Newswire aggregates press release and newswire feeds. Many items include a `sourceCountry` or can be inferred from source domain/publication location, but this is not guaranteed on every item. Precise coordinates are not present in the typical payloads this connector ingests. |
| **Tenant-owned-feed** (`tenant-owned-feed`) | **Depends on source system** | **Depends on source system** | **Depends on source system** | **Variable** | This connector ingests arbitrary tenant-provided feeds (RSS/JSON). Some sources may include `geo:lat/lon`, `location`, or `country` fields; others include none. The connector must not assume uniformity. Any geo extracted must be treated as opt-in and inconsistently populated. |
| **X/Twitter (hypothetical)** | Very sparse (removed/limited) | Place objects exist but rare | Free-text profile (unreliable) | Low–Medium | Historically had `coordinates`/`place`, but availability is low and policy-restricted. Profile location is free-text. Not in project scope. |
| **LinkedIn (hypothetical)** | **Not available** | **Not available** | Free-text profile | Low | No post-level geo in public APIs; profile location is free-text. Not in scope. |
| **Instagram/YouTube/Facebook (hypothetical)** | Very limited | Varies | Free-text | Low | Platform API restrictions limit post geo to small subsets; often requires special permissions. Not in scope. |

**Conclusion from platform review:** For the real connectors, **country-level is the only spatial dimension that is consistently present (GNews) or plausibly derivable with reasonable effort (Newswire/tenant feeds)**. Precise lat/lon is not reliably available across any real connector. Author profile location exists only as free-text in hypothetical connectors and is not present in the real connector payloads today.

## Decision

### 1. Adopt country-level as the v1 spatial unit

This ADR adopts **ISO 3166-1 alpha-2 country code** as the canonical v1 spatial dimension. Rationale:

- **Consistent across real connectors:** GNews provides country directly; Newswire/tenant feeds can often be mapped to country via source country or explicit country fields when present.
- **Sufficient for the stated use cases:** Crisis awareness, regional sentiment, coverage distribution all work at country/region level.
- **Privacy-safe by default:** Aggregates by country avoid storing precise coordinates or individual location traces.
- **Enables simple visualisation:** Country choropleth (world map) and ranked country lists are feasible without point-clustering complexity.

Sub-national (city/region/state) is **deferred** for v1. City-level data is too sparse and ambiguous across real connectors to justify building a reliable map without heavy geocoding (Open Question 1).

### 2. Normalised geo schema

Add normalised geo fields to the data model used for analytics (persisted alongside enrichment). The following fields are introduced:

| Field | Type | Required? | Notes |
|---|---|---|---|
| `geo_country` | `string \| null` | No | ISO 3166-1 alpha-2 (e.g. `US`, `GB`, `NL`). Stored in uppercase. `null` if unknown/unmappable. |
| `geo_country_name` | `string \| null` | No | Human-readable country name (for UI display). Derived from ISO code. |
| `geo_region` | `string \| null` | No | Optional sub-region (e.g. `EU`, `NA`, or UN subregion). Deferred for v1 population but schema allows future population. |
| `geo_source` | `'post' \| 'source' \| 'inferred' \| 'unknown'` | No | Provenance: `post` if the connector provided an explicit country on the post; `source` if derived from source/publication; `inferred` if derived via a future geocoding pass; `unknown` otherwise. |
| `geo_confidence` | `'high' \| 'medium' \| 'low' \| null` | No | Confidence in the mapping. For v1, `high` for GNews explicit country, `medium` for source-derived, `low` if inferred from ambiguous text. |

**Storage location:** These fields are added to `PostEnrichmentSummary` (and persisted in the enrichment store, consistent with ADR-0055's enrichment model). They are **not** added as precise lat/lon. The existing `post_geo_location` table remains unused in v1; no point geometry is stored.

This keeps the schema consistent with `SocialPostSummary` (which already carries enrichment fields) and avoids introducing a new, sparsely-populated geometry table until there is a demonstrated need and reliable data.

### 3. Extraction logic per real connector

| Connector | Extraction strategy (v1) | Mapping |
|---|---|---|
| **GNews** | Read explicit country code from API response (top-level `country` or per-article field present in GNews search). | Map to ISO 3166-1 alpha-2 (uppercase). Set `geo_source = 'post'`, `geo_confidence = 'high'`. |
| **Newswire** | Prefer explicit `sourceCountry`/`country` if present in feed item. Fallback: map source publication domain or source name to country where unambiguous (e.g. known wire services with primary country). | Only populate when mapping is unambiguous. Otherwise leave `null`. Set `geo_source = 'post'` if explicit, else `'source'`; confidence `high`/`medium`. |
| **Tenant-owned-feed** | Inspect common fields: `country`, `countryCode`, `geo.country`, `sourceCountry`. Do **not** attempt to geocode free-text `location` fields in v1 (Open Question 1). | Only use explicit country codes/values present in the feed. Normalise to ISO alpha-2. Set provenance accordingly. |

No attempt is made in v1 to parse author profile location text for any connector (since real connectors do not expose it reliably today). This avoids the cost and ambiguity of geocoding unstructured text.

### 4. Spatial insights to surface in dashboards

With country-level data available (even if sparse), the following widgets/visualisations become feasible without fabricating data:

| Insight | Visualisation | Data source | Notes |
|---|---|---|---|
| **Top countries by volume** | Ranked list (bar chart or table) | `geo_country` counts over filtered posts | Shows which countries generate the most conversation in the current filter set. Handles `null` as "Unknown" row (explicit, never hidden). |
| **Country distribution (share)** | Donut/Pie chart | Country volume share | Useful for coverage view. "Unknown" is shown as its own slice to avoid misleading percentages. |
| **Regional volume over time** | Multi-series line/area by top N countries | Country + `publishedAt` | Top 5–10 countries by total volume in range to avoid chart noise. |
| **Regional sentiment** | Country × sentiment table or small multiples | `geo_country` + `enrichment.sentiment` | Average/majority sentiment per country (only shown for countries with >= N posts to avoid small-sample noise). |
| **World choropleth (country-level)** | SVG choropleth map | Country volume (normalised) | Uses ISO alpha-2 country codes and a lightweight country geometry set (e.g. static TopoJSON/SVG map). No point plotting. Colour scale by post count per country. "Unknown" shown separately (not on map). |

These replace the previously-deferred "Location Insights" widget with a realistic set: a **Top Countries** list + **Country choropleth** (or optionally the country distribution chart). The full D3 point map is not adopted.

### 5. API & UI changes

- **Enrichment pipeline:** Update connector enrichment mappers to populate `geo_country`, `geo_country_name`, `geo_source`, `geo_confidence` per the rules above. Changes are isolated to `social-listening-core` connector mappers (no cross-cutting schema rewrite).
- **`SocialPostSummary`:** Add the four geo fields (nullable) to the summary type returned by `GET /v1/posts`. This is additive and backwards-compatible (existing clients ignore unknown fields).
- **Analytics aggregation:** Extend client-side aggregations (consistent with ADR-0054 Decision §3) to group by `geo_country` when computing country-level insights. No new core aggregation endpoints required for v1.
- **UI:** Replace "Location Insights" slot (ADR-0062 Decision §8) with **"Top Countries & Regional Distribution"**. Render: (a) Top Countries ranked list, (b) country choropleth map (SVG) coloured by volume. Both respect the active filters (date range, source, sentiment, etc.). The "Unknown" bucket is always visible in the list.

## Consequences

**Positive**

- **Unblocks Location Insights in a realistic form.** Delivers genuine spatial value using data that actually exists (especially GNews) without waiting for perfect post-level geo.
- **Privacy-first by design.** Country-level only, no precise coordinates stored. Avoids the compliance risks of point-level mapping.
- **Honest about data coverage.** The "Unknown" bucket makes it explicit how much of the corpus has mappable geography — no misleading map fill.
- **Low implementation surface.** Additive enrichment fields, no new core endpoints, and visualisations built with existing Recharts/SVG approach (no new heavy mapping library required if using a lightweight static country map).
- **Aligns with real connectors.** Matches exactly what GNews provides and what Newswire/tenant feeds can reasonably supply.
- **Sets foundation for future.** Schema supports region and confidence, allowing future expansion if connectors add richer geo or if geocoding is justified later.

**Negative**

- **Sparse coverage for some connectors.** Newswire and tenant-owned-feed will often have `geo_country = null`. GNews provides country for most results but not all. The widget will show a meaningful "Unknown" segment.
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

1. **Geocoding free-text location (future)** — If a future connector exposes author profile location (free-text), should the system geocode it to ISO country? If yes, which provider (e.g. Azure Maps, OpenStreetMap Nominatim) and what confidence threshold is required to populate `geo_country`? Also need to consider cost, rate limits, and tenant data residency. Deferred for v1.
2. **Sub-national mapping** — Is there a demonstrated tenant need for region/state/city-level aggregates? For v1 country is sufficient. If revisited, likely limited to connectors that explicitly provide it (rare) rather than inference.
3. **Domain→country mapping list** — Should we maintain a small, curated allowlist of source domains → country (e.g. major wire services with known primary country)? This could improve Newswire coverage without aggressive guessing. Trade-off: maintenance burden vs. coverage gain.
4. **Handling "Unknown" in visualisations** — The ADR states "Unknown" is always shown. For the choropleth map, should "Unknown" be shown in a separate legend/card (not on the map) or as a count in the Top Countries list only? Implementation detail left to Story 8.7/8.9 follow-up, but principle is established.
5. **Coverage threshold for country insights** — Should country-level sentiment/aggregates be hidden when a country has < N posts in the filtered range (to avoid misleading small samples)? The ADR suggests this for sentiment (Decision §4) — worth confirming the threshold (e.g. N=5) in implementation.

---

*Drafted 2026-08-19 to address the gap identified in ADR-0054 and ADR-0062. Verified against real connector capabilities (gnews, newswire, tenant-owned-feed) and existing enrichment model (ADR-0055). The approach prioritises data realism, privacy, and alignment with the project's "no fabricated data" discipline. Left **Proposed** per project ADR-acceptance authority convention.*