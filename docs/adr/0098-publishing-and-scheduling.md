# ADR-0098: Publishing and scheduling

**Status:** Proposed (2026-08-23)

**Authorizes:** a `SocialConnector.publish?()` optional method, an `outbound_activities` `activity_type='post'`, and a `POST /v1/outbound/posts` endpoint that supports immediate or scheduled publishing across connected platforms.

**Source:** `docs/product-research/feature-designs/07-publishing-and-scheduling.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Composed posts need a real outbound path
`docs/product-research/feature-designs/07-publishing-and-scheduling.md` and `ADR-0075` describe a real outbound publishing capability for the Polypost Composer. `ADR-0072` built the composer UI and `ADR-0075` already authorized the basic publish contract. This ADR adds scheduling, asset targeting, and the `outbound_activities` audit shape.

### 2. Platforms vary in scheduling support
X/Twitter, Bluesky, and LinkedIn support immediate posting. Facebook Pages and Instagram support scheduled posting via their APIs. The connector abstraction must expose this as an optional capability.

### 3. `outbound_activities` already exists for replies
`ADR-0073` introduced `outbound_activities` for replies. Publishing is another `activity_type` that follows the same audit and retry pattern.

---

## Decision

### 1. `SocialConnector.publish?()` optional method
```ts
interface SocialConnector {
  // ... existing methods ...
  publish?(
    ctx: ConnectorContext,
    post: OutboundPost
  ): Promise<{ platformPostId: string; url: string }>;
}

interface OutboundPost {
  text: string;
  assets?: Array<{
    type: 'image' | 'video' | 'link-card';
    url?: string;                  // media URL, if pre-uploaded
    alt?: string;                  // alt text for images
    target?: string;               // e.g. Facebook Page, LinkedIn Page
  }>;
  scheduledFor?: string;            // ISO 8601; immediate if absent
  inReplyTo?: string;               // optional, for threaded publishing
}
```

- `publish?()` is optional. Connectors that do not support publishing return `ConnectorCapabilityError` if the UI tries to use them.
- Assets are uploaded by the connector where required; v1 supports text + link cards. Image and video upload are deferred per connector.

### 2. `scheduled_for` state in `outbound_activities`
```sql
ALTER TABLE outbound_activities ADD COLUMN scheduled_for timestamptz;
ALTER TABLE outbound_activities ADD COLUMN published_at timestamptz;
```

- `activity_type='post'`
- `status` can be `scheduled`, `publishing`, `published`, `failed`, or `cancelled`.
- `scheduled_for` is `null` for immediate posts.

### 3. `POST /v1/outbound/posts` endpoint
```ts
// Request
{
  text: string;
  assets?: OutboundPost['assets'];
  targetPlatforms: string[];        // e.g. ['linkedin', 'bluesky']
  scheduledFor?: string;
  assetTargets?: Record<string, string>; // platformId -> target asset/page id
}

// Response (HTTP 202)
{
  activityIds: string[];
  scheduledFor: string | null;
}
```

- The endpoint creates one `outbound_activities` row per target platform.
- For scheduled posts, the rows are `scheduled` and a scheduler worker dispatches them at `scheduled_for`.
- For immediate posts, the rows move to `publishing` and the connector is called synchronously.

### 4. Targeting by asset
- `assetTargets` lets the user pick which Facebook Page, LinkedIn Page, or Instagram account receives the post.
- The UI fetches available targets from `GET /v1/connectors/:platformId/targets` (pages, accounts, boards).
- If a platform has no target selected and one is required, the request returns `400 MISSING_ASSET_TARGET`.

### 5. Scheduling worker
- A lightweight worker runs every minute and picks up `outbound_activities` with `status='scheduled'` and `scheduled_for <= now()`.
- It calls the connector's `publish()` and updates `status` and `published_at`.
- If the connector is temporarily unavailable, the worker retries with the same policy as `ADR-0073`/`ADR-0075`.

### 6. Cancellation and reschedule
- `PATCH /v1/outbound/activities/:id/cancel` sets `status='cancelled'` for scheduled posts that have not yet been published.
- `PATCH /v1/outbound/activities/:id/reschedule` updates `scheduled_for`.

---

## Consequences

1. **Real outbound engagement:** the composer becomes a full publishing tool, not just a drafting tool.
2. **Scheduling capability:** users can queue posts for the optimal time.
3. **Reuses outbound audit:** publishing, replies, and CRM handoffs all share `outbound_activities`.
4. **Connector complexity:** each `SocialConnector` must opt into `publish?()` and handle platform-specific asset rules.

---

## Alternatives considered

1. **Use a third-party social-media management API (Buffer/Hootsuite) for publishing.**
   - *Rejected:* it adds a vendor and cost. Native platform APIs keep the platform self-contained and align with the connector framework.

2. **Store scheduled posts in a separate `scheduled_posts` table.**
   - *Rejected:* it duplicates `outbound_activities`. Adding `scheduled_for` and `status` to the existing table is simpler and consistent.

3. **Allow arbitrary scheduling in user timezones without storing UTC.**
   - *Rejected:* the scheduler runs on UTC. The UI converts the user's local time to `scheduled_for` and stores UTC, avoiding daylight-saving edge cases.

---

## Open questions

- Which platforms support `publish?()` in v1? Facebook, LinkedIn, X, Bluesky, Instagram?
- How are image/video uploads handled — pre-uploaded media URLs or platform-native multipart upload?
- Should the scheduler run in-process (like the ingestion scheduler) or as a separate worker/function?
- What is the maximum scheduling window (e.g. 30 days)?

## Resolved questions

Resolved 2026-08-23: **How are failed scheduled posts surfaced?**

When the scheduling worker marks an `outbound_activities` row as `failed`, the failure is surfaced in three places:

1. `GET /v1/outbound/posts?status=failed` (or `GET /v1/outbound/activities?status=failed`) returns the failed rows, including `error_code`, `failed_at`, and the originating `scheduled_for`.
2. A dedicated **Outbound Activity Log** screen or tab in the Tenant Admin UI reuses the same list and is filterable by `status`.
3. An optional, tenant-scoped in-app notification is generated when a scheduled post fails.

The scheduler itself is not expected to retry `failed` scheduled posts beyond the existing retry policy; a failed scheduled post must be corrected, rescheduled, or cancelled by the user.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0072` (Polypost Composer), `ADR-0073` (outbound replies), `ADR-0075` (outbound publishing), `ADR-0051` (connector activation)
