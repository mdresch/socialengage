# BRD-0086: Prospecting List Model and Sharing

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0086: Prospecting List Model and Sharing |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0086-prospecting-list-model-and-sharing.md, ../Business-Requirements/BRD-0086-Prospecting-List-Model-And-Sharing.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0086-prospecting-list-model-and-sharing.md and the business requirements in BRD-0086-Prospecting-List-Model-And-Sharing.md into functional design for **Prospecting List Model And Sharing**.
Social selling is a key growth use case for SocialEngage, but users currently have no tenant-native way to collect, annotate, prioritize, or hand off the high-value authors they discover through influencer discovery or topic analysis. Leads are typically tracked in ad-hoc spreadsheets or external notes, which prevents collaboration, makes prioritization inconsistent, and creates compliance risk when contact information is scraped or stored outside the platform.

This initiative establishes a lightweight, tenant-scoped **prospecting list** capability. A `Social-Selling-Strategist` can create named lists, add authors from discovery or search, record relationship stage and notes, and share lists within the same tenant. Tenant-level row-level security (RLS) and explicit sharing rules ensure that private lists remain private and shared lists are only visible to authorized tenant users. Export to CSV and a forward-looking CRM handoff contract are included to support manual outreach and future connector-based automation.

The business value is focused: better lead organization, faster prioritization through scores and stages, controlled team collaboration, and a safe handoff path to CRM tools without duplicating existing `Author` and `AuthorTopicSignal` data.

> **Note:** ADR-0086 is currently **Proposed** (2026-08-23). This BRD is a draft for review and will be updated when the ADR is accepted.

---

### 2.2 Scope
**In scope:**
- `prospecting_lists` and `prospecting_list_entries` data model, including ownership, sharing, and tenant scoping.
- Create, read, update, and delete operations for prospecting lists.
- Add, update, and remove authors from a list.
- Tenant-level RLS for both lists and their entries.
- Explicit sharing model: an owner can keep a list private or a `Tenant-Admin` can mark it as shared with the tenant.
- `relationship_stage` field with values: `new`, `contacted`, `engaged`, `converted`, `passed`.
- Per-entry notes, tags, topic, `engagement_score`, and `authenticity_score`.
- Metadata-only CSV export.
- Definition of the `POST .../crm-handoff` API contract (actual CRM connector delivery is a downstream dependency).
- UI views for listing, creating, editing, sharing, and exporting prospecting lists.
- "Add to prospecting list" action from influencer discovery and related author surfaces.

**Out of scope:**
- Workflow engine or enforced `relationship_stage` transitions.
- Automated email follow-ups, reminders, or outreach sequences.
- Public or anonymous sharing of prospecting lists.
- Automatic scraping or storing of private contact information such as email or phone numbers.
- Full real-time CRM connector implementation in v1.
- AI-driven stage recommendations, outreach message drafting, or duplicate detection in v1.
- Bulk import from external spreadsheets in v1.

## 3. Context and Background
See ADR Context.
Social selling is a key growth use case for SocialEngage, but users currently have no tenant-native way to collect, annotate, prioritize, or hand off the high-value authors they discover through influencer discovery or topic analysis. Leads are typically tracked in ad-hoc spreadsheets or external notes, which prevents collaboration, makes prioritization inconsistent, and creates compliance risk when contact information is scraped or stored outside the platform.

This initiative establishes a lightweight, tenant-scoped **prospecting list** capability. A `Social-Selling-Strategist` can create named lists, add authors from discovery or search, record relationship stage and notes, and share lists within the same tenant. Tenant-level row-level security (RLS) and explicit sharing rules ensure that private lists remain private and shared lists are only visible to authorized tenant users. Export to CSV and a forward-looking CRM handoff contract are included to support manual outreach and future connector-based automation.

The business value is focused: better lead organization, faster prioritization through scores and stages, controlled team collaboration, and a safe handoff path to CRM tools without duplicating existing `Author` and `AuthorTopicSignal` data.

> **Note:** ADR-0086 is currently **Proposed** (2026-08-23). This BRD is a draft for review and will be updated when the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable organized lead tracking | `Social-Selling-Strategist` users can create and manage prospecting lists without leaving the platform |
| 2 | Improve prospect prioritization | Users can rank and filter authors by engagement score, authenticity score, and relationship stage |
| 3 | Support controlled collaboration | Lists can be shared within a tenant while preserving owner privacy and tenant isolation |
| 4 | Provide safe export and CRM handoff | CSV export and CRM push contract are metadata-only by default, with no automatic PII harvesting |
| 5 | Build on existing author data | Reuse the `Author` and `AuthorTopicSignal` models instead of creating duplicate author records |

---

