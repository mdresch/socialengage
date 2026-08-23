# Business Requirements Document — Onboarding Checklist State

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Onboarding Checklist State |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0080-onboarding-checklist-state.md, ../Business-Requirements/BRD-0080-Onboarding-Checklist-State.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0080-onboarding-checklist-state.md and the business requirements in BRD-0080-Onboarding-Checklist-State.md into functional design for **Onboarding Checklist State**.
New SocialEngage tenants currently complete setup by navigating independently through connector, watchlist, user, and post screens. This leaves trial users without a clear activation path and increases support requests for basic setup. ADR-0080 proposes a tenant-scoped `onboarding_checklist` state model and a lightweight `GET/PATCH` API that reflects setup progress without altering existing endpoints.

The proposed solution adds a dismissible, read-mostly checklist to the tenant admin dashboard. It guides a `Tenant-Admin` through four core setup milestones — connect a source, build a watchlist, invite a user, and verify first posts — plus optional advanced steps. Completion is derived from existing data, so the checklist introduces no new workflow gates and no new permissions. The expected business value is faster time-to-value, lower support burden, and higher trial-to-paid conversion.

> **Note:** ADR-0080 is currently **Proposed** (not yet Accepted). This BRD is a draft for review and will be updated once the ADR is accepted.

---

### 2.2 Scope
**In scope:**
- Adding a tenant-scoped `onboarding_checklist` JSONB column to the `tenants` table.
- `GET /v1/tenants/:id/onboarding-checklist` returning current completion state (readable by `tenant_admin` and `tenant_user`).
- `PATCH /v1/tenants/:id/onboarding-checklist` allowing a `Tenant-Admin` to:
  - Dismiss the checklist.
  - Reset the checklist to pending.
  - Mark advanced steps as hidden or shown.
- Deriving completion of core steps from existing `connector_activations`, `watchlists`, `users`, `posts`, enrichment runs, and `alert_rules` data.
- Admin dashboard `OnboardingChecklist` component that displays steps, completion status, and deep links to existing screens.
- Dismissible and resumable checklist behavior with progress re-evaluated on navigation return.

**Out of scope:**
- Modifying the existing connector, watchlist, user invitation, or post endpoints.
- Requiring the checklist before any other product feature can be used.
- Manual completion of core steps by a user; completion is derived only.
- New role or permission model; the feature reuses existing RLS.
- New Service Bus events in v1.
- AI-driven smart next-step recommendations or query suggestions.

## 3. Context and Background
See ADR Context.
New SocialEngage tenants currently complete setup by navigating independently through connector, watchlist, user, and post screens. This leaves trial users without a clear activation path and increases support requests for basic setup. ADR-0080 proposes a tenant-scoped `onboarding_checklist` state model and a lightweight `GET/PATCH` API that reflects setup progress without altering existing endpoints.

The proposed solution adds a dismissible, read-mostly checklist to the tenant admin dashboard. It guides a `Tenant-Admin` through four core setup milestones — connect a source, build a watchlist, invite a user, and verify first posts — plus optional advanced steps. Completion is derived from existing data, so the checklist introduces no new workflow gates and no new permissions. The expected business value is faster time-to-value, lower support burden, and higher trial-to-paid conversion.

> **Note:** ADR-0080 is currently **Proposed** (not yet Accepted). This BRD is a draft for review and will be updated once the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce new-tenant time-to-first-post | Median time from tenant creation to first posts drops by 25% within 90 days of shipping |
| 2 | Lower setup-related support burden | Support tickets classified as "basic setup" decrease by 30% within 90 days |
| 3 | Improve trial-to-paid conversion | Trial-to-paid rate improves because users reach value faster |
| 4 | Maintain self-service experience | New tenants complete core setup without engineering or Platform-Admin involvement |

---

