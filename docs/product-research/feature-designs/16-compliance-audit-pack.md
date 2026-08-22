---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Compliance audit pack

### What it is

A one-click report that compiles all governance-relevant activity for a given tenant and period: data collected, watchlists and queries, alert and response actions, exports, user role changes, and DSR outcomes. The pack is designed to be defensible in an audit or legal review.

### End-user benefits

- **Defensibility:** a single artifact that explains what the platform did and why for a given period.
- **Reduced legal overhead:** faster responses to audits, subpoenas, and regulatory inquiries.
- **Transparency:** shows data subjects and regulators that decisions are documented.
- **Operational clarity:** helps tenants review their own usage and policy compliance.

### Core details

- Scope: tenant, date range, and optional event types.
- Output: PDF for human review and JSON for downstream systems.
- Includes: connector activations, watchlists, query strings, ingested post counts, enrichment actions, alerts, responses, exports, role changes, DSR requests.
- Excludes: raw post content unless explicitly requested and authorized.
- The pack is signed with a checksum and stored in `platform_admin_audit_log`.

### Implementation complexity

**Medium.** The main work is aggregating data from many tables into a consistent, readable report. The heavy part is query construction and report formatting, not new infrastructure.

### Growth and reach

A differentiator for enterprise and regulated tenants. Needed for SOC 2, ISO 27001, and GDPR Article 30 record-of-processing readiness.

---

## Technical design

- **Data flow:** user/admin selects period and tenant → `POST /v1/admin/compliance-audit-pack` or `POST /v1/tenant/compliance-audit-pack` queues a report job → worker gathers records from `connector_activations`, `watchlists`, `social_posts` (counts only), `post_watchlist_matches`, `outbound_activities`, `data_subject_requests`, `users`, `platform_admin_audit_log` → PDF/JSON generated → stored in Blob with presigned URL.
- **Component interactions:** `ComplianceAuditPackUI` → `complianceAuditPackStore` → report worker → `Azure Blob` → notification.
- **REST/Service Bus contracts:** `POST /v1/tenant/compliance-audit-pack`, `GET /v1/tenant/compliance-audit-pack/:id/status`, `GET /v1/tenant/compliance-audit-pack/:id/download`.
- **Storage:** `compliance_audit_packs` table with `tenant_id`, `period_start`, `period_end`, `format`, `status`, `download_url`.
- **Security considerations:** Only `tenant_admin` and `platform_admin` can generate packs. Packs are encrypted at rest in Blob. Download links expire.

## Backend principles

- **Aggregate, don't leak.** The pack includes counts and metadata, not raw tenant post bodies unless explicitly authorized.
- **Tamper-evident.** Include a checksum and sign the pack so it can be verified.
- **Scope-controlled.** The requester can only generate a pack for their own tenant (or all tenants, for Platform-Admin).
- **Async.** Report generation is a background job to avoid database load.

## Frontend / UI principles

- **User flow:** admin opens compliance section → selects date range and scope → previews inclusions → submits → receives email with download link.
- **Component hierarchy:** `ComplianceAuditPackPage` → `AuditPackForm` → `AuditPackList` → `AuditPackDownload`.
- **State management:** Server state for pack history and status.
- **Accessibility and responsive design:** Clear checkboxes for inclusions, large date pickers, and status messages.

## Open questions

- How long should packs be retained, and who can delete them?
- Should raw post content be included if a regulator requests it, or kept separate?
- Which jurisdictions' reporting formats should be supported out of the box?
- Should the pack include the platform's own data-handling policy document?
- How do we handle multi-tenant audit requests where one DSR affected several tenants?

## AI enhancements

- **Narrative summary:** the AI writes an executive summary of the audit pack, calling out unusual patterns or missing documentation.
- **Gap detection:** the AI flags periods or actions that are under-documented or missing expected logs.
- **Risk callouts:** the AI highlights high-risk actions such as bulk exports, role escalations, or repeated failed authentication attempts.

## Persona acceptance

- **Legal-Advisor (primary):** can generate a pack, verify its checksum, and use it as evidence in an audit or review.
- **Tenant-Admin (primary):** can generate a tenant-scoped pack for their own data handling review.
- **Platform-Admin (primary):** can generate platform-level or per-tenant packs for operational and compliance oversight.
- **Sole-Operator (secondary):** can run a pack before a compliance conversation without writing manual queries.
- **Data-Subject (secondary):** benefits indirectly through faster, more defensible DSR responses.
