---
name: compliance
description: Cryptographic audit log hash chaining, tamper detection, and verifiable compliance evidence bundle ZIP export with Merkle root manifest.json (ADR-0127, ADR-0094, Story 16.3).
---

# Compliance & Cryptographic Audit Pack Engine

## What this is

The compliance engine maintains an unbroken cryptographic ledger across administrative and tenant operations by appending records with SHA-256 hash chaining anchored to a 64-zero genesis block. It provides verification endpoints (`GET /v1/compliance/audit-log/verify`) to detect and pinpoint historical database tampering, and packages structured compliance evidence bundles (`POST /v1/compliance/audit-packs`) containing `manifest.json` (`manifestVersion: "1.0.0"`), file digests, Merkle root hash, and platform HMAC signatures for SOC 2, ISO 27001, and GDPR Article 30 audits.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0127 | Merkle-tree cryptographic hash chaining on audit logs and standardized manifest export | 16.3 |
| ADR-0094 | Base compliance audit pack model, 24-hour presigned URL, and 90-day retention lifecycle | 10.14, 16.3 |
| ADR-0030 §5 | Durable logging of platform admin operations and RLS bypass actions | 5.7, 5.14 |
| ADR-0031 | Tenant audit logging and RLS boundary protection | 5.7, 16.3 |

## Contracts that constrain this component

- `contracts/epic-16/story-16.3.audit-hash-chaining-manifest.contract.test.ts` — Deterministic SHA-256 hash chaining, genesis anchor, row-level locking concurrency protection, audit log verification and tampering detection, ZIP export bundle generation with 1.0.0 manifest, and 24-hour presigned URL download with 90-day retention.

## How to extend this safely

- **Adding a new audit log action type:** Tenant-ledger records go through `appendChainedTenantAudit`; platform-ledger records go through `logPlatformAdminAction` in `admin/platformAdminAuditLog.ts` (there is no `appendChainedPlatformAdminAudit` helper — `logPlatformAdminAction` performs the chain read and INSERT inline). Ensure the payload is JSON-serializable; the canonical serializer sorts payload keys alphabetically before hashing.
- **App-scoped audit writers:** Callers under `app_user`, `tenant_signup_role`, or `tenant_deletion_role` pass their own pool/client to `logPlatformAdminAction` so the INSERT keeps per-role blast-radius separation. Those roles hold INSERT only — `platform_admin_audit_log` stays readable by `platform_admin_role` alone (migration 0015, asserted by Story 5.7's contract) — so the `SELECT record_hash` chain read inside `logPlatformAdminAction` always runs on `getPlatformAdminPool()` regardless of the write pool. Do not "fix" this by granting those roles SELECT.
- **Adding an exported evidence file to audit packs:** Add the file to `buildAuditPackFiles(...)`, calculate its SHA-256 digest, byte size, and row count, and register it in `manifest.files`. The Merkle root calculator includes all enclosed record hashes automatically.
- **Verification queries:** Always re-compute sequential hashes from `previous_record_hash` in chronological sequence (`ORDER BY created_at ASC, id ASC`) using `computeRecordHash(...)`.

## Load-bearing constraints — do not change casually

- **Genesis Block Anchor:** The initial record for each tenant ledger or platform ledger partition MUST link to `0000000000000000000000000000000000000000000000000000000000000000` (64 zeros). Never alter or randomize the genesis hash.
- **Deterministic Record Hash:** The hash formula is strictly:
  `SHA-256(id | tenant_id | actor_id | action | timestamp | canonical_payload | previous_record_hash)`. Any field delimiter or sorting deviation invalidates the chain.
- **Row-Level Locking:** Chained appends MUST use `SELECT record_hash FROM ... ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE` within the partition transaction to prevent concurrency races.
- **Manifest Schema:** `manifest.json` MUST specify `manifestVersion: "1.0.0"` and include all file descriptors with valid SHA-256 digests matching the enclosed files.
- **Presigned Expiration Window:** Audit pack download tokens expire after 24 hours; packages older than 90 days are marked `expired` and return `410 GONE`.

## Known gaps / deferred work

- **Asymmetric HSM Signing (Q-0127-2):** Manifest verification signatures currently use HMAC-SHA256 with platform signing secret; asymmetric Ed25519 or Azure Key Vault HSM keys are deferred to future hardware signing integration.
- **Automated Daily Chain Health Cron (Q-0127-3):** Periodic continuous verification cron task can be scheduled via `pg_cron` in a future operational story.

## Relations to other components

- `admin/platformAdminAuditLog.ts`: Calls into `auditHashChaining.ts` for chained append of platform administrative actions.
- `governance/dsrQuarantineStore.ts`: DSR records and receipts are cross-referenced in exported `dsr_proof_logs.csv`.
- `http/versions/v1/complianceRouter.ts`: HTTP router exposing `/v1/compliance/audit-log/verify` and `/v1/compliance/audit-packs`.
