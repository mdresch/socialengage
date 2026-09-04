# Technical Design Specification (TDS) — Credential Creation Authority Scoped by Ownership Tier

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0028: Credential Creation Authority Scoped by Ownership Tier |
| **Document ID** | `TDS-0028` |
| **Feature Name** | Three-Tier Credential Governance & Role-Gated Authorization Model |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0028` | [ADR-0028: Credential creation authority is scoped by ownership tier](../../adr/0028-credential-creation-authority-scoped-by-ownership-tier.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0028` | [BRD-0028: Credential Creation Authority Scoped by Ownership Tier](../Business-Requirements/BRD-0028-Credential-Creation-Authority-Scoped-By-Ownership-Tier.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0028` | [FDD-0028: Credential Creation Authority Scoped by Ownership Tier](../Functional-Design/FDD-0028-Credential-Creation-Authority-Scoped-By-Ownership-Tier.md) | Fully Aligned |
| **Governing User Story** | `Story 1.7 (ADR-0034)` | [Epic 1: Repository and API Foundation](../../user-stories/epic-1-repository-and-api-foundation.md#story-17--connector-connectdisconnect-crud-endpoints-ownership-tier-aware) | Acceptance Target |
| **Executable Contract Test** | `Story 1.7 Contract` | `contracts/epic-1/story-1.7.connector-crud.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Roles["Identity Principals"]
        PA[Platform Admin]
        TA[Tenant Admin]
        TU[Tenant User]
    end

    subgraph AuthorityTiers["Credential Ownership Tiers"]
        T1["Tier 1: System-Wide<br/>(PROHIBITED FOR 3RD-PARTY SOURCES)"]
        T2["Tier 2: Tenant-Wide<br/>(GNews, Org Pages, App-Only, Azure AI)"]
        T3["Tier 3: User-Bound<br/>(Personal Profiles, User-Level OAuth)"]
    end

    subgraph Operations["API Gateways & Storage"]
        ConnectRoute["POST /v1/connectors/:id/connect"]
        CredTable[("platform_credentials<br/>(tenant_id, user_id, ownership_tier)")]
        RLS[Postgres RLS Engine]
    end

    PA -.->|CANNOT CREATE| T1
    TA -->|AUTHORIZED| T2
    TU -->|AUTHORIZED (Self-Activation Only)| T3
    
    TA -.->|FORBIDDEN ON BEHALF OF USER| T3
    TU -.->|FORBIDDEN (403 Forbidden)| T2
    
    T2 --> ConnectRoute
    T3 --> ConnectRoute
    ConnectRoute --> CredTable
    CredTable --> RLS
```

### 2.2 Architectural Invariants
- **Tier 1 Prohibition Invariant:** System-wide or platform-level credentials for external data sources or AI enrichment are strictly prohibited. Every credential must be scoped to a specific tenant.
- **Tier 2 Tenant-Admin Sole Authority Invariant:** Tenant-wide credentials (representing organizational assets such as Facebook Company Pages, LinkedIn Pages, multi-admin Groups, GNews API keys, and Azure AI Language accounts) may only be created, rotated, or disconnected by callers authenticated with role `tenant_admin`.
- **Tier 3 User-Only Self-Activation Invariant:** User-bound credentials (representing personal accounts, personal profiles, or individual OAuth tokens) must be self-activated by the individual user. Neither `tenant_admin` nor `platform_admin` may create, activate, or authorize a Tier 3 credential on a user's behalf.
- **Decoupling Invariant (Ownership vs. Visibility):** Credential creation authority determines *who controls the connection*; it does not restrict *ingested data visibility*. Data ingested via any tier is normalized and stored with standard `tenant_id` isolation, making it visible to all authorized users within that tenant under ADR-0015.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Definition: `platform_credentials` Tiering Columns
```sql
CREATE TYPE credential_ownership_tier AS ENUM ('tenant_wide', 'user_bound');

ALTER TABLE platform_credentials 
  ADD COLUMN ownership_tier credential_ownership_tier NOT NULL DEFAULT 'tenant_wide',
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Constraint: User-bound credentials MUST specify user_id; Tenant-wide MUST NOT
ALTER TABLE platform_credentials
  ADD CONSTRAINT chk_ownership_tier_user_id
  CHECK (
    (ownership_tier = 'tenant_wide' AND user_id IS NULL) OR
    (ownership_tier = 'user_bound' AND user_id IS NOT NULL)
  );
```

### 3.2 Row-Level Security Rules for Credentials
```sql
-- Normal tenant users can only read/manage their own Tier 3 credentials,
-- while Tenant-Admins can manage Tier 2 credentials and view all tenant credentials
CREATE POLICY platform_credentials_tier_isolation ON platform_credentials
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      -- Tenant Admin sees tenant-wide and all credentials
      current_setting('app.user_role', true) = 'tenant_admin'
      -- Or individual user sees their own user-bound credentials
      OR (ownership_tier = 'user_bound' AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    )
  );
