# Business Requirements Document — RSS/News Connector: GNews API, Publication-as-Author

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage RSS/News Connector — GNews API, Publication-as-Author |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | AI Business & Requirements Analyst persona |
| Approver(s) | Menno, Sponsor/Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-07-31 | AI Business & Requirements Analyst persona | Initial draft derived from ADR-0026 |
| 1.0 | 2026-08-22 | AI Business & Requirements Analyst persona | Approved BRD aligned with accepted ADR-0026, Story 2.7, and multi-source ingestion feature design |

---

## 2. Executive Summary

**What problem are we solving?**  
The SocialEngage ingestion pipeline has supported the full connector framework, rate-limiting, health, and normalization layers since Phase 0, but the RSS/News platform category — the first category committed in the implementation plan — has never had a real connector. This leaves a gap in the unified listening coverage that the product promises: tenants cannot track general news coverage of topics, companies, or competitors the same way they track social or press-release sources.

**Who is affected?**  
Tenant-Admins who configure sources, Tenant-Users and Social-Selling-Strategists who consume the normalized post feed, and the product's own credibility as a multi-source listening platform.

**What is the proposed solution at a glance?**  
Introduce a GNews API-based RSS/News connector. Each tenant supplies its own free-tier GNews API key; the connector polls GNews's `/api/v4/search` endpoint, normalizes each article into the common `SocialPost` model, and models the article's originating publication as the `Author`. The connector reuses the existing `apiKey` authentication, `poll` delivery, per-tenant credential, and rate-limit patterns already built for the framework.

**What business value do we expect?**  
Closes the oldest unbuilt Phase 1 gap, gives tenants real general-news coverage, proves the `apiKey` authentication mode for the first time, and confirms that the "organization/outlet as Author" pattern introduced for Newswire generalizes to a second connector family.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the Phase 1 RSS/News connector gap | Story 2.7 is built and the GNews connector passes contract tests against the live ingestion pipeline |
| 2 | Expand tenant coverage to general-news sources | A Tenant-Admin can connect, activate, and view healthy GNews-sourced posts in the same feed as other platforms |
| 3 | Validate the `apiKey` authentication abstraction | GNews becomes the first shipped `authMode: 'apiKey'` connector without introducing a new credential-storage pattern |
| 4 | Prove the publication-as-Author model generalizes beyond Newswire | Two connectors (Newswire, GNews) resolve `Author` to an organization/outlet using the same scoped exception pattern |
| 5 | Maintain compliance with platform provider terms | GNews's free-tier non-commercial constraint is documented, accepted, and re-evaluated before any commercial use |

---

## 4. Scope

### 4.1 In Scope

