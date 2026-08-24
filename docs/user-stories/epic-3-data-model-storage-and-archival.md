# Epic 3: Data Model, Storage & Archival

## Story 3.1 — Normalized author entity

**Source:** ADR-0004 · **Status:** Ready
**Built:** 2026-07-29 — social-listening-core@34264e6

**As a** data engineer,
**I want** authors normalized into their own `Author` entity, upserted by `(tenantId, platformId, externalAuthorId)`, with `SocialPost` referencing it via `authorId`,
**so that** author-level facts (handle, display name, follower count, profile location) are stored once and updated in place instead of duplicated across every post from the same account.

**Acceptance Criteria**
- Ingesting two posts from the same external author within a tenant results in exactly one `Author` row, with `lastSeenAt` updated on the second ingest.
- `SocialPost` has no embedded author display fields — only `authorId`.
- `postGeoLocation` lives on `SocialPost` (per-event); `profileLocation` lives on `Author` (per-account) — verified by schema inspection.

---

## Story 3.2 — IngestionRun as the audit anchor for every post

**Source:** ADR-0005 · **Status:** Ready
**Built:** 2026-07-29 — social-listening-core@34264e6

**As an** operations engineer investigating a data issue,
**I want** every `SocialPost` linked via `acquisitionId` to the `IngestionRun` that produced it, with that run recording trigger type, connector version, and outcome,
**so that** I can trace exactly which process, at what time, with what connector version, brought any given post in.

**Acceptance Criteria**
- Every `SocialPost` insert has a non-null `acquisitionId` referencing an existing `IngestionRun`.
- `IngestionRun` records `triggerType` (`poll`/`webhook`), `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`, `postsSkipped`, and `errorSummary` when applicable.
- Given a `SocialPost` ID, a support engineer can retrieve its originating run's connector version and trigger type in a single query.
- `IngestionRun` rows are immutable once created.

---

## Story 3.3 — Connector-side watchlist filtering with post-fetch fallback

**Source:** ADR-0006 · **Status:** Ready
**Built:** 2026-07-29 — social-listening-core@f3254d9

**As a** tenant configuring a watchlist,
**I want** matching to happen on the platform's own server when it supports query filtering, falling back to post-fetch matching in the core when it doesn't,
**so that** rate-limit budget isn't spent fetching posts that don't match, wherever that's avoidable.

**Acceptance Criteria**
- For a platform whose connector translates watchlist terms into native query parameters, requests sent to that platform include the translated filter.
- For a platform without native filtering support, the core evaluates the watchlist against every fetched post before persisting matches.
- A given `Watchlist` produces the same matched posts regardless of which platform sourced them — proven for this story's own `WatchlistTerms` (keyword/hashtag/account, OR-only) shape by this story's contract; Story 3.6 (ADR-0021, shipped 2026-07-30) closes the same consistency question more rigorously for a `booleanQuery`'s AST, as an independent parallel matching mode, not a replacement of this one.
- No matching posts are lost due to translation errors for connectors with native query translation.
- Rate-limit cost and bandwidth are not spent fetching posts that would be discarded where native filtering is available.
- The matching path used for a given `IngestionRun` is recorded and queryable.
- Malformed or non-translatable watchlists fail with a clear, non-retryable error and are surfaced to the tenant.

---

## Story 3.4 — Cursor-based pagination for the posts API

**Source:** ADR-0011 · **Status:** Ready
**Built:** 2026-07-29 — social-listening-core@a5399d5

**As an** API consumer paging through a tenant's posts,
**I want** `GET /posts` paginated by opaque cursor rather than offset,
**so that** performance stays stable on a high-volume, continuously-growing table, and concurrent inserts don't cause skipped or duplicated results across pages.

**Acceptance Criteria**
- `GET /posts` accepts a `cursor` query parameter and returns a cursor for the next page; it does not accept `page`/`offset` parameters.
- Paging through results while new posts are being ingested concurrently produces no duplicate or skipped posts across pages (verified by a test that inserts rows mid-pagination).
- Query latency for a page near the "end" of a multi-million-row table is comparable to a page near the "start" (no linear degradation with depth).
- `watchlistId`, `platformId`, `from`/`to`, and `sentiment` filters continue to work correctly when combined with `cursor`.
- The `nextCursor` token is opaque; clients pass it verbatim and never construct or decode it.

---

## Story 3.5 — Tiered data retention and archival

