# BRD-0042: Wikipedia Connector — MediaWiki API, Revision Re-poll, Article-as-Author

## 1. Document Control

| Field | Value |
| --- | --- |
| Document Title | Wikipedia Connector — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-06 | AI Business & Requirements Analyst | Initial draft from ADR-0042 and related implementation stories |
| 1.0 | 2026-08-19 | AI Business & Requirements Analyst | Approved BRD incorporating ADR-0042 decisions and Story 2.13/2.14/6.21/6.22 acceptance criteria |

---

## 2. Executive Summary

SocialEngage needs a new, legally clean, self-service content source that can monitor public Wikipedia articles about a tenant's brand, organization, or topics. Reddit, X, and Meta were evaluated and found unsuitable or unverifiable, while Wikimedia's own primary sources confirm that the MediaWiki API is open, requires no account or key, and permits commercial reuse under CC BY-SA/GFDL terms. This BRD defines the business need, scope, and acceptance criteria for the Wikipedia connector.

The problem is two-fold: other connector candidates are blocked by closed registration (Reddit), paid-only access (X), or unverified capabilities (Meta); and Wikipedia's value is not a one-shot article snapshot but a living document that can change in reputation-relevant ways. The proposed solution is a `SocialConnector` that targets the MediaWiki Action API directly, polls `recentchanges` for already-tracked articles, normalizes each qualifying revision into a `SocialPost`, and models `Author` as the specific Wikipedia article (stable `pageid`) while keeping attribution on `SocialPost.url`.

The expected business value is expanded platform coverage with a no-account, no-key source; a novel "article just changed" reputation signal; and continued compliance with the open-content licensing requirements that Wikipedia content carries.

---

## 3. Business Objectives

| # | Objective | Success Measure |
| --- | --- | --- |
| 1 | Add a self-service, no-approval Wikipedia ingestion source to the connector roster | Wikipedia is registered as a `SocialConnector` and can be activated in the Tenant Admin UI |
| 2 | Deliver reputation-relevant edit monitoring for tracked Wikipedia articles | Each qualifying revision of a tracked article produces a new `SocialPost` and the tenant can see when an article changed |
| 3 | Satisfy Wikimedia attribution and licensing obligations | Every Wikipedia-sourced `SocialPost.url` points to the specific revision permalink and storage of unmodified text is documented |
| 4 | Preserve a meaningful, reusable `Author` entity model | Multiple revisions of the same article share a single `Author` keyed by `pageid` |
| 5 | Keep implementation honest about known gaps | Open questions (exact CirrusSearch surface, exact rate limit, materiality threshold) are explicitly documented rather than invented |

---

## 4. Scope

### 4.1 In Scope

- A `SocialConnector` for Wikipedia (`providerId` distinct from existing connectors) using the MediaWiki Action API directly.
- `authMode: 'none'` and `deliveryMode: 'poll'` with a compliant, connector-identifying `User-Agent` header.
- Re-polling already-tracked articles via the `recentchanges` API and creating one `SocialPost` per qualifying revision.
- Modeling `Author` as the specific Wikipedia article: `externalAuthorId` = stable `pageid`, `handle`/`displayName` = current article title, `followerCount` unpopulated.
- Attribution through `SocialPost.url` set to the specific revision permalink (`?oldid=<revid>`).
- New-article discovery via the `search` API for a watchlist's query; current content is ingested at discovery with no historical backfill.
- Watchlist keyword/hashtag/boolean matching with native CirrusSearch operators where confirmed and whole-article post-fetch fallback for unconfirmed operators.
- Tenant-scoped copies of ingested revisions under existing RLS (ADR-0015).
- Exposing the connector in the Tenant Admin UI connector list and the watchlist source list.

### 4.2 Out of Scope

- One-shot static snapshot ingestion (explicitly rejected in ADR-0042).
- A single, connector-wide "Wikipedia" `Author` reused for every article (explicitly rejected).
- Modeling `Author` as the article's contributor list or contributor-history page.
- RAG/embedding-oriented chunked ingestion in this release.
- Backfilling a newly discovered article's full revision history beyond its current content.
- A materiality threshold for re-ingestion (e.g., edit size, minor-edit flag) in v1.
- Cross-source de-duplication of the Newswire/GNews kind (not applicable to Wikipedia).
- External redistribution of AI-enrichment output derived from Wikipedia text without a later CC BY-SA "Adapted Material" review.

### 4.3 Assumptions

- Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy remain as verified on 2026-08-06.
- Tenants will use watchlist queries that are compatible with the confirmed `supportedQueryFeatures`; unconfirmed CirrusSearch operators will fall back cleanly to whole-article matching.
- A conservative rate-limit placeholder is acceptable until the exact Wikimedia ceiling is verified.
- Whole, unmodified article text stored in `SocialPost.text` does not constitute an "Adapted Material" share under CC BY-SA 4.0.

