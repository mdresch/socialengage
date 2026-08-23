# BRD-0024: Newswire Connector — Direct Wire-Service RSS, Issuer-as-Author

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Newswire Connector — Direct Wire-Service RSS, Issuer-as-Author — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno — Product Owner / Business Sponsor / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft synthesized from ADR-0024, Story 2.6, and related ADRs |
| 1.0 | 2026-08-19 | BRD Writer Agent | Approved BRD, all placeholders resolved |

---

## 2. Executive Summary

Press-release wire services are a high-value source of structured, market-moving and reputation-relevant announcements, yet SocialEngage has no way to ingest them. This BRD defines a Newswire `SocialConnector` that polls the freely available, public RSS/ATOM feeds published by **GlobeNewswire** and **PR Newswire** directly, without an aggregator, API key, or paid account. Each press release is normalized into a `SocialPost` through the existing ingestion pipeline, and the issuing organization — not an individual account — is represented as the `Author`.

This approach is deliberately scoped to the two wires whose public, no-signup feeds have been primary-source verified. It avoids recurring cost, card-gated trials, and reselling risk, while letting tenants track companies and topics against real press-release data using the same watchlist-matching experience already available for other platforms.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Add press-release coverage to SocialEngage without recurring vendor cost | Zero paid accounts, zero cards, and zero per-request charges for the Newswire connector |
| 2 | Reuse the existing RSS/News connector architecture | New connector ships using the current `poll`/`normalize` framework with no new connector-framework capability |
| 3 | Keep the `Author` model internally consistent | Issuing organization is modeled correctly under ADR-0004's scoped organization-as-Author exception |
| 4 | Maintain tenant self-service, low-friction onboarding | Connector can be activated without collecting or storing API keys for the tenant |
| 5 | Expand the Phase-4 multi-connector roster | Newswire is ready to build as Story 2.6, with provider and modeling decisions already accepted |

---

## 4. Scope

### 4.1 In Scope

- GlobeNewswire's and PR Newswire's free, public RSS/ATOM feeds.
- A distinct `SocialConnector` with `authMode: 'none'` and `deliveryMode: 'poll'`.
- Normalization of feed items into `SocialPost` rows via the existing `runIngestionAttempt()` pipeline.
- `Author` modeled as the **issuing organization**, with `externalAuthorId` derived from the feed's issuer identifier and `followerCount` intentionally unpopulated.
- Accurate declaration of `supportedQueryFeatures` (expected minimal/empty at v1) and correct fallback to whole-query, post-fetch watchlist matching.
- Polling of at least one real GlobeNewswire feed and at least one real PR Newswire feed.
- No-duplicate behavior when a feed has zero new items since the last poll cycle.
- A deliberate, documented decision for cross-wire duplicate handling at implementation time.

### 4.2 Out of Scope

- Business Wire and AccessWire coverage at v1.
- Paid aggregators such as RTPR, bigdata.com, or PRNEWS.IO.
- Historical backfill of press releases predating the connector's first poll.
- A generalized, project-wide rewrite of the `Author` model (ADR-0004 remains the baseline; this is a documented connector-specific exception).
- Push or webhook delivery from the wire services.
- Native, clause-level query translation beyond what the feed can support.

### 4.3 Assumptions

- GlobeNewswire and PR Newswire will continue to make the selected feeds available without authentication or payment.
- The feed formats (RSS/ATOM) remain structurally stable enough to parse with the existing RSS/News parser.
- The same conservative polling cadence used for the RSS/News connector is acceptable to both wire services.
- The connector is activated per tenant through the credential-independent activation mechanism introduced in ADR-0051.

### 4.4 Constraints

