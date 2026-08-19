# ADR-0063: Post-watchlist match persistence — `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId` server-side filter

**Status:** Accepted (2026-08-19)

**Accepted by Menno 2026-08-19**, verbatim: *"ADR-0063 cleanly solves the architectural prerequisite for watchlist filtering, bridges the gaps left in ADR-0062, and provides a clear path forward for both backend (Story 3.11) and frontend (Story 8.9) execution. You are fully cleared to accept ADR-0063 and unblock the associated stories."* **Story 3.11** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`) moves from Blocked to **Ready**. **Story 8.9** (`docs/user-stories/epic-8-analytics-dashboard.md`) moves from "Blocked — pending ADR-0063 acceptance" to "Blocked — pending Story 3.11 implementation and Story 8.7 build". Per this series' own "no story until acceptance" precedent (ADR-0024/0026), both stories are now eligible to enter the implementation queue in dependency order.

**Source:** ADR-0062 Open Question 1 (2026-08-19), which named this junction table as "the proper long-term path for a fully accurate server-side filter" while adopting a client-side approximation (`activeWatchlistFilter`) as a stepping stone. Menno's direct request (2026-08-19): "could you please review the decline of the Topics Filter and align the Topics to the Watchlist already available in the systems?" — the alignment was partially addressed in ADR-0062 Decision §3; this ADR completes it by providing the server-side foundation ADR-0062 explicitly deferred.

## Context

### Why post-to-watchlist match results are not currently persisted

Post-to-watchlist matching runs in-process at ingestion time, inside `runIngestionAttempt()`, using:

- **`WatchlistTerms` path (ADR-0006/Story 3.3):** `listActiveWatchlistsForTenant()` → `matchPostsForWatchlist()` → `matchesWatchlist()` — keyword/hashtag/account OR-semantics matching.
- **Boolean AST path (ADR-0021/Story 3.6):** `resolveWatchlistAstDispatch()` → `matchPostsForWatchlistAst()` → `matchesAst()` — full AND/OR/NOT/TERM/HASHTAG/ACCOUNT evaluation.

ADR-0058 (Story 2.13) wired the match results into `SocialPostIngestedEvent` publishing — each event carries which watchlists a post matched, so downstream subscribers can filter their own notification queues. The computed match result is available inside `runIngestionAttempt()` at that moment. It is then discarded: no table persists the `(post_id, watchlist_id)` pairs after the event is published.

This means:
- `GET /v1/posts` has no `watchlistId` filter parameter — the posts router (`postsRouter.ts`) can only filter by cursor and limit.
- `SocialPostSummary` carries no `matchedWatchlistIds` field — the admin UI cannot tell which posts matched which watchlists without re-running the matching logic client-side.
- The Watchlist Coverage widget (ADR-0062 Decision §8) was explicitly not built because no real per-watchlist post count exists.

### What ADR-0062 Decision §3 adopted as a stepping stone

ADR-0062 Decision §3 introduced `activeWatchlistFilter` — a client-side approximation:

- Fetches the user's active watchlists from `GET /v1/watchlists` (already exists).
- For `keyword`/`hashtag` `matchType` watchlists only: matches each `terms[]` entry case-insensitively against the post's `bodyMarkdown` field (ADR-0053/Story 3.10).
- Excludes `boolean_query` watchlists — re-implementing the full boolean AST client-side carries a fidelity risk against the server's own `matchesAst()` path (ADR-0021 consistency mandate).
- The mismatch vs. server-side ingestion semantics is disclosed in a tooltip.

This was a deliberate stepping stone: it delivers a functional Watchlist-based filter to the UI with zero new backend surface. ADR-0062 Open Question 1 explicitly named the junction table as the next step.

### Verification: what already exists and what this ADR adds

| Component | Exists today? | This ADR |
|---|---|---|
| `GET /v1/watchlists` | Yes — returns `{ watchlists: Watchlist[] }` | Unchanged |
| `matchesWatchlist()` / `matchesAst()` | Yes — in-process at ingestion | Unchanged |
| `listActiveWatchlistsForTenant()` | Yes — called during ingestion for ADR-0058 events | Unchanged |
| `post_watchlist_matches` table | No | Adds |
| Writing match records at ingestion | No | Adds (inside existing `runIngestionAttempt()` path) |
| `GET /v1/posts?watchlistId=<id>` | No | Adds (new optional query parameter) |
| `activeWatchlistFilter` in admin UI (client-side) | Yes — ADR-0062 Decision §3 | Superseded by Story 8.9 when built |

---

## Decision

### 1. `post_watchlist_matches` junction table

A new migration adds:

```sql
CREATE TABLE post_watchlist_matches (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID          NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  watchlist_id  UUID          NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  tenant_id     UUID          NOT NULL,
  matched_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (post_id, watchlist_id)
);

