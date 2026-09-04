# Technical Design Specification (TDS) — Error Handling and Auto-Disable Policy

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0010: Error Handling & Auto-Disable Policy |
| **Document ID** | `TDS-0010` |
| **Feature Name** | Ingestion Error Classification & Circuit Breaker Auto-Disable |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0010` | [ADR-0010: Retryable-vs-non-retryable error policy with per-tenant auto-disable](../../adr/0010-error-handling-and-auto-disable-policy.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0010` | [BRD-0010: Error Handling and Auto-Disable Policy](../Business-Requirements/BRD-0010-Error-Handling-And-Auto-Disable-Policy.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0010` | [FDD-0010: Error Handling and Auto-Disable Policy](../Functional-Design/FDD-0010-Error-Handling-And-Auto-Disable-Policy.md) | Fully Aligned |
| **Governing User Story** | `Story 2.3` | [Epic 2: Ingestion Connectors and Rate Limits](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-23--retryable-vs-non-retryable-error-policy-with-per-tenant-auto-disable) | Acceptance Target |
| **Executable Contract Test** | `Story 2.3 Contract` | `contracts/epic-2/story-2.3.error-handling-and-auto-disable.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Scheduler["Poll Scheduler (pollScheduler.ts)"]
        PreCheck["shouldAttemptIngestion(tenantId, platformId)"]
    end

    subgraph Execution["Ingestion Executor (runIngestionAttempt.ts)"]
        RunPoll["connector.poll()"]
        CatchBlock["catch (err)"]
        Classify["classifyError(err) -> { retryable, isCredentialFailure }"]
        OAuthCheck{"Is Credential Error & Refreshable?"}
        AutoRefresh["Attempt Token Refresh"]
        Backoff["Exponential Backoff Retry"]
    end

    subgraph Database["Postgres Storage"]
        RunStore["completeIngestionRun(..., { retryable, isCredentialFailure, errorSummary })"]
        HealthDerive["deriveConnectorHealth()"]
    end

    PreCheck -->|Allowed (status != 'failing')| RunPoll
    PreCheck -.->|Blocked (status == 'failing')| CircuitOpen["Skip Run / Auto-Disabled"]
    
    RunPoll --> CatchBlock
    CatchBlock --> Classify
    Classify --> OAuthCheck
    OAuthCheck -->|Yes| AutoRefresh
    AutoRefresh -->|Refresh Success| RunPoll
    AutoRefresh -->|Refresh Failed| RunStore
    OAuthCheck -->|No (Transient / RateLimit)| Backoff
    OAuthCheck -->|No (Permanent Non-Retryable)| RunStore
    
    RunStore --> HealthDerive
    HealthDerive -.->|Updates Ingestion Allowance| PreCheck
```

### 2.2 Architectural Boundaries & Invariants
- **Classification Invariant:** Errors are categorized into `retryable` (rate limits, transient network 5xx timeouts) versus `non-retryable` (HTTP 401, 403, malformed queries, invalid credentials).
- **Refresh-Before-Fail Invariant:** For OAuth2 connectors, token expiration triggers an automatic, silent token refresh attempt. A credential failure is surfaced to the tenant only if refresh fails.
- **Auto-Disable Circuit Breaker:** When consecutive non-retryable failures cross the threshold defined in ADR-0023, `shouldAttemptIngestion()` returns `false`, halting automatic polling for that tenant.
- **Tenant Isolation:** Auto-disable and circuit breaker states are strictly per-tenant; a failing connector in Tenant A never halts or throttles polling in Tenant B.

---

## 3. Data Architecture & Persistence Design

Ingestion run audit table records the error classification flags:
```sql
ALTER TABLE ingestion_runs
  ADD COLUMN retryable BOOLEAN,
  ADD COLUMN is_credential_failure BOOLEAN;

CREATE INDEX idx_ingestion_runs_failure_eval 
  ON ingestion_runs(tenant_id, platform_id, status, retryable);
```

---

## 4. API, Interface & Integration Contract Design

### 4.1 Error Classifier Interface (`src/ingestion/errorClassification.ts`)
```typescript
export interface ClassifiedError {
  kind: 'RateLimit' | 'Transient' | 'Credential' | 'MalformedInput' | 'Unknown';
  retryable: boolean;
  isCredentialFailure: boolean;
  httpStatus?: number;
  message: string;
}

export function classifyError(error: unknown): ClassifiedError;
```

### 4.2 Ingestion Gate (`src/ingestion/shouldAttemptIngestion.ts`)
```typescript
export async function shouldAttemptIngestion(
  tenantId: string,
  platformId: string
): Promise<boolean> {
  const health = await deriveConnectorHealth(tenantId, platformId);
  return health.status !== 'failing';
}
```

### 4.3 Manual Re-Enable Endpoint (ADR-0109)
- `POST /v1/connectors/:platformId/enable`
- Triggers a probe run with `triggerType = 'health_check'`. If successful, resets consecutive failures and clears circuit breaker.

---

## 5. Rate Limiting, Concurrency & Flow Control

- Retryable errors back off exponentially ($1\text{s}, 2\text{s}, 4\text{s}, \dots$) with jitter up to a maximum cap (300 seconds).
- Auto-disable saves platform compute and third-party quota by terminating polling loops against invalid accounts.

---

## 6. Security, Identity & Credential Governance

- Redaction: Sanitization routines strip API keys, Bearer tokens, and client secrets from `error_summary` before persistence.

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Classification Mapping
| Error Type | Platform Response | `retryable` | `isCredentialFailure` | Action |
|---|---|---|---|---|
| Rate Limit | HTTP 429 Too Many Requests | `true` | `false` | Schedule exponential backoff |
| Server Error | HTTP 500 / 502 / 503 / 504 | `true` | `false` | Retry up to max attempts |
| Expired Token | HTTP 401 Unauthorized | `false` | `true` | Attempt OAuth refresh; if fail, set `reconnect_required` |
| Bad Query Syntax | HTTP 400 Bad Request | `false` | `false` | Log error; flag non-retryable |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-2/story-2.3.error-handling-and-auto-disable.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-ERR-01` | Rate limit classified as retryable | Mock HTTP 429 from provider; assert `retryable: true` in run record. |
| `TEST-ERR-02` | Invalid key triggers non-retryable | Mock HTTP 401; assert `retryable: false` and `isCredentialFailure: true`. |
| `TEST-ERR-03` | Circuit breaker trips after threshold | Seed failing run history; assert `shouldAttemptIngestion` returns `false`. |
| `TEST-ERR-04` | Per-tenant failure isolation | Assert Tenant A tripped breaker does not affect Tenant B polling. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/connector-health-and-error-handling/SKILL.md`:
- **Classification Discipline:** Always map incoming third-party errors through `classifyError()`.
- **Pre-Check Invariant:** The scheduler must always invoke `shouldAttemptIngestion()` prior to executing a run.

---

## 10. Observability, Metrics & Operational Telemetry

- `connector_circuit_breaker_tripped_total{platform, tenant_id}` (counter)
- `connector_error_classifications_total{platform, kind}` (counter)

---

## 11. Migration, Rollout & Feature Gating

- Migration `migrations/0008_add_retryable_to_ingestion_runs.sql` adds classification columns.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0010-1]** Third-party APIs return standard HTTP status codes.
- **[D-0010-1]** ADR-0023 failure threshold formula.

### 12.2 Open Questions
- [x] **[Q-0010-1]** *Failure Threshold Formula:* Clarified in ADR-0023 (rate-relative calculation).
