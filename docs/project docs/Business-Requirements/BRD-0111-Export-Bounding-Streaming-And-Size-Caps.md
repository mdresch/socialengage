# Business Requirements Document — Export Bounding, Streaming, and Size Caps

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Export Bounding, Streaming, and Size Caps – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent, on behalf of Product / Architecture |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft — ADR-0111 is currently Proposed and may change before acceptance |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0111, feature design `10-data-export.md`, and related user stories |

---

## 2. Executive Summary

Social listening data exports can generate very large result sets. Without explicit bounds, a single tenant request could stream millions of posts, exhausting worker memory, incurring unbounded Azure Blob Storage costs, and causing connection timeouts. ADR-0111 defines the resource guards for the data-export endpoints: synchronous and asynchronous thresholds, row and size caps, tenant-scoped rate limits, and a bounded lifecycle for exported files.

The proposed solution keeps small exports fast and synchronous while automatically promoting large exports to an asynchronous background job. The job streams the result to tenant-scoped Azure Blob Storage, returns a trackable `jobId`, and enforces automatic expiry. Rate limits are applied per tenant so the platform can control total export cost and abuse. This approach supports the existing `10-data-export` feature design and the `ADR-0090` / `ADR-0074` export contracts while preventing Denial-of-Service via unbounded exports.

The expected business value is threefold: predictable platform cost and resource use, a safe and auditable data-portability path for compliance (GDPR/CCPA), and a fast self-service experience for routine exports.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Protect platform resources from unbounded export workloads | No export request causes worker memory exhaustion or >100 MB file generation |
| 2 | Control storage and compute costs for the platform operator | Export-related Blob storage and compute remain within a bounded, tenant-scoped quota |
| 3 | Provide reliable, self-service data portability for tenants | Tenants can export matched posts with predictable response times and a 24-hour download window |
| 4 | Maintain an auditable trail of who exported what and when | `export_jobs` records are retained for 90 days and include tenant, user, status, SHA-256, and expiry |

---

## 4. Scope

### 4.1 In Scope

- Synchronous CSV export for `GET /v1/posts/export.csv` when `limit <= 5,000` and `format='csv'`.
- Default synchronous limit of `1,000` rows.
- Asynchronous export promotion for any request where `limit > 5,000`, `format='json'`, or a `watchlistId` matches more than 5,000 posts.
- Async job orchestration via `POST /v1/posts/export` returning `202 Accepted` with a `jobId`.
- `export_jobs` table tracking status, format, row count, blob path, SHA-256, expiry, and creation timestamp.
- Hard export caps: CSV 100,000 rows; JSON 10,000 rows; 100 MB max file size; 3 concurrent async exports per tenant.
- Tenant-scoped rate limits: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
- Blob lifecycle: 24-hour presigned download URLs; 7-day blob object retention; 90-day `export_jobs` audit retention.
- Error responses for invalid limits, rate limits, oversized matched sets, and worker failures.

### 4.2 Out of Scope

- Unlimited or plan-configurable synchronous caps (left as an open question per ADR-0111).
- Permanent or long-term export archive storage; exports are intentionally short-lived.
- Scheduled or repeating exports (deferred to v2 of the data-export feature).
- Right-to-erasure / DSR export flows, which are handled as a separate capability.
- Workspace JSON export details beyond the bounding, streaming, and lifecycle rules defined here (see ADR-0074).

### 4.3 Assumptions

- Azure Blob Storage and the existing tenant-scoped container model are already in place (ADR-0016).
- The base data-export endpoints and RLS patterns from `ADR-0090` and `ADR-0074` are available.
- Exports are always scoped to the caller's tenant; `withTenant()` or an equivalent RLS helper is used at every query step.
- Connector secrets, OAuth tokens, and `rawPayload` are never serialized to an export file.

### 4.4 Constraints

- Max synchronous CSV response: 5,000 rows.
- Max CSV export: 100,000 rows; max JSON export: 10,000 rows.
- Max export file size: 100 MB.
- Max concurrent async exports per tenant: 3.
- All rate limits are enforced per tenant, not per user.
- Exported files are deleted after 7 days; download URLs expire after 24 hours.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary consumer of posts CSV exports | High | Fast, predictable, bounded CSV exports for analysis in Excel/BI tools |
| Data-Subject | Future DSR / portability requester | Medium | A machine-readable, tamper-evident export of personal data |
| Legal-Advisor | Compliance / audit pack reviewer | Medium | Proof that exports are bounded, redacted, and auditable |
| Tenant-Admin | Tenant-scoped export operator | Medium | Control over who can export and confidence that exports stay within tenant boundaries |
| Sole-Operator / Platform-Admin | Platform cost and abuse owner | High | Per-tenant rate limits, lifecycle, and cost controls |
| Backend-Engineer | Implementer and maintainer of export services | High | Clear thresholds, error codes, and streaming contracts to avoid memory spikes |

