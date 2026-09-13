# Technical Design Specification (TDS) — Metric Explainability Prompt and Caching

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0113: Metric Explainability Prompt Architecture, Deterministic Synthesis & Postgres-Backed Caching Engine |
| **Document ID** | `TDS-0113` |
| **Feature Name** | Metric Explainability AI Service, Versioned Prompts & Response Cache |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/metric-explainability/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0113` | [ADR-0113: Metric Explainability Prompt and Caching](../../adr/0113-metric-explainability-prompt-and-caching.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0113` | [BRD-0113: Metric Explainability Prompt And Caching](../Business-Requirements/BRD-0113-Metric-Explainability-Prompt-And-Caching.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0113` | [FDD-0113: Metric Explainability Prompt And Caching](../Functional-Design/FDD-0113-Metric-Explainability-Prompt-And-Caching.md) | Fully Aligned |
| **Governing User Story** | `Story 13.7` | [Epic 13: Stories 109–117](../../user-stories/epic-13-adr-0109-to-0117.md#story-137--metric-explainability-prompt-and-caching-backend) | Acceptance Target |
| **Related User Stories** | `Story 9.2`, `Story 17.3` | Early Explainability Spike, Explainability Streaming | Evolutionary Cycle |
| **Related Architecture Decisions** | `ADR-0062`, `ADR-0078`, `ADR-0105`, `ADR-0133` | Spike Storyteller, Metric Explain, Widget Contracts, Streaming Refinements | Architectural Sibling |
| **Executable Contract Test** | `Story 13.7 Contract` | `social-listening-core/contracts/epic-13/story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Analytics Client"]
        Widget["MetricTile.tsx (Explain Button)"]
    end

    subgraph ServiceLayer["social-listening-core API Layer"]
        Router["POST /v1/explain"]
        Service["metricExplainabilityService.ts"]
        PromptV1["metricExplainPromptV1.ts (System Prompt + Seed)"]
        CacheMgr["metricExplanationCache.ts"]
    end

    subgraph Persistence["PostgreSQL Data Store"]
        CacheTable["metric_explanation_cache (5-Minute TTL, Tenant RLS)"]
        AuditLog["platform_admin_audit_log (Audit trail)"]
    end

    subgraph ExternalAI["Azure OpenAI Service"]
        LLM["GPT-4o-mini (temperature=0, fixed seed)"]
    end

    Widget --> Router
    Router --> Service
    Service --> CacheMgr
    CacheMgr -->|Lookup SHA-256 Key| CacheTable
    CacheTable -->>|Cache Hit (Fresh < 5m)| CacheMgr
    CacheMgr -->>|Return Cached Explanation| Service
    Service -->|Audit Log cache_hit=true| AuditLog
    Service -->> Router
    
    CacheTable -->>|Cache Miss or noCache=true| CacheMgr
    CacheMgr -->> Service
    Service --> PromptV1
    PromptV1 --> LLM
    LLM -->>|Synthesized Text| Service
    Service -->|Store with 5m TTL| CacheTable
    Service -->|Audit Log cache_hit=false| AuditLog
    Service -->> Router
    Router -->> Widget
```

### 2.2 Architectural Boundaries & Invariants
- **Versioned Prompt Contract:** AI explanations use explicit prompt versioning (currently `promptVersion: "v1"`). Prompts enforce structured context injection: metric name, current value, previous value, delta, and top contributing entities/keywords.
- **Deterministic Generation:** To prevent stochastic fluctuations across identical queries, the Azure OpenAI completion model executes with `temperature = 0` and a fixed integer seed mathematically derived from `promptVersion`.
- **Postgres-Backed 5-Minute TTL Cache:** Cache entries reside in table `metric_explanation_cache`. The compound cache key hashes: `tenant_id`, `metric`, `value`, `timeRange`, `filters`, and `promptVersion`.
- **Tenant Isolation & Bypass Affordance:** Cache lookups are strictly tenant-isolated via RLS. Callers can supply `?noCache=true` or `{ noCache: true }` in the request body to force fresh synthesis when investigating real-time anomalies.
- **Audit Logging:** Every explain invocation logs to `platform_admin_audit_log` with user ID, metric key, token counts, and a boolean `cache_hit` flag.

---

## 3. Data Architecture & Persistence Design

### 3.1 Cache DDL Schema
Migration `0067_create_metric_explanation_cache.sql`:
```sql
CREATE TABLE IF NOT EXISTS metric_explanation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cache_key TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'v1',
    explanation TEXT NOT NULL,
    generation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_metric_cache_tenant_key UNIQUE (tenant_id, cache_key)
);

