# Technical Design Specification (TDS) — Compliance Audit Pack Refinements

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0127: Compliance Audit Pack Refinements — Merkle-Tree Hash Chaining & Verifiable Evidence Bundle Manifests |
| **Document ID** | `TDS-0127` |
| **Feature Name** | Tamper-Evident Audit Ledger Chaining & SOC 2 / ISO 27001 Verifiable Manifest Packages |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/compliance/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0127` | [ADR-0127: Compliance Audit Pack Refinements](../../adr/0127-compliance-audit-pack-refinements.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0127` | [BRD-0127: Compliance Audit Pack Refinements](../Business-Requirements/BRD-0127-Compliance-Audit-Pack-Refinements.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0127` | [FDD-0127: Compliance Audit Pack Refinements](../Functional-Design/FDD-0127-Compliance-Audit-Pack-Refinements.md) | Fully Aligned |
| **Governing User Story** | `Story 16.3` | [Epic 16: Privacy, Governance & Ops](../../user-stories/epic-16-adr-0125-to-0128.md#story-163--cryptographic-audit-log-hash-chaining-and-manifest-export-backend) | Acceptance Target |
| **Related User Stories** | `Story 10.14`, `Story 10.15` | Compliance Audit Pack Generator, Trust & Compliance Export UI | Upstream Foundations |
| **Related Architecture Decisions** | `ADR-0094`, `ADR-0031`, `ADR-0043`, `ADR-0126` | Base Compliance Pack, Tenant Audit Log, Deletion Audit, DSR Receipts | System Architecture |
| **Executable Contract Tests** | `Story 16.3 Contract` | `social-listening-core/contracts/epic-16/story-16.3.audit-hash-chaining-manifest.contract.test.ts` | Ready for Suite Execution |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph AdminActions["Administrative Actions"]
        TenantAction["Tenant Admin Mutation (RBAC, Watchlist, DSR)"]
        PlatformAction["Platform Admin Operation (Plan, Bypass)"]
    end

    subgraph LoggingEngine["social-listening-core Audit Engine"]
        AuditWriter["Audit Log Appender"]
        HashCalculator["SHA-256 Ledger Chaining Engine"]
        PackBuilder["Audit Pack Generator"]
    end

    subgraph Storage["PostgreSQL Ledger"]
        AuditLog["platform_admin_audit_log & tenant_audit_log
        - previous_record_hash: TEXT
        - record_hash: TEXT
        - actor_id, action, timestamp, payload"]
    end

    subgraph OutputArchive["Exported Evidence Bundle (ZIP)"]
        CSVFiles["audit_logs.csv / dsr_proof_logs.csv"]
        ManifestJSON["manifest.json
        - SHA-256 checksums per file
        - Merkle root hash
        - Generator signature"]
    end

    TenantAction --> AuditWriter
    PlatformAction --> AuditWriter
    AuditWriter --> HashCalculator
    HashCalculator -->|Compute H(prev_hash + entry)| AuditLog
    
    PackBuilder -->|Query Time Range & Verify Chain| AuditLog
    PackBuilder --> CSVFiles
    PackBuilder -->|Compute Merkle Root & File Digests| ManifestJSON
    CSVFiles --> OutputArchive
    ManifestJSON --> OutputArchive
```

### 2.2 Architectural Boundaries & Invariants
- **Cryptographic Hash Chaining Invariant:** Every record in the audit log stores `previous_record_hash` and `record_hash`. The `record_hash` is computed deterministically as:
  $$\text{record\_hash} = \text{SHA-256}(\text{id} \parallel \text{tenant\_id} \parallel \text{actor\_id} \parallel \text{action} \parallel \text{timestamp} \parallel \text{canonical\_payload} \parallel \text{previous\_record\_hash})$$
- **Genesis Block Invariant:** The initial record for each tenant ledger (or platform ledger) uses a fixed 64-character zero string:
  `0000000000000000000000000000000000000000000000000000000000000000`.
- **Tamper Evidence & Non-Repudiation:** Any modification, back-dating, or deletion of a historical row invalidates all downstream hashes in the ledger chain. Verification tools detect tampering in $O(N)$ sequential verification time.
- **Machine-Readable Audit Manifest Invariant:** Every compliance export package generates a root `manifest.json` containing SHA-256 digests for all generated CSV files, row counts, and the Merkle root hash of the included records.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Schema Definition
Migration `0082_add_audit_log_hash_chaining.sql`:
```sql
ALTER TABLE platform_admin_audit_log
ADD COLUMN IF NOT EXISTS previous_record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
ADD COLUMN IF NOT EXISTS record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';

CREATE INDEX IF NOT EXISTS idx_audit_log_record_hash 
ON platform_admin_audit_log (record_hash);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_seq 
ON platform_admin_audit_log (tenant_id, created_at ASC);
```

### 3.2 TypeScript Contracts & Manifest Structure
`social-listening-core/src/compliance/types.ts`:
```typescript
export interface AuditLogChainEntry {
  id: string;
  tenantId: string | null;
  actorId: string;
  action: string;
  timestamp: string;
  payload: Record<string, unknown>;
  previousRecordHash: string;
  recordHash: string;
}

export interface FileDigestEntry {
  path: string;
  sha256: string;
  rowCount: number;
  byteSize: number;
}

export interface ComplianceAuditPackManifest {
  manifestVersion: '1.0.0';
  packId: string;
  tenantId: string;
  generatedAt: string;
  timeRange: {
    startDate: string;
    endDate: string;
  };
  merkleRootHash: string;
  files: FileDigestEntry[];
  verificationSignature: string;
}
```

---

## 4. Application Logic & Workflows

### 4.1 Chained Append Algorithm
```typescript
import { createHash } from 'crypto';

export async function appendChainedAuditLog(
  client: PoolClient,
  entry: Omit<AuditLogChainEntry, 'id' | 'previousRecordHash' | 'recordHash'>
): Promise<AuditLogChainEntry> {
  // 1. Lock the latest record to guarantee sequential ordering
  const lastRow = await client.query(
    `SELECT record_hash FROM platform_admin_audit_log 
     WHERE (tenant_id = $1 OR ($1 IS NULL AND tenant_id IS NULL))
     ORDER BY created_at DESC, id DESC 
     LIMIT 1 FOR UPDATE`,
    [entry.tenantId]
  );

  const previousRecordHash = lastRow.rows[0]?.record_hash || 
    '0000000000000000000000000000000000000000000000000000000000000000';

  const id = randomUUID();
  const canonicalPayload = JSON.stringify(entry.payload, Object.keys(entry.payload).sort());
  const serialized = `${id}|${entry.tenantId || ''}|${entry.actorId}|${entry.action}|${entry.timestamp}|${canonicalPayload}|${previousRecordHash}`;
  
  const recordHash = createHash('sha256').update(serialized).digest('hex');

  await client.query(
    `INSERT INTO platform_admin_audit_log 
     (id, tenant_id, actor_id, action, created_at, payload, previous_record_hash, record_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, entry.tenantId, entry.actorId, entry.action, entry.timestamp, entry.payload, previousRecordHash, recordHash]
  );

  return { ...entry, id, previousRecordHash, recordHash };
}
```

### 4.2 Manifest Generation & Merkle Root Computation
```typescript
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return '0000000000000000000000000000000000000000000000000000000000000000';
  let currentLevel = [...hashes];

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

