# BRD-0117: Prospecting List Export and CRM Push

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Prospecting List Export and CRM Push – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | [Product Owner] |
| Approver(s) | Menno [Business Sponsor] |
| Status | Draft for review |

> **Note on ADR status:** The source ADR-0117 is currently **Proposed** (2026-08-23). This BRD is therefore a draft for review and may change until the ADR is Accepted.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0117, feature design 18-prospecting-list, and Epic 13 user stories |

---

## 2. Executive Summary

SocialEngage users can already discover, score, and curate authors into tenant-scoped **prospecting lists**. The missing step is a safe, controlled handoff of those leads into downstream sales workflows. Today, a `Social-Selling-Strategist` must manually copy prospect metadata out of the platform or risk sharing uncontrolled, full-PII exports. This BRD defines the business need for **prospecting-list export** and **CRM push** capabilities.

The proposed solution adds two controlled handoff paths: a **metadata-only CSV export** and a **batch CRM push** that reuses the existing `CRMConnector` (ADR-0095). Both paths enforce the same privacy guardrails as other export features (ADR-0111): phone and email are never emitted by the platform, and only user-curated notes may contain any contact information the user has chosen to add. Export and push are protected by role- and share-based authorization, and every CRM push is recorded in the `outbound_activities` audit log.

Expected business value: a closed social-selling loop, reduced manual copying, consistent PII handling, and an auditable trail from list curation to CRM lead.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the social-selling loop from discovery to CRM handoff | `Social-Selling-Strategist` can push a curated list to a CRM in under two minutes |
| 2 | Reuse existing CRM connector infrastructure | No new connector credential store is built; `CRMConnector` (ADR-0095) is the integration point |
| 3 | Maintain strict PII and privacy boundaries | Phone/email never appear in exports or payloads except in user-curated notes; zero leakage incidents in contract/audit review |
| 4 | Provide an auditable handoff trail | Every CRM push creates an `outbound_activities` record that a `Tenant-Admin` can inspect |
| 5 | Improve list portability for manual outreach | CSV export contains analysis-ready, metadata-only columns for spreadsheet import |

---

## 4. Scope

### 4.1 In Scope

- Metadata-only CSV export of a prospecting list, bounded by the same sync/async and size rules as ADR-0111.
- Batch CRM push of all or selected list entries to a connected CRM as `lead` records.
- `CRMConnector` payload mapping for major CRMs (HubSpot `contacts`, Salesforce `Lead`).
- Batching of CRM calls at up to 50 entries per call.
- Idempotent re-push behavior: updating the existing CRM record when the connector supports it.
- `outbound_activities` audit logging for every push.
- Role- and share-based authorization for export and push.
- Optional `selectedEntryIds` on CRM push (push all if omitted).
- Optional `customFields` passed through to the CRM lead record.

### 4.2 Out of Scope

- Single-entry CRM push endpoints (deferred; can be added later).
- A separate `ProspectCRMConnector` abstraction (rejected in ADR-0117).
- PDF or Excel export formats (rejected in ADR-0117).
- Scheduled or automatic recurring CRM pushes.
- Automatic harvesting or storage of phone numbers or email addresses.
- CRM campaign/list creation (open question; not required for v1).

### 4.3 Assumptions

- The prospecting-list data model (`prospecting_lists`, `prospecting_list_entries`) is in place (ADR-0086).
- The `CRMConnector` and credential model are already available (ADR-0095).
- The export bounding, streaming, and size-cap infrastructure is available (ADR-0111).
- Author scoring (`engagement_score`, `authenticity_score`, `influence_score`) is available from the `Author` model (ADR-0108).

### 4.4 Constraints

- ADR-0117 is still **Proposed**; the contents of this BRD are subject to acceptance-driven change.
- Exports and payloads must remain metadata-only; platform-stored `phone`/`email` fields are explicitly excluded.
- CRM push must be batched and rate-limited to protect downstream CRM APIs.
- All operations must be tenant-scoped and subject to row-level security.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Social-Selling-Strategist | Primary user: curates lists and hands off leads | High | One-click export or push to CRM with clear confirmation |
| Tenant-Business-Analyst | Secondary user: correlates prospect data with sales | Medium | Clean, metadata-only CSV for analysis |
| Tenant-User | Secondary user: views shared lists, may add authors | Medium | See shared lists and understand which were exported/pushed |
| Tenant-Admin | Secondary: configures sharing and audits handoffs | Medium | Control who can export/push, view `outbound_activities` |
| Compliance / Security | Governance | High | No platform-harvested PII in exports or payloads |
| Product Owner | Requirement owner | High | Clear acceptance criteria and risk visibility |

---

## 6. Current State (As-Is)

Prospecting lists exist as a tenant-scoped data model. Users can save authors, add notes and tags, and record relationship stages. However, there is no supported way to move that curated data into a CRM or into a spreadsheet. This creates the following pain points:

- **Manual copy/paste:** strategists copy public URLs and scores manually into their CRM or outreach tools.
- **Inconsistent data:** manual entry introduces errors and missing fields.
- **No audit trail:** the platform has no record of which leads were pushed or when.
- **PII risk:** users may create their own uncontrolled exports that include sensitive contact information.
- **Missed sales velocity:** the gap between discovery and outreach slows the social-selling workflow.

---

## 7. Future State (To-Be)

After this initiative, a `Social-Selling-Strategist` can open a prospecting list and choose either **Export CSV** or **Push to CRM**.

