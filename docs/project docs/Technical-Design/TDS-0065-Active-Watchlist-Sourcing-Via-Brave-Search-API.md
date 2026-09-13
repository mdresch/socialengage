# Technical Design Specification (TDS) — Active Watchlist Sourcing via Brave Search API

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0065: Active Watchlist Sourcing via Brave Search API — Polling Ingestion, Candidate AST Filtering & Grounding |
| **Document ID** | `TDS-0065` |
| **Feature Name** | Brave Search Ingestion Connector, Proactive Watchlist Querying & AI Grounding |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/ingestion-connectors/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0065` | [ADR-0065: Active Watchlist Sourcing via Brave Search API](../../adr/0065-active-watchlist-sourcing-via-brave-search-api.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0065` | [BRD-0065: Active Watchlist Sourcing Via Brave Search API](../Business-Requirements/BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0065` | [FDD-0065: Active Watchlist Sourcing Via Brave Search API](../Functional-Design/FDD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md) | Fully Aligned |
| **Governing User Story** | `Story 2.21` | [Epic 2: Ingestion Connectors](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-221--active-watchlist-sourcing-via-brave-search-api-polling-connector-query-transformation-and-junction-linking) | Acceptance Target |
| **Related User Stories** | `Story 6.28`, `Story 2.22` | Brave Search UI Config, Bing Search Sourcing | Sibling Modules |
| **Related Architecture Decisions** | `ADR-0004`, `ADR-0005`, `ADR-0006`, `ADR-0021`, `ADR-0028`, `ADR-0063`, `ADR-0066` | Author Normalization, Deduplication, Watchlist AST, Tier-2 Creds, Match Junction | System Architecture |
| **Executable Contract Tests** | `Story 2.21 Contract` | `social-listening-core/contracts/epic-2/story-2.21.brave-search-connector.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Scheduler["Live Ingestion Scheduler"]
        Tick["Cron Tick (1-4 Hour Pacing Loop)"]
        ActiveWatchlists["Fetch Tenant Active Watchlists"]
    end

    subgraph BraveConnector["brave-search Ingestion Connector"]
        QueryBuilder["Watchlist AST / Keyword to Brave Query Formatter"]
        PacingDelay["1.2s Rate Pacing Guard (1 req/sec limit)"]
        BraveClient["HTTP Client (/res/v1/news/search or /web/search)"]
        ASTValidator["In-Process AST Re-Validation (matchesAst / matchesWatchlist)"]
        Normalizer["SocialPost & Author Domain Mapper"]
    end

    subgraph ExternalAPI["Brave Search API"]
        BraveAPI["https://api.search.brave.com"]
    end

    subgraph Storage["PostgreSQL (Tenant Isolated)"]
        Posts["social_posts (provider_id = 'brave-search')"]
        Junction["post_watchlist_matches (post_id, watchlist_id)"]
    end

    subgraph AI["Enrichment & Grounding Pipeline"]
        LLMGrounding["AzureOpenAiConnector Grounding Pass"]
    end

    Tick --> ActiveWatchlists
    ActiveWatchlists --> QueryBuilder
    QueryBuilder --> PacingDelay
    PacingDelay --> BraveClient
    BraveClient -->|X-Subscription-Token| BraveAPI
    BraveAPI -->> BraveClient: JSON Results (Title, URL, Snippet, PublishedAt)
    BraveClient --> ASTValidator
    ASTValidator -->|Passed AST Filter| Normalizer
    Normalizer --> Posts
    Normalizer --> Junction
    Posts --> LLMGrounding
```

### 2.2 Architectural Boundaries & Invariants
- **Dual Discovery & AST Invariant:** Brave Search performs coarse discovery via `/res/v1/news/search` (or `/web/search`). Every candidate snippet returned **must** be re-evaluated against the triggering watchlist's exact boolean AST (`matchesAst()`). Candidates failing strict AST match are discarded prior to persistence, ensuring identical precision to passive feeds.
- **Publication Domain as Author (ADR-0004 Generalization):** Because search engine results represent web pages rather than social handles, the source domain serves as the canonical Author entity:
  - `author.id = "brave-search:" + domain`
  - `author.username = domain` (e.g., `techcrunch.com`)
  - `author.displayName = sourceName || domain`
  - `author.platform = 'brave-search'`
- **Deduplication Key:** `externalId` is set to the canonicalized destination URL. Persistence enforces `(tenant_id, provider_id, external_id)` uniqueness.
- **Pacing & Rate Invariants:** Requests across watchlists are paced with a minimum **1.2-second sleep** between queries, strictly honoring Brave's 1 req/sec free-tier ceiling. Polling interval defaults to 1–4 hours.
- **Tier-2 Credential Ownership:** The `X-Subscription-Token` is stored in `platform_credentials` under `owner_type = 'tenant'` (ADR-0028).

---

## 3. Data Architecture & Persistence Design

### 3.1 Normalization Mapping
| Brave Search JSON Field | `SocialPostSummary` Field | Normalization Transformation |
|---|---|---|
| `url` | `externalId`, `url` | Canonicalized URL (strip tracking params `utm_*`, `ref`) |
| `title` | `title` | Normalized title string |
| `description` | `bodyMarkdown` | Snippet markdown representation |
| `page_age` / `published` | `publishedAt` | Parsed ISO date, defaults to `now()` if missing |
| `source` / `domain` | `author` | Normalized author entity (`brave-search:domain`) |
| `language` | `enrichment.detectedLanguage` | Initial hint, validated during AI enrichment |

### 3.2 Post-Watchlist Junction Linking
```sql
INSERT INTO post_watchlist_matches (tenant_id, post_id, watchlist_id)
VALUES ($1, $2, $3)
ON CONFLICT (tenant_id, post_id, watchlist_id) DO NOTHING;
```

---

## 4. Application Logic & Workflows

### 4.1 Ingestion Execution Loop
```typescript
export async function runBraveSearchIngestion(
  tenantId: string,
  credentials: BraveCredentials,
  watchlists: Watchlist[],
  client: BraveSearchClient
): Promise<IngestionRunResult> {
  const postsToIngest: NormalizedPost[] = [];
  const junctionLinks: { postId: string; watchlistId: string }[] = [];

  for (const wl of watchlists) {
    const query = formatWatchlistToBraveQuery(wl);
    const response = await client.searchNews(query, { freshness: 'pd', count: 20 });
    
    for (const result of response.results) {
      // Strict AST verification
      const candidateText = `${result.title} ${result.description}`;
      if (!matchesWatchlistAst(wl.ast, candidateText)) {
        continue;
      }

      const post = mapBraveResultToPost(tenantId, result);
      postsToIngest.push(post);
      junctionLinks.push({ postId: post.id, watchlistId: wl.id });
    }

    // Rate pacing delay
    await sleep(1200);
  }

  await persistPostsAndJunctions(tenantId, postsToIngest, junctionLinks);
  return { ingestedCount: postsToIngest.length };
}
```

---

## 5. Interface & API Contracts

### 5.1 Connector Registration Details
- **Provider ID:** `brave-search`
- **Ownership Tier:** Tier-2 (Tenant-Admin owned)
- **Credential Auth Header:** `X-Subscription-Token`
- **Supported Watchlist Types:** `keyword`, `hashtag`, `boolean_query`

---

## 6. Security, Tenancy & Isolation Model
- **No Shared Keys:** Brave subscription tokens are tenant-scoped; no cross-tenant query blending is permitted.
- **SSRF Hardening:** Destination URLs returned by Brave Search are validated before any internal link unwrapping.

---

## 7. Performance, Scalability & Resource Caps
- **Batch Ceiling:** Max 25 results requested per watchlist per cycle.
- **Lookback Bounds:** Freshness query bounded to `pd` (past day) or `pw` (past week) to avoid redundant older result fetches.

---

## 8. Resilience, Recovery & Failure Semantics
- **Graceful Quota Handling:** If Brave returns HTTP 429 (`Too Many Requests`), the connector logs a classified error, trips circuit breaker for current tick, and resumes on next scheduled interval without failing overall system health.

---

## 9. Observability, Telemetry & Auditability
- **Metrics:**
  - `brave_search_queries_total{tenant_id}`
  - `brave_search_candidates_evaluated_total`
  - `brave_search_ast_matches_retained_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Compatibility:** Additive connector registration in `connectorRegistry.ts`. Disabling the connector halts active search polling without affecting past ingested posts.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test:** `social-listening-core/contracts/epic-2/story-2.21.brave-search-connector.contract.test.ts`:
  - (1) Confirms query generation across keyword and boolean watchlists.
  - (2) Proves AST validator filters out false-positive broad match candidates.
  - (3) Verifies author normalization to publication domain.
  - (4) Asserts junction rows populated in `post_watchlist_matches`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0065-1]** **Full-Article Scraping Feasibility:** Assessing whether high-relevance Brave search results should trigger an asynchronous full-text web fetch.
- [ ] **[Q-0065-2]** **LLM Grounding Prompt Tuning:** Optimizing the prompt instructions passed to `AzureOpenAiConnector` for post relevance justification.
- [ ] **[Q-0065-3]** **Dynamic Freshness Windowing:** Automatically adjusting the `freshness` parameter based on watchlist update frequency.
