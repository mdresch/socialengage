# ADR-0127: Compliance audit pack refinements — Merkle-tree hash chaining and verifiable evidence bundles

**Status:** Proposed (2026-08-28)

**Authorizes:** refinements to ADR-0094's compliance audit pack generation: Merkle-tree cryptographic hash chaining across audit log entries and automated evidence bundle generation for SOC 2 / ISO 27001 audits.

**Source:** docs/product-research/feature-designs/16-compliance-audit-pack.md, 16-compliance-audit-pack-deep-research.md

---

## Decision
1. **Audit Log Integrity Chaining:** Every udit_logs record includes previous_record_hash and ecord_hash computed over { id, tenant_id, actor_id, action, timestamp, previous_record_hash }.
2. **Standardized Audit Pack Manifest:** Export packages include a machine-readable manifest.json containing SHA-256 digests for all exported CSVs and DSR proof logs.