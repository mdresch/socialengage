---
feature: publishing_scheduling
source: docs/product-research/feature-designs/07-publishing-and-scheduling.md
generated: 2026-08-22
research_type: Deep Feature Research Brief
---

# Deep Research Brief — Publishing and Scheduling

## Feature summary

Publishing and scheduling is the ability to compose, preview, schedule, and dispatch outbound posts to one or more connected social assets from within the same tool that handles listening. In SocialEngage this is the bridge from a passive intelligence tool to an active social media management suite, building on the `SocialConnector.publish?()` contract and the `outbound_activities` table proposed in ADR-0075.

## Competitive context

| Product | Support level | Standout notes |
|---|---|---|
| **Sprinklr** | Core (yes) | Advanced Publisher across 30+ channels, Digital Asset Manager, Smart Scheduling (AI-recommended times based on 5 engagement metrics), recurring posts, targeting/gating. |
| **Sprout Social** | Core (yes) | Compose with per-network customization, Sprout Queue, optimal send times (ViralPost 2.0), approval workflows, calendar sharing, 13-month scheduling horizon. |
| **Hootsuite** | Core (yes) | Per-network tailoring, bulk scheduling up to 350 posts via CSV, recommended posting times, content calendar with gaps/heatmap, collaboration/approval. |

## Feature-to-feature correlations

Products with `publishing_scheduling` also strongly support the following features. These are the capabilities a multi-network publishing surface typically sits next to:

| Feature | Co-occurrence | Interpretation |
|---|---|---|
| `multi_source_ingestion` | 3/3 | A true suite listens and publishes across the same set of channels. |
| `ai_sentiment_analysis` | 3/3 | Sentiment data helps decide what to publish and when. |
| `ai_topic_clustering` | 3/3 | Trend discovery feeds content ideation and campaign timing. |
| `unified_social_inbox` | 3/3 | Publishing and response are two sides of the same engagement workflow. |
| `dashboards_analytics` | 3/3 | Analytics validate publishing cadence and content performance. |
| `real_time_alerts` | 3/3 | Publishing windows can be paused or accelerated based on alerts. |
| `data_export` | 3/3 | Exported content calendars and reports are expected by agencies/enterprise. |
| `api_integrations` | 3/3 | API and CRM/BI ties are critical for distributed marketing. |
| `multi_user_workspaces` | 3/3 | Approval, roles, and tenant/client separation are essential for teams. |
| `boolean_query_builder` | 1/3 | Deep listening queries are less tightly coupled to publishing. |
| `influencer_discovery` | 1/3 | Influencer outreach is a separate use case from scheduled posts. |

## Dependency graph

```mermaid
graph TD
    P[publishing_scheduling] -->|builds on| O[outbound_activities]
    P -->|builds on| SC[SocialConnector.publish?()]
    P -->|builds on| TA[target_asset_id]
    P -->|builds on| PC[Polypost Composer]
    P -->|enables| U[unified_social_inbox]
    P -->|enables| A[ai_topic_clustering content ideation]
    P -->|enables| D[dashboards_analytics performance]
    P -->|enables| R[real_time_alerts pause/resume]
    P -->|enables| DE[data_export content calendar]
    P -->|correlates with| MS[multi_source_ingestion]
    P -->|correlates with| S[ai_sentiment_analysis]
    P -->|correlates with| M[multi_user_workspaces RBAC]
    S1[Sprinklr] -->|implements| P
    S2[Sprout Social] -->|implements| P
    S3[Hootsuite] -->|implements| P
```

## Source findings

### 1. Sprinklr — Social Media Publishing & Engagement platform

- **URL:** https://www.sprinklr.com/products/social-media-management/social-media-publishing-platform/
- **Type:** Product marketing / feature overview
- **Key findings:**
  - Supports 30+ social and messaging channels from one publisher.
  - Includes Digital Asset Manager for content, media, approvals, and bulk uploads.
  - AI-recommended scheduling and the ability to add any new channel in weeks.
- **Relevance to SocialEngage:** The connector-first architecture already maps to "add any new channel"; the gap is the authoring surface, asset manager, and smart scheduling.

### 2. Sprinklr Help — Publish content on multiple channels at once

- **URL:** https://www.sprinklr.com/help/articles/content-creation/publish-content-on-multiple-channels-at-once/64c0c0b34b22892bd5a1ea15
- **Type:** Product help / how-to
- **Key findings:**
  - "All Channels" view lets a user create one message and then customize per channel before scheduling.
  - Accounts can be scheduled at different times from the same message.
  - Channel-specific mandatory fields block scheduling if incomplete.
- **Relevance to SocialEngage:** Validates the `perPlatformOverrides` and `target_asset_id` fields in ADR-0075.

### 3. Sprinklr Help — Smart Scheduling

- **URL:** https://www.sprinklr.com/help/articles/leverage-ai-in-publishing/smart-scheduling/63fef0d532d12b63c5f55c51
- **Type:** Product help
- **Key findings:**
  - Smart Scheduling uses 30 days of per-account historical data.
  - Scores every hour of the day using Share, Comment, Like, Impression, and Fan Count.
  - Recommends time slots in the next 7 days and respects already-scheduled posts.
