---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Self-service onboarding checklist

### What it is

A guided, step-by-step checklist in the tenant admin UI that helps a Tenant-Admin set up a new tenant without engineering support: connect the first source, build the first watchlist, add the first user, and verify that posts are flowing in.

### End-user benefits

- **Faster time-to-value:** new tenants can be productive in minutes instead of hours.
- **Reduced support burden:** the checklist surfaces required actions and common mistakes.
- **Confidence:** each step has clear validation and a green check when complete.
- **Self-sufficiency:** Tenant-Admins do not need the Platform-Admin or a manual for basic setup.

### Core details

- Steps: `Connect a source` (connector activation), `Build a watchlist` (boolean query), `Invite a user`, `Verify first posts`.
- Each step links to the relevant UI and shows completion status.
- The checklist is visible until the tenant finishes it, then collapses to a settings option.
- Optional advanced steps: enable AI enrichment, configure alerts, set up a dashboard.
- Progress is stored on `tenants.onboarding_checklist` or a dedicated table.

### Implementation complexity

**Low.** Mostly UI and state management. The heavy work is wiring it to existing connector, watchlist, user, and post APIs.

### Growth and reach

Directly improves activation and retention. Especially important for self-service sign-up and trial-to-paid conversion.

---

## Technical design

- **Data flow:** Tenant-Admin signs in → `GET /v1/tenants/:id/onboarding-checklist` returns current progress → each step is completed by calling existing endpoints (`POST /v1/connectors/:platformId/activate`, `POST /v1/watchlists`, etc.) → `onboardingChecklistStore` updates completion flags.
- **Component interactions:** `OnboardingChecklist` → existing connector, watchlist, user, post stores → `TenantAdminDashboard`.
- **REST/Service Bus contracts:** `GET /v1/tenants/:id/onboarding-checklist`, `PATCH /v1/tenants/:id/onboarding-checklist` (dismiss/reset). No events needed in v1.
- **Storage:** Add an `onboarding_checklist` JSONB column to `tenants` or a dedicated normalized table.
- **Security considerations:** Only `tenant_admin` can update the checklist. Progress is read-only for `tenant_user`.

## Backend principles

- **Progressive disclosure.** Show only the next 1–2 steps prominently; keep advanced steps collapsed.
- **Real validation.** A step is not "complete" until the underlying action has succeeded (e.g., connector health is healthy, watchlist returns posts).
- **Dismissible and resumable.** The user can dismiss the checklist and reopen it from settings.
- **No new permissions.** Uses existing RLS and tenant ownership.

## Frontend / UI principles

- **User flow:** admin lands on dashboard → sees the checklist at the top → clicks through each step → dashboard updates as steps complete.
- **Component hierarchy:** `OnboardingChecklist` → `ChecklistStep` → `ChecklistActionLink` → `ChecklistProgress`.
- **State management:** Local UI state plus server state for completion flags; refetch after each step.
- **Accessibility and responsive design:** Step list is keyboard-navigable; progress is announced to screen readers; mobile view stacks vertically.

## Open questions

- Should the checklist be mandatory, dismissible, or skippable per tenant?
- Should progress be tracked at the tenant level or the individual admin level?
- Should the checklist adapt based on the selected plan (e.g., skip advanced steps for free tiers)?
- What happens if a connector fails after the step was marked complete?
- Should the checklist include a video or contextual help panel?

## AI enhancements

- **Smart next step:** the AI recommends which source to connect first based on the tenant's stated use case.
- **Query suggestions:** the AI suggests a first watchlist query based on the tenant's domain or competitor names.
- **Troubleshooting:** the AI explains why a step is not completing and suggests fixes.

## Persona acceptance

- **Tenant-Admin (primary):** can complete basic tenant setup without leaving the admin UI or reading docs.
- **Sole-Operator (primary):** sees fewer support requests from new tenants because the checklist handles common setup issues.
- **Tenant-User (secondary):** benefits because the tenant reaches first posts faster.
- **Platform-Admin (secondary):** can see completion metrics across tenants.
