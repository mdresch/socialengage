---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# DSR self-service portal

### What it is

A tenant-authenticated portal where an end user (Data-Subject) can submit, track, and download responses for Data-Subject Access Requests (DSARs): access/export, rectification, erasure, and restriction-of-processing.

### End-user benefits

- **Transparency:** users can see what data is held and how to exercise their rights.
- **Reduced operational load:** self-service reduces support tickets and manual DSR handling.
- **Compliance:** supports GDPR Articles 15, 16, 17, 18 and CCPA access/deletion rights.
- **Trust:** clear SLAs and status tracking build confidence in the platform.

### Core details

- Available to any user with a tenant account (Tenant-User or Tenant-Admin) and, in the future, to verified non-users through a request ID.
- Request types: `access` (export), `rectification`, `erasure`, `restriction`.
- Each request gets a ticket ID, status, and due-by date.
- Completed access requests provide a presigned download link for a machine-readable export.
- Requests are logged in `platform_admin_audit_log`.

### Implementation complexity

**Medium-to-high.** Requires secure request intake, request validation, workflow orchestration, export generation, and notification. The biggest challenge is the cross-table export/erasure orchestration.

### Growth and reach

A compliance enabler. Required for enterprise tenants in regulated industries. Often a procurement gate.

---

## Technical design

- **Data flow:** user opens DSR portal → `GET /v1/me/data-requests` lists existing requests → `POST /v1/me/data-requests` creates a new `data_subject_requests` row → async worker collects the user's data across tenant tables → export written to Blob with presigned URL or erasure performed → status updated, requester notified.
- **Component interactions:** `DSRPortal` → `dataSubjectRequestStore` → export/erasure worker → `Azure Blob` → notification service.
- **REST/Service Bus contracts:** `POST /v1/me/data-requests`, `GET /v1/me/data-requests`, `GET /v1/me/data-requests/:id/download`. `DataSubjectRequestCompletedEvent` in v2.
- **Storage:** `data_subject_requests` with `request_type`, `status`, `requested_at`, `completed_at`, `download_url`.
- **Security considerations:** Users can only request data for themselves. Rectification and erasure require identity verification. All actions are auditable.

## Backend principles

- **User-scoped by default.** A user can only see and request their own data, unless they are a parent/guardian or authorized agent.
- **Async by default.** Export and erasure are long-running; return `202 Accepted` and a status URL.
- **Preservation where required.** Erasure should use cryptographic redaction or tombstones to preserve referential integrity and audit logs.
- **SLA tracking.** Store and expose due dates based on regulation and tenant policy.

## Frontend / UI principles

- **User flow:** user opens DSR portal from settings → selects request type → confirms identity → receives ticket ID and due date → checks status and downloads export when ready.
- **Component hierarchy:** `DSRPortal` → `NewRequestForm` / `RequestHistory` / `RequestStatusCard`.
- **State management:** React Query or server state for request status; polling for in-progress requests.
- **Accessibility and responsive design:** Clear status indicators, easy-to-read due dates, and accessible forms.

## Open questions

- Should non-tenant users (pure data subjects) use the same portal with an email verification step, or a separate public form?
- Which data is in scope for `access` — only user profile, or also posts the user authored and any derived analytics?
- How do we verify identity for erasure/rectification to prevent account takeover abuse?
- What is the default SLA, and should it differ by jurisdiction?
- Should the portal be exposed at the tenant domain or a central platform domain?

## AI enhancements

- **Data scope preview:** the AI summarizes what data will be included in an access request before the user submits it.
- **Smart redaction:** the AI flags fields that may contain another person's PII and suggests redaction before export.
- **Request summary:** the AI generates a plain-language explanation of what each request type means and what to expect.

## Persona acceptance

- **Data-Subject (primary):** can submit and track access/erasure requests and download their data export.
- **Legal-Advisor (primary):** can produce a complete, timestamped record of every request and response.
- **Tenant-Admin (secondary):** can view and manage DSR requests for their tenant from the admin UI.
- **Sole-Operator (secondary):** can monitor request volume, SLA compliance, and overdue requests.
