---
name: multi-user-workspaces-rbac
description: Multi-user workspaces, RBAC permission matrix, watchlist sharing with read/edit scopes, and per-tenant feature gates per ADR-0107.
---

# Multi-User Workspaces and RBAC Permissions Skill

## Contracts that constrain this component

- `social-listening-core/contracts/epic-12/story-12.13.multi-user-workspaces-rbac.contract.test.ts` — Story 12.13 contract test.

## Overview
Implements Story 12.13 (ADR-0107):
- RBAC permission matrix (`tenant_admin`, `tenant_user`) with `hasPermission(role, resource, action)` and `requirePermission(resource, action)` middleware.
- Watchlist sharing (`watchlist_shares` table with `read` and `edit` permissions, RLS isolation).
- Watchlist sharing API (`POST /v1/watchlists/:id/shares`, `GET /v1/watchlists/:id/shares`, `DELETE /v1/watchlists/:id/shares/:userId`).
- Per-tenant feature gates (`tenants.feature_gates`, `GET/PATCH /v1/tenants/me/features`).
- License seat ceiling enforcement on user invitations and reactivations.

## Key Types & Functions
```ts
export type Resource = 'users' | 'connectors' | 'watchlists' | 'alerts' | 'posts' | 'analytics' | 'settings' | 'exports' | 'dsr';
export type Action = 'read' | 'read_all' | 'manage' | 'manage_all' | 'own' | 'activate_own' | 'create_own' | 'read_shared' | 'none';

export function hasPermission(role: string, resource: Resource, action: Action): boolean;
export function requirePermission(resource: Resource, action: Action): RequestHandler;
```
