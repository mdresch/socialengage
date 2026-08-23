# BRD-0079 — Crisis Template Bundle and Activation

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0079 — Crisis Template Bundle and Activation |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0079-crisis-template-bundle-and-activation.md, ../Business-Requirements/BRD-0079-Crisis-Template-Bundle-And-Activation.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0079-crisis-template-bundle-and-activation.md and the business requirements in BRD-0079-Crisis-Template-Bundle-And-Activation.md into functional design for **Crisis Template Bundle And Activation**.
SocialEngage must help brand-reputation teams begin monitoring for common crisis scenarios within seconds, not hours. Today, a `Tenant-Brand-Reputation-Manager` has to build a watchlist query, define alert thresholds, and create a triage playbook from scratch every time a new risk appears. This is slow, error-prone, and produces inconsistent first responses across tenants.

This BRD defines a *crisis template bundle and activation* capability. The system will ship a small set of platform-wide, pre-configured crisis templates (brand crisis, product recall, executive-name attack, competitor surge, data-breach rumor). A tenant user can open a crisis threshold wizard, preview the default query and thresholds, customize them if needed, and activate the template. Activation creates a preconfigured `watchlist` and `alert_rule` for that tenant and stores a linked playbook the team can follow when an alert fires.

The expected business value is faster time to protection, a more consistent first response, lower setup friction for new tenants, and stronger differentiation for enterprise reputation-management use cases — while reusing the existing watchlist and alert primitives so no new alerting engine is required.

---

### 2.2 Scope
**In scope:**
- A platform-level `crisis_templates` table that stores default templates and playbooks.
- A per-tenant `tenant_crisis_templates` table that records each activation and links to the generated `watchlist` and `alert_rule`.
- A `POST /v1/crisis-templates/:id/activate` flow that creates a preconfigured `watchlist` and `alert_rule` for the calling tenant.
- Optional preview and customization of the default query and thresholds before activation.
- Returning the linked playbook as advisory, read-only data to the UI and alerts.
- A frontend *Crisis Threshold Wizard* that lists templates, shows a preview, accepts customization, and triggers activation.
- Integration with the existing watchlist, boolean query AST, and real-time alert infrastructure.

**Out of scope:**
- Workflow enforcement of playbook steps or SLA tracking in v1.
- New alerting pipeline, delivery channels, or query engine.
- AI-generated custom templates, threshold tuning, or playbook drafting in v1.
- Cross-template chaining or combined-crisis bundles.
- Real-time alert display and triage tooling (those are owned by separate features).

## 3. Context and Background
See ADR Context.
SocialEngage must help brand-reputation teams begin monitoring for common crisis scenarios within seconds, not hours. Today, a `Tenant-Brand-Reputation-Manager` has to build a watchlist query, define alert thresholds, and create a triage playbook from scratch every time a new risk appears. This is slow, error-prone, and produces inconsistent first responses across tenants.

This BRD defines a *crisis template bundle and activation* capability. The system will ship a small set of platform-wide, pre-configured crisis templates (brand crisis, product recall, executive-name attack, competitor surge, data-breach rumor). A tenant user can open a crisis threshold wizard, preview the default query and thresholds, customize them if needed, and activate the template. Activation creates a preconfigured `watchlist` and `alert_rule` for that tenant and stores a linked playbook the team can follow when an alert fires.

The expected business value is faster time to protection, a more consistent first response, lower setup friction for new tenants, and stronger differentiation for enterprise reputation-management use cases — while reusing the existing watchlist and alert primitives so no new alerting engine is required.

---

## 4. Goals and Objectives
|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Reduce time to activate crisis monitoring to under one minute | Average end-to-end activation time from wizard open to active watchlist/alert |
|| 2 | Standardize first response for common reputation crises | All v1 templates include a visible, consistent triage playbook |
|| 3 | Lower setup friction for tenant brand managers | Self-service activation rate and reduction in support requests for watchlist/alert setup |
|| 4 | Reuse existing primitives rather than build new engines | No new alerting pipeline, query engine, or workflow orchestration is introduced in v1 |

---

**Positive consequences (from ADR):**
1. **Faster time to protection:** a reputation manager can activate monitoring in under a minute.
2. **Reuses existing primitives:** no new alert engine, no new query engine, no new data pipeline.
3. **Standardization with local control:** defaults are shared, but each tenant’s activated template is a separate `watchlist` and `alert_rule` they can edit or delete.
4. **Deferred workflow:** the first version does not enforce playbook SLAs or owner assignment. That remains a future feature.

---

