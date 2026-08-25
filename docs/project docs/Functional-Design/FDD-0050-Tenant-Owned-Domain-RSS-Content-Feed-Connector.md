# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0050 Tenant Owned Domain RSS Content Feed Connector — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0050-tenant-owned-domain-rss-content-feed-connector.md, ../Business-Requirements/BRD-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0050-tenant-owned-domain-rss-content-feed-connector.md and the business requirements in BRD-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md into functional design for **Tenant Owned Domain RSS Content Feed Connector**.
**What problem are we solving?** SocialEngage's ingestion connectors to date (Newswire, GNews, Wikipedia) all pull from third-party sources the tenant does not own. Tenants who want to monitor their own corporate blog, newsroom, or owned publication have no supported connector, and there is no mechanism to prove that the tenant actually controls the domain they claim to monitor.

**Who is affected?** Tenant-Admins who configure connectors, Tenant-Users who consume the post feed, brand/PR teams tracking owned-channel coverage, and Platform-Admins observing cross-tenant connector adoption.

**What is the proposed solution at a glance?** Introduce a distinct `tenant-owned-feed` connector that lets a Tenant-Admin supply a domain and explicit RSS/Atom feed URL, then prove domain ownership by publishing a DNS TXT record at `_socialengage-verify.<domain>`. Only after verification succeeds does SocialEngage begin polling the feed. The `Author` for every ingested post is the verified domain/organization, with optional per-feed display names and per-item bylines surfaced only as display data.

**What business value do we expect?** Closes a high-trust, on-brand content gap with no new vendor credential burden; provides a self-service, cryptographically grounded ownership gate that mirrors Google Workspace and Microsoft 365 domain verification; and resolves the accumulated "rule of three" exception for organization-as-Author modeling by formalizing it in ADR-0004.

---

### 2.2 Scope
**In scope:**
- A distinct `tenant-owned-feed` connector (`providerId` `tenant-owned-feed` or equivalent), separate from Newswire and GNews.
- RSS 2.0 and Atom feed parsing and polling.
- DNS TXT record domain-ownership verification before polling begins.
- Explicit, tenant-supplied feed URL at v1.
- Verification state machine: `pending`, `verified`, `expired`, and `removed`.
- Organization-as-Author modeling: `Author.externalAuthorId` equals the verified domain.
- Tenant-Admin connector setup UI: domain/feed URL input, TXT record instructions, and a "Verify now" control.
- Tenant-wide connector activation/deactivation control.
- Multi-feed administration: list, add, edit `feedUrl`, soft-remove, and add a second feed under an already-verified domain.
- Optional per-feed display `name` and per-item byline extraction from the feed (`dc:creator`, `<author>`, or Atom `<author><name>`), both display-only.
- Respectful polling: self-identifying `User-Agent`, 30-minute default cadence, honoring the feed's own `<ttl>` hint when larger.
- No historical backfill: only items seen after polling starts are ingested.

**Out of scope:**
- RSS autodiscovery from a homepage HTML `<link rel="alternate">` tag (deferred to v1+).
- Historical ingestion of feed items published before the connector begins polling.
- Replacing organization-as-Author with individual-as-Author in the normalized `Author` entity.
- Surfacing or enforcing third-party CMS hosting-platform terms (e.g., WordPress.com, Squarespace, HubSpot).
- Platform-Admin cross-tenant feed visibility (candidate for a future, separate ADR).
- A hard ceiling on the number of feeds per tenant at v1.
- Scheduled cleanup of stale `pending` or `removed` rows (named future work).

## 3. Context and Background
See ADR Context.
**What problem are we solving?** SocialEngage's ingestion connectors to date (Newswire, GNews, Wikipedia) all pull from third-party sources the tenant does not own. Tenants who want to monitor their own corporate blog, newsroom, or owned publication have no supported connector, and there is no mechanism to prove that the tenant actually controls the domain they claim to monitor.

**Who is affected?** Tenant-Admins who configure connectors, Tenant-Users who consume the post feed, brand/PR teams tracking owned-channel coverage, and Platform-Admins observing cross-tenant connector adoption.

**What is the proposed solution at a glance?** Introduce a distinct `tenant-owned-feed` connector that lets a Tenant-Admin supply a domain and explicit RSS/Atom feed URL, then prove domain ownership by publishing a DNS TXT record at `_socialengage-verify.<domain>`. Only after verification succeeds does SocialEngage begin polling the feed. The `Author` for every ingested post is the verified domain/organization, with optional per-feed display names and per-item bylines surfaced only as display data.

