---
name: onboarding-checklist-ui
description: Onboarding checklist UI component (Story 9.6, ADR-0080, BRD-0080, FDD-0080) — dismissible dashboard guide and progress tracking for new tenant admins in social-listening-admin. Read this before touching src/app/tenant/OnboardingChecklist.tsx, src/app/api/tenants/[id]/onboarding-checklist/route.ts, or the onboarding checklist methods in src/lib/core-client.ts.
---

# Onboarding Checklist UI (`OnboardingChecklist.tsx`)

## What this is

The user-facing setup progress widget mounted on the tenant workspace overview dashboard (`src/app/tenant/page.tsx`), reflecting the 4 core onboarding steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) and optional advanced steps (`enable_enrichment`, `configure_alerts`). It consumes the backend checklist state from `GET /v1/tenants/:id/onboarding-checklist` (Story 9.5, ADR-0080), rendering step completion, progress percentage, deep-links to relevant configuration screens, and dismiss/reopen controls, without blocking any existing user flow.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0080 | Onboarding checklist state — JSONB on `tenants`, bundled `SELECT EXISTS` evaluation, one-way milestone caching, `GET`/`PATCH` API | 9.5 (backend) |
| ADR-0080 | Onboarding checklist UI — dismissible dashboard guide, deep-links, advanced step visibility | 9.6 (frontend) |
| BRD-0080 | Business requirements for self-service tenant onboarding | 9.6 |
| FDD-0080 | Functional design for checklist progress, deep-linking, and dismissal | 9.6 |
| ADR-0036 §2 | Bearer token attachment via `authenticatedCoreFetch()` in `core-client.ts` | 6.1 / 9.6 |
| ADR-0035 | Design system tokens and non-blocking dashboard cards | 6.2 / 9.6 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.6.onboarding-checklist-ui.contract.test.ts` — verifies core step rendering, deep-link normalization, auto-check milestone reflection, dismiss/reopen flow, graceful empty/completed state handling, advanced-step visibility toggle, and role-based permissions (`tenant_admin` mutation vs `tenant_user` read-only).

## Key Files and Roles

- `src/app/tenant/OnboardingChecklist.tsx`: the interactive Client Component handling step lists, progress bar, and dismiss/reopen triggers.
- `src/app/api/tenants/[id]/onboarding-checklist/route.ts`: BFF proxy route handler (`GET`/`PATCH`) for same-origin client requests, delegating to `core-client.ts`.
- `src/lib/core-client.ts`: `getOnboardingChecklist(tenantId)` and `patchOnboardingChecklist(tenantId, body)`, both routed through `authenticatedCoreFetch()`.
- `src/app/tenant/page.tsx`: Server Component overview page fetching checklist data in parallel with other dashboard feeds and mounting `OnboardingChecklist`.

## Key Invariants

1. **Non-blocking / Non-gating:** The checklist is purely advisory and dismissible; it never gates or restricts access to any feature, and all other pages remain fully usable regardless of checklist status.
2. **Deep-linking:** Each step links directly to the relevant management page (`/tenant/connectors`, `/tenant/watchlists`, `/tenant/users`, `/tenant/posts`).
3. **Persistent Dismissal:** Dismissal state is saved server-side via `PATCH /api/tenants/:id/onboarding-checklist`, with a trigger button available to reopen.
4. **Advanced Steps:** Advanced steps can be toggled without gating existing workflows.
5. **Sole Choke Point for Tokens:** `OnboardingChecklist.tsx` speaks only to `/api/tenants/:id/onboarding-checklist`; that BFF route speaks to `core-client.ts`, which alone calls `authenticatedCoreFetch()`. No bearer token or `CORE_API_BASE_URL` is ever exposed to the client.
6. **Role Gating:** Only `tenant_admin` callers can mutate dismissal status or advanced-step visibility (`PATCH`); `tenant_user` can view progress in read-only mode.

## Note on stale, orphaned files (found 2026-09-10, resolving a leftover unresolved merge conflict)

`c4021b3` ("feat(epic-9): complete remaining stories 9.6-9.11") relocated this component from `src/components/OnboardingChecklist.tsx` to `src/app/tenant/OnboardingChecklist.tsx`, and its BFF route from `src/app/api/onboarding-checklist/route.ts` to `src/app/api/tenants/[id]/onboarding-checklist/route.ts` — but a later merge (`6fe3b5d`, "Merge branch 'main' ... (Epic 9 completed)") never actually resolved the resulting conflict in this file; it committed raw `<<<<<<<`/`=======`/`>>>>>>>` markers describing both the old and new locations side by side, verbatim, straight to `main`. This pass resolves that conflict using the current, actually-imported code as the source of truth (confirmed by grep: `src/app/tenant/page.tsx` imports `./OnboardingChecklist`; nothing imports `src/components/OnboardingChecklist.tsx` or fetches `/api/onboarding-checklist` from any live call site).

The two old-path files — `src/components/OnboardingChecklist.tsx` and `src/app/api/onboarding-checklist/route.ts` — still exist on disk and are genuinely dead code (confirmed, not assumed), left over from before the move. Not deleted here — that's a separate cleanup decision, out of scope for a documentation-conflict fix — but flagged so it isn't silently rediscovered.
