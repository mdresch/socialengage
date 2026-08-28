# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0095 Case and Lead Handoff to CRM — Functional Design Document |
| Version | 1.1 |
| Date | 2026-08-28 |
| Author(s) | Technical Lead & Architecture Review Team |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Approved |
| Related Documents | `docs/adr/0095-case-handoff-to-crm.md` (Accepted 2026-08-28), `docs/project docs/Business-Requirements/BRD-0095-Case-Handoff-To-CRM.md`, ADR-0051 (Connector Activation & Credentials), ADR-0073 / ADR-0075 (`outbound_activities`), ADR-0086 / ADR-0117 (Prospecting Lists & CRM Push), ADR-0044 (Tenancy & Ownership), Stories 11.1 and 11.2 |

---

## 2. Purpose and Scope

### 2.1 Purpose
This document translates the accepted architectural decisions in **ADR-0095** and business requirements in **BRD-0095** into the detailed functional specification for **Case and Lead Handoff to CRM**.

This capability enables social care agents (`Tenant-Social-Care-Agent`), brand managers (`Tenant-Brand-Reputation-Manager`), and social sellers (`Social-Selling-Strategist`) to escalate social-inbox items, care issues, or prospective leads directly into an external CRM (Microsoft Dynamics 365, Salesforce, or HubSpot) without manual data entry.

### 2.2 Scope

**In scope:**
- A pluggable `CRMConnector` interface (`pushEntity`, `validateCredentials`, `status`) supporting Microsoft Dynamics 365 (Dataverse Web API v9.2), Salesforce (REST API), and HubSpot (CRM v3 API).
- Generalized `CRMCasePayload` supporting both post-level escalation (`POST /v1/inbox/items/:id/case`) and author-level prospecting pushes (`POST /v1/prospecting-lists/:id/crm-handoff` per ADR-0117).
- Typed CRM entity mapping (`lead`, `opportunity`, `support`) across Dynamics 365, Salesforce, and HubSpot.
- Storage of CRM credentials in `platform_credentials` with `credential_type = 'crm'` (ADR-0051).
- Tenant-admin-configurable field overrides via a `crm_field_mappings` database table.
- Comprehensive outbound audit logging in `outbound_activities` with `activity_type = 'crm_handoff'`.
- Fail-closed deduplication with `409 Conflict` returning existing CRM links unless `allowDuplicate: true` is passed.
- UI modal on post details, inbox items, and prospecting lists to configure and trigger handoff.

**Out of scope:**
- Bidirectional synchronization (pulling external CRM updates back into SocialEngage in v1).
- Automatic / background case creation without explicit user action in v1.
- Direct raw object creation bypassing typed entity schemas.

---

## 3. Architecture & Functional Components

### 3.1 `CRMConnector` Provider Abstraction

```ts
export type CRMProviderType = 'dynamics365' | 'salesforce' | 'hubspot';
export type CRMEntityType = 'lead' | 'opportunity' | 'support';

export interface CRMCasePayload {
  tenantId: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorPublicUrl?: string;
  postId?: string;                   // Optional for author-only prospecting pushes
  postExcerpt?: string;
  platformId: string;
  publishedAt?: string;
  sentiment?: string;
  watchlistId?: string;
  entityType: CRMEntityType;          // 'lead' | 'opportunity' | 'support'
  assignedTo?: string;               // External CRM User / Queue ID
  notes?: string;
  customFields?: Record<string, any>;
}

export interface CRMPushResult {
  crmRecordId: string;
  crmRecordUrl: string;
  entityType: string;
  rawResponse?: Record<string, any>;
}

export interface CRMConnector {
  readonly id: string;
  readonly provider: CRMProviderType;
  
  pushEntity(
    ctx: ConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult>;
  
  validateCredentials(ctx: ConnectorContext): Promise<boolean>;
  status(ctx: ConnectorContext): Promise<ConnectorStatus>;
}
```

### 3.2 Provider Implementations & Entity Mappings

| Generic Type | Microsoft Dynamics 365 (Dataverse v9.2) | Salesforce | HubSpot (CRM v3) |
| :--- | :--- | :--- | :--- |
| **`lead`** | `leads` entity (`subject`, `description`, `lastname`, `leadsourcecode`) | `Lead` (`LastName`, `Company`, `Description`, `LeadSource`) | `contacts` + `deals` (`leadstatus`, `dealname`) |
| **`opportunity`** | `opportunities` entity (`name`, `description`, `customerid_contact@odata.bind`) | `Opportunity` (`Name`, `StageName`, `CloseDate`, `Description`) | `deals` (`dealname`, `pipeline`, `amount`) |
| **`support`** | `incidents` entity (`title`, `description`, `casetypecode`) | `Case` (`Subject`, `Description`, `Origin`, `Priority`) | `tickets` (`hs_ticket_subject`, `content`, `hs_pipeline_stage`) |