**What business value do we expect?** Closes a high-trust, on-brand content gap with no new vendor credential burden; provides a self-service, cryptographically grounded ownership gate that mirrors Google Workspace and Microsoft 365 domain verification; and resolves the accumulated "rule of three" exception for organization-as-Author modeling by formalizing it in ADR-0004.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenants to monitor their own corporate blogs, newsrooms, and owned content feeds | A `tenant-owned-feed` connector is active and producing `SocialPost` rows for configured feeds |
| 2 | Ensure only the DNS-proven domain owner can configure monitoring of that domain | No feed is polled while verification status is `pending` or `expired`; every active feed has a matching, successful DNS TXT proof |
| 3 | Avoid any new vendor credential or secret-management infrastructure | No API key, OAuth grant, or vendor account is stored or required for this connector |
| 4 | Generalize organization-as-Author modeling to reduce future per-connector exception debt | ADR-0004 carries a durable, forward-pointer "organization-as-Author" clause cited by this and prior connectors |
| 5 | Support administration of multiple owned feeds per tenant | Tenant-Admin can add, list, rename, edit feed URL, and soft-remove feeds from a single screen |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a meaningful, named content gap: tenants who want to monitor their own corporate blog or newsroom — the most on-brand, highest-trust content source for a social listening platform — have had no connector to do so. This is the first connector where the tenant is both the operator and the content publisher.
- DNS TXT verification provides a real, cryptographically grounded proof of domain control — not a workaround or honor system — while remaining free and self-service. The tenant needs DNS access to configure it, which is a correct and appropriate gate: an IT admin misconfiguring a corporate-domain feed connector on behalf of someone who doesn't control the domain is the exact risk being avoided.
- Using the same mechanism as Google Workspace and Microsoft 365 domain verification means the tenant's IT team is almost certainly already familiar with the process — it is well-documented, widely practiced, and tooled across all major DNS registrars (GoDaddy, Cloudflare, Namecheap, etc.).
- The `authMode: 'none'` model (no vendor credential required) avoids the need for any new credential-management infrastructure — nothing new to store, encrypt, or rotate. Simpler than GNews's API-key connector, and appropriate for a source the tenant owns.
- Resolves the "rule of three" question ADR-0026 explicitly deferred: with three connectors now needing organization-as-Author modeling, ADR-0004 gains a permanent forward-pointer clause rather than accumulating a fourth one-off note. Future connectors have a stable reference.
- The explicit, tenant-supplied feed URL (v1) is operationally simpler than autodiscovery: no HTML-fetch failures to handle, no ambiguity about which autodiscovery link to prefer when multiple exist, and no dependency on the tenant's homepage serving valid HTML.

