# ADR-0118: Additional Social Platform Publishing

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23.** Records the project's intent to extend ADR-0075's `SocialConnector.publish?()` outbound post path to Instagram, Bluesky, Mastodon, Threads, and X, and establishes a build order and shared design constraints for this second wave of publishing connectors. No primary-source API verification has been performed for these platforms yet; each requires its own connector-specific ADR before implementation.

**Source:** Menno request (2026-08-23): *"Could you create a draft ADR for the Instagram, Bluesky, Mastodon, Threads, X"*

---

## Context

### 1. ADR-0075 authorizes Facebook and LinkedIn first
ADR-0075 (Proposed 2026-08-22) authorizes `SocialConnector.publish?()` for immediate outbound posting and an `outbound_activities` audit table. It explicitly scopes v1 to text/link-card posts and leaves image/video upload and additional platforms for later ADRs.

### 2. The composer already previews these five platforms
ADR-0072's Polypost Composer has preview rails for Instagram, Bluesky, Mastodon, Threads, and X, but no real write path. The previews are client-side simulations only.

### 3. Each platform has distinct API, cost, and permission models
- **Instagram:** Content Publishing API, requires a Facebook Business/Creator account with a linked Page, and primarily supports media (image/video/carousel) posts rather than text-only. v1 text-only posting is not viable.
- **Bluesky:** AT Protocol, relatively open, OAuth-like authentication, supports text, links, images, and threads.
- **Mastodon:** ActivityPub-compatible REST API, simple application/user token model, supports text, links, images, and content warnings.
- **Threads:** Meta's Threads API, limited third-party access and business verification requirements.
- **X/Twitter:** Paid API tiers, strict review, and elevated cost; may not be economical for a small self-funded project.

### 4. No primary-source verification has been done
This ADR does not purport to verify terms, pricing, or API shapes. It records a build order and common architecture only. Concrete implementation for any platform requires a per-platform, primary-source-verified ADR (per ADR-0048 and ADR-0027).

---

## Decision

### 1. These platforms are a second wave, after Facebook and LinkedIn
The order for implementing `SocialConnector.publish?()` is:

1. Facebook (Story 2.29, ADR-0075)
2. LinkedIn (Story 2.30, ADR-0075)
3. Mastodon — simplest token model and no business verification
4. Bluesky — open protocol, but requires AT Protocol implementation
5. Instagram — depends on Facebook Business/Creator account and media upload (ADR-0115)
6. Threads — depends on Meta access and review
7. X/Twitter — last, due to cost and review barriers; explicit re-evaluation before building

### 2. Reuse existing architecture
Each platform's `publish?()` implementation will:

- Reuse the `outbound_activities` table and `SocialConnector.publish?()` contract from ADR-0075.
- Use `RequestGate` with key `(tenantId, providerId, 'outbound_post')`.
- Require a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.
- Target a per-user asset enumerated by the connector (e.g. `GET /v1/connectors/:providerId/assets`).
- Return `{ externalId, externalUrl }` on success.

### 3. Text/link-card first, media later
Following ADR-0075's v1 scope, the initial `publish()` for each platform supports text and link-card only. Image/video media upload is explicitly out of v1 and depends on ADR-0115.

### 4. No business-intermediary role
Per ADR-0027, SocialEngage remains a technical connection mechanism only. The tenant/user holds their own platform account and pays the platform directly. No pooled or shared credentials.

### 5. Each platform needs a separate acceptance review
This ADR is a roadmap, not a per-platform specification. Before building any of these connectors, a new per-platform ADR must be drafted, primary-source-verified, and accepted (e.g., ADR-0119 Mastodon publishing, ADR-0120 Bluesky publishing, etc.).

---

## Consequences

### Positive
- Provides a clear, explicit build order for the remaining composer preview rails.
- Avoids premature commitment to high-cost or unverified platforms.
- Reuses existing outbound architecture rather than inventing a new one per platform.

### Negative
- X/Twitter may remain unsupported indefinitely if its API economics do not fit the project.
- Instagram text-only posting is not technically viable; it cannot be enabled until media upload is built.
- Threads API availability is uncertain and may require re-prioritization.

---

## Open Questions

1. Which of these platforms, if any, should also support `SocialConnector.reply?()` or `SocialConnector.poll()?` (i.e., should the same per-platform ADR cover ingestion and engagement as well as publishing?)
2. Should Mastodon support per-toot threading natively or map the Polypost Composer's thread model to multiple Mastodon posts?
3. What is the exact Bluesky authentication model (OAuth, App Passwords, or DID-based) and its rate/cost model?
4. Does Instagram support any text/link-only post type through the Content Publishing API, or is media always required?
5. Is X/Twitter's paid API still economically viable for a self-funded project at the time of implementation?

---

## Related Documents

- ADR-0075: Outbound Social Post Publishing
- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0068: Instagram Connector
- ADR-0069: LinkedIn Connector
- ADR-0115: Publishing Media Upload and Asset Targeting
- ADR-0048: No-Core-Pipeline-Change Verification for New Connector Registration
- ADR-0027: Connector Is Technical Intermediary, Not Contracting Party
