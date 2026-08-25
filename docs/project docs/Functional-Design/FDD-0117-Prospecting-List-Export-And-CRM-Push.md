# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0117 Prospecting List Export and CRM Push — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review) |
| Related Documents | ADR-0117, BRD-0117, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

SocialEngage users can already discover, score, and curate authors into tenant-scoped **prospecting lists**. The missing step is a safe, controlled handoff of those leads into downstream sales workflows. Today, a `Social-Selling-Strategist` must manually copy prospect metadata out of the platform or risk sharing uncontrolled, full-PII exports. This BRD defines the business need for **prospecting-list export** and **CRM push** capabilities.

This FDD translates the accepted architecture and business requirements from ADR-0117 and BRD-0117 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Metadata-only CSV export of a prospecting list, bounded by the same sync/async and size rules as ADR-0111.
- Batch CRM push of all or selected list entries to a connected CRM as `lead` records.
- `CRMConnector` payload mapping for major CRMs (HubSpot `contacts`, Salesforce `Lead`).
- Batching of CRM calls at up to 50 entries per call.
- Idempotent re-push behavior: updating the existing CRM record when the connector supports it.
- `outbound_activities` audit logging for every push.
- Role- and share-based authorization for export and push.
- Optional `selectedEntryIds` on CRM push (push all if omitted).
- Optional `customFields` passed through to the CRM lead record.
- **Out of scope:** - Single-entry CRM push endpoints (deferred; can be added later).
- A separate `ProspectCRMConnector` abstraction (rejected in ADR-0117).
- PDF or Excel export formats (rejected in ADR-0117).
- Scheduled or automatic recurring CRM pushes.
- Automatic harvesting or storage of phone numbers or email addresses.
- CRM campaign/list creation (open question; not required for v1).
- **Assumptions and constraints:** - The prospecting-list data model (`prospecting_lists`, `prospecting_list_entries`) is in place (ADR-0086).
- The `CRMConnector` and credential model are already available (ADR-0095).
- The export bounding, streaming, and size-cap infrastructure is available (ADR-0111).
- Author scoring (`engagement_score`, `authenticity_score`, `influence_score`) is available from the `Author` model (ADR-0108).

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Prospecting lists need to leave the platform
`docs/product-research/feature-designs/18-prospecting-list.md` and `ADR-0086` describe the `prospecting_lists` data model. The next step is to let users export the list or push its entries into a CRM as leads.

### 2. CRM connector already exists
`ADR-0095` defined `CRMConnector` for case handoff. The same connector and credential model can push a prospecting list.

