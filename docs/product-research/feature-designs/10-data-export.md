---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Data export

### What it is
Allowing tenants to download their listening data and workspace metadata in machine-readable formats (JSON, CSV) for backup, analysis, or compliance.

### End-user benefits
- **Portability:** users are not locked into the product for analysis.
- **Compliance:** GDPR/CCPA data portability and audit requirements.
- **Deeper analysis:** import posts into Excel, BI, or custom models.

### Core details
- ADR-0074 and Stories 3.16/6.40 define the first step: `GET /v1/tenants/me/export/workspace` (JSON) and `GET /v1/posts?format=csv` (CSV).
- Exports must be bounded, synchronous, and respect RLS.
- The deletion/offboarding export already exists (Story 3.8); on-demand export should reuse the same patterns.

### Implementation complexity
**Medium.** Bounded streaming, CSV serialization, and size caps need careful design. Workspace JSON is more complex because it spans multiple tables and must avoid leaking secrets.

### Growth and reach
Export is an enterprise procurement checkbox. It also makes the product safer for customers who need custody of their own data.

---

## Technical design

- **Data flow:** user requests export → backend validates RLS and bounds (date range, max rows) → queries `social_posts`, `watchlists`, `post_watchlist_matches`, `authors`, `connector_activations` as needed → serializes to CSV (per-table streams) or JSON (workspace snapshot) → streams to Azure Blob Storage with a SAS URL or serves directly if small.
- **Component interactions:** export reuses the deletion/offboarding export mechanism (Story 3.8) but is on-demand and scoped to the caller's RLS. CSV uses cursor-based streaming to avoid memory spikes.
- **REST/Service Bus contracts:** `GET /v1/posts?format=csv&...` (synchronous), `GET /v1/tenants/me/export/workspace` (JSON; can be async with a `job_id`), `GET /v1/export/jobs/:id` for async status.
- **Storage:** `social_posts`, `watchlists`, `post_watchlist_matches`, `authors` are the primary sources; exported files land in tenant-scoped Azure Blob Storage or are generated on the fly.
- **Security considerations:** Every query must be wrapped in `withTenant()` to enforce RLS; workspace JSON must redact `platform_credentials` and other secrets; export files are tenant-scoped and time-limited; large exports should require a background job to prevent DoS.

## Backend principles

- **Bounded, synchronous by default; async for large exports.** v1 CSV export is a streaming response bounded by row/date limits. Workspace JSON and large exports are async jobs to avoid blocking worker threads.
- **RLS at every step.** The export query must be a `withTenant()` query or use the tenant-context helper so the user can only export their own tenant's data.
- **No secrets in exports.** `platform_credentials` (Key Vault), OAuth tokens, and refresh tokens must never leave the tenant boundary in an export file.
- **Contract-test targets.** Verify that an export contains only the calling tenant's data, that CSV columns are stable, that workspace JSON does not include credential fields, and that bounds are enforced.

## Frontend / UI principles

- **User flow:** user navigates to "Export" → chooses format (CSV posts, workspace JSON) → sets date range/watchlist filters → clicks export → gets download link or job status.
- **Component hierarchy:** `ExportPage` → `ExportFormatSelector` → `ExportFilters` (date, watchlist, provider) → `ExportDownload` (link/status/error).
- **State management:** Form state for filters; polling for async job status; error state for bounds/permissions.
- **Accessibility and responsive design:** Clear format labels, focus management for job status, and accessible progress indicators.

## Open questions

