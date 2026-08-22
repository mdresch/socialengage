---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Multi-source ingestion

### What it is
The ability to pull public and owned content from more than one kind of source — social networks, news sites, RSS feeds, review sites, blogs, broadcast, and the open web — into a single normalized post stream.

### End-user benefits
- **One dashboard for the whole conversation** instead of switching between platform-native tools.
- **Context across channels:** a brand crisis or campaign can be tracked on X, in news coverage, on Reddit, and on owned Facebook Pages simultaneously.
- **Better coverage** of owned channels, competitors, and industry keywords.

### Core details
- Each source becomes a `SocialConnector` with a `poll()` loop, `authMode`, and `Author` modeling.
- A source capability matrix records which connectors support boolean watchlists, media, comments, or historical backfill.
- `IngestionRun` remains the audit anchor; each source posts into the same `social_posts` table with `provider_id` and `rawPayload`.

### Implementation complexity
**Medium per new connector.** The framework already exists (`ProviderConnector`, `SocialConnector`, `registry.ts`, live scheduler). Adding a new source is mostly: primary-source verify the API/RSS, model the `Author` and `SocialPost` mapping, rate-limit through `RequestGate`, and add the connector-specific `SKILL.md`. OAuth connectors (Instagram, LinkedIn, Facebook) are higher effort than RSS/API-key.

### Growth and reach
More sources means the product can replace more point tools. It is the primary lever for moving from a single-use listening tool to an enterprise intelligence platform.

---

## Technical design

- **Data flow:** external source (REST/RSS/OAuth) → `SocialConnector.poll()` → `RequestGate` (per-connector rate limit) → canonical `Author` and `SocialPost` normalization → `htmlToMarkdown()` body conversion → `social_posts` with `provider_id` and `rawPayload` → watchlist matching (`matchesWatchlist()` or connector-native AST) → `SocialPostIngestedEvent` on Service Bus for downstream consumers.
- **Component interactions:** `bootstrapConnectors()` in `pollScheduler.ts` enumerates active connectors by tenant and user; each connector implements the `ProviderConnector`/`SocialConnector` interfaces and reports health through `ingestion_runs`. Connector-specific `SKILL.md` files own each platform's API contract.
- **REST/Service Bus contracts:** `POST /v1/connectors/:platformId/activate|deactivate` (ADR-0065), `POST /v1/connectors/:platformId/connect|disconnect` for credentials (ADR-0028), `GET /v1/connectors/:platformId/health`, `GET /v1/ingestion_runs`, and `SocialPostIngestedEvent` / `ConnectorHealthChangedEvent` on Service Bus (Story 5.19).
- **Storage:** `social_posts` (tenant-scoped, JSONB `enrichment` + `rawPayload`), `ingestion_runs` (audit anchor), `authors` (normalized per platform), `connector_activations` (tenant/user ownership), and `platform_credentials` (Azure Key Vault–backed envelope encryption).
- **Security considerations:** RLS on every tenant-scoped table; OAuth tokens scoped per user (Tier 3) or tenant (Tier 2); no raw credential material in logs; rate-gating to prevent provider throttling/banning; optional tenant-owned feed DNS TXT ownership gate (ADR-0050).

## Backend principles

- **Single `social_posts` table for all sources.** Provider-specific shape collapses into a common `SocialPost` contract and `body_markdown` canonical text. Do not create per-source post tables.
- **Service boundaries.** Ingestion stays in `social-listening-core`. Connectors are independent, registry-discovered modules. The AI enrichment layer is also provider-agnostic.
- **Postgres + RLS.** `tenant_id` columns with row-level security; `connector_activations` gated by `platform_admin_role` for tenant-wide, user for Tier-3. `identity_resolver_role` used for `resolveIdentity()` before RLS context is set.
- **Rate limiting.** `RequestGate` enforces per-provider cadence, concurrency, and daily limits. Live polling has jitter and derived-cadence scheduling (Story 1.13/1.14).
- **Contract-test targets.** Each real connector must have a contract test proving `poll()` produces valid `SocialPost` objects, `IngestionRun` anchoring, `ConnectorHealth` transitions, and that `social_posts` respects RLS for the caller's `tenant_id`.

## Frontend / UI principles

- **User flow:** Tenant Admin selects "Connectors" → chooses a platform → enters credentials or OAuth flow → activates → sees health/last-run status and recent posts.
- **Component hierarchy:** `ConnectorGrid` (list of available connectors) → `ConnectorCard` (status, activate/deactivate, connect/disconnect) → `ConnectorSetupModal` (per-connector form) → `IngestionRunsTable` (audit view).
- **State management:** React state for setup wizard; server-state for connector list/health via `GET /v1/connectors`; optimistic toggles for activation.
- **Accessibility and responsive design:** Keyboard-focusable activation toggles, `aria-live` for health changes, mobile-friendly connector cards with clear error/help links.

## Open questions