---

## 6. Current State (As-Is)

The data-export feature design (`10-data-export.md`) and `ADR-0090` define an initial CSV export endpoint and the concept of an asynchronous workspace JSON export. `ADR-0074` covers the first workspace export. Story 3.8 (deletion/offboarding export) already exists and demonstrates per-tenant streaming and redaction patterns.

**Pain points today:**

- No explicit bound on how many rows can be returned synchronously, risking out-of-memory and connection timeouts.
- No automatic async promotion; large or JSON exports would block the worker.
- No per-tenant rate limiting, allowing a single tenant to monopolize export compute and Blob storage.
- No defined file or Blob lifecycle, leading to unbounded storage growth.
- No standardized job-tracking table for async exports, making status, audit, and retry inconsistent.

---

## 7. Future State (To-Be)

After ADR-0111 is implemented, the export flow is:

1. A tenant user or analyst requests an export with filters, format, and `limit`.
2. The backend validates the request against RLS, tenant rate limits, and the format/row caps.
3. If the request is within the synchronous threshold (CSV, `limit <= 5,000`), the API streams rows directly with `Content-Type: text/csv; charset=utf-8`.
4. If the request exceeds the sync threshold or is JSON, the backend returns `202 Accepted` with a `jobId` and queues an async `export_jobs` row.
5. The worker streams the result to Azure Blob Storage, writes the blob path, row count, SHA-256, and `ready` status to `export_jobs`.
6. The user polls `GET /v1/exports/:id` for status and downloads via `GET /v1/exports/:id/download` using a 24-hour presigned URL.
7. After 7 days the blob is hard-deleted by a scheduled worker; the `export_jobs` record is retained for 90 days for audit.

**Expected capabilities:**

