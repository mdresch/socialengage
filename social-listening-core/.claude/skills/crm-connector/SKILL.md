---
name: crm-connector
description: Manages CRMConnector provider abstraction (Dynamics 365, Salesforce, HubSpot), crm_field_mappings schema, case/lead handoffs, and prospecting-list batch push.
---

# CRM Connector & Case Handoff

Governed by **ADR-0095**, **BRD-0095**, **FDD-0095**, **Story 11.1**, and **Story 13.13**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.1.crm-connector-and-case-handoff.contract.test.ts` — Story 11.1 contract test.
- `social-listening-core/contracts/epic-13/story-13.13.prospecting-list-export-and-crm-push.contract.test.ts` — Story 13.13 contract test.

## Key Responsibilities

1. **`CRMConnector` Provider Abstraction**:
   - `pushEntity(ctx: ConnectorContext, payload: CRMCasePayload): Promise<CRMPushResult>`
   - `pushProspectsBatch?(ctx: ConnectorContext, payloads: ProspectingListEntryPayload[], options?: { rePushByExternalId?: Record<string, string> }): Promise<CRMProspectPushResult[]>` (Story 13.13)
   - `validateCredentials(ctx: ConnectorContext): Promise<boolean>`
   - `status(ctx: ConnectorContext): Promise<CRMConnectorStatus>`
   - Supported providers: `dynamics365`, `salesforce`, `hubspot`.
   - Supported generic entity targets: `lead`, `opportunity`, `support`.
   - `CRMCasePayload` carries optional prospecting-list fields (`topic`, `engagementScore`, `authenticityScore`, `influenceScore`, `relationshipStage`, `tags`, `externalId`) for re-push updates.

2. **Dynamics 365 Dataverse Integration**:
   - Authentication via Azure AD (Entra ID) OAuth 2.0.
   - Endpoint: Dataverse Web API v9.2 `https://<org>.crm.dynamics.com/api/data/v9.2/<entityset>`.
   - Canonical Deep Links: `https://<org>.crm.dynamics.com/main.aspx?etn=<entity>&id={<guid>}&pagetype=entityrecord`.

3. **Field Mappings (`crm_field_mappings`)**:
   - Stores tenant overrides for field mappings with tenant isolation (RLS).
   - Validates required fields and applies fallback default values.

4. **Fail-Closed Deduplication & Outbound Audit**:
   - Case handoff: checks `outbound_activities` for `(post_id, crm_connector_id, status='sent')`.
   - Rejects duplicate case pushes with `409 Conflict` containing the previous `crmRecordId` and `crmRecordUrl` unless `allowDuplicate: true` is passed.
   - Writes all case handoff attempts into `outbound_activities` with `activity_type='crm_handoff'` and diagnostic details.
   - Prospecting-list handoff (Story 13.13): writes one `outbound_activities` row per entry with `activity_type='crm_prospect'`, supports re-push updates keyed by `(author_id, provider_id)`, and reuses existing CRM records when the connector's `externalId` is supplied.

## Relations to other components

- **`outbound_activities` table** — all CRM handoff and CRM prospect push attempts are written here with `activity_type='crm_handoff'`/`'crm_prospect'`; deduplication reads this table to block repeat sends.
- **`social_posts` table** — posts being escalated to CRM are the primary source for `CRMCasePayload`; `post_id` is the deduplication key for case handoffs.
- **`prospecting-lists` skill** — prospecting list entries are pushed to CRM in batch via `pushProspectsBatch()`; the CRM connector is the outbound transport for Story 13.13 exports.
- **`outbound-engagement` skill** — CRM handoff follows the same outbound-activity audit pattern as reply/publish; `outbound_activities` is the shared audit table for all outbound action types.
- **`connector-capability-matrix` skill** — the CRM connector's provider type (`dynamics365`, `salesforce`, `hubspot`) and entity targets are registered in the connector capability matrix.
