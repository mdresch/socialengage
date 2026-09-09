# BRD-0086: Prospecting List Model and Sharing

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Prospecting List Model and Sharing Business Requirements Document |
| Version | 1.1 |
| Date | 2026-08-27 |
| Author(s) | Product Owner |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0086 and supporting source documents |
| 1.1 | 2026-08-27 | Technical Lead | Synced to ADR-0086's accepted revision: sharing is owner-only (no `Tenant-Admin` override), read-only for non-owner tenant members; CRM connector citation corrected to ADR-0095/ADR-0117 (was ADR-0091); score fields sourced to ADR-0108, all four snapshotted; no fixed entries-per-list cap (pagination only); export/CRM-handoff wire contracts deferred to ADR-0117 |

---

## 2. Executive Summary

Social selling is a key growth use case for SocialEngage, but users currently have no tenant-native way to collect, annotate, prioritize, or hand off the high-value authors they discover through influencer discovery or topic analysis. Leads are typically tracked in ad-hoc spreadsheets or external notes, which prevents collaboration, makes prioritization inconsistent, and creates compliance risk when contact information is scraped or stored outside the platform.

This initiative establishes a lightweight, tenant-scoped **prospecting list** capability. A `Social-Selling-Strategist` can create named lists, add authors from discovery or search, record relationship stage and notes, and share lists within the same tenant. Tenant-level row-level security (RLS) and explicit sharing rules ensure that private lists remain private and shared lists are only visible to authorized tenant users. Export to CSV and a forward-looking CRM handoff contract are included to support manual outreach and future connector-based automation.

The business value is focused: better lead organization, faster prioritization through scores and stages, controlled team collaboration, and a safe handoff path to CRM tools without duplicating existing `Author` and `AuthorTopicSignal` data.

> **Note:** ADR-0086 was **Accepted** on 2026-08-27, as revised. This BRD reflects the accepted decision; Stories 10.1/10.2 are Ready.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable organized lead tracking | `Social-Selling-Strategist` users can create and manage prospecting lists without leaving the platform |
| 2 | Improve prospect prioritization | Users can rank and filter authors by engagement score, authenticity score, and relationship stage |
| 3 | Support controlled collaboration | Lists can be shared within a tenant while preserving owner privacy and tenant isolation |
| 4 | Provide safe export and CRM handoff | CSV export and CRM push contract are metadata-only by default, with no automatic PII harvesting |
| 5 | Build on existing author data | Reuse the `Author` and `AuthorTopicSignal` models instead of creating duplicate author records |

---

## 4. Scope

### 4.1 In Scope

- `prospecting_lists` and `prospecting_list_entries` data model, including ownership, sharing, and tenant scoping.
- Create, read, update, and delete operations for prospecting lists.
- Add, update, and remove authors from a list.
- Tenant-level RLS for both lists and their entries.
- Explicit sharing model: only the list's own owner can mark it shared with the tenant (read-only for teammates); no `Tenant-Admin` override.
- `relationship_stage` field with values: `new`, `contacted`, `engaged`, `converted`, `passed`.
- Per-entry notes, tags, topic, `custom_attributes`, and all four ADR-0108 scores (`engagement_score`, `authenticity_score`, `influence_score`, `reach_score`).
- Metadata-only CSV export.
- Definition of the `POST .../crm-handoff` API contract (actual CRM connector delivery is a downstream dependency).
- UI views for listing, creating, editing, sharing, and exporting prospecting lists.
- "Add to prospecting list" action from influencer discovery and related author surfaces.

### 4.2 Out of Scope

- Workflow engine or enforced `relationship_stage` transitions.
- Automated email follow-ups, reminders, or outreach sequences.
- Public or anonymous sharing of prospecting lists.
- Automatic scraping or storing of private contact information such as email or phone numbers.
- Full real-time CRM connector implementation in v1.
- AI-driven stage recommendations, outreach message drafting, or duplicate detection in v1.
- Bulk import from external spreadsheets in v1.

### 4.3 Assumptions