**Source:** ADR-0018 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`, since storage volume rather than correctness is the driver)
**Built:** 2026-07-30 — social-listening-core@f4bd93c

**As a** platform operator managing storage cost on an unbounded, high-volume table,
**I want** `rawPayload` and `IngestionRun` moved to cheaper archival storage after a bounded hot-storage window, while analytically-relevant fields stay indefinitely in primary storage,
**so that** primary storage growth is bounded by the actually-expensive part of the data, without losing the fields needed for future multi-year topic aggregation.

**Acceptance Criteria**
- A `SocialPost` older than 90 days (configurable — see ADR-0018's Amendment Log) has its `rawPayload` replaced by a pointer to archival blob storage, while `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain live and queryable.
- An `IngestionRun` older than 18 months (configurable — see ADR-0018's Amendment Log) is archived, not hard-deleted — every `SocialPost.acquisitionId` referencing it continues to resolve.
- Both retention windows are read from configuration rather than hardcoded, so changing either is an operational change, not a code change.
- `SocialPost` and `IngestionRun` are partitioned monthly, and archival operates by detaching/exporting the oldest partition rather than a row-by-row delete sweep.
- Fetching an archived `rawPayload` (e.g., for a support investigation) succeeds via the archival pointer, confirming the "never discarded" guarantee (§4.2) still holds post-archival.
- For active tenants, no `IngestionRun` row is hard-deleted.

---

## Story 3.6 — Unified boolean-query AST for watchlist matching

**Source:** ADR-0021 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`; whole-query degradation kept for v1, per ADR-0021's Acceptance note)
**Built:** 2026-07-30 — social-listening-core@5c375ec

**As a** tenant with a watchlist using a boolean query,
**I want** that query parsed once into a canonical AST that every connector's native translation and the shared post-fetch fallback both evaluate identically, with unsupported query features surfaced to me rather than silently degrading,
**so that** I get consistent matching behavior across platforms and know when a platform can't fully honor my query.

**Acceptance Criteria**
- A `Watchlist.booleanQuery` is parsed into an AST with `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` node types before any connector or fallback matcher evaluates it.
- Each connector declares `supportedQueryFeatures: AstNodeType[]`; a query containing a node type the connector doesn't support falls back to post-fetch matching for that platform, and this fallback is visible on the connector/watchlist status view.
- A test asserting the same `Watchlist` against a mock platform with full native support and a mock platform with none produces identical matched posts for identical input data.

---

## Story 3.7 — Tenant offboarding data lifecycle: export and deletion

**Source:** ADR-0039 (Accepted 2026-08-06) · **Status:** Retired 2026-08-07 — never built as specified below. See Story 3.8, which now owns this entire capability.

**Retirement note, 2026-08-07.** This story was built the night of 2026-08-06/07 exactly as specified: `platform_admin_role`-gated, `POST /v1/admin/tenants/:id/export` / `.../delete`. Running the resulting contract against the full accumulated suite surfaced a real collision with Story 5.7's own already-accepted "`platform_admin_role` has zero access to any tenant-content table" boundary (ADR-0030 §2) — satisfying this story's own AC required a real, if narrow, widening of that boundary. Menno reviewed this directly and corrected the underlying decision: tenant deletion is `tenant_admin`-initiated only, own-tenant-only, never Platform-Admin-initiated. ADR-0039 Decision §1 was superseded in full (see its own dated "Superseding note") and ADR-0043 was corrected and accepted the same night. This story's implementation (routes, migration grants, contract test) was reverted before ever being committed — the ACs below are left in place as the historical record of what was originally decided and specified, per this project's own "an Accepted decision's text stays put" convention; they were never satisfied by shipped code. See Story 3.8 for what was actually built.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes a real, twice-named gap: ADR-0018's own Decision text states outright "tenant offboarding / right-to-erasure requests... deserves its own decision"; ADR-0031 names "Tenant deletion/offboarding" as its own out-of-scope Open Question. Story 5.7 (built) can suspend a tenant, but nothing addresses what happens to a suspended tenant's data — every table (`social_posts`, `authors`, `ingestion_runs`, `watchlists`, `platform_credentials`, `users`) continues to exist indefinitely.

**As** Platform Admin, offboarding a tenant that has left the platform,
**I want** to give that tenant a chance to export their own data, then delete it completely — across primary storage, archival storage, and Key Vault — in a bounded, auditable way,
**so that** a departed tenant's data doesn't linger forever, and the deletion actually reaches every tier ADR-0018's own retention mechanism created, not just the hot Postgres rows.

**Acceptance Criteria**
- `POST /v1/admin/tenants/:id/export` (Platform-Admin-only, `platform_admin_role`) triggers a structured export of the named tenant's `social_posts` (including archived `rawPayload` resolved via its blob pointer), `authors`, `watchlists`, and `ingestion_runs` (including archived rows) — available before any deletion action against that tenant.
- `POST /v1/admin/tenants/:id/delete` (Platform-Admin-only, two-step confirmation — an explicit, distinct action from suspension, never a side effect of `PATCH .../status`) initiates deletion; the actual row/blob removal runs as a bounded, asynchronous, partition-aware job (ADR-0039 §4), not a single synchronous transaction.
- Deletion hard-deletes `users`, `watchlists`, and `platform_credentials` rows for the target tenant, and actively revokes/deletes the corresponding secrets from Key Vault — proven by a test confirming a previously-valid credential is unreadable from Key Vault after deletion completes, not merely dereferenced in Postgres.
- Deletion hard-deletes `social_posts` and `authors` rows (hot and, for `rawPayload`, archived-blob tier) for the target tenant.
- Deletion hard-deletes `ingestion_runs` rows for the target tenant — both hot and already-archived-out-of-Postgres rows (ADR-0018's 2026-07-30 amendment) — a named, scoped exception to ADR-0018's own general "archived, never hard-deleted" rule (ADR-0039 §3), proven only once every `social_posts` row referencing a given run is also gone.
- `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the deleted tenant are retained, not deleted — proven by a test confirming they remain queryable (by `tenants.id` as an unenforced tombstone reference) after the tenant itself is gone.
- A deletion in progress or completed for a tenant is reflected in that tenant's own `status` (or equivalent) so a stale reference elsewhere in the system (e.g. a lingering session) fails cleanly rather than silently continuing to operate against partially-deleted data.
- Every export and deletion action is durably logged via the existing `platform_admin_audit_log`/`logPlatformAdminAction()` mechanism (ADR-0030 §5) — reusing, not duplicating, the existing audit path.
- No self-service, Tenant-Admin-initiated deletion path exists — both endpoints above are reachable only through `platform_admin_role`, proven by a test confirming no `app_user` session can reach either.

---

## Story 3.8 — Self-service, Tenant-Admin-initiated tenant deletion: request, export, grace period, confirmation

**Source:** ADR-0043 (Accepted 2026-08-07) · **Status:** Ready. Now the sole tenant-deletion mechanism (Story 3.7 retired, above) — ADR-0043 was corrected in place before acceptance to supersede ADR-0039 Decision §1 in full, not narrowly on its "cannot self-delete" sentence, once Story 3.7's own build surfaced the collision described in its retirement note.
**Built:** 2026-08-07 — social-listening-core@9a99257

**Built-vs-drafted note, 2026-08-07.** The shipped implementation differs from AC6 below in one deliberate way, decided during a security review while building this story: the final, irreversible hard-delete step runs under a dedicated, narrowly-scoped `tenant_deletion_role` (mirroring `tenant_signup_role`'s own precedent, Story 5.15) rather than a standing `app_user` grant — `app_user` is one shared Postgres role every `tenant_admin` AND every `tenant_user` session uses concurrently, so a standing `DELETE` grant on `users`/`tenants` there would be constantly present across every session, not a narrow, code-path-only privilege. `tenant_deletion_role` deliberately does not `BYPASSRLS`, unlike every other specialized role in this project, for defense-in-depth. `app_user` itself only ever gets the two narrow, per-column `UPDATE` grants (`deletion_requested_at`/`deletion_confirmed_at`) plus `INSERT` on `platform_admin_audit_log`, as AC6 originally specified, for the request/export/cancel steps. AC4's "invokes the same internal deletion-execution function Story 3.7 builds" is moot since Story 3.7 was never built as such — `executeTenantDeletion()` is this story's own function now, not a reused one. See `.claude/skills/self-service-tenant-deletion/SKILL.md`.

**Drafted 2026-08-06, same day as ADR-0039's acceptance**, from Menno's own direct instruction: *"could you check tenant admin can request tenant delete at which all connectors stop and no more data ingestion takes place for the tenant. a time period for download all available data in .csv or json format soft delete period then confirmation tenant delete is final."* Confirmed, via a structured choice, that Platform Admin's own role in this flow is **"Fully self-service, Platform Admin only sees the audit trail"** — no Platform Admin approval step. Platform Admin's own separate Story 3.7 export/delete endpoints are unaffected, additive, for the Platform-Admin-initiated case; this story's own deletion-execution step reuses that same mechanism rather than building a second one (ADR-0043 §6).

**As** Tenant-Admin who has decided to leave the platform,
**I want** to request deletion of my own tenant, have ingestion halt immediately, export my own data in CSV or JSON as many times as I need during a grace period, and only be able to make the deletion final once that period has genuinely elapsed — with a real way to change my mind before then,
**so that** I can leave the platform entirely under my own control, without waiting on a Platform Admin to review or approve my own request.

**Acceptance Criteria**

1. **Request** — a `tenant_admin`-authenticated endpoint (never reachable by a `tenant_user` identity, proven by a test) sets `tenants.deletion_requested_at` for the caller's own tenant. From that moment, every ingestion attempt for that tenant is refused before an `IngestionRun` is even opened — proven by a test that calls `runIngestionAttempt()` for a tenant with `deletion_requested_at` set and asserts no run is created and a non-retryable `tenant_deletion_requested` outcome is returned (ADR-0043 §3).
2. **Export window** — a `tenant_admin`-only endpoint exports the same data ADR-0039 §2/Story 3.7 already scope (`social_posts` including archived `rawPayload`, `authors`, `watchlists`, `ingestion_runs` including archived rows) for the caller's own tenant only, in the caller's choice of CSV or JSON — proven by a test asserting both formats are honored. Re-triggerable — a test confirms a second export request during the same grace period succeeds and reflects any data ingested before the request halted ingestion.
3. **Grace period** — a request may not be confirmed (AC4) until 30 days (configurable, ADR-0043 §5) have elapsed since `deletion_requested_at` — proven by a test confirming an early confirmation attempt is rejected (409) and names the remaining wait, not silently ignored. **Cancellation** is available via a `tenant_admin`-only endpoint at any point from request until confirmation actually executes (including after 30 days have elapsed but before confirmation) — proven by a test confirming cancellation nulls both `deletion_requested_at`/`deletion_confirmed_at` and immediately resumes ingestion eligibility.
4. **Final confirmation** — only reachable once the grace period has genuinely elapsed (AC3); on success, sets `deletion_confirmed_at` and invokes the same internal deletion-execution function Story 3.7 builds for the Platform-Admin-initiated path (ADR-0039 §3/§4) — proven by a test confirming this path and Story 3.7's own Platform-Admin path converge on the same execution function, not two separately-implemented pipelines.
5. **Audit** — every step (request, each export, cancellation if invoked, confirmation) is logged via the existing `platform_admin_audit_log`/`logPlatformAdminAction()` mechanism, with the acting Tenant-Admin's own identity recorded as `actorIdentity` — proven by a test querying the audit log (Story 5.14's existing endpoint) after a full request→export→cancel→request→confirm sequence and asserting every step is present and attributable to the correct identity, reachable by Platform Admin's existing audit-log read path with no new Platform Admin action required to see it.
6. `app_user`'s new grants (`UPDATE (deletion_requested_at, deletion_confirmed_at)` on `tenants`; `INSERT` on `platform_admin_audit_log`) are proven column/table-scoped, not broader — a test confirms an `app_user` session still cannot write `tenants.status`, `license_seat_count`, or `domain` (ADR-0030 §2/ADR-0031 §3 remain unweakened).

---

## Story 3.9 — Point-in-time author follower count on `SocialPost`

**Source:** ADR-0049 (Accepted 2026-08-11) · **Status:** Ready
**Built:** 2026-08-12 — social-listening-core@34e9dfb

**Drafted 2026-08-11, at ADR-0049's acceptance**, per the ADR-0024/0026 "no story until acceptance" precedent ADR-0049's own Status line named ahead of time. Closes the specific, named gap ADR-0004's own Negative consequences flagged at its 2026-07-28 acceptance ("historical accuracy of 'follower count at time of post' is not preserved") and `docs/adr/README.md`'s "Still outstanding, not yet drafted" section carried until ADR-0049 was drafted 2026-08-10.

**As a** data engineer supporting reach/influencer analysis on historical posts,
**I want** `SocialPost` to carry the author's follower count as reported by the connector at the moment that specific post was ingested, kept separate from `Author`'s own current, most-recently-seen follower count,
**so that** a reach-analysis query against a post from months ago reflects what the author's audience actually was at publish time, not what it is today.

**Acceptance Criteria**
- `SocialPost` gains one new, nullable field — `authorFollowerCountAtPublish` (Postgres column `author_follower_count_at_publish`, `INTEGER`, nullable, per ADR-0049's own Implementation defaults) — proven by schema inspection; no other author field (`handle`, `displayName`, `profileLocation`, `verifiedStatus`) is added to `SocialPost`, matching ADR-0049's own explicit "scope is one field only" boundary.
- The field is populated exactly once, at ingest time, from whatever the connector's `normalize()` output reports for that specific post's author at that moment — proven by a test that ingests the same author's second post with a different reported follower count and confirms the first post's already-stored value is unchanged.
- The field is **never** derived from, updated by, or reconciled against `Author.followerCount` after initial write — proven by a test confirming that a later `Author.followerCount` upsert (triggered by a newer post from the same author) does not retroactively change any earlier post's `author_follower_count_at_publish`.
- `Author.followerCount` continues exactly as ADR-0004's own Decision specifies — proven by re-running Story 3.1's existing contract unchanged (no assertion in that contract needs to change for this story to pass).
- A connector that does not supply a follower count alongside the post payload leaves the field `NULL` — proven for the Newswire (ADR-0024/Story 2.6) and GNews (ADR-0026/Story 2.7) connectors, both of which already model organization-as-Author and already leave `Author.followerCount` unpopulated for the same reason.
- The three-way `NULL` interpretation ADR-0049's own Negative consequences and Open Question 1 name — (a) connector-type null (this connector never reports it), (b) platform-omitted null (this specific post's payload happened to omit it even though the connector generally supports it), (c) pre-migration null (the row predates this column's existence) — is documented as a field-level comment on the migration that adds the column, per ADR-0049's own instruction that this documentation requirement (not its exact form) is what the ADR mandates. This story's contract does not need to distinguish the three cases at query time, only prove the documentation exists.
- Existing `SocialPost` rows written before this migration have `NULL` for the new column and are **not** backfilled — proven by a test confirming a pre-existing row is unaffected by the migration, per ADR-0049's own "does not retroactively populate existing rows" consequence.
- No `GET /posts` (ADR-0011) response-shape change and no `GET /topics/:topic/authors` (ADR-0007) `sortBy` change are made by this story — ADR-0049 explicitly leaves both as a separate, future decision (Open Question 3); this story adds the storage-layer field only, per ADR-0049's own "No API surface change is mandated by this ADR" statement.

**Notes:**
- This story does not build a connector-level `canProvideFollowerCountAtPublish` capability declaration as a separate, named interface — ADR-0049 Open Question 5 names the exact shape of that declaration (a capability-manifest boolean, a `normalize()` return-value convention, or something else) as an implementation-time task, not fixed by the ADR itself; whoever picks this story up decides it directly and documents the choice in this story's own component `SKILL.md`.

**Built 2026-08-12.** `migrations/0027_add_social_posts_author_follower_count_at_publish.sql` (new — additive `author_follower_count_at_publish INTEGER`, no backfill, plus a real `COMMENT ON COLUMN` documenting the three-way `NULL` interpretation per AC6); `src/connectors/types.ts` (`NormalizedPost.authorFollowerCountAtPublish`, and Open Question 5 resolved as `SocialConnector.canProvideFollowerCountAtPublish`, a boolean analogous to `supportedQueryFeatures`); `src/posts/socialPostStore.ts` (`InsertSocialPostInput` gains the field, written to the new column, deliberately not added to `SocialPostFull`/`SocialPostSummary` — no API surface change). Newswire and GNews were not touched — proving AC5 by running their own real, unmodified poll functions and confirming the column reads `NULL`, exactly the "connector-type null" case the migration's own column comment names. See `contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts` (9/9, including an inline local connector proving the capability-flag mechanism end to end, since no real individual-account connector exists yet) and `docs/implementation-log.md`. Full `social-listening-core` suite after: 53/53 suites, 379/379 tests passing.
- `BIGINT` vs. `INTEGER` (ADR-0049 Open Question 2) is not revisited by this story — `INTEGER` is used exactly as ADR-0049's Implementation defaults specify; revisit only if a future connector's platform reports a count that would overflow it (flagged there for Reddit specifically).
- Historical backfill from platform APIs (ADR-0049 Open Question 4) is out of scope — this story does not attempt to populate the field for any row ingested before it exists.

---

## Story 3.10 — Canonical Markdown post-body storage and enrichment input (`body_markdown`, `body_markdown_version`)

**Source:** ADR-0053 (Accepted 2026-08-13) · **Status:** Ready
**Built:** 2026-08-13 — social-listening-core@dcec172

**Drafted 2026-08-13, at ADR-0053's own acceptance**, per the ADR-0024/0026 "no story until acceptance" precedent. Closes the real, live gap ADR-0053 itself found this session: Newswire and tenant-owned-feed posts enrich on title text alone, and GNews on title+description alone, because none of the three connectors' own parsers ever captured the source's actual body content, and `social_posts` had no column to hold it even if they did.

**As a** Tenant-Admin (or anyone relying on AI enrichment quality for ingested posts),
**I want** Newswire, tenant-owned-feed, and GNews posts to be enriched on their actual body content rather than title text alone, with that body stored once in a stable, canonical format,
**so that** enrichment results (sentiment, entities, key phrases) reflect what a post actually says, and so no future consumer (display, export) needs its own bespoke parsing logic per connector.

**Acceptance Criteria**

1. `social_posts` gains two new, nullable columns — `body_markdown` (`TEXT`) and `body_markdown_version` (`SMALLINT`) — added by a new migration, per ADR-0053 Decision §2. Both are `NULL` exactly when no body source was available for that post, never an empty string — proven by schema inspection and a test confirming a post with no body-eligible field yields both `NULL`.
2. A new shared `htmlToMarkdown()` utility implements the full pipeline ADR-0053 Decision §3 specifies, in order: truncate the raw source at `MAX_BODY_SOURCE_LENGTH` (100,000 characters) → sanitize via `sanitize-html@2.17.6`, configured with the literal `allowedTags`/`nonTextTags` arrays and the `transformTags`(tracking-parameter stripping)/`exclusiveFilter` (bare-tracking-link exclusion) rules named in Decision §3, verbatim → convert via `turndown@7.2.4` plus `turndown-plugin-gfm@1.0.2` for GFM table support. Proven by unit tests covering: a safe pass-through for already-plain text; `<script>`/`<style>` content fully discarded; `<img>` excluded; an `<a href>` reduced to a bare tracking domain after stripping is dropped (text preserved) per the `exclusiveFilter` rule; a `<table>` converts to GFM table syntax, not unstructured text; input beyond the length guard is truncated before sanitization/conversion ever run.
3. `turndown`, `sanitize-html`, and `turndown-plugin-gfm` are pinned to exact versions in `package.json` (`7.2.4`/`2.17.6`/`1.0.2`, no semver range), with a code comment at the `htmlToMarkdown()` call site naming ADR-0053 — proven by inspecting `package.json` and the source comment directly.
4. `rssFeedParser.ts`'s `ParsedRssItem` gains `description`, `contentEncoded`, and `rawXml` (Decision §4) — proven by parsing a fixture RSS `<item>` with a CDATA-wrapped `<description>` and confirming all three new fields populate correctly alongside the existing `guid`/`link`/`title`/`pubDate`/`issuer` fields, unchanged.
5. `feedItemParser.ts`'s `ParsedFeedItem` gains the RSS-shaped (`description`/`contentEncoded`) and Atom-shaped (`summary`/`content`) body fields, plus `rawXml` (Decision §4) — proven by parsing both an RSS `<item>` fixture and an Atom `<entry>` fixture and confirming the correct format-appropriate fields populate for each.
6. The "richest available field" precedence rule (Decision §4/§5) — `content:encoded`/`content` over `description`/`summary`, `null` if neither present — is applied identically for Newswire and tenant-owned-feed, and for GNews's own `content`-over-`description` shape — proven by a test matrix covering all field-presence combinations for each connector.
7. All three connectors' `ingestX()` functions populate `body_markdown`/`body_markdown_version` exactly once, at ingestion, via `htmlToMarkdown()` — proven by ingesting a fixture item through each connector's real, unmodified ingest function and confirming the stored row's `body_markdown` matches the utility's own output for that item's precedence-selected source, with `body_markdown_version` equal to `1`.
8. `raw_payload` gains `rawXml` for Newswire and tenant-owned-feed automatically, via the pre-existing `{ providerId, externalId, ...item }` spread (Decision §4) — proven by confirming a stored row's `raw_payload.rawXml` matches the original raw block exactly; no change is made to GNews's own `rawPayload`, which already spreads the complete API response object.
9. GNews's `content` field is (a) included in `body_markdown`'s own precedence source alongside `description` (Decision §5), and (b) has its known free-tier truncation marker trimmed via the named regex before conversion — proven by a fixture GNews article whose `content` carries a `[+N chars]`-style suffix, confirming the marker is absent from the resulting `body_markdown`.
10. Enrichment input composition (Decision §6) — all three connectors call `enrichPost()` with `[title, body_markdown].filter(Boolean).join('. ')`, replacing the previous title-only (Newswire, tenant-owned-feed) and title+description (GNews) calls — proven per connector, asserting the exact composed string reaching `enrichPost()`.
11. The consumer contract (Decision §8 — `body_markdown` is Markdown source, never display text; any future Markdown→HTML render must sanitize its output) is documented in this component's own `SKILL.md`. Not independently runtime-tested — no consumer exists yet to exercise it — proven by `SKILL.md` content inspection only, the same documentation-only proof `ClassifiableError`-propagation (ADR-0052 Decision §8) already established as sufficient for an invariant with no current caller.

**Explicitly out of scope**, per ADR-0053's own Open Questions: backfilling `body_markdown` for already-ingested historical rows (Open Question 1 — deliberately not built; deleting and re-ingesting a tenant is an accepted alternative, not a mandate); any future Markdown-to-HTML/Word/PDF renderer (Open Question 2); whether raw Markdown syntax in `enrichmentText` measurably degrades enrichment accuracy (Open Question 9 — explicitly deferred to a possible future ADR, not this story); image preservation (Open Question 7); Atom `<content>`'s `type` attribute distinction (Open Question 5).

**Notes:**
- GNews's truncation-marker regex (AC9) is a best-current-understanding pattern, not confirmed against a real truncated response (ADR-0053 Open Question 11) — whoever builds this story should verify against a live response if a real GNews credential is available, and adjust the regex if the actual format differs, without needing to revisit this story's own contract structure.
- `body_markdown_version` (AC1/AC7) starts at `1` for this story's own pipeline; incrementing it for a future pipeline change is a judgment call left to whoever makes that later change (ADR-0053 Decision §2), not something this story's own contract needs to anticipate.

---

## Story 3.11 — Post-watchlist match persistence: `post_watchlist_matches` junction table, ingestion write, and `GET /v1/posts?watchlistId` filter

**Source:** ADR-0063 (Accepted 2026-08-19) · **Status:** Built 2026-08-19 — resumed mid-implementation from a prior session via `heal-contract-failure` (real schema conflict, ambiguous-column SQL bug, and fixture bug found and fixed — see ADR-0063's own Amendment Log and `docs/implementation-log.md`).
**Built:** 2026-08-19 — social-listening-core@63902a1

**As a** Tenant User or Tenant-Admin,
**I want** `GET /v1/posts` to accept a `watchlistId` filter parameter so that I can retrieve only the posts that matched a specific watchlist at ingestion time,
**so that** the analytics dashboard can display accurate, server-side-filtered content per watchlist without a client-side approximation.

**Acceptance Criteria**

1. A new migration creates the `post_watchlist_matches` table: columns `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `post_id UUID NOT NULL` (deliberately no DB-enforced foreign key into `social_posts` — see the Note below), `watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE`, `tenant_id UUID NOT NULL`, `matched_at TIMESTAMPTZ NOT NULL DEFAULT now()`, plus a `UNIQUE (post_id, watchlist_id)` constraint, two named indexes (`idx_pwm_watchlist_id` on `(watchlist_id, tenant_id, matched_at DESC)`; `idx_pwm_post_id` on `(post_id, tenant_id)`), and a Row-Level Security policy using the existing `app.tenant_id` session predicate — same pattern as `watchlists` itself (ADR-0063 Decision §1, corrected by that ADR's own Amendment Log). Proven by schema inspection in the contract test: the table, indexes, constraint, and RLS policy all exist after migrations run.
2. A new store function `insertPostWatchlistMatches(tenantId, pairs: Array<{ postId: string; watchlistId: string }>)` issues a batch `INSERT INTO post_watchlist_matches ... ON CONFLICT (post_id, watchlist_id) DO NOTHING` — idempotent on retry, proven by calling the function twice with the same pairs and confirming the row count does not grow on the second call.
3. `publishSocialPostIngestedEvents()` calls `insertPostWatchlistMatches()` with the same matched-watchlist set it already computes for ADR-0058's event-publishing loop — the real, single choke point every connector's own per-post loop already calls, not `runIngestionAttempt()` itself (a generic, connector-agnostic attempt/retry state machine with no knowledge of posts or watchlists — verified directly, not assumed). The call is best-effort: a failure inside `insertPostWatchlistMatches()` is logged (same telemetry path as connector health errors, ADR-0009/ADR-0010) but does not throw and does not fail the ingestion attempt. Proven by a contract test that injects a store-function error and confirms the ingesting post is still returned by `GET /v1/posts`.
4. `postsRouter.ts` accepts an optional `watchlistId` query parameter (valid UUID). When present: validates UUID format (returns `400 INVALID_WATCHLIST_ID` on malformed input); verifies a matching row exists in `post_watchlist_matches` under the caller's RLS context (returns `404 WATCHLIST_NOT_FOUND` if none — same 404-vs-403 split as ADR-0044 Decision §5c); joins `post_watchlist_matches` on `post_id = social_posts.id AND watchlist_id = $watchlistId`; returns the filtered `SocialPostSummary[]` with cursor-based pagination preserved (ADR-0011). Proven by contract tests covering: a valid `watchlistId` returns only the matched posts; a UUID that belongs to a different tenant returns `404`; a malformed string returns `400`; cursor pagination still works when `watchlistId` is present.
5. `SocialPostSummary` is not changed — no new field is added. The filter is server-side; the response shape is unchanged.
6. No change to `matchesWatchlist()`, `matchesAst()`, `resolveWatchlistDispatch()`, or any other matching logic — this story writes match results, it does not change how they are computed (ADR-0063 Decision §1 note).
7. No retroactive backfill of existing `social_posts` rows — posts ingested before this migration have no `post_watchlist_matches` rows, and `GET /v1/posts?watchlistId=<id>` returns an empty set for those posts. The empty result is honest; it is not an error. Confirmed by a contract test that seeds a post without a match row and verifies the filtered result is empty, not an error.

**Explicitly out of scope:** retroactive backfill of historical posts (ADR-0063 Open Question 1 — deliberately not built; a future `POST /v1/watchlists/:id/reindex` endpoint is the named design direction); re-matching on watchlist update when `terms[]` or `boolean_query` changes (ADR-0063 Open Question 2 — accepted staleness at v1); `GET /v1/watchlists` response `postCount` field (ADR-0063 Open Question 4 — left to Story 8.9's judgment); any `social-listening-admin` change (Story 8.9).

**Note:** AC1's `post_id` column deliberately carries no DB-enforced foreign key into `social_posts`, discovered at implementation time and corrected in ADR-0063's own Amendment Log — `social_posts` has been partitioned by `created_at` since migration `0012` (Story 3.5, ADR-0018), which forced its primary key to become composite (`id`, `created_at`); Postgres requires a partitioned table's unique/PK constraints to include the partition key, so `social_posts.id` alone has no unique constraint to reference. This is the same conflict already resolved once for `social_posts.acquisition_id → ingestion_runs(id)` (`data-retention-and-archival/SKILL.md`) — `post_id` is app-enforced only, the same tier `acquisition_id`/`author_id` already partly rely on. No code path in this repo hard-deletes an individual `social_posts` row today, so the `ON DELETE CASCADE` guarantee this trades away is currently theoretical, not active. `watchlist_id`'s own `ON DELETE CASCADE` is unaffected — `watchlists` is not partitioned.

---

## Story 3.12 — Post-watchlist match historical backfill and discovery-driven watchlist attribution

**Source:** ADR-0063 (2026-08-20 Amendment Log entry) · **Status:** Built 2026-08-20
**Built:** 2026-08-20 — social-listening-core@3adc060
**Depends on:** Story 3.11 (`post_watchlist_matches` table, **Built** 2026-08-19); Story 2.14 (Wikipedia watchlist-driven discovery, **Built** 2026-08-18)

**As a** Tenant User or Tenant-Admin,
**I want** historical posts ingested before Story 3.11 to be matched against active watchlists in `post_watchlist_matches`, and Wikipedia posts discovered via a specific watchlist to be attributed directly to that watchlist,
**so that** historical and discovered posts accurately populate the watchlist coverage charts and topic filters on the analytics dashboard.

**Acceptance Criteria**

1. **Backfill function / operation:** A new function `backfillPostWatchlistMatches(tenantId?: string)` in `social-listening-core/src/watchlists/postWatchlistMatchStore.ts`:
   - Iterates through existing `social_posts` across all tenants (or scoped to `tenantId` if provided).
   - For each post, loads the tenant's active watchlists via `listActiveWatchlistsForTenant(tenantId)`.
   - Converts each watchlist to an AST (`watchlistToAst(watchlist)`) and runs the fallback AST evaluator `matchesAst(ast, { id: post.id, text, authorExternalId })` against the post's text (composed from title/snippet and `body_markdown`).
   - Inserts the resulting pairs into `post_watchlist_matches` using `insertPostWatchlistMatches()` (`ON CONFLICT (post_id, watchlist_id) DO NOTHING`), ensuring idempotency and zero duplicate match records.
   - Proven by a contract test verifying that historical posts unlinked in `post_watchlist_matches` become linked after running `backfillPostWatchlistMatches()`, without creating duplicate rows on repeated runs.
2. **Backfill migration execution:** A new migration (`0038_backfill_post_watchlist_matches.sql` or equivalent runner step) runs the retroactive backfill pass during database migration so that existing databases automatically populate `post_watchlist_matches` upon upgrade.
3. **Wikipedia discovery-driven attribution:** In `pollWikipedia.ts` (Story 2.14), when articles are fetched during Phase 1 (discovery) for a specific watchlist's discovery query:
   - The discovering watchlist's `watchlist.id` is explicitly passed into `ingestWikipediaRevisions()`.
   - `publishSocialPostIngestedEvents()` guarantees that the discovering `watchlistId` is included in the persisted `matchedWatchlistIds` sent to `insertPostWatchlistMatches()`, while continuing to evaluate all other active tenant watchlists via `matchesAst()`.
   - Proven by a contract test confirming that an article discovered via a watchlist query is always recorded in `post_watchlist_matches` for that watchlist even if specific sub-phrasing varies.
4. **Re-poll preserved:** Re-polling already-tracked Wikipedia articles (Phase 2 of `pollWikipedia.ts`) continues to evaluate all active tenant watchlists via `publishSocialPostIngestedEvents()`.
5. **No breaking changes:** `GET /v1/posts?watchlistId=<id>` response shape, RLS policies, and error handling remain unchanged.

**Explicitly out of scope:** Automatic re-matching triggers on live watchlist term update (ADR-0063 Open Question 2 — accepted staleness at v1; can be invoked via manual backfill if needed); any change to `social-listening-admin`.

---

## Story 3.13 — Post Enrichment Overrides API and Re-Enrichment Precedence Guard

**Source:** ADR-0071 (Accepted 2026-08-20) · **Status:** Implemented
**Depends on:** Story 1.1 (Posts router and RLS context), Story 2.20 (Geospatial enrichment normalization), Story 3.5 (Post storage schema), Story 3.8 (AI Language enrichment)

**As a** core backend engineer,
**I want** a `PATCH /v1/posts/:id/enrichment` endpoint allowing authorized tenant users to modify post enrichment attributes with full audit lineage, and an explicit re-enrichment precedence guard,
**so that** human corrections are immediately reflected across the system while preventing automated AI re-runs from silently overwriting human edits.

**Acceptance Criteria**

1. **Enrichment Update Endpoint (`PATCH /v1/posts/:id/enrichment`):**
   - Implemented in `postsRouter.ts`, authenticated with bearer session, and scoped by PostgreSQL Row-Level Security (`tenant_id`). Authorized for `tenant_user` and `tenant_admin` roles.
   - Accepts request payload `UpdatePostEnrichmentRequest`:
     - `sentiment?: 'positive' | 'neutral' | 'negative'`
     - `sentimentScore?: number` (optional float clamped between `0.0..1.0`)
     - `keyPhrases?: string[]` (allows empty array `[]`)
     - `detectedLanguage?: string | null`
     - `geoCountry?: string | null`
     - `geoCountryName?: string | null`
     - `summary?: string | null`
2. **Payload Validation & Sanitization:**
   - **Sentiment Score Consistency:** If `sentiment` is modified and `sentimentScore` is omitted, the backend auto-assigns a default score (`positive` → `0.8`, `neutral` → `0.5`, `negative` → `0.2`).
   - **Key Phrases Sanitization:** Strips HTML, trims whitespace, removes empty entries, deduplicates case-insensitively while preserving first-seen casing, caps at max 50 phrases and max 200 chars per phrase.
   - **Language Validation:** Validates `detectedLanguage` against ISO 639-1 two-letter lowercase allowlist or `null`. Rejects invalid codes with `400 Bad Request`.
   - **Geospatial Cross-Field Validation:** Normalizes `geoCountry` to uppercase ISO 3166-1 alpha-2 or `null`. If `geoCountry` is `null`, clears `geoCountryName` to `null`. If `geoCountry` is set, resolves/validates `geoCountryName`.
3. **Audit History & Override Schema:**
   - Updates `social_posts.enrichment` in-place.
   - Sets `enrichment.override`:
     - `isOverridden: true`
     - `overriddenAt: string` (ISO 8601 UTC)
     - `overriddenByUserId: string` (from authenticated session)
     - `overriddenFields: string[]` (exact list of keys modified in this request)
     - `originalValues: Record<string, any>` (snapshot of initial values prior to the first human override)
     - `aiHistory: Array<{ generatedAt: string, model?: string, values: Record<string, any> }>` (preserves prior automated outputs)
4. **Re-Enrichment Precedence Guard (`POST /v1/posts/:id/enrich` & AI Runners):**
   - Any re-enrichment operation checks `enrichment->'override'->>'isOverridden'`.
   - If `isOverridden === true` and `force !== true`: rejects with **`409 Conflict`** and payload `{ error: 'Post enrichment has been manually overridden', code: 'ENRICHMENT_MANUALLY_OVERRIDDEN', override: {...} }`.
   - If `force === true`: overwrites top-level values, archives previous AI values into `override.aiHistory[]`, updates `override.originalValues` to the new AI output, and resets `override.isOverridden = false`.
5. **Response & Error Handling:**
   - Returns HTTP `200 OK` with full updated `SocialPostSummary`.
   - Returns `404 Not Found` if the post ID does not exist or belongs to another tenant.

**Explicitly out of scope:** Admin UI components (Story 6.31); batch enrichment endpoint (deferred).

---

## Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API

**Source:** ADR-0073 (Accepted 2026-08-22) · **Status:** Ready
**Built:** 2026-08-24 — social-listening-core@e3e661b

**As a** Tenant User or Tenant-Admin,
**I want** a tenant-scoped record of every reply attempt and a REST endpoint to create one against an ingested post,
**so that** outbound engagement is auditable, retryable, and tied to the credential and user that performed it.

**Acceptance Criteria**

1. A new migration creates `outbound_activities` with columns: `id`, `tenant_id` (RLS predicate), `post_id`, `provider_id`, `user_id`, `credential_id`, `activity_type`, `body`, `status`, `external_id`, `external_url`, `error_code`, `created_at`, `sent_at`, `failed_at`. No DB-enforced FK into `social_posts` (partitioned) or `platform_credentials`; enforcement is app-layer, matching `post_watchlist_matches` precedent.

2. `POST /v1/posts/:id/replies` is mounted under the `/v1` router, authenticated, and RLS-scoped. It validates the `post_id` exists for the tenant and that `body` is non-empty; returns `404 Not Found` for cross-tenant posts.

3. The endpoint loads the caller's active Tier-3 `platform_credentials` for the post's `provider_id`. If none exists, the connector lacks `reply?()`, or the caller is not the credential owner, it returns `422 Unprocessable Entity` with code `REPLY_NOT_AVAILABLE`.

4. On success the endpoint inserts an `outbound_activities` row with `status = 'sent'`, `external_id`, and `external_url`. On failure it inserts `status = 'failed'` with a normalized `error_code` and returns `502`/`504`/provider-appropriate status.

5. `GET /v1/posts/:id/replies` returns the tenant-scoped list of `outbound_activities` for that post, ordered `created_at DESC`, with cursor pagination if the list is expected to exceed 50 rows.

6. Outbound `reply()` calls consume a separate `RequestGate` key per `(tenantId, providerId, 'outbound')` so that write rate limits do not starve ingestion polls.

7. Jest contract test asserts: successful reply creation, `404` for cross-tenant post, `422` for missing/unsupported credential, `429` handling when the gate is exhausted, and the returned row matches the persisted row.

**Explicitly out of scope:** Connector-specific `reply()` implementations (Stories 2.26–2.27); admin UI (Story 6.38); editing/deleting sent replies.

---

## Story 3.15 — Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API

**Source:** ADR-0075 (Accepted 2026-08-23) · **Status:** Ready
**Built:** 2026-08-24 — social-listening-core@8e7f312
**Depends on:** Story 3.14 (base `outbound_activities` table and `POST /v1/posts/:id/replies`), Story 2.28 (connector `publish?()` framework)

**As a** Tenant User or Tenant-Admin,
**I want** a tenant-scoped record of every outbound post attempt and a REST endpoint to dispatch new posts to my connected platform assets,
**so that** the Polypost Composer's dispatch becomes real, auditable, and retryable.

**Acceptance Criteria**

1. A migration adds the following columns to `outbound_activities` (or creates them in the same migration if it runs alongside Story 3.14): `target_asset_id TEXT`, `target_asset_type TEXT`, `payload JSONB`, `scheduled_for TIMESTAMPTZ`, `cancelled_at TIMESTAMPTZ`.
2. The `activity_type` check constraint (or type) is widened to include `'post'`; the `status` constraint is widened to include `'cancelled'`.
3. `POST /v1/outbound/posts` is mounted under the `/v1` router, authenticated, and RLS-scoped. It accepts a JSON body: `text` (non-empty, per-platform limits checked), `perPlatformOverrides` (optional partial record), `media` (optional array of media refs), `linkPreview` (optional), `targets` (array of `{ providerId, targetAssetId }`), and `scheduledFor` (optional ISO 8601 timestamp).
4. For each target, the endpoint loads the caller's active Tier-3 `platform_credentials` for `provider_id`. If `SocialConnector.publish?()` is missing, the credential is not active, the caller does not own the credential, or `target_asset_id` is not in the caller's enumerated asset list, the endpoint returns `422 Unprocessable Entity` with code `PUBLISH_NOT_AVAILABLE`.
5. If `scheduledFor` is present, the endpoint inserts an `outbound_activities` row per target with `status = 'pending'`, `activity_type = 'post'`, `scheduled_for` set, and returns `201 Created` with the created rows.
6. If `scheduledFor` is absent, the endpoint calls `outboundPublishService.publish()` for each target, catches `ClassifiableError`, and updates each row to `sent` (with `external_id`, `external_url`) or `failed` (with `error_code`). The HTTP response is `201 Created` when every target succeeds; `207 Multi-Status` (or provider-appropriate status) is used for partial failures, with the per-target results in the response body.
7. `GET /v1/outbound/posts` returns the tenant-scoped list of `outbound_activities` where `activity_type = 'post'`, ordered `created_at DESC`, filterable by `status` and `providerId`, with cursor pagination if the list is expected to exceed 50 rows.
8. `DELETE /v1/outbound/posts/:id` is allowed only when the row is `status = 'pending'`, the `scheduled_for` has not yet passed, and the row belongs to the caller's tenant. It sets `status = 'cancelled'` and `cancelled_at = NOW()`; otherwise it returns `409 Conflict`.
9. Outbound `publish()` calls consume a separate `RequestGate` key per `(tenantId, providerId, 'outbound_post')` so that post writes do not starve ingestion polls.
10. Jest contract test asserts: successful immediate dispatch, scheduled dispatch, `404` for cross-tenant target, `422` for missing/unsupported credential, `429` handling when the gate is exhausted, and `DELETE` cancellation.

**Explicitly out of scope:** Connector-specific `publish()` implementations (Stories 2.29–2.30); image/video media upload (v1 is text/link-card only); the background scheduler that will eventually process `scheduled_for` rows; admin UI (Story 6.39); editing/deleting already-sent posts.

---

## Story 3.16 — Tenant-facing workspace and matched-posts export endpoints

**Source:** ADR-0074 (Accepted 2026-08-23) · **Status:** Ready
**Built:** 2026-08-24 — social-listening-core@0d11e3f

**As a** Tenant-Admin or tenant user,
**I want** to download a full workspace JSON archive and a CSV of matched posts on demand from `social-listening-core`,
**so that** I can back up or analyze my tenant's data without going through the deletion/offboarding flow.

**Acceptance Criteria**

1. `GET /v1/tenants/me/export/workspace` is mounted under the `/v1` router, authenticated, and returns a JSON archive of the caller's own tenant. It is restricted to `tenant_admin` resolved identities; `tenant_user` receives `403 Forbidden`.

2. The workspace JSON includes: tenant metadata (`name`, `domain`, `licenseSeatCount`, `activeSeatCount`, `status`, `createdAt`), tenant users, watchlists (all users' watchlists — requires the same `getAdminPool()` exception as `exportTenantData()`), connector activations, `platform_credentials` metadata (no secrets or encrypted envelopes), `social_posts` with resolved archived `rawPayload`, `authors`, and `ingestion_runs`. The exact column set is contract-tested and versioned.

3. `GET /v1/posts` supports `?format=csv` (or a sibling `GET /v1/posts/export.csv` route), authenticated, available to both `tenant_admin` and `tenant_user`. It accepts the same filter/query parameters as the existing `GET /v1/posts` JSON endpoint (search, provider, author, watchlistId, date range, cursor) and returns a flat CSV with a header row and one row per post.

4. The CSV columns include at minimum: `id`, `published_at`, `provider`, `author_name`, `author_url`, `title`, `body_markdown`, `url`, `sentiment`, `keywords`, `watchlist_ids`. UTF-8 with BOM, RFC 4180-ish quoting.

5. Both exports are synchronous, bounded, and fail safely: workspace JSON has a response-size cap; posts CSV has a row cap (e.g. 10,000). Exceeding the cap returns `413 Payload Too Large` or `422 Request Entity Too Large` with code `EXPORT_TOO_LARGE`, never an unbounded stream.

6. No `platform_admin` identity may call either export endpoint — the zero-tenant-content boundary (ADR-0030 §2) is preserved.

7. Jest contract tests assert: workspace export returns the correct tenant, includes expected tables, excludes credential secrets, rejects `tenant_user`; posts CSV returns the same rows as the equivalent JSON request, respects filters, and enforces the row cap.

**Explicitly out of scope:** Async background export with Azure Blob Storage; on-demand full workspace CSV; deleting/altering data through the export endpoint; adding the dependency `lucide-react` (a separate UI decision).

---

## Story 3.17 — Composer deep research REST endpoint

**Source:** ADR-0076 (Accepted 2026-08-23) · **Status:** Ready
**Built:** not yet
**Depends on:** Story 2.31 (Brave/Bing one-off research search helpers), Story 2.32 (Azure OpenAI `research?()` capability), Story 5.10/5.11 (tenant auth and `GET /v1/me`)

**As a** tenant user,
**I want** a `POST /v1/composer/research` endpoint in `social-listening-core`,
**so that** I can submit my draft post text and receive a deep-research summary I can compare to my own message.

**Acceptance Criteria**

1. `POST /v1/composer/research` is mounted under the `/v1` router, authenticated, and RLS-scoped. It accepts `{ text: string, targetPlatforms?: string[], maxSearchResultsPerQuery?: number }` and returns the `ComposerResearchResult` shape from ADR-0076 §1.

2. The endpoint extracts `keyPhrases`, `relatedTopics`, and `searchQueries` by calling the active `AIProviderConnector.research?()` for the tenant. If no capable AI provider is connected and active, it returns `422 AI_PROVIDER_NOT_CAPABLE`.

3. For each generated `searchQueries` entry, the endpoint calls the tenant's active Brave/Bing search helper(s) (Story 2.31) and collects up to `maxSearchResultsPerQuery` results per query (default 5, hard cap 10). If no search provider is connected and active, it returns `422 SEARCH_PROVIDER_UNAVAILABLE`.

4. The endpoint passes the original text, key phrases, related topics, and collected search result snippets back to `AIProviderConnector.research?()` (or the same connector's second research stage) to produce `contextSummary` and `comparison`.

5. The endpoint enforces caps: max 10 key phrases, max 5 search queries, and max 10 search results per query. Exceeding these caps returns `422 RESEARCH_TOO_LARGE`.

6. The endpoint is gated to `tenant_admin` and `tenant_user` resolved identities; `platform_admin` receives `403` (ADR-0030 §2).

7. Outbound `research()` calls consume a separate `RequestGate` key per `(tenantId, providerId, 'research')`.

8. Jest contract tests assert: a valid request returns all `ComposerResearchResult` fields; missing AI provider returns `422` with `AI_PROVIDER_NOT_CAPABLE`; missing search provider returns `422` with `SEARCH_PROVIDER_UNAVAILABLE`; `platform_admin` receives `403`; caps are enforced; no `social_posts` or `post_watchlist_matches` rows are created.

**Explicitly out of scope:** Caching results; async background jobs; media or image analysis; persistence of research results; scheduled/repeated research.

