---
name: social-inbox-ui
description: Frontend UI components and BFF routes for unified social inbox triage, priority filtering, snooze, resolution, and inline replies.
---

# Unified Social Inbox UI

Governed by **ADR-0099**, **BRD-0099**, **FDD-0099**, and **Story 11.10**.

## Architecture & Responsibilities

1. **Client Methods (`core-client.ts`)**:
   - `listInboxItems(options)`: calls `GET /v1/inbox` with status, priority, and assignment filters.
   - `getInboxItem(id)`: calls `GET /v1/inbox/:id`.
   - `updateInboxItem(id, updates)`: calls `PATCH /v1/inbox/:id`.
   - `assignInboxItem(id, assignedTo)`: calls `POST /v1/inbox/:id/assign`.
   - `snoozeInboxItem(id, snoozedUntil)`: calls `POST /v1/inbox/:id/snooze`.
   - `resolveInboxItem(id, notes)`: calls `POST /v1/inbox/:id/resolve`.
   - `replyToInboxItem(id, body)`: calls `POST /v1/inbox/:id/reply`.

2. **BFF Proxy Routes**:
   - `GET /api/inbox`
   - `GET /api/inbox/[id]`
   - `PATCH /api/inbox/[id]`
   - `POST /api/inbox/[id]/assign`
   - `POST /api/inbox/[id]/snooze`
   - `POST /api/inbox/[id]/resolve`
   - `POST /api/inbox/[id]/reply`

3. **UI Components**:
   - `InboxView.tsx`: two-pane workdesk with priority filters (`Urgent`, `High`, `Snoozed`, `Resolved`), snippet preview list, and search filter.
   - `InboxItemDetail.tsx`: conversation detail card, sentiment & reach signals, snooze picker, internal notes editor, and inline reply composer with instant resolution feedback.
   - `/tenant/inbox/page.tsx`: dedicated route page.
