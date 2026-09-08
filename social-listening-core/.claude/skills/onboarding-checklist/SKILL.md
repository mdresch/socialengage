---
name: onboarding-checklist
description: Tenant-scoped onboarding checklist state (Story 9.5, ADR-0080) and role-tailored onboarding journeys with automated probes (Story 17.2, ADR-0130). Read this before touching src/tenants/onboardingChecklist.ts, src/http/versions/v1/onboardingChecklistRouter.ts, src/onboarding/roleOnboardingService.ts, src/onboarding/automatedVerificationProbeRunner.ts, src/http/versions/v1/onboardingRouter.ts, the tenants.onboarding_checklist JSONB column, migration 0043, the tenant_onboarding_state table, or migration 0081.
---

# Onboarding Checklist State

## What this is

Two layered features sharing one problem space — helping a tenant get productive and letting the system detect that objectively:

1. **Tenant-wide checklist (Story 9.5/9.6, ADR-0080):** a mostly-derived progress tracker that helps a new `Tenant-Admin` complete initial tenant setup (connect a source, build a watchlist, invite a user, verify first posts). Lives as a single JSONB column (`tenants.onboarding_checklist`) on the existing `tenants` table, reconciled on every `GET` via a bundled `SELECT EXISTS` query with one-way JSONB milestone caching. Exposed via `GET`/`PATCH /v1/tenants/:id/onboarding-checklist`.
2. **Role-tailored journeys with automated probes (Story 17.2, ADR-0130):** four persona-specific step trees (`admin`, `care_agent`, `social_seller`, `brand_manager`; 3 steps each) stored in a dedicated `tenant_onboarding_state.role_journeys` JSONB column, completed only when a synthetic background probe (`AutomatedVerificationProbeRunner`) confirms real operational traffic (an actual ingestion run, a real watchlist match, a dispatched reply, a completed CRM handoff) rather than superficial entity creation. Exposed via `GET /v1/onboarding/checklist?role=<role>`.