```

---

## 4. API, Interface & Integration Contract Design

### 4.1 Connector CRUD Authorization Logic (`connectorsRouter.ts`)
When registering or activating credentials via `POST /v1/connectors/:id/connect`:

```typescript
export async function handleConnect(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: platformId } = req.params;
  const { credential, ownershipTier } = req.body;
  const caller = req.identity;

  if (ownershipTier === 'tenant_wide') {
    if (caller.role !== 'tenant_admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only Tenant-Admins are authorized to create tenant-wide credentials'
      });
      return;
    }
  } else if (ownershipTier === 'user_bound') {
    // User must activate their own credential
    if (req.body.targetUserId && req.body.targetUserId !== caller.userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Administrators cannot activate user-bound credentials on behalf of another user'
      });
      return;
    }
  }

  // Delegate to envelope encryption store...
}
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- **Rate Limits by Tier:**
  - Tier 2 credentials share a single `RequestGate` bucket per tenant for that platform.
  - Tier 3 credentials instantiate dedicated `RequestGate` buckets keyed by `(tenant_id, platform_id, user_id)` to prevent one user's polling from exhausting another user's personal rate quota.

---

## 6. Security, Identity & Credential Governance

### 6.1 Authority Matrix by Identity Kind
| Action | Platform Admin | Tenant Admin | Tenant User |
|---|---|---|---|
| Create System-Wide Credential | **FORBIDDEN (TDS-0027/28)** | **FORBIDDEN** | **FORBIDDEN** |
| Create Tier 2 Tenant Credential (GNews, Azure AI, Org Pages) | **FORBIDDEN** (No tenant data access) | **AUTHORIZED** | **FORBIDDEN (403)** |
| Disconnect Tier 2 Credential | **FORBIDDEN** | **AUTHORIZED** | **FORBIDDEN (403)** |
| Activate Tier 3 User Credential (Personal Profile) | **FORBIDDEN** | **FORBIDDEN on behalf of user** | **AUTHORIZED (Self only)** |
| View Decrypted Credential | **NEVER** | **NEVER** | **NEVER** |

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Security Violation Exceptions
- `403 Forbidden` (`INSUFFICIENT_CREDENTIAL_AUTHORITY`): Non-admin attempts to register a Tier 2 tenant-wide API key.
- `403 Forbidden` (`CANNOT_ACTIVATE_FOR_OTHER_USER`): Tenant-Admin attempts to supply OAuth token for another employee's personal account.
- `400 Bad Request` (`INVALID_TIER_CONFIGURATION`): Request specifies `user_bound` without a valid caller `userId`.

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-1/story-1.7.connector-crud.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-TIER-01` | Non-admin blocked from Tier 2 credential creation | Call `POST /v1/connectors/gnews/connect` as standard `tenant_user`. Assert HTTP 403 Forbidden. |
| `TEST-TIER-02` | Tenant Admin allowed for Tier 2 creation | Call `POST /v1/connectors/gnews/connect` as `tenant_admin`. Assert HTTP 201 Created. |
| `TEST-TIER-03` | Admin blocked from Tier 3 creation on behalf of user | Call `POST /v1/connectors/reddit/connect` with `ownershipTier: "user_bound"` targeting another user's ID. Assert HTTP 403 Forbidden. |
| `TEST-TIER-04` | User self-activation of Tier 3 succeeds | Call `POST /v1/connectors/reddit/connect` as standard user for own `userId`. Assert HTTP 201 Created and properly linked. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/credential-envelope-encryption/SKILL.md`:
- **Ownership Scope Invariant:** Never create credentials with `ownershipTier = 'system_wide'`.
- **Authority Enforcement Rule:** Authorization checks must occur before DEK decryption or Azure Key Vault interactions.
- **Audit Logging Standard:** Every credential creation and revocation event must record `ownership_tier`, `tenant_id`, and `created_by_user_id`.

---

## 10. Observability, Metrics & Operational Telemetry

- Structured audit log entry:
  ```json
  {
    "event": "credential_registered",
    "tenantId": "...",
    "platformId": "gnews",
    "ownershipTier": "tenant_wide",
    "actorUserId": "...",
    "actorRole": "tenant_admin"
  }
  ```

---

## 11. Migration, Rollout & Feature Gating

- **Schema Migration:** Add `ownership_tier` and `user_id` columns to `platform_credentials` with default `'tenant_wide'` to support backward compatibility for existing credentials.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0028-1]** Platform users are authenticated and possess an explicit role (`tenant_admin` vs `tenant_user`).
- **[D-0028-1]** Story 1.7 (`ADR-0034`) connector CRUD implementation.

### 12.2 Open Questions
- [ ] **[Q-0028-1]** *Delegated Administration:* Will future enterprise tiers require custom RBAC roles with granular permissions (e.g. `connector_manager` separate from `tenant_admin`)? *(Status: Open; deferred to Enterprise RBAC roadmap).*
