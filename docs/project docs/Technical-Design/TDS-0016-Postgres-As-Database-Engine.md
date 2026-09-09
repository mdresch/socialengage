# Technical Design Specification (TDS) — Postgres as Database Engine

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0016: Postgres as Database Engine |
| **Document ID** | `TDS-0016` |
| **Feature Name** | Azure Database for PostgreSQL Engine Standard & Health Verification |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0016` | [ADR-0016: Postgres as the database engine](../../adr/0016-postgres-as-database-engine.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0016` | [BRD-0016: Postgres as the Database Engine](../Business-Requirements/BRD-0016-Postgres-As-Database-Engine.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0016` | [FDD-0016: Postgres as the Database Engine](../Functional-Design/FDD-0016-Postgres-As-Database-Engine.md) | Fully Aligned |
| **Governing User Story** | `Story 1.10` | [Epic 1: Repository and API Foundation](../../user-stories/epic-1-repository-and-api-foundation.md#story-110--postgres-boot-time-readiness-check-and-a-real-v1health) | Acceptance Target |
| **Executable Contract Test** | `Story 1.10 Contract` | `contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph CoreService["social-listening-core Process"]
        Server[src/http/server.ts Entrypoint]
        Readiness[src/db/postgresReadiness.ts]
        HealthRoute[GET /v1/health]
        Pool[src/db/pool.ts - pg.Pool Singleton]
        
        Server -->|1. waitForPostgresReady| Readiness
        Readiness -->|SELECT 1 with retry/backoff| Pool
        Server -->|2. listen on PORT if healthy| ExpressApp[Express HTTP Listener]
        
        HealthRoute -->|checkPostgresConnectivity| Readiness
    end

    subgraph AzureCloud["Azure Infrastructure"]
        Pool -->|TCP Connection Pool (SSL / Port 5432)| AzurePG[(Azure Database for PostgreSQL Flexible Server)]
    end

    subgraph Monitoring["External Probes / Orchestration"]
        K8s[Kubernetes / Container App Probes] -->|Liveness/Readiness Probe| HealthRoute
    end
```

### 2.2 Architectural Boundaries & Invariants
- **Engine Standard:** Azure Database for PostgreSQL (Flexible Server, version $\ge 14$) is the sole persistent relational data store.
- **Fail-Fast Startup Invariant:** The Node.js application process must refuse to start and exit non-zero if PostgreSQL is unreachable at boot time. It must never open HTTP listen ports while database connectivity is broken.
- **Database-Aware Health Invariant:** `GET /v1/health` must probe PostgreSQL with an active `SELECT 1` query having a bounded timeout (2000 ms). It returns HTTP `200` (`{ status: "ok" }`) when connected, and HTTP `503` (`{ status: "unavailable" }`) when disconnected.
- **Unauthenticated Health Probe:** `/v1/health` remains completely unauthenticated and public so container orchestrators and load balancers can poll it without credentials.

---

## 3. Data Architecture & Persistence Design

### 3.1 Load-Bearing Postgres Engine Features
1. **Native JSONB (`rawPayload`):**
   - Stores variable schema social post payloads across heterogeneous platforms (X/Twitter, Reddit, YouTube, Facebook, LinkedIn, MediaWiki).
   - Allows indexable extraction via JSON path expressions (e.g. `raw_payload->>'author_name'`) and GIN indexes (`USING gin(raw_payload)`).
2. **Native Row-Level Security (RLS):**
   - Database-layer multi-tenant data isolation per ADR-0015.
3. **Future Extension Headroom (Unexercised Baseline):**
   - Built-in full-text search (`tsvector`, `tsquery`).
   - Vector embeddings extension (`pgvector` for RAG/semantic similarity in ADR-0081+).

### 3.2 Connection Pool Configuration (`src/db/pool.ts`)
- Configured via environment variables:
  ```typescript
  {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'socialengage_dev',
    user: process.env.PGUSER || 'app_user',
    password: process.env.PGPASSWORD || 'app_user_password',
    max: parseInt(process.env.PGMAXCONNECTIONS || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  }
  ```

---

## 4. API, Interface & Integration Contract Design

### 4.1 Health Check API Contract
- **Route:** `GET /v1/health`
- **Authentication:** None (Public)
- **Response Schemas:**

**Success (HTTP 200 OK):**
```json
{
  "status": "ok"
}
```

**Postgres Failure (HTTP 503 Service Unavailable):**
```json
{
  "status": "unavailable"
}
```

### 4.2 TypeScript Readiness Interface (`src/db/postgresReadiness.ts`)
```typescript
export interface PostgresReadinessOptions {
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

/** Runs a single SELECT 1 with bounded timeout. Never throws. */
export async function checkPostgresConnectivity(timeoutMs: number = 2000): Promise<boolean>;

/** Retries checkPostgresConnectivity with exponential backoff. Throws on exhaustion. */
export async function waitForPostgresReady(options?: PostgresReadinessOptions): Promise<void>;
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- **Health Probe Protection:** Container probes should poll `/v1/health` at intervals no shorter than 5 seconds.
- **Probe Timeout Discipline:** `checkPostgresConnectivity` enforces a strict 2-second statement timeout to ensure database unresponsiveness does not stall HTTP server event loops or exhaust connection pool slots.

---

## 6. Security, Identity & Credential Governance

- **Least-Privilege Connection:** Application runtime operates under non-superuser role `app_user`.
- **Azure PostgreSQL Authentication:** In staging and production environments, connection strings utilize Azure Managed Identity or Azure Key Vault secrets. TLS/SSL verification is enforced (`ssl: { rejectUnauthorized: true }`).

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Startup vs. Runtime Fault Matrix
| Failure Condition | Lifecycle Phase | System Reaction | Exit Code / Status |
|---|---|---|---|
| PostgreSQL port unreachable | Server Boot | Logs structured error with host/port, retries up to `maxRetries`, then aborts | `process.exit(1)` |
| Database authentication failure | Server Boot | Immediate failure; no retry (unrecoverable without config change) | `process.exit(1)` |
| Database network blip | Runtime (`/v1/health`) | Probing query fails or exceeds 2000 ms timeout | HTTP `503 Service Unavailable` |
| Transient connection drop | Runtime Queries | `pg.Pool` discards dead socket and acquires fresh client | Managed by `pg.Pool` client error handler |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts`.

| Test ID | Description | Acceptance Criteria |
|---|---|---|
| `TEST-PG-01` | Boot check succeeds when DB reachable | Server process boots successfully and logs readiness confirmation. |
| `TEST-PG-02` | Boot check fails when DB unreachable | Process spawned with invalid `PGPORT` exits with non-zero status code after bounded backoff. |
| `TEST-PG-03` | `/v1/health` returns 200 when DB connected | `GET /v1/health` returns `{ status: "ok" }` with 200 status code. |
| `TEST-PG-04` | `/v1/health` returns 503 when DB drops | Simulating connection failure causes `/v1/health` to return `{ status: "unavailable" }` with 503 status code. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/postgres-tenant-db/SKILL.md`:
- **Engine Invariant:** Postgres is the only approved data engine. Do not introduce dialect-neutral abstractions or polyfills that compromise JSONB or RLS capabilities.
- **Health Check Standard:** All application entrypoints must call `waitForPostgresReady()` before starting network listeners.
- **Connection Isolation:** Testing environments must use separate database instances (e.g. `socialengage_test` vs `socialengage_dev`) as specified in ADR-0025.

---

## 10. Observability, Metrics & Operational Telemetry

### 10.1 Telemetry Elements
- **Metrics:**
  - `postgres_readiness_probe_duration_seconds` (histogram)
  - `postgres_connection_failures_total` (counter)
- **Structured Logs:**
  ```json
  {
    "event": "postgres_readiness_check",
    "status": "connected",
    "host": "localhost",
    "database": "socialengage_dev",
    "durationMs": 4
  }
  ```

---

## 11. Migration, Rollout & Feature Gating

- **Prerequisites:** PostgreSQL instance provisioned with extensions `uuid-ossp` and `pgcrypto`.
- **Zero-Downtime Assurance:** Boot-time checks prevent premature ingress traffic during blue-green deployments until the new container's database connection is verified.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0016-1]** Single shared PostgreSQL cluster supporting native JSONB and RLS.
- **[D-0016-1]** `node-postgres` (`pg`) client driver.

### 12.2 Open Questions
- [ ] **[Q-0016-1]** *pgvector Extension Installation:* When will `CREATE EXTENSION IF NOT EXISTS vector;` be added to initial migrations? *(Status: Scheduled for Phase 9 / ADR-0081 RAG ingestion).*
