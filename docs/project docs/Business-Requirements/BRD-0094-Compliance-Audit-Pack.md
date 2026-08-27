# Business Requirements Document (BRD) — Compliance Audit Pack

> **Note:** This BRD is based on **ADR-0094 (Accepted 2026-08-28)** which is currently **Proposed** (2026-08-23). The content is therefore a draft for review and may change if the ADR is revised before acceptance.

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Compliance Audit Pack Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft for Review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0094 (Accepted 2026-08-28), feature design `16-compliance-audit-pack.md`, and Epic 10 stories |

---

## 2. Executive Summary

Regulated and enterprise tenants, as well as the platform operator, need a defensible, self-contained record of platform activity for a given period. Today the data exists across multiple tables (`platform_admin_audit_log`, `data_subject_requests`, `ingestion_runs`, takedown records, and connector-activation logs), but there is no easy way to hand an auditor or regulator a single, verifiable artifact that explains what happened and why. The **Compliance Audit Pack** addresses this by allowing an authorized `Tenant-Admin` or `Platform-Admin` to request a scoped, tamper-evident export for a date range and request type.

The pack aggregates governance-relevant activity — DSR requests, takedown decisions, ingestion runs, enrichment jobs, and more — into a signed JSON bundle with a manifest. The primary consumers are the `Legal-Advisor`, `Platform-Admin`, and `Tenant-Admin` personas, who need to respond to audits, subpoenas, data-subject requests, and internal compliance reviews quickly and confidently.

This initiative supports SOC 2, ISO 27001, and GDPR Article 30 record-of-processing readiness. It also reduces the manual work currently required to compile evidence from multiple tables, lowering the legal and operational overhead of compliance conversations.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce the time and effort required to respond to audits and regulatory inquiries | A complete, defensible pack can be requested and downloaded without manual SQL or ad-hoc exports |
| 2 | Improve trust and transparency with tenants, regulators, and data subjects | Every pack includes a verifiable checksum and platform signature that can be independently checked |
| 3 | Strengthen compliance readiness for regulated tenants | The pack covers DSR, takedown, ingestion, enrichment, and full-platform review use cases required by SOC 2 / ISO 27001 / GDPR |
| 4 | Reduce operational risk from incomplete or inconsistent audit evidence | Packs are scoped to a fixed period and type, with a defined schema and retention lifecycle |

---

## 4. Scope

### 4.1 In Scope

- A new `compliance_audit_packs` data model that tracks pack type, date range, status, storage path, and SHA-256 hash.
- Pack types: `dsr`, `takedown`, `ingestion`, `enrichment`, and `full`.
- Async generation of audit packs initiated through a REST endpoint (`POST /v1/compliance/audit-packs`).
- Status and download tracking endpoint (`GET /v1/compliance/audit-packs/:id`).
- Tamper-evident export format: a JSON payload (`pack.json`) and a signed `manifest.json` containing the SHA-256 hash, pack metadata, and a platform signature.
- Role-based access: `Tenant-Admin` can generate packs for their own tenant; `Platform-Admin` can generate packs for any tenant.
- Pack storage in Azure Blob Storage with a 90-day default object lifetime and 24-hour presigned download URLs.
- Pack aggregation from existing tables: `platform_admin_audit_log`, `data_subject_requests`, takedown records, `ingestion_runs`, enrichment job records, connector activations, watchlists, and user role changes.

### 4.2 Out of Scope

- Raw post body content, unless explicitly requested and separately authorized (packs default to counts and metadata).
- Tenant-specific signing keys; v1 packs are signed by the platform.
- Indefinite or custom retention of packs beyond the 90-day default.
- Blockchain or third-party notarization (the format is designed so it can be extended later, but is not in v1).
- Automatic delivery of packs to public DSR/takedown requesters (to be decided; see Open Questions).

### 4.3 Assumptions

- The underlying audit, DSR, takedown, and ingestion tables are already in place and RLS-protected.
- Azure Blob Storage and a platform-managed signing secret or HMAC key are available.
- Pack generation is acceptable to run asynchronously because the payload may be large.
- The user interface for pack generation will be delivered as part of a broader Trust & Compliance section.

