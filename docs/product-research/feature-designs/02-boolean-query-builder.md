---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Boolean query builder

### What it is
A structured query interface that lets users build precise mention filters with `AND`, `OR`, `NOT`, phrase matching, grouping, and field scoping (author, source, language, location).

### End-user benefits
- **Precision:** reduce noise by excluding common false positives.
- **Shareability:** queries can be saved as watchlists and reused across the team.
- **Power for analysts:** brand + campaign - competitor, in English, from news only, becomes a single reusable watchlist.

### Core details
- The `watchlists` table already stores a boolean AST (`watchlist_ast`) and `matchType`.
- A UI query builder generates the AST visually and validates it against the per-connector capability matrix.
- Connector-side native filtering is preferred; `matchesWatchlist()` fallback runs in the ingestion pipeline.

### Implementation complexity
**Medium for the backend; higher for the UI.** The AST and fallback matching are already implemented. The main remaining work is a visual, platform-aware query composer and real-time validation against connector capabilities.

### Growth and reach
A good query builder lowers the skill barrier for non-technical users and increases the accuracy of dashboards and alerts, making the product credible next to Brandwatch/Talkwalker.

---

## Technical design

- **Data flow:** user builds a query in the UI → frontend validates and emits a Boolean AST → `PATCH /v1/watchlists/:id` stores `watchlist_ast` (JSONB) and `matchType` → ingestion or fetch path matches posts against the AST → matched posts join `post_watchlist_matches`.
- **Component interactions:** the query builder writes AST nodes; `ast.ts` evaluates `AND`, `OR`, `NOT`, phrase/exact, and field scoping; `matchesWatchlist()` in the ingestion fallback path runs for connectors without native filtering; connector-native watchlist support is documented per connector `SKILL.md`.
- **REST/Service Bus contracts:** `GET/POST/PATCH/DELETE /v1/watchlists` (RFC 7396 PATCH, ADR-0044), `GET /v1/posts?watchlistId` (server-side filter, Story 3.11), `SocialPostIngestedEvent` triggers re-matching.
- **Storage:** `watchlists` table with `tenant_id`, `matchType`, `watchlist_ast`; `post_watchlist_matches` junction for persisted match results.
- **Security considerations:** watchlist ownership is per-user; RLS on both tables; no raw query string is executed against the database; AST is evaluated in-process.

## Backend principles

- **AST as source of truth.** The watchlist is stored as a normalized, serializable AST, not as a free-form string. Evaluator and UI must produce the same tree.
- **Connector-side first, fallback second.** Prefer native platform/RSS filtering where the connector declares support (e.g., Brave/Bing search, GNews). Fallback `matchesWatchlist()` runs on every ingested `SocialPost`.
- **Postgres + RLS.** `watchlists` and `post_watchlist_matches` are tenant-scoped and user-scoped where applicable. Optimistic locking via `version` prevents lost updates.
- **Contract-test targets.** Cover all Boolean operators, nested groups, phrase/exact, field scoping, and the equivalence between fallback matcher and any connector-native translation.

## Frontend / UI principles

- **User flow:** user creates a watchlist → visual query composer or raw text mode → live preview of sample matches → save → use in post feed and analytics.
- **Component hierarchy:** `WatchlistEditor` → `QueryBuilder` (block-based or text) → `QueryPreview` (sample posts) → `MatchCountBadge`.
- **State management:** Local AST state in the editor; debounced preview fetch; server sync via PATCH.
- **Accessibility and responsive design:** Clear operator labels, keyboard navigation between blocks, color not the only cue for AND/OR distinction, mobile stack of query blocks.

## Open questions

- Should the query language support `NEAR`, `WILDCARD`, and regex, or stop at `AND`/`OR`/`NOT`/phrase?
- How should the UI explain connector-specific limitations (e.g., "LinkedIn does not support NOT")?
- Should saved queries be shareable at tenant or user level?
- How do we test and enforce that connector-native and fallback matching return identical results for the same watchlist?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Support `NEAR`/`WILDCARD`/regex?** | Support `NEAR/x` and a trailing `*` wildcard in the AST, but **defer regex and `?` single-character wildcards** to v2. `NEAR/x` and `*` are common in listening tools; regex is rarely supported by social-platform search APIs and is expensive to simulate reliably. | Talkwalker supports `*`/`?` and `NEAR/x`; SentiOne supports `NEAR` and trailing `*`; Lexalytics/Spotlight supports `NEAR/1-99` and wildcards. Meta Content Library only supports AND/OR/NOT with no wildcards. |
| **How to explain connector limitations?** | Use a **connector capability matrix** in the UI. When a user adds an operator a selected connector cannot translate, show a warning chip and a tooltip: e.g. "LinkedIn does not support `NOT` — this clause will run as a fallback matcher." Keep a "fallback" or "native" badge on each query group. | API Direct and Social Searcher both publish per-endpoint operator tables. Kommon Poll's docs emphasize "use filters instead of query text when possible." Meta's advanced search docs explicitly list which operators are supported and note that phrase search is not. |
| **Saved query sharing?** | **Tenant-level sharing by default**, with an opt-in private flag. Watchlists are the primary monitoring artifact; teams need shared queries for consistent dashboards and alerts. RLS on `watchlists` already enforces `tenant_id`. | Kommon Poll groups queries into workspace-level projects. SentiOne and Talkwalker projects are shared team resources. |
| **Native vs. fallback identical?** | Maintain a **reference test corpus** of posts for each connector. For every new connector, run the same watchlist through both the native API filter and the fallback `matchesWatchlist()` matcher, then compare the resulting `post_watchlist_matches` set. Differences are bugs until parity is proven. | API Direct passes the exact query through to each platform, which means native and fallback are likely to diverge. The only safe approach is contract tests that assert parity on a representative corpus. |

### Sources consulted

- Talkwalker Developer Portal — https://developer.talkwalker.com/docs/query-syntax/boolean-operators
- SentiOne Listen Query Language — https://listen.help.sentione.com/reference/listen-query-language
- Lexalytics/Spotlight query operators — https://spotlight-docs.lexalytics.com/docs/query-operators
- Meta Content Library advanced search — https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/advanced-search/
- API Direct boolean search docs — https://apidirect.io/docs/boolean-search
- Social Searcher premium API — https://www.api-docs.social-searcher.com/premium-api.html
- Kommon Poll Query Builder — https://docs.kommonpoll.com/query-builder
- LinkedIn Boolean Search guide — https://linkedapi.io/guides/linkedin-boolean-search

## Persona acceptance

- **Tenant-Admin (primary):** can build and save tenant-wide watchlists through a visual query builder that validates connector-specific operator support.
- **Tenant-Business-Analyst (primary):** can preview the exact post set a query will match, export the AST, and reuse the saved query in the API and exports.
- **Tenant-User (primary):** can build personal watchlists without knowing Boolean syntax; the UI explains why a query matched or missed a post.
- **Topic-Center-Analyst (primary):** can scope topic research with complex nested queries and phrase matching across languages and sources.
- **Tenant-Brand-Reputation-Manager (secondary):** can exclude noise and competitors with `NOT` operators and get a clear warning when a clause cannot be translated to a connector.

## AI enhancements

- **Natural-language to Boolean:** user types “show me positive mentions of our brand in English but not from trolls” and the AI emits a valid `watchlist_ast`.
- **Query explanation:** AI explains why a query matched or missed a post in plain language.
- **Suggested refinements:** based on sample results, the AI recommends excluding keywords or adding operators to reduce noise.
- **Connector-aware validation:** the builder warns when a query cannot be translated into a connector's native filtering.
