# Business Requirements Document — Onboarding Checklist State

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Onboarding Checklist State — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft for review — parent ADR-0080 is Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0080, feature design, and Epic 9 stories |

---

## 2. Executive Summary

New SocialEngage tenants currently complete setup by navigating independently through connector, watchlist, user, and post screens. This leaves trial users without a clear activation path and increases support requests for basic setup. ADR-0080 proposes a tenant-scoped `onboarding_checklist` state model and a lightweight `GET/PATCH` API that reflects setup progress without altering existing endpoints.

The proposed solution adds a dismissible, read-mostly checklist to the tenant admin dashboard. It guides a `Tenant-Admin` through four core setup milestones — connect a source, build a watchlist, invite a user, and verify first posts — plus optional advanced steps. Completion is derived from existing data, so the checklist introduces no new workflow gates and no new permissions. The expected business value is faster time-to-value, lower support burden, and higher trial-to-paid conversion.

> **Note:** ADR-0080 is currently **Proposed** (not yet Accepted). This BRD is a draft for review and will be updated once the ADR is accepted.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce new-tenant time-to-first-post | Median time from tenant creation to first posts drops by 25% within 90 days of shipping |
| 2 | Lower setup-related support burden | Support tickets classified as "basic setup" decrease by 30% within 90 days |
| 3 | Improve trial-to-paid conversion | Trial-to-paid rate improves because users reach value faster |
| 4 | Maintain self-service experience | New tenants complete core setup without engineering or Platform-Admin involvement |

---

## 4. Scope

### 4.1 In Scope

- Adding a tenant-scoped `onboarding_checklist` JSONB column to the `tenants` table.
- `GET /v1/tenants/:id/onboarding-checklist` returning current completion state (readable by `tenant_admin` and `tenant_user`).
- `PATCH /v1/tenants/:id/onboarding-checklist` allowing a `Tenant-Admin` to:
  - Dismiss the checklist.
  - Reset the checklist to pending.
  - Mark advanced steps as hidden or shown.
- Deriving completion of core steps from existing `connector_activations`, `watchlists`, `users`, `posts`, enrichment runs, and `alert_rules` data.
- Admin dashboard `OnboardingChecklist` component that displays steps, completion status, and deep links to existing screens.
- Dismissible and resumable checklist behavior with progress re-evaluated on navigation return.

### 4.2 Out of Scope

- Modifying the existing connector, watchlist, user invitation, or post endpoints.
- Requiring the checklist before any other product feature can be used.
- Manual completion of core steps by a user; completion is derived only.
- New role or permission model; the feature reuses existing RLS.
- New Service Bus events in v1.
- AI-driven smart next-step recommendations or query suggestions.

### 4.3 Assumptions

- The underlying connector activation, watchlist, user invitation, and post APIs are already available and working.
- A `Tenant-Admin` is the only persona that can modify the checklist state.
- `tenant_user` may view the checklist but cannot update it.
- On-read derivation is acceptable for v1; caching can be added later if performance requires it.

### 4.4 Constraints

- The solution must not break or gate existing workflows.
- Storage must remain within the existing Postgres tenant-scoped model.
- Security must reuse existing RLS and tenant ownership checks.
- The UI must remain keyboard-navigable and accessible.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary user who completes setup | High | Clear, ordered steps with confirmation of success |
| Sole-Operator | Support / operations owner | High | Fewer setup support requests from new tenants |
| Tenant-User | End user of the listening data | Medium | Sees the tenant reach first posts faster |
| Platform-Admin | Cross-tenant visibility | Medium | Potential future metrics on onboarding completion |
| Product Owner | Feature owner | High | Measurable improvement in activation and support load |

---

## 6. Current State (As-Is)

**Current process:**

1. A new tenant is created.
2. The `Tenant-Admin` must independently discover and use the connector, watchlist, user invitation, and post feed screens.
3. There is no single view showing which setup steps remain.
4. The admin may not know whether posts are flowing or whether a step is fully successful.

**Pain points:**

- New tenants can become stuck before reaching first value.
- Support handles repetitive "how do I finish setup" questions.
- Trial users may churn because the path to first posts is unclear.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A `Tenant-Admin` lands on the tenant admin dashboard.
2. A dismissible `OnboardingChecklist` appears at the top.
3. The checklist lists steps in order: connect a source, build a watchlist, invite a user, verify first posts, plus optional advanced steps.
4. Each incomplete step is a deep link to the relevant existing screen.
5. As the admin completes actions in the existing UI, `GET /v1/tenants/:id/onboarding-checklist` re-evaluates and updates completion.
6. The admin can dismiss the checklist and reopen it later from a help menu.

**Expected capabilities:**

