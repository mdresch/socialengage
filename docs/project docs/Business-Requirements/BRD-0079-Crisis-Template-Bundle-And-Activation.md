# BRD-0079 — Crisis Template Bundle and Activation

> **Status note:** ADR-0079 is *Accepted* (2026-08-23). This BRD reflects the accepted decision and the ready-to-build implementation stories 9.3 and 9.4.
>
> **Correction and amendment note (2026-08-25).** ADR-0079's Context §2 claim that "`ADR-0044` and the built watchlist/alert infrastructure" already exist was factually wrong — verified by grep across both repos: no `alert_rules` table, `AlertRule` type, or notification-channel concept exists anywhere in the codebase; the real owning ADR for that infrastructure, `ADR-0091`, is **Proposed**, not Accepted, and its Story 10.9 is Blocked. ADR-0079 was amended the same day (see its own "Correction" and "Amendment" sections, 2026-08-25) to defer real `alert_rule` creation to a follow-on story once `ADR-0091` is accepted and built. **This BRD is amended below to match** — every reference to "alert_rule," "alerts," and "protection" that implied v1 delivers real-time notification has been corrected in place with a dated marker; the original text is preserved alongside each correction per this project's historical-record convention, not silently rewritten.

## 1. Document Control

|| Field | Value |
|---|---|---|
|| Document Title | Crisis Template Bundle and Activation – Business Requirements Document |
|| Version | 1.1 |
|| Date | 2026-08-25 |
|| Author(s) | BRD Writer Agent, SocialEngage; amended by the Business & Requirements Analyst persona |
|| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved (amended, see v1.1) |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|---|
|| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0079 and feature design 20-crisis-threshold-wizard |
|| 1.0 | 2026-08-23 | BRD Writer Agent | Updated to Accepted ADR and ready-to-build Stories 9.3 and 9.4 |
|| 1.1 | 2026-08-25 | Business & Requirements Analyst | Corrected every requirement that assumed `alert_rule`/notification-channel infrastructure already exists — it does not (verified by grep, both repos). Realigned to ADR-0079's 2026-08-25 Amendment: v1 activation creates a `watchlist` only; `alert_rule` creation is deferred to a follow-on once `ADR-0091` (Proposed) is accepted and its Story 10.9 is built. Original text is not deleted where it documents the prior (incorrect) assumption — corrections are marked in place. |

---

## 2. Executive Summary

