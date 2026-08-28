# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0111 Export Bounding, Streaming, and Size Caps — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft — ADR-0111 is currently Proposed and may change before acceptance) |
| Related Documents | ADR-0111, BRD-0111, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Social listening data exports can generate very large result sets. Without explicit bounds, a single tenant request could stream millions of posts, exhausting worker memory, incurring unbounded Azure Blob Storage costs, and causing connection timeouts. ADR-0111 defines the resource guards for the data-export endpoints: synchronous and asynchronous thresholds, row and size caps, tenant-scoped rate limits, and a bounded lifecycle for exported files.

This FDD translates the accepted architecture and business requirements from ADR-0111 and BRD-0111 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Synchronous CSV export for `GET /v1/posts/export.csv` when `limit <= 5,000` and `format='csv'`.
- Default synchronous limit of `1,000` rows.
- Asynchronous export promotion for any request where `limit > 5,000`, `format='json'`, or a `watchlistId` matches more than 5,000 posts.
- Async job orchestration via `POST /v1/posts/export` returning `202 Accepted` with a `jobId`.
- `export_jobs` table tracking status, format, row count, blob path, SHA-256, expiry, and creation timestamp.
- Hard export caps: CSV 100,000 rows; JSON 10,000 rows; 100 MB max file size; 3 concurrent async exports per tenant.
- Tenant-scoped rate limits: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
- Blob lifecycle: 24-hour presigned download URLs; 7-day blob object retention; 90-day `export_jobs` audit retention.
- Error responses for invalid limits, rate limits, oversized matched sets, and worker failures.
- **Out of scope:** - Unlimited or plan-configurable synchronous caps (left as an open question per ADR-0111).
- Permanent or long-term export archive storage; exports are intentionally short-lived.
- Scheduled or repeating exports (deferred to v2 of the data-export feature).
- Right-to-erasure / DSR export flows, which are handled as a separate capability.
- Workspace JSON export details beyond the bounding, streaming, and lifecycle rules defined here (see ADR-0074).
- **Assumptions and constraints:** - Azure Blob Storage and the existing tenant-scoped container model are already in place (ADR-0016).
- The base data-export endpoints and RLS patterns from `ADR-0090` and `ADR-0074` are available.
- Exports are always scoped to the caller's tenant; `withTenant()` or an equivalent RLS helper is used at every query step.
- Connector secrets, OAuth tokens, and `rawPayload` are never serialized to an export file.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Exports can be large
`docs/product-research/feature-designs/10-data-export.md` and `ADR-0090` describe a CSV export endpoint. Without bounding, a tenant could request millions of rows, exhausting memory, storage, and the worker.

### 2. Streaming and async are already part of `ADR-0090`
This ADR finalizes the limits: how many rows can be synchronous, when a request goes async, how async exports are stored, and when they expire.

### 3. Rate limiting must be tenant-scoped
Exports are expensive. A per-tenant rate limit prevents abuse and runaway costs.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Protect platform resources from unbounded export workloads | No export request causes worker memory exhaustion or >100 MB file generation |
| 2 | Control storage and compute costs for the platform operator | Export-related Blob storage and compute remain within a bounded, tenant-scoped quota |
| 3 | Provide reliable, self-service data portability for tenants | Tenants can export matched posts with predictable response times and a 24-hour download window |
| 4 | Maintain an auditable trail of who exported what and when | `export_jobs` records are retained for 90 days and include tenant, user, status, SHA-256, and expiry |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary consumer of posts CSV exports | High | Fast, predictable, bounded CSV exports for analysis in Excel/BI tools |
| Data-Subject | Future DSR / portability requester | Medium | A machine-readable, tamper-evident export of personal data |
| Legal-Advisor | Compliance / audit pack reviewer | Medium | Proof that exports are bounded, redacted, and auditable |
| Tenant-Admin | Tenant-scoped export operator | Medium | Control over who can export and confidence that exports stay within tenant boundaries |
| Sole-Operator / Platform-Admin | Platform cost and abuse owner | High | Per-tenant rate limits, lifecycle, and cost controls |
| Backend-Engineer | Implementer and maintainer of export services | High | Clear thresholds, error codes, and streaming contracts to avoid memory spikes |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 10.8 | backend engineer | `GET /v1/posts/export.csv` to stream bounded CSV exports and `POST /v1/posts/export` for async large exports, | tenants can download their matched posts safely. | Synchronous exports up to 5,000 rows, async up to 100,000 rows.; CSV columns: `post_id`, `published_at`, `platform_id`, `author_name`, `author_url`, `body_markdown`, `sentiment`, `topics`, `reach`, `engagement`, `url`, `watchlist_ids`.; Async exports write to Blob and track `export_jobs`. |
| 13.4 | backend engineer | `export_jobs`, sync/async thresholds, Blob lifecycle, and rate limits for CSV/JSON exports, | exports cannot overwhelm the platform. | Synchronous exports up to 5,000 rows; async up to 100,000 rows.; `POST /v1/posts/export` creates `export_jobs` and streams to Blob.; `export_jobs` table tracks status, row count, blob path, SHA-256, and expiry. |
| 13.13 | backend engineer | `GET /v1/prospecting-lists/:id/export.csv` and `POST /v1/prospecting-lists/:id/crm-handoff`, | `Social-Selling-Strategist` can export or push leads to a CRM. | CSV export with metadata-only columns and same bounds as `ADR-0111`.; `POST .../crm-handoff` accepts `crmConnectorId`, `caseType='lead'`, and `selectedEntryIds`.; `CRMConnector` receives a batch of `ProspectingListEntryPayload` and maps to leads. |

