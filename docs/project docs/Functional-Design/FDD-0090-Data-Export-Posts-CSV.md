# BRD-0090: Data Export — Posts CSV

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0090: Data Export — Posts CSV |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0090-data-export-posts-csv.md, ../Business-Requirements/BRD-0090-Data-Export-Posts-CSV.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0090-data-export-posts-csv.md and the business requirements in BRD-0090-Data-Export-Posts-CSV.md into functional design for **Data Export Posts CSV**.
Tenants need a reliable, self-service way to download their matched social-listening posts in a machine-readable format for backup, analysis, and compliance. While workspace-wide JSON export is already planned under ADR-0074 / Story 3.16, CSV remains the universal interchange format for spreadsheets, BI tools, and regulatory filings. This BRD captures the business requirements for a dedicated `GET /v1/posts/export.csv` endpoint that streams bounded, tenant-scoped CSV exports while enforcing row-level security and excluding connector secrets.

The proposed capability is a bounded, on-demand CSV export of posts visible to the caller. Synchronous exports serve the common case (up to 10,000 rows by default, with a hard cap of 50,000). Requests exceeding the synchronous threshold are handed off to an asynchronous background job that writes the file to Azure Blob Storage and returns a presigned download URL. The export shape intentionally omits raw internal JSONB fields and credential material, producing an analysis-ready file rather than a debugging dump.

> **Draft notice:** ADR-0090 has not yet been accepted. The scope, limits, and column set in this BRD reflect the current Proposed ADR and may change during review.

---

### 2.2 Scope
**In scope:**
- A dedicated `GET /v1/posts/export.csv` endpoint for `Tenant-Admin` and `Tenant-User` identities.
- Synchronous streaming CSV response bounded by a configurable row limit.
- Optional filters: `watchlistId`, `start`/`end` `published_at` range, and `limit`.
- Stable CSV column set: `post_id`, `published_at`, `platform_id`, `author_name`, `author_url`, `body_markdown`, `sentiment`, `topics`, `reach`, `engagement`, `url`, `watchlist_ids`.
- Asynchronous export for requests above the synchronous threshold, with `export_jobs` status tracking.
- Row-level security (RLS) via `withTenant()` and watchlist ownership / sharing checks.
- Exclusion of `rawPayload`, `enrichment` JSONB internals, and connector credentials from the export.

**Out of scope:**
- Workspace JSON export (covered by ADR-0074).
- On-demand full workspace CSV export.
- Excel `.xlsx` generation.
- Scheduled or repeating exports (e.g., weekly CSV digests).
- Data erasure / deletion through the export endpoint.
- Inline editing or re-import of exported CSV.

## 3. Context and Background
See ADR Context.
Tenants need a reliable, self-service way to download their matched social-listening posts in a machine-readable format for backup, analysis, and compliance. While workspace-wide JSON export is already planned under ADR-0074 / Story 3.16, CSV remains the universal interchange format for spreadsheets, BI tools, and regulatory filings. This BRD captures the business requirements for a dedicated `GET /v1/posts/export.csv` endpoint that streams bounded, tenant-scoped CSV exports while enforcing row-level security and excluding connector secrets.

The proposed capability is a bounded, on-demand CSV export of posts visible to the caller. Synchronous exports serve the common case (up to 10,000 rows by default, with a hard cap of 50,000). Requests exceeding the synchronous threshold are handed off to an asynchronous background job that writes the file to Azure Blob Storage and returns a presigned download URL. The export shape intentionally omits raw internal JSONB fields and credential material, producing an analysis-ready file rather than a debugging dump.

> **Draft notice:** ADR-0090 has not yet been accepted. The scope, limits, and column set in this BRD reflect the current Proposed ADR and may change during review.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenant data portability for analysis and compliance | Tenants can download a posts CSV without engineering support |
| 2 | Protect tenant and connector secrets during export | Exported CSV never contains `rawPayload`, OAuth tokens, or credential envelopes |
| 3 | Prevent unbounded exports from destabilizing the platform | Exports respect row limits and fail safely with documented HTTP codes |
| 4 | Reuse the export foundation for future DSR access requests | The same streaming worker and CSV shape can be reused by ADR-0093 / `15-dsr-self-service-portal` |

---