ALTER TABLE metric_explanation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY metric_cache_tenant_isolation ON metric_explanation_cache
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_metric_cache_lookup ON metric_explanation_cache (tenant_id, cache_key, expires_at);
```

### 3.2 TypeScript Request / Response DTOs
```typescript
export interface ExplainMetricRequest {
  metric: string;                // e.g. 'net_sentiment' | 'mention_volume'
  value: number;
  previousValue?: number;
  timeRange: { start: string; end: string };
  filters?: Record<string, string>;
  noCache?: boolean;
}

export interface ExplainMetricResponse {
  generationId: string;
  metric: string;
  explanation: string;
  promptVersion: string;
  cacheHit: boolean;
  generatedAt: string;
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Cache Key Generation
```typescript
import { createHash } from 'crypto';

export function computeCacheKey(req: ExplainMetricRequest, promptVersion: string): string {
  const payload = JSON.stringify({
    metric: req.metric,
    value: req.value,
    prev: req.previousValue ?? null,
    start: req.timeRange.start,
    end: req.timeRange.end,
    filters: req.filters || {},
    v: promptVersion,
  });
  return createHash('sha256').update(payload).digest('hex');
}
```

### 4.2 Deterministic Prompt Invocation
```typescript
export const METRIC_EXPLAIN_V1_SEED = 421337;

export async function synthesizeMetricExplanation(
  req: ExplainMetricRequest,
  credential: string
): Promise<string> {
  const prompt = renderMetricPromptV1(req);

  const response = await azureOpenAiConnector.chatCompletion({
    messages: [
      { role: 'system', content: prompt.systemMessage },
      { role: 'user', content: prompt.userMessage },
    ],
    temperature: 0.0,
    seed: METRIC_EXPLAIN_V1_SEED,
    maxTokens: 300,
    credential,
  });

  return response.content.trim();
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Endpoint Specification
`POST /v1/explain`

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "metric": "net_sentiment",
  "value": -4.2,
  "previousValue": 1.5,
  "timeRange": {
    "start": "2026-09-01T00:00:00Z",
    "end": "2026-09-05T23:59:59Z"
  }
}
```
- **Response Format (200 OK):**
```json
{
  "generationId": "d8c11e74-72bf-4638-a28a-7e382d561234",
  "metric": "net_sentiment",
  "explanation": "Net sentiment dropped from +1.5 to -4.2 over the selected 5-day window, driven primarily by a surge in negative mentions regarding checkout timeouts on e-commerce platforms.",
  "promptVersion": "v1",
  "cacheHit": false,
  "generatedAt": "2026-09-05T15:20:00.000Z"
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Cross-Tenant Guard:** Cache rows are partitioned by `tenant_id` and gated by Postgres RLS. Tenant A cannot retrieve Tenant B's explanation even if metric keys, values, and timestamps are identical.
- **Access Control:** Endpoint requires authenticated `tenant_user` or `tenant_admin` role. Disabled tenant AI configurations return HTTP 403.

---

## 7. Performance, Scalability & Resource Caps
- **Cache Hit Latency:** Returns in $< 10\text{ms}$ directly from Postgres.
- **LLM Call Reduction:** 5-minute TTL reduces OpenAI API call costs by $> 85\%$ during collaborative team reviews of dashboard spikes.

---

## 8. Resilience, Recovery & Failure Semantics
- **OpenAI Throttling:** If Azure OpenAI rate limits, cached entries remain valid until expiration; subsequent un-cached calls return `503 AI_UNAVAILABLE`.
- **Expired Cache Eviction:** Expired rows are ignored by query filters (`expires_at > NOW()`) and purged via daily vacuum jobs.

---

## 9. Observability, Telemetry & Auditability
- Invocations recorded in `platform_admin_audit_log` with:
  - `action: 'ai_metric_explained'`
  - `metricKey: req.metric`
  - `cache_hit: boolean`
  - `duration_ms: number`

---

## 10. Migration, Compatibility & Rollback Strategy
- Schema migration `0067` applies cleanly without table locks. Rollback drops table `metric_explanation_cache`.

---

## 11. Verification, Testing & Quality Assurance
- **Story 13.7 Contract:** `social-listening-core/contracts/epic-13/story-13.7.metric-explainability-prompt-and-caching.contract.test.ts`
  - Validates promptVersion exposure and non-empty explanation.
  - Proves deterministic execution (`temperature=0`, fixed seed).
  - Verifies cache hit on identical second call within TTL.
  - Verifies `noCache=true` bypass.
  - Verifies audit logging and cross-tenant cache isolation.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0113-1]** **Dynamic per-metric TTLs.** Supporting longer TTLs (e.g. 1 hour) for historical metrics vs 5 minutes for real-time KPIs.
- [ ] **[Q-0113-2]** **Multilingual explanation generation.** Allowing users to request explanations in Dutch, German, or French.
- [x] ~~**[Q-0113-3]** **Streaming explanations.**~~ Formalized in ADR-0133 via Server-Sent Events (SSE).
