# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0042 Wikipedia Connector — MediaWiki API, Revision Re-poll, Article-as-Author — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Sponsor / Technical Lead) |
| Status | Approved (ADR-0042 Accepted 2026-08-08; connector built via Story 2.13/2.14, UI via Story 6.21/6.22) |
| Related Documents | ADR-0042, BRD-0042, ADR-0004, ADR-0021, ADR-0027, ADR-0018, ADR-0015, Story 2.13, Story 2.14, Story 6.21, Story 6.22 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0042's architecture decision and BRD-0042's business requirements into the functional design of the Wikipedia connector: a self-service, keyless `SocialConnector` that polls the MediaWiki Action API, re-ingests already-tracked articles as they are edited, and models `Author` as the tracked article itself. The connector is already built (Story 2.13/2.14 in `social-listening-core`; Story 6.21/6.22 in `social-listening-admin`); this FDD documents the shipped functional behavior derived from ADR-0042's Decision, for traceability and future maintenance.

### 2.2 Scope

- **In scope:** connector registration and configuration (`authMode: 'none'`, `deliveryMode: 'poll'`, compliant `User-Agent`); article discovery via `search`; revision re-poll via `recentchanges`; `SocialPost` normalization (including the revision-permalink attribution mechanism); `Author` modeling keyed by `pageid`; watchlist matching with CirrusSearch push-down and whole-article fallback; Tenant Admin UI exposure as a connector and as a watchlist source.
- **Out of scope:** one-shot static snapshot ingestion (rejected); a single connector-wide "Wikipedia" `Author` (rejected); historical revision backfill beyond current content at discovery; a materiality threshold for re-ingestion; RAG/embedding-oriented chunked ingestion; CC BY-SA "Adapted Material" review of AI-enrichment output redistribution (flagged for a future pass, not designed here).

### 2.3 Target Audience

Backend engineers extending or maintaining the Wikipedia connector; frontend engineers maintaining its Tenant Admin UI surfaces; QA writing/maintaining its contract tests; Platform Operations monitoring its volume and rate-limit posture.

---

## 3. Context and Background

Reddit (the originally planned next connector) closed self-service registration; X requires a paid tier; Meta's non-Page listening capability is unverified. Wikipedia, verified directly against Wikimedia's own primary sources, requires no account or API key, explicitly permits commercial reuse under CC BY-SA 4.0/GFDL, and is gated only by a compliant `User-Agent` header. Unlike GNews/Newswire content (published once, effectively immutable), a Wikipedia article is a living document that can be edited — including adversarially, in ways directly relevant to reputation monitoring. The Knowledge-Graph & Semantic Data Modeling Reviewer flagged an unresolved `Author`-modeling question: does the connector re-poll an article over time (real many-post-to-one-`Author` reuse) or ingest it once (a 1:1 collapse, functionally equivalent to embedding author fields per post, which ADR-0004 already rejected)? ADR-0042 resolves this by choosing re-poll-on-edit as the connector's primary cadence, making `Author` = the tracked article (keyed by stable `pageid`) a genuine, if structurally distinct, third instance of the issuer-as-Author pattern established by ADR-0024 (Newswire) and ADR-0026 (GNews).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Add a self-service, no-approval-gate ingestion source | `wikipedia` connector registered with `authMode: 'none'` |
| G2 | Surface reputation-relevant edit activity, not just first discovery | Each qualifying revision of a tracked article produces a new `SocialPost` |
| G3 | Satisfy Wikimedia's attribution obligation | `SocialPost.url` is the specific revision permalink (`?oldid=<revid>`) on every ingested post |
| G4 | Keep `Author` a meaningful, reusable entity | Multiple revisions of the same article resolve to one `Author` row keyed by `pageid` |
| G5 | Avoid inventing unverified operational numbers | `getRateLimitConfig()` uses either a verified Wikimedia limit or an explicitly-labeled conservative placeholder |
| G6 | Expose the connector to tenants | Wikipedia appears as an activatable connector and as a watchlist platform source in the Tenant Admin UI |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Wikipedia `SocialConnector` Registration

