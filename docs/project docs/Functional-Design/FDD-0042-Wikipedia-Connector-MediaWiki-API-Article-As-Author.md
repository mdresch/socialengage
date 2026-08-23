# BRD-0042: Wikipedia Connector — MediaWiki API, Revision Re-poll, Article-as-Author

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0042: Wikipedia Connector — MediaWiki API, Revision Re-poll, Article-as-Author |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, ../Business-Requirements/BRD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0042-wikipedia-connector-mediawiki-api-article-as-author.md and the business requirements in BRD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md into functional design for **Wikipedia Connector MediaWiki API Article As Author**.
SocialEngage needs a new, legally clean, self-service content source that can monitor public Wikipedia articles about a tenant's brand, organization, or topics. Reddit, X, and Meta were evaluated and found unsuitable or unverifiable, while Wikimedia's own primary sources confirm that the MediaWiki API is open, requires no account or key, and permits commercial reuse under CC BY-SA/GFDL terms. This BRD defines the business need, scope, and acceptance criteria for the Wikipedia connector.

The problem is two-fold: other connector candidates are blocked by closed registration (Reddit), paid-only access (X), or unverified capabilities (Meta); and Wikipedia's value is not a one-shot article snapshot but a living document that can change in reputation-relevant ways. The proposed solution is a `SocialConnector` that targets the MediaWiki Action API directly, polls `recentchanges` for already-tracked articles, normalizes each qualifying revision into a `SocialPost`, and models `Author` as the specific Wikipedia article (stable `pageid`) while keeping attribution on `SocialPost.url`.

The expected business value is expanded platform coverage with a no-account, no-key source; a novel "article just changed" reputation signal; and continued compliance with the open-content licensing requirements that Wikipedia content carries.

---

### 2.2 Scope
**In scope:**
- A `SocialConnector` for Wikipedia (`providerId` distinct from existing connectors) using the MediaWiki Action API directly.
- `authMode: 'none'` and `deliveryMode: 'poll'` with a compliant, connector-identifying `User-Agent` header.
- Re-polling already-tracked articles via the `recentchanges` API and creating one `SocialPost` per qualifying revision.
- Modeling `Author` as the specific Wikipedia article: `externalAuthorId` = stable `pageid`, `handle`/`displayName` = current article title, `followerCount` unpopulated.
- Attribution through `SocialPost.url` set to the specific revision permalink (`?oldid=<revid>`).
- New-article discovery via the `search` API for a watchlist's query; current content is ingested at discovery with no historical backfill.
- Watchlist keyword/hashtag/boolean matching with native CirrusSearch operators where confirmed and whole-article post-fetch fallback for unconfirmed operators.
- Tenant-scoped copies of ingested revisions under existing RLS (ADR-0015).
- Exposing the connector in the Tenant Admin UI connector list and the watchlist source list.

**Out of scope:**
- One-shot static snapshot ingestion (explicitly rejected in ADR-0042).
- A single, connector-wide "Wikipedia" `Author` reused for every article (explicitly rejected).
- Modeling `Author` as the article's contributor list or contributor-history page.
- RAG/embedding-oriented chunked ingestion in this release.
- Backfilling a newly discovered article's full revision history beyond its current content.
- A materiality threshold for re-ingestion (e.g., edit size, minor-edit flag) in v1.
- Cross-source de-duplication of the Newswire/GNews kind (not applicable to Wikipedia).
- External redistribution of AI-enrichment output derived from Wikipedia text without a later CC BY-SA "Adapted Material" review.

## 3. Context and Background
`docs/open-decisions.md`'s 2026-08-06 connector-comparison entry vetted Reddit, X, YouTube, Meta, and Wikipedia against this project's own established evaluation discipline (ADR-0024/0026's primary-source verification bar, ADR-0027's technical-intermediary-only posture). Reddit — the informally "next" connector per `docs/implementation-plan.md`'s Phase 1 note — was found to have closed self-service registration since late 2025 (approval-gated, "slow and often silent" for commercial use per community reporting) and a 48-hour content-deletion-propagation obligation that does not fit ADR-0018's/ADR-0039's current retention design. X requires a paid tier with no free path at all. Meta's actual social-listening capability (monitoring *other* accounts' public posts, not a tenant's own Page) is unconfirmed either way. Wikipedia came back clean on every axis this project actually screens for.