CREATE INDEX idx_pwm_watchlist_id ON post_watchlist_matches (watchlist_id, tenant_id, matched_at DESC);
CREATE INDEX idx_pwm_post_id      ON post_watchlist_matches (post_id, tenant_id);

ALTER TABLE post_watchlist_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY pwm_tenant_isolation ON post_watchlist_matches
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Column notes:**

- `tenant_id` is denormalized onto the junction table to satisfy RLS using the same `app.tenant_id` session predicate already established by `social_posts` and `watchlists` — avoiding a JOIN to either parent table in every policy check.
- `ON DELETE CASCADE` on both FKs: deleting a post or deleting a watchlist automatically removes its match records. No orphaned rows, no explicit cleanup story needed.
- `UNIQUE (post_id, watchlist_id)` prevents double-insertion on retry without requiring an upsert — `INSERT ... ON CONFLICT DO NOTHING` is safe and idempotent.

### 2. Writing match records at ingestion

Inside `runIngestionAttempt()`, the watchlist-match call already happens for ADR-0058's event publishing. This ADR extends that path:

After `matchPostsForWatchlist()` / `matchPostsForWatchlistAst()` produces the `(post, watchlist)` pairs for each connector run, insert the matched pairs into `post_watchlist_matches`:

```typescript
await insertPostWatchlistMatches(tenantId, matchedPairs);
// matchedPairs: Array<{ postId: string; watchlistId: string }>
```

`insertPostWatchlistMatches()` is a new store function in `socialPostStore.ts` (or a new `postWatchlistMatchStore.ts`). It issues a single batch INSERT with `ON CONFLICT (post_id, watchlist_id) DO NOTHING` — idempotent on retry, matching ADR-0005's own "ingestion run as immutable audit anchor" pattern.

**Best-effort semantics:** failure to insert match records must never block or fail ingestion of the post itself. The INSERT is wrapped such that an error is logged (to the same connector health telemetry path ADR-0009/ADR-0010 establish) but `runIngestionAttempt()` continues. A post missing from `post_watchlist_matches` is a soft inconsistency (worse UX, but not data loss); a failed ingestion is hard data loss.

### 3. `GET /v1/posts?watchlistId=<id>` filter parameter

`postsRouter.ts` gains a new, optional `watchlistId` query parameter. When present:

- Validate that it is a valid UUID; return `400` with `{ code: 'INVALID_WATCHLIST_ID' }` if not.
- Validate that a watchlist with this `id` exists and belongs to the calling user's tenant via the existing RLS context; return `404` with `{ code: 'WATCHLIST_NOT_FOUND' }` if not (same 404-vs-403 split as ADR-0044 Decision §5c — a cross-tenant or not-found watchlist ID surfaces as 404, never 403, matching the watchlist CRUD contract).
- The SQL query JOINs `post_watchlist_matches` on `post_id = social_posts.id AND watchlist_id = $watchlistId`. RLS on both `social_posts` and `post_watchlist_matches` enforces tenant isolation without any additional application-layer predicate.
- Cursor-based pagination (ADR-0011) is fully preserved — `matched_at DESC` ordering on the junction table index aligns with `publishedAt DESC` on `social_posts`, ensuring consistent cursor semantics.