- **Description:** Registers Wikipedia as a distinct `SocialConnector` targeting the MediaWiki Action API directly (`en.wikipedia.org/w/api.php` and per-language equivalents), with no aggregator or wrapper.
- **Triggers:** Connector registry initialization at application start; Tenant Admin activation via the generic activate/deactivate surface (ADR-0051).
- **Inputs:** None required from the tenant — no account, no API key, no OAuth flow.
- **Processing:** `authMode: 'none'`; `deliveryMode: 'poll'` (MediaWiki has no push/webhook mechanism); every outbound request carries a compliant, connector-identifying `User-Agent` header (client identity plus contact information) per the Wikimedia User-Agent Policy.
- **Outputs:** A registered, activatable `SocialConnector` with `providerId: 'wikipedia'`.
- **Error handling:** A non-compliant `User-Agent` may cause Wikimedia to return HTTP 403 without notice; the connector must always send the compliant header, never an empty or generic default.
- **Edge cases:** No credential-pooling concern applies (ADR-0027) — there is no account or key to pool; the shared `User-Agent` string identifies the software, not a tenant relationship.

### 5.2 Feature / Capability: New-Article Discovery

- **Description:** Finds Wikipedia articles matching a tenant's watchlist query for the first time, using the MediaWiki `search` API, driven by the tenant's own watchlist terms (not a shared hardcoded literal, per Story 2.14).
- **Triggers:** Scheduled poll cycle for a watchlist targeting the Wikipedia connector.
- **Inputs:** The watchlist's query terms (keyword/hashtag/boolean AST).
- **Processing:** Issues a `search` request using the watchlist's own terms; on a match, fetches the article's current full content and metadata (`pageid`, title).
- **Outputs:** One `SocialPost` for the article's current revision at time of discovery; one `Author` row created or resolved for that `pageid`.
- **Error handling:** No results returns a no-op poll outcome, not an error.
- **Edge cases:** Full boolean AST-to-CirrusSearch operator translation (AND/OR/NOT, quoted phrases, `intitle:`/`insource:`) is not fully implemented — named as an explicit, ongoing verification gap, not silently assumed complete. No historical backfill is performed at discovery — only the current revision is ingested.

### 5.3 Feature / Capability: Revision Re-Poll of Tracked Articles

- **Description:** Re-ingests an already-tracked article as it is edited, using the `recentchanges` API, producing a new `SocialPost` per qualifying revision rather than a single static snapshot.
- **Triggers:** Scheduled poll cycle for articles already known to a tenant's watchlist(s).
- **Inputs:** The article's `pageid`/title; the timestamp of the last successful poll (`rcstart`/`rcend` windowing).
- **Processing:** Queries `recentchanges` filtered by page and time range since the last poll; for each qualifying entry, fetches the revision's full current text and metadata; creates a new `SocialPost` linked to the article's existing `Author` row (resolved by `pageid`, not recreated).
- **Outputs:** Zero or more new `SocialPost` rows per poll cycle, each with `Author` resolved to the same row across all revisions of the same article; `Author.lastSeenAt` updated to reflect the most recent qualifying revision.
- **Error handling:** A poll cycle with zero qualifying entries is a no-op — no duplicate `SocialPost` rows are created.
- **Edge cases:** `recentchanges` cannot enumerate edits more than 30 days into the past (`$wgRCMaxAge`) — an already-tracked article's older, unpolled edit history beyond that window is not retroactively discoverable through this endpoint (the underlying `revisions` API can be walked further back, but this is not designed as an automatic behavior). Every qualifying revision re-ingests the article's full current text, not a diff — a large, mostly-unrelated edit to an otherwise-matching article still produces a full-text re-ingestion (a known noise/volume trade-off, left for future materiality-threshold tuning).

### 5.4 Feature / Capability: `Author` Modeling as the Tracked Article

- **Description:** Models `Author` as the specific Wikipedia article being tracked, not the platform, a contributor, or a contributor-history page.
- **Triggers:** First ingestion of any revision of a given article (discovery or re-poll).
- **Inputs:** The article's stable `pageid`, current title.
- **Processing:** `Author.externalAuthorId` = `pageid` (stable across page moves, unlike title); `Author.handle`/`displayName` = the article's current title; `Author.followerCount` left unpopulated (as with Newswire/GNews); `Author.firstSeenAt` set on first ingestion, `Author.lastSeenAt` updated on every subsequent qualifying revision.
- **Outputs:** One `Author` row per distinct `pageid`, reused across every `SocialPost` derived from that article's revisions.
- **Error handling:** N/A — resolution is a lookup-or-create keyed by `pageid`; no ambiguous-match case exists given a stable numeric key.
- **Edge cases:** An article's title changes (page move) — `Author.handle`/`displayName` is expected to be refreshed to the current title on next ingestion while `externalAuthorId` (`pageid`) remains stable, preserving the same `Author` row's identity across the rename.