**Positive consequences (from ADR):**
1. **Lightweight social-selling feature:** the prospecting list builds on `Author` and `AuthorTopicSignal` without duplicating them.
2. **Controlled collaboration:** sharing is explicit and limited to the tenant.
3. **No workflow engine v1:** relationship stage is a label, reducing initial scope.
4. **Foundation for CRM handoff:** `POST .../crm-handoff` is defined here but relies on the future `CRMConnector` ADR.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow an authenticated user to create, view, rename, and delete tenant-scoped prospecting lists | Must | List CRUD operations are available through the API and UI; a list is owned by a user and scoped to a tenant | Product Owner |
| BR-002 | The system shall allow users to add and remove authors from a prospecting list | Must | Entries reference `Author` by `author_id`; duplicate or invalid authors are handled gracefully | Product Owner |
| BR-003 | The system shall record and display a relationship stage for each list entry | Must | Stage values are limited to `new`, `contacted`, `engaged`, `converted`, and `passed` | Product Owner |
| BR-004 | The system shall support notes, tags, topic, and score metadata on each entry | Should | Users can add, edit, and clear notes and tags; topic and scores are populated at add time | Product Owner |
| BR-005 | The system shall allow users to share a list within the same tenant | Must | `Tenant-Admin` can toggle `shared`; shared lists are visible to other tenant users; unshared lists remain owner-only | Product Owner |
| BR-006 | The system shall provide an "Add to prospecting list" action from influencer discovery and author surfaces | Should | Users can select a list or create a new one from the discovery UI | Product Owner |
| BR-007 | The system shall support exporting a list to CSV | Should | CSV includes metadata columns only; no automatically scraped PII; user-curated notes are included at the tenant's discretion | Product Owner |
| BR-008 | The system shall define a CRM handoff contract for list entries | Could | `POST .../crm-handoff` accepts `crmConnectorId` and selected entries; payload is tenant-scoped and ready for a future connector | Product Owner |
| BR-009 | The system shall enforce that list entries inherit the parent list's visibility | Must | Entries cannot be viewed outside the visibility of their list; RLS prevents cross-tenant or unauthorized access | Product Owner |
| BR-010 | The system shall provide a prospecting list UI with list and detail views | Should | Users can add authors, edit stages/notes/tags, toggle sharing, and export from the UI | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Social-Selling-Strategist` | Primary end user; creates and manages lead lists | High | Easy list creation, scoring, notes, tags, and export |
| `Tenant-User` | Secondary user; views shared lists and adds discovered authors | Medium | Read shared lists and contribute prospects |
| `Tenant-Admin` | Secondary user; controls sharing and export permissions | Medium | Simple sharing toggle and visibility rules |
| `Tenant-Business-Analyst` | Secondary user; correlates list data with sales or CRM data | Low | Reliable CSV exports and clear data lineage |
| Product Owner / Business Sponsor | Owns the feature direction and acceptance | High | On-scope, PII-safe, reusable on existing data |
| Technical Lead | Owns architecture and contract design | High | Clear schema, RLS, and minimal data duplication |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.1 | epic-10-adr-0086-to-0094.md | As backend engineer, I want `prospecting_lists` and `prospecting_list_entries` tables with RLS and sharing, so that `Social-Selling-Strategist` can save, sco... | `prospecting_lists` and `prospecting_list_entries` tables exist with tenant RLS.; `GET /v1/prospecting-lists`, `POST`, `PATCH`, and `DELETE` are tenant-scope... |
| Story 10.2 | epic-10-adr-0086-to-0094.md | As `Social-Selling-Strategist`, I want a prospecting list page where I can add authors, set stages, add notes, and share lists, so that I can manage leads an... | `ProspectingListsView` and `ProspectingListDetailView` are implemented.; Users can add authors from influencer discovery or post feed.; `relationship_stage`,... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `prospecting_lists` table | Stores list header: `id`, `tenant_id`, `owner_id`, `name`, `description`, `shared`, `created_at`, `updated_at` | ADR-0086 | Data / Product | Tenant data |
| `prospecting_list_entries` table | Stores list items: `id`, `prospecting_list_id`, `tenant_id`, `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `relationship_stage`, `notes`, `tags`, `added_by_user_id`, `added_at` | ADR-0086 | Data / Product | Tenant data |
| `author_id` | Reference to the existing `Author` table; no author metadata is duplicated | ADR-0004 | Data / Product | Public metadata |
| `shared` flag | Boolean flag indicating whether a list is visible to the tenant | ADR-0086 | Product | Configuration |
| `relationship_stage` | Categorical label tracking outreach progress | ADR-0086 | Product | Tenant data |
| `notes` | Free-text user observations per entry | User input | User | May contain tenant-sensitive or PII notes if entered |
| `tags` | User-defined array of labels per entry | User input | User | Tenant data |
| `engagement_score` / `authenticity_score` | Numerical scores imported from author/topic signals | `AuthorTopicSignal` | Data | Tenant data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A prospecting list belongs to exactly one tenant and one owner. |
| BRU-002 | A list is visible to its owner and, if `shared = true`, to all `tenant_user` and `tenant_admin` users in the same tenant. |
| BRU-003 | Only a `Tenant-Admin` can set `shared = true`; regular users cannot. |
| BRU-004 | `prospecting_list_entries` inherit the visibility of their parent list; if the list is not shared, the entries are not shared. |
| BRU-005 | `relationship_stage` is a user-managed label and must be one of `new`, `contacted`, `engaged`, `converted`, or `passed`. |
| BRU-006 | v1 does not enforce workflow transitions, email automation, or follow-up reminders. |
| BRU-007 | Only public author metadata and user-curated notes may be stored or exported; private contact data is not scraped automatically. |
| BRU-008 | Export to CSV is metadata-only by default and excludes email, phone, or other private contact fields. |
| BRU-009 | An author is added to a list by reference to the existing `Author` table; full author records are not duplicated. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `Author` table (ADR-0004) and `AuthorTopicSignal` (ADR-0007) | Internal / Data | Technical Lead | Already in place |
| D-002 | Watchlist ownership and RLS patterns (ADR-0044) | Internal / Architecture | Technical Lead | Already in place |
| D-003 | Influencer discovery UI and `Author` scoring (ADR-0108, Story 12.15 / 12.16) | Internal / Feature | Product Owner | Before or alongside frontend stories |
| D-004 | CRM connector abstraction (ADR-0091 / ADR-0117, Story 13.13 / 13.14) | Internal / Future | Product Owner | After ADR-0086 is accepted and built |
| D-005 | `prospecting_lists` and `prospecting_list_entries` schema acceptance (ADR-0086) | Internal / Decision | Product Owner | When ADR-0086 is accepted |

