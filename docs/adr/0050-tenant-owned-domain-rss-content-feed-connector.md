# ADR-0050: Tenant-owned-domain RSS/content-feed connector with DNS TXT domain ownership verification

**Status:** Proposed (2026-08-10) — drafted by the AI Business & Requirements Analyst persona, left Proposed per that persona's own charter boundary. Menno (Sponsor) accepts in his own words, recorded in the Amendment Log below when it occurs. **No user story is drafted until this ADR is accepted**, per the ADR-0024/0026 precedent stated at their own acceptance.
**Source:** Flagged in `docs/adr/README.md`'s "Still outstanding, not yet drafted" connector-candidate bullet: *"Connector letting a tenant monitor their own domain's RSS/content feed... distinct from both shipped connectors (GNews, Newswire), which both pull from third-party sources the tenant doesn't own."* (Added 2026-08-04, per the README.) This ADR originates the provider selection decision for this connector category and resolves two deferred questions: (1) whether DNS TXT-record domain-ownership verification, explicitly declined for the self-service sign-up flow in ADR-0037 §4, fits here instead; and (2) how to model `Author` for a tenant's own publication. It does not document a decision the design spec or original design conversation made.

---

## Context

### The connector gap this ADR fills

All connectors accepted in this series target **third-party content sources the tenant does not own**:

| Connector | Content source | Source ownership | Auth |
|---|---|---|---|
| Newswire ([ADR-0024](0024-newswire-connector-direct-wire-rss-issuer-as-author.md)) | GlobeNewswire, PR Newswire wire feeds | Third-party press-release wire services | `authMode: 'none'` |
| RSS/News ([ADR-0026](0026-rss-news-connector-gnews-api-publication-as-author.md)) | GNews API, general news publications | Third-party news API | `authMode: 'apiKey'` |
| Wikipedia ([ADR-0042](0042-wikipedia-connector-mediawiki-api-article-as-author.md)) | MediaWiki article content | Third-party encyclopedia | `authMode: 'none'` |

A connector letting a tenant monitor their **own** domain's content feed — the company blog, newsroom, or other owned publication — is structurally distinct from all three. The content source is the tenant's own; the tenant is authorizing monitoring of a URL they control rather than subscribing to a third-party data stream. This creates two questions that don't arise with third-party connectors: (a) how to prove the tenant actually owns the domain they claim to configure, and (b) whether organization-as-Author modeling generalizes enough to warrant a permanent pattern change on ADR-0004, given that this would be the third connector to need that departure.

ADR-0024's own Consequences section anticipated this shape: *"A future connector with a similar shape (e.g. a corporate blog/newsroom feed) would need to decide whether to reuse this exact pattern or treat each case independently."* This ADR is that decision point.

### Why DNS TXT verification belongs here, not at sign-up

ADR-0037 §4 explicitly considered DNS TXT-record domain-ownership verification for the self-service tenant sign-up flow and declined it. The rationale, sourced directly from ADR-0037 §4's own "Considered and explicitly declined" entry (search "DNS TXT" in that file):

- DNS propagation after a record is added typically takes **minutes to 48–72 hours** — verified against Google Workspace's own domain-verification documentation (`knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record`, fetched 2026-08-10: *"It can take up to 72 hours for the new TXT records to be recognized"*) and Microsoft 365's own add-domain flow (`learn.microsoft.com/en-us/microsoft-365/admin/setup/add-domain`, fetched 2026-08-10), which both use TXT verification but note the same propagation delay.
- Blocking a tenant's **entire product entry** on a DNS propagation event — which the tenant can do nothing to accelerate once the record is published — is incompatible with self-service sign-up UX expectations. ADR-0037 §4 explicitly named this as the reason: not that TXT verification is wrong as a mechanism, but that it gates the wrong thing (the tenant's first experience with the product) on an event outside the tenant's control once triggered.

**Why this is different here:** a tenant-owned-domain RSS connector is one optional, tenant-initiated connector setup, activated only after the tenant is already a live, functioning user of the product. The delay is acceptable — and the tenant is the right party to wait for it — because:

- The tenant is explicitly signing up to monitor their **own** domain; the IT team member or admin configuring this connector already has DNS access by definition, and publishing a TXT record is a normal step in that role.
- It gates one specific optional connector, not the product itself.
- It proves **authorization to act for the domain** (the tenant controls the DNS zone, therefore controls the domain), which WHOIS lookups and email-based confirmation do not — ADR-0037 §4 already rejected WHOIS for this reason, and the same reasoning applies here.

