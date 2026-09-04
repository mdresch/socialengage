# ADR-0032: `users` table shape, RLS, and the request-time identity-resolution path

**Status:** Accepted (2026-08-03) — drafted by the AI Business & Requirements Analyst persona, then accepted by Menno after a clarifying exchange (Acceptance note, Amendment Log below). Fourth of a seven-ADR batch; assumes ADR-0029 (authentication/Entra), ADR-0030 (bypass mechanism and its identity-resolution use), and ADR-0031 (`tenants` table this table references).
**Acceptance note (2026-08-03):** Accepted by Menno, verbatim: *"ok then ADR 0032 also cofirmed as approved."* Preceded by two clarifying exchanges that changed nothing in the Decision (credential-tracking ownership confirmed on `platform_credentials`, not `users`, §7; Tenant Reader/Business Analyst role split confirmed deferred, "roles are unknown at this time", §4). **Followed, in the same continuous review, by one exchange that did change the Decision**: Menno's direct instruction, verbatim, *"Replace status active/suspended with a nullable end date. removing an end date makes the account according to the audit trail per that date active again"* — added as §9 (`access_ends_at`), folded in and logged honestly in sequence below rather than reordered to look like it preceded acceptance. All remaining Open Questions stay open, including the two added by this last exchange.
**Source:** `docs/adr/README.md`'s 2026-07-30 brainstorm; ADR-0028 (Tenant-Admin as tenant-wide credential-creation authority; user-bound credential self-activation — this table's `role`/`id` columns are the concrete target those tiers need); `Stakeholder-Register.md`'s Tenant-Admin/Tenant Reader/Tenant Business Analyst personas; ADR-0029 §3 (data-ownership principle this table's profile fields must satisfy).

## Context

No `users` table exists anywhere in this project — `Stakeholder-Register.md` S-08 states plainly that "no code, table, or authenticated identity exists yet" for any of the Platform Admin, Tenant-Admin, Tenant Reader, or Tenant Business Analyst personas, and names candidate ADRs #1–#4 as the prerequisite. This ADR is the last of those four, and closes the loop: ADR-0029 decided how a caller authenticates; ADR-0030 decided the mechanism (and named, without designing, a request-time identity-resolution bypass this table is the target of); ADR-0031 gave "tenant" a real table this one now references. ADR-0028 already requires that whichever role this ADR designates hold sole tenant-wide credential-creation authority ("Tenant-Admin") and that a user-bound credential be activated only by its own owning user — this ADR gives both a concrete row to point at.

## Decision

### 1. Schema

```
users
  id               uuid primary key default gen_random_uuid()
  tenant_id        uuid not null references tenants(id)
  external_subject text unique              -- Entra `sub` claim; NULL until first sign-in links an invited row
  email            text not null
  display_name     text                     -- nullable until set; Postgres-owned, ADR-0029 §3
  role             text not null default 'tenant_user'  -- 'tenant_admin' | 'tenant_user'
  status           text not null default 'invited'       -- 'invited' | 'active' (suspended folded into access_ends_at, see §9)
  invited_at       timestamptz not null default now()
  activated_at     timestamptz
  access_ends_at   timestamptz                            -- NULL = active indefinitely; see §9
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()
```

`id` is SocialEngage-generated, deliberately decoupled from Entra's own `sub` value — a direct consequence of ADR-0029's portability design: a future IdP swap only ever needs to re-link `external_subject`, never renumber a foreign key anything else in this schema points at.

### 2. RLS — identical shape to every other tenant-scoped table

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

No special-casing — this is exactly ADR-0015's existing pattern, applied to a new table.

### 3. Platform Admin is not a row in this table

Modeled instead in its own, separate table (e.g. `platform_admins`: `id`, `external_subject`, `email`, `created_at`) with **no `tenant_id` column and no `tenant_isolation` policy of this shape** — its own RLS policy returns zero rows to the ordinary `app_user` role under any tenant context; only `platform_admin_role` (ADR-0030) may read or write it. **Rationale, stated plainly:** forcing Platform Admin into a nullable-`tenant_id` row on `users` would force every RLS predicate and every application-layer query against this table to special-case `tenant_id IS NULL` — for a role that conceptually does not belong to any tenant at all. A second, small, separate table is the cleaner fit, not a premature abstraction; it directly reflects ADR-0030 §2's already-locked boundary that Platform Admin never touches tenant-content tables, of which this is one.

### 4. Tenant Reader and Tenant Business Analyst are not separate `role` values in v1

`Stakeholder-Register.md`'s split of "Tenant User" into Tenant Reader (consumes passively) and Tenant Business Analyst (actively queries/exports) is a description of **usage patterns**, stated in that register's own text — nothing currently decided anywhere in this project's ADRs, stories, or design spec requires enforcing a *different authorization scope* between the two. Both map to `role = 'tenant_user'` in this v1 schema. **This is a deliberate choice against inventing a permission boundary nothing has asked for yet**, the same anti-speculative-build discipline this project already applies elsewhere (ADR-0020's deferred distributed rate-limit gate). Flagged explicitly as an Open Question below, not silently foreclosed — revisit once a real feature (e.g., an export endpoint requiring a different grant than a read-only dashboard) actually needs the distinction.