- What is the maximum row/calendar limit for a synchronous CSV export?
- Should exports be stored in Azure Blob Storage with presigned URLs or served as inline attachment downloads?
- Do we support scheduled/repeating exports (e.g., weekly digest CSV)?
- Which workspace tables belong in the JSON export (do we include users, invitations, audit logs)?
- How do we handle right-to-erasure exports vs. regular data export?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Synchronous CSV limit?** | **50,000 rows or 50 MB** for v1. Above that, switch to an **async background job** that streams to Azure Blob and emails a presigned URL. Use keyset/cursor pagination, not `OFFSET`. | SaaS CSV export guides warn that naive exports die around 500k rows; 50k-100k is the safe synchronous boundary. Sideguy and Viprasol both use streaming + presigned-URL for scale. |
| **Blob with presigned URL or inline?** | **Azure Blob with presigned SAS URLs** for anything > 5 MB. Serve small exports inline only. This keeps the API stateless and supports async large exports. | Viprasol/Sideguy patterns: stream to S3/Blob, then presigned-URL delivery. Azure Data Explorer `.export` also writes to storage, not inline. |
| **Scheduled/repeating exports?** | **Defer to v2**. v1 is on-demand. Scheduled exports are an enterprise procurement checkbox but add cron, quota, and delivery complexity. | ScoutSocial and VEREID treat exports as on-demand DSR tools; scheduled digests are a paid-tier feature in most tools. |
| **Workspace tables in JSON export?** | Include `tenants`, `users` (no credential secrets), `watchlists`, `social_posts`, `post_watchlist_matches`, `connector_activations` metadata, `authors`. **Exclude** `platform_credentials` secrets, `platform_admin_audit_log`, and raw OAuth tokens. | GDPR Article 15/20 portability covers user-facing data; secrets and cross-tenant audit logs are not the user's data. OpenWeb's export endpoint excludes SSO tokens. |
| **Right-to-erasure vs. regular export?** | Separate `POST /v1/me/delete` (DSR) from the regular export. Erasure uses **cryptographic shredding/redaction** with tombstones, 30-day SLA, and an audit entry. The regular export is a tenant data portability export. | VEREID and PasskeyBridge distinguish `access` and `erasure` DSRs with separate endpoints and shredding; Anchorpipe tracks DSR requests and statuses. |

### Sources consulted

- ScoutSocial: CCPA privacy rights — https://scoutsocial.ai/legal/ccpa
- Anchorpipe: data subject request workflows — https://anchorpipe-docs.vercel.app/docs/guides/security/data-subject-requests
- PasskeyBridge: DSAR workflows — https://docs.passkeybridge.io/guides/dsar-workflows
- OpenWeb: export and delete user data — https://developers.openweb.com/docs/export-and-delete-user-data
- VEREID: DSR handling — https://docs.vereid.com/guides/dsr-handling
- Viprasol: SaaS CSV export — https://viprasol.com/blog/saas-csv-export/
- Sideguy: scalable data export — https://www.sideguysolutions.com/shareables/scalable-data-export-nodejs.html
- Stack Overflow: CsvHelper stream too long — https://stackoverflow.com/questions/69127949/csvhelper-stream-too-long
- Azure: export data to storage — https://learn.microsoft.com/en-us/azure/data-explorer/kusto/management/data-export/export-data-to-storage

## Persona acceptance

- **Tenant-Business-Analyst (primary):** can export posts CSV and workspace JSON with predictable bounds, stable columns, and no cross-tenant leakage.
- **Author-of-a-Post (primary):** (future DSR path) a public takedown request creates a tracked ticket and does not leak requester details to the tenant.
- **Data-Subject (primary):** can request a machine-readable export of their own data and a separate erasure request.
- **Legal-Advisor (primary):** can generate a compliance audit pack that includes export, deletion, and decision logs.
- **Tenant-Admin (secondary):** can run tenant-scoped exports and revoke export permissions per role.
- **Sole-Operator (secondary):** can enforce export caps and storage budgets at the platform level.

## AI enhancements

- **AI-generated export summary:** a plain-language overview of what is in the export and why it might matter.
- **Smart redaction suggestions:** the AI flags fields that may contain PII or secrets before export.
- **Data quality scoring:** warn if the exported dataset is incomplete, skewed, or has gaps.
- **Natural-language export builder:** “give me all negative Facebook mentions from July” is turned into the right filters and format.