**Positive consequences (from ADR):**
1. **Faster activation:** new tenants have a clear, ordered path without leaving the admin UI.
2. **No new workflows:** the checklist uses existing endpoints and RLS.
3. **Dismissible:** users can hide the checklist and return later.
4. **Derivation cost:** reading the checklist requires a few small queries or a denormalized JSONB cache. The default is on-read derivation; caching can be added if it becomes expensive.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide `GET /v1/tenants/:id/onboarding-checklist` that returns the current checklist state | Must | Endpoint is tenant-scoped and returns `connect_source`, `build_watchlist`, `invite_user`, `verify_posts`, and `advanced_steps` statuses | Product Owner |
| BR-002 | The system shall provide `PATCH /v1/tenants/:id/onboarding-checklist` that lets a `Tenant-Admin` dismiss, reset, or hide/show advanced steps | Must | `Tenant-Admin` can set `dismissed_at`/`dismissed_by_user_id`, reset the checklist, and toggle advanced step visibility | Product Owner |
| BR-003 | The system shall derive completion of core steps from existing data | Must | `connect_source` checks `connector_activations`; `build_watchlist` checks `watchlists`; `invite_user` checks `users`; `verify_posts` checks `posts`; `enable_enrichment` checks enrichment runs; `configure_alerts` checks `alert_rules` | Product Owner |
| BR-004 | The admin dashboard shall display the checklist with step completion and deep links | Should | `OnboardingChecklist` component shows each step, completed status, and links to connectors, watchlists, invites, and post feed screens | Product Owner |
| BR-005 | The checklist shall be dismissible and resumable | Must | Dismissed state is persisted; user can reopen the checklist from a help menu or settings | Product Owner |
| BR-006 | The checklist shall not block any existing endpoint or feature | Must | All existing connector, watchlist, user, and post screens remain accessible even when the checklist is incomplete | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary user who completes setup | High | Clear, ordered steps with confirmation of success |
| Sole-Operator | Support / operations owner | High | Fewer setup support requests from new tenants |
| Tenant-User | End user of the listening data | Medium | Sees the tenant reach first posts faster |
| Platform-Admin | Cross-tenant visibility | Medium | Potential future metrics on onboarding completion |
| Product Owner | Feature owner | High | Measurable improvement in activation and support load |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.5 | epic-9-adr-0077-to-0085.md | As backend engineer, I want `tenants.onboarding_checklist` and the `GET/PATCH /v1/tenants/:id/onboarding-checklist` endpoints to track and dismiss setup prog... | `tenants` has an `onboarding_checklist` JSONB column with `connect_source`, `build_watchlist`, `invite_user`, `verify_posts`, and `advanced_steps`.; `GET /v1... |
| Story 9.6 | epic-9-adr-0077-to-0085.md | As new `Tenant-Admin`, I want a dismissible checklist in the admin dashboard that guides me through setup, so that I can get the tenant productive without su... | `OnboardingChecklist` component shows steps with completion status.; Each step deep-links to the relevant screen (connectors, watchlists, invites, post feed)... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.onboarding_checklist` | JSONB column storing step completion, advanced step visibility, and dismissal metadata | `tenants` table | Platform / Tenant | Tenant-scoped operational data |
| `connect_source.completed` | Boolean derived from active `connector_activations` rows | `connector_activations` | Product | Operational |
| `build_watchlist.completed` | Boolean derived from existence of `watchlists` rows | `watchlists` | Product | Operational |
| `invite_user.completed` | Boolean derived from existence of non-creator `users` rows | `users` | Product | Personal data (tenant membership) |
| `verify_posts.completed` | Boolean derived from `GET /v1/posts` returning rows | `posts` | Product | Operational |
| `enable_enrichment.completed` | Boolean derived from `sentiment` or `topic` enrichment runs on posts | post enrichment records | Product | Operational |
| `configure_alerts.completed` | Boolean derived from existence of `alert_rules` rows | `alert_rules` | Product | Operational |
| `dismissed_at` | Timestamp when the checklist was dismissed | User action via `PATCH` | Product | Operational |
| `dismissed_by_user_id` | ID of the user who dismissed the checklist | User action via `PATCH` | Product | Personal data (user ID) |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Core checklist steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) may not be marked complete manually via `PATCH`; completion is derived from existing data. |
| BRU-002 | Only `tenant_admin` can call `PATCH /v1/tenants/:id/onboarding-checklist`. |
| BRU-003 | `tenant_user` may call `GET /v1/tenants/:id/onboarding-checklist` but may not modify the state. |
| BRU-004 | Dismissal records the timestamp and the dismissing user's ID. |
| BRU-005 | Reset returns the checklist to its default pending state, clearing `dismissed_at` and `dismissed_by_user_id`. |
| BRU-006 | Advanced steps may be hidden or shown but their completion is also derived from existing data. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0051 connector activation endpoint | Existing | Backend | Available |
| D-002 | ADR-0044 watchlist API | Existing | Backend | Available |
| D-003 | ADR-0032 user invitation endpoint | Existing | Backend | Available |
| D-004 | ADR-0008 / ADR-0044 posts API and watchlist matching | Existing | Backend | Available |
| D-005 | Story 9.5 — Onboarding checklist state (backend) | Internal | Backend | TBD |
| D-006 | Story 9.6 — Onboarding checklist UI (frontend) | Internal | Frontend | TBD |

