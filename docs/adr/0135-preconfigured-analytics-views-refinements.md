# ADR-0135: Preconfigured analytics views — refinements

**Status:** Accepted (2026-08-28)

**Authorizes:** a binding correction to how ADR-0087's five `*DailyCount` tables are implemented — as ordinary, RLS-protected Postgres tables only, never literal `CREATE MATERIALIZED VIEW` objects — because PostgreSQL does not support Row-Level Security on materialized views at all; plus two smaller, confirmatory refinements (bi-temporal late-arrival tracking, TimescaleDB deferral).

**Source:** `docs/adr/0087-preconfigured-analytics-views.md` (Accepted 2026-08-27), `27-preconfigured-analytics-views-deep-research.md` (Deep Research Brief, Second Brain vault `raw/`, generated 2026-08-28)

---

## Context

### 1. ADR-0087 already shipped, with a real, load-bearing ambiguity
ADR-0087 was Accepted 2026-08-27 and built 2026-08-28 (Story 10.3, `social-listening-core@fdb9bb8`). Its Decision §2–§3 defines five tables (`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`) with composite primary keys and "a `tenant_id` RLS policy," refreshed by a `RefreshAnalyticsViews` worker (Decision §4). ADR-0087's own Alternatives §1 rejects TimescaleDB continuous aggregates in favor of "plain tables with a scheduled worker," which already points toward ordinary tables — but neither ADR-0087 nor its BRD/FDD ever states, as an explicit, binding rule, that the underlying Postgres DDL must never be `CREATE MATERIALIZED VIEW`. The feature is literally named "preconfigured analytics **views**," the family is called `*DailyCount` **views** throughout BRD-0087/FDD-0087 (FDD-0087 §14 Glossary: "Preconfigured analytics view — a precomputed, tenant-scoped daily aggregate **table**" — note the glossary entry itself conflates "view" and "table"), and the original feature design doc (per the research brief) explicitly left open "whether v1/v2 should use native Postgres continuous aggregates... or plain materialized views with `pg_cron`." That ambiguity is a real risk: an implementer following the feature name and the "materialized views with `pg_cron`" framing could reasonably build these as literal Postgres `MATERIALIZED VIEW` objects.

### 2. PostgreSQL does not support RLS on materialized views — this is not a minor gap
`27-preconfigured-analytics-views-deep-research.md` §4 (PostgreSQL mailing list / community technical discussion, Postgres 15+) establishes, as a hard architectural fact, that `CREATE POLICY` cannot target a materialized view — Postgres refuses the DDL outright, because a materialized view is refreshed under the security context of whoever runs the refresh, not the querying client, so RLS's per-query row filtering has no attachment point during materialization. The documented community workaround — a security-barrier view wrapping the materialized view, filtering by `tenant_id = current_setting('app.tenant_id')` at query time — is explicitly **not** equivalent to true RLS: it lacks RLS's write-path controls and must be manually maintained as an extra layer, never a database-enforced policy on the underlying object. If ADR-0087's tables were ever built as literal materialized views, "a `tenant_id` RLS policy" (Decision §3) would be **impossible to satisfy as literally stated** — this is a genuine, correctness-critical conflict between the Decision text and PostgreSQL's actual capabilities, not a wording nit.

### 3. Two smaller, confirmatory findings
- **Bi-temporal late-arrival tracking** (lakeFS best-practice guide): `RefreshAnalyticsViews` should scope recomputation using an arrival/ingestion timestamp distinct from `published_at`. ADR-0087 Decision §4 already selects "posts with `published_at` in a window and `updated_at` after the last refresh" — `social_posts.updated_at` already serves as this arrival-time signal. This finding **confirms** the existing design rather than changing it; recorded here as a Clarification, not a Decision change.
- **TimescaleDB continuous aggregates:** the research recommends reserving this for a later, scale-driven migration rather than the v1 default, given SocialEngage's Azure-native Postgres deployment (per `CLAUDE.md`) makes a TimescaleDB extension dependency an added operational commitment. This **confirms** ADR-0087's own Alternatives §1 rejection; no change.