- No API key, vendor account, or secret may be required for v1.
- The connector must not make SocialEngage a contracting party, reseller, or intermediary between the wire services and the tenant (ADR-0027).
- Polling must stay conservative because no published rate limit exists for the public feeds.
- Author modeling cannot violate the per-account baseline in ADR-0004 except under the explicit, documented exception.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User | Tracks companies, topics, and market events in watchlists | High | See press releases alongside other platform posts in the feed |
| Tenant Admin | Activates/deactivates connectors for the tenant | Medium | Toggle the connector without entering credentials or managing keys |
| Product Owner | Defines platform coverage and prioritization | High | Adds press-release wire coverage at zero ongoing cost |
| Platform Admin | Operates multi-tenant ingestion and health | Medium | Connector fits existing `poll`/`normalize` framework and health model |
| Compliance / Finance | Owns vendor, cost, and legal risk | High | Avoid paid agreements, card-gated trials, or reselling liability |

---

## 6. Current State (As-Is)

The connector framework, `Author`, `IngestionRun`, rate limiting, error handling, watchlist matching, pagination, and `ConnectorHealth` are built and contracted (ADR-0002 through ADR-0011 and ADR-0021). However, the actual Newswire connector implementation does not exist. Press releases are not ingested, so tenants cannot track wire-service announcements alongside social and news content.

**Pain points:**
- A significant source of company- and market-relevant content is absent from the platform.
- Existing `Author` modeling is designed around individual accounts with `followerCount`, `handle`, and first/last seen tracking; press-release issuers are organizations, so author mapping would be ambiguous without an explicit decision.
- Adding a paid aggregator would introduce a recurring cost, a card-gated trial, and an operational cancellation risk that conflicts with the project's zero-friction, self-funded stance.

---

## 7. Future State (To-Be)

A Newswire `SocialConnector` is registered with a distinct `providerId`. It polls selected public feeds from GlobeNewswire and PR Newswire at a conservative cadence, normalizes each new item into a `SocialPost`, and resolves the `Author` as the issuing organization. The connector is activated per tenant through the same credential-independent activation surface used by other connectors. Watchlist matching falls back to whole-query, post-fetch matching because the feeds do not support clause-level native search.

