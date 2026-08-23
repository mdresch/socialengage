# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0079 Crisis Template Bundle and Activation |
|| Version | 1.0 |
|| Date | 2026-08-23 |
|| Author(s) | FDD Writer Agent |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Draft for Review |
|| Related Documents | ADR-0079, BRD-0079, `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`, Story 9.3, Story 9.4, ADR-0044, ADR-0021 |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|---|
|| 0.1 | 2026-08-23 | (prior batch run) | Initial defective draft (wrong H1 / flat BRD-style Section 5) |
|| 0.2 | 2026-08-23 | FDD Writer Agent | Full regeneration using correct FDD template and ADR-0079 (then Proposed) |
|| 1.0 | 2026-08-23 | FDD Writer Agent | Updated for Accepted ADR-0079, final BRD-0079, and ready-to-build Stories 9.3 and 9.4 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates the accepted ADR-0079 and the approved BRD-0079 into a functional design for a **crisis template bundle and activation** capability. The feature provides a small set of platform-wide, pre-configured crisis templates that a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` can activate in one step to create a tenant-owned `watchlist` and `alert_rule` for common reputation-risk scenarios.

### 2.2 Scope

- **In scope:**
  - Platform-wide `crisis_templates` table (default query, AST, thresholds, playbook, parameters, activation status).
  - Per-tenant `tenant_crisis_templates` activation record.
  - `GET /v1/crisis-templates` list/preview endpoint.
  - `POST /v1/crisis-templates/:templateKey/activate` endpoint with mustache-style parameter interpolation and optional customization.
  - Playbook as read-only, advisory data returned at preview and alert time.
  - The *Crisis Threshold Wizard* frontend in `social-listening-admin` (selection, preview, customization, activation, navigation).
  - Reuse of existing `watchlist`, `alert_rule`, and real-time-alert infrastructure (ADR-0044) and the boolean query AST (ADR-0021).

- **Out of scope:**
  - Workflow enforcement, SLA tracking, or step completion tracking for playbooks in v1.
  - New alerting pipeline, delivery channel, or query engine.
  - AI-generated custom templates, threshold tuning, or playbook drafting.
  - Cross-template chaining or combined-crisis bundles.
  - Real-time alert display/triage UI itself.
  - A Platform-Admin template-management UI (initial templates are seeded by migration/fixtures).

### 2.3 Target Audience

Backend engineers implementing the tables and activation endpoint, frontend engineers building the Crisis Threshold Wizard, QA writing contract tests, and product/UX stakeholders reviewing template content and activation experience.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** When a reputation risk emerges, a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` currently must manually build a watchlist query, set alert thresholds, and create a triage plan outside the product. This is slow, error-prone, and inconsistent across tenants (BRD-0079 §6).
- **Business/user value:** Faster time to protection (under one minute), a standardized first response via a visible playbook, lower setup friction for new tenants, and stronger differentiation for enterprise reputation-management use cases (BRD-0079 §2, §3).
- **Source requirements:** ADR-0079 (Accepted 2026-08-23), BRD-0079, `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`, Story 9.3 and Story 9.4 in `docs/user-stories/epic-9-adr-0077-to-0085.md`.
- **Constraints and dependencies:**
  - Builds entirely on existing `watchlist`/`alert_rule` primitives (ADR-0044) and the boolean query AST (ADR-0021). No new alerting or query engine is introduced.
  - Tenant isolation is mandatory: one tenant must never see another tenant's activations, watchlists, or alert rules.
  - Platform template updates must never retroactively change already-activated tenant instances.
  - All activation writes occur inside a single database transaction.

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

