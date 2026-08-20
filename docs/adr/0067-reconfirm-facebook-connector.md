# ADR-0067: Facebook Connector (`facebook`) — Platform Connector Approval

**Status:** Proposed (2026-08-19)

**Source:** Follow-up to ADR-0064 (Location and geospatial insights), ADR-0065/0066 (Active sourcing connectors), and Epic 2/3 connector architecture. This ADR evaluates the feasibility of adding a native Facebook connector using the Meta Graph API.

## Context

### Platform API surface

Facebook exposes content via the [Meta Graph API](https://developers.facebook.com/docs/graph-api). Access to public content is heavily restricted compared with legacy APIs:

- **Pages:** Public Page posts can be retrieved via the Graph API using a Page access token. This is the most stable and permissioned path.
- **Groups:** Group content access requires App Review and is typically restricted to approved use cases; many groups are not accessible via the public Graph API for listening use cases.
- **User profiles:** Personal user posts are not accessible via the Graph API without explicit user consent and granular permissions. Access to friends' or general user timelines is not available for third-party listening.
- **Location data:** Some posts can be tagged with a `place` object. When present, a Place may include country-level information, but this is attached to a small fraction of posts. Precise coordinates are extremely rare and not reliably exposed for public content.

### Alignment with project scope

The project has three real connectors (`gnews`, `newswire`, `tenant-owned-feed`). Facebook is a candidate social platform connector. To remain consistent with prior decisions, any Facebook ingestion must:

- Only ingest content that is accessible via approved Graph API endpoints (no scraping).
- Follow the canonical mapping to `SocialPostSummary` (ADR-0054).
- Follow the country-level-only geo policy (ADR-0064) — extract `place.country` only when present, otherwise set `geo_country = null`.
- Respect author-rights posture (ADR-0004/ADR-0024/ADR-0026/ADR-0050) by treating the Page/author as presented by the API.

## Decision

### 1. Connector definition

A new connector `facebook` is introduced with the following scope:

- **Ingestion target:** **Facebook Pages only** for v1. Group posts and personal user posts are **not** ingested.
- **Endpoint:** `GET /{page-id}/posts` (Graph API v21.0 or current LTS) to retrieve public Page posts. Additional fields requested: `id`, `message`, `created_time`, `permalink_url`, `place`, `from`, `attachments`.
- **Provider ID:** `facebook`

### 2. Authentication and credentials

- **Authentication:** Page access token. Long-lived Page access tokens are preferred for scheduled polling.
- **Credential storage:** Stored in the platform credential vault (Tier-2 platform credentials, ADR-0028). Tokens are stored per tenant (or per configured Page) and never logged.
- **Permissions:** Requires `pages_read_engagement` (minimum) to read Page posts. The tenant must explicitly authorize the specific Pages to be ingested (no broad account-wide scraping).

### 3. Mapping to canonical schema

| Graph API field | `SocialPostSummary` field | Notes |
|---|---|---|
| `id` | `externalId` | Normalised to `facebook_{pageId}_{postId}` or just the Graph API post ID. |
| `permalink_url` | `url` | Canonical URL to the Facebook post. |
| `message` | `bodyMarkdown` | Primary text content. If empty, fall back to `attachments` description if present. |
| `created_time` | `publishedAt` | Parsed to ISO 8601 UTC. |
| `from.name` / `from.id` | `author` / metadata | Use Page name as author (consistent with organization-as-author posture). Store Page ID in metadata. |
| `place` | Geo fields | If `place.country` exists (ISO 3166-1 alpha-2 or name), map to `geo_country` (uppercase ISO alpha-2), `geo_source = 'post'`, `geo_confidence = 'high'`. Otherwise `geo_country = null`, `geo_source = 'unknown'`. **Discard** `place.location` (lat/lon), bounding box, and place name. (per ADR-0064) |
| — | `providerId` | `facebook` |

### 4. Deduplication, rate limits, and ingestion behaviour

- **Deduplication:** URL-based / external ID based via `(tenant_id, providerId, externalId)` uniqueness constraint (ADR-0005).
- **Rate limits:** Graph API enforces rate limits (app-level and Page-level). The connector implements exponential backoff with jitter on `429`/`5xx`, respects `X-App-Usage`/platform headers where available, and staggers polling across configured Pages.
- **Polling:** Scheduled polling of configured Pages (not real-time webhook ingestion) for v1. Webhooks can be evaluated in future if tenant demand exists.
- **Scope control:** Only explicitly configured Page IDs are ingested. No discovery of arbitrary Pages.

### 5. Enrichment

Facebook Page posts flow through the existing enrichment pipeline (`azureOpenAiConnector.ts`, ADR-0038) with no connector-specific changes. Language is detected via enrichment (ADR-0055) and may be informed by post text.

## Consequences

**Positive**

- **Adds a major platform:** Provides coverage of Facebook Page content, which is often a source of brand/organizational updates relevant to watchlists.
- **Clean, permissioned scope:** Restricting to Pages avoids the significant privacy/permission risks of personal profiles and groups.
- **Consistent with geo policy:** Uses only `place.country` when present and discards precise location data.
- **Reuses infrastructure:** Leverages existing ingestion runner, deduplication, enrichment, and ADR-0063 watchlist linking when posts are discovered via other means (or when watchlists are evaluated against incoming Facebook posts).

**Negative**

- **Limited coverage:** Does not ingest groups or personal user content. Many relevant conversations occur outside public Pages.
- **Sparse geo:** `place.country` is rare. Most Facebook Page posts will have `geo_country = null` ("Unknown").
- **API gating:** Graph API access requires App Review for certain permissions if scaled, and long-lived tokens require careful rotation/management.
- **Rate limiting:** Can be restrictive at higher polling volumes across many Pages.

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Scrape public Facebook Pages** | Rejected. Violates Meta Terms of Service and is brittle. |
| **Ingest groups or user content** | Rejected for v1 due to permission restrictions and privacy considerations. |
| **Attempt to infer geo from Page location** | Rejected. Page location is often the organization's headquarters, not the location of the post/event being discussed. Could be misleading. Only post-level `place.country` is used. |

## Open Questions

1. **Page configuration model:** Should tenants configure Page IDs explicitly in the admin UI, or can they search for Pages? Explicit configuration is preferred for v1 to avoid unintended scope creep.
2. **Webhook vs polling:** Is there a demonstrated need for near-real-time ingestion of Page posts? Polling is sufficient for v1; webhooks can be deferred.
3. **Attachment handling:** How should link previews, images, or videos from `attachments` be represented in `SocialPostSummary`? Body text is sufficient for v1, but richer representation may be needed later.

---

