# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0079 Crisis Template Bundle and Activation |
|| Version | 1.1 |
|| Date | 2026-08-25 |
|| Author(s) | FDD Writer Agent; amended by the Business & Requirements Analyst persona |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Amended for Review |
|| Related Documents | ADR-0079 (amended 2026-08-25), BRD-0079 (v1.1), `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`, Story 9.3, Story 9.4, ADR-0044, ADR-0021, ADR-0091 (Proposed) |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|---|
|| 0.1 | 2026-08-23 | (prior batch run) | Initial defective draft (wrong H1 / flat BRD-style Section 5) |
|| 0.2 | 2026-08-23 | FDD Writer Agent | Full regeneration using correct FDD template and ADR-0079 (then Proposed) |
|| 1.0 | 2026-08-23 | FDD Writer Agent | Updated for Accepted ADR-0079, final BRD-0079, and ready-to-build Stories 9.3 and 9.4 |
|| 1.1 | 2026-08-25 | Business & Requirements Analyst | Corrected every design element that assumed `alert_rule`/notification-channel infrastructure already exists — verified by grep (both repos) that none does. Realigned to ADR-0079's 2026-08-25 Amendment: v1 activation creates and returns a `watchlist` only, storing thresholds/notification-channel intent as data; `alert_rule` creation is a named, not-yet-numbered follow-on gated on `ADR-0091` (Proposed) being accepted and its Story 10.9 being built. Corrections marked in place, original text not silently deleted. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates the accepted (and 2026-08-25-amended) ADR-0079 and the approved BRD-0079 (v1.1) into a functional design for a **crisis template bundle and activation** capability. The feature provides a small set of platform-wide, pre-configured crisis templates that a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` can activate in one step to create a tenant-owned `watchlist` for common reputation-risk scenarios, recording the requested thresholds and notification-channel intent for a future alert-delivery follow-on *(amended 2026-08-25 — originally "create a tenant-owned `watchlist` and `alert_rule`"; no `alert_rule` exists — see ADR-0079's Amendment)*.

### 2.2 Scope

