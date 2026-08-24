# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0080 Onboarding Checklist State — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-24 |
| Author(s) | FDD Writer Agent |
| Reviewer(s) | Menno (Business Sponsor, Product Owner, Technical Lead) |
| Status | Approved (2026-08-24) — Parent ADR-0080 Accepted |
| Related Documents | ADR-0080 (Onboarding checklist state), BRD-0080 (Onboarding Checklist State), `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md`, Story 9.5, Story 9.6, ADR-0051 (connector activation), ADR-0044 (watchlists), ADR-0032 (users/invites), ADR-0008 (posts API) |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0080 and BRD-0080 into a functional design for a tenant-scoped **onboarding checklist state model**: a lightweight, mostly-derived progress tracker that helps a `Tenant-Admin` complete initial tenant setup (connect a source, build a watchlist, invite a user, verify first posts) without introducing new workflow gates. Parent ADR-0080 was accepted on 2026-08-24.

### 2.2 Scope

- **In scope:**
  - The `tenants.onboarding_checklist` JSONB column and its structure (core steps, advanced steps, dismissal metadata).
  - `GET /v1/tenants/:id/onboarding-checklist` (read current state).
  - `PATCH /v1/tenants/:id/onboarding-checklist` (dismiss, reset, toggle advanced-step visibility only — never manual core-step completion).
  - Derivation logic that computes core/advanced step completion from existing `connector_activations`, `watchlists`, `users`, `posts`, enrichment, and `alert_rules` data.
  - The admin dashboard `OnboardingChecklist` UI component: steps, status, deep links, dismiss/reopen behavior.
- **Out of scope:**
  - Any change to the existing connector, watchlist, user-invitation, or post endpoints themselves.
  - Making the checklist mandatory or gating any existing endpoint or feature on checklist completion.
  - Manual completion of core steps by a user (completion is derived only, never settable).
  - Any new role/permission model — reuses existing RLS and tenant ownership.
  - New Service Bus events in v1.
  - AI-driven "smart next step" recommendations or query suggestions (noted as a future enhancement in the feature design).

### 2.3 Target Audience

Engineers implementing the `onboarding_checklist` column and its `GET`/`PATCH` endpoints, frontend engineers building the `OnboardingChecklist` dashboard component, QA writing contract tests for derivation logic and role gating, and product stakeholders tracking activation/support-burden metrics.

---

## 3. Context and Background

- **Problem:** New tenants must independently discover the connector, watchlist, user-invitation, and post-feed screens with no single view of what setup remains — causing stalled activation and repetitive "how do I finish setup" support requests (BRD-0080 §6).
- **Business/user value:** Faster time-to-first-post, lower setup-related support burden, and improved trial-to-paid conversion (BRD-0080 §3).
- **Source requirements:** ADR-0080, BRD-0080, feature design `19-self-service-onboarding-checklist.md`, Story 9.5 (backend), Story 9.6 (frontend) in `docs/user-stories/epic-9-adr-0077-to-0085.md`.
- **Constraints/dependencies:**
  - All underlying actions already exist: connector activation (ADR-0051), watchlist creation (ADR-0044), user invitation (ADR-0032), post verification (ADR-0008/ADR-0044/Story 6.11). The checklist is a read-mostly reflection layer over these, not a new workflow.
  - Must not gate or block any existing endpoint (BRD-0080 §4.4).
  - Must reuse existing RLS/tenant ownership — no new permission model.
  - ADR-0080 itself is Proposed; this design is provisional pending acceptance.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce new-tenant time-to-first-post | Median time from tenant creation to first posts drops measurably after shipping |
| G2 | Lower setup-related support burden | Fewer "basic setup" support tickets after shipping |
| G3 | Keep onboarding fully self-service and non-blocking | No existing connector/watchlist/user/post screen becomes inaccessible because the checklist is incomplete |
| G4 | Keep the checklist state trustworthy | Core step completion always reflects real underlying data, never a manually-set flag |
| G5 | Keep the feature dismissible and resumable | A dismissed checklist can always be reopened; dismissal never destroys progress state |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `GET /v1/tenants/:id/onboarding-checklist`

