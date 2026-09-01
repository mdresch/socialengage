# ADR-0117: Prospecting list export and CRM push

**Status:** Accepted (2026-08-28)

**Authorizes:** `GET /v1/prospecting-lists/:id/export` and `POST /v1/prospecting-lists/:id/crm-handoff` for exporting a prospecting list and pushing its entries to a CRM (reusing `CRMConnector`, ADR-0095).

**Source:** `docs/product-research/feature-designs/18-prospecting-list.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Prospecting lists need to leave the platform
`docs/product-research/feature-designs/18-prospecting-list.md` and `ADR-0086` describe the `prospecting_lists` data model. The next step is to let users export the list or push its entries into a CRM as leads.

### 2. CRM connector already exists
`ADR-0095` defined `CRMConnector` for case handoff. The same connector and credential model can push a prospecting list.

### 3. Export must be metadata-only
Like post CSV (ADR-0090/0111), the prospecting list export must not include PII beyond what is already in the `prospecting_list_entries.notes` and must not include connector secrets.

---

## Decision

### 1. Export endpoint
```
GET /v1/prospecting-lists/:id/export.csv?limit=...
```

**Columns**
```
author_id, author_name, platform_id, public_url, topic, engagement_score, authenticity_score, influence_score, relationship_stage, notes, tags
```

- `author_id`, `author_name`, `platform_id`, `public_url`, and `topic` come from `prospecting_list_entries`.
- Scores come from `Author` (ADR-0108).
- `notes` and `tags` are user-curated.
- `phone` and `email` are **excluded**. The user can put them in `notes` if they have them, but the platform does not expose them.

- Bound by the same sync/async and size rules as `ADR-0111`.

### 2. CRM push endpoint
```
POST /v1/prospecting-lists/:id/crm-handoff
{
  crmConnectorId: string;
  caseType: 'lead';             // prospecting lists always push as leads
  selectedEntryIds?: string[];  // push all if omitted
  customFields?: Record<string, string>;
}
```

**Response**
```ts
{
  outboundActivityIds: string[];
  pushedCount: number;
  skippedCount: number;
  crmUrl?: string;              // CRM list/campaign URL
}
```

### 3. CRM payload mapping
- The `CRMConnector` receives a batch of `ProspectingListEntryPayload`:
  ```ts
  {
    authorId: string;
    authorName: string;
    platformId: string;
    publicUrl?: string;
    topic: string;
    engagementScore: number;
    authenticityScore: number;
    influenceScore: number;
    relationshipStage: string;
    notes: string;
    tags: string[];
  }
  ```
- The connector maps this to the CRM's lead/contact object.
- HubSpot: `contacts` with `social profile` properties.
- Salesforce: `Lead` with custom fields for scores and tags.

### 4. Idempotency and batching
- Each entry push creates an `outbound_activities` row with `activity_type='crm_prospect'`.
- Pushes are batched by 50 entries per CRM call.
- Re-pushing the same author to the same CRM connector updates the existing CRM record if the connector supports it.

### 5. RLS and sharing
- Only the list `owner`, a user with `edit` share, or `tenant_admin` can export or push.
- `Tenant-Admin` can see the outbound activity for any list in the tenant.

---

## Consequences

1. **Social selling闭环:** a user can discover, score, and push leads in one flow.
2. **Reuses `CRMConnector`:** the same credential and mapping infrastructure as case handoff.
3. **Bounded PII:** export and push avoid email/phone unless the user explicitly adds them to notes.
4. **Audit trail:** every push is an `outbound_activities` record.

---

## Alternatives considered

1. **Push one entry at a time with `POST /v1/prospecting-lists/:id/entries/:entryId/crm-handoff`.**
   - *Rejected:* batch push is more practical for lists. Single-entry push can be added later.

2. **Create a separate `ProspectCRMConnector` interface.**
   - *Rejected:* it duplicates `CRMConnector`. The payload mapping differs, but the interface is the same.

3. **Export to PDF or Excel instead of CSV.**
   - *Rejected:* CSV is universal and analysis-ready. PDF/Excel add dependencies.

---

## Open questions

- Should the push create a CRM campaign or list, or just individual contacts?
- How are duplicate leads handled? Key on `authorId` or on `authorName + platformId`?
- Should the export include `influence_score` and `authenticity_score` as raw numbers or labels?
- Can the user schedule a recurring CRM push as entries are added?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0086` (prospecting list model), `ADR-0095` (CRM connector), `ADR-0111` (export bounding)
