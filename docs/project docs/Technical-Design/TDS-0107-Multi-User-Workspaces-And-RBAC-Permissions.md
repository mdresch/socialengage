# Technical Design Specification (TDS) — Multi-User Workspaces & RBAC Permissions

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0107: Multi-User Workspaces & Fine-Grained RBAC Permissions — Watchlist Resource Sharing, Permission Matrix & Tenant-Bounded Collaboration |
| **Document ID** | `TDS-0107` |
| **Feature Name** | Multi-User Workspace Sharing & Fine-Grained Resource RBAC |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/workspace-rbac/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0107` | [ADR-0107: Multi-User Workspaces and RBAC Permissions](../../adr/0107-multi-user-workspaces-and-rbac-permissions.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0107` | [BRD-0107: Multi-User Workspaces And RBAC Permissions](../Business-Requirements/BRD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0107` | [FDD-0107: Multi-User Workspaces And RBAC Permissions](../Functional-Design/FDD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md) | Fully Aligned |
| **Governing User Story** | `Story 12.13` | [Epic 12: Stories 101–108](../../user-stories/epic-12-adr-0101-to-0108.md#story-1213--multi-user-workspaces-and-rbac-permissions-backend) | Acceptance Target |
| **Related User Stories** | `Story 12.14`, `Story 13.5` | Workspace Settings UI, Feature Gating | Downstream Modules |
| **Related Architecture Decisions** | `ADR-0015`, `ADR-0032`, `ADR-0044`, `ADR-0112` | Tenant RLS, Users Table, Watchlist CRUD, Seat Limits | System Architecture |
| **Executable Contract Tests** | `Story 12.13 & 12.14 Contracts` | `social-listening-core/contracts/epic-12/story-12.13.multi-user-workspaces-rbac.contract.test.ts`<br>`social-listening-admin/contracts/epic-12/story-12.14.workspace-settings-ui.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Users["Tenant Users (Same Tenant)"]
        Owner["Owner User (Alice)"]
        Collaborator["Collaborator User (Bob)"]
    end

    subgraph Service["social-listening-core: RBAC & Sharing Service"]
        ShareRoute["POST /v1/watchlists/:id/shares"]
        PermMatrix["permissionMatrix.ts (hasPermission / requirePermission)"]
        Store["watchlistShareStore.ts"]
    end

    subgraph Database["PostgreSQL Storage (Tenant RLS)"]
        WL["watchlists (owner_id = Alice)"]
        Shares["watchlist_shares Table
        (tenant_id, watchlist_id, user_id, permission: 'read' | 'edit' | 'admin')"]
    end

    Owner -->|Share Watchlist with Bob (permission: 'edit')| ShareRoute
    ShareRoute --> PermMatrix
    PermMatrix -->|Verify Alice owns WL or has 'admin'| Store
    Store --> Shares
    
    Collaborator -->|GET /v1/watchlists| Store
    Store -->|Return Owned + Shared Watchlists| Collaborator
```

### 2.2 Architectural Boundaries & Invariants
- **Strict Same-Tenant Sharing Invariant:** Resource sharing is strictly bounded within the tenant. Attempting to share a watchlist with a `userId` belonging to a different tenant is rejected with HTTP 400 (`CROSS_TENANT_SHARE_FORBIDDEN`).
- **Granular Share Permissions:**
  - `read`: View matched posts, analytics, and watchlist boolean query.
  - `edit`: Modify keywords, boolean AST, and connector bindings.
  - `admin`: Full control, including sharing with additional team members and deletion.
- **Role Hierarchy & Ownership Precedence:** A `tenant_admin` retains administrative override on all resources in their tenant. For standard `tenant_user` accounts, ownership or explicit `watchlist_shares` grants dictate access.
- **Tenant RLS Integration:** Table `watchlist_shares` enforces PostgreSQL Row-Level Security via `tenant_id = current_setting('app.current_tenant_id', true)::uuid`.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Schema Definition
Migration `0074_create_watchlist_shares.sql`:
```sql
CREATE TABLE IF NOT EXISTS watchlist_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('read', 'edit', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_watchlist_user_share UNIQUE (tenant_id, watchlist_id, user_id)
);

ALTER TABLE watchlist_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY watchlist_shares_tenant_isolation ON watchlist_shares
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_watchlist_shares_user ON watchlist_shares (tenant_id, user_id);
```

### 3.2 TypeScript Share Interface
```typescript
export type SharePermission = 'read' | 'edit' | 'admin';

export interface WatchlistShare {
  id: string;
  tenantId: string;
  watchlistId: string;
  userId: string;
  permission: SharePermission;
  createdAt: string;
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Permission Matrix Enforcement
Implemented in `social-listening-core/src/auth/permissionMatrix.ts`:

```typescript
export function hasPermission(
  userRole: 'tenant_user' | 'tenant_admin',
  sharePermission: SharePermission | null,
  requiredAction: 'read' | 'edit' | 'admin'
): boolean {
  // Tenant admin always has full privileges
  if (userRole === 'tenant_admin') return true;
  if (!sharePermission) return false;

  const PERMISSION_HIERARCHY: Record<SharePermission, number> = {
    read: 1,
    edit: 2,
    admin: 3,
  };

  const ACTION_WEIGHTS: Record<'read' | 'edit' | 'admin', number> = {
    read: 1,
    edit: 2,
    admin: 3,
  };

  return PERMISSION_HIERARCHY[sharePermission] >= ACTION_WEIGHTS[requiredAction];
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Sharing REST Endpoints
- `POST /v1/watchlists/:id/shares`: Shares watchlist with a colleague.
  - Body: `{ "userId": "usr-123", "permission": "edit" }`
  - Returns: `201 Created`
- `GET /v1/watchlists/:id/shares`: Lists all collaborators on a watchlist.
- `DELETE /v1/watchlists/:id/shares/:userId`: Revokes access for a collaborator.

---

## 6. Security, Tenancy & Isolation Model
- **Cross-Tenant Guard:** Sharing validation checks:
  `SELECT tenant_id FROM users WHERE id = target_user_id AND tenant_id = current_tenant_id`
  If zero rows match, the request fails with HTTP 400.

---

## 7. Performance, Scalability & Resource Caps
- Querying a user's combined watchlists (owned + shared) uses a unified indexed `UNION` query, completing in $< 10\text{ms}$.

---

## 8. Resilience, Recovery & Failure Semantics
- Cascading deletes ensure that if a user or watchlist is deleted, referencing `watchlist_shares` rows are purged automatically.

---

## 9. Observability, Telemetry & Auditability
- Invocations logged in audit records: `watchlist_share_granted{watchlist_id, target_user, permission}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Non-breaking additive table. Legacy single-user watchlists default to owned-only visibility.

---

## 11. Verification, Testing & Quality Assurance
- **Story 12.13 Contract:** `social-listening-core/contracts/epic-12/story-12.13.multi-user-workspaces-rbac.contract.test.ts`
  - Validates share creation, update, and revocation.
  - Proves permission matrix hierarchy (`read < edit < admin`).
  - Verifies rejection of cross-tenant user sharing.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0107-1]** **Team / Group sharing.** Allowing watchlists to be shared with functional teams (e.g. "Marketing Team") rather than individual users.
