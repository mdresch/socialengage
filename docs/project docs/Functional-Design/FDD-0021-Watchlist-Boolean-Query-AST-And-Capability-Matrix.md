# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0021 Watchlist Boolean Query AST and Capability Matrix — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0021 is Accepted; this FDD documents the shipped design — see Story 3.6) |
| Related Documents | ADR-0021, BRD-0021, ADR-0006, ADR-0002, ADR-0009/0010, Feature Design 02 (Boolean query builder), Story 3.6 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0021 (Unified boolean-query AST for watchlist matching, with per-connector capability matrix) and BRD-0021 into the functional design for how a tenant's `Watchlist.booleanQuery` is parsed exactly once into a canonical AST, how that single AST is consumed identically by connector-native query translation and the shared post-fetch fallback matcher, and how per-connector query-feature support is declared, evaluated, and surfaced to tenants and admins. ADR-0021 is Accepted (2026-07-29) and Story 3.6 shipped it (`social-listening-core@5c375ec`, 2026-07-30); this FDD is not a draft.

### 2.2 Scope

**In scope:**
- Parsing a `booleanQuery` string into a canonical, platform-agnostic AST with v1 node types `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- The `supportedQueryFeatures: AstNodeType[]` capability declaration on the `SocialConnector` interface.
- Whole-query degradation logic: if any AST node type used by a query is not in a connector's declared `supportedQueryFeatures`, the entire query falls back to post-fetch matching for that connector.
- Shared evaluation contract: the same AST drives both connector-native translation and the shared post-fetch fallback matcher (`matchesWatchlist()`).
- Tenant/admin-visible surfacing of fallback state on the connector status page and the watchlist detail view.
- Parity behavior between native and fallback matching paths for identical input data.

**Out of scope:**
- Per-clause degradation (deferred until a third connector shows partial, divergent capability — rule-of-three trigger per ADR-0021's Acceptance note).
- Creation-time blocking validation UI in the watchlist builder.
- Advanced operators beyond v1 (`NEAR`, wildcard, regex) — noted as a future feature-design open question, not built.
- The visual/block-based query builder UI itself (tracked separately; this FDD covers AST semantics and capability matrix behavior consumed by that UI, not the UI's own interaction design).

### 2.3 Target Audience

Backend engineers implementing or extending connectors, admin UI engineers building the connector status/watchlist detail views, QA authoring parity contract tests, product owner.

---

## 3. Context and Background

ADR-0006 established that watchlist matching can happen either connector-side (native query filtering) or in a shared post-fetch fallback matcher in the core, but left the two paths as independent reimplementations of "what does this boolean query mean." ADR-0006's own Negative consequences flagged the resulting risk directly: a tenant's `booleanQuery` — e.g. `"acme AND (support OR help) NOT jobs"` — could be interpreted differently by a connector's native translation than by the fallback matcher, producing inconsistent matched posts depending purely on which platform sourced a post. ADR-0021 closes that gap by making the AST the single parsed representation both paths consume, and by requiring connectors to declare, rather than silently approximate, which parts of that representation they can translate.

Source requirements: BRD-0021 §§6–7 (current/future state), Story 3.6 (Epic 3, shipped 2026-07-30). Constraint carried from ADR-0021: whole-query (not per-clause) degradation for v1, given only two near-term connectors (RSS/News, Reddit) are in scope and RSS has little-to-no native boolean support regardless.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Eliminate silent divergence between connector-native and post-fetch matching | Parity contract test: same `Watchlist` against a mock full-support platform and a mock no-support platform yields identical matched posts for identical input data |
| G2 | Make platform query limitations an explicit, inspectable fact | Every connector declares `supportedQueryFeatures`; the admin UI capability matrix and per-watchlist badge reflect it |
| G3 | Keep the tenant informed when native filtering is not being used | Watchlist detail view and connector status page show a fallback indicator, not a silent behavior change |
| G4 | Keep connector onboarding cost low | New connectors translate one shared AST and declare support rather than reimplementing boolean semantics |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Boolean Query Parsing to Canonical AST

- **Description:** Converts a tenant-authored `booleanQuery` string into a canonical, serializable AST (`watchlist_ast`, JSONB) that is the sole representation used by every downstream matching path.
- **Triggers:** A `Watchlist` is created or its `booleanQuery` is updated (`POST`/`PATCH /v1/watchlists`).
- **Inputs:** Raw `booleanQuery` string (e.g. `"acme AND (support OR help) NOT jobs"`), hashtag/account/term tokens embedded in the query.
- **Processing:**
  - Parse the string exactly once, at the core layer, before any connector or fallback matcher sees it.
  - Recognize v1 node types only: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`. Support nested grouping (parentheses).
  - Persist the resulting AST as `Watchlist.watchlist_ast`; the original string remains available for display/editing.
  - A parse happens once per save, not once per matching attempt — the same stored AST is reused by every subsequent native translation or fallback evaluation until the query is edited again.
