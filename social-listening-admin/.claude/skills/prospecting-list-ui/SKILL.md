# Prospecting list UI

## Story
Story 10.2 (ADR-0086) — Prospecting list detail page with inline editing.
Story 13.14 (ADR-0117) — Prospecting export and CRM push UI.

## Intent
Provide a tenant-facing screen for viewing and managing a single prospecting list: inline edit of list metadata and entries, bounded CSV export, and batch "Push to CRM" handoff. The UI is owner-writeable; shared non-owner views are read-only, consistent with ADR-0086's ownership rules.

## Governing decisions
- ADR-0086 `prospecting_lists` ownership/RLS: a list has a single `owner_id`; shared lists are visible to other tenant users but not editable. Non-owners see a "Read-only" badge and cannot edit list metadata, entries, export, or push to CRM.
- ADR-0117 export and CRM push: `GET /v1/prospecting-lists/:id/export.csv` returns a metadata-only, bounded CSV (same bounds as ADR-0111). `POST /v1/prospecting-lists/:id/crm-handoff` accepts `crmConnectorId`, `caseType='lead'`, and optional `selectedEntryIds`.
- ADR-0112 feature gating: `exports` and `prospecting_crm` gates control visibility of the "Export CSV" and "Push to CRM" actions. Missing gate values default to enabled (`featureGates.exports !== false`), matching the core `requireFeatureGate` convention.
- ADR-0036 §2 `core-client.ts` is the sole bearer-token attachment point. All core calls for the list go through it; the UI uses same-origin BFF proxies for browser-facing paths (`/api/prospecting-lists/:id/export.csv` and `/api/prospecting-lists/:id/crm-handoff`).
- The existing single-author "💼 CRM" per-row handoff (Story 11.2 / ADR-0095) remains unchanged; Story 13.14 adds a list-level batch handoff modal.

## Architecture
- `src/app/tenant/prospecting/[id]/page.tsx` (Server Component) — role-gates on the `'tenant'` shell, decrypts the session, resolves the list owner, fetches `getMyPlan()` to read `featureGates`, and passes `featureGates` to `ProspectingListDetailView`.
- `src/app/tenant/prospecting/ProspectingListDetailView.tsx` (Client Component) — owner-only header actions for "Export CSV" and "Push to CRM". Conditionally renders the buttons based on `isOwner` and feature-gate state. Fetches the CSV blob from `/api/prospecting-lists/:id/export.csv?limit=5000` and triggers a browser download.
- `src/app/tenant/prospecting/ProspectingListCrmPushModal.tsx` (Client Component) — opened from `ProspectingListDetailView`. Loads available CRM connectors from `/api/crm/connectors`, lets the user select a connector and the entries to push (default all selected), then `POST`s to `/api/prospecting-lists/:id/crm-handoff`. On success, shows `pushedCount`/`skippedCount` and, when present, a link to `crmUrl`.
- `src/app/api/prospecting-lists/[id]/export.csv/route.ts` — thin same-origin proxy to `exportProspectingListCsv()`; streams the response with the original `Content-Type` and an `attachment` `Content-Disposition`.
- `src/app/api/prospecting-lists/[id]/crm-handoff/route.ts` — thin same-origin proxy to `pushProspectingListToCrm()`; forwards status and JSON body unchanged.
- `src/lib/core-client.ts` — adds `exportProspectingListCsv(listId, limit)` and `pushProspectingListToCrm(listId, input)` plus their input/response types. Uses `authenticatedCoreFetch()` so the bearer token is attached automatically.
- `src/components/plan/FeatureToggleList.tsx` — lists `exports` and `prospecting_crm` as tenant-plan feature-gate keys.

## Load-bearing constraints
- CSV export is triggered client-side with a bounded `limit=5000` query parameter, matching the contract's default bound and the BFF proxy default.
- The CRM push modal always sends `caseType: 'lead'` and `selectedEntryIds` derived from user selection. The connector list is fetched from the existing `/api/crm/connectors` path; no new connector administration UI is in scope.
- Feature-gate missing values are treated as enabled. Explicitly disabled gates (`featureGates.exports === false` or `featureGates.prospecting_crm === false`) hide the corresponding action.

## Cross-component behavior
- Reuses `CRMHandoffModal` from `crm-handoff-ui` for single-author lead escalation in the entries table.
- Reads plan feature gates from the existing `getMyPlan()` and `FeatureToggleList` surface.

## Contracts
- `contracts/epic-13/story-13.14.prospecting-export-and-crm-push-ui.contract.test.ts` — Story 13.14 contract test.
