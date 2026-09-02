---
name: workspace-settings-ui
description: Multi-user workspace settings UI supporting user management, seat limits, RBAC permission matrix visualization, watchlist sharing, and per-tenant feature gates per ADR-0107.
---

# Workspace Settings UI Skill

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-12/story-12.14.workspace-settings-ui.contract.test.ts` — Story 12.14 contract test.

## Overview
Implements Story 12.14 (ADR-0107):
- `WorkspaceSettingsView`: Tabbed interface managing:
  - **Users Tab**: User invitations, status display, role assignment, active seat limit meter (`activeSeatCount` / `licenseSeatCount`).
  - **Roles Tab**: Role and permission matrix visualization across `tenant_admin`, `tenant_user`, and `analyst`.
  - **Sharing Tab**: Per-watchlist sharing manager with `read` and `edit` permission assignment and share revoking.
  - **Features Tab**: Per-tenant feature gates management (`aiClustering`, `advancedAnalytics`, `customWebhooks`, etc.).

## Components
- `src/components/settings/WorkspaceSettingsView.tsx`