The same mechanism (generate token → publish TXT → poll DNS to verify) is industry-standard for exactly this class of claim. Verified against primary sources:
- **Google Workspace domain verification** (`knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record`, fetched 2026-08-10): admin generates a unique value (`google-site-verification=TOKEN`), publishes it as a TXT record at the domain's apex or subdomain, then Google polls to confirm presence.
- **Microsoft 365 domain verification** (`learn.microsoft.com/en-us/microsoft-365/admin/setup/add-domain`, fetched 2026-08-10): Microsoft 365 generates a verification TXT value, tenant publishes it at the registrar, Microsoft polls to confirm domain ownership before any M365 services activate for that domain.

Neither of these requires the tenant to wait for verification before using other parts of those products — only the specific capability being gated (Google Workspace email delivery, Microsoft 365 services for that domain) waits. The parallel to this connector is exact.

### RSS/Atom feed mechanics — primary-source verification

The RSS 2.0 specification (`rssboard.org/rss-specification`, fetched 2026-08-10, version 2.0.11, published 2009-03-30) defines the format a tenant's own content feed is most likely to use:

- A feed is an XML document with a single `<channel>` containing channel metadata (`title`, `link`, `description`, `pubDate`, `lastBuildDate`) and any number of `<item>` elements.
- Each `<item>` may carry: `title`, `link`, `description`, `pubDate` (RFC 822 date-time), `guid` (globally unique identifier — the primary deduplication key), `author` (email address of the author, optional), `category`, and `source`.
- The `<author>` field, when present, is **an email address** (e.g., `lawyer@boyer.net (Lawyer Boyer)`), not a display name or social-account handle. It is explicitly optional; the spec notes *"For a weblog authored by a single individual it would make sense to omit the `<author>` element."* Corporate/company blog feeds routinely omit it.
- The optional `<ttl>` (time-to-live) channel element hints how many minutes a feed can be cached before a client should refresh: `<ttl>60</ttl>`. This is a hint, not a binding contract.
- Atom (RFC 4287) is a parallel format with similar structure; this ADR covers both via the same poll/parse mechanism.

**RSS Autodiscovery** (`rssboard.org/rss-autodiscovery`, fetched 2026-08-10, version 1.0, published 2006-11-27): a publisher can signal a feed's URL to browsers and aggregators by including in the HTML `<head>`:

```html
<link rel="alternate" type="application/rss+xml" title="My Blog" href="https://example.com/feed">
```

This enables automatic feed-URL discovery from a page URL without requiring the user to know the feed path. Common well-known feed paths (no autodiscovery required): `/feed`, `/rss`, `/feed.xml`, `/rss.xml`, `/atom.xml`, `/blog/feed`.

The implications for this connector's design:
- **Author identity:** `<author>` in RSS is optional and email-based. For a corporate blog, the meaningful "author" is the publication/organization, not any individual byline. This is the same organization-as-Author departure ADR-0024 and ADR-0026 each documented as a per-connector exception to ADR-0004. This would be the **third** connector to need the same departure — exactly the "rule of three" threshold ADR-0026 flagged as the trigger to revisit whether ADR-0004 should carry a permanent, generalized organization-as-Author clause. See Decision below.
- **Deduplication:** `<guid>` is the natural deduplication key, consistent with how ADR-0024/0026 use item identifiers from their own sources.
- **No follower count:** RSS/Atom has no field for author subscriber count or audience size. `Author.followerCount` is left unpopulated, same as ADR-0024/0026/0042.
- **Feed URL:** the tenant provides a direct feed URL, or the system can autodiscover it from the domain's homepage. v1 decision is addressed in the Decision section below.
- **No historical window:** RSS feeds typically contain only recent items (most CMS tools publish 10–25 items per feed). There is no equivalent to GNews's 30-day historical query. Items published before the connector starts polling cannot be retroactively ingested — the same no-historical-backfill limitation as ADR-0024 (Newswire).

### Relationship to ADR-0027 (Connector is a technical intermediary only)

