# TDS-0077: Watchlist Connector Count and Preview Volume Endpoint

**Status:** Approved  
**Date:** 2026-09-05  
**Governing ADR:** [ADR-0077](../../adr/0077-watchlist-connector-count-method.md)  
**Related Epics/Stories:** [Epic 9 / Story 9.1](../../user-stories/epic-9-adr-0077-to-0085.md#story-91--watchlist-connector-count-and-preview-volume-endpoint), [Epic 18 / Story 18.1](../../user-stories/epic-18-adr-0134-to-0135.md#story-181)  
**Target Repositories:** `social-listening-core`  
**Contract Test Citations:**  
- `social-listening-core/contracts/epic-9/story-9.1.watchlist-preview-volume.contract.test.ts`  

---

## 1. Architectural Context & Problem Statement

When brand reputation managers (`Tenant-Brand-Reputation-Manager`) or tenant administrators (`Tenant-Admin`) configure complex boolean query watchlists across diverse social platforms, they face severe operational risks before activating real-time ingestion:
1. **Runaway Quota Consumption:** Broad or malformed queries (e.g. searching generic terms without negation or specific qualifiers) can immediately exhaust daily API rate limits and token buckets on rate-constrained connectors.
2. **Storage and Enrichment Cost Spikes:** Ingesting tens of thousands of unintended matching posts incurs immediate downstream storage, embedding, and LLM sentiment/clustering enrichment costs.
3. **Connector Capability Heterogeneity:** Upstream provider APIs differ radically: some support native total-hit count endpoints (e.g. GNews, Newswire, Brave/Bing Search), while others only support paginated streams (e.g. Facebook, Instagram, LinkedIn).

To prevent blind activation, this specification formalizes the **Watchlist Volume Preview Engine**:
- An optional `count?()` method on `SocialConnector` for platforms with cheap native count primitives.
- A deterministic 50-post sample-and-extrapolation fallback for connectors lacking native count endpoints.
- A tenant-scoped, RLS-gated endpoint (`POST /v1/watchlists/preview-volume`) executing concurrent connector previews with partial failure isolation and proactive operational warnings (`high_volume`, `quota_risk`, `unsupported_query`).

```mermaid
flowchart TD
    subgraph Client ["Client / Admin UI (Story 9.1 / 18.1)"]
        UI["Watchlist Builder / Preview Trigger"] -->|POST /v1/watchlists/preview-volume| BFF["BFF API Router"]
    end

    subgraph Core ["social-listening-core"]
        BFF --> Router["watchlistsRouter.ts"]
        Router --> Auth["Tenant Bearer Auth & RLS Context"]
        Auth --> Service["previewVolumeService.ts"]
        
        Service --> PreCheck["RequestGate.checkAvailability()"]
        PreCheck -->|Budget OK| Dispatch["Concurrent Connector Dispatch"]
        PreCheck -->|Exceeds 80% Budget| QuotaRisk["Tag warning: quota_risk"]
        
        Dispatch --> C1["GNewsConnector.count?()"]
        Dispatch --> C2["FacebookConnector (No count?())"]
        Dispatch --> C3["FailingConnector (Network Error)"]
        
        C1 -->|Native totalArticles| ExactRes["Confidence: exact"]
        C2 -->|sample() fallback (50 posts)| Extrapolate["Extrapolate Cadence -> Confidence: estimate"]
        C3 -->|Error Catch| PartialIso["Confidence: unavailable (Isolated Error)"]
        
        ExactRes --> Aggregate["Aggregate WatchlistVolumePreview"]
        Extrapolate --> Aggregate
        PartialIso --> Aggregate
        QuotaRisk --> Aggregate
        
        Aggregate --> Response["200 OK Response (totalEstimatedPosts + breakdown)"]
    end
```

---

## 2. Governing ADRs & Decision Log Reference

- [ADR-0077: Watchlist connector count and preview endpoint](../../adr/0077-watchlist-connector-count-method.md) — Authorizes `SocialConnector.count?()`, `sample?()`, the 50-post fallback formula, and `POST /v1/watchlists/preview-volume`.
- [ADR-0002: Unified Provider Connector Pattern](../../adr/0002-unified-provider-connector-pattern.md) — Pluggable connector abstraction governing additive interface methods.
- [ADR-0003: Per-Tenant Per-Provider Rate Limiting](../../adr/0003-per-tenant-per-provider-rate-limiting.md) — `RequestGate` rate-limiting budget checks before preview execution.
- [ADR-0015: Tenant Isolation via Postgres Row-Level Security](../../adr/0015-tenant-isolation-via-postgres-row-level-security.md) — Multi-tenant isolation for watchlist and credential lookups.
- [ADR-0134: Watchlist connector count and preview endpoint — refinements](../../adr/0134-watchlist-connector-count-method-refinements.md) — Additive UI confidence contract and cost projections extending ADR-0077.

---

## 3. Data Architecture & Persistence Design

### 3.1 Zero-Side-Effect Guarantee
Preview requests are strictly analytical and non-mutating:
- **No Database Ingestion:** Posts retrieved during preview sampling are **never** inserted into `social_posts`, `authors`, `post_watchlist_matches`, or `outbound_activities`.
- **No Cursor / Watermark Mutations:** Connectors called in preview mode (`mode: 'preview'` or `isDryRun: true`) must not update high-water marks, pagination cursors, or `ingestion_runs` checkpoints.
- **Sample Disposal:** Sample arrays are held in ephemeral memory exclusively to calculate time span $\Delta t_{sample}$ and are released immediately upon response serialization.

### 3.2 Extrapolation Formula & Cadence Calculation
For connectors lacking native `count?()`, the service invokes `sample?()` (or dry-run polling) with a bounded ceiling of `PREVIEW_SAMPLE_SIZE = 50`:
1. Let $N = \text{posts.length}$.
2. If $N = 0$, `estimatedPosts = 0`, `confidence = 'exact'`.
3. If $N < 50$, the query returned fewer posts than the sample limit within the entire lookback window. Therefore, $N$ is the exact total: `estimatedPosts = N`, `confidence = 'exact'`.
4. If $N = 50$:
   - Calculate sample span: $\Delta t_{sample} = t_{newest} - t_{oldest}$.
   - If $\Delta t_{sample} \le 0$, `estimatedPosts = N`, `confidence = 'estimate'`.
   - Otherwise, calculate arrival rate: $r = \frac{N}{\Delta t_{sample}}$.
   - Given requested window duration $\Delta t_{window}$ (defaulting to 7 days = $604,800,000\text{ ms}$ if unspecified):
     $$\text{estimatedPosts} = \text{Math.round}(r \times \Delta t_{window})$$
   - `confidence = 'estimate'`, `sampleSize = 50`.

---

## 4. API, Interface & Contract Design

### 4.1 `SocialConnector` Additive Methods
Defined in `social-listening-core/src/connectors/types.ts`:

```typescript
export interface ConnectorCountResult {
  count: number;
  confidence: 'exact' | 'estimate';
  sampleSize?: number;
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}

export interface ConnectorSampleResult {
  posts: NormalizedPost[];
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}

export interface SocialConnector {
  // Existing poll, testConnection, etc.
  count?(
    ctx: ConnectorContext,
    args: { ast: AstNode; timeWindow?: TimeWindow }
  ): Promise<ConnectorCountResult>;

  sample?(
    ctx: ConnectorContext,
    args: { ast: AstNode; limit: number; timeWindow?: TimeWindow }
  ): Promise<ConnectorSampleResult>;
}
```

### 4.2 HTTP REST Contract: `POST /v1/watchlists/preview-volume`
Mounted in `social-listening-core/src/http/versions/v1/watchlistsRouter.ts`:

- **Method / Route:** `POST /v1/watchlists/preview-volume`
- **Auth:** Bearer Token (`resolveIdentity` middleware validating active tenant context)
- **Role Gating:** `Tenant-Admin`, `Tenant-Brand-Reputation-Manager`, `Tenant-User`

#### Request Payload
```json
{
  "ast": {
    "type": "AND",
    "children": [
      { "type": "TERM", "value": "acme" },
      { "type": "TERM", "value": "security" }
    ]
  },
  "connectorIds": ["conn-gnews-01", "conn-fb-02", "conn-brave-03"],
  "timeWindow": {
    "start": "2026-08-16T00:00:00.000Z",
    "end": "2026-08-23T00:00:00.000Z"
  }
}
```

#### Response Payload (200 OK)
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
    },
    {
      "connectorId": "conn-brave-03",
      "platformId": "brave-search",
      "estimatedPosts": 0,
      "confidence": "unavailable",
      "rateLimitCost": 0,
      "warning": "quota_risk",
      "errorCode": "RATE_LIMIT_EXHAUSTED",
      "errorMessage": "Connector rate limit budget exceeded pre-check threshold"
    }
  ]
}
```

---

## 5. Rate Limiting, Concurrency Gating & Quota Governance

1. **Pre-Flight Availability Verification:**
   Before invoking upstream network APIs, the service calls:
   ```typescript
   checkProviderAvailability(providerId, estimatedCost);
   ```
2. **Quota Risk Guardrails:**
   - A single preview call must not consume more than **5%** of the connector's remaining per-tenant rate-limit budget.
   - If the connector has less than **20%** remaining budget (i.e. preview would consume $>80\%$ of remaining capacity), `checkProviderAvailability` flags a quota hazard.
   - When quota is insufficient, the service does not crash; it emits `warning: 'quota_risk'`, sets `confidence: 'unavailable'`, and reports `errorCode: 'QUOTA_EXCEEDED'`.
3. **Execution Concurrency:**
   - Connectors are polled concurrently via `Promise.allSettled()`.
   - Network timeout is strictly clamped to **15 seconds** per connector preview to prevent hung upstream connections from blocking the HTTP response.

---

## 6. Security, Identity & Multi-Tenant Isolation

1. **Strict Tenant Scoping:** All connector configurations, credentials, and watchlist entities are retrieved using `tenant_id = current_setting('app.current_tenant_id')`.
2. **Cross-Tenant Prevention:** If a caller submits a `connectorId` belonging to another tenant, the connector is omitted or marked `unavailable` with `ERR_CONNECTOR_NOT_FOUND` (HTTP 404/403 isolation).
3. **Inactive Connector Preview Authorization:** Users may evaluate inactive connectors provided valid OAuth/API credentials exist in Key Vault (`ADR-0014`), allowing decision-makers to evaluate expected volume prior to formal activation.

---

## 7. Error Handling & Failure Classification

The preview orchestrator guarantees **Partial Failure Isolation**:

| Failure Mode | HTTP Status | Response Representation | Handling Logic |
|---|---|---|---|
| Upstream Connector Timeout / 500 | `200 OK` | `confidence: 'unavailable'`, `errorCode: 'UPSTREAM_ERROR'` | Isolated to specific connector item in `breakdown`. Other connectors succeed. |
| Connector Missing `count?()` & `sample?()` | `200 OK` | `confidence: 'unavailable'`, `warning: 'unsupported_query'` | Returns `errorCode: 'PREVIEW_NOT_SUPPORTED'`. |
| Unsupported AST Operator | `200 OK` | `warning: 'unsupported_query'`, `unsupportedOperators: ['NEAR']` | Reported via static `astCapabilityCheck()` before network dispatch. |
| High Estimated Volume ($> 100,000$) | `200 OK` | `warning: 'high_volume'` | Flagged on item; warns user before activating large stream. |
| Malformed AST Payload | `400 Bad Request` | Standard RFC 7807 Error | Fails request immediately before connector dispatch. |
| Invalid Tenant Credentials | `401 / 403` | Standard RFC 7807 Error | Auth middleware blocks request before preview execution. |

---

## 8. Testing & Contract Gate Plan

### 8.1 Executable Contract Suite
- **Location:** `social-listening-core/contracts/epic-9/story-9.1.watchlist-preview-volume.contract.test.ts`
- **Scenarios Verified:**
  - `AC1`: Optional `count?()` interface validity on `SocialConnector`.
  - `AC2`: GNews exact count evaluation via `totalArticles` field.
  - `AC3`: Non-count connector sample fallback (sample $= 50 \to$ estimate; sample $< 50 \to$ exact).
  - `AC4`: `POST /v1/watchlists/preview-volume` schema validation and RLS enforcement.
  - `AC5`: Concurrent preview execution with partial failure containment.
  - `AC6`: Warning thresholds (`high_volume`, `quota_risk`, `unsupported_query`).
  - `AC7`: Cross-tenant boundary enforcement and unauthorized connector exclusion.

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

- **`social-listening-core/.claude/skills/provider-connector-framework/SKILL.md`:** Document the `count?()` and `sample?()` method signatures, `mode: 'preview'` invariant, and non-mutating dry-run requirement.
- **`social-listening-core/.claude/skills/watchlist-matching/SKILL.md`:** Detail the preview volume extrapolation algorithm, warning thresholds, and static `astCapabilityCheck` mechanics.

---

## 10. Observability, Metrics & Telemetry

- **Prometheus / Azure Monitor Metrics:**
  - `watchlists_preview_requests_total{status="success|error"}`: Counter of preview operations.
  - `watchlists_preview_duration_ms`: Histogram of preview request execution latency.
  - `watchlists_preview_warnings_total{type="high_volume|quota_risk|unsupported_query"}`: Counter of operational warnings raised.
- **Structured Audit Logging:**
  Log entry includes `tenantId`, `connectorIds`, `totalEstimatedPosts`, `durationMs`, and per-connector confidence grades.

---

## 11. Migration, Rollout & Feature Gating

- **Zero Database Migrations:** Uses existing tables and stateless in-memory calculations.
- **Feature Flag:** Gated under `features.watchlist_volume_preview` (default enabled in all tiers).
- **Rollback Path:** Disable route in `watchlistsRouter.ts` or turn off feature flag; client UI falls back to standard un-estimated watchlist activation.

---

## 12. Technical Assumptions, Dependencies & Open Questions

- **[Q-0077-1] Default Preview Sample Size:** Settled at 50 posts. Sufficient for cadence extrapolation across standard social APIs without triggering pagination loops.
- **[Q-0077-2] Static vs Dynamic Capability Checking:** Two-phase resolution adopted: static AST operator check runs first, followed by dynamic platform-level validation.
- **[Q-0077-3] Ingested Post Leaks:** Prevented structurally by routing through `sample?()` or `poll({ mode: 'preview' })` without writing to the database.