### 4.4 Constraints

- v1 signing uses a platform key and HMAC-SHA256; public-key signing is a future option.
- Packs are large but short-lived; a 90-day default balances accessibility and storage cost.
- Generation must not expose cross-tenant data to a `Tenant-Admin`.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Legal-Advisor | Primary user; needs evidence for audits and legal review | High | A one-click, verifiable artifact with a checksum and signature |
| Tenant-Admin | Primary user; manages own tenant's compliance posture | High | Generate tenant-scoped packs for selected periods and types without technical assistance |
| Platform-Admin | Primary user; oversees the whole platform | High | Generate per-tenant or platform-level packs for operational and regulatory review |
| Sole-Operator | Secondary user; runs a small tenant | Medium | Simple pre-compliance self-check without writing queries |
| Data-Subject | Indirect beneficiary | Medium | Faster, more defensible DSR and takedown responses |
| Regulator / Auditor | External reviewer | High | Receives a signed, period-bound, self-contained record |

---

## 6. Current State (As-Is)

The platform already records many governance-relevant events:

- `platform_admin_audit_log` captures admin, tenant, and connector actions (ADR-0031).
- `data_subject_requests` tracks DSR requests (ADR-0093).
- Takedown requests and redaction decisions are recorded (ADR-0092).
- `ingestion_runs` records ingestion activity.
- Enrichment jobs and overrides are tracked (ADR-0071).

**Pain points:**

- Auditors and legal reviewers cannot receive a single, self-contained artifact; evidence must be assembled by querying multiple tables.
- There is no standard format or tamper-evidence, making the resulting record hard to defend.
- Manual export processes are slow, error-prone, and may inadvertently expose raw post content or cross-tenant data.

---

## 7. Future State (To-Be)

After this initiative, an authorized admin will be able to:

1. Open the compliance section and select a date range, pack type, and tenant scope.
2. Submit the request; the system queues an async generation job.
3. Track the pack status and receive a presigned download link when ready.
4. Download a `pack.json` payload plus a `manifest.json` containing the SHA-256 of the payload and a platform signature.
5. Verify the pack integrity independently using the SHA-256 recorded in the `compliance_audit_packs` table.

**Expected capabilities:**

