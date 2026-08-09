# ADR-0044: Watchlist CRUD contract — PATCH semantics, error mapping, and updated_at policy

**Status:** Proposed (drafted 2026-08-08 by the AI Business & Requirements Analyst persona)
**Source:** Story 1.5 (Watchlist Management) needs an explicit decision on (a) PATCH semantics (no prior ADR covers this), (b) HTTP error-code mapping that does not conflict with ADR-0030 §1's role-check boundary, (c) the `updated_at` policy for mutable tenant-scoped tables (named as an Open Question in earlier ADRs, never decided), and (d) reconciliation of the `watchlists` row shape with ADR-0021's boolean-query AST.
**Acceptance note:** *(to be filled at acceptance — verbatim reviewer quote, per series convention)*

## Context

Story 1.5 introduces tenant-scoped watchlists. Three concrete questions remain unanswered after ADR-0006 (connector-side vs post-fetch matching) and ADR-0021 (boolean-query AST + per-connector capability matrix) — and a fourth, ADR-0021's own §Open-Questions ("where does `supportedQueryFeatures` surface"), which this ADR explicitly defers to ADR-0021's own accepted answer (connector status page + watchlist-detail-view badge).

The four questions this ADR decides:

1. **PATCH semantics** — every prior `/v1` endpoint in this codebase (verified directly against `social-listening-core/src/http/versions/v1/watchlistsRouter.ts` and the rest of the v1 router family) uses PUT or POST; nothing has yet decided what PATCH means. ADR-0017's compatibility policy is silent on the wire shape of partial updates. A standardized PATCH contract is needed before more than one endpoint needs one, otherwise divergent per-endpoint shapes lock in.
2. **Error-code mapping** — ADR-0015 makes tenant isolation a database-enforced invariant. The application layer still has to *translate* RLS denials and "not your row" results into HTTP codes without leaking tenant existence (ADR-0006 §Consequences already notes the tenant-existence-leak concern indirectly via the capability-matrix surfacing). ADR-0030 §1 says Tenant-Admin authorization failures are an *application-layer role check*, not a tenant boundary — so 403 vs 404 cannot be collapsed into one rule.
3. **`updated_at` policy** — every mutable tenant-scoped table in this project already has an `updated_at` column (verified in `migrations/0002`–`migrations/0021`), but nothing in the ADR series decides whether it's application-set or trigger-set, or which tables are exempt. `IngestionRun` (ADR-0005) must be exempt — it is the immutable acquisition/audit anchor and may not have its `updated_at` rewritten by a `before update` trigger.
4. **Reconciliation with ADR-0021** — ADR-0021 is the durable decision for watchlist *matching*. A watchlist row needs a `filters` shape that is consistent with (not in conflict with) the AST/capability-matrix model, not an alternative matching model in JSONB.

This ADR does **not** decide, re-decide, or constrain:

- Watchlist *matching* semantics — ADR-0006 and ADR-0021 are the durable decisions for that; this ADR cross-references them and stays out of their way.
- Tenant identity propagation — ADR-0015 (RLS), ADR-0033 (`X-Tenant-Id` retirement) are the durable decisions.
- Watchlist creation authorization (who can create one) — deferred to whichever story implements `users.role = 'tenant_admin'`'s actual authorization boundary on `/v1/watchlists`; per ADR-0030 §1, it is an application-layer role check against `users.role`, not a database mechanism. Named as an Open Question below rather than invented here.
- `activity_logs` vs `platform_admin_audit_log` naming — out of scope; the prior draft of this ADR introduced a new audit table name without realizing ADR-0030 §5 / ADR-0031 §27 / ADR-0037 §125 had already converged on `platform_admin_audit_log`. Removed in this revision; cross-referenced instead.

## Decision

### 1. PATCH semantics — JSON Merge Patch (RFC 7396), project-wide

Every `/v1` PATCH endpoint in this project uses [RFC 7396 JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396):