### 6.3 Workflow Diagrams / Steps

### 1. Synchronous export caps
- `limit <= 5,000` and `format='csv'` is synchronous.
- `Content-Type: text/csv; charset=utf-8`.
- Streamed row-by-row; no full in-memory materialization.
- Default `limit` is 1,000.

### 2. Async export thresholds
- Any request with `limit > 5,000`, or `format='json'`, or `watchlistId` that matches > 5,000 posts goes async.
- `POST /v1/posts/export` (async) returns `202 Accepted` with `jobId`.
- The worker streams the result to Azure Blob Storage and writes `export_jobs`:
  ```sql
  export_jobs (
    id uuid,
    tenant_id uuid,
    requested_by_user_id uuid,
    status text,                 -- 'pending' | 'running' | 'ready' | 'expired' | 'failed'
    format text,
    row_count int,
    blob_path text,
    sha256 text,
    expires_at timestamptz,
    created_at timestamptz
  );
  ```

### 3. Hard limits
- CSV: max 100,000 rows per export.
- JSON: max 10,000 rows per export (because JSON includes full post bodies and is larger).
- Max concurrent async exports per tenant: 3.
- Max export file size: 100 MB.

### 4. Rate limiting
- `GET /v1/posts/export.csv` — 60 requests per hour per tenant.
- `POST /v1/posts/export` — 20 async jobs per hour per tenant.
- `GET /v1/exports/:id` — 120 requests per hour per tenant.
- `GET /v1/exports/:id/download` — 10 downloads per hour per tenant.

### 5. Blob storage lifecycle
- Async exports are stored in a tenant-scoped Blob container.
- Default expiry: 24 hours for the download URL, 7 days for the blob object.
- Expired exports are hard-deleted by a scheduled worker.
- `export_jobs` rows are retained for 90 days for audit.

### 6. Error responses
- `400 INVALID_LIMIT` if `limit` < 1 or > hard cap.
- `429 EXPORT_RATE_LIMITED` if rate cap exceeded.
- `422 EXPORT_TOO_LARGE` if the matched set exceeds 100,000 rows.
- `500 EXPORT_WORKER_FAILED` if the async job fails, with a retryable `jobId`.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. Synchronous export caps
- `limit <= 5,000` and `format='csv'` is synchronous.
- `Content-Type: text/csv; charset=utf-8`.
- Streamed row-by-row; no full in-memory materialization.
- Default `limit` is 1,000.

### 2. Async export thresholds
- Any request with `limit > 5,000`, or `format='json'`, or `watchlistId` that matches > 5,000 posts goes async.
- `POST /v1/posts/export` (async) returns `202 Accepted` with `jobId`.
- The worker streams the result to Azure Blob Storage and writes `export_jobs`:
  ```sql
  export_jobs (
    id uuid,
    tenant_id uuid,
    requested_by_user_id uuid,
    status text,                 -- 'pending' | 'running' | 'ready' | 'expired' | 'failed'
    format text,
    row_count int,
    blob_path text,
    sha256 text,
    expires_at timestamptz,
    created_at timestamptz
  );
  ```

