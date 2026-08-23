# Business Requirements Document — RSS/News Connector: GNews API, Publication-as-Author

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — RSS/News Connector: GNews API, Publication-as-Author |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0026-rss-news-connector-gnews-api-publication-as-author.md, ../Business-Requirements/BRD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0026-rss-news-connector-gnews-api-publication-as-author.md and the business requirements in BRD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md into functional design for **RSS News Connector GNews API Publication As Author**.
**What problem are we solving?**  
The SocialEngage ingestion pipeline has supported the full connector framework, rate-limiting, health, and normalization layers since Phase 0, but the RSS/News platform category — the first category committed in the implementation plan — has never had a real connector. This leaves a gap in the unified listening coverage that the product promises: tenants cannot track general news coverage of topics, companies, or competitors the same way they track social or press-release sources.

**Who is affected?**  
Tenant-Admins who configure sources, Tenant-Users and Social-Selling-Strategists who consume the normalized post feed, and the product's own credibility as a multi-source listening platform.

**What is the proposed solution at a glance?**  
Introduce a GNews API-based RSS/News connector. Each tenant supplies its own free-tier GNews API key; the connector polls GNews's `/api/v4/search` endpoint, normalizes each article into the common `SocialPost` model, and models the article's originating publication as the `Author`. The connector reuses the existing `apiKey` authentication, `poll` delivery, per-tenant credential, and rate-limit patterns already built for the framework.

**What business value do we expect?**  
Closes the oldest unbuilt Phase 1 gap, gives tenants real general-news coverage, proves the `apiKey` authentication mode for the first time, and confirms that the "organization/outlet as Author" pattern introduced for Newswire generalizes to a second connector family.

---

