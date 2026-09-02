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