This connector has no third-party platform credential at all — no API key (unlike GNews), no OAuth grant (unlike future Reddit), no vendor account (unlike Newswire's feed registration patterns). The tenant's own publicly accessible feed URL is fetched directly. ADR-0027's principle applies: SocialEngage is a technical intermediary, never a contracting party. There is no vendor whose terms apply to this connector at the content-source level (the tenant's own public feed is, by definition, published by the tenant themselves). Any future decision about terms that *do* apply — e.g., if the tenant's feed is served by a third-party platform like Squarespace, WordPress.com, or HubSpot — is an implementation-time consideration, not a vendor-selection decision this ADR makes.

---

## Decision

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

## Consequences

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

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **No domain verification — trust the tenant-supplied URL** | Rejected. Any tenant could configure monitoring of a competitor's public RSS feed without proving they own it, undermining the connector's core distinction (tenant-owned vs. third-party content). More concretely: a tenant admin misconfiguring the wrong domain — `companyname.com` when they meant `company-name.com`, or a competitor's domain — would silently begin ingesting content the tenant has no right to monitor under this connector's own stated purpose. DNS TXT verification is the right gate. |
| **Verify using `tenants.domain` at sign-up time instead of a per-connector TXT check** | Rejected. Sign-up domain capture (ADR-0031's `tenants.domain`) proves the tenant's email domain only, not that the tenant controls the content domain they want to configure for this connector. A tenant at `acme.com` may want to monitor `blog.acme.com` or `newsroom.acme.com` — or an entirely separate domain for a subsidiary or product blog. Email-domain matching is the wrong primitive for content-domain authorization. |
| **WHOIS-based verification** | Rejected, same reasoning as ADR-0037 §4: WHOIS data is often privacy-masked (particularly post-GDPR for EU registrants), not real-time, and does not prove *control* of the DNS zone — it proves *registration*, which is a weaker and less useful claim for this purpose. |
| **DNS TXT verification at signup, not per-connector** | Rejected for signup (ADR-0037 §4, already decided); fits here instead. Named as the origin of this connector's own TXT proposal. |
| **Merge into the Newswire connector** | Rejected. The Newswire connector (ADR-0024) targets third-party wire services with no domain ownership claim. Merging a connector with a DNS verification gate, a tenant-owned-domain trust model, and a completely different activation flow into ADR-0024's scope would pollute ADR-0024's own decision (which explicitly targets "no aggregator, no API key, no account" third-party feeds). Keeping this as a distinct `providerId` is correct. |
| **Merge into the RSS/News connector** | Rejected. GNews (ADR-0026) is an API-key connector targeting a specific third-party news aggregation service. The tenant-owned-domain connector has `authMode: 'none'`, no vendor relationship, a domain verification gate, and a different Author-modeling context. They should not share a `providerId`. |
| **Autodiscovery as v1 (not explicit URL)** | Considered; deferred, not rejected. RSS Autodiscovery (rssboard.org/rss-autodiscovery, fetched 2026-08-10) is well-specified and widely implemented — a `<link rel="alternate" type="application/rss+xml">` tag in the homepage `<head>` is the standard pattern. However, autodiscovery requires a successful HTML fetch of the tenant's homepage, HTML parsing, and handling the case where multiple autodiscovery links exist or none exist at all — adding failure modes that don't exist when the tenant supplies the feed URL directly. v1 uses an explicit URL; autodiscovery is a named future extension, not an afterthought. |
| **Defer entirely** | Named as a candidate for prioritization review. `docs/implementation-plan.md`'s Phase 4 connector order currently slots Wikipedia (ADR-0042, Proposed) ahead of this connector; accepting this ADR does not change that ordering — it only selects the mechanism and trust model ahead of when a Story would build it, the same ahead-of-schedule drafting pattern ADR-0024/0026 used. If Menno's prioritization places this behind Wikipedia and other Proposed connectors, deferring is not architecturally wrong. |

---

## Open Questions

The following are explicitly not resolved by this ADR:

1. **TXT record host-level scoping.** When the tenant's feed URL is at `blog.example.com`, should the TXT verification record be published at `_socialengage-verify.blog.example.com` (subdomain-level) or `_socialengage-verify.example.com` (apex-level)? The subdomain-level scoping is more precise and follows Stripe's pattern (which uses `_stripe.<subdomain>`); apex-level is simpler to explain but may conflict if the tenant wants to verify multiple subdomains independently. Should be decided at Story time and communicated clearly in the Admin UI copy.

2. **Multiple-domain and multiple-feed support per tenant.** This ADR describes verifying one domain and configuring one feed URL. Whether a single tenant may verify multiple domains and configure multiple feed connectors (e.g., `blog.acme.com` and `newsroom.acme.com`) is an implementation question — the verification-state storage model above supports it conceptually, but the UX and the per-domain `Author` identity separation need explicit design at Story time.

3. **Whether feeds served by third-party CMS platforms need any additional terms consideration.** A tenant's own corporate blog may be hosted on WordPress.com, Squarespace, HubSpot, or similar platforms. From the RSS feed's perspective, it is still the tenant's own content at the tenant's own domain — the feed URL is tenant-controlled. But the underlying platform's ToS may have clauses about programmatic access to feed content. The DNS TXT verification proves the tenant controls the domain but does not address the hosting platform's terms. Whether this is a concern worth surfacing to the tenant in the Admin UI, or whether it is out of SocialEngage's scope under ADR-0027's "connecting party is responsible for compliance with their own platform's terms" principle, is left open.

4. **Whether `<ttl>` from the feed should be respected as a binding lower bound on poll interval.** The RSS 2.0 spec (`rssboard.org/rss-specification`, fetched 2026-08-10) defines `<ttl>` as *"a hint"*, not a requirement. The implementation default above treats it as a hint that the poll interval should not be lower than `<ttl>` minutes. Whether SocialEngage should hard-respect it (minimum poll interval = max(default, ttl)) or ignore it in favor of the `RequestGate` configuration is an implementation-time decision.

5. **Per-item author identity from RSS `<author>` email field.** The RSS 2.0 spec's `<author>` field is an email address, optional, and commonly omitted in corporate CMS output. If a future use case requires tracking individual content authors (not the organization), this connector's current organization-as-Author model does not support it. A separate, named design decision would be needed — not in scope for this ADR.

6. **ADR-0004 supersession update for "rule of three" generalization.** This ADR decides that ADR-0004 should now carry a permanent generalized "organization-as-Author" clause (see Decision §4). The exact wording of that clause — what it says about when this departure is appropriate, what it says about Author field semantics for organizational entities — is not prescribed by this ADR. It is an appendix to ADR-0004, written at acceptance time by whoever formalizes it (AI persona drafts; Menno accepts).

7. **Compliance with ADR-0048 at implementation time.** ADR-0048 (Proposed) establishes that no new connector registration should require core-pipeline changes. The implementation team should verify this connector satisfies ADR-0048 when picking up the Story, not block this ADR's acceptance on ADR-0048's own Proposed status.

---

## Amendment Log

- **2026-08-10** — Drafted by the AI Business & Requirements Analyst persona. Primary-source verification performed this session:
  - **Google Workspace domain verification:** `knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record` (fetched 2026-08-10). Confirmed: unique TXT value generated by admin console, published at DNS by tenant, polled by Google; propagation up to 72 hours; TXT record must remain until verification succeeds.
  - **Microsoft 365 domain verification:** `learn.microsoft.com/en-us/microsoft-365/admin/setup/add-domain` (fetched 2026-08-10). Confirmed: same general TXT-based pattern; Microsoft uses TXT record or CNAME for domain ownership verification before M365 services activate.
  - **RSS 2.0 specification:** `rssboard.org/rss-specification` (fetched 2026-08-10, version 2.0.11, 2009-03-30). Confirmed: XML channel/item structure; `<author>` field is an email address, optional; `<guid>` is the deduplication key; `<pubDate>` is per-item publication time; `<ttl>` is a cache hint in minutes.
  - **RSS Autodiscovery spec:** `rssboard.org/rss-autodiscovery` (fetched 2026-08-10, version 1.0, 2006-11-27). Confirmed: `<link rel="alternate" type="application/rss+xml">` pattern in HTML `<head>`; deferred to v1+ scope, not v1 requirement.
  - ADR-0024 (Newswire, Accepted), ADR-0026 (GNews, Accepted), and ADR-0042 (Wikipedia, Proposed) read directly to confirm organization-as-Author precedent; ADR-0037 read directly to confirm DNS TXT sign-up-flow rejection reasoning. Left **Proposed**, per this persona's own charter boundary — acceptance authority rests with Menno (Sponsor), recorded verbatim in this Amendment Log when it occurs.