### 4.4 Constraints

- No account, API key, or per-tenant credential may be used; access is gated only by a compliant `User-Agent` header.
- `recentchanges` cannot enumerate edits more than 30 days into the past on Wikimedia wikis.
- `SocialPost.url` must carry the specific revision id (`oldid`) to satisfy attribution.
- SocialEngage may not resell, sublicense, or white-label the Wikimedia API.
- Storage and retention must align with ADR-0018's existing tiered-retention policy.

---

## 5. Stakeholders

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

## 6. Current State (As-Is)

SocialEngage currently ships four real `SocialConnector` platforms: GNews, Newswire, tenant-owned-feed, and Facebook. The original Phase 1 plan pointed toward RSS/News and then Reddit, but Reddit's self-service registration has closed, X requires a paid tier, and Meta's social-listening capability remains unverified. GNews and Newswire both ingest items that are published once and effectively immutable; they do not provide a signal for "the same public document just changed." The `Author` entity is modeled per ADR-0004 as a normalized, reusable organization-level identity, with ADR-0024 (Newswire) and ADR-0026 (GNews) already establishing two issuer-as-`Author` departures.

**Pain points:**
- There is no self-service, no-account, commercial-reuse-permitted source in the connector roster.
- A tenant cannot monitor reputation-relevant edits to their own or a relevant Wikipedia article.
- The `Author` modeling question for a Wikipedia article (a platform-native document, not a real-world organization) was left unresolved by the Knowledge Graph reviewer.
- Storing Wikipedia content without clear attribution and licensing separation would expose the project to CC BY-SA/GFDL compliance risk.

---

## 7. Future State (To-Be)

After this initiative, a `SocialConnector` named `wikipedia` is registered in `social-listening-core` and surfaced in `social-listening-admin`. A Tenant Admin can activate it with no credentials. A watchlist can target Wikipedia as a platform source. The connector polls the MediaWiki Action API in two modes: (1) `recentchanges` for already-tracked articles and (2) `search` for first-time discovery.

**Expected capabilities:**
- Each qualifying revision of a tracked article becomes a new `SocialPost` under the tenant's RLS scope.
- All such revisions for the same article share a single `Author` entity keyed by the stable `pageid`.
- Every `SocialPost` stores the article's full, unmodified text at the time of that revision and links to the specific revision permalink via `SocialPost.url`.
- Outbound requests identify the client with a compliant, non-generic `User-Agent` header.
- Watchlist matching uses confirmed native query features and falls back to whole-article matching for unconfirmed operators.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| NFR-001 | The connector shall operate in compliance with Wikimedia's Terms of Use, API Usage Guidelines, and User-Agent Policy. | Compliance | Must | All claims are traceable to primary-source Wikimedia URLs; no invented terms. |
| NFR-002 | The connector shall use a conservative, explicitly-labeled rate-limit placeholder until the exact ceiling is verified. | Performance | Must | `getRateLimitConfig()` either uses a verified number from `mediawiki.org` or an explicitly named placeholder. |
| NFR-003 | All ingested `SocialPost` and `Author` data shall remain tenant-scoped under the existing RLS model. | Security | Must | Cross-tenant leakage is prevented by the existing RLS policy. |
| NFR-004 | The connector shall support the existing tiered-retention and storage policy (ADR-0018). | Scalability | Should | Wikipedia volume is observable and retention rules apply without special exceptions. |
| NFR-005 | The system shall not resell, sublicense, or white-label the Wikimedia API. | Legal | Must | Architecture and operations reviews confirm no third-party API-resale path. |

---

## 9. Business Rules