## 5. Functional Requirements
|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | The system shall provide a platform-level `crisis_templates` table with pre-configured templates for common reputation crises | Must | Table contains `id`, `template_key`, `name`, `default_query`, `default_ast`, `default_thresholds`, `playbook`, and `is_active`; initial templates cover brand crisis, product recall, executive-name attack, competitor surge, and data-breach rumor | Product Owner |
|| BR-002 | The system shall record each activation in a tenant-scoped `tenant_crisis_templates` table | Must | Table contains `id`, `tenant_id`, `template_key`, `watchlist_id`, `alert_rule_id`, `custom_thresholds`, `created_by_user_id`, and `created_at`; one row per activation | Product Owner |
|| BR-003 | The system shall expose an endpoint to list active crisis templates available to a tenant | Must | Returns active templates including name, default query, default thresholds, and playbook for preview; tenant users only see templates, not activations of others | Product Owner |
|| BR-004 | The system shall provide an activation endpoint that creates a `watchlist` and `alert_rule` owned by the caller | Must | `POST /v1/crisis-templates/:id/activate` creates a `watchlist` from the default/customized query and an `alert_rule` from the default/customized thresholds; returns `watchlist_id`, `alert_rule_id`, and `tenant_crisis_templates` id | Product Owner |
|| BR-005 | The system shall allow the user to customize the default query and thresholds before activation | Should | The wizard exposes editable fields for thresholds and query preview; customized values are stored in the created `alert_rule` and `watchlist` | Product Owner |
|| BR-006 | The system shall not retroactively change already-activated watchlists or alert rules when platform defaults change | Must | Updating a platform template does not modify the query, thresholds, or playbook of existing `tenant_crisis_templates` activations | Product Owner |
|| BR-007 | The system shall return the linked playbook as advisory data with the template and alert | Must | `playbook` is returned as JSON and shown in the UI; it is not executed or enforced by the back end in v1 | Product Owner |
|| BR-008 | The admin UI shall provide a *Crisis Threshold Wizard* for template selection, preview, and activation | Must | Wizard lists active templates, shows preview, supports customization, calls the activation endpoint, and navigates to the new watchlist | Product Owner |
|| BR-009 | The wizard shall surface activation errors and quota risks inline | Should | Errors such as high-volume or quota-risk warnings are shown before or after activation without requiring an engineer to interpret logs | Product Owner |
|| BR-010 | Activation and related records shall respect tenant and role boundaries | Must | Only users with `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role in the tenant can activate; all created data is scoped to the tenant | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|---|
|| `Tenant-Brand-Reputation-Manager` (primary) | Activates and owns crisis monitoring | High | Activate a crisis template in under a minute and receive alerts with a linked playbook |
|| `Tenant-Admin` (primary) | Manages tenant setup and user access | High | See which templates are active and who receives the alerts |
|| `Tenant-Social-Care-Agent` (secondary) | Responds to crisis alerts | Medium | Open the playbook from an alert and follow recommended triage steps |
|| `Tenant-User` (secondary) | May receive crisis alerts if on the recipient list | Low | See crisis alerts relevant to their role without manual configuration |
|| `Platform-Admin` | Seeds and maintains platform templates | Medium | Update or add platform templates without a full release |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.3 | epic-9-adr-0077-to-0085.md | As backend engineer, I want `crisis_templates`, `tenant_crisis_templates`, and `POST /v1/crisis-templates/:id/activate` to create a preconfigured `watchlist`... | `crisis_templates` table exists with `template_key`, `default_query`, `default_thresholds`, and `playbook`.; `tenant_crisis_templates` table tracks the `watc... |
| Story 9.4 | epic-9-adr-0077-to-0085.md | As `Tenant-Brand-Reputation-Manager`, I want a wizard in `social-listening-admin` that lets me preview and activate crisis templates, so that I can start mon... | A `CrisisThresholdWizard` lists active `crisis_templates`.; Selecting a template shows `default_query`, `default_thresholds`, and `playbook`.; The user can c... |


## 7. Data Requirements
|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
|| `crisis_templates` | Platform default templates, queries, thresholds, and playbooks | Platform seed data / Platform Admin | Platform | Configuration data (not PII) |
|| `tenant_crisis_templates` | Per-tenant activation record linking a template to the created `watchlist` and `alert_rule` | Activation flow | Tenant | Tenant-scoped identifiers and internal IDs |
|| `watchlist_id` | Reference to the watchlist created on activation | Existing watchlist service | Tenant | Internal reference |
|| `alert_rule_id` | Reference to the alert rule created on activation | Existing alert-rule service | Tenant | Internal reference |
|| `playbook` | Ordered triage steps with owner, action, and recommended SLA minutes | `crisis_templates` | Platform | Operational guidance (advisory) |
|| `created_by_user_id` | User who performed the activation | Activation flow | Tenant | Internal user identifier |

---

