---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Multi-user workspaces and RBAC

### What it is
Tenant-scoped workspaces with role-based access: platform admin, tenant admin, tenant user, and fine-grained permissions for connectors, watchlists, posts, and settings.

### End-user benefits
- **Team separation:** each tenant has its own data and users.
- **Least privilege:** tenant admins manage connectors and users; tenant users manage their own watchlists and posts.
- **Governance:** audit logs track who did what.

### Core details
- This is already built: Entra External ID, `resolveIdentity()`, RLS on every tenant table, `tenant_admin`/`tenant_user`/`platform_admin` roles, and `platform_admin_audit_log`.
- Future depth: per-connector permissions, per-watchlist sharing, and more granular feature gating.

### Implementation complexity
**Core is already built; additions are low-to-medium.** The architecture is multi-tenant from day one. New RBAC dimensions (e.g., who can publish vs. reply) can be added by extending the `ResolvedIdentity` role checks.

### Growth and reach
Proper RBAC is a prerequisite for selling to enterprises and agencies. It is also a differentiator against SMB tools that offer only flat team access.

---

## Summary: where SocialEngage stands

| Feature | Current state | Priority for growth |
|---|---|---|
| Multi-source ingestion | Strong and expanding | Keep building connectors |
| Boolean query builder | Backend ready; UI needed | High for analyst adoption |
| AI sentiment analysis | Built; deepen to aspect-based | Medium |
| AI topic clustering | Not built; enrichment path is clear | High for differentiation |
| Influencer discovery | Partial data; needs scoring + UI | Medium-high |
| Unified social inbox | Foundation via ADR-0073/0075 | Very high (turns listening into care) |
| Publishing and scheduling | Proposed (ADR-0075) | Very high (full-suite play) |
| Dashboards and analytics | v1 built; deepen | Medium |
| Real-time alerts | Not built; data exists | High for operational value |
| Data export | Proposed (ADR-0074) | High for enterprise trust |
| API and integrations | Internal; document/version | Medium |
| Multi-user workspaces and RBAC | Built; add finer grain | Medium |

## Technical design

- **Data flow:** caller sends `Authorization: Bearer` → `entraAuthMiddleware` validates token → `resolveIdentity()` looks up `sub`/`email` in `users`/`platform_admins` → attaches `ResolvedIdentity` (`tenant_id`, `role`, `user_id`) to `req` → `withTenant()` sets RLS context for every subsequent query.
- **Component interactions:** `tenant-auth-middleware` (Story 5.10) composes auth and identity; `identity-resolution` skill owns the lookup; `platform-admin-access` skill owns the `platform_admin_role` BYPASSRLS path; `platform_admin_audit_log` records privileged actions.
- **REST/Service Bus contracts:** `GET /v1/me` returns the caller's resolved identity (Story 5.11); `POST /v1/tenants/self-service-signup` (ADR-0037) creates a new tenant; user/tenant management endpoints are role-gated.
- **Storage:** `tenants`, `users`, `platform_admins`, `platform_admin_audit_log`, `domain_signup_attempts` (all RLS-protected or role-scoped).
- **Security considerations:** `platform_admin_role` uses BYPASSRLS and writes to `platform_admin_audit_log` for every privileged action; `tenant_admin` and `tenant_user` have no BYPASSRLS and are bound by RLS; `identity_resolver_role` is read-only and used for `resolveIdentity()`.

## Backend principles

- **RLS is the tenant boundary, not a middleware check.** Every tenant-scoped table has an RLS policy on `tenant_id`. Authorization code should not rely solely on route-level checks.
- **Identity is resolved once per request.** `resolveIdentity()` is the single source of truth for who is calling and in what role. It is never bypassed.
- **Feature gating by role, not by ad-hoc flags.** New features (publishing, inbox, alerts, export) should gate with `tenant_admin`/`tenant_user`/`platform_admin` roles rather than introducing one-off permissions until a true permission model is needed.
- **Contract-test targets.** Verify that `tenant_user` cannot read another tenant's `social_posts`, that `tenant_admin` can invite users, that `platform_admin` can read cross-tenant audit logs, and that `resolveIdentity()` returns the correct role for test and production tokens.

## Frontend / UI principles

- **User flow:** unauthenticated user signs in via Entra → routed to admin UI based on role (`tenant_user` vs `tenant_admin` vs `platform_admin`) → sees role-appropriate navigation and screens.
- **Component hierarchy:** `RoleGate` (hides/shows pages) → `TenantSettings` (tenant admin only) → `UserManagement` (invite/revoke) → `PlatformAdminConsole` (platform admin only).
- **State management:** BFF session or client-side fetch of `GET /v1/me` is the source of role truth; navigation is filtered by role; conditional rendering for privileged actions.
- **Accessibility and responsive design:** Role-based navigation is exposed to screen readers with current-page state; admin tables support keyboard navigation and bulk actions.