- **Outputs:** A persisted `watchlist_ast` JSONB structure associated with the `Watchlist`.
- **Error handling:** A malformed or unparseable `booleanQuery` (unbalanced parentheses, unrecognized operator) is rejected with a tenant-readable validation error at save time (BRD-0021 NFR-004); no partial/best-effort AST is persisted.
- **Edge cases:** Deeply nested groups; a query using only `TERM` nodes (no boolean operators) still produces a valid single-node AST; empty/whitespace-only query is rejected rather than producing an always-match AST.

### 5.2 Feature / Capability: Per-Connector Capability Declaration (`supportedQueryFeatures`)

- **Description:** Each connector declares, as part of its implementation of the `SocialConnector` interface (ADR-0002), which AST node types it can correctly translate into its platform's native query syntax.
- **Triggers:** Declared statically per connector at implementation time; read by the core whenever a watchlist is matched against that connector.
- **Inputs:** The connector's own knowledge of its platform's query grammar (e.g., GNews's `q` parameter genuinely supports `AND`/`OR`/`NOT`/phrase; RSS/Newswire and Facebook expose no native query surface at all).
- **Processing:** `supportedQueryFeatures: AstNodeType[]` is exposed as a field on the connector's implementation of `SocialConnector`. This is a capability contract, not a runtime negotiation — the core trusts the declaration and does not independently verify translation correctness at request time (correctness is instead enforced by contract tests, see 5.3 Error handling).
- **Outputs:** A per-connector array of supported node types, readable by the core's matching-path selection logic and by the admin UI's capability matrix.
- **Error handling:** An inaccurate declaration (claiming support the connector cannot actually honor) is a connector-author defect, not a runtime-detected condition — mitigated by required parity contract tests (BRD-0021 R-003), not by the running system.
- **Edge cases:** A connector with an entirely empty `supportedQueryFeatures` (e.g. RSS/Newswire, Facebook) always falls back to post-fetch matching — this is an expected, valid declaration, not a defect.

### 5.3 Feature / Capability: Whole-Query Degradation and Matching-Path Selection

- **Description:** Before a poll/fetch is issued to a connector, the core compares the watchlist's AST node types against that connector's `supportedQueryFeatures` and selects exactly one matching path for the entire query.
- **Triggers:** Every ingestion poll/fetch cycle for a `Watchlist` against a given connector.
- **Inputs:** `Watchlist.watchlist_ast`, the target connector's `supportedQueryFeatures`.
- **Processing:**
  1. Enumerate every distinct AST node type present in the watchlist's AST.
  2. If every node type is included in the connector's `supportedQueryFeatures`, translate the full AST into the connector's native query syntax and rely on server-side filtering.
  3. If any single node type is not supported, the entire query — not just the unsupported clause — falls back to the shared post-fetch matcher for that connector. No partial native translation is attempted (whole-query, not per-clause, degradation is the v1 default per ADR-0021).
  4. Record which matching path (native vs. fallback) was used for the resulting `IngestionRun`/fetch so it is queryable later.
- **Outputs:** A matching-path decision per (`Watchlist`, connector) pair; either a native query sent to the platform or full post-fetch evaluation against fetched posts.
- **Error handling:** If translation to native syntax fails unexpectedly at runtime despite a supported declaration, the fetch does not silently drop matching — the system falls back to post-fetch matching for that run rather than returning zero/incorrect results.
- **Edge cases:** A connector supporting 5 of 6 v1 node types still loses native filtering entirely for any query using the 6th (e.g., a platform lacking `NOT` loses native filtering for any query containing `NOT`, even if the rest of the query is simple `AND`/`TERM`) — this is the accepted v1 trade-off (ADR-0021 Negative consequences), to be revisited once a third connector shows partial, divergent support (rule of three).

### 5.4 Feature / Capability: Shared Post-Fetch Fallback Matching

- **Description:** The single fallback matcher (`matchesWatchlist()`) evaluates the canonical AST directly against normalized post text, independent of which connector sourced the post.
- **Triggers:** Invoked whenever the matching-path selection (5.3) determines native filtering is unavailable for a `Watchlist`/connector pair, and on every ingested post for connectors with no native support at all.
- **Inputs:** `Watchlist.watchlist_ast`, the normalized text/metadata of a fetched `SocialPost` (post body, hashtags, author/account).
- **Processing:** Recursively evaluates the AST tree (`AND`/`OR`/`NOT` combinators over `TERM`/`HASHTAG`/`ACCOUNT` leaf matches) against the post's normalized fields. Because this is the identical AST a native translation would have used, it is guaranteed to express the same boolean semantics as any native path for the same query — this is the specific guarantee ADR-0021 exists to provide.
- **Outputs:** A boolean match decision per post; matches are recorded in `post_watchlist_matches`.
- **Error handling:** Evaluation is in-process against already-fetched, already-normalized text — no raw query string is ever executed against the database (BRD-0021 Constraint).
- **Edge cases:** A post missing a field the AST references (e.g. no hashtags present, `HASHTAG` node in query) evaluates that leaf as non-matching rather than erroring; nested `NOT` inside `AND`/`OR` groups evaluates according to standard boolean precedence with parentheses honored.

### 5.5 Feature / Capability: Fallback/Capability Visibility (Admin UI Surfacing)

- **Description:** Makes the capability matrix and per-watchlist fallback state visible to tenants and platform admins rather than an implicit, undiscoverable behavior.
- **Triggers:** Rendering the connector status page or a watchlist detail view.
- **Inputs:** Connector `supportedQueryFeatures` (per connector); the recorded matching path used for a `Watchlist` against a given connector.
- **Processing:** The connector status page lists, per connector, which of the six v1 AST node types it supports (a capability matrix). The watchlist detail view shows a lightweight badge ("using post-fetch matching for X") when any connected platform is not using native filtering for that watchlist's current query. Per ADR-0021's Acceptance note, this is display-only — there is no creation-time blocking warning in the watchlist builder for v1.
- **Outputs:** Rendered capability matrix (connector status page) and fallback badge (watchlist detail view).
- **Error handling:** If capability data cannot be loaded, the page should degrade to omitting the matrix/badge rather than blocking the underlying watchlist/connector functionality.
- **Edge cases:** A watchlist connected to multiple connectors with different capability profiles shows a per-connector fallback state, not a single tenant-wide flag.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Owns tenant-wide watchlists; needs visible fallback warnings |
| Tenant-Business-Analyst | Builds complex boolean queries; needs consistent cross-platform results |
| Tenant-User | Builds personal watchlists |
| Tenant-Brand-Reputation-Manager | Relies on `NOT` to exclude noise; needs clear warning when exclusion can't translate |
| Connector Author (engineering) | Implements and declares `supportedQueryFeatures` per platform |
| Platform Admin | Reviews capability matrix and parity test results across tenants |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 3.6) | Tenant with a `booleanQuery` watchlist | Have my query parsed once into a canonical AST used identically by every connector and the fallback matcher | I get consistent matching regardless of which platform sourced a post | AST built with v1 node types before any evaluation; identical results on full-support vs. no-support mock platforms for identical input |
| US2 | Tenant relying on server-side filtering for cost/rate-limit reasons | Know when a platform stops honoring my query natively | I'm not silently paying the fallback cost / missing the rate-limit benefit without knowing | Connector status page and watchlist detail badge surface fallback state |
| US3 | Connector author | Declare exactly which AST features my platform supports | New connectors integrate without reimplementing boolean semantics | `supportedQueryFeatures` on `SocialConnector`; parity contract test required before merge |
| US4 | Platform Admin | See a per-connector capability matrix | I can reason about platform limitations across the fleet | Connector status view lists AND/OR/NOT/TERM/HASHTAG/ACCOUNT support per connector |

