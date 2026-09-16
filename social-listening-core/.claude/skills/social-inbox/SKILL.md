---
name: social-inbox
description: Backend service and HTTP routes for unified social inbox, triage, status transitions, priority heuristics, and reply execution.
---

# Unified Social Inbox & Reply Service

Governed by **ADR-0099**, **BRD-0099**, **FDD-0099**, and **Story 11.9**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.9.social-inbox-and-reply.contract.test.ts` — Story 11.9 contract test.

## Key Architecture & Responsibilities

1. **`inbox_items` Table**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `tenant_id UUID NOT NULL`
   - `post_id UUID NOT NULL`
   - `watchlist_id UUID NULL`
   - `provider_id TEXT NOT NULL`
   - `status`: `open`, `assigned`, `snoozed`, `resolved`
   - `priority`: `urgent`, `high`, `normal`, `low`
   - `assigned_to`: UUID of assignee user
   - `snoozed_until`: UTC timestamp for snoozed items
   - `notes`: triage notes
   - `tags`: classification tags array

2. **Priority Determination (`deriveInboxPriority`)**:
   - `urgent`: negative sentiment + author reach >= 50,000
   - `high`: negative sentiment or author reach >= 10,000
   - `normal`: default

3. **Operations & Endpoints**:
   - `GET /v1/inbox`: lists triage queue with priority sorting and status/assignee/platform filters.
   - `GET /v1/inbox/:id`: returns item with joined post payload.
   - `PATCH /v1/inbox/:id`: updates notes/tags/priority.
   - `POST /v1/inbox/:id/assign`: assigns to agent and updates status to `assigned`.
   - `POST /v1/inbox/:id/snooze`: snoozes until future timestamp.
   - `POST /v1/inbox/:id/resolve`: marks status `resolved`.
   - `POST /v1/inbox/:id/reply`: executes `SocialConnector.reply()`, creates reply outbound activity, and marks item `resolved`.
   - `autoResolveRedactedPostItems`: automatically marks matched items `resolved` with notes `redacted` when post is redacted.

## Relations to other components

- **`inbox_items` table** — primary backing table; RLS-gated per `tenant_id`.
- **`social_posts` table** — each inbox item references a post; the reply endpoint reads post payload to build the reply context.
- **`outbound-engagement` skill** — `POST /v1/inbox/:id/reply` delegates to `SocialConnector.reply()` and writes an `outbound_activities` row via the same outbound audit mechanism as the standalone reply endpoint.
- **`watchlist-matching` skill** — watchlist-matched posts are the primary source of new inbox items; `watchlist_id` on each inbox item traces back to the originating watchlist.
- **`influencer-discovery-and-scoring` skill** — inbox priority heuristics (`urgent`/`high`) reference `reach_score` thresholds computed by the author scoring worker in that skill.
- **`real-time-alert-rules` skill** — alert evaluation may fan out to inbox item creation for high-severity matches alongside webhook delivery. **Documentation Steward correction, 2026-09-14: not backed by a real call site.** `alertEvaluationWorker.ts` never imports or calls `inboxItemStore.ts`/`createInboxItem` — the only real callers of inbox-item creation are `inboxRouter.ts` and `inboxItemStore.ts` itself. Same underlying gap as `real-time-alert-rules/SKILL.md`'s webhook-delivery claim (see that file's own 2026-09-14 note). Flagged for Menno, not fixed here.