---

- The underlying connector activation, watchlist, user invitation, and post APIs are already available and working.
- A `Tenant-Admin` is the only persona that can modify the checklist state.
- `tenant_user` may view the checklist but cannot update it.
- On-read derivation is acceptable for v1; caching can be added later if performance requires it.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Onboarding checklist read completes within 500 ms at the 95th percentile | Performance | Should | Measured via API monitoring in staging and production |
| NFR-002 | Checklist access enforces existing tenant RLS and role checks | Security | Must | Only `tenant_admin` can `PATCH`; `tenant_user` can only `GET` for their own tenant |
| NFR-003 | Checklist UI is keyboard-navigable and announces progress to screen readers | Accessibility | Should | Verified by manual accessibility check |
| NFR-004 | Checklist state is stored in a tenant-scoped, JSONB column on `tenants` | Maintainability | Must | Schema change is backward-compatible and documented |

---

## 11. Error Handling and Exceptions
1. **Faster activation:** new tenants have a clear, ordered path without leaving the admin UI.
2. **No new workflows:** the checklist uses existing endpoints and RLS.
3. **Dismissible:** users can hide the checklist and return later.
4. **Derivation cost:** reading the checklist requires a few small queries or a denormalized JSONB cache. The default is on-read derivation; caching can be added if it becomes expensive.

---

## 12. Assumptions and Dependencies
- The underlying connector activation, watchlist, user invitation, and post APIs are already available and working.
- A `Tenant-Admin` is the only persona that can modify the checklist state.
- `tenant_user` may view the checklist but cannot update it.
- On-read derivation is acceptable for v1; caching can be added later if performance requires it.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | ADR-0080 is not accepted, requiring rework | Medium | Medium | Keep BRD and stories as draft; only commit implementation after ADR acceptance | Product Owner |
| R-002 | Deriving completion on every `GET` becomes expensive as tenants grow | Low | Medium | Default to on-read derivation; add caching or trigger-based refresh if profiling shows a need | Technical Lead |
| R-003 | Checklist is not discoverable and users dismiss it permanently | Medium | Medium | Provide a clearly labeled "Reopen" or "Help" menu entry and onboarding completion settings | Product Owner |
| R-004 | Existing data is inconsistent and shows incorrect completion | Low | High | Define completion rules clearly; reconcile on navigation return and surface manual refresh where needed | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0080-onboarding-checklist-state.md`
- BRD: `../Business-Requirements/BRD-0080-Onboarding-Checklist-State.md`
- Feature design: `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md``
- Deep research: `docs/product-research/reports/*-deep-research.md``
- User stories: see extracted stories above