**Negative**
- **DNS propagation delay is a real UX cost.** After the tenant publishes the TXT record, they may wait up to 72 hours before SocialEngage can confirm it. There is nothing SocialEngage can do to reduce this delay — it is inherent to DNS. The Admin UI must communicate this plainly (not as an error), and the pending-verification state must be clearly surfaced. This is the same delay Google Workspace and Microsoft 365 accept for domain verification; it is accepted here for the same reasons, but it is a real friction point for tenant admins used to instant-configuration connectors.
- **Verification adds a new state machine** (pending/verified/expired/failed) that the connector activation flow doesn't currently have — every other connector either connects immediately (Newswire, GNews) or fails immediately (OAuth callback error). The pending-verification state needs its own UI treatment, re-check flow, and expiry handling — more operational complexity than prior connectors.
- **No historical lookback** — the same limitation as Newswire. A new corporate blog connector will see content from the polling-start date forward only; items already published before the connector was set up are not available unless a separate backfill mechanism is built. Named here so it isn't discovered as a surprise at implementation.
- **TXT record prefix/subdomain scoping is non-obvious** when the feed URL is at a subdomain (`blog.example.com`) but the tenant expects to publish the record at the apex (`example.com`). The exact scoping rule (verify at the feed domain's level, or at the apex?) must be decided at implementation time and communicated clearly in the Admin UI.
- **Feed URL must be explicitly supplied.** A tenant who doesn't know their blog's feed URL — common for non-technical admins — may have friction finding it. Most CMS platforms publish feed URLs at well-known paths and document them; autodiscovery would remove this friction but is deferred to v1+.
- **Author modeling is organizational, not individual.** For tenants who want to attribute content to specific named authors (e.g., track which employees are publishing on the company blog), this connector — like Newswire and GNews — provides no individual-author identity. The `<author>` element in RSS 2.0 is an email address field, not a display name, and is routinely omitted in corporate CMS output (verified from the RSS 2.0 spec, fetched 2026-08-10). Supporting per-item author identity from RSS feeds would require either a CMS-specific API integration (out of this ADR's scope) or a separate Author-identity-resolution ADR.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a distinct tenant-owned feed connector, separate from Newswire and GNews | Must | `providerId` is unique and registered without core ingestion orchestration changes | Product Owner |
| BR-002 | The system shall require successful DNS TXT domain verification before any feed URL is polled | Must | Polling only begins when verification status is `verified` | Product Owner |
| BR-003 | The system shall accept an explicit, tenant-supplied RSS/Atom feed URL at v1 | Must | `feedUrl` is required at connect; no HTML autodiscovery is performed | Product Owner |
| BR-004 | The system shall generate a unique verification token and present copyable TXT record instructions | Must | Response includes `txtRecordHost`, `txtRecordValue`, and `expiresAt` | Product Owner |
| BR-005 | The system shall allow the tenant to re-check DNS verification manually and report `pending`/`verified` clearly | Must | "Verify now" returns either `verified` or a retryable `pending` state, not a hard error | Product Owner |
| BR-006 | The system shall support multi-feed administration per tenant: add, list, edit `feedUrl`, and soft-remove | Must | `tenant_admin` can manage multiple feeds and see `pending`/`verified`/`expired`/`removed` rows | Product Owner |
| BR-007 | The system shall explain DNS propagation delay (minutes to 72 hours) in the setup UI | Must | Copy is plain-language and never framed as an error or stuck state | Product Owner |
| BR-008 | The system shall model `Author` as the verified organization/domain, not an individual | Must | `Author.externalAuthorId` equals the verified domain for every ingested post | Product Owner |
| BR-009 | The system shall allow an optional per-feed display `name` and surface a per-item byline when the feed provides one | Should | `name` is optional/nullable; byline is extracted from `dc:creator`, `<author>`, or Atom `<author><name>` where present | Product Owner |
| BR-010 | The system shall poll tenant-owned feeds with a self-identifying `User-Agent` and a conservative cadence | Must | Every fetch sets a non-generic `User-Agent`; default poll interval is conservative and can respect `<ttl>` | Product Owner |
| BR-011 | The system shall not ingest feed items published before the connector begins polling | Must | Only items observed after the first verified poll produce `SocialPost` rows | Product Owner |
| BR-012 | The system shall allow the verified content domain to differ from the tenant's email domain | Must | A tenant can verify `blog.acme.com` or an entirely separate domain from `tenants.domain` | Product Owner |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Build a new connector for tenant-owned-domain RSS/content-feed monitoring, with the following durable characteristics:

**1. Connector identity and mechanism.** A distinct connector (`providerId` `tenant-owned-feed`, or similar — exact identifier is an implementation default in the Amendment Log), separate from the Newswire and RSS/News connectors, because the trust model and activation flow differ materially even though the underlying polling mechanism is the same. The connector uses `deliveryMode: 'poll'` — tenant-owned RSS feeds offer no push/webhook model; polling is the only available mechanism, the same as every other connector in this series to date.

**2. `authMode: 'none'` — no vendor credential.** Consistent with ADR-0027: SocialEngage fetches the tenant's own public feed URL directly. No API key, no OAuth grant, no vendor account is required or appropriate — there is no vendor for SocialEngage to authenticate against. The connecting party is the tenant themselves; the feed they configure is their own property. **This distinguishes this connector from GNews (`authMode: 'apiKey'`) and from future social-platform connectors (OAuth), while matching Newswire's own `authMode: 'none'` precedent — though the absence-of-credential rationale differs: Newswire's auth is absent because the third-party feeds are genuinely public; this connector's auth is absent because the tenant is the content owner.**

**3. DNS TXT domain ownership gate — durable requirement, not a default.** A tenant cannot begin polling a feed URL until SocialEngage has verified, via a DNS TXT record challenge, that the tenant controls the domain of the feed URL they are configuring. This is the durable policy decision: DNS TXT verification is required, not optional and not deferrable to a future amendment. The specific implementation details (record prefix, token format, TTL, re-check cadence) are implementation defaults in the Amendment Log.

The verification flow, following the same protocol Google Workspace and Microsoft 365 use for domain ownership verification (both verified from primary sources, fetched 2026-08-10):

```
Tenant Admin → SocialEngage Admin UI: Configure own-domain feed (supply domain + feed URL)
SocialEngage Admin UI → Core API: POST /connectors/tenant-owned-feed/connect { domain, feedUrl }
Core API → Core API: Generate a unique verification token; construct TXT record instructions
Core API → Admin UI: 200 { txtRecordHost: "_socialengage-verify.example.com", txtRecordValue: "socialengage-verify=<TOKEN>", expiresAt, feedUrl }
Admin UI → Tenant Admin: "Publish this TXT record at your DNS registrar, then return here to verify"
[Tenant Admin publishes TXT record at registrar — propagation: minutes to 72 hours]
Tenant Admin → Admin UI: "I've published the record — verify now"
Admin UI → Core API: POST /connectors/tenant-owned-feed/verify-domain { connectorActivationId }
Core API → DNS: Lookup TXT records at _socialengage-verify.<domain>
  if TXT record matches token → mark domain verified; enable polling of feedUrl
  if TXT record missing or wrong → return { status: 'pending', retryAfter: <interval> }
```

The exact TXT record host prefix (`_socialengage-verify`) is an implementation default — see Amendment Log. The underscore prefix and subdomain placement (rather than at the domain apex) follows the industry practice established by GitHub, Stripe, and similar services: it keeps the verification record isolated from the apex zone, avoids conflicts with existing apex TXT records (e.g., SPF), and is explicitly recognized by DNS registrars as a "service verification" subdomain pattern.

**4. Author modeling — organization-as-Author, and the "rule of three" resolution.** For this connector, `Author` represents the tenant's own publication or organization, not an individual — the same organization-as-Author departure from ADR-0004 that ADR-0024 (Newswire) and ADR-0026 (GNews) each documented as scoped, per-connector exceptions. **This is the third connector requiring the identical departure**, which is exactly the "rule of three" threshold ADR-0026 flagged as the trigger to revisit whether ADR-0004 should carry a permanent, generalized "organization-as-Author" clause rather than accumulating further per-connector notes.

This ADR decides that question: **ADR-0004 should now carry a permanent, generalized "organization-as-Author" forward-pointer clause** — one that names the established pattern, acknowledges that three connectors have needed it, and provides a standing reference for future connectors with the same shape. This does not change ADR-0004's Decision text (which the series' own convention prohibits). It is added as a dated Supersession update note on ADR-0004, referencing this ADR, ADR-0024, and ADR-0026 as the three instances that established the pattern. Future connectors where "author" means an organization, publication, or domain may cite ADR-0004's standing clause rather than each adding their own one-off note.

Concretely for this connector: `Author.externalAuthorId` = the verified domain (e.g., `example.com`), not the feed URL — the domain is the stable, DNS-verified identifier of the publication. `Author.followerCount` is left unpopulated, consistent with ADR-0024/0026/0042.

**5. Connector domain need not match `tenants.domain` from ADR-0031.** The tenant's email domain captured at sign-up (`tenants.domain`, per ADR-0031's tenants table) identifies the organization's email domain, not necessarily the domain of its content publication. A tenant at `acme.com` may run their blog at `blog.acme.com` or even at a separate domain. The DNS TXT verification is the trust mechanism — if the tenant can publish a TXT record proving they control a domain, they may configure that domain's feed regardless of whether it matches `tenants.domain`. A tenant may verify and configure multiple domains (e.g., `blog.acme.com` and `newsroom.acme.com`), each with its own verification state.

