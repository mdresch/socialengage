# ADR-0068: Instagram Connector (`instagram`) — Platform Connector Approval

**Status:** Proposed (2026-08-19)

**Source:** Follow-up to ADR-0067 (Facebook connector). Instagram content is accessed via the same Meta Graph API surface (Instagram Graph API) for Business and Creator accounts.

## Context

### Platform API surface

Instagram's public content access for third-party ingestion is limited to **Instagram Business** and **Instagram Creator** accounts connected to a Meta Business portfolio:

- **IG Business/Creator accounts:** Media can be retrieved via Instagram Graph API (`/{ig-user-id}/media`) when the account is connected to a Facebook Page and has appropriate permissions.
- **Personal accounts:** Not accessible via Instagram Graph API. Legacy Instagram API endpoints for personal content have been deprecated.
- **Location data:** Media can be tagged with a location (Place). When present, the Place may include country-level information, but this is rare. Precise coordinates are not reliably exposed.
- **Comments/reels:** Accessible with additional permissions but v1 scope is limited to media posts.

### Relationship to Facebook

Instagram Graph API requires a connection to a Facebook Page. Authentication and credential management are closely related to ADR-0067.

## Decision

### 1. Connector definition

A new connector `instagram` is introduced with scope:

- **Ingestion target:** Instagram Business and Creator accounts only. Personal Instagram accounts are **not** ingested.
- **Endpoint:** `GET /{ig-user-id}/media` (Instagram Graph API) requesting fields: `id`, `caption`, `media_type`, `media_url`, `permalink`, `timestamp`, `username`, `owner`, `location`.
- **Provider ID:** `instagram`

### 2. Authentication and credentials

- **Authentication:** Uses a Page access token with permissions to access the connected IG Business/Creator account. The IG account must be linked to a Facebook Page.
- **Credential storage:** Same vault as ADR-0067 (Tier-2 platform credentials, ADR-0028), stored per tenant/configured account.
- **Permissions:** Requires `instagram_basic` and `pages_read_engagement` (and related permissions as required by current Graph API version). Configuration is per IG account.

### 3. Mapping to canonical schema

| Graph API field | `SocialPostSummary` field | Notes |
|---|---|---|
| `id` | `externalId` | Normalised to `instagram_{igUserId}_{mediaId}`. |
| `permalink` | `url` | Canonical link to the Instagram post. |
| `caption` | `bodyMarkdown` | Primary caption text. May be empty. |
| `timestamp` | `publishedAt` | Parsed to UTC. |
| `username` / `owner` | `author` / metadata | Use IG username as author. Store IG user ID in metadata. |
| `location` | Geo fields | If `location.country` exists, map to `geo_country` (uppercase ISO alpha-2), `geo_source = 'post'`, `geo_confidence = 'high'`. Otherwise `geo_country = null`, `geo_source = 'unknown'`. **Discard** `location.latitude`/`longitude`, place name, and place ID (ADR-0064). |
| `media_type` | Metadata | Stored in post metadata (image/video/carousel) for display context; not required for core `SocialPostSummary` fields. |
| — | `providerId` | `instagram` |

### 4. Deduplication, rate limits, and ingestion

- **Deduplication:** Via `(tenant_id, providerId, externalId)` (ADR-0005).
- **Rate limits:** Subject to Graph API rate limits (shared with Facebook). Same backoff strategy as ADR-0067.
- **Scope:** Only explicitly configured IG Business/Creator accounts are ingested. No personal profiles.
- **Polling:** Scheduled polling of configured accounts for v1.

### 5. Enrichment

Flows through existing enrichment pipeline (ADR-0038, ADR-0055). Captions are typically shorter than news articles, but enrichment still produces key phrases, sentiment, and language where sufficient text exists.

## Consequences

**Positive**

- **Covers a key visual platform:** Instagram is widely used for brand content and campaign announcements.
- **Permissioned scope:** Restricts to Business/Creator accounts, avoiding personal profile access.
- **Consistent architecture:** Reuses Facebook/Graph API credential model and ingestion patterns.

**Negative**

- **Limited to Business/Creator:** Excludes personal accounts and most organic UGC outside business profiles.
- **Sparse geo:** Location tags are rare on IG media. Most posts will be "Unknown".
- **Short text:** Captions are often short (or empty), which can reduce enrichment signal quality for some posts.
- **Setup complexity:** Requires linking IG account to a Facebook Page and proper permissions.

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Ingest personal Instagram content** | Rejected. Not supported by current Graph API and not feasible under platform policies. |
| **Scraping public IG profiles** | Rejected. Violates Meta Terms of Service. |
| **Infer geo from account profile** | Rejected. Profile location is free-text and not post-specific. Only post-level location tag is used (ADR-0064). |

## Open Questions

1. **Account discovery:** Should tenants be able to select from their connected IG accounts, or must they enter IG user IDs manually? UI-driven selection is preferable but depends on available permissions.
2. **Reels & carousels:** Should carousel albums and reels be ingested as single posts (representative) or as separate items? v1: ingest the media object as returned (one row per media item) with its permalink and caption.
3. **Story content:** Instagram Stories are ephemeral and not available via the standard `/media` endpoint in a way suitable for persistent listening. Excluded from v1.

---