- A `null` value in the patch body **deletes** the targeted key (where the key is nullable / not required).
- Keys omitted from the patch body are **unchanged** (no "absent = null" inference).
- Arrays are **replaced in full**, not merged element-wise — `["a","b"]` patched with `["c"]` becomes `["c"]`, not `["a","b","c"]`.

This is the **durable decision**. Specific behaviors (which keys are nullable/deletable on a given resource, what an array-merge-vs-replace looks like for a particular field) are implementation defaults logged in each resource's own story, not in this ADR.

**Rationale (stated for review):** RFC 7396 is the smallest standard that gives partial-update semantics with predictable semantics on missing/null/array fields. It is strictly less expressive than JSON Patch (RFC 6902) — which is rejected here for v1 as "more machinery than any current endpoint actually needs," with the rule-of-three trigger noted (revisit if a third resource genuinely needs targeted-array-element updates).

### 2. Error-code mapping — explicitly split by cause, do not collapse

The application layer maps request failures to HTTP codes as follows. The two "is this a 404 or a 403" cases that matter are split deliberately, because they have different remediation:

| Cause | HTTP code | Body shape | Rationale / source |
|---|---|---|---|
| Resource does not exist **within the caller's tenant** (RLS returned zero rows because the row genuinely isn't there) | **404 Not Found** | `{ code: "not_found" }` | Doesn't leak tenant existence — caller learns only that they can't see this id. ADR-0015 §Consequences already names RLS as the enforcement layer. |
| Resource exists in **another** tenant (RLS returned zero rows because cross-tenant) | **404 Not Found** | Same body shape — *identical* to the above | Prevents cross-tenant existence enumeration; this is the explicit cross-tenant case, named as not distinguishable from the same-tenant not-found case. |
| Resource exists in caller's tenant, but caller is authenticated as `role = 'tenant_user'` and the action requires `role = 'tenant_admin'` (ADR-0030 §1) | **403 Forbidden** | `{ code: "forbidden", required_role: "tenant_admin" }` | **Not 404.** Tenant-Admin's authorization failure is an *application-layer role check* (ADR-0030 §1), not a tenant boundary — collapsing it into 404 would hide authorization bugs from logs and from the Tenant-Admin's own debugging. Caller already knows the resource exists (they're in the same tenant); hiding that information here has no security benefit. |
| Body fails validation (e.g. invalid filter AST node, unknown match type) | **422 Unprocessable Entity** | `{ code: "validation_failed", details: [...] }` | Standard 422 use; distinguishes "I understood your request but can't apply it" from "I couldn't parse your request" (400). |
| Body is not parseable JSON, or has wrong shape | **400 Bad Request** | `{ code: "bad_request" }` | Standard 400 use. |
| PATCH applied with stale `If-Match` (optimistic-locking version mismatch — see §3) | **409 Conflict** | `{ code: "version_conflict", current_version: <int> }` | Standard 409 use; explicit code so the client can refetch and retry rather than blindly re-applying. |
| Optimistic-locking version column missing from a PATCH request where the resource is configured to require it | **428 Precondition Required** | `{ code: "precondition_required" }` | RFC 6585. Distinct from 400 because the body *is* parseable; what's missing is the precondition header/field. |
| Rate-limited (ADR-0003, ADR-0040) | **429 Too Many Requests** | per ADR-0040's response shape | Cross-reference, not re-decided. |

This mapping applies to every `/v1` mutable endpoint, not just `/v1/watchlists`. Per-endpoint deviations are logged in that endpoint's own story with a "deviates from ADR-0044 §2 because…" rationale — deviations are not silent.

### 3. Optimistic locking — version column, when required

Every `/v1` resource whose PATCH is non-idempotent in a way that matters (a concurrent PATCH from another admin on the same row would produce a silently-lost update) carries a `version integer not null default 1` column. PATCH requests must include the version they observed (via `If-Match: "<version>"` header); a mismatch returns 409 with the current version in the body (per §2).