**Implementation defaults (adjustable via Amendment Log; does not require superseding this ADR):**

- **TXT record host prefix:** `_socialengage-verify.<domain>` (e.g., for `blog.example.com`, the record is published at `_socialengage-verify.blog.example.com`). Alternative: at the apex domain (`_socialengage-verify.example.com`) when the feed URL is a subdomain — the exact scoping rule (which domain level gets the TXT record) is an implementation-time decision.
- **Token format:** a cryptographically random, URL-safe string, long enough to be non-guessable (e.g., 32+ characters). Exact format is implementation-time.
- **Token TTL:** 7 days. A verification challenge expires if the tenant hasn't successfully verified within this window; they must restart the flow. Revisit if operationally too short.
- **DNS re-check cadence after tenant initiates verification:** poll at 1-minute intervals for the first 5 minutes, then back off to every 15 minutes. DNS propagation is outside the tenant's control once the record is published; aggressive initial polling catches fast-propagating registrars without hammering DNS for the slow-propagating majority.
- **Feed poll interval:** 30 minutes (conservative default; no published rate limit exists for a tenant's own feed). Respect the feed's own `<ttl>` element if present and if its value is greater than the default interval, per the RSS 2.0 spec's intent.
- **v1 feed URL: explicit, tenant-supplied.** Tenant provides the direct feed URL (e.g., `https://blog.example.com/feed`) at connector configuration time. Optional autodiscovery — fetching the domain's homepage and parsing `<link rel="alternate" type="application/rss+xml">` — is a future extension, not v1 scope. Rationale: explicit URL is unambiguous, immune to HTML-rendering failures, and puts no requirement on the tenant's homepage to implement autodiscovery. Common feed paths (`/feed`, `/rss`, `/feed.xml`) may be tried as a fallback if autodiscovery is later added; this ADR leaves that open.
- **`supportedQueryFeatures` (ADR-0021):** empty/none at v1. RSS feed content is fetched in full per item; keyword/boolean filtering falls back to whole-query post-fetch matching, same as Newswire. This connector's `normalize()` output feeds ADR-0021's standard capability matrix without change.
- **`getRateLimitConfig():** conservative fixed-window default (e.g., one poll per feed URL per 30 minutes). No published rate limit exists for a publicly accessible RSS feed. As with Newswire, the default is conservative-by-design and revisable.
- **`User-Agent` header:** SocialEngage must identify itself in the `User-Agent` header on every fetch of the tenant's own feed, per the same respectful-polling discipline ADR-0024 established when it noted the SEC EDGAR `User-Agent` lesson. Even though the tenant has authorized monitoring, well-behaved HTTP clients self-identify.
- **No historical backfill.** RSS feeds carry only recent items (typically the last 10–25 items the CMS has published). Items published before the connector begins polling are not available through the feed and are not retroactively ingested — same limitation as ADR-0024. If a tenant needs historical content, a separate, future, purpose-built mechanism would be required; this ADR does not anticipate or scope it.
- **Verification state storage:** a per-`(tenantId, connectorActivationId)` record tracking domain, feed URL, verification token, token expiry, and verified/pending/expired status. Exact table shape is an implementation-time decision for the Story that picks this up.

---

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary configurer of the tenant-owned feed | High | A self-service, trustworthy setup flow with clear DNS instructions and propagation expectations |
| Tenant-User | Consumer of ingested posts | Medium | Can see owned-channel posts, bylines, and provider badges in the post feed |
| Sole-Operator / Social-Selling-Strategist | Monitors volume and filters by source | Medium | Can distinguish tenant-owned content from third-party content and understand source health |
| DNS / IT Administrator | Publishes the required TXT record at the registrar | High | Clear, copyable TXT record host and value with no ambiguity about subdomain vs. apex placement |
| Platform-Admin | Cross-tenant adoption and health observer | Low | Can see that the connector exists and is registered without accessing tenant feed data |
| Product Owner (Menno) | Sponsor and decision owner | High | A durable, generalized Author model and no core-path coupling for new connectors |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.11 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant wanting to monitor my own company's blog or newsroom feed, I want a connector that polls my own domain's RSS/Atom feed only after I've proven — via... | A registered `SocialConnector` (`providerId` `tenant-owned-feed` or equivalent distinct identifier, `authMode: 'none'`, `deliveryMode: 'poll'`, per ADR-0050 ... |
| Story 2.19 | epic-2-ingestion-connectors-and-rate-limits.md | As tenant with more than one connected feed (Story 6.20/ADR-0057's own multi-feed support), I want to give each feed my own chosen name, and have each ingest... | `tenant_owned_feed_activations` gains an optional, nullable `name` column (`migrations/0037`) — never required, never defaulted; unset renders as `domain` in... |
| Story 6.12 | epic-6-tenant-admin-ui.md | As tenant wanting to monitor my own company's blog or newsroom feed, I want a setup flow that walks me through proving domain ownership and then activates po... | A dedicated connect flow (a new screen or a clearly distinct section of the connectors screen — not shoehorned into Story 6.3's existing single-credential `C... |
| Story 6.20 | epic-6-tenant-admin-ui.md | As Tenant-Admin who wants to monitor more than one of my own domains/feeds, I want to see, add, edit, and remove every feed I've configured, not just the one... | `GET /v1/connectors/tenant-owned-feed/activations` (new, `tenant_admin` only) lists every activation for the caller's tenant regardless of status (`pending`/... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_owned_feed_activations` | Per-tenant, per-feed verification and configuration record (domain, feedUrl, name, verification token, expiry, status, verifiedAt) | Created by tenant-owned feed connector | Core backend | Medium |
| `connector_activations.is_active` | Tenant-wide on/off switch for the `tenant-owned-feed` connector, independent of per-feed verification | `connector_activations` table (ADR-0051) | Core backend | Medium |
| `social_posts` | Ingested feed items with `provider_id`, `rawPayload` (including optional `feedName` and per-item `author` byline), `body_markdown` | Derived from RSS/Atom items by connector | Core backend | Medium |
| `authors` | Normalized `Author` row keyed to the verified domain as `externalAuthorId` | Derived at normalization | Core backend | Low |
| DNS TXT record | `_socialengage-verify.<domain>` TXT value containing the SocialEngage token | Tenant's DNS zone | Tenant / DNS admin | Medium |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A tenant-owned feed may not be polled until the domain's DNS TXT verification status is `verified`. |
| BRU-002 | Domain ownership is proven by a TXT record at `_socialengage-verify.<domain>` whose value matches the SocialEngage-generated token. |
| BRU-003 | A verification token is valid only for a bounded TTL; expired activations must be removed and the flow restarted. |
| BRU-004 | The `Author` for every post from a tenant-owned feed is the verified domain, not the feed URL or any individual byline. |
| BRU-005 | The verified content domain need not match the tenant's sign-up email domain (`tenants.domain`). |
| BRU-006 | Connecting, verifying, listing, editing, and removing tenant-owned feeds are `tenant_admin`-only actions. |
| BRU-007 | A second feed URL under an already-verified domain is auto-verified server-side without a new DNS TXT record. |
| BRU-008 | A tenant may edit `feedUrl` in place, but changing `domain` requires removing the existing activation and creating a new one. |
| BRU-009 | Removing a feed is a soft transition to `removed` status; previously ingested `SocialPost` and `Author` rows are preserved. |
| BRU-010 | Historical feed items published before the connector's first poll are never retroactively ingested. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0004 – Author normalized separately from post, including organization-as-Author clause | Internal / ADR | Menno | Accepted |
| D-002 | ADR-0027 – Connector is a technical intermediary, not a contracting party | Internal / ADR | Menno | Accepted |
| D-003 | ADR-0048 – Connector registration transparency (no core-path edits) | Internal / ADR | Menno | Accepted |
| D-004 | ADR-0051 – Connector activation/deactivation decoupled from credential | Internal / ADR | Menno | Accepted |
| D-005 | ADR-0057 – Multi-feed administration for tenant-owned feed | Internal / ADR | Menno | Accepted |
| D-006 | Provider-connector framework (`ProviderConnector`, `SocialConnector`, `registry.ts`) | Internal / Code | Core team | Existing |
| D-007 | Tenant's DNS registrar and public feed hosting | External / Tenant | Tenant / IT | At setup time |
| D-008 | ADR-0050 2026-08-20 Amendment Log – per-feed `name` and per-item byline extraction | Internal / ADR | Menno | Accepted |

---

- The Tenant-Admin configuring the connector has access to publish DNS records for the claimed domain.
- The feed is publicly reachable over HTTPS and returns valid RSS 2.0 or Atom XML.
- DNS propagation after a TXT record is published can take from minutes to 72 hours, which is acceptable because this is an optional, post-sign-up connector (not the product entry gate).
- The tenant understands how to obtain the direct feed URL; v1 does not autodiscover it.

**The durable decision — this is what would need superseding, not just amending:**

Build a new connector for tenant-owned-domain RSS/content-feed monitoring, with the following durable characteristics:

**1. Connector identity and mechanism.** A distinct connector (`providerId` `tenant-owned-feed`, or similar — exact identifier is an implementation default in the Amendment Log), separate from the Newswire and RSS/News connectors, because the trust model and activation flow differ materially even though the underlying polling mechanism is the same. The connector uses `deliveryMode: 'poll'` — tenant-owned RSS feeds offer no push/webhook model; polling is the only available mechanism, the same as every other connector in this series to date.

**2. `authMode: 'none'` — no vendor credential.** Consistent with ADR-0027: SocialEngage fetches the tenant's own public feed URL directly. No API key, no OAuth grant, no vendor account is required or appropriate — there is no vendor for SocialEngage to authenticate against. The connecting party is the tenant themselves; the feed they configure is their own property. **This distinguishes this connector from GNews (`authMode: 'apiKey'`) and from future social-platform connectors (OAuth), while matching Newswire's own `authMode: 'none'` precedent — though the absence-of-credential rationale differs: Newswire's auth is absent because the third-party feeds are genuinely public; this connector's auth is absent because the tenant is the content owner.**

**3. DNS TXT domain ownership gate — durable requirement, not a default.** A tenant cannot begin polling a feed URL until SocialEngage has verified, via a DNS TXT record challenge, that the tenant controls the domain of the feed URL they are configuring. This is the durable policy decision: DNS TXT verification is required, not optional and not deferrable to a future amendment. The specific implementation details (record prefix, token format, TTL, re-check cadence) are implementation defaults in the Amendment Log.

The verification flow, following the same protocol Google Workspace and Microsoft 365 use for domain ownership verification (both verified from primary sources, fetched 2026-08-10):

```
Tenant Admin → SocialEngage Admin UI: Configure own-domain feed (supply domain + feed URL)
SocialEngage Admin UI → Core API: POST /connectors/tenant-owned-feed/connect { domain, feedUrl }
Core API → Core API: Generate a unique verification token; construct TXT record instructions
Core API → Admin UI: 200 { txtRecordHost: "_socialengage-verify.example.com", txtRecordValue: "socialengage-verify=<TOKEN>", expiresAt, feedUrl }
Admin UI → Tenant Admin: "Publish this TXT record at your DNS registrar, then return here to verify"
[Tenant Admin publishes TXT record at registrar — propagation: minutes to 72 hours]
Tenant Admin → Admin UI: "I've published the record — verify now"
Admin UI → Core API: POST /connectors/tenant-owned-feed/verify-domain { connectorActivationId }
Core API → DNS: Lookup TXT records at _socialengage-verify.<domain>
  if TXT record matches token → mark domain verified; enable polling of feedUrl
  if TXT record missing or wrong → return { status: 'pending', retryAfter: <interval> }
```

The exact TXT record host prefix (`_socialengage-verify`) is an implementation default — see Amendment Log. The underscore prefix and subdomain placement (rather than at the domain apex) follows the industry practice established by GitHub, Stripe, and similar services: it keeps the verification record isolated from the apex zone, avoids conflicts with existing apex TXT records (e.g., SPF), and is explicitly recognized by DNS registrars as a "service verification" subdomain pattern.

**4. Author modeling — organization-as-Author, and the "rule of three" resolution.** For this connector, `Author` represents the tenant's own publication or organization, not an individual — the same organization-as-Author departure from ADR-0004 that ADR-0024 (Newswire) and ADR-0026 (GNews) each documented as scoped, per-connector exceptions. **This is the third connector requiring the identical departure**, which is exactly the "rule of three" threshold ADR-0026 flagged as the trigger to revisit whether ADR-0004 should carry a permanent, generalized "organization-as-Author" clause rather than accumulating further per-connector notes.

This ADR decides that question: **ADR-0004 should now carry a permanent, generalized "organization-as-Author" forward-pointer clause** — one that names the established pattern, acknowledges that three connectors have needed it, and provides a standing reference for future connectors with the same shape. This does not change ADR-0004's Decision text (which the series' own convention prohibits). It is added as a dated Supersession update note on ADR-0004, referencing this ADR, ADR-0024, and ADR-0026 as the three instances that established the pattern. Future connectors where "author" means an organization, publication, or domain may cite ADR-0004's standing clause rather than each adding their own one-off note.

Concretely for this connector: `Author.externalAuthorId` = the verified domain (e.g., `example.com`), not the feed URL — the domain is the stable, DNS-verified identifier of the publication. `Author.followerCount` is left unpopulated, consistent with ADR-0024/0026/0042.

**5. Connector domain need not match `tenants.domain` from ADR-0031.** The tenant's email domain captured at sign-up (`tenants.domain`, per ADR-0031's tenants table) identifies the organization's email domain, not necessarily the domain of its content publication. A tenant at `acme.com` may run their blog at `blog.acme.com` or even at a separate domain. The DNS TXT verification is the trust mechanism — if the tenant can publish a TXT record proving they control a domain, they may configure that domain's feed regardless of whether it matches `tenants.domain`. A tenant may verify and configure multiple domains (e.g., `blog.acme.com` and `newsroom.acme.com`), each with its own verification state.

**Implementation defaults (adjustable via Amendment Log; does not require superseding this ADR):**

- **TXT record host prefix:** `_socialengage-verify.<domain>` (e.g., for `blog.example.com`, the record is published at `_socialengage-verify.blog.example.com`). Alternative: at the apex domain (`_socialengage-verify.example.com`) when the feed URL is a subdomain — the exact scoping rule (which domain level gets the TXT record) is an implementation-time decision.
- **Token format:** a cryptographically random, URL-safe string, long enough to be non-guessable (e.g., 32+ characters). Exact format is implementation-time.
- **Token TTL:** 7 days. A verification challenge expires if the tenant hasn't successfully verified within this window; they must restart the flow. Revisit if operationally too short.
- **DNS re-check cadence after tenant initiates verification:** poll at 1-minute intervals for the first 5 minutes, then back off to every 15 minutes. DNS propagation is outside the tenant's control once the record is published; aggressive initial polling catches fast-propagating registrars without hammering DNS for the slow-propagating majority.
- **Feed poll interval:** 30 minutes (conservative default; no published rate limit exists for a tenant's own feed). Respect the feed's own `<ttl>` element if present and if its value is greater than the default interval, per the RSS 2.0 spec's intent.
- **v1 feed URL: explicit, tenant-supplied.** Tenant provides the direct feed URL (e.g., `https://blog.example.com/feed`) at connector configuration time. Optional autodiscovery — fetching the domain's homepage and parsing `<link rel="alternate" type="application/rss+xml">` — is a future extension, not v1 scope. Rationale: explicit URL is unambiguous, immune to HTML-rendering failures, and puts no requirement on the tenant's homepage to implement autodiscovery. Common feed paths (`/feed`, `/rss`, `/feed.xml`) may be tried as a fallback if autodiscovery is later added; this ADR leaves that open.
- **`supportedQueryFeatures` (ADR-0021):** empty/none at v1. RSS feed content is fetched in full per item; keyword/boolean filtering falls back to whole-query post-fetch matching, same as Newswire. This connector's `normalize()` output feeds ADR-0021's standard capability matrix without change.
- **`getRateLimitConfig():** conservative fixed-window default (e.g., one poll per feed URL per 30 minutes). No published rate limit exists for a publicly accessible RSS feed. As with Newswire, the default is conservative-by-design and revisable.
- **`User-Agent` header:** SocialEngage must identify itself in the `User-Agent` header on every fetch of the tenant's own feed, per the same respectful-polling discipline ADR-0024 established when it noted the SEC EDGAR `User-Agent` lesson. Even though the tenant has authorized monitoring, well-behaved HTTP clients self-identify.
- **No historical backfill.** RSS feeds carry only recent items (typically the last 10–25 items the CMS has published). Items published before the connector begins polling are not available through the feed and are not retroactively ingested — same limitation as ADR-0024. If a tenant needs historical content, a separate, future, purpose-built mechanism would be required; this ADR does not anticipate or scope it.
- **Verification state storage:** a per-`(tenantId, connectorActivationId)` record tracking domain, feed URL, verification token, token expiry, and verified/pending/expired status. Exact table shape is an implementation-time decision for the Story that picks this up.

---

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Verification tokens must be cryptographically random and non-guessable | Security | Must | Token entropy and length make brute-force infeasible; validated in implementation tests |
| NFR-002 | Verification tokens expire after a bounded period (e.g., 7 days) | Security | Must | `tokenExpiresAt` is enforced; expired activations can be removed and reconnected |
| NFR-003 | Default poll cadence is conservative and respects the feed's `<ttl>` hint when larger | Performance | Should | 30-minute default; poll interval is at least `max(default, ttl)` when a `<ttl>` hint exists |
| NFR-004 | Connector registration must not require changes to core ingestion orchestration files | Maintainability | Must | ADR-0048 no-core-path-edit invariant is satisfied and mechanically checked |
| NFR-005 | All tenant-owned feed actions are tenant-scoped under RLS and `tenant_admin`-gated where tenant-wide | Security | Must | `tenant_user` cannot connect, verify, list, edit, or remove tenant-owned feeds |
| NFR-006 | No vendor credential (API key, OAuth token, account) is stored for this connector | Security | Must | `authMode` is `none`; no credential envelope or Key Vault entry is required |
| NFR-007 | Pending and verified states are clearly communicated to the user | Usability | Must | UI distinguishes DNS pending from connector-wide inactive and from verified-but-not-yet-polling |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes a meaningful, named content gap: tenants who want to monitor their own corporate blog or newsroom — the most on-brand, highest-trust content source for a social listening platform — have had no connector to do so. This is the first connector where the tenant is both the operator and the content publisher.
- DNS TXT verification provides a real, cryptographically grounded proof of domain control — not a workaround or honor system — while remaining free and self-service. The tenant needs DNS access to configure it, which is a correct and appropriate gate: an IT admin misconfiguring a corporate-domain feed connector on behalf of someone who doesn't control the domain is the exact risk being avoided.
- Using the same mechanism as Google Workspace and Microsoft 365 domain verification means the tenant's IT team is almost certainly already familiar with the process — it is well-documented, widely practiced, and tooled across all major DNS registrars (GoDaddy, Cloudflare, Namecheap, etc.).
- The `authMode: 'none'` model (no vendor credential required) avoids the need for any new credential-management infrastructure — nothing new to store, encrypt, or rotate. Simpler than GNews's API-key connector, and appropriate for a source the tenant owns.
- Resolves the "rule of three" question ADR-0026 explicitly deferred: with three connectors now needing organization-as-Author modeling, ADR-0004 gains a permanent forward-pointer clause rather than accumulating a fourth one-off note. Future connectors have a stable reference.
- The explicit, tenant-supplied feed URL (v1) is operationally simpler than autodiscovery: no HTML-fetch failures to handle, no ambiguity about which autodiscovery link to prefer when multiple exist, and no dependency on the tenant's homepage serving valid HTML.

**Negative**
- **DNS propagation delay is a real UX cost.** After the tenant publishes the TXT record, they may wait up to 72 hours before SocialEngage can confirm it. There is nothing SocialEngage can do to reduce this delay — it is inherent to DNS. The Admin UI must communicate this plainly (not as an error), and the pending-verification state must be clearly surfaced. This is the same delay Google Workspace and Microsoft 365 accept for domain verification; it is accepted here for the same reasons, but it is a real friction point for tenant admins used to instant-configuration connectors.
- **Verification adds a new state machine** (pending/verified/expired/failed) that the connector activation flow doesn't currently have — every other connector either connects immediately (Newswire, GNews) or fails immediately (OAuth callback error). The pending-verification state needs its own UI treatment, re-check flow, and expiry handling — more operational complexity than prior connectors.
- **No historical lookback** — the same limitation as Newswire. A new corporate blog connector will see content from the polling-start date forward only; items already published before the connector was set up are not available unless a separate backfill mechanism is built. Named here so it isn't discovered as a surprise at implementation.
- **TXT record prefix/subdomain scoping is non-obvious** when the feed URL is at a subdomain (`blog.example.com`) but the tenant expects to publish the record at the apex (`example.com`). The exact scoping rule (verify at the feed domain's level, or at the apex?) must be decided at implementation time and communicated clearly in the Admin UI.
- **Feed URL must be explicitly supplied.** A tenant who doesn't know their blog's feed URL — common for non-technical admins — may have friction finding it. Most CMS platforms publish feed URLs at well-known paths and document them; autodiscovery would remove this friction but is deferred to v1+.
- **Author modeling is organizational, not individual.** For tenants who want to attribute content to specific named authors (e.g., track which employees are publishing on the company blog), this connector — like Newswire and GNews — provides no individual-author identity. The `<author>` element in RSS 2.0 is an email address field, not a display name, and is routinely omitted in corporate CMS output (verified from the RSS 2.0 spec, fetched 2026-08-10). Supporting per-item author identity from RSS feeds would require either a CMS-specific API integration (out of this ADR's scope) or a separate Author-identity-resolution ADR.

---

## 12. Assumptions and Dependencies
- The Tenant-Admin configuring the connector has access to publish DNS records for the claimed domain.
- The feed is publicly reachable over HTTPS and returns valid RSS 2.0 or Atom XML.
- DNS propagation after a TXT record is published can take from minutes to 72 hours, which is acceptable because this is an optional, post-sign-up connector (not the product entry gate).
- The tenant understands how to obtain the direct feed URL; v1 does not autodiscover it.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | DNS propagation delay (up to 72 hours) creates support friction | High | Medium | UI explains propagation plainly, provides manual re-check, and never frames pending as an error | Product Owner |
| R-002 | A tenant misconfigures the wrong domain or feed URL | Medium | High | DNS TXT proof required before polling; `domain` cannot be edited in place | Product Owner |
| R-003 | Unbounded multi-feed count increases compute and storage costs | Low | Medium | Monitor real usage; revisit a cap only with cost data | Product Owner |
| R-004 | Lack of historical backfill disappoints users who expect older content | Medium | Medium | Document v1 limitation explicitly; plan a separate future backfill mechanism if needed | Product Owner |
| R-005 | `pending` and `removed` rows accumulate without scheduled cleanup | Medium | Low | Name as a future scheduled-job story; no production harm until then | Technical Lead |
| R-006 | Prior `tenant_user` sessions could connect or verify feeds before role gating was corrected | Low | Medium | `connect` and `verify-domain` now require `tenant_admin`; multi-feed administration enforces the same | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0050-tenant-owned-domain-rss-content-feed-connector.md`
- BRD: `../Business-Requirements/BRD-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Deep research: _No deep-research report found._
- User stories: see extracted stories above