### 5. Request-time identity resolution — concretizing ADR-0030 §4

Every authenticated request's first step, before any `withTenant()` call, resolves the token's validated `sub` claim (ADR-0029) against this table (and, if no match, the `platform_admins` table) via a **narrowly-scoped, SELECT-only** bypass path. Proposed here as its own role, distinct from `platform_admin_role`: **`identity_resolver_role`**, granted `BYPASSRLS` and `GRANT SELECT` **only** on `users(id, tenant_id, role, status, external_subject)` and the equivalent minimal columns of `platform_admins` — never `SELECT *`, never any write grant. This is deliberately a *fourth*, even-narrower role than `platform_admin_role`'s own (`tenants`-table) grant, so that a compromise of one does not imply the other. Once `(tenant_id, user_id, role)` is resolved, the request proceeds through the ordinary `withTenant(resolvedTenantId, ...)` path exactly as it does today (ADR-0015 unchanged) — this bypass exists only to bootstrap the very first lookup of a request, never for anything downstream of it in the same request.

### 6. Invite/link flow — concretizing ADR-0029 §4

Tenant-Admin creates a `users` row with `status = 'invited'`, `email` set, `external_subject = NULL`. At first successful Entra sign-in whose token's `email` claim matches that row, `external_subject` is written from the token's `sub` and `status` moves to `active`. A caller whose `sub` matches no `users` row and no `platform_admins` row is rejected at the application layer (401/403) regardless of Entra having permitted the sign-in — per ADR-0029 §4, Entra's own permission to sign in is not, by itself, SocialEngage access.

### 7. Credential ownership target for ADR-0028's Tier 3 — named, not designed here

This table's `id` is the foreign-key target candidate ADR #6 will add as `platform_credentials.user_id` for user-bound (Tier 3) credentials. Named here so #6 has a concrete column to point at; the `platform_credentials` schema change itself is #6's own job.

### 8. Profile-field ownership

Per ADR-0029 §3's "single source of truth per field" principle, cited not re-derived: `display_name`, and any future Office/AD-style field this project ever adds (department, job title, or similar), are owned here — filled in at invite time by Tenant-Admin, or by the user themself once active — never synced from Entra or any external directory.

### 9. `access_ends_at`, not a `'suspended'` status value — **added at review, 2026-08-03 (Amendment Log below)**

Menno's own direction, verbatim: *"Replace status active/suspended with a nullable end date. removing an end date makes the account according to the audit trail per that date active again."*

- **`status`'s value set shrinks to `'invited' | 'active'` only** — `'suspended'` is removed as a status value entirely. The active/ended distinction moves to `access_ends_at`, a nullable timestamp: **`NULL` = active indefinitely; a past or present timestamp = access has already ended (an immediate suspension simply sets it to `now()`); a future timestamp = a scheduled expiration** (e.g. a contractor's access ending on a known date without anyone having to remember to suspend them manually) — still active until that moment arrives.
- **"Currently active" check:** `status = 'active' AND (access_ends_at IS NULL OR access_ends_at > now())`.
- **Reactivation is explicit, not implicit:** clearing `access_ends_at` back to `NULL` makes the account active again as of that action — per Menno's own instruction, this is the sanctioned reactivation mechanism (there is no separate `'reactivated'` state; a cleared `access_ends_at` and `status = 'active'` together are sufficient).
- **Every write to `access_ends_at` — setting it (immediate or scheduled) or clearing it — is itself an auditable event**, not just a value change silently reflected in the row's current state: who changed it, when, and the before/after value. This is not a new, separately-invented audit mechanism — it is the same "exact audit-log schema" requirement already inherited from ADR-0030 §5 and left as an Open Question by ADR-0031 §Open Questions; `access_ends_at` changes are named here as needing to flow through whatever mechanism that Open Question eventually resolves to, not a fourth, parallel audit path.
- **A past `access_ends_at` is not auto-cleared by anything** — it simply continues to evaluate as "ended" under the check above indefinitely, until a Tenant-Admin (or Platform Admin, for the break-glass case, ADR-0030 §3) explicitly clears it. No scheduled job is introduced by this ADR to sweep or expire it further.

## Consequences

**Positive**
- Closes `Stakeholder-Register.md` S-08's own named gap ("candidate ADRs #1–#4 must exist first") — the last of the four now exists.
- Deliberately narrow, purpose-specific bypass role (§5) keeps the identity-resolution mechanism's blast radius smaller than Platform Admin's own, rather than reusing one bypass role for two different jobs.
- Not inventing a Reader/Business-Analyst permission split (§4) avoids building an authorization boundary with no current feature behind it.
- **Added at review, 2026-08-03:** `access_ends_at` (§9) supports scheduled future expirations (not just immediate suspension) and, combined with its own audit trail, captures *when* access ended or was restored — strictly more information than a bare boolean/enum status ever gave.