- A single backend endpoint that returns current onboarding progress.
- Automatic derivation of core step completion from existing tables.
- A `PATCH` endpoint for dismissal, reset, and advanced-step visibility.
- A dashboard checklist UI with status, deep links, and accessibility support.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide `GET /v1/tenants/:id/onboarding-checklist` that returns the current checklist state | Must | Endpoint is tenant-scoped and returns `connect_source`, `build_watchlist`, `invite_user`, `verify_posts`, and `advanced_steps` statuses | Product Owner |
| BR-002 | The system shall provide `PATCH /v1/tenants/:id/onboarding-checklist` that lets a `Tenant-Admin` dismiss, reset, or hide/show advanced steps | Must | `Tenant-Admin` can set `dismissed_at`/`dismissed_by_user_id`, reset the checklist, and toggle advanced step visibility | Product Owner |
| BR-003 | The system shall derive completion of core steps from existing data | Must | `connect_source` checks `connector_activations`; `build_watchlist` checks `watchlists`; `invite_user` checks `users`; `verify_posts` checks `posts`; `enable_enrichment` checks enrichment runs; `configure_alerts` checks `alert_rules` | Product Owner |
| BR-004 | The admin dashboard shall display the checklist with step completion and deep links | Should | `OnboardingChecklist` component shows each step, completed status, and links to connectors, watchlists, invites, and post feed screens | Product Owner |
| BR-005 | The checklist shall be dismissible and resumable | Must | Dismissed state is persisted; user can reopen the checklist from a help menu or settings | Product Owner |
| BR-006 | The checklist shall not block any existing endpoint or feature | Must | All existing connector, watchlist, user, and post screens remain accessible even when the checklist is incomplete | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Onboarding checklist read completes within 500 ms at the 95th percentile | Performance | Should | Measured via API monitoring in staging and production |
| NFR-002 | Checklist access enforces existing tenant RLS and role checks | Security | Must | Only `tenant_admin` can `PATCH`; `tenant_user` can only `GET` for their own tenant |
| NFR-003 | Checklist UI is keyboard-navigable and announces progress to screen readers | Accessibility | Should | Verified by manual accessibility check |
| NFR-004 | Checklist state is stored in a tenant-scoped, JSONB column on `tenants` | Maintainability | Must | Schema change is backward-compatible and documented |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Core checklist steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) may not be marked complete manually via `PATCH`; completion is derived from existing data. |
| BRU-002 | Only `tenant_admin` can call `PATCH /v1/tenants/:id/onboarding-checklist`. |
| BRU-003 | `tenant_user` may call `GET /v1/tenants/:id/onboarding-checklist` but may not modify the state. |
| BRU-004 | Dismissal records the timestamp and the dismissing user's ID. |
| BRU-005 | Reset returns the checklist to its default pending state, clearing `dismissed_at` and `dismissed_by_user_id`. |
| BRU-006 | Advanced steps may be hidden or shown but their completion is also derived from existing data. |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Onboarding completion rate | Track how many new tenants complete all core steps | Product team | Weekly |
| Step-level drop-off | Identify which checklist step users abandon | Product team | Weekly |
| Time-to-first-post | Measure activation speed | Product team | Weekly |
| Dismissal / reopen rate | Understand checklist engagement | Product team | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | ADR-0080 is not accepted, requiring rework | Medium | Medium | Keep BRD and stories as draft; only commit implementation after ADR acceptance | Product Owner |
| R-002 | Deriving completion on every `GET` becomes expensive as tenants grow | Low | Medium | Default to on-read derivation; add caching or trigger-based refresh if profiling shows a need | Technical Lead |
| R-003 | Checklist is not discoverable and users dismiss it permanently | Medium | Medium | Provide a clearly labeled "Reopen" or "Help" menu entry and onboarding completion settings | Product Owner |
| R-004 | Existing data is inconsistent and shows incorrect completion | Low | High | Define completion rules clearly; reconcile on navigation return and surface manual refresh where needed | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0051 connector activation endpoint | Existing | Backend | Available |
| D-002 | ADR-0044 watchlist API | Existing | Backend | Available |
| D-003 | ADR-0032 user invitation endpoint | Existing | Backend | Available |
| D-004 | ADR-0008 / ADR-0044 posts API and watchlist matching | Existing | Backend | Available |
| D-005 | Story 9.5 — Onboarding checklist state (backend) | Internal | Backend | TBD |
| D-006 | Story 9.6 — Onboarding checklist UI (frontend) | Internal | Frontend | TBD |

---

## 14. Acceptance Criteria

- `GET /v1/tenants/:id/onboarding-checklist` returns the checklist state for the authenticated tenant user or admin.
- `PATCH` is restricted to `tenant_admin` and supports dismiss, reset, and advanced step visibility.
- Core step completion is derived from the underlying connector, watchlist, user, post, enrichment, and alert data.
- The checklist does not block any existing endpoint or product feature.
- The UI checklist displays steps, completion status, and deep links to the correct existing screens.
- The checklist can be dismissed and reopened.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `onboarding_checklist` | A tenant-scoped JSONB state structure that tracks setup progress and dismissal. |
| Core step | A mandatory setup step: connect source, build watchlist, invite user, verify posts. |
| Advanced step | An optional setup step: enable enrichment, configure alerts. |
| `tenant_admin` | The administrator of a tenant who can modify tenant settings and the checklist state. |
| `tenant_user` | A member of a tenant with read-only access to the checklist. |
| Dismiss | Hiding the checklist from the dashboard while preserving the ability to reopen it. |

---

## 16. Appendices

### Reference documents

- `docs/adr/0080-onboarding-checklist-state.md` — source ADR (Proposed)
- `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md` — feature design
- `docs/product-research/feature-adr-scoping.md` — related scoping document
- `docs/user-stories/epic-9-adr-0077-to-0085.md` — Epic 9 user stories

### Related user stories

- **Story 9.5 — Onboarding checklist state (backend):** As a backend engineer, I want `tenants.onboarding_checklist` and the `GET/PATCH /v1/tenants/:id/onboarding-checklist` endpoints to track and dismiss setup progress, so that new `Tenant-Admin`s can see what setup steps remain. Acceptance criteria include the JSONB column, the `GET` endpoint, `PATCH` for dismiss/reset, core step derivation, and persisted dismissed state.
- **Story 9.6 — Onboarding checklist UI (frontend):** As a new `Tenant-Admin`, I want a dismissible checklist in the admin dashboard that guides me through setup, so that I can get the tenant productive without support. Acceptance criteria include the `OnboardingChecklist` component, deep links, automatic completion on return, and dismiss/reopen behavior.

### Missing source

- No `docs/product-research/reports/*-deep-research.md` file for the onboarding checklist feature was found. When a deep-research brief is produced, it should be linked here.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
