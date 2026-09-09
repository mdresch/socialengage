# Technical Design Specification (TDS) — Tenants Table Shape

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0031: Tenants Table Shape & Self-Referential RLS |
| **Document ID** | `TDS-0031` |
| **Feature Name** | Canonical Tenant Entity Persistence & Self-Scoped RLS |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/tenants/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0031` | [ADR-0031: `tenants` table shape and its own Row-Level Security policy](../../adr/0031-tenants-table-shape.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0031` | [BRD-0031: `tenants` Table Shape](../Business-Requirements/BRD-0031-Tenants-Table-Shape.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0031` | [FDD-0031: `tenants` Table Shape](../Functional-Design/FDD-0031-Tenants-Table-Shape.md) | Fully Aligned |
| **Governing User Story** | `Story 5.8` | [Epic 5: Security, Isolation and Messaging](../../user-stories/epic-5-security-isolation-and-messaging.md#story-58--tenants-table-shape-and-its-own-row-level-security-policy) | Acceptance Target |
| **Executable Contract Test** | `Story 5.8 Contract` | `contracts/epic-5/story-5.8.tenants-table-shape.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientRequests["Client Ingress"]
        TAReq["Tenant Admin Request (GET /v1/tenant/settings)"]
        PAReq["Platform Admin Request (POST /v1/platform-admin/tenants)"]
    end

    subgraph ServiceLayer["Core Domain Services"]
        TenantStore["src/tenants/tenantStore.ts"]
    end

    subgraph DatabaseLayer["PostgreSQL Persistence"]
        TenantsTable[("tenants table<br/>(id, name, status, license_seat_count, active_seat_count, domain)")]
        RLSPolicy["RLS Policy: USING (id = app.tenant_id)"]
    end

    TAReq -->|withTenant(tenantId)| TenantStore
    PAReq -->|platformAdminPool (BYPASSRLS)| TenantStore
    
    TenantStore -->|Scoping by app.tenant_id| RLSPolicy
    RLSPolicy -->|Row-Filtered Query| TenantsTable
    TenantStore -->|Unfiltered Cross-Tenant Query| TenantsTable
```

### 2.2 Architectural Boundaries & Invariants
- **Primary Key Scoping Invariant:** Unlike content tables carrying a `tenant_id` foreign key, the `tenants` table enforces RLS where `id` matches `current_setting('app.tenant_id')`.
- **Self-Service Read Invariant:** Tenant-Admin can read their own tenant metadata (`name`, `status`, `license_seat_count`, `active_seat_count`) via the standard `app_user` connection pool using `withTenant()`.
- **Administrative Modification Invariant:** Only Platform Admin (via `platform_admin_role`) may create new tenants, alter `license_seat_count`, or change `status` (`active` vs `suspended`).
- **Atomic Seat Counting:** `active_seat_count` increments and decrements are performed transactionally during user onboarding/offboarding, guarding against license over-allocation.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Specification
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  license_seat_count INTEGER NOT NULL CHECK (license_seat_count > 0),
  active_seat_count INTEGER NOT NULL DEFAULT 0 CHECK (active_seat_count >= 0),
  domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_seat_limit CHECK (active_seat_count <= license_seat_count)
);

CREATE INDEX idx_tenants_domain ON tenants(domain);

-- Enable and Force RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

-- Self-referential RLS Policy
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

### 3.2 Concurrency Defense: Atomic Seat Allocation
To prevent race conditions during concurrent user invitations:
```sql
-- Atomic seat increment with concurrency protection
UPDATE tenants
SET active_seat_count = active_seat_count + 1,
    updated_at = NOW()
WHERE id = $1 AND active_seat_count < license_seat_count
RETURNING active_seat_count, license_seat_count;
```

---

## 4. API, Interface & Integration Contract Design

### 4.1 TypeScript Repository Contract (`src/tenants/tenantStore.ts`)
```typescript
export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  licenseSeatCount: number;
  activeSeatCount: number;
  domain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  licenseSeatCount: number;
  domain?: string | null;
}