- The `Author` table and `AuthorTopicSignal` data already exist and are stable (ADR-0004, ADR-0007).
- Author scoring and discovery surfaces (ADR-0108) will provide the "Add to prospecting list" entry point.
- Tenant and user identity, plus role-based access, are already in place.
- CRM handoff will rely on the `CRMConnector` abstraction (ADR-0095), with its prospecting-list-specific wire contract in ADR-0117.
- Public metadata and user-curated notes are sufficient for v1 outreach workflows.

### 4.4 Constraints

- Must remain strictly tenant-scoped with RLS; no cross-tenant list visibility.
- Only a list's own owner can mark it `shared = true`; there is no `Tenant-Admin` override (ADR-0044 §5c parity). Sharing grants read-only visibility to other tenant members — it does not grant them write access.
- Export must not include scraped private contact data by default.
- The model must not duplicate `Author` metadata; `author_id` is the only stored reference.
- Implementation must follow the contract-first workflow and existing component skill patterns.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Social-Selling-Strategist` | Primary end user; creates and manages lead lists | High | Easy list creation, scoring, notes, tags, and export |
| `Tenant-User` | Secondary user; views shared lists and adds discovered authors | Medium | Read shared lists and contribute prospects |
| `Tenant-Admin` | Secondary user; no special access to prospecting lists beyond any other `tenant_user` — may view a shared list, cannot toggle sharing or edit another user's list | Low | Clear, predictable visibility rules with no surprise oversight access |
| `Tenant-Business-Analyst` | Secondary user; correlates list data with sales or CRM data | Low | Reliable CSV exports and clear data lineage |
| Product Owner / Business Sponsor | Owns the feature direction and acceptance | High | On-scope, PII-safe, reusable on existing data |
| Technical Lead | Owns architecture and contract design | High | Clear schema, RLS, and minimal data duplication |

---

## 6. Current State (As-Is)

Today, a `Social-Selling-Strategist` can discover authors through influencer discovery and topic analysis, but the platform does not provide a persistent, shareable place to track those leads.

**Current process:**

1. User discovers a promising author in the influencer discovery or topic center.
2. User copies author details, scores, or URLs into an external spreadsheet or note-taking tool.
3. Relationship tracking, prioritization, and outreach handoff happen outside SocialEngage.
4. Team members cannot see each other's lead lists or progress unless shared manually.

**Pain points:**

- Leads are fragmented across external tools and user accounts.
- No standardized way to record relationship stage, notes, or tags.
- Prioritization is inconsistent because scores and context are not kept together.
- Sharing is manual and insecure, increasing PII and platform-terms risk.
- CRM handoff requires re-keying data, causing errors and delays.

---

## 7. Future State (To-Be)

After this initiative is implemented, the `Social-Selling-Strategist` can manage leads entirely within SocialEngage:

**New or improved process:**

1. User discovers an author through influencer discovery, topic analysis, or search.
2. User clicks **Add to prospecting list** and selects an existing or new list.
3. The list stores the `author_id`, topic, scores, and user-curated metadata such as stage, notes, and tags.
4. User reviews the list, edits relationship stages inline, and filters or sorts by score.
5. The list's owner can mark it shared so other tenant users can view it (read-only); the owner alone keeps write access.
6. User exports the list to CSV or pushes selected entries to a connected CRM when the connector is available.

**Expected capabilities:**

- Create and manage multiple named, tenant-scoped prospecting lists.
- Add authors from discovery, search, and post-feed surfaces.
- Track relationship stage, notes, tags, topic, and scores per author.
- Share lists read-only within the tenant, under the owner's own control.
- Export list data to CSV with metadata-only columns.
- Prepare for CRM handoff through a defined API contract.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow an authenticated user to create, view, rename, and delete tenant-scoped prospecting lists | Must | List CRUD operations are available through the API and UI; a list is owned by a user and scoped to a tenant | Product Owner |
| BR-002 | The system shall allow users to add and remove authors from a prospecting list | Must | Entries reference `Author` by `author_id`; adding an `author_id` already on the list returns `409 Conflict` (one row per author per list) | Product Owner |
| BR-003 | The system shall record and display a relationship stage for each list entry | Must | Stage values are limited to `new`, `contacted`, `engaged`, `converted`, and `passed` | Product Owner |
| BR-004 | The system shall support notes, tags, topic, custom attributes, and score metadata on each entry | Should | Users can add, edit, and clear notes, tags, and `custom_attributes`; topic and all four ADR-0108 scores (`engagement_score`, `authenticity_score`, `influence_score`, `reach_score`) are snapshotted at add time | Product Owner |
| BR-005 | The system shall allow a list's owner to share it within the same tenant | Must | Only `owner_id` can toggle `shared`; shared lists are read-only for other tenant users; unshared lists remain owner-only; there is no `Tenant-Admin` override | Product Owner |
| BR-006 | The system shall provide an "Add to prospecting list" action from influencer discovery and author surfaces | Should | Users can select a list or create a new one from the discovery UI | Product Owner |
| BR-007 | The system shall support exporting a list to CSV | Should | CSV includes metadata columns only; no automatically scraped PII; user-curated notes are included at the tenant's discretion; wire contract defined in ADR-0117 | Product Owner |
| BR-008 | The system shall define a CRM handoff contract for list entries | Could | `POST .../crm-handoff` accepts `crmConnectorId` and selected entries; payload is tenant-scoped; wire contract and `CRMConnector` reuse defined in ADR-0117/ADR-0095 | Product Owner |
| BR-009 | The system shall enforce that list entries inherit the parent list's visibility | Must | Entries cannot be viewed outside the visibility of their list; RLS prevents cross-tenant or unauthorized access | Product Owner |
| BR-010 | The system shall provide a prospecting list UI with list and detail views | Should | Users can add authors, edit stages/notes/tags, toggle sharing, and export from the UI | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | List and entry data must be isolated to the owning tenant and visible only to authorized users | Security | Must | RLS policies and contract tests verify cross-tenant access returns `404` and shared visibility works within tenant |
| NFR-002 | Only a list's own owner can change its `shared` status or mutate it while shared | Security | Must | RLS-based tests confirm a non-owner's write attempt (including `tenant_admin`) matches zero rows and returns `404`, not `403` |
| NFR-003 | The system must not automatically harvest or store private contact information such as email or phone | Compliance | Must | No PII columns exist in the model except user-curated notes; export excludes PII by default |
| NFR-004 | List operations and exports must respond within 2 seconds for lists up to 5,000 entries | Performance | Should | Contract and UI performance tests verify p95 latency under 2 seconds |
| NFR-005 | The list UI must be keyboard-navigable and screen-reader friendly | Accessibility | Should | Tables expose row labels, sorting, and action buttons with clear ARIA semantics |
| NFR-006 | The data model must reuse the existing `Author` table to avoid duplication | Maintainability | Must | Only `author_id` and derived scores are stored in `prospecting_list_entries` |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A prospecting list belongs to exactly one tenant and one owner. |
| BRU-002 | A list is visible (read-only, unless owned) to its owner and, if `shared = true`, to all `tenant_user` and `tenant_admin` users in the same tenant. |
| BRU-003 | Only a list's own `owner_id` can set `shared = true`/`false`. There is no `Tenant-Admin` override, matching ADR-0044 §5c's precedent for watchlists. |
| BRU-004 | `prospecting_list_entries` inherit the visibility of their parent list; if the list is not shared, the entries are not shared. |
| BRU-005 | `relationship_stage` is a user-managed label and must be one of `new`, `contacted`, `engaged`, `converted`, or `passed`. |
| BRU-006 | v1 does not enforce workflow transitions, email automation, or follow-up reminders. |
| BRU-007 | Only public author metadata and user-curated notes may be stored or exported; private contact data is not scraped automatically. |
| BRU-008 | Export to CSV is metadata-only by default and excludes email, phone, or other private contact fields. |
| BRU-009 | An author is added to a list by reference to the existing `Author` table; full author records are not duplicated. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `prospecting_lists` table | Stores list header: `id`, `tenant_id`, `owner_id`, `name`, `description`, `shared`, `created_at`, `updated_at` | ADR-0086 | Data / Product | Tenant data |
| `prospecting_list_entries` table | Stores list items: `id`, `prospecting_list_id`, `tenant_id`, `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `influence_score`, `reach_score`, `relationship_stage`, `notes`, `tags`, `custom_attributes`, `added_by_user_id`, `added_at` | ADR-0086 | Data / Product | Tenant data |
| `author_id` | Reference to the existing `Author` table; no author metadata is duplicated | ADR-0004 | Data / Product | Public metadata |
| `shared` flag | Boolean flag indicating whether a list is read-only-visible to the tenant; owner-togglable only | ADR-0086 | Product | Configuration |
| `relationship_stage` | Categorical label tracking outreach progress | ADR-0086 | Product | Tenant data |
| `notes` | Free-text user observations per entry | User input | User | May contain tenant-sensitive or PII notes if entered |
| `tags` | User-defined array of labels per entry | User input | User | Tenant data |
| `custom_attributes` | Tenant-defined JSON metadata per entry (e.g. SDR assignee, campaign tag) | User input | User | Tenant data |
| `engagement_score` / `authenticity_score` / `influence_score` / `reach_score` | Add-time snapshot of the author's `Author` scoring columns; not kept in sync | ADR-0108 | Data | Tenant data |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Prospecting lists created per tenant | Track adoption of the social selling feature | Product team | Weekly |
| Entries per list and per stage | Understand pipeline distribution and engagement | `Social-Selling-Strategist` / Tenant-Admin | On demand |
| Shared vs. private list ratio | Monitor collaboration behavior | Product team | Weekly |
| Export and CRM handoff counts | Measure handoff to external tools | Product team / Sales | Weekly |
| Top topics in prospecting lists | Identify high-interest themes for outreach | `Tenant-Business-Analyst` | Monthly |
| Average engagement and authenticity scores | Prioritization signal for leads | `Social-Selling-Strategist` | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users enter PII into `notes` and export it, creating compliance exposure | Medium | High | Add inline guidance, default metadata-only export, and tenant-admin review of sharing settings | Product Owner |
| R-002 | Sharing is misconfigured and private lists become visible to unintended users | Medium | High | Only the list's own owner can toggle `shared`; RLS enforces tenant and ownership boundaries per-command; clear labels in UI | Technical Lead |
| R-003 | Scores become stale since they're an add-time snapshot, leading to poor prioritization on old entries | Medium | Medium | Documented as an intentional trade-off (immutable qualification context); current values remain available via `Author` (ADR-0108) if needed | Technical Lead |
| R-004 | Feature is underused because discovery and CRM connectors are not yet built | Medium | Medium | Provide CSV export immediately; defer CRM handoff UI until connector is available | Product Owner |
| R-005 | Lists are used to spam or scrape authors at scale | Medium | High | Rate limit exports and adds; audit list creation; enforce public-metadata-only policy | Technical Lead |
| R-006 | ~~ADR remains Proposed and details change, invalidating this BRD~~ Resolved: ADR-0086 accepted 2026-08-27, revised per architectural review; this BRD is synced to the accepted text. | — | — | Closed | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `Author` table (ADR-0004) and `AuthorTopicSignal` (ADR-0007) | Internal / Data | Technical Lead | Already in place |
| D-002 | Watchlist ownership and RLS patterns (ADR-0044) | Internal / Architecture | Technical Lead | Already in place |
| D-003 | Influencer discovery UI and `Author` scoring (ADR-0108, Story 12.15 / 12.16) | Internal / Feature | Product Owner | Before or alongside frontend stories |
| D-004 | CRM connector abstraction (ADR-0095) and its prospecting-list wire contract (ADR-0117, Story 13.13 / 13.14) | Internal / Future | Product Owner | After Story 10.1 is built |
| D-005 | ~~`prospecting_lists` and `prospecting_list_entries` schema acceptance (ADR-0086)~~ | Internal / Decision | Product Owner | Resolved — accepted 2026-08-27 |

