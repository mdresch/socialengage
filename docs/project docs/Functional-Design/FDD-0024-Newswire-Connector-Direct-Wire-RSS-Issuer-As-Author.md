# BRD-0024: Newswire Connector — Direct Wire-Service RSS, Issuer-as-Author

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0024: Newswire Connector — Direct Wire-Service RSS, Issuer-as-Author |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md, ../Business-Requirements/BRD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0024-newswire-connector-direct-wire-rss-issuer-as-author.md and the business requirements in BRD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md into functional design for **Newswire Connector Direct Wire RSS Issuer As Author**.
Press-release wire services are a high-value source of structured, market-moving and reputation-relevant announcements, yet SocialEngage has no way to ingest them. This BRD defines a Newswire `SocialConnector` that polls the freely available, public RSS/ATOM feeds published by **GlobeNewswire** and **PR Newswire** directly, without an aggregator, API key, or paid account. Each press release is normalized into a `SocialPost` through the existing ingestion pipeline, and the issuing organization — not an individual account — is represented as the `Author`.

This approach is deliberately scoped to the two wires whose public, no-signup feeds have been primary-source verified. It avoids recurring cost, card-gated trials, and reselling risk, while letting tenants track companies and topics against real press-release data using the same watchlist-matching experience already available for other platforms.

---

### 2.2 Scope
**In scope:**
- GlobeNewswire's and PR Newswire's free, public RSS/ATOM feeds.
- A distinct `SocialConnector` with `authMode: 'none'` and `deliveryMode: 'poll'`.
- Normalization of feed items into `SocialPost` rows via the existing `runIngestionAttempt()` pipeline.
- `Author` modeled as the **issuing organization**, with `externalAuthorId` derived from the feed's issuer identifier and `followerCount` intentionally unpopulated.
- Accurate declaration of `supportedQueryFeatures` (expected minimal/empty at v1) and correct fallback to whole-query, post-fetch watchlist matching.
- Polling of at least one real GlobeNewswire feed and at least one real PR Newswire feed.
- No-duplicate behavior when a feed has zero new items since the last poll cycle.
- A deliberate, documented decision for cross-wire duplicate handling at implementation time.

**Out of scope:**
- Business Wire and AccessWire coverage at v1.
- Paid aggregators such as RTPR, bigdata.com, or PRNEWS.IO.
- Historical backfill of press releases predating the connector's first poll.
- A generalized, project-wide rewrite of the `Author` model (ADR-0004 remains the baseline; this is a documented connector-specific exception).
- Push or webhook delivery from the wire services.
- Native, clause-level query translation beyond what the feed can support.

## 3. Context and Background
RSS/News and Reddit were chosen (2026-07-29) as Phase 1's first and second platforms (spec §10). Phase 1's full architectural slice built around that choice — the connector framework (ADR-0002), `Author` (ADR-0004), `IngestionRun` (ADR-0005), per-tenant rate limiting (ADR-0003), error handling and auto-disable (ADR-0010), connector-side watchlist matching (ADR-0006), cursor pagination (ADR-0011), and derived `ConnectorHealth` (ADR-0009) — is built, with a passing contract for every one of the 23 ADRs' stories as of 2026-07-30 (see `docs/implementation-log.md`). **Neither RSS/News's nor Reddit's actual connector implementation exists yet, though** — both remain `docs/implementation-plan.md`'s Phase 1 "also build, not storied" scope, distinct from the architecture around them. This ADR doesn't depend on that gap being closed first: it only selects Newswire's *provider* and *modeling approach* ahead of when a Story would actually build it (Phase 4, multi-connector scale-out is where Newswire falls), the same ahead-of-schedule drafting pattern ADR-0017/0019 used for their own decisions. **Accepting this ADR does not imply Newswire is ready to be built before RSS/News's own real connector is** — if the near-term goal is proving data actually flows through the pipeline, that route is closing Phase 1's connector gap, not this one.

Two things need deciding before a Story can be picked up:

