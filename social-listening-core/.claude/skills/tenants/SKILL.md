---
name: tenants
description: The `tenants` table — the first table in this project whose own primary key IS the tenant identity, its RLS policy scoped by `id`, its seat-count enforcement, and platform_admin_role's column-scoped write boundary. Read this before adding a column to `tenants`, before writing code that touches `active_seat_count`, or before wiring a real user-invitation flow (Story 5.9) that needs to reserve/release a seat.
---

# Tenants

## What this is

`tenants` (migration `0017`) gives every other tenant-scoped table's `tenant_id` a real referent for the first time — until this story, `tenant_id` was a bare UUID convention with no defining row anywhere. Unlike every other tenant-scoped table, `tenants` has no separate `tenant_id` foreign key column: its own primary key, `id`, *is* the tenant identity, and its RLS policy is scoped by `id` directly (ADR-0031 §2). `tenantStore.ts` is the sanctioned read/write surface — never query or write `tenants` directly outside it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0031 | `tenants` table shape and its own RLS policy, including sign-up `domain` capture (§5, added at review) | 5.8 |
| ADR-0015 | The RLS pattern this table's policy follows exactly (fail-closed, `NULLIF`-normalized) | 5.4 (precedent), 5.8 (this table) |
| ADR-0030 | `platform_admin_role`'s `BYPASSRLS` mechanism — this table is the first one it's actually granted anything on | 5.7 (mechanism), 5.8 (first real grant) |

## Contracts that constrain this component

- `contracts/epic-5/story-5.8.tenants-table-rls.contract.test.ts` — RLS enabled/forced with a policy scoped by `id`; a tenant-scoped session sees exactly its own row; `platform_admin_role` can create a tenant and update `status`/`license_seat_count` but is column-level denied from writing `active_seat_count`; the seat-count increment/decrement path runs as `app_user`, is rejected once at capacity, and is DB-atomic (no race window); `domain` is nullable and unique only when non-null.

## How to extend this safely

- **Story 5.9 (`users` table):** when wiring a real user-invitation flow, call `incrementActiveSeatCount(tenantId)` inside the same transaction that inserts/activates the `users` row — it already returns `null` if the tenant is at capacity, which is the rejection signal ADR-0031 §3/Story 5.8's AC5 requires. Call `decrementActiveSeatCount(tenantId)` when a user is removed/offboarded. Do not reimplement the seat-count check inline in the users code — this function is the single sanctioned enforcement point.
- **Any new column:** add it to `migrations/0017_create_tenants.sql`'s own follow-up migration (never edit `0017` after it ships), and decide explicitly whether `app_user` or `platform_admin_role` (or neither) should be able to write it — the column-level GRANTs below are deliberate, not an oversight to "fix" by widening.
- **Candidate ADR #4 (whoever builds the sign-up/invite-flow story):** `domain`'s public-email-provider exclusion and the exact "rerouting" UX on a domain match are both explicitly undesigned by ADR-0031 §5 — that story's job, not a gap in this one.

## Load-bearing constraints — do not change casually

- **`platform_admin_role`'s `UPDATE` grant on `tenants` is column-scoped to `(status, license_seat_count)` only** — never widen this to a blanket `UPDATE`. A blanket grant would silently defeat AC3's "Platform Admin cannot write `active_seat_count`" boundary, which today is a real, DB-enforced permission-denied error, not an application-code convention that trusts the caller not to.
- **`app_user`'s `UPDATE` grant on `tenants` is column-scoped to `active_seat_count` only** — a Tenant-Admin's own tenant-scoped session can read its own `name`/`status`/seat counts (RLS, not a column grant, is what confines *reads* to the caller's own row) but cannot rename or unsuspend its own tenant via a raw update; only Platform Admin can. Symmetric with the constraint above, same underlying design principle (ADR-0031 §2/§3: Platform Admin sets administrative metadata, never membership detail; the tenant itself sets membership detail, never its own administrative metadata).
- **The seat-count increment/decrement is a single atomic `UPDATE ... WHERE active_seat_count < license_seat_count RETURNING *` statement, not a `SELECT` followed by a separate `UPDATE`.** This is deliberate — it is the exact fix ADR-0031 §3 named for its own flagged race condition (two concurrent invites both reading a stale count and both passing a check). Splitting this into two statements would reintroduce that race.
- **`tenants` has no `tenant_id` column and its RLS policy is scoped by `id`, not `tenant_id`** — this is the one table in the project shaped this way (ADR-0031 §2's own explicit rejection of a self-referencing `tenant_id = id` column as needless indirection). Don't "fix" this to match every other table's pattern; it's intentional.

## Known gaps / deferred work

- **Not wired into a real user-invitation flow yet** — no `users` table exists (Story 5.9's own job). This story proves `incrementActiveSeatCount`/`decrementActiveSeatCount` correct in isolation against the `tenants` table alone, the same "prove the mechanism, not the whole pipeline" pattern Story 4.1 used for `author_topic_signals`.
- **`domain`'s public-email-provider exclusion mechanism is not designed or implemented** — ADR-0031 §5's own named Open Question. Today, `domain` will happily accept `gmail.com` etc. as a "unique" tenant domain; nothing prevents it. Whoever builds the sign-up flow must add this before relying on `domain` for real routing.
- **Tenant deletion/offboarding is out of scope** — ADR-0031's own named Open Question, cross-referenced to `docs/open-items-and-deferred-work.md` §C.
- **The audit-log schema for Platform-Admin writes to `tenants` is `platform_admin_audit_log`'s existing first-cut shape (Story 5.7)** — not redesigned here; `createTenant`/`updateTenantAdmin` both call `logPlatformAdminAction()`, the same as every other Platform Admin action.
- **No HTTP/REST surface exists for `tenants` yet** — this story is table/store-level only; a future Admin UI story would add `POST/GET/PATCH` routes calling into `tenantStore.ts`, not reimplement its logic.