- **Description:** Creates a tenant-owned `watchlist` and `alert_rule` from a platform crisis template, optionally customized, and records the activation.
- **Triggers:** The user confirms activation in the Crisis Threshold Wizard after previewing and optionally customizing a template.
- **Inputs:**
  - Path parameter `templateKey` (references `crisis_templates.template_key`).
  - Request body:
    - `name?` — optional custom watchlist/alert name.
    - `variables: Record<string, string | string[]>` — e.g. `{ brand_name: "Acme", competitors: ["CompA"] }`.
    - `customQuery?` — optional override query rendered from `variables`.
    - `customThresholds?` — `{ volumeSpikePct?, negativeSentimentPct?, timeWindowMinutes? }`.
    - `notificationChannelIds: string[]` — required target destinations for the generated `alert_rule`.
  - Caller identity: `user_id`, `tenant_id`, role.
- **Processing (single transaction):**
  1. Authorize the caller; reject if the role is not `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.
  2. Look up `crisis_templates` by `template_key`; reject if not found or `is_active = false`.
  3. Verify every `required` parameter in `crisis_templates.parameters` is present in `variables`.
  4. If `customThresholds` is supplied, validate it against the core `AlertRuleThresholds` schema before any write.
  5. Interpolate `default_query` and `default_ast` with `variables` to produce a concrete watchlist query and AST.
  6. Create a `watchlist` from the rendered AST under the caller's `user_id`, scoped to the caller's tenant.
  7. Create an `alert_rule` from `default_thresholds` (or `customThresholds`) and `notificationChannelIds`, linked to the new watchlist. Populate `alert_rule.metadata` with `tenant_crisis_template_id` and a `playbook` snapshot.
  8. Write the `tenant_crisis_templates` record, including the `playbook` snapshot and activation `variables`.
  9. Return the new `tenantCrisisTemplateId`, `watchlistId`, `alertRuleId`, `status: 'active'`, and the `playbook`.
- **Outputs:** JSON response with the new identifiers, status, and playbook.
- **Error handling:**
  - Unknown or inactive `templateKey` → not-found / inactive error before any write.
  - Missing required variable → validation error before any write.
  - Invalid `customThresholds` → validation error before any write.
  - Missing `notificationChannelIds` → validation error before any write.
  - Caller lacking required role → authorization rejection.
  - Downstream creation failure → activation fails atomically; no partial rows are committed.
  - Quota/volume risk on the resulting query → surfaced as an inline warning to the wizard per BR-009 in BRD-0079.
- **Edge cases:**
  - Activating the same `template_key` multiple times for one tenant is allowed; each activation creates independent `watchlist`/`alert_rule`/`tenant_crisis_templates` rows.
  - Customization changes only the copied values in the new `watchlist`/`alert_rule`; it never writes back to `crisis_templates`.
  - The `competitors` variable is required for the `competitor-surge` template; activation fails without it.

### 5.3 Feature / Capability: Platform template independence from tenant activations

- **Description:** Ensures that editing or deactivating a platform `crisis_templates` row never mutates a tenant's already-activated `watchlist`, `alert_rule`, or `tenant_crisis_templates` record.
- **Triggers:** A `Platform-Admin` or seed/migration process updates a `crisis_templates` row.
- **Inputs:** Updated template field values.
- **Processing:** Because `default_ast`, `default_thresholds`, and `playbook` are copied into the tenant's own `watchlist`/`alert_rule` and `tenant_crisis_templates` at activation time, later template edits have no effect on existing activations.
- **Outputs:** Existing tenant rows remain unchanged after a template edit.
- **Error handling:** Not applicable — structural copy-not-reference guarantee.
- **Edge cases:** A template is deactivated after tenants have already activated it; those tenants keep their independent assets, but the template disappears from future `GET /v1/crisis-templates` listings.

### 5.4 Feature / Capability: Playbook as advisory data

- **Description:** Each template carries a `playbook` — ordered triage steps with owner, action, and recommended SLA minutes — surfaced to the UI but never executed or enforced by the backend.
- **Triggers:** Returned as part of template preview (5.1) and alongside any alert generated from an activated template's `alert_rule`.
- **Inputs:** `playbook` JSON stored on `crisis_templates` and copied to `tenant_crisis_templates` and `alert_rule.metadata` at activation.
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
- **Outputs:** A newly activated, tenant-owned watchlist and alert rule; user is redirected to view/manage it.
- **Error handling:** Activation errors (missing variables, invalid thresholds, inactive template, authorization failure, quota/volume risk) are surfaced inline, not as console-only or navigation errors.
- **Edge cases:** User abandons the wizard mid-customization — no backend state is written until the explicit activation call succeeds; partial edits are local/client-side only.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Tenant-Brand-Reputation-Manager | Primary actor; activates and owns crisis monitoring and receives alerts with the linked playbook |
|| Tenant-Admin | Primary actor; can also activate templates and see which templates are active tenant-wide |
|| Tenant-Social-Care-Agent | Secondary actor; opens the playbook from a fired alert and follows triage steps |
|| Tenant-User | Secondary actor; may receive crisis alerts if on the alert rule's recipient list |
|| Platform-Admin | Seeds and maintains `crisis_templates`; not a runtime actor in the activation flow itself |
|| Existing watchlist / alert-rule / real-time-alert services (system actors) | Created and invoked by the activation flow; not modified by this feature |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 9.3 | backend engineer | build `crisis_templates`, `tenant_crisis_templates`, and `POST /v1/crisis-templates/:id/activate` to create a preconfigured `watchlist` and `alert_rule` from a template | `Tenant-Brand-Reputation-Manager` can activate crisis monitoring in one click | `crisis_templates` has `template_key`/`default_query`/`default_thresholds`/`playbook`; `tenant_crisis_templates` tracks `watchlist_id`/`alert_rule_id`; activation creates and returns a `watchlist`/`alert_rule` owned by the caller; activation copies defaults so later template changes don't retroactively affect activated instances; `playbook` is advisory only, not a workflow engine |
|| Story 9.4 | Tenant-Brand-Reputation-Manager | use a wizard in `social-listening-admin` to preview and activate crisis templates | I can start monitoring for reputation risks without writing a watchlist by hand | `CrisisThresholdWizard` lists active templates; selecting one shows `default_query`/`default_thresholds`/`playbook`; thresholds are customizable before activation; activation calls the endpoint and navigates to the new watchlist; errors (e.g. quota risk) are surfaced inline |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — activating a crisis template:**

1. `Tenant-Brand-Reputation-Manager` (or `Tenant-Admin`) opens the Crisis Threshold Wizard in `social-listening-admin`.
2. Wizard calls `GET /v1/crisis-templates`; backend returns active templates (5.1).
3. Wizard renders template list; user selects a scenario (e.g. "Brand Crisis").
4. Wizard renders `TemplatePreview` with `default_query`, `default_thresholds`, `parameters`, and `PlaybookPreview`.
5. User supplies required `variables` and optionally edits thresholds/query.
6. User confirms activation; wizard calls `POST /v1/crisis-templates/:templateKey/activate` with `variables`, `customThresholds`, and `notificationChannelIds`.
7. Backend authorizes the role, looks up the template, validates required variables and thresholds, interpolates `default_ast` with `variables`, creates a `watchlist`, creates an `alert_rule` with playbook snapshot, and writes the `tenant_crisis_templates` record — all in one transaction (5.2).
8. Backend returns `tenantCrisisTemplateId`, `watchlistId`, `alertRuleId`, `status: 'active'`, and `playbook`.
   - On error, the wizard shows an inline error or warning instead.
9. Wizard navigates the user to the newly created watchlist.
10. (Later, asynchronously) The `alert_rule` fires through the existing real-time-alerts pipeline; the fired alert surfaces the linked `playbook` for triage (5.4), consumed by `Tenant-Social-Care-Agent`/`Tenant-User` recipients.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Template catalog data authored/seeded at the platform level (`crisis_templates`).
- User selection and optional customization (query, thresholds, `variables`, `notificationChannelIds`) from the wizard.
- Authenticated caller identity (`user_id`, `tenant_id`, role) from the existing session/RLS mechanism.

### 7.2 Data Outputs

- New `watchlist` and `alert_rule` rows (using existing tables/services from ADR-0044), owned by the caller's tenant.
- A new `tenant_crisis_templates` row recording the activation.
- `playbook` JSON passed through to the UI at preview and alert time.

### 7.3 Data Model / Entities

|| Entity | Key Attributes | Relationships |
||---|---|---|
|| `crisis_templates` (platform-wide, not tenant-scoped) | `id` (uuid), `template_key` (text, unique), `name` (text), `description` (text), `default_query` (text), `default_ast` (jsonb), `parameters` (jsonb), `default_thresholds` (jsonb), `playbook` (jsonb), `is_active` (boolean) | Source template for zero or more `tenant_crisis_templates` activations; not owned by any tenant |
|| `tenant_crisis_templates` (tenant-scoped) | `id` (uuid), `tenant_id` (uuid), `template_key` (text), `watchlist_id` (uuid, FK → watchlists ON DELETE CASCADE), `alert_rule_id` (uuid, FK → alert_rules ON DELETE CASCADE), `variables` (jsonb), `custom_thresholds` (jsonb), `playbook` (jsonb), `created_by_user_id` (uuid), `created_at` (timestamptz) | Records one activation; each activation owns exactly one `watchlist` and one `alert_rule` |
|| `watchlist` (existing, ADR-0044) | Created from rendered `default_ast` or customized query | Owned by `created_by_user_id`, scoped to `tenant_id`; referenced by `tenant_crisis_templates.watchlist_id` |
|| `alert_rule` (existing, ADR-0044) | Created from `default_thresholds` or `custom_thresholds`; `metadata` includes `tenant_crisis_template_id` and `playbook` snapshot | Linked to the new `watchlist`; referenced by `tenant_crisis_templates.alert_rule_id` |

### 7.4 Validation Rules

- `template_key` referenced by an activation request must exist in `crisis_templates` and have `is_active = true`.
- Every `required` parameter in `crisis_templates.parameters` must be present in the supplied `variables`.
- `customThresholds`, when supplied, must validate against the core `AlertRuleThresholds` schema before any database write.
- `notificationChannelIds` must contain at least one entry.
- Rendered `default_ast` must remain a valid `WatchlistAST` after mustache-style interpolation with `variables`.
- `tenant_id` on every created row must match the authenticated caller's tenant, never client-supplied.
- `created_by_user_id` is populated from the authenticated caller to support audit (NFR-005).

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | A tenant user may only activate templates on behalf of their own tenant; data is never shared across tenants. | Activation endpoint |
|| BR2 | Activating a template creates tenant-owned `watchlist` and `alert_rule` instances that the tenant may later edit or delete via existing surfaces. | Activation endpoint |
|| BR3 | Deleting a generated `watchlist` or `alert_rule` cascades and removes the associated `tenant_crisis_templates` record. | Data lifecycle |
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
|| Alert-rule service (ADR-0044) | Outbound from activation flow | Creates the tenant-owned `alert_rule` from thresholds and `notificationChannelIds`; embeds `playbook` snapshot in `metadata` | Existing internal alert-rule creation API |
|| Boolean query AST parser (ADR-0021) | Internal | Interprets `default_ast`/customized query into the watchlist's stored query representation | Existing internal AST format |
|| Mustache-style interpolator | Internal | Replaces `{{placeholder}}` tokens in `default_query` and `default_ast` with `variables` before watchlist creation | String/array substitution |
|| Notification-channel service (existing) | Internal | Validates and resolves `notificationChannelIds` before `alert_rule` creation | Existing internal channel API |
|| Real-time alerts pipeline (existing) | Downstream, asynchronous | Fires alerts from the newly created `alert_rule`, surfacing the linked `playbook` | Existing alert delivery mechanism |
|| Unified social inbox (existing feature) | Downstream, consumer | Triage surface where `Tenant-Social-Care-Agent` may act on a fired crisis alert | Existing inbox integration |

---

## 10. Non-Functional Considerations

- **Performance:** Activation must complete and return a response within three seconds for typical templates (BRD-0079 NFR-001).
- **Security / access control:** Tenant activations, watchlists, and alert rules must not be visible or editable by other tenants (NFR-002); activation requires `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role; playbook role assignments must respect existing RBAC.
- **Scalability:** No new pipeline is introduced; scaling characteristics follow the existing watchlist/alert-rule/real-time-alerts infrastructure.
- **Reliability / availability:** Activation is atomic with respect to its `watchlist`, `alert_rule`, and `tenant_crisis_templates` writes — a failure partway through must not leave an orphaned or dangling reference.
- **Audit and logging:** `created_by_user_id` is stored on every activation for audit attribution (NFR-005).
- **Accessibility:** The wizard must be keyboard navigable and responsive, including keyboard-selectable template cards and clearly labeled/validated threshold fields (NFR-004).
- **Maintainability:** Platform templates must be updatable (content, thresholds, playbook) without a product release, since they are stored as data in `crisis_templates` (NFR-003).

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| Unknown or inactive `templateKey` | Template not available | Activation endpoint rejects before creating any `watchlist`/`alert_rule`/`tenant_crisis_templates` row |
|| Caller lacks required role | Access denied / insufficient permissions | Standard authorization rejection |
|| Missing required `variables` | Missing required information (e.g. "Competitor names are required for Competitor Surge") | Validation error before any write |
|| Missing `notificationChannelIds` | Select at least one notification channel | Validation error before any write |
|| Invalid `customThresholds` | Threshold values are not valid | Validation error against `AlertRuleThresholds` schema before any write |
|| Rendered `default_ast` is invalid | Query could not be built from the supplied values | Validation error before `watchlist` creation |
|| Underlying watchlist/alert-rule creation failure | Activation failed; please try again | Transaction rolls back; no partial `tenant_crisis_templates` record is committed |
|| Broad/high-volume default or customized query | Inline quota/volume-risk warning | Activation may proceed or be blocked depending on severity; warning is shown before or after activation per BR-009 |
|| Cross-tenant access attempt | Access denied / not found | Rejected by tenant isolation |
|| Malformed or missing `playbook` on a template | Playbook section not shown | UI degrades gracefully; not treated as a hard error |