## 8. Business Rules and Logic
|| ID | Rule |
|---|---|
|| BRU-001 | A tenant user may only activate templates on behalf of their own tenant; data is never shared across tenants. |
|| BRU-002 | Activating a template creates tenant-owned `watchlist` and `alert_rule` instances that the tenant may later edit or delete. |
|| BRU-003 | Platform `crisis_templates` are not tenant-scoped and are read-only for tenant users in v1. |
|| BRU-004 | The playbook is advisory in v1; the system does not enforce steps, track completion, or raise SLA breaches. |
|| BRU-005 | Default query and thresholds are copied at activation time; later changes to the platform template do not affect existing activations. |
|| BRU-006 | Activation requires the caller to have the `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role. |
|| BRU-007 | Only templates with `is_active = true` may be listed and activated. |

---

## 9. Interfaces and Integrations
|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
|| D-001 | ADR-0044 — watchlist and `alert_rule` primitives | Internal / Architectural | Engineering Lead | In place; this feature reuses it |
|| D-002 | ADR-0021 — boolean query AST | Internal / Architectural | Engineering Lead | In place for default query parsing |
|| D-003 | Real-time alerts pipeline | Internal / Existing | Engineering Lead | In place; this feature feeds into it |
|| D-004 | Story 9.3 — Crisis template bundle and activation (backend) | Internal / Implementation | Engineering Lead | Required before frontend can consume the API |
|| D-005 | Story 9.4 — Crisis threshold wizard (frontend) | Internal / Implementation | Engineering Lead | Builds on Story 9.3 |

---

- The watchlist CRUD, alert-rule, and real-time-alert primitives are already built and stable (ADR-0044 and related work).
- The boolean query AST and connector primitives needed for default queries are in place (ADR-0021).
- Crisis templates are initially seeded by the platform and are read-only for tenants in v1.
- Users who may activate templates are either `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.

## 10. Non-Functional Considerations
|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | Activation must complete and return a response within three seconds for typical templates | Performance | Should | Measured via API latency monitoring under normal load |
|| NFR-002 | Tenant activations, watchlists, and alert rules must not be visible or editable by other tenants | Security | Must | Verified by contract tests for cross-tenant 403/404 behavior |
|| NFR-003 | Platform templates must be updateable without a product release | Maintainability | Should | New or adjusted template content is read from the `crisis_templates` table, not hardcoded |
|| NFR-004 | The wizard must be keyboard navigable and responsive | Usability / Accessibility | Should | Keyboard selection and mobile layout verified in the admin UI |
|| NFR-005 | Activation actions must be attributable to a user for audit purposes | Compliance | Should | `created_by_user_id` is stored and retrievable for every activation |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
1. **Faster time to protection:** a reputation manager can activate monitoring in under a minute.
2. **Reuses existing primitives:** no new alert engine, no new query engine, no new data pipeline.
3. **Standardization with local control:** defaults are shared, but each tenant’s activated template is a separate `watchlist` and `alert_rule` they can edit or delete.
4. **Deferred workflow:** the first version does not enforce playbook SLAs or owner assignment. That remains a future feature.

---

## 12. Assumptions and Dependencies
- The watchlist CRUD, alert-rule, and real-time-alert primitives are already built and stable (ADR-0044 and related work).
- The boolean query AST and connector primitives needed for default queries are in place (ADR-0021).
- Crisis templates are initially seeded by the platform and are read-only for tenants in v1.
- Users who may activate templates are either `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.

## 13. Open Questions / Risks
|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
|| R-001 | Default templates may not fit every tenant, causing false positives or missed crises | Medium | Medium | Allow customization before activation; validate thresholds against `alert_rule` capabilities | Product Owner |
|| R-002 | Users may expect playbook steps to be enforced as a workflow | Medium | Low | Clearly label the playbook as advisory in v1 and document future workflow plans | UX Lead |
|| R-003 | Permission model for editing activated templates is not yet decided (open ADR question) | Medium | Medium | Restrict editing to the activator or a `Tenant-Admin` until the question is resolved | Engineering Lead |
|| R-004 | New or updated templates require a management surface not built in v1 | Medium | Low | Seed initial templates in a migration; plan a Platform Admin management UI for later | Product Owner |
|| R-005 | Broad default queries may match too many posts and create quota or volume risk | Medium | High | Provide preview/warning before activation; support threshold and source customization | Engineering Lead |

---

## 14. Appendix
- ADR: `../../adr/0079-crisis-template-bundle-and-activation.md`
- BRD: `../Business-Requirements/BRD-0079-Crisis-Template-Bundle-And-Activation.md`
- Feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md``
- Deep research: `docs/product-research/reports/20-crisis-threshold-wizard-deep-research.md``
- User stories: see extracted stories above