### 6.3 Workflow Diagrams / Steps

**Watchlist save flow:**
1. Tenant creates/edits a `Watchlist` with a `booleanQuery` string via `POST`/`PATCH /v1/watchlists`.
2. Core parses the string into an AST exactly once; malformed queries are rejected with a validation error (no partial save).
3. AST persists as `Watchlist.watchlist_ast`.

**Matching flow (per ingestion poll/fetch, per connector):**
1. Core loads the `Watchlist.watchlist_ast` and the target connector's `supportedQueryFeatures`.
2. Core enumerates the AST's node types and checks each against the connector's declared support.
3. If all supported → translate the full AST to the connector's native query syntax; issue the fetch with server-side filtering; record matching path = native.
4. If any node unsupported → issue a broader fetch (or use the connector's own default fetch behavior) and evaluate every fetched post's normalized text against the AST via the shared fallback matcher; record matching path = fallback.
5. Matches persist to `post_watchlist_matches`.
6. Matching-path state feeds the connector status page's capability matrix and the watchlist detail view's fallback badge.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Tenant-authored `booleanQuery` string (watchlist creation/edit UI or API).
- Connector-declared `supportedQueryFeatures` (static, per connector implementation).
- Fetched `SocialPost` normalized text/metadata (from each connector's ingestion path).

### 7.2 Data Outputs

- Persisted `Watchlist.watchlist_ast` (JSONB).
- `post_watchlist_matches` rows recording which posts matched which watchlist.
- Matching-path (native/fallback) record per `Watchlist`/connector/ingestion run, consumed by the admin UI.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `Watchlist` | `id`, `tenant_id`, `owner_user_id` (nullable for tenant-wide), `booleanQuery` (string), `watchlist_ast` (JSONB), `matchType`, `version` | Belongs to a tenant; optionally owned by a user; referenced by `post_watchlist_matches` |
| `SocialConnector` (interface, extended) | `connectorId`, existing ADR-0002 fields, `supportedQueryFeatures: AstNodeType[]` (new) | Implemented by each concrete connector (GNews, Newswire, tenant-owned-feed, Wikipedia, Facebook, future Reddit) |
| AST node (`watchlist_ast` internal structure) | `type` (`AND`\|`OR`\|`NOT`\|`TERM`\|`HASHTAG`\|`ACCOUNT`), `children`/`value` depending on type | Recursive tree structure stored within one `Watchlist.watchlist_ast` |
| `post_watchlist_matches` | `post_id`, `watchlist_id`, matched-at metadata, matching path used | Junction between `SocialPost` and `Watchlist` |
| `IngestionRun` / fetch record (existing entity, extended) | matching path field (native vs. fallback) | Associated with a `Watchlist` and a connector for a given poll cycle |

### 7.4 Validation Rules

- `booleanQuery` must parse into a valid AST using only v1 node types; unparseable strings are rejected at save time with a tenant-readable error.
- `watchlist_ast` is never hand-edited directly by a client — it is always derived from `booleanQuery` by the single core parser.
- `supportedQueryFeatures` values must be drawn from the v1 `AstNodeType` enum; connectors must not declare node types the parser does not recognize.
- No raw `booleanQuery` string is ever passed to the database for evaluation — only the parsed AST is evaluated, and only in-process.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A `Watchlist.booleanQuery` is parsed exactly once; the resulting AST is the only representation used for matching thereafter. | Watchlist save (5.1) |
| BR2 | A connector must accurately declare `supportedQueryFeatures` for every AST node type it can correctly translate. | Connector implementation (5.2) |
| BR3 | If any AST node type in a query is not in a connector's `supportedQueryFeatures`, the entire query falls back to post-fetch matching for that connector — no per-clause degradation in v1. | Matching-path selection (5.3) |
| BR4 | Degradation to post-fetch matching must be surfaced to the tenant; it must never be silently absorbed. | Admin UI surfacing (5.5) |
| BR5 | The v1 AST node type set is fixed at `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`. | Parsing (5.1), capability declaration (5.2) |
| BR6 | The post-fetch matcher and every connector-native translation must produce the same match set for the same AST and the same input data. | Parity guarantee (5.3, 5.4) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `POST`/`PATCH /v1/watchlists` | Inbound | Accept `booleanQuery`, trigger parse-to-AST | REST / JSON, RFC 7396 PATCH (ADR-0044) |
| `SocialConnector` implementations (GNews, Newswire, tenant-owned-feed, Wikipedia, Facebook) | Outbound | Native query translation where `supportedQueryFeatures` allows | Per-platform native query API |
| Shared fallback matcher (`matchesWatchlist()`) | Internal | Evaluate AST against normalized post text | In-process function call |
| `post_watchlist_matches` (Postgres, RLS) | Outbound | Persist match results | SQL / tenant-scoped table |
| Connector status page, watchlist detail view (admin UI) | Outbound | Render capability matrix and fallback badge | REST read endpoints consumed by Next.js UI |
| `GET /v1/posts?watchlistId` | Outbound | Server-side filter of posts by matched watchlist (Story 3.11) | REST / JSON |

---

## 10. Non-Functional Considerations

- **Performance:** Whole-query degradation trades away native-filtering rate-limit/bandwidth savings (ADR-0006) whenever any single clause is unsupported; this is an accepted v1 cost, not a defect.
- **Security/access control:** Watchlist ownership and matches are tenant- and user-scoped under RLS; AST evaluation never executes a raw string against the database.
- **Reliability:** Malformed queries are rejected at save time rather than producing an ambiguous or always-matching AST at evaluation time.
- **Maintainability:** A single parser/evaluator/AST definition is the one place boolean semantics are specified and tested, rather than semantics being implicitly redefined per connector.
- **Consistency (parity):** Native and fallback matching paths must return equivalent results for the same watchlist and input data — enforced via contract tests against a reference corpus, not by runtime cross-checking.
- **Usability:** Fallback state and connector limitations are communicated in plain, non-technical language (badges/tooltips), not raw AST/operator jargon.
- **Audit/observability:** The matching path used for a given ingestion run is recorded and queryable, supporting the "native vs. post-fetch match ratio" and "unsupported operator usage" reporting BRD-0021 calls for.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Malformed `booleanQuery` (unbalanced parens, unknown operator) | Tenant-readable validation error at save time | Save rejected; no `watchlist_ast` persisted; existing AST (if editing) unchanged |
| Connector declares support it cannot actually honor | No runtime-visible error | Latent defect surfaced only via failing parity contract tests before release, not to the tenant |
| Native translation fails unexpectedly at runtime despite supported declaration | No user-facing error (transparent) | Falls back to post-fetch matching for that run rather than dropping matches |
| Any AST node unsupported by a connector | Fallback badge shown on watchlist detail view and connector status page | Whole query evaluated via post-fetch matcher for that connector; no partial native translation attempted |
| Capability/fallback data fails to load in the UI | Matrix/badge silently omitted | Underlying watchlist and connector functionality remains unaffected |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- The `watchlists` table already stores `booleanQuery` and `matchType` (pre-existing schema).
- A post-fetch matching mechanism (`matchesWatchlist()`) already exists and can evaluate structured queries against ingested posts (ADR-0006).
- Connector authors can and do accurately self-declare `supportedQueryFeatures`.
- The near-term connector roster (RSS/News, Reddit, per spec §10's committed order) is small enough that whole-query degradation's cost is acceptable.

**Dependencies:**
- `SocialConnector` interface (ADR-0002) — extended with `supportedQueryFeatures`.
- Connector-side filtering with post-fetch fallback (ADR-0006) — the architecture this ADR closes a consistency gap in.
- Connector status page / admin UI (ADR-0009/ADR-0010, Phase 1 admin UI scope) — the surface that renders the capability matrix and fallback badge.
- `Watchlist` CRUD / row-shape validation (ADR-0044).
- Story 3.6 (shipped 2026-07-30, `social-listening-core@5c375ec`) — the implementation this FDD documents.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should per-clause degradation replace whole-query once a third connector shows partial, divergent capability? | Technical Lead | Revisit when a third connector (beyond RSS/News, Reddit) is onboarded (rule of three, per ADR-0021 Acceptance note) |
| Q2 | Should the query language extend to `NEAR`/wildcard operators beyond v1's six node types? | Product Owner | Deferred — feature-design 02 open question, not scheduled |
| Q3 | Should saved queries/watchlists be shareable at tenant level with an opt-in private flag? | Product Owner | Noted in feature-design 02, not yet decided for this ADR's scope |

---

## 14. Appendix

**Glossary:** see BRD-0021 §15 for AST, `supportedQueryFeatures`, whole-query degradation, post-fetch matching, native filtering, `matchType`, and Watchlist definitions.

**Reference links:**
- [ADR-0021: Unified boolean-query AST for watchlist matching, with per-connector capability matrix](../../adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md)
- [BRD-0021](../Business-Requirements/BRD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md)
- [ADR-0006: Connector-side watchlist filtering with post-fetch fallback](../../adr/0006-connector-side-watchlist-filtering-with-post-fetch-fallback.md)
- [ADR-0002: `SocialConnector` interface] (referenced by ADR-0021; not independently verified in this pass)
- [Feature design 02 — Boolean query builder](../../product-research/feature-designs/02-boolean-query-builder.md)
- [Story 3.6 — Unified boolean-query AST for watchlist matching](../../user-stories/epic-3-data-model-storage-and-archival.md)

**Missing sources:** No `docs/product-research/reports/<feature>-deep-research.md` exists specifically for the boolean-query AST; feature-design 02 includes its own "Research-based recommendations" table in lieu of a separate deep-research brief, and is cited above in place of one.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown, real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
