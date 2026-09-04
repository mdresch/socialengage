# ADR-0031: `tenants` table shape and its own Row-Level Security policy

**Status:** Accepted (2026-08-03) — drafted by the AI Business & Requirements Analyst persona, revised in place at review to add sign-up domain capture (Amendment Log below), then accepted. Third of a seven-ADR batch; assumes ADR-0029 (authentication) and ADR-0030 (Platform Admin's `platform_admin_role`, `BYPASSRLS`-based, scoped to this table).
**Acceptance note (2026-08-03):** Accepted by Menno, with one addition folded in first: *"Store the sign up users work domain as a domain field in the tenant id to have future similar domains be rerouted."* Menno also directly confirmed, unchanged, that the seat-count race condition (§3) and tenant deletion/offboarding stay out of this ADR's scope exactly as drafted — reviewed, not overlooked. All Open Questions remain open at acceptance, including the three added by this same review (public-email-provider exclusion mechanism, exact reroute UX, audit-log schema, seat-count race condition).
**Source:** `docs/adr/README.md`'s 2026-07-30 brainstorm ("no `tenants` table... exists anywhere in this series — 'tenant' today is purely a `tenant_id` UUID convention"); ADR-0015 (RLS pattern this table must follow); ADR-0030 (the bypass mechanism and audit requirement this table's own design must satisfy).

## Context

Every currently-shipped table (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) carries a `tenant_id` column that *references* a tenant, but no table has ever *defined* what a tenant is — `tenant_id` has been a bare UUID convention since Phase 0. This ADR gives it a real table. ADR-0030 already decided the authorization *mechanism* (a `platform_admin_role` with `BYPASSRLS`, scoped to this table and to a future Platform Admin identity table); this ADR decides this table's own columns and its own RLS policy shape — a table that, unlike every other tenant-scoped table so far, does not merely carry a `tenant_id` foreign key, it defines what one is.

## Decision

### 1. Schema

```
tenants
  id                  uuid primary key default gen_random_uuid()
  name                text not null
  status              text not null default 'active'   -- 'active' | 'suspended'
  license_seat_count  integer not null                  -- set only by Platform Admin
  active_seat_count   integer not null default 0         -- app-maintained, see §3
  domain              text                              -- sign-up user's work email domain, nullable; see §5
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
```

`created_by`/audit detail is deliberately not a column on this table — ADR-0030 §5 already requires every Platform-Admin-bypassed write to be durably logged; that log is the record of *who* provisioned or changed a tenant, not a field on the row itself. This table's own audit-log schema is this ADR's job to decide, not designed further here beyond naming the requirement it must satisfy (ADR-0030 §5) — left as an Open Question below rather than invented speculatively.

### 2. RLS policy — scoped by `id`, not by a `tenant_id` foreign key

This is the one tenant-scoped table in this project whose own primary key, not a separate `tenant_id` column, *is* the tenant identity — the policy reflects that directly, following ADR-0015's existing `NULLIF(..., '')`-normalized, fail-closed pattern exactly:

```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

This lets an ordinary tenant-scoped session (a Tenant-Admin viewing their own tenant's settings — name, status, seat counts) read exactly its own row through the normal `app_user`/`withTenant()` path (ADR-0015) — **no Platform Admin bypass is needed for that self-service case.** Only Platform Admin's genuinely cross-tenant operations (create a new tenant; list/suspend any tenant; change `license_seat_count`) require `platform_admin_role`'s `BYPASSRLS` grant (ADR-0030).

### 3. Seat/license enforcement — application-layer, not a database trigger

`active_seat_count` is a denormalized counter, incremented or decremented by the same application-code transaction that inserts or updates a `users` row's `status` (invited/active/removed — candidate ADR #4), **not** by a database trigger or constraint. This is a deliberate choice, consistent with this project's existing minimal-SQL-machinery pragmatism (no ORM, no migration/query-builder framework — `docs/open-items-and-deferred-work.md` §E): a trigger would be more "automatically correct" but is more machinery than this project has chosen to carry anywhere else. Enforcement of the seat limit itself — reject a new invite if `active_seat_count >= license_seat_count` — happens in application code at invite-creation time, inside the same transaction that would increment the counter. **A race condition under concurrent invites (two simultaneous invites both reading a stale `active_seat_count` and both passing the check) is a real, named risk of this choice, not resolved here** — logged as an Open Question, to be closed at implementation time (e.g., a `SELECT ... FOR UPDATE` on the tenant row, or an atomic `UPDATE ... WHERE active_seat_count < license_seat_count RETURNING ...`) rather than designed in detail by this ADR.

`platform_admin_role` never writes `active_seat_count` — only `license_seat_count` (the ceiling) and `status` (suspend/reactivate) are Platform-Admin-writable, concretely enforcing ADR-0030 §2's locked-in boundary for this specific table: **Platform Admin sees and sets administrative metadata (name, status, seat *ceiling*), never the tenant's own membership detail (who currently occupies those seats) — that distinction is what "zero tenant-data access" means, made concrete here rather than left abstract.**

**Supersession update, 2026-08-04 — a third column added to the Platform-Admin-writable set.** [ADR-0037](0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md) §9 (decided post-acceptance, same day) extends `platform_admin_role`'s grant on this table to also cover `UPDATE(domain)` — a real, audited recovery path for a wrong or squatted `domain` value that ADR-0037's own self-service sign-up flow can otherwise produce with no way to fix. `domain` joins `license_seat_count`/`status` in the same "administrative metadata, not tenant-content" category this paragraph already established — the underlying distinction (Platform Admin sets administrative facts about the tenant record, never its membership/content) is unchanged, just applied to one more column. This ADR's own Decision/Consequences text stays unedited, per this file's own "don't rewrite history" convention; the actual grant now lives in ADR-0037 §9, same treatment as the Open Questions supersession above.

### 4. What this ADR deliberately does not decide

`docs/adr/README.md`'s 2026-07-30 brainstorm's two still-open questions — whether connector *activation* needs its own table separate from `platform_credentials`, and whether a tenant needs multiple activations of one platform (e.g. several Facebook Pages) — belong to candidate ADR #6 (connector connect/disconnect CRUD), not this one; this table's shape is silent on both and does not presuppose either answer.

### 5. Sign-up domain capture, for future same-domain routing — **added at review, 2026-08-03 (Amendment Log below)**

Menno's own instruction, verbatim: *"Store the sign up users work domain as a domain field in the tenant id to have future similar domains be rerouted."* `tenants.domain` captures the email domain of whichever user's sign-up actually provisions a tenant (e.g., `acme.com` from `admin@acme.com`), so a later sign-up from the same domain can be recognized and routed toward this existing tenant, instead of silently creating a second, unrelated tenant for what is really the same organization.

- **Nullable** — a sign-up that can't confidently capture a real organizational domain (or one excluded per below) leaves it unset.
- **Unique only when non-null** (a partial unique index, e.g. `CREATE UNIQUE INDEX ON tenants (domain) WHERE domain IS NOT NULL`) — one tenant per captured domain, consistent with the routing purpose: two tenants can't both claim the same domain.
- **A real correctness requirement this instruction implies, named explicitly rather than left implicit: domain-matching must exclude common public/free email providers** (gmail.com, outlook.com, yahoo.com, and similar) — two unrelated organizations both signing up with personal `@gmail.com` addresses must never be matched or merged into the same tenant on the strength of a shared domain. **The exact exclusion mechanism (a maintained denylist, a heuristic, a third-party domain-classification lookup) is not designed here** — left as an Open Question for whoever builds this, the same "name the gap, don't invent the fix speculatively" discipline this ADR already applies to the seat-count race condition (§3).
- **The exact "rerouting" behavior on a domain match is also not decided here** — whether that means auto-suggesting the existing tenant, requiring that tenant's own Tenant-Admin to approve the new sign-up, or something else, is a sign-up/invite-flow UX decision for whoever builds candidate ADR #4's own story, not designed by this schema-level ADR.
- **A genuine trade-off, named rather than hidden:** a legitimate enterprise with multiple, deliberately-separate SocialEngage tenants under one corporate email domain (e.g. distinct divisions or subsidiaries) is exactly the case this uniqueness constraint complicates — not impossible to support, but not designed for here; flagged as a real limitation of the "one domain, one tenant" default this instruction establishes.

## Consequences

**Positive**
- Gives every existing `tenant_id`-bearing table (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) a real referent for the first time — `tenant_id uuid` can now be a genuine foreign key to `tenants.id`, not a bare convention.
- Reuses ADR-0015's exact RLS pattern with no new mechanism, and ADR-0030's exact bypass mechanism with no new mechanism — this ADR introduces one new table, not one new kind of enforcement.
- Concretely resolves what "Platform Admin... zero tenant-data access" means at the column level, not just as a documented intention.
- **Added at review, 2026-08-03:** `domain` (§5) gives future sign-ups a real chance to be recognized as belonging to an already-onboarded organization, rather than every sign-up necessarily producing a new, disconnected tenant.

**Negative**
- The seat-count race condition (§3) is a real, currently-unresolved correctness gap, not a hypothetical one — flagged for whoever implements this table's story to close before or during that implementation, not silently assumed away. **Confirmed at review, 2026-08-03:** Menno reviewed this gap directly and confirmed it stays exactly as scoped — out of this ADR's design, left for implementation time — not an oversight.
- Adding `tenant_id` as a real foreign key to every existing tenant-scoped table's migration is real, if mechanical, schema-migration work across six existing tables — not free, even though each table's own RLS policy text does not need to change.
- **Added at review, 2026-08-03:** `domain` (§5) is only as safe as its public-email-provider exclusion list, which this ADR does not design — built carelessly or incompletely, it risks incorrectly linking unrelated tenants that happen to share a common free-email domain. It also complicates, without forbidding, a legitimate multi-tenant single-organization case (§5).

## Alternatives Considered

- **A `tenant_id` self-referencing column on this table** (mirroring every other table's shape exactly) instead of scoping the RLS policy by `id` directly — rejected as needless indirection: this table *is* the tenant, a self-referencing `tenant_id = id` column would be redundant with the primary key it would always equal.
- **A database trigger enforcing the seat-count ceiling** — considered, rejected in favor of application-layer enforcement (§3), consistent with this project's existing minimal-machinery choice elsewhere; revisit if the race condition proves to be a real, demonstrated problem rather than a theoretical one.

## Open Questions

- [ ] **[Q-0031-1]** **Exact audit-log schema** for Platform-Admin-bypassed writes to this table (ADR-0030 §5's requirement) — not designed here.
- [ ] **[Q-0031-2]** **The seat-count race condition (§3)** — a real correctness gap, left to implementation-time resolution, not designed in detail here.
- [ ] **[Q-0031-3]** **Whether `name` needs a uniqueness constraint, or a separate slug/subdomain field** for admin-UI routing purposes — candidate ADR #7's concern, if anything, not decided here.
- [x] **[Q-0031-4]** ~~**Tenant deletion/offboarding** (GDPR Article 17-adjacent)~~ **Resolved by ADR-0043:** Self-service tenant deletion, tombstoning, and cascade purge architecture established. — already named out of scope elsewhere (`docs/open-items-and-deferred-work.md` §C); not addressed by this ADR either, cross-referenced rather than silently reopened. **Confirmed at review, 2026-08-03:** Menno reviewed this exclusion directly and confirmed it stays out of this ADR's scope.
- [ ] **[Q-0031-5]** **Added at review, 2026-08-03 — the public/free-email-provider exclusion mechanism for `domain` matching (§5)** — not designed here; whoever builds this must decide a denylist, heuristic, or lookup service before relying on domain-based routing in production.
- [ ] **[Q-0031-6]** **Added at review, 2026-08-03 — the exact sign-up "rerouting" UX on a domain match (§5)** — auto-suggest, require existing-Tenant-Admin approval, or something else — left to candidate ADR #4's own story.

**Pending supersession note, added 2026-08-04 — not yet in effect, ADR-0037 is still Proposed.** [ADR-0037](0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md), if accepted, resolves both of the Open Questions immediately above by name — not a change to this ADR's own Decision or Consequences text, which stays exactly as written: (1) the public/free-email-provider exclusion mechanism is decided as a maintained, static, application-code denylist (ADR-0037 §4), named there as permanently incomplete by construction rather than a false completeness claim; (2) the exact domain-match rerouting UX is decided as an outright rejection toward the existing invite flow (ADR-0032 §6), never an automatic join and never a new request-approval queue (ADR-0037 §3). Per this file's own governance-table convention, this is a Pending supersession note only — it takes effect, and this ADR's own Open Questions above are marked resolved, only once ADR-0037 is actually accepted, not before.

**Supersession update, 2026-08-04, same day — the note above is now in effect.** ADR-0037 was accepted by Menno the same day it was drafted ("ADR 0037 is approved as well"). Both Open Questions immediately above are now resolved exactly as the Pending supersession note anticipated, plus one refinement ADR-0037's own acceptance added beyond what was originally anticipated here: the domain-match rejection now also surfaces the attempt to the matched tenant's own Tenant-Admin as an actionable proposal (ADR-0037 §8b, the "Same-Domain Invite Assist," decided at acceptance, not part of the original drafting pass this note first pointed to) — softening, without removing, the "zero self-service path" limitation this ADR's own §5 originally named. This ADR's own Decision/Consequences text remains unedited, per this file's own "don't rewrite history" convention; the actual behavior now lives in ADR-0037.

## Amendment Log

- 2026-08-03 — Initial proposal, drafted by the AI Business & Requirements Analyst persona.
- 2026-08-03 — **Revised at review, before acceptance**, per Menno's direct instruction: *"Store the sign up users work domain as a domain field in the tenant id to have future similar domains be rerouted."* Added §5 (`domain` column, nullable, unique when non-null, with the necessary public-email-provider exclusion and exact reroute-UX both named as unresolved rather than invented speculatively) and updated Consequences/Open Questions accordingly. Menno also directly reviewed and confirmed, unchanged, this ADR's two existing named exclusions — the seat-count race condition (§3) and tenant deletion/offboarding — both stay exactly as originally scoped, not silently reopened or expanded.