1. **Which provider(s).** "Newswire" in the target list means press-release wire feeds (Business Wire, PR Newswire, GlobeNewswire, AccessWire) — distinct in content shape from the general-news RSS/News connector already architected for. Direct wire-service *publishing* APIs (PR Newswire, Business Wire, ACCESS Newswire) are priced for issuing a release ($195–$1,500+/mo), the wrong shape for a *reading*/listening connector at any price — but that's a separate question from whether these wires' own *public* RSS feeds (for reading, not publishing) are free, which turned out to matter a great deal here (see Decision and Amendment Log).
2. **How to model the issuer.** `Author` (ADR-0004) was designed around individual social-platform accounts — `followerCount`, `handle`, `firstSeenAt`/`lastSeenAt` tracking one person's or brand's activity over time. A press release's "author" is an issuing organization, not an individual account in that sense, and doesn't fit the model cleanly without an explicit decision.
Press-release wire services are a high-value source of structured, market-moving and reputation-relevant announcements, yet SocialEngage has no way to ingest them. This BRD defines a Newswire `SocialConnector` that polls the freely available, public RSS/ATOM feeds published by **GlobeNewswire** and **PR Newswire** directly, without an aggregator, API key, or paid account. Each press release is normalized into a `SocialPost` through the existing ingestion pipeline, and the issuing organization — not an individual account — is represented as the `Author`.

This approach is deliberately scoped to the two wires whose public, no-signup feeds have been primary-source verified. It avoids recurring cost, card-gated trials, and reselling risk, while letting tenants track companies and topics against real press-release data using the same watchlist-matching experience already available for other platforms.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Add press-release coverage to SocialEngage without recurring vendor cost | Zero paid accounts, zero cards, and zero per-request charges for the Newswire connector |
| 2 | Reuse the existing RSS/News connector architecture | New connector ships using the current `poll`/`normalize` framework with no new connector-framework capability |
| 3 | Keep the `Author` model internally consistent | Issuing organization is modeled correctly under ADR-0004's scoped organization-as-Author exception |
| 4 | Maintain tenant self-service, low-friction onboarding | Connector can be activated without collecting or storing API keys for the tenant |
| 5 | Expand the Phase-4 multi-connector roster | Newswire is ready to build as Story 2.6, with provider and modeling decisions already accepted |

---

**Positive consequences (from ADR):**
**Positive**
- **Genuinely zero-cost, zero-commitment** — matches RSS/News's and Reddit's own onboarding exactly: no card, no trial-to-cancel operational step, no risk of an unintended charge.
- Reuses the RSS/News connector's existing poll/parse mechanism directly — most of the actual new work is the issuer-as-Author modeling and feed-selection/dedup logic, not a new connector-framework capability.
- Making the Author-as-organization departure an explicit ADR — rather than an implementation-time improvisation — keeps ADR-0004 accurate as the record of what "normal" `Author` modeling means, with this connector correctly flagged as the documented exception.
- Feeds ADR-0021's "revisit whole-query-vs-per-clause degradation once a 3rd connector's capability matrix shows partial, divergent support" trigger with real data, one way or the other, once built.

**Negative**
- **Only 2 of the 4 originally-considered wire services are covered at v1** (GlobeNewswire, PR Newswire) — Business Wire (media-partner-gated) and AccessWire (unconfirmed) are deferred, a real content-coverage gap versus what a paid aggregator covering all four would have offered.
- **No historical lookback** — a real trade-off against the rejected paid-aggregator path, not fixable without a different (paid) data source later.
- **No confirmed, published rate limit** — the connector must poll conservatively and respectfully by default; `RequestGate` can't be sized against a documented ceiling the way RTPR's connector could have been.
- **Two separate feed sources to normalize and de-duplicate against**, rather than one aggregator API handling that once — see the Cross-wire de-duplication note above.
- The Author-as-organization pattern is scoped to this connector, but isn't necessarily unique to it — a future connector with a similar shape (e.g. a corporate blog/newsroom feed) would need to decide whether to reuse this exact pattern or treat each case independently; this ADR doesn't generalize the answer.
- If Business Wire's or AccessWire's terms are later confirmed as free and open, adding them is a follow-up scope change to this same connector, not automatically covered by this ADR's acceptance.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Target **GlobeNewswire's and PR Newswire's own free, public RSS feeds directly** as the connector's data source — no aggregator, no API key, no account. Verified 2026-07-30: GlobeNewswire publishes 90+ topic/industry/organization RSS+ATOM feeds openly at `globenewswire.com/rss/list`, no login required; PR Newswire's general feeds are explicitly marketed as a *"free news widget"* at `prnewswire.com/rss/`, with only its *customized*/journalist-targeted feeds gated behind a login, not the general topic/industry feeds this connector needs. This mechanism is identical to the RSS/News connector already architected for (ADR-0002's `poll`/`normalize` shape) — this connector reuses that same polling/parsing approach, just against press-release-specific feeds, kept as its own connector identity (distinct `providerId`) because of the issuer-as-Author modeling difference below, not because the underlying mechanism differs.