### 2.2 Scope
**In scope:**
- Selecting GNews API (`gnews.io`) as the concrete RSS/News provider.
- Per-tenant GNews API key registration via the existing `POST /connectors/:platformId/connect` flow.
- Polling the GNews `/api/v4/search` endpoint with a per-tenant, non-shared `apikey` query parameter.
- Normalizing returned articles (`id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, `source`) into canonical `SocialPost` rows.
- Modeling the article's `source` publication as the `Author`: `externalAuthorId` from `source.id` or `source.name`, `followerCount` left unpopulated.
- Declaring GNews's native `supportedQueryFeatures` (`AND`/`OR`/`NOT` and phrase search in the `q` parameter) for connector-native watchlist matching where possible.
- Enforcing the free-tier ceiling of 100 requests/day and up to 10 articles/request, per tenant.
- Reusing the existing `RequestGate`, `IngestionRun`, `ConnectorHealth`, and `runIngestionAttempt` pipeline.
- Constraint: use of GNews's free tier is scoped to this project's current non-commercial status as documented in `Business-Case-v6.0.md` §4/§9.

**Out of scope:**
- Commercial or paid-tier GNews usage at v1; this is explicitly a free-tier, non-commercial connector until re-evaluated.
- A second general-news connector or a NewsData.io integration in v1 — kept as a future amendment lead, not rejected.
- Cross-publication duplicate de-duplication strategy — left as an implementation-time decision, same as ADR-0024.
- Exact boolean AST-to-GNews query syntax translation — established as an implementation-time detail under ADR-0021.
- Historical backfill beyond GNews's own 30-day window.
- Generalizing the organization-as-Author exception into ADR-0004's base text — deferred until a third connector requires it (rule of three).
- Push/webhook delivery; GNews does not expose one, so `deliveryMode: 'poll'` is the only v1 mode.

## 3. Context and Background
RSS/News and Reddit were chosen (2026-07-29) as Phase 1's first and second platforms (spec §10). Phase 1's full architectural slice built around that choice — the connector framework (ADR-0002), `Author` (ADR-0004), `IngestionRun` (ADR-0005), per-tenant rate limiting (ADR-0003), error handling and auto-disable (ADR-0010/0023), connector-side watchlist matching (ADR-0006), cursor pagination (ADR-0011), and derived `ConnectorHealth` (ADR-0009) — is built and contract-verified (see `docs/implementation-log.md`). **The actual RSS/News connector implementation was never built, though** — it remained Phase 1's own "also build, not storied" line, and stayed the single oldest unbuilt piece of an otherwise fully-shipped Phase 0–4 even after Story 2.6/ADR-0024 (Newswire, architecturally a *later*, Phase-4 connector) shipped ahead of it as a deliberate, ADR-sanctioned deviation.

Two things need deciding before Story 2.7 can be picked up, the same two questions ADR-0024 had to answer for Newswire:

1. **Which concrete provider.** "RSS/News" in `docs/implementation-plan.md` means general news coverage — distinct in content shape from Newswire's press-release wires — and was already characterized as `poll`-only, **API-key auth**, no paid tier before any real vendor was checked. That characterization needs to actually survive contact with a real vendor's own terms, the same way the original Newswire proposal (RTPR) did not.
2. **How to model the article's "author."** `Author` (ADR-0004) was designed around individual social-platform accounts — `followerCount`, `handle`, `firstSeenAt`/`lastSeenAt` tracking one person's or brand's activity over time. General-news APIs report the **publication** an article came from, not a byline — a person the platform's own data model doesn't return at all, not merely a variant of "author" like Newswire's issuing organization was.
**What problem are we solving?**  
The SocialEngage ingestion pipeline has supported the full connector framework, rate-limiting, health, and normalization layers since Phase 0, but the RSS/News platform category — the first category committed in the implementation plan — has never had a real connector. This leaves a gap in the unified listening coverage that the product promises: tenants cannot track general news coverage of topics, companies, or competitors the same way they track social or press-release sources.

**Who is affected?**  
Tenant-Admins who configure sources, Tenant-Users and Social-Selling-Strategists who consume the normalized post feed, and the product's own credibility as a multi-source listening platform.

**What is the proposed solution at a glance?**  
Introduce a GNews API-based RSS/News connector. Each tenant supplies its own free-tier GNews API key; the connector polls GNews's `/api/v4/search` endpoint, normalizes each article into the common `SocialPost` model, and models the article's originating publication as the `Author`. The connector reuses the existing `apiKey` authentication, `poll` delivery, per-tenant credential, and rate-limit patterns already built for the framework.

**What business value do we expect?**  
Closes the oldest unbuilt Phase 1 gap, gives tenants real general-news coverage, proves the `apiKey` authentication mode for the first time, and confirms that the "organization/outlet as Author" pattern introduced for Newswire generalizes to a second connector family.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the Phase 1 RSS/News connector gap | Story 2.7 is built and the GNews connector passes contract tests against the live ingestion pipeline |
| 2 | Expand tenant coverage to general-news sources | A Tenant-Admin can connect, activate, and view healthy GNews-sourced posts in the same feed as other platforms |
| 3 | Validate the `apiKey` authentication abstraction | GNews becomes the first shipped `authMode: 'apiKey'` connector without introducing a new credential-storage pattern |
| 4 | Prove the publication-as-Author model generalizes beyond Newswire | Two connectors (Newswire, GNews) resolve `Author` to an organization/outlet using the same scoped exception pattern |
| 5 | Maintain compliance with platform provider terms | GNews's free-tier non-commercial constraint is documented, accepted, and re-evaluated before any commercial use |

---

**Positive consequences (from ADR):**
**Positive**
- Closes Phase 1's single oldest unbuilt gap — the "actual RSS/News connector implementation" line that has sat unstoried since Phase 0, even after a later Phase-4 connector (Newswire) shipped ahead of it.
- The first connector in this project to actually exercise `authMode: 'apiKey'` in a real, running build — Newswire proved `'none'`, Reddit (not yet built) will prove OAuth; this is the missing third data point for ADR-0002's "the abstraction generalizes across auth modes" claim.
- A materially richer native query surface (AND/OR/NOT/phrase) than Newswire's minimal/empty declaration gives ADR-0021's capability matrix a genuine second real data point once built, distinct from "everything falls back to whole-query matching."
- Fits the existing per-tenant credential-connect flow and ADR-0014's credential model exactly — no new architectural pattern required for auth or storage.
- Confirms, with a second real instance, that ADR-0024's issuer-as-Author departure generalizes to "the provider reports an organization/outlet, not a person" rather than being a one-off Newswire quirk — closing one of ADR-0024's own named open questions.

**Negative**
- **The free tier is explicitly non-commercial-only per GNews's own FAQ**, a real, accepted constraint that must be revisited before or if this project ever monetizes — not a permanent property of the connector.
- **GNews's own published terms are internally inconsistent** (FAQ vs. Terms of Service) on whether commercial use is permitted at all on the free tier; this ADR adopts the more conservative reading rather than resolving GNews's contradiction, which is a real ambiguity this project does not control.
- **100 requests/day per tenant is a modest ceiling** — enough to prove the pipeline for Phase 1's one-tenant, one-watchlist deliverable, but a real constraint once more than a few watchlists per tenant compete for it; GNews's paid tiers exist to lift this, at a cost this project has not committed to.
- **No push capability and only a 30-day historical window** — a real trade-off, same category as Newswire's no-backfill limitation.
- **Content articles, not literal RSS/XML** — GNews returns JSON, not an RSS/Atom feed; this is a naming clarification worth stating plainly: "RSS/News" in this project's own documents names a *category* (general news, poll, cheap validation), not a literal wire-format requirement, and `normalize()` already has to parse whatever shape a provider returns regardless of source.
- Author-as-publication is scoped to this connector (and Newswire), not stated as ADR-0004's general rule — a future connector with the same shape would still need its own explicit note, per ADR-0024's own precedent of not generalizing this into ADR-0004 directly.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a GNews connector option in the connector catalog. | Must | A distinct `providerId` for GNews is registered and visible to Tenant-Admins. | Product Owner |
| BR-002 | The system shall allow a Tenant-Admin to connect the GNews connector using a per-tenant API key. | Must | `POST /connectors/gnews/connect` accepts and stores a single `apikey` per ADR-0014, without a new credential pattern. | Product Owner |
| BR-003 | The system shall poll GNews `/api/v4/search` and normalize articles into `SocialPost` rows. | Must | A live poll returns real GNews articles; each is normalized with `provider_id`, `url`, `title`, `description`, `content`, `image`, `publishedAt`, `lang`, and `rawPayload`. | Product Owner |
| BR-004 | The system shall model the GNews article source as the `Author`. | Must | `Author.externalAuthorId` is populated from `source.id` (or `source.name` if absent); `followerCount` is left unpopulated. | Product Owner |
| BR-005 | The system shall declare and use GNews's native boolean query capabilities. | Should | `supportedQueryFeatures` lists `AND`, `OR`, `NOT`, and phrase search; watchlist matching uses native `q` fragments where possible and falls back to post-fetch matching otherwise. | Product Owner |
| BR-006 | The system shall stay within the tenant's free-tier GNews quota. | Must | Polling never exceeds 100 requests/day or 10 articles/request for that tenant; `RequestGate` and cadence are configured accordingly. | Product Owner |
| BR-007 | The system shall avoid duplicate `SocialPost` rows when no new articles exist. | Must | A second consecutive poll with no new articles since the last checkpoint is a no-op. | Product Owner |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Target **GNews API** (`gnews.io`, documented at `docs.gnews.io`) as the connector's concrete data source for the RSS/News category. Verified directly 2026-07-31 against GNews's own pages:

- **Pricing** (`gnews.io/pricing`): the free "Essential" plan is €0, requires no credit card ("*Start on the free tier instantly, no credit card needed*"), and returns up to 10 articles per request, 100 requests/day, with a 12-hour publication delay and a 30-day historical window.
- **Auth mechanism** (`docs.gnews.io/endpoints/search-endpoint`): a per-account API key passed as the `apikey` query parameter (`GET https://gnews.io/api/v4/search?q=...&apikey=API_KEY`) — this is a genuine `authMode: 'apiKey'` fit, unlike Newswire's `authMode: 'none'`, and is the first connector in this project to actually exercise that auth mode.
- **Query capability** (`docs.gnews.io/endpoints/search-endpoint`): the mandatory `q` parameter supports `AND`/`OR`/`NOT`, quoted-phrase search, and parenthetical grouping — a materially richer native filtering surface than Newswire's "expected minimal/empty" declaration, and a real opportunity for ADR-0021's boolean-query AST to push a meaningful subset of a watchlist's query down to the provider natively rather than falling back to whole-query post-fetch matching for everything.
- **Response shape** (`docs.gnews.io/json-response`): each article carries `id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, and a nested `source` object (`id`, `name`, `url`, `country`) — **no author or byline field of any kind**. This confirms the second decision below.

**Permitted-use constraint, adopted deliberately rather than glossed over:** GNews's own pricing-page FAQ states, verbatim: *"No, the free subscription cannot be used for commercial projects. The free plan is designed for non-commercial projects, development, and testing purposes only."* This project, per `Business-Case-v6.0.md` §4 and §9, genuinely has no revenue model and is self-funded — the free tier's "non-commercial projects" permission is a real, accurate fit for this project's *current* documented status, not a workaround. **This is adopted as an explicit, accepted operating constraint, not a loophole:** if the project ever monetizes or onboards a paying tenant, this connector's provider/tier needs re-evaluation before that happens — the same "compliance-by-construction... monitor for policy or pricing changes before they cause a failure" discipline `Stakeholder-Register.md` §4 already applies to every other platform provider (S-03). **A genuine internal inconsistency in GNews's own published terms is named here rather than silently resolved in this project's favor:** GNews's own Terms of Service (`gnews.io/legal/terms-of-service`, Section 3.3) states, with no plan-based carve-out, that *"Data retrieved through the API... may be used for commercial purposes, subject to [copyright/attribution] conditions"* — directly in tension with the pricing page's FAQ. This ADR adopts the **more conservative FAQ reading** as the operative constraint (non-commercial use only, on the free tier), consistent with how this project already treats platform-provider terms elsewhere; it does not attempt to resolve GNews's own internal contradiction on its behalf.

**Per-tenant credential, not a shared pool:** each tenant registers their own free GNews API key via the same `POST /connectors/:platformId/connect` flow already storied for every other connector, stored per ADR-0014's existing envelope-encrypted credential model. The 100-requests/day ceiling is therefore per-tenant, not a project-wide shared quota across every tenant this project ever onboards — no new credential-storage pattern is needed.

For this connector, `Author` represents the **source publication**, not an individual — a scoped, documented departure from ADR-0004's per-account assumption, structurally identical to ADR-0024's issuer-as-Author exception for Newswire. This is the **second** connector to need this exact departure, confirming what ADR-0024's own Consequences section anticipated but declined to generalize: *"a future connector with a similar shape... would need to decide whether to reuse this exact pattern or treat each case independently."* This ADR reuses ADR-0024's exact pattern rather than inventing a new one, flagged on ADR-0004 as a second dated Pending-supersession note (see that file), not edited into ADR-0004's original Decision text.

**Implementation defaults (adjustable — logged here in an Amendment Log going forward; does not require superseding this ADR on its own):**

- `authMode: 'apiKey'`, key supplied per-tenant, passed as the `apikey` query parameter.
- `deliveryMode: 'poll'` — GNews has no push/webhook mechanism; consistent with every other Phase 1/4 connector.
- `getRateLimitConfig()`: 100 requests/day, 10 articles/request, per the connected tenant's own free-tier account — a real, published, confirmed ceiling (unlike Newswire's unconfirmed placeholder).
- `supportedQueryFeatures` (ADR-0021): AND/OR/NOT and phrase search within the `q` parameter — the exact translation from the internal boolean AST to GNews's query syntax is an implementation-time task, not fixed by this ADR.
- `Author.externalAuthorId` = `source.id` where present, else `source.name`; `Author.followerCount` left unpopulated as not meaningful for a publication.
- **No historical backfill beyond GNews's own 30-day window** — a watchlist created today can see articles back to 30 days per GNews's stated historical limit, not further; this is a real, published boundary, not an open question.
- Cross-publication duplicate handling (the same wire story picked up and republished by multiple outlets GNews indexes) is an implementation-time decision, named here so it isn't discovered mid-build, the same way ADR-0024 named cross-wire de-duplication for Newswire.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor / Technical Lead / Solo Developer | High | Compliance-safe, low-cost, contract-first delivery that closes the Phase 1 gap |
| Tenant-Admin | Configures connectors and credentials | High | Simple API-key setup, clear capability matrix, health status visible |
| Tenant-User | Consumes the unified post feed | Medium | Sees general-news posts alongside other sources with source clearly labeled |
| Social-Selling-Strategist | Filters posts by source/author for prospecting | Medium | Can identify and export publication-level author lists |
| Platform-Admin | Monitors cross-tenant connector health | Low | Per-tenant quota usage and error rates visible without accessing tenant data |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.7 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant tracking general news coverage of a topic, company, or organization, I want a real `SocialConnector` that polls GNews API's Search endpoint using a... | A registered `SocialConnector` (`authMode: 'apiKey'`, `deliveryMode: 'poll'`, a `providerId` distinct from Newswire's) authenticates using a per-tenant-suppl... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost` | Normalized article with title, description, content, URL, image, publishedAt, language, provider, raw payload | GNews API `/v4/search` | Tenant | Public/third-party content |
| `Author` | Source publication derived from `source.id` or `source.name` | GNews API `source` object | Tenant | Public metadata |
| `IngestionRun` | Audit record of each poll attempt, including success/failure and article count | Connector `poll()` output | System | Operational |
| `ConnectorHealth` | Derived health status for the connector | `IngestionRun` and error classification | System | Operational |
| `platform_credentials` | Envelope-encrypted GNews API key per tenant | Tenant-supplied via connect flow | Tenant (key owner) / system (encrypted envelope) | Credential secret |
| `provider_id` | Distinct GNews connector identifier | Connector registry | System | Operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A GNews connector may only be activated when a valid per-tenant GNews API key has been registered. |
| BRU-002 | The `Author` for a GNews article must always resolve to the source publication, never to an individual journalist. |
| BRU-003 | The free-tier GNews connector is authorized only for non-commercial, self-funded project use; commercial re-evaluation is required before monetization. |
| BRU-004 | The GNews API key must not be pooled or shared across tenants; each tenant uses its own credential. |
| BRU-005 | Historical search is capped at GNews's 30-day window; older backfill is not permitted. |
| BRU-006 | The connector must adopt the more conservative reading of GNews's published terms (FAQ non-commercial clause) where the provider's own documents conflict. |

---

## 9. Interfaces and Integrations
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

- The project remains non-commercial/self-funded and therefore fits GNews's free-tier "non-commercial projects" permission as the operative constraint.
- Each tenant can obtain its own GNews free API key without project-side contracting.
- The existing `Author`, `SocialPost`, `IngestionRun`, and `ConnectorHealth` data models from prior ADRs are available unchanged.
- The connector framework's `poll()` and `RequestGate` abstractions already support `apiKey` authentication mode.

**The durable decision — this is what would need superseding, not just amending:**

Target **GNews API** (`gnews.io`, documented at `docs.gnews.io`) as the connector's concrete data source for the RSS/News category. Verified directly 2026-07-31 against GNews's own pages:

- **Pricing** (`gnews.io/pricing`): the free "Essential" plan is €0, requires no credit card ("*Start on the free tier instantly, no credit card needed*"), and returns up to 10 articles per request, 100 requests/day, with a 12-hour publication delay and a 30-day historical window.
- **Auth mechanism** (`docs.gnews.io/endpoints/search-endpoint`): a per-account API key passed as the `apikey` query parameter (`GET https://gnews.io/api/v4/search?q=...&apikey=API_KEY`) — this is a genuine `authMode: 'apiKey'` fit, unlike Newswire's `authMode: 'none'`, and is the first connector in this project to actually exercise that auth mode.
- **Query capability** (`docs.gnews.io/endpoints/search-endpoint`): the mandatory `q` parameter supports `AND`/`OR`/`NOT`, quoted-phrase search, and parenthetical grouping — a materially richer native filtering surface than Newswire's "expected minimal/empty" declaration, and a real opportunity for ADR-0021's boolean-query AST to push a meaningful subset of a watchlist's query down to the provider natively rather than falling back to whole-query post-fetch matching for everything.
- **Response shape** (`docs.gnews.io/json-response`): each article carries `id`, `title`, `description`, `content`, `url`, `image`, `publishedAt`, `lang`, and a nested `source` object (`id`, `name`, `url`, `country`) — **no author or byline field of any kind**. This confirms the second decision below.

**Permitted-use constraint, adopted deliberately rather than glossed over:** GNews's own pricing-page FAQ states, verbatim: *"No, the free subscription cannot be used for commercial projects. The free plan is designed for non-commercial projects, development, and testing purposes only."* This project, per `Business-Case-v6.0.md` §4 and §9, genuinely has no revenue model and is self-funded — the free tier's "non-commercial projects" permission is a real, accurate fit for this project's *current* documented status, not a workaround. **This is adopted as an explicit, accepted operating constraint, not a loophole:** if the project ever monetizes or onboards a paying tenant, this connector's provider/tier needs re-evaluation before that happens — the same "compliance-by-construction... monitor for policy or pricing changes before they cause a failure" discipline `Stakeholder-Register.md` §4 already applies to every other platform provider (S-03). **A genuine internal inconsistency in GNews's own published terms is named here rather than silently resolved in this project's favor:** GNews's own Terms of Service (`gnews.io/legal/terms-of-service`, Section 3.3) states, with no plan-based carve-out, that *"Data retrieved through the API... may be used for commercial purposes, subject to [copyright/attribution] conditions"* — directly in tension with the pricing page's FAQ. This ADR adopts the **more conservative FAQ reading** as the operative constraint (non-commercial use only, on the free tier), consistent with how this project already treats platform-provider terms elsewhere; it does not attempt to resolve GNews's own internal contradiction on its behalf.

**Per-tenant credential, not a shared pool:** each tenant registers their own free GNews API key via the same `POST /connectors/:platformId/connect` flow already storied for every other connector, stored per ADR-0014's existing envelope-encrypted credential model. The 100-requests/day ceiling is therefore per-tenant, not a project-wide shared quota across every tenant this project ever onboards — no new credential-storage pattern is needed.

For this connector, `Author` represents the **source publication**, not an individual — a scoped, documented departure from ADR-0004's per-account assumption, structurally identical to ADR-0024's issuer-as-Author exception for Newswire. This is the **second** connector to need this exact departure, confirming what ADR-0024's own Consequences section anticipated but declined to generalize: *"a future connector with a similar shape... would need to decide whether to reuse this exact pattern or treat each case independently."* This ADR reuses ADR-0024's exact pattern rather than inventing a new one, flagged on ADR-0004 as a second dated Pending-supersession note (see that file), not edited into ADR-0004's original Decision text.

**Implementation defaults (adjustable — logged here in an Amendment Log going forward; does not require superseding this ADR on its own):**

- `authMode: 'apiKey'`, key supplied per-tenant, passed as the `apikey` query parameter.
- `deliveryMode: 'poll'` — GNews has no push/webhook mechanism; consistent with every other Phase 1/4 connector.
- `getRateLimitConfig()`: 100 requests/day, 10 articles/request, per the connected tenant's own free-tier account — a real, published, confirmed ceiling (unlike Newswire's unconfirmed placeholder).
- `supportedQueryFeatures` (ADR-0021): AND/OR/NOT and phrase search within the `q` parameter — the exact translation from the internal boolean AST to GNews's query syntax is an implementation-time task, not fixed by this ADR.
- `Author.externalAuthorId` = `source.id` where present, else `source.name`; `Author.followerCount` left unpopulated as not meaningful for a publication.
- **No historical backfill beyond GNews's own 30-day window** — a watchlist created today can see articles back to 30 days per GNews's stated historical limit, not further; this is a real, published boundary, not an open question.
- Cross-publication duplicate handling (the same wire story picked up and republished by multiple outlets GNews indexes) is an implementation-time decision, named here so it isn't discovered mid-build, the same way ADR-0024 named cross-wire de-duplication for Newswire.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The GNews connector must reuse the existing `apiKey` authentication and credential-storage patterns. | Maintainability | Must | No new credential table or storage pattern is introduced. |
| NFR-002 | The connector must operate within GNews's stated free-tier terms and document the non-commercial constraint. | Compliance | Must | The connector's `SKILL.md` and contract tests reference the free-tier non-commercial constraint and the FAQ-vs-ToS ambiguity. |
| NFR-003 | Connector polling must respect per-tenant rate limits and degrade gracefully on `429` or quota-exhaustion. | Reliability | Must | Health transitions to `failing` or `degraded` on rate-limit or provider errors; no infinite retry loops. |
| NFR-004 | `Author` and `SocialPost` normalization must be tenant-scoped and RLS-safe. | Security | Must | All contract tests prove RLS isolation for `social_posts` and `authors` rows. |
| NFR-005 | The connector must be removable without affecting other connector implementations. | Maintainability | Should | The registration and no-core-path-edit invariants from ADR-0048/Story 2.10 hold for the new connector. |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes Phase 1's single oldest unbuilt gap — the "actual RSS/News connector implementation" line that has sat unstoried since Phase 0, even after a later Phase-4 connector (Newswire) shipped ahead of it.
- The first connector in this project to actually exercise `authMode: 'apiKey'` in a real, running build — Newswire proved `'none'`, Reddit (not yet built) will prove OAuth; this is the missing third data point for ADR-0002's "the abstraction generalizes across auth modes" claim.
- A materially richer native query surface (AND/OR/NOT/phrase) than Newswire's minimal/empty declaration gives ADR-0021's capability matrix a genuine second real data point once built, distinct from "everything falls back to whole-query matching."
- Fits the existing per-tenant credential-connect flow and ADR-0014's credential model exactly — no new architectural pattern required for auth or storage.
- Confirms, with a second real instance, that ADR-0024's issuer-as-Author departure generalizes to "the provider reports an organization/outlet, not a person" rather than being a one-off Newswire quirk — closing one of ADR-0024's own named open questions.

