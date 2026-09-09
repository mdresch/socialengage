---
name: onboarding-checklist-ui
description: Frontend Onboarding Checklist UI (Story 9.6, ADR-0080) — guided progress tracker for new Tenant-Admins in the admin dashboard. Read this before modifying src/components/OnboardingChecklist.tsx, src/app/api/onboarding-checklist/route.ts, or the onboarding checklist methods in src/lib/core-client.ts.
---

# Onboarding Checklist UI (Frontend)

## What this is

The user-facing setup progress widget displayed in the tenant workspace overview dashboard (`src/app/tenant/page.tsx`). It consumes the backend checklist state from `GET /v1/tenants/:id/onboarding-checklist` (Story 9.5, ADR-0080), rendering step completion, progress percentage, deep-links to relevant configuration screens, dismiss/reopen controls, and toggleable advanced step visibility without blocking any existing user flows.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
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

## Relations to other components

- **`src/app/api/onboarding-checklist/route.ts`** — BFF proxy that proxies GET/PATCH requests to `GET /v1/tenants/:id/onboarding-checklist` and `PATCH /v1/tenants/:id/onboarding-checklist` on core; attaches the session bearer token via `authenticatedCoreFetch()` (ADR-0036 §2).
- **`src/lib/core-client.ts`** — `getOnboardingChecklist()` and `patchOnboardingChecklist()` are the typed wrappers for the two endpoints; this is the only caller.
- **`src/app/tenant/page.tsx`** — mounts `<OnboardingChecklist>` as a non-blocking widget alongside the post feed and other dashboard cards; checklist data is fetched in parallel on the server side.
- **`social-listening-core` onboarding-checklist skill** — the backend counterpart (Story 9.5); governs the JSONB schema, `SELECT EXISTS` derivation, one-way milestone caching, and the `GET`/`PATCH` REST surface this component consumes.
- **`src/components/ConnectorStatus.tsx`** (connector status view, Story 6.5) — linked from the `connect_source` checklist step's deep-link; a user clicking that step is routed to `/tenant/connectors`.
- **`src/components/WatchlistManager.tsx`** (watchlist UI, Story 6.4) — linked from the `build_watchlist` step deep-link (`/tenant/watchlists`).