- **Description:** Returns the current onboarding checklist state for a tenant, with core-step and advanced-step completion computed from live underlying data.
- **Triggers:** The tenant admin dashboard loads; the `OnboardingChecklist` component mounts or is refreshed (e.g. on navigation return after completing a step).
- **Inputs:** Path parameter `:id` (tenant id); authenticated caller session (`tenant_admin` or `tenant_user`, scoped to that tenant).
- **Processing:**
  1. Authenticate and authorize the caller as a member (`tenant_admin` or `tenant_user`) of the requested tenant; reject cross-tenant reads via existing RLS.
  2. Read the `tenants.onboarding_checklist` JSONB column for stored dismissal/visibility metadata.
  3. Re-derive each core step's `completed`/`completed_at` on read (or from a cached/reconciled value — see 5.3) by checking the relevant underlying table:
     - `connect_source` — at least one active `connector_activations` row.
     - `build_watchlist` — at least one `watchlists` row.
     - `invite_user` — at least one `users` row other than the tenant creator.
     - `verify_posts` — `GET /v1/posts`-equivalent query returns at least one row.
     - `enable_enrichment` (advanced) — `sentiment` or `topic` enrichment has run on at least one post.
     - `configure_alerts` (advanced) — at least one `alert_rules` row exists.
  4. Merge derived completion with stored `dismissed_at`/`dismissed_by_user_id` and advanced-step visibility flags.
- **Outputs:** Current checklist state: `steps` (core, each with `completed`/`completed_at`), `advanced_steps` (same shape, plus visibility), `dismissed_at`, `dismissed_by_user_id`.
- **Error handling:** Cross-tenant or unauthenticated requests are rejected before any derivation runs; a tenant with no `onboarding_checklist` value (e.g., created before this feature) falls back to the documented default-pending structure rather than erroring (see Edge cases and Open Question Q4).
- **Edge cases:**
  - A step's underlying data exists but is later deleted (e.g., the only watchlist is removed) — completion is re-derived on the next `GET` and can revert from complete to incomplete, since it is a live reflection, not a one-way ratchet.
  - Tenant created before this feature shipped and has no `onboarding_checklist` value stored — treated as the default-pending JSONB shape (Open Question Q4 in ADR-0080).

### 5.2 Feature / Capability: `PATCH /v1/tenants/:id/onboarding-checklist`

- **Description:** Lets a `Tenant-Admin` dismiss the checklist, reset it to pending, or toggle advanced-step visibility — but never lets anyone manually mark a core (or advanced) step complete.
- **Triggers:** User clicks "dismiss," "reset," or an advanced-step visibility toggle in the `OnboardingChecklist` UI.
- **Inputs:** Path parameter `:id` (tenant id); one of: `{ action: 'dismiss' }`, `{ action: 'reset' }`, `{ action: 'set_advanced_visibility', step, visible }`; caller identity (`user_id`, role).
- **Processing:**
  1. Authorize the caller as `tenant_admin` for the target tenant; reject any `tenant_user` attempt (BRU-002).
  2. On `dismiss`: set `dismissed_at` to now and `dismissed_by_user_id` to the caller.
  3. On `reset`: clear `dismissed_at` and `dismissed_by_user_id`, returning the checklist to its default pending presentation (completion itself is still derived live, not reset, since it reflects real data).
  4. On advanced-step visibility toggle: update the stored `hidden`/`shown` flag for that advanced step only.
  5. Reject any request payload attempting to set a core (or advanced) step's `completed` value directly.
- **Outputs:** The updated `onboarding_checklist` state (same shape as `GET`).
- **Error handling:** Non-`tenant_admin` callers are rejected; attempts to directly set `completed` on any step are rejected as an invalid operation, not silently ignored.
- **Edge cases:** Dismissing an already-dismissed checklist is idempotent (updates the timestamp/user, does not error); resetting an already-pending checklist is likewise a no-op success.

