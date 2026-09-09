# Technical Design Specification (TDS) — Active Watchlist Sourcing via Bing Search API

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0066: Active Watchlist Sourcing via Bing Search API (Azure) — Enterprise Polling Ingestion, Dual-Endpoint Fallback & URL Canonicalisation |
| **Document ID** | `TDS-0066` |
| **Feature Name** | Bing Search Ingestion Connector, Enterprise Azure Sourcing & Multi-Step Canonicalisation |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/ingestion-connectors/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0066` | [ADR-0066: Active Watchlist Sourcing via Bing Search API (Azure)](../../adr/0066-active-watchlist-sourcing-via-bing-search-api.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0066` | [BRD-0066: Active Watchlist Sourcing Via Bing Search API](../Business-Requirements/BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0066` | [FDD-0066: Active Watchlist Sourcing Via Bing Search API](../Functional-Design/FDD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md) | Fully Aligned |
| **Governing User Story** | `Story 2.22` | [Epic 2: Ingestion Connectors](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-222--active-watchlist-sourcing-via-bing-search-api-azure-polling-connector-candidate-evaluation-cap-and-url-canonicalisation) | Acceptance Target |
| **Related User Stories** | `Story 6.29`, `Story 2.21` | Bing Search UI Config, Brave Search Sourcing | Sibling Modules |
| **Related Architecture Decisions** | `ADR-0004`, `ADR-0005`, `ADR-0028`, `ADR-0038`, `ADR-0063`, `ADR-0065`, `ADR-0120` | Author Entity, Deduplication, Tier-2 Creds, AI Language, Match Persistence, Search Abstraction | System Architecture |
| **Executable Contract Tests** | `Story 2.22 Contract` | `social-listening-core/contracts/epic-2/story-2.22.bing-search-connector.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Scheduler["Live Ingestion Scheduler"]
        Tick["Cron Poller (1-4h interval)"]
        ActiveWatchlists["Query Active Watchlists"]
    end

    subgraph BingConnector["bing-search Ingestion Connector"]
        QueryTransformer["Watchlist Terms / AST to Bing Query"]
        EndpointSelector["Deterministic Endpoint Selector (News -> Web fallback if < 5 results)"]
        LookbackMapper["Lookback to Freshness ('Day' | 'Week' | 'Month')"]
        BingClient["HTTP Client (/v7.0/news/search & /v7.0/search)"]
        URLCanonicalizer["Multi-Step URL Canonicaliser (strip utm/tracking, unwrap redirects)"]
        ASTValidator["Candidate Evaluation Cap (Top 25-50) & AST Filter"]
        PostMapper["SocialPost & Domain Author Normalizer"]
    end

    subgraph AzureCognitive["Azure AI Services"]
        BingAPI["api.bing.microsoft.com"]
    end

    subgraph Storage["PostgreSQL (Tenant RLS)"]
        Posts["social_posts (provider_id = 'bing-search')"]
        Junction["post_watchlist_matches"]
    end

    subgraph AI["Enrichment Pipeline"]
        LLMGrounding["AzureOpenAiConnector Grounding & Summary"]
    end

    Tick --> ActiveWatchlists
    ActiveWatchlists --> QueryTransformer
    QueryTransformer --> LookbackMapper
    LookbackMapper --> EndpointSelector
    EndpointSelector --> BingClient
    BingClient -->|Ocp-Apim-Subscription-Key| BingAPI
    BingAPI -->> BingClient: JSON (name, url, description, datePublished)
    BingClient --> URLCanonicalizer
    URLCanonicalizer --> ASTValidator
    ASTValidator -->|Passed Strict AST| PostMapper
    PostMapper --> Posts
    PostMapper --> Junction
    Posts --> LLMGrounding
```

### 2.2 Architectural Boundaries & Invariants
- **Deterministic Endpoint Selection (`auto` default):** The connector queries `/v7.0/news/search` first to prioritize fresh journalistic sources. If the news endpoint yields **fewer than 5 validated results**, the connector automatically falls back to `/v7.0/search` (Web) in the same polling tick to harvest broader web content.
- **Candidate Evaluation Cap:** The connector requests at most `count = 25` (up to 50 max) results from Bing per watchlist query, capping network and CPU parsing overhead.
- **Deterministic Lookback-to-Freshness Mapping:**
  - Ingestion lookback $\le 48\text{ hours} \implies \text{freshness} = \text{'Day'}$.
  - Ingestion lookback 3 to 7 days $\implies \text{freshness} = \text{'Week'}$.
  - Ingestion lookback $> 7\text{ days} \implies \text{freshness} = \text{'Month'}$.
- **Multi-Step URL Canonicalisation:** To ensure bulletproof deduplication:
  1. Resolves and unwraps HTTP 301/302 redirects where available.
  2. Strips known tracking query parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`, `ref`, `source`).
  3. Lowercases schemes (`https://`) and hostnames, stripping `www.` prefixes.
  4. Strips trailing hash fragments (`#...`).