## 5. Interface & API Contracts

### 5.1 Route Catalog
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/v1/compliance/audit-packs` | Tenant-Admin, Compliance-Officer | Initiates generation of chained audit bundle with `manifest.json` |
| `GET` | `/v1/compliance/audit-packs/:id/download` | Tenant-Admin, Compliance-Officer | Downloads verified ZIP evidence archive |
| `GET` | `/v1/compliance/audit-log/verify` | Tenant-Admin, Platform-Admin | Verifies continuous cryptographic hash chain integrity |

### 5.2 Evidence Bundle `manifest.json` Contract
```json
{
  "manifestVersion": "1.0.0",
  "packId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "generatedAt": "2026-09-05T15:00:00.000Z",
  "timeRange": {
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-09-01T00:00:00.000Z"
  },
  "merkleRootHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "files": [
    {
      "path": "audit_logs.csv",
      "sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      "rowCount": 1420,
      "byteSize": 128450
    },
    {
      "path": "dsr_proof_logs.csv",
      "sha256": "eed85764d262ff038e2d4240a5a3a29ec97b5e4c02f0a1c6a2e4c85244585e51",
      "rowCount": 18,
      "byteSize": 4920
    }
  ],
  "verificationSignature": "a3b98c..."
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Append-Only Immutability:** Row-level permissions on `platform_admin_audit_log` revoke `UPDATE` and `DELETE` privileges for application connection roles, allowing `INSERT` and `SELECT` only.
- **Tenant-Specific Sub-Ledgers:** Tenant audit chains calculate previous hashes within their isolated `tenant_id` scope, preventing cross-tenant leakage of action frequencies or volume.
- **Independent Auditor Verification:** External auditors can verify `manifest.json` offline using standard UNIX utilities (`sha256sum -c`) without requiring access to SocialEngage source code or databases.

---

## 7. Performance, Scalability & Resource Caps
- **Sequential Row Lock Bounding:** Hash calculation uses `FOR UPDATE` on only the single preceding record, holding transaction locks for $< 2\text{ms}$.
- **Export Streaming:** Large audit pack CSV exports stream directly to Blob storage, piping row chunks through crypto hash streams to calculate file digests without buffering in memory.

---

## 8. Resilience, Recovery & Failure Semantics
- **Chain Break Isolation:** If an administrative system failure causes an invalid hash, `GET /v1/compliance/audit-log/verify` pinpoints the exact row ID and timestamp of divergence, allowing remediation without corrupting subsequent blocks.

---

## 9. Observability, Telemetry & Auditability
- **Integrity Telemetry:**
  - `audit_log_records_chained_total{tenant_id}`
  - `audit_pack_manifests_generated_total{tenant_id}`
  - `audit_log_chain_verification_failures_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Migration Plan:** `0082_add_audit_log_hash_chaining.sql` populates initial hashes for legacy unchained records using deterministic sequential replay.
- **Rollback:** Columns can be deprecated; export bundles omit `manifest.json` if refinement flag is disabled.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-16/story-16.3.audit-hash-chaining-manifest.contract.test.ts`:
  - (1) Proves sequential insertion links `previous_record_hash` to preceding row's `record_hash`.
  - (2) Simulates row data modification and asserts chain verification detects breakage.
  - (3) Proves generated export bundle contains valid `manifest.json` matching file SHA-256 checksums.
  - (4) Validates correct Merkle root calculation across exported log entries.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0127-1]** **Global vs. Tenant Hash Ledgers:** Evaluating dual chaining: maintaining a tenant sub-chain alongside an immutable platform-wide master ledger.
- [ ] **[Q-0127-2]** **Ed25519 Manifest Signing:** Adding asymmetric hardware security module (HSM) signing keys for exported audit manifests.
- [ ] **[Q-0127-3]** **Periodic Chain Health Cron:** Setting up an automated daily background cron task to verify audit chain continuity and alert on tampering.