## Open questions

- When do we introduce fine-grained permissions (e.g., who can publish vs. reply vs. export) beyond the three main roles?
- How do we support agencies with multiple client tenants under one login?
- Should `tenant_admin` be able to impersonate a `tenant_user` for support?
- Do we need per-connector permissions (e.g., some users can only see Facebook data)?
- How do we keep `ResolvedIdentity` in sync when Entra claims change (e.g., email update)?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Fine-grained permissions?** | **Defer to v3**. Keep `tenant_admin`/`tenant_user`/`platform_admin` in v1/v2. Add a permission matrix (publish, reply, export, manage connectors, etc.) only when enterprise customers ask for it. | SchedulifyX exposes ~65 permission keys; Brand2Social and Hootsuite already use per-brand/per-channel permissions. Social media management tools converge on fine-grained RBAC, but it is overkill for v1. |
| **Agencies with multiple tenants?** | **v2: partner role + tenant-switcher**. A user can belong to multiple tenants with a `partner` flag; `GET /v1/me/tenants` and a tenant context switch. Do not try to merge tenant data views. | Vista Social targets agencies with profile groups and client clusters; multi-tenant access is a common agency requirement but requires explicit scoping to avoid cross-tenant leaks. |
| **Tenant admin impersonation?** | **No impersonation.** Use the existing break-glass mechanism (ADR-0030) for platform admins and read-only audit logs for support. Impersonation is high-risk and rarely needed. | Security best practice: avoid impersonation; use break-glass or shadow access with full audit. The project already has a two-phase break-glass flow. |
| **Per-connector permissions?** | **v2.5: add a `connector_user_access` table** mapping user/platform. v1: the `tenant_user` sees all tenant connectors. | Brand2Social and Hootsuite both have per-channel/per-social-network permissions; Spikerz's access management is built around platform-specific account control. |
| **ResolvedIdentity sync on claim changes?** | Treat the **bearer token as the source of truth on every request**. Resolve `sub`/`email` at request time; do not cache identity beyond the request. If the `sub` is stable, email changes are not critical. Add a `users.last_claims_update_at` timestamp and a nightly sync job for cleanup. | Azure DAB/RLS quickstart passes token claims directly to SQL session context; Entra claims can be customized per app. Email sync conflicts are a known Entra issue, so `sub` (object ID) should be the primary key. |

### Sources consulted

- Brand2Social: role-based authentication — https://brand2social.com/features/role-based-authentication/
- SchedulifyX: RBAC and custom permissions — https://schedulifyx.com/blog/schedulifyx-enterprise-rbac-audit-logs-custom-permissions
- Hootsuite API permissions matrix — https://developer.hootsuite.com/docs/api-permissions-matrix
- Spikerz: social media access management — https://www.spikerz.com/social-media-access-management-software
- Vista Social: social listening for agencies — https://vistasocial.com/insights/social-listening-for-agencies/
- Azure DAB + Entra + RLS quickstart — https://github.com/Azure-Samples/dab-2.0-quickstart-web_entra-api_entra-db_entra-db_rls/blob/main/README.md
- Microsoft: Entra claims customization — https://learn.microsoft.com/en-us/entra/identity-platform/claims-customization-powershell
- Microsoft: email addresses not synced troubleshooting — https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/user-prov-sync/email-addresses-not-sync

## Persona acceptance

- **Platform-Admin (primary):** can create/suspend tenants, adjust seat counts, and query audit logs without accessing tenant data.
- **Tenant-Admin (primary):** can invite/revoke tenant users, manage connectors and watchlists, and not accidentally see platform-level data.
- **Legal-Advisor (primary):** can produce a defensible trail of every role change, approval, and export action.
- **Tenant-User (secondary):** can act within their role (reply, publish, view) without seeing administrative screens.
- **Data-Subject (secondary):** (future) can trigger a self-service access/erasure request and see it tracked and fulfilled.

## AI enhancements

- **Role-recommendation engine:** the AI suggests whether a new user should be `tenant_user` or `tenant_admin` based on their domain.
- **Audit-log summarization:** turn raw `platform_admin_audit_log` rows into a human-readable activity summary.
- **Access-pattern anomaly detection:** flag when a user or key is accessing data outside their normal pattern.
- **Right-to-erasure assistance:** the AI helps identify which data belongs to a user being deleted or exported.
