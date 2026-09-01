---
name: crisis-template-bundle
description: Crisis template bundle and activation (Story 9.3, ADR-0079, BRD-0079, FDD-0079) — preconfigured crisis monitoring templates with mustache AST interpolation and single-transaction activation. Read this before touching src/crisis/crisisTemplateStore.ts, src/http/versions/v1/crisisTemplatesRouter.ts, or migration 0044.
---

# Crisis Template Bundle and Activation

## What this is

A platform-wide catalog of preconfigured crisis templates (`crisis_templates`) and a tenant-scoped activation mechanism (`tenant_crisis_templates`). Enables a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` to activate one-click crisis monitoring for common reputation risks (brand crisis, product recall, executive attacks, competitor surges, data breaches).

Activation interpolates mustache tokens (e.g. `{{brand_name}}`) into concrete boolean queries/ASTs, creates a tenant-owned `watchlist`, records the activation with requested thresholds and notification-channel intent, and returns a snapshot advisory playbook.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0079 | Crisis template bundle & activation — platform table, tenant activation table, mustache interpolation, single-transaction watchlist creation | 9.3 (backend) |
| ADR-0079 | Frontend Crisis Threshold Wizard component | 9.4 (frontend) |
| ADR-0044 | Watchlist API design & AST standardization — generated watchlists follow the standard watchlist schema | 1.5, 9.3 |
| ADR-0015 | Multi-tenant RLS isolation — `tenant_crisis_templates` is strictly isolated by `tenant_id` | 9.3 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.3.crisis-templates.contract.test.ts` — verifies:
  - `GET /v1/crisis-templates` returns active seeded templates with preview data.
  - `GET /v1/crisis-templates/:templateKey` returns single template preview or 404.
  - `POST /v1/crisis-templates/:templateKey/activate` validates required parameters (e.g. `brand_name`, `competitors`) and returns 422 if missing.
  - Activation requires at least one `notificationChannelIds` entry.
  - Activation creates `watchlist` and `tenant_crisis_templates` within a single atomic transaction.
  - Deleting the generated `watchlist` cascades and deletes `tenant_crisis_templates` (`ON DELETE CASCADE`).
  - Cross-tenant RLS prevents accessing or mutating another tenant's activations.

## Key Invariants

1. **Advisory Playbooks in v1:** The `playbook` array is advisory triage data (recommended steps, owners, SLA minutes) for human operators; it is not an automated state machine.
2. **Notification Intent:** `notificationChannelIds` is stored as intent data on `tenant_crisis_templates`; alert rule evaluation and multi-channel message dispatch are gated on `ADR-0091` follow-on work.
3. **Copy-on-Activation:** Platform templates are copied at activation time; subsequent modifications to platform templates do not alter already-activated tenant instances.
4. **Single Transaction Guarantee:** Watchlist insertion and activation row creation execute inside `withTenant()` transactional boundaries; partial failures roll back completely.