---

- The `Author` table and `AuthorTopicSignal` data already exist and are stable (ADR-0004, ADR-0007).
- Author scoring and discovery surfaces (ADR-0108) will provide the "Add to prospecting list" entry point.
- Tenant and user identity, plus role-based access, are already in place.
- CRM handoff will rely on a future `CRMConnector` abstraction (ADR-0091 / ADR-0117).
- Public metadata and user-curated notes are sufficient for v1 outreach workflows.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | List and entry data must be isolated to the owning tenant and visible only to authorized users | Security | Must | RLS policies and contract tests verify cross-tenant access returns `404` and shared visibility works within tenant |
| NFR-002 | Only `Tenant-Admin` can change the `shared` status of a list | Security | Must | Role-based authorization tests confirm regular users cannot toggle sharing |
| NFR-003 | The system must not automatically harvest or store private contact information such as email or phone | Compliance | Must | No PII columns exist in the model except user-curated notes; export excludes PII by default |
| NFR-004 | List operations and exports must respond within 2 seconds for lists up to 5,000 entries | Performance | Should | Contract and UI performance tests verify p95 latency under 2 seconds |
| NFR-005 | The list UI must be keyboard-navigable and screen-reader friendly | Accessibility | Should | Tables expose row labels, sorting, and action buttons with clear ARIA semantics |
| NFR-006 | The data model must reuse the existing `Author` table to avoid duplication | Maintainability | Must | Only `author_id` and derived scores are stored in `prospecting_list_entries` |

---

## 11. Error Handling and Exceptions
1. **Lightweight social-selling feature:** the prospecting list builds on `Author` and `AuthorTopicSignal` without duplicating them.
2. **Controlled collaboration:** sharing is explicit and limited to the tenant.
3. **No workflow engine v1:** relationship stage is a label, reducing initial scope.
4. **Foundation for CRM handoff:** `POST .../crm-handoff` is defined here but relies on the future `CRMConnector` ADR.

---

## 12. Assumptions and Dependencies
- The `Author` table and `AuthorTopicSignal` data already exist and are stable (ADR-0004, ADR-0007).
- Author scoring and discovery surfaces (ADR-0108) will provide the "Add to prospecting list" entry point.
- Tenant and user identity, plus role-based access, are already in place.
- CRM handoff will rely on a future `CRMConnector` abstraction (ADR-0091 / ADR-0117).
- Public metadata and user-curated notes are sufficient for v1 outreach workflows.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users enter PII into `notes` and export it, creating compliance exposure | Medium | High | Add inline guidance, default metadata-only export, and tenant-admin review of sharing settings | Product Owner |
| R-002 | Sharing is misconfigured and private lists become visible to unintended users | Medium | High | Only `Tenant-Admin` can toggle `shared`; RLS enforces tenant boundaries; clear labels in UI | Technical Lead |
| R-003 | Scores become stale if not recomputed, leading to poor prioritization | Medium | Medium | Document score freshness expectations; open question tracked for v1.5 on recomputation policy | Technical Lead |
| R-004 | Feature is underused because discovery and CRM connectors are not yet built | Medium | Medium | Provide CSV export immediately; defer CRM handoff UI until connector is available | Product Owner |
| R-005 | Lists are used to spam or scrape authors at scale | Medium | High | Rate limit exports and adds; audit list creation; enforce public-metadata-only policy | Technical Lead |
| R-006 | ADR remains Proposed and details change, invalidating this BRD | Medium | Medium | Mark BRD as draft; refresh when ADR-0086 is accepted | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0086-prospecting-list-model-and-sharing.md`
- BRD: `../Business-Requirements/BRD-0086-Prospecting-List-Model-And-Sharing.md`
- Feature design: `docs/product-research/feature-designs/18-prospecting-list.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above