Both are dismissible/non-blocking progress guides, never mandatory gates — neither blocks any existing endpoint.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0080 | Onboarding checklist state — JSONB column on `tenants`, bundled EXISTS derivation, one-way milestone locking, GET/PATCH API | 9.5 (backend) |
| ADR-0080 | Same — frontend `OnboardingChecklist` dashboard component | 9.6 (frontend) |
| ADR-0130 | Onboarding checklist state refinements — role-tailored step trees and automated verification probes (`tenant_onboarding_state.role_journeys`) | 17.2 (frontend/backend) |
| ADR-0030 §2 | Platform Admin zero-tenant-content boundary — `platform_admin` identity gets 403 on this route | 9.5 / 17.2 |
| ADR-0015 | RLS / `withTenant()` scoping — reads and writes go through `app_user`, never `platform_admin_role` | 9.5 / 17.2 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.5.onboarding-checklist-state.contract.test.ts` — 17 test cases covering AC1–AC6 for the tenant-wide checklist.
- `contracts/epic-17/story-17.2.onboarding-probes.contract.test.ts` — 7 test cases covering AC1–AC7: role-tailored step trees (`admin`, `care_agent`, `social_seller`, `brand_manager`), synthetic probes (`traffic_probe`, `query_match_probe`, `triage_probe`, `crm_push_probe`), milestone persistence in `tenant_onboarding_state.role_journeys`, probe short-circuiting, and role alias normalization.

## How to extend this safely

- **Adding a new core or advanced step (tenant-wide checklist):** add the step name to `CORE_STEP_NAMES`/`ADVANCED_STEP_NAMES` in `src/tenants/onboardingChecklist.ts`, add a `DERIVATION_SQL` fragment for it, add a deep link in `DEEP_LINKS`, and update the default JSONB shape in migration 0043's `DEFAULT` clause (a new migration is needed for existing tenants — `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT` only affects new rows). The contract test's AC1 default-shape assertion will need updating too.
- **Wiring `configure_alerts` to real data:** currently always `completed:false` because no `alert_rules` table exists yet (Story 9.3/ADR-0079 introduces it). Once that table exists, add a `DERIVATION_SQL` fragment for `configure_alerts` and remove it from the `Exclude<..., 'configure_alerts'>` type gymnastics. No ADR change needed — ADR-0080 Decision §2 already names `alert_rules` as the source.
- **Changing the PATCH request shape:** ADR-0080 Decision §3's literal `PatchOnboardingChecklistRequest` TypeScript interface is authoritative. FDD-0080 §5.2 describes a different `{ action: ... }` shape — per the project's ADR > FDD hierarchy, the ADR's shape is what's implemented. Changing the shape requires an ADR amendment, not just a code edit.
- **Adding a new role-journey step or persona (role-tailored journeys):** add the step template to `ROLE_STEP_TEMPLATES[role]` in `src/onboarding/roleOnboardingService.ts` (needs `id`, `title`, `description`, `probeKey`, `actionUrl`, `actionLabel`), then add a matching `EXISTS(...)` clause keyed to that `probeKey` in `AutomatedVerificationProbeRunner.runProbes()`'s single bundled query. A new persona also needs a default entry in `roleJourneys` (both the migration's JSONB `DEFAULT` and `getRoleOnboardingChecklist()`'s in-code fallback) and a `normalizeRole()` alias branch.
- **Adding a new probe:** every probe is one more column in the single bundled `SELECT ... EXISTS(...) AS x, EXISTS(...) AS y ...` query in `automatedVerificationProbeRunner.ts` — do not add a second round-trip query per probe (same bundled-query discipline as the tenant-wide checklist's `DERIVATION_SQL`, see Load-bearing constraints below).

## Load-bearing constraints — do not change casually

- **One-way milestone locking:** once a step is `completed:true` in the JSONB, it is never re-checked or reverted. `evaluatePendingSteps` only queries steps that are still `completed:false`. Deleting an underlying row does NOT un-complete a step — this is ADR-0080 Decision §2's explicit "historical milestone integrity" invariant, proven by AC4.
- **Bundled single-query evaluation:** all pending steps are checked in one `SELECT EXISTS ... EXISTS ... EXISTS` query, not N round-trips. ADR-0080 Consequences §3 names `< 3ms` latency as a design target. Do not refactor into per-step queries.
- **PATCH never sets `steps` or `advanced_steps` completion:** `validatePatchBody` rejects any body key outside `{ dismissed, reset, hiddenAdvancedSteps }` with a 400. This is BR1/BR6 — core/advanced step completion is derived only, never manually settable. The only PATCH-writable state is dismissal metadata and advanced-step visibility.
- **`hidden_advanced_steps` is additive beyond ADR-0080's literal default JSON:** the ADR's Decision §1 default shape does not name where `hiddenAdvancedSteps` state persists. Migration 0043 adds `hidden_advanced_steps: []` to the default. This is the storage location — see the migration's own comment.
- **`invite_user` derivation excludes the caller:** `DERIVATION_SQL.invite_user` uses `id != $2` where `$2` is the calling user's own id. The ADR's own SQL parameterizes a second argument without naming what it represents; this resolves that ambiguity as "the calling user's own id" (the only value available without a schema change), not "the tenant's original creator."
- **Role-journey steps are one-way-locked too, per probe:** `getRoleOnboardingChecklist()` only evaluates a role step's probe if that step isn't already `completed:true` in stored `role_journeys`; once true it's never re-checked. Same "historical milestone integrity" invariant as the tenant-wide checklist (AC6, proven by deleting the seeding row after completion and confirming the step stays `true`), independently implemented — do not assume touching one checklist's locking logic touches the other's.
- **Probes are one bundled query, not twelve:** `AutomatedVerificationProbeRunner.runProbes()` evaluates all 12 `probeKey`s (3 steps × 4 personas) in a single `SELECT ... EXISTS(...)...` round-trip regardless of which role was requested — mirrors the tenant-wide checklist's bundled-query discipline (ADR-0080 Consequences §3's `<3ms` target). Do not split into per-role or per-step queries.
- **`tenant_onboarding_state` is a separate table from `tenants.onboarding_checklist`**, not a rename or an added column — migration 0081 creates it fresh with its own RLS policy (`tenant_isolation`), independent of migration 0043's grant on `tenants`. The two checklists' storage is fully decoupled even though both render in the same admin dashboard.

## Known gaps / deferred work

- **`configure_alerts` is always `completed:false`** — no `alert_rules` table exists in this codebase yet (Story 9.3/ADR-0079 introduces it, not merged at the time of this story). Documented here rather than pulling Story 9.3's schema into this story's scope.
- **ADR-0080 Open-Questions auto-dismiss-for-pre-existing-tenants** ("existing active tenants... automatically set to `dismissed: true`") — not named by any of Story 9.5's own six Acceptance Criteria, and would require an arbitrary time-based "existed before this shipped" heuristic the ADR never specifies. A brand-new tenant that completes all core steps shows a fully-checked, still-dismissible (not auto-dismissed) checklist, matching FDD-0080 §5.4's own edge case.
- **`invite_probe`, `list_probe`, `catalog_probe`, `inbox_probe`, `ticket_probe`, `crisis_probe`, `digest_probe`, and `anomaly_probe`** (the admin/care_agent/social_seller/brand_manager steps other than the 4 named in Story 17.2's AC2–AC5) are existence checks against already-shipped tables (`users`, `prospecting_lists`, `authors`, `social_posts`, `watchlists`), not new schema — they were not individually named as probes in ADR-0130's terse text but are needed to complete all 4 role trees per Story 17.2 AC1, and are covered indirectly by AC1's step-shape assertions rather than a dedicated per-probe AC.
- **ADR-0130 and its BRD-0130/FDD-0130 companions are terse stubs**, not fully elaborated specs — the authoritative detail for this feature lives in Story 17.2's Acceptance Criteria in `docs/user-stories/epic-17-adr-0129-to-0133.md`, not in the ADR/BRD/FDD prose. Treat the Story's AC list as the real contract source when the ADR text runs out.

## Relations to other components

- **`tenants` table / `tenantStore.ts`** — `onboarding_checklist` is a column on `tenants`; reads and writes go through `withTenant()` (RLS-scoped `app_user`), the same path as `getOwnTenant()`. Migration 0043 grants `app_user` a column-scoped `UPDATE (onboarding_checklist)` privilege, matching migration 0017's own `active_seat_count` precedent.
- **`connectorActivationStore.ts`** — read-only input to `connect_source` derivation (`connector_activations` where `is_active = true`).
- **`watchlistStore.ts`** — read-only input to `build_watchlist` derivation (`watchlists`) and to `define_boolean_watchlist`/`crisis_probe`/`digest_probe`'s role-journey probes (`watchlists`, `post_watchlist_matches`).
- **`identityResolution.ts` / `users` table** — read-only input to `invite_user` derivation (`users` other than caller); also the source of `dismissed_by_user_id`.
- **`social_posts` table** — read-only input to `verify_posts` derivation, `enable_enrichment` advanced-step derivation (`enrichment IS NOT NULL`), and the `inbox_probe`/`ticket_probe`/`anomaly_probe` role-journey probes.
- **`outbound_activities` table (Story 2.26/2.28, ADR-0073/0075)** — read-only input to the `triage_probe` (`activity_type = 'reply'`) and `crm_push_probe` (`activity_type IN ('crm_handoff', 'crm_prospect')`) role-journey probes.
- **`ingestion_runs` table** — read-only input to the `traffic_probe` role-journey probe (`status IN ('succeeded', 'success') AND posts_ingested > 0`).
- **`prospecting_lists` table (Story 17.1, ADR-0129)** — read-only input to the `list_probe` role-journey probe.
- **`requireTenantUser.ts`** — both routers (`onboardingChecklistRouter.ts` and `onboardingRouter.ts`) use `requireTenantUserIdentity()` for caller authorization; `platform_admin` identities are rejected before either handler runs.
- **`social-listening-admin`'s `onboarding-checklist-ui` skill** — the frontend counterpart; `getRoleOnboardingChecklist()` in `core-client.ts` calls `GET /v1/onboarding/checklist` exposed by this component.
