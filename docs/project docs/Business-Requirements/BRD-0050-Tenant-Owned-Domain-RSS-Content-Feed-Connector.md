# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Tenant-Owned Domain RSS/Content Feed Connector – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-11 |
| Author(s) | AI Business & Requirements Analyst (BRD Writer Agent) |
| Approver(s) | Menno – Business Sponsor, Product Owner, Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-11 | AI BRD Writer Agent | Initial draft from ADR-0050, related ADRs, and user stories |
| 1.0 | 2026-08-11 | Menno | Approved as Accepted with ADR-0050; includes 2026-08-20 Amendment Log extensions |

---

## 2. Executive Summary

**What problem are we solving?** SocialEngage's ingestion connectors to date (Newswire, GNews, Wikipedia) all pull from third-party sources the tenant does not own. Tenants who want to monitor their own corporate blog, newsroom, or owned publication have no supported connector, and there is no mechanism to prove that the tenant actually controls the domain they claim to monitor.

**Who is affected?** Tenant-Admins who configure connectors, Tenant-Users who consume the post feed, brand/PR teams tracking owned-channel coverage, and Platform-Admins observing cross-tenant connector adoption.

**What is the proposed solution at a glance?** Introduce a distinct `tenant-owned-feed` connector that lets a Tenant-Admin supply a domain and explicit RSS/Atom feed URL, then prove domain ownership by publishing a DNS TXT record at `_socialengage-verify.<domain>`. Only after verification succeeds does SocialEngage begin polling the feed. The `Author` for every ingested post is the verified domain/organization, with optional per-feed display names and per-item bylines surfaced only as display data.

**What business value do we expect?** Closes a high-trust, on-brand content gap with no new vendor credential burden; provides a self-service, cryptographically grounded ownership gate that mirrors Google Workspace and Microsoft 365 domain verification; and resolves the accumulated "rule of three" exception for organization-as-Author modeling by formalizing it in ADR-0004.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenants to monitor their own corporate blogs, newsrooms, and owned content feeds | A `tenant-owned-feed` connector is active and producing `SocialPost` rows for configured feeds |
| 2 | Ensure only the DNS-proven domain owner can configure monitoring of that domain | No feed is polled while verification status is `pending` or `expired`; every active feed has a matching, successful DNS TXT proof |
| 3 | Avoid any new vendor credential or secret-management infrastructure | No API key, OAuth grant, or vendor account is stored or required for this connector |
| 4 | Generalize organization-as-Author modeling to reduce future per-connector exception debt | ADR-0004 carries a durable, forward-pointer "organization-as-Author" clause cited by this and prior connectors |
| 5 | Support administration of multiple owned feeds per tenant | Tenant-Admin can add, list, rename, edit feed URL, and soft-remove feeds from a single screen |

---

## 4. Scope

### 4.1 In Scope

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

### 4.2 Out of Scope

- RSS autodiscovery from a homepage HTML `<link rel="alternate">` tag (deferred to v1+).
- Historical ingestion of feed items published before the connector begins polling.
- Replacing organization-as-Author with individual-as-Author in the normalized `Author` entity.
- Surfacing or enforcing third-party CMS hosting-platform terms (e.g., WordPress.com, Squarespace, HubSpot).
- Platform-Admin cross-tenant feed visibility (candidate for a future, separate ADR).
- A hard ceiling on the number of feeds per tenant at v1.
- Scheduled cleanup of stale `pending` or `removed` rows (named future work).

### 4.3 Assumptions

- The Tenant-Admin configuring the connector has access to publish DNS records for the claimed domain.
- The feed is publicly reachable over HTTPS and returns valid RSS 2.0 or Atom XML.
- DNS propagation after a TXT record is published can take from minutes to 72 hours, which is acceptable because this is an optional, post-sign-up connector (not the product entry gate).
- The tenant understands how to obtain the direct feed URL; v1 does not autodiscover it.

### 4.4 Constraints

- The connector must use the existing `ProviderConnector`/`SocialConnector` framework without requiring core ingestion orchestration changes (ADR-0048).
- No vendor credential may be stored for this connector (ADR-0027).
- All database access is tenant-scoped with row-level security and `tenant_admin` gating where the action is tenant-wide.
- The solution must not block the product sign-up flow on DNS propagation (the sign-up domain question was already decided separately in ADR-0037).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary configurer of the tenant-owned feed | High | A self-service, trustworthy setup flow with clear DNS instructions and propagation expectations |
| Tenant-User | Consumer of ingested posts | Medium | Can see owned-channel posts, bylines, and provider badges in the post feed |
| Sole-Operator / Social-Selling-Strategist | Monitors volume and filters by source | Medium | Can distinguish tenant-owned content from third-party content and understand source health |
| DNS / IT Administrator | Publishes the required TXT record at the registrar | High | Clear, copyable TXT record host and value with no ambiguity about subdomain vs. apex placement |
| Platform-Admin | Cross-tenant adoption and health observer | Low | Can see that the connector exists and is registered without accessing tenant feed data |
| Product Owner (Menno) | Sponsor and decision owner | High | A durable, generalized Author model and no core-path coupling for new connectors |

