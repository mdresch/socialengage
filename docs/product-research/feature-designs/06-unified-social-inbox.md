---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Unified social inbox

### What it is
A single, team-owned view of all mentions, comments, DMs, and replies that need a human response, with triage, assignment, and status tracking.

### End-user benefits
- **Faster response times:** one place to see everything that needs action.
- **Accountability:** assign mentions to owners and track resolution.
- **Audit trail:** every reply and its outcome is recorded.

### Core details
- The outbound foundation is already being built: `outbound_activities` (Stories 3.14/3.15) and `SocialConnector.reply?()` (Stories 2.26/2.27, 6.38).
- An inbox is essentially a tenant-scoped view over `outbound_activities` plus incoming mentions that require a response.
- Needs `assignment` status, `owner`, `priority`, and `resolution` columns on top of `outbound_activities`.

### Implementation complexity
**High.** It requires reply/publish to be real, per-connector `reply?()` implementations, an inbox UI, assignment workflows, and real-time update mechanics. It is the most expensive feature on this list.

### Growth and reach
The inbox is what turns listening into social care and community management. It is the bridge to larger support, marketing, and customer-success teams.

---

## Technical design

- **Data flow:** inbound mention arrives via `SocialPostIngestedEvent` → `InboxItem` is derived for posts that need response (mentions, DMs, comments) → user triages in inbox → `POST /v1/outbound/activities` with `activity_type='reply'` and `parent_social_post_id` → `SocialConnector.reply?()` dispatches to platform → reply is stored in `outbound_activities` and linked back to the original post.
- **Component interactions:** the inbox reuses `outbound_activities` (Story 3.15, ADR-0075) and adds `assignment`/`status` columns. `SocialConnector` gains an optional `reply?()` method; connectors without it return a clear unsupported error.
- **REST/Service Bus contracts:** `GET /v1/inbox` (filtered by status/owner/priority), `POST /v1/inbox/:id/assign`, `POST /v1/inbox/:id/resolve`, `POST /v1/outbound/activities` for replies, `SocialPostIngestedEvent` and `OutboundActivityCompletedEvent`.
- **Storage:** `outbound_activities` with new columns: `inbox_status`, `assigned_to_user_id`, `priority`, `parent_social_post_id`, `resolution_note`; `social_posts` for the original mention.
- **Security considerations:** RLS on `outbound_activities` and `social_posts`; only users with the right connector asset can reply; audit every assignment and reply.

## Backend principles

- **Extend `outbound_activities`, do not create a parallel table.** Reuse the publishing/scheduling table because a reply is just another outbound activity with a `parent_social_post_id`.
- **Connector `reply?()` is optional.** Not every platform supports public replies. The framework must fail gracefully.
- **Postgres + RLS.** `outbound_activities` is already tenant-scoped. Add `assigned_to_user_id` and `inbox_status` with RLS and policy for user assignment.
- **Contract-test targets.** Verify that a mention becomes an inbox item, that assignment and resolution update status, that a reply is linked to the parent post, and that unauthorized users cannot reply to another tenant's mention.

## Frontend / UI principles

- **User flow:** inbox shows unread/assigned items → user filters by source/sentiment/priority → selects an item → views thread → composes reply → marks resolved.
- **Component hierarchy:** `InboxPage` → `InboxFilters` → `InboxList` → `InboxThreadPanel` (post + reply composer + resolution) → `ReplyComposer`.
- **State management:** Server-side pagination with real-time updates; client state for filters and selected item.
- **Accessibility and responsive design:** Inbox list supports arrow-key navigation; reply composer has a clear focus trap; status changes are announced via `aria-live`; mobile uses a split-pane with list and detail.

## Open questions

