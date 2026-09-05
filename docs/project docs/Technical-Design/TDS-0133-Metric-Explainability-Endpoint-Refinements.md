# Technical Design Specification (TDS) — Metric Explainability Endpoint Refinements

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0133: Metric Explainability Endpoint Refinements — Statistical Significance Gating ($p < 0.05$) & Multi-Factor Root-Cause Metric Decomposition |
| **Document ID** | `TDS-0133` |
| **Feature Name** | Statistical Significance Anomaly Gate & Root-Cause Factor Decomposition |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/metric-explainability/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0133` | [ADR-0133: Metric Explainability Endpoint Refinements](../../adr/0133-metric-explainability-endpoint-refinements.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0133` | [BRD-0133: Metric Explainability Endpoint Refinements](../Business-Requirements/BRD-0133-Metric-Explainability-Endpoint-Refinements.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0133` | [FDD-0133: Metric Explainability Endpoint Refinements](../Functional-Design/FDD-0133-Metric-Explainability-Endpoint-Refinements.md) | Fully Aligned |
| **Governing User Story** | `Story 17.3` | [Epic 17: Stories 129–133](../../user-stories/epic-17-adr-0129-to-0133.md#story-173) / Story 13.7 Baseline | Acceptance Target |
| **Related User Stories** | `Story 13.7`, `Story 8.8` | Metric Explainability Baseline, Spike Storyteller | Predecessor Modules |
| **Related Architecture Decisions** | `ADR-0078`, `ADR-0113`, `ADR-0105` | Metric Explainability Baseline, Prompt Caching, Widget Contracts | Core Architecture |
| **Executable Contract Tests** | `Story 13.7 Contract` | `social-listening-core/contracts/epic-13/story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Client["Frontend Analytics UI"]
        ExplainBtn["Explain Metric Button (MetricTile.tsx)"]
    end

    subgraph CoreService["social-listening-core: metricExplainabilityService.ts"]
        Endpoint["POST /v1/explain"]
        StatsGate["Statistical Significance Gate (Z-Score > 2.0 / p < 0.05)"]
        Decomposer["Root-Cause Factor Decomposer (Volume vs Sentiment vs Author)"]
        LLMEngine["Azure OpenAI Service (GPT-4o-mini Synthesis)"]
    end

    ExplainBtn --> Endpoint
    Endpoint --> StatsGate
    StatsGate -->|Not Significant (p >= 0.05)| EarlyReturn["200 OK (Non-Generative Statistical Summary: 'Shift within expected variance')"]
    StatsGate -->|Statistically Significant (p < 0.05)| Decomposer
    Decomposer -->|Structured Factor Breakdown| LLMEngine
    LLMEngine -->|Generative Narrative| Endpoint
    Endpoint -->> ExplainBtn
```

### 2.2 Architectural Boundaries & Invariants
- **Statistical Significance Pre-Filter Gate:** Prior to dispatching an expensive generative completion request to Azure OpenAI, the service calculates the standardized Z-score of the metric delta against the historical 30-day baseline distribution:
  $$Z = \frac{|\Delta - \mu|}{\sigma}, \quad p = 2 \cdot (1 - \Phi(Z))$$
  If $p \ge 0.05$ (meaning $Z < 1.96$), the change is statistically indistinguishable from background noise. The API immediately returns a deterministic response (*"Metric shift is within expected natural variance; generative explanation omitted"*) without spending LLM tokens.
- **Multi-Factor Root-Cause Decomposition:** When an anomaly is validated ($p < 0.05$), the system mathematically decomposes the shift into discrete drivers: volume change, platform distribution skew, author reach weight, and topic clustering. These factors are injected into the prompt as structured telemetry.

---

## 3. Data Architecture & Persistence Design

### 3.1 Decomposition DTO Schema
```typescript
export interface FactorDecomposition {
  volumeDeltaPercent: number;
  sentimentShiftContribution: number;  // -1.0 to +1.0
  dominantPlatform: string;
  topContributingTopic: string;
  topAuthorImpactRatio: number;
}

export interface StatisticallyGatedExplainResponse {
  isStatisticallySignificant: boolean;
  zScore: number;
  pValue: number;
  explanation: string;
  factorDecomposition?: FactorDecomposition;
  tokenCostSaved: boolean;
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Statistical Significance Evaluator
```typescript
export function evaluateStatisticalSignificance(
  currentValue: number,
  historicalMean: number,
  historicalStdDev: number
): { isSignificant: boolean; zScore: number; pValue: number } {
  if (historicalStdDev === 0) {
    return { isSignificant: false, zScore: 0, pValue: 1.0 };
  }

  const zScore = Math.abs(currentValue - historicalMean) / historicalStdDev;
  // Approximation of standard normal CDF
  const pValue = Math.max(0.0001, Math.min(1.0, 2 * (1 - normalCdf(zScore))));
  const isSignificant = pValue < 0.05;

  return {
    isSignificant,
    zScore: Math.round(zScore * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
  };
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Endpoint Behavior
`POST /v1/explain`

- **Payload:** Same as ADR-0113 (`metric`, `value`, `previousValue`, `timeRange`).
- **Response when Not Statistically Significant (p >= 0.05):**
```json
{
  "generationId": "none",
  "isStatisticallySignificant": false,
  "zScore": 0.84,
  "pValue": 0.4009,
  "explanation": "The change in net_sentiment from 2.1 to 2.4 is within standard historical variance. No operational action is required.",
  "tokenCostSaved": true
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Token Accounting Guard:** Eliminates unnecessary third-party API spend for small-business tenants with tight monthly token quotas.
- **Tenant Context:** Historical mean and standard deviation are calculated strictly across the authenticated tenant's past data.

---

## 7. Performance, Scalability & Resource Caps
- **Instant Response for Non-Anomalies:** Requests failing the significance gate return in $< 15\text{ms}$ with zero external network overhead.

---

## 8. Resilience, Recovery & Failure Semantics
- If insufficient historical data exists to establish variance ($< 7$ historical samples), the gate defaults to open (`isSignificant = true`) and proceeds to LLM analysis.

---

## 9. Observability, Telemetry & Auditability
- Emits metric: `metric_explain_significance_gated_total{metric, passed}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Additive optimization to `metricExplainabilityService.ts`; fully backward-compatible with ADR-0113 contracts.

---

## 11. Verification, Testing & Quality Assurance
- Validated alongside ADR-0113 contract in `social-listening-core/contracts/epic-13/story-13.7.metric-explainability-prompt-and-caching.contract.test.ts`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0133-1]** **Configurable alpha significance level.** Allowing tenants to adjust the significance threshold (e.g., $p < 0.01$ for high-noise feeds).
