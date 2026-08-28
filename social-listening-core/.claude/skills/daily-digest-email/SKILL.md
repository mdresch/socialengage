---
name: daily-digest-email
description: Backend service and worker for timezone-aware daily digest email generation, metrics aggregation, notable post ranking, and bounded AI summaries.
---

# Daily Digest Email (Backend)

Governed by **ADR-0096**, **BRD-0096**, **FDD-0096**, and **Story 11.3**.

## Key Architecture & Components

1. **Database Schema (`user_digest_preferences`)**:
   - `id`, `tenant_id`, `user_id`, `is_enabled`, `send_at_local`, `timezone`, `watchlist_ids`, `include_ai_summary`, `include_top_posts`, `include_topic_breakdown`, `last_sent_at`.
   - Index on `(is_enabled, timezone, send_at_local)` for efficient hourly worker queries.
   - Forced PostgreSQL RLS with `tenant_isolation` policy.

2. **Timezone-Aware Scheduling (`digestPreferenceStore.ts` & `dailyDigestScheduler.ts`)**:
   - Hourly job matching `to_char(now() AT TIME ZONE timezone, 'HH24') = to_char(send_at_local, 'HH24')`.
   - 20-hour duplicate send cooldown guard: `last_sent_at < now() - INTERVAL '20 hours'`.

3. **Data Assembly & Precomputed Views (`dailyDigestBuilder.ts`)**:
   - Reads 24-hour slices from `sentiment_daily_counts` and `source_daily_counts` (ADR-0087).
   - Ranks candidate posts using the blended impact score:
     $$\text{ImpactScore} = (\text{reach} \times 0.4) + (\text{engagement} \times 0.4) + (\text{is\_negative} \ ? \ 300 : 0)$$
   - Caps `notablePosts` at top 5.
   - Bounded AI summary generation via `AIProviderConnector.research()`.

4. **Rendering & Delivery (`dailyDigestRenderer.ts`)**:
   - Generates dual MIME parts (`text/html` and `text/plain`).
   - Standardized branding tokens and RFC 8058 compliant one-click unsubscribe links.

5. **API Endpoints (`digestRoutes.ts`)**:
   - `GET /v1/users/me/digest-preferences`
   - `POST /v1/users/me/digest-preferences`
   - `POST /v1/users/me/digest-previews`
   - `GET /v1/digest/unsubscribe`