**Verified directly against Wikimedia's own primary sources, 2026-08-06** (not secondhand — every claim below was fetched from `foundation.wikimedia.org`, `meta.wikimedia.org`, or `mediawiki.org` directly, the same discipline ADR-0024/0026 held themselves to after RTPR's and Currents API's claims failed to survive direct verification):

- **Self-service, no approval gate.** The Wikimedia Foundation's own API Usage Guidelines (`foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines`) state directly: *"the existence of this policy does not require members of the Wikimedia community to get prior permission from the Wikimedia Foundation before using the APIs in a manner consistent with this policy."* No account, no API key, no developer application review — a materially different posture from Reddit's now-closed registration.
- **Commercial reuse explicitly permitted.** The Foundation's Terms of Use §7 ("Licensing of Content"), fetched directly: contributed text is dual-licensed CC BY-SA 4.0 and GFDL, and *"these licenses do allow commercial uses of your contributions, as long as such uses are compliant with the terms of the respective licenses."* No commercial/non-commercial split exists in the API Usage Guidelines either — unlike GNews's free tier (ADR-0026), which is explicitly non-commercial-only.
- **Attribution mechanism, stated by Wikimedia itself.** Terms of Use §7 names three acceptable attribution methods; the first, verbatim: *"Through hyperlink (where possible) or URL to the article to which you contributed (since each article has a history page that lists all contributors, authors and editors)."* This is the mechanism this ADR's Decision adopts below — see the "Attribution mechanism" implementation default.
- **Only real restriction: no sublicensing/reselling/white-labeling of the API itself**, not a restriction on using it. The API Usage Guidelines, fetched directly: *"Operators (or those acting on their behalf) may not sublicense, lease, assign, or guarantee the availability or functionality of a Wikimedia Foundation-managed API to any third party,"* and *"It is not permissible to implement an API client that white labels in a manner that obscures the identity of the ultimate service provider of the APIs (the Wikimedia Foundation)."* This restricts reselling Wikimedia's own API access to a third party while hiding that it's Wikimedia's — it does not restrict SocialEngage from using the API internally to power its own ingestion pipeline, the same posture ADR-0027 already establishes for every connector: SocialEngage is a technical consumer of the source, never a reseller of it.
- **ShareAlike triggers on modification-and-redistribution, not passive storage.** CC BY-SA 4.0's own legal text (`creativecommons.org/licenses/by-sa/4.0/legalcode.en`), fetched directly: the ShareAlike obligation (§3(b)) applies only when a licensee *"Share[s] Adapted Material,"* where "Adapted Material" (§1) requires the licensed material to be *"translated, altered, arranged, transformed, or otherwise modified."* Reproducing, storing, or displaying the unmodified text — which is all this connector's v1 scope does — does not trigger it. Named explicitly here, per this ADR's own task, so a future contributor does not assume SocialEngage's own database storage of raw article text is itself a "modification."

This is the same rigor bar ADR-0024 (Newswire) and ADR-0026 (GNews) already established for a connector-selection ADR — this ADR follows their structure directly, not a lighter-weight decision.

**The entity-modeling question this ADR must resolve, not defer a third time.** The Knowledge-Graph & Semantic Data Modeling Reviewer reviewed this exact question on 2026-08-06 (`docs/architecture/knowledge-graph-register.md`) and found: relational storage remains sufficient (no graph-shaped traversal or dense many-to-many pattern is implied by anything proposed); but the floated framing — "`Author` = the article's own contributor-history page, a dynamic reference, not one fixed organization" — does **not** cleanly extend ADR-0024's/ADR-0026's issuer-as-Author pattern the way it first looked like it might. A per-article history-page reference is 1:1 with the `SocialPost` being ingested, which collapses `Author` normalization to exactly the "embed author fields per post" alternative ADR-0004's own Alternatives Considered section already rejected — **unless** a real many-post-to-one-`Author` reuse pattern exists. The reviewer named the open question directly: does this connector re-poll/re-ingest an article as it gets edited over time (producing multiple `SocialPost` rows over time, all pointing at the same `Author`), or is each article ingested once as a static snapshot? This ADR's Decision, below, makes that call.
SocialEngage needs a new, legally clean, self-service content source that can monitor public Wikipedia articles about a tenant's brand, organization, or topics. Reddit, X, and Meta were evaluated and found unsuitable or unverifiable, while Wikimedia's own primary sources confirm that the MediaWiki API is open, requires no account or key, and permits commercial reuse under CC BY-SA/GFDL terms. This BRD defines the business need, scope, and acceptance criteria for the Wikipedia connector.