### 5.5 Feature / Capability: Attribution via `SocialPost.url`

- **Description:** Satisfies Wikimedia's CC BY-SA/GFDL attribution requirement (a hyperlink to the article, which itself links to its own contributor-history page) through the existing `SocialPost.url` field, deliberately kept separate from the `Author` entity.
- **Triggers:** Creation of any `SocialPost` from a Wikipedia revision.
- **Inputs:** The revision's `revid` and the article's title.
- **Processing:** `SocialPost.url` is set to `https://en.wikipedia.org/w/index.php?title=<Title>&oldid=<revid>` — the specific revision's own permalink, never the bare, revision-less article URL.
- **Outputs:** A `SocialPost.url` that satisfies the attribution mechanism independently of what `Author` represents.
- **Error handling:** N/A — a derived, deterministic field.
- **Edge cases:** None beyond title-encoding correctness in the URL.

### 5.6 Feature / Capability: Watchlist Matching (Native Push-Down with Fallback)

- **Description:** Matches watchlist queries against Wikipedia content, pushing down to CirrusSearch operators where confirmed reachable through the standard API endpoint, and falling back to whole-article post-fetch matching for anything unconfirmed — the same connector-side-with-fallback pattern (ADR-0006) and capability-matrix declaration (ADR-0021) used by every other connector.
- **Triggers:** Any poll cycle evaluating fetched or discovered content against a tenant's watchlist AST.
- **Inputs:** The watchlist's AST (keyword/hashtag/boolean, including quoted phrases and exclusions where supported).
- **Processing:** `supportedQueryFeatures` is declared conservatively; features not confirmed reachable via `action=query&list=search` fall back to full whole-article text evaluation, exactly as the discovery-search call (Story 2.14) leaves the full boolean AST evaluated against fetched content regardless of what drove the initial search call.
- **Outputs:** A boolean match/no-match decision per watchlist per candidate post, and (on match) a published ingestion event, unchanged from every other connector's event-publishing path.
- **Error handling:** An unrecognized or unsupported operator never silently drops a candidate; it falls back to whole-content matching rather than being skipped.
- **Edge cases:** CirrusSearch's exact native-query-parameter surface through the standard endpoint was not fully confirmed at ADR-0042's acceptance — a named, ongoing verification gap that governs how conservative `supportedQueryFeatures` must stay.

### 5.7 Feature / Capability: Tenant Admin UI Exposure

- **Description:** Surfaces the Wikipedia connector as an activatable connector on the connectors screen, and as a selectable platform source on the watchlist creation/edit screen.
- **Triggers:** Tenant-Admin visits `tenant/connectors` or `tenant/watchlists`.
- **Inputs:** N/A — a UI listing, driven by the already-registered connector's static configuration.
- **Processing:** Adds a `wikipedia` entry with a distinct icon/color to both the connectors list and the watchlist platform-source list, using the same generic activate/deactivate mechanism (ADR-0051) already used by other connectors — no new backend surface required.
- **Outputs:** Tenant-Admin can activate/deactivate Wikipedia with no credential entry, and can target a new or existing watchlist at Wikipedia as a source.
- **Error handling:** Standard connector activate/deactivate error handling (already generic, not connector-specific) applies unchanged.
- **Edge cases:** None specific to Wikipedia beyond the no-credential activation flow already common to `authMode: 'none'` connectors.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Activates/deactivates the Wikipedia connector; creates/edits watchlists targeting it |
| Brand / Reputation Manager (tenant user) | Reviews ingested posts and reputation-relevant edit activity |
| Live ingestion-polling scheduler | Drives discovery and re-poll cycles automatically |
| Wikimedia MediaWiki API | External system providing `search`, `recentchanges`, and `revisions` data |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Story 2.13 | Tenant tracking public perception of a brand/topic with a Wikipedia presence | ...have the connector re-poll and discover Wikipedia articles | ...I see reputation-relevant edits, not just a one-time snapshot | Re-poll via `recentchanges` produces one `SocialPost` per qualifying revision, sharing one `Author` per `pageid`; `SocialPost.url` carries the revision permalink; whole-article fallback matching used for event publishing |
| Story 2.14 | Tenant who has activated the Wikipedia connector | ...have discovery search use my own watchlist terms | ...activating the connector lets me track my own brand/topic, not a shared hardcoded literal | Discovery search call uses the tenant's own watchlist query terms; full boolean AST is still evaluated against fetched content regardless of what drove the search call; `recentchanges`-driven re-poll of already-tracked articles is unchanged |
| Story 6.21 | Tenant-Admin | ...see Wikipedia listed as an activatable connector | ...I can turn it on without needing engineering involvement | Wikipedia appears in `tenant/connectors` with activate/deactivate via the existing generic surface (ADR-0051) |
| Story 6.22 | Tenant who wants to track a Wikipedia article | ...have Wikipedia offered as a platform source when creating/editing a watchlist | ...I can actually point a watchlist at it | Wikipedia appears as a selectable platform source in `tenant/watchlists` |