No change to `SocialPostSummary`'s shape — the filter is server-side; the response is the same `SocialPostSummary[]` already defined.

### 4. Staleness on watchlist update — v1 accepted trade-off

When a watchlist's `terms[]` or `boolean_query` changes, existing `post_watchlist_matches` rows reflect the match semantics at the time of ingestion, not the current watchlist definition. New posts ingested after the update use the new definition; historical posts do not. At v1 this staleness is accepted: re-indexing historical posts on every watchlist edit is a background-job concern (its own ADR, own story, own operational risk) that has no demonstrated need at this project's current tenant scale. Named as Open Question 2 so a future architect finds it, not re-derives it.

### 5. Historical backfill — deferred

Posts ingested before this table is created have no match records. At v1 no retroactive backfill migration runs: the backfill would re-evaluate every `social_posts` row's `bodyMarkdown` against every tenant's active watchlists — a full table scan at migration time that adds cost, risk, and a meaningful deployment window. Feasible using the existing `matchesWatchlist()`/`matchesAst()` fallback matchers (no new logic needed), but named as Open Question 1 rather than built in.

### 6. Downstream enablement: `activeWatchlistFilter` server-side upgrade (`social-listening-admin`)

Once Story 3.11 is built:

- `activeWatchlistFilter` in Story 8.7 can be upgraded to pass `?watchlistId=<id>` to `GET /v1/posts` instead of applying a client-side predicate against `bodyMarkdown`.
- The upgraded filter is accurate for all watchlist `matchType` values, including `boolean_query` watchlists the client-side approximation excluded.
- The tooltip disclosure ("Approximate match — based on keyword terms in post text; advanced boolean watchlists are not included") is retired.

This upgrade is **Story 8.9** — a separate `social-listening-admin`-only change, no new `social-listening-core` surface beyond what Story 3.11 already adds, and depends on Story 3.11 being built.

### 7. Downstream enablement: Watchlist Coverage widget (`social-listening-admin`)

ADR-0062 Decision §8 excluded the Watchlist Coverage (PieChart donut) widget: the specification itself acknowledged "static for now, pending real watchlist matching API," and this project's no-fabricated-placeholder discipline confirmed it cannot be built honestly without real per-watchlist post counts.

Once Story 3.11 is built, a per-watchlist post count is:

```sql
SELECT watchlist_id, COUNT(*) AS post_count
FROM post_watchlist_matches
WHERE tenant_id = current_setting('app.tenant_id')::uuid
GROUP BY watchlist_id;
```

The Watchlist Coverage widget becomes buildable. It is not a new REST endpoint — the existing `GET /v1/watchlists` response can be extended to carry `postCount` (a new, nullable field, zero-cost addition to the existing response), or the widget can call `GET /v1/posts?watchlistId=<id>` once per active watchlist and use the returned total. The implementation choice is Story 8.9's own judgment. This does not change `GET /v1/watchlists`'s own contract or any existing caller.

A dated "Pending supersession note" is added to ADR-0062 Decision §3 (`activeWatchlistFilter`) and Decision §8 (Watchlist Coverage "not built" row), taking effect only if and when this ADR is accepted.

---

## Consequences

**Positive**

- `GET /v1/posts?watchlistId=<id>` enables proper server-side watchlist filtering — accurate for all `matchType` values (keyword, hashtag, account, boolean AST), RLS-enforced, covering the `boolean_query` watchlists the client-side approximation excluded.
- The Watchlist Coverage widget becomes buildable with real data.
- `activeWatchlistFilter`'s client-side approximation (ADR-0062 Decision §3) can be retired in Story 8.9 — better accuracy, less client-side work, tooltip disclosure no longer needed.
- Match records are written once at ingestion — no per-request re-evaluation of watchlist terms against the full post set.
- Idempotent writes (`ON CONFLICT DO NOTHING`) make the ingestion retry path safe without additional handling.

**Negative**