The problem is two-fold: other connector candidates are blocked by closed registration (Reddit), paid-only access (X), or unverified capabilities (Meta); and Wikipedia's value is not a one-shot article snapshot but a living document that can change in reputation-relevant ways. The proposed solution is a `SocialConnector` that targets the MediaWiki Action API directly, polls `recentchanges` for already-tracked articles, normalizes each qualifying revision into a `SocialPost`, and models `Author` as the specific Wikipedia article (stable `pageid`) while keeping attribution on `SocialPost.url`.

The expected business value is expanded platform coverage with a no-account, no-key source; a novel "article just changed" reputation signal; and continued compliance with the open-content licensing requirements that Wikipedia content carries.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
| --- | --- | --- |
| 1 | Add a self-service, no-approval Wikipedia ingestion source to the connector roster | Wikipedia is registered as a `SocialConnector` and can be activated in the Tenant Admin UI |
| 2 | Deliver reputation-relevant edit monitoring for tracked Wikipedia articles | Each qualifying revision of a tracked article produces a new `SocialPost` and the tenant can see when an article changed |
| 3 | Satisfy Wikimedia attribution and licensing obligations | Every Wikipedia-sourced `SocialPost.url` points to the specific revision permalink and storage of unmodified text is documented |
| 4 | Preserve a meaningful, reusable `Author` entity model | Multiple revisions of the same article share a single `Author` keyed by `pageid` |
| 5 | Keep implementation honest about known gaps | Open questions (exact CirrusSearch surface, exact rate limit, materiality threshold) are explicitly documented rather than invented |

---

**Positive consequences (from ADR):**
**Positive**

- The best-grounded connector candidate this project has vetted since GNews/Newswire — self-service with no approval gate (unlike Reddit's now-closed registration), commercial reuse explicitly permitted (unlike GNews's non-commercial-only free tier), every material claim verified directly against Wikimedia's own primary sources rather than secondhand summaries.
- Resolves, with reasoning rather than a third deferral, the entity-modeling open question the Knowledge-Graph reviewer explicitly declined to answer — a genuine, if structurally distinct, third instance of the issuer-as-Author pattern, giving `docs/adr/README.md`'s and ADR-0004's own "rule of three" trigger a real third data point (see the accompanying Pending supersession note on ADR-0004).
- Cleanly separates the entity-reuse question (`Author` = the article) from the legal-attribution question (`SocialPost.url` = the specific revision permalink) — avoids conflating two different concerns into one field, per this ADR's own explicit task framing.
- Storing whole, unchunked article text in `SocialPost.text` at each qualifying revision keeps the future RAG/embedding direction Menno has already named as anticipated (not designed here — see Open questions) structurally open rather than foreclosed: a later chunking/indexing pass can operate on the stored raw text without this ADR having pre-committed to any particular chunk boundary.
- `recentchanges`-driven re-polling is a genuinely novel monitoring signal none of this project's other connectors offer — "your own Wikipedia article just changed" — closer to the actual reputation-monitoring use case than a one-shot article snapshot would be.

**Negative**