- Which connectors support replies (Facebook, X, LinkedIn, Instagram)?
- Should DMs and comments be in the same inbox or separate queues?
- How do we mark a post as "needs response" automatically vs. manually?
- Do we need real-time inbox updates via WebSocket or is polling acceptable?
- What is the SLA/alerting model for unresolved high-priority items?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Which connectors support replies?** | Make `SocialConnector.reply?()` **optional**. v1: **Facebook Pages and X** are the most mature reply targets. LinkedIn has limited API reply support; Instagram DMs are harder and should be deferred. Fail gracefully for unsupported connectors. | Meta Graph API supports public comments/replies; X API supports replies; LinkedIn and Instagram have more restrictive or private-messaging APIs. |
| **DMs and comments in same or separate queues?** | **One unified queue** with `source_type` and `is_private` tags, plus filters/views for DMs vs. comments. Teams need a single triage surface; the routing rule differs (public acknowledge then DM vs. private resolution). | Sift AI and VOC.AI both recommend a unified inbox with tagging and routing; iDesk360 aggregates comments, Messenger, and reviews into one dashboard. |
| **Auto vs. manual "needs response"?** | **Hybrid**. Auto-tag using rules: negative sentiment, complaint keywords, @mentions, high-reach author, and AI-predicted intent. Allow manual override. Queue anything not auto-tagged as "monitoring." | VOC.AI triage matrix; Sift AI says priority should be set before reply; iDesk360 uses auto-replies and tagging. |
| **WebSocket or polling?** | **Polling at 15–30 seconds is acceptable for v1**. Move to **Server-Sent Events (SSE)** or webhooks over Service Bus in v2 for near-real-time. WebSockets are overkill for one-way inbox updates. | TwitterAPI.io table shows polling is fine for low-medium urgency; Veld recommends SSE for one-way feeds; ADHDecode notes WebSocket fan-out complexity. |
| **SLA/alerting model?** | Priority-based: **public complaints ≤ 2 hours**, **high-priority/escalation ≤ 30 minutes**, **general feedback ≤ 24 hours**. Use an escalation rule that reassigns after half the SLA. | Ordinal recommends < 2 hours for public-facing channels and 30-minute handoffs; iDesk360 uses auto-replies for off-hours; Tareno/Apaya set per-stage SLAs. |

### Sources consulted

- Sift AI: social media support guide — https://www.getsift.ai/blog/social-media-support/
- VOC.AI: customer service workflow — https://www.voc.ai/blog/social-media-customer-service-response-workflow
- Ordinal: how to use social media for customer service — https://www.tryordinal.com/blog/how-to-use-social-media-for-customer-service
- iDesk360: social media customer service best practices — https://idesk360.com/blog/social-media-customer-service-best-practices
- TwitterAPI.io: monitoring X via API — https://twitterapi.io/blog/monitoring-twitter-via-api-guide
- Veld Systems: real-time feed updates — https://veldsystems.com/blog/building-activity-feeds-social-features
- ADHDecode: real-time feed system design — https://adhdecode.com/system-design/design-a-social-feed/real-time-feed-updates/
- SocialAPI.ai: unified social inbox API — https://social-api.ai/blog/unified-social-inbox-api

## Persona acceptance

- **Tenant-Social-Care-Agent (primary):** sees one triaged queue with SLA timers, can assign/escalate an item, and reply directly from the inbox composer.
- **Tenant-User (primary):** can view assigned conversations, see connector-specific reply options, and mark items resolved with a clear audit trail.
- **Tenant-Brand-Reputation-Manager (secondary):** can route high-risk mentions into the inbox for triage and coordinate a public/private response.
- **Tenant-Admin (secondary):** can configure inbox workflows and permissions without touching code.

## AI enhancements

- **Reply suggestions:** generate context-aware reply drafts for the inbox composer.
- **Tone and style adaptation:** adjust the draft to be formal, friendly, or apologetic.
- **Urgency and intent routing:** the AI predicts which messages need the fastest response and to whom they should be assigned.
- **Crisis/escalation scoring:** flag a conversation that is likely to escalate before it does.
