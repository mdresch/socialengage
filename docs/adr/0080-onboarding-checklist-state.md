# ADR-0080: Onboarding checklist state

**Status:** Accepted (2026-08-24)

**Authorizes:** a tenant-scoped `onboarding_checklist` state model, bundled milestone reconciliation engine, and a lightweight `GET/PATCH` API that tracks a new tenant's setup progress without changing the existing connector, watchlist, or user endpoints.

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

### 2. One-Way Milestone Locking & Bundled Query Reconciliation
Onboarding steps represent historical milestone achievements; once marked completed, they remain permanently completed even if underlying resources are later deleted or replaced.

#### Reconciliation Flow on `GET`:
1. **Fast-Path Cache Check:** If a step is already marked `"completed": true` in `tenants.onboarding_checklist`, skip checking that table entirely.
2. **Bundled Single-Query Evaluation:** For any uncompleted steps, run a single bundled `SELECT EXISTS` query rather than multiple isolated round-trips:
```sql
SELECT
  EXISTS(SELECT 1 FROM connector_activations WHERE tenant_id = $1 AND is_active = true) AS has_connector,
  EXISTS(SELECT 1 FROM watchlists WHERE tenant_id = $1) AS has_watchlist,
  EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND id != $2) AS has_invited_user,
  EXISTS(SELECT 1 FROM social_posts WHERE tenant_id = $1 LIMIT 1) AS has_posts,
  EXISTS(SELECT 1 FROM alert_rules WHERE tenant_id = $1) AS has_alerts;
```
*(Leverages the existing `social_posts(tenant_id)` index so the `LIMIT 1` check executes in $O(1)$ time).*
3. **JSONB Milestone Persistence:** If any pending step is satisfied, set `"completed": true`, record `"completed_at": now()` (or resource creation timestamp), and persist the updated JSONB back to `tenants` to cache completion permanently.

### 3. Explicit API Request & Response Contracts

```typescript
// GET /v1/tenants/:id/onboarding-checklist (Response)
export interface OnboardingChecklistResponse {
  isComplete: boolean;           // true when all core steps are completed
  progressPercentage: number;    // e.g. 75 (3 of 4 core steps)
  dismissed: boolean;
  dismissedAt: string | null;
  steps: {
    connect_source: ChecklistStep;
    build_watchlist: ChecklistStep;
    invite_user: ChecklistStep;
    verify_posts: ChecklistStep;
  };
  advancedSteps: {
    enable_enrichment: ChecklistStep;
    configure_alerts: ChecklistStep;
  };
}

export interface ChecklistStep {
  completed: boolean;
  completedAt: string | null;
  deepLink: string;             // e.g. "/settings/connectors"
}

// PATCH /v1/tenants/:id/onboarding-checklist (Request)
export interface PatchOnboardingChecklistRequest {
  dismissed?: boolean;          // Sets or clears dismissed_at and dismissed_by_user_id
  reset?: boolean;              // Resets dismissed state
  hiddenAdvancedSteps?: string[]; // e.g. ["enable_enrichment"]
}
```

### 4. Role-Based Visibility & Authorization
- **Read (`GET /v1/tenants/:id/onboarding-checklist`):** Accessible to both `tenant_admin` and `tenant_user`.
- **Modify (`PATCH /v1/tenants/:id/onboarding-checklist`):** Strictly restricted to `tenant_admin`.
- **UI Gating:** `tenant_user` (viewers/analysts) view a simplified, non-intrusive progress summary, avoiding clutter from admin-only setup actions (such as API keys or user invitations).

### 5. UI Deep Linking & Return Verification
The admin dashboard displays the checklist at the top. Each step deep-links directly to the relevant connector, watchlist, user invite, or post feed screen. When the user navigates back to the dashboard, the bundled reconciler verifies milestone completion.

---

## Consequences

1. **Faster activation:** New tenants have a clear, ordered path without leaving the admin UI.
2. **Zero workflow lock-in:** The checklist is a dismissible progress guide that never blocks API or direct UI usage.
3. **High-performance reconciliation:** Single bundled `SELECT EXISTS` query with one-way JSONB milestone locking ensures response latency is $< 3\text{ ms}$.
4. **No cross-service triggers:** Eliminates the need for database triggers or distributed event hooks across 6 separate domain tables.
5. **Historical milestone integrity:** Deleting a watchlist or removing a user does not un-complete historical onboarding progress.

---

## Alternatives considered

1. **Store checklist progress in a separate `onboarding_checklists` table.**
   - *Rejected:* The state is tightly bound to the tenant. A separate table adds unnecessary relational overhead without clear benefit.

2. **Derive completion entirely client-side from existing API calls.**
   - *Rejected:* Pushes orchestration to the UI and multiplies initial dashboard network requests. A single backend endpoint keeps the UI thin.

3. **Make the checklist mandatory before using the product.**
   - *Rejected:* Creates friction for advanced and API-first users; violates the self-service, dismissible design goal.

4. **Event-driven / Trigger-based milestone updates.**
   - *Rejected:* Database triggers or cross-service event hooks across 6 distinct domain tables introduce tight coupling and maintenance overhead compared to bundled read reconciliation.

---

## Open questions

- ~~Should completion be computed on every `GET` or refreshed by a trigger/hook when the underlying tables change?~~ **Resolved at acceptance:** Computed on `GET` using a single bundled `SELECT EXISTS` query with one-way JSONB milestone caching.
- ~~Should `Platform-Admin` see onboarding completion metrics across tenants?~~ **Resolved at acceptance:** Yes, `tenants.onboarding_checklist` enables standard SQL aggregation for platform activation funnels and drop-off analysis.
- ~~Should the checklist order or step names be configurable per tenant?~~ **Resolved at acceptance:** No, kept fixed in v1 to preserve standard SaaS self-service simplicity.
- ~~How does the checklist behave for tenants created before this ADR is implemented?~~ **Resolved at acceptance:** Auto-reconciled on first `GET` — existing active tenants have their steps marked `completed: true` and are automatically set to `dismissed: true`.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0051` (connector activation), `ADR-0044` (watchlists), `ADR-0032` (users/invites)

### Pending supersession note (2026-08-28)

If ADR-0130 (Proposed, 2026-08-28) is accepted, this ADR's Decision §1 would be refined by ADR-0130's own §1–§2 — specifically role-tailored step branches (Admin vs Analyst vs Marketer) and automated step verification probes. This is a pending note only: ADR-0130 is currently Proposed, not accepted.