---

## 6. Current State (As-Is)

**Current process:**
1. SocialEngage offers connectors for third-party sources the tenant does not own: Newswire (public RSS), GNews (third-party API), and Wikipedia (public MediaWiki).
2. Connecting these sources is either immediate (`authMode: 'none'`) or requires a vendor API key/OAuth.
3. There is no connector for the tenant's own blog, newsroom, or owned RSS feed.
4. Organization-as-Author has been handled as a per-connector exception in ADR-0024 and ADR-0026, creating accumulation risk.

**Pain points:**
- Tenants cannot track their own highest-trust, on-brand content source inside the same post feed as third-party coverage.
- Without a domain-ownership gate, a tenant could misconfigure or intentionally monitor a competitor's public feed and misrepresent it as owned content.
- The "rule of three" for organization-as-Author exceptions has been reached; a durable generalization is needed.
- Existing connectors have no pending-verification state, so the UX pattern for a DNS-propagated gate does not exist in the product.

---

## 7. Future State (To-Be)

**New or improved process:**
1. The Tenant-Admin navigates to the tenant-owned-feed connector screen.
2. They enter a `domain` and explicit `feedUrl` and initiate the connection.
3. SocialEngage generates a unique verification token and returns DNS TXT instructions (`_socialengage-verify.<domain>` with a token value and an expiration time).
4. The Tenant-Admin publishes the TXT record at their DNS registrar and returns to click "Verify now."
5. SocialEngage polls DNS for the record. If found and matching, the domain is marked `verified` and polling begins; if not, a `pending`/`retryAfter` response is returned.
6. New feed items are ingested as `SocialPost` rows with `Author` set to the verified domain.
7. The Tenant-Admin can list all owned feeds, edit `feedUrl`, soft-remove feeds, and add additional feeds under an already-verified domain without re-proving ownership.