### 6.3 Workflow Diagrams / Steps

**Workflow: new-article discovery**

1. Scheduled poll cycle runs for a watchlist targeting the Wikipedia connector.
2. Connector issues a `search` request to the MediaWiki API using the watchlist's own query terms, with a compliant `User-Agent` header.
3. On a match not previously known to the connector, fetch the article's current full content, `pageid`, and title.
4. Resolve or create an `Author` row keyed by `pageid`.
5. Create a `SocialPost` with `url` set to the current revision's permalink, `text` set to the full article content, and link to the resolved `Author`.
6. Evaluate the post against every matching watchlist's full AST; on match, publish an ingestion event (unchanged from the standard pipeline).

**Workflow: revision re-poll of a tracked article**

1. Scheduled poll cycle runs for an article already known to the tenant (previously discovered).
2. Connector queries `recentchanges` filtered by the article's page and the time window since the last successful poll.
3. If zero qualifying entries: no-op, poll cycle ends.
4. If one or more qualifying entries: for each, fetch the revision's full current text and `revid`.
5. Resolve the existing `Author` row by `pageid` (never create a new one for the same article).
6. Create a new `SocialPost` per qualifying revision, with `url` set to that revision's own permalink; update `Author.lastSeenAt`.
7. Evaluate each new post against matching watchlists; publish ingestion events on match.

**Workflow: Tenant Admin activation**

1. Tenant-Admin opens `tenant/connectors`.
2. Sees Wikipedia listed with a distinct icon/color, no credential fields.
3. Activates it via the generic `POST /v1/connectors/wikipedia/activate` endpoint (ADR-0051) — no credential submission required.
4. Creates or edits a watchlist, selecting Wikipedia as a platform source (`tenant/watchlists`).
5. Ingestion begins on the next scheduled poll cycle.

---

## 7. Data Requirements

### 7.1 Data Inputs

MediaWiki Action API responses: `search` results (page matches), `recentchanges` entries (edits since last poll, filtered by page and time window), `revisions` content (full article text for a given `revid`), and page metadata (`pageid`, title).

### 7.2 Data Outputs

