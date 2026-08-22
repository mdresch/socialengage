# Performance Review Agent Stakeholder Profile

## Purpose

This profile captures a new AI review agent whose role is to audit the SocialEngage application for query and rendering performance, and to prescribe the correct loading-state and data-fetching patterns for every UI surface. The agent complements the existing Engineering Pragmatism and Security reviewers by focusing specifically on perceived and actual performance.

## Stakeholder Type

- **Role:** Performance Review Agent
- **Category:** Internal / Tool-Agent
- **Status:** Proposed
- **Domain pull:** query efficiency, loading-state UX, and rendering latency
- **Source basis:** the need to keep a solo-operated, multi-tenant social-listening platform responsive as query volumes, widget counts, and AI-enrichment costs grow.

## Core Responsibilities

A Performance Review Agent reviews:

1. **Database query cost.** Every tenant-scoped query is checked for:
   - missing indexes, full-table scans, and sequential over-fetches;
   - N+1 fetches, unbounded `LIMIT`/`OFFSET`, and large `IN` lists;
   - whether a query can be precomputed, paginated, or served from a materialized view.
2. **API design for performance.** Endpoints are checked for:
   - over-fetching fields the UI does not need;
   - synchronous endpoints that should be async for large exports;
   - cursor pagination vs. offset pagination;
   - batching, caching, and `ETag`/`Last-Modified` opportunities.
3. **UI loading-state patterns.** Every screen is checked for the correct visual loading pattern:
   - spinner / activity indicator for indeterminate waits under ~300 ms;
   - skeleton or shimmer for medium waits (300 ms – 1.5 s);
   - progress bar or detailed message for long waits over 1.5 s;
   - overlay loader for blocking saves/submissions;
   - component-level skeleton or `Suspense` fallback for lazy-loaded parts.
4. **Data-frontend coupling.** The agent flags when the UI loads large raw datasets that should be aggregated server-side, and when client-side aggregation is acceptable.
5. **Preconfigured views and caching.** The agent evaluates whether expensive analytics queries should move to precomputed, tenant-scoped views rather than run against raw tables at request time.

## Loading Pattern Decision Guide

The agent applies the following convention for visual loading states.

| Situation | Best Pattern | Why |
|---|---|---|
| Fast API call (< 300 ms) | No loader, or a tiny inline spinner | Avoid visual noise for negligible waits. |
| Medium wait (300 ms – 1.5 s) | Skeleton or shimmer | Reduces perceived wait by showing layout immediately. |
| Long wait (> 1.5 s) | Progress bar or detailed message | Sets expectations and prevents abandonment. |
| Blocking action (save, submit, delete) | Overlay loader | Prevents duplicate actions and signals completion. |
| Component-level lazy load | Skeleton or lazy placeholder | Keeps surrounding layout stable. |
| Dashboard with many widgets | Per-widget skeletons | Let each widget load independently; avoid one spinner for the whole page. |
| Initial app boot | Preloader screen or shell | Acceptable for heavy SPAs; keep under a few seconds. |

## Common Performance Rules

- **Prefer precomputed views for expensive analytics.** `TopicDailyCount`, `SourceDailyCount`, and `AuthorDailyCount` should be continuous aggregates or materialized views rather than recomputed from `social_posts` on every dashboard load.
- **Cursor pagination for feed-style views.** `GET /v1/posts` already uses keyset pagination; the UI must preserve this and not fall back to `OFFSET`.
- **Defer heavy AI until needed.** AI explanations, topic clustering, and summarization should be on-demand or precomputed, never a prerequisite for rendering the page shell.
- **Image and media lazy loading.** Media previews use blur-up placeholders and component-level `Suspense`.
- **Cache hot metadata.** Connector health, tenant settings, and feature flags should be cached with short TTLs rather than fetched on every render.

## Requirements Implications

- Every new UI route or dashboard widget must include a `loading.tsx`/`Suspense` boundary with the appropriate pattern.
- Every new backend query must pass a performance review check before merging.
- Expensive analytics must be designed against preconfigured or pre-aggregated data; raw-table scans require explicit justification.
- Loading-state components should be named consistently: `LoadingState`, `Skeleton`, `Shimmer`, `Placeholder`, `Preloader`, `SuspenseFallback`, `BusyIndicator`.

## Suggested Use in Requirements Work

Use this profile when drafting or reviewing:

- dashboard and analytics widgets;
- watchlist, post-feed, and export endpoints;
- AI enrichment and summarization UI;
- onboarding and admin console screens;
- any feature that fetches or aggregates more than a few hundred rows.

## Notes

This profile is a design-time artifact. It does not replace a real performance budget or load test, but it makes performance and loading-state trade-offs explicit during design and review.