- Selecting GNews API (`gnews.io`) as the concrete RSS/News provider.
- Per-tenant GNews API key registration via the existing `POST /connectors/:platformId/connect` flow.
- Polling the GNews `/api/v4/search` endpoint with a per-tenant, non-shared `apikey` query parameter.
- Normalizing returned articles (`id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, `source`) into canonical `SocialPost` rows.
- Modeling the article's `source` publication as the `Author`: `externalAuthorId` from `source.id` or `source.name`, `followerCount` left unpopulated.
- Declaring GNews's native `supportedQueryFeatures` (`AND`/`OR`/`NOT` and phrase search in the `q` parameter) for connector-native watchlist matching where possible.
- Enforcing the free-tier ceiling of 100 requests/day and up to 10 articles/request, per tenant.
- Reusing the existing `RequestGate`, `IngestionRun`, `ConnectorHealth`, and `runIngestionAttempt` pipeline.
- Constraint: use of GNews's free tier is scoped to this project's current non-commercial status as documented in `Business-Case-v6.0.md` §4/§9.

### 4.2 Out of Scope

- Commercial or paid-tier GNews usage at v1; this is explicitly a free-tier, non-commercial connector until re-evaluated.
- A second general-news connector or a NewsData.io integration in v1 — kept as a future amendment lead, not rejected.
- Cross-publication duplicate de-duplication strategy — left as an implementation-time decision, same as ADR-0024.
- Exact boolean AST-to-GNews query syntax translation — established as an implementation-time detail under ADR-0021.
- Historical backfill beyond GNews's own 30-day window.
- Generalizing the organization-as-Author exception into ADR-0004's base text — deferred until a third connector requires it (rule of three).
- Push/webhook delivery; GNews does not expose one, so `deliveryMode: 'poll'` is the only v1 mode.

### 4.3 Assumptions

- The project remains non-commercial/self-funded and therefore fits GNews's free-tier "non-commercial projects" permission as the operative constraint.
- Each tenant can obtain its own GNews free API key without project-side contracting.
- The existing `Author`, `SocialPost`, `IngestionRun`, and `ConnectorHealth` data models from prior ADRs are available unchanged.
- The connector framework's `poll()` and `RequestGate` abstractions already support `apiKey` authentication mode.

### 4.4 Constraints

- GNews free tier: 100 requests/day, 10 articles/request, 12-hour publication delay, 30-day historical window, no credit card required.
- GNews's own FAQ prohibits free-tier use for commercial projects; this is a real constraint to monitor before any monetization.
- GNews's Terms of Service and pricing FAQ contain an internal contradiction on commercial use; this BRD and ADR-0026 adopt the more conservative FAQ reading.
- No per-project credential pool; each tenant's key is isolated per ADR-0014.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor / Technical Lead / Solo Developer | High | Compliance-safe, low-cost, contract-first delivery that closes the Phase 1 gap |
| Tenant-Admin | Configures connectors and credentials | High | Simple API-key setup, clear capability matrix, health status visible |
| Tenant-User | Consumes the unified post feed | Medium | Sees general-news posts alongside other sources with source clearly labeled |
| Social-Selling-Strategist | Filters posts by source/author for prospecting | Medium | Can identify and export publication-level author lists |
| Platform-Admin | Monitors cross-tenant connector health | Low | Per-tenant quota usage and error rates visible without accessing tenant data |

---

## 6. Current State (As-Is)

**Current process:**  
The connector framework is fully architected and contract-verified. Newswire (press-release RSS) and other later connectors have already shipped, while the originally planned RSS/News general-news connector has remained unbuilt. Tenants therefore cannot track general-news coverage, even though the category was the first selected for Phase 1.

**Pain points:**
- A visible gap in the platform's source coverage: the implementation plan's first platform category has no real connector.
- The `apiKey` authentication mode has not yet been exercised by a shipped connector.
- The "organization as Author" pattern proven for Newswire has not yet been confirmed to generalize to another source family.
- Tenants cannot include general-news mentions in cross-channel listening.

---

## 7. Future State (To-Be)

**New or improved process:**  
A Tenant-Admin selects the GNews connector from the connector grid, enters a free-tier GNews API key, and activates the connector. The live polling scheduler invokes `gnews-connector.poll()` on a bounded cadence, passes the tenant's `apikey`, receives up to 10 articles per request, normalizes each article into a `SocialPost` with the source publication as `Author`, and writes the posts into the tenant-scoped `social_posts` table. Watchlist matching pushes supported boolean query fragments down to GNews's native `q` parameter and falls back to whole-query matching for unsupported fragments. `IngestionRun` records each poll and `ConnectorHealth` reflects rate-limit or provider error states.

**Expected capabilities:**
- Real general-news articles from GNews appear in the unified post feed.
- The `apiKey` authentication mode is exercised in production.
- The publication-as-Author pattern is reused from Newswire without modifying ADR-0004's original text.
- Connector health and rate-limit saturation are visible to the tenant and platform admin.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a GNews connector option in the connector catalog. | Must | A distinct `providerId` for GNews is registered and visible to Tenant-Admins. | Product Owner |
| BR-002 | The system shall allow a Tenant-Admin to connect the GNews connector using a per-tenant API key. | Must | `POST /connectors/gnews/connect` accepts and stores a single `apikey` per ADR-0014, without a new credential pattern. | Product Owner |
| BR-003 | The system shall poll GNews `/api/v4/search` and normalize articles into `SocialPost` rows. | Must | A live poll returns real GNews articles; each is normalized with `provider_id`, `url`, `title`, `description`, `content`, `image`, `publishedAt`, `lang`, and `rawPayload`. | Product Owner |
| BR-004 | The system shall model the GNews article source as the `Author`. | Must | `Author.externalAuthorId` is populated from `source.id` (or `source.name` if absent); `followerCount` is left unpopulated. | Product Owner |
| BR-005 | The system shall declare and use GNews's native boolean query capabilities. | Should | `supportedQueryFeatures` lists `AND`, `OR`, `NOT`, and phrase search; watchlist matching uses native `q` fragments where possible and falls back to post-fetch matching otherwise. | Product Owner |
| BR-006 | The system shall stay within the tenant's free-tier GNews quota. | Must | Polling never exceeds 100 requests/day or 10 articles/request for that tenant; `RequestGate` and cadence are configured accordingly. | Product Owner |
| BR-007 | The system shall avoid duplicate `SocialPost` rows when no new articles exist. | Must | A second consecutive poll with no new articles since the last checkpoint is a no-op. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The GNews connector must reuse the existing `apiKey` authentication and credential-storage patterns. | Maintainability | Must | No new credential table or storage pattern is introduced. |
| NFR-002 | The connector must operate within GNews's stated free-tier terms and document the non-commercial constraint. | Compliance | Must | The connector's `SKILL.md` and contract tests reference the free-tier non-commercial constraint and the FAQ-vs-ToS ambiguity. |
| NFR-003 | Connector polling must respect per-tenant rate limits and degrade gracefully on `429` or quota-exhaustion. | Reliability | Must | Health transitions to `failing` or `degraded` on rate-limit or provider errors; no infinite retry loops. |
| NFR-004 | `Author` and `SocialPost` normalization must be tenant-scoped and RLS-safe. | Security | Must | All contract tests prove RLS isolation for `social_posts` and `authors` rows. |
| NFR-005 | The connector must be removable without affecting other connector implementations. | Maintainability | Should | The registration and no-core-path-edit invariants from ADR-0048/Story 2.10 hold for the new connector. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A GNews connector may only be activated when a valid per-tenant GNews API key has been registered. |
| BRU-002 | The `Author` for a GNews article must always resolve to the source publication, never to an individual journalist. |
| BRU-003 | The free-tier GNews connector is authorized only for non-commercial, self-funded project use; commercial re-evaluation is required before monetization. |
| BRU-004 | The GNews API key must not be pooled or shared across tenants; each tenant uses its own credential. |
| BRU-005 | Historical search is capped at GNews's 30-day window; older backfill is not permitted. |
| BRU-006 | The connector must adopt the more conservative reading of GNews's published terms (FAQ non-commercial clause) where the provider's own documents conflict. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost` | Normalized article with title, description, content, URL, image, publishedAt, language, provider, raw payload | GNews API `/v4/search` | Tenant | Public/third-party content |
| `Author` | Source publication derived from `source.id` or `source.name` | GNews API `source` object | Tenant | Public metadata |
| `IngestionRun` | Audit record of each poll attempt, including success/failure and article count | Connector `poll()` output | System | Operational |
| `ConnectorHealth` | Derived health status for the connector | `IngestionRun` and error classification | System | Operational |
| `platform_credentials` | Envelope-encrypted GNews API key per tenant | Tenant-supplied via connect flow | Tenant (key owner) / system (encrypted envelope) | Credential secret |
| `provider_id` | Distinct GNews connector identifier | Connector registry | System | Operational |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| GNews poll volume | Track successful polls and articles ingested | Tenant-Admin / Platform-Admin | Per poll, aggregated hourly/daily |
| GNews rate-limit saturation | Monitor how close a tenant is to the 100 requests/day ceiling | Tenant-Admin / Platform-Admin | Real-time and daily |
| Connector health status | Surface `healthy`/`degraded`/`failing` for the GNews connector | Tenant-Admin / Platform-Admin | Real-time |
| GNews API error rate | Track quota, auth, and provider errors | Platform-Admin / Technical Lead | Daily |
| Cross-source post count | Compare GNews article volume against other connectors | Social-Selling-Strategist | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | GNews changes free-tier pricing, limits, or terms | Medium | High | Monitor provider terms monthly; design connector to re-evaluate on policy/pricing changes; per-tenant key limits blast radius | Technical Lead |
| R-002 | GNews FAQ vs. ToS ambiguity on commercial use creates compliance uncertainty | Medium | High | Adopt conservative FAQ reading; document constraint in BRD/ADR/SKILL; re-evaluate before any monetization | Sponsor |
| R-003 | 100 requests/day per tenant is insufficient for multiple active watchlists | Medium | Medium | Make quota visible in UI; allow future paid-tier or alternate provider (e.g. NewsData.io) upgrade path without re-architecting | Product Owner |
| R-004 | Cross-publication duplicate articles inflate post volume | Medium | Medium | Leave explicit implementation-time de-duplication decision; track duplicates in `IngestionRun` notes | Technical Lead |
| R-005 | Exact AST-to-GNews query translation is complex and may silently degrade matching | Medium | Medium | Declare `supportedQueryFeatures` explicitly; contract test native vs. fallback paths; never silently no-op | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Connector framework (`ProviderConnector`/`SocialConnector`, `runIngestionAttempt()`, `registry.ts`) | Internal / Existing | Technical Lead | Already built and contract-verified |
| D-002 | Per-tenant credential storage (ADR-0014) | Internal / Existing | Technical Lead | Already built and verified |
| D-003 | Rate-limit gate (ADR-0003/ADR-0020) | Internal / Existing | Technical Lead | Already built and verified |
| D-004 | Boolean query AST and `supportedQueryFeatures` (ADR-0021) | Internal / Existing | Technical Lead | Already built and verified |
| D-005 | `Author` model (ADR-0004) with scoped organization-as-Author exception | Internal / Existing | Technical Lead | Already built for Newswire; reused for GNews |
| D-006 | GNews free-tier API availability and terms | External | GNews / Tenant | Accepted as operative constraint at ADR-0026 acceptance |
| D-007 | Story 2.7 implementation and contract tests | Internal | Technical Lead / Solo Developer | Ready per ADR-0026; to be picked up after BRD acceptance |

---

## 14. Acceptance Criteria

- A GNews connector can be registered with a unique `providerId`, distinct from Newswire's.
- A Tenant-Admin can connect and activate the GNews connector using a per-tenant GNews API key.
- A live poll against GNews returns real articles and writes normalized `SocialPost` rows with correct tenant scoping.
- Each normalized article's `Author` resolves to the source publication, with `externalAuthorId` from `source.id` or `source.name`.
- Polling respects the 100 requests/day and 10 articles/request free-tier ceiling and produces a correct no-op on repeated empty polls.
- `supportedQueryFeatures` accurately reflects GNews's `AND`/`OR`/`NOT`/phrase support.
- Connector health, `IngestionRun`, and rate-limit behavior follow the existing framework patterns.
- The free-tier non-commercial constraint is documented and does not conflict with commercial use until re-evaluated.

---

## 15. Glossary

| Term | Definition |
|---|---|
| GNews | `gnews.io`, a general-news API providing article search with a free, API-key-authenticated tier. |
| `Author` | The normalized representation of a content originator; for GNews, the source publication, not an individual. |
| `externalAuthorId` | The connector-specific identifier for an `Author`; for GNews, drawn from `source.id` or `source.name`. |
| `SocialPost` | The canonical, normalized post record into which all connector content is ingested. |
| `supportedQueryFeatures` | The connector capability declaration of which boolean AST operations can be pushed to the provider's native query language. |
| `poll` | A connector delivery mode in which the system periodically fetches new content from the provider. |
| `apiKey` | An authentication mode in which a per-tenant secret is passed as a query parameter. |
| `providerId` | The unique identifier for a connector registration in the SocialEngage connector registry. |
| `IngestionRun` | The audit record of a single connector poll attempt, success/failure, and article count. |
| `ConnectorHealth` | The derived health status of a connector, based on recent `IngestionRun` results and errors. |
| Non-commercial free tier | GNews's free plan, permitted per its pricing FAQ only for non-commercial projects, development, and testing. |

---

## 16. Appendices

### A. Reference Documents

- ADR-0026: `docs/adr/0026-rss-news-connector-gnews-api-publication-as-author.md` — accepted 2026-07-31; source of the provider selection, publication-as-Author modeling, and operating constraints.
- Feature Design — Multi-source ingestion: `docs/product-research/feature-designs/01-multi-source-ingestion.md` — provides the broader connector framework, data flow, and persona context.
- User Story — Story 2.7: `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — implementation story for the GNews RSS/News connector.

### B. Missing / Deferred Sources

- No dedicated `docs/product-research/reports/<feature>-deep-research.md` was found for GNews. Vendor pricing, terms, and capability verification are embedded directly in ADR-0026's Amendment Log and Consequences sections, which were primary-source verified against `gnews.io` pages on 2026-07-31.
- Cross-publication duplicate strategy, exact AST-to-GNews query translation, and NewsData.io as a future alternative are explicitly left as implementation-time or future-amendment decisions per ADR-0026.

### C. Related ADRs

- ADR-0002 — Connector framework and `SocialConnector`/`ProviderConnector` abstractions
- ADR-0003 — Per-tenant rate limiting
- ADR-0004 — `Author` model and the scoped organization-as-Author exception
- ADR-0005 — `IngestionRun` audit anchor
- ADR-0010/0023 — Error handling and auto-disable
- ADR-0011 — Cursor pagination
- ADR-0014 — Envelope-encrypted credential model
- ADR-0020 — Distributed rate-limit gate (deferred until multi-instance)
- ADR-0021 — Boolean query AST and `supportedQueryFeatures`
- ADR-0024 — Newswire connector (issuer-as-Author precedent)
- ADR-0027 — Connector as technical intermediary, never a contracting party (confirmed GNews already satisfies this)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno |  | 2026-07-31 |
| Product Owner | Menno |  | 2026-07-31 |
| Technical Lead | Menno |  | 2026-07-31 |
| Other Stakeholder | — |  |  |
