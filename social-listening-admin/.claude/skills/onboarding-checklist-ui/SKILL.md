---
name: onboarding-checklist-ui
description: Frontend onboarding UI — the tenant-wide checklist (Story 9.6, ADR-0080) and role-tailored onboarding journeys with automated probes (Story 17.2, ADR-0130). Read this before modifying src/app/tenant/OnboardingChecklist.tsx, src/app/api/onboarding-checklist/route.ts, src/app/api/tenants/[id]/onboarding-checklist/route.ts, or the onboarding checklist methods in src/lib/core-client.ts.
---

# Onboarding Checklist UI (Frontend)

## What this is

The user-facing setup progress widget mounted in the tenant workspace overview dashboard (`src/app/tenant/page.tsx` → `src/app/tenant/OnboardingChecklist.tsx`). One Client Component serves two layered features:

1. **Tenant-wide checklist (Story 9.6, ADR-0080):** the 4 core steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) plus optional advanced steps (`enable_enrichment`, `configure_alerts`). Initial state is fetched server-side (`src/app/tenant/page.tsx` calls `getOnboardingChecklist()`) and passed down as a prop; dismiss/reopen and advanced-step visibility are mutated client-side via `PATCH /api/tenants/:id/onboarding-checklist`.
2. **Role-tailored journeys with automated probes (Story 17.2, ADR-0130):** role tabs for `admin`, `care_agent`, `social_seller`, `brand_manager`, each showing 3 persona-specific steps that complete only when a backend probe confirms real operational traffic. Fetched client-side per role-tab switch via `GET /api/onboarding-checklist?role=<role>`.