---

## Decision

### 1. Carried forward from ADR-0087 unchanged
The five table schemas (Decision §2), composite primary keys and index plan (Decision §3, except as amended in §2 below), the 15-minute `RefreshAnalyticsViews` refresh pipeline and its provisional-current-day handling (Decision §4), query routing (Decision §5), the no-raw-content constraint (Decision §6), `topic_id` sourcing from ADR-0104 (Decision §7), and the scoped, widget-by-widget partial supersession of ADR-0054 (Decision §8) all remain exactly as Accepted and built. This ADR does not reopen any of that.

### 2. Binding correction: ordinary Postgres tables only — literal `CREATE MATERIALIZED VIEW` is prohibited for these five tables
`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` **must** be implemented as ordinary Postgres tables (`CREATE TABLE`), each carrying a genuine `CREATE POLICY` RLS policy scoped by `tenant_id`, following the exact same pattern already used by every other tenant-scoped table in this project (ADR-0015). They **must not**, under any circumstance, be implemented as literal `CREATE MATERIALIZED VIEW` objects, because:
- Postgres cannot attach an RLS policy to a materialized view at all (Context §2) — ADR-0087 Decision §3's "a `tenant_id` RLS policy" is only satisfiable if the underlying object is a table.
- The community-documented security-barrier-view workaround is explicitly weaker than real RLS (no write-path control, manually maintained) and is **rejected** as the primary tenant-isolation mechanism for these tables — see Alternatives below.

`RefreshAnalyticsViews` populates these tables via idempotent upsert (`INSERT ... ON CONFLICT (tenant_id, date, ...) DO UPDATE`), **never** via `REFRESH MATERIALIZED VIEW` or `REFRESH MATERIALIZED VIEW CONCURRENTLY`. This is consistent with — and makes explicit — what ADR-0087's own Alternatives §1 already concluded ("plain tables with a scheduled worker are simpler") and what its Decision §4 ("refresh is idempotent") already implies, but had never stated as a binding prohibition on the underlying DDL.

### 3. Terminology clarification
"Preconfigured analytics view" (and "`*DailyCount` views," used loosely in BRD-0087/FDD-0087) is the **feature/product name** for this capability. The underlying database objects are, and must remain, ordinary Postgres tables. Any future documentation, code comment, or schema migration file that uses "view" to describe these objects should be read as referring to the product concept, not a literal Postgres `VIEW`/`MATERIALIZED VIEW` object. FDD-0087 §14's Glossary entry ("a precomputed, tenant-scoped daily aggregate table") already gets this right operationally, despite the ambiguous product name — this ADR makes that reading binding rather than incidental.

### 4. Clarification: late-arrival recomputation already uses the correct signal
No change to ADR-0087 Decision §4. `social_posts.updated_at` (already the field `RefreshAnalyticsViews` compares against its own last-successful-refresh watermark) is the bi-temporal arrival-time signal the research recommends; this is confirmed as sufficient, not extended.

---

## Alternatives considered

1. **Wrap a true `MATERIALIZED VIEW` in a security-barrier view, using the wrapper as the tenant-isolation boundary.**
   - *Rejected:* the community-documented pattern (Context §2) is explicitly non-equivalent to real RLS — it has no write-path control and must be hand-maintained as a second layer outside Postgres's own policy engine. Using it as the *primary* isolation mechanism for tenant-confidential aggregate data (BRD-0087 §10: "Tenant-confidential aggregate") is a materially weaker guarantee than every other tenant-scoped table in this project carries, and would be an unexplained, undocumented downgrade from ADR-0015's standard.

2. **Adopt TimescaleDB continuous aggregates now, sidestepping the RLS question via a different mechanism.**
   - *Rejected, reaffirming ADR-0087's own Alternatives §1:* adds an extension dependency this project has not otherwise adopted; the research explicitly recommends deferring this to a later, scale-driven migration, not the v1 default.