- **Base Domain as Author (ADR-0004 Generalization):**
  - `author.id = "bing-search:" + baseDomain`
  - `author.username = baseDomain` (e.g. `reuters.com`)
  - `author.displayName = provider[0].name || baseDomain`
  - `author.platform = 'bing-search'`
- **Tier-2 Credential Ownership:** Uses Azure Cognitive Services `Ocp-Apim-Subscription-Key` stored encrypted under tenant ownership in `platform_credentials`.

---

## 3. Data Architecture & Persistence Design

### 3.1 Normalization Schema
| Bing Search Field | `SocialPostSummary` Field | Processing Rules |
|---|---|---|
| `url` | `externalId`, `url` | Canonicalized URL string |
| `name` | `title` | Title string trimmed of trailing publisher branding |
| `description` | `bodyMarkdown` | Excerpt markdown |
| `datePublished` (or `dateLastCrawled`) | `publishedAt` | Parsed ISO date |
| `provider[0].name` / `domain` | `author` | Normalized author entity |

### 3.2 Canonicalisation Utility (`urlCanonicalizer.ts`)
```typescript
export function canonicalizeSearchUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'ref'];
  trackingParams.forEach(param => parsed.searchParams.delete(param));
  
  parsed.hash = '';
  return parsed.toString();
}
```

---

## 4. Application Logic & Workflows

### 4.1 Ingestion Execution with Fallback
```typescript
export async function executeBingWatchlistIngestion(
  tenantId: string,
  watchlist: Watchlist,
  bingClient: BingSearchClient
): Promise<NormalizedPost[]> {
  const query = buildBingQuery(watchlist);
  const freshness = mapLookbackToFreshness(watchlist.lookbackHours || 24);

  // 1. Try News Search
  let results = await bingClient.searchNews(query, { freshness, count: 25 });
  let matchedPosts = filterCandidatesByAst(results, watchlist.ast, tenantId);

  // 2. Fallback to Web Search if < 5 results
  if (matchedPosts.length < 5) {
    const webResults = await bingClient.searchWeb(query, { freshness, count: 25 });
    const additionalMatches = filterCandidatesByAst(webResults, watchlist.ast, tenantId);
    matchedPosts = deduplicatePosts([...matchedPosts, ...additionalMatches]);
  }

  return matchedPosts;
}
```

---

## 5. Interface & API Contracts

### 5.1 Connector Details
- **Provider ID:** `bing-search`
- **Supported Endpoints:** `/v7.0/news/search`, `/v7.0/search`
- **Default Strategy:** `auto` (News first, Web fallback)
- **Auth Header:** `Ocp-Apim-Subscription-Key`

---

## 6. Security, Tenancy & Isolation Model
- **Tenant Credential Isolation:** Stored in Key Vault, bound to `tenant_id`. No sharing across tenants.
- **SSRF Prevention:** Validates hostnames against standard public DNS resolution prior to redirect following.

---

## 7. Performance, Scalability & Resource Caps
- **Request Pacing:** Rate-limited to max 3 queries per second per tenant to respect Azure S1/S2 transaction limits.
- **Candidate Processing Budget:** Max 50 candidates evaluated in-process per watchlist tick, completing in $< 10\text{ms}$.

---

## 8. Resilience, Recovery & Failure Semantics
- **Endpoint Fallback:** If `/v7.0/news/search` encounters a 5xx error, the connector automatically degrades to `/v7.0/search` for that tick.

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `bing_search_queries_total{endpoint: 'news' | 'web'}`
  - `bing_search_fallback_invocations_total`
  - `bing_search_candidates_discarded_ast_total`
  - `bing_search_estimated_cost_usd{tenant_id}`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Rollout:** Registered alongside `brave-search` in `connectorRegistry.ts`. Both can operate simultaneously or independently per tenant preference.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-2/story-2.22.bing-search-connector.contract.test.ts`:
  - (1) Verifies deterministic fallback from News to Web when results $< 5$.
  - (2) Proves URL canonicalizer strips `utm_*` and `fbclid` query params.
  - (3) Verifies author normalization to publication base domain.
  - (4) Asserts junction rows populated in `post_watchlist_matches`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0066-1]** **Bing Grounding LLM Extension:** Evaluating Microsoft Copilot / Bing Chat Grounding API extensions for real-time fact checking.
- [ ] **[Q-0066-2]** **Market Localization Auto-Detection:** Inferring `mkt` search parameters dynamically from watchlist language metadata.
- [ ] **[Q-0066-3]** **Trending Topics Ingestion:** Evaluating `/v7.0/news/trendingtopics` as an optional discovery feed for broad brand crisis detection.