- Which social connectors belong in v2 (Instagram, LinkedIn, Reddit, TikTok, YouTube)?
- How should media (images, video, carousels) be stored and rendered uniformly across connectors?
- What is the policy for historical backfill per connector, and does it count against paid quota?
- Should we build a unified cross-platform `Author` identity, or keep platform-local author records?
- What is the retry/alert policy when a connector's OAuth refresh token fails silently?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Which connectors in v2?** | Prioritize **Instagram, LinkedIn, and Reddit** for v2: they deliver the broadest brand/enterprise value and have documented platform APIs. Add **TikTok** and **YouTube** as v2.5 because short-form and video content are high-demand but have stricter data and API access rules. Defer Bluesky, Mastodon, and niche forums to v3 unless a customer commits. | Sprout Social's 2026 Q1 updates added Instagram, Facebook, Reddit, and TikTok listening; Sprinklr covers 30+ channels. Unified listening APIs such as Octolens and SocQ bundle Reddit, X, LinkedIn, YouTube, and TikTok as the core B2B/B2C set. |
| **Media storage and rendering?** | Store a single high-resolution canonical asset in Azure Blob Storage (JPEG ≤ 20 MB, MP4/MOV ≤ 500 MB) and derive platform-specific variants at publish time. For *listening*, preserve only the platform media URL plus a lightweight preview; do not transcode unless the user downloads. Enforce a platform capability matrix for max images, aspect ratio, and video duration. | HubSpot and Buffer note JPEG/MP4/MOV are the most widely supported formats. PostEverywhere's API documentation shows per-platform size, dimension, and aspect-ratio limits vary heavily, so a normalized base plus per-platform transform is the safest pattern. |
| **Historical backfill policy?** | Backfill must be an explicit, bounded user request with a date range and a maximum post cap. It **does** count against the tenant's monthly mention quota. Only allow backfill for sources that support it (e.g., X ~13 months, Reddit since 2017, news/blogs several years; Instagram is typically unavailable). Notify the tenant by email when the job completes. | Sprinklr's help docs show backfill availability varies by source and requires platform-specific API support. Lucidya and Keyhole explicitly count historical posts against the customer's post allowance and cap the volume. Agility PR's "Replay" feature for X warns that backfill counts toward the monthly quota. |
| **Unified `Author` identity?** | Keep platform-local `Author` records as the source of truth and build a soft, confidence-scored **author identity cluster** on top. Match by handle, display name, URL, and content similarity. Do not force a single master author record until a later phase; instead, expose the cluster as a derived view. | Identiq Labs, Shuuka, and Google for Creators all demonstrate that cross-platform author identity is a separate, hard problem solved by linking/verification layers rather than forcing a single canonical record. StorytellerOS keeps each pen name's per-platform accounts separate. |
| **OAuth refresh-token silent-failure policy?** | Treat refresh as a state machine, not a silent retry. (1) Proactively refresh 60–180 seconds before expiry with per-credential mutex/lock to avoid races; (2) map `invalid_grant` / 401 / 403 as **reauthorization required** and stop retrying; (3) map 5xx as retry-with-backoff and 429 as respect-`Retry-After`; (4) set `ConnectorHealth` to `failing` and alert the tenant/user to reconnect. Never silently fail. | EskiLab's OAuth refresh runbook recommends per-credential locks, proactive alarms, and controlled failure states. Truto emphasizes state-machine degradation and avoiding infinite retry loops. Google best practices require handling revocation and integrating with Cross-Account Protection where available. HubSpot's integration docs advise not to retry automatically on 401/403. |

### Sources consulted

- Octolens — https://octolens.com/social-listening-api
- Sprout Social 2026 Q1 product updates — https://sproutsocial.com/product-updates/2026-q1/
- PostEverywhere media requirements — https://developers.posteverywhere.ai/media-requirements
- HubSpot social post media guide — https://knowledge.hubspot.com/social/create-and-publish-social-posts
- Sprinklr help: historical backfills — https://www.sprinklr.com/help/articles/topic-management/historical-backfills-for-your-topics/63f772899b334f7283b4da52
- Lucidya help: historical data and post allowance — https://www.lucidya.com/help/request-historical-data
- Keyhole help: historical data and quotas — http://help.keyhole.co/en/articles/11658474-historical-data
- Identiq Labs — https://identiqlabs.com/
- Google for Creators Search Profile — https://creators.google/profile
- EskiLab OAuth token refresh runbook — https://eskilab.com/oauth-token-refresh-runbook-long-lived-integrations/
- Truto: handling OAuth token refresh failures — https://truto.one/blog/handling-oauth-token-refresh-failures-in-production-for-third-party-integrations
- Google OAuth best practices — https://developers.google.com/identity/protocols/oauth2/resources/best-practices
- HubSpot OAuth token management — https://developers.hubspot.com/blog/oauth-token-management-hubspot-integrations

## Persona acceptance

- **Tenant-Admin (primary):** can connect/activate a new source through a wizard, see a per-connector capability matrix, and understand which sources are healthy without reading code.
- **Sole-Operator (primary):** sees platform-wide connector counts, per-source ingestion volume, and rate-limit saturation on one screen; failures trigger an alert.
- **Tenant-User (primary):** sees a single, normalized post feed and can quickly identify which source each post came from.
- **Social-Selling-Strategist (primary):** can filter posts by source and author and export source-specific author lists for prospecting.
- **Platform-Admin (secondary):** sees platform-level active/suspended connector counts and cross-tenant error rates without accessing tenant data.

## AI enhancements

- **Source-quality scoring:** AI ranks sources by reliability, bias, and freshness before they are activated.
- **Duplicate/merge detection:** LLM + vector similarity to spot the same story across RSS, news, and social.
- **Content summarization:** long-form news or review articles are summarized before display in the post feed.
- **Auto-categorization:** incoming posts are pre-tagged by topic, source type, and urgency.
