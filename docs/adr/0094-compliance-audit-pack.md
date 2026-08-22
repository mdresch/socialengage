# ADR-0094: Compliance audit pack

**Status:** Proposed (2026-08-23)

**Authorizes:** a `compliance_audit_packs` data model and a tamper-evident export format that a `Tenant-Admin` or `Platform-Admin` can generate for a selected date range and request type.

**Source:** `docs/product-research/feature-designs/16-compliance-audit-pack.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Trust and defensibility require a paper trail
`docs/product-research/feature-designs/16-compliance-audit-pack.md` and the `Legal-Advisor`/`AI-Manager` stakeholder profiles require a way to produce a defensible record of platform activity for a period: posts ingested, takedowns processed, DSR requests resolved, and AI/enrichment decisions made.

### 2. The project already logs many events
`platform_admin_audit_log` (ADR-0031) records admin, tenant, and connector actions. `data_subject_requests` (ADR-0092/0093) records rights requests. `ingestion_runs` records ingestion. A compliance pack composes these into a single, reviewable artifact.

### 3. Tamper-evidence is achievable without a full blockchain
A signed JSON export with a SHA-256 hash and a server-side timestamp is enough for v1. Verifiability is the goal, not absolute immutability.

---

## Decision

### 1. New `compliance_audit_packs` table
```sql
compliance_audit_packs (
  id uuid,
  tenant_id uuid,
  generated_by_user_id uuid,
  pack_type text,            -- 'dsr' | 'takedown' | 'ingestion' | 'enrichment' | 'full'
  start_date date,
  end_date date,
  status text,               -- 'generating' | 'ready' | 'expired' | 'failed'
  storage_path text,         -- Azure Blob path
  sha256 text,
  generated_at timestamptz,
  expires_at timestamptz
);
```

### 2. Pack contents by type
- **dsr** — all `data_subject_requests` in the date range, their resolution, and the fulfillment trail.
- **takedown** — all takedown requests, grant/deny decisions, and redaction markers.
- **ingestion** — `ingestion_runs` summary, post counts by platform, and connector health snapshots.
- **enrichment** — AI enrichment jobs, overrides (ADR-0071), and topic-clustering snapshots.
- **full** — all of the above, with a cross-reference index.

### 3. Generation endpoint
```
POST /v1/compliance/audit-packs
{
  packType: string,
  startDate: ISOString,
  endDate: ISOString
}
```

- `Tenant-Admin` can generate for their own tenant.
- `Platform-Admin` can generate for any tenant, for regulatory or operational review.
- Generation is async; `GET /v1/compliance/audit-packs/:id` tracks status and returns the download URL.

### 4. Tamper-evident format
- The pack is a `pack.json` file containing the requested records.
- A `manifest.json` contains:
  - `pack_id`
  - `tenant_id`
  - `generated_at`
  - `sha256` of `pack.json`
  - `signature` from the platform's signing key (or HMAC-SHA256 for v1)
- The SHA-256 is recorded in `compliance_audit_packs.sha256` so the tenant can verify the download later.

### 5. Expiry and download
- Packs are stored in Blob Storage and expire after 90 days by default.
- Download URLs are presigned and expire after 24 hours.
- Expired packs are deleted from Blob and marked `expired` in the table.

---

## Consequences

1. **Defensible decisions:** every takedown, DSR, and enrichment choice can be exported with a verifiable hash.
2. **Regulatory readiness:** auditors or regulators can receive a complete, signed record.
3. **Storage cost:** audit packs are large but short-lived. The 90-day default balances accessibility and cost.
4. **Foundation for future proof:** the pack format can later be notarized to a third party or blockchain if needed.

---

## Alternatives considered

1. **Use only the existing `platform_admin_audit_log` without a pack export.**
   - *Rejected:* auditors need a period-bound, self-contained artifact. Querying multiple tables is not a viable handoff.

2. **Sign packs with a tenant-specific key.**
   - *Rejected:* it gives tenants too much control over the signature and complicates key management. The platform signs with its own key in v1.

3. **Store packs forever.**
   - *Rejected:* it creates unbounded storage cost. 90 days is a reasonable default; critical packs can be downloaded before expiry.

---

## Open questions

- Should the pack include `platform_admin_audit_log` entries for `Platform-Admin` actions on the tenant?
- How are corrections to records handled after a pack has been generated? A new pack supersedes the old one with an `supersedes_id` field?
- What is the HMAC key source? Azure Key Vault or a platform-wide managed identity secret?
- Should the public DSR/takedown requesters receive a copy of the audit pack for their own request?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/16-compliance-audit-pack.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0031` (audit log), `ADR-0092` (takedown), `ADR-0093` (DSR), `ADR-0016` (Azure Blob Storage)