**Export path:**
1. The user selects the export action.
2. The platform generates a metadata-only CSV containing author identifiers, scores, relationship stage, notes, and tags.
3. If the list is within the synchronous threshold the file downloads immediately; larger lists are processed asynchronously via `export_jobs`.
4. The CSV deliberately excludes `phone` and `email` unless the user has added them to free-text notes.

**CRM push path:**
1. The user selects a configured `CRMConnector` from a modal.
2. The user optionally selects specific entries; if none are selected, all entries are pushed.
3. The platform maps each entry to the CRM's lead/contact shape and pushes in batches of up to 50.
4. Each push creates an `outbound_activities` row with `activity_type='crm_prospect'`.
5. The platform returns the count pushed, the count skipped, the generated outbound activity IDs, and a CRM list/campaign URL when available.
6. Re-pushing the same author to the same connector updates the existing CRM record where the connector supports it.

**Expected capabilities:**
- Metadata-only, permission-bound CSV export.
- Batch, auditable CRM handoff reusing the existing connector.
- Scalable to large lists via async export and bounded CRM call batching.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

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

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Prospecting lists exported (CSV count) | Track export adoption | Product team | Weekly |
| Prospects pushed to CRM by connector | Track CRM handoff volume and connector mix | Product team / Tenant-Admin | Weekly |
| Push success / skip / failure counts | Monitor integration reliability | Product team / Engineering | Daily |
| Average list size at handoff | Understand typical use case | Product team | Monthly |
| Time from list creation to CRM push | Measure social-selling velocity | Product team / Business Sponsor | Monthly |

---

## 12. Risks and Mitigations

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

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0086: `prospecting_lists` / `prospecting_list_entries` data model | Internal | Engineering | In place before this BRD build |
| D-002 | ADR-0095: `CRMConnector` and credential model | Internal | Engineering | In place before CRM push build |
| D-003 | ADR-0111: export bounding, streaming, and size caps | Internal | Engineering | In place before CSV export build |
| D-004 | ADR-0108: `Author` scoring model | Internal | Engineering | In place; provides score columns |
| D-005 | Story 13.13: backend export and CRM push endpoints | Internal | Engineering | Must be built before Story 13.14 (UI) |
| D-006 | Story 13.14: frontend export and push actions | Internal | Engineering / UX | Starts after Story 13.13 is accepted/complete |

---

## 14. Acceptance Criteria

- CSV export returns the columns `author_id, author_name, platform_id, public_url, topic, engagement_score, authenticity_score, influence_score, relationship_stage, notes, tags`.
- CSV export does not include `phone` or `email` and does not include any connector secrets.
- Synchronous export supports up to 5,000 rows; asynchronous export supports up to 100,000 rows.
- `POST /v1/prospecting-lists/:id/crm-handoff` accepts `crmConnectorId`, `caseType='lead'`, optional `selectedEntryIds`, and optional `customFields`.
- The handoff response returns `outboundActivityIds`, `pushedCount`, `skippedCount`, and an optional `crmUrl`.
- `CRMConnector` receives a batch of `ProspectingListEntryPayload` and maps it to the CRM's lead/contact object.
- HubSpot pushes are mapped to `contacts` with social profile properties; Salesforce pushes are mapped to `Lead` with custom fields for scores and tags.
- Each push writes one `outbound_activities` row with `activity_type='crm_prospect'`.
- Batches contain no more than 50 entries per CRM call.
- Re-pushing the same author to the same CRM connector updates the existing CRM record where the connector supports it.
- Only the list `owner`, a user with `edit` share, or `tenant_admin` can export or push.
- `Tenant-Admin` can view `outbound_activities` for any list in the tenant.
- The UI provides accessible **Export CSV** and **Push to CRM** actions on the prospecting list.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Prospecting list** | A tenant- or user-scoped list for saving, scoring, annotating, and exporting authors discovered through listening or topic analysis. |
| **ProspectingListEntryPayload** | The structured object sent to a `CRMConnector` containing author metadata, scores, relationship stage, notes, and tags. |
| **CRMConnector** | The existing connector abstraction (ADR-0095) used to hand off data to CRMs such as HubSpot and Salesforce. |
| **CRM handoff** | The action of pushing one or more list entries to a configured CRM as leads. |
| **Metadata-only export** | An export that contains only public and platform-derived metadata; platform-stored phone and email are excluded. |
| **`outbound_activities`** | The audit-log table that records external actions such as CRM handoffs. |
| **RLS** | Row-level security; ensures users see and operate only on data scoped to their tenant, role, and share. |
| **Relationship stage** | A user-curated lifecycle field (`new`, `contacted`, `engaged`, `converted`, `passed`) on a prospecting-list entry. |
| **PII** | Personally identifiable information; in this BRD specifically `phone` and `email` that the platform does not expose. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0117-prospecting-list-export-and-crm-push.md` (source ADR, **Proposed**)
- `docs/product-research/feature-designs/18-prospecting-list.md` (feature design)
- `docs/product-research/feature-adr-scoping.md` (source scoping document)
- `docs/user-stories/epic-13-adr-0109-to-0117.md`
  - Story 13.13 — Prospecting list export and CRM push (backend)
  - Story 13.14 — Prospecting export and CRM push UI (frontend)

### 16.2 Related ADRs

- `ADR-0086` — Prospecting list data model
- `ADR-0095` — CRM connector
- `ADR-0111` — Export bounding, streaming, and size caps

### 16.3 Missing Source Note

No `docs/product-research/reports/18-prospecting-list-deep-research.md` file was found; the competitive/research brief should be added when available.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
