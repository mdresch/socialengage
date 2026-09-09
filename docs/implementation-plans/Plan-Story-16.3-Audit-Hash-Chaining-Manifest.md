# Implementation Plan — Story 16.3: Cryptographic Audit Log Hash Chaining & Manifest Export (Backend)

## 1. Traceability Matrix & Governing Specifications

| Artifact | Identifier | Status / Mapping |
|---|---|---|
| **Architecture Decision Record** | `ADR-0127` | Accepted (2026-08-28) — Merkle-tree hash chaining & verifiable evidence bundles |
| **Business Requirements Document** | `BRD-0127` | Approved — BR-127.1 (Merkle hash chained audit logs), BR-127.2 (Machine-verifiable manifest) |
| **Functional Design Document** | `FDD-0127` | Approved — SHA-256 hash chaining and export bundle manifest specifications |
| **Technical Design Specification** | `TDS-0127` | Approved — Complete schemas, Merkle root computation, and route definitions |
| **User Story** | `Story 16.3` | Ready (`docs/user-stories/epic-16-adr-0125-to-0128.md`) |
| **Component Skill** | `compliance` | `social-listening-core/.claude/skills/compliance/SKILL.md` |
| **Executable Contract** | `Story 16.3 Contract` | `social-listening-core/contracts/epic-16/story-16.3.audit-hash-chaining-manifest.contract.test.ts` |

---

## 2. Acceptance Criteria Breakdown & Contract Test Design

- **AC1: Cryptographic Hash Chaining Storage:**
  - Audit log tables (`platform_admin_audit_log` and `tenant_audit_log`) maintain `previous_record_hash TEXT NOT NULL` and `record_hash TEXT NOT NULL`.
  - Deterministic formula:
    $$\text{record\_hash} = \text{SHA-256}(\text{id} \parallel \text{tenant\_id} \parallel \text{actor\_id} \parallel \text{action} \parallel \text{timestamp} \parallel \text{canonical\_payload} \parallel \text{previous\_record\_hash})$$
  - Genesis block anchored to 64 zeros (`0000000000000000000000000000000000000000000000000000000000000000`).

- **AC2: Concurrency Protection via Row-Level Locking:**
  - Chained append queries use `SELECT record_hash FROM ... ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE` within the tenant or platform partition.
  - Guarantees strict sequential ordering without fork races under concurrent appends.

- **AC3: Hash Chain Integrity Verification Endpoint:**
  - `GET /v1/compliance/audit-log/verify`
  - Re-evaluates hash sequence chronologically from genesis or start boundary.
  - Returns `200 { isValid: true, verifiedRecordsCount, chainStartHash, chainEndHash }`.
  - When a record's data or hash is tampered, returns `200 { isValid: false, compromisedRecordId, sequencePosition, expectedHash, actualHash }` pinpointing the exact failure point.

- **AC4: Structured ZIP Export Bundle & `manifest.json`:**
  - `POST /v1/compliance/audit-packs`
  - Gated to `tenant_admin` / `compliance_officer` / `platform_admin`. Non-admin rejected with `403 FORBIDDEN`.
  - Assembles evidence bundle including `audit_logs.csv` and `dsr_proof_logs.csv` into a valid PKZIP archive containing root `manifest.json`.
  - `manifest.json` validates under schema `manifestVersion: "1.0.0"` with:
    - `packId`, `tenantId`, `generatedAt`, `timeRange` (`startDate`, `endDate`)
    - `files`: array of `{ path, sha256, rowCount, byteSize }`
    - `merkleRootHash`: cryptographic Merkle root of all enclosed records
    - `verificationSignature`: platform HMAC-SHA256 digital signature over manifest payload

- **AC5: Presigned Download & Retention Lifecycle:**
  - `GET /v1/compliance/audit-packs/:id/download`
  - Generates/validates presigned download token enforcing a 24-hour expiration window.
  - Enforces 90-day retention lifecycle policy, marking expired packs and returning `410 GONE` / error when expired.

---

## 3. Minimal Change Set (Scope)

1. `social-listening-core/migrations/0079_add_audit_log_hash_chaining_and_compliance_packs.sql`
2. `social-listening-core/src/compliance/types.ts`
3. `social-listening-core/src/compliance/auditHashChaining.ts`
4. `social-listening-core/src/compliance/zipArchive.ts`
5. `social-listening-core/src/compliance/auditPackService.ts`
6. `social-listening-core/src/http/versions/v1/complianceRouter.ts`
7. `social-listening-core/src/http/versions/v1/router.ts`
8. `social-listening-core/src/admin/platformAdminAuditLog.ts`
9. `social-listening-core/.claude/skills/compliance/SKILL.md`
10. `social-listening-core/contracts/epic-16/story-16.3.audit-hash-chaining-manifest.contract.test.ts`

---

## 4. Execution Plan (Red -> Green -> Validate -> Sync -> Merge)
1. Write failing contract test (`story-16.3.audit-hash-chaining-manifest.contract.test.ts`) covering AC1–AC5.
2. Run contract test to verify RED state.
3. Apply migration `0079` to dev and template databases.
4. Implement hash chaining, zip generation, audit pack service, and router.
5. Re-run contract test until GREEN.
6. Verify full Epic 16 suite and run typecheck.
7. Update component SKILL.md, implementation log, user story status, and dashboard telemetry.
8. Merge to `main`.
