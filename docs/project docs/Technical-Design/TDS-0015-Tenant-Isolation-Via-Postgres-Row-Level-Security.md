# Technical Design Specification (TDS) — Tenant Isolation via Postgres Row-Level Security

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0015: Tenant Isolation via Postgres Row-Level Security |
| **Document ID** | `TDS-0015` |
| **Feature Name** | Database-Enforced Tenant Isolation via Row-Level Security |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0015` | [ADR-0015: Enforce tenant isolation at the database layer with Postgres Row-Level Security](../../adr/0015-tenant-isolation-via-postgres-row-level-security.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0015` | [BRD-0015: Tenant Isolation via Postgres Row-Level Security](../Business-Requirements/BRD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0015` | [FDD-0015: Tenant Isolation via Postgres Row-Level Security](../Functional-Design/FDD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md) | Fully Aligned |
| **Governing User Story** | `Story 5.4` | [Epic 5: Security, Isolation and Messaging](../../user-stories/epic-5-security-isolation-and-messaging.md#story-54--tenant-isolation-via-postgres-row-level-security) | Acceptance Target |
| **Executable Contract Test** | `Story 5.4 Contract` | `contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientLayer["Application Layer (social-listening-core)"]
        Req[Incoming API Request] --> Middleware[Auth & Tenant Resolution Middleware]
        Middleware --> Service[Domain Services / Repositories]
        Service --> WT["withTenant(tenantId, fn, pool, userId)"]
    end

    subgraph DatabaseLayer["Azure Database for PostgreSQL (Single Shared DB)"]
        WT -->|1. BEGIN| PGSession[Connection Session]
        WT -->|2. SELECT set_config('app.tenant_id', tenantId, true)| PGSession
        WT -->|3. Domain Queries (SELECT/INSERT/UPDATE/DELETE)| PGSession
        WT -->|4. COMMIT / ROLLBACK| PGSession
        
        PGSession --> RLS_Engine[Postgres RLS Engine]
        
        subgraph TablesWithRLS["RLS-Protected Tables (FORCE ROW LEVEL SECURITY)"]
            T1[(social_posts)]
            T2[(authors)]
            T3[(watchlists)]
            T4[(ingestion_runs)]
            T5[(platform_credentials)]
            T6[(rag_chunks)]
            T7[(tenants)]
        end
        
        RLS_Engine -->|USING / WITH CHECK| TablesWithRLS
    end
```

### 2.2 Architectural Boundaries & Invariants
- **Database Boundary:** Multi-tenancy is enforced in a single shared PostgreSQL database instance. No physical database-per-tenant or schema-per-tenant exists.
- **Fail-Closed Invariant:** If `app.tenant_id` is missing, empty string `''`, or does not match a row's `tenant_id`, Postgres RLS evaluates to `NULL` (falsy), returning zero rows. It never leaks data across tenants.
- **Mandatory Wrapper Invariant:** All queries touching tenant-scoped tables must be wrapped in `withTenant<T>(tenantId, fn, pool?, userId?)`. Direct invocations of `pool.query(...)` against tenant tables without `withTenant` run without session context and return zero rows.
- **Role Boundary:** RLS is strictly enforced against non-superuser, non-owner database roles (specifically `app_user`). Superusers bypass RLS by Postgres definition; hence the app runtime connects solely as `app_user`.
- **Table Owner Defense-in-Depth:** Every tenant table explicitly executes `ALTER TABLE ... FORCE ROW LEVEL SECURITY` so that even table owners cannot accidentally bypass RLS unless specifically configured with `BYPASSRLS`.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL & Row-Level Security Definition Pattern
Every table carrying `tenant_id` UUID must enforce RLS using the following migration standard:

```sql
-- Create non-superuser app role if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON <table_name> TO app_user;

-- Enable and FORCE Row-Level Security
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Definition
DROP POLICY IF EXISTS tenant_isolation ON <table_name>;
CREATE POLICY tenant_isolation ON <table_name>
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

### 3.2 Special Table Policies
- **`tenants` Table:** Scoped by its primary key `id` rather than `tenant_id`:
  ```sql
  CREATE POLICY tenant_isolation_on_tenants ON tenants
    FOR ALL
    USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  ```
- **`watchlists` Table:** Supports dual tenant and optional user-level scoping (`app.user_id`):
  ```sql
  CREATE POLICY watchlist_tenant_user_isolation ON watchlists
    FOR ALL
    USING (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND (
        user_id IS NULL 
        OR NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    );
  ```

### 3.3 The `NULLIF(..., '')` RLS Custom GUC Nuance
In PostgreSQL connection pooling:
1. When a transaction sets a custom GUC via `set_config('app.tenant_id', tenantId, true)` with `is_local=true`, the value resets when the transaction ends (`COMMIT`/`ROLLBACK`).
2. However, custom GUCs (unlike built-in Postgres settings) have no registered default; once set on a connection, PostgreSQL resets them to an empty string `''` rather than `NULL` on connection reuse.
3. Casting `''::uuid` immediately throws a PostgreSQL runtime error: `invalid input syntax for type uuid: ""`.
4. Wrapping with `NULLIF(current_setting('app.tenant_id', true), '')::uuid` normalizes empty strings to `NULL`.
5. In PostgreSQL, `tenant_id = NULL` evaluates to `NULL` (falsy in SQL boolean logic), causing the policy to cleanly and safely fail closed (0 rows) without crashing the connection.

---

## 4. API, Interface & Integration Contract Design

### 4.1 TypeScript Implementation Contract: `withTenant`
Located at `social-listening-core/src/db/withTenant.ts`:

```typescript
import { Pool, PoolClient } from 'pg';
import { getPool } from './pool';

/**
 * The only sanctioned way to run a tenant-scoped query (ADR-0015).
 * Sets the RLS session context via set_config(..., true) inside an explicit transaction.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
  pool: Pool = getPool(),
  userId?: string
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    if (userId !== undefined) {
      await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

### 4.2 Cross-Tenant / Platform-Admin Bypass Interface
Governed by ADR-0030 / Story 5.7:
- Dedicated pool `getPlatformAdminPool()` connecting as a specific role (`platform_admin_role`) granted `BYPASSRLS`.
- Dedicated pool `getTenantDeletionPool()` connecting as `tenant_deletion_role` (which does *not* bypass RLS, ensuring deletion queries still require tenant context).

---

## 5. Rate Limiting, Concurrency & Flow Control

- **Connection Pool Contention:** Since each `withTenant` call acquires a dedicated client from `pg.Pool` for the duration of the transaction, connection checkouts must be kept as short as possible.
- **Statement Timeout:** To prevent orphaned transactions from exhausting the connection pool, connection pools specify a statement timeout (default 30,000 ms) and connection acquire timeout.
- **No Direct HTTP Rate Limits on RLS:** Flow control is handled at the HTTP layer via `RequestGate` before the database session is opened.

---

## 6. Security, Identity & Credential Governance

### 6.1 RBAC & Role Enforcement Matrix
| Role | Can Access Superuser Privileges? | RLS Enforced? | Purpose |
|---|---|---|---|
| `postgres` (migration runner) | Yes (Table Owner / Superuser) | No | Schema migrations, DDL, role provisioning |
| `app_user` | No (Least privilege `LOGIN`) | **YES (FORCED)** | Standard application runtime queries |
| `platform_admin_role` | No | Bypassed via `BYPASSRLS` | Emergency break-glass & platform ops (ADR-0030) |
| `tenant_deletion_role` | No | **YES** | Tenant-initiated offboarding (ADR-0043) |

### 6.2 Credential Protection
- `app_user` credentials in development are local/ephemeral.
- In production (Azure Database for PostgreSQL), Managed Identity or Azure Key Vault secrets are injected via environment variables (`PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`).

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Error Scenarios & Behaviors
| Scenario | Observed Behavior | Root Cause | Handling Strategy |
|---|---|---|---|
| Query issued without `withTenant` | Returns 0 rows (SELECT) or affects 0 rows (UPDATE/DELETE) | Session GUC `app.tenant_id` is unset (`NULL`) | Fail-closed by design; detect via contract tests |
| Missing `NULLIF(..., '')` in policy | Throws `invalid input syntax for type uuid: ""` | Custom GUC resets to `''` on connection reuse | Migration review invariant: all policies must include `NULLIF(..., '')` |
| Invalid UUID passed to `withTenant` | Database throws syntax error on `set_config` or policy evaluation | Malformed tenant ID | Validation middleware rejects non-UUID tenant identifiers with HTTP 400 |
| Pool exhaustion under load | `timeout exceeded when acquiring client` | Long-running queries inside `withTenant` transaction | Enforce statement timeout and avoid external I/O inside `withTenant` block |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-RLS-01` | Isolation between Tenant A and Tenant B | Seed posts for Tenant A and Tenant B. Execute unfiltered query under Tenant A context; assert zero Tenant B rows returned. |
| `TEST-RLS-02` | Unset context fails closed | Execute query without `withTenant` (no `app.tenant_id` set); assert zero rows returned. |
| `TEST-RLS-03` | Schema completeness verification | Inspect `information_schema.columns` for `tenant_id` and cross-reference with `pg_tables` where `rowsecurity = true`; assert 100% coverage. |
| `TEST-RLS-04` | Insert cross-tenant rejection | Attempt to `INSERT` a row with `tenant_id = 'B'` while session context is `app.tenant_id = 'A'`; assert `WITH CHECK` policy violation error. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/postgres-tenant-db/SKILL.md`:
- **Load-Bearing Invariant:** Every new table with `tenant_id` must include `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and the canonical policy with `NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
- **Runtime Rule:** Never invoke `pool.query` directly for tenant-scoped operations; always invoke via `withTenant(tenantId, fn)`.
- **Transaction Discipline:** Do not perform network calls, third-party API fetches, or long-running computations inside the `withTenant` callback, as it holds a PostgreSQL connection and active transaction.

---

## 10. Observability, Metrics & Operational Telemetry

### 10.1 Structured Logging
- Transaction start and completion logged at `debug` level with `tenant_id`.
- Policy violation errors (`42501` insufficient privilege or `44000` with check option violation) logged at `error` level with structured metadata:
  ```json
  {
    "event": "rls_policy_violation",
    "tenantId": "...",
    "error": "new row violates row-level security policy for table social_posts"
  }
  ```

### 10.2 Platform Metrics
- `db_query_duration_ms` partitioned by table and operation.
- `db_connection_pool_waiting_clients` to alert on pool starvation.

---

## 11. Migration, Rollout & Feature Gating

- **Rollout Strategy:** Database migrations are strictly sequential and versioned (`migrations/0002_enable_rls_social_posts.sql`, `migrations/0046_...`, etc.).
- **Zero-Downtime Guarantee:** Adding RLS to an existing table locks the table briefly for `ALTER TABLE`; during active traffic, migrations must run during maintenance windows or use non-exclusive lock patterns.
- **Rollback Procedure:** Drop policy and disable RLS via compensating migration if necessary, though in practice RLS is an immutable security baseline.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0015-1]** Single shared PostgreSQL database for all tenants.
- **[A-0015-2]** Application connections run as the unprivileged `app_user` role.
- **[D-0015-1]** PostgreSQL version $\ge 14$ supporting `FORCE ROW LEVEL SECURITY` and transaction-local `set_config(..., true)`.

### 12.2 Open Questions
- [ ] **[Q-0015-1]** *Dynamic Schema Auditing:* Should CI include an automated schema lint script that fails the build if any table with a `tenant_id` column lacks `rowsecurity = true` in `pg_tables`? *(Status: Accepted in principle via Story 5.4 contract test; migration hook script deferred).*