---

## 12. Assumptions and Dependencies

- The watchlist CRUD and `alert_rule` primitives (ADR-0044) and the boolean query AST (ADR-0021) are already built and stable.
- The real-time alerts pipeline is already built and is the delivery mechanism this feature feeds into.
- Crisis templates are initially seeded by the platform and are read-only for tenants in v1.
- Users who may activate templates are either `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.
- At least one notification channel must be available and selected at activation time.
- No external dependencies beyond the existing internal watchlist/alert-rule/real-time-alerts services.

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
- **Activation:** The act of creating a tenant-scoped `watchlist` and `alert_rule` from a platform crisis template.
- **Watchlist:** A saved boolean query that defines which posts a tenant is monitoring.
- **Alert rule:** A threshold and delivery configuration linked to a watchlist that triggers real-time alerts.
- **`crisis_templates`:** Platform-wide table storing default crisis templates.
- **`tenant_crisis_templates`:** Per-tenant table recording each template activation.
- **Five v1 templates:** Brand Crisis, Product Recall, Executive Attack, Competitor Surge, Data-Breach Rumor.

### Reference links

- ADR: `docs/adr/0079-crisis-template-bundle-and-activation.md` (Status: Accepted 2026-08-23)
- BRD: `docs/project docs/Business-Requirements/BRD-0079-Crisis-Template-Bundle-And-Activation.md`
- Feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0044` (watchlist/`alert_rule` primitives), `ADR-0021` (boolean query AST)
- Related user stories: Story 9.3 (backend), Story 9.4 (frontend), both in `docs/user-stories/epic-9-adr-0077-to-0085.md`
- No `docs/product-research/reports/20-crisis-threshold-wizard-deep-research.md` (or equivalent) was found for this feature.

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