### 3. Export must be metadata-only
Like post CSV (ADR-0090/0111), the prospecting list export must not include PII beyond what is already in the `prospecting_list_entries.notes` and must not include connector secrets.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the social-selling loop from discovery to CRM handoff | `Social-Selling-Strategist` can push a curated list to a CRM in under two minutes |
| 2 | Reuse existing CRM connector infrastructure | No new connector credential store is built; `CRMConnector` (ADR-0095) is the integration point |
| 3 | Maintain strict PII and privacy boundaries | Phone/email never appear in exports or payloads except in user-curated notes; zero leakage incidents in contract/audit review |
| 4 | Provide an auditable handoff trail | Every CRM push creates an `outbound_activities` record that a `Tenant-Admin` can inspect |
| 5 | Improve list portability for manual outreach | CSV export contains analysis-ready, metadata-only columns for spreadsheet import |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow an authorized user to export a prospecting list as a metadata-only CSV. | Must | CSV contains `author_id, author_name, platform_id, public_url, topic, engagement_score, authenticity_score, influence_score, relationship_stage, notes, tags`; excludes `phone` and `email` except in user-curated `notes`; bounded by ADR-0111 sync/async rules. | Product Owner |
| BR-002 | The system shall allow an authorized user to push all or selected entries from a prospecting list to a connected CRM as leads. | Must | `POST .../crm-handoff` accepts `crmConnectorId`, `caseType='lead'`, optional `selectedEntryIds`, and optional `customFields`; pushes chosen entries. | Product Owner |
| BR-003 | The system shall batch CRM calls at up to 50 entries per call. | Must | No single CRM call exceeds 50 entries; response reflects per-call progress. | Product Owner |
| BR-004 | The system shall map prospecting-list entries to CRM-specific lead/contact fields. | Must | HubSpot maps to `contacts` with social profile properties; Salesforce maps to `Lead` with custom fields for scores and tags. | Product Owner |
| BR-005 | The system shall create an `outbound_activities` audit record for every CRM push. | Must | Each push writes a row with `activity_type='crm_prospect'`; `Tenant-Admin` can view outbound activity for any list in the tenant. | Product Owner |
| BR-006 | The system shall support updating an existing CRM record when re-pushing the same author to the same connector. | Should | Re-push to the same `crmConnectorId` does not create a duplicate lead where the connector supports deduplication/update. | Product Owner |
| BR-007 | The system shall enforce role- and share-based access before allowing export or push. | Must | Only the list `owner`, a user with `edit` share, or `tenant_admin` can export or push. | Product Owner |
| BR-008 | The system shall return a summary of the CRM handoff, including counts and a CRM URL when available. | Must | Response contains `outboundActivityIds`, `pushedCount`, `skippedCount`, and optional `crmUrl`. | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Social-Selling-Strategist | Primary user: curates lists and hands off leads | High | One-click export or push to CRM with clear confirmation |
| Tenant-Business-Analyst | Secondary user: correlates prospect data with sales | Medium | Clean, metadata-only CSV for analysis |
| Tenant-User | Secondary user: views shared lists, may add authors | Medium | See shared lists and understand which were exported/pushed |
| Tenant-Admin | Secondary: configures sharing and audits handoffs | Medium | Control who can export/push, view `outbound_activities` |
| Compliance / Security | Governance | High | No platform-harvested PII in exports or payloads |
| Product Owner | Requirement owner | High | Clear acceptance criteria and risk visibility |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.13 | backend engineer | `GET /v1/prospecting-lists/:id/export.csv` and `POST /v1/prospecting-lists/:id/crm-handoff`, | `Social-Selling-Strategist` can export or push leads to a CRM. | CSV export with metadata-only columns and same bounds as `ADR-0111`.; `POST .../crm-handoff` accepts `crmConnectorId`, `caseType='lead'`, and `selectedEntryIds`.; `CRMConnector` receives a batch of `ProspectingListEntryPayload` and maps to leads. |
| 13.14 | `Social-Selling-Strategist` | export and "push to CRM" buttons on a prospecting list, | I can move leads into the CRM or a spreadsheet. | "Export CSV" downloads the list with bounded rows.; "Push to CRM" opens a modal to pick the CRM connector and entries to push.; Pushed entries show a link to the CRM record. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `prospecting_lists` | Tenant- or user-scoped list header: `name`, `owner_id`, `shared` | `prospecting_lists` table | Tenant / Product | Business data |
| `prospecting_list_entries` | Junction with `author_id`, `author_name`, `platform_id`, `public_url`, `topic`, `notes`, `tags`, `relationship_stage` | `prospecting_list_entries` table | Tenant / User | Public metadata; `notes` may contain PII |
| Author scores | `engagement_score`, `authenticity_score`, `influence_score` derived for an author | `Author` model (ADR-0108) | Tenant / Product | Business data |
| `CRMConnector` | Configured connector and credential for a CRM provider | `connectors` / `platform_credentials` (ADR-0095) | Tenant-Admin / User | Confidential |
| `outbound_activities` | Audit log of push: `activity_type='crm_prospect'`, tenant, list, connector, counts | `outbound_activities` table | Platform / Tenant-Admin | Business data |
| `export_jobs` | Export tracking: status, row count, blob path, SHA-256, expiry | `export_jobs` table (ADR-0111) | Platform | Business data |
| `phone` / `email` | Excluded platform-stored contact fields | (excluded) | — | Personal data — must not be exported |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A user may export or push a prospecting list only if they are the list `owner`, have `edit` share, or hold the `tenant_admin` role. |
| BRU-002 | A `Tenant-Admin` may view the `outbound_activities` for any prospecting list in their tenant. |
| BRU-003 | The CSV export and CRM payload may not include `phone` or `email`; the only permitted contact data is whatever a user has entered in free-text `notes`. |
| BRU-004 | Every CRM push must use `caseType='lead'`. |
| BRU-005 | CRM pushes are processed in batches of no more than 50 entries per call. |
| BRU-006 | Re-pushing the same `authorId` to the same `crmConnectorId` updates the existing CRM record if the connector supports it. |
| BRU-007 | Every push must create an `outbound_activities` row with `activity_type='crm_prospect'`. |
| BRU-008 | If `selectedEntryIds` is omitted on a push request, all entries in the list are pushed. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Export and push must not expose phone or email beyond user-curated notes. | Security | Must | Static scan and contract tests assert `phone`/`email` columns are absent from CSV and payload, except as part of free-text `notes`. |
| NFR-002 | Partial CRM push failures must be reported without stopping the entire batch. | Reliability | Must | Response reports `pushedCount` and `skippedCount`; failed/skipped entries are distinguishable. |
| NFR-003 | Exports must use the same sync/async and size thresholds as ADR-0111. | Performance | Should | Sync up to 5,000 rows; async up to 100,000 rows; `export_jobs` tracks status, row count, blob path, and expiry. |
| NFR-004 | Every CRM push must be auditable in `outbound_activities`. | Compliance | Must | Audit row contains tenant, list, connector, user, timestamp, and batch details. |
| NFR-005 | Export and push endpoints must pass RLS and share checks. | Security | Must | Contract tests reject unauthorized callers. |
| NFR-006 | The feature must reuse `CRMConnector` rather than introduce a new connector abstraction. | Maintainability | Should | No new `ProspectCRMConnector` interface is added; payload mapping is owned by the connector or its mapping layer. |
| NFR-007 | UI export and push actions must include accessible labels and confirmation. | Usability / Accessibility | Should | Screen-reader labels on buttons; confirmation before push; status visible to user. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | ADR-0117 is still Proposed; decisions may change before acceptance. | High | Medium | Keep this BRD in **Draft for review** status; do not commit to build until the ADR is Accepted. | Product Owner |
| R-002 | PII leakage via export or CRM payload. | Low | High | Enforce metadata-only rules in code and contract tests; exclude `phone`/`email`; review notes content guidelines. | Security / Engineering |
| R-003 | CRM mapping failures for specific providers. | Medium | Medium | Define clear mapping table per provider; return `skippedCount`; support retry for transient failures. | Engineering |
| R-004 | Duplicate leads if re-push deduplication logic is unclear. | Medium | Medium | Resolve the open question on deduplication key (`authorId` vs `authorName + platformId`) before build. | Product Owner |
| R-005 | Downstream CRM rate-limit errors. | Medium | Medium | Cap batch size at 50; add queue/throttling if needed; surface `skippedCount` and retry guidance. | Engineering |
| R-006 | Low user adoption due to hidden UI actions. | Low | Medium | Place Export and Push actions prominently on the list view; include confirmation and status feedback. | Product Owner / UX |
| R-007 | Large list export latency or timeouts. | Medium | Medium | Use async `export_jobs` for lists above the sync threshold; set Blob lifecycle and expiry. | Engineering |