export interface TenantStore {
  getTenant(client: PoolClient, tenantId: string): Promise<Tenant | null>;
  createTenant(client: PoolClient, input: CreateTenantInput): Promise<Tenant>;
  updateStatus(client: PoolClient, tenantId: string, status: 'active' | 'suspended'): Promise<Tenant>;
  setLicenseSeats(client: PoolClient, tenantId: string, licenseSeatCount: number): Promise<Tenant>;
  incrementActiveSeats(client: PoolClient, tenantId: string): Promise<boolean>;
  decrementActiveSeats(client: PoolClient, tenantId: string): Promise<void>;
}
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- Tenant creation is rate-limited via `signupRateLimit.ts` to prevent domain squatting and DoS attacks against the shared PostgreSQL cluster.
- `SELECT ... FOR UPDATE` locks are applied only on high-contention seat allocations.

---

## 6. Security, Identity & Credential Governance

- Standard tenant users cannot execute `UPDATE` or `DELETE` on `tenants`.
- `platform_admin_role` has explicit `GRANT SELECT, INSERT, UPDATE ON tenants TO platform_admin_role`, but `active_seat_count` is maintained exclusively by the core application runtime.

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Domain Errors
| Error Condition | HTTP Code | Error Code | Description |
|---|---|---|---|
| Seat limit exceeded | 409 Conflict | `LICENSE_SEAT_LIMIT_REACHED` | Cannot invite user; all licensed seats occupied |
| Tenant suspended | 403 Forbidden | `TENANT_SUSPENDED` | Access blocked for users belonging to suspended tenant |
| Tenant not found | 404 Not Found | `TENANT_NOT_FOUND` | Tenant ID does not exist or blocked by RLS |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-5/story-5.8.tenants-table-shape.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-TNT-01` | Tenant isolation on `tenants` table | Seed Tenant A and Tenant B. Execute `SELECT * FROM tenants` under Tenant A session context; assert only Tenant A row returned. |
| `TEST-TNT-02` | Platform Admin can view all tenants | Execute query using `platformAdminPool`; assert visibility of both Tenant A and Tenant B rows. |
| `TEST-TNT-03` | Seat counter overflow prevention | Set `licenseSeatCount = 1`, `activeSeatCount = 1`. Attempt atomic increment; assert operation fails and returns false. |
| `TEST-TNT-04` | Domain indexing lookup | Verify that query searching by `domain` leverages index and matches correctly. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/tenants/SKILL.md`:
- **RLS Policy Invariant:** `tenants` uses `id = app.tenant_id` for its RLS check, not `tenant_id`.
- **Seat Allocation Invariant:** Always use atomic SQL increment checks rather than read-then-write application logic.
- **Domain Rerouting Standard:** When a user registers with a corporate email, check `tenants.domain` for existing organizational tenants before provisioning a new one.

---

## 10. Observability, Metrics & Operational Telemetry

- **Metrics:**
  - `tenants_total{status}` (gauge)
  - `tenant_seat_utilization_ratio{tenant_id}` (gauge: `active / license`)
- **Structured Audit Logs:**
  ```json
  {
    "event": "tenant_provisioned",
    "tenantId": "...",
    "name": "Acme Corp",
    "domain": "acme.com",
    "licenseSeats": 10
  }
  ```

---

## 11. Migration, Rollout & Feature Gating

- Migration `migrations/0004_create_tenants_table.sql` creates table and installs self-referential RLS policy.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0031-1]** Primary key is a valid UUIDv4.
- **[D-0031-1]** Postgres CHECK constraints enforced on seat counts.

### 12.2 Open Questions
- [x] **[Q-0031-1]** *Seat Race Condition:* Resolved via atomic SQL conditional update (`WHERE active_seat_count < license_seat_count`).
- [ ] **[Q-0031-2]** *Public Email Domain Exclusion:* Maintain an allowlist/denylist of public email providers (gmail.com, outlook.com) to prevent squatting of public domains in `tenants.domain`. *(Status: Tracked in Story 5.12 / ADR-0037).*
