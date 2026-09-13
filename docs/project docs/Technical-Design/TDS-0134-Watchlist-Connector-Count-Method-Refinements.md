# TDS-0134: Watchlist Connector Count Method Refinements — UI Confidence Contract & Cost Projections

**Status:** Approved  
**Date:** 2026-09-05  
**Governing ADR:** [ADR-0134](../../adr/0134-watchlist-connector-count-method-refinements.md)  
**Related Epics/Stories:** [Epic 18 / Story 18.1](../../user-stories/epic-18-adr-0134-to-0135.md#story-181), [Epic 9 / Story 9.1](../../user-stories/epic-9-adr-0077-to-0085.md#story-91--watchlist-connector-count-and-preview-volume-endpoint)  
**Target Repositories:** `social-listening-core`, `social-listening-admin`  
**Contract Test Citations:**  
- `social-listening-core/contracts/epic-18/story-18.1.watchlist-volume-confidence-and-cost.contract.test.ts`  
- `social-listening-admin/contracts/epic-18/story-18.1.volume-confidence-ui.contract.test.ts`  

---

## 1. Architectural Context & Problem Statement

While ADR-0077 established the core `SocialConnector.count?()` method and `POST /v1/watchlists/preview-volume` endpoint, cross-industry benchmarking against leading enterprise ad platforms (Meta Ads Manager, Google Ads Reach Planner, X API v2 Tweet Counts, and AWS Pricing Calculator) revealed two critical usability and operational gaps:
1. **Ambiguous UI Uncertainty Representation:** In the initial UI, exact counts and statistical estimates were rendered identically (e.g. displaying raw integers like `45,000` without qualification). Users assumed estimates were deterministic commitments, leading to mistrust when real-world ingestion varied.
2. **Missing Downstream Financial Modeling:** Knowing estimated raw post volume is helpful, but tenant decision-makers (`Tenant-Admin`, `Tenant-Executive`) actually need to know the *financial impact*: "How much database storage will this ingest?" and "How many Azure OpenAI enrichment calls will this consume per month?"

This specification formalizes the targeted refinements authorized by ADR-0134:
1. **Explicit UI Confidence Display Contract:** Strict rendering rules in `social-listening-admin` distinguishing exact values from estimated ranges (`~45,000 (estimated)` vs `12,340`).
2. **Additive `estimatedCost` Projection Block:** Downstream infrastructure modeling computing monthly storage growth (GB) and AI enrichment call projections.
3. **Pessimistic Confidence Inheritance:** The aggregate `estimatedCost.confidence` degrades to the lowest confidence level present across any queried connector.
4. **Documented Connector Implementation Priority Order:** Prioritizing native total-hit count implementations (Tier 1) over sample-and-extrapolate platforms (Tier 2).

```mermaid
flowchart TD
    subgraph UI ["social-listening-admin (Story 18.1)"]
        Builder["Watchlist Builder UI"] --> PreviewTrigger["Trigger Preview"]
        PreviewTrigger -->|POST /v1/watchlists/preview-volume| BFF["BFF Proxy"]
        
        BFF --> RenderPanel["VolumePreviewPanel / ConnectorVolumeRow"]
        RenderPanel --> CheckConf{"confidence === 'exact'?"}
        CheckConf -->|Yes| RenderExact["Render Exact: '12,340'"]
        CheckConf -->|No (estimate)| RenderTilde["Render Estimate: '~45,000 (estimated)'"]
        CheckConf -->|No (unavailable)| RenderWarn["Render Alert: 'Unavailable (Error/Quota)'"]
        
        RenderPanel --> RenderCost["Render Estimated Cost Card: Storage (GB/mo) & AI Calls/mo"]
    end

    subgraph Core ["social-listening-core (Story 18.1)"]
        BFF --> Router["watchlistsRouter.ts"]
        Router --> Service["previewVolumeService.ts"]
        
        Service --> BasePreview["Execute Baseline ADR-0077 Previews"]
        BasePreview --> ConnectorBreakdown["Compile ConnectorVolumeItem[]"]
        
        ConnectorBreakdown --> CostEngine["Calculate estimatedCost Projection"]
        CostEngine --> MultStorage["Compute Storage GB: totalPosts * 0.001 GB"]
        CostEngine --> MultAI["Compute AI Calls: totalPosts * 1.0"]
        
        ConnectorBreakdown --> ResolveConf["Resolve Cost Confidence (Pessimistic Min)"]
        ResolveConf --> InheritRule{"Any connector unavailable or estimate?"}
        InheritRule -->|Any Unavailable| CostUnavail["estimatedCost.confidence = 'unavailable'"]
        InheritRule -->|Any Estimate| CostEst["estimatedCost.confidence = 'estimate'"]
        InheritRule -->|All Exact| CostExact["estimatedCost.confidence = 'exact'"]
        
        CostEngine --> AttachCost["Attach optional estimatedCost block"]
        AttachCost --> JsonResp["Return Enhanced WatchlistVolumePreview JSON"]
    end
```

---

## 2. Governing ADRs & Decision Log Reference

- [ADR-0134: Watchlist connector count and preview endpoint — refinements](../../adr/0134-watchlist-connector-count-method-refinements.md) — Authorizes UI confidence contract, connector priority order, and additive `estimatedCost` block.
- [ADR-0077: Watchlist connector count and preview endpoint](../../adr/0077-watchlist-connector-count-method.md) — Baseline foundation carried forward unmodified.
- [ADR-0038: AI Enrichment Provider Selection](../../adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md) — Governs downstream Azure AI Language / OpenAI calls factored into cost estimates.
- [ADR-0101: Multi-Source Connector Capability Matrix](../../adr/0101-multi-source-connector-capability-matrix.md) — Connector capability metadata and `count` support indicators.

---

## 3. Data Architecture & Persistence Design

### 3.1 Financial Modeling Multipliers
The cost projection engine computes downstream impact without database schema changes:
1. **Raw + Enriched Post Footprint:** Average storage footprint per post (including normalized body, author profile, AI aspect sentiment, and topic tags) is parameterized at **$1.0\text{ KB}$** ($0.000001\text{ GB}$). Monthly projection over 30 days based on window arrival rate:
   $$\text{storageGbPerMonth} = \frac{\text{monthlyEstimatedPosts} \times 1.0\text{ KB}}{1,048,576\text{ KB/GB}}$$
2. **AI Enrichment Invocations:** Every matched post queued for standard processing undergoes single-pass sentiment and topic enrichment:
   $$\text{aiEnrichmentCallsPerMonth} = \text{monthlyEstimatedPosts} \times 1.0$$
3. **Monthly Normalization Factor:**
   If the user requested a time window $\Delta t_{window}$ (in days), the 30-day projection scales linearly:
   $$\text{monthlyEstimatedPosts} = \text{Math.round}\left(\text{totalEstimatedPosts} \times \frac{30}{\Delta t_{window,\text{days}}}\right)$$

### 3.2 Confidence Inheritance Lattice
Cost confidence follows a strict weakest-link lattice rule:
$$\text{Confidence}_{\text{cost}} = \min_{c \in \text{breakdown}}(\text{Confidence}_c)$$
where $\text{unavailable} < \text{estimate} < \text{exact}$.
If even a single connector fails or returns `unavailable`, the system refuses to project a misleadingly low cost, marking `estimatedCost.confidence = 'unavailable'`.

---

## 4. API, Interface & Contract Design

### 4.1 Extended `WatchlistVolumePreview` Type Contract
In `social-listening-core/src/watchlists/previewVolumeService.ts`:

```typescript
export interface EstimatedCostProjection {
  storageGbPerMonth: number;
  aiEnrichmentCallsPerMonth: number;
  currency: 'USD';
  confidence: 'exact' | 'estimate' | 'unavailable';
}

export interface WatchlistVolumePreview {
  totalEstimatedPosts: number;
  breakdown: ConnectorVolumeItem[];
  estimatedCost?: EstimatedCostProjection; // Additive refinement
}
```

### 4.2 HTTP REST Contract: Extended Response (200 OK)
```json
{
  "totalEstimatedPosts": 12450,
  "breakdown": [
    {
      "connectorId": "conn-gnews-01",
      "platformId": "gnews",
      "estimatedPosts": 450,
      "confidence": "exact",
      "sampleSize": 450,
      "rateLimitCost": 1,
      "warning": "none"
    },
    {
      "connectorId": "conn-fb-02",
      "platformId": "facebook",
      "estimatedPosts": 12000,
      "confidence": "estimate",
      "sampleSize": 50,
      "rateLimitCost": 1,
      "warning": "none"
    }
  ],
  "estimatedCost": {
    "storageGbPerMonth": 0.52,
    "aiEnrichmentCallsPerMonth": 53357,
    "currency": "USD",
    "confidence": "estimate"
  }
}
```

### 4.3 UI Confidence Display Contract
In `social-listening-admin/src/components/watchlists/VolumePreviewPanel.tsx`:

| Confidence State | UI Display Format | Visual Styling | Tooltip / Explanatory Text |
|---|---|---|---|
| `exact` | `"12,340"` | Solid font (`text-foreground`), green check icon | "Exact match count verified via provider API total-results." |
| `estimate` | `"~45,000 (estimated)"` | Muted italic (`text-muted-foreground`), tilde prefix | "Estimated based on statistical arrival rate of 50-post sample." |
| `unavailable` | `"Unavailable"` | Destructive badge (`text-destructive`), warning icon | Displays `errorMessage` or "Rate limit quota risk detected." |

---

## 5. Rate Limiting & Concurrency Gating

- **Zero Additional API Calls:** The cost projection logic is purely computational and introduces zero additional network calls or rate-limit consumption.
- **Inherited Budget Gating:** Inherits all ADR-0077 `RequestGate` pre-checks. If a connector is skipped due to rate-limit exhaustion, it triggers the pessimistic inheritance rule, cleanly setting `estimatedCost.confidence = 'unavailable'`.

---

## 6. Security, Identity & Multi-Tenant Governance

- **Tenant Quota Isolation:** Cost multipliers can be overridden per tenant plan tier (e.g. Enterprise tenants with dedicated AI provisioned throughput vs Standard multi-tenant tiers).
- **No Data Leakage:** Cost projections expose aggregate metrics only; no internal infrastructure details or underlying unit pricing contracts are leaked to unauthorized roles.

---

## 7. Error Handling & Degradation Resilience

1. **Non-Breaking Optionality:** The `estimatedCost` field is optional. If calculation fails or cost multiplier configuration is missing, the backend omits the field, allowing the UI to render the volume breakdown without error.
2. **Partial Connector Failure Handling:** When a connector returns `confidence: 'unavailable'` due to timeout or network failure, `estimatedCost` is still included with values set to `0` and `confidence: 'unavailable'`, informing the user why cost cannot be reliably projected.

---

## 8. Testing & Contract Gate Plan

### 8.1 Backend Contract Tests
- **Location:** `social-listening-core/contracts/epic-18/story-18.1.watchlist-volume-confidence-and-cost.contract.test.ts`
- **Verification Matrix:**
  - Cost calculations correctly compute storage GB and AI call multipliers.
  - Pessimistic confidence inheritance: exact + exact $\to$ exact; exact + estimate $\to$ estimate; exact + unavailable $\to$ unavailable.
  - Absence of breaking changes for clients ignoring `estimatedCost`.

### 8.2 Frontend Component Tests
- **Location:** `social-listening-admin/contracts/epic-18/story-18.1.volume-confidence-ui.contract.test.ts`
- **Verification Matrix:**
  - Formats numbers with commas and tilde prefix when `confidence === 'estimate'`.
  - Suppresses tilde and displays clean integer when `confidence === 'exact'`.
  - Renders cost estimation card with storage GB and AI enrichment counts.

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

- **`social-listening-core/.claude/skills/watchlist-matching/SKILL.md`:** Document the cost projection math, confidence inheritance lattice, and implementation priority order.
- **`social-listening-admin/.claude/skills/admin-ui-components/SKILL.md`:** Document the `VolumePreviewPanel` visual formatting contract and confidence badge styling tokens.

---

## 10. Observability, Metrics & Telemetry

- **Prometheus Counters:**
  - `watchlist_preview_cost_projected_total{confidence="exact|estimate|unavailable"}`: Tracks distribution of cost confidence evaluations.
  - `watchlist_preview_high_cost_warnings_total`: Count of previews exceeding enterprise budget warning thresholds.

---

## 11. Migration, Rollout & Feature Gating

- **Zero-Downtime Deployment:** Fully backward-compatible additive changes.
- **Feature Flag:** `features.watchlist_cost_projections` toggles cost card display in the frontend.

---

## 12. Technical Assumptions, Dependencies & Open Questions

- **[Q-0134-1] Cost Multiplier Source:** Per-post multipliers default to global system standards ($1.0\text{ KB/post}$, $1\text{ AI call/post}$) with tenant tier overrides managed via configuration.
- **[Q-0134-2] Currency Localization:** Fixed to `USD` in v1; multi-currency conversions deferred to future enterprise billing epics.
