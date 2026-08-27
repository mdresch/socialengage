---
name: onboarding-checklist-ui
description: Onboarding checklist UI component (Story 9.6, ADR-0080, BRD-0080, FDD-0080) — visual guide and progress tracking for new tenant admins in social-listening-admin. Read this before touching src/app/tenant/OnboardingChecklist.tsx or src/app/api/tenants/[id]/onboarding-checklist/.
---

# Onboarding Checklist UI (`OnboardingChecklist.tsx`)

## What this is

A dashboard guide component in `social-listening-admin` that reflects the 4 core onboarding steps (`connect_source`, `build_watchlist`, `invite_user`, `verify_posts`) and optional advanced steps (`enable_enrichment`, `configure_alerts`).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0080 | Onboarding checklist state model & single-query reconciliation | 9.6 (frontend), 9.5 (backend) |
| BRD-0080 | Business requirements for self-service tenant onboarding | 9.6 |
| FDD-0080 | Functional design for checklist progress, deep-linking, and dismissal | 9.6 |

## Key Invariants

1. **Non-blocking Guide:** The checklist is purely advisory and dismissible; it never gates or restricts access to any feature.
2. **Deep-linking:** Each step links directly to the relevant management page (`/tenant/connectors`, `/tenant/watchlists`, `/tenant/users`, `/tenant/posts`).
3. **Persistent Dismissal:** Dismissal state is saved server-side via `PATCH /api/tenants/:id/onboarding-checklist`, with a trigger button available to reopen.
4. **Advanced Steps:** Advanced steps can be toggled without gating existing workflows.
