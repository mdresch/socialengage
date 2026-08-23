# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0024 Newswire Connector: Direct Wire-Service RSS, Issuer-as-Author — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0024 is Accepted; documents shipped design — Story 2.6) |
| Related Documents | ADR-0024, BRD-0024, ADR-0002, ADR-0004, ADR-0021, ADR-0027, ADR-0051, Story 2.6 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0024 (Newswire connector — direct wire-service RSS feeds, with issuer-as-Author modeling) and BRD-0024 into the functional design for a Newswire `SocialConnector` that polls GlobeNewswire's and PR Newswire's free, public RSS/ATOM feeds directly (no aggregator, no API key, no account), normalizes each item into a `SocialPost`, and models the issuing organization — not an individual — as the `Author`. ADR-0024 is Accepted (2026-07-30); Story 2.6 implements it. This FDD documents the accepted, shipped design.

### 2.2 Scope

**In scope:**
- Direct polling of GlobeNewswire's (`globenewswire.com/rss/list`) and PR Newswire's (`prnewswire.com/rss/`) free, public RSS/ATOM feeds.
- A distinct `SocialConnector` (`authMode: 'none'`, `deliveryMode: 'poll'`) reusing the existing RSS/News poll/normalize mechanism.
- Issuer-as-Author modeling: `Author` represents the issuing organization, not an individual account — a scoped, documented exception to ADR-0004.
- `supportedQueryFeatures` declared minimal/empty, with whole-query post-fetch fallback matching (ADR-0021).
- A conservative, unconfirmed-rate-limit-aware polling cadence.
- A deliberate (if deferred-to-implementation) cross-wire de-duplication strategy.
- Per-tenant, credential-independent activation (ADR-0051).

**Out of scope:**
- Business Wire and AccessWire coverage at v1 (deferred pending primary-source confirmation of open public feed access).
- Paid aggregators (RTPR, bigdata.com, PRNEWS.IO) and direct wire-service *publishing* APIs.
- Historical backfill of press releases predating the connector's first poll.
- A project-wide rewrite of the `Author` model — ADR-0004 remains the baseline; this is a scoped exception.
- Push/webhook delivery.

### 2.3 Target Audience

Backend engineers implementing/extending the connector, product owner, platform admin reviewing cost/compliance posture, tenant admins activating the connector.

---

## 3. Context and Background

RSS/News and Reddit were chosen (2026-07-29) as Phase 1's first and second platforms; the full connector framework, `Author`, `IngestionRun`, rate limiting, error handling/auto-disable, connector-side watchlist matching, pagination, and derived `ConnectorHealth` were already built and contracted by the time this ADR was drafted — but neither RSS/News's nor Reddit's actual connector implementations existed yet at that point, a separate gap this ADR does not depend on being closed first. This ADR selects Newswire's provider and modeling approach ahead of Phase 4 (multi-connector scale-out), the same ahead-of-schedule drafting pattern used elsewhere in the ADR series.

Two questions needed deciding: (1) which provider(s) — direct wire-service *publishing* APIs are priced for issuing a release ($195–$1,500+/mo), the wrong shape for a *reading* connector, but that's separate from whether the wires' own public *reading* RSS feeds are free (they turned out to be, for two of the four candidate wires); (2) how to model the issuer — `Author` (ADR-0004) was designed around individual accounts (`followerCount`, `handle`, first/last-seen tracking), and a press release's "author" is an issuing organization, not an individual, requiring an explicit modeling decision. A three-pass research trail (documented in the ADR's own Amendment Log) rejected RTPR (card-gated trial, $139/mo Pro-only programmatic access), bigdata.com (per-query retrieval shape, not pollable), GDELT (general news, not press-release-specific), and PRNEWS.IO ($5,000/year) before converging on GlobeNewswire + PR Newswire direct RSS as the only genuinely free, no-card, pollable option.

Source requirements: BRD-0024 §§6–7, Story 2.6 (Epic 2, accepted 2026-07-30).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Add press-release coverage at zero recurring cost | No paid plan, card, or per-request charge for the connector |
| G2 | Reuse the existing connector framework rather than build new mechanism | Ships on the current `poll`/`normalize` shape (ADR-0002); the new work is modeling + feed selection, not framework capability |
| G3 | Keep the `Author` model internally consistent despite the organization-shaped exception | Issuer modeled per ADR-0004's scoped exception, not an ad hoc workaround |
| G4 | Keep tenant onboarding zero-friction | Connector activatable without collecting or storing any credential |
| G5 | Never make SocialEngage a contracting party to the wire services | No API agreement, key exchange, or credential proxying (ADR-0027) |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Direct Public RSS/ATOM Polling (GlobeNewswire, PR Newswire)

