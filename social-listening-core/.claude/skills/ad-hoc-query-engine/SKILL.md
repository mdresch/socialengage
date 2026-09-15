---
name: ad-hoc-query-engine
description: Parameterized ad-hoc multi-dimensional analytics query builder and endpoint POST /v1/analytics/query (ADR-0088, Story 10.4), hardened by Story 17.2 — actually Story 17.4 (ADR-0132, TDS-0132): immutable AST query templates, EXPLAIN cost governor, tighter transactional safeguards, RBAC role gating. Read this before touching src/analytics/adHocQueryEngine.ts, src/analytics/queryGovernor.ts, or the /query handler in src/http/versions/v1/analyticsViewsRouter.ts.
---

# Ad-Hoc Analytics Query Engine (ADR-0088 + ADR-0132)

## What this is

`POST /v1/analytics/query` — multi-dimensional aggregation over `social_posts` for tenant analytics callers. Story 10.4 (ADR-0088) built the baseline; Story 17.4 (ADR-0132, TDS-0132 — the real spec; the ADR/BRD/FDD trio are terse stubs) hardened it into a governed, AST-compiled engine.

Pipeline per request: `compileAdHocQuery()` builds an **immutable AST template** → `executeGovernedQuery()` runs `EXPLAIN (FORMAT JSON)` for a pre-execution cost check → `SET LOCAL` session safeguards → the bound query executes → results serialize as JSON or CSV.

## Contracts that constrain this component

- `contracts/epic-10/story-10.4.ad-hoc-query-endpoint.contract.test.ts` — baseline aggregation shape, CSV format, allowlist 400s (tenant_user remains authorized under the RBAC matrix — see role gating below).
- `contracts/epic-17/story-17.4.ast-query-governor.contract.test.ts` — AST immutability/parameterization, governor 422 end-to-end, session-setting readback, 5,000-row cap, role gating + tenant isolation.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0088 | Ad-hoc query endpoint — allowlisted dimensions/metrics/grains, JSON+CSV | 10.4 |
| ADR-0132 / TDS-0132 | AST template parameterization + execution budget governor | 17.4 |
| ADR-0107 | RBAC permission matrix — `hasPermission(role, 'analytics', 'read')` is the gate | 12.13 |
| ADR-0015 | Tenant isolation via `withTenant()` transaction-local `app.tenant_id` | — |

## Load-bearing constraints — do not change casually

- **No request data ever enters SQL text.** `compileAdHocQuery()` returns `{ ast, sql, params }` where `ast` is deep-frozen (`Object.freeze` on the object, its dimension/metric arrays, and its filters) and every user value binds as a positional `$N`. Identifiers and expressions come only from the fixed fragment tables keyed by the allowlist enums — a hostile filter value must appear in `params`, never in `sql`.
- **The governor runs `EXPLAIN (FORMAT JSON)` before every execution**, same transaction, same bound params. `Plan['Total Cost'] > maxEstimatedCost` (default 10,000) throws `QueryCostExceededError` → the route maps it to **422** with `{ error: 'QUERY_COST_EXCEEDED', estimatedCost, budgetLimit, suggestedAdjustments }`. The query never executes on rejection.
- **Session safeguards are `SET LOCAL` inside `withTenant()`'s transaction** — `statement_timeout = '3000ms'` and `work_mem = '32MB'`. The governor then reads them back via `SELECT current_setting(...)` and returns them in the response's `governor.appliedSettings` block — that's what makes the safeguard contract-verifiable rather than self-reported. Postgres normalizes the display (`'3s'`, `'32MB'`/`'32768kB'`).
- **Row cap is 5,000**, enforced on the LIMIT bind parameter (`Math.min(config.maxRowsReturned, ...)`) — raised from Story 10.4's 1,000 by ADR-0132.
- **Role gating uses the ADR-0107 permission matrix**, `hasPermission(identity.role, 'analytics', 'read')` — *not* a hardcoded role list. This is the deliberate reconciliation of Story 17.4's "(`tenant_admin`, `analyst`)" wording with two real constraints: (1) `analyst` exists in `permissionMatrix.ts` but the `users.role` CHECK constraint (migration 0081) only admits `tenant_admin`/`tenant_user`/`tenant_brand_reputation_manager`, so no real user can hold it yet — the gate still honors it if the constraint ever widens; (2) `tenant_user` carries `analytics: 'read'` in the same matrix, and Story 10.4's contract asserts `tenant_user` gets 200. Do not narrow to a literal two-role allowlist without breaking a passing contract.
- **Config is env-overridable for operations/tests:** `QUERY_GOVERNOR_MAX_COST`, `QUERY_GOVERNOR_STATEMENT_TIMEOUT_MS`, `QUERY_GOVERNOR_WORK_MEM`, `QUERY_GOVERNOR_MAX_ROWS` are read per call by `getGovernorConfig()`; `executeAdHocQuery` also accepts a `Partial<QueryGovernorConfig>` override. The 17.4 contract drives `QUERY_GOVERNOR_MAX_COST=0.0001` to make the real planner trip the budget end-to-end.

## Known gaps / deferred work / orphaned code

- **`src/http/versions/v1/analyticsQueryRouter.ts` is dead code — never mounted in `router.ts`** (only `analyticsViewsRouter` is, at `/analytics`). It duplicates the `/query` handler with no role gate or governor mapping. Left in place (out of Story 17.4's scope) — do not edit it expecting live behavior, and do not copy from it.
- **`'analyst'` is not a storable `users.role` value** (CHECK constraint: `tenant_admin`, `tenant_user`, `tenant_brand_reputation_manager`). The RBAC matrix row exists; widening the CHECK is a separate migration decision.
- **Precomputed-view routing named in the 10.4 header comment is not implemented** — every query scans `social_posts` (+ `post_watchlist_matches` when needed). The governor's cost ceiling is the guardrail that makes that safe; routing to `*_daily_counts` tables would bypass most governor rejections entirely.
- **TDS-0132 §1.2's traceability matrix cites "Story 17.2"** as its governing story — a doc bug; the governing story is 17.4.

## Relations to other components

- **`withTenant()`** (`src/db/withTenant.ts`) — supplies the transaction the `SET LOCAL`s and `app.tenant_id` RLS context live inside. The AC's `app.current_tenant_id` phrasing maps to this codebase's `app.tenant_id` session variable.
- **`permissionMatrix.ts`** (`src/auth/`) — the role gate's authority. `tenant_admin` → `analytics: 'read_all'`, `analyst`/`tenant_user` → `'read'`; anything else → 403 `PERMISSION_DENIED`.
- **`post_watchlist_matches`** — joined only when the `watchlist` dimension or a `watchlists` filter is present.
- **`social-listening-admin` Story 10.5** — the query UI is this endpoint's client; the 422 `QUERY_COST_EXCEEDED` payload (`estimatedCost`, `budgetLimit`, `suggestedAdjustments`) is what it should render when the governor rejects.
