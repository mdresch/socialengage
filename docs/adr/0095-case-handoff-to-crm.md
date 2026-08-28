# ADR-0095: Case and Lead Handoff to CRM (Dynamics 365, Salesforce, HubSpot)

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23 · Revised 2026-08-28 per architectural review.** Authorizes the `CRMConnector` provider abstraction (supporting Microsoft Dynamics 365, Salesforce, and HubSpot), custom field mapping schema, `outbound_activities` audit recording, and the `POST /v1/inbox/items/:id/case` escalation endpoint.

**Source:** `docs/product-research/feature-designs/23-case-handoff-to-crm.md`, `docs/product-research/feature-designs/18-prospecting-list.md`, and ADR-0051/0073/0075/0086/0117.

---

## 1. Comparison with Preceding ADRs

| Preceding ADR | Architectural Relationship & Alignment |
| :--- | :--- |
| **ADR-0051** *(Connector Activation & Credentials)* | **Aligned**: CRM integrations use the established `platform_credentials` / `connector_activations` framework. Dynamics 365 requires storing `tenant_id` (Azure AD Directory ID), `client_id`, `client_secret` (or OAuth tokens), and `organization_url` (e.g., `https://<org>.crm.dynamics.com`). |
| **ADR-0073 & ADR-0075** *(`outbound_activities` Audit Log)* | **Aligned**: CRM pushes constitute outbound side-effects. Recording them in `outbound_activities` with `activity_type = 'crm_handoff'`, `post_id`, `author_id`, `external_id` (CRM record ID), and `external_url` ensures a unified audit trail across publishing, replies, and CRM handoffs. |
| **ADR-0086 & ADR-0117** *(Prospecting Lists & CRM Push)* | **Aligned**: ADR-0086 explicitly references `CRMConnector (ADR-0095)` for `POST /v1/prospecting-lists/:id/crm-handoff`. `CRMCasePayload` is generalized so `postId` and `postExcerpt` are optional, cleanly supporting both post-level escalation and author-level lead creation. |
| **ADR-0044** *(Tenancy & Ownership)* | **Aligned**: All CRM mappings, activations, and handoff requests are tenant-scoped with Row-Level Security (RLS). |

---

## Context

### 1. Social-inbox escalation and social selling handoff
Users (`Tenant-Social-Care-Agent`, `Tenant-Brand-Reputation-Manager`, `Social-Selling-Strategist`) need to escalate social posts, customer care issues, or prospective authors into an external CRM as cases, tickets, leads, or opportunities.

### 2. CRM heterogeneity
Enterprise customers utilize diverse CRM backends. Microsoft Dynamics 365 (Dataverse Web API v9.2), Salesforce (REST API), and HubSpot (CRM v3 API) are tier-1 requirements. A clean `CRMConnector` abstraction prevents vendor lock-in.

### 3. Unified outbound audit and activity trail
Per ADR-0073 and ADR-0075, all external mutations are recorded in `outbound_activities`. CRM handoffs follow this exact pattern for auditability, deduplication, and retry management.

---

## Decision

### 1. `CRMConnector` Abstraction

```ts
export type CRMProviderType = 'dynamics365' | 'salesforce' | 'hubspot';
export type CRMEntityType = 'lead' | 'opportunity' | 'support';

export interface CRMCasePayload {
  tenantId: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorPublicUrl?: string;
  postId?: string;                   // Optional to support author-only prospecting pushes
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

### 2. Provider Implementations & Entity Mappings

| Generic Type | Microsoft Dynamics 365 (Dataverse v9.2) | Salesforce | HubSpot (CRM v3) |
| :--- | :--- | :--- | :--- |
| **`lead`** | `leads` entity (`subject`, `description`, `lastname`, `leadsourcecode`) | `Lead` (`LastName`, `Company`, `Description`, `LeadSource`) | `contacts` + `deals` (`leadstatus`, `dealname`) |
| **`opportunity`** | `opportunities` entity (`name`, `description`, `customerid_contact@odata.bind`) | `Opportunity` (`Name`, `StageName`, `CloseDate`, `Description`) | `deals` (`dealname`, `pipeline`, `amount`) |
| **`support`** | `incidents` entity (`title`, `description`, `casetypecode`) | `Case` (`Subject`, `Description`, `Origin`, `Priority`) | `tickets` (`hs_ticket_subject`, `content`, `hs_pipeline_stage`) |

**Microsoft Dynamics 365 Specifics:**
- **Authentication:** Azure AD (Entra ID) OAuth 2.0 with resource URL `https://<org>.crm.dynamics.com/.default` stored in `platform_credentials`.
- **API Endpoint:** `GET`/`POST` `https://<org>.crm.dynamics.com/api/data/v9.2/<entityset>`.
- **Canonical Deep Link:** `https://<org>.crm.dynamics.com/main.aspx?etn=<entity>&id={<guid>}&pagetype=entityrecord`.

