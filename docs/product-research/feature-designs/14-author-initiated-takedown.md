---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Author-initiated takedown

### What it is

A public, non-authenticated form that lets an author of an ingested public post request removal or redaction of that post from the tenant's listening data. The request creates a tracked data-subject rights (DSR) ticket that can be reviewed by the tenant or platform operator.

### End-user benefits

- **Trust and legitimacy:** authors can exercise control over how their public content is used, which reduces legal and ethical risk.
- **Compliance readiness:** creates an auditable process that supports Article 17 right-to-erasure and CCPA deletion requests.
- **Clear workflow:** a single, documented path for takedown requests instead of ad-hoc emails or manual tracking.
- **Defensibility:** every request, review, and decision is logged for the Legal-Advisor and Data-Subject personas.

### Core details

- Public form that requires the post URL, the requester's contact info, and the reason for takedown.
- Creates a `data_subject_requests` ticket with status `pending`, `approved`, `rejected`, or `escalated`.
- Does not expose requester details to the tenant until the request is approved.
- Approved requests perform redaction or soft-deletion of the affected `social_posts` row and child matches.
- Notification is sent to the requester when the request is resolved.

### Implementation complexity

**Medium.** Requires a new public endpoint, a DSR request table, an approval workflow, redaction logic, and notification. The heavy part is the workflow and the legal review step, not the data model.

### Growth and reach

This is a table-stakes compliance and trust feature. It becomes more important as tenants scale, ingest more public content, and face DSR requests.

---

## Technical design

- **Data flow:** author submits public form → `POST /v1/dsr/takedown` creates a `data_subject_requests` row with `type: takedown` and `status: pending` → Legal/tenant review UI shows the request → approved request calls a redaction worker that replaces the post body with `[redacted]` or deletes the row (configurable) → `data_subject_requests` updated to `completed` with audit log.
- **Component interactions:** public form → `takedownPublicRouter` → `dataSubjectRequestStore` → redaction worker → `social_posts` / `post_watchlist_matches` → notification service.
- **REST/Service Bus contracts:** `POST /v1/dsr/takedown`, `GET /v1/dsr/:id/status` (public, token-based). Internal `DELETE /v1/admin/dsr/:id/approve`. `DataSubjectRequestResolvedEvent` published to Service Bus in v2.
- **Storage:** `data_subject_requests` table; `platform_admin_audit_log` records approvals.
- **Security considerations:** public endpoint must be rate-limited and require CAPTCHA to prevent abuse. PII from requesters is stored only until resolution. Tenant data is not exposed to the requester.

## Backend principles

- **Public by design.** The takedown form is intentionally unauthenticated so any author can use it without a tenant account.
- **Approval gate.** Requests are not automatically executed; a human or policy-approved auto-rule must approve them.
- **Redaction, not deletion by default.** Prefer replacing the `body_markdown` and raw payload with `[redacted]` and removing `author` association, to preserve referential integrity and audit continuity.
- **Audit everything.** Every submission, review, and resolution is written to `platform_admin_audit_log`.

## Frontend / UI principles

- **User flow:** public form → confirmation page with a request ID → status page where the requester can check progress using the ID.
- **Component hierarchy:** `TakedownPublicForm` → `TakedownConfirmation` / `TakedownStatusPage`. Admin UI: `DSRReviewQueue` → `DSRReviewDetail`.
- **State management:** Public form uses React state; admin UI uses server state for the review queue.
- **Accessibility and responsive design:** Form is simple, mobile-friendly, and screen-reader accessible; error messages explain what information is missing.

## Open questions

- Should the form require a link to the original post, or can an author search by URL/handle?
- Who approves the request — Platform Admin, Tenant-Admin, or an automated policy?
- Should the system notify the tenant that a takedown occurred, or keep the requester anonymous?
- What is the SLA for response (e.g., 30 days under GDPR)?
- Should takedown be applied to all tenants or only the requesting tenant? (Multi-tenant redaction is likely required.)

## AI enhancements

- **Similar-request detection:** the AI groups takedown requests that target the same post or author to help operators identify coordinated or duplicate requests.
- **Risk scoring:** the AI flags requests that may be abusive, frivolous, or part of a reputation-management campaign.
- **Auto-redaction assistant:** the AI suggests which rows and derived tables (matches, sentiment, topic clusters) are affected by a takedown.

## Persona acceptance

- **Author-of-a-Post (primary):** can find the takedown form, submit a request, and receive a tracking ID without creating an account.
- **Data-Subject (primary):** can exercise the right to request erasure and see a status page.
- **Legal-Advisor (primary):** can review a log of all takedown requests, decisions, and redaction outcomes.
- **Platform-Admin (secondary):** can review and approve/reject requests from a queue without accessing unrelated tenant data.
- **Tenant-Admin (secondary):** can see takedown notices that affect their tenant and confirm the content has been redacted.