### 5.3 Feature / Capability: Core/advanced step completion derivation

- **Description:** The rule set that turns existing tenant data into checklist completion flags, without introducing any new source-of-truth table for "is this step done."
- **Triggers:** Every `GET` (5.1), and optionally a background/trigger-based refresh if on-read derivation proves too expensive (ADR-0080 Consequences §4, Open Question).
- **Inputs:** `connector_activations`, `watchlists`, `users`, `posts`, enrichment records, `alert_rules` — all scoped to the tenant.
- **Processing:** Each step has a single, explicit boolean rule (listed in 5.1, step 3). No step is derived from more than one condition in v1; all are simple existence checks scoped to the tenant.
- **Outputs:** `completed: boolean` and `completed_at: timestamp | null` per step. `completed_at` reflects when the step was first observed complete (implementation may set it on the read that first observes completion, or via a reconciliation hook — left open per ADR-0080 Open Questions).
- **Error handling:** A failure to query one underlying table (e.g., transient DB error) should not silently mark that step complete or incomplete incorrectly — the read should fail loudly for that step rather than guess (design intent; exact retry/partial-failure behavior is an implementation detail not fixed by the ADR).
- **Edge cases:** A step becomes complete then its underlying data is removed (see 5.1 edge cases) — completion can revert since v1 has no one-way "ratchet" semantics; this is a deliberate simplicity trade-off, not a bug.

### 5.4 Feature / Capability: `OnboardingChecklist` dashboard UI

