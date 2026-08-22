# ADR-0080: Onboarding checklist state

**Status:** Proposed (2026-08-23)

**Authorizes:** a tenant-scoped `onboarding_checklist` state model and a lightweight `GET/PATCH` API that tracks a new tenant's setup progress without changing the existing connector, watchlist, or user endpoints.

**Source:** `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Self-service onboarding is a product activation gate
`docs/product-research/feature-designs/19-self-service-onboarding-checklist.md` describes a guided checklist that helps a `Tenant-Admin` set up a new tenant: connect a source, build a watchlist, invite a user, and verify first posts. The goal is to reduce support burden and time-to-value.

### 2. The underlying actions already exist
- Connector activation: `POST /v1/connectors/:platformId/activate` (ADR-0051).
- Watchlist creation: `POST /v1/watchlists` (ADR-0044).
- User invitation: `POST /v1/tenants/:id/invite` (ADR-0032).
- Post verification: `GET /v1/posts` (ADR-0008, ADR-0044, Story 6.11).

The checklist is a read-only reflection of these existing actions plus a few new state bits.

### 3. Checklist must not replace existing workflow
The onboarding checklist is a progress UI, not a mandatory gating workflow. It can be dismissed and reopened. It does not block any existing endpoint.

---

## Decision

### 1. Add `onboarding_checklist` JSONB column to `tenants`
```sql
ALTER TABLE tenants ADD COLUMN onboarding_checklist jsonb NOT NULL DEFAULT '{
  "steps": {
    "connect_source": { "completed": false, "completed_at": null },
    "build_watchlist": { "completed": false, "completed_at": null },
    "invite_user": { "completed": false, "completed_at": null },
    "verify_posts": { "completed": false, "completed_at": null }
  },
  "advanced_steps": {
    "enable_enrichment": { "completed": false, "completed_at": null },
    "configure_alerts": { "completed": false, "completed_at": null }
  },
  "dismissed_at": null,
  "dismissed_by_user_id": null
}';
```

### 2. Completion is derived from existing tables
A background or on-read reconciler checks the tenant state and marks steps complete:
- `connect_source` — at least one `connector_activations` row is active.
- `build_watchlist` — at least one `watchlists` row exists.
- `invite_user` — at least one `users` row other than the creator exists.
- `verify_posts` — `GET /v1/posts` returns at least one row.
- `enable_enrichment` — `sentiment` or `topic` enrichment has run on at least one post.
- `configure_alerts` — at least one `alert_rules` row exists.

### 3. New `GET /v1/tenants/:id/onboarding-checklist` endpoint
Returns the current state. Tenant-scoped, `tenant_admin` or `tenant_user` can read.

### 4. New `PATCH /v1/tenants/:id/onboarding-checklist` endpoint
Allows the `Tenant-Admin` to:
- Dismiss the checklist (`dismissed_at`, `dismissed_by_user_id`).
- Reset the checklist to pending.
- Mark `advanced_steps` as hidden or shown.

It does **not** allow marking core steps complete manually; those are derived.

### 5. UI reads state and links to existing screens
The admin dashboard shows the checklist at the top. Each step is a deep link to the existing connector, watchlist, user, or post feed screen. Completion is verified on navigation return.

---

## Consequences

1. **Faster activation:** new tenants have a clear, ordered path without leaving the admin UI.
2. **No new workflows:** the checklist uses existing endpoints and RLS.
3. **Dismissible:** users can hide the checklist and return later.
4. **Derivation cost:** reading the checklist requires a few small queries or a denormalized JSONB cache. The default is on-read derivation; caching can be added if it becomes expensive.

---

## Alternatives considered

1. **Store checklist progress in a separate `onboarding_checklists` table.**
   - *Rejected:* the state is tightly bound to the tenant and is small. A separate table adds a join without clear benefit.

2. **Derive completion entirely client-side from existing API calls.**
   - *Rejected:* it pushes orchestration to the UI and makes the initial dashboard load more complex. A single backend endpoint keeps the UI thin.

3. **Make the checklist mandatory before using the product.**
   - *Rejected:* it creates friction for advanced users and is not aligned with the self-service, dismissible design goal.

---

## Open questions

- Should completion be computed on every `GET` or refreshed by a trigger/hook when the underlying tables change?
- Should `Platform-Admin` see onboarding completion metrics across tenants?
- Should the checklist order or step names be configurable per tenant?
- How does the checklist behave for tenants created before this ADR is implemented?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0051` (connector activation), `ADR-0044` (watchlists), `ADR-0032` (users/invites)