| ID | Rule |
| --- | --- |
| BRU-001 | For the Wikipedia connector, `Author` represents the specific Wikipedia article, keyed by the stable `pageid` and not by title, contributor list, or a constant "Wikipedia" value. |
| BRU-002 | Attribution for Wikipedia-sourced content is satisfied through `SocialPost.url` pointing to the specific revision permalink (`?oldid=<revid>`); `Author` does not carry the attribution obligation. |
| BRU-003 | No account, API key, or tenant-specific credential is stored or transmitted; the only access control is a compliant, connector-identifying `User-Agent` header. |
| BRU-004 | Only unmodified article text is stored in `SocialPost.text`; any future external redistribution of AI-enrichment output derived from Wikipedia text must first be reviewed for CC BY-SA "Adapted Material" exposure. |
| BRU-005 | New-article discovery uses the `search` API; re-poll of already-tracked articles uses the `recentchanges` API. |
| BRU-006 | Each tenant tracking the same public article ingests its own tenant-scoped copy of the same revision under RLS. |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
| --- | --- | --- | --- |
| Wikipedia connector activation count | Track adoption of the new source | Product / Platform Operations | Monthly |
| Revisions ingested per tracked article | Monitor edit velocity and reputation signals | Brand / Reputation Manager | Daily / Weekly |
| Storage volume by Wikipedia source | Manage cost and retention under ADR-0018 | Platform Operations | Monthly |
| Watchlist matches on Wikipedia posts | Measure source usefulness for alerting | Product / Analytics | Daily |
| Rate-limit events / 429 responses | Ensure compliant, non-disruptive polling | Engineering / Platform Operations | Real-time / Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R-001 | The article-as-`Author` shape is treated as a mechanical third instance and ADR-0004 is over-generalized. | Medium | Medium | Document the narrower, structurally distinct nature of the Wikipedia case and update ADR-0004 carefully. | Menno / Architecture |
| R-002 | The exact CirrusSearch query surface available through the standard API endpoint remains unconfirmed, causing feature mismatch. | Medium | Medium | Declare `supportedQueryFeatures` conservatively and fall back to whole-article matching for unconfirmed operators. | Engineering |
| R-003 | Unverified Wikimedia rate limits lead to 403/429 blocks or service disruption. | Low | High | Ship with a conservative, explicitly-labeled placeholder and verify the real ceiling before sizing `RequestGate`. | Engineering |
| R-004 | Actively-edited articles generate high `SocialPost` volume and storage growth. | Medium | High | Apply ADR-0018 retention tiers; leave materiality-threshold tuning as a future, named option. | Product / Engineering |
| R-005 | Future AI enrichment output redistributed externally could trigger CC BY-SA "Adapted Material" obligations. | Low | High | Flag for legal/semantic review before any feature shares enrichment output derived from Wikipedia text outside the tenant's account. | Menno |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A `wikipedia` `SocialConnector` is registered with `authMode: 'none'`, `deliveryMode: 'poll'`, and a distinct `providerId`, with no change to the core ingestion path.
- Every outbound MediaWiki API request carries a compliant, connector-identifying `User-Agent` header.
- Two distinct revisions of the same tracked article across two poll cycles produce two `SocialPost` rows that resolve to the same `Author`.
- Each `Author` is keyed by the article's stable `pageid`, with `handle`/`displayName` set to the current title and `followerCount` unpopulated.
- Each `SocialPost.url` points to the specific revision permalink (`?oldid=<revid>`) and not the bare article URL.
- A newly discovered article is ingested at its current revision only; no historical revision backfill is performed.
- `supportedQueryFeatures` is declared conservatively, and unconfirmed CirrusSearch operators fall back to whole-article post-fetch matching.
- `getRateLimitConfig()` uses a verified value or an explicitly-labeled conservative placeholder, never a silently invented number.
- A poll cycle with no new qualifying `recentchanges` produces no duplicate `SocialPost` rows.
- The Tenant Admin UI lists Wikipedia as an activatable connector and as a watchlist source.

---

## 15. Glossary

| Term | Definition |
| --- | --- |
| MediaWiki Action API | Wikipedia's first-party HTTP API for querying pages, revisions, recent changes, and search. |
| `recentchanges` | MediaWiki API endpoint listing recent edits, filterable by page title and time window. |
| `pageid` | A stable numeric identifier for a Wikipedia page, persisting across title changes. |
| `oldid` / `revid` | A specific revision identifier used to construct a permalink to that exact version of an article. |
| Article-as-`Author` | The Wikipedia connector's `Author` entity represents the tracked article itself, not a person, organization, or constant platform value. |
| CC BY-SA 4.0 | Creative Commons Attribution-ShareAlike license applied to Wikipedia text. |
| GFDL | GNU Free Documentation License, also applying to Wikipedia text. |
| CirrusSearch | The MediaWiki search backend that supports quoted phrases, exclusions, and field-scoped operators. |
| Adapted Material | Modified or transformed material that, when shared, triggers CC BY-SA ShareAlike obligations. |

---

## 16. Appendices

### Supporting Documents

- ADR-0042 — `docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md`
- Story 2.13 — `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`
- Story 2.14 — `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`
- Story 6.21 — `docs/user-stories/epic-6-tenant-admin-ui.md`
- Story 6.22 — `docs/user-stories/epic-6-tenant-admin-ui.md`
- ADR-0004 — `docs/adr/0004-author-normalized-separately-from-post.md`
- ADR-0021 — `docs/adr/0021-connector-query-capability-matrix.md`
- ADR-0027 — `docs/adr/0027-no-pooling-third-party-accounts.md`
- ADR-0015 — `docs/adr/0015-rls-per-tenant-data-isolation.md`
- ADR-0018 — `docs/adr/0018-tiered-retention-policy.md`

### Note on Product-Research Sources

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for the Wikipedia connector. This BRD was produced directly from ADR-0042, the relevant `epic-2` and `epic-6` user stories, and the connector comparison recorded in `docs/open-decisions.md`.

---

## 17. Approval

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
