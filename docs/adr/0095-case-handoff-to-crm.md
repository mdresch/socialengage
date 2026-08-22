# ADR-0095: Case handoff to CRM

**Status:** Proposed (2026-08-23)

**Authorizes:** a `CRMConnector` abstraction and a `POST /v1/inbox/items/:id/case` endpoint that pushes a social-inbox item into an external CRM (HubSpot, Salesforce) with a configurable field mapping and an `outbound_activities` audit record.

**Source:** `docs/product-research/feature-designs/23-case-handoff-to-crm.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The social-inbox turns listening into action
`docs/product-research/feature-designs/06-unified-social-inbox.md` and `docs/product-research/feature-designs/23-case-handoff-to-crm.md` describe a workflow where a `Tenant-Social-Care-Agent` or `Tenant-Brand-Reputation-Manager` can escalate a post or author to a CRM as a new case, lead, or opportunity.

### 2. CRM systems are heterogeneous
The most common targets are HubSpot and Salesforce. Each has its own object model, auth, and rate limits. A `CRMConnector` interface keeps the platform from hardcoding one vendor.

### 3. The project already has `outbound_activities`
`ADR-0073` and `ADR-0075` introduced `outbound_activities` for replies and publishing. The CRM handoff is another `activity_type` that follows the same audit pattern.

---

## Decision

### 1. New `CRMConnector` interface
```ts
interface CRMConnector {
  id: string;
  pushCase(
    ctx: ConnectorContext,
    payload: CRMCasePayload
  ): Promise<{ crmCaseId: string; crmUrl: string }>;
  validateCredentials(ctx: ConnectorContext): Promise<boolean>;
  status(): Promise<ConnectorStatus>;
}

interface CRMCasePayload {
  tenantId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPublicUrl?: string;
  postExcerpt: string;
  platformId: string;
  publishedAt: string;
  sentiment?: string;
  watchlistId?: string;
  caseType: 'lead' | 'opportunity' | 'support';
  assignedTo?: string;
}
```

### 2. Credential and activation
- CRM credentials are stored in `platform_credentials` with `credential_type = 'crm'`.
- Activation follows `ADR-0051` (connector activation) and is per-tenant or per-user depending on the provider.
- `Tenant-Admin` or `Tenant-User` can activate their own CRM connector.

### 3. `POST /v1/inbox/items/:id/case`
- The `:id` is the `social_post.id` or an `inbox_item` id (v1 uses `post_id`).
- Request body:
  ```ts
  {
    crmConnectorId: string;
    caseType: 'lead' | 'opportunity' | 'support';
    assignedTo?: string;
    notes?: string;
    customFields?: Record<string, string>;
  }
  ```
- Response:
  ```ts
  {
    outboundActivityId: string;
    crmCaseId: string;
    crmUrl: string;
  }
  ```

### 4. Default field mapping
- `CRMConnector` implementations define a default mapping from `CRMCasePayload` to their object fields:
  - HubSpot → `contacts` + `deals` (for lead/opportunity) or `tickets` (for support).
  - Salesforce → `Lead` or `Case` objects.
- `Tenant-Admin` can override the mapping through a `crm_field_mappings` table:
  ```ts
  {
    crm_connector_id: string,
    tenant_id: string,
    source_field: string,   // e.g. 'authorName'
    target_field: string    // e.g. 'LastName'
  }
  ```

### 5. `outbound_activities` record
- Every handoff writes an `outbound_activities` row with `activity_type='crm_handoff'`.
- It records `post_id`, `author_id`, `crm_case_id`, `crm_url`, and `response_status`.
- This is the audit and idempotency anchor; a `post_id` + `crm_connector_id` can be tracked.

### 6. Idempotency and retries
- `pushCase` is idempotent by `post_id` where the CRM allows it (HubSpot/v3 `idProperty`, Salesforce external id).
- If the CRM call fails, `outbound_activities.response_status` is `failed` and the user can retry.

---

## Consequences

1. **CRM integration is pluggable:** the platform supports HubSpot and Salesforce v1, with room for more.
2. **Actionable listening:** a post can become a CRM record in one click.
3. **Reuses outbound audit:** the handoff follows the same `outbound_activities` pattern as replies and publishing.
4. **Field-mapping complexity:** custom mappings require validation but are essential for CRM adoption.

---

## Alternatives considered

1. **Use a single, hardcoded HubSpot integration.**
   - *Rejected:* it locks the product to one CRM. A connector interface is consistent with the rest of the platform.

2. **Create a generic `POST /v1/crm/push` that accepts the CRM's raw object.**
   - *Rejected:* it leaks provider specifics and is hard to audit. A typed `CRMCasePayload` keeps the contract clean.

3. **Sync the CRM bidirectionally (pull updates back).**
   - *Rejected:* it is complex and requires webhooks. v1 is one-way push only.

---

## Open questions

- Should the handoff be triggered from the post detail, the inbox, or a prospecting list?
- What is the right object mapping for each CRM in v1? (HubSpot: contact + deal vs. contact + ticket.)
- Should duplicate handoffs for the same `post_id` be blocked or allowed with a new note?
- How should the UI surface `outbound_activities` failures and allow retry?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/23-case-handoff-to-crm.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0073` (outbound replies), `ADR-0075` (outbound publishing), `ADR-0051` (connector activation)
