# Epic 3: Data Model, Storage & Archival

## Story 3.1 — Normalized author entity

**Source:** ADR-0004 · **Status:** Ready

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

**As an** operations engineer investigating a data issue,
**I want** every `SocialPost` linked via `acquisitionId` to the `IngestionRun` that produced it, with that run recording trigger type, connector version, and outcome,
**so that** I can trace exactly which process, at what time, with what connector version, brought any given post in.

**Acceptance Criteria**
- Every `SocialPost` insert has a non-null `acquisitionId` referencing an existing `IngestionRun`.
- `IngestionRun` records `triggerType` (`poll`/`webhook`), `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`, `postsSkipped`, and `errorSummary` when applicable.
- Given a `SocialPost` ID, a support engineer can retrieve its originating run's connector version and trigger type in a single query.

---

## Story 3.3 — Connector-side watchlist filtering with post-fetch fallback

**Source:** ADR-0006 · **Status:** Ready

**As a** tenant configuring a watchlist,
**I want** matching to happen on the platform's own server when it supports query filtering, falling back to post-fetch matching in the core when it doesn't,
**so that** rate-limit budget isn't spent fetching posts that don't match, wherever that's avoidable.

**Acceptance Criteria**
- For a platform whose connector translates watchlist terms into native query parameters, requests sent to that platform include the translated filter.
- For a platform without native filtering support, the core evaluates the watchlist against every fetched post before persisting matches.
- A given `Watchlist` produces the same matched posts regardless of which platform sourced them — proven for this story's own `WatchlistTerms` (keyword/hashtag/account, OR-only) shape by this story's contract; Story 3.6 (ADR-0021, shipped 2026-07-30) closes the same consistency question more rigorously for a `booleanQuery`'s AST, as an independent parallel matching mode, not a replacement of this one.

---

## Story 3.4 — Cursor-based pagination for the posts API

**Source:** ADR-0011 · **Status:** Ready

**As an** API consumer paging through a tenant's posts,
**I want** `GET /posts` paginated by opaque cursor rather than offset,
**so that** performance stays stable on a high-volume, continuously-growing table, and concurrent inserts don't cause skipped or duplicated results across pages.

**Acceptance Criteria**
- `GET /posts` accepts a `cursor` query parameter and returns a cursor for the next page; it does not accept `page`/`offset` parameters.
- Paging through results while new posts are being ingested concurrently produces no duplicate or skipped posts across pages (verified by a test that inserts rows mid-pagination).
- Query latency for a page near the "end" of a multi-million-row table is comparable to a page near the "start" (no linear degradation with depth).

---

## Story 3.5 — Tiered data retention and archival

**Source:** ADR-0018 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`, since storage volume rather than correctness is the driver)

**As a** platform operator managing storage cost on an unbounded, high-volume table,
**I want** `rawPayload` and `IngestionRun` moved to cheaper archival storage after a bounded hot-storage window, while analytically-relevant fields stay indefinitely in primary storage,
**so that** primary storage growth is bounded by the actually-expensive part of the data, without losing the fields needed for future multi-year topic aggregation.

**Acceptance Criteria**
- A `SocialPost` older than 90 days (configurable — see ADR-0018's Amendment Log) has its `rawPayload` replaced by a pointer to archival blob storage, while `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain live and queryable.
- An `IngestionRun` older than 18 months (configurable — see ADR-0018's Amendment Log) is archived, not hard-deleted — every `SocialPost.acquisitionId` referencing it continues to resolve.
- Both retention windows are read from configuration rather than hardcoded, so changing either is an operational change, not a code change.
- `SocialPost` and `IngestionRun` are partitioned monthly, and archival operates by detaching/exporting the oldest partition rather than a row-by-row delete sweep.
- Fetching an archived `rawPayload` (e.g., for a support investigation) succeeds via the archival pointer, confirming the "never discarded" guarantee (§4.2) still holds post-archival.

---

## Story 3.6 — Unified boolean-query AST for watchlist matching

**Source:** ADR-0021 · **Status:** Ready (accepted 2026-07-29; scheduled for Phase 4 — see `docs/implementation-plan.md`; whole-query degradation kept for v1, per ADR-0021's Acceptance note)

**As a** tenant with a watchlist using a boolean query,
**I want** that query parsed once into a canonical AST that every connector's native translation and the shared post-fetch fallback both evaluate identically, with unsupported query features surfaced to me rather than silently degrading,
**so that** I get consistent matching behavior across platforms and know when a platform can't fully honor my query.

**Acceptance Criteria**
- A `Watchlist.booleanQuery` is parsed into an AST with `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` node types before any connector or fallback matcher evaluates it.
- Each connector declares `supportedQueryFeatures: AstNodeType[]`; a query containing a node type the connector doesn't support falls back to post-fetch matching for that platform, and this fallback is visible on the connector/watchlist status view.
- A test asserting the same `Watchlist` against a mock platform with full native support and a mock platform with none produces identical matched posts for identical input data.

---

## Story 3.7 — Tenant offboarding data lifecycle: export and deletion

**Source:** ADR-0039 (Accepted 2026-08-06) · **Status:** Ready. A genuinely undecided, hard-to-reverse data-deletion/compliance-adjacent question — twice already named and twice already declined by an Accepted ADR (ADR-0018, ADR-0031) as needing its own decision, not ordinary CRUD/UI surface.

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

**Source:** ADR-0043 (Proposed, drafted 2026-08-06) · **Status:** Blocked — pending ADR-0043's acceptance. A real reversal of ADR-0039 Decision §1's "cannot self-delete" prohibition, sourced from Menno's own direct instruction this session — see ADR-0043's own Status line and Source for why this persona could draft but not accept it.

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
