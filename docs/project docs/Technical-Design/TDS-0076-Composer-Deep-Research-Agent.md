# Technical Design Specification (TDS) — Composer Deep Research Agent

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0076: Composer Deep Research Agent — Draft Context Extraction, Search Sourcing & Synthesis Engine |
| **Document ID** | `TDS-0076` |
| **Feature Name** | Polypost Composer Deep Research Assistant & Multi-Search Synthesis |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/composer/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0076` | [ADR-0076: Composer Deep Research Agent](../../adr/0076-composer-deep-research-agent.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0076` | [BRD-0076: Composer Deep Research Agent](../Business-Requirements/BRD-0076-Composer-Deep-Research-Agent.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0076` | [FDD-0076: Composer Deep Research Agent](../Functional-Design/FDD-0076-Composer-Deep-Research-Agent.md) | Fully Aligned |
| **Governing User Story** | `Story 3.17` | [Epic 3: Data Model & Storage](../../user-stories/epic-3-data-model-storage-and-archival.md#story-317--composer-deep-research-rest-endpoint) | Acceptance Target |
| **Related User Stories** | `Story 2.31`, `Story 2.32`, `Story 6.41`, `Story 14.4` | Search Helpers, LLM Capability, Composer UI Panel, Research Caching | Implementation Group |
| **Related Architecture Decisions** | `ADR-0027`, `ADR-0028`, `ADR-0038`, `ADR-0065`, `ADR-0066`, `ADR-0120`, `ADR-0121` | Technical Intermediary, Tier-2 Creds, Azure OpenAI, Search Connectors, Caching | System Architecture |
| **Executable Contract Tests** | `Story 2.31, 2.32, 3.17 & 6.41 Contracts` | `social-listening-core/contracts/epic-2/story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts`<br>`social-listening-core/contracts/epic-2/story-2.32.azure-openai-research-capability.contract.test.ts`<br>`social-listening-core/contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts`<br>`social-listening-admin/contracts/epic-6/story-6.41.composer-deep-research-panel-ui.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph UI["social-listening-admin (Polypost Composer)"]
        Author["Author Drafting Post"]
        ComposerToolbar["Deep Research Button"]
        DeepResearchPanel["Collapsible Research Panel (Summary & Comparison)"]
        BFFProxy["/api/composer/research (Same-Origin Proxy)"]
    end

    subgraph CoreService["social-listening-core"]
        Endpoint["POST /v1/composer/research"]
        Gate["RequestGate: (tenantId, providerId, 'research')"]
        Orchestrator["DeepResearchOrchestrator"]
    end

    subgraph UpstreamServices["Tenant Connected Services (Tier-2 Creds)"]
        LLMExtractor["Azure OpenAI (Key Phrases & Query Gen)"]
        SearchEngines["Brave Search & Bing Search APIs (Snippets)"]
        LLMSynthesizer["Azure OpenAI (Context & Comparison Synthesis)"]
    end

    Author --> ComposerToolbar
    ComposerToolbar --> BFFProxy
    BFFProxy --> Endpoint
    Endpoint --> Gate
    Gate --> Orchestrator

    Orchestrator -->|1. Extract Phrases & Queries| LLMExtractor
    LLMExtractor -->> Orchestrator: Key Phrases + Queries
    Orchestrator -->|2. Parallel Search Dispatch| SearchEngines
    SearchEngines -->> Orchestrator: Snippets & Citations
    Orchestrator -->|3. Synthesize Context & Compare| LLMSynthesizer
    LLMSynthesizer -->> Orchestrator: Summary + Gap Analysis
    Orchestrator -->> Endpoint: ComposerResearchResult
    Endpoint -->> BFFProxy: JSON Result
    BFFProxy -->> DeepResearchPanel: Render UI
```

### 2.2 Architectural Boundaries & Invariants
- **Multi-Step Orchestration Pipeline:** Deep research executes a deterministic four-phase pipeline:
  1. Phrase & Query Extraction: LLM generates key phrases and up to 3 targeted search queries from post text.
  2. One-Off Search Dispatch: Dispatches queries across tenant's active search connectors (Brave/Bing), bounding results to top `maxSearchResultsPerQuery` (default 5, hard ceiling 10).
  3. Grounding & Synthesis: LLM ingests post text + retrieved snippets to generate an external context summary.
  4. Comparison & Gap Analysis: LLM generates an author-facing comparison highlighting angles covered, missing perspectives, and assertions requiring factual verification.
- **Strict Tier-2 Direct Billing:** Search and LLM operations consume the tenant's own credentials. If neither search provider is active, returns HTTP 422 (`SEARCH_PROVIDER_UNAVAILABLE`). If only dedicated NLP (Azure AI Language) is configured without an LLM connector, returns HTTP 422 (`AI_PROVIDER_NOT_CAPABLE`).
- **Research Rate Gate Isolation:** All research requests acquire slots against a dedicated `RequestGate` bucket keyed on `(tenant_id, provider_id, 'research')`. Research bursts never compete with or starve social listening ingestion queues (`poll`).
- **Ephemeral Synchronous Execution (v1):** The endpoint runs synchronously within a single HTTP transaction. Request payload text is capped at 5,000 characters.

---

## 3. Data Architecture & Persistence Design

### 3.1 TypeScript Contracts & Payload Definitions
`social-listening-core/src/composer/researchTypes.ts`:
```typescript
export interface ComposerResearchRequest {
  text: string;
  targetPlatforms?: string[];
  maxSearchResultsPerQuery?: number; // default 5, max 10
}

export interface ResearchSourceItem {
  title: string;
  url: string;
  snippet: string;
  provider: 'brave-search' | 'bing-search';
}

export interface ComposerResearchResult {
  keyPhrases: string[];
  relatedTopics: string[];
  searchQueries: string[];
  sources: ResearchSourceItem[];
  contextSummary: string;
  comparison: string;
  completedAt: string;
}
```

---

## 4. Application Logic & Workflows

### 4.1 Pipeline Orchestration Flow
```typescript
export async function executeComposerResearch(
  tenantId: string,
  request: ComposerResearchRequest,
  aiConnector: AIProviderConnector,
  searchConnectors: SearchProviderConnector[],
  gate: RequestGate
): Promise<ComposerResearchResult> {
  // 1. Validate providers
  if (!aiConnector.research) {
    throw new ClassifiableError('AI_PROVIDER_NOT_CAPABLE', 'Active AI provider cannot perform generative research.');
  }
  if (searchConnectors.length === 0) {
    throw new ClassifiableError('SEARCH_PROVIDER_UNAVAILABLE', 'No search connectors configured for tenant.');
  }

  // 2. Extract phrases & queries
  await gate.acquire(`${tenantId}:${aiConnector.providerId}:research`);
  const extraction = await aiConnector.extractResearchQueries(request.text);

  // 3. Search dispatch
  const sources: ResearchSourceItem[] = [];
  const limit = Math.min(request.maxSearchResultsPerQuery || 5, 10);

  for (const q of extraction.searchQueries.slice(0, 3)) {
    const searchConn = searchConnectors[0];
    await gate.acquire(`${tenantId}:${searchConn.providerId}:research`);
    const searchRes = await searchConn.search!({ tenantId }, { q, limit });
    
    for (const item of searchRes.results) {
      sources.push({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        provider: searchConn.providerId as 'brave-search' | 'bing-search',
      });
    }
  }

  // 4. Synthesis & Comparison
  const synthesis = await aiConnector.research(request.text, sources, {
    keyPhrases: extraction.keyPhrases,
    relatedTopics: extraction.relatedTopics,
  });

  return {
    keyPhrases: extraction.keyPhrases,
    relatedTopics: extraction.relatedTopics,
    searchQueries: extraction.searchQueries,
    sources,
    contextSummary: synthesis.contextSummary,
    comparison: synthesis.comparison,
    completedAt: new Date().toISOString(),
  };
}
```

---

## 5. Interface & API Contracts

### 5.1 Route Catalog
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/v1/composer/research` | Tenant-User, Tenant-Admin | Executes synchronous deep research pipeline on draft post text |

### 5.2 Research Contract (`POST /v1/composer/research`)
**Request Body:**
```json
{
  "text": "Announcing our new automated cloud compliance auditor with continuous Merkle tree verification.",
  "targetPlatforms": ["linkedin", "twitter"],
  "maxSearchResultsPerQuery": 5
}
```

**Response (200 OK):**
```json
{
  "keyPhrases": ["cloud compliance", "Merkle tree", "continuous audit"],
  "relatedTopics": ["SOC 2 Automation", "Cryptographic Ledgers", "Regulatory Technology"],
  "searchQueries": [
    "automated cloud compliance audit Merkle tree",
    "SOC 2 continuous cryptographic ledger"
  ],
  "sources": [
    {
      "title": "Continuous Compliance in 2026",
      "url": "https://techchronicle.io/compliance-ledgers",
      "snippet": "New frameworks mandate tamper-evident Merkle hash logging for all privileged actions...",
      "provider": "brave-search"
    }
  ],
  "contextSummary": "Public discussion emphasizes that regulators increasingly demand tamper-evident cryptographic proofs...",
  "comparison": "Your post highlights automation and Merkle trees, aligning well with industry trends. Consider addressing multi-cloud support.",
  "completedAt": "2026-09-05T15:50:00.000Z"
}
```

### 5.3 Error Code Catalog
| HTTP Code | Error Code | Circumstance |
|---|---|---|
| `422` | `SEARCH_PROVIDER_UNAVAILABLE` | Neither Brave nor Bing connector is activated for tenant |
| `422` | `AI_PROVIDER_NOT_CAPABLE` | Tenant only has Azure AI Language; lacks generative LLM connector |
| `413` | `RESEARCH_TOO_LARGE` | Input draft text exceeds 5,000 characters |
| `429` | `RATE_LIMITED` | Research request gate quota exceeded |

---

## 6. Security, Tenancy & Isolation Model
- **Zero Content Storage:** Draft post text passed to `/v1/composer/research` is processed ephemerally in memory; it is not persisted in database tables in v1.
- **Tenant Context Isolation:** Credentials and search execution occur strictly inside `withTenant()` context.
- **Platform-Admin Access Rejection:** Requests carrying `platform_admin` credentials receive HTTP 403, honoring the zero-tenant-content boundary (ADR-0030).

---

## 7. Performance, Scalability & Resource Caps
- **Execution Deadline:** Total end-to-end orchestration pipeline enforces a 15-second timeout.
- **Parallel Search Execution:** Web search queries execute concurrently via `Promise.all()` to minimize total round-trip latency.

---

## 8. Resilience, Recovery & Failure Semantics
- **Partial Search Degradation:** If one search query returns a timeout, the pipeline continues synthesis with results from remaining queries rather than aborting.

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `composer_research_requests_total{tenant_id}`
  - `composer_research_duration_ms`
  - `composer_research_snippets_retrieved_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Rollout:** Additive REST endpoint. Disabling the feature toggle in `tenant_settings` hides the Deep Research button in the UI.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:**
  - `social-listening-core/contracts/epic-2/story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts`
  - `social-listening-core/contracts/epic-2/story-2.32.azure-openai-research-capability.contract.test.ts`
  - `social-listening-core/contracts/epic-3/story-3.17.composer-deep-research.contract.test.ts`:
    - (1) Validates multi-step pipeline execution and response schema.
    - (2) Proves rejection when search connector is inactive (422).
    - (3) Proves isolation under research `RequestGate`.
  - `social-listening-admin/contracts/epic-6/story-6.41.composer-deep-research-panel-ui.contract.test.ts`:
    - Tests UI panel toggle, state handling, and citation links.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0076-1]** **Asynchronous Job Streaming:** Supporting Server-Sent Events (SSE) for incremental streaming of search snippets and synthesis.
- [ ] **[Q-0076-2]** **Generalized Search Provider Contract:** Refactoring internal search helpers into `SearchProviderConnector` (addressed in ADR-0120).
- [ ] **[Q-0076-3]** **Persistent Research Caching:** Adding hash-based caching to avoid redundant re-runs on minor draft edits (addressed in ADR-0121).
