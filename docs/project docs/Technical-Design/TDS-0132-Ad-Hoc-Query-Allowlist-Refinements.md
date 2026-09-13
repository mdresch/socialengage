# Technical Design Specification (TDS) — Ad-Hoc Query Allowlist Refinements

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0132: Ad-Hoc Query Allowlist Refinements — Pre-Compiled AST Query Templates & Execution Cost Governor Engine |
| **Document ID** | `TDS-0132` |
| **Feature Name** | Parameterized AST Query Templates & Query Execution Budget Governor |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/ad-hoc-query-engine/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0132` | [ADR-0132: Ad-Hoc Query Allowlist Refinements](../../adr/0132-ad-hoc-query-allowlist-refinements.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0132` | [BRD-0132: Ad-Hoc Query Allowlist Refinements](../Business-Requirements/BRD-0132-Ad-Hoc-Query-Allowlist-Refinements.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0132` | [FDD-0132: Ad-Hoc Query Allowlist Refinements](../Functional-Design/FDD-0132-Ad-Hoc-Query-Allowlist-Refinements.md) | Fully Aligned |
| **Governing User Story** | `Story 17.2` | [Epic 17: Stories 129–133](../../user-stories/epic-17-adr-0129-to-0133.md#story-172) / Story 10.4 Baseline | Acceptance Target |
| **Related User Stories** | `Story 10.4`, `Story 10.5` | Ad-Hoc Query Baseline, Query UI | Baseline Implementation |
| **Related Architecture Decisions** | `ADR-0088`, `ADR-0111`, `ADR-0135` | Ad-Hoc Baseline, Export Bounding, Views Refinements | Architectural Framework |
| **Executable Contract Tests** | `Story 10.4 Contract` | `social-listening-core/contracts/epic-10/story-10.4.ad-hoc-query-endpoint.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Client["API Client / Admin Console"]
        Req["POST /v1/analytics/query"]
    end

    subgraph CoreEngine["social-listening-core Query Engine"]
        Governor["Query Governor (Cost & Complexity Estimation)"]
        ASTCompiler["AST Template Compiler (Zero String Concatenation)"]
        Timer["Execution Timer (3,000ms Statement Timeout)"]
    end

    subgraph Database["PostgreSQL"]
        Plan["EXPLAIN (FORMAT JSON) Cost Evaluation"]
        Execute["Prepared Statement Execution"]
    end

    Req --> Governor
    Governor -->|Pre-Execution Cost Check| Plan
    Plan -->>|Estimated Cost < 10,000| Governor
    Plan -->>|Estimated Cost >= 10,000| Reject["422 Unprocessable Entity (Query Cost Exceeds Budget)"]
    Governor --> ASTCompiler
    ASTCompiler --> Timer
    Timer --> Execute
    Execute -->> Req
```

### 2.2 Architectural Boundaries & Invariants
- **Pre-Compiled AST Query Templates:** Completely replaces dynamic SQL string assembly with immutable Abstract Syntax Tree (AST) templates. All identifier positions and expressions are structurally fixed; user parameters bind strictly via positional `$1, $2, ...` placeholders.
- **Pre-Execution Cost Governor:** Queries evaluate their execution plan via an internal `EXPLAIN` pass. If the estimated total cost exceeds $10,000$ units, the query is rejected immediately with HTTP 422 (`QUERY_COST_EXCEEDED`), protecting database shared buffers from malicious or inefficient cartesian joins.
- **Tighter Statement Timeout:** Decreases the maximum client statement timeout ceiling from $5,000\text{ms}$ to $3,000\text{ms}$.

---

## 3. Data Architecture & Persistence Design

### 3.1 Governor Configuration Interface
```typescript
export interface QueryGovernorConfig {
  maxEstimatedCost: number;       // Default: 10000
  statementTimeoutMs: number;     // Default: 3000ms
  maxMemoryBytes: number;         // Default: 50MB
  maxRowsReturned: number;        // Default: 5000
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Governor Guard Implementation
```typescript
export async function executeGovernedQuery(
  client: PoolClient,
  sql: string,
  params: any[],
  config: QueryGovernorConfig
): Promise<any[]> {
  // 1. Run EXPLAIN to assess query plan cost
  const explainRes = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
  const plan = explainRes.rows[0]['QUERY PLAN'][0]['Plan'];
  const totalCost = plan['Total Cost'];

  if (totalCost > config.maxEstimatedCost) {
    throw new QueryCostExceededError(`Estimated query cost ${totalCost} exceeds budget ${config.maxEstimatedCost}`);
  }

  // 2. Set strict local statement timeout
  await client.query(`SET LOCAL statement_timeout = '${config.statementTimeoutMs}ms'`);

  // 3. Execute query safely
  const result = await client.query(sql, params);
  return result.rows;
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Error Response Contract
When a query is rejected by the execution governor:
- **HTTP Status:** `422 Unprocessable Entity`
- **Payload:**
```json
{
  "error": "QUERY_COST_EXCEEDED",
  "message": "The requested multi-dimensional query would scan too many partitions. Narrow your date range or add platform filters.",
  "estimatedCost": 14250,
  "budgetLimit": 10000
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Denial of Service Prevention:** The execution governor prevents "noisy neighbor" scenarios where a single tenant's heavy ad-hoc analytics queries degrade transactional post ingestion across the entire multi-tenant database cluster.

---

## 7. Performance, Scalability & Resource Caps
- **Statement Timeout:** Hard-capped at $3,000\text{ms}$.
- **Memory Ceiling:** Enforces `SET LOCAL work_mem = '32MB'`.

---

## 8. Resilience, Recovery & Failure Semantics
- If a query times out, PostgreSQL automatically cancels the query execution, emits a `57014 query_canceled` error, and releases connection locks immediately.

---

## 9. Observability, Telemetry & Auditability
- Emits server log: `query_governor_rejected{tenant_id, estimated_cost, dimensions}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Engine-level optimization; backward-compatible with all valid ADR-0088 client queries.

---

## 11. Verification, Testing & Quality Assurance
- Validated against contract suite in `social-listening-core/contracts/epic-10/story-10.4.ad-hoc-query-endpoint.contract.test.ts`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0132-1]** **Tenant cost tier overrides.** Allowing Enterprise-tier tenants higher cost budgets (e.g. 25,000 units) via plan metadata.