- **`Author`'s reused shape here is not identical to Newswire's/GNews's**, and treating it as a mechanical "third instance, therefore generalize ADR-0004 without further thought" would overstate the similarity — see the Pending supersession note on ADR-0004 for the narrower, honestly-scoped generalization this ADR actually recommends.
- **A re-poll-per-revision cadence can generate real per-tenant volume** for an actively-edited article, a cumulative storage/retention driver ADR-0018's existing tiers were not sized against; named here, not yet resolved.
- **No confirmed, published rate limit** at the exact numeric level — same honest gap ADR-0024 disclosed for Newswire; the connector must poll conservatively by default until verified.
- **CirrusSearch's exact native-query-parameter surface through the standard API endpoint was not fully confirmed** in this pass — a real verification gap before `supportedQueryFeatures` can be finalized, named rather than glossed over.
- **`recentchanges`'s 30-day rolling window** means an already-tracked article's edit history beyond 30 days back is not retroactively discoverable through that endpoint alone — a real, if partial (revision-history walking can go further), limitation.
- Every qualifying revision re-ingests the article's current full text, not a diff — Wikipedia's own API does not expose a plain "what changed" field suitable for direct ingestion (per-diff attribution isn't cleanly available either, confirmed by the Knowledge-Graph reviewer's own finding) — meaning a large, mostly-unrelated edit to an otherwise-matching article still produces a full-text re-ingestion, a real noise/volume trade-off left for implementation-time tuning (e.g., a materiality threshold), not resolved here.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
| --- | --- | --- | --- | --- |
| BR-001 | The system shall register Wikipedia as a `SocialConnector` with `authMode: 'none'` and `deliveryMode: 'poll'`. | Must | `wikipedia` is a distinct registered connector; no change to the core ingestion orchestration path is required. | Engineering |
| BR-002 | The system shall set a compliant, connector-identifying `User-Agent` header on every MediaWiki API request. | Must | The header identifies the client and includes contact information on every real or fixture request. | Engineering |
| BR-003 | The system shall re-poll already-tracked articles via the `recentchanges` API and create one `SocialPost` per qualifying revision. | Must | A test with two distinct revisions of the same article across two poll cycles produces two `SocialPost` rows that resolve to the same `Author`. | Engineering |
| BR-004 | The system shall model `Author` as the Wikipedia article using the stable `pageid` and current title. | Must | `Author.externalAuthorId` = `pageid`; `Author.handle`/`displayName` = current title; `followerCount` is unpopulated. | Engineering |
| BR-005 | The system shall set `SocialPost.url` to the specific revision permalink (`?oldid=<revid>`). | Must | Stored URL includes the revision id and is distinct from the bare article URL. | Engineering |
| BR-006 | The system shall ingest only the current revision of a newly discovered article and shall not backfill prior history. | Must | First discovery of an article produces one `SocialPost` for the current revision only. | Engineering |
| BR-007 | The system shall support watchlist matching with confirmed CirrusSearch operators and fallback to whole-article matching. | Must | `supportedQueryFeatures` is declared conservatively; unconfirmed operators fall back to post-fetch matching. | Engineering |
| BR-008 | The Tenant Admin UI shall list Wikipedia as an activatable connector and as a watchlist source. | Should | `tenant/connectors/page.tsx` and `tenant/watchlists/page.tsx` include a `wikipedia` entry with a distinct icon and color. | Engineering |
| BR-009 | A poll cycle with zero qualifying `recentchanges` entries since the last check shall be a no-op. | Must | Two consecutive poll cycles with no new edits produce no duplicate `SocialPost` rows. | Engineering |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
| --- | --- | --- | --- |
| Menno (Sponsor / Product Owner / Technical Lead) | Decision owner and approver | High | Defensible licensing, clean scope, and honest known gaps |
| Tenant Admin | Activates and manages the connector | High | Simple, no-credential activation and clear UI placement |
| Brand / Reputation Manager | Uses the data to monitor public perception | High | Timely notification when a Wikipedia article changes |
| Knowledge Graph & Semantic Data Modeling Reviewer | `Author` modeling and normalization | Medium | Reusable entity without 1:1 collapse per revision |
| Engineering (backend) | Implements the connector and ingestion logic | High | Clear defaults, explicit placeholders, and validation targets |
| Engineering (frontend) | Surfaces the connector in the admin UI | Medium | Hand-curated `PLATFORMS` and `SOCIAL_PLATFORMS` entries |
| Platform Operations | Monitors connector health, volume, and rate limits | Medium | Volume and rate-limit observability |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.13 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant tracking public perception of their own brand, organization, or a topic with a Wikipedia presence, I want a real `SocialConnector` that re-polls a ... | A registered `SocialConnector` (`providerId` distinct from every existing connector, `authMode: 'none'`, `deliveryMode: 'poll'`, per ADR-0042 Decision §1) ta... |
| Story 2.14 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant who has activated the Wikipedia connector, I want its discovery search to use the topic(s) I've actually defined in my own watchlist(s) targeting W... | `pollWikipedia()`'s discovery phase no longer calls `fetchWikipediaSearch()` with a fixed, shared `DEFAULT_QUERY` — it derives its search query from the tena... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
| --- | --- | --- | --- | --- |
| `Author.externalAuthorId` | Stable Wikipedia `pageid` for the tracked article | MediaWiki `action=query&prop=info` | Backend | Public |
| `Author.handle` / `Author.displayName` | Current article title (may change on page move) | MediaWiki `action=query&prop=info` | Backend | Public |
| `Author.followerCount` | Not populated for Wikipedia articles (same as Newswire/GNews) | — | Backend | — |
| `SocialPost.url` | Permalink to the specific revision: `https://en.wikipedia.org/w/index.php?title=<Title>&oldid=<revid>` | Derived from MediaWiki revision id | Backend | Public |
| `SocialPost.text` | Full, unmodified article text for the revision | MediaWiki `action=query&prop=revisions&rvprop=content` | Backend | Public (open-licensed) |
| `SocialPost.publishedAt` | Revision timestamp from `recentchanges` or `revisions` | MediaWiki API | Backend | Public |
| RecentChanges timestamp | Time of the latest edit for re-poll windowing | MediaWiki `action=query&list=recentchanges` | Backend | Public |
| `User-Agent` string | Client identification required by Wikimedia policy (e.g., `SocialEngage/1.0`) | Connector configuration | Backend | Non-sensitive |

