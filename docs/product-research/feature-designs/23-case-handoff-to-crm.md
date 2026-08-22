---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Case handoff to CRM

### What it is

A `Unified Social Inbox` integration that lets a Tenant-Social-Care-Agent escalate a post or conversation into a case in the tenant's connected CRM, support, or ticketing system. The original post becomes a linked source in the CRM case.

### End-user benefits

- **Seamless support workflow:** social care and traditional support share one case history.
- **No context loss:** the CRM case includes a link to the post, author, sentiment, and previous replies.
- **Faster resolution:** the right team can pick up the case with full context.
- **Auditability:** the handoff is recorded in the platform and the CRM.

### Core details

- Agent selects an inbox item and clicks "Create case" or "Escalate to CRM."
- The system creates a case in the connected CRM (via webhook or native API) and returns a case ID and URL.
- The platform stores the `external_case_id` and `external_case_url` on the original `social_posts` or `inbox_conversations` table.
- Optional: the agent can assign a case owner, priority, and category before handoff.
- The `case_handoff` action is auditable and appears in `platform_admin_audit_log`.

### Implementation complexity

**Medium.** Requires a CRM connector framework, a webhook payload contract, and UI for handoff. The heavy part is CRM-specific authentication and payload mapping.

### Growth and reach

Essential for social care at scale. Bridges social listening and existing support infrastructure. A common integration requirement for enterprises.

---

## Technical design

- **Data flow:** agent opens an inbox item → clicks "Create case" → `POST /v1/inbox/:itemId/case` collects post metadata, sentiment, and conversation thread → `CRMConnector.createCase()` sends the payload to the configured CRM → receives `case_id` and `case_url` → stores the mapping and shows a link in the inbox.
- **Component interactions:** `UnifiedInbox` → `InboxItem` → `CreateCaseDialog` → `POST /v1/inbox/:itemId/case` → `crmConnectorStore` → external CRM.
- **REST/Service Bus contracts:** `POST /v1/inbox/:itemId/case`, `GET /v1/inbox/:itemId/case`, `DELETE /v1/inbox/:itemId/case` (unlink). `CaseHandoffEvent` published to Service Bus for audit.
- **Storage:** Add `external_case_id` and `external_case_url` to `social_posts` or a new `inbox_cases` table. Add `tenant_crm_configurations` for credentials.
- **Security considerations:** CRM credentials are stored in the same `credential` envelope system as connectors. PII is only sent if the CRM integration contract allows it. Tenant isolation for CRM configs.

## Backend principles

- **CRM as just another connector.** Reuse the existing ownership-tier-aware credential and connector framework.
- **Idempotent handoffs.** Creating the same case twice should not create duplicate CRM cases; use `external_case_id` and a unique handoff ID.
- **Link, don't copy.** The platform stores the CRM case URL and ID, not the full case history.
- **Auditable.** Every handoff and update is logged.

## Frontend / UI principles

- **User flow:** agent reviews a conversation → clicks "Create case" → selects CRM and category → confirms → sees a success state with a link to the CRM case.
- **Component hierarchy:** `InboxItemDetail` → `CreateCaseButton` → `CreateCaseDialog` → `CaseLinkChip`.
- **State management:** Server state for handoff status; local state for the dialog.
- **Accessibility and responsive design:** Dialog is keyboard-navigable; success/error messages are clear and include the external case link.

## Open questions

- Which CRMs are supported in v1 (e.g., Salesforce, HubSpot, Zendesk)?
- Should the handoff be one-way, or should status updates sync back from the CRM?
- Should the agent be able to create a case from a single post or from a full conversation thread?
- Should the system support assigning a case manager before handoff?
- How do we handle CRMs that do not support a standard case object?

## AI enhancements

- **Auto-summarize for CRM:** the AI writes a concise case summary from the conversation thread.
- **Priority recommendation:** the AI suggests a case priority based on sentiment, reach, and customer status.
- **Category suggestion:** the AI suggests a CRM category from the post content.

## Persona acceptance

- **Tenant-Social-Care-Agent (primary):** can escalate a conversation to the CRM with one click and see the CRM link in the inbox.
- **Tenant-User (primary):** can view the linked CRM case when reviewing an assigned conversation.
- **Tenant-Admin (secondary):** can configure the CRM connector and handoff fields for the tenant.
- **Tenant-Brand-Reputation-Manager (secondary):** can see which reputation issues have been handed off to support.
