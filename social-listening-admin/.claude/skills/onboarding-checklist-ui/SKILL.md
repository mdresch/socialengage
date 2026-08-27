---
name: onboarding-checklist-ui
<<<<<<< HEAD
description: Onboarding checklist UI component (Story 9.6, ADR-0080, BRD-0080, FDD-0080) — visual guide and progress tracking for new tenant admins in social-listening-admin. Read this before touching src/app/tenant/OnboardingChecklist.tsx or src/app/api/tenants/[id]/onboarding-checklist/.
---

# Onboarding Checklist UI (`OnboardingChecklist.tsx`)

## What this is

A dashboard guide component in `social-listening-admin` that reflects the 4 core onboarding steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) and optional advanced steps (`enable_enrichment`, `configure_alerts`).
=======
description: Frontend Onboarding Checklist UI (Story 9.6, ADR-0080) — guided progress tracker for new Tenant-Admins in the admin dashboard. Read this before modifying src/components/OnboardingChecklist.tsx, src/app/api/onboarding-checklist/route.ts, or the onboarding checklist methods in src/lib/core-client.ts.
---

# Onboarding Checklist UI (Frontend)

## What this is

The user-facing setup progress widget displayed in the tenant workspace overview dashboard ([src/app/tenant/page.tsx](file:///d:/Source/socialengage/social-listening-admin/src/app/tenant/page.tsx)). It consumes the backend checklist state from `GET /v1/tenants/:id/onboarding-checklist` (Story 9.5, ADR-0080), rendering step completion, progress percentage, deep-links to relevant configuration screens, dismiss/reopen controls, and toggleable advanced step visibility without blocking any existing user flows.
>>>>>>> origin/main

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
<<<<<<< HEAD
| ADR-0080 | Onboarding checklist state model & single-query reconciliation | 9.6 (frontend), 9.5 (backend) |
| BRD-0080 | Business requirements for self-service tenant onboarding | 9.6 |
| FDD-0080 | Functional design for checklist progress, deep-linking, and dismissal | 9.6 |

## Key Invariants

1. **Non-blocking Guide:** The checklist is purely advisory and dismissible; it never gates or restricts access to any feature.
2. **Deep-linking:** Each step links directly to the relevant management page (`/tenant/connectors`, `/tenant/watchlists`, `/tenant/users`, `/tenant/posts`).
3. **Persistent Dismissal:** Dismissal state is saved server-side via `PATCH /api/tenants/:id/onboarding-checklist`, with a trigger button available to reopen.
4. **Advanced Steps:** Advanced steps can be toggled without gating existing workflows.
=======
| ADR-0080 | Onboarding checklist state — JSONB on `tenants`, bundled `SELECT EXISTS` evaluation, one-way milestone caching, `GET`/`PATCH` API | 9.5 (backend) |
| ADR-0080 | Onboarding checklist UI — dismissible dashboard guide, deep-links, advanced step visibility | 9.6 (frontend) |
| ADR-0036 §2 | Bearer token attachment via `authenticatedCoreFetch()` in `core-client.ts` | 6.1 / 9.6 |
| ADR-0035 | Design system tokens and non-blocking dashboard cards | 6.2 / 9.6 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.6.onboarding-checklist-ui.contract.test.ts` — Verifies core step rendering, deep-link normalization, auto-check milestone reflection, dismiss/reopen flow, graceful empty/completed state handling, advanced steps visibility toggle, and role-based permissions (`tenant_admin` mutation vs `tenant_user` read-only).

## Key Files and Roles

- `src/components/OnboardingChecklist.tsx`: The interactive Client Component handling step lists, progress bar, dismiss/reopen triggers, and focus-based auto-refresh.
- `src/app/api/onboarding-checklist/route.ts`: BFF proxy route handler for same-origin client requests to core.
- `src/lib/core-client.ts`: `getOnboardingChecklist()` and `patchOnboardingChecklist()`.
- `src/app/tenant/page.tsx`: Server Component overview page fetching checklist data in parallel with other dashboard feeds and mounting `OnboardingChecklist`.

## Load-Bearing Invariants

1. **Non-blocking / Non-gating:** The checklist is a guide, not a gate. Users can navigate freely and all other pages/features remain fully usable regardless of checklist status.
2. **Sole Choke Point for Tokens:** `OnboardingChecklist.tsx` speaks to `/api/onboarding-checklist`, and the BFF route speaks to `core-client.ts` via `authenticatedCoreFetch()`. No bearer token or `CORE_API_BASE_URL` is ever exposed to the client.
3. **Role Gating:** Only `tenant_admin` callers can mutate dismissal status or advanced step visibility (`PATCH`). `tenant_user` can view progress in read-only mode.
4. **Milestone Re-check on Focus:** `window.addEventListener('focus', ...)` automatically refreshes state when the user completes a task in another tab or screen and returns.
>>>>>>> origin/main