- Five pack types covering DSR, takedown, ingestion, enrichment, and a full cross-reference index.
- Role-scoped generation: `Tenant-Admin` for own tenant; `Platform-Admin` for any tenant.
- Tamper-evident export with payload hash, manifest, and platform signature.
- Expiring storage and download URLs to manage cost and risk.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a `Tenant-Admin` to request a compliance audit pack for their own tenant | Must | Request is accepted, scoped to the user's tenant, and a pack record is created | Product Owner |
| BR-002 | The system shall allow a `Platform-Admin` to request a compliance audit pack for any tenant | Must | Request can specify any tenant and is authorized without cross-tenant leakage | Product Owner |
| BR-003 | The system shall support pack types `dsr`, `takedown`, `ingestion`, `enrichment`, and `full` | Must | Pack record `pack_type` is one of the allowed values and content matches the type | Product Owner |
| BR-004 | The system shall generate packs asynchronously and expose status and download endpoints | Must | `POST` returns a pack ID; `GET` returns `generating`, `ready`, `expired`, or `failed` plus download URL when ready | Product Owner |
| BR-005 | The system shall produce a tamper-evident export consisting of a payload and a signed manifest | Must | `pack.json` and `manifest.json` are generated; manifest includes `pack_id`, `tenant_id`, `generated_at`, `sha256`, and `signature` | Product Owner |
| BR-006 | The system shall record the SHA-256 of the payload in the `compliance_audit_packs` table | Must | `sha256` column is populated and matches the manifest | Product Owner |
| BR-007 | The system shall provide presigned download URLs that expire after 24 hours | Must | URL is time-limited and cannot be used after expiry | Product Owner |
| BR-008 | The system shall delete blob objects and mark packs `expired` after the retention period | Must | Default 90-day object lifetime is enforced; expired packs are no longer downloadable | Product Owner |
| BR-009 | The system shall include counts and metadata rather than raw post bodies unless explicitly authorized | Should | Pack payload excludes `social_posts` body content by default | Product Owner |
| BR-010 | The system shall provide a human-readable PDF companion for legal review | Could | A PDF rendering of the pack is available for download alongside the JSON (future or v1.5) | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Pack generation must not block the requesting HTTP request | Performance | Must | `POST` returns immediately and generation continues in a background job |
| NFR-002 | Pack generation must respect tenant RLS and never include another tenant's data | Security | Must | Contract tests verify cross-tenant isolation and unauthorized access returns 404/403 |
| NFR-003 | Packs stored in Blob must be encrypted at rest | Security | Must | Azure Blob Storage encryption is enabled for the container used |
| NFR-004 | The platform signature must be verifiable by a recipient with the manifest and payload | Security | Must | An independent SHA-256 of `pack.json` matches the manifest value |
| NFR-005 | The system must support at least one concurrent pack generation per tenant without deadlock | Scalability | Should | Multiple pack requests queue and complete without contention on shared resources |
| NFR-006 | Audit pack history must be discoverable and filterable in the admin UI | Usability | Should | `AuditPackList` shows status, type, period, and expiry for the tenant |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `Tenant-Admin` may only generate a compliance audit pack for the tenant to which they belong. |
| BRU-002 | A `Platform-Admin` may generate a pack for any tenant, including a platform-level or full pack. |
| BRU-003 | Each pack must be signed by the platform, not by a tenant-specific key. |
| BRU-004 | A pack's `pack_type` must be one of `dsr`, `takedown`, `ingestion`, `enrichment`, or `full`. |
| BRU-005 | The start date must not be after the end date, and the date range must not exceed a configurable maximum. |
| BRU-006 | Packs are retained for a default of 90 days; after that the blob object is deleted and the record is marked `expired`. |
| BRU-007 | Download URLs are presigned and expire after 24 hours. |
| BRU-008 | Raw post content is excluded unless the requester has explicit authorization and the pack type explicitly supports it. |
| BRU-009 | A new pack that supersedes a prior pack must reference the prior pack via `supersedes_id` if the supersession feature is implemented. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `compliance_audit_packs.id` | Unique pack identifier | Generated by system | Platform | Internal |
| `compliance_audit_packs.tenant_id` | Tenant the pack belongs to | `tenants` | Platform | Internal |
| `compliance_audit_packs.generated_by_user_id` | User who requested the pack | `users` | Platform | Internal |
| `compliance_audit_packs.pack_type` | Type of pack (`dsr`, `takedown`, `ingestion`, `enrichment`, `full`) | Request input | Platform | Internal |
| `compliance_audit_packs.start_date` / `end_date` | Period covered by the pack | Request input | Platform | Internal |
| `compliance_audit_packs.status` | Lifecycle status (`generating`, `ready`, `expired`, `failed`) | System | Platform | Internal |
| `compliance_audit_packs.storage_path` | Azure Blob path to the pack | System | Platform | Internal |
| `compliance_audit_packs.sha256` | SHA-256 hash of `pack.json` | Generated by system | Platform | Internal |
| `compliance_audit_packs.generated_at` / `expires_at` | Timestamps for creation and blob expiry | System | Platform | Internal |
| `pack.json` | Aggregated records for the selected period and type | `platform_admin_audit_log`, `data_subject_requests`, takedown records, `ingestion_runs`, enrichment records | Platform | High — may contain PII/audit data |
| `manifest.json` | Metadata and signature for tamper-evidence | Generated by system | Platform | High |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Pack generation volume | Track how many packs are generated by type and role | Platform-Admin / Compliance | Daily / Monthly |
| Pack success/failure rate | Monitor async job health and reliability | Platform-Admin | Daily |
| Average pack size and storage cost | Manage Blob storage budget and retention | Platform-Admin / Finance | Monthly |
| Time-to-ready | Measure how long pack generation takes | Product team | Weekly |
| Expired packs deleted | Confirm retention policy enforcement | Compliance / Security | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Packs grow large and increase Blob storage costs | Medium | Medium | 90-day default retention; size caps; monitoring and alerting on storage spend | Platform-Admin |
| R-002 | HMAC/signature key is compromised or rotated | Low | High | Store key in Azure Key Vault; rotate with a documented process; include key version in manifest | Security Lead |
| R-003 | A pack may need correction after it is signed | Medium | High | Allow supersession via `supersedes_id`; document that each pack is a point-in-time record | Product Owner |
| R-004 | Cross-tenant data leakage in pack aggregation | Low | High | Enforce RLS in all source queries; contract tests for cross-tenant isolation | Engineering Lead |
| R-005 | Low adoption because users do not understand pack value | Medium | Low | Provide UI guidance, tooltip explanations, and link to Legal-Advisor documentation | Product Owner |
| R-006 | Raw post content accidentally included in packs | Medium | High | Default to counts/metadata; require explicit authorization for raw content; review pack schemas | Compliance Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `platform_admin_audit_log` table and events (ADR-0031) | Internal | Engineering | Already in place |
| D-002 | Takedown request data model and redaction flow (ADR-0092) | Internal | Engineering | In progress (Story 10.11) |
| D-003 | DSR self-service data model (ADR-0093) | Internal | Engineering | In progress (Story 10.12) |
| D-004 | Azure Blob Storage storage and presigned URL support (ADR-0016) | Internal / Platform | Engineering | Already in place |
| D-005 | Azure Key Vault or platform-managed secret for HMAC signing | Internal / Security | Engineering | To be resolved at implementation |
| D-006 | Trust & Compliance admin UI section (Story 10.14) | Internal | Engineering | After Story 10.13 |