- New migration and new table to maintain. `post_watchlist_matches` grows proportionally to `posts × active_watchlists_per_tenant` — a real storage cost for tenants with many active watchlists and high post volumes (Open Question 3).
- **Staleness on watchlist update:** when a watchlist's `terms[]` or `boolean_query` changes, existing match records reflect the old definition. Historical posts are not re-matched (Open Question 2).
- **Historical gap:** posts ingested before this table exists have no match records. `GET /v1/posts?watchlistId=<id>` returns an honest result — only posts ingested after Story 3.11 is deployed — but that gap may surprise a tenant expecting a full historical view (Open Question 1).
- `runIngestionAttempt()` gains one additional best-effort write per ingestion call. The write is batched and non-blocking; the performance impact is expected to be negligible at this project's current scale, but is named rather than assumed.
- Story 8.7's `activeWatchlistFilter` approximation (client-side, keyword/hashtag only) and Story 8.9's server-side upgrade are two separate shipped states. During the gap between Stories 8.7 and 8.9, the UI uses the approximation; after Story 8.9, it uses the server-side parameter. This is a named, temporary inconsistency, not a permanent design flaw.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Client-side approximation (ADR-0062 Decision §3 `activeWatchlistFilter`)** | Adopted as a stepping stone. Limited to `keyword`/`hashtag` watchlists, matches post-fetch against `bodyMarkdown`, does not cover `boolean_query` watchlists, and matches client-side semantics rather than the server-side ingestion pass. This ADR provides the proper long-term path; Story 8.9 retires the approximation. |
| **Store `matchedWatchlistIds UUID[]` directly on `social_posts`** | Rejected. An array column on `social_posts` is harder to query efficiently for the "which posts matched this watchlist?" direction (requires `= ANY()` or unnest), carries unbounded growth, and is not a normalized design for a genuine many-to-many relationship. The junction table is the standard relational pattern. |
| **Re-run watchlist matching at `GET /v1/posts` query time — no persisted records** | Rejected. This would require fetching post body text and every active watchlist's terms for every API request — the same per-request full-set evaluation ADR-0054 Decision §3 specifically rejected as a data-source strategy. The cost scales with both post volume and watchlist count, not just one. |
| **Retroactive backfill migration — populate historical match records at migration time** | Deferred. Feasible using the existing `matchesWatchlist()`/`matchesAst()` fallback matchers; no new matching logic needed. Not built in v1 because a full `social_posts` table scan at migration time adds deployment risk with no demonstrated demand. Named as Open Question 1. |
| **A separate `POST /v1/watchlists/:id/reindex` endpoint — trigger a background backfill on demand** | Named, not designed. A reasonable operational tool if a tenant discovers their historical post view is incomplete after Story 3.11 ships. Named here as a design direction; not built speculatively. |

---

## Open Questions

1. **Historical backfill** — posts ingested before this table exists have no match records. A backfill using the existing `matchesWatchlist()`/`matchesAst()` fallback matchers is feasible but not built in v1. Named so a future story can add it if demonstrated tenant need warrants — e.g. a `POST /v1/watchlists/:id/reindex` on-demand endpoint, or a one-time migration job.

2. **Staleness on watchlist update** — when a watchlist's `terms[]` or `boolean_query` changes, existing match records reflect the old definition. A re-match trigger (e.g. re-running `matchesWatchlist()`/`matchesAst()` over affected posts on UPDATE of `watchlists`) or an explicit per-watchlist reindex endpoint would address this. Deferred; named as a known risk. For `keyword`/`hashtag` watchlists a re-match is straightforward (evaluate `terms[]` against `body_markdown`); for `boolean_query` watchlists it requires running the full AST evaluator, which is available in `social-listening-core`'s `matchesAst()`.

3. **Storage ceiling** — for tenants with many active watchlists and high post volumes, `post_watchlist_matches` grows proportionally (`posts × active_watchlists_per_tenant`). An explicit row cap per tenant, a TTL aligned with ADR-0018's own 90-day `rawPayload` retention window, or partitioning by `tenant_id`/`matched_at` is left to a future ADR if a real capacity signal emerges. Nothing at this project's current tenant scale warrants it speculatively.

