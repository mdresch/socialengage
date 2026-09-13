# Technical Design Specification (TDS) — Compliance Audit Pack Generation

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0094: Compliance Audit Pack Generation — Merkle-Tree Hash Chaining, Verifiable Evidence Bundles & Regulatory Export Engine |
| **Document ID** | `TDS-0094` |
| **Feature Name** | Compliance Evidence Bundle Generator & Audit Log Hash Chaining |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/compliance-audit/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0094` | [ADR-0094: Compliance Audit Pack](../../adr/0094-compliance-audit-pack.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0094` | [BRD-0094: Compliance Audit Pack](../Business-Requirements/BRD-0094-Compliance-Audit-Pack.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0094` | [FDD-0094: Compliance Audit Pack](../Functional-Design/FDD-0094-Compliance-Audit-Pack.md) | Fully Aligned |
| **Governing User Story** | `Story 10.14` | [Epic 10: Stories 86–94](../../user-stories/epic-10-adr-0086-to-0094.md) | Acceptance Target |
| **Related User Stories** | `Story 10.11`, `Story 16.3` | Author Takedown, Audit Pack Refinements | Sister Modules |
| **Related Architecture Decisions** | `ADR-0014`, `ADR-0015`, `ADR-0030`, `ADR-0127` | Credential Encryption, Tenant RLS, Admin Audit Log, Merkle Refinements | System Foundation |
| **Executable Contract Tests** | `Story 10.14 Contract` | `social-listening-core/contracts/epic-10/story-10.14.ai-insights-digest.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph AdminConsole["Admin Portal (/tenant/compliance)"]
        ExportBtn["Request Audit Evidence Pack"]
    end

    subgraph AuditPackService["social-listening-core: complianceAuditPackService.ts"]
        Trigger["POST /v1/compliance/audit-pack"]
        Aggregator["Evidence Bundle Aggregator:
        1. Hash-Chained Audit Logs (CSV)
        2. DSR Adjudication Records (CSV)
        3. Access History & Roles (CSV)
        4. Encryption Key Rotation Log (CSV)"]
        Hasher["Manifest Generator (SHA-256 Digest per File)"]
        Zipper["Archiver (manifest.json + Signed Evidence Bundle ZIP)"]
    end

    subgraph Storage["PostgreSQL & Blob Storage"]
        AuditTable["platform_admin_audit_log (with previous_record_hash)"]
        Blob["Azure Blob Storage (Encrypted Export Artifact)"]
    end

    ExportBtn --> Trigger
    Trigger --> Aggregator
    Aggregator --> AuditTable
    Aggregator --> Hasher
    Hasher --> Zipper
    Zipper --> Blob
    Blob -->> AdminConsole
```

### 2.2 Architectural Boundaries & Invariants
- **Merkle-Tree Hash Chaining:** Every row in `platform_admin_audit_log` includes a `previous_record_hash` and a `record_hash` computed over:
  $$\text{record\_hash} = \text{SHA256}(\text{id} \mathbin{\Vert} \text{tenant\_id} \mathbin{\Vert} \text{actor\_id} \mathbin{\Vert} \text{action} \mathbin{\Vert} \text{timestamp} \mathbin{\Vert} \text{previous\_record\_hash})$$
  This forms an unbroken tamper-evident cryptographic ledger, guaranteeing retroactive log tampering is immediately detectable.
- **Machine-Readable `manifest.json`:** Every exported evidence pack includes an authoritative manifest detailing file names, row counts, record hashes, and root Merkle trees.
- **Audit-Ready SOC 2 / ISO 27001 Evidence:** Automatically generates all required regulatory artifacts (role change histories, key rotation timestamps, DSR fulfillment times) without manual database queries.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Hash Chaining Definition
Migration `0073_add_audit_log_hash_chaining.sql`:
```sql
ALTER TABLE platform_admin_audit_log 
    ADD COLUMN IF NOT EXISTS previous_record_hash TEXT,
    ADD COLUMN IF NOT EXISTS record_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_chain 
    ON platform_admin_audit_log (tenant_id, created_at ASC);
```

### 3.2 Evidence Manifest Schema
```typescript
export interface AuditPackManifest {
  manifestVersion: '1.0';
  tenantId: string;
  generatedAt: string;
  coverageWindow: { start: string; end: string };
  merkleRoot: string;
  files: Array<{
    fileName: string;
    sha256: string;
    rowCount: number;
    byteSize: number;
  }>;
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Merkle Root Computation
```typescript
import { createHash } from 'crypto';

export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return createHash('sha256').update('').digest('hex');
  let currentLevel = leafHashes;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = createHash('sha256').update(left + right).digest('hex');
      nextLevel.push(combined);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Endpoint Specification
`POST /v1/compliance/audit-pack`

- **Headers:** `Authorization: Bearer <tenant_admin_token>`
- **Request Body:**
```json
{
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-06-30T23:59:59Z",
  "format": "zip"
}
```
- **Response Format (200 OK):**
```json
{
  "downloadUrl": "https://storage.socialengage.internal/compliance/audit-pack-2026-h1.zip?sas=...",
  "expiresAt": "2026-09-05T16:30:00Z",
  "manifest": {
    "merkleRoot": "a8fbc91298418...1234",
    "filesCount": 4
  }
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Tenant Scoping:** Audit packs strictly extract logs and DSR proof belonging to the caller's tenant.
- **Short-Lived Download SAS:** Generated evidence archives in Azure Blob Storage expire after 15 minutes.

---

## 7. Performance, Scalability & Resource Caps
- Generation executes as a background stream, writing chunks directly to disk/blob to cap server memory consumption at $< 64\text{MB}$.

---

## 8. Resilience, Recovery & Failure Semantics
- If hash verification detects a broken chain during pack assembly, the process terminates with HTTP 500 (`AUDIT_CHAIN_INTEGRITY_VIOLATION`) and alerts the security team.

---

## 9. Observability, Telemetry & Auditability
- Invocations permanently logged: `compliance_audit_pack_exported{tenant_id, merkle_root}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Forward-only additive columns; legacy audit rows have `previous_record_hash = null` as genesis markers.

---

## 11. Verification, Testing & Quality Assurance
- **Story 10.14 Contract:** Validates Merkle root derivation, manifest structure, and audit pack generation.

---

## 12. Open Questions & Future Enhancements

- [x] ~~**[Q-0094-1]** **Merkle tree chaining.**~~ Decided in ADR-0127: Formally adopted for audit log integrity.
- [ ] **[Q-0094-2]** **Third-party auditor portal.** Providing read-only auditor access keys for external compliance reviewers.