**Negative**
- **The free tier is explicitly non-commercial-only per GNews's own FAQ**, a real, accepted constraint that must be revisited before or if this project ever monetizes — not a permanent property of the connector.
- **GNews's own published terms are internally inconsistent** (FAQ vs. Terms of Service) on whether commercial use is permitted at all on the free tier; this ADR adopts the more conservative reading rather than resolving GNews's contradiction, which is a real ambiguity this project does not control.
- **100 requests/day per tenant is a modest ceiling** — enough to prove the pipeline for Phase 1's one-tenant, one-watchlist deliverable, but a real constraint once more than a few watchlists per tenant compete for it; GNews's paid tiers exist to lift this, at a cost this project has not committed to.
- **No push capability and only a 30-day historical window** — a real trade-off, same category as Newswire's no-backfill limitation.
- **Content articles, not literal RSS/XML** — GNews returns JSON, not an RSS/Atom feed; this is a naming clarification worth stating plainly: "RSS/News" in this project's own documents names a *category* (general news, poll, cheap validation), not a literal wire-format requirement, and `normalize()` already has to parse whatever shape a provider returns regardless of source.
- Author-as-publication is scoped to this connector (and Newswire), not stated as ADR-0004's general rule — a future connector with the same shape would still need its own explicit note, per ADR-0024's own precedent of not generalizing this into ADR-0004 directly.