- **Description:** The `social-listening-admin` dashboard component that renders checklist state, links each incomplete step to the relevant existing screen, and offers dismiss/reopen controls.
- **Triggers:** Tenant admin dashboard load; return navigation after completing a step in another screen; explicit dismiss/reopen/advanced-toggle interaction.
- **Inputs:** Checklist state from `GET /v1/tenants/:id/onboarding-checklist`.
- **Processing:**
  1. Render core steps in order (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`), each showing completion status and, if incomplete, a deep link to the relevant existing screen (connector setup, watchlist builder, invite flow, post feed).
  2. Render advanced steps (`enable_enrichment`, `configure_alerts`) only when visible per the stored visibility flag.
  3. Re-fetch and re-render on navigation return so a just-completed step shows as checked without a manual refresh.
  4. Offer a dismiss control; once dismissed, the checklist collapses to a reopenable entry (e.g., in a help menu or settings), per feature design `19-self-service-onboarding-checklist.md`.
  5. Handle the fully-complete and fully-empty states gracefully (no broken layout either way).
- **Outputs:** Rendered checklist UI; navigation to existing screens; `PATCH` calls for dismiss/reset/visibility.
- **Error handling:** A failed `GET` shows a non-blocking error state in the checklist widget without breaking the rest of the dashboard.
- **Edge cases:** All core steps complete but the checklist has not been dismissed — UI still shows a fully-checked list (not auto-hidden) until the user dismisses it, consistent with "dismissible," not "auto-disappearing."

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Primary actor; completes setup steps, can dismiss/reset the checklist and toggle advanced-step visibility |
| Tenant-User | Secondary actor; can view (`GET`) checklist state but cannot modify it |
| Sole-Operator | Indirect beneficiary; support/operations role that benefits from fewer setup support requests |
| Platform-Admin | Indirect/future actor; potential future cross-tenant completion metrics (not in v1 scope) |
| Existing connector/watchlist/user/post services (system actors) | Source of truth for derived completion; not modified by this feature |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
|---|---|---|---|---|
| Story 9.5 | backend engineer | build `tenants.onboarding_checklist` and the `GET`/`PATCH /v1/tenants/:id/onboarding-checklist` endpoints to track and dismiss setup progress | new `Tenant-Admin`s can see what setup steps remain | JSONB column with `connect_source`/`build_watchlist`/`invite_user`/`verify_posts`/`advanced_steps`; `GET` is tenant-scoped; `PATCH` allows dismiss/reset for `Tenant-Admin` only; core steps derived from existing data; dismissed state persists and can be reopened; `PATCH` cannot manually mark core steps complete, only hide/show advanced steps |
| Story 9.6 | new Tenant-Admin | use a dismissible checklist in the admin dashboard that guides me through setup | I can get the tenant productive without support | `OnboardingChecklist` shows steps with completion status; each step deep-links to the relevant screen; completed steps auto-check on return; checklist can be dismissed/reopened from a help menu; empty/completed states handled gracefully; advanced steps can be shown/hidden without gating existing workflows |

Both stories are listed as **Blocked — pending ADR acceptance** as of this writing (Story 9.6 additionally depends on Story 9.5). Neither is Built.

### 6.3 Workflow Diagrams / Steps

**Primary workflow — new tenant completes onboarding:**

1. `Tenant-Admin` signs in and lands on the tenant admin dashboard.
2. Dashboard loads `OnboardingChecklist`, which calls `GET /v1/tenants/:id/onboarding-checklist` (5.1).
3. Backend authorizes the caller, derives core/advanced step completion from existing tables (5.3), merges with stored dismissal/visibility metadata, and returns the state.
4. UI renders steps in order; incomplete steps show a deep link to the relevant existing screen (5.4).
5. Admin clicks a step's deep link (e.g., "Connect a source") and completes the action using the existing connector activation screen/endpoint — no new logic is introduced here.
6. Admin navigates back to the dashboard; `OnboardingChecklist` re-fetches (`GET`), the derivation logic observes the new `connector_activations` row, and the step now shows complete.
7. Admin repeats for remaining core steps (watchlist, invite, verify posts) and optionally the advanced steps.
8. Once satisfied, admin dismisses the checklist via `PATCH` (`action: 'dismiss'`) (5.2); it collapses to a reopenable entry.
9. (Optional) Admin later reopens the checklist from a help menu, or calls `PATCH` (`action: 'reset'`) to clear the dismissal.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Existing `connector_activations`, `watchlists`, `users`, `posts`, post-enrichment records, and `alert_rules` data — all read-only inputs to derivation.
- `PATCH` request payloads for dismiss/reset/advanced-visibility actions.
- Authenticated caller identity and role for authorization.

### 7.2 Data Outputs

- The `onboarding_checklist` JSONB state returned by `GET`/`PATCH`.
- Updated `dismissed_at`/`dismissed_by_user_id`/advanced-step-visibility fields persisted back to `tenants.onboarding_checklist` on `PATCH`.
- No writes to any of the underlying source tables (`connector_activations`, `watchlists`, `users`, `posts`, `alert_rules`) — this feature only reads them.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `tenants.onboarding_checklist` (JSONB column on existing `tenants` table) | `steps.connect_source.completed` (bool), `steps.connect_source.completed_at` (timestamptz \| null), `steps.build_watchlist.{completed,completed_at}`, `steps.invite_user.{completed,completed_at}`, `steps.verify_posts.{completed,completed_at}`, `advanced_steps.enable_enrichment.{completed,completed_at}`, `advanced_steps.configure_alerts.{completed,completed_at}`, `dismissed_at` (timestamptz \| null), `dismissed_by_user_id` (uuid \| null) | Belongs to one `tenants` row; `dismissed_by_user_id` references `users`; core/advanced step completion is derived from, not owned by, `connector_activations`/`watchlists`/`users`/`posts`/enrichment/`alert_rules` |
| `connector_activations` (existing) | Used read-only to derive `connect_source` | Referenced by derivation logic only; not modified |
| `watchlists` (existing) | Used read-only to derive `build_watchlist` | Referenced by derivation logic only; not modified |
| `users` (existing) | Used read-only to derive `invite_user`; also the source of `dismissed_by_user_id` | Referenced by derivation logic only; not modified |
| `posts` (existing) | Used read-only to derive `verify_posts` | Referenced by derivation logic only; not modified |
| Enrichment records (existing) | Used read-only to derive `enable_enrichment` | Referenced by derivation logic only; not modified |
| `alert_rules` (existing) | Used read-only to derive `configure_alerts` | Referenced by derivation logic only; not modified |

### 7.4 Validation Rules

- `GET` requires the caller to be an authenticated member (`tenant_admin` or `tenant_user`) of the target tenant; cross-tenant reads are rejected by RLS.
- `PATCH` requires the caller to be `tenant_admin` for the target tenant; `tenant_user` calls are rejected.
- `PATCH` payloads must be one of the defined actions (`dismiss`, `reset`, advanced-visibility toggle); any payload attempting to set a step's `completed` value directly is rejected.
- The default `onboarding_checklist` JSONB shape (all steps `completed: false`, `completed_at: null`, `dismissed_at: null`, `dismissed_by_user_id: null`) must be well-formed and backward-compatible for tenants created before this column existed.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Core checklist steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) may not be marked complete manually via `PATCH`; completion is derived from existing data. | `PATCH` endpoint |
| BR2 | Only `tenant_admin` can call `PATCH /v1/tenants/:id/onboarding-checklist`. | Authorization |
| BR3 | `tenant_user` may call `GET /v1/tenants/:id/onboarding-checklist` but may not modify the state. | Authorization |
| BR4 | Dismissal records the timestamp and the dismissing user's ID. | Dismiss action |
| BR5 | Reset returns the checklist to its default pending presentation, clearing `dismissed_at` and `dismissed_by_user_id`. | Reset action |
| BR6 | Advanced steps may be hidden or shown but their completion is also derived from existing data, never set manually. | Advanced-step visibility |
| BR7 | The checklist must never block or gate any existing connector, watchlist, user, or post endpoint or screen. | Overall feature behavior |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `OnboardingChecklist` UI component (`social-listening-admin`) | Inbound to backend | Reads and updates checklist state | HTTPS REST, JSON (`GET`/`PATCH /v1/tenants/:id/onboarding-checklist`) |
| `connector_activations` table (ADR-0051) | Read-only, internal | Derives `connect_source` completion | Existing internal data access |
| `watchlists` table (ADR-0044) | Read-only, internal | Derives `build_watchlist` completion | Existing internal data access |
| `users` table (ADR-0032) | Read-only, internal | Derives `invite_user` completion and resolves `dismissed_by_user_id` | Existing internal data access |
| `posts` table / posts API (ADR-0008, ADR-0044, Story 6.11) | Read-only, internal | Derives `verify_posts` completion | Existing internal data access |
| Enrichment records (existing) | Read-only, internal | Derives `enable_enrichment` (advanced) completion | Existing internal data access |
| `alert_rules` table (existing) | Read-only, internal | Derives `configure_alerts` (advanced) completion | Existing internal data access |
| Existing connector/watchlist/invite/post-feed screens | Downstream, deep-linked | Destination of each incomplete step's action link | Existing UI navigation |

---

## 10. Non-Functional Considerations

- **Performance:** Checklist read should complete within 500 ms at the 95th percentile (BRD-0080 NFR-001); on-read derivation is the v1 default, with caching/trigger-based refresh available later if profiling shows a need.
- **Security / access control:** Reuses existing tenant RLS and role checks — only `tenant_admin` can `PATCH`; `tenant_user` can only `GET` for their own tenant (NFR-002).
- **Reliability / availability:** The checklist must never block or gate any existing workflow, even if the checklist itself is degraded or unavailable.
- **Accessibility:** The checklist UI is keyboard-navigable and announces progress to screen readers (NFR-003).
- **Maintainability:** State is stored in a single tenant-scoped JSONB column on `tenants`; the schema change is backward-compatible for existing tenants (NFR-004).
- **Data consistency:** Because completion is derived live rather than a persisted one-way flag, correctness depends on the underlying tables being queried consistently — no separate "denormalized fact" is allowed to drift from them.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Cross-tenant or unauthenticated `GET`/`PATCH` | Access denied (generic, consistent with rest of admin UI) | Rejected by RLS/authorization before derivation or mutation runs |
| `tenant_user` attempts `PATCH` | Access denied / insufficient permissions | Request rejected; only `tenant_admin` may mutate checklist state |
| `PATCH` payload attempts to directly set a step's `completed` value | Invalid request | Rejected as an invalid operation, not silently ignored or accepted |
| Tenant has no stored `onboarding_checklist` value (pre-existing tenant) | Checklist renders as all-pending | Backend falls back to the default pending JSONB shape rather than erroring |
| Underlying table query fails during derivation (e.g., transient DB error) | Non-blocking error state in the checklist widget | Backend does not guess a step's completion on partial failure; existing screens remain fully usable regardless |
| Checklist fully complete but not yet dismissed | Checklist shows all steps checked | UI does not auto-hide; user must explicitly dismiss |

---

## 12. Assumptions and Dependencies

- The connector activation, watchlist, user-invitation, and post APIs are already built and stable (ADR-0051, ADR-0044, ADR-0032, ADR-0008).
- A `Tenant-Admin` is the only persona that can modify checklist state; `tenant_user` is read-only.
- On-read derivation is acceptable for v1 performance; caching/trigger-based refresh is an optional future optimization, not a v1 requirement.
- **Pending decision:** ADR-0080 is Proposed, not Accepted — the column shape, endpoint contract, and derivation rules described here could still change before acceptance.
- **External dependency:** none beyond the existing internal connector/watchlist/user/post/enrichment/alert-rule data.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should completion be computed on every `GET`, or refreshed by a trigger/hook when the underlying tables change? | Engineering | Before/at ADR-0080 acceptance |
| Q2 | Should `Platform-Admin` see onboarding completion metrics across tenants? | Menno | Future iteration |
| Q3 | Should the checklist order or step names be configurable per tenant? | Product | Future iteration |
| Q4 | How does the checklist behave for tenants created before this ADR is implemented (no stored `onboarding_checklist` value)? | Engineering | Before/at ADR-0080 acceptance |
| Q5 | Should the checklist be mandatory, dismissible, or skippable per tenant, or is "always dismissible" final for v1? | Product | Before/at ADR-0080 acceptance |
| Q6 | Should the checklist adapt based on the tenant's selected plan (e.g., skip advanced steps for free tiers)? | Product | Future iteration |

---

## 14. Appendix

### Glossary

See BRD-0080 §15 for the shared glossary (`onboarding_checklist`, Core step, Advanced step, `tenant_admin`, `tenant_user`, Dismiss).

### Reference links

- ADR: `docs/adr/0080-onboarding-checklist-state.md` (Status: Proposed)
- BRD: `docs/project docs/Business-Requirements/BRD-0080-Onboarding-Checklist-State.md`
- Feature design: `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md`
- Related ADRs: `ADR-0051` (connector activation), `ADR-0044` (watchlists), `ADR-0032` (users/invites), `ADR-0008` (posts API)
- Related user stories: Story 9.5 (backend), Story 9.6 (frontend), both in `docs/user-stories/epic-9-adr-0077-to-0085.md`
- No `docs/product-research/reports/*-deep-research.md` file for the onboarding checklist feature was found (consistent with BRD-0080 §16 "Missing source"); no competitive/market deep-research brief is linked.

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | (prior batch run) | Initial defective draft (wrong H1 / flat BRD-style Section 5) |
| 0.2 | 2026-08-23 | FDD Writer Agent | Full regeneration: correct H1, per-capability Section 5, real Section 7.3 data model, workflow steps, sourced stories |