---

## 14. Acceptance Criteria

- `prospecting_lists` and `prospecting_list_entries` tables exist with tenant RLS.
- `GET /v1/prospecting-lists`, `POST`, `PATCH`, and `DELETE` endpoints are tenant-scoped and user-owned.
- A list can be marked `shared` so other `tenant_user`s in the same tenant can read it (read-only).
- Only the list's own `owner_id` can toggle `shared`, or create/update/delete the list or its entries at any time; there is no `Tenant-Admin` override. A non-owner's write attempt on a visible shared resource returns `404`, not `403`.
- `relationship_stage` is constrained to `new`, `contacted`, `engaged`, `converted`, and `passed`.
- `ProspectingListsView` and `ProspectingListDetailView` are implemented.
- Users can add authors from influencer discovery or the post feed; adding a duplicate `author_id` to the same list returns `409 Conflict`.
- `relationship_stage`, `notes`, `tags`, and `custom_attributes` are editable inline by the owner.
- Export and CRM-handoff buttons are present in the UI, wired to the contracts owned by ADR-0117/ADR-0095.
- CSV export is metadata-only and excludes automatically scraped private contact data.
- Contract tests cover CRUD, owner-only mutation on a shared list (`404` for non-owners), duplicate-entry `409`, and cross-tenant `404` behavior.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Prospecting list | A tenant-scoped, user-owned named list of authors tracked for social-selling outreach. |
| Prospecting list entry | A single author record within a list, including topic, scores, stage, notes, and tags. |
| `Author` | The existing platform entity representing a social media account or content creator. |
| `AuthorTopicSignal` | The model that captures an author's topical relevance and derived scoring. |
| Relationship stage | A user-managed label indicating outreach status: `new`, `contacted`, `engaged`, `converted`, `passed`. |
| `engagement_score` / `authenticity_score` / `influence_score` / `reach_score` | Add-time snapshot of an author's ADR-0108 scoring columns; not kept in sync with the live `Author` values. |
| RLS | Row-level security; the tenant isolation mechanism used for the prospecting tables, enforced per-command (read vs. write) here. |
| `shared` | A list visibility flag that, when `true` and set only by the list's own owner, makes the list read-only-visible to other users in the same tenant. |
| CRM handoff | The API contract for pushing selected list entries to a connected CRM; wire contract in ADR-0117, reusing `CRMConnector` (ADR-0095). |
| `Social-Selling-Strategist` | Primary persona responsible for finding, scoring, and engaging high-value authors. |
| `Tenant-Admin` | Tenant administrator; has no special access to prospecting lists — same as any other `tenant_user` for this feature. |

---

## 16. Appendices

### 16.1 Reference documents

- ADR-0086: `docs/adr/0086-prospecting-list-model-and-sharing.md`
- Feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- Feature-to-ADR scoping plan: `docs/product-research/feature-adr-scoping.md`

### 16.2 Related user stories

- **Story 10.1** — Prospecting list model and sharing (backend) — `docs/user-stories/epic-10-adr-0086-to-0094.md`
- **Story 10.2** — Prospecting list UI (frontend) — `docs/user-stories/epic-10-adr-0086-to-0094.md`
- **Story 12.16** — Influencer discovery UI (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`
- **Story 13.13** — Prospecting list export and CRM push (backend) — `docs/user-stories/epic-13-adr-0109-to-0117.md`
- **Story 13.14** — Prospecting export and CRM push UI (frontend) — `docs/user-stories/epic-13-adr-0109-to-0117.md`

### 16.3 Missing source

- No `docs/product-research/reports/<feature>-deep-research.md` file exists for the prospecting list feature. When a deep-research brief is produced, it should be linked here.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | TBD — Stakeholder to be named | | |
