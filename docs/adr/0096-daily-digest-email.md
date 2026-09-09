# ADR-0096: Daily Digest Email (Timezone-Aware, Precomputed Views & AI Summary)

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23 · Revised 2026-08-28 per architectural review.** Authorizes the `user_digest_preferences` data model, timezone-aware hourly scheduler, precomputed aggregate queries (`*DailyCount`), blended impact ranking for notable posts, bounded `AIProviderConnector` summary generation, and CAN-SPAM/RFC-8058 compliant email delivery.

**Source:** `docs/product-research/feature-designs/24-daily-digest-email.md`, `docs/product-research/feature-adr-scoping.md`, and ADR-0044/0049/0073/0076/0087/0091.

---

## 1. Comparison with Preceding ADRs

| Preceding ADR | Architectural Relationship & Alignment |
| :--- | :--- |
| **ADR-0087** *(Preconfigured Analytics Views)* | **Aligned**: The digest reads from `TopicDailyCount`, `SourceDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` tables instead of scanning `social_posts` across tenants at send time. Since `*DailyCount` tables are partitioned by UTC calendar date, queries spanning custom local 24-hour windows aggregate the relevant UTC date slices. |
| **ADR-0044 & ADR-0032** *(User Ownership & RLS)* | **Aligned**: `user_digest_preferences` is user-owned and tenant-scoped with Row-Level Security (`tenant_id`, `user_id`). Users configure only their own personal subscription (`/v1/users/me/digest-preferences`), and the digest aggregates only watchlists the user has permission to view. |
| **ADR-0038 & ADR-0076** *(AI Summary Cost & Safety)* | **Aligned**: Generating the morning executive summary via `AIProviderConnector.research()` enforces strict token and cost guards: maximum 1 LLM call per user per day, structured output schema, and hard context bounds (top 5 notable post snippets only). |
| **ADR-0091** *(Alerts & Delivery Channels)* | **Aligned**: Reuses Azure Communication Services (ACS) Email and SMTP delivery infrastructure. Standardizes email template styling, branding tokens, and delivery retry policies. |
| **ADR-0049 & ADR-0073** *(Metrics & Notable Posts)* | **Aligned**: Selects top 5 `notablePosts` using a deterministic impact score combining `author_follower_count_at_publish`, engagement count, and negative sentiment urgency. |

---

## Context

### 1. Daily executive and operational summaries
Users (`Tenant-Reader`, `Tenant-Brand-Reputation-Manager`, `Tenant-Social-Care-Agent`) require a consolidated morning digest summarizing the previous 24 hours of social mentions, sentiment shifts, emerging topics, and notable high-impact conversations.

### 2. Timezone diversity and delivery schedules
Users operate across global timezones. A user-configurable `send_at_local` time and IANA `timezone` setting ensures the email arrives in the recipient's local morning (e.g. 08:00 AM Europe/Amsterdam or 07:30 AM America/New_York).

### 3. Compute efficiency via precomputed daily views
Scanning `social_posts` per user per day would impose prohibitive database load. Utilizing the precomputed `*DailyCount` tables (ADR-0087) makes morning digest generation fast and cost-effective.

---

## Decision

### 1. Database Schema (`user_digest_preferences`)

```sql
CREATE TABLE user_digest_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  send_at_local time NOT NULL DEFAULT '08:00:00',
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  watchlist_ids uuid[] DEFAULT '{}', -- Empty array means all accessible watchlists
  include_ai_summary boolean NOT NULL DEFAULT true,
  include_top_posts boolean NOT NULL DEFAULT true,
  include_topic_breakdown boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_digest_prefs UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_user_digest_scheduler 
  ON user_digest_preferences (is_enabled, timezone, send_at_local) 
  WHERE is_enabled = true;
```

### 2. Timezone-Aware Hourly Scheduler

An hourly background worker processes subscriptions matching the current hour in the recipient's local timezone:
```sql
SELECT * FROM user_digest_preferences
WHERE is_enabled = true
  AND to_char(now() AT TIME ZONE timezone, 'HH24') = to_char(send_at_local, 'HH24')
  AND (last_sent_at IS NULL OR last_sent_at < now() - INTERVAL '20 hours');
```
Upon successful transmission, `last_sent_at` is updated to `now()`, enforcing a 20-hour cooldown against duplicate sends.

### 3. Digest Content Structure & Data Assembly