**Positive consequences (from ADR):**
1. **Portability:** tenants can take their matched posts into other tools.
2. **Compliance support:** CSV format is suitable for DSR responses and regulator requests.
3. **Bounded streaming:** large exports do not hold HTTP connections open or load all rows into memory.
4. **Storage cost:** async exports create temporary Blob objects; they expire after 24 hours.
5. **Foundation for `15-dsr-self-service-portal`:** the DSR access-request export can reuse this worker and CSV shape.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose `GET /v1/posts/export.csv` for `Tenant-Admin` and `Tenant-User` | Must | Endpoint is mounted, authenticated, and returns `text/csv` | Product Owner |
| BR-002 | The system shall support optional `watchlistId`, `start`, `end`, `limit`, and `format=csv` query parameters | Must | All filters are validated and applied to the returned rows | Product Owner |
| BR-003 | The system shall return a CSV header and one row per matched post | Must | Output is RFC 4180-ish quoted, UTF-8, with the agreed column set | Product Owner |
| BR-004 | The system shall exclude `rawPayload`, raw `enrichment` JSONB, and connector credentials from the CSV | Must | Contract tests prove the export contains no secret fields | Product Owner |
| BR-005 | The system shall enforce a default and hard row limit before streaming begins | Must | Exceeding the hard cap is rejected or shifted to async; no unbounded stream | Product Owner |
| BR-006 | The system shall sort results by `published_at` descending | Should | The first data row is the most recent post in the filtered set | Product Owner |
| BR-007 | The system shall support async exports for requests above the synchronous threshold | Should | `POST /v1/posts/export` (or equivalent) returns `202` with a `jobId` and a status endpoint | Product Owner |
| BR-008 | The system shall generate a presigned download URL for completed async exports | Should | Caller can download the file for up to 24 hours after completion | Product Owner |
| BR-009 | The system shall not allow `platform_admin` or unauthenticated callers to export tenant posts | Must | `platform_admin` and anonymous requests are rejected | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary user of exported CSV for analysis and reporting | High | Predictable columns, stable quoting, safe row limits, no secrets |
| Tenant-Admin | Tenant owner who may run or authorize exports | Medium | Ability to export all tenant-visible posts and trust RLS |
| Tenant-User | Everyday user who exports posts matched by their watchlists | Medium | Simple filters, fast downloads for small result sets |
| Legal-Advisor / Compliance Officer | Uses exports for DSR / regulatory response | Medium | Machine-readable format, evidence of no cross-tenant leakage |
| Platform-Admin | Operates the platform; has zero tenant content | Low | No access to per-tenant exports; monitoring of export volume |
| Data-Subject (future) | Public user requesting their own data via DSR | Low | Same CSV shape may be reused under the DSR portal |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.8 | epic-10-adr-0086-to-0094.md | As backend engineer, I want `GET /v1/posts/export.csv` to stream bounded CSV exports and `POST /v1/posts/export` for async large exports, so that tenants can... | Synchronous exports up to 5,000 rows, async up to 100,000 rows.; CSV columns: `post_id`, `published_at`, `platform_id`, `author_name`, `author_url`, `body_ma... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `post_id` | Public post identifier | `social_posts.id` | Tenant | Internal reference |
| `published_at` | Post publication timestamp | `social_posts.published_at` | Tenant | Public |
| `platform_id` | Public platform code | `social_posts.provider` / `platform_id` | Tenant | Public |
| `author_name` | Resolved author display name | `authors.name` | Tenant | Public |
| `author_url` | Public author profile URL | `authors.url` or `social_posts.author_url` | Tenant | Public |
| `body_markdown` | Canonical normalized post body | `social_posts.body_markdown` | Tenant | Public |
| `sentiment` | Derived sentiment label from enrichment | `enrichment` (label only) | Tenant | Public |
| `topics` | Pipe-separated list of topic names | `post_topics` / `topics` | Tenant | Public |
| `reach` | Reach/audience metadata if available | `social_posts.metadata` | Tenant | Public |
| `engagement` | Engagement metadata if available | `social_posts.metadata` | Tenant | Public |
| `url` | Canonical post URL | `social_posts.url` | Tenant | Public |
| `watchlist_ids` | Pipe-separated matching watchlist IDs | `post_watchlist_matches` | Tenant | Internal reference |

> **Sensitivity note:** All exported fields are user-facing, redacted values. Internal credential, token, and `rawPayload` data must not be included.

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A caller may only export posts that are visible to their resolved `tenant_id` through RLS. |
| BRU-002 | If `watchlistId` is provided, it must be owned by or shared with the caller. |
| BRU-003 | `rawPayload`, `enrichment` JSONB, and connector credential fields are never written to the CSV. |
| BRU-004 | `platform_id` in the CSV is the public platform code, not the internal connector identifier. |
| BRU-005 | The synchronous export limit is enforced before streaming begins; exceeding it must either fail or trigger async export. |
| BRU-006 | `Tenant-User` may export posts they can see; `Tenant-Admin` may export all posts in the tenant. |
| BRU-007 | Async export files are tenant-scoped, time-limited, and accessed via presigned URLs. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0090 acceptance | Internal | Product Owner / Menno | Upon ADR review |
| D-002 | `withTenant()` RLS helpers and `GET /v1/posts` filtering (existing) | Internal | Engineering | Already in place |
| D-003 | Azure Blob Storage and presigned-SAS generation | External | Platform Operations | Already provisioned |
| D-004 | `POST /v1/posts/export` async worker and `export_jobs` table design | Internal | Engineering | Defined by ADR-0090 / Story 10.8 |
| D-005 | Future DSR self-service portal (`15-dsr-self-service-portal`) | Internal | Product Owner | Reuses this export shape; not a blocker for v1 |

---

- The caller is an authenticated `Tenant-Admin` or `Tenant-User` resolved through the existing identity middleware.
- The `social_posts`, `watchlists`, `post_watchlist_matches`, and `authors` tables already exist and are accessible under tenant RLS.
- Azure Blob Storage is available for temporary async export files.
- CSV consumers can open UTF-8 text; an optional BOM may be included for Excel compatibility.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | CSV export must stream rows and not load the entire result set into memory | Performance | Must | Measured by contract test with 10,000+ rows |
| NFR-002 | Exports must respect row-level tenant isolation under `withTenant()` | Security | Must | Cross-tenant export attempts fail in contract tests |
| NFR-003 | Exported filenames should include the tenant and date | Usability | Should | `Content-Disposition` reflects `<tenant>-posts-<date>.csv` |
| NFR-004 | Async export files must expire within 24 hours | Security / Cost | Must | Blob objects are deleted or inaccessible after expiry |
| NFR-005 | The export endpoint must not write to the database except for job tracking | Reliability | Should | No new tables beyond `export_jobs` are required for CSV |
| NFR-006 | CSV output must be stable and versioned for downstream consumers | Maintainability | Should | Column set is documented and contract-tested | 

---

## 11. Error Handling and Exceptions
1. **Portability:** tenants can take their matched posts into other tools.
2. **Compliance support:** CSV format is suitable for DSR responses and regulator requests.
3. **Bounded streaming:** large exports do not hold HTTP connections open or load all rows into memory.
4. **Storage cost:** async exports create temporary Blob objects; they expire after 24 hours.
5. **Foundation for `15-dsr-self-service-portal`:** the DSR access-request export can reuse this worker and CSV shape.

---

## 12. Assumptions and Dependencies
- The caller is an authenticated `Tenant-Admin` or `Tenant-User` resolved through the existing identity middleware.
- The `social_posts`, `watchlists`, `post_watchlist_matches`, and `authors` tables already exist and are accessible under tenant RLS.
- Azure Blob Storage is available for temporary async export files.
- CSV consumers can open UTF-8 text; an optional BOM may be included for Excel compatibility.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Large exports cause memory or HTTP timeout issues | Medium | High | Enforce row caps, stream rows, shift large exports to async Blob jobs | Engineering Lead |
| R-002 | Accidental secret leakage in CSV | Medium | High | Explicit allow-list of columns; contract tests redact `rawPayload` and `enrichment` | Security Lead |
| R-003 | Cross-tenant data leakage | Low | High | Wrap every query in `withTenant()` and verify in contract tests | Engineering Lead |
| R-004 | Storage cost from temporary async Blob files | Low | Medium | 24-hour expiry on presigned URLs / objects; monitor export volume | Platform Operations |
| R-005 | Low adoption if UI for filters is not discoverable | Medium | Medium | Include export action in the post-feed and tenant admin UI; document the endpoint | Product Owner |
| R-006 | ADR is Proposed and may change | High | Medium | Treat this BRD as a draft; re-synchronize after ADR acceptance | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0090-data-export-posts-csv.md`
- BRD: `../Business-Requirements/BRD-0090-Data-Export-Posts-CSV.md`
- Feature design: `docs/product-research/feature-designs/10-data-export.md``
- Deep research: `docs/product-research/reports/*data-export*deep-research.md``
- User stories: see extracted stories above