- Small exports return in a single HTTP request with bounded, streamed CSV.
- Large exports are safe, trackable, and cost-controlled.
- Platform operators can rely on per-tenant rate limits and automatic lifecycle cleanup.
- All exports are auditable and RLS-scoped to the requesting tenant.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support synchronous CSV export at `GET /v1/posts/export.csv` for requests where `format='csv'` and `limit <= 5,000` | Must | Request returns 200 with `text/csv; charset=utf-8`; rows are streamed one at a time | Product Owner |
| BR-002 | The system shall use a default `limit` of 1,000 for synchronous CSV exports | Must | Request with no `limit` returns up to 1,000 rows | Product Owner |
| BR-003 | The system shall promote a request to async when `limit > 5,000`, `format='json'`, or the matched watchlist exceeds 5,000 posts | Must | Response is 202 with a `jobId`; worker begins processing | Product Owner |
| BR-004 | The system shall stream async exports to Azure Blob Storage and write an `export_jobs` record | Must | Record includes `id`, `tenant_id`, `requested_by_user_id`, `status`, `format`, `row_count`, `blob_path`, `sha256`, `expires_at`, `created_at` | Product Owner |
| BR-005 | The system shall enforce hard export caps of 100,000 rows for CSV and 10,000 rows for JSON | Must | Requests exceeding the cap return 400 `INVALID_LIMIT`; match-set > cap returns 422 `EXPORT_TOO_LARGE` | Product Owner |
| BR-006 | The system shall enforce a 100 MB max export file size | Must | Async worker aborts and sets `failed` status if file size exceeds 100 MB | Product Owner |
| BR-007 | The system shall allow no more than 3 concurrent async exports per tenant | Must | A 4th concurrent request returns 429 or is queued until a slot is free | Product Owner |
| BR-008 | The system shall enforce per-tenant rate limits for export endpoints | Must | 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour | Product Owner |
| BR-009 | The system shall return specific export error codes for invalid limits, rate limiting, oversized matched sets, and worker failures | Must | 400 `INVALID_LIMIT`, 429 `EXPORT_RATE_LIMITED`, 422 `EXPORT_TOO_LARGE`, 500 `EXPORT_WORKER_FAILED` with retryable `jobId` | Product Owner |
| BR-010 | The system shall make async exports downloadable via a 24-hour presigned URL and retain the Blob for 7 days | Must | Download works within 24 hours; Blob is removed after 7 days; expired exports become `expired` | Product Owner |
| BR-011 | The system shall retain `export_jobs` records for 90 days for audit | Must | Records older than 90 days are removed by scheduled cleanup without deleting Blobs prematurely | Product Owner |
| BR-012 | The system shall ensure RLS is applied to every export query and exclude connector secrets and `rawPayload` | Must | Contract tests verify only the calling tenant's data is returned and no credential fields are present | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Synchronous CSV exports stream row-by-row without full in-memory materialization | Performance | Must | Memory profile is flat for a 5,000-row export; monitored in contract tests |
| NFR-002 | `export_jobs` status is trackable and consistent (`pending`, `running`, `ready`, `expired`, `failed`) | Reliability | Must | Status transitions are auditable and tested end-to-end |
| NFR-003 | Export files and presigned URLs are tenant-scoped and time-limited | Security | Must | URLs cannot be used outside their 24-hour window; no cross-tenant access |
| NFR-004 | The platform can support bounded concurrent async export load (3 per tenant, rate-limited) | Scalability | Must | Load test confirms no resource exhaustion under 10x expected request volume |
| NFR-005 | Export error responses are actionable and do not leak internal paths | Usability | Should | Error messages describe the limit/rate/cap exceeded, not internal stack traces |
| NFR-006 | Async job failures are logged with `jobId` and retriable or manually re-queueable | Maintainability | Should | Failure logs include tenant, user, format, and error code |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A synchronous CSV export is only allowed when `format='csv'` and `limit <= 5,000`. |
| BRU-002 | The default `limit` for a synchronous CSV export is `1,000` rows. |
| BRU-003 | Any export request with `limit > 5,000`, `format='json'`, or a matched watchlist > 5,000 posts must be processed asynchronously. |
| BRU-004 | CSV exports are capped at 100,000 rows; JSON exports are capped at 10,000 rows. |
| BRU-005 | No single export file may exceed 100 MB. |
| BRU-006 | A tenant may have at most 3 concurrent async exports; additional requests are rejected or queued. |
| BRU-007 | Rate limits are enforced per tenant, not per user: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour. |
| BRU-008 | Async exports are stored in a tenant-scoped Blob container; download URLs are valid for 24 hours. |
| BRU-009 | Blob objects are hard-deleted 7 days after creation; `export_jobs` rows are retained for 90 days. |
| BRU-010 | Export queries must be wrapped with `withTenant()` or an equivalent RLS helper. |
| BRU-011 | `platform_credentials`, OAuth tokens, and `rawPayload` must never appear in any export file. |
| BRU-012 | `export_jobs.status` may only be `pending`, `running`, `ready`, `expired`, or `failed`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `export_jobs.id` | UUID primary key of the export job | Generated by API | Backend | Low |
| `export_jobs.tenant_id` | Tenant for RLS and ownership | `tenants` table, caller context | Backend | High (tenant boundary) |
| `export_jobs.requested_by_user_id` | User who initiated the export | `users` table, caller identity | Backend | Medium (audit) |
| `export_jobs.status` | Job lifecycle status | Worker state machine | Backend | Low |
| `export_jobs.format` | `csv` or `json` | Request parameter | Backend | Low |
| `export_jobs.row_count` | Number of rows actually exported | Worker after streaming | Backend | Low |
| `export_jobs.blob_path` | Path to the tenant-scoped Blob | Azure Blob Storage | Backend | High (access control) |
| `export_jobs.sha256` | SHA-256 hash of the exported file | Worker after Blob write | Backend | Medium (integrity) |
| `export_jobs.expires_at` | Download URL expiry timestamp | API at job creation | Backend | Low |
| `export_jobs.created_at` | Job creation timestamp | API at job creation | Backend | Low |
| `posts.* (selected columns)` | Filtered, RLS-scoped post data | `social_posts` + related tables | Tenant | High (tenant data) |
| `watchlist_id` | Optional filter for export scope | `watchlists` table | Tenant | Medium |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Export requests by tenant | Track usage and detect abuse | Platform-Admin / Sole-Operator | Hourly / Daily |
| Async queue depth and age | Monitor background worker health | Backend-Engineer | Real-time |
| Rate-limit hits (`429 EXPORT_RATE_LIMITED`) | Identify tenants approaching caps | Platform-Admin | Daily |
| Failed export jobs (`EXPORT_WORKER_FAILED`) | Track reliability and retry needs | Backend-Engineer | Daily |
| Blob storage consumed by exports | Control cost and lifecycle | Platform-Admin / Sole-Operator | Weekly |
| Export audit log (`export_jobs` 90-day retention) | Compliance evidence | Legal-Advisor / Auditor | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A tenant exceeds rate or row caps and receives repeated errors | Medium | Medium | Clear error codes, in-product messaging, and documented limits | Product Owner |
| R-002 | Async worker failure leaves a job stuck in `running` | Medium | High | Worker heartbeat, timeout, and `failed` transition with `jobId` for retry | Backend-Engineer |
| R-003 | Blob lifecycle misconfiguration causes unbounded storage growth | Low | High | Automated 7-day hard delete and 24-hour URL expiry; monitor Blob capacity | Platform-Admin |
| R-004 | Export accidentally leaks connector secrets or another tenant's data | Low | High | RLS on every query, stable CSV columns, and redaction contract tests | Backend-Engineer |
| R-005 | Large exports cause memory spikes even when streamed | Medium | High | Cursor-based streaming, 100 MB file cap, and no full in-memory materialization | Backend-Engineer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0090` — CSV export endpoint and streaming contract | Architectural | Product / Architecture | Accepted |
| D-002 | `ADR-0074` — workspace JSON export | Architectural | Product / Architecture | Accepted |
| D-003 | `ADR-0016` — Azure Blob Storage tenant-scoped container | Architectural | Product / Architecture | Accepted |
| D-004 | Feature design `10-data-export.md` | Functional | Product Owner | In place |
| D-005 | `docs/product-research/feature-adr-scoping.md` (ADR-0111 planning) | Process | Product Owner | In place |
| D-006 | User Story 13.4 — Export bounding, streaming, and size caps (backend) | Implementation | Backend-Engineer | Ready |
| D-007 | User Story 10.8 — Data export posts CSV (backend) | Implementation | Backend-Engineer | Ready |
| D-008 | Deep-research brief for data export (`docs/product-research/reports/10-data-export-deep-research.md`) | Research | Product Owner | Not found (noted in Appendix) |

---

## 14. Acceptance Criteria

- Synchronous CSV exports up to 5,000 rows are streamed directly without full in-memory materialization and with `Content-Type: text/csv; charset=utf-8`.
- Asynchronous exports for `limit > 5,000`, `format='json'`, or watchlist matches > 5,000 return `202 Accepted` with a `jobId` and create an `export_jobs` record.
- `export_jobs` tracks status, format, row count, blob path, SHA-256, expiry, and timestamps.
- Hard limits are enforced: CSV 100,000 rows, JSON 10,000 rows, 100 MB file size, 3 concurrent async exports per tenant.
- Per-tenant rate limits are enforced: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
- Presigned download URLs are valid for 24 hours; Blob objects are deleted after 7 days; `export_jobs` records are retained for 90 days.
- Error codes are returned for invalid limits (400 `INVALID_LIMIT`), rate limiting (429 `EXPORT_RATE_LIMITED`), oversized matched sets (422 `EXPORT_TOO_LARGE`), and worker failures (500 `EXPORT_WORKER_FAILED`).
- Exports respect RLS and do not contain `rawPayload`, `platform_credentials`, OAuth tokens, or other connector secrets.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Async export** | An export processed by a background worker and delivered via a trackable `jobId` and Blob download. |
| **Blob lifecycle** | The retention and deletion policy for exported files in Azure Blob Storage. |
| **Cursor-based streaming** | A query technique that reads rows one at a time without loading the entire result set into memory. |
| **Export bounding** | The practice of enforcing upper limits on rows, file size, and concurrency for exports. |
| **Export jobs** | The `export_jobs` table that tracks the lifecycle of an async or audited export. |
| **Presigned URL** | A time-limited, signed Azure Blob URL that grants temporary download access to an export file. |
| **RLS** | Row-Level Security — the tenant-scoped query isolation used for all data access. |
| **Synchronous export** | An export returned immediately in the HTTP response, without a background job. |
| **Tenant-scoped rate limit** | A quota applied to all users within a tenant, not per individual user. |
| **Watchlist** | A saved boolean query used to filter posts for analysis or export. |

---

## 16. Appendices

### A. Reference Documents

- `docs/adr/0111-export-bounding-streaming-and-size-caps.md` — source ADR (Proposed)
- `docs/product-research/feature-designs/10-data-export.md` — parent feature design
- `docs/product-research/feature-adr-scoping.md` — feature-to-ADR scoping plan
- `docs/adr/0090-*.md` — related CSV export ADR
- `docs/adr/0074-*.md` — related workspace export ADR
- `docs/adr/0016-*.md` — related Azure Blob Storage ADR

### B. Related User Stories

- **Story 13.4 — Export bounding, streaming, and size caps (backend)**
  - Source: ADR-0111
  - Status: Ready
  - As a backend engineer, I want `export_jobs`, sync/async thresholds, Blob lifecycle, and rate limits for CSV/JSON exports, so that exports cannot overwhelm the platform.
  - Key acceptance criteria: sync up to 5,000 rows; async up to 100,000 rows; `POST /v1/posts/export` creates `export_jobs`; rate limits; 7-day Blob / 24-hour URL expiry.

- **Story 10.8 — Data export posts CSV (backend)**
  - Source: ADR-0090 / ADR-0111
  - Status: Ready
  - As a backend engineer, I want `GET /v1/posts/export.csv` to stream bounded CSV exports and `POST /v1/posts/export` for async large exports, so that tenants can download their matched posts safely.
  - Key acceptance criteria: sync 5,000 / async 100,000; stable CSV columns; Blob and `export_jobs` tracking; per-tenant rate limits; no secrets exported.

### C. Missing Source

- A `docs/product-research/reports/10-data-export-deep-research.md` deep-research brief could not be found. If one is produced later, it should be appended here.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
