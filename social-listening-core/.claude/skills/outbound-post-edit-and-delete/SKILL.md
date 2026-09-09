---
name: outbound-post-edit-and-delete
description: Outbound activity revision tracking, post editing, and post deletion framework for social-listening-core.
---

# Outbound Post Edit and Delete

## What this is

This component provides the backend framework for editing and deleting published or scheduled outbound posts and replies. It records every mutation after initial dispatch in a tenant-scoped, append-only `outbound_activity_revisions` table, updates audit timestamps (`edited_at`, `deleted_at`) on parent `outbound_activities` rows, and invokes optional `edit?()` and `delete?()` methods on registered `SocialConnector` instances.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0119 | Editing and Deleting Published Outbound Posts: child revision table, connector edit/delete methods, REST endpoints | 14.2 |
| ADR-0075 | Outbound Social Post Publishing: base `outbound_activities` table and `publish()` dispatch | 2.28, 3.15 |
| ADR-0073 | Outbound Reply to Ingested Posts: base `outbound_activities` audit model | 2.26, 3.14 |
| ADR-0028 | Credential Creation Authority by Ownership Tier: user-bound Tier-3 credentials | 1.7 |
| ADR-0030 | Platform Admin Boundary: zero access to tenant-scoped content or revisions | 5.10 |

## Contracts that constrain this component

- `contracts/epic-14/story-14.2.editing-and-deleting-published-outbound-posts.contract.test.ts` — locks down `outbound_activity_revisions` RLS, parent audit columns, `PATCH` (in-place for pending, connector call for sent), `DELETE` (cancellation for pending, connector call for sent), `GET` revisions list, `edit_not_supported`/`delete_not_supported` 422 errors, and strict author / `tenant_admin` role gating.

## How to extend this safely

- **Adding edit or delete support for a platform:**
  1. Verify the platform's API capabilities and constraints via a primary-source-backed per-platform ADR.
  2. Implement optional `edit?(activity, body, payload?, credential)` and/or `delete?(activity, credential)` on the connector.
  3. Ensure required OAuth scopes are configured and verified on connector credentials.
- **Querying current post content:**
  - Do not assume `outbound_activities.body` contains the latest content for `sent` posts. The latest non-failed `'edit'` revision in `outbound_activity_revisions` (via `getLatestAppliedEditRevision` or `getCurrentBody`) is the source of truth for post content.
- **Extending revisions:**
  - The revision table is append-only. Only `status`, `error_code`, `external_id`, and `external_url` may be modified as an operation transitions from `'pending'` to `'applied'` or `'failed'`. Never delete or overwrite previous revision content.

## Load-bearing constraints — do not change casually

- **RLS tenant isolation:** All queries to `outbound_activity_revisions` must execute through `withTenant(tenantId)` with PostgreSQL Row Level Security enabled.
- **Authorization:** Only the original author (`user_id`) who created the parent activity or a `tenant_admin` in the same tenant may request an edit or delete. `platform_admin` has zero access.
- **Pending post semantics:** An edit to a `pending` post updates the parent body in place, sets `edited_at`, and records an `applied` revision without calling a connector. A delete of a `pending` post cancels the activity (`status='cancelled'`) and creates no revision row.
- **Sent post semantics:** An edit or delete on a `sent` post requires connector implementation. If the connector lacks the method, return 422 with `edit_not_supported` or `delete_not_supported`.
- **Target asset read-only:** `target_asset_id` cannot be retargeted during an edit; attempting to change it returns 422 `TARGET_ASSET_READ_ONLY`.

## Known gaps / deferred work

- Per-platform connector implementations of `edit?()` and `delete?()` (Mastodon, Bluesky, Facebook, LinkedIn, etc.) are deferred to per-platform stories following primary-source verification.
- Media asset re-upload or replacement on post edit is deferred to future media asset pipeline iterations.
- Platform-specific edit/delete time window expiration enforcement is deferred to per-platform connector handlers.

## Relations to other components

- Calls `getSocialConnector(providerId)` from `src/connectors/registry.ts` to dispatch edits and deletes.
- Reads encrypted credentials via `readCredential` from `src/credentials/credentialStore.ts`.
- Gated by `acquireForOutboundPost` from `src/connectors/requestGate.ts`.
- Authenticated via `requireTenantUserIdentity` from `src/http/auth/requireTenantUser.ts`.