---

---

## 12. Assumptions and Dependencies

- The prospecting-list data model (`prospecting_lists`, `prospecting_list_entries`) is in place (ADR-0086).
- The `CRMConnector` and credential model are already available (ADR-0095).
- The export bounding, streaming, and size-cap infrastructure is available (ADR-0111).
- Author scoring (`engagement_score`, `authenticity_score`, `influence_score`) is available from the `Author` model (ADR-0108).

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0086: `prospecting_lists` / `prospecting_list_entries` data model | Internal | Engineering | In place before this BRD build |
| D-002 | ADR-0095: `CRMConnector` and credential model | Internal | Engineering | In place before CRM push build |
| D-003 | ADR-0111: export bounding, streaming, and size caps | Internal | Engineering | In place before CSV export build |
| D-004 | ADR-0108: `Author` scoring model | Internal | Engineering | In place; provides score columns |
| D-005 | Story 13.13: backend export and CRM push endpoints | Internal | Engineering | Must be built before Story 13.14 (UI) |
| D-006 | Story 13.14: frontend export and push actions | Internal | Engineering / UX | Starts after Story 13.13 is accepted/complete |

---

---

## 13. Open Questions

- Should the push create a CRM campaign or list, or just individual contacts?
- How are duplicate leads handled? Key on `authorId` or on `authorName + platformId`?
- Should the export include `influence_score` and `authenticity_score` as raw numbers or labels?
- Can the user schedule a recurring CRM push as entries are added?

---

---

## 14. Appendix

### Reference Documents

- ADR-0117: `docs/adr/0117-prospecting-list-export-and-crm-push.md`
- BRD-0117: `docs/project docs/Business-Requirements/BRD-0117-Prospecting-List-Export-And-CRM-Push.md`
- Feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0117 and BRD-0117. |