Both layers are non-blocking, dismissible guides — neither locks any existing user flow.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0080 | Onboarding checklist state — JSONB on `tenants`, bundled `SELECT EXISTS` evaluation, one-way milestone caching, `GET`/`PATCH` API | 9.5 (backend) |
| ADR-0080 | Onboarding checklist UI — dismissible dashboard guide, deep-links, advanced step visibility | 9.6 (frontend) |
| BRD-0080 | Business requirements for self-service tenant onboarding | 9.6 |
| FDD-0080 | Functional design for checklist progress, deep-linking, and dismissal | 9.6 |
| ADR-0130 | Onboarding checklist state refinements — role-tailored step trees, automated verification probes | 17.2 (frontend/backend) |
| ADR-0036 §2 | Authorization header attachment via `authenticatedCoreFetch()` in `core-client.ts` | 6.1 / 9.6 / 17.2 |
| ADR-0035 | Design system tokens and non-blocking dashboard cards | 6.2 / 9.6 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.6.onboarding-checklist-ui.contract.test.ts` — core step rendering, deep-link normalization, auto-check milestone reflection, dismiss/reopen flow, graceful empty/completed state handling, advanced steps visibility toggle, and role-based permissions (`tenant_admin` mutation vs `tenant_user` read-only).
- `contracts/epic-17/story-17.2.onboarding-journeys-ui.contract.test.ts` — `core-client.ts` exports `getRoleOnboardingChecklist()`, `RoleOnboardingStep`, `RoleJourneyResponse`, `OnboardingRoleKind`; `/api/onboarding-checklist/route.ts` accepts `?role=` and forwards to `getRoleOnboardingChecklist()`; role tabs/switcher for all 4 personas; steps render title, description, progress percentage, and action buttons; role-specific action URLs deep-link to real operational screens.

## Key Files and Roles

- `src/app/tenant/OnboardingChecklist.tsx`: the single live Client Component. Renders the tenant-wide checklist from its `initialChecklist` prop, and independently renders role-journey tabs that fetch per-role data client-side. Handles dismiss/reopen, advanced-step visibility, role-tab switching, and focus-based auto-refresh.
- `src/app/api/onboarding-checklist/route.ts`: BFF route. `GET` with `?role=` forwards to `getRoleOnboardingChecklist(role)` (Story 17.2); `GET` without `role` falls back to the tenant-wide `getOnboardingChecklist(tenantId)` (Story 9.6).
- `src/app/api/tenants/[id]/onboarding-checklist/route.ts`: BFF route for the tenant-wide checklist's `GET`/`PATCH` (dismiss/reopen/advanced-step visibility). `OnboardingChecklist.tsx` calls its `PATCH` directly client-side; the initial `GET` is instead done server-side in `page.tsx` via `core-client.ts` directly (this route's own `GET` handler exists for direct/refetch use but isn't the component's primary read path).
- `src/lib/core-client.ts`: `getOnboardingChecklist()` / `patchOnboardingChecklist()` (Story 9.5/9.6, call core directly at `/v1/tenants/:id/onboarding-checklist`) and `getRoleOnboardingChecklist()` (Story 17.2, calls core at `/v1/onboarding/checklist`).
- `src/app/tenant/page.tsx`: Server Component overview page fetching the tenant-wide checklist server-side in parallel with other dashboard feeds, and mounting `OnboardingChecklist`.

## Key Invariants

1. **Non-blocking / non-gating, both layers:** the checklist and the role journeys are guides, not gates. Users can navigate freely and all other pages/features remain fully usable regardless of either checklist's status.
2. **Sole choke point for tokens:** `OnboardingChecklist.tsx` never calls core directly — it goes through the two BFF routes above, and `core-client.ts`'s `authenticatedCoreFetch()` is the only place a bearer token is attached (ADR-0036 §2). No bearer token or `CORE_API_BASE_URL` is ever exposed to the client.
3. **Role gating differs between the two layers:** for the tenant-wide checklist, only `tenant_admin` callers can mutate dismissal status or advanced step visibility (`PATCH`); `tenant_user` views read-only. The Story 17.2 role-journey `GET` has no such restriction server-side — any authenticated tenant user can request any role's `?role=` tabs; there is no check tying the requested role to the caller's own role.
4. **Milestone re-check on focus:** `window.addEventListener('focus', ...)` automatically refreshes state when the user completes a task in another tab or screen and returns — applies to both the tenant-wide checklist and the active role-journey tab.
5. **Two independent step-ID vocabularies:** the 4 tenant-wide step IDs (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) and the 12 role-journey step IDs (3 per persona, defined in `social-listening-core`'s `roleOnboardingService.ts` `ROLE_STEP_TEMPLATES`) are unrelated namespaces. Don't assume a step `id` is unique across both when writing shared rendering logic.

## Known gaps / deferred work / orphaned code

- **`src/components/OnboardingChecklist.tsx` is dead code — do not edit it expecting it to render anywhere.** It's a duplicate component left over from an old `main` merge (`6fe3b5d`, "Epic 9 completed") that combined two independently-built onboarding UIs — `c4021b3` ("feat(epic-9): complete remaining stories 9.6-9.11") had relocated the component from `src/components/` to `src/app/tenant/` and its BFF route from `src/app/api/onboarding-checklist/route.ts` to `src/app/api/tenants/[id]/onboarding-checklist/route.ts`, but that merge never resolved the resulting conflict in this SKILL.md and committed raw `<<<<<<<`/`=======`/`>>>>>>>` markers straight to `main`. Confirmed via grep: nothing imports `components/OnboardingChecklist`; `src/app/tenant/OnboardingChecklist.tsx` is the only one wired into `page.tsx`. Not deleted as part of Story 17.2 (out of scope) — flagged here so it isn't mistaken for live code or edited by accident. (`src/app/api/onboarding-checklist/route.ts`, which the same relocation orphaned, is live *again* as of Story 17.2 — it now hosts the `?role=` journey read.)
- **This SKILL.md itself previously held unresolved `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main` conflict markers**, committed to `main` as-is since that same merge, and was stale on Story 17.2 entirely. Rewritten to describe the actual current, merged state of the code on disk (verified against real imports, not assumed).
- **No server-side check that a caller's `?role=` matches their own role** (see Load-Bearing Invariant 3) — any tenant member can view any persona's journey progress. Not named as a bug by any of Story 17.2's Acceptance Criteria (the story is about progress *visibility and verification*, not access restriction), but worth knowing if a future story tightens this.

## Relations to other components

- **`social-listening-core`'s `onboarding-checklist` skill** — the backend counterpart; `roleOnboardingService.ts` / `automatedVerificationProbeRunner.ts` / `onboardingRouter.ts` are what `getRoleOnboardingChecklist()` here calls into via `GET /v1/onboarding/checklist`.
- **`role-routing.ts` / `session.ts`** — `resolveCallerTenantUser()` in both BFF routes resolves the caller's tenant identity from the session cookie; a non-`tenant_user` identity gets `401` before either route touches core.
- **`src/components/ConnectorStatus.tsx`** — linked from the `connect_source` checklist step's deep-link; a user clicking that step is routed to `/tenant/connectors`.
- **`src/components/WatchlistManager.tsx`** — linked from the `build_watchlist` step deep-link (`/tenant/watchlists`).