**Required by default for v1:** `watchlists`. (Story 1.5 is the first mutable resource; this column is added to its table.)

**Not required by default for v1:** resources where a concurrent PATCH is structurally impossible in the current codebase — e.g. resources whose only mutation is INSERT-then-archive (no in-place PATCH). Per-resource opt-in is decided in that resource's own story.

### 4. `updated_at` policy — trigger-set on mutable tenant-scoped tables, exempt list explicit

Mutable tenant-scoped tables in this project get their `updated_at` column maintained by a Postgres `before update` trigger, not by application code:

- **Reason:** keeps `updated_at` honest in the face of any write path — direct SQL, migrations, future code paths that forget the SET clause — the same RLS-style "DB-enforced invariant" argument ADR-0015 makes for tenant isolation.
- **Exempt, explicitly:**
  - `IngestionRun` — ADR-0005's "immutable acquisition/audit anchor." No `updated_at` column, no `before update` trigger. An attempt to UPDATE an `IngestionRun` row must fail at the application layer (per ADR-0005 §Decision's spirit of immutability).
  - `platform_admin_audit_log` — append-only audit log; no `updated_at`, no UPDATE allowed.
  - Any other table the project explicitly designates as append-only — added to this exempt list at that table's own ADR / migration, not invented here.
- **Trigger shape (illustrative — implementation detail in the migration):**
  ```sql
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
  applied per-table as `CREATE TRIGGER ... BEFORE UPDATE ON <table> ... EXECUTE FUNCTION set_updated_at()`.
- **New mutable tenant-scoped tables get this trigger by convention; the absence of it on a new mutable table is a PR-review finding**, not silent.

### 5. `watchlists` row shape — reconciled with ADR-0021

The `watchlists` table has columns:

```sql
watchlists
  id                uuid primary key default gen_random_uuid()
  tenant_id         uuid not null references tenants(id)
  name              text not null
  match_type        text not null          -- 'keyword' | 'hashtag' | 'account' | 'boolean'
  terms             text[]                 -- for keyword/hashtag/account: a Postgres array of strings; see §5a
  boolean_query     text                   -- for boolean: the source text parsed by ADR-0021's AST
  version           integer not null default 1   -- §3, optimistic locking
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()   -- §4 trigger-maintained
  -- RLS, indexes per §5b
```

#### §5a. `terms` is **not** the source of truth for boolean matching

For `match_type IN ('keyword','hashtag','account')`, `terms` is a Postgres `text[]` array of strings — matching what migration `0014_create_watchlists.sql` already ships and `WatchlistRow.terms: string[]` in `social-listening-core/src/watchlists/watchlistStore.ts` already types, rather than a JSONB column. The simplest shape that fits three different match-types without an extra per-type table; also the shape Postgres array operators (`&&`, `@>`, `ANY`) actually need for keyword/hashtag/account matching, since `text[]` containment is cheaper than JSONB for this access pattern.

For `match_type = 'boolean'`, `boolean_query` is the source text and is parsed into an AST at query time by the core-layer parser described in ADR-0021 §Decision. **JSONB GIN indexing on `terms` is irrelevant for boolean watchlists** — boolean matching is AST-driven (ADR-0021), not substring/containment-driven, and indexing a column the matching path doesn't read would be a misapplication. Indexing on `terms` is therefore a `text[]` concern, not a JSONB one — for the non-boolean match types this project ships today, the existing `idx_watchlists_tenant_id` / `idx_watchlists_tenant_match_type` indexes on `(tenant_id, match_type)` (migration 0014) are sufficient, since the watchlist-listing path filters by tenant first and only then evaluates per-watchlist containment. A GIN index on `terms` (using `gin(to_tsvector(...))` or a dedicated term-extraction column) is the deferred optimization, not the default; revisit only when watchlist counts per tenant make per-row term lookup measurably slow. Implementation choice left to a future migration if/when traffic data justifies it.

This resolves the apparent conflict between "watchlists store filters as a generic JSONB blob" (the initial, now-rejected, draft of this ADR) and "watchlist matching is AST-driven" (ADR-0021): they apply to disjoint `match_type` values. A boolean watchlist has `terms = NULL` and a populated `boolean_query`; a non-boolean watchlist has the inverse.

#### §5b. RLS — the existing project pattern, not a new one

```sql
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON watchlists
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

