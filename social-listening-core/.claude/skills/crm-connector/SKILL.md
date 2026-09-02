---
name: crm-connector
description: Manages CRMConnector provider abstraction (Dynamics 365, Salesforce, HubSpot), crm_field_mappings schema, and case/lead handoffs.
---

# CRM Connector & Case Handoff

Governed by **ADR-0095**, **BRD-0095**, **FDD-0095**, and **Story 11.1**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.1.crm-connector-and-case-handoff.contract.test.ts` — Story 11.1 contract test.

## Key Responsibilities

1. **`CRMConnector` Provider Abstraction**:
   - `pushEntity(ctx: ConnectorContext, payload: CRMCasePayload): Promise<CRMPushResult>`
   - `validateCredentials(ctx: ConnectorContext): Promise<boolean>`
   - `status(ctx: ConnectorContext): Promise<CRMConnectorStatus>`
   - Supported providers: `dynamics365`, `salesforce`, `hubspot`.
   - Supported generic entity targets: `lead`, `opportunity`, `support`.

2. **Dynamics 365 Dataverse Integration**:
   - Authentication via Azure AD (Entra ID) OAuth 2.0.
   - Endpoint: Dataverse Web API v9.2 `https://<org>.crm.dynamics.com/api/data/v9.2/<entityset>`.
   - Canonical Deep Links: `https://<org>.crm.dynamics.com/main.aspx?etn=<entity>&id={<guid>}&pagetype=entityrecord`.

3. **Field Mappings (`crm_field_mappings`)**:
   - Stores tenant overrides for field mappings with tenant isolation (RLS).
   - Validates required fields and applies fallback default values.

4. **Fail-Closed Deduplication & Outbound Audit**:
   - Checks `outbound_activities` for `(post_id, crm_connector_id, status='sent')`.
   - Rejects duplicate pushes with `409 Conflict` containing the previous `crmRecordId` and `crmRecordUrl` unless `allowDuplicate: true` is passed.
   - Writes all handoff attempts into `outbound_activities` with `activity_type='crm_handoff'` and diagnostic details.
