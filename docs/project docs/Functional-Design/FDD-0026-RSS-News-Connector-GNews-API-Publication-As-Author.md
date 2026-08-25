# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0026 RSS/News Connector: GNews API, Publication-as-Author — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0026 is Accepted; documents shipped design — Story 2.7) |
| Related Documents | ADR-0026, BRD-0026, ADR-0002, ADR-0004, ADR-0014, ADR-0021, ADR-0024, ADR-0027, Story 2.7 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0026 (RSS/News connector — GNews API, with publication-as-Author modeling) and BRD-0026 into the functional design for the RSS/News platform category's first concrete connector implementation: a GNews API-based connector using per-tenant `apiKey` authentication, polling, native AND/OR/NOT/phrase query translation, and publication-as-Author modeling. ADR-0026 is Accepted (2026-07-31, same day drafted and accepted); Story 2.7 implements it. This FDD documents the shipped design.

### 2.2 Scope

**In scope:**
- GNews API (`gnews.io`, `/api/v4/search`) as the concrete RSS/News provider.
- `authMode: 'apiKey'` — per-tenant credential, registered via the existing connect flow and stored under ADR-0014's envelope-encrypted model.
- `deliveryMode: 'poll'`.
- Normalization of GNews articles (`id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, `source`) into `SocialPost`.
- Publication-as-Author modeling: `Author` represents the source publication, not an individual — the second connector (after Newswire) to need this exact departure from ADR-0004.
- `supportedQueryFeatures` declaring GNews's real native AND/OR/NOT/phrase capability within `q`.
- Enforcement of the free-tier 100 requests/day, 10 articles/request, per-tenant ceiling.
- The explicit, accepted non-commercial-use operating constraint tied to this project's current self-funded status.

**Out of scope:**
- Commercial/paid-tier GNews usage at v1.
- A second general-news connector or NewsData.io integration (deferred, unconfirmed formal terms).
- Cross-publication de-duplication strategy and exact AST-to-`q`-syntax translation (both implementation-time decisions).
- Historical backfill beyond GNews's own 30-day window.
- Generalizing organization-as-Author into ADR-0004's base text (deferred per "rule of three" — two instances is not yet three).
- Push/webhook delivery (GNews exposes none).

### 2.3 Target Audience

Backend engineers implementing/extending the connector, product owner, tenant admins connecting the source, platform admins monitoring quota/health.

---

## 3. Context and Background

RSS/News and Reddit were chosen (2026-07-29) as Phase 1's first and second platforms; the full architectural slice around that choice (connector framework, `Author`, `IngestionRun`, rate limiting, error handling/auto-disable, watchlist matching, pagination, derived health) was built and contract-verified — but the actual RSS/News connector implementation was never built, remaining Phase 1's single oldest unbuilt gap even after the later, Phase-4 Newswire connector shipped ahead of it as a deliberate, ADR-sanctioned deviation.

Two questions needed deciding, mirroring what ADR-0024 answered for Newswire: (1) which concrete provider — "RSS/News" was already characterized as `poll`-only, API-key auth, no paid tier, before any real vendor was checked, and that characterization needed to survive contact with a real vendor's terms; (2) how to model an article's "author" — GNews reports the publication an article came from, not a byline, a data shape the platform doesn't return at all (not merely a variant, the way Newswire's issuing organization was). A same-day research pass (drafted by the AI Business & Requirements Analyst persona, reviewed and accepted by Menno as Sponsor) rejected NewsAPI.org (categorical ban on staging/production use, any commercial status), Currents API (a third-party "production-safe" claim that did not survive direct verification against Currents' own pages), and Mediastack (100 calls/*month*, too thin); GDELT and a keyless-RSS approach were considered but not selected because either would repeat Newswire's `authMode: 'none'` deviation rather than prove the `apiKey` path for the first time — the specific gap this ADR closes. NewsData.io was deferred (its formal terms pages could not be rendered directly across four attempts; its own blog content was internally inconsistent about free-vs-paid commercial fit).

A real internal inconsistency in GNews's own terms is named, not silently resolved: the pricing-page FAQ states the free tier "cannot be used for commercial projects," while the Terms of Service (§3.3) states retrieved data "may be used for commercial purposes" with no plan-based carve-out. This ADR adopts the more conservative FAQ reading as the operative constraint, consistent with how the project treats every other platform provider's terms — and names this as something requiring re-evaluation if the project ever monetizes, not a permanent property.

Source requirements: BRD-0026 §§6–7, Story 2.7 (Epic 2, Ready as of ADR-0026's 2026-07-31 acceptance).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Close Phase 1's oldest unbuilt gap | Story 2.7 built and contract-verified against the live ingestion pipeline |
| G2 | Expand tenant coverage to general-news sources | Tenant-Admin can connect, activate, and view healthy GNews-sourced posts in the unified feed |
| G3 | Prove the `apiKey` auth mode for the first time in a real, running build | GNews connector exercises `authMode: 'apiKey'` end to end |
| G4 | Confirm the publication-as-Author pattern generalizes beyond a Newswire one-off | Two connectors (Newswire, GNews) resolve `Author` to an organization/outlet using the identical scoped-exception pattern |
| G5 | Stay within GNews's own published terms | Free-tier non-commercial constraint documented, accepted, and flagged for re-evaluation before monetization |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: GNews Connector Registration and Per-Tenant Credential

- **Description:** Registers a distinct `SocialConnector` for GNews and lets each tenant connect using their own free-tier API key.
- **Triggers:** Tenant-Admin initiates `POST /connectors/gnews/connect`.
- **Inputs:** A per-tenant GNews API key.
- **Processing:** `authMode: 'apiKey'` — the key is stored under ADR-0014's existing envelope-encrypted credential model, exactly as any other API-key connector, with no new credential-storage pattern introduced. The 100-requests/day ceiling is therefore per-tenant, not a project-wide shared pool — no tenant's usage affects another's quota.
- **Outputs:** A stored, encrypted per-tenant credential; the connector becomes available for polling once activated.
- **Error handling:** An invalid/rejected key surfaces as a connect-time failure, not a later silent poll failure.
- **Edge cases:** A tenant with no registered key cannot activate the connector — this is the same pattern every other `apiKey` connector already follows.

### 5.2 Feature / Capability: Polling and Article Normalization

- **Description:** Polls GNews's `/api/v4/search` endpoint and normalizes each returned article into the platform's canonical `SocialPost` shape.
- **Triggers:** Scheduled poll cycle for a tenant with the connector active and a valid key.
- **Inputs:** The tenant's `apikey`, the watchlist-derived `q` query (see 5.4), GNews's paginated article response.
- **Processing:** `deliveryMode: 'poll'` (GNews has no push/webhook mechanism). Each request returns up to 10 articles; the connector maps `id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang` into `SocialPost` fields, retaining the raw payload. Content returned is JSON, not literal RSS/XML — "RSS/News" in this project's docs names a category (general news, poll, cheap validation), not a literal wire-format requirement.
- **Outputs:** Normalized `SocialPost` rows, tenant-scoped.
- **Error handling:** A poll returning zero new articles since the last checkpoint is a correct no-op — no duplicate rows produced across consecutive cycles. Quota exhaustion or rate-limit responses (`429`) feed into the standard `ConnectorHealth`/auto-disable model rather than looping indefinitely.
- **Edge cases:** GNews's 30-day historical window means a watchlist created today cannot see articles older than 30 days — a real, published boundary, not a defect.

### 5.3 Feature / Capability: Publication-as-Author Modeling

- **Description:** Resolves each article's `Author` to the source publication, not an individual — GNews's own documented response schema carries no author/byline field of any kind.
- **Triggers:** Every normalized `SocialPost` (5.2) needs an associated `Author`.
- **Inputs:** GNews's nested `source` object (`id`, `name`, `url`, `country`).
- **Processing:** `Author.externalAuthorId` = `source.id` where present, else `source.name`; `Author.followerCount` is deliberately left unpopulated (not a meaningful concept for a publication). This reuses ADR-0024's exact issuer-as-Author pattern for Newswire rather than inventing a new one — confirmed as the second real instance of the same departure, which the project's own "rule of three" treats as still not enough to generalize into ADR-0004's base text (a third connector needing the identical departure is the trigger to revisit).
- **Outputs:** A resolved `Author` row representing the publication, linked to the `SocialPost`.
- **Error handling:** An article with no `source.id` falls back to `source.name`; an article with neither is a data-quality edge case handled at normalization time rather than blocking ingestion.
- **Edge cases:** The same publication appearing across multiple articles should resolve to the same `Author` record where `source.id`/`source.name` matches, avoiding duplicate `Author` rows for one real outlet.

### 5.4 Feature / Capability: Native Query Translation (`supportedQueryFeatures`)

- **Description:** Declares and uses GNews's real native boolean query capability within its `q` parameter, giving ADR-0021's AST a genuine partial-native-translation opportunity distinct from Newswire's minimal/empty declaration.
- **Triggers:** Watchlist matching evaluation for a tenant watchlist against the GNews connector.
- **Inputs:** The watchlist's AST; GNews's `q` parameter, which supports `AND`/`OR`/`NOT` and quoted-phrase search with parenthetical grouping.
- **Processing:** `supportedQueryFeatures` declares `AND`/`OR`/`NOT`/phrase support; per ADR-0021's whole-query degradation rule, if the watchlist's AST uses only these supported node types, the full query translates natively into `q`; if it uses any unsupported node type (e.g. `HASHTAG`/`ACCOUNT`, which GNews's search has no equivalent for), the entire query falls back to whole-query post-fetch matching for this connector. The exact AST-to-`q`-syntax translation mapping is an implementation-time task, not fixed by this ADR.
- **Outputs:** Either a native GNews search request reflecting the full AST, or a fallback post-fetch match, per connector.
- **Error handling:** N/A — this is the standard ADR-0021 matching-path selection, applied with a materially richer capability declaration than Newswire's.
- **Edge cases:** A watchlist mixing supported and unsupported node types still degrades whole-query, not per-clause, per ADR-0021's existing v1 rule — this ADR does not change that rule, only supplies a connector with more to potentially translate natively.

### 5.5 Feature / Capability: Free-Tier Quota Enforcement

- **Description:** Keeps polling within GNews's published free-tier ceiling per tenant.
- **Triggers:** Every poll attempt.
- **Inputs:** The tenant's current request count against the 100-requests/day ceiling.
- **Processing:** `getRateLimitConfig()` reflects the real, published, confirmed ceiling (100 requests/day, 10 articles/request) — unlike Newswire's unconfirmed placeholder, this is a real, documented limit. The existing `RequestGate` mechanism enforces it per tenant.
- **Outputs:** Polls that stay within quota; quota-exceeded attempts are gated/deferred rather than sent.
- **Error handling:** Nearing or exceeding quota should surface via `ConnectorHealth`/UI visibility rather than fail silently.
- **Edge cases:** A tenant running multiple watchlists against this connector competes for the same 100-requests/day ceiling — a real constraint once more than a few watchlists are active, named as an accepted v1 limitation, not solved here.

### 5.6 Feature / Compliance Constraint: Non-Commercial Free-Tier Use

- **Description:** Documents and enforces, as an operating constraint (not a technical gate), that GNews's free tier is used only because this project is genuinely non-commercial and self-funded.
- **Triggers:** Ongoing — reviewed whenever the project's commercial status might change.
- **Inputs:** The project's documented business status (`Business-Case-v6.0.md` §4/§9).
- **Processing:** The connector's own documentation (`SKILL.md`) and contract tests reference the free-tier non-commercial constraint and the FAQ-vs-ToS ambiguity explicitly. The more conservative FAQ reading (non-commercial only) is adopted as the operative constraint rather than the less restrictive ToS reading, consistent with how the project treats every other provider's terms.
- **Outputs:** A documented, monitored constraint, not a runtime-enforced technical control.
- **Error handling:** N/A — this is a compliance/process control, not a system behavior.
- **Edge cases:** If the project ever monetizes or onboards a paying tenant, this connector's provider/tier requires re-evaluation before that happens — named explicitly as a required future action, not silently deferred.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Configures the connector and registers the API key |
| Tenant-User / Social-Selling-Strategist | Consumes the normalized post feed; filters by source/author |
| Platform-Admin | Monitors cross-tenant connector health and quota |
| Menno (Sponsor/Technical Lead) | Owns compliance-safe delivery |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 2.7) | Tenant-Admin | Connect and activate a GNews connector with my own free API key | I get general-news coverage alongside other platforms | Distinct `providerId`; connect flow stores the key via ADR-0014's model; no new credential pattern |
| US2 | Tenant-User | See general-news articles in the same unified feed as other sources | I can monitor topics/companies across channels | Live poll returns real articles normalized into `SocialPost` with correct tenant scoping |
| US3 | Social-Selling-Strategist | Filter/export posts by publication-level author | I can identify outlets covering a topic | `Author.externalAuthorId` populated from `source.id`/`source.name` |
| US4 | Platform-Admin | See quota saturation and health for the connector | I can spot tenants approaching the 100-req/day ceiling | Rate-limit/health visible via existing `ConnectorHealth`/UI patterns |

### 6.3 Workflow Diagrams / Steps

**Connect and activate:**
1. Tenant-Admin selects GNews from the connector catalog.
2. Enters their own free-tier GNews API key via `POST /connectors/gnews/connect`.
3. Key stored encrypted (ADR-0014); connector activated (ADR-0051 activation mechanism, same as any other connector).

**Poll cycle:**
1. Scheduler triggers a poll for an active tenant.
2. Connector builds the `q` query — natively translating the watchlist AST where `supportedQueryFeatures` allows, or issuing a broader query with fallback matching otherwise.
3. GNews returns up to 10 articles; each is normalized into a `SocialPost`.
4. Each article's `Author` resolves to its source publication.
5. `IngestionRun` records the outcome; `ConnectorHealth`/`RequestGate` track quota and errors.
6. Watchlist matches persist via native or fallback path per 5.4.

---

## 7. Data Requirements

### 7.1 Data Inputs

- GNews `/api/v4/search` response: `id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, `source` (`id`, `name`, `url`, `country`).
- Tenant's registered `apikey`.
- Watchlist AST (for native `q` translation).

### 7.2 Data Outputs

- Normalized `SocialPost` rows.
- `Author` rows (publication).
- `IngestionRun` records.
- Watchlist match records via native or fallback path.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialConnector` (GNews, new registration) | distinct `providerId`, `authMode: 'apiKey'`, `deliveryMode: 'poll'`, `supportedQueryFeatures` (`AND`/`OR`/`NOT`/phrase), `getRateLimitConfig()` (100/day, 10/request) | Implements the existing `SocialConnector` interface (ADR-0002) |
| `SocialPost` (existing schema, reused) | `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, `authorId`, raw payload | Normalized from GNews articles |
| `Author` (existing schema, publication-as-organization variant) | `externalAuthorId` (`source.id`/`source.name`), `followerCount` (unpopulated) | Second scoped exception to ADR-0004, structurally identical to Newswire's issuer-as-Author pattern |
| `platform_credentials` (existing, envelope-encrypted, ADR-0014) | per-tenant `apikey` | One key per tenant, never pooled |
| `IngestionRun` (existing, reused) | `tenantId`, `platformId` (GNews), `status`, article count, quota usage | Standard ingestion attempt record |
| `RequestGate` (existing, reused) | per-tenant request counter against the 100/day ceiling | Enforces the free-tier quota |

### 7.4 Validation Rules

- `Author.externalAuthorId` must be populated from `source.id` (preferred) or `source.name` (fallback) — never left blank when either is available.
- Polling must never exceed 100 requests/day or 10 articles/request per tenant.
- `supportedQueryFeatures` must reflect only GNews's genuine native capability (`AND`/`OR`/`NOT`/phrase) — never overstated.
- A repeated poll with no new articles must not create duplicate `SocialPost` rows.
- The connector's credential must be tenant-scoped and RLS-safe, never pooled across tenants.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A GNews connector may only be activated when a valid per-tenant GNews API key has been registered. | Registration (5.1) |
| BR2 | `Author` for a GNews article must always resolve to the source publication, never an individual journalist. | Author modeling (5.3) |
| BR3 | The free-tier GNews connector is authorized only for non-commercial, self-funded project use; commercial re-evaluation is required before monetization. | Compliance (5.6) |
| BR4 | The GNews API key must not be pooled or shared across tenants. | Credential (5.1) |
| BR5 | Historical search is capped at GNews's 30-day window. | Polling (5.2) |
| BR6 | The connector adopts the more conservative reading of GNews's published terms (FAQ non-commercial clause) where the provider's own documents conflict. | Compliance (5.6) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| GNews API (`/api/v4/search`) | Inbound | Source article data | REST/JSON over HTTPS, `apikey` query param |
| `POST /connectors/gnews/connect` | Inbound | Registers the per-tenant credential | REST/JSON |
| `platform_credentials` (Postgres, envelope-encrypted) | Outbound (write)/Inbound (read) | Stores the per-tenant API key | SQL, ADR-0014 encryption model |
| `runIngestionAttempt()` pipeline | Internal | Normalizes articles, records `IngestionRun` | In-process |
| `RequestGate` | Internal | Enforces the per-tenant 100/day quota | In-process |
| Shared/native watchlist matcher | Internal | Native `q` translation or fallback matching | In-process |
| `ConnectorHealth` derivation | Internal | Health/auto-disable based on `IngestionRun` outcomes and quota errors | In-process |

---

## 10. Non-Functional Considerations

- **Compliance:** Free-tier non-commercial constraint documented in the connector's `SKILL.md` and contract tests; the FAQ-vs-ToS ambiguity is named explicitly, not silently resolved.
- **Maintainability:** Reuses existing `apiKey` auth and credential-storage patterns — no new credential table or pattern introduced; connector remains removable without affecting other connectors (ADR-0048/Story 2.10 invariants).
- **Reliability:** Rate-limit/quota errors (`429`, exhaustion) must degrade gracefully — health transitions to `degraded`/`failing`, no infinite retry loops.
- **Security:** `Author`/`SocialPost` normalization is tenant-scoped and RLS-safe; contract tests prove isolation.
- **Capacity:** 100 requests/day per tenant is a modest ceiling — adequate for Phase 1's one-tenant, one-watchlist deliverable, a real constraint once more than a few watchlists per tenant compete for it; a future paid-tier or alternate-provider upgrade path is not precluded, but not built now.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Invalid/rejected API key at connect time | Connect-flow error | Credential rejected; connector not activated |
| Quota exhausted (100 requests/day reached) | Connector shows degraded/rate-limited state | `RequestGate` defers further polls for that tenant until the window resets |
| `429` response from GNews | None (transparent) | Treated per standard error classification (ADR-0010/ADR-0023); `ConnectorHealth` reflects the pattern |
| Poll returns zero new articles | None | Correct no-op; no duplicate rows |
| Article missing `source.id` | None | Falls back to `source.name` for `Author.externalAuthorId` |
| Watchlist query using node types GNews doesn't support | Fallback badge shown (per ADR-0021) | Entire query falls back to whole-query post-fetch matching for this connector |
| Historical search requested beyond 30 days | None (structural limit) | GNews simply does not return older articles; no backfill attempted |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- The project remains non-commercial/self-funded, fitting GNews's free-tier "non-commercial projects" permission.
- Each tenant can obtain its own free GNews API key without project-side contracting.
- Existing `Author`, `SocialPost`, `IngestionRun`, `ConnectorHealth` models are available unchanged.
- The connector framework's `poll()`/`RequestGate` abstractions already support `apiKey` auth mode.

**Dependencies:**
- ADR-0002 (`SocialConnector` framework) — built.
- ADR-0004 (`Author` model) — carries a second scoped exception for this connector, reusing ADR-0024's pattern.
- ADR-0014 (envelope-encrypted credential model) — built; reused with no new pattern.
- ADR-0021 (`supportedQueryFeatures`/watchlist matching) — built; this connector supplies a materially richer capability declaration than Newswire.
- ADR-0024 (Newswire, issuer-as-Author precedent) — this connector's Author-modeling pattern is reused directly from it.
- ADR-0027 (connector as technical intermediary, never a contracting party) — confirmed 2026-08-01 this connector already satisfied the principle before ADR-0027 existed.
- Story 2.7 — this ADR's implementation story, Ready as of 2026-07-31.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What are NewsData.io's actual formal terms? | Technical Lead | Worth a follow-up browser-rendered verification pass before ruling it in or out more permanently |
| Q2 | What cross-publication de-duplication strategy should be used? | Technical Lead | Implementation-time decision, named but not resolved here |
| Q3 | What is the exact AST-to-GNews-`q`-syntax translation mapping? | Technical Lead | Implementation-time task; this ADR only establishes the native capability is real and non-trivial |
| Q4 | Should ADR-0004 eventually carry a permanent, generalized organization-as-Author clause? | Technical Lead | Resolved at acceptance: not yet (rule of three); revisit when a third connector needs the identical departure |

---

## 14. Appendix

**Glossary:** see BRD-0026 §15 for GNews, `Author`, `externalAuthorId`, `SocialPost`, `supportedQueryFeatures`, `poll`, `apiKey`, `providerId`, `IngestionRun`, `ConnectorHealth`, and non-commercial free tier definitions.

**Reference links:**
- [ADR-0026: RSS/News connector — GNews API, with publication-as-Author modeling](../../adr/0026-rss-news-connector-gnews-api-publication-as-author.md)
- [BRD-0026](../Business-Requirements/BRD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md)
- [Feature design — Multi-source ingestion](../../product-research/feature-designs/01-multi-source-ingestion.md)
- [ADR-0002, ADR-0004, ADR-0014, ADR-0021, ADR-0024, ADR-0027] (referenced; not independently re-verified in this pass)
- [Story 2.7 — GNews RSS/News connector](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)

**Missing sources:** No dedicated `docs/product-research/reports/<feature>-deep-research.md` was found for GNews; vendor pricing/terms/capability verification is embedded directly in ADR-0026's own Amendment Log and Consequences sections (primary-source verified against `gnews.io` pages 2026-07-31), as BRD-0026's own Appendix confirms.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown, real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