## 12. Assumptions and Dependencies
- The project remains non-commercial/self-funded and therefore fits GNews's free-tier "non-commercial projects" permission as the operative constraint.
- Each tenant can obtain its own GNews free API key without project-side contracting.
- The existing `Author`, `SocialPost`, `IngestionRun`, and `ConnectorHealth` data models from prior ADRs are available unchanged.
- The connector framework's `poll()` and `RequestGate` abstractions already support `apiKey` authentication mode.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | GNews changes free-tier pricing, limits, or terms | Medium | High | Monitor provider terms monthly; design connector to re-evaluate on policy/pricing changes; per-tenant key limits blast radius | Technical Lead |
| R-002 | GNews FAQ vs. ToS ambiguity on commercial use creates compliance uncertainty | Medium | High | Adopt conservative FAQ reading; document constraint in BRD/ADR/SKILL; re-evaluate before any monetization | Sponsor |
| R-003 | 100 requests/day per tenant is insufficient for multiple active watchlists | Medium | Medium | Make quota visible in UI; allow future paid-tier or alternate provider (e.g. NewsData.io) upgrade path without re-architecting | Product Owner |
| R-004 | Cross-publication duplicate articles inflate post volume | Medium | Medium | Leave explicit implementation-time de-duplication decision; track duplicates in `IngestionRun` notes | Technical Lead |
| R-005 | Exact AST-to-GNews query translation is complex and may silently degrade matching | Medium | Medium | Declare `supportedQueryFeatures` explicitly; contract test native vs. fallback paths; never silently no-op | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0026-rss-news-connector-gnews-api-publication-as-author.md`
- BRD: `../Business-Requirements/BRD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above