**Microsoft Dynamics 365 Integration Details:**
- **Auth Flow:** Azure AD (Entra ID) OAuth 2.0 Client Credentials or User Delegation (`https://<org>.crm.dynamics.com/.default`).
- **REST Surface:** Dataverse Web API v9.2 `GET`/`POST https://<org>.crm.dynamics.com/api/data/v9.2/<entityset>`.
- **Deep Links:** Generated as `https://<org>.crm.dynamics.com/main.aspx?etn=<entity>&id={<guid>}&pagetype=entityrecord`.

---

## 4. Database Schema (`crm_field_mappings`)

```sql
CREATE TABLE crm_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_connector_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('lead', 'opportunity', 'support')),
  source_field text NOT NULL,        -- e.g. 'authorName', 'postExcerpt', 'notes'
  target_field text NOT NULL,        -- e.g. 'subject' (Dynamics), 'Description' (Salesforce)
  is_required boolean NOT NULL DEFAULT false,
  default_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_crm_field_mapping UNIQUE (tenant_id, crm_connector_id, entity_type, source_field)
);

CREATE INDEX idx_crm_field_mappings_lookup 
  ON crm_field_mappings(tenant_id, crm_connector_id, entity_type);
```

---

## 5. API Specifications

### 5.1 `POST /v1/inbox/items/:id/case`

- **URL Parameter:** `:id` (Social Post ID or Inbox Item ID)
- **Authorization:** `Tenant-User` or `Tenant-Admin` with active CRM connector.

**Request Body (`application/json`):**
```json
{
  "crmConnectorId": "dynamics365-production",
  "entityType": "support",
  "assignedTo": "queue-support-tier1",
  "notes": "Customer reported billing issue on LinkedIn post",
  "customFields": {
    "severity": "high"
  },
  "allowDuplicate": false
}
```

**Success Response (`201 Created`):**
```json
{
  "outboundActivityId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crmRecordId": "inc-98213-abc",
  "crmRecordUrl": "https://contoso.crm.dynamics.com/main.aspx?etn=incident&id={00000000-0000-0000-0000-000000000000}&pagetype=entityrecord",
  "status": "success"
}
```

**Duplicate Response (`409 Conflict`):**
```json
{
  "error": "Item already pushed to CRM",
  "crmRecordId": "inc-98213-abc",
  "crmRecordUrl": "https://contoso.crm.dynamics.com/main.aspx?etn=incident&id={00000000-0000-0000-0000-000000000000}&pagetype=entityrecord",
  "outboundActivityId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 6. Outbound Activities Audit Trail

Every handoff creates an entry in `outbound_activities`:
- `tenant_id`: Invoking tenant ID.
- `activity_type`: `'crm_handoff'`.
- `post_id`: Associated `social_posts.id` (nullable for author-only prospecting handoffs).
- `author_id`: Target `authors.id`.
- `connector_id`: CRM connector identifier.
- `external_id`: External record ID returned by CRM.
- `external_url`: Deep link to view record in CRM portal.
- `status`: `'success' | 'failed'`.
- `error_details`: Captured error payload on failure.

---

## 7. Functional Requirements Matrix

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-001 | `CRMConnector` provider abstraction | Must | Interface supports `pushEntity`, `validateCredentials`, `status` across Dynamics 365, Salesforce, and HubSpot |
| FR-002 | Microsoft Dynamics 365 Dataverse Integration | Must | Supports Azure AD OAuth 2.0, Dataverse Web API v9.2, and canonical deep links |
| FR-003 | Post & Prospecting List Escalation | Must | Generalized payload cleanly supports post escalations and author prospecting pushes |
| FR-004 | Custom Field Mapping Schema | Should | `crm_field_mappings` table stores tenant-specific field overrides with RLS |
| FR-005 | Fail-Closed Deduplication | Must | Returns `409 Conflict` with existing CRM links unless `allowDuplicate: true` |
| FR-006 | Outbound Activity Audit Logging | Must | Records every push in `outbound_activities` with retry support on failure |
| FR-007 | Front-end CRM Escalation Modal | Must | Post detail, inbox, and prospecting lists render CRM handoff dialog with link feedback |

---

## 8. Non-Functional Requirements

- **Security & Multi-Tenancy:** All credentials, field mappings, and activity records are strictly isolated via PostgreSQL RLS.
- **Latency & Reliability:** Handoff operations complete within 3 seconds under normal network conditions; failures write detailed diagnostic payloads to `outbound_activities`.
- **Maintainability:** Adding a new CRM requires only a single class implementing `CRMConnector` with no changes to core listening pipelines.