3. **Leave the ambiguity in ADR-0087 as-is, trusting implementers to infer "plain tables" from Alternatives §1.**
   - *Rejected:* Decision text is supposed to be the binding contract, not something an implementer has to reverse-engineer from the Alternatives section plus the feature's own product name (which points the wrong way). Given this is a correctness-critical, silently-broken-if-wrong property (tenant isolation on tenant-confidential aggregate data), it warrants an explicit, binding statement.

---

## Relation to ADR-0087

This ADR resolves a genuine Decision-level ambiguity in ADR-0087, not a cosmetic one: whether the five `*DailyCount` tables may ever be implemented as literal Postgres `MATERIALIZED VIEW` objects. Because PostgreSQL cannot attach RLS to a materialized view, ADR-0087 Decision §3's "a `tenant_id` RLS policy" and a literal materialized-view implementation are **mutually exclusive** — at most one of them can be true of the actual running schema. This ADR resolves the conflict definitively in favor of RLS: ordinary tables, real `CREATE POLICY` statements, upsert-based refresh (Decision §2 above). Everything else in ADR-0087 — the five schemas, the refresh cadence, query routing, `topic_id` sourcing, the `sum_reach`/`sum_engagement` partial-coverage semantics, and the ADR-0054 relationship — is carried forward unchanged (Decision §1 above).

Story 10.3 was already built (`social-listening-core@fdb9bb8`, 2026-08-28) before this ADR was drafted. Per ADR-0047 §2's implementation-status rule: **whether Story 10.3's actual shipped code used `CREATE TABLE` or `CREATE MATERIALIZED VIEW` is unverified by this ADR** — this ADR does not assume either way. If accepted, verifying and, if necessary, correcting the already-built schema to match Decision §2 is required follow-up implementation work, not something this ADR performs itself.

---

## Consequences

**Positive**
1. Closes a genuine, silently-dangerous ambiguity: without this ADR, tenant isolation on tenant-confidential aggregate data (BRD-0087 §10) could ship broken or weaker-than-documented if an implementer had taken the "materialized views with `pg_cron`" framing from the original feature design literally.
2. No schema redesign — the five table shapes, keys, and indexes are unchanged; this only pins down the DDL mechanism and the RLS attachment point.
3. Keeps this project's tenant-isolation guarantee uniform: every tenant-scoped table, including these five, now explicitly follows ADR-0015's real-RLS pattern with no documented exception.

**Negative**
1. Requires a verification pass (and possible migration) against Story 10.3's already-shipped schema — see Relation to ADR-0087 above.
2. Forecloses the security-barrier-view-over-a-true-MV path even though it is cheaper to build in some Postgres shops — judged not worth the weaker isolation guarantee for tenant-confidential data.

---

## Open questions

- Verifying Story 10.3's actual shipped DDL against Decision §2 is **deferred to the implementing follow-up story for this ADR** (Epic 18), per ADR-0047 §3's "deferred to a named future story" form — not decided here.
- ADR-0087's own still-open retention-policy question (relationship to ADR-0018) is unaffected by this ADR and remains open there.

---

## Footnotes

- Original ADR: `docs/adr/0087-preconfigured-analytics-views.md` (Accepted 2026-08-27; built 2026-08-28, Story 10.3)
- Deep research: `27-preconfigured-analytics-views-deep-research.md` (Second Brain vault, `raw/`), specifically §4 "PostgreSQL — Row Level Security is not supported on materialized views"
- Related ADRs: `ADR-0015` (tenant RLS, the pattern these tables must now explicitly follow), `ADR-0104` (topic_id sourcing, unaffected), `ADR-0054` (unaffected)
- Related BRD/FDD: `BRD-0087-Preconfigured-Analytics-Views.md`, `FDD-0087-Preconfigured-Analytics-Views.md` (each carry a 2026-08-28 dated note pointing here) and this ADR's own `BRD-0135`/`FDD-0135`