**Expected capabilities:**
- Real press-release data flows through the existing ingestion pipeline without API keys or paid accounts.
- The `Author` table correctly records issuing organizations with `externalAuthorId` populated and `followerCount` left blank.
- A poll with no new items is a correct no-op and produces no duplicate `SocialPost` rows.
- Cross-wire duplicates are handled according to a deliberate implementation-time strategy, not left unaddressed.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The Newswire connector shall be registered as a distinct `SocialConnector` with `authMode: 'none'` and `deliveryMode: 'poll'` | Must | `providerId` is distinct from RSS/News and GNews; no credential prompt is shown to tenants | Product Owner |
| BR-002 | The connector shall poll at least one live GlobeNewswire RSS/ATOM feed and at least one live PR Newswire RSS/ATOM feed | Must | Polling produces real `SocialPost` rows from both wire services | Product Owner |
| BR-003 | Each feed item shall be normalized into a `SocialPost` through the existing `runIngestionAttempt()` pipeline | Must | Normalized posts have title, body, URL, and published timestamp populated; pipeline reuses ADR-0002's shape | Product Owner |
| BR-004 | The `Author` for each post shall represent the issuing organization, not an individual | Must | `externalAuthorId` is set from the feed's issuer identifier; `followerCount` is unpopulated; resolved `Author` row shape is proven by contract | Product Owner |
| BR-005 | Polling shall require no API key or vendor account for either source | Must | Connector passes tenant-level activation without key storage; no outbound request includes a key or token | Product Owner |
| BR-006 | `supportedQueryFeatures` shall be declared accurately and watchlist matching shall fall back to whole-query post-fetch matching when native support is absent | Should | Declaration is minimal/empty at v1; matching does not silently no-op | Technical Lead |
| BR-007 | A poll cycle with zero new items since the last check shall produce no duplicate `SocialPost` rows | Must | Two consecutive poll cycles against an unchanged feed are both correct no-ops | Technical Lead |
| BR-008 | Cross-wire duplicate handling shall be decided and documented at implementation time | Should | Story 2.6's contract proves the duplicate strategy was chosen deliberately, not left accidental | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The connector shall incur zero per-tenant or per-request cost for the selected feeds | Cost | Must | No paid plan, no card, no usage charge is required for v1; documented in ADR-0024 |
| NFR-002 | Polling cadence shall be conservative and not exceed the RSS/News connector's own cadence until a published rate limit is confirmed | Performance / Reliability | Must | `RequestGate` uses `fixed-window` with a default no more aggressive than RSS/News |
| NFR-003 | The connector shall operate without making SocialEngage a contracting party for the wire services | Compliance | Must | No API agreement, no key exchange, and no tenant-credential proxying; aligned with ADR-0027 |
| NFR-004 | The connector shall use the same health, error-handling, and auto-disable model as existing connectors | Maintainability | Must | Failures increment `ConnectorHealth` and can trigger auto-disable per ADR-0010 |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | For the Newswire connector, `Author` always represents the issuing organization, not a person, social handle, or publication. |
| BRU-002 | No API key, secret, or vendor account is required for a tenant to use the Newswire connector at v1. |
| BRU-003 | Business Wire and AccessWire may not be added to this connector until their public, no-signup feed terms are independently primary-source verified. |
| BRU-004 | Feed subset selection is an implementation-time decision tied to watchlist/tenant demand, not a fixed product rule. |
| BRU-005 | Historical press releases are not backfilled; only items available on the live RSS/ATOM feeds at poll time are ingested. |
| BRU-006 | Connector activation is independent of credential presence and follows ADR-0051's activation mechanism. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost` (press release) | Normalized press-release item: title, body, URL, published timestamp, author reference | GlobeNewswire / PR Newswire public RSS/ATOM feeds | Backend Ingestion | Public third-party content |
| `Author` (issuing organization) | Issuer entity with `externalAuthorId` from feed and `followerCount` unpopulated | Derived from feed `issuer` / organization field | Backend Ingestion | Public third-party content |
| `ConnectorHealth` | Health status, consecutive-failure count, and auto-disable flag for the Newswire connector | Ingestion run outcomes | Backend Operations | Operational |
| `IngestionRun` | Polling attempt, checkpoint, and outcome metadata | Connector scheduler | Backend Operations | Operational |
| `Watchlist` query / match records | Result of matching press-release posts against tenant watchlists | Existing watchlist service | Backend Ingestion | Tenant-internal |
| `connector_activations` | Per-tenant active/inactive flag for the connector | Tenant Admin action | Backend Operations | Tenant-internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Press-release volume by wire service (GlobeNewswire vs. PR Newswire) | Track ingestion coverage and balance | Product team | Daily |
| Cross-wire duplicate count | Measure overlap between the two feeds and validate dedup strategy | Product team | Weekly |
| Connector health / consecutive-failure rate | Ensure the connector remains healthy without published rate limits | Platform Admin | Real-time dashboard |
| Ingestion run success/failure counts | Operational visibility into poll cycles | Platform Admin | Per run |
| Cost of Newswire connector | Confirm zero cost remains true | Finance / Product Owner | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | GlobeNewswire or PR Newswire change public feed terms or require registration | Low | High | Monitor feeds and terms; retain Alternatives list (RTPR, etc.) for future re-evaluation; follow ADR-0027 no-reseller stance | Product Owner |
| R-002 | No published rate limit leads to accidental over-polling and service blocking | Medium | High | Use a conservative, fixed-window cadence at or below RSS/News; implement health/auto-disable; revisit if limits are discovered | Technical Lead |
| R-003 | The same release appears on both wires, creating duplicate posts for tenants | High | Medium | Make cross-wire dedup a deliberate implementation-time decision; instrument duplicate metrics | Product Owner |
| R-004 | Author model confusion spreads to other connectors | Medium | Medium | Scope the exception explicitly to Newswire and reference ADR-0004's organization-as-Author clause | Technical Lead |
| R-005 | Pressure to add Business Wire/AccessWire before access is verified | Low | Medium | Defer both until primary-source confirmation; document rule BRU-003 | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 connector framework (`poll`/`normalize`) | Internal / Technical | Technical Lead | Already built and contracted |
| D-002 | ADR-0004 `Author` model with scoped organization-as-Author exception | Internal / Model | Technical Lead | Already accepted and updated |
| D-003 | ADR-0021 `supportedQueryFeatures` framework | Internal / Technical | Technical Lead | Already built |
| D-004 | ADR-0051 credential-independent connector activation | Internal / Activation | Technical Lead | Already accepted |
| D-005 | Story 2.6 implementation contract | Internal / Delivery | Product Owner | Ready, accepted 2026-07-30 |
| D-006 | RSS/News connector parsing mechanism | Internal / Reuse | Technical Lead | Already built |