```ts
export interface DailyDigestData {
  tenantName: string;
  recipientName: string;
  dateRangeLabel: string;
  totalMentions: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  topTopics: Array<{
    topic: string;
    count: number;
    deltaPercentage: number;
  }>;
  topPlatforms: Array<{
    platform: string;
    count: number;
  }>;
  notablePosts: Array<{
    postId: string;
    platform: string;
    authorName: string;
    authorHandle?: string;
    excerpt: string;
    publishedAt: string;
    url?: string;
    impactScore: number;
  }>;
  aiSummary?: {
    narrative: string;
    keyThemes: string[];
    sentimentTrend: string;
  };
  unsubscribeUrl: string;
}
```

- **Metrics & Breakdowns:** Aggregated from `TopicDailyCount`, `SourceDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` (ADR-0087).
- **Notable Posts Selection:** Up to 5 posts selected from matching watchlists over the 24-hour window, ranked by:
  $$\text{ImpactScore} = (\text{reach} \times 0.4) + (\text{engagement} \times 0.4) + (\text{is\_negative} \ ? \ 300 : 0)$$
- **AI Summary Generation:** If `include_ai_summary` is true, an executive narrative (max 250 words) is generated via `AIProviderConnector.research()` using the top post excerpts as grounded context.

### 4. Email Delivery & Compliance

- **Transport:** Delivered via Azure Communication Services (ACS) Email or tenant-configured SMTP relay.
- **Subject:** `"[SocialEngage] <tenant_name> Daily Digest — <date>"`
- **Templates:** Responsive, brand-aligned HTML and plain-text fallback.
- **One-Click Unsubscribe (RFC 8058 / CAN-SPAM / GDPR):**
  - Includes `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
  - HMAC-signed one-click unsubscribe URL in the footer (`/public/v1/digest/unsubscribe?token=<jwt/hmac>`) disabling future sends without login friction.

### 5. REST API Specifications

- `GET /v1/users/me/digest-preferences`: Retrieve current user's preferences.
- `PUT /v1/users/me/digest-preferences`: Update schedule, timezone, watchlist filters, and content toggles.
- `POST /v1/users/me/digest-preview`: Generate and return HTML and JSON payload for live in-browser preview.
- `GET/POST /public/v1/digest/unsubscribe?token=<token>`: Public one-click opt-out endpoint.

---

## Resolving Open Questions

| Open Question | Decision & Architecture Rationale |
| :--- | :--- |
| **1. Tenant vs User Timezone?** | **User's personal IANA timezone** (e.g. `'Europe/Amsterdam'`, `'America/New_York'`) configured in their digest preferences, defaulting to the tenant's primary timezone. |
| **2. Notable posts selection criteria?** | **Blended impact score**: Top 5 posts ranked by reach (`author_follower_count_at_publish`), engagement counts, and high negative sentiment severity. |
| **3. Subscription model (Self vs Delegated)?** | **Self-service opt-in only**. Users manage their own preferences via `/v1/users/me/digest-preferences`. Admins cannot force unwanted subscriptions. |
| **4. Unsubscribe mechanics?** | **HMAC-signed one-click unsubscribe**. Standardized header and footer link (`/public/v1/digest/unsubscribe?token=...`) that sets `is_enabled = false` immediately. |

---

## Consequences

### Positive
- **High Re-engagement:** Delivers critical brand insights directly to stakeholders' inboxes every morning.
- **Minimal Database Overhead:** Reads precomputed `*DailyCount` tables instead of executing heavy table scans.
- **Cost-Controlled AI Integration:** Strictly bounded to 1 summary call per subscribed user per day with hard token limits.
- **Compliance Built-In:** Native RFC 8058 one-click unsubscribe prevents deliverability issues and spam flags.

### Trade-offs & Mitigations
- **Email Transmission Costs:** Mitigated by making daily digests opt-in per user and supporting tenant SMTP relays.
- **Hourly Cron Window Variance:** Mitigated by 20-hour cooldown checks preventing multi-send race conditions.

---

## Related Notes
- `docs/product-research/feature-designs/24-daily-digest-email.md`
- `docs/adr/0087-preconfigured-analytics-views.md`
- `docs/adr/0091-real-time-alert-rules-and-delivery.md`
- `docs/adr/0038-ai-enrichment-provider-selection.md`
- `docs/adr/0076-composer-deep-research-agent.md`
