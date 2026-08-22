---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Crisis threshold wizard

### What it is

A pre-built alert template builder for the Tenant-Brand-Reputation-Manager. It offers one-click alert configurations for common reputation crises (brand crisis, product recall, executive-name attack, competitor surge) and an escalation playbook tied to each.

### End-user benefits

- **Faster crisis detection:** common reputation risks are monitored out of the box.
- **Consistent response:** each template includes a recommended triage and escalation flow.
- **Lower setup friction:** no need to manually write complex boolean queries and thresholds.
- **Team alignment:** crisis playbooks are visible to all tenant users.

### Core details

- Templates: `Brand crisis` (negative sentiment + volume spike), `Product recall` (brand + product name + negative), `Executive attack` (executive name + negative + high reach), `Competitor surge` (competitor name + volume spike), `Data breach rumor` (brand + "breach" / "hack" / "leaked").
- Each template creates an alert rule, a watchlist, and a playbook with roles, response time, and recommended actions.
- Users can customize thresholds, sources, and recipients.
- Alerts are surfaced in `09-real-time-alerts.md` and triaged in `06-unified-social-inbox.md`.

### Implementation complexity

**Low-to-medium.** Mostly a UI wrapper over existing `watchlists`, `boolean-query-builder`, and `real-time-alerts` features. The heavy part is the playbook content and escalation workflows.

### Growth and reach

A strong enterprise and brand-safety feature. Reduces the time to go from setup to active monitoring, and supports premium pricing for reputation management.

---

## Technical design

- **Data flow:** user opens crisis wizard → selects a template → wizard pre-fills a watchlist query, alert rule, and thresholds → user customizes → `POST /v1/crisis-templates` creates `watchlist`, `alert_rule`, and `playbook` rows → alerts fire through existing `real-time-alerts` pipeline.
- **Component interactions:** `CrisisThresholdWizard` → `watchlistStore` + `alertRuleStore` + `playbookStore` → `real-time-alerts` system.
- **REST/Service Bus contracts:** `GET /v1/crisis-templates`, `POST /v1/crisis-templates/:templateId/activate`, `PATCH /v1/crisis-templates/:id`. Reuses `alert_rule` and `watchlist` endpoints.
- **Storage:** `crisis_templates` table with `template_key`, `name`, `default_query`, `default_thresholds`, `playbook`; `tenant_crisis_templates` for per-tenant activation.
- **Security considerations:** Templates are platform-level defaults; tenant-scoped activations and customizations are isolated. Playbooks may contain role assignments that must respect RBAC.

## Backend principles

- **Template, not hardcode.** Store templates as data so they can be updated without a release.
- **Re-use existing primitives.** A crisis template is just a pre-filled `watchlist` + `alert_rule` + `playbook` bundle.
- **Tenant-isolated customizations.** Customizations do not affect the platform defaults or other tenants.
- **Playbook as configuration.** Playbook steps are data, not workflow engine logic, in v1.

## Frontend / UI principles

- **User flow:** brand manager opens wizard → sees template cards → selects one → previews query and thresholds → activates.
- **Component hierarchy:** `CrisisThresholdWizard` → `TemplateCardGrid` → `TemplatePreview` → `ThresholdEditor` → `PlaybookPreview`.
- **State management:** Server state for templates and activations; local state for preview and customization.
- **Accessibility and responsive design:** Template cards are keyboard-selectable; thresholds use clear labels and validation.

## Open questions

- Should the wizard be available to Tenant-Admins or only to Tenant-Brand-Reputation-Managers?
- Should playbook steps be enforced (workflow engine) or just advisory?
- How many templates ship in v1, and who creates them (platform admin, AI, or documentation)?
- Should the wizard also create a dashboard tab for the crisis?
- Can templates cross-reference each other (e.g., brand crisis + executive attack)?

## AI enhancements

- **Custom template builder:** the AI interviews the user and generates a tailored crisis query and thresholds.
- **Playbook drafting:** the AI writes a playbook with recommended actions and owners.
- **Threshold tuning:** the AI reviews historical data and recommends sensitivity based on normal volume patterns.

## Persona acceptance

- **Tenant-Brand-Reputation-Manager (primary):** can activate a crisis template in under a minute and receive alerts with a linked playbook.
- **Tenant-Admin (primary):** can see which templates are active and who receives the alerts.
- **Tenant-Social-Care-Agent (secondary):** can open the playbook from an alert and follow the recommended triage steps.
- **Tenant-User (secondary):** can see crisis alerts if they are in the recipient list.
