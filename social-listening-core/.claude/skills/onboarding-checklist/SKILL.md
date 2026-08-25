---
name: onboarding-checklist
description: Tenant-scoped onboarding checklist state (Story 9.5, ADR-0080) — a mostly-derived progress tracker for new-tenant setup. Read this before touching src/tenants/onboardingChecklist.ts, src/http/versions/v1/onboardingChecklistRouter.ts, the tenants.onboarding_checklist JSONB column, or migration 0043.
---

# Onboarding Checklist State

## What this is

A tenant-scoped, mostly-derived progress tracker that helps a new `Tenant-Admin` complete initial tenant setup (connect a source, build a watchlist, invite a user, verify first posts). It lives as a single JSONB column (`tenants.onboarding_checklist`) on the existing `tenants` table, reconciled on every `GET` via a bundled `SELECT EXISTS` query with one-way JSONB milestone caching. Exposed via `GET`/`PATCH /v1/tenants/:id/onboarding-checklist`. It is a dismissible progress guide, never a mandatory gate — it does not block any existing endpoint.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0080 | Onboarding checklist state — JSONB column on `tenants`, bundled EXISTS derivation, one-way milestone locking, GET/PATCH API | 9.5 (backend) |
| ADR-0080 | Same — frontend `OnboardingChecklist` dashboard component | 9.6 (frontend, not yet built) |
| ADR-0030 §2 | Platform Admin zero-tenant-content boundary — `platform_admin` identity gets 403 on this route | 9.5 |
| ADR-0015 | RLS / `withTenant()` scoping — reads and writes go through `app_user`, never `platform_admin_role` | 9.5 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.5.onboarding-checklist-state.contract.test.ts` — 17 test cases covering AC1–AC6: default JSONB shape, GET role gating (tenant_admin/tenant_user 200, cross-tenant 404, missing-identity 401, platform_admin 403), per-step bundled-EXISTS derivation (connect_source, build_watchlist, invite_user, verify_posts), one-way milestone locking (build_watchlist stays complete after row delete), PATCH dismiss/reset/hidden-advanced-steps with tenant_admin-only authorization, and 400-rejection of any PATCH body attempting to set a core step's `completed` value.

## How to extend this safely

- **Adding a new core or advanced step:** add the step name to `CORE_STEP_NAMES`/`ADVANCED_STEP_NAMES` in `src/tenants/onboardingChecklist.ts`, add a `DERIVATION_SQL` fragment for it, add a deep link in `DEEP_LINKS`, and update the default JSONB shape in migration 0043's `DEFAULT` clause (a new migration is needed for existing tenants — `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT` only affects new rows). The contract test's AC1 default-shape assertion will need updating too.
- **Wiring `configure_alerts` to real data:** currently always `completed:false` because no `alert_rules` table exists yet (Story 9.3/ADR-0079 introduces it). Once that table exists, add a `DERIVATION_SQL` fragment for `configure_alerts` and remove it from the `Exclude<..., 'configure_alerts'>` type gymnastics. No ADR change needed — ADR-0080 Decision §2 already names `alert_rules` as the source.
- **Changing the PATCH request shape:** ADR-0080 Decision §3's literal `PatchOnboardingChecklistRequest` TypeScript interface is authoritative. FDD-0080 §5.2 describes a different `{ action: ... }` shape — per the project's ADR > FDD hierarchy, the ADR's shape is what's implemented. Changing the shape requires an ADR amendment, not just a code edit.

## Load-bearing constraints — do not change casually

- **One-way milestone locking:** once a step is `completed:true` in the JSONB, it is never re-checked or reverted. `evaluatePendingSteps` only queries steps that are still `completed:false`. Deleting an underlying row does NOT un-complete a step — this is ADR-0080 Decision §2's explicit "historical milestone integrity" invariant, proven by AC4.
- **Bundled single-query evaluation:** all pending steps are checked in one `SELECT EXISTS ... EXISTS ... EXISTS` query, not N round-trips. ADR-0080 Consequences §3 names `< 3ms` latency as a design target. Do not refactor into per-step queries.
- **PATCH never sets `steps` or `advanced_steps` completion:** `validatePatchBody` rejects any body key outside `{ dismissed, reset, hiddenAdvancedSteps }` with a 400. This is BR1/BR6 — core/advanced step completion is derived only, never manually settable. The only PATCH-writable state is dismissal metadata and advanced-step visibility.
- **`hidden_advanced_steps` is additive beyond ADR-0080's literal default JSON:** the ADR's Decision §1 default shape does not name where `hiddenAdvancedSteps` state persists. Migration 0043 adds `hidden_advanced_steps: []` to the default. This is the storage location — see the migration's own comment.
- **`invite_user` derivation excludes the caller:** `DERIVATION_SQL.invite_user` uses `id != $2` where `$2` is the calling user's own id. The ADR's own SQL parameterizes a second argument without naming what it represents; this resolves that ambiguity as "the calling user's own id" (the only value available without a schema change), not "the tenant's original creator."

## Known gaps / deferred work

- **`configure_alerts` is always `completed:false`** — no `alert_rules` table exists in this codebase yet (Story 9.3/ADR-0079 introduces it, not merged at the time of this story). Documented here rather than pulling Story 9.3's schema into this story's scope.
- **ADR-0080 Open-Questions auto-dismiss-for-pre-existing-tenants** ("existing active tenants... automatically set to `dismissed: true`") — not named by any of Story 9.5's own six Acceptance Criteria, and would require an arbitrary time-based "existed before this shipped" heuristic the ADR never specifies. A brand-new tenant that completes all core steps shows a fully-checked, still-dismissible (not auto-dismissed) checklist, matching FDD-0080 §5.4's own edge case.
- **Story 9.6 (frontend `OnboardingChecklist` UI)** — a separate, dependent story, not yet built.

## Relations to other components

- **`tenants` table / `tenantStore.ts`** — `onboarding_checklist` is a column on `tenants`; reads and writes go through `withTenant()` (RLS-scoped `app_user`), the same path as `getOwnTenant()`. Migration 0043 grants `app_user` a column-scoped `UPDATE (onboarding_checklist)` privilege, matching migration 0017's own `active_seat_count` precedent.
- **`connectorActivationStore.ts`** — read-only input to `connect_source` derivation (`connector_activations` where `is_active = true`).
- **`watchlistStore.ts`** — read-only input to `build_watchlist` derivation (`watchlists`).
- **`identityResolution.ts` / `users` table** — read-only input to `invite_user` derivation (`users` other than caller); also the source of `dismissed_by_user_id`.
- **`social_posts` table** — read-only input to `verify_posts` derivation and `enable_enrichment` advanced-step derivation (`enrichment IS NOT NULL`).
- **`requireTenantUser.ts`** — the router uses `requireTenantUserIdentity()` for caller authorization; `platform_admin` identities are rejected 403 by that helper before the handler runs.