- **In scope:**
  - Platform-wide `crisis_templates` table (default query, AST, thresholds, playbook, parameters, activation status).
  - Per-tenant `tenant_crisis_templates` activation record.
  - `GET /v1/crisis-templates` list/preview endpoint.
  - `POST /v1/crisis-templates/:templateKey/activate` endpoint with mustache-style parameter interpolation and optional customization.
  - Playbook as read-only, advisory data returned at preview time now, and at alert time once the `ADR-0091` follow-on ships *(amended 2026-08-25)*.
  - The *Crisis Threshold Wizard* frontend in `social-listening-admin` (selection, preview, customization, activation, navigation), including an explicit disclosure that v1 does not deliver automated alerts *(amended 2026-08-25)*.
  - Reuse of the existing `watchlist` infrastructure (ADR-0044) and the boolean query AST (ADR-0021) *(amended 2026-08-25 — originally "Reuse of existing `watchlist`, `alert_rule`, and real-time-alert infrastructure (ADR-0044)"; `ADR-0044` never defined `alert_rule`, and no real-time-alert infrastructure exists — see ADR-0079's Correction)*.
  - **Added 2026-08-25:** storing thresholds and notification-channel intent as data on `tenant_crisis_templates`, for a not-yet-numbered follow-on story to consume once `ADR-0091` is accepted and built.

- **Out of scope:**
  - Workflow enforcement, SLA tracking, or step completion tracking for playbooks in v1.
  - New alerting pipeline, delivery channel, or query engine.
  - AI-generated custom templates, threshold tuning, or playbook drafting.
  - Cross-template chaining or combined-crisis bundles.
  - Real-time alert display/triage UI itself.
  - A Platform-Admin template-management UI (initial templates are seeded by migration/fixtures).
  - **Added 2026-08-25:** real `alert_rule` creation, threshold evaluation, and notification delivery of any kind (in-app, email, webhook). No such infrastructure exists in the codebase; it is owned by `ADR-0091` (Proposed) and Story 10.9 (Blocked — pending ADR acceptance).

### 2.3 Target Audience

Backend engineers implementing the tables and activation endpoint, frontend engineers building the Crisis Threshold Wizard, QA writing contract tests, and product/UX stakeholders reviewing template content and activation experience.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** When a reputation risk emerges, a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` currently must manually build a watchlist query, set alert thresholds, and create a triage plan outside the product. This is slow, error-prone, and inconsistent across tenants (BRD-0079 §6).
- **Business/user value:** Faster time to protection (under one minute), a standardized first response via a visible playbook, lower setup friction for new tenants, and stronger differentiation for enterprise reputation-management use cases (BRD-0079 §2, §3).
- **Source requirements:** ADR-0079 (Accepted 2026-08-23), BRD-0079, `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`, Story 9.3 and Story 9.4 in `docs/user-stories/epic-9-adr-0077-to-0085.md`.
- **Constraints and dependencies:**
  - Builds entirely on the existing `watchlist` primitive (ADR-0044) and the boolean query AST (ADR-0021). No new alerting or query engine is introduced — and, per the 2026-08-25 amendment, none is fabricated ahead of `ADR-0091` either *(amended 2026-08-25 — originally "existing `watchlist`/`alert_rule` primitives (ADR-0044)"; `ADR-0044` never defined `alert_rule`)*.
  - Tenant isolation is mandatory: one tenant must never see another tenant's activations or watchlists *(amended 2026-08-25 — originally "activations, watchlists, or alert rules"; no alert rule exists in v1)*.
  - Platform template updates must never retroactively change already-activated tenant instances.
  - All activation writes occur inside a single database transaction.
  - **Added 2026-08-25:** real alert-rule creation is out of scope for v1 and depends on `ADR-0091` (Proposed, not Accepted) and its Story 10.9 (Blocked). This design must not create a competing, provisional `alert_rules` schema ahead of that ADR's acceptance.

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
||---|---|---|
|| G1 | Reduce time to activate crisis monitoring to under one minute | End-to-end activation time from wizard open to active watchlist/alert is measured and typically under 60s |
|| G2 | Standardize first response for common reputation crises | Every v1 template includes a visible, consistent playbook shown at preview and alert time |
|| G3 | Lower setup friction for brand managers | Self-service activation is possible with no hand-written boolean query required |
|| G4 | Reuse existing primitives, no new engines | No new alerting pipeline, query engine, or workflow orchestrator is introduced |
|| G5 | Keep platform defaults independent of tenant activations | Updating a `crisis_templates` row never mutates an existing `tenant_crisis_templates` activation's copied query, thresholds, or playbook |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `GET /v1/crisis-templates` (list and preview)

- **Description:** Returns the set of active, platform-wide crisis templates available for a tenant to preview and activate.
- **Triggers:** The Crisis Threshold Wizard loads, or any client needs the current template catalog.
- **Inputs:** Authenticated tenant/user session; no request body. Read access does not require an elevated role.
- **Processing:**
  1. Authenticate the caller and resolve tenant context.
  2. Query `crisis_templates` for rows where `is_active = true`.
  3. Return preview-relevant fields: `template_key`, `name`, `description`, `default_query`, `default_thresholds`, `parameters`, `playbook`.
- **Outputs:** A list of active templates with preview data.
- **Error handling:** Unauthenticated requests are rejected before querying; an empty active-template set returns an empty list, not an error.
- **Edge cases:** A template flagged `is_active = false` is excluded from the list even if a tenant has previously activated it.

### 5.2 Feature / Capability: `POST /v1/crisis-templates/:templateKey/activate`

- **Description:** Creates a tenant-owned `watchlist` from a platform crisis template, optionally customized, and records the activation together with the requested thresholds and notification-channel intent *(amended 2026-08-25 — originally "Creates a tenant-owned `watchlist` and `alert_rule`..."; no `alert_rule` is created in v1 — see ADR-0079's Amendment)*.
- **Triggers:** The user confirms activation in the Crisis Threshold Wizard after previewing and optionally customizing a template.
- **Inputs:**
  - Path parameter `templateKey` (references `crisis_templates.template_key`).
  - Request body:
    - `name?` — optional custom watchlist name.
    - `variables: Record<string, string | string[]>` — e.g. `{ brand_name: "Acme", competitors: ["CompA"] }`.
    - `customQuery?` — optional override query rendered from `variables`.
    - `customThresholds?` — `{ volumeSpikePct?, negativeSentimentPct?, timeWindowMinutes? }`.
    - `notificationChannelIds: string[]` — required, stored as intent only; not resolved against a real channel service in v1 *(amended 2026-08-25 — originally "required target destinations for the generated `alert_rule`")*.
  - Caller identity: `user_id`, `tenant_id`, role.
- **Processing (single transaction):**
  1. Authorize the caller; reject if the role is not `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.
  2. Look up `crisis_templates` by `template_key`; reject if not found or `is_active = false`.
  3. Verify every `required` parameter in `crisis_templates.parameters` is present in `variables`.
  4. If `customThresholds` is supplied, validate it against the core `AlertRuleThresholds` schema (reused for shape validation only) before any write.
  5. Interpolate `default_query` and `default_ast` with `variables` to produce a concrete watchlist query and AST.
  6. Create a `watchlist` from the rendered AST under the caller's `user_id`, scoped to the caller's tenant.
  7. ~~Create an `alert_rule` from `default_thresholds` (or `customThresholds`) and `notificationChannelIds`, linked to the new watchlist. Populate `alert_rule.metadata` with `tenant_crisis_template_id` and a `playbook` snapshot.~~ **Removed 2026-08-25 — no `alert_rule` table exists.** No `alert_rule` is created.
  8. Write the `tenant_crisis_templates` record, including `watchlist_id`, the effective `thresholds` (`default_thresholds` merged with any `customThresholds`), `notification_channel_ids`, the `playbook` snapshot, and activation `variables` *(amended 2026-08-25 — added `thresholds`/`notification_channel_ids` in place of the removed `alert_rule` linkage)*.
  9. Return the new `tenantCrisisTemplateId`, `watchlistId`, `status: 'active'`, `playbook`, `thresholds`, and `notificationChannelIds` *(amended 2026-08-25 — originally "..., `alertRuleId`, `status: 'active'`..."; no `alertRuleId` is returned in v1)*.
- **Outputs:** JSON response with the new identifiers, status, playbook, thresholds, and notification-channel intent.
- **Error handling:**
  - Unknown or inactive `templateKey` → not-found / inactive error before any write.
  - Missing required variable → validation error before any write.
  - Invalid `customThresholds` → validation error before any write.
  - Missing `notificationChannelIds` → validation error before any write.
  - Caller lacking required role → authorization rejection.
  - Downstream creation failure → activation fails atomically; no partial rows are committed.
  - Quota/volume risk on the resulting query → surfaced as an inline warning to the wizard per BR-009 in BRD-0079 (v1.1), which now also requires the wizard to disclose that v1 does not deliver automated alerts.
- **Edge cases:**
  - Activating the same `template_key` multiple times for one tenant is allowed; each activation creates independent `watchlist`/`tenant_crisis_templates` rows *(amended 2026-08-25 — originally "`watchlist`/`alert_rule`/`tenant_crisis_templates` rows")*.
  - Customization changes only the copied values in the new `watchlist` and the `tenant_crisis_templates` row; it never writes back to `crisis_templates` *(amended 2026-08-25 — originally "the new `watchlist`/`alert_rule`")*.
  - The `competitors` variable is required for the `competitor-surge` template; activation fails without it.

### 5.3 Feature / Capability: Platform template independence from tenant activations

- **Description:** Ensures that editing or deactivating a platform `crisis_templates` row never mutates a tenant's already-activated `watchlist` or `tenant_crisis_templates` record *(amended 2026-08-25 — originally "`watchlist`, `alert_rule`, or `tenant_crisis_templates` record"; no `alert_rule` exists in v1)*.
- **Triggers:** A `Platform-Admin` or seed/migration process updates a `crisis_templates` row.
- **Inputs:** Updated template field values.
- **Processing:** Because `default_ast`, `default_thresholds`, and `playbook` are copied into the tenant's own `watchlist` and `tenant_crisis_templates` at activation time, later template edits have no effect on existing activations *(amended 2026-08-25 — originally "copied into the tenant's own `watchlist`/`alert_rule` and `tenant_crisis_templates`"; no `alert_rule` exists in v1)*.
- **Outputs:** Existing tenant rows remain unchanged after a template edit.
- **Error handling:** Not applicable — structural copy-not-reference guarantee.
- **Edge cases:** A template is deactivated after tenants have already activated it; those tenants keep their independent assets, but the template disappears from future `GET /v1/crisis-templates` listings.

### 5.4 Feature / Capability: Playbook as advisory data

- **Description:** Each template carries a `playbook` — ordered triage steps with owner, action, and recommended SLA minutes — surfaced to the UI but never executed or enforced by the backend.
- **Triggers:** Returned as part of template preview (5.1) now, and alongside any alert generated once the `ADR-0091` follow-on ships *(amended 2026-08-25 — originally "alongside any alert generated from an activated template's `alert_rule`"; no `alert_rule` exists in v1, so nothing fires yet)*.
- **Inputs:** `playbook` JSON stored on `crisis_templates` and copied to `tenant_crisis_templates` at activation *(amended 2026-08-25 — originally "copied to `tenant_crisis_templates` and `alert_rule.metadata`"; there is no `alert_rule.metadata` in v1)*.
- **Processing:** Backend passes `playbook` through unmodified; no state machine, completion tracking, or SLA-breach detection in v1.
- **Outputs:** `playbook` JSON rendered by the UI as a checklist-like display at preview and alert time.
- **Error handling:** A missing or malformed `playbook` is a template-authoring defect; the UI should tolerate an absent playbook gracefully.
- **Edge cases:** v1 does not track whether any step was completed.

### 5.5 Feature / Capability: Crisis Threshold Wizard (frontend)

- **Description:** The `social-listening-admin` UI flow that lets a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` browse, preview, customize, and activate crisis templates.
- **Triggers:** User navigates to the Crisis Threshold Wizard.
- **Inputs:** Active template list from `GET /v1/crisis-templates`; user selections and edits to thresholds/query.
- **Processing:**
  1. List active templates as selectable cards.
  2. On selection, show `TemplatePreview` with `default_query`, `default_thresholds`, `parameters`, and `PlaybookPreview`.
  3. Allow the user to edit thresholds (and optionally the query) before committing.
  4. On confirm, call `POST /v1/crisis-templates/:templateKey/activate` with `variables`, `customThresholds`, and `notificationChannelIds`.
  5. On success, navigate the user to the newly created watchlist.
  6. **Added 2026-08-25:** Display a persistent, plain-language disclosure that v1 does not deliver automated alerts — the activated watchlist provides monitoring only until a future release wires real alert delivery.
- **Outputs:** A newly activated, tenant-owned watchlist; user is redirected to view/manage it *(amended 2026-08-25 — originally "A newly activated, tenant-owned watchlist and alert rule"; no alert rule is created in v1)*.
- **Error handling:** Activation errors (missing variables, invalid thresholds, inactive template, authorization failure, quota/volume risk) are surfaced inline, not as console-only or navigation errors.
- **Edge cases:** User abandons the wizard mid-customization — no backend state is written until the explicit activation call succeeds; partial edits are local/client-side only.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Tenant-Brand-Reputation-Manager | Primary actor; activates and owns crisis monitoring; will receive alerts with the linked playbook once the `ADR-0091` follow-on ships *(amended 2026-08-25 — originally "receives alerts with the linked playbook"; v1 delivers no alerts)* |
|| Tenant-Admin | Primary actor; can also activate templates and see which templates are active tenant-wide |
|| Tenant-Social-Care-Agent | Secondary actor; will open the playbook from a fired alert and follow triage steps once the `ADR-0091` follow-on ships *(amended 2026-08-25)* |
|| Tenant-User | Secondary actor; will be able to receive crisis alerts once the `ADR-0091` follow-on ships *(amended 2026-08-25 — originally "if on the alert rule's recipient list"; no alert rule exists in v1)* |
|| Platform-Admin | Seeds and maintains `crisis_templates`; not a runtime actor in the activation flow itself |
|| Existing watchlist service (system actor) | Created and invoked by the activation flow; not modified by this feature *(amended 2026-08-25 — originally "Existing watchlist / alert-rule / real-time-alert services"; only the watchlist service exists)* |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 9.3 | backend engineer | build `crisis_templates`, `tenant_crisis_templates`, and `POST /v1/crisis-templates/:id/activate` to create a preconfigured `watchlist` from a template, recording thresholds and notification-channel intent for a future alert-delivery follow-on | `Tenant-Brand-Reputation-Manager` can activate crisis monitoring in one click | `crisis_templates` has `template_key`/`default_query`/`default_thresholds`/`playbook`; `tenant_crisis_templates` tracks `watchlist_id`/`thresholds`/`notification_channel_ids`; activation creates and returns a `watchlist` owned by the caller; activation copies defaults so later template changes don't retroactively affect activated instances; `playbook` is advisory only, not a workflow engine *(amended 2026-08-25 — originally "create a preconfigured `watchlist` and `alert_rule`... `tenant_crisis_templates` tracks `watchlist_id`/`alert_rule_id`... creates and returns a `watchlist`/`alert_rule`"; see ADR-0079's Amendment and the corresponding revised Story 9.3 Acceptance Criteria)* |
|| Story 9.4 | Tenant-Brand-Reputation-Manager | use a wizard in `social-listening-admin` to preview and activate crisis templates | I can start monitoring for reputation risks without writing a watchlist by hand | `CrisisThresholdWizard` lists active templates; selecting one shows `default_query`/`default_thresholds`/`playbook`; thresholds are customizable before activation; activation calls the endpoint and navigates to the new watchlist; the wizard discloses that v1 does not deliver automated alerts; errors (e.g. quota risk) are surfaced inline *(amended 2026-08-25 — added the disclosure requirement; see the corresponding revised Story 9.4 Acceptance Criteria)* |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — activating a crisis template:**

1. `Tenant-Brand-Reputation-Manager` (or `Tenant-Admin`) opens the Crisis Threshold Wizard in `social-listening-admin`.
2. Wizard calls `GET /v1/crisis-templates`; backend returns active templates (5.1).
3. Wizard renders template list; user selects a scenario (e.g. "Brand Crisis").
4. Wizard renders `TemplatePreview` with `default_query`, `default_thresholds`, `parameters`, and `PlaybookPreview`.
5. User supplies required `variables` and optionally edits thresholds/query.
6. User confirms activation; wizard calls `POST /v1/crisis-templates/:templateKey/activate` with `variables`, `customThresholds`, and `notificationChannelIds`.
7. Backend authorizes the role, looks up the template, validates required variables and thresholds, interpolates `default_ast` with `variables`, creates a `watchlist`, and writes the `tenant_crisis_templates` record (including `thresholds`, `notification_channel_ids`, and the `playbook` snapshot) — all in one transaction (5.2) *(amended 2026-08-25 — originally "creates a `watchlist`, creates an `alert_rule` with playbook snapshot, and writes the `tenant_crisis_templates` record"; no `alert_rule` is created)*.
8. Backend returns `tenantCrisisTemplateId`, `watchlistId`, `status: 'active'`, `playbook`, `thresholds`, and `notificationChannelIds` *(amended 2026-08-25 — originally "..., `alertRuleId`, `status: 'active'`...")*.
   - On error, the wizard shows an inline error or warning instead.
9. Wizard navigates the user to the newly created watchlist, with a persistent disclosure that v1 does not yet deliver automated alerts *(amended 2026-08-25)*.
10. ~~(Later, asynchronously) The `alert_rule` fires through the existing real-time-alerts pipeline; the fired alert surfaces the linked `playbook` for triage (5.4), consumed by `Tenant-Social-Care-Agent`/`Tenant-User` recipients.~~ **Removed from the v1 workflow, 2026-08-25 — no `alert_rule` and no real-time-alerts pipeline exist.** This step becomes real once a not-yet-numbered follow-on story wires `ADR-0091`'s alert infrastructure to `tenant_crisis_templates.thresholds`/`.notification_channel_ids`, gated on `ADR-0091` being accepted and its Story 10.9 being built.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Template catalog data authored/seeded at the platform level (`crisis_templates`).
- User selection and optional customization (query, thresholds, `variables`, `notificationChannelIds`) from the wizard.
- Authenticated caller identity (`user_id`, `tenant_id`, role) from the existing session/RLS mechanism.

### 7.2 Data Outputs

- A new `watchlist` row (using the existing table/service from ADR-0044), owned by the caller's tenant *(amended 2026-08-25 — originally "New `watchlist` and `alert_rule` rows"; no `alert_rule` table exists)*.
- A new `tenant_crisis_templates` row recording the activation, including `thresholds` and `notification_channel_ids` as stored intent data.
- `playbook` JSON passed through to the UI at preview time now, and at alert time once the `ADR-0091` follow-on ships *(amended 2026-08-25)*.

### 7.3 Data Model / Entities

|| Entity | Key Attributes | Relationships |
||---|---|---|
|| `crisis_templates` (platform-wide, not tenant-scoped) | `id` (uuid), `template_key` (text, unique), `name` (text), `description` (text), `default_query` (text), `default_ast` (jsonb), `parameters` (jsonb), `default_thresholds` (jsonb), `playbook` (jsonb), `is_active` (boolean) | Source template for zero or more `tenant_crisis_templates` activations; not owned by any tenant |
|| `tenant_crisis_templates` (tenant-scoped) | `id` (uuid), `tenant_id` (uuid), `template_key` (text), `watchlist_id` (uuid, FK → watchlists ON DELETE CASCADE), `thresholds` (jsonb), `notification_channel_ids` (jsonb), `variables` (jsonb), `custom_thresholds` (jsonb), `playbook` (jsonb), `created_by_user_id` (uuid), `created_at` (timestamptz) | Records one activation; each activation owns exactly one `watchlist` *(amended 2026-08-25 — originally included `alert_rule_id` (uuid, FK → alert_rules ON DELETE CASCADE) and "owns exactly one `watchlist` and one `alert_rule`"; replaced with `thresholds`/`notification_channel_ids` stored-intent columns — see ADR-0079's Amendment)* |
|| `watchlist` (existing, ADR-0044) | Created from rendered `default_ast` or customized query | Owned by `created_by_user_id`, scoped to `tenant_id`; referenced by `tenant_crisis_templates.watchlist_id` |
|| ~~`alert_rule` (existing, ADR-0044)~~ | **Removed 2026-08-25 — does not exist.** `ADR-0044` never defined `alert_rule`; no such table exists in the codebase. Owned by `ADR-0091` (Proposed), not this feature. | — |

### 7.4 Validation Rules

- `template_key` referenced by an activation request must exist in `crisis_templates` and have `is_active = true`.
- Every `required` parameter in `crisis_templates.parameters` must be present in the supplied `variables`.
- `customThresholds`, when supplied, must validate against the core `AlertRuleThresholds` schema (reused for shape validation only) before any database write.
- `notificationChannelIds` must contain at least one entry; stored as intent, not resolved against a real channel service *(amended 2026-08-25)*.
- Rendered `default_ast` must remain a valid `WatchlistAST` after mustache-style interpolation with `variables`.
- `tenant_id` on every created row must match the authenticated caller's tenant, never client-supplied.
- `created_by_user_id` is populated from the authenticated caller to support audit (NFR-005).

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | A tenant user may only activate templates on behalf of their own tenant; data is never shared across tenants. | Activation endpoint |
|| BR2 | Activating a template creates a tenant-owned `watchlist` instance; requested thresholds and notification-channel intent are recorded as data on `tenant_crisis_templates` *(amended 2026-08-25 — originally "creates tenant-owned `watchlist` and `alert_rule` instances")*. | Activation endpoint |
|| BR3 | Deleting a generated `watchlist` cascades and removes the associated `tenant_crisis_templates` record *(amended 2026-08-25 — originally "Deleting a generated `watchlist` or `alert_rule`")*. | Data lifecycle |
|| BR4 | Platform `crisis_templates` are not tenant-scoped and are read-only for tenant users in v1. | Template catalog |
|| BR5 | The playbook is advisory in v1; the system does not enforce steps, track completion, or raise SLA breaches. | Playbook handling |
|| BR6 | Default query, AST, thresholds, and playbook are copied at activation time; later changes to the platform template do not affect existing activations. | Activation / template independence |
|| BR7 | Activation requires the caller to have the `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role. | Activation authorization |
|| BR8 | Only templates with `is_active = true` may be listed and activated. | Template catalog / activation |
|| BR9 | Every `required` template parameter must be present in the supplied `variables` map or activation fails. | Activation validation |
|| BR10 | `customThresholds` must validate against the core `AlertRuleThresholds` schema before any database write. | Activation validation |
|| BR11 | Activation requires at least one `notificationChannelIds` entry. | Activation validation |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
||---|---|---|---|
|| Crisis Threshold Wizard (`social-listening-admin`) | Inbound to backend | Lists templates and triggers activation | HTTPS REST, JSON (`GET /v1/crisis-templates`, `POST /v1/crisis-templates/:templateKey/activate`) |
|| Watchlist service (ADR-0044) | Outbound from activation flow | Creates the tenant-owned `watchlist` from rendered AST | Existing internal watchlist creation API |
|| ~~Alert-rule service (ADR-0044)~~ | ~~Outbound from activation flow~~ | ~~Creates the tenant-owned `alert_rule` from thresholds and `notificationChannelIds`; embeds `playbook` snapshot in `metadata`~~ | **Removed 2026-08-25 — no alert-rule service exists; ADR-0044 never defined one. Owned by ADR-0091 (Proposed).** |
|| Boolean query AST parser (ADR-0021) | Internal | Interprets `default_ast`/customized query into the watchlist's stored query representation | Existing internal AST format |
|| Mustache-style interpolator | Internal | Replaces `{{placeholder}}` tokens in `default_query` and `default_ast` with `variables` before watchlist creation | String/array substitution |
|| ~~Notification-channel service (existing)~~ | ~~Internal~~ | ~~Validates and resolves `notificationChannelIds` before `alert_rule` creation~~ | **Removed 2026-08-25 — no notification-channel service exists in the codebase.** |
|| ~~Real-time alerts pipeline (existing)~~ | ~~Downstream, asynchronous~~ | ~~Fires alerts from the newly created `alert_rule`, surfacing the linked `playbook`~~ | **Removed 2026-08-25 — no real-time alerts pipeline exists; owned by ADR-0091 (Proposed).** |
|| ~~Unified social inbox (existing feature)~~ | ~~Downstream, consumer~~ | ~~Triage surface where `Tenant-Social-Care-Agent` may act on a fired crisis alert~~ | **Removed 2026-08-25 — not a v1 consumer; no alerts fire in v1.** |

---

## 10. Non-Functional Considerations

- **Performance:** Activation must complete and return a response within three seconds for typical templates (BRD-0079 NFR-001).
- **Security / access control:** Tenant activations and watchlists must not be visible or editable by other tenants (NFR-002); activation requires `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role; playbook role assignments must respect existing RBAC *(amended 2026-08-25 — originally "Tenant activations, watchlists, and alert rules")*.
- **Scalability:** No new pipeline is introduced; scaling characteristics follow the existing watchlist infrastructure *(amended 2026-08-25 — originally "watchlist/alert-rule/real-time-alerts infrastructure")*.
- **Reliability / availability:** Activation is atomic with respect to its `watchlist` and `tenant_crisis_templates` writes — a failure partway through must not leave an orphaned or dangling reference *(amended 2026-08-25 — originally "`watchlist`, `alert_rule`, and `tenant_crisis_templates` writes")*.
- **Audit and logging:** `created_by_user_id` is stored on every activation for audit attribution (NFR-005).
- **Accessibility:** The wizard must be keyboard navigable and responsive, including keyboard-selectable template cards and clearly labeled/validated threshold fields (NFR-004).
- **Maintainability:** Platform templates must be updatable (content, thresholds, playbook) without a product release, since they are stored as data in `crisis_templates` (NFR-003).

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| Unknown or inactive `templateKey` | Template not available | Activation endpoint rejects before creating any `watchlist`/`tenant_crisis_templates` row *(amended 2026-08-25 — originally "creating any `watchlist`/`alert_rule`/`tenant_crisis_templates` row")* |
|| Caller lacks required role | Access denied / insufficient permissions | Standard authorization rejection |
|| Missing required `variables` | Missing required information (e.g. "Competitor names are required for Competitor Surge") | Validation error before any write |
|| Missing `notificationChannelIds` | Select at least one notification channel | Validation error before any write |
|| Invalid `customThresholds` | Threshold values are not valid | Validation error against `AlertRuleThresholds` schema before any write |
|| Rendered `default_ast` is invalid | Query could not be built from the supplied values | Validation error before `watchlist` creation |
|| Underlying watchlist/activation-record creation failure | Activation failed; please try again | Transaction rolls back; no partial `tenant_crisis_templates` record is committed *(amended 2026-08-25 — originally "Underlying watchlist/alert-rule creation failure")* |
|| Broad/high-volume default or customized query | Inline quota/volume-risk warning | Activation may proceed or be blocked depending on severity; warning is shown before or after activation per BR-009 |
|| Cross-tenant access attempt | Access denied / not found | Rejected by tenant isolation |
|| Malformed or missing `playbook` on a template | Playbook section not shown | UI degrades gracefully; not treated as a hard error |

---

## 12. Assumptions and Dependencies

- The watchlist CRUD ~~and `alert_rule` primitives~~ primitive (ADR-0044) — only the watchlist primitive exists; no `alert_rule` primitive exists (amended 2026-08-25) — and the boolean query AST (ADR-0021) are already built and stable.
- ~~The real-time alerts pipeline is already built and is the delivery mechanism this feature feeds into.~~ **Corrected 2026-08-25:** No real-time alerts pipeline exists. v1 does not feed into any delivery mechanism; alert delivery is a named follow-on gated on ADR-0091 (Proposed) being accepted and built.
- Crisis templates are initially seeded by the platform and are read-only for tenants in v1.
- Users who may activate templates are either `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.
- At least one notification channel **identifier** must be supplied at activation time, stored as intent — no channel service exists to validate against in v1 (amended 2026-08-25).
- No external dependencies beyond the existing internal watchlist service (amended 2026-08-25 — originally 'watchlist/alert-rule/real-time-alerts services'; only the watchlist service exists).

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
||---|---|---|---|
|| Q1 | Should repeat activation of the same `template_key` for one tenant be blocked, deduplicated, or freely allowed? | Product / Engineering | Before implementation of Story 9.3 |
|| Q2 | Should playbook steps eventually be enforced as a workflow, or remain permanently advisory? | Product | Future iteration |

---

## 14. Appendix

### Glossary

- **Crisis template:** A pre-configured bundle of watchlist query, alert thresholds, parameters, and playbook for a common reputation crisis.
- **Playbook:** An ordered set of recommended triage steps, owners, and time-boxed actions linked to a crisis template.
- **Activation:** The act of creating a tenant-scoped `watchlist` and recording threshold/notification-channel intent on `tenant_crisis_templates` from a platform crisis template (amended 2026-08-25 — originally 'watchlist and alert_rule').
- **Watchlist:** A saved boolean query that defines which posts a tenant is monitoring.
- ~~**Alert rule:** A threshold and delivery configuration linked to a watchlist that triggers real-time alerts.~~ **Removed 2026-08-25 — no alert_rule table or type exists in v1; owned by ADR-0091 (Proposed).**
- **`crisis_templates`:** Platform-wide table storing default crisis templates.
- **`tenant_crisis_templates`:** Per-tenant table recording each template activation.
- **Five v1 templates:** Brand Crisis, Product Recall, Executive Attack, Competitor Surge, Data-Breach Rumor.

### Reference links

- ADR: `docs/adr/0079-crisis-template-bundle-and-activation.md` (Status: Accepted 2026-08-23)
- BRD: `docs/project docs/Business-Requirements/BRD-0079-Crisis-Template-Bundle-And-Activation.md`
- Feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0044` (watchlist primitive only — amended 2026-08-25: ADR-0044 never defined `alert_rule`), `ADR-0021` (boolean query AST), `ADR-0091` (Proposed — owns the real alert-rule/delivery infrastructure this feature's v1 defers to)
- Related user stories: Story 9.3 (backend), Story 9.4 (frontend), both in `docs/user-stories/epic-9-adr-0077-to-0085.md`
- No `docs/product-research/reports/20-crisis-threshold-wizard-deep-research.md` (or equivalent) was found for this feature.

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