**Negative**
- The seat-count enforcement this table's `status` transitions feed into (ADR-0031 §3) inherits that ADR's own named race-condition risk — not resolved here either.
- A fourth distinct Postgres role (`identity_resolver_role`, alongside `app_user`, `platform_admin_role`, and the migration/bootstrap role) is real operational surface to provision and keep correctly scoped — a small but genuine increase in the database's own role-management complexity.
- Declining to split Tenant Reader/Tenant Business Analyst now means that if a real future need for the distinction emerges, it requires a schema migration (`role` enum widened, or a second permission dimension added) rather than already being present — an accepted, named trade-off, not an oversight.

## Alternatives Considered

- **A separate user-role join table**, allowing a user to hold more than one role at once — rejected as premature: nothing currently named in this project needs a single user to hold two roles simultaneously; a single `role` column is sufficient today. Revisit if a real multi-role need appears.
- **Splitting Tenant Reader/Tenant Business Analyst into separate `role` values now**, pre-emptively — rejected (§4); no current feature or ADR requires the distinction at the authorization layer.
- **Modeling Platform Admin as a `users` row with `tenant_id` nullable** — rejected (§3); complicates every RLS predicate on this table for a role that structurally doesn't belong to any tenant.

## Open Questions

- [ ] **[Q-0032-1]** **Whether Tenant Reader and Tenant Business Analyst ever need a real authorization-level distinction**, not just a usage-pattern description — deliberately not decided now (§4); revisit once a concrete feature actually requires different treatment by role. **Confirmed at review, 2026-08-03:** Menno reviewed this directly and confirmed the underlying reason it's deferred — verbatim, *"roles are unknown at this time"* — the exact shape any future distinction should take isn't yet known, not merely undecided, reinforcing (not just permitting) §4's single-`tenant_user`-value choice for v1.
- [ ] **[Q-0032-2]** **The seat-count race condition** inherited from ADR-0031 §3 — not resolved here.
- [ ] **[Q-0032-3]** **Whether `external_subject` should also capture which token/claims version issued it**, in case a future Entra configuration change alters claim shape — not decided, a minor implementation detail for whoever builds this table's story.
- [ ] **[Q-0032-4]** **Added at review, 2026-08-03 — the exact audit mechanism for `access_ends_at` writes (§9)** — inherits, rather than duplicates, the same unresolved "exact audit-log schema" question already open from ADR-0030 §5/ADR-0031; not designed here.

## Amendment Log

- 2026-08-03 — Initial proposal, drafted by the AI Business & Requirements Analyst persona.
- 2026-08-03 — Clarifying exchange, no Decision change: Menno asked whether `users` maintains saved keys/activated connectors for a user; confirmed no — that data lives entirely on `platform_credentials.user_id` (§7), never duplicated onto `users`, per ADR-0029 §3's single-source-of-truth principle.
- 2026-08-03 — Confirming exchange on §4's Open Question, no Decision change: Menno confirmed, verbatim, "roles are unknown at this time" — added to that Open Question's own text above.
- 2026-08-03 — **Accepted**, verbatim: "ok then ADR 0032 also cofirmed as approved." See Status line and Acceptance note.
- 2026-08-03 — **Revised, in the same continuous review, immediately after the acceptance entry above** — per this project's own honest-sequencing discipline, logged in the order it actually happened rather than reordered. Menno's direct instruction, verbatim: *"Replace status active/suspended with a nullable end date. removing an end date makes the account according to the audit trail per that date active again."* Added §9: `access_ends_at` (nullable timestamptz) replaces `'suspended'` as a `status` value; `NULL` = active, a set timestamp (past, present, or future) = ended or scheduled to end; clearing it reactivates the account; every write to it is an auditable event, inheriting rather than duplicating the audit-mechanism question already open from ADR-0030/ADR-0031. Schema (§1), Consequences (one Positive added), and Open Questions (one added) updated accordingly. This does not reopen this ADR's Status — it remains **Accepted**, the same in-place-revision-after-review pattern already used for ADR-0030/ADR-0031's own additions, just arriving one message later here.

## Note on relation to ADR-0041 (2026-08-06)

**ADR-0041** (Accepted 2026-08-06) formalizes, as a general, project-wide, cross-layer rule, something this ADR's own §3 already decided locally: Platform Admin "is not a row in this table" — modeled in its own, separate `platform_admins` table, with no `tenant_id` column and no `tenant_isolation` policy, specifically because it does not conceptually belong to any tenant at all. This already fully satisfies ADR-0041's Decision §1 — this note confirms that, and requires no change to this ADR's own Decision or Consequences text.