SocialEngage must help brand-reputation teams begin monitoring for common crisis scenarios within seconds, not hours. Today, a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` has to build a watchlist query, define alert thresholds, and create a triage playbook from scratch every time a new risk appears. This is slow, error-prone, and produces inconsistent first responses across tenants.

This BRD defines a *crisis template bundle and activation* capability. The system will ship a small set of platform-wide, pre-configured crisis templates (brand crisis, product recall, executive-name attack, competitor surge, data-breach rumor). A tenant user can open a crisis threshold wizard, preview the default query and thresholds, customize them if needed, and activate the template. **Activation creates a preconfigured `watchlist` for that tenant and stores the requested thresholds, notification-channel intent, and a linked playbook the team can follow when an alert eventually fires** *(amended 2026-08-25 — originally read "Activation creates a preconfigured `watchlist` and `alert_rule`..."; no `alert_rule` is created in v1, since no such infrastructure exists yet — see ADR-0079's 2026-08-25 Amendment)*.

The expected business value is faster time to standardized, ready-to-monitor setup, a more consistent first response, lower setup friction for new tenants, and stronger differentiation for enterprise reputation-management use cases — while reusing the existing watchlist primitive so no new query engine is required *(amended 2026-08-25 — originally read "faster time to protection... while reusing the existing watchlist and alert primitives so no new alerting engine is required"; v1 does not deliver real-time alert **protection** — it delivers monitoring. No `alert` primitive exists to reuse. Real alert delivery is a named follow-on, not yet built — see ADR-0079's Amendment)*.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|---|
|| 1 | Reduce time to activate crisis monitoring to under one minute | Average end-to-end activation time from wizard open to active watchlist/alert |
|| 2 | Standardize first response for common reputation crises | All v1 templates include a visible, consistent triage playbook |
|| 3 | Lower setup friction for tenant brand managers | Self-service activation rate and reduction in support requests for watchlist/alert setup |
|| 4 | Reuse existing primitives rather than build new engines | No new alerting pipeline, query engine, or workflow orchestration is introduced in v1 — and, per the 2026-08-25 amendment, v1 does not attempt to build even a minimal alerting pipeline ahead of `ADR-0091`, rather than fabricating one prematurely |

---

## 4. Scope

### 4.1 In Scope

- A platform-level `crisis_templates` table that stores default templates and playbooks.
- A per-tenant `tenant_crisis_templates` table that records each activation and links to the generated `watchlist`, and stores threshold and notification-channel-intent data for later use *(amended 2026-08-25 — originally "links to the generated `watchlist` and `alert_rule`"; no `alert_rule` exists in v1)*.
- A `POST /v1/crisis-templates/:id/activate` flow that creates a preconfigured `watchlist` for the calling tenant and records thresholds/notification-channel intent *(amended 2026-08-25 — originally "creates a preconfigured `watchlist` and `alert_rule`"; see ADR-0079's Amendment)*.
- Optional preview and customization of the default query and thresholds before activation.
- Returning the linked playbook as advisory, read-only data to the UI, and (once the ADR-0091 follow-on ships) to alerts *(amended 2026-08-25 — v1 has no alerts to attach the playbook to)*.
- A frontend *Crisis Threshold Wizard* that lists templates, shows a preview, accepts customization, and triggers activation.
- Integration with the existing watchlist and boolean query AST infrastructure *(amended 2026-08-25 — originally "watchlist, boolean query AST, and real-time alert infrastructure"; no real-time-alert infrastructure exists yet — that is ADR-0091, Proposed, not built)*.
- **Added 2026-08-25:** capturing threshold and notification-channel intent on `tenant_crisis_templates` in v1, so no data is lost once the `ADR-0091` follow-on wires real `alert_rule` creation.

### 4.2 Out of Scope

- Workflow enforcement of playbook steps or SLA tracking in v1.
- New alerting pipeline, delivery channels, or query engine.
- AI-generated custom templates, threshold tuning, or playbook drafting in v1.
- Cross-template chaining or combined-crisis bundles.
- Real-time alert display and triage tooling (those are owned by separate features).
- A Platform-Admin CRUD UI for managing templates in v1; templates are seeded by migration/fixtures.
- **Added 2026-08-25:** real `alert_rule` creation and delivery. No `alert_rules` table, `AlertRule` type, or notification-channel concept exists in the codebase as of 2026-08-25. That infrastructure is owned by `ADR-0091` (Proposed, not Accepted) and its Story 10.9 (Blocked — pending ADR acceptance). v1 of this feature stores threshold and notification-channel-intent data only; it does not evaluate thresholds or deliver notifications. A follow-on story, not yet numbered, wires real alert-rule creation once `ADR-0091` is accepted and built.

### 4.3 Assumptions

- ~~The watchlist CRUD, alert-rule, and real-time-alert primitives are already built and stable (ADR-0044 and related work).~~ **Corrected 2026-08-25:** this assumption was wrong. `ADR-0044` covers `watchlists` CRUD only — it never defines `alert_rule`. No alert-rule or real-time-alert primitive exists anywhere in the codebase (verified by grep, both repos, 2026-08-25). The actual owning ADR, `ADR-0091`, is Proposed, not Accepted. The correct assumption for v1: **only** the watchlist CRUD primitive (`ADR-0044`) is already built and stable; alert-rule/real-time-alert primitives do not exist and are out of scope for this feature's v1 (see §4.2).
- The boolean query AST and connector primitives needed for default queries are in place (ADR-0021).
- Crisis templates are initially seeded by the platform and are read-only for tenants in v1.
- Users who may activate templates are either `Tenant-Brand-Reputation-Manager` or `Tenant-Admin`.
- At least one notification channel **identifier** must be supplied and selected at activation time, stored as intent — *(amended 2026-08-25 — originally implied a real, resolvable notification channel; no notification-channel service exists to validate against in v1)*.

### 4.4 Constraints

- Tenant data must remain isolated: one tenant cannot see another tenant's activated templates, watchlists, or alert rules.
- Platform defaults must not retroactively change already-activated tenant instances.
- Playbook content must not be treated as an enforced workflow in v1.
- The feature must avoid a production release whenever a template is added or updated.
- All activation writes occur inside a single database transaction; partial activation is not allowed.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|---|
|| `Tenant-Brand-Reputation-Manager` (primary) | Activates and owns crisis monitoring | High | Activate a crisis template in under a minute and receive alerts with a linked playbook |
|| `Tenant-Admin` (primary) | Manages tenant setup and user access | High | See which templates are active and who receives the alerts |
|| `Tenant-Social-Care-Agent` (secondary) | Responds to crisis alerts | Medium | Open the playbook from an alert and follow recommended triage steps |
|| `Tenant-User` (secondary) | May receive crisis alerts if on the recipient list | Low | See crisis alerts relevant to their role without manual configuration |
|| `Platform-Admin` | Seeds and maintains platform templates | Medium | Update or add platform templates without a full release |

---

## 6. Current State (As-Is)

**Current process:** When a reputation risk emerges, the `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` must manually define a watchlist query, choose connector sources, set alert thresholds, and agree on a response plan outside the product. This is typically done by writing a boolean query, creating an alert rule, and documenting the response steps in a separate tool or chat.

**Pain points:**
- High setup friction delays the start of monitoring during time-sensitive crises.
- Inconsistent queries and thresholds produce false positives or missed signals.
- Triage and escalation steps are not visible inside the alert, so response teams work from ad-hoc notes.
- New tenants do not have a ready-to-use starting point for brand-safety monitoring.

---

## 7. Future State (To-Be)

**New or improved process:** A brand manager opens the *Crisis Threshold Wizard* and sees a set of pre-built templates. They select a relevant scenario, review the default query and thresholds, optionally adjust them, and activate the template. The system creates a private `watchlist` for that tenant, records the activation (including the requested thresholds and notification-channel intent), and returns the playbook. **Once the `ADR-0091` follow-on ships, when the resulting alert fires, the recipient will see the playbook inline and can begin triage immediately; until then, the activated watchlist provides monitoring without automated notification** *(amended 2026-08-25 — originally read "The system creates a private `watchlist` and `alert_rule`... When the alert fires..."; no `alert_rule` exists in v1, so nothing fires yet — see ADR-0079's Amendment)*.

**Expected capabilities:**
- One-click activation of pre-built crisis monitoring for common reputation scenarios.
- Preview and customization of default query and thresholds before committing.
- A visible, linked playbook for each crisis type, surfaced at preview time now, and at alert time once the `ADR-0091` follow-on ships *(amended 2026-08-25)*.
- Per-tenant ownership and editability of the activated watchlist *(amended 2026-08-25 — originally "activated watchlists and alert rules"; no alert rule exists in v1)*.
- Template data managed as platform configuration, not hardcoded release artifacts.
- Foreign-key lifecycle management that removes the activation record when the generated watchlist is deleted *(amended 2026-08-25 — originally "when the generated watchlist or alert rule is deleted"; there is no generated alert rule to cascade from in v1)*.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | The system shall provide a platform-level `crisis_templates` table with pre-configured templates for common reputation crises | Must | Table contains `id`, `template_key`, `name`, `description`, `default_query`, `default_ast`, `parameters`, `default_thresholds`, `playbook`, and `is_active`; initial templates cover brand crisis, product recall, executive-name attack, competitor surge, and data-breach rumor | Product Owner |
|| BR-002 | The system shall record each activation in a tenant-scoped `tenant_crisis_templates` table | Must | Table contains `id`, `tenant_id`, `template_key`, `watchlist_id`, `notification_channel_ids`, `thresholds`, `variables`, `custom_thresholds`, `playbook`, `created_by_user_id`, and `created_at`; one row per activation *(amended 2026-08-25 — originally listed `alert_rule_id` instead of `notification_channel_ids`/`thresholds`; no `alert_rule` exists in v1 — see ADR-0079's Amendment)* | Product Owner |
|| BR-003 | The system shall expose an endpoint to list active crisis templates available to a tenant | Must | Returns active templates including name, default query, default thresholds, and playbook for preview; tenant users only see templates, not activations of others | Product Owner |
|| BR-004 | The system shall provide an activation endpoint that creates a `watchlist` owned by the caller and records requested thresholds and notification-channel intent | Must | `POST /v1/crisis-templates/:templateKey/activate` creates a `watchlist` from the rendered `default_ast`; stores thresholds and `notificationChannelIds` as data on `tenant_crisis_templates`; returns `tenantCrisisTemplateId`, `watchlistId`, `status`, `playbook`, `thresholds`, and `notificationChannelIds` *(amended 2026-08-25 — originally "creates a `watchlist` and `alert_rule`... returns... `alertRuleId`..."; no `alert_rule` is created in v1)* | Product Owner |
|| BR-005 | The system shall allow the user to customize the default query and thresholds before activation | Should | The wizard exposes editable thresholds and optional `customQuery`; customized values are stored in the created `watchlist` and on `tenant_crisis_templates` *(amended 2026-08-25 — originally "stored in the created `watchlist` and `alert_rule`")* | Product Owner |
|| BR-006 | The system shall not retroactively change already-activated watchlists when platform defaults change | Must | Updating a platform template does not modify the query, thresholds, or playbook of existing `tenant_crisis_templates` activations *(amended 2026-08-25 — originally "already-activated watchlists or alert rules"; no alert rule exists in v1)* | Product Owner |
|| BR-007 | The system shall return the linked playbook as advisory data with the template, and (once built) with the alert | Must | `playbook` is returned as JSON and shown in the UI; it is not executed or enforced by the back end in v1; playbook-at-alert-time is deferred to the `ADR-0091` follow-on *(amended 2026-08-25)* | Product Owner |
|| BR-008 | The admin UI shall provide a *Crisis Threshold Wizard* for template selection, preview, and activation | Must | Wizard lists active templates, shows preview, supports threshold customization, calls the activation endpoint, and navigates to the new watchlist | Product Owner |
|| BR-009 | The wizard shall surface activation errors and quota risks inline, and shall disclose that v1 does not deliver automated alerts | Should | Errors such as missing required variables, invalid thresholds, or quota risks are shown before or after activation without requiring an engineer to interpret logs; the wizard states plainly that the activated watchlist provides monitoring only, not automated notification, until a future release *(amended 2026-08-25 — added the disclosure requirement; see ADR-0079's Amendment "Negative" consequence)* | Product Owner |
|| BR-010 | Activation and related records shall respect tenant and role boundaries | Must | Only users with `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role in the tenant can activate; all created data is scoped to the tenant | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | Activation must complete and return a response within three seconds for typical templates | Performance | Should | Measured via API latency monitoring under normal load |
|| NFR-002 | Tenant activations, watchlists, and alert rules must not be visible or editable by other tenants | Security | Must | Verified by contract tests for cross-tenant 403/404 behavior |
|| NFR-003 | Platform templates must be updateable without a product release | Maintainability | Should | New or adjusted template content is read from the `crisis_templates` table, not hardcoded |
|| NFR-004 | The wizard must be keyboard navigable and responsive | Usability / Accessibility | Should | Keyboard selection and mobile layout verified in the admin UI |
|| NFR-005 | Activation actions must be attributable to a user for audit purposes | Compliance | Should | `created_by_user_id` is stored and retrievable for every activation |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | A tenant user may only activate templates on behalf of their own tenant; data is never shared across tenants. |
|| BRU-002 | Activating a template creates a tenant-owned `watchlist` instance that the tenant may later edit or delete; requested thresholds and notification-channel intent are recorded but not yet enforced *(amended 2026-08-25 — originally "creates tenant-owned `watchlist` and `alert_rule` instances"; no `alert_rule` exists in v1)*. |
|| BRU-003 | Deleting a generated `watchlist` cascades and removes the associated `tenant_crisis_templates` record *(amended 2026-08-25 — originally "Deleting a generated `watchlist` or `alert_rule`"; there is no generated `alert_rule` in v1)*. |
|| BRU-004 | Platform `crisis_templates` are not tenant-scoped and are read-only for tenant users in v1. |
|| BRU-005 | The playbook is advisory in v1; the system does not enforce steps, track completion, or raise SLA breaches. |
|| BRU-006 | Default query and thresholds are copied at activation time; later changes to the platform template do not affect existing activations. |
|| BRU-007 | Activation requires the caller to have the `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` role. |
|| BRU-008 | Only templates with `is_active = true` may be listed and activated. |
|| BRU-009 | Every `required` template parameter must be present in the supplied `variables` map or activation fails. |
|| BRU-010 | `customThresholds` and `default_thresholds` must validate against the core `AlertRuleThresholds` schema before any database write, even though v1 stores the result as data rather than creating a live, evaluating rule *(amended 2026-08-25 — the schema is reused for shape validation only; no `alert_rule` row is written in v1)*. |
|| BRU-011 | Activation requires at least one `notificationChannelIds` entry, stored as intent; v1 does not validate the entry against a real notification-channel service, because none exists *(amended 2026-08-25)*. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|---|
|| `crisis_templates` | Platform default templates, queries, thresholds, and playbooks | Platform seed data / Platform Admin | Platform | Configuration data (not PII) |
|| `tenant_crisis_templates` | Per-tenant activation record linking a template to the created `watchlist` and `alert_rule` | Activation flow | Tenant | Tenant-scoped identifiers and internal IDs |
|| `watchlist_id` | Reference to the watchlist created on activation | Existing watchlist service | Tenant | Internal reference |
|| ~~`alert_rule_id`~~ `thresholds` / `notification_channel_ids` | *(amended 2026-08-25 — originally "`alert_rule_id` \| Reference to the alert rule created on activation \| Existing alert-rule service"; no alert-rule service exists.)* Effective thresholds and requested notification-channel identifiers, stored as data on `tenant_crisis_templates` for a future `ADR-0091` follow-on to consume | Activation flow | Tenant | Tenant business configuration / internal identifiers |
|| `playbook` | Ordered triage steps with owner, action, and recommended SLA minutes | `crisis_templates` | Platform | Operational guidance (advisory) |
|| `variables` | Activation-time parameter values such as `brand_name` and `competitors` | Caller / wizard | Tenant | Tenant business inputs |
|| `custom_thresholds` | Threshold overrides supplied at activation | Caller / wizard | Tenant | Tenant business configuration |
|| `notificationChannelIds` | Requested delivery-channel identifiers, stored as intent — not resolved against a real channel service in v1 | Caller / wizard | Tenant | Internal identifiers *(amended 2026-08-25 — originally "Target delivery channels for the generated `alert_rule` \| Existing notification channel service"; no notification-channel service exists)* |
|| `created_by_user_id` | User who performed the activation | Activation flow | Tenant | Internal user identifier |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|---|
|| Number of active crisis templates per tenant | Track adoption and coverage | Product / Operations | Daily |
|| Average time to activate a template | Measure setup speed and UX improvement | Product / Engineering | Weekly |
|| Activations by crisis type | Understand which risks tenants care about most | Product / Marketing | Weekly |
|| Alert trigger rate by crisis template | Validate template relevance and threshold quality | Product / Engineering | Weekly |
|| Playbook view count from alerts | Measure playbook usefulness | Product / UX | Monthly |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
|| R-001 | Default templates may not fit every tenant, causing false positives or missed crises | Medium | Medium | Allow customization before activation; validate thresholds against `alert_rule` capabilities | Product Owner |
|| R-002 | Users may expect playbook steps to be enforced as a workflow | Medium | Low | Clearly label the playbook as advisory in v1 and document future workflow plans | UX Lead |
|| R-003 | Mustache-style parameter interpolation may produce an invalid AST | Medium | Medium | Validate and substitute variables before compiling the AST; test per template | Engineering Lead |
|| R-004 | New or updated templates require a management surface not built in v1 | Medium | Low | Seed initial templates in a migration; plan a Platform Admin management UI for later | Product Owner |
|| R-005 | Broad default queries may match too many posts and create quota or volume risk | Medium | High | Provide preview/warning before activation; support threshold and source customization | Engineering Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|---|
|| D-001 | ADR-0044 — `watchlist` primitive only | Internal / Architectural | Engineering Lead | In place; this feature reuses it *(amended 2026-08-25 — originally "watchlist and `alert_rule` primitives"; `ADR-0044` never defined `alert_rule` — see ADR-0079's Correction)* |
|| D-002 | ADR-0021 — boolean query AST | Internal / Architectural | Engineering Lead | In place for default query parsing |
|| D-003 | ADR-0091 — real-time alert rules and delivery | Internal / Architectural | Engineering Lead | **Proposed, not Accepted; Story 10.9 Blocked.** v1 of this feature does not depend on it — it stores intent data only. A follow-on story (not yet numbered) will depend on ADR-0091 once accepted and built *(amended 2026-08-25 — originally "Real-time alerts pipeline \| Internal / Existing \|... In place; this feature feeds into it" — no such pipeline exists)* | 
|| D-004 | Story 9.3 — Crisis template bundle and activation (backend) | Internal / Implementation | Engineering Lead | Required before frontend can consume the API |
|| D-005 | Story 9.4 — Crisis threshold wizard (frontend) | Internal / Implementation | Engineering Lead | Builds on Story 9.3 |
|| D-006 | *(Added 2026-08-25)* Follow-on story, not yet numbered — real `alert_rule` creation from `tenant_crisis_templates.thresholds`/`.notification_channel_ids` | Internal / Implementation | Engineering Lead | Blocked on `ADR-0091` acceptance and Story 10.9 |

---

## 14. Acceptance Criteria

- The `crisis_templates` and `tenant_crisis_templates` tables are created with the columns and foreign keys defined in ADR-0079 **as amended 2026-08-25** (no `alert_rule_id` column; `thresholds`/`notification_channel_ids` in its place).
- `crisis_templates` contains the five v1 templates: Brand Crisis, Product Recall, Executive Attack, Competitor Surge, and Data-Breach Rumor.
- `GET /v1/crisis-templates` (or equivalent list endpoint) returns the list of active templates and their preview data.
- `POST /v1/crisis-templates/:templateKey/activate` validates required variables and thresholds, creates a `watchlist` owned by the caller, records thresholds and `notificationChannelIds` on `tenant_crisis_templates`, and returns `tenantCrisisTemplateId`, `watchlistId`, `status`, `playbook`, `thresholds`, and `notificationChannelIds` *(amended 2026-08-25 — originally "creates a `watchlist` and `alert_rule`... `alertRuleId`..."; no `alert_rule` exists in v1)*.
- Activation copies the current default query, thresholds, and playbook; subsequent changes to the platform template do not affect already-activated instances.
- The playbook is returned as advisory data and is not executed or enforced by the back end in v1.
- The *Crisis Threshold Wizard* lists active templates, shows default query/default thresholds/playbook, allows threshold customization, calls the activation endpoint, and navigates to the new watchlist — **and discloses that v1 does not deliver automated alerts** *(amended 2026-08-25)*.
- Activation errors and quota risks are surfaced inline in the wizard.
- Cross-tenant access is blocked; tenant users cannot see or modify another tenant's activations.
- Deleting a generated `watchlist` cascades and removes the related `tenant_crisis_templates` record *(amended 2026-08-25 — originally "Deleting a generated `watchlist` or `alert_rule`"; no `alert_rule` exists in v1)*.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| Crisis template | A pre-configured bundle of watchlist query, alert thresholds, and playbook for a common reputation crisis. |
|| Playbook | An ordered set of recommended triage steps, owners, and time-boxed actions linked to a crisis template. |
|| Activation | The act of creating a tenant-scoped `watchlist` from a platform crisis template and recording the requested thresholds and notification-channel intent *(amended 2026-08-25 — originally "creating a tenant-scoped `watchlist` and `alert_rule`"; no `alert_rule` exists in v1)*. |
|| Watchlist | A saved boolean query that defines which posts a tenant is monitoring. |
|| Alert rule | *(Not built in v1.)* A threshold and delivery configuration linked to a watchlist that triggers real-time alerts — owned by `ADR-0091` (Proposed), not this feature. Crisis-template activation records the data an eventual `alert_rule` will need, but does not create one *(amended 2026-08-25)*. |
|| `crisis_templates` | Platform-wide table storing default crisis templates. |
|| `tenant_crisis_templates` | Per-tenant table recording each template activation. |
|| Brand crisis | A reputation scenario marked by negative sentiment combined with a volume spike. |
|| Product recall | A scenario combining brand, product name, and negative sentiment signals. |
|| Executive-name attack | A scenario targeting an executive's name with negative sentiment and high reach. |
|| Competitor surge | A scenario involving a competitor name and a volume spike. |
|| Data-breach rumor | A scenario matching brand references to breach/hack/leaked language. |

---

## 16. Appendices

### Reference documents

- ADR-0079 — `docs/adr/0079-crisis-template-bundle-and-activation.md` (source, Accepted 2026-08-23; amended 2026-08-25 — see that ADR's own Correction and Amendment sections)
- Feature design — `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Feature-to-ADR scoping — `docs/product-research/feature-adr-scoping.md`
- User stories — `docs/user-stories/epic-9-adr-0077-to-0085.md`
  - Story 9.3 — Crisis template bundle and activation (backend)
  - Story 9.4 — Crisis threshold wizard (frontend)
- Related ADRs — ADR-0044 (watchlist CRUD only, not `alert_rule` — corrected 2026-08-25), ADR-0021 (boolean query AST), ADR-0091 (real-time alert rules and delivery — Proposed, not Accepted; owns the deferred `alert_rule` follow-on)

### Missing source

- No `docs/product-research/reports/20-crisis-threshold-wizard-deep-research.md` (or equivalent deep-research report) was found for this feature.

---

## 17. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