### 3. Hard limits
- CSV: max 100,000 rows per export.
- JSON: max 10,000 rows per export (because JSON includes full post bodies and is larger).
- Max concurrent async exports per tenant: 3.
- Max export file size: 100 MB.

### 4. Rate limiting
- `GET /v1/posts/export.csv` — 60 requests per hour per tenant.
- `POST /v1/posts/export` — 20 async jobs per hour per tenant.
- `GET /v1/exports/:id` — 120 requests per hour per tenant.
- `GET /v1/exports/:id/download` — 10 downloads per hour per tenant.

### 5. Blob storage lifecycle
- Async exports are stored in a tenant-scoped Blob container.
- Default expiry: 24 hours for the download URL, 7 days for the blob object.
- Expired exports are hard-deleted by a scheduled worker.
- `export_jobs` rows are retained for 90 days for audit.

### 6. Error responses
- `400 INVALID_LIMIT` if `limit` < 1 or > hard cap.
- `429 EXPORT_RATE_LIMITED` if rate cap exceeded.
- `422 EXPORT_TOO_LARGE` if the matched set exceeds 100,000 rows.
- `500 EXPORT_WORKER_FAILED` if the async job fails, with a retryable `jobId`.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Synchronous CSV exports stream row-by-row without full in-memory materialization | Performance | Must | Memory profile is flat for a 5,000-row export; monitored in contract tests |
| NFR-002 | `export_jobs` status is trackable and consistent (`pending`, `running`, `ready`, `expired`, `failed`) | Reliability | Must | Status transitions are auditable and tested end-to-end |
| NFR-003 | Export files and presigned URLs are tenant-scoped and time-limited | Security | Must | URLs cannot be used outside their 24-hour window; no cross-tenant access |
| NFR-004 | The platform can support bounded concurrent async export load (3 per tenant, rate-limited) | Scalability | Must | Load test confirms no resource exhaustion under 10x expected request volume |
| NFR-005 | Export error responses are actionable and do not leak internal paths | Usability | Should | Error messages describe the limit/rate/cap exceeded, not internal stack traces |
| NFR-006 | Async job failures are logged with `jobId` and retriable or manually re-queueable | Maintainability | Should | Failure logs include tenant, user, format, and error code |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A tenant exceeds rate or row caps and receives repeated errors | Medium | Medium | Clear error codes, in-product messaging, and documented limits | Product Owner |
| R-002 | Async worker failure leaves a job stuck in `running` | Medium | High | Worker heartbeat, timeout, and `failed` transition with `jobId` for retry | Backend-Engineer |
| R-003 | Blob lifecycle misconfiguration causes unbounded storage growth | Low | High | Automated 7-day hard delete and 24-hour URL expiry; monitor Blob capacity | Platform-Admin |
| R-004 | Export accidentally leaks connector secrets or another tenant's data | Low | High | RLS on every query, stable CSV columns, and redaction contract tests | Backend-Engineer |
| R-005 | Large exports cause memory spikes even when streamed | Medium | High | Cursor-based streaming, 100 MB file cap, and no full in-memory materialization | Backend-Engineer |

---

---

## 12. Assumptions and Dependencies

- Azure Blob Storage and the existing tenant-scoped container model are already in place (ADR-0016).
- The base data-export endpoints and RLS patterns from `ADR-0090` and `ADR-0074` are available.
- Exports are always scoped to the caller's tenant; `withTenant()` or an equivalent RLS helper is used at every query step.
- Connector secrets, OAuth tokens, and `rawPayload` are never serialized to an export file.

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

---

## 13. Open Questions

- Should the synchronous cap be configurable per plan (free vs. paid)?
- How is the matched-row count estimated before the export begins?
- Should failed exports be retried automatically, or only on manual re-queue?
- How are CSV and JSON exports signed for integrity?

---

---

## 14. Appendix

### Reference Documents

- ADR-0111: `docs/adr/0111-export-bounding-streaming-and-size-caps.md`
- BRD-0111: `docs/project docs/Business-Requirements/BRD-0111-Export-Bounding-Streaming-And-Size-Caps.md`
- Feature design: `docs/product-research/feature-designs/10-data-export.md`
- User stories: `docs/user-stories/epic-10-adr-0086-to-0094.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0111 and BRD-0111. |