**Expected capabilities:**
- Monitor one or more tenant-owned RSS/Atom feeds in the same post stream as third-party connectors.
- Cryptographically grounded proof of domain control via DNS TXT.
- Clear pending/verified/expired/removed states in the Admin UI.
- No vendor credential, API key, or OAuth flow required.
- Optional per-feed display names and per-item bylines surfaced in the post feed.
- Tenant-wide activation/deactivation of the connector independent of per-feed verification status.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

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

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_owned_feed_activations` | Per-tenant, per-feed verification and configuration record (domain, feedUrl, name, verification token, expiry, status, verifiedAt) | Created by tenant-owned feed connector | Core backend | Medium |
| `connector_activations.is_active` | Tenant-wide on/off switch for the `tenant-owned-feed` connector, independent of per-feed verification | `connector_activations` table (ADR-0051) | Core backend | Medium |
| `social_posts` | Ingested feed items with `provider_id`, `rawPayload` (including optional `feedName` and per-item `author` byline), `body_markdown` | Derived from RSS/Atom items by connector | Core backend | Medium |
| `authors` | Normalized `Author` row keyed to the verified domain as `externalAuthorId` | Derived at normalization | Core backend | Low |
| DNS TXT record | `_socialengage-verify.<domain>` TXT value containing the SocialEngage token | Tenant's DNS zone | Tenant / DNS admin | Medium |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Verified tenant-owned feeds count | Track adoption of owned-channel monitoring | Product team / Platform-Admin | Daily / On demand |
| Pending verifications count and age | Identify tenants stuck at DNS propagation step | Product team / Support | Daily |
| Posts ingested from `tenant-owned-feed` | Measure owned-content volume | Tenant-Admin / Product | Real-time / On demand |
| Time to verify (first `pending` to `verified`) | Monitor DNS propagation UX friction | Product team | Weekly |
| Failed verification attempts | Detect misconfigured DNS or support issues | Product team / Support | Daily |
| Feed health and last successful poll | Surface connector operational status | Tenant-Admin | Real-time |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | DNS propagation delay (up to 72 hours) creates support friction | High | Medium | UI explains propagation plainly, provides manual re-check, and never frames pending as an error | Product Owner |
| R-002 | A tenant misconfigures the wrong domain or feed URL | Medium | High | DNS TXT proof required before polling; `domain` cannot be edited in place | Product Owner |
| R-003 | Unbounded multi-feed count increases compute and storage costs | Low | Medium | Monitor real usage; revisit a cap only with cost data | Product Owner |
| R-004 | Lack of historical backfill disappoints users who expect older content | Medium | Medium | Document v1 limitation explicitly; plan a separate future backfill mechanism if needed | Product Owner |
| R-005 | `pending` and `removed` rows accumulate without scheduled cleanup | Medium | Low | Name as a future scheduled-job story; no production harm until then | Technical Lead |
| R-006 | Prior `tenant_user` sessions could connect or verify feeds before role gating was corrected | Low | Medium | `connect` and `verify-domain` now require `tenant_admin`; multi-feed administration enforces the same | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

1. A `tenant-owned-feed` connector is registered with `authMode: 'none'` and `deliveryMode: 'poll'`, without any change to core ingestion orchestration files.
2. `POST /v1/connectors/tenant-owned-feed/connect` accepts `{ domain, feedUrl, name? }` and returns a unique token plus `txtRecordHost`, `txtRecordValue`, and `expiresAt`.
3. `POST /v1/connectors/tenant-owned-feed/verify-domain` confirms the DNS TXT record and marks the feed `verified` only when the token matches; missing or mismatched records return a retryable `pending` state.
4. Polling of the configured `feedUrl` never begins while verification is not `verified`.
5. Each normalized post's `Author` resolves to the verified domain as `externalAuthorId`; `followerCount` is unpopulated.
6. The Admin UI plainly states that DNS propagation can take from minutes to 72 hours and offers a re-clickable "Verify now" control.
7. A tenant can list, edit `feedUrl`, soft-remove, and add additional feeds; a second feed under an already-verified domain skips new DNS verification.
8. Per-item bylines are extracted from `dc:creator`, `<author>`, or Atom `<author><name>` where present and surfaced display-only in the post feed.
9. No items published before the connector begins polling are ingested.
10. The feed is polled with a self-identifying `User-Agent` and a conservative cadence.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Author** | The normalized entity representing the originator of a `SocialPost`; for the tenant-owned feed, this is the verified organization/domain. |
| **Connector activation** | The persisted, ownership-scoped record that enables or disables polling for a `platformId` (`connector_activations.is_active`). |
| **DNS TXT record** | A type of DNS resource record used to associate arbitrary text with a domain; here, the mechanism for proving domain ownership. |
| **RSS** | Really Simple Syndication; an XML-based web feed format containing a channel and items. |
| **Atom** | An alternative XML-based syndication format (RFC 4287) with a similar structure to RSS. |
| **Feed URL** | The explicit, tenant-supplied URL of the RSS/Atom document to poll. |
| **Tenant-owned feed** | An RSS/Atom feed from a domain the tenant controls, as proven by DNS TXT verification. |
| **Verification token** | A cryptographically random value generated by SocialEngage that the tenant publishes in a DNS TXT record. |
| **`<ttl>`** | RSS 2.0 channel element that hints how many minutes a feed can be cached before refreshing; treated as a hint, not a binding contract. |
| **Soft-remove** | A state transition (to `removed`) that stops polling but preserves the record and already ingested posts. |

---

## 16. Appendices

### Appendix A – Source ADR
- [ADR-0050: Tenant-owned-domain RSS/content-feed connector with DNS TXT domain ownership verification](../adr/0050-tenant-owned-domain-rss-content-feed-connector.md)

### Appendix B – Related Feature Design
- [Feature design: Multi-source ingestion](../product-research/feature-designs/01-multi-source-ingestion.md) – the only feature design that explicitly references an "optional tenant-owned feed DNS TXT ownership gate (ADR-0050)." No dedicated feature-design or deep-research file exists for the tenant-owned feed connector; the BRD is derived directly from the ADR and its amendment log.

### Appendix C – Related User Stories
- [Story 2.11](../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) – Tenant-owned-domain RSS/content-feed connector with DNS TXT verification
- [Story 2.19](../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) – Tenant-owned feed: per-feed display name, and per-item author (byline) extraction
- [Story 6.12](../user-stories/epic-6-tenant-admin-ui.md) – Tenant-owned-feed connector setup UI
- [Story 6.17](../user-stories/epic-6-tenant-admin-ui.md) – Tenant-wide activate/deactivate control on the tenant-owned-feed connector screen
- [Story 6.20](../user-stories/epic-6-tenant-admin-ui.md) – Multi-feed administration for the tenant-owned-feed connector (list, edit, remove)

### Appendix D – Related ADRs
- [ADR-0004](../adr/0004-author-normalized-separately-from-post.md) – Author normalized separately from post
- [ADR-0024](../adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md) – Newswire connector
- [ADR-0026](../adr/0026-rss-news-connector-gnews-api-publication-as-author.md) – RSS/News (GNews) connector
- [ADR-0037](../adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md) – Self-service tenant sign-up (DNS TXT explicitly declined there)
- [ADR-0042](../adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md) – Wikipedia connector
- [ADR-0048](../adr/0048-connector-registration-transparency.md) – Connector registration transparency
- [ADR-0051](../adr/0051-connector-activation-decoupled-from-credential.md) – Connector activation
- [ADR-0057](../adr/0057-tenant-owned-feed-multi-feed-administration.md) – Multi-feed administration for tenant-owned feed

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-11 |
| Product Owner | Menno | | 2026-08-11 |
| Technical Lead | Menno | | 2026-08-11 |
| Other Stakeholder | — | | |