`SocialPost` rows (one per discovered article and per qualifying subsequent revision) and `Author` rows (one per distinct `pageid`), both tenant-scoped under RLS (ADR-0015); ingestion events published on watchlist match, feeding the existing downstream pipeline (Service Bus, per ADR-0029/Story 5.19).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialConnector` (Wikipedia registration) | `providerId: 'wikipedia'`, `authMode: 'none'`, `deliveryMode: 'poll'`, `supportedQueryFeatures` (conservative), `getRateLimitConfig()` (verified or explicitly-labeled placeholder) | Registered in the connector registry; activated per-tenant via ADR-0051's generic activate/deactivate surface |
| `Author` | `externalAuthorId` = article's stable `pageid`; `handle`/`displayName` = current article title; `followerCount` unpopulated; `firstSeenAt`/`lastSeenAt` = first/most-recent qualifying-revision ingestion timestamps | One `Author` row per distinct `pageid`; many `SocialPost` rows reference the same `Author` over the article's edit lifetime (many-post-to-one-`Author` reuse) |
| `SocialPost` | `url` = specific revision permalink (`?oldid=<revid>`); `text` = full unmodified article content at that revision; `publishedAt` = revision timestamp; `authorId` (FK to `Author`) | Many-to-one to `Author`; tenant-scoped under RLS (ADR-0015) |
| `Watchlist` | Query AST (keyword/hashtag/boolean); platform-source selection including `wikipedia` | Drives both discovery `search` queries and post-fetch match evaluation |
| `recentchanges` polling state | Last-polled timestamp per tracked article, used to window subsequent `recentchanges` queries | Internal scheduler/connector state, not a new persisted entity beyond existing poll-cursor mechanisms |

### 7.4 Validation Rules

- `Author.externalAuthorId` must be the article's numeric `pageid`, never its title (titles can change).
- `SocialPost.url` must always include a specific `oldid`; a bare article URL without a revision id is not a valid value for Wikipedia-sourced posts.
- A poll cycle with zero qualifying `recentchanges` entries must not produce any new `SocialPost` rows (no-op idempotency).
- `getRateLimitConfig()` must never contain a silently invented numeric ceiling — only a verified Wikimedia-published value or an explicitly-labeled conservative placeholder.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `Author` represents the specific tracked Wikipedia article, keyed by stable `pageid`, never the platform as a whole, a contributor, or a contributor-history page | `Author` resolution logic |
| BR2 | Attribution is satisfied through `SocialPost.url` (the specific revision permalink); `Author` does not carry the attribution obligation | `SocialPost` creation |
| BR3 | No account, API key, or tenant-specific credential is stored or transmitted; access is gated only by a compliant `User-Agent` header | Connector request construction |
| BR4 | Only unmodified article text is stored in `SocialPost.text`; any future external redistribution of AI-enrichment output derived from that text requires a prior CC BY-SA "Adapted Material" review | Enrichment/redistribution features (future) |
| BR5 | New-article discovery uses `search`; re-poll of already-tracked articles uses `recentchanges` | Poll-cycle routing |
| BR6 | Each tenant tracking the same public article ingests its own tenant-scoped copy of the same revision under RLS | Multi-tenant ingestion |
| BR7 | `recentchanges` cannot enumerate edits more than 30 days into the past; this is a rolling-window limitation of that endpoint, not of the underlying revision history | Re-poll windowing |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| MediaWiki Action API (`en.wikipedia.org/w/api.php`) | Inbound (fetch) | `search`, `recentchanges`, `revisions` content and metadata | HTTPS/JSON, `User-Agent`-gated, no auth |
| Connector registry / ingestion pipeline (`social-listening-core`) | Internal | Registers and drives the Wikipedia connector alongside GNews/Newswire/tenant-owned-feed/Facebook | In-process TypeScript |
| Live ingestion-polling scheduler | Internal | Triggers discovery and re-poll cycles on a schedule | In-process TypeScript |
| Watchlist matching engine (ADR-0006/ADR-0021) | Internal | Evaluates fetched/discovered content against tenant watchlists | In-process TypeScript |
| Service Bus (ADR-0029) | Outbound | Publishes ingestion events on watchlist match | Azure Service Bus |
| Tenant Admin UI (`social-listening-admin`) | Outbound (to user) | Lists Wikipedia as an activatable connector and watchlist platform source | HTTP/React (Next.js) |
| Postgres + RLS (ADR-0015) | Internal | Tenant-scoped storage of `SocialPost`/`Author` rows | SQL |

---

## 10. Non-Functional Considerations

- **Performance:** Polling must respect a conservative rate-limit posture until Wikimedia's exact published ceiling is verified; re-poll windowing avoids redundant `recentchanges` queries by tracking the last-polled timestamp per article.
- **Security / access control:** No credentials are stored for this connector; tenant isolation is enforced by existing RLS (ADR-0015), unchanged by this connector.
- **Scalability:** An actively-edited article can generate substantially more `SocialPost` volume over its lifetime than a GNews/Newswire one-shot item — a real, named cumulative storage driver against ADR-0018's existing tiered-retention policy, worth revisiting once real volume exists.
- **Reliability / availability:** A non-compliant `User-Agent` risks an unannounced HTTP 403 block from Wikimedia; the connector must always send the compliant header.
- **Audit and logging:** Standard connector health/status logging applies, unchanged from other connectors.
- **Accessibility:** Tenant Admin UI additions (Story 6.21/6.22) follow the same accessibility posture as existing connector/watchlist screens.
- **Localization / internationalization:** Per-language-edition MediaWiki endpoints are supported by the same mechanism; v1 scope is not otherwise localization-specific.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Non-compliant `User-Agent` triggers HTTP 403 | Connector shows a degraded/error health status | Request fails; connector must always send the compliant header, never omit it |
| Zero qualifying `recentchanges` entries | No visible change | No-op; no duplicate `SocialPost` rows created |
| Unconfirmed CirrusSearch operator in a watchlist query | No visible error to the tenant | Falls back to whole-article post-fetch matching rather than dropping the candidate |
| Rate limit exceeded (unverified exact ceiling) | Connector health may show degraded/throttled | Connector polls conservatively by default; must not invent a numeric ceiling |
| Article title changes (page move) between polls | No visible error | `Author` row is preserved via stable `pageid`; `handle`/`displayName` refreshed to current title |

---

## 12. Assumptions and Dependencies

- Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy remain as verified on 2026-08-06.
- Tenants use watchlist queries compatible with the confirmed `supportedQueryFeatures`; unconfirmed operators fall back cleanly.
- A conservative rate-limit placeholder is acceptable until the exact Wikimedia ceiling is verified.
- Whole, unmodified article text stored in `SocialPost.text` does not itself constitute an "Adapted Material" share under CC BY-SA 4.0 (not yet independently re-verified for AI-enrichment output redistribution).
- Depends on: ADR-0004 (Author normalization — this connector is a "Pending supersession note" data point), ADR-0021 (connector query-feature matrix), ADR-0027 (no-pooling — inapplicable here, no credential), ADR-0018 (tiered retention), ADR-0015 (RLS), ADR-0051 (generic connector activate/deactivate, built).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should ADR-0004 be generalized to a "rule of three" issuer-as-Author pattern, given this connector's structurally distinct third instance? | Menno / Architecture | Carried as a Pending supersession note on ADR-0004 |
| Q2 | What is CirrusSearch's exact native-query-parameter surface through the standard `action=query&list=search` endpoint? | Engineering | Implementation-time verification, not yet fully confirmed |
| Q3 | What is Wikimedia's exact numeric rate-limit ceiling? | Engineering | Verify before finally sizing `RequestGate`; conservative placeholder used until then |
| Q4 | Should a materiality threshold (edit size, minor-edit flag) gate re-ingestion of every qualifying revision? | Product / Engineering | Left as a future, named tuning option, not built |
| Q5 | How far should a newly discovered article's prior revision history be backfilled, if at all? | Engineering | Not designed; an implementation-time volume/cost trade-off |
| Q6 | Does AI-enrichment output derived from Wikipedia text, if ever redistributed externally, constitute "sharing Adapted Material" under CC BY-SA §3(b)? | Menno / Legal review | Flagged, not analyzed; required before any future external-redistribution feature |

---

## 14. Appendix

### Glossary

See BRD-0042 Section 15 for the full glossary (MediaWiki Action API, `recentchanges`, `pageid`, `oldid`/`revid`, Article-as-Author, CC BY-SA 4.0, GFDL, CirrusSearch, Adapted Material).

### Reference Links

- **ADR-0042:** `docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md`
- **BRD-0042:** `docs/project docs/Business-Requirements/BRD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md`
- **Related ADRs:** ADR-0004 (Author normalization), ADR-0021 (connector query-feature matrix), ADR-0027 (no-pooling), ADR-0018 (tiered retention), ADR-0015 (RLS), ADR-0051 (generic connector activate/deactivate), ADR-0006 (connector-side-with-fallback matching)
- **Stories:** Story 2.13, Story 2.14 (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`); Story 6.21, Story 6.22 (`docs/user-stories/epic-6-tenant-admin-ui.md`)

### Missing / Not Applicable Sources

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists for the Wikipedia connector; this FDD, like BRD-0042, is derived directly from ADR-0042, the connector-comparison entry in `docs/open-decisions.md`, and the named user stories.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0042 and BRD-0042, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