4. **`GET /v1/watchlists` response and `postCount` field** — once Story 3.11 is built, `GET /v1/watchlists` could optionally carry a `postCount` per watchlist (a cheap `COUNT` join on `post_watchlist_matches`). Whether to add this to the response shape, or leave it to the Watchlist Coverage widget to aggregate via its own `GET /v1/posts?watchlistId=<id>` calls, is Story 8.9's implementation-time judgment. Not fixed here as a durable response-shape commitment.

---

*Drafted 2026-08-19 by the orchestrating session, at Menno's direct request to align the Topics filter with the existing Watchlist system. Verified directly before drafting: `social-listening-core/src/http/versions/v1/postsRouter.ts` (confirmed no `watchlistId` parameter exists); `social-listening-core/src/posts/socialPostStore.ts` (confirmed `SocialPostSummary` carries no `matchedWatchlistIds`); `social-listening-core/src/watchlists/` (confirmed matching logic exists and is available for reuse); `social-listening-core/src/ingestion/ingestionRunner.ts` (confirmed `runIngestionAttempt()` is the right insertion point); ADR-0058/`docs/adr/0058-wire-ingestion-events-into-real-connector-pipeline.md` (confirmed `listActiveWatchlistsForTenant()` + match call already happens in the ingestion path). Left **Proposed**, per this project's ADR-acceptance authority convention — Menno (Sponsor) reviews and accepts separately. Per this series' own "no story until acceptance" precedent (ADR-0024/0026), **Story 3.11** (`social-listening-core`: junction table + ingestion write + `GET /v1/posts?watchlistId` filter) and **Story 8.9** (`social-listening-admin`: `selectedTopic` watchlist filter + Watchlist Coverage widget) are drafted alongside this ADR, both **Blocked — pending ADR-0063 acceptance**. Story 8.9 additionally depends on Story 3.11. **Accepted by Menno 2026-08-19** — see acceptance note above Status line. Story 3.11 is now **Ready**; Story 8.9 remains **Blocked — pending Story 3.11 implementation and Story 8.7 build**.*

---

## Amendment Log

- **Documentation Steward correction, 2026-08-19 (later the same day)** — six references above (the Source paragraph; Decision §6's heading and first bullet; Decision §7's closing paragraph; the second Positive-consequences bullet; the last Consequences bullet; and the first row of Alternatives Considered) describe `activeWatchlistFilter` as an already-adopted client-side stepping stone from "ADR-0062 Decision §3." That was accurate at the moment this ADR was drafted (`2f605b6`), but was superseded one commit later that same day, *before* this ADR was accepted: `6eb6062` ("docs(adr): block selectedTopic/Watchlist on ADR-0063 in ADR-0062, Story 8.7, Story 8.9") removed `activeWatchlistFilter` from ADR-0062 entirely, per Menno's direct instruction that watchlist filtering be a hard dependency on this ADR rather than a client-side approximation. That commit renamed ADR-0062 Decision §3 to "Filter state model and Explicit ADR-0063 Dependency," moved the watchlist selector to a new "Explicitly Blocked (Awaiting ADR-0063)" category, and — critically — removed the pending-supersession-note instruction from ADR-0062 Decision §8 that this ADR's own Decision §7 still tells a reader to go add. Story 8.7 (Built 2026-08-17, confirmed against `docs/implementation-log.md`) shipped with the watchlist-selector slot fully unwired; no `activeWatchlistFilter` code was ever built anywhere in `social-listening-admin`. Story 3.11 and Story 8.9, drafted alongside this ADR, already reflect the corrected, walked-back reality — Story 8.9's first Acceptance Criterion is headed "implement (not upgrade)" and states "No client-side `terms[]`-matching predicate is introduced." **Consequently, Decision §7's instruction to add a "Pending supersession note" to ADR-0062 Decision §3/§8 is moot and should not be actioned** — that content no longer exists in ADR-0062 to annotate. No Decision, Consequences, or Alternatives Considered text above is edited by this note, per this series' own append-only convention for Accepted ADRs; the `activeWatchlistFilter` references above should be read as historical context describing a stepping-stone that was proposed and then withdrawn before this ADR's acceptance, not as a mechanism that ever shipped.