- **Description:** Polls GlobeNewswire's and PR Newswire's own free, public feeds directly, reusing the RSS/News connector's existing `poll`/`normalize` mechanism against press-release-specific feeds.
- **Triggers:** Scheduled poll cycle (per the platform's polling scheduler, Story 1.13/1.14), on a conservative cadence.
- **Inputs:** Feed URLs (a selected subset of GlobeNewswire's 90+ topic/industry/organization feeds and PR Newswire's general/category feeds — an implementation-time choice tied to watchlist/tenant demand, not fixed by this ADR); the connector's last-polled checkpoint per feed.
- **Processing:**
  - `authMode: 'none'` — no API key or account required for either source's public feeds.
  - `deliveryMode: 'poll'` — no push/webhook option exists for either source.
  - Fetch each configured feed on interval; parse new items since the last checkpoint using the same RSS/ATOM parsing already built for RSS/News.
  - Because these are live/recent-only feeds (not an archive lookup API), no historical backfill occurs — a watchlist created today cannot retroactively see releases published before the connector started polling this feed.
- **Outputs:** Raw feed items ready for normalization into `SocialPost` (5.2).
- **Error handling:** No published rate limit exists for either service's public feeds — the connector uses a conservative `fixed-window` default no more aggressive than RSS/News's own cadence; failures feed into the standard `ConnectorHealth`/auto-disable model (ADR-0010/ADR-0023), same as any other connector.
- **Edge cases:** A feed with zero new items since the last checkpoint is a correct no-op — no duplicate `SocialPost` rows are produced across consecutive poll cycles; a feed becoming temporarily unavailable is treated as a normal transient failure (retryable), not a connector-level defect.

### 5.2 Feature / Capability: Feed-Item Normalization into `SocialPost`

- **Description:** Converts each new RSS/ATOM feed item into the platform's canonical `SocialPost` shape through the existing `runIngestionAttempt()` pipeline.
- **Triggers:** A new item detected during a poll cycle (5.1).
- **Inputs:** Raw feed item (title, body/summary, link, published timestamp, issuer/organization field where present).
- **Processing:** Maps feed fields into `SocialPost`'s title, body, URL, and published-timestamp fields, reusing the same normalization path already proven for RSS/News; associates the post with a resolved `Author` (5.3).
- **Outputs:** A persisted `SocialPost` row with title, body, URL, and published timestamp populated.
- **Error handling:** A feed item missing an expected field (e.g. no summary) is normalized with that field left empty rather than failing the whole poll cycle.
- **Edge cases:** The same underlying press release distributed on both wires simultaneously produces two feed items — cross-wire de-duplication (5.4) governs whether this becomes one or two `SocialPost` rows.

### 5.3 Feature / Capability: Issuer-as-Author Modeling

- **Description:** Represents the issuing organization — not an individual account — as the `Author` for every post this connector produces, a scoped, documented departure from ADR-0004's per-account assumption.
- **Triggers:** Every normalized `SocialPost` (5.2) needs an associated `Author`.
- **Inputs:** The feed's issuer/organization identifier (company name/ticker where available).
- **Processing:** `Author.externalAuthorId` is set from the issuer's identifier as it appears in the feed; `Author.followerCount` is deliberately left unpopulated, since it is not a meaningful concept for an issuing organization the way it is for an individual social account. This is not a general change to `Author` modeling — it is an accepted variant scoped to provider shapes where "author" genuinely means "organization," flagged as a forward-pointer note on ADR-0004 rather than an edit to it.
- **Outputs:** A resolved `Author` row representing the issuing organization, linked to the `SocialPost`.
- **Error handling:** A feed item with no identifiable issuer field falls back to whatever generic issuer label the feed provides (e.g. the feed's own publisher name) rather than leaving `Author` unresolved.
- **Edge cases:** The same issuing organization appearing across both GlobeNewswire and PR Newswire should resolve to the same `Author` record where the issuer identifier matches, avoiding duplicate `Author` rows for one real organization.

### 5.4 Feature / Capability: Cross-Wire De-Duplication (Deferred to Implementation, but Deliberate)

- **Description:** Governs whether the same press release appearing on both GlobeNewswire and PR Newswire simultaneously produces one `SocialPost` or two.
- **Triggers:** Detection of two feed items with matching headline/issuer/timestamp proximity across the two wires within the same or adjacent poll cycles.
- **Inputs:** Headline text, issuer identity, published timestamp from both wires' items.
- **Processing:** This ADR explicitly does not resolve the strategy (headline/issuer/timestamp-proximity matching vs. accepting duplicate rows) — it is named as a required implementation-time decision so it isn't discovered mid-build; whichever approach is chosen must be proven deliberately by Story 2.6's contract, not left accidental.
- **Outputs:** Either a single deduplicated `SocialPost`, or two distinct rows if duplicates are accepted for v1 — whichever the implementation decision settles on.
- **Error handling:** N/A — this is a design-time decision point, not a runtime error condition.
- **Edge cases:** A near-identical but not identical release (e.g. a correction or update) on the second wire should not be falsely merged with the original if the chosen matching strategy is too loose.

### 5.5 Feature / Capability: Watchlist Matching Fallback

- **Description:** Declares this connector's native query capability (ADR-0021) and relies on the shared post-fetch fallback matcher, since neither wire's public feed exposes a queryable search surface.
- **Triggers:** Watchlist matching evaluation for any tenant watchlist against this connector.
- **Inputs:** `supportedQueryFeatures` (expected minimal/empty at v1), the watchlist's AST.
- **Processing:** With no/minimal native query support declared, the entire query for this connector falls back to whole-query post-fetch matching against fetched post text (ADR-0021's whole-query degradation rule), the same pattern already established for RSS/News.
- **Outputs:** Matched posts recorded via the standard fallback matcher, not a native query.
- **Error handling:** N/A — fallback is the expected, correctly-declared behavior, not a failure state.
- **Edge cases:** If either wire's feed later exposes real query parameters, `supportedQueryFeatures` would need updating to reflect any genuine native capability — not assumed here.

### 5.6 Feature / Capability: Credential-Independent Activation

- **Description:** The connector is activated per tenant through ADR-0051's activation mechanism, entirely independent of any credential — since none exists for this connector.
- **Triggers:** A Tenant-Admin toggling the connector on/off in the admin UI.
- **Inputs:** Tenant activation intent.
- **Processing:** `authMode: 'none'` governs credential requirements only (this connector needs no API key or vendor account to function) — it does not imply automatic tenant-wide activation. A `connector_activations` row governs whether ingestion actually runs for a given tenant, defaulting to inactive, exactly as any other connector's activation state would (per ADR-0024's 2026-08-12 Clarification, correcting an earlier admin-UI defect that had treated `authMode: 'none'` as permanently "connected" for every tenant).
- **Outputs:** A tenant-scoped active/inactive flag governing whether `shouldAttemptIngestion()` proceeds for this connector.
- **Error handling:** N/A — activation state is a simple boolean toggle with a documented default (inactive).
- **Edge cases:** A tenant with no `connector_activations` row for this connector reads as inactive, not active, consistent with every other connector's lazy-creation rule.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant User | Tracks companies/topics/market events via watchlists; sees press releases in the post feed |
| Tenant-Admin | Activates/deactivates the connector for the tenant |
| Platform Admin | Operates ingestion, monitors connector health |
| Compliance / Finance | Cares that the connector remains cost-free and non-reselling |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 2.6) | Tenant tracking companies/market events | See press-release content from GlobeNewswire and PR Newswire alongside other platform content | I get full-picture monitoring without paying for a separate wire subscription | Real `SocialPost` rows from both wires; `Author` resolves to the issuing organization; connector requires no API key |
| US2 | Tenant-Admin | Activate the Newswire connector without entering any credential | Onboarding stays zero-friction | Connector activatable via ADR-0051's activation mechanism with no key-entry UI |
| US3 | Platform Admin | See the connector participate in the same health/auto-disable model as every other connector | Operational visibility is consistent across the fleet | Failures feed `ConnectorHealth`; auto-disable applies per ADR-0010/ADR-0023 |

### 6.3 Workflow Diagrams / Steps

**Poll cycle:**
1. Scheduler triggers a poll for a configured GlobeNewswire or PR Newswire feed on the connector's cadence.
2. Connector fetches the feed; compares against the last-polled checkpoint.
3. New items are normalized into `SocialPost` rows (title/body/URL/published timestamp).
4. Each post's `Author` is resolved to the issuing organization (`externalAuthorId` set; `followerCount` left blank).
5. Cross-wire de-duplication logic (as decided at implementation time) determines whether a matching release from the other wire collapses into one post or remains two.
6. Watchlist matching runs via post-fetch fallback (no native query support).
7. `IngestionRun` records the outcome; `ConnectorHealth` reflects success/failure per the standard derivation.

**Tenant activation:**
1. Tenant-Admin opens the connector screen for Newswire.
2. No credential form is shown (`authMode: 'none'`).
3. Tenant-Admin toggles activation on; `connector_activations` row set to active for that tenant.
4. Subsequent poll cycles include that tenant per `shouldAttemptIngestion()`'s activation check.

---

## 7. Data Requirements

### 7.1 Data Inputs

- GlobeNewswire and PR Newswire RSS/ATOM feed items (title, body/summary, link, published timestamp, issuer field where present).
- Tenant activation state (`connector_activations`).

### 7.2 Data Outputs

- Normalized `SocialPost` rows (press releases).
- `Author` rows representing issuing organizations.
- `IngestionRun` records per poll attempt.
- Watchlist match records (`post_watchlist_matches`) via fallback matching.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialConnector` (Newswire, new registration) | distinct `providerId`, `authMode: 'none'`, `deliveryMode: 'poll'`, `supportedQueryFeatures` (minimal/empty), `getRateLimitConfig()` (conservative `fixed-window` default) | Implements the existing `SocialConnector` interface (ADR-0002) |
| `SocialPost` (existing schema, reused) | title, body, URL, `publishedAt`, `authorId` | Normalized from feed items; linked to the resolved `Author` |
| `Author` (existing schema, issuer-as-organization variant) | `externalAuthorId` (issuer identifier from feed), `followerCount` (unpopulated), other existing `Author` fields unused/not meaningful for this connector | Scoped exception to ADR-0004's per-individual-account baseline |
| `IngestionRun` (existing, reused) | `tenantId`, `platformId` (Newswire), `status`, `retryable`, checkpoint | Standard ingestion attempt record; feeds `ConnectorHealth`/auto-disable |
| `connector_activations` (ADR-0051, reused) | `tenant_id`, `platformId` (Newswire), `is_active` | Governs per-tenant activation independent of credential presence |
| Cross-wire duplicate match (implementation-time construct) | matching key (headline/issuer/timestamp proximity), resolution outcome | Applied at normalization/dedup step (5.4) |

### 7.4 Validation Rules

- `Author.externalAuthorId` for this connector must be populated from the feed's issuer identifier; `Author.followerCount` is intentionally left unset (not a validation failure).
- No credential/API key field may be required or stored for this connector (`authMode: 'none'`).
- A poll cycle against an unchanged feed must not create duplicate `SocialPost` rows.
- `supportedQueryFeatures` must reflect only genuine native capability (expected empty/minimal) — never overstate support the feeds don't provide.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `Author` for this connector always represents the issuing organization, never a person, social handle, or publication. | Author modeling (5.3) |
| BR2 | No API key, secret, or vendor account is required for a tenant to use this connector. | Polling / activation (5.1, 5.6) |
| BR3 | Business Wire and AccessWire may not be added to this connector until their public, no-signup feed terms are independently primary-source verified. | Scope boundary |
| BR4 | Feed subset selection (which of GlobeNewswire's 90+ feeds, which PR Newswire categories) is an implementation-time decision tied to watchlist/tenant demand. | Polling (5.1) |
| BR5 | Historical press releases are not backfilled — only items available on the live feeds at poll time are ingested. | Polling (5.1) |
| BR6 | Connector activation is independent of credential presence and follows ADR-0051's activation mechanism, defaulting to inactive. | Activation (5.6) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| GlobeNewswire public RSS/ATOM feeds | Inbound | Source press-release data | RSS/ATOM over HTTPS, no auth |
| PR Newswire public RSS feeds | Inbound | Source press-release data | RSS over HTTPS, no auth |
| `runIngestionAttempt()` pipeline | Internal | Normalizes feed items into `SocialPost`, records `IngestionRun` | In-process |
| `connector_activations` (Postgres) | Inbound (read) | Per-tenant activation state | SQL |
| Shared fallback matcher (`matchesWatchlist()`) | Internal | Watchlist matching for this connector | In-process |
| `ConnectorHealth` derivation (ADR-0009/ADR-0023) | Internal | Health/auto-disable based on `IngestionRun` outcomes | In-process |
| Admin UI connector screen | Outbound | Shows connector as no-credential-required; activation toggle | REST / JSON |

---

## 10. Non-Functional Considerations

- **Cost:** Zero paid accounts, cards, or per-request charges — a hard NFR, verified through the ADR's own multi-pass vendor research trail.
- **Compliance:** No API agreement, key exchange, or tenant-credential proxying — SocialEngage never becomes a contracting party or reseller for either wire service (ADR-0027).
- **Performance/reliability:** Conservative polling cadence (no more aggressive than RSS/News) given the absence of any published rate limit; standard `ConnectorHealth`/auto-disable model applies identically to this connector.
- **Maintainability:** Reuses the existing RSS/News poll/parse mechanism — no new connector-framework capability is introduced; the incremental work is modeling and feed-selection/dedup logic only.
- **Coverage limitation:** Only 2 of 4 originally-considered wire services are covered at v1 (Business Wire and AccessWire deferred) — a real, accepted content-coverage gap versus a hypothetical paid aggregator.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Feed temporarily unavailable | None (transparent) | Treated as a retryable failure; feeds standard `ConnectorHealth`/auto-disable logic |
| Feed item missing an expected field (e.g. no summary) | None | Normalized with that field left empty rather than failing the whole poll |
| Same release on both wires | None | Resolved per the chosen cross-wire de-duplication strategy (implementation-time decision) |
| No published rate limit exceeded (hypothetical) | None (preventive) | Conservative `fixed-window` cadence used by default to avoid this scenario |
| Tenant with no activation row | Connector shown as inactive | `is_active` reads as false; no polling occurs for that tenant |
| Business Wire/AccessWire requested by a tenant | Not offered in v1 | Connector coverage limited to GlobeNewswire/PR Newswire until terms are separately verified |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- GlobeNewswire and PR Newswire continue to make the selected feeds available without authentication or payment.
- Feed formats (RSS/ATOM) remain structurally stable enough to parse with the existing RSS/News parser.
- The RSS/News connector's conservative polling cadence is an acceptable default for both wire services.
- The connector is activated per tenant through ADR-0051's mechanism.

**Dependencies:**
- ADR-0002 (`SocialConnector` framework, `poll`/`normalize`) — built.
- ADR-0004 (`Author` model) — carries a scoped, documented exception for this connector rather than a general rewrite.
- ADR-0021 (`supportedQueryFeatures`/watchlist matching degradation) — built.
- ADR-0027 (connector as technical intermediary, never a contracting party) — confirmed 2026-08-01 that this ADR's Decision already satisfied the principle before ADR-0027 existed; no scope change needed.
- ADR-0051 (connector activation decoupled from credential presence) — corrects the 2026-08-12-identified admin-UI defect where `authMode: 'none'` was mistakenly read as implying automatic activation.
- Story 2.6 — this ADR's implementation story.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Are Business Wire's and AccessWire's actual public RSS access terms open enough to add later? | Product Owner | Confirm directly (primary source) before considering; not assumed to match GlobeNewswire/PR Newswire |
| Q2 | What cross-wire de-duplication strategy should be used? | Technical Lead | Implementation-time decision, required before/with Story 2.6's contract |
| Q3 | Exactly which feed subset (topic/industry/category) should be polled? | Product Owner | Implementation-time choice tied to watchlist/tenant demand |
| Q4 | Should the issuer-as-organization Author pattern generalize to future organization-shaped connectors (e.g. corporate blog/newsroom feeds)? | Technical Lead | Recommend deciding at acceptance time per the ADR's own open question; not resolved generally here |

---

## 14. Appendix

**Glossary:** see BRD-0024 §15 for Newswire, GlobeNewswire, PR Newswire, Issuer, Author, RSS/ATOM, SocialConnector, `supportedQueryFeatures`, cross-wire deduplication, and poll/normalize definitions.

**Reference links:**
- [ADR-0024: Newswire connector — direct wire-service RSS feeds, with issuer-as-Author modeling](../../adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md)
- [BRD-0024](../Business-Requirements/BRD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md)
- [ADR-0002, ADR-0004, ADR-0021, ADR-0027, ADR-0051] (referenced; not independently re-verified in this pass)
- [Story 2.6 — Newswire connector: direct wire-service RSS, issuer-as-Author](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)

**Missing sources:** No `docs/product-research/feature-designs/<feature>.md` or deep-research report exists specifically for the Newswire connector; the ADR's own extensive Amendment Log (three research passes evaluating RTPR, bigdata.com, GDELT, PRNEWS.IO, Business Wire, AccessWire, SEC EDGAR) substitutes for a separate feature-design/deep-research document, as BRD-0024's own Appendix confirms.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown, real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