### 3. Database Schema (`crm_field_mappings`)

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

### 4. API Specification (`POST /v1/inbox/items/:id/case`)

**Request (`application/json`):**
```json
{
  "crmConnectorId": "string",
  "entityType": "lead | opportunity | support",
  "assignedTo": "string (optional)",
  "notes": "string (optional)",
  "customFields": {},
  "allowDuplicate": false
}
```

**Response (`HTTP 201 Created`):**
```json
{
  "outboundActivityId": "string",
  "crmRecordId": "string",
  "crmRecordUrl": "string",
  "status": "success"
}
```

**Deduplication & Idempotency:**
- Before dispatching, the service checks `outbound_activities` for `(post_id, crm_connector_id, status = 'success')`.
- If an existing record is found and `allowDuplicate != true`, the endpoint responds with `409 Conflict` returning `{ "message": "Item already pushed to CRM", "crmRecordId": "...", "crmRecordUrl": "...", "outboundActivityId": "..." }`.

### 5. `outbound_activities` Audit Entry

Every execution inserts a record into `outbound_activities`:
- `tenant_id`: Calling tenant ID.
- `activity_type`: `'crm_handoff'`.
- `post_id`: Associated `social_post.id` (if applicable).
- `author_id`: Target `author.id`.
- `connector_id`: The activated CRM connector identifier.
- `external_id`: The created `crmRecordId`.
- `external_url`: The canonical `crmRecordUrl`.
- `status`: `'success' | 'failed'`.
- `error_details`: Exception and payload details for troubleshooting and retry.

---

## Resolving Open Questions

| Open Question | Decision & Architecture Rationale |
| :--- | :--- |
| **1. Trigger surface (Inbox vs Post Detail vs Prospecting List)?** | **All three surfaces.** The endpoint `POST /v1/inbox/items/:id/case` handles individual post/inbox escalations, while `POST /v1/prospecting-lists/:id/crm-handoff` (ADR-0117) reuses `CRMConnector` for bulk/author lead pushes. |
| **2. Default object mapping per provider?** | **Explicit 3-way mapping**: <br>• **Dynamics 365**: `lead` → `leads`, `opportunity` → `opportunities`, `support` → `incidents`<br>• **Salesforce**: `lead` → `Lead`, `opportunity` → `Opportunity`, `support` → `Case`<br>• **HubSpot**: `lead`/`opportunity` → `contacts` + `deals`, `support` → `tickets`. |
| **3. Duplicate handoff behavior?** | **Fail-closed with `409 Conflict`.** Query `outbound_activities` by `(post_id, crm_connector_id, status='success')`. Return `409` with existing CRM links unless `allowDuplicate: true` is set. |
| **4. Failure visibility & retry mechanics?** | **Outbound Activities Queue.** Failed pushes write an `outbound_activities` row with `status='failed'` and `error_details jsonb`. Users can retry via `POST /v1/outbound-activities/:id/retry` or re-submitting from the UI. |

---

## Consequences

### Positive
- **Tier-1 Microsoft Dynamics 365 Support:** Full Dataverse Web API parity with Salesforce and HubSpot for enterprise workflows.
- **Cross-Feature Reusability:** Directly powers inbox escalations (`/v1/inbox/items/:id/case`) and prospecting pushes (ADR-0117 / `/v1/prospecting-lists/:id/crm-handoff`).
- **Auditability & Safe Retries:** Integrated with `outbound_activities` to prevent duplicate case creation and track handoff history.
- **Tenant Field Flexibility:** `crm_field_mappings` allows organizations to map social metadata into custom CRM fields without codebase changes.

### Trade-offs & Mitigations
- **Auth Token Complexity:** Dynamics 365 and Salesforce require robust OAuth token refresh loops. Mitigated by standard connector activation credential refresh services (ADR-0051).
- **One-Way Sync in v1:** CRM status updates do not sync back to SocialEngage in v1. Mitigated by storing canonical deep links so users can navigate to the CRM record in one click.

---

## Related Notes
- `docs/product-research/feature-designs/23-case-handoff-to-crm.md`
- `docs/product-research/feature-designs/18-prospecting-list.md`
- `docs/adr/0051-connector-activation-and-credential-storage.md`
- `docs/adr/0073-outbound-reply-dispatch.md`
- `docs/adr/0075-outbound-post-publishing.md`
- `docs/adr/0086-prospecting-list-model-and-sharing.md`
- `docs/adr/0117-prospecting-list-export-and-crm-push.md`