Identical shape to every other tenant-scoped table per ADR-0015 (RLS invariant) and ADR-0032 §2 (the most recent accepted precedent for the `NULLIF(... , '')::uuid` cast on `app.tenant_id`). The session variable is **`app.tenant_id`**, propagated by the single authentication middleware ADR-0033 §1 specifies — `app.current_tenant` (named in the initial draft of this ADR) does not exist anywhere else in this codebase and is a typo, corrected here.

### 6. Cross-references to already-decided ADRs (explicit, not re-decided)

- **Tenant identity source:** ADR-0033 §1 — `Authorization: Bearer <token>` validated by the single middleware, resolved to `(tenantId, userId, role)` per ADR-0032 §5; `X-Tenant-Id` is ignored, not merged. This ADR does not re-decide any of this.
- **Watchlist matching logic:** ADR-0006 (connector-side preferred, post-fetch fallback) and ADR-0021 (boolean-query AST + per-connector capability matrix + whole-query degradation for v1). This ADR does not re-decide any of this.
- **API versioning:** ADR-0017 — every endpoint under `/v1/...`; breaking changes require a `/v2/...` successor with a 90-day deprecation window. ADR-0044 itself is not a breaking change to existing endpoints (it adds new contracts to resources that didn't yet have a PATCH); no deprecation window applies to its introduction.
- **Platform Admin's `BYPASSRLS` boundary:** ADR-0030 §2 — locked to `tenants` and `platform_admins` only; the new `watchlists` table is tenant-content and is therefore covered by ordinary `app_user` RLS, not by `platform_admin_role`. Platform Admin never has a path to query `watchlists` rows, full stop.
- **Audit mechanism:** this project's already-decided audit table is `platform_admin_audit_log` (ADR-0030 §5, ADR-0031 §27, ADR-0037 §125), with its own helper. A tenant-content mutation audit trail (the prior draft of this ADR proposed `activity_logs`) is **not designed here** — it would be a separate, future ADR if/when Story 1.5 or its successors actually need durable per-mutation history for compliance (the current decision: rely on `version` (§3) + `updated_at` (§4) for change-tracking; revisit if a real compliance need surfaces).
- **`supportedQueryFeatures` surfacing:** deferred to ADR-0021's own accepted answer — connector status page + watchlist-detail-view badge — not re-decided here.

## Consequences

**Positive**

- PATCH semantics, error mapping, optimistic locking, and `updated_at` policy are now durable, project-wide rules with one canonical answer each — eliminating the per-endpoint divergence risk that would otherwise lock in as more resources become mutable.
- The watchlist row shape is reconciled with ADR-0021's AST model rather than silently introducing an alternative matching model — no future connector author has to choose between two contradictory "what does a watchlist look like" sources.
- §4's exempt-list discipline (`IngestionRun`, `platform_admin_audit_log`, anything else named append-only) keeps the "trigger-set `updated_at`" rule from quietly violating ADR-0005's immutability invariant.
- §2's explicit 403-vs-404 split preserves the signal that distinguishes "you can't see this row at all" (404) from "you can see this row but you can't do this action" (403) — a distinction Tenant-Admin needs for debugging, and that ADR-0030 §1 already implies must exist.

**Negative**

- §1's RFC 7396 decision is a project-wide commitment; any future endpoint that would benefit from RFC 6902 (JSON Patch, targeted array-element updates) needs a deliberate exception logged in its own story, not silent divergence.
- §3's `version` column requires every client of a versioned PATCH to implement `If-Match` handling — a real, small client-side cost in exchange for the lost-update prevention.
- §4's trigger-maintained `updated_at` is a Postgres-level decision; any future read-replica or async-replication setup must propagate trigger executions correctly (true of all triggers, not new here, but named for completeness).

## Alternatives Considered

- **Per-endpoint PATCH semantics, no project-wide standard** — rejected: would lock in divergent shapes as each endpoint is built, exactly the divergence this ADR exists to prevent.
- **Always 404 for both cross-tenant and same-tenant authorization failures** (the prior draft's approach) — rejected: collapses the cross-tenant case (which genuinely must be 404 to prevent enumeration) with the Tenant-Admin role-check case (which must remain 403 to preserve debuggability per ADR-0030 §1). §2's split is the reasoned-through answer.
- **JSON Patch (RFC 6902) instead of JSON Merge Patch** — rejected for v1: more expressive, but no current endpoint actually needs targeted-array-element updates; rule-of-three trigger noted.
- **Application-set `updated_at`, no trigger** — rejected: places the invariant on every future write path getting it right, exactly the failure mode ADR-0015 already argues against for RLS.

## Open Questions for decision

- **Watchlist creation authorization — which `users.role` values may create a watchlist in a tenant.** ADR-0032 §1 establishes `role ∈ {'tenant_admin', 'tenant_user'}` for v1 and ADR-0030 §1 places this as an application-layer role check; whether Tenant-Users may create their *own* watchlists (read-only access model) or only Tenant-Admins may create them is a real product question, not a technical one. Left for whoever drafts the watchlist-creation story to propose with a default.
- **Whether a real compliance need will eventually surface for tenant-mutation audit history** (vs. the current `version`+`updated_at` change-tracking) — if yes, a separate ADR for an `activity_logs` table naming is the right place; this ADR deliberately doesn't pre-decide the schema for a need that hasn't materialized.
- **Whether the partial-GIN-on-`terms`-where-`match_type!=boolean` (§5a) or a separate-column split is the cleaner migration** — implementation choice; both forms are acceptable under this ADR.

## Amendment Log

- 2026-08-08 — Initial proposal (this draft), drafted by the AI Business & Requirements Analyst persona, in response to a review finding that the prior draft of this ADR re-decided ADR-0015/0017/0030/0033 and silently conflicted with ADR-0021. This revision scopes the durable decisions to the four actually unanswered questions and explicitly cross-references the rest.
- 2026-08-08 — **Revised in place, same day**, after a second review pass against the actual codebase: (a) `terms` is `text[]` (a Postgres array), not `jsonb` as the prior version of this revision proposed — migration `0014_create_watchlists.sql` and `social-listening-core/src/watchlists/watchlistStore.ts`'s `WatchlistRow.terms: string[]` both already use `text[]`, and Postgres array operators are the simpler match primitive for keyword/hashtag/account containment than JSONB containment would be; the JSONB-GIN discussion in §5a is reframed as a deferred optimization, not a default. (b) The `updated_at` trigger function name is corrected to `update_updated_at_column()` (matching what migration 0014 already defines), not `set_updated_at()` (which the prior version illustratively invented). Two `plpgsql` functions doing the same thing under different names would silently drift, so naming consistency with the shipped migration is the right default. Per this project's own in-place-revision-before-acceptance convention (ADR-0030/ADR-0031/ADR-0032's own precedent), this does not reopen this ADR's Status — it remains **Proposed**.

## Note on relation to ADR-0041 (no relation)

This ADR does not interact with ADR-0041's "Platform Admin is a distinct identity kind" rule. Platform Admin's continued lack of any path to `watchlists` rows is enforced by §6's reference to ADR-0030 §2, which ADR-0041 already notes relation to.