---

## 8. Business Rules and Logic
| ID | Rule |
| --- | --- |
| BRU-001 | For the Wikipedia connector, `Author` represents the specific Wikipedia article, keyed by the stable `pageid` and not by title, contributor list, or a constant "Wikipedia" value. |
| BRU-002 | Attribution for Wikipedia-sourced content is satisfied through `SocialPost.url` pointing to the specific revision permalink (`?oldid=<revid>`); `Author` does not carry the attribution obligation. |
| BRU-003 | No account, API key, or tenant-specific credential is stored or transmitted; the only access control is a compliant, connector-identifying `User-Agent` header. |
| BRU-004 | Only unmodified article text is stored in `SocialPost.text`; any future external redistribution of AI-enrichment output derived from Wikipedia text must first be reviewed for CC BY-SA "Adapted Material" exposure. |
| BRU-005 | New-article discovery uses the `search` API; re-poll of already-tracked articles uses the `recentchanges` API. |
| BRU-006 | Each tenant tracking the same public article ingests its own tenant-scoped copy of the same revision under RLS. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
| --- | --- | --- | --- | --- |
| D-001 | ADR-0042 accepted | Internal | Menno | Resolved 2026-08-08 |
| D-002 | ADR-0004 Author normalization model | Internal | Architecture | Accepted; pending supersession note to be resolved by Menno |
| D-003 | ADR-0021 connector query-feature matrix | Internal | Architecture | Accepted |
| D-004 | ADR-0051 generic connector activate/deactivate surface | Internal | Engineering | Built |
| D-005 | ADR-0018 tiered retention policy | Internal | Engineering | Accepted |
| D-006 | Wikimedia API availability, policies, and rate limits | External | Wikimedia | Ongoing; exact rate limit remains unverified |
| D-007 | Story 2.13, 2.14, 6.21, and 6.22 implementation | Internal | Engineering | Built 2026-08-17/18 |

---

- Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy remain as verified on 2026-08-06.
- Tenants will use watchlist queries that are compatible with the confirmed `supportedQueryFeatures`; unconfirmed CirrusSearch operators will fall back cleanly to whole-article matching.
- A conservative rate-limit placeholder is acceptable until the exact Wikimedia ceiling is verified.
- Whole, unmodified article text stored in `SocialPost.text` does not constitute an "Adapted Material" share under CC BY-SA 4.0.

**The durable decision — this is what would need superseding, not just amending:**

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| NFR-001 | The connector shall operate in compliance with Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy. | Compliance | Must | All claims are traceable to primary-source Wikimedia URLs; no invented terms. |
| NFR-002 | The connector shall use a conservative, explicitly-labeled rate-limit placeholder until the exact ceiling is verified. | Performance | Must | `getRateLimitConfig()` either uses a verified number from `mediawiki.org` or an explicitly named placeholder. |
| NFR-003 | All ingested `SocialPost` and `Author` data shall remain tenant-scoped under the existing RLS model. | Security | Must | Cross-tenant leakage is prevented by the existing RLS policy. |
| NFR-004 | The connector shall support the existing tiered-retention and storage policy (ADR-0018). | Scalability | Should | Wikipedia volume is observable and retention rules apply without special exceptions. |
| NFR-005 | The system shall not resell, sublicense, or white-label the Wikimedia API. | Legal | Must | Architecture and operations reviews confirm no third-party API-resale path. |

---

## 11. Error Handling and Exceptions
**Positive**

