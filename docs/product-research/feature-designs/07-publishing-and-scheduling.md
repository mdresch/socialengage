---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Publishing and scheduling

### What it is
Composing, previewing, scheduling, and publishing outbound posts to one or more connected social assets from within the same tool that handles listening.

### End-user benefits
- **One workflow:** no need to switch to Hootsuite/Buffer for outgoing content.
- **Multi-asset dispatch:** write once, publish to multiple Facebook Pages or LinkedIn profiles.
- **Planned cadence:** queue content in advance and view it alongside inbound listening.

### Core details
- ADR-0075 and Story 2.28–2.30, 3.15, 6.39 already define the architecture: `SocialConnector.publish?()`, `POST /v1/outbound/posts`, `outbound_activities` `activity_type='post'`, and `target_asset_id`.
- A `scheduled_for` column on `outbound_activities` enables deferred publishing once a background scheduler exists.
- The Polypost Composer (ADR-0072) is the authoring surface.

### Implementation complexity
**High.** Beyond the core endpoint, each platform needs OAuth scope verification, per-asset targeting, rate-limit gating, media upload, and preview rendering. Facebook is the v1 target; LinkedIn/others follow.

### Growth and reach
Publishing makes SocialEngage a full social media management suite, not just a listening tool. It competes directly with Sprout Social, Hootsuite, and Sprinklr.

---

## Technical design

- **Data flow:** user creates a post in the Polypost Composer → `POST /v1/outbound/posts` with `targets[]` (asset IDs) and `perPlatformOverrides` → backend validates OAuth scopes and rate limits → stores a row in `outbound_activities` with `activity_type='post'`, `status='pending'`, `scheduled_for` or `publish_immediately` → a background scheduler polls pending rows and calls `SocialConnector.publish?()` per target → platform returns platform-specific post ID → status updated to `sent` or `failed`.
- **Component interactions:** `PolypostComposer` (ADR-0072) → `outboundPostsRouter` → `outbound_activities` store → `publishScheduler` → `SocialConnector` implementations (Facebook v1, LinkedIn next). Existing `RequestGate` enforces platform rate limits.
- **REST/Service Bus contracts:** `POST /v1/outbound/posts`, `GET /v1/outbound/posts` (list), `DELETE /v1/outbound/posts/:id` (cancel if not yet sent), `OutboundActivityCompletedEvent` on Service Bus.
- **Storage:** `outbound_activities` table (tenant-scoped, RLS) with `activity_type='post'`, `target_asset_id`, `scheduled_for`, `status`, `per_platform_overrides`, `media_keys`, `result_id`, and `error_message`.
- **Security considerations:** RLS; OAuth scope verification per platform; media uploaded to temporary Azure Blob store and scoped to tenant; no cross-tenant publishing; rate gating by connector.

## Backend principles

- **One canonical message, many per-asset variants.** `outbound_activities` stores a single `outbound_message` and `perPlatformOverrides` per target. This matches Sprinklr's "All Channels" and Hootsuite's per-network composer patterns.
- **Background scheduler deferred to v1.5.** v1 can publish immediately or set `scheduled_for` and have a simple cron/polling loop (story 2.28). A true queue and retry scheduler is a later enhancement.
- **Postgres + RLS.** `outbound_activities` is `tenant_id`-scoped; only Tenant Admins or delegated publishers can create posts. `target_asset_id` must be an asset the caller owns or has permission to use.
- **Contract-test targets.** Verify `POST /v1/outbound/posts` validates OAuth scopes, rejects missing required fields, cancels a pending post, and that `SocialConnector.publish?()` produces a platform-specific result.

## Frontend / UI principles

- **User flow:** user opens Polypost Composer → selects target assets → writes message → previews per platform → schedules or publishes → views calendar/queue.
- **Component hierarchy:** `PolypostComposer` → `AssetSelector` → `MessageEditor` → `PlatformPreviews` → `SchedulePicker` → `PublishingCalendar`.
- **State management:** React state for composer; server state for scheduled posts and calendar; optimistic updates for publish/cancel.
- **Accessibility and responsive design:** Preview tabs are keyboard navigable; date picker supports timezone selection; error messages are explicit and actionable; calendar is responsive with list/week/month views.

## Open questions