- **Correction discovered during Story 3.11's own implementation, 2026-08-19 — `post_watchlist_matches.post_id` cannot carry the `REFERENCES social_posts(id) ON DELETE CASCADE` foreign key Decision §1's snippet and Column notes specify.** Confirmed empirically while running the migration (Postgres error: "there is no unique constraint matching given keys for referenced table `social_posts`"), not assumed. Root cause: `social_posts` was partitioned by `created_at` in migration `0012` (Story 3.5, ADR-0018) — *before* this ADR was drafted — which forced its primary key to become composite, `PRIMARY KEY (id, created_at)`, a hard Postgres requirement for partitioned tables (a partition's unique/PK constraints must include the partition key). `social_posts.id` alone has had no unique constraint to reference since that migration, so `REFERENCES social_posts(id)` fails regardless of how it's written — this ADR's own drafting session verified `postsRouter.ts`, `socialPostStore.ts`, `watchlists/`, and `ingestionRunner.ts` before writing Decision §1 (see the provenance note below), but did not check `social_posts`'s actual partitioned schema, where this conflict was already sitting.

  **This is not a new category of problem for this codebase.** `data-retention-and-archival/SKILL.md`'s own load-bearing constraints document the identical conflict, discovered and resolved once already, for `social_posts.acquisition_id → ingestion_runs(id)`: a real FK there is also incompatible with `archiveAgedRawPayloads()`'s own partition-detach cycle (Postgres refuses to detach a partition any live FK still points into), so that FK was dropped in favor of application-level enforcement — "confirmed with the user before dropping the constraint," per migration `0012`'s own comment. `post_id` follows the identical precedent: no DB-enforced FK into `social_posts`, enforced instead by `insertPostWatchlistMatches()`'s only real caller (`publishSocialPostIngestedEvents()`) always passing a real, just-inserted post id — the same tier `acquisition_id`/`author_id` already partly rely on. `watchlist_id → watchlists(id) ON DELETE CASCADE` is unaffected and unchanged — `watchlists` is not partitioned, so its own unique `id` constraint is intact.

  **Why this does not jeopardize this ADR's actual intent.** The ADR's purpose — a real, queryable, RLS-enforced junction table that lets `GET /v1/posts?watchlistId=<id>` filter server-side instead of re-evaluating watchlist terms per request (Decision §2/§3, this ADR's entire reason for existing) — is fully intact: every other structural element (the table itself, both indexes, the `UNIQUE (post_id, watchlist_id)` idempotency constraint, the `tenant_id`-denormalized RLS policy, the ingestion-time write path, the `GET /v1/posts` filter and its 400/404 semantics) is unchanged and unaffected by this correction. The one thing genuinely given up is the `ON DELETE CASCADE` half of Decision §1's Column notes ("deleting a post... automatically removes its match records. No orphaned rows, no explicit cleanup story needed") for the `post_id` side specifically — and that guarantee is currently theoretical, not active: confirmed directly (`grep DELETE FROM social_posts` across `src/`) that no code path in this repo hard-deletes an individual `social_posts` row today. If one is ever added, it would need to explicitly clean up `post_watchlist_matches` rows itself, the same already-accepted trade-off `acquisition_id` lives with today for `ingestion_runs`. `watchlist_id`'s own cascade (the more operationally real of the two — watchlists genuinely do get deleted via existing CRUD) is untouched.

  Decision §1's code snippet and Column notes above are left as originally drafted, per this series' own append-only convention for Accepted ADRs — read `post_id`'s `REFERENCES social_posts(id) ON DELETE CASCADE` there as superseded by this note, not as the as-built schema. The as-built migration (`migrations/0036_create_post_watchlist_matches.sql`) and `.claude/skills/post-watchlist-match-persistence/SKILL.md` carry the corrected, real schema.