- **Relevance to SocialEngage:** A future v2 enhancement; for v1, storing `scheduled_for` and a simple queue is enough, but the scoring model should not be hardcoded into the first release.

### 4. Sprout Social — Social Media Scheduling & Publishing

- **URL:** https://sproutsocial.com/features/social-media-publishing/
- **Type:** Product marketing
- **Key findings:**
  - Calendar-based planning across profiles and networks.
  - Collaboration notes, approval workflows, and calendar sharing with external stakeholders.
  - Product links and tags can be added to scheduled posts.
- **Relevance to SocialEngage:** Confirms that approval and calendar collaboration are expected at the mid-market level; not in v1 but should not be designed out.

### 5. Sprout Social Support — How can I customize my social posts using Compose?

- **URL:** https://support.sproutsocial.com/hc/en-us/articles/360000095183-How-can-I-customize-my-social-posts-using-Compose
- **Type:** Product help
- **Key findings:**
  - Compose supports "Schedule Manually", "Sprout Queue", and message duplication.
  - Optimal Send Times are plan-gated and timezone-aware.
  - Up to 13 months of advance scheduling and 10,000 scheduled messages.
- **Relevance to SocialEngage:** A `scheduled_for` timestamp and a queue abstraction are the two core data shapes to support; plan-gating optimal send is a later monetization/scope decision.

### 6. Hootsuite — Publishing platform

- **URL:** https://www.hootsuite.com/platform/publishing
- **Type:** Product marketing
- **Key findings:**
  - Bulk scheduling for up to 350 posts via CSV.
  - Best-time-to-post heat maps by goal.
  - Suspend scheduled posts during a crisis or opportunity.
- **Relevance to SocialEngage:** Bulk scheduling and crisis pause are enterprise-grade capabilities that should be deferred but not precluded by v1 schema.

### 7. Hootsuite Help — Create and publish posts

- **URL:** https://help.hootsuite.com/s/article/create-publish
- **Type:** Product help
- **Key findings:**
  - Per-network customization of text, mentions, hashtags, and media.
  - Drafts, immediate publish, and scheduled publish from the same composer.
  - No support for event posts or polls.
- **Relevance to SocialEngage:** The "compose once, customize per asset" pattern matches ADR-0075's `perPlatformOverrides`; the `no event posts/polls` boundary is a useful v1 out-of-scope reference.

### 8. HubSpot Knowledge — Create and publish social posts

- **URL:** https://knowledge.hubspot.com/social/create-and-publish-social-posts
- **Type:** Product help
- **Key findings:**
  - HubSpot's composer lets a user draft once, then customize for X, Facebook, LinkedIn, etc.
  - Supports publish now or schedule for later.
  - BETA "Optimize your social posts" offers AI-recommended publishing times.
- **Relevance to SocialEngage:** CRM-integrated publishing (HubSpot's angle) is not v1, but the multi-network composer and AI-recommended times are consistent with the Polypost Composer direction.

### 9. Buffer — Social Media Scheduler & Planner

- **URL:** https://buffer.com/publish
- **Type:** Product marketing
- **Key findings:**
  - Queue/calendar, per-platform customization, first-comment scheduling, 2,000 posts in advance.
  - Free plan limited to 10 posts per channel.
- **Relevance to SocialEngage:** Buffer's simplicity is the low-end benchmark; SocialEngage should not compete on free-tier volume but can match the core composer/queue/calendar pattern.

### 10. Fuxux — How to schedule social media posts

- **URL:** https://www.fuxux.com/blog/how-to-schedule-social-media-posts
- **Type:** Industry guide / best practices
- **Key findings:**
  - Best practice is to plan weekly, adapt per platform, and use a calendar.
  - Consistency, timezone targeting, batching, and per-platform native formatting are the main wins.
- **Relevance to SocialEngage:** Reinforces that the value of scheduling is consistency and platform-native adaptation, not simply cross-posting the same text.

## Implications for SocialEngage

1. **The v1 scope is well-aligned.** ADR-0075's text/link-card, immediate and `scheduled_for` posts, per-asset targeting, and Facebook-first implementation matches the common pattern across Sprinklr, Sprout, and Hootsuite. The competitors do more, but all of them start from the same primitives: a multi-channel composer, per-network overrides, and a scheduled queue.

2. **The data model should not assume one asset per post.** Sprinklr's "All Channels" and Hootsuite's per-network composer show that the canonical content is one message with many per-asset variants. ADR-0075's `perPlatformOverrides` and `targets` array is the right shape.

3. **Scheduling needs a clear queue/status model.** The `outbound_activities` table with `status` (`pending`, `sent`, `failed`, `cancelled`) and `scheduled_for` is sufficient for v1. Recurring posts, bulk CSV, and smart scheduling are v2+.

4. **Publishing increases the value of every adjacent feature.** Because publishing co-occurs with the inbox, dashboards, and alerts, it should be built as an extension of the existing `outbound_activities` pipeline rather than a new subsystem. That keeps the dependency graph shallow and avoids duplicating connector/auth logic.

5. **The biggest risk is not the feature itself, but the OAuth scope creep.** Facebook/LinkedIn write scopes require careful primary-source verification. The first connector (Facebook Pages) must prove the exact permission (`pages_manage_posts`) and error behavior before the generic `publish?()` contract can be called complete.