- Which platform is the v1 target for `SocialConnector.publish?()` (Facebook Pages vs. LinkedIn)?
- How should we handle media upload size and format limits per platform?
- Should the scheduler live in `pg_cron`, a long-running worker, or Azure Functions?
- What is the approval workflow before a post is sent (draft → pending approval → scheduled)?
- Do we need a separate `outbound_messages` table, or is the current `outbound_activities` shape sufficient for v1?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **v1 `publish?()` target?** | **Facebook Pages** is the v1 target. It is the most mature Graph API, supports text/link/image posts, and the project already has the Facebook connector. **LinkedIn** is the next v1.5 target. Add other platforms as v2. | Sprinklr, Hootsuite, and Buffer all support Facebook Pages and LinkedIn as primary publishing targets; the Meta Graph API is well-documented for page posts. |
| **Media upload limits?** | Store a **single canonical high-res asset** (JPEG ≤ 20 MB, MP4 ≤ 500 MB) in Azure Blob and enforce a per-platform **media capability matrix** before dispatch. Downscale/derive per-platform variants at publish time; do not store every variant. | PostEverywhere's API lists per-platform image/video limits; Bundle.social's API matrix covers max images, size, aspect ratio per post type; Sprout Social's video spec guide shows how platforms differ. |
| **Scheduler infrastructure?** | Use `pg_cron` in v1, but **not as a fire-and-forget job**. Run it every minute to poll `outbound_activities` and use `SELECT ... FOR UPDATE SKIP LOCKED` to claim pending posts. This gives idempotency and retries. v2 can move to a dedicated long-running worker or Azure Functions for richer observability. | Supabase/Runhooks warn that `pg_cron` has no retries and is coupled to the DB; Crontap notes `pg_cron` is fine for SQL but not for HTTP that must succeed. The project already uses `pg_cron` for `AuthorTopicSignal` refresh. |
| **Approval workflow?** | Implement a **configurable state machine**: Draft → Pending Review → Approved → Scheduled → Published/Failed. v1: approval is off by default; one approver per post; version history stored in `outbound_activities` audit columns. Enterprises can enable multi-stage review. | Hootsuite/Kontentino describe the same stages; Postly calls it a state machine with ACID-like checks; Apaya says routing by post type is better than one queue; Tareno stresses clear ownership and automation after approval. |
| **Separate `outbound_messages` table?** | **No.** Extend `outbound_activities` with `message_body`, `per_platform_overrides`, and `media_keys`. The table already has status, audit, and scheduling columns. Split into `outbound_messages` only if message content is reused across many activities (e.g., a campaign with many targets). | Apaya and Kontentino keep the draft/approval/scheduled lifecycle in one place to avoid version drift and copy-paste errors. |

### Sources consulted

- Hootsuite: social media approval workflow — https://blog.hootsuite.com/social-media-approval-workflow/
- Kontentino: social media approvals — https://www.kontentino.com/blog/social-media-approvals-workflow/
- Postly: safe social publishing workflow — https://blog.postly.ai/designing-a-safe-social-publishing-workflow-with-approval-systems/
- Apaya: enterprise social media approval — https://apaya.com/blog/enterprise-social-media-approval-workflow
- Tareno: social media approval workflow — https://tareno.co/resources/blog/social-media-approval-workflow-avoid-delays-mistakes-chaos
- PostEverywhere media requirements — https://developers.posteverywhere.ai/media-requirements
- Bundle.social: media requirements by platform — https://bundle.social/blog/social-media-api-media-requirements
- Sprout Social video specs guide — https://sproutsocial.com/insights/social-media-video-specs-guide/
- Runhooks: scheduling Supabase edge functions without pg_cron — https://runhooks.app/blog/schedule-supabase-edge-functions-without-pg_cron/
- Crontap: Supabase cron jobs guide — https://crontap.com/guides/supabase-cron-jobs

## Persona acceptance

- **Tenant-User (primary):** can compose a post, select target assets, preview per-platform rendering, and publish or schedule without engineering help.
- **Tenant-Social-Care-Agent (primary):** can queue rapid public replies and private DMs from the inbox into the publishing workflow.
- **Tenant-Admin (secondary):** can enable approval workflows, see a queue of pending/scheduled posts, and cancel or reschedule them.
- **Tenant-Brand-Reputation-Manager (secondary):** can ensure crisis-response content goes through approval before it is published.

## AI enhancements

- **AI copy assistance:** rephrase, shorten, expand, or adjust tone in the Polypost Composer (ADR-0072).
- **Deep research agent:** one-off Brave/Bing research summarized for the author (ADR-0076).
- **Optimal send-time prediction:** learn from historical engagement per asset and recommend the best slot.
- **Per-platform adaptation:** auto-tailor length, hashtags, and mentions for each target network.
- **Alt-text generation and image suitability review:** AI suggests accessible text and warns if an image may violate platform rules.
- **Post-performance preview:** a simulated prediction of engagement before publishing.