---

## 14. Acceptance Criteria

- The Newswire connector is registered as a distinct `SocialConnector` with `authMode: 'none'`, `deliveryMode: 'poll'`, and no API-key UI.
- It polls at least one real GlobeNewswire feed and at least one real PR Newswire feed, producing real `SocialPost` rows through the existing ingestion pipeline.
- Each normalized post's `Author` resolves to the issuing organization, with `externalAuthorId` populated and `followerCount` unpopulated.
- `supportedQueryFeatures` is declared accurately (minimal/empty at v1) and watchlist matching correctly falls back to whole-query post-fetch matching.
- A poll cycle against zero new items is a correct no-op across two consecutive poll cycles.
- Cross-wire duplicate handling is explicitly decided and proven by the Story 2.6 contract.
- The connector remains zero-cost and does not require a paid account or vendor agreement.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Newswire** | A press-release distribution service (e.g., GlobeNewswire, PR Newswire, Business Wire, AccessWire). |
| **GlobeNewswire** | One of the two v1 target wire services, providing 90+ public RSS/ATOM feeds at `globenewswire.com/rss/list`. |
| **PR Newswire** | One of the two v1 target wire services, providing free public RSS feeds marketed as a news widget. |
| **Issuer** | The organization that issued a press release; the Newswire connector treats the issuer as the `Author`. |
| **Author** | The normalized entity representing the source of a post; per ADR-0004, normally an individual account, with a scoped exception for organizations in this connector. |
| **RSS / ATOM** | Syndication feed formats used by wire services to publish lists of recent press releases. |
| **SocialConnector** | The pluggable connector abstraction that polls a source and normalizes data into `SocialPost` rows. |
| **supportedQueryFeatures** | A connector's declared native query capabilities used by watchlist matching to decide what can be pushed to the source vs. matched post-fetch. |
| **Cross-wire deduplication** | The handling of the same press release appearing on more than one wire service. |
| **Poll / normalize** | The connector pattern of periodically fetching a feed and transforming feed items into the platform's canonical post model. |
| **Watchlist** | A tenant-defined set of keywords, phrases, or entities used to filter and surface relevant posts. |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0024: Newswire connector — direct wire-service RSS feeds, with issuer-as-Author modeling](../../adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md)
- [ADR-0002: SocialConnector framework](../../adr/0002-socialconnector-framework.md)
- [ADR-0004: Author normalized separately from Post](../../adr/0004-author-normalized-separately-from-post.md)
- [ADR-0021: Connector-supported query features and watchlist matching degradation](../../adr/0021-connector-supported-query-features-and-watchlist-matching-degradation.md)
- [ADR-0027: Connector as technical intermediary only, never a contracting party](../../adr/0027-connector-as-technical-intermediary-only-never-a-contracting-party.md)
- [ADR-0051: Connector activation decoupled from credential presence](../../adr/0051-connector-activation-decoupled-from-credential-presence.md)
- [Story 2.6 — Newswire connector: direct wire-service RSS, issuer-as-Author](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)

### 16.2 Missing or Unavailable Sources

- No matching `docs/product-research/feature-designs/<feature>.md` file was found for this ADR; the BRD was therefore derived from the ADR itself and the Story 2.6 text.
- No matching `docs/product-research/reports/<feature>-deep-research.md` file was found; the competitive research and alternatives are summarized from ADR-0024's Alternatives Considered and Amendment Log.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
