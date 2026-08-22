# ADR-0107: Multi-user workspaces and RBAC permissions

**Status:** Proposed (2026-08-23)

**Authorizes:** per-connector and per-watchlist permissions, fine-grained feature gating, and the `tenant_user` role matrix that extends `tenant_admin` and `tenant_user` beyond the current coarse role split.

**Source:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The current RBAC is coarse
`docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` describes richer workspaces. Today the product has `tenant_admin` and `tenant_user` (ADR-0032). The product needs finer-grained permissions for connectors, watchlists, and features.

### 2. Watchlists are already personal (ADR-0044)
Watchlists are owned by a user and private by default. This ADR adds explicit sharing and read-only access for `tenant_user`s.

### 3. Connectors and credentials are ownership-tier aware
`ADR-0028` and `ADR-0051` established tenant-wide vs. user-bound activation. This ADR adds permission roles for who can activate, configure, and deactivate connectors.

---

## Decision

### 1. Permission matrix
```ts
const PERMISSIONS = {
  'tenant_admin': {
    users: 'manage',
    connectors: 'manage',
    watchlists: 'manage_all',
    alerts: 'manage_all',
    posts: 'read_all',
    analytics: 'read_all',
    settings: 'manage',
    exports: 'manage',
    dsr: 'manage',
  },
  'tenant_user': {
    users: 'none',
    connectors: 'activate_own',       // user-bound credentials
    watchlists: 'own',
    alerts: 'own',
    posts: 'read',
    analytics: 'read',
    settings: 'read',
    exports: 'own',
    dsr: 'create_own',
  },
  // future custom role
  'analyst': {
    connectors: 'none',
    watchlists: 'read_shared',
    posts: 'read',
    analytics: 'read',
    exports: 'own',
  }
};
```

### 2. `tenant_user` role remains the v1 default
- `tenant_user` is the default role.
- Custom roles (`analyst`, `social_care_agent`) are v2 features.

### 3. Per-watchlist sharing
```sql
watchlist_shares (
  watchlist_id uuid,
  shared_with_user_id uuid,
  permission text,            -- 'read' | 'edit'
  shared_by_user_id uuid,
  shared_at timestamptz
);
```

- A `tenant_user` can share their watchlist with another `tenant_user`.
- `tenant_admin` can view and manage all watchlists.
- `read` permission allows viewing and using the watchlist; `edit` allows modifying the query.

### 4. Per-connector permissions
- `tenant_admin` can create tenant-wide credentials for any connector.
- `tenant_user` can create user-bound credentials for connectors with `authMode: 'oauth'`.
- `tenant_admin` can deactivate any connector; `tenant_user` can deactivate only their own user-bound connectors.
- `tenant_admin` can configure connector settings (rate limits, API keys); `tenant_user` cannot.

### 5. Feature gating
- `tenant_settings.feature_gates` is a JSONB field that enables/disables features per tenant.
- `Platform-Admin` can set feature gates for a tenant.
- `Tenant-Admin` can set feature gates for their own tenant where the platform allows it.

### 6. Permission checks
- `requirePermission(resource, action)` helper for use in route handlers.
- RLS remains the primary tenant-scoping mechanism.
- Permission checks are an additional application-layer gate, not a replacement for RLS.

---

## Consequences

1. **Better collaboration:** users can share watchlists without giving full admin access.
2. **Safer connectors:** not every user can create tenant-wide credentials.
3. **Foundation for custom roles:** the permission matrix can be extended to custom roles in v2.
4. **Feature-trial support:** `feature_gates` allow gradual roll-out.

---

## Alternatives considered

1. **Keep only `tenant_admin` and `tenant_user` with no fine-grained sharing.**
   - *Rejected:* it forces users to share credentials and watchlists by giving admin access. Per-resource sharing is necessary.

2. **Use Entra groups for permissions.**
   - *Rejected:* it couples permission management to the IdP and is hard to make tenant-specific. In-app permission is more flexible.

3. **Implement full ABAC (attribute-based access control).**
   - *Rejected:* ABAC is powerful but complex. A role + resource permission matrix is enough for v1.

---

## Open questions

- Should `tenant_user` be able to invite other `tenant_user`s, or only `tenant_admin`?
- How are default permissions for new `tenant_user`s configured? Tenant-wide default?
- Should `watchlist_shares` support sharing to a group or only individual users?
- How does feature gating interact with `Platform-Admin` billing tier changes?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0032` (users and invites), `ADR-0044` (watchlist ownership), `ADR-0028` (connector credentials), `ADR-0051` (connector activation)
