# ADR-0099: Unified social inbox and reply

**Status:** Accepted (2026-08-28)

**Authorizes:** the `inbox_items` data model, triage states, priority, assignment, and the `SocialConnector.reply?()` method for replying to ingested posts from the inbox.

**Source:** `docs/product-research/feature-designs/06-unified-social-inbox.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Listening must turn into action
`docs/product-research/feature-designs/06-unified-social-inbox.md` describes a unified inbox where a `Tenant-Social-Care-Agent` can triage, assign, and reply to posts matched by watchlists. It is the primary workflow surface for customer care and reputation response.

### 2. The `posts` feed already exists
`GET /v1/posts` returns matched posts. The inbox is a workflow layer on top of this feed, with additional state: priority, assignment, resolution, and reply history.

### 3. Reply was already authorized
`ADR-0073` authorized `SocialConnector.reply?()` and `POST /v1/posts/:id/replies`. This ADR adds the inbox data model, triage, and assignment that the reply endpoint feeds.

---

## Decision

### 1. New `inbox_items` table
```sql
inbox_items (
  id uuid,
  tenant_id uuid,
  post_id uuid,
  watchlist_id uuid,
  priority text,                -- 'urgent' | 'high' | 'normal' | 'low'
  status text,                  -- 'new' | 'in_progress' | 'waiting' | 'resolved' | 'snoozed' | 'escalated'
  assigned_to uuid,             -- user_id
  assigned_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  notes text,
  tags text[],
  snoozed_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

- `inbox_items` is tenant-scoped and RLS-protected.
- One row per `(post_id, watchlist_id)` or one row per `post_id` if `watchlist_id` is not material. v1 creates one row per matching `post_watchlist_match`.

### 2. Triage and assignment endpoints
```
GET    /v1/inbox                  // list items, filter by status, priority, assignedTo
GET    /v1/inbox/:id
PATCH  /v1/inbox/:id              // update priority, status, assigned_to, notes, tags
POST   /v1/inbox/:id/assign       // assign to a user
POST   /v1/inbox/:id/snooze      // snooze until
POST   /v1/inbox/:id/resolve     // mark resolved
```

### 3. Priority derivation
- Priority can be set manually by `Tenant-Social-Care-Agent`.
- Default priority is derived from rules:
  - `urgent` if negative sentiment and author has high reach.
  - `high` if negative sentiment.
  - `normal` otherwise.
- Default rules are configurable per watchlist in v2.

### 4. Reply from the inbox
- `POST /v1/inbox/:id/reply` proxies to `POST /v1/posts/:postId/replies` from `ADR-0073`.
- The reply is `outbound_activities` `activity_type='reply'`.
- The inbox item status is automatically set to `resolved` after a successful reply, unless the user opts out.

### 5. Synchronization with posts
- An `IngestionPostMatchedEvent` creates an `inbox_item` for every matching `(post, watchlist)` pair.
- When a post is redacted (ADR-0092), its `inbox_items` are marked `resolved` with `notes='redacted'`.
- `GET /v1/inbox` joins to `social_posts` for post metadata.

### 6. UI conventions
- Inbox list: sort by priority, then `created_at`.
- Filter chips for status, priority, assigned user, watchlist, platform.
- Detail pane: post preview, reply composer, notes, history.
- Bulk actions: assign, resolve, snooze, tag.

---

## Consequences

1. **Actionable workflow:** the inbox turns the post feed into a customer-care queue.
2. **Clear state model:** `priority`, `status`, and `assigned_to` support team triage.
3. **Reuses reply infrastructure:** the reply path is the same as `ADR-0073`.
4. **Data growth:** one row per match means `inbox_items` can grow quickly. Indexes and retention are required.

---

## Alternatives considered

1. **Use `post_watchlist_matches` as the inbox table without adding a new table.**
   - *Rejected:* `post_watchlist_matches` is a match log, not a workflow state table. Adding workflow state would mix concerns.

2. **Create an `inbox` table without a join to `social_posts`.**
   - *Rejected:* it duplicates post metadata and makes the list slow. `inbox_items` stores only workflow state; post metadata is joined.

3. **Allow reply to any post, even if not in the inbox.**
   - *Rejected:* it bypasses triage and assignment. Reply is available from both the inbox and the post detail, but the inbox is the primary workflow.

---

## Open questions

- Should one post generate one `inbox_item` per watchlist or one item per post?
- Should snooze create a scheduled event to wake the item up, or is it a filter on `snoozed_until`?
- How does `inbox_items` handle multi-tenant, multi-agent concurrent edits? Optimistic locking or `updated_at` checks?
- Should resolution notes be appended to `inbox_item.notes` or a separate `inbox_item_history` table?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/06-unified-social-inbox.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0073` (outbound reply), `ADR-0092` (takedown/redaction), `ADR-0044` (watchlists)