---

## 14. Acceptance Criteria

- A `Tenant-Admin` can request a pack for their own tenant and receive a pack ID.
- A `Platform-Admin` can request a pack for any tenant.
- The `compliance_audit_packs` table stores pack type, date range, status, storage path, and SHA-256.
- `POST /v1/compliance/audit-packs` returns immediately and creates a `generating` pack.
- `GET /v1/compliance/audit-packs/:id` returns current status and a download URL when `ready`.
- Pack types `dsr`, `takedown`, `ingestion`, `enrichment`, and `full` each produce appropriate content.
- The generated `manifest.json` contains the SHA-256 of `pack.json` and a platform signature.
- Presigned download URLs expire after 24 hours.
- Blob objects are deleted and pack records marked `expired` after 90 days.
- Cross-tenant pack requests are rejected or return 404.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Audit pack | A period-bound, self-contained export of governance-relevant platform activity. |
| Tamper-evident | A property of the export that allows a recipient to detect changes by comparing a SHA-256 hash and a platform signature. |
| `pack_type` | The category of records included in a pack: `dsr`, `takedown`, `ingestion`, `enrichment`, or `full`. |
| `pack.json` | The JSON payload containing the aggregated records for a pack. |
| `manifest.json` | A companion file containing pack metadata and the signature used for tamper-evidence. |
| Presigned URL | A time-limited download URL that grants access to a specific object in Azure Blob Storage. |
| DSR | Data Subject Request — a request from an individual to access, correct, or erase their personal data. |
| Takedown | A request from an author or rights holder to remove or redact content. |

---

## 16. Appendices

### Reference documents

- **ADR-0094 (Accepted 2026-08-28)** — `docs/adr/0094-compliance-audit-pack.md` (source, currently Proposed)
- **Feature design** — `docs/product-research/feature-designs/16-compliance-audit-pack.md`
- **Feature-to-ADR scoping** — `docs/product-research/feature-adr-scoping.md`
- **Related ADRs** — ADR-0031 (audit log), ADR-0092 (takedown), ADR-0093 (DSR), ADR-0016 (Azure Blob Storage), ADR-0071 (enrichment overrides)

### Related user stories

- **Story 10.13 — Compliance audit pack (backend)** (source: ADR-0094 (Accepted 2026-08-28)): `compliance_audit_packs` table and async tamper-evident export generator.
- **Story 10.14 — Trust and rights admin UI (frontend)** (sources: ADRs 0092, 0093, 0094): `TrustAndComplianceView` with tabs for `Takedowns`, `DSR Requests`, and `Audit Packs`.

### Missing sources

- No `docs/product-research/reports/16-compliance-audit-pack-deep-research.md` file was found; competitive or deep-research context should be added if it becomes available.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