- The best-grounded connector candidate this project has vetted since GNews/Newswire — self-service with no approval gate (unlike Reddit's now-closed registration), commercial reuse explicitly permitted (unlike GNews's non-commercial-only free tier), every material claim verified directly against Wikimedia's own primary sources rather than secondhand summaries.
- Resolves, with reasoning rather than a third deferral, the entity-modeling open question the Knowledge-Graph reviewer explicitly declined to answer — a genuine, if structurally distinct, third instance of the issuer-as-Author pattern, giving `docs/adr/README.md`'s and ADR-0004's own "rule of three" trigger a real third data point (see the accompanying Pending supersession note on ADR-0004).
- Cleanly separates the entity-reuse question (`Author` = the article) from the legal-attribution question (`SocialPost.url` = the specific revision permalink) — avoids conflating two different concerns into one field, per this ADR's own explicit task framing.
- Storing whole, unchunked article text in `SocialPost.text` at each qualifying revision keeps the future RAG/embedding direction Menno has already named as anticipated (not designed here — see Open questions) structurally open rather than foreclosed: a later chunking/indexing pass can operate on the stored raw text without this ADR having pre-committed to any particular chunk boundary.
- `recentchanges`-driven re-polling is a genuinely novel monitoring signal none of this project's other connectors offer — "your own Wikipedia article just changed" — closer to the actual reputation-monitoring use case than a one-shot article snapshot would be.

**Negative**

- **`Author`'s reused shape here is not identical to Newswire's/GNews's**, and treating it as a mechanical "third instance, therefore generalize ADR-0004 without further thought" would overstate the similarity — see the Pending supersession note on ADR-0004 for the narrower, honestly-scoped generalization this ADR actually recommends.
- **A re-poll-per-revision cadence can generate real per-tenant volume** for an actively-edited article, a cumulative storage/retention driver ADR-0018's existing tiers were not sized against; named here, not yet resolved.
- **No confirmed, published rate limit** at the exact numeric level — same honest gap ADR-0024 disclosed for Newswire; the connector must poll conservatively by default until verified.
- **CirrusSearch's exact native-query-parameter surface through the standard API endpoint was not fully confirmed** in this pass — a real verification gap before `supportedQueryFeatures` can be finalized, named rather than glossed over.
- **`recentchanges`'s 30-day rolling window** means an already-tracked article's edit history beyond 30 days back is not retroactively discoverable through that endpoint alone — a real, if partial (revision-history walking can go further), limitation.
- Every qualifying revision re-ingests the article's current full text, not a diff — Wikipedia's own API does not expose a plain "what changed" field suitable for direct ingestion (per-diff attribution isn't cleanly available either, confirmed by the Knowledge-Graph reviewer's own finding) — meaning a large, mostly-unrelated edit to an otherwise-matching article still produces a full-text re-ingestion, a real noise/volume trade-off left for implementation-time tuning (e.g., a materiality threshold), not resolved here.

## 12. Assumptions and Dependencies
- Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy remain as verified on 2026-08-06.
- Tenants will use watchlist queries that are compatible with the confirmed `supportedQueryFeatures`; unconfirmed CirrusSearch operators will fall back cleanly to whole-article matching.
- A conservative rate-limit placeholder is acceptable until the exact Wikimedia ceiling is verified.
- Whole, unmodified article text stored in `SocialPost.text` does not constitute an "Adapted Material" share under CC BY-SA 4.0.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R-001 | The article-as-`Author` shape is treated as a mechanical third instance and ADR-0004 is over-generalized. | Medium | Medium | Document the narrower, structurally distinct nature of the Wikipedia case and update ADR-0004 carefully. | Menno / Architecture |
| R-002 | The exact CirrusSearch query surface available through the standard API endpoint remains unconfirmed, causing feature mismatch. | Medium | Medium | Declare `supportedQueryFeatures` conservatively and fall back to whole-article matching for unconfirmed operators. | Engineering |
| R-003 | Unverified Wikimedia rate limits lead to 403/429 blocks or service disruption. | Low | High | Ship with a conservative, explicitly-labeled placeholder and verify the real ceiling before sizing `RequestGate`. | Engineering |
| R-004 | Actively-edited articles generate high `SocialPost` volume and storage growth. | Medium | High | Apply ADR-0018 retention tiers; leave materiality-threshold tuning as a future, named option. | Product / Engineering |
| R-005 | Future AI enrichment output redistributed externally could trigger CC BY-SA "Adapted Material" obligations. | Low | High | Flag for legal/semantic review before any feature shares enrichment output derived from Wikipedia text outside the tenant's account. | Menno |

---

## 14. Appendix
- ADR: `../../adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md`
- BRD: `../Business-Requirements/BRD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above