**Business Wire and AccessWire are explicitly not included at v1.** Business Wire's own feed-access page is literally titled *"Feed Options for Media Partners"* — a real signal that full RSS access is gated behind a media-partner registration, not open to the general public the way GlobeNewswire's and PR Newswire's feeds are. AccessWire's general-public RSS terms could not be confirmed either way (third-party aggregators reference an "RSS Master Feed," but no direct, sourced confirmation of open public access was found). Both are deferred, not rejected — add them to this connector's coverage once their terms are separately confirmed as equivalently free and open, rather than assuming they match GlobeNewswire/PR Newswire.

For this connector, `Author` represents the **issuing organization**, not an individual — a scoped, documented departure from ADR-0004's per-account assumption. This is not a change to `Author` modeling generally; it's an accepted variant for provider shapes where "author" genuinely means "organization," flagged on ADR-0004 as a dated Pending supersession note (per the ADR series' own convention for a still-Proposed ADR that would affect part of an Accepted ADR's decision) rather than edited into ADR-0004 itself.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- `authMode: 'none'` — GlobeNewswire's and PR Newswire's public feeds need no API key or account, unlike RSS/News (API-key-only per `docs/implementation-plan.md`) or the originally-proposed RTPR aggregator.
- `deliveryMode: 'poll'` — RSS feeds are pulled on an interval; no push/webhook option exists for either source, consistent with the RSS/News connector's own mechanism.
- `getRateLimitConfig()`: no published rate limit from either service for their public feeds — a conservative `fixed-window` default, polled no more aggressively than the RSS/News connector's own cadence, revisited if either service's terms specify an actual ceiling. Unlike RTPR's confirmed 60 req/min, this is an unconfirmed placeholder — call it out as such when the Story is picked up.
- `supportedQueryFeatures` (ADR-0021): expected minimal-to-empty at launch, meaning this connector will likely fall back to whole-query post-fetch matching, same as RSS/News.
- `Author.externalAuthorId` = issuer's identifier as it appears in the feed (company name/ticker where available); `Author.followerCount` left unpopulated as not meaningful for this connector.
- **No historical backfill.** Unlike an archived article-lookup API, RSS feeds only carry recent/live items — a watchlist created today cannot retroactively see press releases from before the connector started polling. This is a real trade-off against the (rejected) paid-aggregator alternative, not an oversight.
- **Cross-wire de-duplication is not resolved by this ADR.** The same press release is sometimes distributed on more than one wire simultaneously; whether to de-duplicate (and how — headline/issuer/timestamp proximity matching) or accept duplicate `SocialPost` rows for v1 is an implementation-time decision, named here so it isn't discovered mid-build.
- Feed subset to poll (which of GlobeNewswire's 90+ topic/industry feeds, which PR Newswire categories) is an implementation-time choice tied to watchlist/tenant demand, not fixed by this ADR.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User | Tracks companies, topics, and market events in watchlists | High | See press releases alongside other platform posts in the feed |
| Tenant Admin | Activates/deactivates connectors for the tenant | Medium | Toggle the connector without entering credentials or managing keys |
| Product Owner | Defines platform coverage and prioritization | High | Adds press-release wire coverage at zero ongoing cost |
| Platform Admin | Operates multi-tenant ingestion and health | Medium | Connector fits existing `poll`/`normalize` framework and health model |
| Compliance / Finance | Owns vendor, cost, and legal risk | High | Avoid paid agreements, card-gated trials, or reselling liability |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.6 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant tracking companies via press releases, I want a real `SocialConnector` that polls GlobeNewswire's and PR Newswire's free public RSS feeds and norma... | A registered `SocialConnector` (`authMode: 'none'`, `deliveryMode: 'poll'`, a distinct `providerId`) polls at least one real GlobeNewswire feed and at least ... |
| Story 2.8 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant relying on this platform's own enrichment promise (spec §2's "enriching posts with sentiment, entities, and key phrases"), I want ingested posts ac... | A registered `AIProviderConnector` (`providerId` distinct from any `SocialConnector`'s) authenticates against Azure AI Language using a per-tenant-supplied c... |
| Story 2.13 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant tracking public perception of their own brand, organization, or a topic with a Wikipedia presence, I want a real `SocialConnector` that re-polls a ... | A registered `SocialConnector` (`providerId` distinct from every existing connector, `authMode: 'none'`, `deliveryMode: 'poll'`, per ADR-0042 Decision §1) ta... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost` (press release) | Normalized press-release item: title, body, URL, published timestamp, author reference | GlobeNewswire / PR Newswire public RSS/ATOM feeds | Backend Ingestion | Public third-party content |
| `Author` (issuing organization) | Issuer entity with `externalAuthorId` from feed and `followerCount` unpopulated | Derived from feed `issuer` / organization field | Backend Ingestion | Public third-party content |
| `ConnectorHealth` | Health status, consecutive-failure count, and auto-disable flag for the Newswire connector | Ingestion run outcomes | Backend Operations | Operational |
| `IngestionRun` | Polling attempt, checkpoint, and outcome metadata | Connector scheduler | Backend Operations | Operational |
| `Watchlist` query / match records | Result of matching press-release posts against tenant watchlists | Existing watchlist service | Backend Ingestion | Tenant-internal |
| `connector_activations` | Per-tenant active/inactive flag for the connector | Tenant Admin action | Backend Operations | Tenant-internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | For the Newswire connector, `Author` always represents the issuing organization, not a person, social handle, or publication. |
| BRU-002 | No API key, secret, or vendor account is required for a tenant to use the Newswire connector at v1. |
| BRU-003 | Business Wire and AccessWire may not be added to this connector until their public, no-signup feed terms are independently primary-source verified. |
| BRU-004 | Feed subset selection is an implementation-time decision tied to watchlist/tenant demand, not a fixed product rule. |
| BRU-005 | Historical press releases are not backfilled; only items available on the live RSS/ATOM feeds at poll time are ingested. |
| BRU-006 | Connector activation is independent of credential presence and follows ADR-0051's activation mechanism. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 connector framework (`poll`/`normalize`) | Internal / Technical | Technical Lead | Already built and contracted |
| D-002 | ADR-0004 `Author` model with scoped organization-as-Author exception | Internal / Model | Technical Lead | Already accepted and updated |
| D-003 | ADR-0021 `supportedQueryFeatures` framework | Internal / Technical | Technical Lead | Already built |
| D-004 | ADR-0051 credential-independent connector activation | Internal / Activation | Technical Lead | Already accepted |
| D-005 | Story 2.6 implementation contract | Internal / Delivery | Product Owner | Ready, accepted 2026-07-30 |
| D-006 | RSS/News connector parsing mechanism | Internal / Reuse | Technical Lead | Already built |

---

- GlobeNewswire and PR Newswire will continue to make the selected feeds available without authentication or payment.
- The feed formats (RSS/ATOM) remain structurally stable enough to parse with the existing RSS/News parser.
- The same conservative polling cadence used for the RSS/News connector is acceptable to both wire services.
- The connector is activated per tenant through the credential-independent activation mechanism introduced in ADR-0051.

**The durable decision — this is what would need superseding, not just amending:**

Target **GlobeNewswire's and PR Newswire's own free, public RSS feeds directly** as the connector's data source — no aggregator, no API key, no account. Verified 2026-07-30: GlobeNewswire publishes 90+ topic/industry/organization RSS+ATOM feeds openly at `globenewswire.com/rss/list`, no login required; PR Newswire's general feeds are explicitly marketed as a *"free news widget"* at `prnewswire.com/rss/`, with only its *customized*/journalist-targeted feeds gated behind a login, not the general topic/industry feeds this connector needs. This mechanism is identical to the RSS/News connector already architected for (ADR-0002's `poll`/`normalize` shape) — this connector reuses that same polling/parsing approach, just against press-release-specific feeds, kept as its own connector identity (distinct `providerId`) because of the issuer-as-Author modeling difference below, not because the underlying mechanism differs.

**Business Wire and AccessWire are explicitly not included at v1.** Business Wire's own feed-access page is literally titled *"Feed Options for Media Partners"* — a real signal that full RSS access is gated behind a media-partner registration, not open to the general public the way GlobeNewswire's and PR Newswire's feeds are. AccessWire's general-public RSS terms could not be confirmed either way (third-party aggregators reference an "RSS Master Feed," but no direct, sourced confirmation of open public access was found). Both are deferred, not rejected — add them to this connector's coverage once their terms are separately confirmed as equivalently free and open, rather than assuming they match GlobeNewswire/PR Newswire.

For this connector, `Author` represents the **issuing organization**, not an individual — a scoped, documented departure from ADR-0004's per-account assumption. This is not a change to `Author` modeling generally; it's an accepted variant for provider shapes where "author" genuinely means "organization," flagged on ADR-0004 as a dated Pending supersession note (per the ADR series' own convention for a still-Proposed ADR that would affect part of an Accepted ADR's decision) rather than edited into ADR-0004 itself.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- `authMode: 'none'` — GlobeNewswire's and PR Newswire's public feeds need no API key or account, unlike RSS/News (API-key-only per `docs/implementation-plan.md`) or the originally-proposed RTPR aggregator.
- `deliveryMode: 'poll'` — RSS feeds are pulled on an interval; no push/webhook option exists for either source, consistent with the RSS/News connector's own mechanism.
- `getRateLimitConfig()`: no published rate limit from either service for their public feeds — a conservative `fixed-window` default, polled no more aggressively than the RSS/News connector's own cadence, revisited if either service's terms specify an actual ceiling. Unlike RTPR's confirmed 60 req/min, this is an unconfirmed placeholder — call it out as such when the Story is picked up.
- `supportedQueryFeatures` (ADR-0021): expected minimal-to-empty at launch, meaning this connector will likely fall back to whole-query post-fetch matching, same as RSS/News.
- `Author.externalAuthorId` = issuer's identifier as it appears in the feed (company name/ticker where available); `Author.followerCount` left unpopulated as not meaningful for this connector.
- **No historical backfill.** Unlike an archived article-lookup API, RSS feeds only carry recent/live items — a watchlist created today cannot retroactively see press releases from before the connector started polling. This is a real trade-off against the (rejected) paid-aggregator alternative, not an oversight.
- **Cross-wire de-duplication is not resolved by this ADR.** The same press release is sometimes distributed on more than one wire simultaneously; whether to de-duplicate (and how — headline/issuer/timestamp proximity matching) or accept duplicate `SocialPost` rows for v1 is an implementation-time decision, named here so it isn't discovered mid-build.
- Feed subset to poll (which of GlobeNewswire's 90+ topic/industry feeds, which PR Newswire categories) is an implementation-time choice tied to watchlist/tenant demand, not fixed by this ADR.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The connector shall incur zero per-tenant or per-request cost for the selected feeds | Cost | Must | No paid plan, no card, no usage charge is required for v1; documented in ADR-0024 |
| NFR-002 | Polling cadence shall be conservative and not exceed the RSS/News connector's own cadence until a published rate limit is confirmed | Performance / Reliability | Must | `RequestGate` uses `fixed-window` with a default no more aggressive than RSS/News |
| NFR-003 | The connector shall operate without making SocialEngage a contracting party for the wire services | Compliance | Must | No API agreement, no key exchange, and no tenant-credential proxying; aligned with ADR-0027 |
| NFR-004 | The connector shall use the same health, error-handling, and auto-disable model as existing connectors | Maintainability | Must | Failures increment `ConnectorHealth` and can trigger auto-disable per ADR-0010 |

---

## 11. Error Handling and Exceptions
**Positive**
- **Genuinely zero-cost, zero-commitment** — matches RSS/News's and Reddit's own onboarding exactly: no card, no trial-to-cancel operational step, no risk of an unintended charge.
- Reuses the RSS/News connector's existing poll/parse mechanism directly — most of the actual new work is the issuer-as-Author modeling and feed-selection/dedup logic, not a new connector-framework capability.
- Making the Author-as-organization departure an explicit ADR — rather than an implementation-time improvisation — keeps ADR-0004 accurate as the record of what "normal" `Author` modeling means, with this connector correctly flagged as the documented exception.
- Feeds ADR-0021's "revisit whole-query-vs-per-clause degradation once a 3rd connector's capability matrix shows partial, divergent support" trigger with real data, one way or the other, once built.

**Negative**
- **Only 2 of the 4 originally-considered wire services are covered at v1** (GlobeNewswire, PR Newswire) — Business Wire (media-partner-gated) and AccessWire (unconfirmed) are deferred, a real content-coverage gap versus what a paid aggregator covering all four would have offered.
- **No historical lookback** — a real trade-off against the rejected paid-aggregator path, not fixable without a different (paid) data source later.
- **No confirmed, published rate limit** — the connector must poll conservatively and respectfully by default; `RequestGate` can't be sized against a documented ceiling the way RTPR's connector could have been.
- **Two separate feed sources to normalize and de-duplicate against**, rather than one aggregator API handling that once — see the Cross-wire de-duplication note above.
- The Author-as-organization pattern is scoped to this connector, but isn't necessarily unique to it — a future connector with a similar shape (e.g. a corporate blog/newsroom feed) would need to decide whether to reuse this exact pattern or treat each case independently; this ADR doesn't generalize the answer.
- If Business Wire's or AccessWire's terms are later confirmed as free and open, adding them is a follow-up scope change to this same connector, not automatically covered by this ADR's acceptance.

## 12. Assumptions and Dependencies
- GlobeNewswire and PR Newswire will continue to make the selected feeds available without authentication or payment.
- The feed formats (RSS/ATOM) remain structurally stable enough to parse with the existing RSS/News parser.
- The same conservative polling cadence used for the RSS/News connector is acceptable to both wire services.
- The connector is activated per tenant through the credential-independent activation mechanism introduced in ADR-0051.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | GlobeNewswire or PR Newswire change public feed terms or require registration | Low | High | Monitor feeds and terms; retain Alternatives list (RTPR, etc.) for future re-evaluation; follow ADR-0027 no-reseller stance | Product Owner |
| R-002 | No published rate limit leads to accidental over-polling and service blocking | Medium | High | Use a conservative, fixed-window cadence at or below RSS/News; implement health/auto-disable; revisit if limits are discovered | Technical Lead |
| R-003 | The same release appears on both wires, creating duplicate posts for tenants | High | Medium | Make cross-wire dedup a deliberate implementation-time decision; instrument duplicate metrics | Product Owner |
| R-004 | Author model confusion spreads to other connectors | Medium | Medium | Scope the exception explicitly to Newswire and reference ADR-0004's organization-as-Author clause | Technical Lead |
| R-005 | Pressure to add Business Wire/AccessWire before access is verified | Low | Medium | Defer both until primary-source confirmation; document rule BRU-003 | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md`
- BRD: `../Business-Requirements/BRD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above